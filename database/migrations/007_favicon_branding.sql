BEGIN;

ALTER TABLE branding_settings
  ADD COLUMN IF NOT EXISTS favicon_path VARCHAR(500);

INSERT INTO schema_migrations (version)
VALUES ('007_favicon_branding')
ON CONFLICT DO NOTHING;

COMMIT;
