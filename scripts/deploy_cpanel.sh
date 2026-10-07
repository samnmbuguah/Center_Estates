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
CPANEL_USER="${CPANEL_USER:-$USER}"
CPANEL_HOME="${CPANEL_HOME:-/home2/${CPANEL_USER}}"
FRONTEND_PATH="${CPANEL_HOME}/${DOMAIN}"
API_PATH="${CPANEL_HOME}/${API_DOMAIN}"
PYTHON_VENV="${CPANEL_HOME}/virtualenv/${API_DOMAIN}/3.9/bin/activate"
NODE_VENV="${CPANEL_HOME}/nodevenv/${DOMAIN}/24/bin/activate"
BACKEND_ARCHIVE="$(mktemp /tmp/center-estates-api.XXXXXX.tar.gz)"
FRONTEND_ARCHIVE="$(mktemp /tmp/center-estates-web.XXXXXX.tar.gz)"
DEPLOY_SCOPE="${DEPLOY_SCOPE:-full}"
# Optional SSH port override so the deploy can target a host directly (e.g. when
# an ssh alias still points at a retired address) without editing ssh config.
SSH_PORT="${SSH_PORT:-}"
SSH_OPTS=(-o ConnectTimeout=30)
SCP_OPTS=(-o ConnectTimeout=30)
if [[ -n "$SSH_PORT" ]]; then
  SSH_OPTS+=(-p "$SSH_PORT")
  SCP_OPTS+=(-P "$SSH_PORT")
fi
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
  if .venv/bin/python manage.py makemigrations --check --dry-run && \
    .venv/bin/python -m pytest companion.tests properties.tests -x -q --tb=short --reuse-db --nomigrations 2>&1; then
    echo "All tests passed."
  else
    echo "Some tests failed. Aborting deploy." >&2
    exit 1
  fi
  cd ../..
fi

# A frontend-only release cannot mutate database or media, so avoid spending
# several minutes taking an unnecessary production backup. Backend/full
# releases keep the safety snapshot by default.
if [[ ( "$DEPLOY_SCOPE" == "full" || "$DEPLOY_SCOPE" == "backend" ) && "${SKIP_BACKUP:-0}" != "1" ]]; then
  echo "Taking pre-deploy backup..."
  "$(dirname "$0")/backup_cpanel.sh" "${REMOTE_HOST}" "${DOMAIN}" "${API_DOMAIN}" || echo "Warning: Pre-deploy backup encountered an issue; proceeding cautiously."
fi

FRONTEND_BUILD_PID=""
if [[ ( "$DEPLOY_SCOPE" == "full" || "$DEPLOY_SCOPE" == "frontend" ) && "${SKIP_BUILD:-0}" != "1" ]]; then
  FRONTEND_FINGERPRINT="$({
    find apps/web -type f \
      -not -path 'apps/web/.next/*' \
      -not -path 'apps/web/node_modules/*' \
      -print0
    printf '%s\0' package.json package-lock.json
  } | sort -z | xargs -0 sha256sum | sha256sum | awk '{print $1}')"
  BUILT_FINGERPRINT="$(cat apps/web/.next/.cpanel-source.sha256 2>/dev/null || true)"
  if [[ "$FRONTEND_FINGERPRINT" == "$BUILT_FINGERPRINT" && -f apps/web/.next/standalone/apps/web/server.js ]]; then
    echo "Frontend source unchanged; reusing verified standalone build."
  else
    echo "Building frontend (webpack 55s, type-check skipped for speed; run \`npm run type-check\` separately)..."
    SKIP_TYPE_CHECK=1 NEXT_BUILD_WORKERS=1 NODE_OPTIONS="--max-old-space-size=4096" NEXT_PUBLIC_API_BASE_URL="https://${API_DOMAIN}/api/v1" npm --prefix apps/web run build > /tmp/cpanel-frontend-build.log 2>&1 &
    FRONTEND_BUILD_PID=$!
  fi
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

scp "${SCP_OPTS[@]}" "$BACKEND_ARCHIVE" "${REMOTE_HOST}:${API_PATH}/deploy-api.tar.gz"
api_htaccess="$(mktemp /tmp/cpanel-api.XXXXXX.htaccess)"
sed "s|/home2/username|${CPANEL_HOME}|g" "scripts/cpanel-api.htaccess" > "${api_htaccess}"
scp "${SCP_OPTS[@]}" "${api_htaccess}" "${REMOTE_HOST}:${API_PATH}/.htaccess"
rm -f "${api_htaccess}"

