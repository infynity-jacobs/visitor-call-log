BEGIN;

-- Ensure the singleton S50 CDR settings row exists.
-- Migration 008 created the table but did not seed its required id=1 row.
INSERT INTO s50_cdr_settings (id)
VALUES (1)
ON CONFLICT (id) DO NOTHING;

INSERT INTO schema_migrations (version)
VALUES ('009_seed_s50_cdr_settings')
ON CONFLICT DO NOTHING;

COMMIT;
