# Story 2.6: Resident Portal Layout and Navigation

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a resident,
I want a clear resident portal layout and navigation,
so that I can move between dashboard, payments, documents, announcements, events, board contact, and property details.

## Acceptance Criteria

1. Given an authenticated resident with an active property membership opens the resident portal, when the layout renders, then the resident sees navigation for Dashboard, Payments, Documents, Announcements, Events, Contact Board, and My Property, and all navigation items are reachable by keyboard.
2. Given a resident uses a small screen, when they open the resident navigation, then the navigation adapts without text overflow or overlap, and the active page remains clear.
3. Given a resident lacks permission for a property-specific capability, when navigation or route guards evaluate the permission, then restricted content is hidden or blocked consistently, and no unrelated private data is rendered.

## Tasks / Subtasks

- [x] Add a member-gated resident portal shell without blocking invitation acceptance. (AC: 1, 2, 3)
  - [x] Refactor the current portal home into a member-only route group, for example `app/(resident)/portal/(member)/page.tsx`.
  - [x] Remove or relocate the original `app/(resident)/portal/page.tsx` after the move so Next.js does not have two pages resolving to `/portal`.
  - [x] Add a member-only layout, for example `app/(resident)/portal/(member)/layout.tsx`, that wraps `/portal`, `/portal/payments`, `/portal/documents`, `/portal/announcements`, `/portal/events`, `/portal/contact-board`, and `/portal/my-property`.
  - [x] Do not add an active-membership-gated `app/(resident)/portal/layout.tsx`, because that would also wrap invitation acceptance routes.
  - [x] Keep `app/(resident)/portal/invitations/accept/page.tsx` outside the member-only route group so invited users without active membership can still accept invitations.
  - [x] Centralize the existing active-profile and active-membership checks in the member-only shell using `getCurrentPropertyMemberships()` or a shared helper built on it, rather than duplicating profile and membership queries in every child page.
  - [x] Preserve unauthenticated redirects to `/login` with a safe `next` value for the requested portal path.
  - [x] Preserve privacy-safe profile-unavailable and no-active-membership states with sign-out access.
- [x] Add resident portal navigation configuration and UI. (AC: 1, 2)
  - [x] Add a resident navigation config, such as `lib/resident/portal-navigation.ts`, with Dashboard, Payments, Documents, Announcements, Events, Contact Board, and My Property labels and stable hrefs.
  - [x] Add a client navigation component, such as `components/resident/resident-portal-nav.tsx`, following the existing `PublicNav` pathname and mobile-toggle pattern.
  - [x] Mark the active route clearly on desktop and mobile without relying on color alone.
  - [x] Ensure all nav links and the mobile menu toggle are keyboard reachable, have visible focus states, and close or remain stable predictably on small screens.
  - [x] Prevent text overflow and layout overlap at 320px and wider viewports.
- [x] Add initial resident portal section routes with safe placeholder content and route guards. (AC: 1, 3)
  - [x] Add `/portal/payments`, `/portal/documents`, `/portal/announcements`, `/portal/events`, `/portal/contact-board`, and `/portal/my-property` pages under the member-only route group.
  - [x] Keep pages useful but minimal: page heading, safe resident context where already available, and clear empty or unavailable state text without implementation jargon.
  - [x] Keep all seven top-level navigation destinations visible for active members; enforce capability restrictions in route/page content so AC1 navigation remains satisfied.
  - [x] Treat Payments as available only when at least one active membership has `membership.membershipPermissions.canPayDues`; otherwise render a generic unavailable state without payment details.
  - [x] Treat Documents as available only when at least one active membership has `membership.membershipPermissions.canViewDocuments`; otherwise render a generic unavailable state without document details.
  - [x] When a resident has multiple active memberships, derive route availability from the full membership list and show only safe eligible-property summaries where needed.
  - [x] Keep Announcements, Events, Contact Board, and My Property free of future private data until later stories add their data services.
  - [x] Do not render owner names, raw account numbers, balances, payment history, private documents, message contents, board/admin-only data, role assignment details, raw Supabase errors, or internal IDs.
- [x] Preserve existing auth, profile, property, invitation, and role behavior. (AC: 1, 2, 3)
  - [x] Preserve `/login`, `server/actions/auth.ts`, Supabase SSR helpers, `proxy.ts`, auth callback handling, and sign-in/sign-out.
  - [x] Preserve `getCurrentProfile()` blocked states from Story 2.2.
  - [x] Preserve `getCurrentPropertyMemberships()` and `canAccessProperty()` active-only behavior from Story 2.3.
  - [x] Preserve `acceptPropertyInvitation()` and the `/portal/invitations/accept` query-token login redirect from Story 2.4.
  - [x] Do not depend on unresolved Story 2.5 role-mutation audit behavior for this UI story.
  - [x] Do not introduce a Supabase service-role client into browser/client code.
