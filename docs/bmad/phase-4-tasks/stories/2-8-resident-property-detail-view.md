# Story 2.8: Resident Property Detail View

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a resident,
I want to view authorized details for my linked property,
so that I can confirm the account and membership information the HOA has on file.

## Acceptance Criteria

1. Given a resident has active membership for a property, when they open My Property, then they see authorized property details such as address, masked account number, membership relationship, and linked member summary according to permissions, and sensitive fields not intended for residents are hidden.
2. Given a resident attempts to open a property they are not linked to, when the property detail request is made, then the request is denied, and the response does not confirm whether the property exists.
3. Given a membership permission such as `can_view_balance`, `can_pay_dues`, `can_view_documents`, or `can_invite_members` is disabled, when the property detail view renders, then related actions or fields are omitted or disabled, and the explanation is clear without exposing restricted data.

## Tasks / Subtasks

- [x] Replace the current My Property placeholder with a real property detail experience. (AC: 1, 2, 3)
  - [x] Update `app/(resident)/portal/(member)/my-property/page.tsx`; keep it inside the existing URL-neutral `(member)` route group.
  - [x] Keep the top-level `/portal/my-property` route useful for one or multiple active linked properties.
  - [x] For multiple active memberships, render a property-aware list of authorized property detail cards rather than a global detail panel that mixes data.
  - [x] Add or reuse a detail route such as `app/(resident)/portal/(member)/my-property/[propertyId]/page.tsx` if direct property detail URLs are needed to satisfy unauthorized-request handling.
  - [x] Do not create `app/(resident)/portal/my-property/page.tsx` outside `(member)` or duplicate a route that resolves to the same URL.
- [x] Add a server-only resident property detail service. (AC: 1, 2, 3)
  - [x] Add `server/services/auth/resident-property-detail.ts` or an equivalently named server-only service near the existing auth/resident portal services.
  - [x] Reuse `getResidentPortalMemberships()` as the source of authenticated profile, active membership context, masked account number, and membership permission booleans.
  - [x] Accept an optional requested `propertyId` for direct detail requests; if the requested ID is not already present in active memberships, return a generic unavailable/not-found state before querying `properties`.
  - [x] Query only authorized property detail fields for active linked properties: `id`, `community_id`, `address_line1`, `address_line2`, `city`, `state`, `postal_code`, `county`, `lot_number`, `parcel_number`, `plat_reference`, `current_balance_cents`, `next_due_date`, `last_payment_at`, and `delinquency_status`.
  - [x] Scope property detail queries by both membership-derived `property.id` values and matching `community_id` values; keep `status = active` and `deleted_at is null` filters.
  - [x] Do not select or return `owner_display_name`, raw `account_number`, `public_payment_code`, `mailing_address`, payment history, private documents, message contents, invitation token data, raw Supabase errors, or service-role data.
  - [x] Gate balance, next due date, last payment, and dues status by `membership.membershipPermissions.canViewBalance`.
  - [x] Gate pay-dues links by `membership.membershipPermissions.canPayDues`, document links by `canViewDocuments`, and invite/member-management actions by `canInviteMembers`.
  - [x] Return typed privacy-safe states for active detail data, unauthenticated/profile/membership unavailable passthrough, unauthorized property requests, empty detail data, and property detail errors.
- [x] Implement resident-safe linked member summary behavior. (AC: 1, 3)
  - [x] Treat the currently authenticated resident's active property membership as the minimum linked member summary.
  - [x] Do not broaden `property_memberships` RLS or use a service-role client just to list other linked residents in this story.
  - [x] If showing other linked members is possible through an existing safe policy or future RPC, display only active members' resident-safe display name and relationship; never show email, phone, auth user IDs, profile IDs, removed/suspended members, invitation records, or permission internals.
  - [x] If other linked members are not available under the current policies, render a privacy-safe summary such as "Your active membership is linked to this property" and reserve member management for a later authorized workflow.
