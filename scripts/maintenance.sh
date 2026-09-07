#!/usr/bin/env bash
# scripts/maintenance.sh
#
# Routine maintenance tasks: verify service health, prune backups older
# than the retention window, and report disk usage for the app and backup
# directories. Intended to be run periodically (e.g. a weekly cron job).
#
# Usage: sudo ./scripts/maintenance.sh

set -euo pipefail

APP_DIR="/opt/visitor-call-log"
BACKUP_DIR="/var/backups/visitor-call-log"
SERVICE_NAME="visitor-call-log"
RETENTION_DAYS=90

log() { echo -e "\n\033[1;34m==>\033[0m $1"; }

log "Service status"
systemctl status "$SERVICE_NAME" --no-pager -l | head -n 5 || true

log "Running health check"
"$(dirname "${BASH_SOURCE[0]}")/health_check.sh" || echo "WARNING: health check failed — investigate before proceeding."

if [[ -d "$BACKUP_DIR" ]]; then
  log "Pruning backups older than ${RETENTION_DAYS} days in $BACKUP_DIR"
  find "$BACKUP_DIR" -name 'visitor-call-log-*.sql.gz' -mtime "+${RETENTION_DAYS}" -print -delete

  log "Backup directory usage"
  du -sh "$BACKUP_DIR" 2>/dev/null || true
  echo "Backup count: $(find "$BACKUP_DIR" -name 'visitor-call-log-*.sql.gz' | wc -l)"
fi

if [[ -d "$APP_DIR" ]]; then
  log "Application directory usage"
  du -sh "$APP_DIR" 2>/dev/null || true
fi

log "Disk space"
df -h / 2>/dev/null || true

echo
echo "Maintenance check complete."
