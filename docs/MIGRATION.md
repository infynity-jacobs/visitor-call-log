# Database Migrations

## Running migrations

```bash
sudo ./deploy/migrate.sh
```

This applies every `*.sql` file in `database/migrations/`, in filename order, that
hasn't already been applied. Applied versions are tracked in the `schema_migrations`
table, so the script is always safe to re-run — already-applied migrations are skipped
(`[skip]`), and only pending ones are applied (`[apply]`).

`deploy/install.sh` and `deploy/update.sh` both call this script automatically; you
only need to run it by hand if you're troubleshooting or applying a migration outside
the normal install/update flow.

## How migrations are structured

Each file:
- Is wrapped in `BEGIN; ... COMMIT;` — a failure partway through rolls back cleanly
- Uses `IF NOT EXISTS` / `ON CONFLICT DO NOTHING` so it's idempotent even if re-run
- Ends by recording itself: `INSERT INTO schema_migrations (version) VALUES ('00N_name') ON CONFLICT DO NOTHING;`

See [`database/README.md`](../database/README.md) for the full authoring guide and an
example of adding a new migration.

## Detecting the current database version

```bash
PGPASSWORD=<password> psql -h localhost -U vcl_app -d visitor_call_log \
  -c "SELECT version, applied_at FROM schema_migrations ORDER BY applied_at;"
```

## If a migration fails

The failing file's own transaction rolls back automatically (nothing partial is left
behind), and `migrate.sh` stops immediately rather than attempting later files. Fix the
SQL in that migration file and re-run `sudo ./deploy/migrate.sh` — migrations already
recorded in `schema_migrations` are skipped, so only the fixed file (and anything after
it) will be applied.

## Safe upgrade path between versions

Because migrations are additive, numbered, and tracked, upgrading from any older
version to a newer one is just: pull the new code, then run `deploy/migrate.sh` (or
`deploy/update.sh`, which does this for you). Every migration between your current
version and the target version is applied in order automatically — you never need to
manually track which schema changes you've already received.
