# Troubleshooting

## Service won't start

```bash
sudo systemctl status visitor-call-log
sudo journalctl -u visitor-call-log -n 100 --no-pager
```

Common causes:
- **Missing/invalid `.env`** — check `app/backend/.env` exists and has all required
  variables (compare against `config/.env.example`).
- **Database unreachable** — verify PostgreSQL is running: `sudo systemctl status postgresql`.
- **Port already in use** — another process is bound to port 3000. Check with
  `sudo lsof -i :3000` and either stop it or change `PORT` in `.env` (and update the
  Nginx `proxy_pass` target to match).

## Health check fails

```bash
./scripts/health_check.sh
```

If it reports `"db":false`, the app is running but can't reach PostgreSQL — check the
`DB_*` variables in `.env` and that the `vcl_app` role/database exist:

```bash
sudo -u postgres psql -c "\du" -c "\l"
```

## 502 Bad Gateway from Nginx

The backend isn't responding on `127.0.0.1:3000`. Confirm the service is running
(`systemctl status visitor-call-log`) and check its logs. Also confirm
`/etc/nginx/sites-available/visitor-call-log.conf` proxies to the correct port.

## Migration fails partway through

Each migration file is wrapped in a transaction, so a failure rolls back cleanly rather
than leaving a half-applied schema. Read the error from `deploy/migrate.sh`'s output,
fix the SQL in the offending file, and re-run `sudo ./deploy/migrate.sh` — already-applied
migrations are skipped automatically. See [MIGRATION.md](MIGRATION.md).

## Emails aren't sending

1. Confirm SMTP settings are saved under **Settings → SMTP** and click **Send test email**.
2. Check the exact error message shown — it comes directly from the SMTP server/library
   and usually indicates the real cause (auth failure, wrong port, TLS mismatch).
3. For Gmail, you likely need an **App Password** rather than your regular password
   (requires 2-Step Verification to be enabled on the Google account).
4. Check `sudo journalctl -u visitor-call-log` for the full stack trace if the UI error
   is generic.

## Reports fail to generate or download

- Check `journalctl -u visitor-call-log` for the specific error — report generation
  failures are logged with detail server-side even though the UI shows a generic message.
- Very large date ranges can be slow; consider narrowing the range if generation times out.

## Forgot the admin password

If no admin account can log in, reset one directly via the database:

```bash
cd /opt/visitor-call-log/app/backend
node -e "console.log(require('bcryptjs').hashSync('NewPassword123', 10))"
```

Copy the printed hash, then:

```bash
sudo -u postgres psql -d visitor_call_log \
  -c "UPDATE users SET password_hash = '<hash from above>' WHERE username = 'admin';"
```

## Nginx SSL certificate issues

```bash
sudo certbot certificates          # see what's installed and expiry dates
sudo certbot renew --dry-run       # verify auto-renewal works
sudo nginx -t                      # verify config syntax after any manual edit
```

## Where logs live

- **Application logs**: `sudo journalctl -u visitor-call-log -f`
- **Nginx access/error logs**: `/var/log/nginx/access.log`, `/var/log/nginx/error.log`
- **PostgreSQL logs**: `/var/log/postgresql/`

## Still stuck?

Gather the following before asking for help:
- `sudo systemctl status visitor-call-log postgresql nginx`
- `sudo journalctl -u visitor-call-log -n 200 --no-pager`
- The exact error message shown in the browser
- Output of `curl -s http://localhost:3000/api/health`
