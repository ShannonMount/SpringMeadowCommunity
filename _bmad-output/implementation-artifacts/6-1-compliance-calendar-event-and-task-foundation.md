# Story 6.1: Compliance Calendar Event and Task Foundation

Status: in-progress

## Story

As a board/admin user,
I want compliance events and tasks tracked in a calendar,
so that legally important HOA deadlines are visible and assignable.

## Acceptance Criteria

1. Given a board/admin user has compliance permission, when they create a compliance event, then the system stores type, title, description, due date, start date, related records, priority, legal-sensitive flag, assigned users, and status and the event is scoped to the community.
2. Given a compliance event has tasks, when tasks are created or updated, then each task stores title, description, type, status, due date, assignee, evidence, and completion metadata and tasks remain linked to their compliance event.
3. Given a user lacks compliance permission, when they attempt to list, create, update, or complete compliance events, then the request is denied and no compliance deadline details are returned.

## Tasks / Subtasks

- [x] Add the compliance foundation schema. (AC: 1, 2)
  - [x] Add `supabase/migrations/202605110024_compliance_calendar_foundation.sql`.
  - [x] Create `compliance_status` enum values for upcoming, in progress, ready for review, completed, blocked, deferred, overdue, and legal review required.
  - [x] Create `public.compliance_calendar_events` with due date, start date, priority, legal-sensitive flag, assignment arrays, and related record references.
  - [x] Create `public.compliance_tasks` with event linkage, task type, status, due date, assignee, evidence payload, and completion timestamps.
  - [x] Add indexes on due date, type, legal sensitivity, assignment arrays, and event/task status.

- [x] Wire compliance permissions into the role model. (AC: 3)
  - [x] Grant `admin.compliance.manage` to admin/board roles.
  - [x] Grant `legal.workflow.review` to legal/compliance reviewer roles.
  - [x] Keep the permission model aligned with the existing role assignment system.

- [ ] Add the actual compliance service and admin page behavior. (AC: 1, 2, 3)
  - [ ] Build permission-aware CRUD/list functions for compliance calendar events and tasks.
  - [ ] Add a real admin compliance page to render the event/task records and safe access states.
  - [ ] Enforce permission gating before listing, creating, updating, or completing compliance records.
  - [ ] Keep task completion metadata and evidence payloads safely scoped to authorized board/admin workflows.

- [x] Add focused regression coverage. (AC: 1, 2, 3)
  - [x] Add `tests/compliance-calendar-foundation.test.mjs`.
  - [x] Assert the compliance type/status schema, tables, indexes, and permission wiring are in place.

## Dev Notes

This is the foundational compliance calendar story. It establishes the schema and permission layer needed for later admin calendar views, reminders, meeting flows, and records request integrations. The current implementation is intentionally limited to the core event/task foundation; Story 6.2 will expand this into month/list status views and the reminder job stories will build the automation layer on top of it.

### Relevant Files

- `supabase/migrations/202605110024_compliance_calendar_foundation.sql`
- `tests/compliance-calendar-foundation.test.mjs`
- `app/(admin)/admin/compliance/page.tsx`
- `server/services/auth/admin-workspace.ts`