- [x] Extend verification. (AC: 1, 2, 3)
  - [x] Add a focused Node guardrail test file, likely `tests/resident-portal-navigation.test.mjs`.
  - [x] Test that all seven required nav labels and hrefs exist.
  - [x] Test that the resident nav is a client component using `usePathname`, active route logic, keyboard/focus classes, and mobile open/closed state.
  - [x] Test that the member-only layout uses current profile and active membership gates.
  - [x] Test that `/portal/invitations/accept` is not moved under the active-membership-gated layout and still preserves token redirects to login.
  - [x] Test that Payments/Documents navigation or route content respects `canPayDues` and `canViewDocuments`.
  - [x] Test that resident portal files do not expose owner names, raw account numbers, balances, payment history, private documents, message contents, board/admin-only data, raw Supabase errors, or service-role imports in browser/client code.
  - [x] Preserve Story 2.1 through 2.5 guardrail tests.
  - [x] Run `npm test`, `npm run typecheck`, `npm run lint`, and `npm run build`.

### Review Findings

- [x] [Review][Patch] Payments/Documents route guards run in client components with serialized membership data [app/(resident)/portal/(member)/layout.tsx:57]

## Dev Notes

Story 2.6 turns the authenticated resident portal from a single gated page into a shared portal shell with navigation and safe section routes. This is layout and routing foundation work only; it must not become the dashboard, payments, documents, messages, or property-detail implementation.

The central discipline: do not break invitation acceptance. Story 2.4 placed `/portal/invitations/accept` under the portal path so unauthenticated users can preserve a token through login and authenticated invited users can activate their first membership. If a new `/portal` layout requires active membership for every child route, invitation acceptance will regress. Use a route group so the member shell applies to member pages only.

### Current Files To Update

- `app/(resident)/portal/page.tsx`
  - Current state: a server component that resolves active profile, redirects unauthenticated users to `/login?next=%2Fportal`, resolves active memberships, renders privacy-safe unavailable states, lists linked properties with masked account numbers and membership permission booleans, and exposes sign-out.
  - Change: move or refactor this content into the member route group home, then remove the old page at this path to avoid a duplicate `/portal` route. The portal home can become a compact dashboard placeholder with linked property context, but it must still avoid dues balances, payment history, private document names, owner names, and messages.
  - Preserve: profile gate, active-membership gate, safe redirects, safe unavailable states, masked account number only, and sign-out.
- `app/(resident)/portal/invitations/accept/page.tsx`
  - Current state: accepts an invitation token server-side, redirects unauthenticated users to login with a token-preserving `next`, renders generic accepted/unavailable states, and links to `/portal` and `/contact`.
  - Change: usually none. If route organization changes, keep this route outside the active-membership-gated layout.
  - Preserve: token parameter handling, safe login redirect, generic errors, and no property/payment/document details.
- `components/public/public-nav.tsx`
  - Current state: client component using `usePathname`, a mobile menu state, Escape handling, active route classes, and focus-visible styles.
  - Change: use as a local pattern for a new resident nav component. Do not import public nav configuration into resident portal navigation.
- `server/services/auth/property-memberships.ts`
  - Current state: server-only resolver returning active memberships with safe property context and `membershipPermissions` booleans: `canViewBalance`, `canPayDues`, `canViewDocuments`, and `canInviteMembers`; includes `canAccessProperty(propertyId)`.
  - Change: reuse it for shell context and property-specific capability checks. Do not add payment/document data queries in this story.
- `server/services/auth/permissions.ts`
  - Current state: server-only role permission helper and role mutation foundation from Story 2.5.
  - Change: if used, only use `hasPermission()` for additive role-based UI checks. Do not use role mutation helpers in this story. Be aware Story 2.5 review found unresolved audit/scope issues in role mutation paths; this story should not rely on those paths.
- Existing tests:
  - Current state: Node `node:test` file-content guardrails cover auth session, profile resolution, property membership, invitation acceptance, and role permission foundation.
  - Change: add a companion resident portal navigation test rather than weakening prior guardrails.

### New Files Likely Needed

- `app/(resident)/portal/(member)/layout.tsx`
  - Server component member shell that gates active profile and active memberships, renders the resident nav, and wraps child pages.
