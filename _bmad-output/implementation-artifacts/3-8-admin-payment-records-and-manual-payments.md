# Story 3.8: Admin Payment Records and Manual Payments

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As an authorized admin,
I want to view payment records and record offline payments,
so that the HOA can reconcile online and manual dues activity.

## Acceptance Criteria

1. Given an admin has payment management permission, when they open payment records, then they can view payment status, payer type, property, amount, fee policy, payment method, receipt number, Stripe references when applicable, and timestamps, and access is scoped by community permissions.
2. Given manual payments are enabled by configuration, when an authorized admin records check, cash, or other offline payment, then the system creates an `admin_recorded` payment, applies allocations if provided, updates balances, and prepares audit information, and no raw card or bank data is stored.
3. Given an unauthorized user attempts to view or record payments, when the action is requested, then it is denied, and no payment or property financial data is returned.

## Tasks / Subtasks

- [x] Add admin payment-management schema support. (AC: 1, 2, 3)
  - [x] Add the next ordered migration after `supabase/migrations/202605110007_create_email_logs.sql`, likely `supabase/migrations/202605110008_admin_payment_records_and_manual_payments.sql`.
  - [x] Add a payment-management permission such as `admin.payments.manage` to the seeded `admin` role only. Do not grant it to `resident`, `vendor_applicant`, `approved_vendor`, `pool_worker`, or public/anon roles. If board payment access is needed later, make it assignable through existing role management rather than broad seeded access.
  - [x] Add `manual_payments_enabled boolean not null default false` or an equivalent explicit setting to `public.community_settings`. Manual recording must be denied when disabled, even for authorized admins.
  - [x] Add a manual-payment idempotency mechanism, such as a request UUID column/table keyed by community and form submission, so browser retries or double submits cannot create duplicate offline payments or double-apply allocations.
  - [x] Create permission-checked RPCs or security-definer functions for admin payment reads and manual payment creation. Revoke execute from `public`/`anon` where appropriate, grant only to authenticated callers, set a safe `search_path`, and check `app.current_profile_id()` plus `app.has_permission(target_community_id, 'admin.payments.manage')` inside each function. Keep non-RPC helper functions in the `app` schema where possible.
  - [x] Preserve existing `payments`, `payment_allocations`, `payment_events`, `email_logs`, and `audit_logs` RLS/revokes. Do not add broad direct table grants that expose guest contact fields, Stripe IDs, processor fees, audit data, or payment events to residents or public users.
  - [x] Expose admin payment record fields through a narrow read contract: payment ID for internal links/keys, community/property IDs, display-safe property label/address, status, payer type, amount, currency, fee policy, method, receipt number, Stripe references when present, processor fee/net amount if shown for reconciliation, paid/created/updated timestamps, and allocation totals.
  - [x] Keep raw property account numbers, public payment codes, guest phone, raw lookup inputs, raw webhook payloads, raw provider errors, service-role details, and secret names out of the admin UI contract unless a later story explicitly approves them.
