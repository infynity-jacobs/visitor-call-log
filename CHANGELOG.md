## 1.2.8

- Added an Entry Date & Time (IST) picker to Visitor Register data entry.
- Added an Entry Date & Time (IST) picker to Call Log data entry.
- The picker defaults to the current IST date/time and allows users to record the actual date/time when entering historical records later.
- Converts the selected IST date/time to the existing UTC-clock database storage convention, preserving existing reporting, sorting, filtering, search, and import behavior.
- No database migration required.

# Changelog

## 1.2.7 - 2026-09-07

### Branding sizing refinement
- Login page organization logo renders at up to **300px wide**, matching the approved design.
- Authenticated application header organization logo renders at **150px wide** with preserved aspect ratio.
- PDF printed reports render the organization logo at a matching **150px-equivalent visual width** (112.5 PDF points at 96 CSS px/in) with preserved aspect ratio.
- Login card width was increased to accommodate the larger logo while remaining responsive on mobile.
- No database migration is required.


## 1.2.6 - 2026-09-07
- Added public branding endpoint for the login page, exposing only organization name and logo.
- Added branded login page using the existing Branding settings.
- Added self-service Change Password page for logged-in users.
- Added current-password verification, minimum 8-character validation, confirmation matching, and forced re-login after a successful password change.
- Added an account menu in the top navigation with Change Password and Log out.

## v1.2.5

- Fixed historical Excel import failure caused by legacy phone values longer than 30 characters. Phone columns now support up to 100 characters.
- Import validation now checks database field length limits before commit, so oversized values are reported during preview instead of failing with a PostgreSQL error.
- Preserved global search on both Visitor Register and Call Log.

# Changelog

## 1.2.3
- Moved Visitor Register and Call Log module switching into the main header as distinct, color-coded buttons.
- Applied configured organization branding (logo and organization name) directly to the main navigation header.
- Removed duplicate module switch cards and standalone in-page branding from the Visitor Register page.
- Kept the same header/module navigation consistently visible when switching between Visitor Register and Call Log.
- Fixed the Super Administrator middleware export so the production server can start with the permanent-record deletion routes enabled.

## 1.2.4
- Added Global Search to the Call Log page; search remains global across both modules.
- Completed the Super Administrator historical Excel import workflow with first-sheet/header validation, full-row validation before commit, duplicate workbook protection, import history, and clearer preview/confirmation UI.
- Fixed the JSON upload limit to account for base64 overhead while retaining an 8 MB raw Excel-file limit.

## 1.2.2
- Rebuilt npm lockfiles from the known-good v1.0.5 dependency tree; no application dependency changes.

## 1.2.1
- Compact PDF branding header with inline logo.
- Super Administrator destructive record deletion with audit logging.
- Historical Excel import for VISITOR REGISTER and CALL LOG with preview/validation.
- Super Administrator role.
- Main-page VISITOR REGISTER / CALL LOG visual distinction.


## v1.1.1 — Report date/time fix

- Fixed report Visitor/Call Log Date and Time rendering that could produce `NaN-NaN-Na` / `NaN:NaN`.
- Hardened the common IST formatter to handle PostgreSQL date/time strings and JavaScript `Date` values safely.
- Added regression tests for PostgreSQL-like values, `Date` objects, and invalid inputs.
- Moved record filtering from Visitor Register and Call Log into the Reports page, with filtered-record preview and exports.
- Applied configured branding to the main Visitor Register page.
- Added PDF logo rendering for supported logo paths/URLs and included website in the PDF contact line.

## 1.1.0 - 2026-09-07

### Added
- Global Search on the Visitor Register main page across Visitor Register and Call Log history.
- Clickable search results that open the corresponding module and record.
- On-screen date filtering for Visitor Register and Call Log.
- IST (Asia/Kolkata) display for application record date/time values and generated report timestamps.
- Complete administrator user management: Edit, Enable/Disable, and Delete.
- Safe user deletion with historical record preservation.

### Changed
- Call Log Place is now required.
- Call Log Phone is now required and validated.
- Visitor Register S.No. now uses the stable record ID, matching the existing Call Log behavior.
- User creation/editing validates administrator/user roles strictly.

### Database
- Added migration `004_user_delete_and_search`.
- `created_by` foreign keys now use `ON DELETE SET NULL` for visitors, call logs, and audit records.

### Compatibility
- Production database date/time storage remains unchanged for backward compatibility. User-facing filtering and display convert stored UTC clock values to IST.

## 1.2.9 - Mobile UI Enhancement
- Added responsive mobile navigation with compact hamburger menu.
- Optimized Visitor Register and Call Log data-entry forms for phone/tablet screens.
- Added touch-friendly controls, spacing, and full-width mobile actions.
- Converted recent-entry tables to readable card-style layouts on small screens.
- Improved mobile Global Search and responsive table/report handling.
- Preserved the approved desktop v1.2.8 design and functionality.
- No database migration required.
