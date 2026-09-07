# Administrator Guide

## Roles

- **Normal user**: add visitor records, add call log records, view/export/email reports.
- **Administrator**: everything a normal user can do, plus manage Purpose/Enquiry
  Type/Meeting Person options, branding, SMTP configuration, and user accounts.

Manage users under **Settings → Users** (admin only). The first admin account is the
seeded `admin` user — change its password immediately after installation.

## Configuring dropdown options

Under **Settings**, each of the three configurable option lists (Purpose, Enquiry Type,
Meeting Person) supports:
- **Add** — type a label and click Add; it's appended to the end of the list
- **Edit** — click Edit, change the label, click Save
- **Enable/Disable** — disabled options no longer appear in the Visitor Register form,
  but historical records that used them are unaffected
- **Delete** — permanently removes the option (existing visitor records keep their
  originally recorded value as free text, since it's stored on the record itself)
- **Reorder** — the ↑/↓ buttons change display order in the form's dropdown

## Branding

Under **Settings → Branding**, configure your organization name, logo, address, phone,
email, website, and report header/footer text. These appear:
- In the app itself (organization name)
- On every generated PDF and Excel report
- In the body of emailed reports

## SMTP configuration

Under **Settings → SMTP**, configure your outgoing mail server: host, port, security
(None/TLS/SSL), username, password, and From address/name. The password is encrypted
before being stored and is never sent back to the browser (the field always shows blank
— leave it blank when saving to keep the existing password unchanged).

Use **Send test email** to confirm the configuration works before relying on it.

Common provider settings:

| Provider | Host | Port | Security |
|---|---|---|---|
| Gmail (app password) | smtp.gmail.com | 587 | TLS |
| Office 365 | smtp.office365.com | 587 | TLS |
| Generic/self-hosted | (your host) | 465 or 587 | SSL or TLS |

## Reports

From the **Reports** page, choose Visitors Register or Call Log, a date filter (all
records / a specific date / a date range), then Download Excel, Download PDF, or Email
report. Emailed reports use the SMTP configuration above and attach the same file you'd
download.

## Application version

The current version is shown at the bottom of the Settings page, and is also available
via `GET /api/settings/version`. It's read from the `VERSION` file at the repo root,
which `deploy/update.sh` reports as "Previous Version" / "New Version" on every update.

## Day-to-day data entry

The Visitor Register and Call Log forms are optimized for fast entry: fields default to
the current date/time, the Save button clears the form immediately after a successful
save so the next visitor can be entered right away, and duplicate accidental
double-submissions (e.g. a double-click) are automatically detected and treated as a
single save rather than creating two records.
