# Story 3.3: Resident Stripe Payment Session

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As an authorized property user,
I want to start an online dues payment,
so that I can pay my HOA dues through Stripe without the site handling raw card or bank details.

## Acceptance Criteria

1. Given a resident has active membership and `can_pay_dues` is enabled, when they choose to pay dues with a valid amount and property context, then the server validates authorization, calculates the allowed payment context, creates a pending payment record, and creates a Stripe Checkout session, and the response returns only the Stripe checkout URL or redirects to that URL.
2. Given a resident submits an invalid amount, unauthorized property, disabled payment method, missing payment configuration, or a property with no payable dues, when payment session creation is requested, then the request is rejected with an accessible error, and no private details about unauthorized properties, balances, raw database errors, or internal Stripe configuration are exposed.
3. Given the payment form supports card and optional ACH preferences, when ACH is disabled by community settings, then ACH is not offered, and card payment remains available if enabled.

## Tasks / Subtasks

- [x] Add server-only Stripe and trusted write configuration. (AC: 1, 2, 3)
  - [x] Add the official `stripe` Node SDK dependency; do not add `@stripe/stripe-js` unless the implementation explicitly changes from hosted Checkout URL redirects to client-side Stripe.js.
  - [x] Add server-only configuration for `STRIPE_SECRET_KEY`, a trusted Supabase write key such as `SUPABASE_SECRET_KEY` or legacy `SUPABASE_SERVICE_ROLE_KEY`, and `APP_BASE_URL` or an equivalent server-derived absolute base URL for Checkout success/cancel URLs.
  - [x] Update `.env.example` with the new server-only payment variables and update existing tests that currently reject any Stripe/service-role env example entries.
  - [x] Add a server-only Stripe helper such as `lib/stripe/server.ts`; it must import `server-only`, instantiate Stripe only on the server, and never expose the secret key to client components.
  - [x] Add a server-only Supabase service-role helper such as `lib/supabase/service-role.ts`; it must import `server-only`, use the service role only in trusted server code, and never replace user-scoped Supabase reads for authorization.
- [x] Add minimal community payment settings support. (AC: 2, 3)
  - [x] Add the next ordered migration after `supabase/migrations/202605110002_create_payment_records_and_resident_financial_reads.sql`, likely `supabase/migrations/202605110003_create_community_payment_settings_for_sessions.sql`.
  - [x] Create `public.community_settings` if it does not already exist, using the payment settings fields from the data model: `community_id`, `stripe_account_mode`, `stripe_connected_account_id`, `fee_policy`, `allow_card`, `allow_ach`, `guest_payments_enabled`, `feature_flags`, timestamps, and existing compliance defaults if matching the data model is cleaner.
  - [x] Insert default settings rows for existing communities with `allow_card = true`, `allow_ach = true`, and `fee_policy = 'payer_pays'` unless a row already exists.
  - [x] Enable RLS on `community_settings` and do not add broad resident direct-read policies unless the implementation has a narrow, tested reason. Resident payment session code can read settings through the server-only trusted service after explicit authorization.
  - [x] If `community_settings.fee_policy` includes the data-model value `configurable`, resolve it to a concrete `payer_pays` or `hoa_pays` policy before inserting into `payments.fee_policy`; the existing payment row check only allows those two stored values.
  - [x] Do not build a community settings admin UI; Story 5.6 owns settings management.
