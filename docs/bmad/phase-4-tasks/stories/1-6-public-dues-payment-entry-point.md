# Story 1.6: Public Dues Payment Entry Point

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a guest payer,
I want a public Pay Dues entry point,
so that I can start a privacy-safe payment flow without seeing private account details.

## Acceptance Criteria

1. Given guest payments are enabled for the community, when a visitor selects Pay Dues from the public website, then they are routed to the guest payment lookup entry point, and the public website does not display balance, owner name, resident contact data, payment history, or private documents.
2. Given guest payments are disabled by community settings, when a visitor selects Pay Dues, then the site displays the configured public payment guidance or contact path, and no private property data is exposed.
3. Given the visitor uses keyboard navigation or a mobile device, when they access the Pay Dues entry point, then the control is reachable, clearly labeled, and does not overflow its layout.

## Tasks / Subtasks

- [x] Replace the public Pay Dues placeholder with a real public payment entry page. (AC: 1, 2, 3)
  - [x] Update `app/(public)/pay-dues/page.tsx` so it no longer renders `PlaceholderPage`.
  - [x] Keep the route inside the existing `(public)` route group so it retains `PublicNav`.
  - [x] Add a page-level `h1`, concise public payment guidance, and clear primary/secondary actions.
  - [x] Do not show or imply private account balance, owner identity, resident contact data, private documents, or payment history.
- [x] Add public-safe payment entry configuration. (AC: 1, 2)
  - [x] Add a small module such as `lib/public/payments.ts` for public payment entry settings, copy, route constants, and enabled/disabled state helpers.
  - [x] Model the current story with static/config-driven settings because database-backed `community_settings` and payment settings administration are later stories.
  - [x] Include a single source of truth for guest-payment enabled state and disabled guidance.
  - [x] Keep the enabled state easy to swap later for `community_settings.guest_payments_enabled`.
- [x] Add a guest payment lookup entry surface without implementing payment processing. (AC: 1, 3)
  - [x] Create the public-facing lookup entry page or section that the `/pay-dues` page routes to when guest payments are enabled. A route such as `app/(public)/pay-dues/lookup/page.tsx` is acceptable if it stays in the public shell.
  - [x] Collect only privacy-safe starting fields needed for later guest lookup, such as address line 1, postal code, account number, or public payment code.
  - [x] Make the lookup form visibly disabled, non-submitting, or explicitly staged if the real lookup/API is not implemented in this story.
  - [x] Do not create a real property lookup, Stripe checkout session, database query, or payment record in this story.
- [x] Handle guest payments disabled state. (AC: 2, 3)
  - [x] When the static/config helper says guest payments are disabled, render configured public guidance and a contact path instead of routing to a lookup/payment flow.
  - [x] Keep disabled-state copy generic and privacy-safe; it must not reveal whether a property, account number, payment code, balance, or resident exists.
  - [x] Use an accessible link or button to `/contact` for payment questions when online guest payments are unavailable.
- [x] Preserve accessibility, responsive layout, and public-data boundaries. (AC: 1, 2, 3)
  - [x] Ensure all controls and links are keyboard reachable with visible focus states.
  - [x] Use semantic headings, labels, `aria-describedby` where helper text is needed, and avoid relying on color alone.
  - [x] Keep button/link text stable on mobile and prevent text overflow or overlapping at narrow widths.
  - [x] Do not import Supabase clients, auth helpers, resident/property/board/admin services, payment services, document services, private queries, or Stripe SDK code.
- [x] Extend verification. (AC: 1, 2, 3)
  - [x] Extend `tests/public-shell.test.mjs` or add focused Node tests for Pay Dues placeholder replacement, enabled/disabled payment entry behavior, public-safe lookup fields, contact fallback, accessibility markers, route placement, and private-data guardrails.
  - [x] Add tests or guardrails proving public payment entry files do not include private account data, owner/resident data, balance/payment-history data, private document references, Stripe session creation, Supabase queries, or real payment mutation endpoints.
  - [x] Run `npm test`, `npm run typecheck`, `npm run lint`, and `npm run build`.
  - [x] Manually inspect the Pay Dues entry and lookup/disabled states on desktop and mobile for reachable controls and non-overlapping text.

### Review Findings

- [x] [Review][Patch] Disabled payment state has the wrong accessible link name [app/(public)/pay-dues/page.tsx:44]

## Dev Notes

