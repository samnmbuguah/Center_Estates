#!/bin/bash
# Add to crontab: runs daily at 2 AM
CRON_JOB="0 2 * * * /root/Dev/Center_Estates/infrastructure/docker/backup-rotate.sh >> /var/log/ce-backup.log 2>&1"
(crontab -l 2>/dev/null | grep -v "backup-rotate" ; echo "$CRON_JOB") | crontab -
echo "Backup cron job installed"