- [x] Add atomic manual payment recording. (AC: 2, 3)
  - [x] Implement `record_manual_payment` or equivalent in the new migration as one transactional database operation. It must insert the payment, insert any allocations, update assessments, recalculate property summary, and write audit data together.
  - [x] Validate `communityId`, `propertyId`, idempotency/request ID, optional `paidAt`, amount in integer cents, method, allocation IDs/amounts, and optional reason/note before any mutation.
  - [x] Lock the matched property, payment idempotency row, and allocated assessments as needed so concurrent admin submissions cannot over-allocate the same assessment balances.
  - [x] Allow only offline methods: `check`, `cash`, `manual`, or `other`. Reject `card` and `ach` here because online card/ACH are owned by Stripe flows.
  - [x] Create `payments.payer_type = 'admin_recorded'`, `status = 'succeeded'`, `profile_id = null`, `created_by = actor_profile_id`, `currency = 'USD'`, concrete `fee_policy` from community settings, no Stripe IDs, no processor fee/net values unless explicitly justified, and a stable receipt number if absent. Prefer the existing online receipt pattern `SMC-` plus the first 12 uppercase payment UUID characters unless a better local convention already exists.
  - [x] Use active, non-deleted properties scoped to the same `community_id`; store the same property snapshots pattern used by resident/guest payment session services.
  - [x] If explicit allocations are provided, require every assessment to belong to the same community/property, be open/partially paid/overdue/disputed, have positive remaining balance, and receive no more than its balance. Allocation sum must be positive and less than or equal to payment amount.
  - [x] If no explicit allocations are provided and the product chooses auto-allocation, use the Story 3.6 deterministic order: oldest due date, then created time/ID, only open/partially paid/overdue/disputed assessments with `balance_cents > 0`. If the implementation chooses unapplied manual payments instead, the admin UI must make the unapplied amount explicit.
  - [x] Update `assessments.paid_cents`, `balance_cents`, and status while preserving `assessments_paid_not_above_amount` and `assessments_balance_math`. Paid assessments become `paid`; disputed and overdue assessments should keep their context while still unpaid.
  - [x] Call `app.recalculate_property_assessment_summary(community_id, property_id)` after allocations or any manual payment that affects assessment balances.
  - [x] Update `properties.last_payment_at` for the property to the latest succeeded payment timestamp after a successful manual payment. The existing summary helper updates balance/due/delinquency fields but does not currently maintain `last_payment_at`.
  - [x] Write an append-only audit record such as `payment.manual.create` with `actor_type = 'user'`, actor profile, community, target payment, before `null`, after safe payment/allocation summary, request/idempotency ID, reason if provided, and no raw card/bank/check-routing data.
- [x] Add server-only admin payment service and action. (AC: 1, 2, 3)
  - [x] Add `server/services/payments/admin-payment-management.ts` with `import "server-only"`.
  - [x] Reuse `hasPermission`/`PERMISSION_DENIED_MESSAGE`, current-profile states, existing UUID/date/integer-cent validation style, and `createClient()` user-scoped Supabase access. Do not use service role for normal admin reads or manual payment server actions.
  - [x] Expose typed functions such as `listAdminPaymentRecords(input)` and `recordManualPayment(input)` returning safe union results: success, unauthenticated, profile unavailable, permission denied, configuration disabled, invalid input, and unavailable.
  - [x] Parse and validate filters for status, payer type, method, property, date range, and bounded page size. Default list ordering should be newest paid/created records first.
  - [x] Add `server/actions/admin-payments.ts` with `"use server"` for the manual payment form. Treat it like a public-facing POST endpoint: parse `FormData`, validate again server-side, check authorization through the service/RPC path, and redirect or return a serializable safe state.
  - [x] Generate or pass a single-use idempotency/request ID from the manual payment form to the server action/RPC. Replaying the same submitted ID should return the existing recorded payment outcome and must not mutate balances a second time.
  - [x] Never return raw Supabase errors, raw provider errors, raw account numbers, public payment codes, guest phone, raw Stripe payloads, secret names, service-role keys, or stack traces from the service or action.
- [x] Build the scoped admin payment records page. (AC: 1, 2, 3)
  - [x] Add a minimal route such as `app/(admin)/admin/payments/page.tsx`. This story may create a focused admin payments page, but do not build the full board/admin workspace shell or navigation owned by Epic 5.
  - [x] The page must require `admin.payments.manage` data through the server service. Unauthorized/unauthenticated users get a safe unavailable/denied state without payment details.
  - [x] Render payment records in an accessible data table with columns for paid/created date, property, status, payer type, amount, method, fee policy, receipt number, and Stripe reference summary. Keep long IDs truncated visually but available in accessible text only if genuinely needed.
  - [x] Provide operational filters for status, payer type, method, property/search, and date range using GET search params or a server-safe form. Do not add client-only filtering over a broad unscoped dataset.
  - [x] Render allocation/unapplied totals clearly enough for reconciliation. If manual payments can be unapplied, show that state to admins and do not silently make balances look current.
  - [x] Render a manual payment form only when `manual_payments_enabled` is true. When disabled, show a clear admin-facing disabled state and no active submit path.
  - [x] Manual payment form fields must have visible labels, accessible errors, integer-cent/decimal-dollar parsing safety, method selection constrained to offline methods, optional allocation inputs, optional reason/note, and a submit button that cannot imply raw card/bank collection.
  - [x] Keep the UI quiet and operational: no marketing hero, no decorative cards, no nested cards, no public/resident navigation changes, no in-app implementation notes.
