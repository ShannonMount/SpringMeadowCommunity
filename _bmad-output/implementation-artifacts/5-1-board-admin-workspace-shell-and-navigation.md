# Story 5.1: Board/Admin Workspace Shell and Navigation

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a board/admin user,
I want a dedicated operations workspace with clear navigation,
so that I can manage HOA records and workflows efficiently.

## Acceptance Criteria

1. Given an authenticated user has board/admin workspace permission, when they open the admin area, then they see navigation for Dashboard, Properties, Users, Payments, Assessments, Documents, Announcements, Events, Messages, Compliance Calendar, Records Requests, Audit Logs, and Settings, and navigation items are rendered according to permissions.
2. Given an authenticated resident without admin permissions attempts to open the admin area, when the route guard evaluates the request, then access is denied and no admin-only data is rendered.
3. Given a board/admin user navigates on mobile or by keyboard, when they move through the workspace, then navigation remains usable, focus-visible, and free of text overflow.

## Tasks / Subtasks

- [x] Add a server-only admin workspace context and authorization guard. (AC: 1, 2)
  - [x] Add `server/services/auth/admin-workspace.ts` with `import "server-only"`.
  - [x] Resolve the default community slug `spring-meadow-community` to `community_id` with the user-scoped Supabase client. Do not use `createServiceRoleClient`.
  - [x] Require an active profile via `getCurrentProfile()` and require `board.workspace.access` via `hasPermission({ communityId, permissionKey: "board.workspace.access" })`.
  - [x] Return safe unions such as `workspace`, `unauthenticated`, `profile-unavailable`, `permission-denied`, and `workspace-unavailable`.
  - [x] Build server-side navigation items from a registry and return only safe item fields to UI: `label`, `href`, `enabled`, and optionally `currentStatus`/`section` if useful. Do not return raw Supabase errors, role rows, full permission arrays, profile role IDs, or audit internals to UI.
  - [x] Use `board.workspace.access` as the entry permission. For item enablement, use existing permission keys where available: `admin.users.manage`, `admin.payments.manage`, `admin.assessments.manage`, `admin.documents.manage`, `board.documents.view`, `admin.announcements.manage`, `admin.events.manage`, `admin.messages.manage`, and `audit.logs.view`. Treat future-only sections as safe disabled nav items or safe placeholders until their later stories add concrete permissions and data.

- [x] Add the admin workspace shell, dashboard route, and permission-aware navigation. (AC: 1, 2, 3)
  - [x] Add `app/(admin)/admin/layout.tsx` as the shared workspace shell. It should perform the admin workspace guard before rendering `children`, show generic unavailable/denied states, and redirect unauthenticated users to `/login?next=/admin`.
  - [x] Add `app/(admin)/admin/page.tsx` as a minimal Dashboard landing page for the shell. Story 5.2 owns the real dashboard summary data, so this page must not fetch payment/document/message/compliance counts yet.
  - [x] Add `components/admin/admin-workspace-nav.tsx` as a small client component for mobile menu state and active-link styling. It may use `usePathname`, but all permission filtering/enabled state must come from the server layout.
  - [x] Keep the client nav focused and isolated: no Supabase imports, no service-role imports, no server services, no direct permission checks, no raw admin table names, and no data fetching.
  - [x] Render the required labels: Dashboard, Properties, Users, Payments, Assessments, Documents, Announcements, Events, Messages, Compliance Calendar, Records Requests, Audit Logs, and Settings.
  - [x] Links for already implemented admin routes should point to their current routes: `/admin`, `/admin/payments`, `/admin/documents`, `/admin/announcements`, `/admin/events`, and `/admin/messages`. Keep `/admin/delinquency` accessible; do not remove or rename it in this story.
  - [x] For sections whose full features are owned by later stories, add safe placeholder routes or disabled nav items without private data. If placeholder routes are added, they should be server-rendered, generic, workspace-guarded by the layout, and easy for later stories to replace.
  - [x] Use the existing quiet operational admin style: dense but readable layout, full-width shell bands, restrained borders, `rounded-sm`, predictable nav, no marketing hero, no nested cards, no decorative gradient/orb backgrounds.
  - [x] Ensure mobile navigation uses a real button with `aria-expanded`, `aria-controls`, Escape-to-close behavior if stateful, visible focus styles, `min-w-0`, `break-words` or equivalent overflow protection, and `aria-current="page"` on the active enabled link.

