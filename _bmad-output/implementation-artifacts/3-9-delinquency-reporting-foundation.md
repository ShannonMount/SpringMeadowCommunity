# Story 3.9: Delinquency Reporting Foundation

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a board/admin user,
I want delinquency reporting for unpaid assessments,
so that the board can review overdue balances before compliance or legal-sensitive workflows begin.

## Acceptance Criteria

1. Given assessments have due dates, balances, and statuses, when the delinquency report runs, then it identifies properties with due soon, overdue, delinquent, disputed, or lien-review statuses according to configured rules, and the report is scoped to authorized board/admin users.
2. Given payment allocations change assessment balances, when the report is refreshed, then assessment and property delinquency summaries reflect the updated balances, and paid assessments no longer appear as unpaid delinquencies.
3. Given a delinquency may become legal-sensitive later, when the report displays the item, then it presents review-oriented status information, and it does not automatically file liens, send legal notices, create legal tasks, or mark legal review complete.

## Tasks / Subtasks

- [x] Add delinquency report schema/RPC support. (AC: 1, 2, 3)
  - [x] Add the next ordered migration after `supabase/migrations/202605110008_admin_payment_records_and_manual_payments.sql`, likely `supabase/migrations/202605110009_delinquency_reporting_foundation.sql`.
  - [x] Add a read-only permission such as `board.delinquency.view` to the seeded `board_member` and `admin` roles only. Do not grant it to residents, vendors, pool workers, anon/public roles, or legal reviewers unless a later story explicitly adds that access.
  - [x] Create a permission-checked `public.list_delinquency_report(...)` RPC or equivalent security-definer function. Revoke execute from `public`/`anon`, grant execute only to `authenticated`, set a safe `search_path`, and check `app.current_profile_id()` plus `app.has_permission(target_community_id, 'board.delinquency.view')` inside the function.
  - [x] Keep `assessments`, `payments`, `payment_allocations`, `properties`, `community_settings`, and `audit_logs` RLS/revokes intact. Do not add broad direct table grants to make the report easier.
  - [x] Return a narrow report contract: property ID, community ID, display-safe property label/address, current balance cents, oldest unpaid due date, days past due, next due date, delinquency stage, disputed flag, lien-review candidate flag, open assessment counts/totals, last payment timestamp, and configured threshold values used for the result.
  - [x] Keep owner display names, raw account numbers, public payment codes, mailing addresses, guest PII, raw payment processor data, audit internals, service-role details, secret names, and raw Supabase errors out of the RPC/UI contract.
- [x] Make property delinquency summaries reflect current assessment balances. (AC: 1, 2)
  - [x] Update `app.recalculate_property_assessment_summary(community_id, property_id)` in the new migration with `create or replace function`, not by editing historical migrations.
  - [x] Continue deriving `current_balance_cents` and `next_due_date` from open/partially paid/overdue/disputed assessments with positive balances.
  - [x] Use `community_settings.lien_readiness_days_past_due` with default 30 when classifying lien-review candidates; use the existing due-soon behavior from Story 3.1 unless a more explicit setting already exists.
  - [x] Define and test a deterministic status precedence, for example: `current` when no open balance, `disputed` when any unpaid disputed assessment exists, `lien_review` when the oldest unpaid due date meets the configured lien-readiness threshold, `overdue` when past due but below that threshold, `due_soon` when due soon but not overdue, otherwise `current`.
  - [x] Treat "lien review" as a board review candidate only. Do not create pre-lien notices, lien records, legal tasks, attorney-review completion, or any external filing state in this story.
  - [x] Ensure paid/waived/void/draft assessments are excluded from unpaid delinquency calculations.