- [x] Preserve Epic 3 and future-admin boundaries. (AC: 1, 2, 3)
  - [x] Do not change resident/guest payment session creation, browser return pages, Stripe webhook signature verification, or payment receipt email behavior except for tests proving admin-recorded payments stay excluded.
  - [x] Do not send Resend receipts for `admin_recorded` payments in this story. Story 3.7 currently treats them as not eligible; a future admin receipt/statement story can decide whether offline receipts are emailed.
  - [x] Do not implement refunds, void/reversal UI, monthly reconciliation exports, two-person approval, settings management UI, delinquency reports, legal/lien workflows, or full audit-log viewer here.
  - [x] Do not allow manual payment recording to overwrite or delete existing online payment, webhook, allocation, email log, or audit history.
  - [x] Keep financial math in integer cents only. Format USD at the UI boundary.
- [x] Extend verification. (AC: 1, 2, 3)
  - [x] Add `tests/admin-payment-management.test.mjs`.
  - [x] Test the new migration adds `admin.payments.manage`, manual-payment configuration, permission-checked read/manual-payment RPCs, safe function privileges/search path, RLS/revokes, and no broad resident/public exposure of sensitive columns.
  - [x] Test manual payment RPC logic records `admin_recorded` succeeded payments, rejects disabled configuration, rejects unauthorized callers, rejects online methods, validates allocation scope/sums, updates assessment balances, calls property summary recalculation, updates `properties.last_payment_at`, and writes audit data without raw card/bank details.
  - [x] Test manual payment idempotency: duplicate form submissions or retried RPC calls with the same request ID return the existing payment and do not insert a second payment, add duplicate allocations, increment assessment paid amounts twice, or write misleading audit entries.
  - [x] Test the server service/action are server-only, validate UUIDs/dates/cents/enums, use the permission/RPC path, and avoid service-role, Stripe, Resend, raw errors, raw account numbers, guest phone, public payment code, and secret names.
  - [x] Test the admin page renders the expected payment table columns, filters, manual-payment disabled/enabled states, accessible labels/errors, and denied state without leaking financial data.
  - [x] Test Story 3.7 receipt service remains not eligible for `payer_type = 'admin_recorded'` unless this story explicitly changes that behavior with new ACs.
  - [x] Run `npm test`, `npm run typecheck`, `npm run lint`, `npm run build`, and `git diff --check`.

### Review Findings

