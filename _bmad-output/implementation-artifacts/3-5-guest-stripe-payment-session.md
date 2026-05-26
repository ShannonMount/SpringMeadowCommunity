# Story 3.5: Guest Stripe Payment Session

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a guest payer,
I want to submit payer details and payment amount,
so that I can pay dues and receive only my transaction receipt.

## Acceptance Criteria

1. Given a guest lookup has returned generic success without persisting continuation state in Story 3.4, when the guest submits payer name, email, optional phone, amount, payment preference, and valid Turnstile token, then the server revalidates the eligible payment context, creates short-lived token/session persistence owned by Story 3.5, creates a pending guest payment record and Stripe Checkout session, and the response contains checkout navigation data and no private property details.
2. Given the guest payment succeeds later through Stripe, when the guest returns to the site, then the return page shows only generic transaction submission or receipt-status copy, and it does not show account balance, owner name, resident data, private documents, or payment history.
3. Given guest payments are disabled, the continuation context is missing/expired/used, bot protection fails, rate limits apply, or the amount is invalid, when the guest attempts to create a payment session, then the request is rejected with a clear accessible generic message and no private account information, raw provider details, or token transport details are exposed.

## Tasks / Subtasks

- [x] Add Story 3.5 guest lookup continuation persistence. (AC: 1, 3)
  - [x] Add the next ordered migration after `supabase/migrations/202605110004_add_guest_payment_lookup_indexes.sql`, likely `supabase/migrations/202605110005_create_guest_payment_lookup_sessions.sql`.
  - [x] Create `public.guest_payment_lookup_sessions` with `id`, `community_id`, `property_id`, `token_hash`, `expires_at`, `used_at`, `created_at`, and `updated_at`.
  - [x] Store only the opaque token hash and foreign keys. Do not store raw lookup address, postal code, account number, public payment code, IP address, owner name, balance, or payer contact fields in this table.
  - [x] Enable RLS, revoke direct `anon` and `authenticated` access, add indexes for `token_hash`, active expiry cleanup, and property/context lookup, and do not add public policies.
  - [x] Extend `server/services/payments/guest-property-lookup.ts` so exactly one eligible match creates a cryptographically random continuation token, stores a SHA-256 or stronger hash with a short expiry, and returns the plaintext token only to the trusted route handler.
  - [x] Extend `app/api/guest-payments/lookup/route.ts` to set an HTTP-only, `sameSite: "lax"` continuation cookie on lookup success. Use `secure` outside local development, a short `maxAge`, and no token in the JSON body, UI, logs, or URL.
  - [x] Clear or replace the cookie on lookup failure, rate limit, or bot-protection failure so stale contexts do not survive failed attempts.
- [x] Add public guest payment-session validation and UI. (AC: 1, 2, 3)
  - [x] Add `lib/public/guest-payment-session.ts` for request/response types, payer validation, deterministic cents parsing, public messages, and safe status keys.
  - [x] Add `app/(public)/pay-dues/payment/page.tsx` and `components/public/guest-payment-session-form.tsx` or equivalent.
  - [x] Update `components/public/guest-payment-lookup-form.tsx` so lookup success moves the guest to the amount/details step or exposes an accessible "Continue to payment details" action without displaying or storing a token in client state.
  - [x] Collect payer name, email, optional phone, amount, payment method, and Turnstile token. Do not collect or display property details, balance, owner/resident identity, documents, or payment history.
  - [x] Add `app/(public)/pay-dues/return/page.tsx` for generic returned/cancelled/submitted states. Do not query by payment ID from the URL or claim payment success before webhook processing.