- [x] Preserve existing portal navigation, dashboard, payment, and document behavior. (AC: 1, 2, 3)
  - [x] Preserve the active-membership gate in `app/(resident)/portal/(member)/layout.tsx`.
  - [x] Preserve `components/resident/resident-portal-nav.tsx` and `lib/resident/portal-navigation.ts` labels and hrefs from Story 2.6.
  - [x] Preserve the Story 2.7 dashboard service and date-only handling; do not move dashboard data fetching into the property detail page.
  - [x] Preserve existing payment/document permission checks in their pages; My Property may link to those routes only when permitted.
  - [x] Do not add Stripe checkout, payment history, document listing/signed URL, message thread, invitation creation, or role mutation behavior in this story.
- [x] Extend verification. (AC: 1, 2, 3)
  - [x] Add `tests/resident-property-detail.test.mjs`.
  - [x] Test that `/portal/my-property` uses the resident property detail service and no longer only renders the simple placeholder.
  - [x] Test that any direct property detail route denies unauthorized property IDs with generic copy and does not query unlinked property records first.
  - [x] Test that the service is server-only, reuses `getResidentPortalMemberships()`, scopes queries by membership-derived property IDs and community IDs, and preserves active/deleted filters.
  - [x] Test that only safe property detail fields are selected and raw/private fields are not selected or rendered.
  - [x] Test that `canViewBalance`, `canPayDues`, `canViewDocuments`, and `canInviteMembers` control related fields/actions.
  - [x] Test that linked member summary behavior does not expose other residents' email, phone, IDs, permissions, invitation token data, suspended/removed memberships, or service-role imports.
  - [x] Preserve existing Story 2.1 through Story 2.7 guardrails.
  - [x] Run `npm test`, `npm run typecheck`, `npm run lint`, and `npm run build`.

### Review Findings

- [x] [Review][Patch] Linked member summary can expose profile email fallback [server/services/auth/resident-property-detail.ts:124]

## Dev Notes

Story 2.8 upgrades the resident `My Property` placeholder created in Story 2.6. The page already lives at `app/(resident)/portal/(member)/my-property/page.tsx` and currently renders each active membership from `getResidentPortalMemberships()` with address, relationship, and masked account number. This story should deepen that into a property detail experience while keeping the same member-only route group, active-membership gate, privacy posture, and permission model.

The central discipline: property detail data is still resident-facing account/membership confirmation, not a board/admin property record. Use the current property and membership tables. Do not implement payment history, document lists, messaging, invitation creation, admin editing, or full member management here.

### Current Files To Update

- `app/(resident)/portal/(member)/my-property/page.tsx`
  - Current state: server component that calls `getResidentPortalMemberships()` directly and lists active linked properties with address, relationship, and masked account number.
  - Change: call a server-only property detail service, render richer authorized property detail cards, permission-aware actions/fields, and generic unavailable states.
  - Preserve: server component shape, `(member)` route group, no client state unless unavoidable, masked account number only, no raw internal errors, and no private board/admin/payment/document/message exposure.
- `app/(resident)/portal/(member)/my-property/[propertyId]/page.tsx`
  - Current state: does not exist.
  - Possible change: add only if direct property detail URLs are useful. The route must call the same service with the requested property ID and return generic unavailable/not-found behavior for unlinked IDs without confirming existence.
- `server/services/auth/resident-portal.ts`
  - Current state: cached server-only wrapper around `getCurrentPropertyMemberships()`.
  - Change: usually none. The detail service should reuse this helper rather than duplicate active profile and membership resolution.
  - Preserve: `import "server-only"`, `cache()`, and active membership source of truth.
- `server/services/auth/property-memberships.ts`
  - Current state: server-only active-membership resolver selecting safe property fields and permission booleans. It masks `account_number` and does not return balance or private owner/payment/document/message fields.
  - Change: avoid broadening this shared resolver unless the returned type remains safe for every current caller. Prefer a separate property detail service for story-specific data.
  - Preserve: active-only filtering, property status/deleted filters, masked account numbers, and no owner/raw account/payment history details.
- `server/services/auth/resident-dashboard.ts`
  - Current state: Story 2.7 server-only dashboard service with scoped property summary reads and balance/pay permission gates.
  - Change: none expected. Use it as a pattern for scoped property reads, generic error states, and permission-gated fields.
  - Preserve: date-only handling remains in the dashboard page; do not regress Story 2.7.
