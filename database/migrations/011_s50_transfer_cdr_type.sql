BEGIN;

-- PBX historical CDRs include the legitimate Yeastar "Transfer" type.
-- Extend the normalized call classification without altering existing data.

ALTER TABLE s50_call_logs
  DROP CONSTRAINT IF EXISTS s50_call_logs_call_type_check;

ALTER TABLE s50_call_logs
  ADD CONSTRAINT s50_call_logs_call_type_check
  CHECK (
    call_type IN ('internal', 'inbound', 'outbound', 'transfer')
  );

INSERT INTO schema_migrations (version)
VALUES ('011_s50_transfer_cdr_type')
ON CONFLICT DO NOTHING;

COMMIT;
