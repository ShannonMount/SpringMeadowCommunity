# Story 6.2: Compliance Calendar Views and Status Tracking

Status: ready-for-dev

## Story

As a board/admin user,
I want month and list views of compliance events,
so that I can scan upcoming, overdue, blocked, completed, and legal-review items.

## Acceptance Criteria

1. Given compliance events exist, when a board/admin user opens the compliance calendar, then they can view events by month or list with status, due date, priority, type, assignees, and legal-sensitive indicators, and filters for date range, status, type, and assignment are available.
2. Given an event is upcoming, in progress, ready for review, completed, blocked, deferred, overdue, or legal review required, when the event is displayed, then the status is visually and textually distinguishable and the status label remains accessible to assistive technology.
3. Given a compliance task is completed, when the user provides evidence notes or linked documents, then completion metadata is saved and legal-sensitive completion requires the configured reviewer permission when applicable.

## Tasks / Subtasks

- [ ] Add permission-aware calendar query support for month/list views and filters. (AC: 1)
  - [ ] Keep all queries scoped to the resolved community.
  - [ ] Support date range, status, type, and assignment filters.
  - [ ] Return event and task data needed by both views.
- [ ] Build the admin month and list calendar views. (AC: 1, 2)
  - [ ] Add a view switcher with a usable default.
  - [ ] Render due dates, priorities, types, assignees, legal-sensitive indicators, and empty states.
  - [ ] Make every status distinguishable by text and accessible markup, not color alone.
- [ ] Add task completion evidence handling. (AC: 3)
  - [ ] Preserve evidence notes and linked document references.
  - [ ] Require the configured reviewer permission for legal-sensitive completion.
  - [ ] Preserve completion timestamps and completing profile metadata.
- [ ] Add focused regression coverage. (AC: 1, 2, 3)
  - [ ] Cover filtered month/list results and community scoping.
  - [ ] Cover all supported status labels and accessible rendering.
  - [ ] Cover evidence persistence and legal-sensitive reviewer gating.

## Dev Notes

Story 6.1 provides the compliance event/task schema, permission model, secure RPC foundation, service methods, and initial admin page. Extend those existing boundaries rather than introducing a second compliance data path. Story 6.3 will build reminder automation on top of the filtered calendar data.

## Relevant Files

- `supabase/migrations/202605110024_compliance_calendar_foundation.sql`
- `supabase/migrations/202609070001_compliance_calendar_management.sql`
- `server/services/admin/compliance-calendar.ts`
- `app/(admin)/admin/compliance/page.tsx`
- `server/services/auth/admin-workspace.ts`
- `tests/compliance-calendar-foundation.test.mjs`
- `tests/compliance-calendar-admin.test.mjs`