- [x] Add the guest payment session route and server-only service. (AC: 1, 2, 3)
  - [x] Add `app/api/guest-payments/create-session/route.ts` as the public JSON route for guest session creation.
  - [x] Add `server/services/payments/guest-payment-session.ts` with `import "server-only"`.
  - [x] Route order must be: parse JSON, validate public fields, rate limit, verify Turnstile, read the HTTP-only continuation cookie, hash token, then call the server-only service.
  - [x] The service must atomically claim one unused, unexpired lookup session by token hash before creating a payment. If claim fails, return generic unavailable/invalid context copy.
  - [x] Revalidate active community, `community_settings.guest_payments_enabled`, enabled payment method, active non-deleted property, and payment configuration after claiming the token.
  - [x] Validate `amountCents` as integer USD cents greater than zero and within a practical maximum. Do not reveal balance-derived thresholds to guests; do not expose payable balance.
  - [x] Insert a `payments` row with `payer_type = 'guest'`, `profile_id = null`, guest name/email/phone, property snapshots, amount, currency `USD`, concrete fee policy, method, and status `created`.
  - [x] Create a Stripe Checkout Session in `payment` mode using existing `getStripe()` and `getAppBaseUrl()`, selected method `card` or `us_bank_account`, generic product text, and success/cancel URLs under public pay-dues return routes.
  - [x] Include Stripe metadata needed by Story 3.6, such as `paymentId`, `communityId`, `propertyId`, `payerType: "guest"`, selected method, and lookup session ID. Do not include raw account number, owner name, public payment code, balance, guest phone, or raw lookup input in metadata.
  - [x] After `session.url` exists, update the payment to `pending` with `stripe_checkout_session_id`. If Stripe creation or update fails, mark the payment `void` or otherwise neutralize it and return generic unavailable copy.
  - [x] Return only `{ ok: true, checkoutUrl }` or generic typed failure JSON. Never return internal IDs, session IDs, payment intent IDs, token hashes, raw Stripe/Supabase errors, service-role details, or secret names.
- [x] Preserve Epic 3 payment boundaries. (AC: 1, 2, 3)
  - [x] Do not process Stripe webhooks, mark payments `succeeded`, allocate payments, update assessment/property balances from processor success, or send receipts; Stories 3.6 and 3.7 own those.
  - [x] Do not build resident payment changes; Story 3.3 owns resident session creation.
  - [x] Do not build admin payment records, manual payments, refunds, reconciliation, or settings management UI; later admin stories own those.
  - [x] Do not expose full property profiles, balances, documents, owner/resident identity, payment history, account numbers, or public payment codes to guests.
  - [x] Address Story 3.4 hardening where touched: genericize `payment-unavailable`, reset/reacquire Turnstile tokens after failures, catch network/non-JSON failures, reject control characters before whitespace collapse, and associate bot-protection errors with accessible field state.
- [x] Extend verification. (AC: 1, 2, 3)
  - [x] Add `tests/guest-payment-session.test.mjs`.
  - [x] Update `tests/guest-payment-lookup.test.mjs` for Story 3.5-owned lookup sessions and cookie transport while keeping no token in response body, UI, URL, or client state.
  - [x] Test the lookup-session migration, RLS/revokes, token hashing, expiry, single-use semantics, and absence of raw lookup inputs or guest PII.
  - [x] Test the create-session route uses rate limiting, `verifyTurnstile`, the continuation cookie, safe JSON, and no Stripe/session creation before validation gates pass.
  - [x] Test the service claims lookup context once, revalidates settings/property, writes guest payment rows as `created`, creates Checkout, updates to `pending`, voids unsafe partial rows on failure, and returns only checkout URL or generic errors.
  - [x] Test the amount form and return page for accessible labels/status, Turnstile handling, generic copy, no property details, no balances, and no implementation-status text.
  - [x] Run `npm test`, `npm run typecheck`, `npm run lint`, `npm run build`, and `git diff --check`.

### Review Findings