Story 1.6 builds on the completed public shell and the public-safe static/config-driven patterns from Stories 1.1 through 1.5. The `/pay-dues` route already exists in `app/(public)/pay-dues/page.tsx`, but it currently renders the generic placeholder component. This story turns it into a real public entry point while intentionally stopping short of the full guest payment lookup, Stripe Checkout session, webhook, payment record, and receipt workflow owned by Epic 3.

The main implementation trap is overbuilding. Story 1.6 is an entry point and privacy-safe handoff surface. Do not implement actual guest property lookup or Stripe payment creation here unless the later dependencies already exist before development starts.

### Current Files To Update

- `app/(public)/pay-dues/page.tsx`
  - Current state: renders `PlaceholderPage` with title `Pay Dues`.
  - This story changes it into the real public Pay Dues entry page.
  - Preserve: route path `/pay-dues` and public layout/navigation inherited from `app/(public)/layout.tsx`.
- `tests/public-shell.test.mjs`
  - Current state: lightweight Node file-content tests covering the public shell, public routes, home/about content, announcements, events, contact form, public/private import guardrails, and privacy-safe copy.
  - This story should extend the same test style unless a better local test pattern is introduced.
- `lib/public/navigation.ts`
  - Current state: includes `{ label: "Pay Dues", href: "/pay-dues" }`.
  - This story should not need to change the nav label or href.
- `components/public/public-nav.tsx`
  - Current state: renders public navigation for desktop and mobile, with keyboard-operable mobile menu behavior.
  - This story should not need to modify it.
- `lib/public/community-content.ts`
  - Current state: home/about entry-point cards already include Pay Dues linking to `/pay-dues`.
  - This story should preserve that route and not add private payment details to community content.

### New Files Likely Needed

- `lib/public/payments.ts`
  - Public-safe payment entry configuration, labels, copy, route constants, enabled/disabled helper, and future-facing shape for guest payment settings.
- `app/(public)/pay-dues/lookup/page.tsx`
  - Optional but recommended if the enabled state routes to a distinct privacy-safe lookup entry.
- `components/public/payment-entry-form.tsx` or `components/public/guest-payment-lookup-entry.tsx`
  - Optional presentational/client component only if it reduces page complexity or is needed for disabled/staged form controls. Keep it public-only.

### Scope Boundary

In scope:

- Replace the `/pay-dues` placeholder with a real public page.
- Add static/config-driven public payment entry settings.
- Route enabled guest payers toward a privacy-safe lookup entry page or staged lookup section.
- Render disabled-state payment guidance and contact fallback.
- Preserve keyboard/mobile accessibility and privacy-safe content boundaries.
- Add guardrail tests.

Out of scope:

- Real property lookup against Supabase or any database.
- Creating `POST /api/guest-payments/create-session`.
- Creating Stripe Checkout Sessions, Payment Intents, or pending payment records.
- Processing Stripe webhooks or receipts.
- Showing balances, dues status, owner names, resident details, payment history, private documents, account existence, or property existence.
- Admin payment settings screens or database migrations for `community_settings`.

### Future API Contract To Respect

The API design reserves the real guest payment session for Epic 3:

```http
POST /api/guest-payments/create-session
```

Future request shape:

```ts
{
  communitySlug: string
  propertyLookup: {
    addressLine1?: string
    postalCode?: string
    accountNumber?: string
    publicPaymentCode?: string
  }
  payer: {
    name?: string
    email: string
    phone?: string
  }
  amountCents: number
  methodPreference?: "card" | "ach"
  turnstileToken: string
}
```

Future success shape:

```ts
{
  checkoutUrl: string
  confirmation: "payment_session_created"
}
```

Story 1.6 may mirror the starting lookup field names and route direction, but it must not implement this route or return a checkout URL. Later Epic 3 stories own Turnstile-protected lookup, payment amount, Stripe session creation, webhook-confirmed payment state, and receipt-only confirmation.

### Technical Requirements

- Use Next.js + TypeScript App Router and the existing Tailwind CSS setup.
- Keep `/pay-dues` inside `app/(public)`; do not move it to `(auth)`, `(resident)`, `(guest-payment)`, or a route group that loses the public shell.
- Prefer Server Components for static entry and disabled-state rendering. Use a Client Component only if interactive staged form behavior truly needs client state.
- Use a small public module for settings/copy instead of hardcoding everything directly into the page.
- The current package set has only Next, React, TypeScript, and Tailwind. Do not add Stripe, form, schema, or database packages for this story.
- If a static enabled/disabled flag is introduced, name it clearly as a temporary public entry setting and keep it easy to replace with `community_settings.guest_payments_enabled`.
- Do not introduce server actions, route handlers, payment SDK wrappers, API routes, database calls, or environment-variable-dependent payment behavior in this story.
- Do not add a `route.ts` at the same segment level as a `page.tsx`.

