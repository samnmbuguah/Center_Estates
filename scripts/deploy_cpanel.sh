#!/usr/bin/env bash
# Center Estates ERP split cPanel deployment.
# Frontend: centerestates.com (Node/Next); API: api.centerestates.com (Python/Django).

set -euo pipefail

REMOTE_HOST="${1:-host}"
DOMAIN="${2:-centerestates.com}"
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

if [[ ( "$DEPLOY_SCOPE" == "full" || "$DEPLOY_SCOPE" == "frontend" ) && "${SKIP_BUILD:-0}" != "1" ]]; then
  NEXT_PUBLIC_API_BASE_URL="https://${API_DOMAIN}/api/v1" npm --prefix apps/web run build
fi

if [[ "$DEPLOY_SCOPE" == "full" || "$DEPLOY_SCOPE" == "backend" ]]; then
tar -czf "$BACKEND_ARCHIVE" \
  --exclude='apps/backend/.env' \
  --exclude='__pycache__' \
  --exclude='*.pyc' \
  --exclude='apps/backend/db.sqlite3' \
  --exclude='apps/backend/media' \
  --exclude='apps/backend/staticfiles' \
  --exclude='apps/web/.next/cache' \
  --exclude='apps/web/.next/dev' \
  --exclude='apps/web/.next/types' \
  --exclude='apps/web/.next/trace' \
  passenger_wsgi.py apps/backend

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
  mkdir -p tmp
  touch tmp/restart.txt
  # CloudLinux LiteSpeed keeps a preloaded lswsgi master alive across the
  # conventional restart-file touch. Terminate only this application's exact
  # worker command so the next request starts a clean Python process.
  app_pids=\$(pgrep -u \$(id -u) -f '^/opt/alt/python39/bin/lswsgi -m ${API_PATH}/passenger_wsgi.py\$' || true)
  for app_pid in \${app_pids}; do
    kill -TERM "\${app_pid}" 2>/dev/null || true
  done
"
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
    test -f \"\${standalone}/server.js\"
    rm -rf \"\${standalone}/.next/static\" \"\${standalone}/public\"
    mkdir -p \"\${standalone}/.next\"
    cp -a apps/web/.next/static \"\${standalone}/.next/static\"
    cp -a apps/web/public \"\${standalone}/public\"
    mkdir -p tmp
    touch tmp/restart.txt
  "
fi

echo "Deployment complete: https://${DOMAIN} and https://${API_DOMAIN}"