- [x] [Review][Patch] Payment method options are hardcoded instead of reflecting live community settings [app/(public)/pay-dues/payment/page.tsx:45]
- [x] [Review][Patch] Recoverable form mistakes can clear or stale the guest continuation cookie before payment creation [app/api/guest-payments/create-session/route.ts:43]
- [x] [Review][Patch] Unknown or missing return status displays submitted-payment copy [lib/public/guest-payment-session.ts:187]
- [x] [Review][Patch] Pending payment update does not verify a matched row before returning Checkout [server/services/payments/guest-payment-session.ts:301]
- [x] [Review][Patch] Existing Stripe Checkout session is not expired when local pending update fails [server/services/payments/guest-payment-session.ts:308]
- [x] [Review][Patch] Public rate-limit identity trusts unsanitized forwarded headers [app/api/guest-payments/create-session/route.ts:60]
- [x] [Review][Patch] Continuation cookie is scoped to the whole site instead of guest payment APIs [app/api/guest-payments/lookup/route.ts:20]
- [x] [Review][Patch] Payment method errors are not exposed with aria-invalid on the radio group [components/public/guest-payment-session-form.tsx:196]

## Dev Notes

Story 3.5 extends the public guest payment flow from privacy-safe lookup into Stripe Checkout session creation. Story 3.4 intentionally left lookup as generic success only. This story owns the missing continuation context, and the preferred implementation is a server-managed, HTTP-only cookie backed by a hashed short-lived lookup-session row. Do not return a bearer token in JSON, place it in URLs, write it to local storage, or show it in the UI.

The central discipline is revalidation and one-way privacy: lookup success proves only that a guest may continue. The amount/session step must revalidate the server-side context and create a guest payment without revealing property details, balances, owner/resident identity, documents, payment history, raw provider errors, or token transport mechanics.

### Current Files To Update

- `supabase/migrations/202605110004_add_guest_payment_lookup_indexes.sql`
  - Current state: Story 3.4 added only property lookup indexes and no token/session persistence.
  - Change: do not edit this historical migration. Add a new ordered Story 3.5 migration for lookup sessions.
- `server/services/payments/guest-property-lookup.ts`
  - Current state: server-only lookup service resolves active community/settings, queries active non-deleted properties, selects only `id`, and returns `lookup-confirmed`, `not-confirmed`, or `payment-unavailable` without token persistence.
  - Change: add Story 3.5 continuation creation only after exactly one eligible match.
  - Preserve: no Stripe imports, no payment writes, no owner/balance/resident/document/payment-history selection or return values.
- `app/api/guest-payments/lookup/route.ts`
  - Current state: validates lookup JSON, rate limits, verifies Turnstile, calls lookup service, and returns generic JSON without tokens.
  - Change: set an HTTP-only continuation cookie on success while keeping the response body token-free.
  - Preserve: Turnstile before trusted lookup, rate limiting, generic failures, and no payment/session creation in this route.
- `components/public/guest-payment-lookup-form.tsx`
  - Current state: client form posts lookup fields and shows generic success/failure.
  - Change: on success, continue to `/pay-dues/payment` or show a clear accessible continuation action.
  - Preserve: no token in component state, hidden fields, visible text, local/session storage, or URL.
- `lib/public/guest-payment-lookup.ts`
  - Current state: public lookup validation and message module.
  - Change: update only if needed for generic messages or Story 3.4 review hardening.
- `lib/stripe/server.ts`
  - Current state: server-only Stripe helper and validated `APP_BASE_URL`.
  - Change: reuse for guest Checkout; do not create a second Stripe wrapper.
- `lib/supabase/service-role.ts`
  - Current state: server-only trusted Supabase client using `SUPABASE_SECRET_KEY` or legacy `SUPABASE_SERVICE_ROLE_KEY`.
  - Change: reuse only inside trusted server services after validation/rate-limit/Turnstile gates.
- `server/public/turnstile.ts` and `server/public/rate-limit.ts`
  - Current state: server-only Turnstile helper and in-memory rate limiter from public forms/lookup.
  - Change: reuse for guest create-session route; harden if tests expose Story 3.4 review findings.
- `lib/public/payments.ts`
  - Current state: public payment route constants include `/pay-dues` and `/pay-dues/lookup`.
  - Change: add payment-details and return route constants if useful.
- `.env.example`
  - Current state: documents public Supabase, server-only Stripe/Supabase payment keys, `APP_BASE_URL`, and Turnstile keys.
  - Change: no new env expected.

### New Files Likely Needed

