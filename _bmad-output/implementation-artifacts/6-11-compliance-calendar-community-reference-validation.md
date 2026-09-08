# Story 6.11: Compliance Calendar Community Reference Validation

Status: backlog

## Story

As a community administrator,
I want compliance records and assignments constrained to my community,
so that calendar data cannot link across tenants.

## Acceptance Criteria

1. Given an event is created or updated, when related property, meeting, records request, assessment, lien, or fine references are supplied, then every reference belongs to the event's community or the request is rejected.
2. Given event profile assignments or a task assignee are supplied, when the mutation runs, then every profile is an active member of the event's community or the request is rejected.
3. Given a caller attempts to mutate a record from another community, when the request runs, then it is denied without revealing whether the target record exists.
4. Given a valid mutation succeeds, then all persisted foreign keys and assignments remain scoped to the same community as the event.

## Tasks / Subtasks

- [ ] Add ownership checks for every related event reference.
- [ ] Validate assigned profile and task assignee community membership and active status.
- [ ] Return privacy-safe invalid or permission-denied results for cross-community requests.
- [ ] Add database-backed tests for valid, invalid, and cross-community cases.

## Dev Notes

The checks must live in the security-definer RPC boundary, not only in TypeScript. Existing nullable relationship columns without foreign keys require explicit community validation.

### Relevant Files

- `supabase/migrations/202609070001_compliance_calendar_management.sql`
- `server/services/admin/compliance-calendar.ts`
- `tests/`
