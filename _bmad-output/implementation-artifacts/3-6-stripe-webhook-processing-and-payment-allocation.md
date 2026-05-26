# Story 3.6: Stripe Webhook Processing and Payment Allocation

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As the HOA,
I want Stripe webhook events processed reliably,
so that payment status, assessment balances, and receipts reflect confirmed processor events.

## Acceptance Criteria

1. Given Stripe sends a supported webhook event, when the webhook route receives the raw request, then the server verifies the Stripe signature before processing, and unverified payloads are rejected without database writes.
2. Given a valid event is received and has not already been successfully processed, when the webhook processor runs, then the system records the Stripe event ID idempotently, updates the matching payment status and processor references, applies assessment allocations, recalculates the property balance summary, and duplicate or concurrent deliveries do not double-apply payments.
3. Given webhook processing fails after signature verification, when an error occurs after event receipt, then the event is marked failed or logged for retry/monitoring, and the failure does not rely on browser redirect success as proof of payment.

## Tasks / Subtasks

- [ ] Add server-only Stripe webhook configuration and route. (AC: 1, 3)
  - [ ] Add blank `STRIPE_WEBHOOK_SECRET=` to `.env.example`; do not add real secrets, live values, or sample `whsec_...` values.
  - [ ] Extend `lib/stripe/server.ts` with a server-only webhook-secret helper or keep equivalent secret access inside the webhook route/service. Preserve existing `getStripe()` and `getAppBaseUrl()` behavior.
  - [ ] Add `app/api/stripe/webhook/route.ts` with `POST`, `export const runtime = "nodejs"` if needed by the Stripe SDK, and `export const dynamic = "force-dynamic"`.
  - [ ] Read the raw body with `await request.text()` and read the `stripe-signature` header. Do not call `request.json()` before signature verification.
  - [ ] Verify with `getStripe().webhooks.constructEvent(rawBody, signature, webhookSecret)` before inserting `payment_events` or touching payment state.
  - [ ] Return `400` for missing signature, missing webhook secret, malformed payload, or signature verification failure. Return a small `2xx` response for processed, duplicate-processed, and ignored verified events. Return `5xx` only for retryable verified-processing failures after recording safe failure state.
- [ ] Add atomic payment event processing support. (AC: 2, 3)
  - [ ] Add the next ordered migration, likely `supabase/migrations/202605110006_create_stripe_webhook_processing.sql`.
  - [ ] Reuse existing `public.payment_events(provider, provider_event_id)` unique constraint for idempotency; add only narrowly needed indexes/columns if tests prove the current table cannot support retry/monitoring.
  - [ ] Ensure processing is atomic across event claim, payment update, allocation inserts, assessment updates, property summary recalculation, and audit insert. Prefer a Postgres RPC/security-definer function or an explicit row-locking strategy over independent Supabase writes that can partially succeed.
  - [ ] If no persistent `public.audit_logs` migration exists, create the baseline table from the data model in this migration with RLS enabled, no public direct policies, and indexes for community/date, actor, target, and action.
  - [ ] Update `server/services/audit/write-audit-log.ts` or add a webhook-specific audit insert so webhook financial mutations persist `actor_type = 'webhook'`, `actor_profile_id = null`, action, target table/id, before/after snapshots, request/event ID, and safe metadata. Preserve existing role/assessment audit callers.
  - [ ] Treat an existing event with `processing_status = 'processed'` or `ignored` as idempotent success and do not mutate payment/allocation state again. Treat an existing `failed` or stale `received` event as retryable only through code paths that are safe to run multiple times.
  - [x] Enforce payment-level idempotency in addition to Stripe event ID idempotency. If a different Stripe success event targets a local payment that is already `succeeded`, persist safe processor references/event/audit data only; do not allocate additional funds, re-run property balance mutation logic, or apply a previously unapplied remainder to newly open assessments.
