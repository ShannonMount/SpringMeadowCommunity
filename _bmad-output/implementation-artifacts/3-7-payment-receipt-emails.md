# Story 3.7: Payment Receipt Emails

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a payer,
I want to receive a payment receipt after confirmed payment,
so that I have a record of the dues transaction I completed.

## Acceptance Criteria

1. Given a resident payment is confirmed by webhook, when receipt email sending is triggered, then the resident receives a receipt using the configured Resend sender, and the email send attempt is logged.
2. Given a guest payment is confirmed by webhook, when receipt email sending is triggered, then the guest receives only transaction receipt information, and the email does not include account balance, owner name, resident contacts, private documents, or payment history.
3. Given email delivery or send initiation fails, when the send attempt is logged, then the failure status and safe error are recorded for admin monitoring, and payment confirmation remains based on Stripe status, not email delivery.

## Tasks / Subtasks

- [x] Add server-only Resend configuration and dependency. (AC: 1, 2, 3)
  - [x] Add the official `resend` package to `package.json` and `package-lock.json`; do not add unrelated email, queue, or template dependencies unless a concrete implementation need appears.
  - [x] Add blank `RESEND_API_KEY=` and `RESEND_FROM_EMAIL=` entries to `.env.example`. Use no real keys, no live sender domains, and no `NEXT_PUBLIC_` email secrets.
  - [x] Add a server-only helper such as `server/services/email/resend.ts` or `server/services/email/send-email.ts` that reads Resend env vars, constructs the Resend client, validates the configured sender, and never exposes secrets to route responses, client components, logs, or tests.
  - [x] Keep all email helpers under `server/services/email/...` or another server-only location that follows the architecture. Do not import Resend from public pages, client components, middleware/proxy helpers, or `lib/public`.
- [x] Add durable email logging for receipt attempts. (AC: 1, 2, 3)
  - [x] Add the next ordered migration, likely `supabase/migrations/202605110007_create_email_logs.sql`.
  - [x] Create `public.email_logs` if absent using the data-model shape: `community_id`, `type`, `recipient_email`, optional `recipient_profile_id`, `subject`, `provider`, `provider_message_id`, `status`, related record IDs, safe `error`, `sent_at`, timestamps, and indexes for community/type/date, recipient/date, status/date, and related payment.
  - [x] Include receipt types `payment_receipt` and `guest_payment_receipt`; preserve future status values such as `queued`, `sent`, `delivered`, `bounced`, `failed`, and `suppressed`.
  - [x] Enable RLS, revoke direct `anon` and `authenticated` access, and do not add broad public or resident policies. Admin monitoring surfaces come later.
  - [x] Add a narrowly scoped idempotency guard for payment receipts, such as `idempotency_key text unique` and/or a unique partial index on receipt type plus `related_payment_id`. The guard must prevent two webhook deliveries or two distinct success events for the same payment from sending duplicate receipt emails.
  - [x] If retries are supported, update the same receipt log row with `attempt_count`, latest safe `error`, and latest status rather than creating unlimited duplicate receipt rows.
- [x] Add a payment receipt email service. (AC: 1, 2, 3)
  - [x] Add `server/services/payments/payment-receipt-email.ts` with `import "server-only"`.
  - [x] Expose a narrow function such as `sendPaymentReceiptEmailForPayment({ paymentId, stripeEventId })`.
  - [x] Use the service-role Supabase client only in this trusted server service after webhook verification has already happened upstream.
  - [x] Fetch only the confirmed local payment needed for the receipt: `payments.status = 'succeeded'`, `paid_at`, `receipt_number`, payer type, amount, currency, method, `stripe_receipt_url`, `community_id`, `property_id`, `profile_id`, `guest_email`, and safe snapshots as needed.
  - [x] For resident payments, resolve the recipient from `profiles.email` through `payments.profile_id`; do not fall back to guest fields or unrelated contacts.
  - [x] For guest payments, use `payments.guest_email` only. If no usable recipient exists, log a failed or suppressed receipt attempt and return a non-throwing result.
  - [x] Build receipt content from integer cents only. Include local receipt number, paid date, amount, method, community/payment label, and optionally the Stripe receipt URL if present.
  - [x] Resident receipt content may include the property address snapshot. Guest receipt content must not include property address/account details, current balance, owner name, resident names/emails/phones, documents, payment history, raw lookup input, guest phone, assessment breakdowns, or internal identifiers.
  - [x] Do not include raw Stripe event IDs, Checkout Session IDs, PaymentIntent IDs, Charge IDs, Customer IDs, service-role details, secret names, stack traces, processor fee/net internals, or raw provider errors in email bodies or UI-facing results.
  - [x] Return typed outcomes such as `sent`, `already-sent`, `not-eligible`, `missing-recipient`, and `failed` without throwing raw provider/database errors.
