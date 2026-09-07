-- Migration 003: Security/session integrity improvements
BEGIN;

ALTER TABLE users ADD COLUMN IF NOT EXISTS session_version INTEGER NOT NULL DEFAULT 0;

INSERT INTO schema_migrations (version) VALUES ('003_security_and_constraints') ON CONFLICT DO NOTHING;

COMMIT;
