#!/usr/bin/env bash
# deploy/restore.sh
#
# Restores the application database from a backup produced by backup.sh.
# Prompts for confirmation since this overwrites current data.
#
# Usage: sudo ./deploy/restore.sh backup_file.sql[.gz]

set -euo pipefail

APP_DIR="/opt/visitor-call-log"
BACKEND_ENV="$APP_DIR/app/backend/.env"
SERVICE_NAME="visitor-call-log"

log() { echo -e "\n\033[1;34m==>\033[0m $1"; }
fail() { echo -e "\033[1;31mERROR:\033[0m $1" >&2; exit 1; }

BACKUP_FILE="${1:-}"
[[ -n "$BACKUP_FILE" ]] || fail "Usage: sudo ./deploy/restore.sh backup_file.sql[.gz]"
[[ -f "$BACKUP_FILE" ]] || fail "Backup file not found: $BACKUP_FILE"

if [[ -f "$BACKEND_ENV" ]]; then
  ENV_FILE="$BACKEND_ENV"
else
  SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
  ENV_FILE="$(cd "$SCRIPT_DIR/.." && pwd)/app/backend/.env"
fi
[[ -f "$ENV_FILE" ]] || fail "Could not find backend .env at $ENV_FILE."

# shellcheck disable=SC1090
set -a; source "$ENV_FILE"; set +a
export PGPASSWORD="$DB_PASSWORD"

echo "This will REPLACE all data in database '${DB_NAME}' with the contents of:"
echo "  $BACKUP_FILE"
read -r -p "Type 'yes' to continue: " CONFIRM
[[ "$CONFIRM" == "yes" ]] || { echo "Aborted."; exit 1; }

if systemctl is-active --quiet "$SERVICE_NAME" 2>/dev/null; then
  log "Stopping application service"
  systemctl stop "$SERVICE_NAME"
  RESTART_AFTER=1
else
  RESTART_AFTER=0
fi

log "Dropping and recreating database '${DB_NAME}'"
# Requires the postgres superuser account, since dropping a database that
# has active connections (and recreating it cleanly) is not reliably
# possible as the unprivileged application role.
su - postgres -c "psql -v ON_ERROR_STOP=1 -c \"SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = '${DB_NAME}' AND pid <> pg_backend_pid();\"" >/dev/null || true
su - postgres -c "psql -v ON_ERROR_STOP=1 -c \"DROP DATABASE IF EXISTS ${DB_NAME};\"" || fail "Could not drop existing database ${DB_NAME}."
su - postgres -c "psql -v ON_ERROR_STOP=1 -c \"CREATE DATABASE ${DB_NAME} OWNER ${DB_USER};\"" || fail "Could not recreate database ${DB_NAME}."

log "Restoring from backup"
if [[ "$BACKUP_FILE" == *.gz ]]; then
  gunzip -c "$BACKUP_FILE" | psql -h "${DB_HOST:-localhost}" -p "${DB_PORT:-5432}" -U "$DB_USER" -d "$DB_NAME" -v ON_ERROR_STOP=1
else
  psql -h "${DB_HOST:-localhost}" -p "${DB_PORT:-5432}" -U "$DB_USER" -d "$DB_NAME" -v ON_ERROR_STOP=1 -f "$BACKUP_FILE"
fi

if [[ "$RESTART_AFTER" == "1" ]]; then
  log "Restarting application service"
  systemctl start "$SERVICE_NAME"
fi

log "Restore complete."
