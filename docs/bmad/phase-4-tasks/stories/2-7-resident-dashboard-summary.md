# Story 2.7: Resident Dashboard Summary

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a resident,
I want a dashboard showing my dues status, payment action, announcements, and upcoming events,
so that I can quickly understand what needs my attention.

## Acceptance Criteria

1. Given a resident has one active linked property, when the dashboard loads, then it shows that property's dues status, current balance if permitted, next due date if available, pay dues action if permitted, recent announcements, and upcoming events, and the dashboard does not show unrelated property, board-only, admin-only, or vendor-only data.
2. Given a resident has multiple active linked properties, when the dashboard loads, then it presents a property-aware summary or selector, and all dues, payment, announcement, event, document, and message links remain scoped to the selected or listed authorized properties.
3. Given dashboard data is loading, empty, or unavailable, when the page renders, then it displays appropriate loading, empty, or error states, and errors do not reveal internal implementation details or unauthorized record existence.

## Tasks / Subtasks

- [x] Replace the current `/portal` placeholder with a real resident dashboard summary. (AC: 1, 2, 3)
  - [x] Update `app/(resident)/portal/(member)/page.tsx`; keep it as the URL-neutral `(member)` home route for `/portal`.
  - [x] Preserve the member-only shell from Story 2.6 in `app/(resident)/portal/(member)/layout.tsx`; do not recreate `app/(resident)/portal/page.tsx` or `app/(resident)/portal/layout.tsx`.
  - [x] Add `app/(resident)/portal/(member)/loading.tsx` or an equivalent App Router loading boundary if dashboard data fetching can delay first render.
  - [x] Render compact sections for linked properties, dues/payment summary, recent announcements, upcoming events, and quick navigation to documents, payments, my property, and contact board.
  - [x] For one active membership, show a direct summary for that property.
  - [x] For multiple active memberships, show a property-aware list of authorized property summaries rather than a global balance that mixes properties.
  - [x] Keep all dashboard copy privacy-safe and resident-facing; do not mention implementation internals, missing database tables, or Supabase errors.
- [x] Add a server-only resident dashboard summary service. (AC: 1, 2, 3)
  - [x] Add `server/services/auth/resident-dashboard.ts` or an equivalently named server-only service near the existing auth/resident portal services.
  - [x] Reuse `getResidentPortalMemberships()` as the source of authenticated profile and active membership context.
  - [x] Query only authorized property summary fields for active linked properties: `id`, `current_balance_cents`, `next_due_date`, `last_payment_at`, and `delinquency_status`.
  - [x] Scope the property summary query by both authorized `property.id` values and the matching `community_id` values from active memberships; do not assume property IDs alone are the complete future multi-HOA guardrail.
  - [x] Do not select or return `owner_display_name`, raw `account_number`, payment history, private documents, message contents, board/admin-only data, raw Supabase errors, or service-role data.
  - [x] Gate current balance, next due date, and last payment display by `membership.membershipPermissions.canViewBalance`.
  - [x] Gate the pay dues action by `membership.membershipPermissions.canPayDues`.
  - [x] Return typed privacy-safe states for active data, unauthenticated/profile/membership unavailable passthrough, empty content, and dashboard data error.
- [x] Add resident-safe announcement and event summary helpers. (AC: 1, 2, 3)
  - [x] Add `lib/resident/dashboard-content.ts` or an equivalent helper module.
  - [x] Reuse existing public content seeds and filtering patterns from `lib/public/announcements.ts` and `lib/public/events.ts` until the Epic 4 database-backed content service exists.
  - [x] Do not surface the current resident-only seed bodies verbatim if they contain implementation-facing placeholder text; provide resident-safe summaries/copy in the new helper.
  - [x] Include only `public` and `resident` visibility content for the resident dashboard.
  - [x] Exclude `board`, `admin`, `property_specific`, archived, draft, expired, cancelled, and completed items unless a later story explicitly adds authorized property-specific content.
  - [x] Limit dashboard lists to a small number of recent/current announcements and upcoming scheduled events.
  - [x] Do not change public announcement/event helpers in a way that makes resident-only content appear on public pages.
