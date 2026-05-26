# Story 2.5: Role and Permission Assignment Foundation

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As an admin or board-authorized user,
I want users to have explicit roles and permissions,
so that resident, board, admin, vendor, pool worker, and legal reviewer access remains controlled.

## Acceptance Criteria

1. Given the system seeds default role records, when roles are available for Spring Meadow Community, then the system includes resident, board member, admin, vendor applicant, approved vendor, pool worker, and legal/compliance reviewer roles, and each role can carry explicit permission keys.
2. Given a user holds multiple roles, when permission checks evaluate access, then the system considers active role assignments in the correct community and scope, and suspended or removed role assignments do not grant access.
3. Given a sensitive role assignment is created, changed, suspended, or removed, when the action completes, then the system records enough information for later audit logging, and the normal application path does not silently bypass permission checks.

## Tasks / Subtasks

- [x] Add role and profile-role schema foundation. (AC: 1, 2, 3)
  - [x] Add an ordered Supabase/Postgres migration after `202605100002_create_property_invitation_tokens.sql`.
  - [x] Create `public.roles` with `id`, `community_id`, `key`, `name`, `description`, `permissions text[]`, `system_role`, `created_at`, and `updated_at`.
  - [x] Create `public.profile_roles` with `id`, `community_id`, `profile_id`, `role_id`, `scope`, `scope_id`, `status`, `assigned_by`, `assigned_at`, and `removed_at`.
  - [x] Enforce `unique (community_id, key)` on `roles` and `unique (community_id, profile_id, role_id, scope, scope_id)` on `profile_roles`.
  - [x] Add indexes for `profile_roles(community_id, profile_id, status)` and `profile_roles(community_id, role_id, status)`.
  - [x] Enable RLS on both tables. Authenticated users may read public role definitions for their community and their own active role assignments; mutation paths must go through permission-checked server/database functions.
  - [x] Do not add payment, document, dashboard, admin UI, vendor portal, compliance, or full audit-log tables in this story.
- [x] Seed default Spring Meadow role definitions. (AC: 1)
  - [x] Seed Spring Meadow Community if no local seed exists, using slug `spring-meadow-community`, without replacing future community-settings/admin workflows.
  - [x] Seed default roles: `resident`, `board_member`, `admin`, `vendor_applicant`, `approved_vendor`, `pool_worker`, and `legal_reviewer`.
  - [x] Give each role explicit permission keys in a stable naming scheme such as `resident.portal.access`, `property.members.invite`, `admin.roles.manage`, `admin.users.manage`, `board.workspace.access`, `audit.logs.view`, `legal.workflow.review`, `vendor.portal.access`, and `pool.logs.submit`.
  - [x] Make role seeding idempotent with `on conflict` or equivalent so rerunning migrations does not duplicate roles.
  - [x] Keep seeded permissions conservative; later stories may expand permission sets, but this story must not grant broad admin powers to all users.
- [x] Add permission evaluation helpers. (AC: 2)
  - [x] Add SQL helper(s), such as `app.has_permission(target_community_id uuid, permission_key text, target_scope text default null, target_scope_id uuid default null)`, that evaluate the current active profile only.
  - [x] Ensure helpers consider only `profile_roles.status = 'active'`, matching `roles.community_id`, matching current active profile, and matching community/scope.
  - [x] Support community-scoped permissions and scoped permissions for `property`, `vendor`, and `amenity` without granting inactive, suspended, or removed assignments.
  - [x] Add a server-only TypeScript permission service, such as `server/services/auth/permissions.ts` or `server/services/authorization/permissions.ts`, that reuses `getCurrentProfile()` and the existing Supabase server client.
  - [x] Return typed privacy-safe results for unauthenticated, profile-unavailable, permission-denied, and authorized states; do not expose role assignment details for other users.
- [x] Add permission-checked role assignment foundation. (AC: 3)
  - [x] Add server-only role assignment functions, such as `assignProfileRole`, `suspendProfileRole`, and `removeProfileRole`, or equivalent names aligned with local patterns.
  - [x] Require the acting profile to hold `admin.roles.manage` or an explicitly named role-management permission in the target community before mutating assignments.
  - [x] Use SQL `security definer` RPCs or another RLS-compatible server path that performs the permission check before insert/update; do not rely on client-provided actor IDs, profile IDs, role IDs, or community IDs as authority.
  - [x] Preserve assignment metadata: `assigned_by`, `assigned_at`, `removed_at`, previous status where available, target profile, target role, community, scope, and scope ID.
  - [x] Add a minimal audit service interface if absent, such as `server/services/audit/write-audit-log.ts`, and call it with enough role-change detail for later database-backed audit logging. Keep it no-op/dev-safe until the real `audit_logs` table lands.
  - [x] Deny unauthorized role mutations with generic privacy-safe results; do not reveal whether another profile, role, or scoped resource exists.
