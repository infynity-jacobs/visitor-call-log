-- Migration 004: Safe user deletion and historical-record preservation
BEGIN;

-- Historical records must survive deletion of the user who created them.
ALTER TABLE visitors DROP CONSTRAINT IF EXISTS visitors_created_by_fkey;
ALTER TABLE visitors ADD CONSTRAINT visitors_created_by_fkey
  FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL;

ALTER TABLE call_logs DROP CONSTRAINT IF EXISTS call_logs_created_by_fkey;
ALTER TABLE call_logs ADD CONSTRAINT call_logs_created_by_fkey
  FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL;

ALTER TABLE audit_log DROP CONSTRAINT IF EXISTS audit_log_user_id_fkey;
ALTER TABLE audit_log ADD CONSTRAINT audit_log_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL;

INSERT INTO schema_migrations (version) VALUES ('004_user_delete_and_search') ON CONFLICT DO NOTHING;
COMMIT;