- `app/(resident)/portal/(member)/page.tsx`
  - Portal dashboard placeholder/home route at `/portal`.
- `app/(resident)/portal/(member)/payments/page.tsx`
  - Payments section placeholder or access-blocked state based on `canPayDues`.
- `app/(resident)/portal/(member)/documents/page.tsx`
  - Documents section placeholder or access-blocked state based on `canViewDocuments`.
- `app/(resident)/portal/(member)/announcements/page.tsx`
  - Resident announcements section placeholder without private announcement data until later stories.
- `app/(resident)/portal/(member)/events/page.tsx`
  - Resident events section placeholder without private event data until later stories.
- `app/(resident)/portal/(member)/contact-board/page.tsx`
  - Board contact section placeholder without message-thread persistence until later stories.
- `app/(resident)/portal/(member)/my-property/page.tsx`
  - My Property placeholder using only already-safe membership/property fields until Story 2.8 adds the detail view.
- `components/resident/resident-portal-nav.tsx`
  - Client nav component for desktop and mobile active states.
- `lib/resident/portal-navigation.ts`
  - Stable resident portal nav labels, hrefs, and optional capability keys.
- `tests/resident-portal-navigation.test.mjs`
  - Guardrails for route shell, nav labels, active/mobile behavior, permission-sensitive nav/route blocking, invitation-route preservation, and privacy boundaries.

### Scope Boundary

In scope:

- Shared resident portal shell for member-only routes.
- Required resident portal navigation labels and hrefs.
- Responsive desktop/mobile navigation behavior.
- Active route indication.
- Keyboard-reachable navigation and mobile toggle.
- Placeholder section pages for the required nav destinations.
- Permission-aware hiding or blocking for property-specific Payments and Documents capabilities.
- Privacy-safe page states and guardrail tests.

Out of scope:

- Real resident dashboard cards for dues, announcements, or events.
- Stripe resident payment sessions, payment history, balances, or assessment data.
- Document metadata queries, private storage access, signed document downloads, or document lists.
- Resident message thread creation, persistence, notifications, or board inbox.
- Full My Property detail view beyond currently safe membership/property summary.
- Admin/board workspace navigation.
- New database migrations.
- Role assignment UI or role mutation fixes.
- Service-role client usage.

### Technical Requirements

- Use Next.js App Router route groups to apply the member layout only where active membership is required.
- Keep sensitive checks server-side. Client components may receive only safe nav data, active-path behavior, and coarse capability booleans.
- Use existing Supabase SSR helpers and server services. Do not read cookies directly in new portal components.
- Use `getCurrentPropertyMemberships()` as the member-shell source of truth because it already resolves the active profile and active memberships; only call `getCurrentProfile()` separately if the implementation keeps the current two-step unavailable-state UI.
- For route-level permission blocking, return generic unavailable copy. Do not reveal whether a hidden payment, document, message, or property record exists.
- Derive Payments availability with an `some(...)` check across active memberships for `membership.membershipPermissions.canPayDues`.
- Derive Documents availability with an `some(...)` check across active memberships for `membership.membershipPermissions.canViewDocuments`.
- Use masked account numbers only. Do not display raw `account_number`.
- Keep code TypeScript strict and avoid new dependencies unless a clear local pattern already exists.

### Architecture Compliance

- Follow the layered authorization order from architecture/API docs: authenticated user, active profile, community/property scope, role permission where relevant, property membership, then workflow-specific checks.
- Active property membership remains the resident portal entry gate for member routes.
- Roles are separate from property membership. Do not replace membership permission booleans with role checks in this story.
- RLS and server-side services remain defense in depth; the UI must not depend on client-only hiding for sensitive access.
- Public site, guest payment, and invitation acceptance flows must stay separate from member-only resident portal navigation.

### UX and Accessibility Requirements

- The resident portal should feel like an operational app, not a marketing page: no hero, no decorative imagery, no floating nested card layout.
- Use compact, scannable page structure with stable navigation dimensions.
- Keep cards, if used for individual property summaries or section placeholders, at `rounded-sm` or an equivalent radius no larger than 8px.
- Do not put cards inside cards.
- Keep text sizes appropriate for a portal shell; do not use hero-scale headings inside navigation or compact panels.
- Avoid text overflow with `min-w-0`, `truncate` only where safe, `break-words` where labels must wrap, and responsive grid/flex constraints.
- Ensure all interactive elements meet the existing focus-visible pattern using `var(--gold)` or a locally consistent focus style.
- Mobile navigation must not overlap content, must expose `aria-expanded` and `aria-controls`, and should support Escape if implemented as an expandable menu.
- Active navigation state must be perceivable by more than color alone, such as text weight, border/indicator, `aria-current="page"`, or a clear background plus text change.
- Do not include visible in-app instructions about keyboard shortcuts, implementation details, future architecture, or how the UI works.

