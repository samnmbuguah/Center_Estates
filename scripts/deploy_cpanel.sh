#!/usr/bin/env bash
# Center Estates ERP split cPanel deployment.
# Frontend: centerestates.com (Node/Next); API: api.centerestates.com (Python/Django).
#
# Usage:
#   ./deploy_cpanel.sh [REMOTE_HOST] [DOMAIN] [--run-tests]
#
# Options:
#   --run-tests    Run backend tests before deploying (optional, skipped by default)

set -euo pipefail

REMOTE_HOST="${1:-host}"
DOMAIN="${2:-centerestates.com}"
RUN_TESTS=0

# Parse optional flags
for arg in "$@"; do
  case "$arg" in
    --run-tests) RUN_TESTS=1 ;;
  esac
done
API_DOMAIN="${API_DOMAIN:-api.centerestates.com}"
FRONTEND_PATH="/home2/monitori/${DOMAIN}"
API_PATH="/home2/monitori/${API_DOMAIN}"
PYTHON_VENV="/home2/monitori/virtualenv/${API_DOMAIN}/3.9/bin/activate"
NODE_VENV="/home2/monitori/nodevenv/${DOMAIN}/24/bin/activate"
BACKEND_ARCHIVE="$(mktemp /tmp/center-estates-api.XXXXXX.tar.gz)"
FRONTEND_ARCHIVE="$(mktemp /tmp/center-estates-web.XXXXXX.tar.gz)"
DEPLOY_SCOPE="${DEPLOY_SCOPE:-full}"
trap 'rm -f "$BACKEND_ARCHIVE" "$FRONTEND_ARCHIVE"' EXIT

if [[ "$DEPLOY_SCOPE" != "full" && "$DEPLOY_SCOPE" != "backend" && "$DEPLOY_SCOPE" != "frontend" ]]; then
  echo "DEPLOY_SCOPE must be 'full', 'backend', or 'frontend'." >&2
  exit 2
fi

echo "Deploying API to ${REMOTE_HOST}:${API_PATH} and frontend to ${REMOTE_HOST}:${FRONTEND_PATH}"

# Optional: run backend tests before deploying
if [[ "$RUN_TESTS" == "1" ]]; then
  echo "Running backend tests before deploy..."
  cd apps/backend
  if .venv/bin/python -m pytest companion.tests properties.tests -x -q --tb=short 2>&1; then
    echo "All tests passed."
  else
    echo "Some tests failed. Aborting deploy." >&2
    exit 1
  fi
  cd ../..
fi

# Always take a snapshot of live database and media before release
if [[ "${SKIP_BACKUP:-0}" != "1" ]]; then
  echo "Taking pre-deploy backup..."
  "$(dirname "$0")/backup_cpanel.sh" "${REMOTE_HOST}" "${DOMAIN}" "${API_DOMAIN}" || echo "Warning: Pre-deploy backup encountered an issue; proceeding cautiously."
fi

if [[ ( "$DEPLOY_SCOPE" == "full" || "$DEPLOY_SCOPE" == "frontend" ) && "${SKIP_BUILD:-0}" != "1" ]]; then
  NEXT_BUILD_WORKERS=1 NODE_OPTIONS="--max-old-space-size=4096" NEXT_PUBLIC_API_BASE_URL="https://${API_DOMAIN}/api/v1" npm --prefix apps/web run build
fi

if [[ "$DEPLOY_SCOPE" == "full" || "$DEPLOY_SCOPE" == "backend" ]]; then
tar -czf "$BACKEND_ARCHIVE" \
  --exclude='apps/backend/.env' \
  --exclude='apps/backend/.venv' \
  --exclude='apps/backend/.pytest_cache' \
  --exclude='__pycache__' \
  --exclude='*.pyc' \
  --exclude='apps/backend/db.sqlite3' \
  --exclude='apps/backend/media' \
  --exclude='apps/backend/staticfiles' \
  --exclude='apps/web/.next/cache' \
  --exclude='apps/web/.next/dev' \
  --exclude='apps/web/.next/types' \
  --exclude='apps/web/.next/trace' \
  passenger_wsgi.py apps/backend apps/web/public/center-estates-logo.png

scp "$BACKEND_ARCHIVE" "${REMOTE_HOST}:${API_PATH}/deploy-api.tar.gz"

