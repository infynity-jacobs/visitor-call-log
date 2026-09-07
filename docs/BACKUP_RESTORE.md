# Backup & Restore

## Taking a backup

```bash
sudo ./deploy/backup.sh
```

Writes a timestamped, gzip-compressed SQL dump to `/var/backups/visitor-call-log/` by
default, e.g. `visitor-call-log-20260115-143000.sql.gz`. Pass a different directory as
an argument if needed: `sudo ./deploy/backup.sh /path/to/backups`.

- Never overwrites an existing backup file (each is timestamped to the second).
- Automatically keeps only the most recent 30 backups in the target directory,
  deleting older ones.
- Runs automatically before every `deploy/update.sh` and `deploy/uninstall.sh`.

## Restoring a backup

```bash
sudo ./deploy/restore.sh /var/backups/visitor-call-log/visitor-call-log-20260115-143000.sql.gz
```

This is a **destructive** operation — it drops and recreates the entire database before
loading the backup. You'll be asked to type `yes` to confirm. The script:

1. Stops the `visitor-call-log` service (if running) so nothing writes to the database mid-restore
2. Terminates any remaining connections to the database
3. Drops and recreates the database (owned by the application role)
4. Loads the SQL dump (auto-detects `.gz` vs plain `.sql`)
5. Restarts the service (if it was running before)

## Scheduling automatic backups

Add a daily cron job as root:

```bash
sudo crontab -e
```

```
0 2 * * * /opt/visitor-call-log/deploy/backup.sh >> /var/log/visitor-call-log-backup.log 2>&1
```

## Off-server backup copies

The backup directory (`/var/backups/visitor-call-log` by default) lives on the same
server as the database. For real disaster recovery, periodically copy backups
off-server — e.g. `rsync` to another host, or sync to object storage:

```bash
rsync -avz /var/backups/visitor-call-log/ user@backup-host:/backups/visitor-call-log/
```

## Verifying a backup is restorable

Periodically test restores on a separate/staging server rather than assuming backups
are good. A backup you've never restored is not a verified backup.