- [x] Trigger receipt sending from verified webhook success without making email delivery payment truth. (AC: 1, 2, 3)
  - [x] Update `server/services/payments/stripe-webhook-processing.ts` after the RPC succeeds for a confirmed success event. A safe trigger condition is `result.status === "processed"`, `result.payment_id` exists, and the local `rpcInput.event_payment_status === "succeeded"`.
  - [x] Do not trigger receipt sending for pending, failed, refunded, partially refunded, ignored, duplicate, unverified, or unsupported events.
  - [x] Preserve `app/api/stripe/webhook/route.ts` raw body and signature-verification ordering. The route should still delegate verified events and should not import Resend directly.
  - [x] If receipt sending fails, keep the webhook result successful for the payment when payment processing succeeded. Return `2xx` for the webhook unless payment processing itself requires retry.
  - [x] Use a Resend idempotency key derived from stable local data, such as `payment-receipt/{paymentId}` or `guest-payment-receipt/{paymentId}`, and keep it under Resend's documented length limit.
  - [x] Ensure Story 3.6 payment-level idempotency remains intact: distinct Stripe success events for the same succeeded payment may persist safe payment references, but receipt sending must still be at most one successful email per payment/type unless an explicit admin retry later changes that.
- [x] Preserve Epic 3 boundaries and privacy. (AC: 1, 2, 3)
  - [x] Do not change payment allocation rules, assessment balance mutation, property summary recalculation, or webhook signature verification semantics from Story 3.6.
  - [x] Do not build admin payment records, manual payments, reconciliation, refund workflows, email monitoring UI, Resend webhook handling, or background retry dashboards here. Stories 3.8 and 5.9 own those surfaces unless a tiny schema hook is required for this story.
  - [x] Do not expose `email_logs` to residents or guests through direct RLS policies, public routes, or resident payment history views.
  - [x] Do not claim payment success from the browser return pages. The webhook-confirmed payment row remains the source of truth.
  - [x] Keep guest receipt copy strictly transaction-scoped and privacy-safe, matching Stories 3.4 and 3.5 guest boundaries.
- [x] Extend verification. (AC: 1, 2, 3)
  - [x] Add `tests/payment-receipt-email.test.mjs`.
  - [x] Update existing env/server-only guardrail tests to allow blank Resend server env vars only in server-only contexts.
  - [x] Test `package.json` includes `resend` and does not add unrelated email/client dependencies.
  - [x] Test `.env.example` documents Resend env vars with blank values and no real sender/key.
  - [x] Test the email log migration creates `email_logs`, receipt types, status checks, RLS/revokes, useful indexes, and an idempotency guard for payment receipts.
  - [x] Test the receipt service imports `server-only`, uses the service-role client and Resend helper only server-side, selects confirmed payments, resolves resident vs guest recipients correctly, uses an idempotency key, and returns typed safe outcomes.
  - [x] Test webhook processing invokes the receipt service only after verified successful payment processing and does not make receipt failure force a retryable Stripe webhook failure.
  - [x] Test guest receipt templates and service code do not contain or select private guest-disallowed fields such as account balance, owner name, resident contacts, documents, payment history, raw lookup input, guest phone, public payment code, or raw account number.
  - [x] Test public/resident/client-facing files do not import Resend helpers, `email_logs`, receipt service internals, Resend env vars, service role keys, or payment event internals.
  - [x] Run `npm test`, `npm run typecheck`, `npm run lint`, `npm run build`, and `git diff --check`.