- [ ] Handle supported Stripe event types without trusting browser redirects. (AC: 1, 2, 3)
  - [ ] Support at minimum `checkout.session.completed`, `checkout.session.async_payment_succeeded`, `payment_intent.succeeded`, `payment_intent.payment_failed`, `checkout.session.async_payment_failed`, and `charge.refunded`.
  - [ ] For successful Checkout session events, require a trusted payment match from session metadata (`paymentId`, `communityId`, `propertyId`) and verify it matches the stored pending payment and `stripe_checkout_session_id`.
  - [ ] For `payment_intent.succeeded`, match by stored `stripe_payment_intent_id` when available. If it is not stored yet, retrieve or list the related Checkout Session and use its metadata; do not assume current session metadata is automatically present on the PaymentIntent because existing Story 3.3 and 3.5 Checkout creation set `metadata` on the Session only.
  - [x] Support existing `community_settings.stripe_account_mode = 'direct'` safely. For Stripe Connect/direct-account webhook events, use the top-level Stripe `event.account` as the connected-account API context when retrieving Checkout Sessions, PaymentIntents, Charges, and balance transactions. Validate that `event.account` matches the matched community's `stripe_connected_account_id`; reject or fail monitorably when a connected-account event targets a platform-mode community or an unexpected account.
  - [ ] Persist processor references where available: `stripe_payment_intent_id`, `stripe_charge_id`, `stripe_customer_id`, `stripe_receipt_url`, `paid_at`, `processor_fee_cents`, `net_amount_cents`, and a stable `receipt_number` if absent.
  - [ ] For delayed methods such as ACH, keep the payment `pending` until Stripe confirms success through a succeeded event. Do not allocate money merely because the browser returned to the app.
  - [ ] For `payment_intent.payment_failed` and `checkout.session.async_payment_failed`, mark the matching pending payment `failed`, record processor references/error-safe metadata, leave allocations and assessment balances unchanged, and audit the failure.
  - [ ] For `charge.refunded`, update payment status to `refunded` or `partially_refunded`, persist the verified event and audit trail, and do not silently change assessment balances unless the implementation adds explicit, idempotent, tested refund-allocation reversal semantics. Do not invent unreviewed credit-balance behavior in this story.
  - [ ] For unsupported verified event types, record or update `payment_events` as `ignored`, include the event type, and return `2xx`.
- [ ] Apply payment allocations and property balance summaries safely. (AC: 2)
  - [ ] Allocate only confirmed successful payments that are currently `pending` or already `succeeded` from a previous idempotent pass. Do not allocate `created`, `void`, `failed`, `refunded`, or unrelated payment rows.
  - [ ] Use `community_id` and `property_id` from the matched local payment row for every query and mutation.
  - [ ] Because existing resident and guest Checkout sessions do not persist selected assessment IDs, allocate confirmed amounts property-level against open assessments in deterministic order: oldest due date, then created time or ID. Eligible statuses are `open`, `partially_paid`, `overdue`, and `disputed`, with `balance_cents > 0`.
  - [ ] Never allocate more than an assessment balance or more than the payment amount. If payment amount exceeds open balances, leave the remainder unapplied and visible only through internal payment-vs-allocation totals for later admin reconciliation; do not create negative balances or public credit claims.
  - [ ] Insert `payment_allocations` idempotently. Existing unique `(payment_id, assessment_id)` rows must prevent duplicate allocation on retries.
  - [ ] Update `assessments.paid_cents`, `balance_cents`, and `status` while preserving the `assessments_balance_math` and `assessments_paid_not_above_amount` checks. Paid assessments become `paid`; partially paid assessments remain or become `partially_paid`/`overdue` as appropriate; disputed assessments should not lose dispute context unless fully paid.
  - [ ] Call existing `app.recalculate_property_assessment_summary(community_id, property_id)` after successful allocation or any tested refund reversal.
  - [ ] Keep guest privacy boundaries: webhook logs, route responses, public return pages, and future receipt triggers must not expose owner name, account number, public payment code, balance, resident data, documents, payment history, raw lookup input, or guest phone.
