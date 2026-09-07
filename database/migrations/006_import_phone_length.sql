-- Migration 006: Allow historical phone values longer than 30 characters.
-- Historical workbooks may contain multiple phone numbers in one cell.
BEGIN;

ALTER TABLE visitors ALTER COLUMN phone TYPE VARCHAR(100);
ALTER TABLE call_logs ALTER COLUMN phone TYPE VARCHAR(100);
ALTER TABLE branding_settings ALTER COLUMN phone TYPE VARCHAR(100);

INSERT INTO schema_migrations (version)
VALUES ('006_import_phone_length')
ON CONFLICT DO NOTHING;

COMMIT;