- [x] Preserve existing auth/profile/property/invitation behavior. (AC: 1, 2, 3)
  - [x] Preserve `/login`, Supabase SSR helpers, `proxy.ts`, auth callback handling, and sign-in/sign-out.
  - [x] Preserve `getCurrentProfile()` blocked states from Story 2.2.
  - [x] Preserve `getCurrentPropertyMemberships()` and `canAccessProperty()` active-only property access from Story 2.3.
  - [x] Preserve `acceptPropertyInvitation()` and `canInvitePropertyMembers()` behavior from Story 2.4.
  - [x] Keep public pages, public contact, public pay dues, and vendor placeholder unauthenticated.
  - [x] Do not introduce a Supabase service-role client into browser/client code.
- [x] Extend verification. (AC: 1, 2, 3)
  - [x] Add focused Node guardrail tests for the roles/profile_roles migration, seeded default role keys, permission arrays, RLS policies, and active-only permission helpers.
  - [x] Add tests proving suspended/removed role assignments do not grant permissions and that community/scope mismatches are denied.
  - [x] Add tests proving role assignment functions require a role-management permission and call/write an audit-intent path with before/after metadata.
  - [x] Add tests proving role and permission files do not expose payments, dues balance, private documents, owner names, message contents, board/admin-only data to unauthorized users, raw Supabase errors, or service-role imports in browser/client code.
  - [x] Preserve Story 2.1, 2.2, 2.3, and 2.4 guardrail tests.
  - [x] Run `npm test`, `npm run typecheck`, `npm run lint`, and `npm run build`.

### Review Findings

- [x] [Review][Patch] Suspended/removed role audit payloads omit target assignment metadata [server/services/auth/permissions.ts:181]
- [x] [Review][Patch] Community-scoped role assignments can be duplicated with arbitrary scope IDs [supabase/migrations/202605100003_create_roles_and_profile_roles.sql:269]

## Dev Notes

Story 2.5 adds the role/permission layer in the authorization chain. Authentication, active profile resolution, property memberships, and property invitation acceptance already exist. This story should add role definitions, role assignments, permission checks, and permission-gated role mutation foundations without building the full admin workspace.

The central discipline: role assignment is sensitive. Do not add a normal insert/update path that bypasses permission checks. If the implementation cannot safely mutate `profile_roles` under RLS with the existing publishable-key Supabase client, use permission-checked SQL RPCs and call them only from server-only modules.

### Current Files To Update

- `supabase/migrations/`
  - Current state: migrations exist for `profiles`, minimal `communities`/`properties`/`property_memberships`, and `property_invitation_tokens`.
  - Change: add a new migration, likely `202605100003_create_roles_and_profile_roles.sql`.
  - Preserve: do not edit previous migrations unless absolutely necessary; normal migration order should provide `communities`, `profiles`, and `app.current_profile_id()`.
- `server/services/auth/current-profile.ts`
  - Current state: server-only current profile resolver with active/missing/blocked/error states.
  - Change: reuse it; do not duplicate profile lookup or read cookies directly.
- `server/services/auth/property-memberships.ts`
  - Current state: active-only property membership resolver and `canAccessProperty(propertyId)`.
  - Change: usually none. Do not replace membership permission booleans with role permissions yet; later stories may combine them.
- `server/services/auth/property-invitations.ts`
  - Current state: token hashing, acceptance, and `canInvitePropertyMembers()` using active membership plus `can_invite_members`.
  - Change: preserve behavior. Story 2.5 may add role permissions alongside membership permissions, but must not break invitation acceptance.
- `tests/auth-session.test.mjs`, `tests/profile-resolution.test.mjs`, `tests/property-membership.test.mjs`, `tests/property-invitation.test.mjs`
  - Current state: lightweight Node file-content guardrails.
  - Change: add a companion role/permission test file rather than weakening existing guardrails.

### New Files Likely Needed

- `supabase/migrations/202605100003_create_roles_and_profile_roles.sql`
  - Role/profile-role tables, indexes, RLS, default role seeds, permission helper(s), and permission-checked assignment RPC(s) if used.
- `server/services/auth/permissions.ts` or `server/services/authorization/permissions.ts`
  - Server-only permission evaluation and role assignment service helpers.
- `server/services/audit/write-audit-log.ts`
  - Minimal audit interface/no-op placeholder if no audit service exists. It should capture action, actor, community, target, before/after, reason/request metadata shape for later database-backed audit logging.
