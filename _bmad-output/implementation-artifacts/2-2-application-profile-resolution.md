# Story 2.2: Application Profile Resolution

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As an authenticated user,
I want my app profile to be resolved from my auth identity,
so that permissions, notifications, and property access work consistently across the portal.

## Acceptance Criteria

1. Given an authenticated Supabase user has a matching application profile, when the portal resolves the current profile, then the server returns the profile ID, display name, email, status, and notification preferences needed by private workflows, and the profile is resolved server-side before private data access.
2. Given an authenticated Supabase user does not yet have a profile row, when profile resolution runs, then the system creates or reports the missing profile according to the configured signup/profile creation strategy, and private portal routes do not proceed with an unresolved profile.
3. Given a profile is suspended or disabled, when the user attempts to access private portal routes, then access is blocked with a privacy-safe message, and no property data is returned.

## Tasks / Subtasks

- [x] Add the application profile schema foundation. (AC: 1, 2, 3)
  - [x] Add a Supabase/Postgres migration for `profiles` if the local project has a migration convention; otherwise add the SQL artifact in the closest project-standard schema location and document how it should be applied.
  - [x] Include `id`, `auth_user_id`, `email`, `email_verified_at`, `phone`, `first_name`, `last_name`, `display_name`, `status`, `notification_preferences`, `last_login_at`, `created_at`, `updated_at`, and `deleted_at` per the data model.
  - [x] Enforce `auth_user_id` uniqueness, email uniqueness, `auth.users(id)` cascade relationship, valid status values `invited`, `active`, `suspended`, `disabled`, and default `{}` notification preferences.
  - [x] Enable RLS on `profiles` and add the minimal self-read policy or helper needed for user-scoped profile resolution if migrations are being applied in this story.
  - [x] Do not add property membership, role, payment, document, or dashboard tables in this story.
- [x] Add a profile creation/resolution strategy. (AC: 1, 2)
  - [x] Decide and implement the project-local strategy for missing profiles: either create on auth user creation through SQL trigger/function or create/report missing in trusted server code.
  - [x] If creating profiles automatically, populate `auth_user_id`, email, display name fallback, status, email verification timestamp when available, and notification preference defaults without storing credentials.
  - [x] If reporting missing profiles instead of creating them, return a typed missing-profile result that blocks private portal access and renders only a generic privacy-safe message.
  - [x] Ensure duplicate profile creation is idempotent or conflict-safe.
- [x] Implement server-side current profile resolution. (AC: 1, 2, 3)
  - [x] Add `getCurrentProfile()` in an auth/profile server service module such as `server/services/auth/current-profile.ts` or a locally consistent path.
  - [x] Use the existing Supabase server client/session foundation from Story 2.1; do not read cookies directly in unrelated modules.
  - [x] Verify the authenticated Supabase user server-side before querying `profiles`.
  - [x] Return only the fields needed by this story: profile ID, auth user ID if needed server-side, display name, email, status, and notification preferences.
  - [x] Treat missing, deleted, suspended, and disabled profiles as blocked states for private routes.
  - [x] Do not return property records, memberships, roles, dues status, documents, payment history, board/admin data, or unrelated private records.
- [x] Upgrade the resident portal guard to require a resolved active profile. (AC: 1, 2, 3)
  - [x] Update the minimal `/portal` server route from Story 2.1 to call `getCurrentProfile()` before rendering resident shell content.
  - [x] Render a privacy-safe blocked/unavailable state for missing, suspended, disabled, deleted, or unresolved profiles.
  - [x] Preserve the unauthenticated redirect behavior from Story 2.1.
  - [x] Show only profile-safe fields if rendering confirmation content, such as display name or email; do not show property data.
  - [x] Keep resident dashboard navigation and dashboard data out of scope until Stories 2.6 and 2.7.
- [x] Preserve auth/session and public shell behavior. (AC: 1, 2, 3)
  - [x] Do not move `/login` out of `app/(public)`.
  - [x] Preserve `proxy.ts`, `lib/supabase/*`, auth callback behavior, sign-in, and sign-out unless a targeted change is required for profile resolution.
  - [x] Do not introduce a Supabase service-role client into browser/client code.
  - [x] Keep public pages, public contact, public pay dues, and vendor placeholder unauthenticated.