### Library / Framework Requirements

- Current project stack from `package.json`: Next.js `^16.0.0`, React `^19.0.0`, TypeScript `^5.0.0`, Tailwind CSS `^4.0.0`, `@supabase/ssr` `^0.10.3`, and `@supabase/supabase-js` `^2.105.3`.
- Next.js 16 uses `proxy.ts`; keep request-time proxy focused on session presence and leave member/permission checks in server layouts/services.
- No icon library is currently installed. Do not add one for this story unless implementation already introduces a broader UI icon dependency.
- Existing tests use `node --test tests/*.test.mjs`; continue that guardrail style unless a stronger harness is introduced before implementation.

### Testing Requirements

- Add `tests/resident-portal-navigation.test.mjs`.
- Minimum checks:
  - Required nav labels: Dashboard, Payments, Documents, Announcements, Events, Contact Board, My Property.
- Required hrefs: `/portal`, `/portal/payments`, `/portal/documents`, `/portal/announcements`, `/portal/events`, `/portal/contact-board`, `/portal/my-property`.
  - Resident nav component is a client component and uses `usePathname` for active state.
  - Mobile nav has open/closed state, `aria-expanded`, `aria-controls`, keyboard/focus-visible handling, and no fixed-width text assumptions.
  - Member layout calls `getCurrentPropertyMemberships()` or a shared helper built on it, and preserves profile-unavailable/no-active-membership states.
  - Member layout redirects unauthenticated users to login with a safe `next` value for the requested path.
  - The implementation does not leave both `app/(resident)/portal/page.tsx` and `app/(resident)/portal/(member)/page.tsx` resolving to `/portal`.
  - Invitation acceptance route remains outside the active-membership-gated shell and preserves token-aware login redirect behavior.
  - Payments/Documents pages aggregate `canPayDues` and `canViewDocuments` across the active membership list and render generic unavailable states when no active membership grants the capability.
  - Portal files avoid private data terms and service-role imports in browser/client code.
- Preserve existing tests:
  - `tests/auth-session.test.mjs`
  - `tests/profile-resolution.test.mjs`
  - `tests/property-membership.test.mjs`
  - `tests/property-invitation.test.mjs`
  - `tests/role-permission.test.mjs`
  - `tests/public-shell.test.mjs`
- Required verification commands:
  - `npm test`
  - `npm run typecheck`
  - `npm run lint`
  - `npm run build`

### Previous Story Intelligence

- Story 2.1 established `/login`, Supabase SSR helpers, auth callback handling, sign-in/sign-out, and protected `/portal` routing through `proxy.ts`.
- Story 2.2 added `server/services/auth/current-profile.ts` and profile-gated portal behavior. Reuse this identity source.
- Story 2.3 added `server/services/auth/property-memberships.ts`, active-only membership resolution, masked account numbers, and membership permission booleans. Use these for member shell context and property-specific nav gating.
- Story 2.4 added `app/(resident)/portal/invitations/accept/page.tsx`. The code review fixed two issues: Supabase RPCs must be exposed through `public`, and login redirects must preserve invitation token query strings.
- Story 2.5 added role and permission foundation, but code review left two unresolved patch findings:
  - Suspend/remove role audit payloads omit target assignment metadata.
  - Community-scoped role assignments can be duplicated with arbitrary scope IDs.
  This story should not call role mutation paths or depend on those issues being resolved.
- Existing tests are fast Node guardrails and do not import TypeScript modules directly.
- Supabase migrations may not have been applied to a live/local database in these sessions; keep portal work server-service and UI focused.
- The worktree contains many uncommitted Epic 1 and Epic 2 changes. Do not revert unrelated files.
- No `project-context.md` file was found.

### Current Local Technical Information

- Use the current local Next.js 16 App Router conventions and `proxy.ts`.
- Continue using the current `@supabase/ssr` server client in `lib/supabase/server.ts`.
- Keep route groups URL-neutral: `(member)` should organize layouts without changing public URLs.
- Server Components can perform the active-profile and active-membership checks before rendering the portal shell.
- Client Components should be limited to navigation interactivity and active pathname display.

### Project Context Reference

- No `project-context.md` file was found.

### References