- `tests/resident-portal-navigation.test.mjs`
  - Current state: guardrails for route group, nav labels/hrefs, member pages, and existing My Property privacy boundaries.
  - Change: update only if needed to reflect the new property detail service while preserving existing navigation expectations.

### New Files Likely Needed

- `server/services/auth/resident-property-detail.ts`
  - Server-only property detail aggregator that reuses active membership context, scopes property detail queries by authorized memberships and communities, applies permission gates, and returns typed privacy-safe states.
- `app/(resident)/portal/(member)/my-property/[propertyId]/page.tsx`
  - Optional direct detail route for a single property. Use only if it improves the implementation; keep unauthorized IDs generic.
- `tests/resident-property-detail.test.mjs`
  - Focused Node guardrails for detail data shaping, unauthorized direct requests, permission gates, privacy boundaries, and preservation of existing portal behavior.

### Property Detail Data Contract

Implement a small typed contract similar to:

```ts
type ResidentPropertyDetailResult =
  | {
      kind: "property-details";
      profile: CurrentProfile;
      properties: ResidentPropertyDetail[];
    }
  | { kind: "unauthenticated" }
  | { kind: "profile-unavailable"; message: string }
  | { kind: "no-active-membership"; message: string }
  | { kind: "property-unavailable"; message: string }
  | { kind: "property-detail-error"; message: string };

type ResidentPropertyDetail = {
  membershipId: string;
  propertyId: string;
  addressLine1: string;
  addressLine2: string | null;
  city: string;
  state: string;
  postalCode: string;
  county: string | null;
  lotNumber: string | null;
  parcelNumber: string | null;
  platReference: string | null;
  maskedAccountNumber: string;
  relationship: string;
  canViewBalance: boolean;
  canPayDues: boolean;
  canViewDocuments: boolean;
  canInviteMembers: boolean;
  duesStatus: "current" | "due_soon" | "overdue" | "delinquent" | "lien_review" | "disputed" | "unavailable";
  currentBalanceCents: number | null;
  nextDueDate: string | null;
  lastPaymentAt: string | null;
  linkedMemberSummary: {
    currentResidentRelationship: string;
    memberManagementAvailable: boolean;
    displayMembers: { displayName: string; relationship: string }[];
  };
};
```

Rules:

- `propertyId` and `membershipId` are acceptable inside server-returned typed data, React keys, and route params, but do not render raw IDs as page content.
- Use `membership.property.maskedAccountNumber`; do not query or render raw `account_number`.
- `currentBalanceCents`, `nextDueDate`, `lastPaymentAt`, and balance-sensitive `duesStatus` must be `null`/`unavailable` when `canViewBalance` is false.
- Format money from cents as USD in UI helpers; do not store formatted values in data rows.
- Format date-only `next_due_date` without timezone drift. Reuse the Story 2.7 pattern of detecting `YYYY-MM-DD` and anchoring safely before formatting in `America/New_York`.
- Keep all unavailable and denied states generic. Do not distinguish "not found" from "not linked" in user-visible copy.

### Scope Boundary

In scope:

- Resident My Property detail view at `/portal/my-property`.
- Optional direct authorized property detail route under `/portal/my-property/[propertyId]`.
- Property-aware detail cards for one or multiple active memberships.
- Resident-safe account/property fields: address, masked account number, relationship, county, lot number, parcel number, plat reference.
- Permission-aware dues summary, payment link, documents link, and invite/member-management availability.
- Linked member summary limited to safe current membership context unless existing policies safely support more.
- Loading/unavailable/generic denied states if the route can delay or receive an unauthorized direct request.
- Guardrail tests.

Out of scope:

- Raw account numbers, public payment codes, owner display names, mailing addresses, email/phone exposure, auth user IDs, profile IDs, and permission internals in UI.
- Payment history, Stripe checkout/session actions, assessment cycles, manual payments, and payment allocation data.
- Document listing, signed URLs, uploads, or document access logs.
- Message thread creation or board inbox.
- Invitation creation, invitation token listing, member removal, or full member management.
- Admin/board property editing.
- New broad `property_memberships` RLS policies that expose all co-member rows to residents.
- Service-role client usage in browser/client code or resident-facing server services.