### Review Findings

- [x] [Review][Patch] Existing sent receipt logs can be overwritten by later missing-recipient duplicates [server/services/payments/payment-receipt-email.ts:355]
- [x] [Review][Patch] Stuck queued receipt logs are treated as already sent and suppress retries [server/services/payments/payment-receipt-email.ts:229]

## Dev Notes

Story 3.7 is the first email-sending story in the payment flow. Story 3.6 already made Stripe webhook processing the durable source of truth for online payment success. This story must not weaken that: a payment is confirmed because verified Stripe webhook processing updated the local `payments` row, not because a receipt email was sent or delivered.

The safest implementation shape is a best-effort, idempotent side effect after durable success. The webhook processor should first finish payment processing through `process_stripe_payment_event`; only after that succeeds for a success event should it ask a receipt service to send or no-op. Receipt send failure must be logged in `email_logs` and must not roll back allocations, assessment summaries, audit logs, or payment status.

### Current Files To Update

- `package.json` and `package-lock.json`
  - Current state: no Resend SDK dependency.
  - Change: add the official `resend` Node SDK.
  - Preserve: do not add client email libraries or unnecessary template frameworks.
- `.env.example`
  - Current state: documents public Supabase/Turnstile keys, server Stripe/webhook keys, trusted Supabase keys, and `APP_BASE_URL`.
  - Change: add blank `RESEND_API_KEY=` and `RESEND_FROM_EMAIL=`.
  - Preserve: no real secrets, no sender domain examples that look production-ready, and no `NEXT_PUBLIC_` Resend values.
- `server/services/payments/stripe-webhook-processing.ts`
  - Current state: server-only processor maps verified Stripe events to RPC input, calls `process_stripe_payment_event`, and returns typed outcomes. It already supports success, failure, refunds, ignored events, direct-account context, and payment-level idempotency.
  - Change: trigger the receipt service only after successful payment processing for succeeded events.
  - Preserve: existing supported event handling, connected-account retrieval context, safe error behavior, and duplicate/ignored results.
- `app/api/stripe/webhook/route.ts`
  - Current state: reads `request.text()`, verifies `stripe-signature` with `getStripe().webhooks.constructEvent(...)`, delegates to the processor, and maps processor retryability to HTTP status.
  - Change: no direct Resend import expected; only update if the processor contract changes.
  - Preserve: no `request.json()` before signature verification and no database/email writes before verification.
- `supabase/migrations/202605110006_create_stripe_webhook_processing.sql`
  - Current state: creates persistent `audit_logs`, adds webhook processing RPC, sets `payments.status = 'succeeded'`, `paid_at`, `receipt_number`, Stripe references, allocations, and property summaries.
  - Change: do not rewrite this historical migration. Add a new ordered migration for email logs.
  - Preserve: Story 3.6 financial mutation behavior and idempotency.
- `server/services/audit/write-audit-log.ts`
  - Current state: persistent audit writer is available and safe. Receipt email logging should use `email_logs`; audit logging is optional unless the implementation needs a business audit entry for failed/sent receipt side effects.
  - Change: no direct change expected.
  - Preserve: existing role/assessment/webhook audit callers.
- `server/services/payments/resident-payment-session.ts`
  - Current state: creates resident payment rows with `payer_type = 'resident'`, `profile_id`, property snapshots, amount, method, and Stripe metadata.
  - Change: no direct change expected.
  - Preserve: resident Checkout creation remains session-start only and does not send receipts.