- [ ] Prepare receipt and monitoring handoff without sending emails. (AC: 2, 3)
  - [ ] Do not send Resend emails in this story; Story 3.7 owns payment receipt emails.
  - [ ] Leave enough durable state for Story 3.7 to identify newly confirmed payments: `payments.status = 'succeeded'`, `paid_at`, `receipt_number`, payer type, guest/resident email/profile reference, payment amount, and related `payment_events`/audit entry.
  - [ ] Ensure failed webhook events remain monitorable through `payment_events.processing_status = 'failed'`, safe `error` text, and audit metadata. Do not log raw Stripe payloads, full card/bank details, secret names, service-role keys, or raw provider stack traces.
- [ ] Extend verification. (AC: 1, 2, 3)
  - [ ] Add `tests/stripe-webhook-processing.test.mjs`.
  - [ ] Update existing env/server-only guardrail tests to allow blank `STRIPE_WEBHOOK_SECRET` only in server-only contexts.
  - [ ] Test the webhook route reads `request.text()`, verifies `stripe-signature`, never uses `request.json()` before verification, rejects unverified payloads, and imports no client-only modules.
  - [ ] Test `.env.example` documents webhook secret without real values.
  - [ ] Test the processing migration keeps or creates `payment_events` idempotency, adds persistent `audit_logs` if absent, enables RLS/revokes, and preserves private payment grants.
  - [ ] Test duplicate Stripe event handling cannot double-insert allocations or double-increment assessment paid amounts.
  - [x] Test distinct successful Stripe events for the same local payment, such as `checkout.session.completed` followed by `payment_intent.succeeded` and the reverse order, cannot allocate twice or apply a previously unapplied remainder to later assessments.
  - [x] Test connected-account/direct-mode webhook handling uses `event.account` for Stripe API retrievals and validates it against `community_settings.stripe_connected_account_id`; platform-mode communities must not silently accept connected-account events.
  - [ ] Test success events update payment status/references, allocate oldest open assessments deterministically, recalculate property summaries, and persist webhook audit data.
  - [ ] Test failed/delayed/refunded/unsupported events have explicit safe outcomes and do not allocate confirmed funds incorrectly.
  - [ ] Test route/service output and test fixtures do not expose guest PII, account numbers, owner names, raw balances to guests, secrets, raw provider errors, or service-role details.
  - [ ] Run `npm test`, `npm run typecheck`, `npm run lint`, `npm run build`, and `git diff --check`.

### Review Findings

- [x] [Review][Patch] Permanent connected-account mismatch failures were marked retryable [supabase/migrations/202605110006_create_stripe_webhook_processing.sql:295]

## Dev Notes

Story 3.6 is the first source-of-truth payment completion story. Resident and guest browser returns are UX states only. The webhook processor is the only component that may mark online payments succeeded, allocate assessment balances, and make resident payment history show confirmed payments.

The central implementation trap is partial success. A webhook handler that inserts `payment_events`, updates `payments`, and then crashes before allocations can leave the HOA in a misleading financial state. Implement the event claim, payment update, allocation, property summary recalculation, and audit write as one idempotent unit wherever possible.

### Current Files To Update

- `.env.example`
  - Current state: documents public Supabase, Turnstile, server Stripe secret, trusted Supabase keys, and `APP_BASE_URL`.
  - Change: add blank `STRIPE_WEBHOOK_SECRET=`.
  - Preserve: no real keys, no example live secrets, and no public `NEXT_PUBLIC_` webhook secret.
- `lib/stripe/server.ts`
  - Current state: server-only `getStripe()` reads `STRIPE_SECRET_KEY`, and `getAppBaseUrl()` validates `APP_BASE_URL`.
  - Change: add or colocate safe webhook secret access for signature verification.
  - Preserve: no client imports, no raw secret return to UI-facing code, no duplicate Stripe client wrapper.
- `lib/supabase/service-role.ts`
  - Current state: server-only trusted Supabase client using `SUPABASE_SECRET_KEY` or legacy `SUPABASE_SERVICE_ROLE_KEY`, with persisted auth disabled.
  - Change: reuse only inside trusted webhook processing code after Stripe signature verification.
  - Preserve: never import from client components, public pages, middleware/proxy helpers, or browser bundles.
