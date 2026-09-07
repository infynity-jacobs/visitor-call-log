# Tests

## Layout

- `unit/` — pure logic tests with no external dependencies (validators, the SMTP
  password encryption helper). Run in milliseconds, no database needed.
- `integration/api.test.js` — spawns the real backend as a child process against a
  real PostgreSQL database and exercises the HTTP API the same way a browser would
  (login, auth enforcement, conditional-field validation, duplicate-submission
  handling, call log, report generation, admin-only settings enforcement, branding).
- `e2e/` — end-to-end browser tests (placeholder — see below).

## Running tests

```bash
cd app/backend
npm test              # unit + integration
npm run test:unit     # unit only, no database required
npm run test:integration
```

### Integration test requirements

Integration tests need a reachable PostgreSQL database with the schema migrated and
seeded (the seeded `admin` / `admin123` user is used to authenticate test requests).
Point them at a scratch database — **never run these against production data**, since
some tests create and delete real rows (test users, a throwaway purpose option).

```bash
# One-time setup of a local test database:
sudo -u postgres psql -c "CREATE ROLE vcl_app WITH LOGIN PASSWORD 'devpassword';"
sudo -u postgres psql -c "CREATE DATABASE visitor_call_log OWNER vcl_app;"
./deploy/migrate.sh   # from the repo root, with app/backend/.env pointing at it
```

Environment variables (`DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASSWORD`) can
override the defaults in `tests/integration/api.test.js` if your test database differs
from the standard local setup.

## What's covered

- **Unit**: field validators (name/phone/email/date/time), date-filter validation, SMTP password
  encrypt/decrypt round-tripping.
- **Integration**: login (success/failure), auth enforcement on protected routes,
  Visitor Register conditional-field validation (e.g. Enquiry requires Enquiry Type),
  duplicate-submission handling via idempotency keys, call log creation and listing,
  admin-only enforcement on Settings endpoints, branding read/update.

## E2E (`e2e/`)

This directory is a placeholder for browser-driven end-to-end tests (e.g. Playwright or
Cypress) covering full user flows: log in, save a visitor with each Purpose's
conditional fields, generate and download a report, configure SMTP and send a test
email. Add your preferred E2E framework's config and specs here as the frontend
stabilizes.

The unit suite also verifies that the Super Administrator middleware is exported and callable, preventing route startup failures caused by an undefined DELETE-route middleware.
