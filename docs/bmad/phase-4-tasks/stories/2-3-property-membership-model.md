# Story 2.3: Property Membership Model

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a resident with one or more HOA properties,
I want my account linked to the right property records,
so that I can access only the HOA records that belong to me.

## Acceptance Criteria

1. Given a property can have multiple linked users, when an active property membership exists for each user, then each linked user can access the shared property-level information allowed by their membership permissions, and unrelated residents cannot access that property.
2. Given a user is linked to multiple properties, when the resident portal loads property context, then the user can see and select among only their active linked properties, and each selection scopes dashboard, payment, document, and message data to that property.
3. Given a membership is invited, suspended, removed, or inactive, when authorization checks run, then only active memberships grant portal access to property-specific records, and inactive membership states are handled without leaking private property details.

## Tasks / Subtasks

- [x] Add property and membership schema foundation. (AC: 1, 2, 3)
  - [x] Add a Supabase/Postgres migration after `202605080001_create_profiles.sql` for the minimal `properties` and `property_memberships` tables needed by this story.
  - [x] Add prerequisite database foundations in that migration if they do not already exist: `pgcrypto`, `citext`, the `app` schema for helper functions, `community_status` and `property_status` types or constraints, and a minimal `communities` table so `properties.community_id` has a valid parent.
  - [x] Keep the `communities` work minimal: include only the fields required by the data model for Spring Meadow scoping and future multi-HOA support; do not implement the full community settings/admin management workflow.
  - [x] Include `properties` fields needed to support membership linkage and safe property selection: `id`, `community_id`, `account_number`, `public_payment_code`, `status`, address fields, optional owner/account metadata, balance/date placeholders from the data model, timestamps, and `deleted_at`.
  - [x] Include `property_memberships` fields from the data model: `id`, `community_id`, `property_id`, `profile_id`, `relationship`, `status`, `can_view_balance`, `can_pay_dues`, `can_view_documents`, `can_invite_members`, `invited_by`, `invited_at`, `accepted_at`, `removed_at`, `created_at`, and `updated_at`.
  - [x] Add valid status/relationship constraints or enum types for `membership_status` (`invited`, `active`, `suspended`, `removed`) and `relationship_type` (`owner`, `co_owner`, `resident`, `renter`, `manager`, `family`, `other`).
  - [x] Enforce uniqueness for one membership per `community_id` + `property_id` + `profile_id`.
  - [x] Add indexes for resident membership lookup and property membership lookup: `property_memberships(community_id, profile_id, status)` and `property_memberships(community_id, property_id, status)`.
  - [x] Enable RLS on `properties` and `property_memberships`.
  - [x] Do not add roles, profile roles, assessments, payments, documents, message threads, dashboard tables, invitation token tables, or audit log implementation in this story.
- [x] Add database helper/RLS foundation for current profile and active property access. (AC: 1, 2, 3)
  - [x] Add the smallest SQL helper needed for current profile lookup, such as `app.current_profile_id()`, reusing `profiles.auth_user_id = auth.uid()`.
  - [x] Add an active-membership helper such as `app.can_access_property(target_property_id uuid)` or an equivalent RLS-safe expression.
  - [x] Add RLS policy allowing residents to read only their own membership rows.
  - [x] Add RLS policy allowing residents to read only active linked properties.
  - [x] Keep admin/board role permission policies out of scope unless needed as placeholders that do not grant access before Story 2.5.
  - [x] Ensure invited, suspended, removed, deleted, and inactive states do not grant property access.