- [x] Integrate the shell with existing admin pages without breaking current workflows. (AC: 1, 2, 3)
  - [x] Review all existing admin pages before editing: `app/(admin)/admin/payments/page.tsx`, `app/(admin)/admin/delinquency/page.tsx`, `app/(admin)/admin/documents/page.tsx`, `app/(admin)/admin/announcements/page.tsx`, `app/(admin)/admin/events/page.tsx`, and `app/(admin)/admin/messages/page.tsx`.
  - [x] If the new layout owns the page `<main>`, remove or convert page-level `<main>` wrappers from existing admin pages so the rendered DOM does not contain incoherent nested main landmarks. At minimum, `payments` and `delinquency` currently render their own `<main>` wrappers.
  - [x] Preserve every existing admin page service/action call, filter param, redirect query param, field error id, `aria-live` notice, New York timestamp formatting, pagination behavior, and generic denied/sign-in/unavailable copy.
  - [x] Do not refactor existing admin management pages into client components. Existing admin pages are server-rendered operational pages and should stay that way.
  - [x] Do not add new data queries to the shell that duplicate page-specific queries. The shell may only resolve profile/community/permissions/navigation.

- [x] Protect `/admin` at the auth and login handoff boundary. (AC: 2)
  - [x] Update `proxy.ts` so the matcher covers both `/portal/:path*` and `/admin/:path*`.
  - [x] Update `lib/supabase/proxy.ts` so unauthenticated `/admin` and `/admin/...` requests redirect to `/login?next=<admin path and query>`, preserving the query string and using `auth.getClaims()` as the existing resident guard does.
  - [x] Update the safe redirect helpers in `app/(public)/login/page.tsx`, `server/actions/auth.ts`, and `app/auth/callback/route.ts` so local `/admin` and `/admin/...` paths are allowed, while external URLs, protocol-relative paths, and unrelated local paths still fall back safely to `/portal`.
  - [x] Keep resident invitation acceptance redirects intact. Story 2.4/2.6 specifically fixed invitation token preservation; do not regress `/portal/invitations/accept?token=...`.
  - [x] Consider renaming or aliasing `signOutResident` to a neutral sign-out action for shared resident/admin use, but preserve the existing export so resident pages and tests continue to work.
  - [x] Do not rely on client-side redirects or client-side permission checks for authorization. The layout/service guard and existing server services must remain authoritative.

- [x] Preserve privacy and scope boundaries. (AC: 1, 2)
  - [x] Do not expose raw Supabase errors, `error.message`, service-role keys, private storage bucket/path values, audit row internals, Stripe identifiers, guest payer fields, owner names, account numbers, public payment codes, message bodies, document storage paths, email provider data, or raw role assignment rows in the shell or nav.
  - [x] Do not grant direct table access or add new broad RLS policies for the shell. This story should not need a migration unless implementation discovers a small additive permission seed is required.
  - [x] Do not implement Story 5.2 dashboard summaries, Story 5.3 property CRUD, Story 5.4 user/membership management, Story 5.5 role assignment UI, Story 5.6 settings forms, Story 5.7 data table framework, Story 5.8 audit log records, or Story 5.9 operational monitoring.
  - [x] Do not move resident portal navigation into the admin shell or add admin navigation to public/resident pages.