- [x] [Review][Patch] Whole-dollar manual amounts are recorded as cents [server/actions/admin-payments.ts:20]
- [x] [Review][Patch] Manual payment reason can store sensitive payment instrument details [supabase/migrations/202605110008_admin_payment_records_and_manual_payments.sql:603]
- [x] [Review][Patch] Concurrent same-request submissions can fail instead of returning the existing payment [supabase/migrations/202605110008_admin_payment_records_and_manual_payments.sql:290]
- [x] [Review][Patch] Idempotency lookup uses an ambiguous unqualified `request_id` reference [supabase/migrations/202605110008_admin_payment_records_and_manual_payments.sql:294]
- [x] [Review][Patch] Invalid allocation data mutates `manual_payment_requests` before validation completes [supabase/migrations/202605110008_admin_payment_records_and_manual_payments.sql:329]
- [x] [Review][Patch] Duplicate explicit allocations are silently dropped or left unapplied [supabase/migrations/202605110008_admin_payment_records_and_manual_payments.sql:344]
- [x] [Review][Patch] Direct RPC callers can bypass the service maximum payment amount [supabase/migrations/202605110008_admin_payment_records_and_manual_payments.sql:249]
- [x] [Review][Patch] Date-range `to` filter excludes payments later on the selected day [server/services/payments/admin-payment-management.ts:211]
- [x] [Review][Patch] Manual `paidAt` timestamps depend on server timezone [app/(admin)/admin/payments/page.tsx:389]
- [x] [Review][Patch] Payment table does not render all required paid, created, and updated timestamps [app/(admin)/admin/payments/page.tsx:291]
- [x] [Review][Patch] Manual-payment errors are not field-accessible [server/actions/admin-payments.ts:150]
- [x] [Review][Patch] Manual payment reason can still store bare payment instrument numbers [supabase/migrations/202605110008_admin_payment_records_and_manual_payments.sql:260]
- [x] [Review][Patch] Recorded manual-payment retries can return invalid or disabled after state changes [supabase/migrations/202605110008_admin_payment_records_and_manual_payments.sql:267]
- [x] [Review][Patch] Manual-payment `paidAt` accepts future or otherwise unintended timestamps before mutation [supabase/migrations/202605110008_admin_payment_records_and_manual_payments.sql:249]
- [x] [Review][Patch] `last_payment_at` is not recalculated from the latest succeeded payment [supabase/migrations/202605110008_admin_payment_records_and_manual_payments.sql:577]
- [x] [Review][Patch] Oversized allocation amounts can abort the RPC instead of returning invalid input [supabase/migrations/202605110008_admin_payment_records_and_manual_payments.sql:342]
- [x] [Review][Patch] Admin payment records JSON aggregation does not guarantee newest-first ordering [supabase/migrations/202605110008_admin_payment_records_and_manual_payments.sql:163]
- [x] [Review][Patch] Admin date filters use UTC day boundaries despite the New York admin UI timezone [server/services/payments/admin-payment-management.ts:221]
- [x] [Review][Patch] Payment records beyond the first page are unreachable in the admin UI [app/(admin)/admin/payments/page.tsx:578]
- [x] [Review][Patch] Admin payment search text is unbounded before expensive wildcard filtering [server/services/payments/admin-payment-management.ts:488]
- [x] [Review][Patch] Manual payments can complete across a concurrent settings disable without locking the settings row [supabase/migrations/202605110008_admin_payment_records_and_manual_payments.sql:267]
- [x] [Review][Patch] Admin payment search treats `%` and `_` as SQL wildcards instead of literal text [supabase/migrations/202605110008_admin_payment_records_and_manual_payments.sql:159]
- [x] [Review][Patch] Manual `paidAt` parsing accepts impossible datetime-local values before service validation [server/actions/admin-payments.ts:69]
- [x] [Review][Patch] Admin date filters accept impossible local datetime values that can shift ranges [server/services/payments/admin-payment-management.ts:431]
- [x] [Review][Patch] Manual amount parsing accepts malformed comma grouping as a different amount [server/actions/admin-payments.ts:21]
- [x] [Review][Patch] Admin payment page offsets are unbounded before RPC pagination [server/services/payments/admin-payment-management.ts:231]
- [x] [Review][Patch] Manual payment reason length is unbounded before audit storage [server/services/payments/admin-payment-management.ts:475]
- [x] [Review][Patch] Manual payment allocation row count is unbounded before validation and database locks [server/services/payments/admin-payment-management.ts:481]
- [x] [Review][Patch] Story 3.7 receipt exclusion for `admin_recorded` payments is not asserted in Story 3.8 tests [tests/admin-payment-management.test.mjs:43]
- [x] [Review][Patch] Manual-payment trigger helper lacks explicit function guardrails [supabase/migrations/202605110008_admin_payment_records_and_manual_payments.sql:34]

## Dev Notes

Story 3.8 is the admin read/write side of Epic 3 payments. Stories 3.1 through 3.7 already created assessment records, resident and guest payment rows, Stripe Checkout sessions, verified webhook allocation, and receipt emails. This story should let authorized admins inspect those records and record offline payments without weakening the privacy and idempotency boundaries that make the online payment flow safe.

The main implementation trap is treating an offline payment as a simple insert. A manual payment that is marked paid but does not update allocations, assessment balances, property summaries, and audit logs atomically will create reconciliation drift. Keep the manual payment mutation inside a database transaction/RPC and make every query community-scoped.

