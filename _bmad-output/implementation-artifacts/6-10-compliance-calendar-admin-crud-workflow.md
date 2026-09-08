# Story 6.10: Compliance Calendar Admin CRUD Workflow

Status: backlog

## Story

As a board/admin user,
I want to create, edit, complete, and manage compliance events and tasks from the admin workspace,
so that the calendar is operational rather than read-only.

## Acceptance Criteria

1. Given an authorized board/admin user opens Compliance Calendar, when the workspace loads, then the navigation item is enabled and the page provides accessible create, edit, task, and completion actions.
2. Given an authorized user submits a valid event or task form, when the action succeeds, then the record is persisted and the page shows the updated record and a safe success state.
3. Given an authorized user completes an event or task, when completion succeeds, then the completion action is available from the relevant record and the updated status is rendered.
4. Given a user has only legal review permission, when they access the calendar, then they receive only the minimum records needed for review and not an unrestricted full-calendar data dump.
5. Given an unauthenticated, blocked, or unauthorized user opens the route, when the page renders, then no compliance deadline details or mutation controls are exposed.

## Tasks / Subtasks

- [ ] Enable the Compliance Calendar navigation item using the appropriate permission.
- [ ] Add server actions or equivalent route handlers for event and task create/update/complete operations.
- [ ] Add accessible forms, validation messages, pending states, and safe success/error states.
- [ ] Render stored event/task fields needed for operational management without exposing unauthorized sensitive data.
- [ ] Add focused page and action regression tests.

## Dev Notes

Build on the service and RPC layer from Story 6.1. Keep all mutations server-side and preserve the existing admin workspace patterns.

### Relevant Files

- `app/(admin)/admin/compliance/page.tsx`
- `server/services/admin/compliance-calendar.ts`
- `server/services/auth/admin-workspace.ts`
- `server/actions/`
- `tests/`