- [x] Add a server-only delinquency reporting service. (AC: 1, 2, 3)
  - [x] Add `server/services/payments/delinquency-reporting.ts` with `import "server-only"`.
  - [x] Reuse `hasPermission`/`PERMISSION_DENIED_MESSAGE`, `PROFILE_UNAVAILABLE_MESSAGE`, UUID/date/integer validation style, result-union patterns, and `createClient()` user-scoped Supabase access from `assessment-management.ts` and `admin-payment-management.ts`.
  - [x] Expose a typed function such as `listDelinquencyReport(input)` returning safe union results: records, unauthenticated, profile unavailable, permission denied, invalid input, and unavailable.
  - [x] Validate filters server-side: community ID/slug, delinquency stage, property search text, due-date range, minimum balance, bounded page size, and bounded page offset. Escape SQL wildcard search terms in SQL if search is supported.
  - [x] Do not use service-role clients, Stripe, Resend, webhook processors, receipt services, public lookup services, or resident membership services for the board/admin report.
- [x] Build a focused board/admin delinquency report page. (AC: 1, 2, 3)
  - [x] Add a minimal route such as `app/(admin)/admin/delinquency/page.tsx`. Do not build the full board/admin workspace shell or navigation owned by Epic 5.
  - [x] Require data through the server-only delinquency service. Unauthorized/unauthenticated users must receive a safe unavailable/denied state without property financial details.
  - [x] Render a dense, operational, accessible table with columns for property, delinquency stage, current balance, oldest due date, days past due, disputed flag, lien-review candidate flag, open assessment count/total, last payment, and next due date.
  - [x] Provide GET/search-param filters for stage, property/search, due date range, minimum balance, and pagination. Do not client-filter over a broad unscoped dataset.
  - [x] Use visible labels, accessible empty/error states, and responsive horizontal overflow for wide tables. Keep the page quiet and work-focused: no marketing hero, no decorative cards, no nested cards, and no implementation notes in the UI.
  - [x] Label lien-review rows as review candidates, not as legal-ready or filed-lien states.
- [x] Preserve Epic 3 and legal-sensitive boundaries. (AC: 1, 2, 3)
  - [x] Do not change resident/guest payment session creation, Stripe webhook verification, payment receipt emails, manual payment recording, refund semantics, or resident payment history behavior.
  - [x] Do not send emails, notices, lien statements, attorney-review tasks, compliance-calendar tasks, or external filings from this story.
  - [x] Do not implement address verification, pre-lien statement mailing, 15-day wait tracking, lien filing, foreclosure tracking, fines, suspension, monthly reconciliation, or two-person approval. Later Epic 6 and Epic 7 stories own those workflows.
  - [x] Do not expose delinquency report data to public, guest, or resident-facing pages unless a future story explicitly adds resident-visible statements.
  - [x] Keep money math in integer cents and format USD only at UI boundaries.
- [x] Extend verification. (AC: 1, 2, 3)
  - [x] Add `tests/delinquency-reporting.test.mjs`.
  - [x] Test the migration adds the read-only permission to board/admin roles only, creates the scoped report RPC, uses safe function grants/search path, preserves RLS/revokes, and does not expose private columns.
  - [x] Test summary recalculation classifies current, due soon, overdue, disputed, and lien-review candidates from local assessment balances and `community_settings.lien_readiness_days_past_due`.
  - [x] Test paid, waived, void, draft, zero-balance, unrelated-community, and unrelated-property assessments are excluded from unpaid delinquency rows.
  - [x] Test payment allocation changes from Stories 3.6 and 3.8 continue to call the recalculation helper and cause paid assessments/properties to leave unpaid delinquency results.
  - [x] Test the service is server-only, uses the permission/RPC path, validates filters and pagination, escapes wildcard search, and avoids service-role, Stripe, Resend, raw errors, account numbers, public payment codes, owner names, guest PII, and secret names.
  - [x] Test the report page renders expected columns, filters, empty/denied states, pagination controls, and review-candidate wording without legal-action language.
  - [x] Test public, resident, guest, and client-facing files do not import delinquency report services, RPC names, board permissions, private financial details, or service-role clients.
  - [x] Run `npm test`, `npm run typecheck`, `npm run lint`, `npm run build`, and `git diff --check`.

