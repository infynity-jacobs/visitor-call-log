BEGIN;

ALTER TABLE s50_call_logs
    ADD COLUMN cdr_key VARCHAR(32);

UPDATE s50_call_logs
SET cdr_key = md5(
    array_to_string(
        ARRAY[
            COALESCE(NULLIF(btrim(call_id), ''), '<NULL>'),
            COALESCE(to_char(start_at, 'YYYY-MM-DD HH24:MI:SS'), '<NULL>'),
            COALESCE(NULLIF(lower(btrim(call_type)), ''), '<NULL>'),
            COALESCE(NULLIF(btrim(call_from), ''), '<NULL>'),
            COALESCE(NULLIF(btrim(call_to), ''), '<NULL>'),
            COALESCE(NULLIF(btrim(trunk), ''), '<NULL>'),
            COALESCE(NULLIF(btrim(raw_data->>'dsttrunkname'), ''), '<NULL>'),
            COALESCE(NULLIF(btrim(did_number), ''), '<NULL>'),
            COALESCE(duration_seconds::text, '<NULL>'),
            COALESCE(talk_duration_seconds::text, '<NULL>'),
            COALESCE(NULLIF(lower(btrim(status)), ''), '<NULL>')
        ],
        chr(31)
    )
);

DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM s50_call_logs
        WHERE cdr_key IS NULL OR btrim(cdr_key) = ''
    ) THEN
        RAISE EXCEPTION 'Migration 012 aborted: NULL/empty cdr_key found';
    END IF;

    IF EXISTS (
        SELECT cdr_key
        FROM s50_call_logs
        GROUP BY cdr_key
        HAVING COUNT(*) > 1
    ) THEN
        RAISE EXCEPTION 'Migration 012 aborted: duplicate cdr_key found';
    END IF;
END
$$;

ALTER TABLE s50_call_logs
    ALTER COLUMN cdr_key SET NOT NULL;

ALTER TABLE s50_call_logs
    DROP CONSTRAINT IF EXISTS s50_call_logs_call_id_key;

CREATE UNIQUE INDEX s50_call_logs_cdr_key_key
    ON s50_call_logs (cdr_key);

CREATE INDEX IF NOT EXISTS idx_s50_call_logs_call_id
    ON s50_call_logs (call_id);

INSERT INTO schema_migrations (version)
VALUES ('012_s50_cdr_identity')
ON CONFLICT DO NOTHING;

COMMIT;