- [x] Add focused static/source tests. (AC: 1, 2, 3)
  - [x] Add `tests/admin-workspace-shell.test.mjs`.
  - [x] Test that the admin workspace service is server-only, uses `getCurrentProfile`, uses `hasPermission`, checks `board.workspace.access`, resolves the Spring Meadow community, returns safe unions, and does not import service-role clients or expose raw errors.
  - [x] Test that `app/(admin)/admin/layout.tsx` exists, calls the workspace context before rendering children, redirects unauthenticated users to login with an admin `next`, renders generic denied/unavailable states, includes the nav component, and does not import admin page data services.
  - [x] Test that the nav component is the only client component in the shell, uses `usePathname` for active state, renders the required labels, has mobile controls with `aria-expanded`/`aria-controls`, has focus-visible styles, protects text overflow, and receives filtered/enabled items from props.
  - [x] Test that `/admin` dashboard exists and does not fetch real dashboard summaries before Story 5.2.
  - [x] Test auth handoff changes: `proxy.ts` matches `/admin/:path*`; `lib/supabase/proxy.ts` treats admin routes as protected and preserves query strings; login/action/callback safe redirect helpers accept `/admin` and `/admin/...` but reject external URLs.
  - [x] Test existing admin pages still exist under the shell and do not expose forbidden internals. If the layout owns `<main>`, test that existing admin pages do not retain page-level `<main>` wrappers.
  - [x] Add negative assertions that public, guest, resident, shared UI, and client Supabase files do not import the admin workspace service, admin nav component, admin permission keys, service-role clients, or admin-only table/query internals.
  - [x] Run `node --test tests/admin-workspace-shell.test.mjs`, `npm test`, `npm run typecheck`, `npm run lint`, `npm run build`, and `git diff --check`.

### Review Findings

- [x] [Review][Patch] Normalize and reject safe redirect paths with traversal segments before accepting `/portal` or `/admin` [app/(public)/login/page.tsx:24]
- [x] [Review][Patch] Handle Escape from the mobile admin nav button/container so the open menu closes regardless of current focus [components/admin/admin-workspace-nav.tsx:80]

## Dev Notes

Story 5.1 is the first Epic 5 story. It should turn the focused admin pages created in earlier epics into a real workspace shell without pulling forward the full admin CRUD and reporting stories. The highest-risk areas are authorization before render, login redirect preservation for `/admin`, and avoiding a client-heavy shell that leaks permission or private record internals.

### Current Files To Update Or Read Fully

- `proxy.ts`
  - Current state: only matches `/portal/:path*`.
  - Change: include `/admin/:path*`.
  - Preserve: keep Next 16 `proxy.ts`; do not reintroduce `middleware.ts`.

- `lib/supabase/proxy.ts`
  - Current state: protects resident portal routes, uses `@supabase/ssr` and `auth.getClaims()`, and redirects unauthenticated resident routes to login while preserving the path/query.
  - Change: generalize route detection so `/admin` and `/admin/...` are protected and preserve `next`.
  - Preserve: no `auth.getSession()`, no service role, no private data lookup in proxy.

- `app/(public)/login/page.tsx`
  - Current state: public login page sanitizes `next` to `/portal` or `/portal/...` only and uses resident-oriented copy.
  - Change: allow safe local `/admin` paths too. Adjust copy only if needed so the form still makes sense for board/admin users.
  - Preserve: generic auth errors, no account enumeration, accessible labels, and hidden `next` field.

- `server/actions/auth.ts`
  - Current state: `signInResident` allows only portal next paths and `signOutResident` redirects to `/login`.
  - Change: allow safe local admin next paths. Optionally add a neutral sign-out alias while keeping the existing resident export.
  - Preserve: no raw auth errors, no service role, no external redirects.

- `app/auth/callback/route.ts`
  - Current state: callback `safeRedirectPath` allows only portal next paths.
  - Change: allow safe local admin next paths.
  - Preserve: expired session behavior and generic errors.

- `server/services/auth/permissions.ts`
  - Current state: server-only permission helper wraps `public.has_permission` and returns safe `authorized`, `unauthenticated`, `profile-unavailable`, or `permission-denied` unions.
  - Change: reuse it from the new admin workspace service; do not duplicate permission logic.
  - Preserve: role mutation behavior and audit logging.

- `server/services/auth/current-profile.ts`
  - Current state: server-only active profile resolver using user-scoped Supabase client and generic profile unavailable outcomes.
  - Change: reuse it in the admin workspace service.
  - Preserve: no property membership, role assignment, or private data exposure from auth shell.