### Technical Requirements

- Use Next.js App Router server components for the My Property page and server-only service modules for data access.
- Keep `components/resident/resident-portal-nav.tsx` as the only client component needed for portal navigation unless property detail interactivity truly requires another client component.
- Use existing Supabase SSR server client from `lib/supabase/server.ts`; do not read cookies directly in new services.
- Reuse `getResidentPortalMemberships()` once as the authenticated profile and active membership source.
- If `requestedPropertyId` is provided, validate it against active membership property IDs before querying `properties`; this prevents unauthorized requests from probing record existence.
- Query authorized property details with membership-derived constraints such as `id in (...)`, `community_id in (...)`, `status = active`, and `deleted_at is null`.
- Map rows back to the matching active membership using both `community_id` and `property.id`.
- If a Supabase query fails or returns no authorized rows, return a generic property-unavailable/detail-error state. Do not render `error.message`.
- Keep the page efficient for a 200-home HOA: one membership resolution, one property detail query for authorized IDs, no N+1 property queries, and no broad member scans.
- Do not add dependencies.

### Architecture Compliance

- Follow the layered authorization order from the architecture/API docs: authenticated user, active profile, community/property scope, role permission where relevant, property membership, then workflow-specific checks.
- Active property membership remains the resident portal entry gate for `/portal/*`.
- RLS remains defense in depth. Property detail server services must still explicitly scope by active linked membership property IDs.
- Community scope must remain in every HOA-specific query, even for the first single-HOA deployment.
- Guest payment privacy rules are not directly implemented here, but My Property must not expose fields that guest payer flows are forbidden to see.
- Public, resident, board/admin, vendor, document, and message data boundaries must remain separate.

### UX and Accessibility Requirements

- The detail view should feel like an operational resident portal: compact, scannable, and action-oriented.
- Do not create a marketing hero, decorative imagery, nested card layout, or explanatory in-app text about implementation status.
- Keep cards at `rounded-sm` or an equivalent radius no larger than 8px.
- Do not put cards inside cards.
- Use one `h1`, section `h2`s, compact labels, and stable responsive grids so content does not overlap at 320px and wider.
- Ensure all links/buttons are keyboard reachable and use the existing `focus-visible:outline` pattern.
- Do not rely on color alone for permission or dues status; pair status color with visible text.
- Disabled/unavailable permission states should be clear and resident-friendly without revealing whether hidden records exist.
- For multiple properties, each card must make property scope obvious before showing related actions.

### Library / Framework Requirements

- Current local stack from `package.json`: Next.js `^16.0.0`, React `^19.0.0`, TypeScript `^5.0.0`, Tailwind CSS `^4.0.0`, `@supabase/ssr` `^0.10.3`, and `@supabase/supabase-js` `^2.105.3`.
- Next.js route groups are URL-neutral; keep `(member)` out of the URL and avoid duplicate routes resolving to the same path.
- `usePathname()` is a client component hook. Keep pathname-dependent active nav behavior isolated to `ResidentPortalNav`.
- Next.js 16 uses `proxy.ts`; do not add `middleware.ts`.
- Supabase SSR server code should use the existing cookie-aware server client utility. Server Components cannot write cookies directly, so session refresh belongs in `proxy.ts`.
- Supabase RLS policies should continue to use authenticated-user policies as defense in depth; do not bypass them for resident property detail reads.

### Testing Requirements

