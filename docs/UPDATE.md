# Updating the Application

## Standard update

```bash
cd /opt/visitor-call-log
sudo ./deploy/update.sh
```

By default this updates to `origin/main`. To update to a specific tag or branch:

```bash
sudo ./deploy/update.sh v1.1.0
```

## What it does

1. Reads the currently installed version from `VERSION`
2. **Backs up the database** (via `deploy/backup.sh`) before touching anything
3. Fetches and checks out the requested Git ref
4. Reads the new version from `VERSION`
5. Installs/updates backend dependencies (`npm ci --omit=dev`)
6. Rebuilds the frontend (`npm ci && npm run build`)
7. Runs any new database migrations (`deploy/migrate.sh`)
8. Restarts the `visitor-call-log` service
9. Verifies the service is active and passes a health check
10. Reports the old and new versions:

```
Update complete.
Previous Version: 1.0.0
New Version:      1.1.0
```

## If something goes wrong

The script backs up the database *before* making any changes, so:

- **Health check fails after update** — the script exits non-zero and tells you to
  check `journalctl -u visitor-call-log -n 50`. The database backup from step 2 is
  available in `/var/backups/visitor-call-log` if you need to restore it.
- **Roll back the code**: `cd /opt/visitor-call-log && sudo -u vcl-app git checkout <old-tag>`,
  then re-run the dependency install, migration, and restart steps manually (or re-run
  `deploy/update.sh <old-tag>`).
- **Roll back the data**: `sudo ./deploy/restore.sh /var/backups/visitor-call-log/<file>.sql.gz`
  (see [BACKUP_RESTORE.md](BACKUP_RESTORE.md)).

## Avoiding data loss

- Migrations are additive and idempotent (see [MIGRATION.md](MIGRATION.md)) — they never
  drop existing data.
- A backup is always taken before any update, regardless of whether the update itself
  changes the schema.
- The update never overwrites an existing `app/backend/.env` — your secrets and
  configuration persist across updates.


## Git-based production deployment

The production application is deployed from a Git working copy, typically `/home/administrator/visitor-call-log`, into `/opt/visitor-call-log`. The production directory itself does not need to be a Git checkout.

Run from the Git checkout:

```bash
cd /home/administrator/visitor-call-log
sudo ./deploy/update.sh
```

To deploy a specific tag/commit:

```bash
sudo ./deploy/update.sh <git-ref>
```

The update process fetches the repository, verifies a clean working tree, creates a PostgreSQL backup, stages and builds the release outside the production directory, preserves `app/backend/.env`, deploys the code, runs pending migrations, restarts the service, and verifies `/api/health`. A rollback copy of the previous application code is retained under `/var/backups/visitor-call-log/releases/`.

Do not run the update script from `/opt/visitor-call-log`; run it from the Git checkout.


## v1.1.0 update notes

The v1.1.0 release includes database migration `004_user_delete_and_search`, which changes user ownership foreign keys to `ON DELETE SET NULL` so deleting a user never deletes historical Visitor Register, Call Log, or audit records. The update script applies this migration automatically after taking its normal database backup.

Application date/time display and report timestamps are presented in Asia/Kolkata (IST). Stored date/time values remain database UTC clock values for backward compatibility; filters convert IST calendar dates to the corresponding UTC bounds.
