#!/usr/bin/env bash
set -euo pipefail

if [[ $# -ne 2 || "$2" != "RESTORE-CENTER-ESTATES" ]]; then
  echo "Usage: $0 /absolute/path/to/backup RESTORE-CENTER-ESTATES" >&2
  exit 2
fi

backup_dir="$1"
project_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
test -f "${backup_dir}/database.dump"
test -f "${backup_dir}/media.tar.gz"
(cd "${backup_dir}" && sha256sum --check SHA256SUMS)

cd "${project_root}"
docker compose stop web backend
docker compose exec -T db pg_restore \
  --username center_estates --dbname center_estates \
  --clean --if-exists --no-owner --no-privileges < "${backup_dir}/database.dump"
docker compose run --rm --no-deps -T backend sh -c 'find /app/media -mindepth 1 -delete; tar -C /app -xzf -' < "${backup_dir}/media.tar.gz"
docker compose up -d backend web
docker compose ps