- `server/services/payments/guest-payment-session.ts`
  - Current state: creates guest payment rows with `payer_type = 'guest'`, `guest_email`, optional `guest_phone`, property snapshots, amount, method, and Stripe metadata.
  - Change: no direct change expected.
  - Preserve: guest Checkout creation remains session-start only and does not send receipts.
- `tests/stripe-webhook-processing.test.mjs`
  - Current state: guards raw webhook verification, service-only processor code, atomic migration, payment-level idempotency, audit logs, and no public/client leakage.
  - Change: add or coordinate checks so receipt triggering is limited to confirmed success and cannot make payment success retry because email failed.
- `tests/auth-session.test.mjs` and any env guardrails
  - Current state: allow current server-only payment env keys in `.env.example`.
  - Change: allow blank Resend env keys while continuing to forbid server secrets in browser/client/proxy surfaces.

### New Files Likely Needed

- `server/services/email/resend.ts`
- `server/services/email/send-email.ts`
- `server/services/payments/payment-receipt-email.ts`
- `supabase/migrations/202605110007_create_email_logs.sql`
- `tests/payment-receipt-email.test.mjs`

### Suggested Contracts

Use narrow typed contracts similar to:

```ts
type EmailSendResult =
  | { kind: "sent"; emailLogId: string; providerMessageId: string }
  | { kind: "already-sent"; emailLogId: string }
  | { kind: "failed"; emailLogId?: string; retryable: boolean };

type PaymentReceiptEmailResult =
  | { kind: "sent"; paymentId: string }
  | { kind: "already-sent"; paymentId: string }
  | { kind: "not-eligible"; paymentId?: string }
  | { kind: "missing-recipient"; paymentId: string }
  | { kind: "failed"; paymentId: string; retryable: boolean };
```

The webhook processor should use these results for logging/observability only. It should not convert a receipt failure into payment failure.

### Receipt Recipient Rules

- Resident receipts:
  - Require `payments.payer_type = 'resident'`.
  - Require `payments.profile_id`.
  - Resolve recipient from `profiles.email` scoped to the same payment/profile relationship.
  - Do not use guest email/phone, property membership emails, owner display names, or fallback public contact data.
- Guest receipts:
  - Require `payments.payer_type = 'guest'`.
  - Use only `payments.guest_email`.
  - Do not include guest phone in the email body or logs beyond existing payment storage.
- Non-online/admin-recorded payments:
  - Do not send in this story unless explicit tests and acceptance criteria are added. Story 3.8 owns manual payment workflows.

### Receipt Content Rules

Use transaction-scoped content:

- Community/payment label: "Spring Meadow HOA dues payment" or equivalent.
- Receipt number from `payments.receipt_number`.
- Paid date from `payments.paid_at`, formatted in the community/app timezone when practical.
- Amount from `payments.amount_cents` and `payments.currency`.
- Payment method from `payments.method`, displayed as a safe label.
- Optional Stripe receipt URL from `payments.stripe_receipt_url` if present.

Do not include in guest receipts:

- Account balance or delinquency status.
- Owner name or resident contacts.
- Property account number, public payment code, raw lookup input, or full property profile.
- Private documents, payment history, assessment history, or open assessment breakdowns.
- Guest phone.

Do not include in any receipt:

- Raw card or bank data.
- Stripe Checkout Session ID, PaymentIntent ID, Charge ID, Customer ID, event ID, or connected account ID.
- Service role or Resend/Stripe/Supabase secret names or values.
- Raw provider/database error messages.

### Email Log Rules

- Insert or claim an `email_logs` row before calling Resend so failures are visible.
- Store `provider = 'resend'`.
- Store Resend `data.id` as `provider_message_id` on send success.
- Store safe error categories or sanitized messages, such as `missing-recipient`, `resend-validation-error`, `resend-rate-limited`, `resend-configuration-error`, or `resend-send-failed`.
- Avoid storing complete provider payloads or raw stack traces.
- If Resend returns an error, mark the log `failed` or `suppressed` as appropriate and keep the local payment status unchanged.
- If the send succeeds, mark the log `sent` with `sent_at = now()`; delivery webhook status updates can be a later story.

