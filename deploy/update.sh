#!/usr/bin/env bash
# deploy/update.sh
#
# Git-based production deployment for Visitor Register & Call Log.
# Run this script from the Git working copy (for example
# /home/administrator/visitor-call-log). It fetches the requested Git ref,
# stages and builds the release outside /opt, backs up the production DB,
# then deploys the staged code while preserving the production .env.
#
# Usage: sudo ./deploy/update.sh [git-ref]
# Default: main (latest origin/main)

set -Eeuo pipefail

APP_DIR="/opt/visitor-call-log"
APP_USER="vcl-app"
SERVICE_NAME="visitor-call-log"
GIT_USER="${SUDO_USER:-$(stat -c %U "$PWD" 2>/dev/null || echo administrator)}"
DEFAULT_BRANCH="main"
GIT_REF="${1:-$DEFAULT_BRANCH}"
BACKUP_ROOT="/var/backups/visitor-call-log"
RELEASE_BACKUP_DIR="$BACKUP_ROOT/releases"

log() { echo -e "\n\033[1;34m==>\033[0m $1"; }
warn() { echo -e "\033[1;33mWARNING:\033[0m $1" >&2; }
fail() { echo -e "\033[1;31mERROR:\033[0m $1" >&2; exit 1; }

[[ $EUID -eq 0 ]] || fail "Run as root (use sudo)."
command -v git >/dev/null 2>&1 || fail "git is required."
command -v rsync >/dev/null 2>&1 || fail "rsync is required. Run deploy/install_prerequisites.sh."
command -v npm >/dev/null 2>&1 || fail "npm is required. Run deploy/install_prerequisites.sh."
command -v systemctl >/dev/null 2>&1 || fail "systemctl is required."

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
git_as_user() { su - "$GIT_USER" -s /bin/bash -c "git -C '$REPO_ROOT' $*"; }
[[ -d "$REPO_ROOT/.git" ]] || fail "This deployment script must be run from a Git checkout. Current directory: $REPO_ROOT"
[[ -f "$REPO_ROOT/VERSION" ]] || fail "VERSION file not found in $REPO_ROOT."
[[ -d "$APP_DIR" ]] || fail "Production directory $APP_DIR does not exist. Run deploy/install.sh first."
[[ -f "$APP_DIR/app/backend/.env" ]] || fail "Production .env not found at $APP_DIR/app/backend/.env. Refusing to continue."

if ! id -u "$GIT_USER" >/dev/null 2>&1; then
  fail "Git user $GIT_USER does not exist. Run the update with sudo from the repository owner account."
fi

if [[ -n "$(git_as_user "status --porcelain")" ]]; then
  fail "Git working tree is not clean. Commit/stash local changes before deployment."
fi

OLD_VERSION="$(cat "$APP_DIR/VERSION" 2>/dev/null || echo unknown)"
DEPLOY_MARKER="$APP_DIR/.deploy-commit"
OLD_COMMIT="$(cat "$DEPLOY_MARKER" 2>/dev/null || echo unknown)"
TIMESTAMP="$(date +%Y%m%d-%H%M%S)"
STAGE_DIR="$(mktemp -d /tmp/visitor-call-log-release.XXXXXX)"
OLD_CODE_BACKUP="$RELEASE_BACKUP_DIR/${TIMESTAMP}-${OLD_VERSION}"
DB_BACKUP_DIR="$BACKUP_ROOT"
BACKUP_FILE=""
SERVICE_WAS_ACTIVE=0
DEPLOYED=0
MIGRATIONS_STARTED=0

cleanup() {
  rm -rf "$STAGE_DIR"
}
trap cleanup EXIT

rollback() {
  local rc=$?
  [[ "$DEPLOYED" -eq 1 ]] || return "$rc"
  warn "Deployment failed. Attempting automatic rollback."

  systemctl stop "$SERVICE_NAME" 2>/dev/null || true

  if [[ -d "$OLD_CODE_BACKUP" ]]; then
    log "Restoring previous application code from $OLD_CODE_BACKUP"
    rsync -a --delete \
      --exclude 'app/backend/.env' \
      --exclude 'app/backend/node_modules' \
      --exclude 'app/frontend/node_modules' \
      "$OLD_CODE_BACKUP"/ "$APP_DIR"/ || warn "Code rollback encountered an error."

    if [[ -f "$APP_DIR/app/backend/package-lock.json" ]]; then
      su - "$APP_USER" -s /bin/bash -c "cd '$APP_DIR/app/backend' && npm ci --omit=dev" || warn "Could not reinstall previous backend dependencies."
    fi
    if [[ -f "$APP_DIR/app/frontend/package-lock.json" ]]; then
      su - "$APP_USER" -s /bin/bash -c "cd '$APP_DIR/app/frontend' && npm ci && npm run build" || warn "Could not rebuild previous frontend."
    fi
  else
    warn "Previous code backup was not found at $OLD_CODE_BACKUP."
  fi

  if [[ "$MIGRATIONS_STARTED" -eq 1 && -n "$BACKUP_FILE" && -f "$BACKUP_FILE" ]]; then
    warn "A migration was attempted. Database restore is NOT automatic. Use deploy/restore.sh with $BACKUP_FILE if the schema/data must be reverted."
  fi

  systemctl daemon-reload 2>/dev/null || true
  systemctl start "$SERVICE_NAME" 2>/dev/null || true
  return "$rc"
}
trap rollback ERR

