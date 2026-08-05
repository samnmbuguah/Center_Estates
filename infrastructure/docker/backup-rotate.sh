#!/bin/bash
set -eu

BACKUP_DIR="${BACKUP_DIR:-/root/Dev/Center_Estates/backups}"
RETENTION_DAYS="${RETENTION_DAYS:-7}"
TIMESTAMP=$(date -u +%Y%m%dT%H%M%SZ)
BACKUP_PATH="$BACKUP_DIR/$TIMESTAMP"
mkdir -p "$BACKUP_PATH"

# Dump database
docker exec center-estates-erp-db-1 pg_dump -U center_estates center_estates > "$BACKUP_PATH/database.dump"

# Archive media
docker exec center-estates-erp-backend-1 tar -czf - -C /app media > "$BACKUP_PATH/media.tar.gz" 2>/dev/null || touch "$BACKUP_PATH/media.tar.gz"

# Create checksums
cd "$BACKUP_PATH" && sha256sum * > SHA256SUMS

echo "Backup created: $BACKUP_PATH"

# Rotate old backups
find "$BACKUP_DIR" -maxdepth 1 -type d -name "20*" -mtime +"$RETENTION_DAYS" -exec rm -rf {} \; 2>/dev/null || true
echo "Rotated backups older than $RETENTION_DAYS days"