ssh "${SSH_OPTS[@]}" "$REMOTE_HOST" "bash -s" <<EOF
  set -e
  source '${PYTHON_VENV}'
  cd '${API_PATH}'
  tar -xzf deploy-api.tar.gz
  rm -f deploy-api.tar.gz
  find apps/backend -type f -name '*.py[co]' -delete
  find apps/backend -type d -name '__pycache__' -empty -delete
  requirements_hash=\$(sha256sum apps/backend/requirements.txt | awk '{print \$1}')
  installed_hash=\$(cat .requirements.sha256 2>/dev/null || true)
  if [ "\${requirements_hash}" != "\${installed_hash}" ]; then
    python -m pip install --quiet -r apps/backend/requirements.txt PyMySQL
    printf '%s\n' "\${requirements_hash}" > .requirements.sha256
  else
    echo 'Python dependencies unchanged; skipping pip install.'
  fi
  python apps/backend/manage.py migrate --noinput
  python apps/backend/manage.py collectstatic --noinput
  (crontab -l 2>/dev/null | grep -vF '# center-estates-scheduled-reports'; echo "*/15 * * * * cd ${API_PATH} && ${PYTHON_VENV%/*}/python apps/backend/manage.py run_scheduled_reports >> ${API_PATH}/scheduled-reports.log 2>&1 # center-estates-scheduled-reports") | crontab -
  (crontab -l 2>/dev/null | grep -vF '# center-estates-calendar-notifications'; echo "17 * * * * cd ${API_PATH} && ${PYTHON_VENV%/*}/python apps/backend/manage.py sync_calendar_notifications >> ${API_PATH}/calendar-notifications.log 2>&1 # center-estates-calendar-notifications") | crontab -
  (crontab -l 2>/dev/null | grep -vF '# center-estates-sales-reservations'; echo "*/30 * * * * cd ${API_PATH} && ${PYTHON_VENV%/*}/python apps/backend/manage.py sync_sales_reservations >> ${API_PATH}/sales-reservations.log 2>&1 # center-estates-sales-reservations") | crontab -
  (crontab -l 2>/dev/null | grep -vF '# center-estates-daily-backup'; echo "30 2 * * * ${CPANEL_HOME}/scripts/backup_database.sh >> ${CPANEL_HOME}/backups/backup.log 2>&1 # center-estates-daily-backup") | crontab -

  killall -9 lswsgi 2>/dev/null || true
  mkdir -p tmp
  touch tmp/restart.txt
  # Kill stale Python workers matching this application's exact command.
  app_pids=\$(pgrep -u \$(id -u) -f "^/opt/alt/python39/bin/lswsgi -m ${API_PATH}/passenger_wsgi.py" || true)
  for app_pid in \${app_pids}; do
    kill -TERM "\${app_pid}" 2>/dev/null || true
  done
  # Wait for graceful shutdown, then force-kill stragglers
  sleep 3
  app_pids=\$(pgrep -u \$(id -u) -f "^/opt/alt/python39/bin/lswsgi -m ${API_PATH}/passenger_wsgi.py" || true)
  for app_pid in \${app_pids}; do
    kill -9 "\${app_pid}" 2>/dev/null || true
  done
  sleep 2
EOF

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

if [[ -n "${FRONTEND_BUILD_PID:-}" ]]; then
  echo "Waiting for frontend build (pid $FRONTEND_BUILD_PID, ~55s)..."
  if ! wait "$FRONTEND_BUILD_PID"; then
    echo "Frontend build failed; see /tmp/cpanel-frontend-build.log" >&2
    cat /tmp/cpanel-frontend-build.log | tail -40 >&2
    exit 1
  fi
  printf '%s\n' "$FRONTEND_FINGERPRINT" > apps/web/.next/.cpanel-source.sha256
  echo "Frontend build complete."
fi

