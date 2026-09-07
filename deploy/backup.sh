#!/usr/bin/env bash
# deploy/backup.sh
#
# Dumps the application database to a timestamped SQL file. Safe to run
# repeatedly — never overwrites an existing backup.
#
# Usage: sudo ./deploy/backup.sh [output_directory]

set -euo pipefail

APP_DIR="/opt/visitor-call-log"
BACKEND_ENV="$APP_DIR/app/backend/.env"
BACKUP_DIR="${1:-/var/backups/visitor-call-log}"

log() { echo -e "\n\033[1;34m==>\033[0m $1"; }
fail() { echo -e "\033[1;31mERROR:\033[0m $1" >&2; exit 1; }

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

mkdir -p "$BACKUP_DIR"
TIMESTAMP="$(date +%Y%m%d-%H%M%S)"
OUT_FILE="${BACKUP_DIR}/visitor-call-log-${TIMESTAMP}.sql"

if [[ -e "$OUT_FILE" ]]; then
  fail "Backup file $OUT_FILE already exists — refusing to overwrite. Try again in a moment."
fi

log "Backing up database '${DB_NAME}' to $OUT_FILE"
pg_dump -h "${DB_HOST:-localhost}" -p "${DB_PORT:-5432}" -U "$DB_USER" -d "$DB_NAME" \
  --no-owner --no-privileges -f "$OUT_FILE" || fail "pg_dump failed"

gzip "$OUT_FILE"
echo "Backup written to ${OUT_FILE}.gz"

# Retention: keep the most recent 30 backups by default.
KEEP=30
ls -1t "$BACKUP_DIR"/visitor-call-log-*.sql.gz 2>/dev/null | tail -n +$((KEEP + 1)) | xargs -r rm --
echo "Retention: keeping the most recent $KEEP backups in $BACKUP_DIR"