- `app/(public)/pay-dues/payment/page.tsx`
- `app/(public)/pay-dues/return/page.tsx`
- `app/api/guest-payments/create-session/route.ts`
- `components/public/guest-payment-session-form.tsx`
- `lib/public/guest-payment-session.ts`
- `server/services/payments/guest-payment-session.ts`
- `supabase/migrations/202605110005_create_guest_payment_lookup_sessions.sql`
- `tests/guest-payment-session.test.mjs`

### Suggested Contracts

Use narrow typed contracts similar to:

```ts
type GuestPaymentSessionRequest = {
  payerName: string;
  payerEmail: string;
  payerPhone?: string;
  amountCents: number;
  methodPreference?: "card" | "ach";
  turnstileToken: string;
};

type GuestPaymentSessionResult =
  | { kind: "session-created"; checkoutUrl: string }
  | { kind: "invalid-request"; message: string; fieldErrors?: Record<string, string> }
  | { kind: "lookup-expired"; message: string }
  | { kind: "payment-unavailable"; message: string }
  | { kind: "rate-limited"; message: string }
  | { kind: "bot-protection-failed"; message: string };
```

Recommended public messages:

- Invalid input: "Check the payment details and try again."
- Missing/expired lookup context: "Start with the guest payment lookup again."
- Guest payments/configuration unavailable: "Online guest payments are temporarily unavailable. Contact the HOA for help."
- Turnstile failure: "Complete bot protection and try again."
- Rate limited: "Too many payment attempts. Please wait before trying again."
- Return submitted: "Your online payment was submitted for processing. A receipt will be available after confirmation."
- Cancelled: "The online payment was cancelled. You can start again when ready."

### Guest Payment Rules

- Validate amount without floating point math. Accept integer cents or decimal dollars converted deterministically. Reject non-integers, zero, negative, NaN, Infinity, malformed decimals, unsupported currency, and absurd values above the selected practical cap.
- Do not compare guest-entered amount against open balance in a user-distinguishable way. If the implementation uses a server-side cap or balance rule, all failures must remain generic to avoid account probing.
- Resolve method from `community_settings`: `allow_card` maps to Stripe `card`, `allow_ach` maps to Stripe `us_bank_account`; if no method is submitted, prefer card when enabled, otherwise ACH when enabled.
- Resolve `fee_policy = 'configurable'` to a concrete stored payment value, as `payments.fee_policy` only allows `payer_pays` or `hoa_pays`.
- Use `status = 'created'` until the Checkout Session ID is stored, then update to `pending`. This preserves the Story 3.3 lifecycle fix.
- Treat the lookup session as single-use. A failed or cancelled Stripe checkout should require a new lookup unless the implementation has a tested, privacy-safe retry flow.

### Architecture Compliance

- Public guest payer flow remains isolated from authenticated resident payment flow.
- Guest session creation uses Turnstile and rate limiting before service-role reads/writes.
- Service-role usage must stay in `server-only` services and only after public validation gates.
- Every database query must be scoped by `community_id`.
- RLS remains defense in depth; do not add direct anon/authenticated policies for lookup sessions, payments, payment events, or community settings.
- Guest payment rows may store guest email/name/phone for receipt purposes, but UI-facing responses must not echo private property/account details.
- Stripe-hosted Checkout owns card/bank collection. Do not add `@stripe/stripe-js` unless the design intentionally changes away from hosted Checkout.

### UX and Accessibility Requirements

- Keep the public route plain and task-focused. Do not add a landing page, marketing hero, decorative imagery, nested cards, or implementation text.
- Payment details form must have visible labels for payer name, email, optional phone, amount, payment method, and bot protection.
- Use radio buttons or a segmented control for payment method; do not render ACH when settings disallow it.
- Use `aria-live` for status messages and `aria-invalid`/`aria-describedby` for field errors.
- Inputs and submit controls must fit at 320px and wider with no overflow.
- Return page must be generic and receipt-only. It must not show matched property, balance, payment history, owner/resident details, or Stripe/internal IDs.

### Testing Requirements

