#!/usr/bin/env bash
# deploy/uninstall.sh
#
# Removes the application service, Nginx site, and (optionally) the
# application directory and database. Always takes a final backup first
# unless --skip-backup is passed.
#
# Usage: sudo ./deploy/uninstall.sh [--purge] [--skip-backup]
#   --purge        also drop the database and delete /opt/visitor-call-log
#   --skip-backup  do not take a final backup before uninstalling

set -euo pipefail

APP_DIR="/opt/visitor-call-log"
SERVICE_NAME="visitor-call-log"
DB_NAME="visitor_call_log"
DB_USER="vcl_app"
PURGE=0
SKIP_BACKUP=0

for arg in "$@"; do
  case "$arg" in
    --purge) PURGE=1 ;;
    --skip-backup) SKIP_BACKUP=1 ;;
    *) echo "Unknown argument: $arg" >&2; exit 1 ;;
  esac
done

log() { echo -e "\n\033[1;34m==>\033[0m $1"; }

[[ $EUID -eq 0 ]] || { echo "ERROR: run as root (sudo)." >&2; exit 1; }

if [[ "$SKIP_BACKUP" == "0" && -f "$APP_DIR/deploy/backup.sh" ]]; then
  log "Taking a final backup before uninstalling"
  "$APP_DIR/deploy/backup.sh" || echo "WARNING: backup failed — continuing uninstall anyway."
fi

log "Stopping and disabling service"
systemctl stop "$SERVICE_NAME" 2>/dev/null || true
systemctl disable "$SERVICE_NAME" 2>/dev/null || true
rm -f "/etc/systemd/system/${SERVICE_NAME}.service"
systemctl daemon-reload

log "Removing Nginx site"
rm -f "/etc/nginx/sites-enabled/${SERVICE_NAME}.conf"
rm -f "/etc/nginx/sites-available/${SERVICE_NAME}.conf"
nginx -t 2>/dev/null && systemctl reload nginx || true

if [[ "$PURGE" == "1" ]]; then
  log "Purging database"
  su - postgres -c "psql -c \"DROP DATABASE IF EXISTS ${DB_NAME};\"" || true
  su - postgres -c "psql -c \"DROP ROLE IF EXISTS ${DB_USER};\"" || true

  log "Removing application directory $APP_DIR"
  rm -rf "$APP_DIR"
  rm -rf /etc/visitor-call-log

  echo "Purge complete. Backups (if taken) remain in /var/backups/visitor-call-log."
else
  echo "Service and Nginx site removed. Application files remain at $APP_DIR and the database was kept."
  echo "Re-run with --purge to remove the application directory and database as well."
fi