- [x] Preserve existing portal navigation, invitation, property, and permission behavior. (AC: 1, 2, 3)
  - [x] Preserve `app/(resident)/portal/invitations/accept/page.tsx` outside the active-membership-gated route group.
  - [x] Preserve `components/resident/resident-portal-nav.tsx` and `lib/resident/portal-navigation.ts` required labels and hrefs from Story 2.6.
  - [x] Preserve Payments/Documents capability checks in their pages; dashboard links may route to the existing member routes but must not pretend unauthorized property-specific actions are available.
  - [x] Do not add a resident Stripe checkout/session action in this story; that belongs to Epic 3.
  - [x] Do not add assessment, payment, announcement, event, document, or message database migrations in this story.
  - [x] Do not call Story 2.5 role mutation helpers from dashboard code.
- [x] Extend verification. (AC: 1, 2, 3)
  - [x] Add `tests/resident-dashboard-summary.test.mjs`.
  - [x] Test that `/portal` uses the resident dashboard service and no longer only renders the linked-property placeholder.
  - [x] Test that the dashboard service is server-only, reuses `getResidentPortalMemberships()`, queries only authorized property summary fields, and does not select private property/payment/document/message fields.
  - [x] Test that balance/next due/last payment display is controlled by `canViewBalance`, and pay action display is controlled by `canPayDues`.
  - [x] Test that resident dashboard content helpers include only `public` and `resident` visibility announcements/events and exclude board/admin/property-specific/private visibility.
  - [x] Test empty/unavailable/error states use generic copy and do not render raw Supabase errors or unauthorized record existence.
  - [x] Preserve existing Story 2.1 through Story 2.6 guardrails.
  - [x] Run `npm test`, `npm run typecheck`, `npm run lint`, and `npm run build`.

### Review Findings

- [x] [Review][Patch] Date-only next due dates can display one day early [app/(resident)/portal/(member)/page.tsx:22]

## Dev Notes

Story 2.7 is the first real resident dashboard summary on top of the member portal shell created in Story 2.6. The current `/portal` page is still a safe linked-property placeholder. This story should turn that page into a dashboard summary while keeping the same active-membership gate, navigation, privacy posture, and route-group structure.

The central discipline: the dashboard can summarize data already available in the current property model and safe in-memory content seeds, but it must not implement the full Epic 3 payments stack or Epic 4 content database stack. Use the existing property summary fields from `properties` for dues state, and use safe empty/unavailable states where later modules do not exist yet.

### Current Files To Update

- `app/(resident)/portal/(member)/page.tsx`
  - Current state: server component at `/portal` that calls `getResidentPortalMemberships()`, lists active linked properties with address, relationship, masked account number, and quick links to Payments/Documents/My Property.
  - Change: replace the placeholder with dashboard sections for property-aware dues/payment summary, recent announcements, upcoming events, and quick actions.
  - Preserve: server component shape, member-only route group, active-membership dependency, masked account number only, privacy-safe copy, no raw internal errors, and no owner/payment-history/private-document/message exposure.
- `server/services/auth/resident-portal.ts`
  - Current state: tiny server-only cached wrapper around `getCurrentPropertyMemberships()`.
  - Change: usually none. The dashboard service should reuse this helper rather than duplicate active profile and membership resolution.
  - Preserve: `import "server-only"`, `cache()`, and active membership source of truth.
- `server/services/auth/property-memberships.ts`
  - Current state: server-only active-membership resolver selecting safe property fields and membership permission booleans, including `canViewBalance`, `canPayDues`, `canViewDocuments`, and `canInviteMembers`.
  - Change: avoid broadening this shared resolver with sensitive balance fields unless the returned type keeps those fields permission-gated. Prefer a separate dashboard service for balance/status summaries.
  - Preserve: active-only filtering, property status/deleted filters, masked account numbers, and no owner/raw account/payment history details.
