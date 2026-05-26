# Story 3.2: Resident Dues Status and Payment History

Status: in-progress

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a resident,
I want to view dues status and payment history for my linked property,
so that I can understand what I owe and what has been paid.

## Acceptance Criteria

1. Given a resident has active membership for a property and `can_view_balance` is enabled, when they open the payments page or dashboard payment summary, then they see authorized dues status, balance, due dates, and payment history for that property, and payment records for unrelated properties are excluded.
2. Given `can_view_balance` is disabled for the resident membership, when the resident opens payment-related views, then balance details are hidden, and the resident receives a clear permission-aware message.
3. Given payment history is empty, when the resident opens the payments page, then a polished empty state is displayed, and no private system details or unrelated financial data are exposed.

## Tasks / Subtasks

- [ ] Add resident-safe financial read schema support. (AC: 1, 2, 3)
  - [ ] Add the next ordered migration after `supabase/migrations/202605110001_create_assessment_cycles_and_assessments.sql`, likely `supabase/migrations/202605110002_create_payment_records_and_resident_financial_reads.sql`.
  - [ ] Create `public.payments`, `public.payment_allocations`, and `public.payment_events` using the canonical payment data model fields, indexes, integer cents, status/method/payer checks, and `community_id` on every HOA-scoped row.
  - [ ] Enable RLS on new payment tables. Residents may select only posted property payment records for active linked properties when `property_memberships.can_view_balance = true`; guests must get no authenticated table policy.
  - [ ] Add a follow-up resident `select` policy on `public.assessments` for active linked properties with `can_view_balance = true`; keep assessment writes behind the Story 3.1 audited RPCs.
  - [ ] Do not broaden `public.assessment_cycles` resident access unless the page truly needs cycle metadata; due dates and descriptions can come from `assessments`.
  - [ ] Do not expose `payment_events` to residents. Webhook event storage is for Story 3.6 and admin monitoring later.
- [ ] Add a server-only resident dues/payment read service. (AC: 1, 2, 3)
  - [ ] Add `server/services/payments/resident-dues.ts` or an equivalently named server-only service in the payments domain.
  - [ ] Reuse `getResidentPortalMemberships()` as the source of authenticated profile, active memberships, masked account number, property IDs, community IDs, and permission booleans.
  - [ ] Query `properties` summary fields, resident-visible `assessments`, and resident-visible `payments` only for membership-derived property IDs and matching community IDs.
  - [ ] Apply `canViewBalance` in the service mapping, not only in UI. If disabled, return `null`/empty financial fields and a permission-aware state for that property.
  - [ ] Return typed privacy-safe states for unauthenticated, profile unavailable, no active membership, dues unavailable, and successful dues data.
  - [ ] Do not return raw Supabase errors, raw account numbers, owner names, public payment codes, guest emails/phones, Stripe IDs, internal IDs in UI-facing fields, payment event payloads, private documents, or message contents.
- [ ] Replace the resident payments placeholder with a real dues/history view. (AC: 1, 2, 3)
  - [ ] Update `app/(resident)/portal/(member)/payments/page.tsx`; keep it inside the existing URL-neutral `(member)` route group at `/portal/payments`.
  - [ ] Render one property-scoped section/card per active membership so multiple properties never show a combined global balance.
  - [ ] For permitted properties, show status, current balance, next due date, open assessment due items, recent posted payment history, and an accessible empty state when no posted payments exist.
  - [ ] For `can_view_balance = false`, hide balances, due amounts, assessment line items, and payment history details; show clear resident-facing permission copy.
  - [ ] Gate any pay-dues affordance by `canPayDues`, but do not implement Stripe Checkout, Payment Element, pending payment creation, or payment session server actions in this story.
