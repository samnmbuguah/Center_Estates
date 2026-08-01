#!/usr/bin/env bash
set -euo pipefail

project_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
backup_root="${1:-${project_root}/backups}"
timestamp="$(date -u +%Y%m%dT%H%M%SZ)"
destination="${backup_root}/${timestamp}"

mkdir -p "${destination}"
cd "${project_root}"

docker compose exec -T db pg_dump \
  --username center_estates --dbname center_estates \
  --format=custom --no-owner --no-privileges > "${destination}/database.dump"
docker compose exec -T backend tar -C /app -czf - media > "${destination}/media.tar.gz"
sha256sum "${destination}/database.dump" "${destination}/media.tar.gz" > "${destination}/SHA256SUMS"

echo "Backup created: ${destination}"
