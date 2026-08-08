#!/usr/bin/env bash
# Create a recoverable cPanel application-state backup before a release.
# Usage: scripts/backup_cpanel.sh [ssh-host] [domain]

set -euo pipefail

REMOTE_HOST="${1:-host}"
DOMAIN="${2:-centerestates.com}"
REMOTE_PATH="/home2/monitori/${DOMAIN}"

ssh "$REMOTE_HOST" "
  set -e
  cd '${REMOTE_PATH}'
  mkdir -p backups
  stamp=\$(date -u +%Y%m%dT%H%M%SZ)
  archive=\"backups/center-estates-state-\${stamp}.tar.gz\"
  targets='apps/backend/db.sqlite3'
  if [ -d apps/backend/media ]; then targets=\"\${targets} apps/backend/media\"; fi
  tar -czf \"\${archive}\" \${targets}
  sha256sum \"\${archive}\" > \"\${archive}.sha256\"
  find backups -type f -name 'center-estates-state-*' -mtime +14 -delete
  printf '%s\n' \"\${archive}\"
"