- [x] Add a resident payment session domain service. (AC: 1, 2, 3)
  - [x] Add `server/services/payments/resident-payment-session.ts` or an equivalently named server-only service.
  - [x] Reuse `getResidentPortalMemberships()` as the first authorization source. Match submitted `communityId` and `propertyId` against active memberships and require `membership.membershipPermissions.canPayDues === true`.
  - [x] Do not require `canViewBalance` to start a payment. A membership can be payment-authorized while balance viewing is hidden; the service may validate against dues internally but must return only generic errors for hidden-balance cases.
  - [x] Query the active, non-deleted property and open assessment balances using server-derived property/community IDs only. Do not trust client-provided balances, due dates, account numbers, or assessment amounts.
  - [x] Validate `amountCents` as an integer USD cent amount greater than zero, within a defined safe range, and not above the server-calculated payable open balance for that property. If `assessmentIds` are accepted, require every assessment to belong to the authorized property/community and be open/partially paid/overdue/disputed.
  - [x] Validate `methodPreference` against community payment settings. Map resident `"card"` to Stripe `card` and resident `"ach"` to Stripe `us_bank_account`; reject ACH when `allow_ach` is false and reject card when `allow_card` is false.
  - [x] Create a pending resident `payments` row with `payer_type = 'resident'`, `profile_id`, `property_account_snapshot`, `property_address_snapshot`, `amount_cents`, `currency = 'USD'`, `fee_policy`, `method`, and `status = 'pending'`. Use the service role only after all authorization and validation gates pass.
  - [x] Create a Stripe Checkout Session in `payment` mode with server-generated success/cancel URLs, Stripe metadata containing internal IDs needed by later webhook processing, and no raw account number, owner name, guest contact data, or private payment details in client-visible fields.
  - [x] Save the Stripe Checkout Session ID on the pending payment. If Stripe session creation fails after a row is created, mark the row `void` or otherwise safely neutralize it; do not leave ambiguous payable pending records.
  - [x] Return a typed result such as `{ kind: "session-created"; checkoutUrl: string }`, `{ kind: "invalid-request"; message: string }`, `{ kind: "unauthorized"; message: string }`, `{ kind: "configuration-unavailable"; message: string }`, and `{ kind: "payment-unavailable"; message: string }`. Never return raw Supabase errors, raw Stripe errors, secret names, internal IDs, public payment codes, guest contact info, processor fees, or service-role details to the UI.
- [x] Add a resident payment server action. (AC: 1, 2)
  - [x] Add `server/actions/resident-payments.ts` with `"use server"`.
  - [x] Parse `FormData` into `communityId`, `propertyId`, `amountCents` or a decimal dollar amount converted safely to cents, optional `assessmentIds`, and `methodPreference`.
  - [x] Call the resident payment session service; on success, redirect to the Stripe Checkout URL. On failure, redirect back to `/portal/payments` with a generic, accessible status key or return a typed form state if the page is converted to use a client form component.
  - [x] Verify authorization inside the action/service even though the page only renders forms for active memberships. Next.js Server Functions are POST-reachable and must not rely on hidden form fields for authorization.
  - [x] Do not create guest payment routes, admin manual payment actions, Stripe webhook handlers, receipt email actions, or payment allocation mutations in this story.
- [x] Update the resident payments page with a real start-payment form. (AC: 1, 2, 3)
  - [x] Update `app/(resident)/portal/(member)/payments/page.tsx`; keep the route at `/portal/payments` inside the existing `(member)` route group.
  - [x] Preserve the Story 3.2 dues status/history view, permission-aware hidden balance copy, empty history state, date-only formatting, and property-scoped sections.
  - [x] For each active membership with `canPayDues = true`, render a compact property-scoped payment form with amount input, method selection, hidden property/community context, and a submit button.
  - [x] Offer ACH only when community settings allow ACH. Offer card when community settings allow card. If no method is enabled or configuration is unavailable, show a clear resident-facing unavailable state without exposing settings internals.
  - [x] If `canViewBalance = true`, the UI may default or helper-copy the amount from current balance/open dues. If `canViewBalance = false`, do not show balances or due item details, but still allow a payment-authorized resident to enter an amount when payment settings allow it.
  - [x] On cancel/error return from Checkout, display accessible generic copy via `searchParams` or typed action state. Do not claim payment succeeded until the later webhook story processes Stripe confirmation.
  - [x] Keep the page a resident portal work surface: one `h1`, no marketing hero, no nested cards, stable controls at 320px and wider, keyboard reachable form fields, visible labels, visible focus states, and no UI text about implementation internals.