- [ ] Extend the dashboard payment summary without weakening privacy. (AC: 1, 2)
  - [ ] Update `server/services/auth/resident-dashboard.ts` only if needed to include a compact recent payment signal; preserve its existing scoped property summary behavior.
  - [ ] Update `app/(resident)/portal/(member)/page.tsx` to show a compact recent payment/history summary or a clear link to full history for permitted properties.
  - [ ] Preserve the Story 2.7 date-only handling pattern for `next_due_date` and any assessment due dates.
  - [ ] Keep dashboard data fetching efficient: one active-membership resolution, bounded property/assessment/payment queries, no broad scans, and no N+1 queries for each property.
- [ ] Preserve Epic 3 boundaries for later payment stories. (AC: 1, 2, 3)
  - [ ] Do not create resident Stripe sessions; Story 3.3 owns that.
  - [ ] Do not create guest lookup/session behavior; Stories 3.4 and 3.5 own those.
  - [ ] Do not process Stripe webhooks, allocate payments, send receipt emails, or update balances from payments; Stories 3.6 and 3.7 own those.
  - [ ] Do not build admin payment records/manual payments; Story 3.8 owns that.
  - [ ] Keep any seeded/manual payment rows for tests as static history fixtures only if needed, not a manual recording workflow.
- [ ] Extend verification. (AC: 1, 2, 3)
  - [ ] Add `tests/resident-dues-status.test.mjs`.
  - [ ] Test the payment schema migration, constraints, indexes, RLS enablement, resident assessment read policy, and no resident access to payment events.
  - [ ] Test the resident dues service is server-only, reuses `getResidentPortalMemberships()`, scopes by authorized property IDs and community IDs, and maps `canViewBalance` before returning financial fields.
  - [ ] Test the payments page renders dues status/history for permitted memberships, permission-aware copy for `can_view_balance = false`, and a polished empty state for no payment history.
  - [ ] Test the dashboard preserves existing dues summary behavior and does not leak payment history when balance viewing is disabled.
  - [ ] Test privacy exclusions: no raw account number, owner display name, public payment code, guest contact info, Stripe customer/session/payment intent/charge IDs, payment event payload, raw Supabase error, private document, message, service-role, or unrelated property data.
  - [ ] Run `npm test`, `npm run typecheck`, `npm run lint`, `npm run build`, and `git diff --check`.

## Dev Notes

Story 3.2 is the resident read side of the dues and payments area. Story 3.1 created assessment cycle/property assessment management and property balance summary recalculation, but those assessment tables currently expose reads only to assessment managers. This story should add the resident-safe read path for linked property dues and payment history while keeping all financial data property-scoped, permission-gated, and privacy-safe.

The central discipline: residents may see financial data only for active linked properties where their membership permits balance viewing. Build the read model now and leave money movement to later stories. Do not let "payment history" pull the implementation into Stripe session creation, webhook processing, payment allocation mutation, receipt email, guest payment, or admin manual payment workflows.

### Current Files To Update

- `app/(resident)/portal/(member)/payments/page.tsx`
  - Current state: server component that calls `getResidentPortalMemberships()`, filters by `canPayDues`, and lists payable memberships with address and masked account number.
  - Change: call the new resident dues/payment read service and render a real property-scoped dues status, due items, payment history, permission-aware hidden state, and empty history state.
  - Preserve: member route group, server component shape, masked account numbers only, privacy-safe copy, no raw internal errors, and no Stripe/session behavior.
- `app/(resident)/portal/(member)/page.tsx`
  - Current state: Story 2.7 dashboard showing property-aware dues status, current balance, next due date, last payment, pay-dues link, announcements, and events.
  - Change: add only a compact recent payment/history signal if needed to satisfy dashboard payment summary ACs. Keep the full history in `/portal/payments`.
  - Preserve: date-only parsing via `DATE_ONLY_PATTERN`, `Date.UTC(year, month - 1, day, 12)`, `canViewBalance` gates, and `canPayDues` gates.
- `server/services/auth/resident-dashboard.ts`
  - Current state: server-only service that reuses active memberships, queries `properties` by authorized IDs and community IDs, and maps balance/status/date fields only when `canViewBalance` is true.
  - Change: optional bounded recent payment data. If added, use the same permission and scoping rules as the new payments service.
  - Preserve: no raw account, owner, unrelated property, raw errors, or service-role access.