- Keep tests as fast Node `node:test` file-content guardrails unless the project introduces runtime/integration infrastructure.
- Required checks:
  - Lookup-session migration stores only hashed token/context, enables RLS, revokes anon/authenticated direct access, adds expiry/single-use fields, and avoids raw lookup inputs or guest PII.
  - Lookup route sets an HTTP-only cookie on success and does not return tokens in JSON, URL, visible UI, hidden inputs, or client storage.
  - Guest create-session route validates input, rate limits, verifies Turnstile, reads the cookie, and delegates to server-only service.
  - Guest service revalidates lookup/session/settings/property, creates guest payments safely, creates Stripe Checkout, updates to pending, and voids partial rows on failure.
  - Public pages/forms are accessible and privacy-safe.
  - Existing resident and Story 3.4 tests still pass.
- Required verification commands:
  - `npm test`
  - `npm run typecheck`
  - `npm run lint`
  - `npm run build`
  - `git diff --check`

### Previous Story Intelligence

- Story 3.4 deliberately deferred continuation persistence here. Its current success response is generic and token-free, and its tests assert no `lookupToken` in response/UI/client state.
- Story 3.4 created `properties_guest_public_payment_code_lookup_idx` and `properties_guest_account_postal_lookup_idx`; reuse those indexes, do not duplicate them.
- Story 3.4 review still has actionable hardening findings in files this story will touch: generic failure categories, Turnstile retry behavior, rate-limit key/bucket behavior, network/non-JSON failure handling, control-character validation, and accessible bot-protection error association.
- Story 3.3 created reusable `lib/stripe/server.ts`, `lib/supabase/service-role.ts`, `community_settings`, and the safe payment lifecycle pattern: insert `created`, create Checkout, then update to `pending`; void on unsafe partial failure.
- Story 3.3 intentionally did not build guest routes. Do not copy resident membership authorization into guest flow; guest authorization comes from the lookup continuation and revalidation.
- Story 3.2 created `payments`, `payment_allocations`, `payment_events`, resident payment history view, and sensitive column grants. Do not broaden direct resident or public access to guest PII, Stripe IDs, or payment events.

### Current Local Technical Information

- Current local stack from `package.json`: Next.js `^16.0.0`, React `^19.0.0`, TypeScript `^5.0.0`, Tailwind CSS `^4.0.0`, `@supabase/ssr` `^0.10.3`, `@supabase/supabase-js` `^2.105.3`, and `stripe` `^22.1.1`.
- Current npm registry check on 2026-05-13 showed `next` `16.2.6`, `react` `19.2.6`, `@supabase/supabase-js` `2.105.4`, `@supabase/ssr` `0.10.3`, and `stripe` `22.1.1`.
- `server/public/turnstile.ts` calls Cloudflare Siteverify and supports a development token only outside production when no secret is configured.
- `components/public/guest-payment-lookup-form.tsx` currently posts JSON and resets on success; Story 3.5 must replace that dead-end with a continuation step.
- `app/api/guest-payments/create-session/route.ts` does not exist yet.
- `app/api/guest-payments/lookup/route.ts` exists and should remain lookup-only except setting continuation cookie.
- The seeded community slug is `spring-meadow-community`; `lib/public/payments.ts` already uses it.
- No `project-context.md` file was found.

### Latest Technical Information

- Stripe Checkout Sessions are created server-side; `mode`, `line_items`, `success_url`, `cancel_url`, `customer_email`, `metadata`, and `payment_method_types` are relevant for this hosted Checkout flow. Source: https://docs.stripe.com/api/checkout/sessions/create
- Stripe Checkout can collect guest email/customer details in hosted UI, but this story already collects payer email before redirect so it may pass `customer_email` for guest receipt continuity. Source: https://docs.stripe.com/api/checkout/sessions/create
- ACH through Stripe uses bank-payment support such as `us_bank_account`; offer it only when both community settings and Stripe account configuration allow it. Source: https://docs.stripe.com/payments/ach-direct-debit/accept-a-payment
- Next.js Route Handlers live in `app/**/route.ts` and support POST handlers for public API endpoints. Source: https://nextjs.org/docs/app/getting-started/route-handlers
- Next.js data-security guidance says Server Actions are reachable by direct POST and must validate client input plus re-check authorization; keep mutation logic in server-only services and return only what the client needs. Source: https://nextjs.org/docs/app/guides/data-security
- Cloudflare Turnstile Siteverify requires server-side validation; tokens are single-use and valid for five minutes. Source: https://developers.cloudflare.com/turnstile/get-started/server-side-validation/
- Supabase secret and legacy service-role keys are elevated and must remain in trusted server-side code only. Source: https://supabase.com/docs/guides/api/api-keys