- `tests/role-permission.test.mjs`
  - Guardrails for migration shape, seeds, active-only permission checks, mutation permission gates, audit-intent calls, and privacy boundaries.

### Scope Boundary

In scope:

- `roles` and `profile_roles` schema.
- Default Spring Meadow role definitions and permission-key arrays.
- Active-only permission evaluation.
- Community and scope matching for permission checks.
- Permission-gated role assignment/suspend/remove foundation.
- Minimal audit-intent interface for role changes.
- Guardrail tests.

Out of scope:

- Full admin/board workspace UI.
- User management screens.
- Property management screens.
- Full persistent `audit_logs` table/viewer unless already present before implementation.
- Payment, document, message, compliance, vendor, pool, or legal workflow screens.
- MFA policy enforcement.
- Broad RLS policies for future MVP tables not created yet.
- Supabase service-role client in browser/client code.

### Technical Requirements

- Use Next.js + TypeScript App Router and existing Supabase SSR helpers.
- Use Supabase Auth identity and `getCurrentProfile()` as the authenticated profile source.
- Keep authorization decisions server-side and testable.
- Role assignments must be community-scoped from the beginning.
- Valid `profile_roles.scope` values are `community`, `property`, `vendor`, and `amenity`.
- Valid `profile_roles.status` values are `active`, `suspended`, and `removed`.
- Only active role assignments grant permissions.
- Suspended and removed assignments must remain queryable only where needed for authorized management/audit context; they must not grant access.
- Do not trust client-provided actor profile, role, community, scope, or target IDs for authorization.
- Use conservative permission names that future stories can depend on; keep them stable and documented in the migration/service tests.
- Sensitive mutation results must be generic and privacy-safe.

### Architecture Compliance

- Follow the layered authorization order from architecture/API docs: authenticated user, active profile, community scope, role permission, property membership where property data is involved, then workflow/document-specific checks.
- Roles are separate from property membership. Do not use `property_memberships.relationship` as a replacement for roles.
- Board/admin permissions should be granular. Avoid a single unstructured boolean like `is_admin`.
- Enable RLS on role tables. Use database helpers/policies as defense in depth, while keeping clear server-side service checks.
- Role changes are sensitive actions. This story must create enough metadata/audit-intent plumbing so later audit-log persistence can be wired in without changing role assignment call sites.

### Library / Framework Requirements

- Current project uses Next.js `^16.0.0`, React `^19.0.0`, TypeScript `^5.0.0`, Tailwind `^4.0.0`, `@supabase/ssr`, and `@supabase/supabase-js`.
- Do not add new dependencies for roles/permissions unless a clear local pattern already exists.
- Continue using `import "server-only"` for server services that perform permission or mutation logic.
- Existing tests are Node `node:test` file-content guardrails; extend that style unless a stronger test harness is introduced before implementation.

### Testing Requirements

- Add a new focused test file, likely `tests/role-permission.test.mjs`.
- Minimum checks:
  - Migration creates `roles` and `profile_roles` with required fields, constraints, uniqueness, indexes, and RLS.
  - Migration seeds all seven default roles and each has explicit permissions.
  - Permission helper(s) use current active profile, community, scope, active role status, and role permission arrays.
  - Suspended/removed role assignments do not grant permission.
  - Role assignment mutation path requires role-management permission and preserves assignment metadata.
  - Audit interface receives enough action, actor, target, before/after, community, scope, and reason data for later persistence.
  - No service-role imports in browser/client code.
  - Existing auth/profile/property/invitation tests continue to pass.
- Required verification commands:
  - `npm test`
  - `npm run typecheck`
  - `npm run lint`
  - `npm run build`

### Previous Story Intelligence

- Story 2.1 established `/login`, Supabase SSR helpers, auth callback handling, sign-in/sign-out, and protected `/portal` routing through `proxy.ts`.
- Story 2.2 added `server/services/auth/current-profile.ts` and profile-gated portal behavior. Use this as the identity source.
- Story 2.3 added minimal `communities`, `properties`, `property_memberships`, `app.current_profile_id()`, `app.can_access_property()`, `server/services/auth/property-memberships.ts`, and active-only portal property context.
- Story 2.4 added `property_invitation_tokens`, `public.accept_property_invitation()`, `server/services/auth/property-invitations.ts`, and `/portal/invitations/accept`. Code review fixed two issues: Supabase RPCs should be exposed through `public`, and login redirects must preserve query strings for invitation tokens.
- Existing tests are fast Node guardrails and do not import TypeScript modules directly.
- Supabase migrations may not have been applied to a live/local database in these sessions; keep migrations ordered and idempotent.
- The worktree contains many uncommitted Epic 1 and Epic 2 changes. Do not revert unrelated files.
- No `project-context.md` file was found.