### Review Findings

- [x] [Review][Patch] Delinquent stage has no configured classification path [supabase/migrations/202605110009_delinquency_reporting_foundation.sql:206]
- [x] [Review][Patch] Minimum-balance filter can exceed the RPC integer parameter [app/(admin)/admin/delinquency/page.tsx:10]

## Dev Notes

Story 3.9 is the read-only reporting bridge between Epic 3 payments/assessments and later compliance/legal workflows. The implementation should let authorized board/admin users see which properties need review, while preserving the line between "review candidate" and legal action.

The main implementation trap is turning a report into a collections workflow. This story should compute and display delinquency status from existing assessments and settings. It must not send statutory notices, create lien tasks, mark legal review complete, or imply a lien is filed.

### Current Files To Update

- `supabase/migrations/202605100001_create_properties_and_memberships.sql`
  - Current state: `properties` has `current_balance_cents`, `last_payment_at`, `next_due_date`, and `delinquency_status` constrained to `current`, `due_soon`, `overdue`, `delinquent`, `lien_review`, and `disputed`.
  - Change: do not edit this historical migration. Use a new migration to create or replace helper functions/reporting RPCs.
  - Preserve: property identity, account number, public payment code, owner display name, and mailing address stay out of the report contract unless explicitly approved later.
- `supabase/migrations/202605110001_create_assessment_cycles_and_assessments.sql`
  - Current state: creates `assessments`, `assessment_cycles`, manager read policies, `admin.assessments.manage`, and `app.recalculate_property_assessment_summary()`. The helper currently distinguishes current/due soon/overdue from open balances.
  - Change: replace the helper in the new migration so delinquency/lien-review/disputed summaries can be derived consistently.
  - Preserve: constraints `paid_cents <= amount_cents` and `balance_cents = amount_cents - paid_cents`; do not open direct assessment writes.
- `supabase/migrations/202605110002_create_payment_records_and_resident_financial_reads.sql`
  - Current state: creates `payments`, `payment_allocations`, `payment_events`, resident-safe payment history, and sensitive-column grants.
  - Change: no direct table broadening expected. The report may use allocation effects only through assessment balances and property summaries.
  - Preserve: residents still cannot select guest PII, Stripe references, processor fee internals, or payment events directly.
- `supabase/migrations/202605110003_create_community_payment_settings_for_sessions.sql`
  - Current state: creates `community_settings` with `lien_readiness_days_past_due` default 30, `pre_lien_notice_wait_days` default 15, and other compliance defaults.
  - Change: read these settings for report classification; avoid changing settings UI.
  - Preserve: settings table remains private with no broad direct grants.
- `supabase/migrations/202605110006_create_stripe_webhook_processing.sql`
  - Current state: confirmed online payments update allocations, assessment balances, audit logs, and call `app.recalculate_property_assessment_summary()`.
  - Change: no direct change expected, but the helper replacement must keep webhook allocation summaries correct.
  - Preserve: webhook signature verification, payment-level idempotency, and guest privacy.
- `supabase/migrations/202605110008_admin_payment_records_and_manual_payments.sql`
  - Current state: manual payments update allocations, assessment balances, audit logs, `properties.last_payment_at`, and call `app.recalculate_property_assessment_summary()`.
  - Change: no direct change expected, but helper replacement must keep manual payment summaries correct.
  - Preserve: manual payment idempotency, offline-method limits, sensitive reason filtering, and no receipt sending for `admin_recorded`.
- `server/services/payments/assessment-management.ts`
  - Current state: server-only admin assessment service using user-scoped Supabase RPCs, validation, permission checks, safe union results, and audit intent.
  - Change: use as a validation/result-union pattern only.
- `server/services/payments/admin-payment-management.ts`
  - Current state: server-only admin payment service with community resolution, permission checks, New York date normalization, escaped search, bounded pagination, and safe field contracts.
  - Change: use as the closest pattern for a report service with filters and pagination.
  - Preserve: do not import this service into public or resident surfaces.
