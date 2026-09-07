# Installation Guide

Deploying the Visitor Register & Call Log application on a fresh **Ubuntu 22.04 LTS** server.

## 1. Requirements

- A fresh (or clean) Ubuntu 22.04 LTS server, with root/sudo access
- Outbound internet access (to install packages and clone the repo)
- At least 1 vCPU / 1GB RAM for small deployments; 2 vCPU / 2GB RAM recommended
- A domain name pointed at the server, if you want HTTPS (optional but recommended)

## 2. Clone the repository

```bash
sudo apt-get install -y git   # if git isn't already present
git clone <your-repo-url> visitor-call-log
cd visitor-call-log
```

## 3. Install prerequisites

This installs Node.js 20 LTS, PostgreSQL, Nginx, certbot, and creates the dedicated
`vcl-app` system user.

```bash
sudo ./deploy/install_prerequisites.sh
```

Safe to re-run — every step checks whether its target is already installed.

## 4. Run the installer

```bash
sudo ./deploy/install.sh --domain vcl.yourdomain.com
```

Omit `--domain` to install without a domain name (accessible by server IP over HTTP only).

This script:
1. Copies the application code to `/opt/visitor-call-log`
2. Creates the PostgreSQL role and database (generating a random password, saved to
   `/etc/visitor-call-log/db_password`)
3. Writes `app/backend/.env` with generated `JWT_SECRET` and `APP_SECRET_KEY` values
4. Installs backend dependencies and builds the frontend
5. Runs database migrations (see [MIGRATION.md](MIGRATION.md))
6. Installs and starts the `visitor-call-log` systemd service
7. Configures and reloads Nginx
8. Runs a health check

If any step fails, the script prints a clear error and stops — fix the issue and re-run;
already-completed steps (existing `.env`, existing database) are left in place.

## 5. First login

- URL: `http://<server-ip>/` or `http://vcl.yourdomain.com/`
- Username: `admin`
- Password: `admin123`

**Change this password immediately** under Settings → Users, or via:

```bash
curl -X POST http://localhost:3000/api/auth/change-password \
  -H "Authorization: Bearer <token>" -H 'Content-Type: application/json' \
  -d '{"currentPassword":"admin123","newPassword":"<a strong password>"}'
```

## 6. HTTPS configuration

Once your domain's DNS points at the server:

```bash
sudo certbot --nginx -d vcl.yourdomain.com
```

Certbot edits the Nginx config in place to add the `listen 443 ssl` block, obtains a
certificate from Let's Encrypt, and sets up auto-renewal (`certbot.timer`, enabled by
default on Ubuntu). Verify auto-renewal works with:

```bash
sudo certbot renew --dry-run
```

To configure HTTPS manually with a certificate from another provider, add a `listen 443 ssl`
server block to `/etc/nginx/sites-available/visitor-call-log.conf` referencing your
certificate and key paths, then `sudo systemctl reload nginx`.

## 7. Domain configuration

If you did not pass `--domain` during install, or you want to change it later:

1. Edit `/etc/nginx/sites-available/visitor-call-log.conf` and replace `server_name _;`
   with `server_name your-new-domain.com;`
2. `sudo nginx -t && sudo systemctl reload nginx`
3. If also enabling HTTPS, run `sudo certbot --nginx -d your-new-domain.com`

## 8. Upload limits

Report attachments and any logo uploads are capped by Nginx's `client_max_body_size`
(set to 10m by default) in `deploy/nginx/visitor-call-log.conf`, and by Express's JSON
body limit (`2mb`, in `app/backend/src/server.js`). Increase both together if you need
larger uploads.

## 9. Static file handling

The Nginx config serves the built frontend (`app/frontend/dist`) directly and proxies
everything under `/api/` to the Node backend on `127.0.0.1:3000`. Static assets under
`/assets/` are cached for 30 days since Vite fingerprints filenames on every build.

## Next steps

- [UPDATE.md](UPDATE.md) — deploying new versions
- [BACKUP_RESTORE.md](BACKUP_RESTORE.md) — backing up and restoring data
- [ADMIN_GUIDE.md](ADMIN_GUIDE.md) — day-to-day administration
- [TROUBLESHOOTING.md](TROUBLESHOOTING.md) — common problems