- `server/services/auth/property-memberships.ts`
  - Current state: server-only active-membership resolver selecting safe property fields and permission booleans, masking `account_number`, and avoiding balance/payment history fields.
  - Change: usually none. Reuse it rather than widening it with payment history.
  - Preserve: active-only membership/property filters, masked account numbers, and permission booleans as the authorization input.
- `supabase/migrations/202605110001_create_assessment_cycles_and_assessments.sql`
  - Current state: assessment schema, manager read policies, audited RPC write path, and property summary recalculation helper from Story 3.1.
  - Change: do not rewrite unless unavoidable. Prefer a new follow-up migration that adds resident read policy for assessments.
  - Preserve: read-only manager policies and RPC-only writes for assessment mutations.
- `server/services/payments/assessment-management.ts`
  - Current state: admin assessment management write service using `admin.assessments.manage`, Supabase RPCs, typed privacy-safe mutation outcomes, validation, and audit intent.
  - Change: none expected. Do not reuse this write service for resident reads.
- `tests/resident-dashboard-summary.test.mjs` and `tests/resident-property-detail.test.mjs`
  - Current state: guardrails for dashboard/property permission gates, privacy boundaries, and date-only formatting.
  - Change: preserve and add companion resident dues tests rather than diluting existing tests.

### New Files Likely Needed

- `supabase/migrations/202605110002_create_payment_records_and_resident_financial_reads.sql`
  - Payment table foundation, resident-safe payment/assessment read policies, indexes, and constraints.
- `server/services/payments/resident-dues.ts`
  - Server-only resident financial read service for property dues status, open assessments, and posted payment history.
- `tests/resident-dues-status.test.mjs`
  - Focused guardrails for resident dues read schema, service behavior, UI states, permission gates, and privacy exclusions.
- `components/resident/resident-payments-view.tsx`
  - Optional server-rendered presentational component if the payments page becomes too large. Keep it as a server component unless client interactivity is truly needed.

### Resident Dues Data Contract

Implement a small typed contract similar to:

```ts
type ResidentDuesResult =
  | {
      kind: "resident-dues";
      profile: CurrentProfile;
      properties: ResidentDuesProperty[];
    }
  | { kind: "unauthenticated" }
  | { kind: "profile-unavailable"; message: string }
  | { kind: "no-active-membership"; message: string }
  | { kind: "dues-unavailable"; message: string };

type ResidentDuesProperty = {
  membershipId: string;
  propertyId: string;
  communityId: string;
  addressLine1: string;
  addressLine2: string | null;
  city: string;
  state: string;
  postalCode: string;
  maskedAccountNumber: string;
  relationship: string;
  canViewBalance: boolean;
  canPayDues: boolean;
  duesStatus: "current" | "due_soon" | "overdue" | "delinquent" | "lien_review" | "disputed" | "unavailable";
  currentBalanceCents: number | null;
  nextDueDate: string | null;
  lastPaymentAt: string | null;
  openAssessments: ResidentAssessmentSummary[];
  paymentHistory: ResidentPaymentSummary[];
};

type ResidentAssessmentSummary = {
  id: string;
  description: string;
  type: "regular_dues" | "special_assessment" | "late_fee" | "interest" | "fine" | "damage_assessment" | "manual_adjustment";
  amountCents: number;
  paidCents: number;
  balanceCents: number;
  dueDate: string;
  status: "open" | "partially_paid" | "overdue" | "disputed";
};

type ResidentPaymentSummary = {
  id: string;
  amountCents: number;
  currency: "USD";
  method: "card" | "ach" | "check" | "cash" | "manual" | "other";
  status: "succeeded" | "refunded" | "partially_refunded";
  payerType: "resident" | "guest" | "admin_recorded";
  paidAt: string | null;
  receiptNumber: string | null;
};
```

