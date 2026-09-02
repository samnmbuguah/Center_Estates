#!/usr/bin/env bash
# Create a recoverable cPanel application-state backup before a release or on schedule.
# Supports PostgreSQL (pg_dump) and SQLite, uploaded media, and configuration.
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
  temp_dir=\$(mktemp -d -p '${BACKUP_DIR}' backup-work.XXXXXX)

  cleanup() {
    rm -rf \"\${temp_dir}\"
  }
  trap cleanup EXIT

  cd '${API_PATH}'
  env_file='apps/backend/.env'

  # 1. Backup PostgreSQL if configured in .env
  if [ -f \"\${env_file}\" ]; then
    cp \"\${env_file}\" \"\${temp_dir}/.env\"

    db_engine=\$(grep -E '^DB_ENGINE=' \"\${env_file}\" | cut -d'=' -f2- | tr -d '\"'\'' ' || true)
    db_name=\$(grep -E '^DB_NAME=' \"\${env_file}\" | cut -d'=' -f2- | tr -d '\"'\'' ' || true)
    db_user=\$(grep -E '^DB_USER=' \"\${env_file}\" | cut -d'=' -f2- | tr -d '\"'\'' ' || true)
    db_pass=\$(grep -E '^DB_PASSWORD=' \"\${env_file}\" | cut -d'=' -f2- | tr -d '\"'\'' ' || true)
    db_host=\$(grep -E '^DB_HOST=' \"\${env_file}\" | cut -d'=' -f2- | tr -d '\"'\'' ' || echo 'localhost')
    db_port=\$(grep -E '^DB_PORT=' \"\${env_file}\" | cut -d'=' -f2- | tr -d '\"'\'' ' || echo '5432')

    if [[ \"\${db_engine}\" == *\"postgresql\"* ]] && [ -n \"\${db_name}\" ]; then
      echo 'Dumping PostgreSQL database: '\${db_name}'...'
      PGPASSWORD=\"\${db_pass}\" pg_dump -h \"\${db_host}\" -p \"\${db_port}\" -U \"\${db_user}\" -d \"\${db_name}\" -F c -f \"\${temp_dir}/postgres_database.dump\"
    fi
  fi

  # 2. Backup SQLite database if present
  if [ -f 'apps/backend/db.sqlite3' ]; then
    cp 'apps/backend/db.sqlite3' \"\${temp_dir}/db.sqlite3\"
  fi

  # 3. Backup uploaded media if present
  if [ -d 'apps/backend/media' ]; then
    cp -r 'apps/backend/media' \"\${temp_dir}/media\"
  fi

  # 4. Create single archive from staging dir
  cd \"\${temp_dir}\"
  tar -czf \"\${archive}\" .
  sha256sum \"\${archive}\" > \"\${archive}.sha256\"
  echo \"Backup created: \${archive} (\$(du -h \"\${archive}\" | cut -f1))\"

  # Retain backups for 30 days
  find '${BACKUP_DIR}' -type f -name 'center-estates-backup-*' -mtime +30 -delete
"
