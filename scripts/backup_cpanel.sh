#!/usr/bin/env bash
# Create a recoverable cPanel application-state backup before a release or on schedule.
# Usage: scripts/backup_cpanel.sh [ssh-host] [domain] [api-domain]

set -euo pipefail

REMOTE_HOST="${1:-host}"
DOMAIN="${2:-centerestates.com}"
API_DOMAIN="${3:-api.centerestates.com}"
BACKUP_DIR="/home2/monitori/backups"
API_PATH="/home2/monitori/${API_DOMAIN}"

STAMP="$(date -u +%Y%m%dT%H%M%SZ)"

ssh "$REMOTE_HOST" "
  set -e
  mkdir -p '${BACKUP_DIR}'
  archive='${BACKUP_DIR}/center-estates-backup-${STAMP}.tar.gz'
  
  if [ -f '${API_PATH}/apps/backend/db.sqlite3' ]; then
    cd '${API_PATH}'
    targets='apps/backend/db.sqlite3'
    if [ -d 'apps/backend/media' ]; then targets=\"\${targets} apps/backend/media\"; fi
    if [ -f 'apps/backend/.env' ]; then targets=\"\${targets} apps/backend/.env\"; fi

    tar -czf \"\${archive}\" \${targets}
    sha256sum \"\${archive}\" > \"\${archive}.sha256\"
    echo \"Backup created: \${archive} (\$(du -h \"\${archive}\" | cut -f1))\"
    # Retain backups for 30 days
    find '${BACKUP_DIR}' -type f -name 'center-estates-backup-*' -mtime +30 -delete
  else
    echo 'No database found to back up at ${API_PATH}/apps/backend/db.sqlite3' >&2
    exit 1
  fi
"

