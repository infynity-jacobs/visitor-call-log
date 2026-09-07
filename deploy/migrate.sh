#!/usr/bin/env bash
# deploy/migrate.sh
#
# Applies all pending SQL migrations from database/migrations/ in filename
# order. Tracks applied versions in the schema_migrations table so it is
# always safe to re-run.
#
# Usage: sudo ./deploy/migrate.sh

set -euo pipefail

APP_DIR="/opt/visitor-call-log"
BACKEND_ENV="$APP_DIR/app/backend/.env"

log() { echo -e "\n\033[1;34m==>\033[0m $1"; }
fail() { echo -e "\033[1;31mERROR:\033[0m $1" >&2; exit 1; }

# Allow running from within a checked-out repo during development, or
# against the installed copy in production.
if [[ -f "$BACKEND_ENV" ]]; then
  ENV_FILE="$BACKEND_ENV"
  MIGRATIONS_DIR="$APP_DIR/database/migrations"
else
  SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
  REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
  ENV_FILE="$REPO_ROOT/app/backend/.env"
  MIGRATIONS_DIR="$REPO_ROOT/database/migrations"
fi

[[ -f "$ENV_FILE" ]] || fail "Could not find backend .env at $ENV_FILE. Run deploy/install.sh first, or create it from config/.env.example."

# shellcheck disable=SC1090
set -a; source "$ENV_FILE"; set +a

export PGPASSWORD="$DB_PASSWORD"
PSQL="psql -h ${DB_HOST:-localhost} -p ${DB_PORT:-5432} -U ${DB_USER} -d ${DB_NAME} -v ON_ERROR_STOP=1"

log "Ensuring schema_migrations table exists"
$PSQL -c "CREATE TABLE IF NOT EXISTS schema_migrations (version VARCHAR(255) PRIMARY KEY, applied_at TIMESTAMPTZ NOT NULL DEFAULT now());" >/dev/null

applied_count=0
for file in $(ls "$MIGRATIONS_DIR"/*.sql 2>/dev/null | sort); do
  version="$(basename "$file" .sql)"
  already=$($PSQL -tAc "SELECT 1 FROM schema_migrations WHERE version = '${version}'")
  if [[ "$already" == "1" ]]; then
    echo "  [skip]  $version (already applied)"
    continue
  fi
  echo "  [apply] $version"
  $PSQL -f "$file" || fail "Migration $version failed. Database changes were rolled back for this file (see BEGIN/COMMIT in the migration). Fix the migration and re-run."
  applied_count=$((applied_count + 1))
done

log "Migrations complete. Applied $applied_count new migration(s)."