### Current Files To Update

- `supabase/migrations/202605110003_create_community_payment_settings_for_sessions.sql`
  - Current state: creates `community_settings` with Stripe account mode, connected account, fee policy, card/ACH flags, guest payment flag, compliance defaults, and `feature_flags`.
  - Change: do not edit this historical migration. Add a new migration that introduces explicit manual-payment enablement.
  - Preserve: existing Stripe and guest settings used by Stories 3.3 and 3.5.
- `supabase/migrations/202605100003_create_roles_and_profile_roles.sql`
  - Current state: seeds `admin` with role/user/audit permissions and exposes `app.has_permission`.
  - Change: add `admin.payments.manage` through a new migration.
  - Preserve: no broad seeded access for non-admin roles.
- `supabase/migrations/202605110002_create_payment_records_and_resident_financial_reads.sql`
  - Current state: creates `payments`, `payment_allocations`, `payment_events`, resident-safe `resident_payment_history`, RLS, revokes, limited resident grants, and payment/allocation scope triggers.
  - Change: do not edit this historical migration. Add admin read/manual-payment functions in the new migration.
  - Preserve: residents still cannot select guest PII, Stripe references, processor fee internals, or payment events directly.
- `supabase/migrations/202605110006_create_stripe_webhook_processing.sql`
  - Current state: creates persistent `audit_logs` and `process_stripe_payment_event`, including idempotent success handling, allocation updates, property summary recalculation, and webhook audit entries.
  - Change: use its allocation rules as the source of truth for manual payment balancing. Refactor into a shared `app.apply_payment_allocations` helper only if webhook regression tests cover the replaced path.
  - Preserve: raw-body webhook verification and online payment idempotency semantics.
- `supabase/migrations/202605110007_create_email_logs.sql`
  - Current state: creates private email log storage for payment receipt attempts.
  - Change: none expected.
  - Preserve: no broad admin page read of email internals unless future monitoring stories add it.
- `server/services/payments/assessment-management.ts`
  - Current state: server-only admin assessment service using user-scoped Supabase RPCs, validation, permission checks, and audit intent.
  - Change: use as the local pattern for validation/result unions, not as the payment implementation.
- `server/services/payments/resident-dues.ts`
  - Current state: server-only resident financial read service that scopes by active memberships and hides data when `canViewBalance` is false.
  - Change: none expected.
  - Preserve: resident payment history remains property-membership scoped and cannot become an admin data source.
- `server/services/payments/payment-receipt-email.ts`
  - Current state: sends receipts only for `payer_type = 'resident'` and `payer_type = 'guest'`; `admin_recorded` returns not eligible.
  - Change: no receipt sending for offline payments in this story.
- `app/(resident)/portal/(member)/payments/page.tsx`
  - Current state: resident dues/payment history UI and resident online payment form.
  - Change: none expected.
  - Preserve: no admin payment management controls in resident pages.

### New Files Likely Needed

- `supabase/migrations/202605110008_admin_payment_records_and_manual_payments.sql`
- `server/services/payments/admin-payment-management.ts`
- `server/actions/admin-payments.ts`
- `app/(admin)/admin/payments/page.tsx`
- `tests/admin-payment-management.test.mjs`

### Suggested Contracts

Use narrow typed contracts similar to:

```ts
type AdminPaymentRecord = {
  id: string;
  communityId: string;
  propertyId: string;
  propertyLabel: string;
  status: "created" | "pending" | "succeeded" | "failed" | "refunded" | "partially_refunded" | "void";
  payerType: "resident" | "guest" | "admin_recorded";
  amountCents: number;
  currency: "USD";
  feePolicy: "payer_pays" | "hoa_pays";
  method: "card" | "ach" | "check" | "cash" | "manual" | "other";
  receiptNumber: string | null;
  stripeCheckoutSessionId: string | null;
  stripePaymentIntentId: string | null;
  stripeChargeId: string | null;
  paidAt: string | null;
  createdAt: string;
  updatedAt: string;
  allocatedCents: number;
  unappliedCents: number;
};

type RecordManualPaymentResult =
  | { kind: "recorded"; paymentId: string; allocatedCents: number; unappliedCents: number }
  | { kind: "configuration-disabled"; message: string }
  | { kind: "invalid-input"; message: string; fieldErrors: Record<string, string[]> }
  | { kind: "permission-denied"; message: string }
  | { kind: "unauthenticated" }
  | { kind: "profile-unavailable"; message: string }
  | { kind: "payment-unavailable"; message: string };
```