- `server/services/payments/resident-dues.ts`
  - Current state: resident dues service reads only linked properties where `can_view_balance` is true and hides financial data otherwise.
  - Change: none expected.
  - Preserve: resident financial data remains membership-scoped; the board/admin report must not become a resident data path.

### New Files Likely Needed

- `supabase/migrations/202605110009_delinquency_reporting_foundation.sql`
- `server/services/payments/delinquency-reporting.ts`
- `app/(admin)/admin/delinquency/page.tsx`
- `tests/delinquency-reporting.test.mjs`

### Suggested Contracts

Use narrow typed contracts similar to:

```ts
type DelinquencyStage =
  | "current"
  | "due_soon"
  | "overdue"
  | "delinquent"
  | "lien_review"
  | "disputed";

type DelinquencyReportRecord = {
  propertyId: string;
  communityId: string;
  propertyLabel: string;
  stage: DelinquencyStage;
  currentBalanceCents: number;
  openAssessmentCount: number;
  openAssessmentBalanceCents: number;
  oldestUnpaidDueDate: string | null;
  daysPastDue: number;
  nextDueDate: string | null;
  lastPaymentAt: string | null;
  hasDisputedAssessment: boolean;
  lienReviewCandidate: boolean;
  lienReadinessDaysPastDue: number;
};

type DelinquencyReportResult =
  | { kind: "records"; communityId: string; communitySlug: string; records: DelinquencyReportRecord[] }
  | { kind: "unauthenticated" }
  | { kind: "profile-unavailable"; message: string }
  | { kind: "permission-denied"; message: string }
  | { kind: "invalid-input"; message: string; fieldErrors: Record<string, string[]> }
  | { kind: "report-unavailable"; message: string };
```

Rules:

- IDs are acceptable in typed data, React keys, hidden fields, and internal links, but avoid rendering raw IDs as ordinary table text unless needed for admin operations.
- Report rows should be derived from local assessments/properties, not client-submitted balances.
- Every query must be scoped by `community_id`.
- Use integer cents for all money math.
- Use date-only due dates for assessment aging. Avoid timezone-dependent day calculations by comparing SQL `date` values to `current_date`.
- If a report row has both disputed and overdue balances, make the disputed condition visible and tested; do not hide money that still has positive balance.
- If the implementation needs a view, create it with `security_invoker = true` on supported Postgres or keep it inaccessible and expose data only through a permission-checked function.

### Delinquency Classification Rules

- Eligible unpaid assessments: `status in ('open', 'partially_paid', 'overdue', 'disputed')` and `balance_cents > 0`.
- Excluded assessments: `draft`, `paid`, `waived`, `void`, zero-balance rows, unrelated properties, and unrelated communities.
- Suggested precedence for `properties.delinquency_status` and report `stage`:
  1. `current` when no eligible unpaid assessment balance remains.
  2. `disputed` when any eligible disputed assessment has positive balance.
  3. `lien_review` when the oldest eligible unpaid due date is at least `community_settings.lien_readiness_days_past_due` days past due.
  4. `overdue` when an eligible unpaid due date is before `current_date` but below the lien-readiness threshold.
  5. `due_soon` when an eligible unpaid due date is between `current_date` and `current_date + 30`.
  6. `current` otherwise.
- If the product chooses to surface a distinct `delinquent` stage, define the threshold explicitly in the migration/service and add tests. Do not use an arbitrary unstated threshold.
- `lien_review` means "board review candidate" only. It is not a filed lien, legal-ready status, attorney approval, or statutory notice.

### Authorization and Privacy Requirements

