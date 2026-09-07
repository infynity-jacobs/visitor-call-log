#!/usr/bin/env bash
# deploy/install.sh
#
# Full automated installation of the Visitor Register & Call Log application
# onto a fresh Ubuntu 22.04 LTS server. Run deploy/install_prerequisites.sh
# first. This script is idempotent-ish: re-running it will not overwrite an
# existing .env or an already-provisioned database role/password.
#
# Usage: sudo ./deploy/install.sh [--domain example.com]

set -euo pipefail

APP_USER="vcl-app"
APP_DIR="/opt/visitor-call-log"
DB_NAME="visitor_call_log"
DB_USER="vcl_app"
SERVICE_NAME="visitor-call-log"
DOMAIN=""

while [[ $# -gt 0 ]]; do
  case "$1" in
    --domain) DOMAIN="$2"; shift 2 ;;
    *) echo "Unknown argument: $1" >&2; exit 1 ;;
  esac
done

log() { echo -e "\n\033[1;34m==>\033[0m $1"; }
fail() { echo -e "\033[1;31mERROR:\033[0m $1" >&2; exit 1; }

if [[ $EUID -ne 0 ]]; then
  fail "This script must be run as root (use sudo)."
fi

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

command -v node >/dev/null 2>&1 || fail "Node.js not found. Run deploy/install_prerequisites.sh first."
command -v psql >/dev/null 2>&1 || fail "PostgreSQL not found. Run deploy/install_prerequisites.sh first."
command -v nginx >/dev/null 2>&1 || fail "Nginx not found. Run deploy/install_prerequisites.sh first."
id -u "$APP_USER" >/dev/null 2>&1 || fail "System user '$APP_USER' not found. Run deploy/install_prerequisites.sh first."

log "Deploying application code to $APP_DIR"
mkdir -p "$APP_DIR"
rsync -a --exclude 'node_modules' --exclude '.git' --exclude 'dist' "$REPO_ROOT"/ "$APP_DIR"/
chown -R "$APP_USER":"$APP_USER" "$APP_DIR"

BACKEND_DIR="$APP_DIR/app/backend"
FRONTEND_DIR="$APP_DIR/app/frontend"
ENV_FILE="$BACKEND_DIR/.env"

log "Provisioning PostgreSQL role and database (if not already present)"
DB_PASSWORD_FILE="/etc/visitor-call-log/db_password"
mkdir -p /etc/visitor-call-log
chmod 700 /etc/visitor-call-log

if [[ -f "$DB_PASSWORD_FILE" ]]; then
  DB_PASSWORD="$(cat "$DB_PASSWORD_FILE")"
  echo "Using existing database password from $DB_PASSWORD_FILE"
else
  DB_PASSWORD="$(openssl rand -hex 24)"
  echo "$DB_PASSWORD" > "$DB_PASSWORD_FILE"
  chmod 600 "$DB_PASSWORD_FILE"
  echo "Generated new database password (saved to $DB_PASSWORD_FILE)"
fi

su - postgres -c "psql -tc \"SELECT 1 FROM pg_roles WHERE rolname='${DB_USER}'\"" | grep -q 1 || \
  su - postgres -c "psql -c \"CREATE ROLE ${DB_USER} WITH LOGIN PASSWORD '${DB_PASSWORD}';\""
su - postgres -c "psql -c \"ALTER ROLE ${DB_USER} WITH PASSWORD '${DB_PASSWORD}';\""

su - postgres -c "psql -tc \"SELECT 1 FROM pg_database WHERE datname='${DB_NAME}'\"" | grep -q 1 || \
  su - postgres -c "psql -c \"CREATE DATABASE ${DB_NAME} OWNER ${DB_USER};\""

log "Writing backend environment configuration"
if [[ -f "$ENV_FILE" ]]; then
  echo "Existing $ENV_FILE found — leaving it in place. Delete it first if you want a clean regeneration."
else
  JWT_SECRET="$(openssl rand -hex 32)"
  APP_SECRET_KEY="$(openssl rand -hex 32)"
  APP_VERSION="$(cat "$REPO_ROOT/VERSION" 2>/dev/null || echo '1.0.1')"
  CORS_ORIGIN="${DOMAIN:+https://$DOMAIN}"
  CORS_ORIGIN="${CORS_ORIGIN:-*}"

  cat > "$ENV_FILE" <<EOF
NODE_ENV=production
PORT=3000
DB_HOST=localhost
DB_PORT=5432
DB_NAME=${DB_NAME}
DB_USER=${DB_USER}
DB_PASSWORD=${DB_PASSWORD}
JWT_SECRET=${JWT_SECRET}
APP_SECRET_KEY=${APP_SECRET_KEY}
CORS_ORIGIN=${CORS_ORIGIN}
APP_VERSION=${APP_VERSION}
EOF
  chown "$APP_USER":"$APP_USER" "$ENV_FILE"
  chmod 600 "$ENV_FILE"
  echo "Wrote $ENV_FILE with generated secrets."
fi

log "Installing backend dependencies"
su - "$APP_USER" -s /bin/bash -c "cd '$BACKEND_DIR' && npm ci --omit=dev" || fail "Backend dependency install failed"

log "Building frontend"
su - "$APP_USER" -s /bin/bash -c "cd '$FRONTEND_DIR' && npm ci && npm run build" || fail "Frontend build failed"

log "Applying database migrations"
"$SCRIPT_DIR/migrate.sh"

log "Installing systemd service"
cp "$SCRIPT_DIR/systemd/${SERVICE_NAME}.service" "/etc/systemd/system/${SERVICE_NAME}.service"
systemctl daemon-reload
systemctl enable "$SERVICE_NAME"
systemctl restart "$SERVICE_NAME"

log "Configuring Nginx"
NGINX_CONF_SRC="$SCRIPT_DIR/nginx/${SERVICE_NAME}.conf"
NGINX_CONF_DEST="/etc/nginx/sites-available/${SERVICE_NAME}.conf"
SERVER_NAME="${DOMAIN:-_}"
sed "s/__SERVER_NAME__/${SERVER_NAME}/g; s#__FRONTEND_DIST__#${FRONTEND_DIR}/dist#g" "$NGINX_CONF_SRC" > "$NGINX_CONF_DEST"
ln -sf "$NGINX_CONF_DEST" "/etc/nginx/sites-enabled/${SERVICE_NAME}.conf"
rm -f /etc/nginx/sites-enabled/default
nginx -t || fail "Nginx configuration test failed"
systemctl reload nginx

log "Running health check"
sleep 2
"$REPO_ROOT/scripts/health_check.sh" || echo "WARNING: health check did not pass — check 'journalctl -u ${SERVICE_NAME}'."

log "Installation complete."
echo "Application directory: $APP_DIR"
echo "Service:                sudo systemctl status ${SERVICE_NAME}"
echo "Logs:                   sudo journalctl -u ${SERVICE_NAME} -f"
echo "Default admin login:    username 'admin', password 'admin123' — CHANGE THIS IMMEDIATELY."
if [[ -n "$DOMAIN" ]]; then
  echo "Site:                   http://${DOMAIN}  (run 'sudo certbot --nginx -d ${DOMAIN}' for HTTPS)"
else
  echo "Site:                   http://<server-ip>/"
fi