Rules:

- IDs are acceptable in typed data, React keys, hidden form fields, and server actions, but do not render raw internal IDs as ordinary UI text unless needed for admin reconciliation.
- Admin payment reads can include Stripe references because AC 1 requires them, but they must remain behind `admin.payments.manage` and must not leak into public or resident surfaces.
- Manual payment recording must not accept or store full card numbers, CVV, bank account/routing numbers, raw check images, or raw payment instrument details. A non-sensitive reason/note is acceptable only if sanitized and audit-safe.
- Manual payment rows should not create `payment_events`; that table is for provider events. Use `audit_logs` for admin-recorded financial actions.
- Manual payment form submissions need their own idempotency guard because they have no Stripe event ID. Treat retry/double-submit prevention as a financial safety requirement, not a UI nicety.

### Allocation and Balance Rules

- Use local database state, not client-submitted balances, for all assessment and property-balance mutation.
- Use integer cents for all money math.
- Every allocation must be scoped by `community_id`, `property_id`, `payment_id`, and `assessment_id`.
- Eligible assessment statuses for payment allocation remain `open`, `partially_paid`, `overdue`, and `disputed` with `balance_cents > 0`.
- Never allocate more than the payment amount, more than an assessment balance, or across properties/communities.
- Insert `payment_allocations` once per payment/assessment; keep the existing unique `(payment_id, assessment_id)` invariant.
- If an admin records a payment greater than allocations/open balances, leave the remainder as unapplied and visible only in admin/reconciliation surfaces. Do not invent resident-visible credit balances in this story.
- Property balance summaries are derived by `app.recalculate_property_assessment_summary()`, not manually adjusted in TypeScript.
- `properties.last_payment_at` is not maintained by `app.recalculate_property_assessment_summary()` today. Manual payment recording must update it explicitly or update the helper with regression coverage for online payments.

### Authorization and Privacy Requirements

- Permission key: prefer `admin.payments.manage` for both reading admin payment records and recording offline payments unless the implementation intentionally adds a separate read-only permission with tests.
- Check permission in both TypeScript service/action code and database RPCs. Server Actions can be invoked directly, so do not rely on the page render as the only guard.
- Use user-scoped Supabase clients for authenticated admin actions and RPC calls. Reserve service-role clients for trusted system integrations such as Stripe webhooks and email service internals.
- Keep public, resident, guest, and admin payment surfaces separated. Do not import admin payment services into public/resident components or `lib/public`.
- Do not expose guest payment private data to guests or residents. Admin access may show operational records only to authorized users.

### UX and Accessibility Requirements

- The admin payments page should be dense, scannable, and operational: table-first layout, compact filters, clear empty/error states, and predictable form controls.
- Use visible labels for all filters and manual payment fields.
- Use `aria-invalid`, `aria-describedby`, and an `aria-live` status region for manual-payment errors/success messages if the form returns inline state.
- Keep table overflow responsive at 320px and wider with no overlapping text. Use horizontal scroll for wide admin tables if needed.
- Do not create a landing page, marketing hero, decorative imagery, nested cards, or explanation text about implementation details.

### Previous Story Intelligence