ssh "$REMOTE_HOST" "
  set -e
  source '${PYTHON_VENV}'
  cd '${API_PATH}'
  tar -xzf deploy-api.tar.gz
  rm -f deploy-api.tar.gz
  find apps/backend -type f -name '*.py[co]' -delete
  find apps/backend -type d -name '__pycache__' -empty -delete
  requirements_hash=\$(sha256sum apps/backend/requirements.txt | awk '{print \$1}')
  installed_hash=\$(cat .requirements.sha256 2>/dev/null || true)
  if [ \"\${requirements_hash}\" != \"\${installed_hash}\" ]; then
    python -m pip install --quiet -r apps/backend/requirements.txt PyMySQL
    printf '%s\\n' \"\${requirements_hash}\" > .requirements.sha256
  else
    echo 'Python dependencies unchanged; skipping pip install.'
  fi
  python apps/backend/manage.py migrate --noinput
  python apps/backend/manage.py collectstatic --noinput
  python apps/backend/manage.py check --deploy
  (crontab -l 2>/dev/null | grep -vF '# center-estates-scheduled-reports'; printf '%s\n' '*/15 * * * * cd ${API_PATH} && ${API_PATH%/*}/virtualenv/${API_DOMAIN}/3.9/bin/python apps/backend/manage.py run_scheduled_reports >> ${API_PATH}/scheduled-reports.log 2>&1 # center-estates-scheduled-reports') | crontab -
  (crontab -l 2>/dev/null | grep -vF '# center-estates-calendar-notifications'; printf '%s\n' '17 * * * * cd ${API_PATH} && ${API_PATH%/*}/virtualenv/${API_DOMAIN}/3.9/bin/python apps/backend/manage.py sync_calendar_notifications >> ${API_PATH}/calendar-notifications.log 2>&1 # center-estates-calendar-notifications') | crontab -
  mkdir -p tmp
  touch tmp/restart.txt
  # Kill stale Python workers matching this application's exact command.
  app_pids=\$(pgrep -u \$(id -u) -f '^/opt/alt/python39/bin/lswsgi -m ${API_PATH}/passenger_wsgi.py\$' || true)
  for app_pid in \${app_pids}; do
    kill -TERM "\${app_pid}" 2>/dev/null || true
  done
  # Wait for graceful shutdown, then force-kill stragglers
  sleep 3
  app_pids=\$(pgrep -u \$(id -u) -f '^/opt/alt/python39/bin/lswsgi -m ${API_PATH}/passenger_wsgi.py\$' || true)
  for app_pid in \${app_pids}; do
    kill -9 "\${app_pid}" 2>/dev/null || true
  done
  sleep 2
"

  # Do not move on to the frontend release while the restarted API is still
  # warming up. Existing browser sessions can refresh their access token as
  # soon as this health gate succeeds.
  api_ready=0
  for attempt in {1..12}; do
    if curl --fail --silent --show-error --max-time 10 "https://${API_DOMAIN}/api/v1/health/" >/dev/null; then
      api_ready=1
      break
    fi
    sleep 2
  done
  if [[ "$api_ready" != "1" ]]; then
    echo "API did not become healthy after restart; frontend deployment stopped." >&2
    exit 1
  fi
fi

if [[ "$DEPLOY_SCOPE" == "full" || "$DEPLOY_SCOPE" == "frontend" ]]; then
  tar -czf "$FRONTEND_ARCHIVE" \
    app.js apps/web/.next/standalone apps/web/.next/static apps/web/public
  scp "$FRONTEND_ARCHIVE" "${REMOTE_HOST}:${FRONTEND_PATH}/deploy-web.tar.gz"
  ssh "$REMOTE_HOST" "
    set -e
    source '${NODE_VENV}'
    cd '${FRONTEND_PATH}'
    tar -xzf deploy-web.tar.gz
    rm -f deploy-web.tar.gz
    # Next's standalone output ships the exact runtime dependency tree. This
    # avoids cPanel's workspace/node_modules symlink limitation and removes a
    # slow npm install from every web release.
    standalone='apps/web/.next/standalone/apps/web'
    test -f "\${standalone}/server.js"
    mkdir -p "\${standalone}/.next/static" "\${standalone}/public"
    cp -rn apps/web/.next/static/* "\${standalone}/.next/static/" 2>/dev/null || cp -a apps/web/.next/static/* "\${standalone}/.next/static/"
    cp -a apps/web/public/* "\${standalone}/public/" 2>/dev/null || true
    mkdir -p tmp
    touch tmp/restart.txt
    # Kill stale Next.js workers matching this application's path.
    # First try SIGTERM for graceful shutdown, then SIGKILL if needed.
    web_pids=\$(ps -u \$(id -u) -o pid=,comm= | awk '\$2 == \"next-server\" {print \$1}')
    for web_pid in \${web_pids}; do
      if [ \"\$(readlink /proc/\${web_pid}/cwd 2>/dev/null || true)\" = \"${FRONTEND_PATH}/apps/web/.next/standalone/apps/web\" ]; then
        kill -TERM \"\${web_pid}\" 2>/dev/null || true
      fi
    done
    # Wait up to 10s for graceful shutdown, then force-kill stragglers
    sleep 3
    web_pids=\$(ps -u \$(id -u) -o pid=,comm= | awk '\$2 == \"next-server\" {print \$1}')
    for web_pid in \${web_pids}; do
      if [ \"\$(readlink /proc/\${web_pid}/cwd 2>/dev/null || true)\" = \"${FRONTEND_PATH}/apps/web/.next/standalone/apps/web\" ]; then
        kill -9 \"\${web_pid}\" 2>/dev/null || true
      fi
    done
    sleep 2
    # Verify a fresh worker spawned (Passenger auto-restarts on next request)
    curl -sf https://${DOMAIN}/ > /dev/null 2>&1 || true
    new_pids=\$(ps -u \$(id -u) -o pid=,comm= | awk '\$2 == \"next-server\" {print \$1}' | wc -l)
    echo \"Active next-server workers after restart: \${new_pids}\"
  "
fi

echo "Deployment complete: https://${DOMAIN} and https://${API_DOMAIN}"