- Permission key: use a read-only permission such as `board.delinquency.view` for report reads. Keep `admin.assessments.manage` and `admin.payments.manage` reserved for mutation/payment operations.
- Check permission in both TypeScript service code and database RPCs. Server-rendered pages and direct RPC calls must both be safe.
- Use user-scoped Supabase clients for board/admin report reads. Do not use service-role clients for normal report access.
- Keep public, guest, resident, and board/admin surfaces separated. Do not import delinquency services into public/resident components or `lib/public`.
- Do not expose owner display names, account numbers, public payment codes, mailing addresses, guest payment contacts, Stripe identifiers, audit internals, or raw database errors.

### UX and Accessibility Requirements

- The delinquency report page should be dense, scannable, and operational: table-first layout, compact filters, clear empty/denied states, and predictable pagination.
- Use visible labels for every filter.
- Use non-alarmist labels such as "Review candidate" for lien-review rows. Avoid legal-action wording like "file lien", "foreclosure", "notice sent", or "legal approved".
- Keep table overflow responsive at 320px and wider with no overlapping text.
- Do not create a landing page, marketing hero, decorative imagery, nested cards, or explanatory implementation copy.

### Previous Story Intelligence

- Story 3.1 created assessment tables, manager read policies, admin assessment RPCs, and `app.recalculate_property_assessment_summary()`. Replace or extend that helper in a new migration rather than duplicating summary math in TypeScript.
- Story 3.2 created payment tables, allocation scope triggers, resident-safe payment history, and privacy-sensitive grants. Do not broaden resident/public direct payment access for reporting.
- Story 3.6 made webhook processing the source of truth for online payment allocation and calls the property summary helper after allocation.
- Story 3.7 added receipt emails and must remain independent from delinquency reporting. No emails should be sent here.
- Story 3.8 added admin payment records/manual payments and calls the property summary helper after manual allocations. The 3.8 review found and fixed several date, pagination, wildcard, idempotency, and sensitive-input issues; reuse those guardrails in this report.
- Active sprint tracking is `_bmad-output/implementation-artifacts/sprint-status.yaml`; `docs/bmad/phase-4-tasks/sprint-status.yaml` is a stale mirror.
- Git history only shows initial scaffold commits, so current story files, migrations, and local tests are more useful than commit history for implementation patterns.

### Current Local Technical Information

- Current local stack from `package.json`: Next.js `^16.0.0`, React `^19.0.0`, TypeScript `^5.0.0`, Tailwind CSS `^4.0.0`, `@supabase/ssr` `^0.10.3`, `@supabase/supabase-js` `^2.105.3`, `stripe` `^22.1.1`, and `resend` `^6.12.3`.
- Existing tests are fast Node `node:test` file-content guardrails. Keep new delinquency tests in the same style unless the project introduces live Supabase integration infrastructure.
- No `project-context.md` file was found.

### Latest Technical Information

- North Carolina G.S. 47F-3-116 currently says an assessment unpaid for 30 days or longer may constitute a lien when a claim of lien is filed, and a statement must be mailed no fewer than 15 days before filing. This story may use the 30-day setting for review-candidate reporting, but must not implement filing or notice workflows. Source: https://www.ncleg.gov/enactedlegislation/statutes/html/bysection/chapter_47f/gs_47f-3-116.html
- Next.js Server Functions/Actions can be invoked through direct POST requests, so official docs say to verify authentication and authorization inside every Server Function. Source: https://nextjs.org/docs/app/getting-started/mutating-data
- Supabase recommends enabling RLS on exposed-schema tables and granting only the permissions each Postgres role needs. Source: https://supabase.com/docs/guides/database/postgres/row-level-security
- Supabase notes Postgres views can bypass underlying table RLS unless created with `security_invoker = true` on supported Postgres versions or protected from exposed roles. Source: https://supabase.com/docs/guides/database/postgres/row-level-security
- Supabase database function guidance includes `security definer`, explicit `search_path`, and revoking function execution from public roles. Source: https://supabase.com/docs/guides/database/functions

### Project Structure Notes