- Story 3.1 created assessment tables, admin assessment RPCs, and `app.recalculate_property_assessment_summary()`. Use the summary function instead of duplicating property summary math in TypeScript.
- Story 3.2 created payment tables, allocation scope triggers, resident-safe payment history, and RLS/grant guardrails. Do not undo the resident privacy fixes to make admin reads easier.
- Story 3.3 and Story 3.5 established the local payment lifecycle: insert `created`, create Stripe Checkout, update `pending`, and let webhooks mark online payments succeeded. Manual payments should not use Stripe or pretend to be webhook events.
- Story 3.4 and Story 3.5 established the guest privacy boundary. Admin payment UI must not create any guest-facing lookup, token, or balance disclosure.
- Story 3.6 established payment-level idempotency, deterministic assessment allocation, connected-account checks, property summary recalculation, and persistent `audit_logs`. Manual payment recording should preserve those financial invariants.
- Story 3.7 added receipt emails and intentionally excludes `admin_recorded` payments from receipt sending. Do not change that without new acceptance criteria.
- Git history only shows initial scaffold commits, so current story files, migrations, and local tests are more useful than commit history for implementation patterns.

### Current Local Technical Information

- Current local stack from `package.json`: Next.js `^16.0.0`, React `^19.0.0`, TypeScript `^5.0.0`, Tailwind CSS `^4.0.0`, `@supabase/ssr` `^0.10.3`, `@supabase/supabase-js` `^2.105.3`, `stripe` `^22.1.1`, and `resend` `^6.12.3`.
- Current npm registry check on 2026-05-14 showed `next` `16.2.6`, `react` `19.2.6`, `@supabase/supabase-js` `2.105.4`, `@supabase/ssr` `0.10.3`, `stripe` `22.1.1`, and `resend` `6.12.3`. Do not upgrade unrelated framework packages as part of this story.
- Existing tests are fast Node `node:test` file-content guardrails. Keep new admin payment tests in the same style unless the project introduces live Supabase integration infrastructure.
- No `project-context.md` file was found.

### Latest Technical Information

- Next.js Server Actions are server-executed async functions for forms and mutations; forms can submit to actions and actions receive `FormData`. Source: https://nextjs.org/docs/13/app/building-your-application/data-fetching/server-actions-and-mutations
- Next.js documents that Server Actions use POST and should authorize the user before mutating data. Source: https://nextjs.org/docs/13/app/building-your-application/data-fetching/server-actions-and-mutations
- Supabase recommends RLS on tables in exposed schemas and granting only the permissions each Postgres role needs. Source: https://supabase.com/docs/guides/database/postgres/row-level-security
- Supabase notes views can bypass RLS by default unless created with `security_invoker = true` on supported Postgres versions. If a view is used for admin payment records, make the security behavior explicit and tested. Source: https://supabase.com/docs/guides/database/postgres/row-level-security
- Supabase database function guidance shows `security definer` functions with an explicit `search_path`; this story must keep function search paths and execution grants deliberate and tested. Source: https://supabase.com/docs/guides/database/functions
- Supabase JavaScript filters apply to `select`, `update`, `upsert`, and `delete`, and filters should be chained after the operation call. Source: https://supabase.com/docs/reference/javascript/using-filters

### Project Structure Notes

- Admin payment page belongs under `app/(admin)/admin/payments/page.tsx` unless the implementation discovers an existing admin route pattern before coding.
- Admin payment form actions belong under `server/actions/...` with `"use server"`.
- Payment business logic belongs under `server/services/payments/...` with `import "server-only"`.
- Database schema and RPC changes belong in a new ordered migration. Do not edit historical migrations.
- Do not add admin nav to the resident portal. Epic 5 owns the complete board/admin workspace shell and navigation.

### References