- [x] Implement server-side property membership resolution. (AC: 1, 2, 3)
  - [x] Add a server-only membership service, for example `server/services/auth/property-memberships.ts`.
  - [x] Use `getCurrentProfile()` from Story 2.2 or the same server Supabase client/profile resolution pattern; do not trust client-supplied profile IDs.
  - [x] Add a function such as `getCurrentPropertyMemberships()` that returns only active memberships for the current active profile.
  - [x] Return only fields needed for property context selection in this story: property ID, community ID, address display fields, membership ID, relationship, membership permission booleans, and a masked or non-sensitive account identifier if needed.
  - [x] Add a function such as `canAccessProperty(propertyId)` or a typed equivalent that checks current active profile + active membership before later stories query property-specific data.
  - [x] Treat no memberships, inactive memberships, missing profile, blocked profile, query errors, and deleted properties as blocked/unavailable states with privacy-safe results.
  - [x] Do not return dues balances, payment history, private documents, message contents, owner display name, board/admin data, or unrelated resident records.
- [x] Upgrade the resident portal property context shell. (AC: 1, 2, 3)
  - [x] Update `app/(resident)/portal/page.tsx` to resolve active profile first and then load active property memberships server-side.
  - [x] Render a privacy-safe unavailable state when no active property membership exists.
  - [x] If multiple active memberships exist, render a simple accessible property selector or list using only safe property context fields.
  - [x] If one active membership exists, render a safe confirmation of the linked property context without loading dashboard/payment/document/message data.
  - [x] Preserve the unauthenticated redirect and blocked-profile behavior from Story 2.2.
  - [x] Keep full resident portal navigation and dashboard summaries out of scope until Stories 2.6 and 2.7.
- [x] Preserve existing auth/profile/public behavior. (AC: 1, 2, 3)
  - [x] Preserve `/login` under `app/(public)` and the Story 2.1 Supabase SSR auth helpers.
  - [x] Preserve `getCurrentProfile()` behavior and its privacy-safe blocked states.
  - [x] Do not introduce a Supabase service-role client into browser/client code.
  - [x] Keep public pages, contact, public pay dues, vendor placeholder, and unauthenticated guest flows public.
  - [x] Do not broaden Proxy into a database-heavy authorization layer; perform property membership resolution in server route/service code.
- [x] Extend verification. (AC: 1, 2, 3)
  - [x] Add focused tests or guardrails for the property and membership schema artifact, active-only RLS policies/helpers, server membership resolver, and portal property gating.
  - [x] Add tests proving invited/suspended/removed/inactive membership states do not grant property access and render privacy-safe UI.
  - [x] Add tests proving unrelated residents cannot access or select another property.
  - [x] Add tests proving portal/property context files do not expose dues balance, payment history, private documents, message contents, owner display name, board/admin data, password hashes, or service-role imports.
  - [x] Preserve Story 2.1 and Story 2.2 auth/profile guardrail tests.
  - [x] Run `npm test`, `npm run typecheck`, `npm run lint`, and `npm run build`.
  - [x] Manually verify `/login`, unauthenticated `/portal`, profile-blocked `/portal`, no-active-membership `/portal`, and active-membership property context if local fixtures or mocks can exercise them without real private data.

## Dev Notes

Story 2.3 introduces the property membership authorization layer that sits after authentication and active profile resolution. It should make property access explicit, scoped, and testable without building the full resident dashboard.

The key discipline: membership authorization is still not a dashboard, payment, document, message, invitation, or role system. This story may create `properties` and `property_memberships`, implement active-membership checks, and render a safe property context shell. It must not expose private financial, document, owner, board/admin, or message data.

### Current Files To Update

- `app/(resident)/portal/page.tsx`
  - Current state: server component calls `getCurrentProfile()`, redirects unauthenticated users to `/login?next=%2Fportal`, renders a generic blocked-profile state, and otherwise shows display name/email only.
  - Change: after active profile resolution, call the new property membership resolver before rendering any property context.
  - Preserve: unauthenticated redirect, profile unavailable copy, logout form, no dashboard/payment/document/message data.
- `server/services/auth/current-profile.ts`
  - Current state: server-only `getCurrentProfile()` verifies Supabase Auth with `auth.getUser()`, reads `profiles` through the existing server Supabase client, and returns typed active/missing/blocked/error results.
  - Change: usually none. Reuse this helper rather than duplicating profile lookup or reading cookies directly.