if [[ "$DEPLOY_SCOPE" == "full" || "$DEPLOY_SCOPE" == "frontend" ]]; then
  # NEXT_PUBLIC_* values are compiled into the browser bundle. Refuse to ship
  # an artifact built without the production API origin, which would otherwise
  # send authenticated requests to centerestates.com/api and return 404.
  if ! grep -Rqs "https://${API_DOMAIN}/api/v1" apps/web/.next/static/chunks; then
    echo "Frontend artifact does not contain the production API base URL; rebuild with NEXT_PUBLIC_API_BASE_URL=https://${API_DOMAIN}/api/v1." >&2
    exit 1
  fi
  tar -czf "$FRONTEND_ARCHIVE" \
    app.js apps/web/.next/standalone apps/web/.next/static apps/web/public
  scp "${SCP_OPTS[@]}" "$FRONTEND_ARCHIVE" "${REMOTE_HOST}:${FRONTEND_PATH}/deploy-web.tar.gz"
  web_htaccess="$(mktemp /tmp/cpanel-web.XXXXXX.htaccess)"
  sed "s|/home2/username|${CPANEL_HOME}|g" "scripts/cpanel-web.htaccess" > "${web_htaccess}"
  scp "${SCP_OPTS[@]}" "${web_htaccess}" "${REMOTE_HOST}:${FRONTEND_PATH}/.htaccess"
  rm -f "${web_htaccess}"
  ssh "${SSH_OPTS[@]}" "$REMOTE_HOST" "bash -s" <<EOF
    set -e
    source '${NODE_VENV}'
    cd '${FRONTEND_PATH}'
    release_id=\$(tar -xOf deploy-web.tar.gz apps/web/.next/standalone/apps/web/.next/BUILD_ID | tr -d '\r\n')
    test -n "\${release_id}"
    release_root="${FRONTEND_PATH}/releases/\${release_id}"
    previous_target=\$(readlink -f current 2>/dev/null || true)
    rm -rf "\${release_root}"
    mkdir -p "\${release_root}"
    tar -xzf deploy-web.tar.gz -C "\${release_root}"
    rm -f deploy-web.tar.gz
    # Next's standalone output ships the exact runtime dependency tree. This
    # avoids cPanel's workspace/node_modules symlink limitation and removes a
    # slow npm install from every web release.
    standalone="\${release_root}/apps/web/.next/standalone/apps/web"
    test -f "\${standalone}/server.js"
    # Next's monorepo standalone build emits an absolute node_modules symlink
    # that points at the build machine's workspace (e.g. /root/Dev/...). That
    # path does not exist on the server, so Node intermittently fails to resolve
    # 'next' during module lookup and Passenger returns HTTP 500. Repoint the
    # symlink at the standalone node_modules that ships alongside the server.
    if [ -L "\${standalone}/node_modules" ]; then
      rm -f "\${standalone}/node_modules"
      ln -s ../../node_modules "\${standalone}/node_modules"
    fi
    mkdir -p "\${standalone}/.next/static" "\${standalone}/public"
    cp -a "\${release_root}/apps/web/.next/static/." "\${standalone}/.next/static/"
    cp -a "\${release_root}/apps/web/public/." "\${standalone}/public/" 2>/dev/null || true
    # Preserve immutable chunks from the previous release for tabs that were
    # already open, then switch the entire runtime atomically.
    if [ -d current/.next/static ]; then
      cp -an current/.next/static/. "\${standalone}/.next/static/" 2>/dev/null || true
    elif [ -d apps/web/.next/standalone/apps/web/.next/static ]; then
      cp -an apps/web/.next/standalone/apps/web/.next/static/. "\${standalone}/.next/static/" 2>/dev/null || true
    fi
    test "\$(cat "\${standalone}/.next/BUILD_ID")" = "\${release_id}"
    missing_assets=0
    manifest_assets=\$(mktemp)
    grep -Rho 'static/chunks/[^" ]*\.js' "\${standalone}/.next"/*.json "\${standalone}/.next/server"/*.json 2>/dev/null | sort -u > "\${manifest_assets}" || true
    while IFS= read -r asset; do
      [ -z "\${asset}" ] && continue
      if [ ! -f "\${standalone}/.next/\${asset}" ]; then
        echo "Missing staged Next.js asset: \${asset}" >&2
        missing_assets=1
      fi
    done < "\${manifest_assets}"
    rm -f "\${manifest_assets}"
    test "\${missing_assets}" = 0
    ln -sfn "\${standalone}" current.next
    mv -Tf current.next current
    # Serve immutable Next.js assets directly from LiteSpeed. Routing dozens
    # of browser chunks through Passenger makes page startup depend on the
    # Node worker and causes ChunkLoadError timeouts during host contention.
    mkdir -p _next
    ln -sfn "\${standalone}/.next/static" _next/static.next
    mv -Tf _next/static.next _next/static
    cp "\${release_root}/app.js" app.js
    mkdir -p tmp
    touch tmp/restart.txt
    # When deploying centerestates.com, cPanel binds the main domain to public_html.
    # Keep public_html synchronized with .htaccess, _next static assets, and public files.
    if [ "${FRONTEND_PATH}" = "${CPANEL_HOME}/centerestates.com" ] && [ -d "${CPANEL_HOME}/public_html" ]; then
      cp -a .htaccess "${CPANEL_HOME}/public_html/.htaccess" 2>/dev/null || true
      ln -sfn "${FRONTEND_PATH}/_next" "${CPANEL_HOME}/public_html/_next" 2>/dev/null || true
      cp -an "${standalone}/public/." "${CPANEL_HOME}/public_html/" 2>/dev/null || true
    fi
    # Kill stale Next.js workers matching this application's path.
    # A worker whose release directory has been replaced reports its cwd with a
    # " (deleted)" suffix, so strip it before matching; otherwise the previous
    # build's worker survives and keeps serving the old frontend.
    web_pids=\$(ps -u \$(id -u) -o pid=,comm= | awk '\$2 == "next-server" {print \$1}')
    for web_pid in \${web_pids}; do
      cwd="\$(readlink /proc/\${web_pid}/cwd 2>/dev/null || true)"
      cwd="\${cwd% (deleted)}"
      if [[ "\${cwd}" == "${FRONTEND_PATH}/releases/"*/apps/web/.next/standalone/apps/web || "\${cwd}" = "${FRONTEND_PATH}/apps/web/.next/standalone/apps/web" ]]; then
        kill -TERM "\${web_pid}" 2>/dev/null || true
      fi
    done
    # Wait up to 10s for graceful shutdown, then force-kill stragglers
    sleep 3
    web_pids=\$(ps -u \$(id -u) -o pid=,comm= | awk '\$2 == "next-server" {print \$1}')
    for web_pid in \${web_pids}; do
      cwd="\$(readlink /proc/\${web_pid}/cwd 2>/dev/null || true)"
      cwd="\${cwd% (deleted)}"
      if [[ "\${cwd}" == "${FRONTEND_PATH}/releases/"*/apps/web/.next/standalone/apps/web || "\${cwd}" = "${FRONTEND_PATH}/apps/web/.next/standalone/apps/web" ]]; then
        kill -9 "\${web_pid}" 2>/dev/null || true
      fi
    done
    sleep 2
    # Verify a fresh worker spawned (Passenger auto-restarts on next request)
    curl -sf https://${DOMAIN}/ > /dev/null 2>&1 || true
    new_pids=\$(ps -u \$(id -u) -o pid=,comm= | awk '\$2 == "next-server" {print \$1}' | wc -l)
    echo "Active next-server workers after restart: \${new_pids}"
    live_check="https://${DOMAIN}/property?deployment-check=\${release_id}"
    live_html=\$(mktemp)
    release_valid=1
    if ! curl --fail --silent --show-error --max-time 30 "\${live_check}" -o "\${live_html}"; then
      release_valid=0
    fi
    if [ "\${release_valid}" = 1 ] && ! curl --silent --show-error --head --max-time 30 "\${live_check}" | tr -d '\r' | grep -qi '^cache-control:.*no-store'; then
      echo 'Live application HTML is missing the required no-store policy.' >&2
      release_valid=0
    fi
    if [ "\${release_valid}" = 1 ]; then
      live_assets=\$(mktemp)
      grep -oE '(src|href)="[^"]+\.js[^"]*"' "\${live_html}" | sed -E 's/^(src|href)="([^"]+)"$/\2/' | sort -u > "\${live_assets}" || true
      while IFS= read -r asset; do
        [ -z "\${asset}" ] && continue
        if ! curl --fail --silent --show-error --max-time 30 "https://${DOMAIN}\${asset}" >/dev/null; then
          echo "Live chunk failed validation: \${asset}" >&2
          release_valid=0
          break
        fi
      done < "\${live_assets}"
      rm -f "\${live_assets}"
    fi
    rm -f "\${live_html}"
    if [ "\${release_valid}" != 1 ]; then
      if [ -n "\${previous_target}" ] && [ -d "\${previous_target}" ]; then
        echo "Release validation failed; rolling back to \${previous_target}." >&2
        ln -sfn "\${previous_target}" current.rollback
        mv -Tf current.rollback current
        touch tmp/restart.txt
      fi
      exit 1
    fi
    # Prune historical releases to prevent inode accumulation (keep active + 2 rollback targets)
    if [ -d releases ]; then
      ls -td releases/* 2>/dev/null | tail -n +4 | xargs rm -rf 2>/dev/null || true
    fi
EOF
  # Gate the release on the frontend actually serving traffic. A broken
  # standalone runtime (e.g. an unresolved node_modules symlink) can start
  # Passenger but return HTTP 500 for every request; fail loudly instead.
  web_ready=0
  for attempt in {1..12}; do
    if curl --fail --silent --show-error --max-time 10 "https://${DOMAIN}/" >/dev/null; then
      web_ready=1
      break
    fi
    sleep 2
  done
  if [[ "$web_ready" != "1" ]]; then
    echo "Frontend did not become healthy after restart; check ${FRONTEND_PATH}/stderr.log." >&2
    exit 1
  fi
fi

echo "Deployment complete: https://${DOMAIN} and https://${API_DOMAIN}"