- [Epics: Story 3.8](/home/smount/Websites/SpringMeadowCommunity/_bmad-output/planning-artifacts/epics.md)
- [Architecture: Authorization and Payments](/home/smount/Websites/SpringMeadowCommunity/docs/bmad/phase-2-architecture/architecture.md)
- [Architecture: Audit Logging and Financial Safety](/home/smount/Websites/SpringMeadowCommunity/docs/bmad/phase-2-architecture/architecture.md)
- [API Design: Payment History and Admin API](/home/smount/Websites/SpringMeadowCommunity/docs/bmad/phase-3-design/api.md)
- [Data Model: Payments, Allocations, Community Settings, Audit Logs](/home/smount/Websites/SpringMeadowCommunity/docs/bmad/phase-3-design/data-model.md)
- [Tasks: TASK-PAY-005](/home/smount/Websites/SpringMeadowCommunity/docs/bmad/phase-4-tasks/tasks-v1.md)
- [Previous Story 3.7](/home/smount/Websites/SpringMeadowCommunity/_bmad-output/implementation-artifacts/3-7-payment-receipt-emails.md)
- [Previous Story 3.6](/home/smount/Websites/SpringMeadowCommunity/_bmad-output/implementation-artifacts/3-6-stripe-webhook-processing-and-payment-allocation.md)
- [Previous Story 3.5](/home/smount/Websites/SpringMeadowCommunity/_bmad-output/implementation-artifacts/3-5-guest-stripe-payment-session.md)
- [Previous Story 3.2](/home/smount/Websites/SpringMeadowCommunity/_bmad-output/implementation-artifacts/3-2-resident-dues-status-and-payment-history.md)

## Dev Agent Record

### Agent Model Used

GPT-5 Codex

### Debug Log References

- `node --test tests/admin-payment-management.test.mjs` - passed
- `node --test tests/admin-payment-management.test.mjs` - failed as expected after review guardrail updates, then passed after patch
- `npm run typecheck` - passed
- `npm test` - passed
- `npm run lint` - passed
- `npm run build` - passed
- `git diff --check` - passed

### Implementation Plan

- Keep admin payment reads and manual payment creation behind `admin.payments.manage` in both TypeScript and database RPCs.
- Use the new migration as the atomic financial boundary for manual payments, allocation updates, property summary recalculation, `last_payment_at`, idempotency, and audit logging.
- Add a focused admin payment route with server-side filters, a payment records table, and a manual payment form that submits through a server action.
- Verify boundaries with file-content guardrail tests plus the full repository validation commands.

### Completion Notes List

- Ultimate context engine analysis completed - comprehensive developer guide created.
- Story context prepared before implementation.
- Added admin payment-management migration support for `admin.payments.manage`, `manual_payments_enabled`, idempotent manual payment requests, admin payment record reads, and atomic manual payment recording.
- Added a server-only admin payment management service and server action with safe result unions, validation, permission checks, and user-scoped Supabase RPC calls.
- Added a focused `/admin/payments` page with server-side filters, scoped payment table, allocation/unapplied totals, manual-payment enabled/disabled states, and accessible manual-payment controls.
- Added and ran admin payment guardrail tests, full repository tests, typecheck/lint, production build, and whitespace validation.
- Addressed code review findings by removing ambiguous manual amount cent parsing, normalizing manual paid-at timestamps independent of server timezone, including date-only `to` filter end-of-day coverage, making manual-payment errors field-accessible, and rendering paid/created/updated timestamps.
- Hardened manual payment RPC behavior for direct callers by enforcing the service amount cap in SQL, rejecting sensitive payment-instrument reason text, qualifying the idempotency lookup, serializing same-request retries, validating allocations before request-row mutation, and rejecting duplicate explicit allocations.
- Closed remaining Story 3.8 review follow-ups, including literal SQL wildcard search, impossible datetime-local rejection, bounded pagination/allocation/reason inputs, receipt exclusion coverage, trigger helper guardrails, and New York normalization for admin datetime-local filters.

### File List

- `app/(admin)/admin/payments/page.tsx`
- `server/actions/admin-payments.ts`
- `server/services/payments/admin-payment-management.ts`
- `supabase/migrations/202605110008_admin_payment_records_and_manual_payments.sql`
- `tests/admin-payment-management.test.mjs`

### Change Log

- 2026-05-14: Implemented Story 3.8 admin payment records and manual payments; story moved to review.
- 2026-05-14: Addressed 11 Story 3.8 code review patch findings; story remains in review for CR rerun.
- 2026-05-14: Addressed 10 Story 3.8 code review rerun patch findings; story moved to done.
- 2026-05-15: Reconciled remaining Story 3.8 review follow-up checkboxes and tightened admin datetime-local filter normalization.
