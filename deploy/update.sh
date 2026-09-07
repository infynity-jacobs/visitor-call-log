#!/usr/bin/env bash
# deploy/update.sh
#
# Updates an already-installed application to the latest (or specified)
# Git ref: backs up the database, pulls code, installs dependencies,
# runs migrations, rebuilds the frontend, restarts the service, and
# verifies health. Designed to avoid data loss — it always backs up first.
#
# Usage: sudo ./deploy/update.sh [git-ref]   (default: origin/main)

set -euo pipefail

APP_DIR="/opt/visitor-call-log"
APP_USER="vcl-app"
SERVICE_NAME="visitor-call-log"
GIT_REF="${1:-origin/main}"

log() { echo -e "\n\033[1;34m==>\033[0m $1"; }
fail() { echo -e "\033[1;31mERROR:\033[0m $1" >&2; exit 1; }

[[ $EUID -eq 0 ]] || fail "This script must be run as root (use sudo)."
[[ -d "$APP_DIR/.git" ]] || fail "$APP_DIR is not a git checkout. This script expects the app to have been deployed via git clone."

OLD_VERSION="$(cat "$APP_DIR/VERSION" 2>/dev/null || echo 'unknown')"

log "Backing up database before update"
bash "$APP_DIR/deploy/backup.sh"

log "Fetching latest code ($GIT_REF)"
su - "$APP_USER" -s /bin/bash -c "cd '$APP_DIR' && git fetch --all --tags && git checkout $GIT_REF" || fail "Git update failed"

NEW_VERSION="$(cat "$APP_DIR/VERSION" 2>/dev/null || echo 'unknown')"

log "Installing backend dependencies"
su - "$APP_USER" -s /bin/bash -c "cd '$APP_DIR/app/backend' && npm ci --omit=dev" || fail "Backend dependency install failed"

log "Building frontend"
su - "$APP_USER" -s /bin/bash -c "cd '$APP_DIR/app/frontend' && npm ci && npm run build" || fail "Frontend build failed"

log "Applying database migrations"
bash "$APP_DIR/deploy/migrate.sh"

log "Restarting service"
systemctl restart "$SERVICE_NAME"

log "Verifying service status"
sleep 2
systemctl is-active --quiet "$SERVICE_NAME" || fail "Service failed to start after update. Check: journalctl -u ${SERVICE_NAME} -n 50"

log "Running health check"
bash "$APP_DIR/scripts/health_check.sh" || fail "Health check failed after update. The database has been backed up; consider ./deploy/restore.sh if you need to roll back the data, and 'git checkout <old-ref>' to roll back the code."

echo
echo "Update complete."
echo "Previous Version: ${OLD_VERSION}"
echo "New Version:      ${NEW_VERSION}"