- `app/(resident)/portal/(member)/layout.tsx` and `components/resident/resident-portal-nav.tsx`
  - Current state: good local pattern for server layout guard plus small client nav using `usePathname`, mobile menu state, focus-visible styles, and Escape-to-close.
  - Change: do not edit unless extracting a small shared sign-out action is needed.
  - Preserve: resident route group behavior and invitation acceptance outside the member layout.

- Existing admin pages:
  - `app/(admin)/admin/payments/page.tsx`
  - `app/(admin)/admin/delinquency/page.tsx`
  - `app/(admin)/admin/documents/page.tsx`
  - `app/(admin)/admin/announcements/page.tsx`
  - `app/(admin)/admin/events/page.tsx`
  - `app/(admin)/admin/messages/page.tsx`
  - Current state: focused server-rendered admin pages with their own filters, notices, and service calls. `payments` and `delinquency` currently include page-level `<main>` wrappers because no admin layout existed.
  - Change: integrate under the shared shell and remove conflicting landmarks if the layout owns `<main>`.
  - Preserve: all workflow-specific behavior, field errors, query params, and privacy guardrails.

### Suggested New Files

- `server/services/auth/admin-workspace.ts`
- `components/admin/admin-workspace-nav.tsx`
- `app/(admin)/admin/layout.tsx`
- `app/(admin)/admin/page.tsx`
- Optional placeholder pages if nav links should be reachable now:
  - `app/(admin)/admin/properties/page.tsx`
  - `app/(admin)/admin/users/page.tsx`
  - `app/(admin)/admin/assessments/page.tsx`
  - `app/(admin)/admin/compliance/page.tsx`
  - `app/(admin)/admin/records/page.tsx`
  - `app/(admin)/admin/audit/page.tsx`
  - `app/(admin)/admin/settings/page.tsx`
- `tests/admin-workspace-shell.test.mjs`

### Navigation Contract

Required labels and intended paths:

- Dashboard: `/admin`
- Properties: `/admin/properties`
- Users: `/admin/users`
- Payments: `/admin/payments`
- Assessments: `/admin/assessments`
- Documents: `/admin/documents`
- Announcements: `/admin/announcements`
- Events: `/admin/events`
- Messages: `/admin/messages`
- Compliance Calendar: `/admin/compliance`
- Records Requests: `/admin/records`
- Audit Logs: `/admin/audit`
- Settings: `/admin/settings`

Recommended enablement rules:

- Entry to the workspace requires `board.workspace.access`.
- Existing operational pages should be enabled only when the user has the relevant permission. Documents can be enabled for `admin.documents.manage` or `board.documents.view` if the implementation keeps the current page's permission-aware upload/list behavior.
- Future sections may be disabled or placeholder-only until their owning stories add data workflows. Disabled items must not be keyboard traps and should not fetch private records.
- Do not make nav permissions authoritative in the browser. The server layout/service decides what is enabled, and page-level server services keep their own authorization checks.

### Architecture Compliance

- Use Next.js App Router route groups. The architecture recommends public, auth, resident, board/admin, guest payment, API, and webhook surfaces under `app/` and explicitly includes `(admin)/` as the board/admin route group.
- Keep business logic in `server/services/...` and form mutations in `server/actions/...`.
- Use user-scoped Supabase clients for authenticated page/service checks. Service role belongs only in trusted server code for jobs, webhooks, storage signing, or other already-justified flows; this shell should not need it.
- Keep records community-scoped. The default community slug is already `spring-meadow-community` across admin services.
- Keep authorization layered: proxy verifies an authenticated session, layout verifies workspace permission, and each page/service continues checking its own feature permission.

### Latest Technical Information

- Local dependencies in `package.json`: Next `^16.0.0`, React `^19.0.0`, `@supabase/ssr` `^0.10.3`, `@supabase/supabase-js` `^2.105.3`, Tailwind `^4.0.0`, TypeScript `^5.0.0`.
- Official Next layout docs state layouts do not re-render on navigation and should use a client component with `usePathname` for active nav state. Keep the layout server-rendered and isolate active link behavior in the nav client component.
- Official Next `usePathname` docs say it is a Client Component hook. Do not make the whole admin layout a client component just to read the active path.
- Official Supabase SSR docs recommend `@supabase/ssr` for making the user session available on client and server; this repo already uses that pattern through `lib/supabase/server.ts` and `lib/supabase/proxy.ts`.
- Official React 19 docs support Server Functions in forms. Existing action modules already use `"use server"` and redirect status params; preserve that pattern.