- `lib/public/announcements.ts`
  - Current state: typed in-memory announcement seed data and public-only visibility filtering for public pages. Includes public, resident, board, and property-specific sample records.
  - Change: do not weaken public filtering. Resident dashboard content should use a separate helper that may include public and resident visibility for authenticated dashboard display only. The existing resident-only seed body is implementation-facing placeholder copy, so the dashboard must map it to resident-safe copy or avoid rendering its body.
- `lib/public/events.ts`
  - Current state: typed in-memory event seed data and public event filtering for public pages. Includes public, resident, board, and admin sample records.
  - Change: do not weaken public filtering. Resident dashboard content should use a separate helper that may include public and resident visibility for authenticated dashboard display only. The existing resident-only seed description is implementation-facing placeholder copy, so the dashboard must map it to resident-safe copy or avoid rendering its description.
- `tests/resident-portal-navigation.test.mjs`
  - Current state: guardrails for Story 2.6 member route group, resident nav labels/hrefs, mobile nav behavior, route placeholders, invitation route preservation, and privacy boundaries.
  - Change: leave in place and add a companion dashboard summary test rather than diluting the navigation test.

### New Files Likely Needed

- `server/services/auth/resident-dashboard.ts`
  - Server-only dashboard aggregator that reuses `getResidentPortalMemberships()`, queries authorized property summary fields, applies membership permission gates, and returns typed dashboard data.
- `lib/resident/dashboard-content.ts`
  - Resident dashboard helper for recent announcements and upcoming events using current in-memory seed data while preserving public-page filtering boundaries.
- `tests/resident-dashboard-summary.test.mjs`
  - Focused Node guardrails for dashboard data shaping, visibility filtering, permission gates, privacy boundaries, and preservation of existing portal behavior.

### Dashboard Data Contract

Implement a small typed contract similar to:

```ts
type ResidentDashboardResult =
  | { kind: "dashboard"; profile: CurrentProfile; properties: DashboardPropertySummary[]; announcements: DashboardAnnouncement[]; upcomingEvents: DashboardEvent[] }
  | { kind: "unauthenticated" }
  | { kind: "profile-unavailable"; message: string }
  | { kind: "no-active-membership"; message: string }
  | { kind: "dashboard-error"; message: string };

type DashboardPropertySummary = {
  membershipId: string;
  propertyId: string;
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
};
```

Rules:

- `propertyId` and `membershipId` are acceptable inside server-returned typed data and React keys, but do not render raw IDs in the UI.
- `currentBalanceCents`, `nextDueDate`, and `lastPaymentAt` must be `null` when `canViewBalance` is false.
- `duesStatus` should come from `properties.delinquency_status` only for authorized linked properties. If the implementation treats dues status as balance-sensitive, render `unavailable` when `canViewBalance` is false.
- Format money from cents as USD in UI helpers; do not store formatted values in data rows.
- Format dates in `America/New_York` or the local project convention. Avoid timezone surprises for date-only `next_due_date`.

### Scope Boundary

In scope:

- Resident dashboard summary at `/portal`.
- Property-aware dues status display for active linked properties.
- Balance/next due/last payment display only when permitted.
- Pay dues action only when permitted, linking to existing resident payments route.
- Recent dashboard announcements from authenticated-safe public/resident visibility data.
- Upcoming dashboard events from authenticated-safe public/resident visibility data.
- Loading, empty, unavailable, and generic error UI states.
- Guardrail tests.

Out of scope:

- Stripe Checkout or Payment Element.
- Resident payment session server action.
- Payment history.
- Assessment cycles or assessment tables.
- New payment, announcement, event, document, or message migrations.
- Admin/board announcement/event management.
- Property-specific announcement/event targeting beyond already authorized linked property context.
- Document lists, signed URLs, uploads, or document access logs.
- Message thread creation or board inbox.
- Full My Property detail view from Story 2.8.
- Role assignment UI or role mutation fixes.
- Service-role client usage in browser/client code.