- [x] Extend verification. (AC: 1, 2, 3)
  - [x] Add focused tests or guardrails for the profile schema artifact, `getCurrentProfile()` behavior, blocked profile states, and portal gating.
  - [x] Add tests proving missing/suspended/disabled profile paths render privacy-safe messages and do not expose property records, memberships, roles, dues balance, payment history, or private documents.
  - [x] Preserve Story 2.1 auth/session guardrail tests.
  - [x] Run `npm test`, `npm run typecheck`, `npm run lint`, and `npm run build`.
  - [x] Manually verify `/login`, unauthenticated `/portal`, and the profile-blocked portal state if a local mock or test fixture can exercise it without real private data.

## Dev Notes

Story 2.2 turns a valid Supabase Auth session into an application-level profile identity. This is the foundation later stories will use for property memberships, roles, permissions, notifications, invitations, dashboard data, and property-specific authorization. The implementation must resolve the profile server-side before any private data access.

The central discipline: do not confuse profile resolution with property authorization. This story may create/query `profiles` and block private portal access when a profile is missing or inactive. It must not grant property access, load memberships, infer resident permissions, or show dashboard/payment/document data.

### Current Files To Update

- `app/(resident)/portal/page.tsx`
  - Current state: minimal protected resident landing page from Story 2.1. It renders after the `proxy.ts` auth check and intentionally says profile/membership/dashboard details come later.
  - Change: call `getCurrentProfile()` server-side before rendering; render an active-profile shell or a privacy-safe blocked state.
  - Preserve: no property/payment/document/board/admin data.
- `lib/supabase/server.ts`
  - Current state: server Supabase client helper using cookies and public Supabase env variables.
  - Change: reuse it for profile resolution; avoid duplicating cookie/client setup.
- `lib/supabase/proxy.ts` and `proxy.ts`
  - Current state: `/portal/:path*` is protected with `auth.getClaims()` before resident content renders.
  - Possible change: usually none. If profile checks are added in Proxy, keep it lightweight and avoid broad data-fetching in request middleware; route-level server checks are safer for profile resolution.
- `server/actions/auth.ts`
  - Current state: privacy-safe sign-in/sign-out server actions.
  - Possible change: update `last_login_at` only if the profile resolver or auth action can do it without leaking details or requiring service-role access. This is optional unless needed by local strategy.
- `tests/auth-session.test.mjs`
  - Current state: file-content guardrails for Story 2.1 auth/session behavior.
  - Change: extend or add a companion profile-resolution test file. Keep existing Story 2.1 tests passing.
- `.env.example`, `package.json`, `package-lock.json`
  - Current state: Supabase public env documentation and installed Supabase packages.
  - Change: only if a new migration/test tool is truly required. Avoid unrelated dependency churn.

### New Files Likely Needed

- Supabase migration/schema file, depending on local convention:
  - `supabase/migrations/<timestamp>_create_profiles.sql`, or
  - `docs/bmad/phase-3-design/sql/create-profiles.sql`, or
  - a project-standard database folder if one exists by implementation time.
- `server/services/auth/current-profile.ts`
  - Server-only resolver for current app profile.
- `server/services/auth/profile-types.ts` or colocated types
  - Optional typed status/result shape if it keeps blocked-profile handling clear.
- `tests/profile-resolution.test.mjs`
  - Focused Node guardrails for schema, resolver, portal gating, and privacy boundaries.

### Scope Boundary

In scope:

- `profiles` schema/migration artifact.
- Profile creation or missing-profile reporting strategy.
- Server-side `getCurrentProfile()` helper.
- Blocking private portal rendering for missing, deleted, suspended, or disabled profiles.
- Active-profile portal shell that may show display name/email only.
- Tests for profile resolution and privacy-safe blocking.

Out of scope:

- Property records and `property_memberships` implementation.
- Invitation acceptance.
- Roles, permissions, `profile_roles`, and `hasPermission()`.
- Resident dashboard navigation and dashboard data.
- Dues status, balances, payments, payment history, documents, announcements/events inside the resident portal, messages, or board/admin data.
- Supabase service-role client unless the chosen profile-creation strategy absolutely requires trusted server creation and can keep service-role code server-only. Prefer RLS/user-scoped patterns when possible.
- Admin user management UI.

