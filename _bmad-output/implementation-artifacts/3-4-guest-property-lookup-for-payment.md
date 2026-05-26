# Story 3.4: Guest Property Lookup for Payment

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a guest payer,
I want to locate a property for payment without seeing private account data,
so that I can safely pay dues on behalf of a property.

## Acceptance Criteria

1. Given guest payments are enabled, when a guest submits address, postal code, account number, or public payment code with a valid Turnstile token, then the server performs a privacy-safe lookup and returns only whether the payment flow may proceed, not owner name, balance, resident contacts, documents, or payment history.
2. Given the lookup does not match an eligible property, when the guest submits the lookup form, then the response remains privacy-safe and does not confirm whether a specific property exists, and the guest can correct the lookup or contact the HOA.
3. Given bot protection fails or rate limits apply, when the lookup is submitted, then the request is rejected, and the error is accessible without revealing security internals.

## Tasks / Subtasks

- [x] Add guest lookup index and configuration guardrails. (AC: 1, 2)
  - [x] Add the next ordered migration after `supabase/migrations/202605110003_create_community_payment_settings_for_sessions.sql`, `supabase/migrations/202605110004_add_guest_payment_lookup_indexes.sql`.
  - [x] Add only the property lookup indexes needed for public-payment-code and account-number/postal-code matching.
  - [x] Do not create lookup-session tables, token hashes, raw submitted lookup storage, IP-address storage, owner-name storage, balance storage, or payer contact storage in Story 3.4.
  - [x] Defer any opaque continuation-token persistence, hashing, expiry, and cleanup design to Story 3.5.
  - [x] Update `.env.example` with blank `NEXT_PUBLIC_TURNSTILE_SITE_KEY` and `TURNSTILE_SECRET_KEY` entries if they are not already documented.
- [x] Add public guest lookup validation and response types. (AC: 1, 2, 3)
  - [x] Add `lib/public/guest-payment-lookup.ts` or an equivalent public-safe module for request/response types, validation, normalization, and public-facing messages.
  - [x] Validate `communitySlug`, `addressLine1`, `postalCode`, `accountNumber`, `publicPaymentCode`, and `turnstileToken`.
  - [x] Trim inputs, collapse repeated whitespace, cap field lengths, reject control characters, and require enough lookup detail to avoid account-enumeration probes.
  - [x] Prefer matching `publicPaymentCode` as the strongest single lookup key. Require postal code with street address or account number unless implementation has a tested privacy reason not to.
  - [x] Return field-level errors only for malformed or missing input. For no match, ambiguous match, inactive property, disabled guest payments, or unavailable configuration, return generic form-level copy.
- [x] Add a server-only guest property lookup service. (AC: 1, 2)
  - [x] Add `server/services/payments/guest-property-lookup.ts` with `import "server-only"`.
  - [x] Use `createServiceRoleClient()` only inside trusted server code after bot-protection and rate-limit gates have passed.
  - [x] Resolve the active community by slug and read `community_settings.guest_payments_enabled`.
  - [x] Query only active, non-deleted properties in the resolved community. Select the minimum fields needed for matching, preferably only `id`.
  - [x] Do not select or return `owner_display_name`, `current_balance_cents`, `last_payment_at`, `next_due_date`, resident contacts, documents, payment history, payment events, or Stripe processor fields.
  - [x] Treat zero matches, multiple matches, inactive properties, disabled guest payments, and database/provider errors as privacy-safe non-confirming outcomes.
  - [x] On exactly one eligible match, return only a typed generic success result; do not create, store, return, log, or otherwise persist continuation tokens in Story 3.4.
- [x] Add the public lookup route with bot protection and rate limiting. (AC: 1, 2, 3)
  - [x] Add `app/api/guest-payments/lookup/route.ts` or an equivalent route handler dedicated to lookup only.
  - [x] Parse JSON, run public validation, derive a best-effort remote IP from request headers for Turnstile/rate-limit use, and call `verifyTurnstile(token, remoteIp)`.
  - [x] Add a small server-only public rate-limit helper such as `server/public/rate-limit.ts`; keep messages generic and do not leak threshold, provider, or IP details.
  - [x] Return JSON such as `{ ok: true, canProceed: true, message }` for an eligible match and `{ ok: false, canProceed: false, code, errors?, message }` for all other outcomes.
  - [x] Never create a payment record, Stripe Checkout session, PaymentIntent, receipt, allocation, or webhook event from this route.
  - [x] Never return raw Supabase errors, Turnstile error codes, rate-limit internals, property IDs, community IDs, owner names, balances, account numbers, public payment codes, resident data, document data, payment history, lookup tokens, or lookup-session hashes.