- [x] Preserve Epic 3 boundaries for later payment stories. (AC: 1, 2, 3)
  - [x] Do not process Stripe webhooks, update successful payment status, allocate payments to assessments, recalculate balances from payment success, or send receipt emails; Stories 3.6 and 3.7 own those.
  - [x] Do not build guest lookup/session behavior; Stories 3.4 and 3.5 own those.
  - [x] Do not build admin payment records, manual payment recording, refunds, reconciliation, or admin payment permissions; Story 3.8 owns that.
  - [x] Do not expose payment events or processor identifiers to residents. Stripe IDs may be stored server-side for later webhook and admin monitoring work only.
  - [x] Do not handle raw card, bank, routing, or account details. Stripe-hosted Checkout owns payment method collection.
- [x] Extend verification. (AC: 1, 2, 3)
  - [x] Add `tests/resident-payment-session.test.mjs`.
  - [x] Test the new migration creates or extends `community_settings`, seeds defaults, enables RLS, and avoids broad resident direct-read policies.
  - [x] Test server-only Stripe and service-role helpers exist, use server-only imports, read only server env vars, and are not imported by client components.
  - [x] Test the resident payment session service reuses `getResidentPortalMemberships()`, requires `canPayDues`, validates property/community membership, validates method settings, validates integer cents, and creates pending payments only after authorization.
  - [x] Test the service creates Stripe Checkout sessions with success/cancel URLs and metadata, but returns only a checkout URL or generic typed errors.
  - [x] Test the server action uses `"use server"`, calls the service, redirects only to Stripe checkout URLs returned by the service, and does not expose raw Stripe/Supabase errors.
  - [x] Test the payments page renders a property-scoped payment form, card/ACH options according to settings, hidden-balance payment behavior, disabled/unavailable states, and accessible generic error/cancel messages.
  - [x] Test privacy exclusions: no raw account number, owner display name, public payment code, guest contact info, Stripe secret key, service role key, Stripe checkout session/payment intent/charge/customer IDs in UI-facing fields, payment event payloads, raw provider/database errors, private documents, message contents, or unrelated property data.
  - [x] Run `npm test`, `npm run typecheck`, `npm run lint`, `npm run build`, and `git diff --check`.

### Review Findings

- [x] [Review][Decision] Clarify whether resident sessions support assessment-specific payment context — The payment form submits every visible open assessment as `assessmentIds`, and the service validates and sums those IDs, but the pending `payments` row and Stripe metadata do not persist the selected assessment set for later webhook/allocation processing. Decide whether this story is property-level only, in which case the form/service should stop accepting assessment IDs, or assessment-specific, in which case the selected assessment context needs a durable allocation contract before checkout.
- [x] [Review][Patch] Validate `APP_BASE_URL` before using it for Stripe Checkout redirects [lib/stripe/server.ts:19]
- [x] [Review][Patch] Keep payment rows non-pending until the Checkout session is fully stored [server/services/payments/resident-payment-session.ts:334]

## Dev Notes

Story 3.3 turns the read-only resident dues page from Story 3.2 into the first money-movement entry point. The work must stay narrow: create pending resident payment records and Stripe Checkout sessions only. Stripe completion, webhook idempotency, allocation, balance updates, receipts, guest flows, and admin payment workflows remain later stories.

The central discipline is layered authorization before any trusted write: authenticated user, active profile, active linked property membership, `canPayDues`, active property in the same community, payment settings allow the selected method, server-calculated payable context, then service-role write and Stripe session creation. RLS is defense in depth. Hidden form fields and client-supplied balances are not authorization.

### Current Files To Update

- `package.json` and `package-lock.json`
  - Current state: no Stripe SDK dependency.
  - Change: add the official server-side `stripe` package only. Hosted Checkout URL redirect does not require Stripe.js.
  - Preserve: no unnecessary payment/client dependencies.