### Architecture Compliance

- Public visitors may read only public content and public entry points.
- Guest payment flows must be isolated from authenticated resident account flows.
- Guest payment flows must never show full property profile, dues balance, documents, owner/resident identity, or payment history.
- Stripe-hosted payment flows are the long-term architecture, but this story must not create payment sessions.
- Cloudflare Turnstile is required for real guest payment mutation flows later. If this story renders a staged lookup form without submission, it may mention the later protected step but must not pretend bot protection or payment processing is complete.
- Core records are future community-scoped. Static public settings should preserve `communitySlug` or community naming where useful without pretending to load private community settings.
- The product should remain future multi-HOA ready; avoid hardcoding Spring Meadow-specific payment rules beyond public-facing brand copy and current placeholder configuration.

### UX and Accessibility Requirements

- Use one page-level `h1`.
- Primary action should be clearly labeled, such as `Start guest payment lookup`, and route to the staged lookup entry when enabled.
- Disabled-state action should clearly route to `/contact`, such as `Contact the HOA about dues`.
- Use button/link styling that matches existing public pages and remains readable on mobile.
- If lookup fields are shown, every field needs a visible label and helper text explaining that the public page cannot display balances or account details.
- If a form is staged/non-submitting, make that state explicit and accessible. Do not create a fake successful payment path.
- Avoid visible instructional text that explains implementation details, internal feature flags, private workflow names, or later story numbers.
- Keep all copy privacy-safe. It is fine to say the public site cannot display private account details; it is not fine to reveal whether any specific account or property exists.

### Testing Requirements

- Extend the existing Node file-content tests rather than adding broad E2E infrastructure.
- Minimum checks:
  - `app/(public)/pay-dues/page.tsx` no longer renders `PlaceholderPage`.
  - `/pay-dues` remains inside the public route group and public navigation still points to it.
  - A public payment settings/helper module exists, such as `lib/public/payments.ts`.
  - Enabled-state copy or helper routes to a guest lookup entry route/section.
  - Disabled-state copy or helper routes to `/contact`.
  - Lookup entry fields, if rendered, include only public-safe starting fields and do not submit to a real payment API.
  - Pay Dues page and payment helper files do not import `@/server/services`, `@/server/queries`, Supabase clients, auth helpers, resident/property/board/admin services, document services, or Stripe SDK code.
  - Pay Dues page and payment helper files do not include private display terms such as owner name, dues balance, payment history, private documents, resident contact data, board-only/admin-only workflow, or private account details as data to render.
  - No `POST /api/guest-payments/create-session` route is added in this story.
- Required verification commands:
  - `npm test`
  - `npm run typecheck`
  - `npm run lint`
  - `npm run build`

### Previous Story Intelligence

- Story 1.1 established the public route group and `PublicNav`. A review finding moved `/login` into `(public)` after it dropped the public shell. Keep `/pay-dues` and any lookup entry inside `(public)`.
- Story 1.2 added real public home/about pages, shared static public content, a reusable empty-state component, and file-content tests. It intentionally left Story 1.6 as the owner of dues entry behavior.
- Story 1.3 added static public listing helpers plus privacy guardrails. Its review removed private-looking fixture data. Do not include private-looking payment fixture IDs, property examples, account examples, owner labels, balance fields, or hidden workflow paths.
- Story 1.4 added public events with deterministic helpers and public/private import guardrails. Continue the pattern of small public modules and focused Node tests.
- Story 1.5 introduced the first public mutation endpoint and Turnstile helper, but Story 1.6 should not copy that mutation pattern yet. Real guest payment mutation endpoints belong in Epic 3.
- Story 1.5 code review found and fixed a production-safe delivery boundary: do not report success for a workflow that does not really deliver/store data. Apply the same principle here: do not pretend a guest payment or lookup has been processed.
- Existing tests are fast Node tests; they intentionally use file-content guardrails rather than importing TypeScript modules directly.
- The project currently has no `project-context.md`.

### Latest Technical Information