- Add `tests/resident-property-detail.test.mjs`.
- Minimum checks:
  - `app/(resident)/portal/(member)/my-property/page.tsx` imports/uses the resident property detail service.
  - Optional `app/(resident)/portal/(member)/my-property/[propertyId]/page.tsx` uses the same service with route params and generic unauthorized handling.
  - Service includes `import "server-only"`, calls `getResidentPortalMemberships()`, and validates requested property IDs against active memberships before property queries.
  - Service queries `properties` only by active linked property IDs plus matching `community_id`, with `status = active` and `deleted_at is null`.
  - Service selects safe fields only and does not select `owner_display_name`, raw `account_number`, `public_payment_code`, `mailing_address`, payment history, private documents, message contents, invitation token data, raw Supabase errors, or service-role imports.
  - Balance/date/status output is controlled by `canViewBalance`.
  - Pay/document/invite actions are controlled by `canPayDues`, `canViewDocuments`, and `canInviteMembers`.
  - Date-only `next_due_date` display avoids timezone drift.
  - Linked member summary does not expose email, phone, auth/profile IDs, permission internals, invitation records, suspended/removed memberships, or broad co-member data.
  - Existing tests remain intact:
    - `tests/auth-session.test.mjs`
    - `tests/profile-resolution.test.mjs`
    - `tests/property-membership.test.mjs`
    - `tests/property-invitation.test.mjs`
    - `tests/role-permission.test.mjs`
    - `tests/resident-portal-navigation.test.mjs`
    - `tests/resident-dashboard-summary.test.mjs`
    - `tests/public-shell.test.mjs`
- Required verification commands:
  - `npm test`
  - `npm run typecheck`
  - `npm run lint`
  - `npm run build`

### Previous Story Intelligence

- Story 2.1 established `/login`, Supabase SSR helpers, auth callback handling, sign-in/sign-out, protected `/portal` routing, and `proxy.ts`.
- Story 2.2 added `server/services/auth/current-profile.ts`; reuse active profile resolution through existing membership/portal services.
- Story 2.3 added `server/services/auth/property-memberships.ts`, active-only linked property context, masked account numbers, and membership permission booleans.
- Story 2.4 added `app/(resident)/portal/invitations/accept/page.tsx`; keep it outside the member-only layout so invited users without active memberships can accept invitations.
- Story 2.5 added roles and permissions plus server-only role mutation helpers. My Property display should not call role mutation helpers.
- Story 2.6 created the URL-neutral member route group, resident portal nav, safe placeholder section pages, and `server/services/auth/resident-portal.ts`.
- Story 2.7 created `server/services/auth/resident-dashboard.ts`, `lib/resident/dashboard-content.ts`, a `/portal` dashboard, a dashboard loading boundary, and guardrails for permission-gated property summary fields.
- Story 2.7 review fixed date-only `next_due_date` rendering by parsing `YYYY-MM-DD` values without letting New York timezone formatting roll them back a day. Reuse that lesson.
- Existing tests are fast Node `node:test` file-content guardrails and do not import TypeScript modules directly.
- The worktree contains many uncommitted Epic 1 and Epic 2 changes. Do not revert unrelated files.
- No `project-context.md` file was found.

### Current Local Technical Information

- `app/(resident)/portal/(member)/layout.tsx` gates member portal routes through `getResidentPortalMemberships()` and renders `ResidentPortalNav`.
- `app/(resident)/portal/(member)/my-property/page.tsx` is currently a server component that directly calls `getResidentPortalMemberships()` and renders a simple list of active memberships.
- `app/(resident)/portal/(member)/payments/page.tsx` already gates payment access with `membership.membershipPermissions.canPayDues`.
- `app/(resident)/portal/(member)/documents/page.tsx` already gates document access with `membership.membershipPermissions.canViewDocuments`.
- `app/(resident)/portal/(member)/page.tsx` uses Story 2.7 dashboard data and includes date-only parsing guardrails.
- `components/resident/resident-portal-nav.tsx` is the client component using `usePathname`, mobile open/closed state, `aria-expanded`, `aria-controls`, Escape handling, `aria-current`, `break-words`, and focus-visible styles.
- Current property membership RLS allows residents to read their own memberships and active linked properties. It does not safely expose all co-member rows to residents.

### Latest Technical Information

- Next.js App Router route groups organize files without adding the group segment to the URL path. Avoid duplicate groups resolving to the same `/portal/my-property` path. Source: https://nextjs.org/docs/13/app/building-your-application/routing/route-groups
- `usePathname()` is a client component hook. Keep it isolated to the resident navigation client component and keep property detail rendering server-side unless detail-specific interactivity is necessary. Source: https://nextjs.org/docs/app/api-reference/functions/use-pathname
- Supabase SSR for Next.js uses separate browser and server clients, with Proxy responsible for refreshing auth tokens/cookies. Continue using the existing project utilities. Source: https://supabase.com/docs/guides/auth/server-side/creating-a-client
- Supabase recommends RLS on exposed-schema tables and policies scoped to authenticated users as defense in depth. Property detail queries should still explicitly scope by linked property IDs and community IDs. Source: https://supabase.com/docs/guides/database/postgres/row-level-security