- `.env.example`
  - Current state: only public Supabase variables.
  - Change: add server-only payment variables such as `STRIPE_SECRET_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, and `APP_BASE_URL`.
  - Preserve: do not add real secrets or live values.
- `lib/supabase/config.ts`
  - Current state: reads only public Supabase URL and publishable key.
  - Change: either leave unchanged and create a dedicated server-only service role helper, or add a separate server-only function that is not imported by browser/proxy code.
  - Preserve: browser/server SSR clients must continue using publishable key and session cookies.
- `lib/supabase/service-role.ts` (new)
  - Purpose: server-only trusted Supabase client for payment row writes after explicit authorization.
  - Guardrail: never import this from client components, public routes, middleware/proxy helpers, or generic resident read services.
- `lib/stripe/server.ts` (new)
  - Purpose: server-only Stripe client and Checkout helper constants.
  - Guardrail: no secret keys, session IDs, or raw Stripe errors may cross into UI-facing return values.
- `supabase/migrations/202605110003_create_community_payment_settings_for_sessions.sql` (new)
  - Purpose: payment settings foundation needed by ACH/card availability.
  - Guardrail: do not create admin settings UI here.
- `server/services/payments/resident-payment-session.ts` (new)
  - Purpose: authorization, amount/method validation, pending payment row creation, Stripe Checkout Session creation, and safe typed outcomes.
  - Guardrail: server-only; no client imports; no raw errors in return values.
- `server/actions/resident-payments.ts` (new)
  - Purpose: form action for resident payment session requests.
  - Guardrail: use the domain service; do not duplicate authorization in UI only.
- `app/(resident)/portal/(member)/payments/page.tsx`
  - Current state: renders property-scoped dues status/history and a payment/contact affordance.
  - Change: render payment forms/actions for `canPayDues` memberships while preserving Story 3.2 privacy states.
  - Preserve: hidden-balance memberships must not reveal balance/history but may still start a payment when `canPayDues` and settings permit.
- `tests/auth-session.test.mjs`
  - Current state: asserts `.env.example` has no Stripe/service-role entries because those were out of scope for Story 2.1.
  - Change: update this guardrail to allow documented server-only payment env keys while still forbidding them in browser/client/proxy/auth files.
- `tests/resident-dues-status.test.mjs`
  - Current state: ensures Story 3.2 stays read-only and does not include Stripe/session behavior.
  - Change: preserve read-service guardrails, but update any page-level assumptions that are intentionally superseded by Story 3.3 payment forms.

### New Files Likely Needed

- `lib/stripe/server.ts`
- `lib/supabase/service-role.ts`
- `server/services/payments/resident-payment-session.ts`
- `server/actions/resident-payments.ts`
- `supabase/migrations/202605110003_create_community_payment_settings_for_sessions.sql`
- `tests/resident-payment-session.test.mjs`

### Suggested Resident Payment Session Contract

Use a typed service contract similar to:

```ts
type ResidentPaymentSessionInput = {
  communityId: string;
  propertyId: string;
  amountCents: number;
  assessmentIds?: string[];
  methodPreference?: "card" | "ach";
};

type ResidentPaymentSessionResult =
  | { kind: "session-created"; checkoutUrl: string }
  | { kind: "invalid-request"; message: string }
  | { kind: "unauthorized"; message: string }
  | { kind: "configuration-unavailable"; message: string }
  | { kind: "payment-unavailable"; message: string };
