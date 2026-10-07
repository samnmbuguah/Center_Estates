#!/usr/bin/env bash
# Create a recoverable cPanel application-state backup before a release or on schedule.
# Supports PostgreSQL (pg_dump) and SQLite, uploaded media, and configuration.
# Usage: scripts/backup_cpanel.sh [ssh-host] [domain] [api-domain]

set -euo pipefail

REMOTE_HOST="${1:-host}"
DOMAIN="${2:-centerestates.com}"
API_DOMAIN="${3:-api.centerestates.com}"
CPANEL_USER="${CPANEL_USER:-$USER}"
CPANEL_HOME="${CPANEL_HOME:-/home2/${CPANEL_USER}}"
BACKUP_DIR="${CPANEL_HOME}/backups"
API_PATH="${CPANEL_HOME}/${API_DOMAIN}"

# Optional SSH port override (mirrors deploy_cpanel.sh).
SSH_PORT="${SSH_PORT:-}"
SSH_OPTS=(-o ConnectTimeout=30)
if [[ -n "$SSH_PORT" ]]; then
  SSH_OPTS+=(-p "$SSH_PORT")
fi

STAMP="$(date -u +%Y%m%dT%H%M%SZ)"

ssh "${SSH_OPTS[@]}" "$REMOTE_HOST" "
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