- `supabase/migrations/202605080001_create_profiles.sql`
  - Current state: creates `profiles`, profile status constraints, RLS self-read policy, updated-at trigger, and idempotent auth user profile creation trigger.
  - Change: do not edit unless a new helper migration needs to reference profiles. Prefer creating a new migration file for Story 2.3.
- `tests/profile-resolution.test.mjs`
  - Current state: file-content guardrails for profiles schema, `getCurrentProfile()`, and profile-gated portal behavior.
  - Change: preserve these tests and add a companion membership test file rather than weakening Story 2.2 guardrails.

### New Files Likely Needed

- `supabase/migrations/<timestamp>_create_properties_and_memberships.sql`
  - New migration for prerequisite extensions/types, minimal `communities`, `properties`, `property_memberships`, RLS, and helper functions/policies.
- `server/services/auth/property-memberships.ts`
  - Server-only membership resolver and property-access helper.
- `tests/property-membership.test.mjs`
  - Focused Node guardrails for schema, RLS helpers/policies, resolver behavior, active-only access, portal gating, and privacy boundaries.

### Scope Boundary

In scope:

- Minimal `communities` schema prerequisite when no existing migration provides it.
- Minimal `properties` schema required for property membership references and safe selection.
- `property_memberships` schema and indexes.
- Current-profile-to-property membership lookup.
- Active-only property membership authorization helper.
- Resident portal property context shell with safe property selection/confirmation.
- Privacy-safe blocked state when no active membership exists.
- Tests for active-only access and private-data non-disclosure.

Out of scope:

- Full community settings and community administration workflows.
- Property invitation token storage, invitation acceptance, invitation UI, or invitation email flow.
- Roles, `profile_roles`, `hasPermission()`, board/admin permission checks, and admin membership management UI.
- Resident dashboard summaries, full portal navigation, property detail page, payment data, dues status display, Stripe sessions, documents, message threads, announcements/events inside the portal, or board/admin workspaces.
- Audit log implementation for membership changes. The architecture requires audit logging for sensitive membership changes later; this story should not implement membership mutation workflows that would require audit logging.
- Guest payment lookup changes.
- Service-role clients in browser/client modules.

### Technical Requirements

- Use Next.js + TypeScript App Router and the existing Supabase SSR setup.
- Use the Story 2.2 `getCurrentProfile()` result as the profile identity source for server-side membership checks.
- Keep property membership resolution server-side before any property-specific data access.
- If no earlier migration creates `communities`, the Story 2.3 migration must create the minimal parent table before `properties`; otherwise the `properties.community_id references communities(id)` migration will fail.
- Create `pgcrypto` before any new `gen_random_uuid()` table defaults if the extension is still absent, and create `citext` before using `citext` columns such as `communities.slug`.
- `property_memberships.community_id`, `property_id`, and `profile_id` must reference their parent tables and preserve future multi-HOA scope.
- Valid membership statuses are `invited`, `active`, `suspended`, and `removed`; only `active` grants access.
- Valid relationship values are `owner`, `co_owner`, `resident`, `renter`, `manager`, `family`, and `other`.
- The uniqueness rule is one membership per `community_id`, `property_id`, and `profile_id`.
- Permission booleans (`can_view_balance`, `can_pay_dues`, `can_view_documents`, `can_invite_members`) should be stored but not used to reveal the corresponding data in this story.
- Treat deleted/inactive properties and non-active memberships as blocked/unavailable.
- Error and blocked states must be privacy-safe: do not reveal whether an unrelated property exists, who owns it, balances, documents, roles, or message history.
- Do not trust client-provided `profileId`, `communityId`, or membership IDs for authorization decisions.

### Architecture Compliance

