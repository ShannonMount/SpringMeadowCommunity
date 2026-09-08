# Story 6.2: Compliance Calendar Views and Status Tracking

Status: done

## Story

As a board/admin user,
I want month and list views of compliance events,
so that I can scan upcoming, overdue, blocked, completed, and legal-review items.

## Acceptance Criteria

1. Given compliance events exist, when a board/admin user opens the compliance calendar, then they can view events by month or list with status, due date, priority, type, assignees, and legal-sensitive indicators, and filters for date range, status, type, and assignment are available.
2. Given an event is upcoming, in progress, ready for review, completed, blocked, deferred, overdue, or legal review required, when the event is displayed, then the status is visually and textually distinguishable and the status label remains accessible to assistive technology.
3. Given a compliance task is completed, when the user provides evidence notes or linked documents, then completion metadata is saved and legal-sensitive completion requires the configured reviewer permission when applicable.

## Tasks / Subtasks

- [x] Add permission-aware calendar query support for month/list views and filters. (AC: 1)
  - [x] Keep all queries scoped to the resolved community.
  - [x] Support date range, status, type, and assignment filters.
  - [x] Return event and task data needed by both views.
- [x] Build the admin month and list calendar views. (AC: 1, 2)
  - [x] Add a view switcher with a usable default.
  - [x] Add previous/next month navigation while preserving active filters.
  - [x] Render due dates, priorities, types, assignees, legal-sensitive indicators, and empty states.
  - [x] Make every status distinguishable by text and accessible markup, not color alone.
- [x] Add task completion evidence handling. (AC: 3)
  - [x] Preserve evidence notes and linked document references.
  - [x] Require the configured reviewer permission for legal-sensitive completion.
  - [x] Preserve completion timestamps and completing profile metadata.
- [x] Add focused regression coverage. (AC: 1, 2, 3)
  - [x] Cover filtered month/list results and community scoping.
  - [x] Cover inclusive end-date filtering and overdue status derivation with runtime tests.
  - [x] Cover all supported status labels and accessible rendering.
  - [x] Cover evidence persistence and legal-sensitive reviewer gating.

## Dev Notes

Story 6.1 provides the compliance event/task schema, permission model, secure RPC foundation, service methods, and initial admin page. Extend those existing boundaries rather than introducing a second compliance data path. Story 6.3 will build reminder automation on top of the filtered calendar data.

Review follow-ups resolved:

- Date filters treat the selected `to` date as inclusive through `23:59:59.999Z`.
- Month view has previous/next navigation and preserves date, status, type, and assignment filters in its query links.
- Legal-sensitive task completion is enforced by the additive `202609080001_compliance_calendar_legal_completion_guard.sql` migration, so already-deployed environments receive the guard without modifying an applied migration.
- Runtime coverage in `tests/compliance-calendar-filters.test.ts` verifies date boundaries, overdue derivation, and combined filters with fixed timestamps.
- Database integration coverage in `tests/integration/compliance-calendar-legal-completion.sql` exercises the trigger against real event/task rows inside a rollback transaction; run it with `npm run test:db` after the local Supabase database is running.

## Relevant Files

- `supabase/migrations/202605110024_compliance_calendar_foundation.sql`
- `supabase/migrations/202609070001_compliance_calendar_management.sql`
- `supabase/migrations/202609080001_compliance_calendar_legal_completion_guard.sql`
- `lib/compliance-calendar-filters.ts`
- `server/services/admin/compliance-calendar.ts`
- `app/(admin)/admin/compliance/page.tsx`
- `server/services/auth/admin-workspace.ts`
- `tests/compliance-calendar-foundation.test.mjs`
- `tests/compliance-calendar-admin.test.mjs`
- `tests/compliance-calendar-views.test.mjs`
- `tests/compliance-calendar-filters.test.ts`
- `tests/integration/compliance-calendar-legal-completion.sql`