### Technical Requirements

- Use Next.js + TypeScript App Router and the existing Supabase SSR setup from Story 2.1.
- Use Supabase Auth for identity; profile data lives in application `profiles`.
- Do not store plaintext passwords or password hashes in `profiles`.
- `profiles.auth_user_id` must reference `auth.users(id)` and be unique.
- Valid profile statuses are `invited`, `active`, `suspended`, and `disabled`.
- Treat `deleted_at` profiles as blocked/unresolved even if status says active.
- `notification_preferences` should be JSON-compatible and default to `{}`.
- Server-side profile resolution should return typed success/blocked/missing results rather than throwing raw Supabase errors into UI.
- Error and blocked states must be privacy-safe: do not reveal property existence, membership state, roles, dues, documents, or admin data.
- Keep service-role secrets out of browser/client modules.

### Architecture Compliance

- API cross-cutting requirements say private actions/routes must read the Supabase session server-side, resolve `profiles.id` from `auth.users.id`, reject unauthenticated requests, and then apply authorization before data access.
- This story implements the profile-resolution part of that chain. It should set up later authorization work without implementing it early.
- The data model defines `profiles` as the application profile for Supabase Auth users, with `auth_user_id`, email, display name, status, notification preferences, and timestamps.
- RLS should be enabled on `profiles` as part of the private-table strategy where the local migration path supports it.
- Later helper functions such as `app.current_profile_id()`, `app.has_permission()`, and `app.can_access_property()` are design targets. Do not implement permission/property helpers unless required for safe profile self-read.

### UX and Accessibility Requirements

- Profile blocked/missing states must use one clear heading, readable copy, and no implementation jargon.
- Suspended/disabled/missing profile messages should be generic, such as "Your resident profile is not available. Please contact the HOA for help."
- Do not tell the user whether a property exists, whether a membership exists, or which status caused the block unless that wording has been explicitly approved for residents.
- Preserve keyboard-operable logout and focus-visible styles from Story 2.1.
- Keep mobile layouts stable and avoid overlapping controls.

### Testing Requirements

- Follow the existing lightweight Node/file-content test style unless the repo adds a stronger test pattern.
- Minimum checks:
  - Profile schema/migration artifact defines `profiles`, `auth_user_id`, valid statuses, `notification_preferences`, indexes, and RLS when applicable.
  - `getCurrentProfile()` exists, uses the server Supabase client, queries `profiles`, and handles missing/suspended/disabled/deleted states.
  - `/portal` calls `getCurrentProfile()` before rendering private portal content.
  - Blocked profile UI is generic and privacy-safe.
  - Auth/session tests from Story 2.1 still pass.
  - Profile resolver and portal files do not include `property_memberships`, `profile_roles`, dues balance, payment history, private documents, owner name, board-only, admin-only, password hashes, or service-role imports in client/browser code.
- Required verification commands:
  - `npm test`
  - `npm run typecheck`
  - `npm run lint`
  - `npm run build`

### Previous Story Intelligence

- Story 2.1 installed `@supabase/supabase-js` and `@supabase/ssr`.
- Story 2.1 created:
  - `lib/supabase/client.ts`
  - `lib/supabase/config.ts`
  - `lib/supabase/server.ts`
  - `lib/supabase/proxy.ts`
  - `proxy.ts`
  - `server/actions/auth.ts`
  - `app/auth/callback/route.ts`
  - `app/(public)/login/page.tsx`
  - `app/(resident)/portal/page.tsx`
  - `tests/auth-session.test.mjs`
- Story 2.1 protects `/portal/:path*` with `auth.getClaims()` in `proxy.ts`, and unauthenticated `/portal` redirects to `/login?next=%2Fportal`.
- Story 2.1 deliberately did not resolve profiles, memberships, roles, or resident dashboard data. Keep that boundary: Story 2.2 may update the `/portal` page to require an active profile, but property authorization is Story 2.3 and role/permission foundation is Story 2.5.
- Story 2.1 used file-content guardrail tests because the repo currently has simple Node tests rather than component/E2E infrastructure.
- The worktree contains older uncommitted Epic 1 changes. Do not revert unrelated files.
- The project currently has no `project-context.md`.