- [x] Replace the staged public lookup page with a real accessible form. (AC: 1, 2, 3)
  - [x] Update `app/(public)/pay-dues/lookup/page.tsx`; remove the read-only staged form and implementation-status copy.
  - [x] Add `components/public/guest-payment-lookup-form.tsx` or an equivalent client component following the existing contact form pattern.
  - [x] Render visible labels for street address, ZIP code, account reference, public payment code, and bot protection.
  - [x] Load the Turnstile widget using the exact Cloudflare script URL and `NEXT_PUBLIC_TURNSTILE_SITE_KEY`, with the existing development-token fallback pattern only outside production.
  - [x] Show accessible, generic success and failure states with `aria-live`, `aria-invalid`, `aria-describedby`, keyboard-reachable controls, and visible focus states.
  - [x] On successful lookup, show only generic client-visible confirmation. Do not store continuation context client-side; Story 3.5 owns token persistence and guest payment continuation.
  - [x] Preserve the public Pay Dues entry at `/pay-dues`, the lookup route at `/pay-dues/lookup`, and the contact fallback at `/contact`.
- [x] Preserve Epic 3 payment boundaries. (AC: 1, 2, 3)
  - [x] Do not implement guest Stripe payment session creation; Story 3.5 owns that.
  - [x] Do not process Stripe webhooks, update payment status, allocate payments, recalculate balances, or send receipt emails; Stories 3.6 and 3.7 own those.
  - [x] Do not add resident payment changes; Story 3.3 owns resident session creation.
  - [x] Do not build admin payment records, manual payments, refunds, reconciliation, or settings management UI; later admin stories own those.
  - [x] Do not expose full property profiles, balances, documents, owner/resident identity, or payment history to guests.
- [x] Extend verification. (AC: 1, 2, 3)
  - [x] Add `tests/guest-payment-lookup.test.mjs`.
  - [x] Update `tests/public-shell.test.mjs` assertions that currently require the lookup page to stay staged and non-mutating.
  - [x] Test the lookup-index migration and assert Story 3.4 does not create lookup sessions, token hashes, expiry fields, raw lookup inputs, or guest PII storage.
  - [x] Test the public validation module for normalization, required-detail rules, length limits, generic messages, and no secret/provider wording.
  - [x] Test the route uses `verifyTurnstile`, rate limiting, the guest lookup service, and JSON responses with only safe fields.
  - [x] Test the service reads `community_settings.guest_payments_enabled`, scopes by `community_id`, considers only active non-deleted properties, returns generic success only on one eligible match, and treats no/multiple/inactive matches generically.
  - [x] Test the UI renders a real form, Turnstile handling, accessible errors/status, contact fallback, no read-only staged fields, and no private financial/property data.
  - [x] Run `npm test`, `npm run typecheck`, `npm run lint`, `npm run build`, and `git diff --check`.

### Review Findings

- [x] [Review][Decision] Defer successful lookup token persistence to Story 3.5 — Story 3.4 keeps only the lookup API and generic success response. It does not store client-side continuation state, create server-side lookup sessions, return `lookupToken`, or decide URL/cookie/session token transport.
- [x] [Review][Patch] Lookup-session persistence failure still distinguishes valid matches from invalid lookups [server/services/payments/guest-property-lookup.ts:143]
- [x] [Review][Patch] Public rate limiter can retain expired buckets indefinitely and collapse production traffic onto an `unknown` bucket [server/public/rate-limit.ts:15]
- [x] [Review][Patch] Turnstile retry flow can reuse a spent token after a failed lookup [components/public/guest-payment-lookup-form.tsx:57]
- [x] [Review][Patch] Network or non-JSON API failures can leave the form stuck submitting [components/public/guest-payment-lookup-form.tsx:58]
- [x] [Review][Patch] Control characters are collapsed before validation can reject them [lib/public/guest-payment-lookup.ts:74]
- [x] [Review][Patch] Bot-protection errors are not associated with an accessible field state [components/public/guest-payment-lookup-form.tsx:182]

## Dev Notes