- `server/services/payments/resident-payment-session.ts`
  - Current state: creates resident payment rows as `created`, creates Stripe Checkout, then updates to `pending` with `stripe_checkout_session_id`. Session metadata includes `paymentId`, `communityId`, `propertyId`, `profileId`, and selected method. It intentionally persists no assessment IDs.
  - Change: no direct change expected unless webhook processing needs a shared type/constant.
  - Preserve: resident payment start remains membership-authorized and does not mark success.
- `server/services/payments/guest-payment-session.ts`
  - Current state: claims a hashed lookup session, creates guest payment rows as `created`, creates Stripe Checkout, then updates to `pending` with `stripe_checkout_session_id`. Session metadata includes `paymentId`, `communityId`, `propertyId`, `payerType: "guest"`, selected method, and lookup session ID.
  - Change: no direct change expected unless webhook processing needs shared constants.
  - Preserve: no guest property/balance disclosure and no client-visible internal IDs.
- `supabase/migrations/202605110001_create_assessment_cycles_and_assessments.sql`
  - Current state: creates `assessments`, constraints `paid_cents <= amount_cents` and `balance_cents = amount_cents - paid_cents`, and `app.recalculate_property_assessment_summary()`.
  - Change: use existing summary function after allocation. Do not rewrite this historical migration.
- `supabase/migrations/202605110002_create_payment_records_and_resident_financial_reads.sql`
  - Current state: creates `payments`, `payment_allocations`, `payment_events`, unique Stripe ID columns, payment/allocation scope triggers, safe resident payment history view, RLS, revokes, and limited resident grants.
  - Change: add a new ordered migration for webhook-specific support. Do not broaden direct resident/public access to sensitive payment columns or `payment_events`.
- `server/services/audit/write-audit-log.ts`
  - Current state: server-only audit-intent helper returning `{ kind: "recorded" }`; persistent `audit_logs` table is not present in current migrations.
  - Change: persist audit logs or add a webhook-specific persistent audit path as part of this story.
  - Preserve: existing role and assessment audit callers must still compile.
- `tests/auth-session.test.mjs`, `tests/resident-payment-session.test.mjs`, and new webhook tests
  - Current state: tests are fast Node `node:test` file-content guardrails and currently know about server-only payment env keys.
  - Change: extend guardrails for webhook env, route raw-body verification, idempotent event processing, and allocation safety.

### New Files Likely Needed

- `app/api/stripe/webhook/route.ts`
- `server/services/payments/stripe-webhook-processing.ts`
- `supabase/migrations/202605110006_create_stripe_webhook_processing.sql`
- `tests/stripe-webhook-processing.test.mjs`

### Suggested Webhook Service Contract

Use a narrow server-only contract similar to:

```ts
type StripeWebhookProcessingResult =
  | { kind: "processed"; eventId: string; paymentId?: string }
  | { kind: "duplicate"; eventId: string }
  | { kind: "ignored"; eventId: string; eventType: string }
  | { kind: "failed"; eventId: string; retryable: boolean };

async function processStripeWebhookEvent(event: Stripe.Event): Promise<StripeWebhookProcessingResult>;
```

The route should verify the raw payload and then delegate only the verified `Stripe.Event`. The service should return typed outcomes without raw Stripe/Supabase error messages.

### Allocation Rules

- Treat payment allocation as a financial mutation, not a UI update.
- Use integer cents only. Never use floating point math for money.
- Use the local `payments.amount_cents` as the allocation amount after matching and verifying the event; do not trust a client amount or a browser return URL.
- Require local payment row and Stripe event references to agree. A mismatched `paymentId`, `communityId`, `propertyId`, Checkout Session ID, or PaymentIntent ID must fail safely.
- Do not allocate if the local payment is missing, void, failed, refunded, tied to a different community/property, or already fully processed. "Already fully processed" is payment-level, not only provider-event-level: a new Stripe event ID for an already succeeded payment must not allocate again.
- Keep `payment_allocations` append-only unless implementing explicit, tested refund reversal semantics.
- Property balance summaries must be derived from assessments by `app.recalculate_property_assessment_summary()`, not hand-maintained from client state.

### Stripe Connect / Direct Account Rules

