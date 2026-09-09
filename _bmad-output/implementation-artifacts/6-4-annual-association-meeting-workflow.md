# Story 6.4: Annual Association Meeting Workflow

Status: review

## Story

As a board/admin user,
I want to schedule annual association meetings and manage notice windows,
so that the HOA can track required yearly meeting obligations.

## Acceptance Criteria

1. Given an authorized admin or manager creates an annual association meeting, when they provide date/time, location, agenda, and notice requirement details, then the meeting is stored with status, agenda, notice metadata, and community scope, and a related compliance event can track the annual meeting obligation.
2. Given North Carolina default meeting notice settings are active, when the meeting date is set, then the system calculates the earliest notice date as meeting date minus 60 days and latest notice date as meeting date minus 10 days, and those dates are available in the meeting workflow.
3. Given notice is attempted outside the configured notice window, when the user marks notice sent, then the system warns or blocks according to configuration, and any override requires an explicit reason if allowed.

## Tasks / Subtasks

- [x] Add the community-scoped annual meeting model. (AC: 1)
  - [x] Store meeting date/time, location, agenda, status, notice settings, calculated notice window, and community reference.
  - [x] Support draft, scheduled, notice pending, notice sent, held, cancelled, and completed lifecycle states as appropriate.
  - [x] Preserve a relationship to the compliance calendar event for the annual meeting obligation.
  - [x] Protect meeting records with `admin.meetings.manage`; the seeded `admin` and `manager` roles receive this permission.
- [x] Implement North Carolina notice-window calculation. (AC: 2)
  - [x] Use configured community settings when present.
  - [x] Default to 60 days before the meeting for earliest notice and 10 days before the meeting for latest notice.
  - [x] Calculate persisted timezone-aware notice timestamps with the meeting timestamp.
- [x] Implement notice-window enforcement and overrides. (AC: 3)
  - [x] Validate the notice timestamp against the calculated window when notice is marked sent.
  - [x] Block out-of-window notices unless an explicit override reason is supplied.
  - [x] Require and persist an explicit override reason when an out-of-window notice is allowed.
  - [x] Preserve notice status, sender, timestamp, and override metadata for later meeting-record workflows.
- [x] Add the authorized admin workflow. (AC: 1, 3)
  - [x] Add permission-aware create, list, and notice actions using server-side mutations.
  - [x] Render the annual meeting form with date/time, location, agenda, status, and calculated notice dates.
  - [x] Link the meeting to its compliance event without exposing records across communities.
- [x] Add focused regression and database integration coverage. (AC: 1, 2, 3)
  - [x] Test permission contract, notice calculations, and compliance-event linkage.
  - [x] Add a rollback-based database integration test for meeting/event linkage and persisted 60/10-day windows.

## Dev Notes

Stories 6.1 and 6.2 provide the compliance event schema, permission checks, admin workspace patterns, and calendar presentation. Build the annual meeting workflow on those foundations rather than creating a separate deadline model. Story 6.5 will extend the meeting record with notice delivery details, minutes, agenda flags, and document visibility, so keep those future relationships explicit without implementing the later workflow here.

North Carolina defaults are 60 days before the meeting for the earliest notice date and 10 days before the meeting for the latest notice date. The implementation must keep these defaults configurable at the community level and must avoid silently accepting out-of-window notice attempts.

## Relevant Files

- `supabase/migrations/202605110024_compliance_calendar_foundation.sql`
- `supabase/migrations/202609070001_compliance_calendar_management.sql`
- `supabase/migrations/202609080003_manager_meeting_permissions.sql`
- `server/services/admin/compliance-calendar.ts`
- `server/services/admin/community-settings.ts`
- `server/services/auth/permissions.ts`
- `app/(admin)/admin/`
- `server/actions/`
- `supabase/migrations/`
- `tests/`
- `tests/annual-association-meeting.test.mjs`
- `tests/integration/annual-association-meeting.sql`

## Verification

- `node --test tests/annual-association-meeting.test.mjs` passed.
- `npm run typecheck` and `git diff --check` passed.
- `supabase db reset --local` applied the meeting migration successfully.
- `npm run test:db` includes the annual meeting integration test.