### Technical Requirements

- Use Next.js App Router server components for the dashboard page and server-only service modules for data access.
- Keep `components/resident/resident-portal-nav.tsx` as the only client component needed for portal navigation unless dashboard interactivity truly requires another client component.
- If adding a property selector, keep selected-property behavior accessible and ensure it never expands the data set beyond active authorized memberships. A property-aware list is simpler and satisfies the story without extra client state.
- Use existing Supabase SSR server client from `lib/supabase/server.ts`; do not read cookies directly in new services.
- Use the current `properties` fields already present in `supabase/migrations/202605100001_create_properties_and_memberships.sql`: `current_balance_cents`, `last_payment_at`, `next_due_date`, and `delinquency_status`.
- Query with authorized membership-derived constraints, such as `property.id in (...)`, `community_id in (...)`, `status = active`, and `deleted_at is null`; then map rows back to the matching active membership before returning data.
- If a Supabase query fails, return a generic dashboard-unavailable state. Do not render `error.message`.
- Keep the dashboard efficient for a 200-home HOA: one membership resolution, one property summary query for authorized IDs, small in-memory content filtering, and small list limits.
- Do not add new dependencies.

### Architecture Compliance

- Follow the layered authorization order from the architecture/API docs: authenticated user, active profile, community/property scope, role permission where relevant, property membership, then workflow-specific checks.
- Active property membership remains the resident portal entry gate for `/portal`.
- RLS remains defense in depth. Dashboard server services must still explicitly scope property summary queries to active linked membership property IDs.
- Public, resident, board/admin, and vendor visibility boundaries must remain separate. The dashboard may show public and resident content, but never board/admin/vendor-only content.
- Guest payment privacy rules are not directly implemented here, but do not route residents through guest lookup for authenticated pay-dues actions.

### UX and Accessibility Requirements

- The dashboard should feel like an operational portal: compact, scannable, and action-oriented.
- Do not create a marketing hero, decorative imagery, nested card layout, or explanatory in-app text about implementation status.
- Use stable responsive layouts for property summaries, dashboard cards, and action links so content does not overlap or resize unpredictably at 320px and wider.
- Keep cards at `rounded-sm` or an equivalent radius no larger than 8px.
- Do not put cards inside cards.
- Use headings in a sensible hierarchy: one `h1`, section `h2`s, and compact labels.
- Ensure all links/buttons are keyboard reachable and use the existing `focus-visible:outline` pattern.
- Do not rely on color alone for dues status; pair status color with visible text.
- Empty and unavailable states should be clear and resident-friendly without revealing whether hidden records exist.

### Library / Framework Requirements

- Current local stack from `package.json`: Next.js `^16.0.0`, React `^19.0.0`, TypeScript `^5.0.0`, Tailwind CSS `^4.0.0`, `@supabase/ssr` `^0.10.3`, and `@supabase/supabase-js` `^2.105.3`.
- Next.js route groups are URL-neutral, so `(member)` must not appear in the URL and must not conflict with a duplicate `/portal` page.
- Next.js `usePathname()` remains a client component hook; keep pathname-dependent active nav behavior in `ResidentPortalNav`.
- Next.js 16 uses `proxy.ts`; keep request-time proxy focused on session refresh/presence and leave dashboard authorization/data checks in server services.
- Supabase SSR server code should use the existing cookie-aware server client utility. Server Components cannot write cookies directly, so session refresh belongs in `proxy.ts`.
- Supabase RLS policies should continue to use authenticated-user policies as defense in depth; do not bypass them for dashboard reads.

### Testing Requirements

