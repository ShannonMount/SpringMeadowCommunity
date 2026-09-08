# Story 6.13: Compliance Calendar Completion Lifecycle

Status: backlog

## Story

As a board/admin user,
I want completion metadata to accurately follow event and task status changes,
so that the calendar provides a trustworthy record of what was completed and when.

## Acceptance Criteria

1. Given an event or task is created with a completed status, when persistence succeeds, then completion timestamp and completing profile are stored.
2. Given an incomplete record is completed, when completion succeeds, then completion metadata is written once and the completed status is returned.
3. Given a completed record is reopened or deferred, when the status changes, then stale completion metadata is cleared or retained only as explicit historical metadata according to the domain contract.
4. Given a completion request is repeated, when it runs, then the original completion metadata is not silently overwritten.
5. Given an unauthorized user attempts completion, when the request runs, then no status or completion metadata changes.

## Tasks / Subtasks

- [ ] Normalize completion metadata on create, update, and complete RPCs.
- [ ] Define and implement reopen/defer behavior for completion fields.
- [ ] Prevent repeated completion from overwriting the original actor and timestamp.
- [ ] Add lifecycle tests for events and tasks, including denied completion.

## Dev Notes

Keep event and task behavior consistent. Completion metadata must remain community-scoped and must use the authenticated profile as the actor.

### Relevant Files

- `supabase/migrations/202609070001_compliance_calendar_management.sql`
- `server/services/admin/compliance-calendar.ts`
- `tests/`