- Next.js Route Handlers are defined as `route.ts` files inside `app` and support methods such as `POST`, but a `route.ts` cannot coexist at the same route segment level as a `page.tsx`. This story should not need a route handler.
- Stripe Checkout Sessions are created on the server and can return a hosted checkout URL for redirect-based payment. That belongs to Epic 3, not this entry-point story.
- Cloudflare Turnstile still requires server-side Siteverify validation for real protected submissions. Tokens can be forged, expire after five minutes, and are single-use, so a future payment mutation must validate server-side.
- Current package versions use `next` `^16.0.0`, React `^19.0.0`, TypeScript `^5.0.0`, and Tailwind `^4.0.0`.
- Tailwind v4 is configured through `@tailwindcss/postcss` and `@import "tailwindcss";`; do not add Tailwind v3-style config unless a real need appears.

### Project Context Reference

- No `project-context.md` file was found.

### References

- [Epics: Story 1.6](/home/smount/Websites/SpringMeadowCommunity/docs/bmad/phase-4-tasks/epics.md)
- [Requirements: Guest Payment Privacy](/home/smount/Websites/SpringMeadowCommunity/docs/bmad/phase-1-requirements/requirements.md)
- [Architecture: Guest Payment Access](/home/smount/Websites/SpringMeadowCommunity/docs/bmad/phase-2-architecture/architecture.md)
- [API Design: Guest Payment Session](/home/smount/Websites/SpringMeadowCommunity/docs/bmad/phase-3-design/api.md)
- [Data Model: Community Settings and Guest Lookup](/home/smount/Websites/SpringMeadowCommunity/docs/bmad/phase-3-design/data-model.md)
- [Tasks v1: Guest Payment Lookup and Session](/home/smount/Websites/SpringMeadowCommunity/docs/bmad/phase-4-tasks/tasks-v1.md)
- [Previous Story 1.5](/home/smount/Websites/SpringMeadowCommunity/docs/bmad/phase-4-tasks/stories/1-5-public-contact-form-with-bot-protection.md)
- Next.js Route Handlers: https://nextjs.org/docs/app/api-reference/file-conventions/route
- Stripe Checkout Sessions: https://docs.stripe.com/api/checkout/sessions
- Cloudflare Turnstile Server-Side Validation: https://developers.cloudflare.com/turnstile/get-started/server-side-validation/

## Dev Agent Record

### Agent Model Used

GPT-5 Codex

### Debug Log References

- 2026-05-07: Red phase confirmed with `npm test` failing before `lib/public/payments.ts` and `/pay-dues/lookup` existed and before `/pay-dues` placeholder was replaced.
- 2026-05-07: Green/refactor validation passed with `npm test`, `npm run typecheck`, `npm run lint`, and `npm run build`.
- 2026-05-07: Render smoke check passed by serving the production build on port 3055 and fetching `/pay-dues` and `/pay-dues/lookup`; output included public nav, primary/contact actions, staged lookup fields, and no real payment mutation route.

### Completion Notes List

- Ultimate context engine analysis completed - comprehensive developer guide created.
- Replaced the `/pay-dues` placeholder with a public dues entry page that remains in the public shell.
- Added static public payment settings and route helpers for enabled and disabled guest-payment states.
- Added a staged `/pay-dues/lookup` page with public-safe lookup fields, associated labels/helper text, disabled non-submitting controls, and contact fallback.
- Extended public shell tests for Pay Dues page replacement, payment settings, staged lookup fields, disabled guidance, and private-data/non-mutating guardrails.
- Resolved code review finding by aligning the primary Pay Dues link accessible name with its dynamic enabled/disabled label.

### File List

- `docs/bmad/phase-4-tasks/stories/1-6-public-dues-payment-entry-point.md`
- `_bmad-output/implementation-artifacts/1-6-public-dues-payment-entry-point.md`
- `app/(public)/pay-dues/page.tsx`
- `app/(public)/pay-dues/lookup/page.tsx`
- `lib/public/payments.ts`
- `tests/public-shell.test.mjs`
- `docs/bmad/phase-4-tasks/sprint-status.yaml`
- `_bmad-output/implementation-artifacts/sprint-status.yaml`

### Change Log

- 2026-05-07: Created Story 1.6 context for public dues payment entry point.
- 2026-05-07: Implemented public dues payment entry point and moved story to review.
- 2026-05-07: Resolved Story 1.6 code review finding.
