BEGIN;

-- Preserve the existing manual Call Log as a read-only archive before the
-- active Call Log is repurposed for Yeastar S50 CDR inspection.
ALTER TABLE call_logs RENAME TO call_logs_archive;
ALTER INDEX IF EXISTS idx_call_logs_date RENAME TO idx_call_logs_archive_date;
ALTER INDEX IF EXISTS call_logs_idempotency_key_key RENAME TO call_logs_archive_idempotency_key_key;

CREATE TABLE IF NOT EXISTS s50_call_logs (
    id                  BIGSERIAL PRIMARY KEY,
    call_id             VARCHAR(255) NOT NULL UNIQUE,
    start_at             TIMESTAMP NOT NULL,
    direction            VARCHAR(30),
    call_from            VARCHAR(255),
    call_to              VARCHAR(255),
    trunk                VARCHAR(255),
    did_number           VARCHAR(255),
    duration_seconds     INTEGER,
    talk_duration_seconds INTEGER,
    status               VARCHAR(100),
    recording            VARCHAR(500),
    raw_data             JSONB NOT NULL DEFAULT '{}'::jsonb,
    first_seen_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at           TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_s50_call_logs_start_at ON s50_call_logs(start_at DESC);
CREATE INDEX IF NOT EXISTS idx_s50_call_logs_direction ON s50_call_logs(direction);
CREATE INDEX IF NOT EXISTS idx_s50_call_logs_status ON s50_call_logs(status);
CREATE INDEX IF NOT EXISTS idx_s50_call_logs_call_from ON s50_call_logs(call_from);
CREATE INDEX IF NOT EXISTS idx_s50_call_logs_call_to ON s50_call_logs(call_to);

CREATE TABLE IF NOT EXISTS s50_cdr_settings (
    id                  SMALLINT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
    enabled             BOOLEAN NOT NULL DEFAULT false,
    server              VARCHAR(255),
    api_protocol        VARCHAR(10) NOT NULL DEFAULT 'https' CHECK (api_protocol IN ('http','https')),
    api_port            INTEGER NOT NULL DEFAULT 8088,
    api_version         VARCHAR(30) NOT NULL DEFAULT '2.0.0',
    api_username        VARCHAR(255),
    api_password_enc    TEXT,
    verify_tls          BOOLEAN NOT NULL DEFAULT false,
    auto_sync           BOOLEAN NOT NULL DEFAULT false,
    auto_sync_minutes   INTEGER NOT NULL DEFAULT 15 CHECK (auto_sync_minutes >= 5 AND auto_sync_minutes <= 1440),
    last_sync_at        TIMESTAMPTZ,
    last_sync_status    VARCHAR(30),
    last_sync_message   TEXT,
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO schema_migrations (version)
VALUES ('008_s50_cdr_archive')
ON CONFLICT DO NOTHING;

COMMIT;