- Story 3.3 and Story 3.5 already support `community_settings.stripe_account_mode = 'direct'` by creating Checkout Sessions with `stripe_connected_account_id`. Story 3.6 must therefore either process those webhooks correctly or fail them monitorably; silent platform-only handling is not acceptable.
- Use Stripe's top-level `event.account` only as account routing context and safe audit metadata. Do not trust it as proof of local authorization without matching the local payment, community, property, and community settings.
- Platform-mode communities should receive events with no connected account context. Direct-mode communities should receive events whose `event.account` matches `community_settings.stripe_connected_account_id`.
- Any mismatch between local community settings and Stripe connected-account context must fail safely without allocations, assessment updates, or public data exposure.

### Architecture Compliance

- Follow the existing Next.js App Router route-handler pattern for public API/webhook routes.
- Keep Stripe and Supabase trusted keys server-only.
- Verify Stripe signature before any trusted Supabase write.
- Scope every database query by `community_id`; future multi-HOA support depends on this.
- Keep resident and guest flows isolated. Resident payment identity comes from `profile_id`; guest payment identity comes from the pending local payment and lookup/session metadata already created by Story 3.5.
- Do not expand resident/public RLS policies to expose payment events, Stripe IDs, guest names/emails/phones, processor fees, internal receipt references, or raw audit data.
- Do not add admin payment records UI, manual payment recording, refund workflow UI, reconciliation exports, or receipt email sending here. Stories 3.7 and 3.8 own those surfaces.

### Previous Story Intelligence

- Story 3.1 created assessment tables, constraints, update RPCs, and `app.recalculate_property_assessment_summary()`. Use that summary function instead of duplicating property-balance logic in TypeScript.
- Story 3.2 created `payments`, `payment_allocations`, `payment_events`, `resident_payment_history`, sensitive column grants, and RLS. Do not undo the direct-read privacy fixes.
- Story 3.3 created `lib/stripe/server.ts`, `lib/supabase/service-role.ts`, `community_settings`, resident Checkout creation, and property-level payment rows. It also resolved the previous assessment-specific ambiguity by not persisting `assessmentIds`.
- Story 3.4 and Story 3.5 established the guest privacy boundary: public lookup/session flows must never expose property details, balances, owner identity, resident data, documents, payment history, raw lookup inputs, or continuation tokens.
- Story 3.5 added hashed, short-lived, single-use guest lookup sessions and a public return page that says payment was submitted for processing, not paid. Preserve that honest copy until webhook confirmation and receipt work exists.
- Story 3.5 validation noted sprint-status drift in docs mirrors. Treat `_bmad-output/implementation-artifacts/sprint-status.yaml` as the active source of truth for this story.
- Git history only shows initial scaffold commits, so current story files, migrations, and local tests are more useful than commit history for implementation patterns.

### Current Local Technical Information

- Current local stack from `package.json`: Next.js `^16.0.0`, React `^19.0.0`, TypeScript `^5.0.0`, Tailwind CSS `^4.0.0`, `@supabase/ssr` `^0.10.3`, `@supabase/supabase-js` `^2.105.3`, and `stripe` `^22.1.1`.
- Current npm registry check on 2026-05-13 showed `stripe` `22.1.1`, `next` `16.2.6`, `react` `19.2.6`, `@supabase/supabase-js` `2.105.4`, and `@supabase/ssr` `0.10.3`. Do not upgrade unrelated framework packages as part of this story unless the implementation truly requires it.
- Existing tests are file-content guardrails. Keep the new webhook tests fast and structural unless the project introduces live Supabase/Stripe integration infrastructure.
- No `project-context.md` file was found.

### Latest Technical Information

