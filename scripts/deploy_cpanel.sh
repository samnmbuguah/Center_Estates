#!/usr/bin/env bash
# Center Estates ERP cPanel/Passenger deployment.
# Usage: scripts/deploy_cpanel.sh [ssh-host] [domain]

set -euo pipefail

REMOTE_HOST="${1:-host}"
DOMAIN="${2:-centerestates.com}"
REMOTE_PATH="/home2/monitori/${DOMAIN}"
VENV_PATH="/home2/monitori/virtualenv/${DOMAIN}/3.9/bin/activate"
ARCHIVE="$(mktemp /tmp/center-estates-deploy.XXXXXX.tar.gz)"
trap 'rm -f "$ARCHIVE"' EXIT

echo "Deploying Center Estates ERP to ${REMOTE_HOST}:${REMOTE_PATH}"

if [[ "${SKIP_BUILD:-0}" != "1" ]]; then
  npm --prefix apps/web run build
fi

tar -czf "$ARCHIVE" \
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
  passenger_wsgi.py \
  apps/backend \
  apps/web/.next \
  apps/web/public \
  apps/web/package.json

scp "$ARCHIVE" "${REMOTE_HOST}:${REMOTE_PATH}/deploy.tar.gz"

ssh "$REMOTE_HOST" "
  set -e
  source '${VENV_PATH}'
  cd '${REMOTE_PATH}'
  tar -xzf deploy.tar.gz
  rm -f deploy.tar.gz
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
"

echo "Deployment complete: https://${DOMAIN}"