- Layered authorization order remains: authenticated user, current profile, community scope, property membership, then later role/workflow/document checks.
- This story implements the property membership layer and prepares later stories to scope dashboard, payment, document, and message queries.
- Every HOA-scoped table should include `community_id` even in single-HOA deployment.
- The data model defines `communities` before `properties`; Story 2.3 owns the minimal prerequisite if no prior migration exists in the repo by implementation time.
- RLS should be enabled on private tables. Residents may read their own membership rows and active linked properties only.
- Database helper functions such as `app.current_profile_id()` and `app.can_access_property()` are appropriate here if kept narrow and active-membership-only.
- Role/permission helpers such as `app.has_permission()` are design targets for Story 2.5 and should not be implemented early unless represented only as non-granting placeholders.

### UX and Accessibility Requirements

- The no-active-membership state must use one clear heading, readable copy, and no implementation jargon.
- Generic blocked copy should not disclose whether a property exists or which inactive membership status caused the block.
- If rendering multiple linked properties, use accessible controls: a labeled select, radio group, or simple list of links/buttons with stable focus styles.
- Property context copy may show address-style display fields only when the current profile has an active membership for that property.
- Avoid showing account number unless masked or explicitly non-sensitive; never show `owner_display_name`, balance, payment history, private documents, or message contents in this story.
- Preserve keyboard-operable logout and existing focus-visible styling.
- Keep the small portal shell responsive and text-safe on mobile.

### Testing Requirements

- Follow the existing lightweight Node/file-content guardrail style unless stronger test infrastructure exists by implementation time.
- Minimum checks:
  - Migration creates `properties` and `property_memberships` with required keys, constraints, indexes, and RLS enabled.
  - Migration either creates the minimal `communities` parent table or explicitly verifies it already exists before adding `properties.community_id` foreign keys.
  - Migration creates required extensions/types before first use, including `pgcrypto` for UUID defaults and `citext` if `citext` is used.
  - Migration or SQL helpers include `app.current_profile_id()` and active property access logic, or equivalent policy expressions.
  - Membership RLS/policies allow own membership read and active linked property read only.
  - Server membership resolver uses `getCurrentProfile()` or the Story 2.2 server profile pattern and never reads cookies directly.
  - Resolver filters memberships to active status and non-deleted properties.
  - Portal calls membership resolver after active profile resolution and renders generic no-membership UI when needed.
  - Tests cover invited, suspended, removed, inactive/deleted, no-membership, and active-membership paths at the guardrail level.
  - Portal and resolver files do not include dues balance, payment history, private documents, message contents, owner display name, board-only/admin-only data, password hashes, or service-role imports in client/browser code.
- Required verification commands:
  - `npm test`
  - `npm run typecheck`
  - `npm run lint`
  - `npm run build`

### Previous Story Intelligence

- Story 2.1 established Supabase SSR auth helpers, `proxy.ts`, `/login`, auth callback handling, sign-in/sign-out actions, and the initial protected `/portal`.
- Story 2.2 added `supabase/migrations/202605080001_create_profiles.sql`, `server/services/auth/current-profile.ts`, and profile-gated `/portal`.
- Story 2.2 `getCurrentProfile()` returns active profile data only after `auth.getUser()` and treats missing, deleted, suspended, disabled, and query-error states as blocked/unavailable.
- Story 2.2 intentionally avoided property memberships, roles, dues, documents, payments, and dashboard data. Story 2.3 may now introduce property membership authorization, but should preserve those other boundaries.
- Existing tests are fast Node file-content guardrails and do not import TypeScript modules directly.
- The profile migration has not necessarily been applied to a live/local Supabase database from these sessions; the Story 2.3 migration should be ordered after it and assume normal Supabase migration application order.
- No migration currently exists for `communities`, `community_settings`, or enum/extension setup. Do not assume those prerequisites exist just because they appear in design docs.
- The worktree contains older uncommitted Epic 1 and Epic 2 changes. Do not revert unrelated dirty files.
- The project currently has no `project-context.md`.

### Latest Technical Information

- Continue using `@supabase/ssr` and the existing `lib/supabase/server.ts` helper for Server Components and server services.
- Server code should verify the Supabase user/profile server-side; do not rely on client state for property authorization.
- Supabase/Postgres RLS policies and stable SQL helper functions are appropriate defense-in-depth for private tables. Keep helper functions narrow and deterministic.
- Next.js Server Components can resolve profile and property membership context before rendering route content; keep request-time Proxy focused on session presence and avoid heavy database authorization there.