- Stripe webhook signature verification requires the raw request body, the `Stripe-Signature` header, and the endpoint secret; parsing or mutating the body before verification can make verification fail. Source: https://docs.stripe.com/webhooks/signature
- Stripe's Node webhook examples use raw `application/json` body handling and `stripe.webhooks.constructEvent(...)` before switching on event type. Source: https://docs.stripe.com/webhooks?lang=node
- Stripe retries webhook deliveries after failures, does not guarantee event ordering, and event object structure follows the account API version at event creation time. Source: https://docs.stripe.com/webhooks?lang=node
- Stripe Checkout fulfillment guidance says webhooks are required for reliable confirmation; browser landing pages are not enough because a customer may never reach the return page after paying. Source: https://docs.stripe.com/checkout/fulfillment
- Stripe Checkout delayed payment methods can complete later through `checkout.session.async_payment_succeeded`; failed delayed methods can use `checkout.session.async_payment_failed`. Source: https://docs.stripe.com/checkout/fulfillment
- Stripe event types relevant here include `checkout.session.completed`, `checkout.session.async_payment_succeeded`, `payment_intent.succeeded`, `payment_intent.payment_failed`, and `charge.refunded`. Source: https://docs.stripe.com/api/events/types
- Next.js Route Handlers live in `app/**/route.ts`, support `POST`, and use the standard Web `Request`/`Response` APIs plus `NextRequest`/`NextResponse` helpers. Source: https://nextjs.org/docs/app/getting-started/route-handlers

### Project Structure Notes

- Webhook routes belong under `app/api/stripe/webhook/route.ts`.
- Server-only webhook processing belongs under `server/services/payments/...` with `import "server-only"`.
- Stripe helpers belong under `lib/stripe/...`; do not add a second unrelated Stripe client.
- Trusted Supabase writes belong in server-only services after signature verification.
- Database schema changes belong in a new ordered migration. Do not edit historical migrations.
- Payment tests belong in `tests/*.test.mjs` and should follow the existing file-content guardrail style.

### References

- [Epics: Story 3.6](/home/smount/Websites/SpringMeadowCommunity/_bmad-output/planning-artifacts/epics.md)
- [Architecture: Payments and Webhook Reliability](/home/smount/Websites/SpringMeadowCommunity/docs/bmad/phase-2-architecture/architecture.md)
- [API Design: Stripe Webhook](/home/smount/Websites/SpringMeadowCommunity/docs/bmad/phase-3-design/api.md)
- [Data Model: Payments, Allocations, Events, Audit Logs](/home/smount/Websites/SpringMeadowCommunity/docs/bmad/phase-3-design/data-model.md)
- [Tasks: TASK-PAY-003 and TASK-QA-002](/home/smount/Websites/SpringMeadowCommunity/docs/bmad/phase-4-tasks/tasks-v1.md)
- [Previous Story 3.5](/home/smount/Websites/SpringMeadowCommunity/_bmad-output/implementation-artifacts/3-5-guest-stripe-payment-session.md)
- [Previous Story 3.3](/home/smount/Websites/SpringMeadowCommunity/_bmad-output/implementation-artifacts/3-3-resident-stripe-payment-session.md)
- [Previous Story 3.2](/home/smount/Websites/SpringMeadowCommunity/_bmad-output/implementation-artifacts/3-2-resident-dues-status-and-payment-history.md)
- [Previous Story 3.1](/home/smount/Websites/SpringMeadowCommunity/_bmad-output/implementation-artifacts/3-1-assessment-cycle-and-property-assessment-management.md)

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
- Focused DS correction pass completed for Story 3.6 validation findings.
- Added payment-level idempotency for distinct Stripe success events targeting an already succeeded local payment. Later success events persist safe references/event/audit state but do not allocate again or rerun property balance mutation logic.
- Added Stripe Connect/direct-account handling by using top-level `event.account` as Stripe API request context and validating it against `community_settings.stripe_connected_account_id`.
- Added webhook guardrail coverage for payment-level idempotency and connected-account validation.
- Code review completed for the focused Story 3.6 DS pass. One patch was applied so permanent connected-account mismatch failures are monitorable without forcing Stripe retries.

### File List

- `_bmad-output/implementation-artifacts/3-6-stripe-webhook-processing-and-payment-allocation.md`
- `server/services/payments/stripe-webhook-processing.ts`
- `supabase/migrations/202605110006_create_stripe_webhook_processing.sql`
- `tests/stripe-webhook-processing.test.mjs`
