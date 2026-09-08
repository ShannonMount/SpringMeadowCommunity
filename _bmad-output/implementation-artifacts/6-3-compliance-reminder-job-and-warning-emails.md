# Story 6.3: Compliance Reminder Job and Warning Emails

Status: review

## Story

As a board/admin user,
I want automated compliance warning emails,
so that deadlines are not missed because someone forgot to check the calendar.

## Acceptance Criteria

1. Given reminder rules and due compliance items exist, when the secured reminder job runs, then it identifies reminders due to send and queues or sends emails through the configured email service, and duplicate reminders are prevented.
2. Given an email reminder is sent or fails, when the send attempt completes, then the system records recipient, type, related record, provider status, sent timestamp, and error if applicable, and failures are available for admin monitoring.
3. Given an unauthorized request calls the reminder job endpoint, when cron secret or platform authentication fails, then the job does not run and no deadline or recipient details are exposed.

## Tasks / Subtasks

- [x] Define reminder rules and delivery records. (AC: 1, 2)
  - [x] Add a community-scoped reminder rule model for supported compliance event/task timing windows and recipient roles.
  - [x] Add an idempotent reminder delivery/attempt model with a unique key for the compliance record, reminder rule, and due occurrence.
  - [x] Store recipient, reminder type, related event/task, provider status, sent timestamp, and safe error details without raw secrets.
  - [x] Add indexes for due reminder selection, delivery status, and related compliance records.
- [x] Build the secured reminder job endpoint. (AC: 1, 3)
  - [x] Add a server-side job route or handler protected by the configured cron secret and platform authentication contract.
  - [x] Reject missing or invalid credentials before querying compliance records or recipients.
  - [x] Select only due, authorized, non-duplicated reminders within each community.
  - [x] Make retries safe and prevent duplicate sends under concurrent job execution.
- [x] Send warning emails through the configured email service. (AC: 1, 2)
  - [x] Use the existing email provider integration and shared email logging conventions.
  - [x] Render warning content with the minimum deadline and recipient details needed for the authorized workflow.
  - [x] Record queued, sent, delivered, bounced, failed, or suppressed provider outcomes where available.
  - [x] Record provider errors in sanitized form and avoid exposing credentials or raw provider payloads.
- [ ] Expose failures through admin monitoring. (AC: 2)
  - [x] Include reminder job failures and email failures in the existing monitoring summary where appropriate.
  - [x] Preserve community scoping and monitoring permission checks.
  - [x] Keep recipient and compliance details limited to authorized admin workflows.
- [x] Add focused regression and integration coverage. (AC: 1, 2, 3)
  - [x] Test cron/platform authentication rejection before data access.
  - [x] Test due reminder selection using deterministic UTC calendar-day windows, idempotency, retry behavior, and concurrent duplicate prevention.
  - [x] Test email attempt logging for success and failure outcomes.
  - [x] Test monitoring visibility and secret/private-data redaction.
  - [x] Add a database integration test for the unique delivery guard and job authorization boundary.

## Dev Notes

Story 6.1 provides the compliance event/task schema and permission foundation. Story 6.2 provides filtered calendar views and status semantics. Build reminder selection on those existing records, preserve community scoping, and reuse the email logging and admin monitoring contracts from the existing application. Do not expose reminder execution through a browser-accessible endpoint without authentication.

Reminder execution should be deterministic and idempotent: a retry may re-attempt a failed delivery according to the selected retry policy, but it must not create duplicate successful deliveries for the same reminder occurrence. Job authentication must fail closed before loading deadline or recipient data.

## Relevant Files

- `supabase/migrations/202605110024_compliance_calendar_foundation.sql`
- `supabase/migrations/202609070001_compliance_calendar_management.sql`
- `server/services/admin/compliance-calendar.ts`
- `server/services/admin/monitoring-summary.ts`
- `app/api/`
- `server/`
- `supabase/migrations/`
- `supabase/migrations/202609080002_compliance_reminder_rules_and_deliveries.sql`
- `server/services/compliance/compliance-reminder-job.ts`
- `app/api/jobs/compliance-reminders/route.ts`
- `tests/compliance-reminder-job.test.mjs`
- `tests/compliance-reminder-timing.test.ts`
- `tests/integration/compliance-reminder-idempotency.sql`
- `tests/integration/compliance-reminder-concurrency.sh`
- `tests/admin-monitoring.test.mjs`
- `tests/`

## Verification

- `npm run test:db` passed both rollback-based SQL integration tests.
- `node --test tests/compliance-reminder-job.test.mjs tests/compliance-calendar-views.test.mjs tests/compliance-calendar-foundation.test.mjs tests/compliance-calendar-admin.test.mjs` passed 9 tests.
- `npx tsx --test tests/compliance-calendar-filters.test.ts` passed 3 tests.
- `npx tsx --test tests/compliance-reminder-timing.test.ts` passed the UTC calendar-day boundary test.
- `npm run typecheck` and `git diff --check` passed.
- Reminder selection uses UTC calendar-day boundaries, role joins are community-scoped, email log keys are stable per delivery attempt, and the concurrency script verifies the unique claim under two simultaneous PostgreSQL sessions.

Review findings resolved:

- Replaced the moving 24-hour selection window with deterministic UTC calendar-day boundaries.
- Added an explicit `roles.community_id` filter to recipient resolution.
- Added a two-session PostgreSQL concurrency test proving exactly one delivery claim wins for the same idempotency key.
- Replaced timestamp-based failure log keys with stable delivery attempt keys based on the delivery idempotency key and attempt count.