Rules:

- `propertyId`, `communityId`, assessment IDs, and payment IDs are acceptable inside server-returned typed data, React keys, and route params, but do not render raw IDs as page content.
- `currentBalanceCents`, `nextDueDate`, `lastPaymentAt`, `openAssessments`, and `paymentHistory` must be `null`/empty or hidden when `canViewBalance` is false.
- Show posted payment history only. For this story, exclude `created`, `pending`, `failed`, and `void` records from resident history unless a later payment session story explicitly adds "your pending payment" UI.
- Do not display guest payer name, guest email, guest phone, raw property account snapshot, property address snapshot, Stripe IDs, processor fee internals, net amount, or payment event details to residents.
- Store and compute all money as integer cents. Format USD only at the UI boundary.
- Format date-only `due_date` values without timezone drift. Reuse the Story 2.7/2.8 pattern of anchoring `YYYY-MM-DD` values before formatting in `America/New_York`.

### Payment Table Data Model

Use the Postgres-oriented data model from `docs/bmad/phase-3-design/data-model.md` as the source of truth, adapted to the existing migration style:

```sql
create table public.payments (
  id uuid primary key default gen_random_uuid(),
  community_id uuid not null references public.communities(id) on delete cascade,
  property_id uuid not null references public.properties(id),
  payer_type text not null check (payer_type in ('resident', 'guest', 'admin_recorded')),
  profile_id uuid references public.profiles(id),
  guest_name text,
  guest_email citext,
  guest_phone text,
  property_account_snapshot text not null,
  property_address_snapshot text not null,
  amount_cents integer not null check (amount_cents > 0),
  currency text not null default 'USD' check (currency = 'USD'),
  fee_policy text not null check (fee_policy in ('payer_pays', 'hoa_pays')),
  processor_fee_cents integer,
  net_amount_cents integer,
  method text not null check (method in ('card', 'ach', 'check', 'cash', 'manual', 'other')),
  status text not null default 'created'
    check (status in ('created', 'pending', 'succeeded', 'failed', 'refunded', 'partially_refunded', 'void')),
  stripe_checkout_session_id text unique,
  stripe_payment_intent_id text unique,
  stripe_charge_id text,
  stripe_customer_id text,
  stripe_receipt_url text,
  receipt_number text unique,
  paid_at timestamptz,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
```

Create the related tables now so later payment session and webhook stories do not invent a second model, but keep them inert for resident UI:

```sql
create table public.payment_allocations (
  id uuid primary key default gen_random_uuid(),
  community_id uuid not null references public.communities(id) on delete cascade,
  payment_id uuid not null references public.payments(id) on delete cascade,
  assessment_id uuid not null references public.assessments(id),
  amount_cents integer not null check (amount_cents > 0),
  created_at timestamptz not null default now(),
  unique (payment_id, assessment_id)
);

create table public.payment_events (
  id uuid primary key default gen_random_uuid(),
  community_id uuid references public.communities(id),
  payment_id uuid references public.payments(id),
  provider text not null default 'stripe',
  provider_event_id text not null,
  event_type text not null,
  received_at timestamptz not null default now(),
  processed_at timestamptz,
  processing_status text not null default 'received'
    check (processing_status in ('received', 'processed', 'failed', 'ignored')),
  error text,
  payload_hash text,
  unique (provider, provider_event_id)
);
```

- `payment_allocations` links `payments` to `assessments`; no allocation mutation behavior belongs in this story.
- `payment_events` stores future Stripe webhook event IDs and processing status; no webhook handling belongs in this story.
- Add indexes: `payments(community_id, property_id, created_at desc)`, `payments(community_id, profile_id, created_at desc)`, `payments(community_id, status, created_at desc)`, `payment_allocations(community_id, assessment_id)`, and `payment_events(processing_status, received_at desc)`.

### RLS Requirements

