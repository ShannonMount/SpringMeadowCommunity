# Story 6.14: Compliance Calendar Audit Logging

Status: backlog

## Story

As a board member,
I want sensitive compliance changes recorded in the audit log,
so that the association can explain who changed a deadline, task, or completion state.

## Acceptance Criteria

1. Given an authorized user creates an event or task, when the mutation succeeds, then an audit entry records the actor, community, target, action, and after state.
2. Given an authorized user updates an event or task, when the mutation succeeds, then an audit entry records before and after state.
3. Given an authorized user completes an event or task, when the mutation succeeds, then an audit entry records the completion action and metadata change.
4. Given a mutation fails authorization or validation, when the request returns, then no misleading success audit entry is written.
5. Given audit logging itself encounters a recoverable failure, then the mutation follows the established project policy and does not expose sensitive database details.

## Tasks / Subtasks

- [ ] Add audit entries to event/task create, update, and complete paths.
- [ ] Use the existing audit action and target conventions.
- [ ] Capture privacy-safe before/after snapshots and completion metadata.
- [ ] Add tests for successful and denied mutation audit behavior.

## Dev Notes

Follow existing admin mutation audit patterns and avoid placing evidence payloads or other sensitive content in logs unless explicitly required.

### Relevant Files

- `supabase/migrations/202609070001_compliance_calendar_management.sql`
- `server/services/audit/write-audit-log.ts`
- `tests/audit-log-viewer.test.mjs`
- `tests/`
