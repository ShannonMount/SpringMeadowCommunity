# Story 6.15: Compliance Calendar Behavioral Regression Coverage

Status: backlog

## Story

As a maintainer,
I want executable coverage for compliance calendar authorization and persistence,
so that future changes cannot silently break legal-sensitive workflows.

## Acceptance Criteria

1. Given an authorized board/admin user, when event and task CRUD operations run against a test database, then persistence, community scoping, linkage, and returned records are verified.
2. Given a user without compliance permission, when they list, create, update, or complete compliance records, then each operation is denied and no deadline details are returned.
3. Given legal-review-only access, when the calendar is requested, then the test verifies the intentionally limited visibility contract.
4. Given invalid, null, cross-community, and repeated-completion inputs, when the operations run, then the expected safe result and unchanged database state are verified.
5. Given the admin page and actions are exercised, when authorized and denied states render, then the tests verify controls, messages, and absence of sensitive details.

## Tasks / Subtasks

- [ ] Replace source-only assertions with database-backed RPC/service tests where the test harness supports them.
- [ ] Add unauthorized and legal-review authorization cases.
- [ ] Add persistence, scoping, validation, lifecycle, and audit assertions.
- [ ] Add admin page/action behavior coverage for success and safe denial states.
- [ ] Document required local test setup and migration prerequisites.

## Dev Notes

Tests must execute the relevant paths; static regex checks may remain as supplemental migration-shape checks but cannot be the only evidence for acceptance criteria.

### Relevant Files

- `tests/compliance-calendar-admin.test.mjs`
- `tests/compliance-calendar-foundation.test.mjs`
- `server/services/admin/compliance-calendar.ts`
- `supabase/migrations/202609070001_compliance_calendar_management.sql`