### Architecture Compliance

- Follow the existing Next.js App Router route-handler pattern. No new public route is required for this story.
- Keep Resend and Supabase trusted keys server-only.
- Use `community_id` on every email log and payment query.
- Keep resident and guest flows isolated. Resident identity comes from `profile_id`; guest identity comes from `guest_email` on the confirmed payment row.
- Do not broaden RLS or grants for `payments`, `payment_events`, `audit_logs`, or new `email_logs`.
- Keep tests fast Node `node:test` file-content guardrails unless the project introduces live Supabase/Stripe/Resend integration infrastructure.

### Previous Story Intelligence

- Story 3.1 created assessment tables and `app.recalculate_property_assessment_summary()`.
- Story 3.2 created `payments`, `payment_allocations`, `payment_events`, resident payment history, sensitive column grants, and RLS. Do not expose guest PII or Stripe processor columns to residents.
- Story 3.3 created `lib/stripe/server.ts`, `lib/supabase/service-role.ts`, `community_settings`, resident Checkout creation, and the `created` -> `pending` payment lifecycle.
- Story 3.4 and Story 3.5 established the guest privacy boundary: guest flows must never expose property details, balances, owner identity, resident data, documents, payment history, raw lookup inputs, continuation tokens, or private account data.
- Story 3.5 stores `guest_email` specifically for receipt purposes, but public responses must not echo private property/account information.
- Story 3.6 created `app/api/stripe/webhook/route.ts`, `server/services/payments/stripe-webhook-processing.ts`, `audit_logs`, and the `process_stripe_payment_event` RPC. It leaves enough state for this story: `payments.status = 'succeeded'`, `paid_at`, `receipt_number`, payer type, guest/resident identity references, amount, processor receipt URL, and related `payment_events`/audit records.
- Story 3.6 validation fixed two important traps: payment-level idempotency across distinct Stripe success events and Stripe Connect/direct-account context. Receipt sending must preserve both fixes.
- Git history only shows initial scaffold commits, so current story files, migrations, and local tests are more useful than commit history for implementation patterns.

### Current Local Technical Information

- Current local stack from `package.json`: Next.js `^16.0.0`, React `^19.0.0`, TypeScript `^5.0.0`, Tailwind CSS `^4.0.0`, `@supabase/ssr` `^0.10.3`, `@supabase/supabase-js` `^2.105.3`, and `stripe` `^22.1.1`.
- Current npm registry check on 2026-05-13 showed `resend` `6.12.3`, `next` `16.2.6`, `react` `19.2.6`, `@supabase/supabase-js` `2.105.4`, `@supabase/ssr` `0.10.3`, and `stripe` `22.1.1`.
- Existing tests are fast Node file-content guardrails. Keep new receipt tests in the same style.
- No `project-context.md` file was found.
- Active sprint tracking is `_bmad-output/implementation-artifacts/sprint-status.yaml`; the docs mirror may be stale.

### Latest Technical Information

- Resend's Node.js guide uses the official `resend` SDK, constructs `new Resend(apiKey)`, and sends via `resend.emails.send({ from, to, subject, html })`. Source: https://resend.com/docs/send-with-nodejs
- Resend's Email API requires `from`, `to`, `subject`, and email content; the send response includes a provider email ID. Source: https://resend.com/docs/api-reference/emails
- Resend idempotency keys are supported for `POST /emails`; the SDK accepts an `idempotencyKey` option, keys can be up to 256 characters, and Resend keeps them for 24 hours. Source: https://resend.com/docs/dashboard/emails/idempotency-keys
- Resend error responses include safe categories for missing/invalid API keys, unverified domains, invalid sender addresses, rate limits, quota limits, and server errors. Store sanitized categories, not raw provider payloads. Source: https://www.resend.com/docs/api-reference/errors
- Resend dashboard email events include `sent`, `delivered`, `delivery_delayed`, `bounced`, `failed`, `complained`, and `suppressed`. This story should log send initiation success/failure; provider delivery webhook handling can remain future work unless explicitly added. Source: https://resend.com/docs/dashboard/emails/introduction