- Delinquency report page belongs under `app/(admin)/admin/delinquency/page.tsx` unless the implementation discovers an existing admin route pattern before coding.
- Report business logic belongs under `server/services/payments/...` with `import "server-only"`.
- Database schema/RPC changes belong in a new ordered migration. Do not edit historical migrations.
- Do not add admin navigation to resident portal pages. Epic 5 owns the complete board/admin workspace shell and navigation.
- Do not place board/admin reporting code in `lib/public`, `components/public`, `components/resident`, or public route groups.

### References

- [Epics: Story 3.9](/home/smount/Websites/SpringMeadowCommunity/_bmad-output/planning-artifacts/epics.md)
- [Requirements: Assessments and Lien Preparation](/home/smount/Websites/SpringMeadowCommunity/docs/bmad/phase-1-requirements/requirements.md)
- [Architecture: Compliance Calendar and Legal-Sensitive Safety](/home/smount/Websites/SpringMeadowCommunity/docs/bmad/phase-2-architecture/architecture.md)
- [Data Model: Properties, Assessments, Payments](/home/smount/Websites/SpringMeadowCommunity/docs/bmad/phase-3-design/data-model.md)
- [Tasks: TASK-COMP-005 and TASK-QA-003](/home/smount/Websites/SpringMeadowCommunity/docs/bmad/phase-4-tasks/tasks-v1.md)
- [Previous Story 3.8](/home/smount/Websites/SpringMeadowCommunity/_bmad-output/implementation-artifacts/3-8-admin-payment-records-and-manual-payments.md)
- [Previous Story 3.6](/home/smount/Websites/SpringMeadowCommunity/_bmad-output/implementation-artifacts/3-6-stripe-webhook-processing-and-payment-allocation.md)
- [Previous Story 3.1](/home/smount/Websites/SpringMeadowCommunity/_bmad-output/implementation-artifacts/3-1-assessment-cycle-and-property-assessment-management.md)

## Dev Agent Record

### Agent Model Used

GPT-5 Codex

### Debug Log References

- `node --test tests/delinquency-reporting.test.mjs` - failed in red phase before 3.9 files existed, then passed after implementation
- `npm run typecheck` - passed
- `git diff --check` - passed
- `npm test` - passed
- `npm run lint` - passed
- `npm run build` - passed

### Implementation Plan

- Add a new ordered migration for the read-only delinquency report permission, property summary classification helper, and scoped report RPC.
- Keep report access behind `board.delinquency.view` in both TypeScript and SQL, using user-scoped Supabase RPC calls.
- Add a focused admin delinquency route with server-side filters, pagination, and review-candidate wording.
- Verify boundaries with fast Node guardrail tests plus full repository validation.

### Completion Notes List

- Ultimate context engine analysis completed - comprehensive developer guide created.
- Implemented `board.delinquency.view` report access for board/admin roles, a scoped `list_delinquency_report` RPC, and a refreshed property summary helper that classifies current/due-soon/overdue/disputed/lien-review states from eligible unpaid assessments.
- Added a server-only delinquency reporting service with validation, permission checks, bounded filters/pagination, safe result unions, and no service-role/Stripe/Resend/resident dependency path.
- Added a focused `/admin/delinquency` page with operational filters, accessible table output, pagination, safe denied/empty states, and review-candidate language instead of legal-action language.
- Added guardrail coverage for schema/RPC privacy, summary classification, service boundaries, UI rendering, public/resident isolation, and full repository validation.

### File List

- `_bmad-output/implementation-artifacts/3-9-delinquency-reporting-foundation.md`
- `_bmad-output/implementation-artifacts/sprint-status.yaml`
- `app/(admin)/admin/delinquency/page.tsx`
- `server/services/payments/delinquency-reporting.ts`
- `supabase/migrations/202605110009_delinquency_reporting_foundation.sql`
- `tests/delinquency-reporting.test.mjs`

### Change Log

- 2026-05-15: Created Story 3.9 context for delinquency reporting foundation.
- 2026-05-15: Implemented Story 3.9 delinquency reporting foundation; story moved to review.
- 2026-05-15: Completed code review fixes; story moved to done.