Story 3.4 turns the public lookup placeholder from Story 1.6 into a real privacy-safe lookup API and form. The work is lookup-only. Its job is to return generic success or generic failure without proving account details, balances, owner identity, or payment history to the public.

The main implementation trap is building the guest payment continuation step too early. This story may confirm that a payment flow can proceed, but it must not create or persist continuation tokens, collect payer details, collect payment amount, write guest payment rows, call Stripe, or create Checkout sessions. Story 3.5 owns any token persistence and transport decision needed for guest payment session creation.

### Current Files To Update

- `.env.example`
  - Current state: documents public Supabase keys plus server-only Stripe/Supabase payment keys and `APP_BASE_URL`; it does not currently document Turnstile variables.
  - Change: add blank `NEXT_PUBLIC_TURNSTILE_SITE_KEY` and `TURNSTILE_SECRET_KEY`.
  - Preserve: no real keys, no live values, no secret examples.
- `app/(public)/pay-dues/lookup/page.tsx`
  - Current state: staged read-only guest lookup form with disabled fields and copy saying lookup is being prepared.
  - Change: render a real lookup form backed by Turnstile and a privacy-safe lookup route.
  - Preserve: public route, visible labels, contact fallback, and privacy-safe wording.
- `app/(public)/pay-dues/page.tsx`
  - Current state: public entry page links to `/pay-dues/lookup` when static `publicPaymentSettings.guestPaymentsEnabled` is true.
  - Change: only adjust copy or entry-state wiring if needed.
  - Preserve: this page must not import server payment services or expose database-backed account details.
- `lib/public/payments.ts`
  - Current state: static public payment entry settings and routes. Tests assert it does not read env vars or import private services.
  - Change: extend route/copy constants only if useful.
  - Preserve: do not treat this static setting as authoritative for payment availability. The lookup service must read `community_settings.guest_payments_enabled` server-side. Use `spring-meadow-community` from this payment config or a shared public constant for guest lookup; do not copy the older contact-form fallback slug `spring-meadow`.
- `components/public/contact-form.tsx`
  - Current state: client component pattern for public forms with Turnstile widget, development fallback token, `aria-live`, `aria-invalid`, and JSON POST.
  - Change: use as the pattern for a new guest lookup form; avoid unrelated contact-form refactors unless extracting tiny shared Turnstile UI clearly helps.
  - Preserve: existing contact behavior and tests.
- `server/public/turnstile.ts`
  - Current state: server-only helper that posts to Cloudflare Siteverify, supports optional `remoteIp`, treats `timeout-or-duplicate` as failure, and has a development-token fallback when no secret is configured outside production.
  - Change: reuse for guest lookup route. Improve only if needed by lookup tests.
  - Preserve: do not expose Turnstile error codes or secrets to route responses.
- `app/api/public/contact/route.ts`
  - Current state: JSON public route pattern for validation, Turnstile verification, safe routing, and generic failures.
  - Change: no direct change expected; use as an API-route pattern.
  - Preserve: no payment/property imports in contact route.
- `tests/public-shell.test.mjs`
  - Current state: asserts `/pay-dues/lookup` is staged, disabled, and non-mutating.
  - Change: update those assertions for a real lookup form while keeping privacy and no-Stripe-session guardrails.
  - Preserve: public shell must remain free of private server service imports except through explicit public API routes/client fetch boundaries.
- `supabase/migrations/202605100001_create_properties_and_memberships.sql`
  - Current state: `properties` includes `account_number`, `public_payment_code`, active/deleted status fields, and address lookup index.
  - Change: do not rewrite this historical migration. Add Story 3.4 lookup indexes in a new migration if needed.
  - Preserve: direct authenticated property RLS remains membership-scoped.
- `supabase/migrations/202605110003_create_community_payment_settings_for_sessions.sql`
  - Current state: `community_settings` includes `guest_payments_enabled`, card/ACH flags, fee policy, RLS, and no direct anon/authenticated grants.
  - Change: no change expected unless tests uncover a missing index or default needed by lookup.
  - Preserve: no broad direct public reads of settings.

### New Files Likely Needed

- `app/api/guest-payments/lookup/route.ts`
- `components/public/guest-payment-lookup-form.tsx`
- `lib/public/guest-payment-lookup.ts`
- `server/services/payments/guest-property-lookup.ts`
- `server/public/rate-limit.ts`
- `supabase/migrations/202605110004_add_guest_payment_lookup_indexes.sql`
- `tests/guest-payment-lookup.test.mjs`