### Project Context Reference

- No `project-context.md` file was found.

### References

- [Epics: Story 2.8](/home/smount/Websites/SpringMeadowCommunity/_bmad-output/planning-artifacts/epics.md)
- [Previous Story 2.7](/home/smount/Websites/SpringMeadowCommunity/_bmad-output/implementation-artifacts/2-7-resident-dashboard-summary.md)
- [Previous Story 2.6](/home/smount/Websites/SpringMeadowCommunity/_bmad-output/implementation-artifacts/2-6-resident-portal-layout-and-navigation.md)
- [Requirements: Authentication and Resident Dashboard](/home/smount/Websites/SpringMeadowCommunity/docs/bmad/phase-1-requirements/requirements.md)
- [Architecture: Property Membership and Resident Navigation](/home/smount/Websites/SpringMeadowCommunity/docs/bmad/phase-2-architecture/architecture.md)
- [API Design: Property Details](/home/smount/Websites/SpringMeadowCommunity/docs/bmad/phase-3-design/api.md)
- [Data Model: Properties and Property Memberships](/home/smount/Websites/SpringMeadowCommunity/docs/bmad/phase-3-design/data-model.md)
- [Tasks v1: My Property Page](/home/smount/Websites/SpringMeadowCommunity/docs/bmad/phase-4-tasks/tasks-v1.md)

## Dev Agent Record

### Agent Model Used

GPT-5 Codex

### Debug Log References

- 2026-05-11: Red phase confirmed `tests/resident-property-detail.test.mjs` failed before the property detail service, shared view, and direct property route existed.
- 2026-05-11: Verification passed with `npm test`, `npm run typecheck`, `npm run lint`, and `npm run build`.
- 2026-05-11: Code review patch verification passed with `npm test`, `npm run typecheck`, `npm run lint`, and `npm run build`.

### Implementation Plan

- Add a server-only resident property detail service that reuses active membership context, denies unlinked direct property IDs before querying, and applies permission gates.
- Replace the My Property placeholder with a resident-safe detail view that can render one or multiple authorized properties.
- Add a direct property detail route using the same service for unauthorized-request coverage.
- Extend guardrail tests for property detail behavior and update the older portal navigation guardrail for the new service boundary.

### Completion Notes List

- Ultimate context engine analysis completed - comprehensive developer guide created.
- Implemented `getResidentPropertyDetails()` with active membership reuse, pre-query unlinked-property denial, community/property scoped detail reads, generic unavailable states, and permission-gated balance/action fields.
- Added a reusable resident property detail view with property details, account summary, linked member summary, and permission-aware actions.
- Replaced the `/portal/my-property` placeholder and added `/portal/my-property/[propertyId]` for direct authorized property detail requests.
- Added Story 2.8 guardrail tests and updated the resident portal navigation guardrail for the new property detail service boundary.
- Addressed code review finding by using a generic current-resident linked-member label instead of the profile display name, which can fall back to email.

### File List

- `_bmad-output/implementation-artifacts/2-8-resident-property-detail-view.md`
- `docs/bmad/phase-4-tasks/stories/2-8-resident-property-detail-view.md`
- `_bmad-output/implementation-artifacts/sprint-status.yaml`
- `docs/bmad/phase-4-tasks/sprint-status.yaml`
- `app/(resident)/portal/(member)/my-property/page.tsx`
- `app/(resident)/portal/(member)/my-property/[propertyId]/page.tsx`
- `components/resident/resident-property-detail-view.tsx`
- `server/services/auth/resident-property-detail.ts`
- `tests/resident-property-detail.test.mjs`
- `tests/resident-portal-navigation.test.mjs`

### Change Log

- 2026-05-11: Created Story 2.8 context for resident property detail view.
- 2026-05-11: Implemented resident property detail service, My Property detail UI, direct property route, permission gates, and verification guardrails.
- 2026-05-11: Addressed Story 2.8 code review finding for linked-member email fallback exposure.