- Enable RLS on `payments`, `payment_allocations`, and `payment_events`.
- Resident `payments` select policy must require:
  - authenticated user,
  - active profile via `app.current_profile_id()`,
  - active `property_memberships` row for the same `community_id` and `property_id`,
  - `property_memberships.can_view_balance = true`,
  - active, non-deleted property.
- Resident `assessments` select policy must use the same active linked property and `can_view_balance` requirements.
- If adding resident access to `payment_allocations`, scope through an accessible posted payment and assessment. Otherwise leave allocations unreadable to residents for now.
- Do not add resident insert/update/delete policies on any financial table.
- Do not add public/guest select policies. Guest payment privacy is handled by dedicated server flows later and must never expose balance/history.
- Keep admin payment-management permissions for Story 3.8 unless a minimal read-only policy is needed by existing tests. Do not seed broad admin payment behavior here.

### Scope Boundary

In scope:

- Payment records schema foundation needed to display future history.
- Resident-safe assessment read policy for active linked properties with `can_view_balance`.
- Resident-safe payment history read policy for active linked properties with `can_view_balance`.
- Server-only resident dues/payment read service.
- `/portal/payments` resident dues and history view.
- Compact dashboard payment-history signal or link while preserving existing dashboard summary.
- Permission-aware hidden state and empty history state.
- Guardrail tests.

Out of scope:

- Stripe Checkout, Stripe Payment Element, Checkout Session creation, PaymentIntent creation, and payment session actions.
- Guest payment lookup/session flows.
- Stripe webhook processing, payment allocation mutation, webhook idempotency handling, and receipt email sending.
- Admin payment records UI, manual payment recording, refunds, reconciliation, and admin payment permissions.
- Persistent audit log viewer.
- Legal notices, lien automation, fine/suspension workflows, and delinquency reports beyond reading existing assessment status.
- Broad co-member data exposure, raw account numbers, public payment codes, owner names, mailing addresses, guest contact details, raw payment processor details, private documents, or messages.

### Technical Requirements

- Use Next.js App Router server components for `/portal/payments` and server-only modules for data access.
- Use existing Supabase SSR server client from `lib/supabase/server.ts`; do not read cookies directly in new services.
- Reuse `getResidentPortalMemberships()` once as the authenticated profile and active membership source.
- Query with membership-derived constraints: `property.id in (...)`, `community_id in (...)`, `status = active`, and `deleted_at is null`.
- Map every property, assessment, and payment row back to the matching active membership using both `community_id` and `property_id`.
- Keep a bounded history list, such as most recent 10 posted payments per property, unless the UI includes explicit pagination.
- Keep all unavailable/denied states generic. Do not distinguish "property exists but not linked" from "not found" in visible copy.
- Do not add dependencies.
- Keep `server/services/payments/assessment-management.ts` as admin mutation code only; resident reads should have a separate service.

### Architecture Compliance

- Follow layered authorization: authenticated user, active profile, community/property scope, active membership, membership permission, then financial read.
- Use `community_id` everywhere even though Spring Meadow is currently a single-community deployment.
- RLS is defense in depth, not a replacement for explicit server-side scoping.
- Financial table writes must stay trusted and audited. This story adds resident reads, not resident writes.
- Guest payment flows remain isolated from authenticated resident flows and never show balance/history.
- Do not expose service-role keys or use service-role clients in resident-facing code.

### UX and Accessibility Requirements

- The payments page should feel like a resident portal work surface: compact, scannable, and property-scoped.
- Do not create a marketing hero, decorative imagery, nested cards, or implementation-status explanations.
- Use one `h1`, clear section headings, compact labels, and stable responsive grids/tables that work at 320px and wider.
- Cards should use `rounded-sm` or an equivalent radius no larger than 8px.
- Do not put cards inside cards.
- Tables/lists must remain keyboard and screen-reader friendly; use semantic table markup for payment history if tabular data is shown.
- Do not rely on color alone for due/payment status; pair status color with visible text.
- Empty states should be polished and resident-facing, with no mention of missing database rows, Supabase, Stripe internals, or future implementation details.
- Permission-hidden states should explain that balance and payment details are unavailable for that membership without implying records exist.

