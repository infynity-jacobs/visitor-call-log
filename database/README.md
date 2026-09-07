# Database

PostgreSQL schema and migrations for the Visitor Register & Call Log application.

## Layout

- `migrations/` — numbered, idempotent SQL migration files (`001_init.sql`, `002_seed_defaults.sql`, ...).
  Each file is wrapped in a transaction and records itself in `schema_migrations` so it is never applied twice.
- `seeds/` — optional additional seed data for development/demo purposes (not applied in production by default).

## Applying migrations

Migrations are applied by `deploy/migrate.sh`, which runs every `*.sql` file in `migrations/` in filename order
through `psql`, skipping any version already recorded in `schema_migrations`.

```bash
sudo ./deploy/migrate.sh
```

## Adding a new migration

1. Create the next-numbered file, e.g. `003_add_xyz.sql`.
2. Wrap changes in `BEGIN; ... COMMIT;`.
3. Use `IF NOT EXISTS` / `ON CONFLICT DO NOTHING` so the file is safe to re-run.
4. End the file with:
   ```sql
   INSERT INTO schema_migrations (version) VALUES ('003_add_xyz') ON CONFLICT DO NOTHING;
   ```
5. Commit the file and run `deploy/migrate.sh` (or `deploy/update.sh`, which runs it automatically) on each environment.

Never edit a migration that has already been applied to any environment — add a new migration instead.