### Suggested Guest Lookup Contract

Use a narrow typed contract similar to:

```ts
type GuestPaymentLookupInput = {
  communitySlug: string;
  addressLine1?: string;
  postalCode?: string;
  accountNumber?: string;
  publicPaymentCode?: string;
};

type GuestPaymentLookupResult =
  | { kind: "lookup-confirmed"; message: string }
  | { kind: "invalid-request"; message: string; fieldErrors?: Record<string, string[]> }
  | { kind: "not-confirmed"; message: string }
  | { kind: "payment-unavailable"; message: string }
  | { kind: "rate-limited"; message: string };
```

Recommended public messages:

- Invalid input: "Check the lookup details and try again."
- No/ambiguous/inactive match: "We could not confirm an eligible property with those details. Check the information or contact the HOA."
- Guest payments disabled or configuration unavailable: "Online guest payments are temporarily unavailable. Contact the HOA for help."
- Turnstile failure: "Complete bot protection and try again."
- Rate limited: "Too many lookup attempts. Please wait before trying again."

Never return property IDs, community IDs, continuation tokens, token hashes, owner names, resident contacts, balances, account numbers, public payment codes, documents, payment history, payment events, Stripe IDs, raw Supabase errors, Turnstile error codes, rate-limit thresholds, IP addresses, or secret names.

Do not return or persist a `lookupToken` in Story 3.4. Story 3.5 must decide whether continuation uses a server-managed cookie, hidden server-side session, resubmitted lookup details, or another token transport, and must explicitly accept any URL/logging risk if it chooses one.

### Lookup Matching Requirements

- Resolve the community by `communitySlug`, active community status, and server-side `community_settings.guest_payments_enabled`.
- Treat `publicPaymentCode` as the strongest public lookup key. It may stand alone if normalized and exact enough.
- Require postal code with address-line or account-number lookups unless implementation has a tested privacy reason to allow weaker matches.
- Use active, non-deleted properties only.
- Detect multiple matching rows with a `limit(2)` pattern or equivalent and return generic non-confirming copy.
- Do not reveal whether the failure was no match, multiple matches, inactive property, disabled guest payments, configuration failure, or query failure.
- On exactly one eligible property, return only generic success and `canProceed: true`.
- Do not create lookup sessions, generate tokens, hash tokens, set token expiries, or store matched property context in Story 3.4.

### Architecture Compliance

- Public guest payer flow is isolated from authenticated resident payment flow.
- Guest lookup does not require a resident account and must not use resident membership permissions.
- Public lookup may use the service-role client only in trusted server code because unauthenticated guests cannot read protected property rows directly.
- Service-role usage must be preceded by Turnstile verification, rate-limit checks, strict validation, community scoping, and minimal field selection.
- A module-local rate limiter is acceptable as an application guardrail for tests/local development, but production should still rely on Cloudflare/WAF rules as the outer abuse-control layer.
- RLS remains defense in depth; do not add direct `anon` policies for `properties`, `community_settings`, or payments.
- Every query must be scoped by `community_id` after resolving the community slug.
- Story 3.5 owns the continuation context design. It must revalidate eligibility and any token/session existence, expiry, and unused state before creating any guest payment session.

### UX and Accessibility Requirements

- Remove implementation-status wording such as "being prepared" from the live lookup page.
- Keep a single page `h1`, visible field labels, helper text that does not mention private account internals, and a clear contact fallback.
- Inputs and submit controls must fit at 320px and wider with no overflow.
- Use `aria-live` for result messages and field-level `aria-invalid`/`aria-describedby` for validation errors.
- Do not rely on color alone for success or failure.
- Do not display matched property detail or store continuation context in the client.
- Do not add a marketing hero, decorative imagery, nested cards, or explanatory implementation text.

### Testing Requirements

- Keep tests as fast Node `node:test` file-content guardrails unless the project introduces runtime/integration infrastructure.
- Required checks:
  - `.env.example` documents Turnstile site and secret keys without values.
  - `server/public/turnstile.ts` remains server-only and is reused by the lookup route.
  - New rate-limit helper is server-only and returns generic outcomes.
  - New migration adds only lookup indexes and does not create token/session persistence, raw lookup input storage, or guest PII storage.
  - Lookup service imports `server-only`, uses `createServiceRoleClient`, reads `community_settings.guest_payments_enabled`, scopes by community/property status, and returns only typed safe outcomes without token persistence.
  - Lookup route verifies Turnstile before service-role lookup, applies rate limiting, returns safe JSON, and does not create Stripe sessions or payment rows.
  - Lookup form posts to the lookup route, includes Turnstile, renders accessible validation/status states, and exposes no private property/payment fields.
  - Existing public contact and resident payment tests still pass.
