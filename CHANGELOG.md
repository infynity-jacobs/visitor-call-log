# Changelog

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
