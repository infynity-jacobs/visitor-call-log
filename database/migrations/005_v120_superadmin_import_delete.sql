-- Migration 005: Super Admin controls and historical Excel import metadata
BEGIN;

ALTER TABLE branding_settings ADD COLUMN IF NOT EXISTS logo_position VARCHAR(10) NOT NULL DEFAULT 'left' CHECK (logo_position IN ('left','right'));

ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;
ALTER TABLE users ADD CONSTRAINT users_role_check CHECK (role IN ('user', 'admin', 'super_admin'));
UPDATE users SET role = 'super_admin' WHERE username = 'admin';

CREATE TABLE IF NOT EXISTS import_batches (
  id SERIAL PRIMARY KEY,
  record_type VARCHAR(20) NOT NULL CHECK (record_type IN ('visitors','calllog')),
  source_filename VARCHAR(255) NOT NULL,
  source_sha256 VARCHAR(64) NOT NULL,
  source_timezone VARCHAR(64) NOT NULL DEFAULT 'Asia/Kolkata',
  total_rows INTEGER NOT NULL DEFAULT 0,
  imported_rows INTEGER NOT NULL DEFAULT 0,
  skipped_rows INTEGER NOT NULL DEFAULT 0,
  failed_rows INTEGER NOT NULL DEFAULT 0,
  created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_import_batches_file ON import_batches(record_type, source_sha256);

ALTER TABLE visitors ADD COLUMN IF NOT EXISTS import_batch_id INTEGER REFERENCES import_batches(id) ON DELETE SET NULL;
ALTER TABLE visitors ADD COLUMN IF NOT EXISTS source_sno VARCHAR(100);
ALTER TABLE visitors ADD COLUMN IF NOT EXISTS import_raw JSONB;
ALTER TABLE call_logs ADD COLUMN IF NOT EXISTS import_batch_id INTEGER REFERENCES import_batches(id) ON DELETE SET NULL;
ALTER TABLE call_logs ADD COLUMN IF NOT EXISTS source_sno VARCHAR(100);
ALTER TABLE call_logs ADD COLUMN IF NOT EXISTS import_raw JSONB;
CREATE INDEX IF NOT EXISTS idx_visitors_import_batch ON visitors(import_batch_id);
CREATE INDEX IF NOT EXISTS idx_call_logs_import_batch ON call_logs(import_batch_id);

INSERT INTO schema_migrations (version) VALUES ('005_v120_superadmin_import_delete') ON CONFLICT DO NOTHING;
COMMIT;