- Required verification commands:
  - `npm test`
  - `npm run typecheck`
  - `npm run lint`
  - `npm run build`
  - `git diff --check`

### Previous Story Intelligence

- Story 1.6 created the public Pay Dues entry and staged lookup page. This story intentionally supersedes the staged lookup while preserving the privacy-safe contact fallback.
- Story 1.5 created the public contact form and reusable server-only Turnstile helper pattern. Reuse this approach rather than inventing a second bot-protection stack.
- Story 3.1 created assessment tables and property financial summaries. Guest lookup must not reveal those summaries.
- Story 3.2 created safe resident dues/history views and fixed sensitive payment column exposure. Do not broaden public or resident access to payment records.
- Story 3.3 created server-only Stripe and trusted Supabase helpers, `community_settings`, resident payment settings reads, and resident Checkout session creation. Story 3.4 may reuse `createServiceRoleClient()` and `community_settings`, but must not call Stripe.
- Story 3.3 resolved payment lifecycle safety by keeping payment rows in `created` until Checkout session storage succeeds. Guest payment rows are still out of scope until Story 3.5.
- Story 3.3 kept resident sessions property-level. Guest lookup should validate property-level eligibility without creating assessment allocation or continuation-token decisions.

### Current Local Technical Information

- Current local stack from `package.json`: Next.js `^16.0.0`, React `^19.0.0`, TypeScript `^5.0.0`, Tailwind CSS `^4.0.0`, `@supabase/ssr` `^0.10.3`, `@supabase/supabase-js` `^2.105.3`, and `stripe` `^22.1.1`.
- `server/public/turnstile.ts` already calls `https://challenges.cloudflare.com/turnstile/v0/siteverify` and supports optional `remoteIp`.
- `components/public/contact-form.tsx` already loads the Turnstile widget from `https://challenges.cloudflare.com/turnstile/v0/api.js` and reads `cf-turnstile-response`.
- The seeded Spring Meadow community slug is `spring-meadow-community` in `supabase/migrations/202605100003_create_roles_and_profile_roles.sql`; `lib/public/payments.ts` already uses that slug, while the older contact form still falls back to `spring-meadow`.
- `lib/supabase/service-role.ts` supports `SUPABASE_SECRET_KEY` or legacy `SUPABASE_SERVICE_ROLE_KEY`, imports `server-only`, and disables persisted auth sessions.
- `lib/stripe/server.ts` exists for Story 3.3 but should not be imported by Story 3.4 lookup code.
- Existing tests are file-content guardrails and do not import TypeScript modules directly.
- Git history only shows initial scaffold commits, so current story files and local tests are more useful than commit history for implementation patterns.

### Latest Technical Information

- Current npm registry check on 2026-05-12 showed `next` `16.2.6`, `react` `19.2.6`, `@supabase/supabase-js` `2.105.4`, `@supabase/ssr` `0.10.3`, and `stripe` `22.1.1`. No new runtime dependency should be needed for Story 3.4.
- Cloudflare Turnstile server-side validation uses the Siteverify endpoint, requires `secret` and `response`, optionally accepts `remoteip`, and tokens are single-use with a five-minute validity window. Source: https://developers.cloudflare.com/turnstile/get-started/server-side-validation/
- Cloudflare Turnstile client-side implicit rendering uses the exact `https://challenges.cloudflare.com/turnstile/v0/api.js` script URL, creates `cf-turnstile-response` for forms, and still requires server-side validation. Source: https://developers.cloudflare.com/turnstile/get-started/client-side-rendering/
- Next.js Route Handlers live in `app/**/route.ts`, support `POST`, and cannot share the same route segment level as a `page.tsx`. Source: https://nextjs.org/docs/app/getting-started/route-handlers
- Next.js Server Functions and form actions are POST-reachable and require server-side validation/authorization even when the UI constrains what is rendered. Source: https://nextjs.org/docs/app/guides/forms
- Supabase secret keys and legacy `service_role` keys are elevated backend-only credentials that bypass RLS; keep them out of browsers, URLs, logs, public docs, and client bundles. Source: https://supabase.com/docs/guides/api/api-keys