- Add `tests/resident-dashboard-summary.test.mjs`.
- Minimum checks:
  - `app/(resident)/portal/(member)/page.tsx` imports/uses the resident dashboard summary service.
  - Dashboard page renders "Dues status", "Pay dues", "Announcements", and "Upcoming events" or equivalent resident-facing headings/actions.
  - Dashboard route includes a loading boundary or equivalent explicit loading state.
  - Dashboard service includes `import "server-only"`, calls `getResidentPortalMemberships()`, and queries `properties` only for active linked property IDs.
  - Dashboard service scopes property summary queries by membership-derived property IDs and `community_id`, and preserves `status = active` plus `deleted_at is null` filtering.
  - Dashboard service selects `current_balance_cents`, `next_due_date`, `last_payment_at`, and `delinquency_status`.
  - Dashboard service gates balance/due-date/payment timestamp output by `canViewBalance`.
  - Dashboard page gates pay dues action by `canPayDues`.
  - Dashboard content helper includes only public/resident announcement and event visibility for dashboard lists.
  - Dashboard content helper excludes board/admin/vendor/property-specific visibility and inactive lifecycle states.
  - Dashboard content helper does not render implementation-facing seed phrases such as "belong in later authenticated portal work" or "belong in later resident experiences".
  - Dashboard page/service do not render or select `owner_display_name`, raw `account_number`, payment history, private documents, message contents, board/admin-only data, raw Supabase errors, or service-role imports.
  - Existing tests remain intact:
    - `tests/auth-session.test.mjs`
    - `tests/profile-resolution.test.mjs`
    - `tests/property-membership.test.mjs`
    - `tests/property-invitation.test.mjs`
    - `tests/role-permission.test.mjs`
    - `tests/resident-portal-navigation.test.mjs`
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
- Story 2.5 added roles and permissions plus server-only role mutation helpers. Dashboard display should not depend on role mutations.
- Story 2.6 created the URL-neutral member route group, resident portal nav, safe placeholder section pages, and `server/services/auth/resident-portal.ts`.
- Existing tests are fast Node `node:test` file-content guardrails and do not import TypeScript modules directly.
- The worktree contains many uncommitted Epic 1 and Epic 2 changes. Do not revert unrelated files.
- No `project-context.md` file was found.

### Current Local Technical Information

- `app/(resident)/portal/(member)/layout.tsx` gates member portal routes through `getResidentPortalMemberships()` and renders `ResidentPortalNav`.
- `app/(resident)/portal/(member)/page.tsx` currently renders a linked-property placeholder and quick links.
- `app/(resident)/portal/(member)/payments/page.tsx` already gates payment access with `membership.membershipPermissions.canPayDues`.
- `app/(resident)/portal/(member)/documents/page.tsx` already gates document access with `membership.membershipPermissions.canViewDocuments`.
- `components/resident/resident-portal-nav.tsx` is the client component using `usePathname`, mobile open/closed state, `aria-expanded`, `aria-controls`, Escape handling, `aria-current`, `break-words`, and focus-visible styles.
- `lib/public/announcements.ts` and `lib/public/events.ts` intentionally include non-public sample records to prove public pages filter them out. Dashboard helpers must preserve that public boundary.

### Latest Technical Information

- Next.js App Router remains the project routing model; route groups organize files and are not included in the URL path. Avoid duplicate route groups resolving to the same `/portal` path. Source: https://nextjs.org/docs/15/app/api-reference/file-conventions/route-groups
- `usePathname()` is a client component hook. Keep it isolated to the resident navigation client component and keep the dashboard page server-rendered unless dashboard-specific interactivity is necessary. Source: https://nextjs.org/docs/app/api-reference/functions/use-pathname
- Starting with Next.js 16, request middleware is named Proxy. The project already uses `proxy.ts`; do not add `middleware.ts`. Source: https://nextjs.org/docs/app/getting-started/proxy
- Supabase SSR for Next.js uses separate browser and server clients, with Proxy responsible for refreshing auth tokens/cookies. Continue using the existing project utilities. Source: https://supabase.com/docs/guides/auth/server-side/creating-a-client
- Supabase recommends RLS on exposed-schema tables and policies scoped to authenticated users as defense in depth. Dashboard queries should still explicitly scope by linked property IDs. Source: https://supabase.com/docs/guides/database/postgres/row-level-security