### Latest Technical Information

- Continue using the current local Supabase SSR setup. Do not introduce a second auth/client pattern.
- Supabase RPC calls from `supabase.rpc("function_name")` should target functions in an exposed schema, normally `public`, unless the project explicitly exposes another schema. Story 2.4 review already corrected this pattern.
- Next.js 16 uses `proxy.ts`, not legacy `middleware.ts`; keep request-time proxy focused on session presence and leave role/permission checks in server services/routes.

### Project Context Reference

- No `project-context.md` file was found.

### References

- [Epics: Story 2.5](/home/smount/Websites/SpringMeadowCommunity/docs/bmad/phase-4-tasks/epics.md)
- [Previous Story 2.4](/home/smount/Websites/SpringMeadowCommunity/_bmad-output/implementation-artifacts/2-4-property-invitation-acceptance.md)
- [Previous Story 2.3](/home/smount/Websites/SpringMeadowCommunity/_bmad-output/implementation-artifacts/2-3-property-membership-model.md)
- [Architecture: Authorization Architecture](/home/smount/Websites/SpringMeadowCommunity/docs/bmad/phase-2-architecture/architecture.md)
- [API Design: Cross-Cutting Authorization and Admin API](/home/smount/Websites/SpringMeadowCommunity/docs/bmad/phase-3-design/api.md)
- [Data Model: Roles and Profile Roles](/home/smount/Websites/SpringMeadowCommunity/docs/bmad/phase-3-design/data-model.md)
- [Data Model: Audit Logs](/home/smount/Websites/SpringMeadowCommunity/docs/bmad/phase-3-design/data-model.md)
- [Tasks v1: Roles and Permissions](/home/smount/Websites/SpringMeadowCommunity/docs/bmad/phase-4-tasks/tasks-v1.md)

## Dev Agent Record

### Agent Model Used

GPT-5 Codex

### Debug Log References

- 2026-05-11: Red phase confirmed `tests/role-permission.test.mjs` failed before the roles/profile roles migration, permission service, and audit service existed.
- 2026-05-11: Verification passed with `npm test`, `npm run typecheck`, `npm run lint`, and `npm run build`.

### Implementation Plan

- Add an ordered migration for role/profile-role schema, RLS policies, default Spring Meadow role seeds, active-only permission helpers, and permission-gated role assignment RPCs.
- Add a server-only permission service using `getCurrentProfile()`, Supabase RPCs, typed privacy-safe outcomes, and role mutation helpers.
- Add a no-op audit-intent service that captures role-change metadata for later persistent audit log wiring.
- Extend Node guardrails for schema shape, seeded role permissions, active-only permission checks, mutation gates, audit-intent calls, and privacy boundaries.

### Completion Notes List

- Ultimate context engine analysis completed - comprehensive developer guide created.
- Implemented `roles` and `profile_roles` schema foundation with community scope, uniqueness, indexes, RLS, update triggers, and conservative default role seeds for Spring Meadow Community.
- Added `app.has_permission()` and public RPC wrapper for active-only community/scope-aware permission evaluation.
- Added permission-gated `assign_profile_role`, `suspend_profile_role`, and `remove_profile_role` RPCs that require `admin.roles.manage` before mutation.
- Added server-only `hasPermission`, `assignProfileRole`, `suspendProfileRole`, and `removeProfileRole` helpers with generic privacy-safe denial states.
- Added a minimal `writeAuditLog()` audit-intent interface and wired role mutations to capture actor, action, target, before/after, community, and reason metadata.
- Added Story 2.5 guardrail tests and preserved prior Story 2.1-2.4 test coverage.

### File List

- `_bmad-output/implementation-artifacts/2-5-role-and-permission-assignment-foundation.md`
- `docs/bmad/phase-4-tasks/stories/2-5-role-and-permission-assignment-foundation.md`
- `_bmad-output/implementation-artifacts/sprint-status.yaml`
- `docs/bmad/phase-4-tasks/sprint-status.yaml`
- `supabase/migrations/202605100003_create_roles_and_profile_roles.sql`
- `server/services/auth/permissions.ts`
- `server/services/audit/write-audit-log.ts`
- `tests/role-permission.test.mjs`

### Change Log

- 2026-05-10: Created Story 2.5 context for role and permission assignment foundation.
- 2026-05-11: Implemented role/profile-role schema, default role seeds, permission helpers, permission-gated role assignment foundation, audit intent service, and verification guardrails.