### Project Structure Notes

- Email service code belongs under `server/services/email/...` with `import "server-only"`.
- Payment receipt orchestration belongs under `server/services/payments/...`.
- Database schema changes belong in a new ordered migration. Do not edit historical migrations.
- No frontend page is required for this story.
- Payment receipt tests belong in `tests/*.test.mjs` and should follow the existing guardrail style.

### References

- [Epics: Story 3.7](/home/smount/Websites/SpringMeadowCommunity/_bmad-output/planning-artifacts/epics.md)
- [Architecture: Email Architecture](/home/smount/Websites/SpringMeadowCommunity/docs/bmad/phase-2-architecture/architecture.md)
- [Architecture: Payments and Guest Payment Access](/home/smount/Websites/SpringMeadowCommunity/docs/bmad/phase-2-architecture/architecture.md)
- [API Design: Stripe Webhook and Resend Email Service](/home/smount/Websites/SpringMeadowCommunity/docs/bmad/phase-3-design/api.md)
- [Data Model: Payments and Email Logs](/home/smount/Websites/SpringMeadowCommunity/docs/bmad/phase-3-design/data-model.md)
- [Tasks v1: TASK-PAY-004 and TASK-DB-020](/home/smount/Websites/SpringMeadowCommunity/docs/bmad/phase-4-tasks/tasks-v1.md)
- [Previous Story 3.6](/home/smount/Websites/SpringMeadowCommunity/_bmad-output/implementation-artifacts/3-6-stripe-webhook-processing-and-payment-allocation.md)
- [Previous Story 3.5](/home/smount/Websites/SpringMeadowCommunity/_bmad-output/implementation-artifacts/3-5-guest-stripe-payment-session.md)
- [Previous Story 3.3](/home/smount/Websites/SpringMeadowCommunity/_bmad-output/implementation-artifacts/3-3-resident-stripe-payment-session.md)
- [Previous Story 3.2](/home/smount/Websites/SpringMeadowCommunity/_bmad-output/implementation-artifacts/3-2-resident-dues-status-and-payment-history.md)

## Dev Agent Record

### Agent Model Used

GPT-5 Codex

### Debug Log References

- `npm test`
- `npm run typecheck`
- `npm run lint`
- `npm run build`
- `git diff --check`

### Completion Notes List

- Ultimate context engine analysis completed - comprehensive developer guide created.
- Story context prepared; implementation not started.
- Implemented server-only Resend configuration and send wrapper with safe error categorization.
- Added private `email_logs` persistence with receipt idempotency, status tracking, RLS, revokes, and payment indexes.
- Added confirmed-payment receipt orchestration for resident and guest receipts with recipient resolution, guest privacy boundaries, typed outcomes, and send-attempt logging.
- Hooked receipt sending into verified successful Stripe webhook processing without making receipt delivery determine payment confirmation.
- Added payment receipt guardrail tests and updated env tests for server-only Resend variables.
- Code review patches applied for receipt-log idempotency ordering and stale queued receipt retry handling.

### File List

- `.env.example`
- `_bmad-output/implementation-artifacts/3-7-payment-receipt-emails.md`
- `_bmad-output/implementation-artifacts/sprint-status.yaml`
- `package-lock.json`
- `package.json`
- `server/services/email/resend.ts`
- `server/services/email/send-email.ts`
- `server/services/payments/payment-receipt-email.ts`
- `server/services/payments/stripe-webhook-processing.ts`
- `supabase/migrations/202605110007_create_email_logs.sql`
- `tests/auth-session.test.mjs`
- `tests/payment-receipt-email.test.mjs`

### Change Log

- 2026-05-13: Implemented Story 3.7 payment receipt emails and moved story to review.
- 2026-05-13: Applied code review fixes and moved story to done.