### Latest Technical Information

- Supabase SSR is already integrated through `@supabase/ssr`; continue using the local helpers instead of adding another auth client pattern.
- Supabase Auth user identity should be validated server-side before profile lookup. Do not trust client-provided profile IDs.
- Supabase/Postgres migrations commonly live under `supabase/migrations`, but this repo may not yet have that folder. If creating it, keep the migration narrow and focused on `profiles`.
- Next.js Server Components can perform server-side checks before rendering route content; this is a good place for profile resolution after the existing Proxy has handled session presence.

### Project Context Reference

- No `project-context.md` file was found.

### References

- [Epics: Story 2.2](/home/smount/Websites/SpringMeadowCommunity/_bmad-output/planning-artifacts/epics.md)
- [Previous Story 2.1](/home/smount/Websites/SpringMeadowCommunity/_bmad-output/implementation-artifacts/2-1-resident-authentication-entry-and-session-handling.md)
- [Architecture: Authentication Architecture](/home/smount/Websites/SpringMeadowCommunity/docs/bmad/phase-2-architecture/architecture.md)
- [Architecture: Authorization Architecture](/home/smount/Websites/SpringMeadowCommunity/docs/bmad/phase-2-architecture/architecture.md)
- [API Design: Cross-Cutting Authentication and Profile API](/home/smount/Websites/SpringMeadowCommunity/docs/bmad/phase-3-design/api.md)
- [Data Model: Profiles](/home/smount/Websites/SpringMeadowCommunity/docs/bmad/phase-3-design/data-model.md)
- [Data Model: RLS Strategy](/home/smount/Websites/SpringMeadowCommunity/docs/bmad/phase-3-design/data-model.md)
- [Tasks v1: Profile and Session Resolution](/home/smount/Websites/SpringMeadowCommunity/docs/bmad/phase-4-tasks/tasks-v1.md)

## Dev Agent Record

### Agent Model Used

GPT-5 Codex

### Debug Log References

- 2026-05-08: Red phase confirmed `tests/profile-resolution.test.mjs` failed before the schema/resolver/portal guard existed.
- 2026-05-08: Verification passed with `npm test`, `npm run typecheck`, `npm run lint`, and `npm run build`.

### Implementation Plan

- Add a narrow Supabase migration for `profiles`, RLS self-read, update timestamp trigger, and an idempotent auth-user creation trigger.
- Implement server-only `getCurrentProfile()` using the Story 2.1 Supabase server helper and typed active/missing/blocked/error results.
- Gate `/portal` on an active resolved profile and render only generic blocked copy or profile-safe display fields.
- Extend file-content guardrail tests for schema, resolver behavior, blocked states, portal gating, and privacy boundaries.

### Completion Notes List

- Ultimate context engine analysis completed - comprehensive developer guide created.
- Implemented `profiles` schema foundation with auth user cascade, uniqueness constraints, valid profile statuses, JSON notification preference defaults, RLS, and idempotent profile creation on auth user insert.
- Added server-side current profile resolution that verifies the Supabase user, resolves only the current user's profile, and blocks missing, inactive, deleted, and errored states with a generic resident-facing message.
- Updated the resident portal to require an active profile before rendering profile-safe content while preserving unauthenticated redirect and sign-out behavior.
- Added Story 2.2 guardrail tests and updated Story 2.1 auth tests for the new profile-resolution boundary.

### File List

- `_bmad-output/implementation-artifacts/2-2-application-profile-resolution.md`
- `docs/bmad/phase-4-tasks/stories/2-2-application-profile-resolution.md`
- `_bmad-output/implementation-artifacts/sprint-status.yaml`
- `docs/bmad/phase-4-tasks/sprint-status.yaml`
- `app/(resident)/portal/page.tsx`
- `server/services/auth/current-profile.ts`
- `supabase/migrations/202605080001_create_profiles.sql`
- `tests/auth-session.test.mjs`
- `tests/profile-resolution.test.mjs`

### Change Log

- 2026-05-08: Created Story 2.2 context for application profile resolution.
- 2026-05-08: Implemented application profile schema, server-side profile resolution, portal gating, and focused verification guardrails.