### Library / Framework Requirements

- Current local stack from `package.json`: Next.js `^16.0.0`, React `^19.0.0`, TypeScript `^5.0.0`, Tailwind CSS `^4.0.0`, `@supabase/ssr` `^0.10.3`, and `@supabase/supabase-js` `^2.105.3`.
- Next.js App Router pages are Server Components by default and are appropriate for server-side data reads.
- Next.js Server Functions/Actions are POST-reachable server functions and must verify authorization internally. This story should not need new actions unless an explicit mutation appears, which would be a scope smell.
- Supabase JavaScript filters should be chained after `select()` and before awaiting the query.
- Supabase RLS must be enabled on raw-SQL tables in exposed schemas such as `public`, with least-privilege policies for `authenticated` users.
- Stripe remains the future payment processor, but this story stores only safe payment record fields. Do not handle raw card/bank details or add Stripe SDK calls here.

### Testing Requirements

- Add `tests/resident-dues-status.test.mjs`.
- Minimum checks:
  - Payment migration exists, creates `payments`, `payment_allocations`, and `payment_events`, and includes money/status/method/payer constraints plus `unique (provider, provider_event_id)`.
  - Migration creates expected indexes and enables RLS on all new payment tables.
  - Migration adds resident read policies for `payments` and `assessments` that require active property membership and `can_view_balance`.
  - Migration does not add resident insert/update/delete policies for financial tables.
  - Migration does not add public/guest select policies or resident `payment_events` read policies.
  - Resident dues service includes `import "server-only"`, calls `getResidentPortalMemberships()`, uses `createClient()` from `lib/supabase/server.ts`, and scopes reads by authorized property IDs and community IDs.
  - Service maps `canViewBalance` before returning `currentBalanceCents`, due items, and `paymentHistory`.
  - Service does not return or select raw account number, owner display name, public payment code, guest email/phone, Stripe IDs, processor event payloads, raw Supabase errors, private documents, message contents, or service-role imports.
  - Payments page imports/uses the resident dues service and renders dues status, balance, due dates, payment history, permission-hidden copy, and empty history copy.
  - Dashboard retains Story 2.7 privacy/date behavior and does not show history when `canViewBalance` is false.
  - Existing test suite remains intact.
- Required verification commands:
  - `npm test`
  - `npm run typecheck`
  - `npm run lint`
  - `npm run build`
  - `git diff --check`

### Previous Story Intelligence

- Story 2.3 created `properties` and `property_memberships`, active-only property RLS, masked account number handling, and the `can_view_balance`/`can_pay_dues` permission booleans used here.
- Story 2.5 created role/profile-role tables, `hasPermission()`, permission-gated RPC patterns, and audit intent. Do not call role mutation helpers for resident dues reads.
- Story 2.7 created `getResidentDashboardSummary()` and the `/portal` dashboard. It established the pattern for active membership reuse, property/community scoped reads, `canViewBalance` gates, `canPayDues` gates, generic errors, and date-only formatting. Its review fixed date-only display by anchoring `YYYY-MM-DD` values before New York formatting.
- Story 2.8 created `getResidentPropertyDetails()` and property detail UI. Its review fixed a linked member email fallback leak; do not add any guest/resident contact fallback in payment history.
- Story 3.1 created assessment cycle/property assessment schema, audited admin mutation RPCs, `admin.assessments.manage`, manager read policies, and property balance summary recalculation. It intentionally left resident dues status/history UI and payment tables out of scope.
- Story 3.1 review removed direct manager write policies on assessment tables. Preserve RPC-only assessment writes and add resident read-only policies separately.
- The worktree contains many uncommitted Epic 1, Epic 2, and Story 3.1 files. Do not revert unrelated files.
- No `project-context.md` file was found during story creation.

### Current Local Technical Information