- [Epics: Story 2.6](/home/smount/Websites/SpringMeadowCommunity/_bmad-output/planning-artifacts/epics.md)
- [Previous Story 2.5](/home/smount/Websites/SpringMeadowCommunity/_bmad-output/implementation-artifacts/2-5-role-and-permission-assignment-foundation.md)
- [Previous Story 2.4](/home/smount/Websites/SpringMeadowCommunity/_bmad-output/implementation-artifacts/2-4-property-invitation-acceptance.md)
- [Architecture: Next.js Application](/home/smount/Websites/SpringMeadowCommunity/docs/bmad/phase-2-architecture/architecture.md)
- [Architecture: Resident Access and Authorization](/home/smount/Websites/SpringMeadowCommunity/docs/bmad/phase-2-architecture/architecture.md)
- [API Design: Cross-Cutting API Requirements](/home/smount/Websites/SpringMeadowCommunity/docs/bmad/phase-3-design/api.md)
- [Data Model: Property Memberships and Roles](/home/smount/Websites/SpringMeadowCommunity/docs/bmad/phase-3-design/data-model.md)
- [Requirements: Resident Dashboard and Navigation](/home/smount/Websites/SpringMeadowCommunity/docs/bmad/phase-1-requirements/requirements.md)

## Dev Agent Record

### Agent Model Used

GPT-5 Codex

### Debug Log References

- 2026-05-11: Red phase confirmed `tests/resident-portal-navigation.test.mjs` failed before the member route group, resident navigation config/component, and section routes existed.
- 2026-05-11: Verification passed with `npm test`, `npm run typecheck`, `npm run lint`, and `npm run build`.

### Implementation Plan

- Move the member portal experience into a URL-neutral `(member)` route group so `/portal/invitations/accept` remains outside active-membership gating.
- Add a server member layout that uses `getCurrentPropertyMemberships()`, preserves privacy-safe unavailable states, and passes safe profile/membership context to client portal pages.
- Add resident navigation config and a keyboard-operable responsive nav component with active route state.
- Add safe placeholder pages for each required resident portal destination, with Payments/Documents capability checks aggregated across active memberships.
- Extend Node guardrails and update existing auth/profile/property tests for the new route-group shape.

### Completion Notes List

- Ultimate context engine analysis completed - comprehensive developer guide created.
- Implemented member-only resident portal route group at `app/(resident)/portal/(member)` and removed the duplicate `/portal` page file.
- Added cached server-side resident portal membership context, navigation config, and responsive navigation with active route state, Escape handling, and visible focus styles.
- Added member portal pages for Dashboard, Payments, Documents, Announcements, Events, Contact Board, and My Property.
- Preserved invitation acceptance outside the active-membership-gated route group.
- Added Payments/Documents route guards using active membership capability aggregation.
- Added Story 2.6 guardrail tests and updated prior auth/profile/property guardrails for the new App Router route-group structure.

### File List

- `_bmad-output/implementation-artifacts/2-6-resident-portal-layout-and-navigation.md`
- `docs/bmad/phase-4-tasks/stories/2-6-resident-portal-layout-and-navigation.md`
- `_bmad-output/implementation-artifacts/2-6-resident-portal-layout-and-navigation-validation.md`
- `docs/bmad/phase-4-tasks/stories/2-6-resident-portal-layout-and-navigation-validation.md`
- `_bmad-output/implementation-artifacts/sprint-status.yaml`
- `docs/bmad/phase-4-tasks/sprint-status.yaml`
- `app/(resident)/portal/page.tsx` (deleted)
- `app/(resident)/portal/(member)/layout.tsx`
- `app/(resident)/portal/(member)/page.tsx`
- `app/(resident)/portal/(member)/payments/page.tsx`
- `app/(resident)/portal/(member)/documents/page.tsx`
- `app/(resident)/portal/(member)/announcements/page.tsx`
- `app/(resident)/portal/(member)/events/page.tsx`
- `app/(resident)/portal/(member)/contact-board/page.tsx`
- `app/(resident)/portal/(member)/my-property/page.tsx`
- `components/resident/resident-portal-nav.tsx`
- `lib/resident/portal-navigation.ts`
- `server/services/auth/resident-portal.ts`
- `tests/resident-portal-navigation.test.mjs`
- `tests/auth-session.test.mjs`
- `tests/profile-resolution.test.mjs`
- `tests/property-membership.test.mjs`

### Change Log

- 2026-05-11: Created and validated Story 2.6 context for resident portal layout and navigation.
- 2026-05-11: Implemented resident portal member shell, navigation, placeholder section routes, permission-aware Payments/Documents states, and verification guardrails.