### Previous Story Intelligence

- Story 2.4/2.6 fixed login redirects so invitation token query strings are preserved. Any auth safe-redirect change must keep `/portal/invitations/accept?token=...` working.
- Story 2.6 established the resident layout pattern: server layout guard plus small client navigation component for active path/mobile state.
- Stories 3.8, 3.9, 4.2, 4.3, 4.5, 4.6, 4.8, and 4.9 intentionally created focused admin pages before the full shell existed. Do not replace their services or workflows while wrapping them in the shell.
- Story 4.8 warned that Story 5.1 owns the full board/admin workspace shell/navigation. This is that story; keep the work on shell/navigation and do not expand into full feature CRUD.
- Story 4.8 code review fixed duplicate form input IDs when multiple forms render on one page. If this story adds repeated controls in the nav or placeholders, keep IDs unique.
- Story 4.9 completed message visibility/history/notifications and should remain done. Do not weaken its message privacy protections or expose email/audit/message internals through the shell.

### Testing Requirements

- Follow the existing source-inspection test style with `node:test`, `assert`, `readFileSync`, `existsSync`, recursive file listing helpers, and `assertOrdered` where order matters.
- Use focused tests for this story plus full suite verification. No live Supabase harness is expected unless the local pattern changes.
- Tests should assert guard order: workspace context/permission checks must happen before `children` are rendered.
- Tests should assert auth handoff behavior: `/admin` is protected by proxy and accepted by login/action/callback safe redirects, while external redirects are still rejected.
- Tests should assert shell privacy: no service-role imports, no raw `error.message`, no admin-only record data fetched in layout/nav, and no admin workspace imports in public/resident/guest/client Supabase surfaces.

### Project Structure Notes

- Align with current source tree:
  - `app/(admin)/admin/...` for admin routes.
  - `components/admin/...` for admin client navigation.
  - `server/services/auth/...` for server-only auth/workspace helpers.
  - `server/actions/...` for server actions.
  - `tests/*.test.mjs` for static source guardrails.
- There is no installed icon library. Do not add an icon dependency for this story unless the user explicitly asks; text navigation matches the existing resident/admin patterns and avoids package churn.
- No `project-context.md` file was found under the project root during story creation.

### References

