# Visitor Register & Call Log

A production-ready web application for front-office/reception use: a **Visitor Register**
with configurable, purpose-driven conditional fields, and a **Call Log** for recording
incoming/outgoing calls — with Excel/PDF/email reporting, configurable branding, and
SMTP-based email delivery.

## Features

- **Visitor Register** — fast-entry form with auto S.No., date/time defaults, and
  dynamic conditional fields based on the selected Purpose (Bill Pay, Enquiry, Complaint,
  Purchase, Meeting, Interview, Donation, Other), each with its own detail field(s).
  Duplicate accidental submissions (e.g. double-clicking Save) are automatically detected
  and treated as a single record.
- **Call Log** — the same fast-entry pattern for phone calls: name, place, phone, and a
  free-text reason.
- **Configurable dropdowns** — Purpose, Enquiry Type, and Meeting Person options are all
  managed from Settings: add, edit, delete, enable/disable, and reorder, without touching code.
- **Reports** — Visitors Register and Call Log reports, filterable by a specific date, a
  date range, or all records; exportable as **Excel (.xlsx)** or **PDF**, or emailed
  directly with a configurable recipient/subject/message.
- **Branding** — organization name, logo, address, contact details, and report
  header/footer, reflected throughout the app and on every generated report/email.
- **SMTP configuration** — host/port/security/credentials configured in-app, with a
  **Send test email** function; passwords are encrypted before being stored and are
  never returned to the browser.
- **Authentication & roles** — JWT-based login with **Normal user** (data entry, reports)
  and **Administrator** (all settings, user management) roles.
- **PostgreSQL + versioned migrations** — every schema change is a numbered, idempotent
  SQL file; safe to re-run and safe to upgrade between versions.
- **Fully automated deployment** — prerequisite installation, application installation,
  database migration, application update, and backup/restore are all single-command
  scripts designed for a fresh Ubuntu 22.04 LTS server.

## Architecture

- **Backend**: Node.js + Express (`app/backend`) — REST API, JWT auth, PDF/Excel
  generation (`pdfkit`, `exceljs`), email via `nodemailer`.
- **Frontend**: React + Vite (`app/frontend`) — single-page app, plain CSS (no framework
  dependency), talks to the backend under `/api/*`.
- **Database**: PostgreSQL, schema and seed data in `database/migrations/`.
- **Reverse proxy**: Nginx serves the built frontend and proxies `/api/` to the backend.
- **Process management**: systemd (`visitor-call-log.service`) runs the backend as a
  dedicated non-root user (`vcl-app`) with automatic restart.

```
Browser ── Nginx (80/443) ──┬── static files (app/frontend/dist)
                             └── /api/* ── Node/Express (127.0.0.1:3000) ── PostgreSQL
```

## Software requirements

- Ubuntu 22.04 LTS
- Node.js 20.x LTS
- PostgreSQL 14+ (installed automatically; Ubuntu 22.04's default is used)
- Nginx

## Server requirements

- 1+ vCPU, 1GB+ RAM for small deployments (2 vCPU / 2GB recommended)
- Outbound internet access for package installation and (if used) email delivery

## Quick start (fresh Ubuntu 22.04 server)

```bash
git clone <your-repo-url> visitor-call-log
cd visitor-call-log
sudo ./deploy/install_prerequisites.sh
sudo ./deploy/install.sh --domain vcl.yourdomain.com
```

Then log in at `http://vcl.yourdomain.com/` with username `admin`, password `admin123`,
and **change the password immediately** under Settings → Users.

Full walkthrough: **[docs/INSTALL.md](docs/INSTALL.md)**.

## Documentation

| Guide | Covers |
|---|---|
| [docs/INSTALL.md](docs/INSTALL.md) | Fresh server installation, HTTPS, domain configuration |
| [docs/UPDATE.md](docs/UPDATE.md) | Deploying new versions |
| [docs/MIGRATION.md](docs/MIGRATION.md) | How database migrations work and how to add one |
| [docs/BACKUP_RESTORE.md](docs/BACKUP_RESTORE.md) | Backing up and restoring the database |
| [docs/ADMIN_GUIDE.md](docs/ADMIN_GUIDE.md) | Day-to-day administration: users, branding, SMTP, options |
| [docs/TROUBLESHOOTING.md](docs/TROUBLESHOOTING.md) | Common problems and how to diagnose them |
| [database/README.md](database/README.md) | Migration file conventions |

## Configuration

Copy `config/.env.example` (or `config/production.env.example` for a production
starting point) to `app/backend/.env` and fill in real values. `deploy/install.sh` does
this automatically, generating random secrets — you normally don't need to do it by
hand. See the file itself for what each variable controls. **Never commit a real `.env`
file** — it's covered by `.gitignore`.

## Development

```bash
# Backend
cd app/backend
cp ../../config/.env.example .env   # edit DB_* to point at your local Postgres
npm install
npm run dev                          # runs with --watch on src/server.js

# Frontend (separate terminal)
cd app/frontend
npm install
npm run dev                          # Vite dev server on :5173, proxies /api to :3000
```

Apply migrations against your local database with `./deploy/migrate.sh` (it works
against a checked-out repo, not just an installed one — see the script for details).

### Tests

```bash
tests/
├── unit/         # backend unit tests (validators, encryption helpers, etc.)
├── integration/  # API-level tests against a real database
└── e2e/          # end-to-end browser tests
```

Run backend unit/integration tests with `npm test` from `app/backend`. See
`tests/README.md` for details and how to point tests at a scratch database.

## Git workflow

- `main` is always deployable — `deploy/update.sh` defaults to `origin/main`.
- Tag releases (`v1.0.0`, `v1.0.1`, `v1.1.0`, ...) so `deploy/update.sh <tag>` can target
  a specific release rather than always tracking `main`.
- Add new database changes as a new numbered migration file — never edit a migration
  that's already been applied anywhere (see [docs/MIGRATION.md](docs/MIGRATION.md)).

## Versioning

The application version lives in the `VERSION` file at the repo root (e.g. `1.0.0`) and
is surfaced in the Settings page and via `GET /api/settings/version`. Bump it as part of
each release's commit/tag. `deploy/update.sh` reports the before/after version on every
update.

## Security notes

- SMTP and database passwords are never committed to Git (`.gitignore`) and the SMTP
  password specifically is encrypted at rest and never returned to the browser.
- The backend runs under a dedicated non-root system user (`vcl-app`) with a
  hardened systemd unit (`ProtectSystem=strict`, `NoNewPrivileges=true`, etc.).
- Settings pages (branding, SMTP, user management, dropdown option management) require
  the Administrator role; the API enforces this independently of the frontend.