### Project Structure Notes

- Public pages belong under `app/(public)/pay-dues/...`.
- Public API routes belong under `app/api/guest-payments/.../route.ts`.
- Public-safe validation/types belong in `lib/public/...`.
- Trusted payment write logic belongs in `server/services/payments/...` with `import "server-only"`.
- Avoid new abstractions unless they remove concrete duplication with the existing resident payment service or public form patterns.

### References

- [Epics: Story 3.5](/home/smount/Websites/SpringMeadowCommunity/_bmad-output/planning-artifacts/epics.md)
- [Previous Story 3.4](/home/smount/Websites/SpringMeadowCommunity/_bmad-output/implementation-artifacts/3-4-guest-property-lookup-for-payment.md)
- [Previous Story 3.3](/home/smount/Websites/SpringMeadowCommunity/_bmad-output/implementation-artifacts/3-3-resident-stripe-payment-session.md)
- [Architecture: Guest Payment Access and Payments](/home/smount/Websites/SpringMeadowCommunity/docs/bmad/phase-2-architecture/architecture.md)
- [API Design: Guest Payment Session](/home/smount/Websites/SpringMeadowCommunity/docs/bmad/phase-3-design/api.md)
- [Data Model: Community Settings, Properties, Payments](/home/smount/Websites/SpringMeadowCommunity/docs/bmad/phase-3-design/data-model.md)
- [Tasks v1: TASK-GPAY-001 and Guest Payment Pages](/home/smount/Websites/SpringMeadowCommunity/docs/bmad/phase-4-tasks/tasks-v1.md)

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
- Added Story 3.5 lookup continuation persistence with hashed, short-lived, single-use server-owned sessions and HTTP-only cookie transport.
- Added public guest payment details validation, UI, return page, create-session route, and server-only Stripe Checkout creation service.
- Preserved Epic 3 boundaries: no webhook processing, no succeeded allocation/balance changes, no resident/admin payment changes, and no private guest-facing property details.
- Added guardrail coverage for migration privacy, cookie transport, route ordering, service lifecycle, UI accessibility, and token/non-private-data exposure.
- Addressed BMAD code review findings: live method settings, recoverable retries, honest return copy, checkout cleanup, narrower cookies, safer rate-limit identity, and method accessibility.

### File List

- `_bmad-output/implementation-artifacts/3-5-guest-stripe-payment-session.md`
- `_bmad-output/implementation-artifacts/sprint-status.yaml`
- `app/(public)/pay-dues/payment/page.tsx`
- `app/(public)/pay-dues/return/page.tsx`
- `app/api/guest-payments/create-session/route.ts`
- `app/api/guest-payments/lookup/route.ts`
- `components/public/guest-payment-lookup-form.tsx`
- `components/public/guest-payment-session-form.tsx`
- `lib/public/guest-payment-lookup.ts`
- `lib/public/guest-payment-session.ts`
- `lib/public/payments.ts`
- `server/services/payments/guest-payment-session.ts`
- `server/services/payments/guest-property-lookup.ts`
- `supabase/migrations/202605110005_create_guest_payment_lookup_sessions.sql`
- `tests/guest-payment-lookup.test.mjs`
- `tests/guest-payment-session.test.mjs`
- `tests/public-shell.test.mjs`

### Change Log

- 2026-05-13: Implemented Story 3.5 guest Stripe payment session flow and moved story to review.
- 2026-05-13: Addressed code review findings and moved story to done.