- `app/(resident)/portal/(member)/payments/page.tsx` is still a placeholder that filters only `canPayDues`; it does not show balances, due items, or history.
- `app/(resident)/portal/(member)/page.tsx` already shows property-aware dashboard dues summary and should be extended carefully, not replaced.
- `server/services/auth/resident-dashboard.ts` and `server/services/auth/resident-property-detail.ts` are good local patterns for resident-facing read services.
- `supabase/migrations/202605110001_create_assessment_cycles_and_assessments.sql` currently enables RLS on `assessment_cycles` and `assessments`, with select policies only for `admin.assessments.manage`.
- `server/services/payments/assessment-management.ts` is admin mutation code and intentionally does not use `.from("properties")`, `.from("assessments")`, or `.from("assessment_cycles")` directly.
- Existing tests are fast Node `node:test` file-content guardrails and do not import TypeScript modules directly.

### Latest Technical Information

- Next.js App Router pages are Server Components by default; they are suitable for database reads that must keep credentials and query logic server-side. Source: https://nextjs.org/docs/app/getting-started/server-and-client-components
- Next.js data fetching docs note that Server Components can safely query databases on the server, but authentication and authorization still need to be enforced. Source: https://nextjs.org/docs/app/getting-started/fetching-data
- Next.js Server Functions/Actions are reachable by direct POST requests and must verify authentication and authorization inside each function. This reinforces keeping Story 3.2 read-only and leaving payment mutations to later stories. Source: https://nextjs.org/docs/app/getting-started/mutating-data
- Supabase RLS docs say RLS should be enabled on exposed-schema tables created with raw SQL, and policies determine what `authenticated` users can read or write. Source: https://supabase.com/docs/guides/database/postgres/row-level-security
- Supabase JS docs show filters chained on `select()` queries and support filtering on referenced tables. Source: https://supabase.com/docs/reference/javascript/using-filters
- Stripe Checkout Sessions are created on the server and redirect or embed Stripe-controlled UI, but no Checkout Session creation belongs in this story. Source: https://docs.stripe.com/payments/checkout-sessions

### Project Context Reference

- No `project-context.md` file was found.

### References

- [Epics: Story 3.2](/home/smount/Websites/SpringMeadowCommunity/_bmad-output/planning-artifacts/epics.md)
- [Architecture: Property-Centered Design and Payments](/home/smount/Websites/SpringMeadowCommunity/docs/bmad/phase-2-architecture/architecture.md)
- [API Design: Payments API and Payment History](/home/smount/Websites/SpringMeadowCommunity/docs/bmad/phase-3-design/api.md)
- [Data Model: Properties, Assessments, and Payments](/home/smount/Websites/SpringMeadowCommunity/docs/bmad/phase-3-design/data-model.md)
- [Tasks v1: Resident Payments and Payment Tables](/home/smount/Websites/SpringMeadowCommunity/docs/bmad/phase-4-tasks/tasks-v1.md)
- [Compliance Notes: Assessment Calendar and Resident Dues Reminders](/home/smount/Websites/SpringMeadowCommunity/_bmad-output/planning-artifacts/compliance-calendar-and-warning-emails.md)
- [Previous Story 2.7](/home/smount/Websites/SpringMeadowCommunity/_bmad-output/implementation-artifacts/2-7-resident-dashboard-summary.md)
- [Previous Story 2.8](/home/smount/Websites/SpringMeadowCommunity/_bmad-output/implementation-artifacts/2-8-resident-property-detail-view.md)
- [Previous Story 3.1](/home/smount/Websites/SpringMeadowCommunity/_bmad-output/implementation-artifacts/3-1-assessment-cycle-and-property-assessment-management.md)

## Dev Agent Record

### Agent Model Used

### Debug Log References

### Completion Notes List

- Ultimate context engine analysis completed - comprehensive developer guide created.

### File List

### Change Log

- 2026-05-11: Created Story 3.2 context for resident dues status and payment history.
