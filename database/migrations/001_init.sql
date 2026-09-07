-- Migration 001: Initial schema
-- Applies core tables for Visitor Register & Call Log application.
-- Migration runner tracks applied files in schema_migrations.

BEGIN;

CREATE TABLE IF NOT EXISTS schema_migrations (
    version       VARCHAR(255) PRIMARY KEY,
    applied_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------
-- Users / Authentication
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS users (
    id            SERIAL PRIMARY KEY,
    username      VARCHAR(100) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    full_name     VARCHAR(255),
    role          VARCHAR(20) NOT NULL DEFAULT 'user' CHECK (role IN ('user', 'admin')),
    is_active     BOOLEAN NOT NULL DEFAULT true,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------
-- Configurable option tables (Purpose, Enquiry Type, Meeting Person)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS purpose_options (
    id            SERIAL PRIMARY KEY,
    label         VARCHAR(100) NOT NULL,
    is_enabled    BOOLEAN NOT NULL DEFAULT true,
    sort_order    INTEGER NOT NULL DEFAULT 0,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS enquiry_type_options (
    id            SERIAL PRIMARY KEY,
    label         VARCHAR(100) NOT NULL,
    is_enabled    BOOLEAN NOT NULL DEFAULT true,
    sort_order    INTEGER NOT NULL DEFAULT 0,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS meeting_person_options (
    id            SERIAL PRIMARY KEY,
    label         VARCHAR(100) NOT NULL,
    is_enabled    BOOLEAN NOT NULL DEFAULT true,
    sort_order    INTEGER NOT NULL DEFAULT 0,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------
-- Visitors
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS visitors (
    id                  SERIAL PRIMARY KEY,
    visit_date          DATE NOT NULL DEFAULT CURRENT_DATE,
    visit_time          TIME NOT NULL DEFAULT CURRENT_TIME,
    name                VARCHAR(255) NOT NULL,
    place               VARCHAR(255),
    phone               VARCHAR(30),
    purpose             VARCHAR(100) NOT NULL,
    purpose_details     TEXT,
    enquiry_type        VARCHAR(100),
    enquiry_details      TEXT,
    complaint_details   TEXT,
    purchase_details    TEXT,
    person_to_visit     VARCHAR(100),
    person_to_visit_other VARCHAR(255),
    interview_details   TEXT,
    donation_details    TEXT,
    other_details       TEXT,
    created_by          INTEGER REFERENCES users(id),
    idempotency_key     VARCHAR(100) UNIQUE,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_visitors_date ON visitors (visit_date);

-- ---------------------------------------------------------------------
-- Call Log
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS call_logs (
    id                SERIAL PRIMARY KEY,
    call_date         DATE NOT NULL DEFAULT CURRENT_DATE,
    call_time         TIME NOT NULL DEFAULT CURRENT_TIME,
    name              VARCHAR(255) NOT NULL,
    place             VARCHAR(255),
    phone             VARCHAR(30),
    reason            TEXT NOT NULL,
    created_by        INTEGER REFERENCES users(id),
    idempotency_key   VARCHAR(100) UNIQUE,
    created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_call_logs_date ON call_logs (call_date);

-- ---------------------------------------------------------------------
-- Branding settings (single row)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS branding_settings (
    id              SMALLINT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
    org_name        VARCHAR(255) NOT NULL DEFAULT 'Your Organization',
    logo_path       VARCHAR(500),
    address         TEXT,
    phone           VARCHAR(30),
    email           VARCHAR(255),
    website         VARCHAR(255),
    report_header   TEXT,
    report_footer   TEXT,
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------
-- SMTP settings (single row) - password stored encrypted at app layer
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS smtp_settings (
    id                SMALLINT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
    smtp_host         VARCHAR(255),
    smtp_port         INTEGER,
    security          VARCHAR(10) NOT NULL DEFAULT 'none' CHECK (security IN ('none', 'tls', 'ssl')),
    smtp_username     VARCHAR(255),
    smtp_password_enc TEXT, -- encrypted using APP_SECRET_KEY, never returned to client
    from_email        VARCHAR(255),
    from_name         VARCHAR(255),
    updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------
-- Audit log (configuration changes / errors of note)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS audit_log (
    id          SERIAL PRIMARY KEY,
    user_id     INTEGER REFERENCES users(id),
    action      VARCHAR(100) NOT NULL,
    details     JSONB,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO schema_migrations (version) VALUES ('001_init') ON CONFLICT DO NOTHING;

COMMIT;
