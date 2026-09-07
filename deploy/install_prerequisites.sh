#!/usr/bin/env bash
# deploy/install_prerequisites.sh
#
# Installs all OS-level prerequisites for the Visitor Register & Call Log
# application on a fresh Ubuntu 22.04 LTS server: Git, Node.js 20 LTS,
# PostgreSQL, and Nginx.
#
# Usage: sudo ./deploy/install_prerequisites.sh

set -euo pipefail

if [[ $EUID -ne 0 ]]; then
  echo "ERROR: This script must be run as root (use sudo)." >&2
  exit 1
fi

log() { echo -e "\n\033[1;34m==>\033[0m $1"; }
fail() { echo -e "\033[1;31mERROR:\033[0m $1" >&2; exit 1; }

log "Checking OS version"
if ! grep -q 'Ubuntu 22.04' /etc/os-release 2>/dev/null; then
  echo "WARNING: This script targets Ubuntu 22.04 LTS. Continuing anyway, but things may differ on other releases."
fi

log "Updating package index"
apt-get update -y || fail "apt-get update failed"

log "Installing base packages (curl, git, rsync, build-essential, ca-certificates)"
apt-get install -y curl git rsync build-essential ca-certificates gnupg lsb-release || fail "Base package install failed"

log "Installing Node.js 20.x LTS"
if ! command -v node >/dev/null 2>&1 || [[ "$(node -v | cut -d. -f1 | tr -d v)" -lt 18 ]]; then
  curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
  apt-get install -y nodejs || fail "Node.js install failed"
else
  echo "Node.js already installed: $(node -v)"
fi
node -v
npm -v

log "Installing PostgreSQL"
if ! command -v psql >/dev/null 2>&1; then
  apt-get install -y postgresql postgresql-contrib || fail "PostgreSQL install failed"
fi
systemctl enable postgresql
systemctl start postgresql
su - postgres -c "psql -c 'SELECT version();'" || fail "PostgreSQL is not responding after install"

log "Installing Nginx"
if ! command -v nginx >/dev/null 2>&1; then
  apt-get install -y nginx || fail "Nginx install failed"
fi
systemctl enable nginx
systemctl start nginx

log "Installing certbot (for optional HTTPS/Let's Encrypt setup)"
apt-get install -y certbot python3-certbot-nginx || echo "WARNING: certbot install failed — HTTPS setup will need to be done manually. See docs/INSTALL.md."

log "Creating dedicated application system user 'vcl-app' (no login shell)"
if ! id -u vcl-app >/dev/null 2>&1; then
  useradd --system --create-home --home-dir /opt/visitor-call-log --shell /usr/sbin/nologin vcl-app
  echo "Created system user 'vcl-app'."
else
  echo "User 'vcl-app' already exists."
fi

log "Prerequisites installed successfully."
echo "Node:       $(node -v)"
echo "npm:        $(npm -v)"
echo "PostgreSQL: $(su - postgres -c 'psql -c "SHOW server_version;" -t' | xargs)"
echo "Nginx:      $(nginx -v 2>&1)"
echo
echo "Next step: sudo ./deploy/install.sh"