```

Recommended resident-facing generic messages:

- Invalid amount or property context: "We could not start that payment. Check the amount and try again."
- Unauthorized or disabled membership: "Payment is unavailable for this membership. Contact the HOA for help."
- Missing Stripe/settings configuration: "Online payments are temporarily unavailable. Please try again later."

Never include raw provider/database messages, hidden balances, account numbers, owner names, public payment codes, Stripe IDs, or service-role details in those messages.

### Payment Settings Requirements

The data model defines `community_settings` with `fee_policy`, `allow_card`, `allow_ach`, and `guest_payments_enabled`. No migration currently creates that table. This story needs the payment-method settings subset so AC3 can be implemented without hard-coded ACH/card availability.

If adding the full table from the data model is simpler than a narrow subset, keep it schema-only and defaulted. Do not build settings management UI or role permissions here.

Use settings as follows:

- `allow_card = true` permits `methodPreference = "card"` and Stripe payment method type `card`.
- `allow_ach = true` permits `methodPreference = "ach"` and Stripe payment method type `us_bank_account`.
- If the submitted method is absent, choose `card` when enabled, otherwise `ach` when enabled, otherwise reject generically.
- Store the selected database method as `card` or `ach`.
- Store a concrete `fee_policy` of `payer_pays` or `hoa_pays` on the pending payment row, but do not invent surcharge/net-fee math in this story. If settings contain `configurable`, choose the configured/default concrete policy before insert rather than writing `configurable` to `payments`. Leave `processor_fee_cents` and `net_amount_cents` null until webhook/reconciliation stories.

### Stripe Checkout Requirements

Use hosted Stripe Checkout for this story.

- Create a new Checkout Session for each payment attempt.
- Use `mode: "payment"`.
- Use integer cents for `unit_amount`; currency must be `usd`.
- Use server-generated `success_url` and `cancel_url` under `/portal/payments`; do not put raw internal IDs in those URLs.
- Include metadata needed by later webhook processing, such as `paymentId`, `communityId`, `propertyId`, `profileId`, and selected method. Do not include raw account numbers, owner names, or hidden balance details.
- Return or redirect only to `session.url`. Treat missing `session.url` as a configuration/provider failure and return generic unavailable copy.
- Do not store or process card/bank details.

### Existing Payment Schema From Story 3.2

Story 3.2 created:

- `public.payments`, `public.payment_allocations`, `public.payment_events`
- `public.resident_payment_history` safe view
- Resident `select` policy for posted payments only
- Resident `select` policy for assessments gated by active membership and `can_view_balance`
- Column grants that avoid direct resident access to guest PII and Stripe processor columns
- Payment allocation property-scope trigger

Story 3.3 must work with that schema. It may write to sensitive Stripe columns through service role only after authorization, but those columns must remain unavailable to direct resident reads.

### Amount Validation Rules

Use deterministic cents parsing and validation:

- Convert decimal dollar strings to cents without floating point math, or accept a hidden/explicit integer cents field generated by trusted code and revalidate server-side.
- Reject non-integers, zero, negative, NaN, Infinity, malformed decimal strings, and unsupported currency.
- Set a practical upper bound to prevent absurd payment attempts; also reject amounts above the server-calculated open balance for selected payable assessments or property-level open balance.
- If no open payable balance exists, reject with generic payment-unavailable copy.
- For `canViewBalance = false`, do not reveal the server-calculated balance in errors. A too-large amount should still get generic invalid/unavailable copy.

### Current UI State To Preserve

The current payments page already:

- Calls `getResidentDuesStatus()`.
- Renders one property-scoped section per active membership.
- Shows status, current balance, due dates, open assessments, and posted payment history when `canViewBalance` is true.
- Hides balance/history details and shows permission-aware copy when `canViewBalance` is false.
- Keeps payment actions available based on `canPayDues`, not `canViewBalance`.
- Uses date-only formatting anchored to noon UTC before formatting in `America/New_York`.

Do not replace this page with a standalone payment-only flow. Add the payment form into each property section.

### Architecture Compliance

- Follow layered authorization before trusted writes.
- Use `community_id` on every payment/settings query and row.
- Keep resident and guest payment flows isolated. Resident flow uses active membership; guest flow later uses privacy-safe lookup and Turnstile.
- Keep Stripe and service role keys server-only.
- Do not broaden direct resident access to payment events, sensitive Stripe columns, guest PII, raw account numbers, or owner names.
- Server actions are directly reachable by POST; all checks must happen inside the action/service.
- Webhook completion is out of scope, so resident history may not show the new pending payment as paid until later stories.

### UX and Accessibility Requirements

- Payment forms must have visible labels for amount and payment method.
- Radio buttons or a segmented control are appropriate for card/ACH method selection; do not offer ACH when disabled.
- Submit controls must be keyboard reachable and have visible focus styles consistent with the resident portal.
- Error/cancel/success-started messages must be accessible, generic, and not rely on color alone.
- Layout must stay stable at 320px and wider. Amount inputs and buttons must not overflow.
- Do not use a marketing hero, decorative imagery, nested cards, or implementation-status explanations.

### Library / Framework Requirements

- Current local stack from `package.json`: Next.js `^16.0.0`, React `^19.0.0`, TypeScript `^5.0.0`, Tailwind CSS `^4.0.0`, `@supabase/ssr` `^0.10.3`, and `@supabase/supabase-js` `^2.105.3`.
- Current npm registry check on 2026-05-12 showed `stripe` version `22.1.1`, `@stripe/stripe-js` version `9.4.0`, `next` version `16.2.6`, `@supabase/supabase-js` version `2.105.4`, and `@supabase/ssr` version `0.10.3`. Use the server-side `stripe` package for hosted Checkout; do not upgrade unrelated framework packages as part of this story unless the implementation truly requires it.
- Next.js Server Functions/Actions are POST-reachable and must verify auth/authorization internally.
- Stripe Checkout Sessions are created server-side and return a hosted Checkout URL.
- Stripe supports `payment_method_types` such as `card` and `us_bank_account` for Checkout payment sessions where the account/payment method configuration supports them.
- Supabase elevated write keys may bypass RLS. Supabase's current docs distinguish publishable keys from secret keys and describe legacy `service_role` keys as elevated; use any trusted Supabase write key only after explicit authorization and keep it in trusted server-only modules.

### Testing Requirements

- Add `tests/resident-payment-session.test.mjs`.
- Keep tests as fast Node `node:test` file-content guardrails unless the project introduces runtime/integration test infrastructure.
- Required checks:
  - `package.json` includes `stripe` and does not include unnecessary client Stripe dependency unless justified.
  - `.env.example` documents server-only payment variables without values.
  - `lib/stripe/server.ts` and `lib/supabase/service-role.ts` import `server-only`.
  - Service role helper is not imported by client components, public pages, proxy, or generic auth helpers.
  - Payment settings migration creates `community_settings`, payment setting columns, default rows, RLS, and no broad resident policies.
  - Resident payment session service calls `getResidentPortalMemberships()`, checks `canPayDues`, scopes by `communityId` and `propertyId`, validates amount and methods, writes pending `payments`, and creates Checkout Sessions.
  - Server action has `"use server"`, parses form data safely, calls the service, redirects on checkout success, and returns or redirects generic errors.
  - Payments page renders property-scoped forms and does not expose hidden balances, raw account numbers, owner names, public payment codes, guest contact data, Stripe IDs, raw errors, service-role details, payment event payloads, private documents, messages, or unrelated property data.
  - Existing Story 3.2 tests continue to protect resident dues reads and privacy.
- Required verification commands:
  - `npm test`
  - `npm run typecheck`
  - `npm run lint`
  - `npm run build`
  - `git diff --check`

### Previous Story Intelligence

- Story 3.2 created the resident dues read service, payments page, payment schema foundation, safe resident payment history view, and privacy guardrails.
- Story 3.2 code review found and fixed a direct column exposure risk on `payments`; do not undo the column grants or return sensitive Stripe/guest fields to residents.
- Story 3.2 review also fixed `canPayDues` behavior for hidden-balance memberships; Story 3.3 must preserve payment actions when `canPayDues = true` even if `canViewBalance = false`.
- Story 3.2 intentionally left Stripe sessions, guest payment sessions, webhooks, payment allocation mutation, and receipt emails out of scope. This story adds resident session creation only.
- Story 2.3 established active property memberships, masked account numbers, and `can_view_balance`/`can_pay_dues` permission booleans.
- Story 2.7 established resident dashboard privacy gates and date-only formatting.
- Story 2.8 review fixed linked member email fallback leakage; do not add payer/contact fallback data in resident payment UI.
- Story 3.1 created assessment tables and property balance recalculation. Assessment writes must remain behind trusted/admin paths; this story may read assessments for payable context but must not mutate allocations or paid balances.

### Current Local Technical Information

- `app/(resident)/portal/(member)/payments/page.tsx` is the resident payment surface to extend.
- `server/services/payments/resident-dues.ts` is the existing server-only read model to reuse for UI data, not for writes.
- `server/services/auth/resident-portal.ts` exposes cached `getResidentPortalMemberships()`; use it as the resident authorization source.
- `lib/supabase/server.ts` creates a user-scoped SSR client from the publishable key and cookies. Do not use it for privileged payment writes.
- `lib/supabase/config.ts` currently reads only public Supabase env vars.
- `.env.example` currently lists only public Supabase values and existing auth tests assert that old behavior; update tests deliberately.
- No `community_settings` table exists in migrations yet, even though the data model includes it.
- No Stripe package or Stripe helper exists yet.
- Existing tests are file-content guardrails and do not import TypeScript modules directly.

### Latest Technical Information

- Stripe Checkout Sessions are created from server-side code and return a Checkout Session object with a hosted `url` for redirect-based flows. Source: https://docs.stripe.com/api/checkout/sessions/create
- Stripe Checkout is the preferred fit here because it keeps payment method collection in Stripe-hosted UI and avoids the site handling raw card or bank details. Source: https://docs.stripe.com/payments/checkout
- ACH through Checkout uses Stripe-supported bank payment method configuration, commonly represented as `us_bank_account` in Checkout `payment_method_types`; enable it only when community settings and Stripe account configuration allow it. Source: https://docs.stripe.com/payments/ach-debit
- Next.js Server Functions/Actions can be invoked by clients and must perform their own authorization and validation. Source: https://nextjs.org/docs/app/getting-started/updating-data
- Supabase secret keys and legacy `service_role` keys are elevated credentials and must remain server-side in trusted code only. Source: https://supabase.com/docs/guides/api/api-keys

### Project Context Reference

- No `project-context.md` file was found.

### References

- [Epics: Story 3.3](/home/smount/Websites/SpringMeadowCommunity/_bmad-output/planning-artifacts/epics.md)
- [Architecture: Payments Architecture](/home/smount/Websites/SpringMeadowCommunity/docs/bmad/phase-2-architecture/architecture.md)
- [API Design: Create Resident Payment Session](/home/smount/Websites/SpringMeadowCommunity/docs/bmad/phase-3-design/api.md)
- [Data Model: Community Settings and Payments](/home/smount/Websites/SpringMeadowCommunity/docs/bmad/phase-3-design/data-model.md)
- [Tasks v1: TASK-PAY-001](/home/smount/Websites/SpringMeadowCommunity/docs/bmad/phase-4-tasks/tasks-v1.md)
- [Previous Story 3.2](/home/smount/Websites/SpringMeadowCommunity/_bmad-output/implementation-artifacts/3-2-resident-dues-status-and-payment-history.md)
- [Previous Story 3.1](/home/smount/Websites/SpringMeadowCommunity/_bmad-output/implementation-artifacts/3-1-assessment-cycle-and-property-assessment-management.md)
- [Previous Story 2.3](/home/smount/Websites/SpringMeadowCommunity/_bmad-output/implementation-artifacts/2-3-property-membership-model.md)
- [Previous Story 2.7](/home/smount/Websites/SpringMeadowCommunity/_bmad-output/implementation-artifacts/2-7-resident-dashboard-summary.md)

## Dev Agent Record

### Agent Model Used

GPT-5 Codex

### Debug Log References

- Red phase: `npm test` failed as expected on missing Story 3.3 payment-session implementation.
- Red phase: `node --test tests/resident-payment-session.test.mjs` failed as expected after adding review guardrails for `APP_BASE_URL` validation and property-level payment context.
- Code review red phase: `node --test tests/resident-payment-session.test.mjs` failed as expected for pending-before-session-storage guardrail.
- `npm test` - 73 tests passed.
- `npm run typecheck` - passed.
- `npm run lint` - passed.
- `npm run build` - passed.
- `git diff --check` - passed.
- `npm audit --omit=dev` - reported existing Next.js/PostCSS advisories; no audit fix was applied because it would update unrelated framework dependencies outside Story 3.3.

### Completion Notes List

- Ultimate context engine analysis completed - comprehensive developer guide created.
- Added the server-side Stripe SDK, blank server-only payment env documentation, and server-only Stripe/trusted Supabase helper modules.
- Added `community_settings` migration with card/ACH/payment-policy defaults, seeded rows for existing communities, RLS enabled, and no broad authenticated resident read policy.
- Added the resident payment session service with membership-first authorization, `canPayDues` enforcement, server-derived payable-balance validation, payment settings/method validation, pending resident payment creation, hosted Stripe Checkout session creation, session ID persistence, and safe voiding on provider/persistence failure.
- Added the resident payment server action with deterministic amount parsing, method parsing, success redirect to the returned hosted checkout URL, and generic `/portal/payments` status redirects for failures.
- Updated the resident payments page to preserve dues status/history privacy states while adding property-scoped payment forms, card/ACH controls based on settings, hidden-balance payment support, and accessible generic cancel/error/return notices.
- Added Story 3.3 guardrail tests and updated prior auth/dues tests for the new server-only payment scope.
- Resolved review finding [Decision]: resident payment sessions are property-level only for Story 3.3; form/action/service no longer accept `assessmentIds`, avoiding an unstored allocation context before webhook/allocation stories.
- Resolved review finding [Patch]: `APP_BASE_URL` is trimmed, parsed as an absolute URL, restricted to HTTP(S), and rejected when credentials, query, or hash are present before Checkout redirect URLs are built.
- Resolved code review finding [Patch]: payment rows now start in `created` status and are promoted to `pending` only when `stripe_checkout_session_id` is stored, so provider/config failures cannot leave an ambiguous payable pending record.

### File List

- `.env.example`
- `_bmad-output/implementation-artifacts/3-3-resident-stripe-payment-session.md`
- `_bmad-output/implementation-artifacts/sprint-status.yaml`
- `app/(resident)/portal/(member)/payments/page.tsx`
- `lib/stripe/server.ts`
- `lib/supabase/service-role.ts`
- `package-lock.json`
- `package.json`
- `server/actions/resident-payments.ts`
- `server/services/payments/resident-payment-session.ts`
- `supabase/migrations/202605110003_create_community_payment_settings_for_sessions.sql`
- `tests/auth-session.test.mjs`
- `tests/resident-dues-status.test.mjs`
- `tests/resident-payment-session.test.mjs`

### Change Log

- 2026-05-12: Created Story 3.3 context for resident Stripe payment session.
- 2026-05-12: Reran create-story context refresh; clarified trusted Supabase key naming, concrete fee policy storage, and current package/doc guidance.
- 2026-05-12: Implemented resident Stripe Checkout session creation and marked ready for review after successful verification.
- 2026-05-12: Addressed review findings by keeping resident sessions property-level, validating `APP_BASE_URL`, and marking Story 3.3 ready for review.
- 2026-05-12: Applied code review patch for payment session lifecycle safety and marked Story 3.3 done.
