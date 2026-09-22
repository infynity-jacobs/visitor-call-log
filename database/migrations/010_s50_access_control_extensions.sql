BEGIN;

-- ---------------------------------------------------------------------------
-- S50 CDR access control and extension directory
-- ---------------------------------------------------------------------------

-- Add an explicit normalized call classification.
ALTER TABLE s50_call_logs
  ADD COLUMN IF NOT EXISTS call_type VARCHAR(20);

-- Backfill existing S50 CDRs from the original Yeastar direction/type.
UPDATE s50_call_logs
SET call_type = CASE lower(trim(direction))
  WHEN 'internal' THEN 'internal'
  WHEN 'inbound' THEN 'inbound'
  WHEN 'outbound' THEN 'outbound'
  ELSE NULL
END
WHERE call_type IS NULL;

-- The existing production CDR population contains only these three values.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 's50_call_logs_call_type_check'
      AND conrelid = 's50_call_logs'::regclass
  ) THEN
    ALTER TABLE s50_call_logs
      ADD CONSTRAINT s50_call_logs_call_type_check
      CHECK (call_type IN ('internal', 'inbound', 'outbound'));
  END IF;
END
$$;

-- New CDRs must always have an explicit classification.
ALTER TABLE s50_call_logs
  ALTER COLUMN call_type SET NOT NULL;

CREATE INDEX IF NOT EXISTS idx_s50_call_logs_call_type
  ON s50_call_logs(call_type);

-- ---------------------------------------------------------------------------
-- Local cache of the S50 extension directory.
-- The S50 remains the source of truth; this table is an application cache
-- used for display/search without calling the PBX for every CDR row.
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS s50_extensions (
  extension_number VARCHAR(100) PRIMARY KEY,
  username VARCHAR(255),
  status VARCHAR(100),
  type VARCHAR(100),
  first_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_s50_extensions_username
  ON s50_extensions(username);

CREATE INDEX IF NOT EXISTS idx_s50_extensions_status
  ON s50_extensions(status);

-- ---------------------------------------------------------------------------
-- Add Manager to the application role set.
-- Preserve all existing roles/users.
-- ---------------------------------------------------------------------------

ALTER TABLE users
  DROP CONSTRAINT IF EXISTS users_role_check;

ALTER TABLE users
  ADD CONSTRAINT users_role_check
  CHECK (
    role IN ('user', 'admin', 'manager', 'super_admin')
  );

INSERT INTO schema_migrations (version)
VALUES ('010_s50_access_control_extensions')
ON CONFLICT DO NOTHING;

COMMIT;