### Project Context Reference

- No `project-context.md` file was found.

### References

- [Epics: Story 2.3](/home/smount/Websites/SpringMeadowCommunity/_bmad-output/planning-artifacts/epics.md)
- [Previous Story 2.2](/home/smount/Websites/SpringMeadowCommunity/_bmad-output/implementation-artifacts/2-2-application-profile-resolution.md)
- [Previous Story 2.1](/home/smount/Websites/SpringMeadowCommunity/_bmad-output/implementation-artifacts/2-1-resident-authentication-entry-and-session-handling.md)
- [Architecture: Property Membership](/home/smount/Websites/SpringMeadowCommunity/docs/bmad/phase-2-architecture/architecture.md)
- [Architecture: Authorization Architecture](/home/smount/Websites/SpringMeadowCommunity/docs/bmad/phase-2-architecture/architecture.md)
- [API Design: Cross-Cutting Authorization](/home/smount/Websites/SpringMeadowCommunity/docs/bmad/phase-3-design/api.md)
- [Data Model: Properties and Property Memberships](/home/smount/Websites/SpringMeadowCommunity/docs/bmad/phase-3-design/data-model.md)
- [Data Model: RLS Strategy](/home/smount/Websites/SpringMeadowCommunity/docs/bmad/phase-3-design/data-model.md)
- [Tasks v1: Property Membership Auth and Core HOA Tables](/home/smount/Websites/SpringMeadowCommunity/docs/bmad/phase-4-tasks/tasks-v1.md)

## Dev Agent Record

### Agent Model Used

GPT-5 Codex

### Debug Log References

- 2026-05-10: Red phase confirmed `tests/property-membership.test.mjs` failed before the membership migration, resolver, and portal gating existed.
- 2026-05-10: Verification passed with `npm test`, `npm run typecheck`, `npm run lint`, and `npm run build`.

### Implementation Plan

- Add an ordered migration for prerequisite community scope, properties, property memberships, active-only helper functions, and RLS policies.
- Implement a server-only membership resolver that reuses `getCurrentProfile()` and returns only active linked property context.
- Update the resident portal to resolve profile first, then active property memberships, and render a privacy-safe unavailable state or linked property list.
- Extend guardrail tests for schema, active-only access, resolver behavior, portal gating, and private-data non-disclosure.

### Completion Notes List

- Ultimate context engine analysis completed - comprehensive developer guide created.
- Implemented minimal community, property, and property membership schema foundations with required extensions/types, indexes, uniqueness, and RLS.
- Added `app.current_profile_id()` and `app.can_access_property()` helpers plus resident self-membership and active-linked-property read policies.
- Added server-side active property membership resolution with masked account identifiers and typed unavailable/error states.
- Updated `/portal` to require active property memberships after active profile resolution while preserving unauthenticated and profile-blocked behavior.
- Added Story 2.3 guardrails and updated Story 2.2 portal guardrails for the new property context boundary.

### File List

- `_bmad-output/implementation-artifacts/2-3-property-membership-model.md`
- `docs/bmad/phase-4-tasks/stories/2-3-property-membership-model.md`
- `_bmad-output/implementation-artifacts/sprint-status.yaml`
- `docs/bmad/phase-4-tasks/sprint-status.yaml`
- `app/(resident)/portal/page.tsx`
- `server/services/auth/property-memberships.ts`
- `supabase/migrations/202605100001_create_properties_and_memberships.sql`
- `tests/profile-resolution.test.mjs`
- `tests/property-membership.test.mjs`

### Change Log

- 2026-05-08: Created Story 2.3 context for property membership model.
- 2026-05-10: Validated Story 2.3 and added missing database prerequisite guidance for communities, extensions, and types.
- 2026-05-10: Implemented property membership schema, active-only access helpers, server resolver, portal gating, and verification guardrails.