- [Epic 5 Story 5.1 Source](/home/smount/Websites/SpringMeadowCommunity/_bmad-output/planning-artifacts/epics.md)
- [Requirements: Admin Tools and NFRs](/home/smount/Websites/SpringMeadowCommunity/docs/bmad/phase-1-requirements/requirements.md)
- [Architecture: Application Architecture and Board/Admin Access](/home/smount/Websites/SpringMeadowCommunity/docs/bmad/phase-2-architecture/architecture.md)
- [Architecture: Board/Admin Navigation](/home/smount/Websites/SpringMeadowCommunity/docs/bmad/phase-2-architecture/architecture.md)
- [API Design: Admin API and Service Clients](/home/smount/Websites/SpringMeadowCommunity/docs/bmad/phase-3-design/api.md)
- [Data Model: Roles, Permissions, and Auth Security](/home/smount/Websites/SpringMeadowCommunity/docs/bmad/phase-3-design/data-model.md)
- [Resident Layout Pattern](/home/smount/Websites/SpringMeadowCommunity/app/(resident)/portal/(member)/layout.tsx)
- [Resident Nav Pattern](/home/smount/Websites/SpringMeadowCommunity/components/resident/resident-portal-nav.tsx)
- [Permission Service](/home/smount/Websites/SpringMeadowCommunity/server/services/auth/permissions.ts)
- [Current Profile Service](/home/smount/Websites/SpringMeadowCommunity/server/services/auth/current-profile.ts)
- [Supabase Proxy Helper](/home/smount/Websites/SpringMeadowCommunity/lib/supabase/proxy.ts)
- [Auth Actions](/home/smount/Websites/SpringMeadowCommunity/server/actions/auth.ts)
- [Login Page](/home/smount/Websites/SpringMeadowCommunity/app/(public)/login/page.tsx)
- [Previous Story 4.9](/home/smount/Websites/SpringMeadowCommunity/_bmad-output/implementation-artifacts/4-9-message-visibility-history-and-notifications.md)
- [Previous Admin Message Story 4.8](/home/smount/Websites/SpringMeadowCommunity/_bmad-output/implementation-artifacts/4-8-board-admin-message-inbox-and-replies.md)
- [Next.js Layout Docs](https://nextjs.org/docs/15/app/api-reference/file-conventions/layout)
- [Next.js usePathname Docs](https://nextjs.org/docs/app/api-reference/functions/use-pathname)
- [Supabase SSR Docs](https://supabase.com/docs/guides/auth/server-side)
- [React Server Functions Docs](https://react.dev/reference/rsc/server-functions)

## Dev Agent Record

### Agent Model Used

GPT-5 Codex

### Debug Log References

- `node --test tests/admin-workspace-shell.test.mjs`
- `npm test`
- `npm run typecheck`
- `npm run lint`
- `npm run build`
- `git diff --check`
- `node --test tests/admin-workspace-shell.test.mjs`
- `node --test tests/auth-session.test.mjs`
- `npm test`
- `npm run typecheck`
- `npm run lint`
- `npm run build`
- `git diff --check`

### Completion Notes List

- Ultimate context engine analysis completed - comprehensive developer guide created.
- Implemented a server-only admin workspace context that resolves the Spring Meadow community with the user-scoped Supabase client, checks the active profile and `board.workspace.access`, and returns safe permission-aware navigation fields.
- Added the guarded admin layout, client-only admin navigation, minimal dashboard landing page, and generic placeholder routes for later admin sections without adding private data queries.
- Integrated existing admin pages under the shared shell by removing page-level `<main>` wrappers from payments and delinquency while preserving existing page service calls and workflow behavior.
- Protected `/admin` through the proxy/login/callback/action handoff, preserving local admin `next` paths and resident invitation redirect safety.
- Added focused source tests for the shell, nav, auth handoff, page integration, and privacy boundaries; full validation passed.
- Resolved code review findings by centralizing safe redirect validation with traversal rejection and moving Escape handling to the admin nav container so the mobile menu closes from the trigger or panel.

### File List

- `_bmad-output/implementation-artifacts/5-1-board-admin-workspace-shell-and-navigation.md`
- `_bmad-output/implementation-artifacts/sprint-status.yaml`
- `app/(admin)/admin/_components/admin-placeholder-section.tsx`
- `app/(admin)/admin/assessments/page.tsx`
- `app/(admin)/admin/audit/page.tsx`
- `app/(admin)/admin/compliance/page.tsx`
- `app/(admin)/admin/delinquency/page.tsx`
- `app/(admin)/admin/layout.tsx`
- `app/(admin)/admin/page.tsx`
- `app/(admin)/admin/payments/page.tsx`
- `app/(admin)/admin/properties/page.tsx`
- `app/(admin)/admin/records/page.tsx`
- `app/(admin)/admin/settings/page.tsx`
- `app/(admin)/admin/users/page.tsx`
- `app/(public)/login/page.tsx`
- `app/auth/callback/route.ts`
- `components/admin/admin-workspace-nav.tsx`
- `lib/auth/safe-redirect.ts`
- `lib/supabase/proxy.ts`
- `proxy.ts`
- `server/actions/auth.ts`
- `server/services/auth/admin-workspace.ts`
- `tests/admin-workspace-shell.test.mjs`

### Change Log

- 2026-05-17 - Created Story 5.1 context for board/admin workspace shell and navigation.
- 2026-05-17 - Implemented board/admin workspace shell, authorization context, navigation, admin auth handoff, placeholder routes, and source tests.
- 2026-05-17 - Addressed code review findings for safe redirect traversal handling and mobile nav Escape behavior.