### Project Context Reference

- No `project-context.md` file was found.

### References

- [Epics: Story 3.4](/home/smount/Websites/SpringMeadowCommunity/_bmad-output/planning-artifacts/epics.md)
- [Architecture: Guest Payment Access](/home/smount/Websites/SpringMeadowCommunity/docs/bmad/phase-2-architecture/architecture.md)
- [API Design: Guest Payments and Turnstile](/home/smount/Websites/SpringMeadowCommunity/docs/bmad/phase-3-design/api.md)
- [Data Model: Properties, Community Settings, Payments](/home/smount/Websites/SpringMeadowCommunity/docs/bmad/phase-3-design/data-model.md)
- [Tasks v1: TASK-PAY-002](/home/smount/Websites/SpringMeadowCommunity/docs/bmad/phase-4-tasks/tasks-v1.md)
- [Previous Story 3.3](/home/smount/Websites/SpringMeadowCommunity/_bmad-output/implementation-artifacts/3-3-resident-stripe-payment-session.md)
- [Previous Story 1.6](/home/smount/Websites/SpringMeadowCommunity/_bmad-output/implementation-artifacts/1-6-public-dues-payment-entry-point.md)
- [Previous Story 1.5](/home/smount/Websites/SpringMeadowCommunity/_bmad-output/implementation-artifacts/1-5-public-contact-form-with-bot-protection.md)

## Dev Agent Record

### Agent Model Used

GPT-5 Codex

### Debug Log References

- Red phase: `node --test tests/guest-payment-lookup.test.mjs` failed as expected before Story 3.4 implementation files existed.
- Green phase: `node --test tests/guest-payment-lookup.test.mjs` passed.
- Green phase: `node --test tests/public-shell.test.mjs` passed after replacing staged lookup assertions.
- Regression phase: initial `npm test` surfaced the older auth env guardrail rejecting Turnstile variables; updated the guardrail to allow documented Turnstile env keys while still rejecting unrelated secrets.
- `npm test` - 81 tests passed.
- `npm run typecheck` - passed.
- `npm run lint` - passed.
- `npm run build` - passed.
- `git diff --check` - passed.

### Completion Notes List

- Ultimate context engine analysis completed - comprehensive developer guide created.
- Added Story 3.4 property lookup indexes without token/session persistence.
- Added public-safe guest lookup validation, normalized inputs, generic messages, and Turnstile env documentation.
- Added a server-only guest lookup service that scopes by active community, checks `community_settings.guest_payments_enabled`, queries only active non-deleted properties, treats no/multiple/error outcomes generically, and returns generic success only for a single eligible match.
- Added the public `/api/guest-payments/lookup` route with JSON validation, rate limiting, Turnstile verification, safe token-free responses, and no Stripe/payment-record creation.
- Replaced the staged public guest lookup page with an accessible Turnstile-backed form while preserving the Pay Dues entry and contact fallback.
- Added Story 3.4 guardrail tests and updated existing auth/public-shell tests for Turnstile env and real lookup behavior.

### File List

- `.env.example`
- `_bmad-output/implementation-artifacts/3-4-guest-property-lookup-for-payment.md`
- `_bmad-output/implementation-artifacts/sprint-status.yaml`
- `_bmad-output/planning-artifacts/epics.md`
- `app/(public)/pay-dues/lookup/page.tsx`
- `app/api/guest-payments/lookup/route.ts`
- `components/public/guest-payment-lookup-form.tsx`
- `docs/bmad/phase-4-tasks/epics.md`
- `lib/public/guest-payment-lookup.ts`
- `server/public/rate-limit.ts`
- `server/services/payments/guest-property-lookup.ts`
- `supabase/migrations/202605110004_add_guest_payment_lookup_indexes.sql`
- `tests/auth-session.test.mjs`
- `tests/guest-payment-lookup.test.mjs`
- `tests/public-shell.test.mjs`

### Change Log

- 2026-05-12: Created Story 3.4 context for guest property lookup for payment.
- 2026-05-12: Implemented guest property lookup, public form, privacy guardrails, and verification tests; marked ready for review.
- 2026-05-12: Deferred token persistence to Story 3.5 and kept Story 3.4 as lookup API plus generic success only.
