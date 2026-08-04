# Changelog

All notable changes to this project are documented in this file.
Format loosely follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [Unreleased] - 2026-08-05

### Fixed

- **Transactional emails (password reset and invitations) were silently failing for
  everyone.** Both used Resend with a `from` address on `krewby.com`, a domain that
  was never verified in Resend — every send returned a 403 the code never checked
  for, so the app always reported success while no email ever left Resend's
  servers. Replaced with a Gmail SMTP-based mailer (`backend/src/utils/mailer.js`,
  via `nodemailer`) as a working interim solution until a real domain is verified;
  both `forgotPassword` and `sendInviteEmail` now go through it. Configured via
  `GMAIL_USER`/`GMAIL_APP_PASSWORD` in `backend/.env` (gitignored, not committed).
- Implemented the actual `forgot-password` backend endpoint — it previously
  returned only Supabase-generated links via a client-side call with no backend
  involvement; now the backend generates the recovery link via
  `supabaseAdmin.auth.admin.generateLink` and emails it, always returning a
  generic response regardless of whether the account exists (avoids leaking
  which emails are registered).
- Fixed `ResetPassword.jsx` only signing out of the Supabase session, not the
  app's own separate localStorage-based session — after a successful reset it
  would land on `/login`, which then silently redirected to whatever account was
  still cached in `localStorage`, rather than showing the login form. `clearUser()`
  now also clears the `token` key (it previously only cleared `user`, so the
  app's regular sign-out button had the same latent gap).

## [Unreleased] - 2026-08-04

### Security

- **Fixed a critical authentication bypass**: the login endpoint never verified the
  submitted password — any known account email could log in as that user with any
  password (or none). Login now verifies credentials against Supabase Auth before
  issuing the app's JWT, and the password field is required by validation.
- Scoped notifications to their recipient (`GET/PATCH/DELETE /api/notifications`
  previously exposed and allowed editing every user's notifications).
- Closed a privilege-escalation path in invitation acceptance: linking an invite to
  an existing account now requires the caller to be authenticated as that exact
  account, instead of trusting a client-supplied `existing_user_id`.
- Added branch-ownership checks to task endpoints (`createTask`, `updateTask`,
  `deleteTask`, `assignStaff`, `unassignStaff`, `getStaffRoster`) — a manager could
  previously act on another branch's shifts by guessing IDs.
- Added ownership checks to availability endpoints and blocked staff from
  self-approving their own leave requests.
- Added a branch check to timesheet evidence-file URLs so a manager can't pull
  another branch's uploaded evidence.
- Locked CORS down to an explicit origin allowlist (was previously open to any
  origin) and added rate limiting (blanket + a tighter limit on auth endpoints).
- Added `helmet` for baseline security headers.
- Added prompt-injection fencing to the AI assistant's system prompts — untrusted
  free-text fields (leave reasons, shift/task titles) are now explicitly marked as
  data, not instructions, for the tool-calling model.
- Moved the plan-upgrade action off an unauthenticated direct client→Supabase write
  onto an authenticated backend endpoint scoped to the caller's own business.

### Added

- **Real password reset flow.** The previous flow was entirely non-functional: the
  frontend called the wrong URL, the backend endpoints were no-op stubs, and there
  was no reset-password page at all. Replaced with Supabase's built-in reset-email
  flow plus a real `ResetPassword.jsx` page.
- **Audit log** (`audit_logs` table) — an append-only record of who did what, when,
  with before/after state. Wired into leave approve/reject/delete, shift
  update/delete, task assign/unassign, and the equivalent AI-assistant actions.
- **Soft-delete for branches** (`branches.deleted_at`) — deleting a branch no longer
  irreversibly cascades away every historical shift, timesheet, and swap record tied
  to it. Branch listings and plan-limit checks now exclude soft-deleted branches.
- **Leave entitlement tracking** (`staff.annual_leave_days_per_year`) — leave
  requests now surface each staff member's annual entitlement alongside how many
  days of approved annual leave they've already used this calendar year.
- **Labor-rule enforcement in manual assignment.** `branch_settings`
  (`max_work_hours_day`, `max_consecutive_days`, `allow_overtime`) were already
  respected by the AI weekly scheduler but silently ignored by manual staff
  assignment — a manager could schedule straight through either limit with no
  warning. Both paths now enforce the same rules.

### Removed

- The entire `krewby_casual_worker` / "krewby coordinator" concept — dead code
  referencing Prisma models and Supabase tables that no longer exist in the current
  schema (backend routes/controllers/validators, two frontend admin pages, three
  mobile screens).
- The standalone `attendance` REST module (routes/controller/validator) — it
  referenced an `attendance` Prisma model removed from the schema during an earlier
  migration; every call to it would have thrown. Attendance/timesheet tracking now
  lives entirely in the `timesheets` model, which was already the real path in use.

### Fixed

- **Mobile app was querying tables that no longer exist** (`shift_assignments`,
  `attendance`, `outlets`) — every shift/dashboard screen was silently showing empty
  data against the live schema. Updated to the current schema
  (`task_assignments`, `branches`, `casual_availability`) across regular-staff and
  casual-staff screens.
- Removed the mobile clock-in/out feature — it had no backing table anywhere in the
  system (its target table was the removed `attendance` model) and was purely
  decorative.
- Moved mobile auth token storage from plaintext `AsyncStorage` to
  `expo-secure-store`.
- Fixed a non-functional swap-request "reason" field in mobile (was a non-editable
  `<Text>` instead of a `TextInput`).
- Fixed a wrong sort column in mobile leave requests (`created_at`, which doesn't
  exist on `availability`).

### UI / readability

- Increased body/label text sizing across the web app (most text was sitting in an
  8–13px range against a 16px browser default).
- Fixed several small fixed-size circular badges (notification bell count, avatar
  initials, day-of-month calendar circles, stepper +/− buttons) whose text no
  longer fit after the font-size increase — resized rather than re-shrinking the
  font, except where a container is genuinely a compact indicator (badge counts),
  which kept a smaller, fitted font by design.
- Renamed the manager dashboard's "Create Task" quick-action to "Create Shift" —
  it navigates to shift creation, not task creation.
- Normalized shift/task title casing (`toTitleCase` in `frontend/src/utils/text.js`)
  so "afternoon shift" and "Morning Shift" display consistently, applied at
  creation/edit time and backfilled onto existing records. The normalizer
  preserves existing acronyms (e.g. "AML") rather than mangling them into "Aml".
