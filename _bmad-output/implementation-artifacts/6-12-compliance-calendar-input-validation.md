# Story 6.12: Compliance Calendar Input Validation

Status: backlog

## Story

As a board/admin user,
I want invalid compliance record submissions to return clear validation results,
so that malformed requests cannot become database errors or partial writes.

## Acceptance Criteria

1. Given an event or task mutation contains a missing, null, or unsupported required enum/check value, when the RPC runs, then it returns a safe invalid-input result without an unhandled database exception.
2. Given text, date, UUID, assignment, or evidence input exceeds its supported shape, when the mutation runs, then the request is rejected before persistence.
3. Given a service caller supplies malformed runtime input, when the service method runs, then it returns `invalid-input` rather than throwing from local property access or parsing.
4. Given a valid submission, when validation completes, then the record is persisted exactly once with normalized values.

## Tasks / Subtasks

- [ ] Validate event and task required fields before inserts and updates.
- [ ] Handle null, enum, not-null, foreign-key, and check-constraint failures consistently.
- [ ] Add service-boundary guards for strings, IDs, dates, arrays, and evidence payloads.
- [ ] Add tests for malformed and boundary inputs.

## Dev Notes

Use the existing service validation conventions and keep error messages privacy-safe. Do not expose raw Postgres errors to admin users.

### Relevant Files

- `server/services/admin/compliance-calendar.ts`
- `supabase/migrations/202609070001_compliance_calendar_management.sql`
- `tests/`