### Project Context Reference

- No `project-context.md` file was found.

### References

- [Epics: Story 2.7](/home/smount/Websites/SpringMeadowCommunity/_bmad-output/planning-artifacts/epics.md)
- [Previous Story 2.6](/home/smount/Websites/SpringMeadowCommunity/_bmad-output/implementation-artifacts/2-6-resident-portal-layout-and-navigation.md)
- [Previous Story 2.5](/home/smount/Websites/SpringMeadowCommunity/_bmad-output/implementation-artifacts/2-5-role-and-permission-assignment-foundation.md)
- [Requirements: Resident Dashboard](/home/smount/Websites/SpringMeadowCommunity/docs/bmad/phase-1-requirements/requirements.md)
- [Architecture: Resident Access and Payments](/home/smount/Websites/SpringMeadowCommunity/docs/bmad/phase-2-architecture/architecture.md)
- [API Design: Resident Dashboard](/home/smount/Websites/SpringMeadowCommunity/docs/bmad/phase-3-design/api.md)
- [Data Model: Properties and Property Memberships](/home/smount/Websites/SpringMeadowCommunity/docs/bmad/phase-3-design/data-model.md)
- [Data Model: Announcements and Events](/home/smount/Websites/SpringMeadowCommunity/docs/bmad/phase-3-design/data-model.md)
- [Tasks v1: Resident Dashboard](/home/smount/Websites/SpringMeadowCommunity/docs/bmad/phase-4-tasks/tasks-v1.md)

## Dev Agent Record

### Agent Model Used

GPT-5 Codex

### Debug Log References

- 2026-05-11: Red phase confirmed `tests/resident-dashboard-summary.test.mjs` failed before the dashboard loading boundary, server dashboard service, and resident content helper existed.
- 2026-05-11: Verification passed with `npm test`, `npm run typecheck`, `npm run lint`, and `npm run build`.

### Implementation Plan

- Add a server-only resident dashboard service that reuses active membership context, queries scoped property summary fields, and applies balance/pay permission gates.
- Add resident dashboard content helpers that reuse current public seed data while allowing only public/resident visibility and mapping implementation-facing resident seed copy to resident-safe summaries.
- Replace the `/portal` placeholder with a compact dashboard summary page plus a loading boundary.
- Extend Node guardrails for dashboard summary behavior and update the older membership guardrail for the new dashboard home.

### Completion Notes List

- Ultimate context engine analysis completed - comprehensive developer guide created.
- Implemented `getResidentDashboardSummary()` with active membership reuse, community/property scoped property summary reads, generic error states, and `canViewBalance`/`canPayDues` gates.
- Added resident-safe dashboard announcement and event helpers that keep public filtering intact and avoid exposing non-resident visibility content.
- Replaced the `/portal` linked-property placeholder with a resident dashboard showing dues status, permitted balance/date details, pay-dues action, announcements, upcoming events, and quick actions.
- Added an App Router loading state for the resident dashboard.
- Added Story 2.7 guardrail tests and updated the existing property-membership guardrail for the dashboard home.

### File List

- `_bmad-output/implementation-artifacts/2-7-resident-dashboard-summary.md`
- `docs/bmad/phase-4-tasks/stories/2-7-resident-dashboard-summary.md`
- `_bmad-output/implementation-artifacts/sprint-status.yaml`
- `docs/bmad/phase-4-tasks/sprint-status.yaml`
- `app/(resident)/portal/(member)/page.tsx`
- `app/(resident)/portal/(member)/loading.tsx`
- `lib/resident/dashboard-content.ts`
- `server/services/auth/resident-dashboard.ts`
- `tests/resident-dashboard-summary.test.mjs`
- `tests/property-membership.test.mjs`

### Change Log

- 2026-05-11: Created Story 2.7 context for resident dashboard summary.
- 2026-05-11: Implemented resident dashboard summary, scoped dashboard service, resident content helpers, loading state, and verification guardrails.