log "Validating Git repository"
REMOTE_URL="$(git_as_user "remote get-url origin" 2>/dev/null || true)"
[[ -n "$REMOTE_URL" ]] || fail "Git remote 'origin' is not configured."
echo "Repository: $REPO_ROOT"
echo "Remote:     $REMOTE_URL"

log "Fetching Git repository"
git_as_user "fetch --all --tags --prune"

if [[ "$GIT_REF" == "main" ]]; then
  git_as_user "checkout main" >/dev/null 2>&1 || fail "Could not checkout main."
  git_as_user "pull --ff-only origin main" || fail "Could not fast-forward main from origin/main."
  TARGET_REF="origin/main"
else
  git_as_user "rev-parse --verify '$GIT_REF^{commit}'" >/dev/null 2>&1 || fail "Git ref '$GIT_REF' was not found."
  TARGET_REF="$GIT_REF"
fi

TARGET_COMMIT="$(git_as_user "rev-parse --short '$TARGET_REF'")"
TARGET_VERSION="$(git_as_user "show '$TARGET_REF:VERSION'" 2>/dev/null || true)"
[[ -n "$TARGET_VERSION" ]] || fail "Git ref '$GIT_REF' has no VERSION file."
[[ "$TARGET_VERSION" != "$OLD_VERSION" ]] || warn "Target version is the same as production ($OLD_VERSION)."

echo "Current production: v$OLD_VERSION"
echo "Target release:     v$TARGET_VERSION ($TARGET_COMMIT)"

log "Backing up production database"
BACKUP_OUTPUT="$(bash "$REPO_ROOT/deploy/backup.sh")"
echo "$BACKUP_OUTPUT"
BACKUP_FILE="$(printf '%s\n' "$BACKUP_OUTPUT" | sed -n 's/^Backup written to //p' | tail -n 1)"
[[ -n "$BACKUP_FILE" && -f "$BACKUP_FILE" ]] || fail "Database backup was not created successfully."

log "Creating rollback copy of current application code"
mkdir -p "$OLD_CODE_BACKUP"
rsync -a \
  --exclude 'app/backend/.env' \
  --exclude '.deploy-commit' \
  --exclude 'app/backend/node_modules' \
  --exclude 'app/frontend/node_modules' \
  "$APP_DIR"/ "$OLD_CODE_BACKUP"/

log "Staging target release"
rsync -a --delete \
  --exclude '.git' \
  --exclude 'app/backend/.env' \
  --exclude '.deploy-commit' \
  --exclude 'app/backend/node_modules' \
  --exclude 'app/frontend/node_modules' \
  --exclude 'app/frontend/dist' \
  "$REPO_ROOT"/ "$STAGE_DIR"/

STAGED_VERSION="$(cat "$STAGE_DIR/VERSION")"
[[ "$STAGED_VERSION" == "$TARGET_VERSION" ]] || fail "Staged VERSION mismatch."

log "Validating staged backend JavaScript"
while IFS= read -r -d '' file; do
  node --check "$file" >/dev/null
 done < <(find "$STAGE_DIR/app/backend/src" -type f -name '*.js' -print0)

log "Installing staged backend dependencies"
chown -R "$APP_USER":"$APP_USER" "$STAGE_DIR"
su - "$APP_USER" -s /bin/bash -c "cd '$STAGE_DIR/app/backend' && npm ci --omit=dev" || fail "Staged backend dependency install failed."

log "Building staged frontend"
su - "$APP_USER" -s /bin/bash -c "cd '$STAGE_DIR/app/frontend' && npm ci && npm run build" || fail "Staged frontend build failed."

log "Stopping application service for deployment"
if systemctl is-active --quiet "$SERVICE_NAME"; then
  SERVICE_WAS_ACTIVE=1
  systemctl stop "$SERVICE_NAME"
fi

log "Deploying staged release to $APP_DIR"
DEPLOYED=1
rsync -a --delete \
  --exclude 'app/backend/.env' \
  --exclude 'app/backend/node_modules' \
  "$STAGE_DIR"/ "$APP_DIR"/

# Install dependencies into the production tree after code replacement.
chown -R "$APP_USER":"$APP_USER" "$APP_DIR"
log "Installing production backend dependencies"
su - "$APP_USER" -s /bin/bash -c "cd '$APP_DIR/app/backend' && npm ci --omit=dev" || fail "Production backend dependency install failed."

log "Applying database migrations"
MIGRATIONS_STARTED=1
bash "$APP_DIR/deploy/migrate.sh"

log "Starting application service"
systemctl daemon-reload
systemctl start "$SERVICE_NAME"

log "Verifying service status"
sleep 2
systemctl is-active --quiet "$SERVICE_NAME" || fail "Service failed to start. Check journalctl -u $SERVICE_NAME."

log "Running application health check"
bash "$APP_DIR/scripts/health_check.sh" "http://localhost:3000/api/health" "$TARGET_VERSION"

printf '%s\n' "$TARGET_COMMIT" > "$DEPLOY_MARKER"
chown "$APP_USER":"$APP_USER" "$DEPLOY_MARKER"

trap - ERR

# Keep rollback copies for 30 days, then remove older ones.
find "$RELEASE_BACKUP_DIR" -mindepth 1 -maxdepth 1 -type d -mtime +30 -exec rm -rf {} + 2>/dev/null || true

log "Deployment complete"
echo "Previous version: $OLD_VERSION"
echo "Previous commit:  $OLD_COMMIT"
echo "New version:      $TARGET_VERSION"
echo "New commit:       $TARGET_COMMIT"
echo "Database backup:  $BACKUP_FILE"
echo "Rollback copy:    $OLD_CODE_BACKUP"
