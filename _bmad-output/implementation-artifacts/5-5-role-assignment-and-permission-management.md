# Story 5.5: Role Assignment and Permission Management

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As an admin,
I want to assign and remove user roles,
so that board/admin, legal reviewer, vendor, pool worker, and resident capabilities are explicit and auditable.

## Acceptance Criteria

1. Given an admin has role management permission, when they assign a role to a profile, then the role assignment includes community, role, profile, scope, status, assigned_by, and assigned_at, and the assigned permissions become available to authorization checks.
2. Given an admin suspends or removes a role assignment, when the action succeeds, then the role assignment no longer grants access, and removed_at or status metadata is preserved.
3. Given a user without role management permission attempts a role change, when the action runs, then the request is denied, and no hidden permission details are leaked.

## Tasks / Subtasks

- [x] Add admin role-management RPC coverage on the existing role tables. (AC: 1, 2, 3)
  - [x] Add the next ordered migration after `supabase/migrations/202605110020_user_membership_management.sql`, for example `supabase/migrations/202605110021_role_assignment_management.sql`.
  - [x] Reuse existing `public.roles`, `public.profile_roles`, `app.has_permission()`, `public.assign_profile_role()`, `public.suspend_profile_role()`, and `public.remove_profile_role()` from `202605100003_create_roles_and_profile_roles.sql`; do not create duplicate role, permission, user-role, admin-role, or profile-role tables.
  - [x] Add role-management list RPCs such as `public.list_admin_roles`, `public.list_admin_profile_roles`, and `public.list_admin_role_targets`, or a smaller locally consistent set that returns role definitions, active/non-active role assignments, safe profile summaries, and property scope options needed by the UI.
  - [x] Every list or mutation RPC must resolve the active `spring-meadow-community` community or accept a validated target community, call `app.current_profile_id()`, and check `app.has_permission(target_community_id, 'admin.roles.manage')` before returning role-management data or mutating `profile_roles`.
  - [x] Revoke public/anon execution and grant execute only to `authenticated` for new role-management RPCs and the existing `assign_profile_role`, `suspend_profile_role`, and `remove_profile_role` functions if they are still publicly executable by default.
  - [x] Do not grant direct broad select/insert/update/delete access on `roles`, `profile_roles`, `profiles`, `properties`, `property_memberships`, `audit_logs`, payments, documents, messages, or Auth tables.

- [x] Harden role assignment mutation semantics. (AC: 1, 2, 3)
  - [x] Assign must validate that the target profile is non-deleted and in a locally allowed state (`active` or `invited` unless existing product behavior requires stricter `active` only). Disabled/deleted profiles must return a generic unavailable/invalid result.
  - [x] Assign must validate the role key exists in the same community and must not accept arbitrary permission keys from the browser. The browser submits a role key/id selection; the database resolves permissions from `roles.permissions`.
  - [x] Use supported scopes deliberately: `community` scope uses the zero UUID sentinel from the existing schema; `property` scope must validate the property belongs to the same community and is not deleted. Do not expose `vendor` or `amenity` assignment controls until backing vendor/amenity records exist.
  - [x] Assigning an existing suspended/removed assignment should reactivate the durable `profile_roles` row, set `status = 'active'`, set `assigned_by` to the actor, refresh `assigned_at`, and clear `removed_at`.
  - [x] Suspend must preserve `assigned_by`, `assigned_at`, `scope`, and `scope_id`, set `status = 'suspended'`, and leave `removed_at` unchanged/null.
  - [x] Remove must set `status = 'removed'`, set `removed_at = now()`, preserve durable assignment metadata, and ensure removed assignments do not grant permissions.
  - [x] Prevent self-lockout: an actor must not suspend/remove their own final active assignment that grants `admin.roles.manage` in the community unless another active role assignment still grants that permission.
  - [x] All mutation results must be privacy-safe: no raw SQL errors, constraint names, role permission internals for unauthorized users, stack traces, or profile existence leaks.

- [x] Add a server-only admin role management service. (AC: 1, 2, 3)
  - [x] Add `server/services/admin/role-management.ts` with `import "server-only"`.
  - [x] Use user-scoped Supabase clients from `lib/supabase/server.ts` and permission-checked RPCs for normal role list flows; do not use `createServiceRoleClient` in the role-management service.
  - [x] Reuse `getCurrentProfile`, `hasPermission`, `PERMISSION_DENIED_MESSAGE`, `PROFILE_UNAVAILABLE_MESSAGE`, `assignProfileRole`, `suspendProfileRole`, `removeProfileRole`, and `writeAuditLog` patterns already established in `server/services/auth/permissions.ts` and the Story 5.3/5.4 admin services.
  - [x] Return typed safe unions such as `roles`, `assignments`, `assigned`, `suspended`, `removed`, `unauthenticated`, `profile-unavailable`, `permission-denied`, `invalid-input`, and `role-unavailable`.
  - [x] Use narrow explicit contracts for role definitions, role assignments, target profiles, and property scope options. Avoid raw Supabase rows and generic blobs except for audit summaries.
  - [x] Audit assign/suspend/remove through the existing role mutation helpers or equivalent `writeAuditLog` calls. Include actor profile id, target profile id, role id/key, scope, scope id, status, assigned_by, assigned_at, removed_at, and reason. Do not include password/Auth/session data, payment data, document paths, message text, or service-role secrets.

- [x] Add admin role server actions and validation. (AC: 1, 2, 3)
  - [x] Add `server/actions/admin-roles.ts` with `"use server"`.
  - [x] Parse `FormData` defensively, ignore untrusted `communityId`, and resolve Spring Meadow Community server-side.
  - [x] Validate UUIDs, role keys against the role list returned by the server/RPC, scope (`community` or `property` for this story), optional property scope id, target profile id, assignment id, and reason text.
  - [x] Reject control characters, overly long search/reason values, arbitrary permission arrays, arbitrary JSON role blobs, and client-provided actor/assigned_by fields.
  - [x] Redirect to `/admin/roles` with safe query params such as `roleAction=assigned|suspended|removed|invalid|denied|unavailable` and an allow-listed optional `roleActionField`.
  - [x] Keep UI/action copy generic and accessible; never echo raw errors, permission arrays for unauthorized users, SQL function names, or authorization implementation details.

- [x] Build the admin role assignment page. (AC: 1, 2, 3)
  - [x] Add `app/(admin)/admin/roles/page.tsx` as a Server Component under the existing admin layout. Do not add a page-level `<main>`.
  - [x] Update `server/services/auth/admin-workspace.ts` and `tests/admin-workspace-shell.test.mjs` to add a `Roles` navigation item at `/admin/roles`, enabled only by `admin.roles.manage`, with `currentStatus: "available"`.
  - [x] Render an operational role-management surface: heading, filters/search, role definitions with permission summaries, assignment list/table, assign form, suspend/remove forms, scope selector, reason input, permission-aware empty states, and accessible action notices.
  - [x] Keep role permission arrays view-only. Do not add role creation, role deletion, or `roles.permissions` editing in this story unless an existing system role definition is corrected by migration. Permission definitions remain seeded/configured, while this story manages assignments.
  - [x] Cross-link to `/admin/users` where useful for profile/member context, but do not duplicate membership invite/update/status forms from Story 5.4.
  - [x] Use the existing admin visual language: dense but readable, restrained borders, `rounded-sm`, no marketing hero, no nested cards, no decorative gradients/orbs, no in-app feature explanations.
  - [x] Keep forms keyboard navigable with labels, unique IDs for repeated controls, `aria-live` notices, focus-visible controls, `min-w-0`, wrapping labels, and no text overflow on mobile.
  - [x] Prefer server-rendered forms. Add a client component only for a concrete interaction that cannot be handled with normal form posts.

- [x] Preserve existing auth, membership, role, and privacy boundaries. (AC: 1, 2, 3)
  - [x] Do not change Supabase Auth credential handling, `/login`, `app/auth/callback/route.ts`, `lib/supabase/proxy.ts`, or `server/services/auth/current-profile.ts`.
  - [x] Do not change property membership relationship/capability semantics in `property_memberships`; Story 5.4 owns membership management and Story 5.5 owns `profile_roles`.
  - [x] Do not let role assignment grant resident property access without an active `property_memberships` row where resident property data is involved. Roles and memberships remain separate authorization layers.
  - [x] Do not weaken `app.has_permission()` active-only behavior: suspended/removed role assignments must not grant permissions.
  - [x] Do not expose Auth internals, password/recovery/session/provider metadata, payment history, document storage paths, message bodies, guest payer contact data, Stripe identifiers, or raw audit row internals in the role UI.
  - [x] Do not import the admin role-management service into public, resident, guest, client, payment, document, message, or dashboard surfaces.

- [x] Add focused source tests. (AC: 1, 2, 3)
  - [x] Add `tests/admin-role-management.test.mjs`.
  - [x] Test that the migration reuses existing `roles` and `profile_roles`, creates permission-checked list/management RPCs, calls `app.current_profile_id()` and `app.has_permission(..., 'admin.roles.manage')`, validates community/scope/profile/role relationships, prevents self-lockout, revokes public/anon execution, grants authenticated execution, and avoids broad table grants.
  - [x] Test that the service is server-only, uses safe unions, calls role list RPCs and existing role mutation helpers or RPCs, prepares audit metadata, resolves Spring Meadow scope, and does not import service-role clients.
  - [x] Test that the actions parse explicit fields, reject arbitrary permissions/JSON blobs, ignore browser-provided `communityId`/actor fields, redirect with safe query params, and allow-list action field names.
  - [x] Test that `app/(admin)/admin/roles/page.tsx` imports the service/actions, renders role filters/list/assign/suspend/remove UI, renders permission-aware states, includes accessible labels/notices, and does not use page-level `<main>`.
  - [x] Test that `server/services/auth/admin-workspace.ts` exposes a Roles nav item through `admin.roles.manage`.
  - [x] Add negative assertions that public, guest, resident, shared client, payment, document, message, dashboard, property, and membership files do not import admin role-management internals or leak private role/profile data.
  - [x] Run `node --test tests/admin-role-management.test.mjs`, `npm test`, `npm run typecheck`, `npm run lint`, `npm run build`, and `git diff --check`.

### Review Findings

- [x] [Review][Patch] Self-lockout guard counts property-scoped role grants as community role-management grants [supabase/migrations/202605110021_role_assignment_management.sql:600]
- [x] [Review][Patch] Invalid role mutation states are collapsed into permission-denied results [server/services/auth/permissions.ts:219]
- [x] [Review][Patch] Remove-role audit before snapshot records the new removed_at timestamp [server/services/auth/permissions.ts:105]
- [x] [Review][Patch] Assignment pagination also paginates the assign-form target profile list [app/(admin)/admin/roles/page.tsx:621]
- [x] [Review][Patch] Property-scoped role assignment can only choose the first page of properties [supabase/migrations/202605110021_role_assignment_management.sql:379]
- [x] [Review][Patch] Self-lockout checks are vulnerable to concurrent removal of alternate admin grants [supabase/migrations/202605110021_role_assignment_management.sql:602]

## Dev Notes

Story 5.5 turns the role assignment foundation from Story 2.5 into an admin-facing operations workflow. The core risk is accidentally creating a second authorization model. The developer must reuse the existing role/profile-role schema and permission helpers, add safe admin list/read surfaces, harden mutation semantics, and build a focused assignment UI.

### Current State To Preserve

- `public.roles`
  - Current state: created in `supabase/migrations/202605100003_create_roles_and_profile_roles.sql` with `community_id`, `key`, `name`, `description`, `permissions text[]`, `system_role`, timestamps, and unique `(community_id, key)`.
  - Preserve: default seeded roles are `resident`, `board_member`, `admin`, `vendor_applicant`, `approved_vendor`, `pool_worker`, and `legal_reviewer`.
  - Change: role-management UI may list safe role definitions and permission keys to authorized `admin.roles.manage` users. Do not add browser-driven permission editing.

- `public.profile_roles`
  - Current state: links profiles to roles with `community_id`, `profile_id`, `role_id`, `scope`, `scope_id`, `status`, `assigned_by`, `assigned_at`, `removed_at`, timestamps, scope/status checks, and unique `(community_id, profile_id, role_id, scope, scope_id)`.
  - Preserve: only `status = 'active'` grants permissions.
  - Change: admin workflow should list assignments and call safe assign/suspend/remove mutations.

- `app.has_permission()` and `public.has_permission()`
  - Current state: evaluates the current active profile through `app.current_profile_id()`, active `profile_roles`, matching role community, permission arrays, and community/scope matching.
  - Preserve: do not replace with `is_admin`, client-side booleans, Auth metadata, or profile status alone.
  - Change: role management may add tests/guards around role mutations but must keep existing authorization callers working.

- `server/services/auth/permissions.ts`
  - Current state: server-only `hasPermission`, `assignProfileRole`, `suspendProfileRole`, and `removeProfileRole` helpers. Role mutations require `admin.roles.manage`, call RPCs, return privacy-safe results, and write role audit summaries.
  - Preserve: existing callers and typed result shapes unless a narrowly required compatibility extension is needed.
  - Change: Story 5.5 can reuse these helpers from the new admin role-management service and may extend them to return richer invalid/unavailable states if needed.

- `server/services/audit/write-audit-log.ts`
  - Current state: server-only audit service writes to `audit_logs` through a trusted server client when available and otherwise returns a skipped result.
  - Preserve: no service-role imports in browser/client code. Do not surface audit insert failures to users as raw errors.
  - Change: role assignment UI/service must ensure enough role mutation metadata is passed for audit records.

- `server/services/auth/admin-workspace.ts`
  - Current state: admin nav includes Dashboard, Properties, Users, Payments, Assessments, Documents, Announcements, Events, Messages, Compliance Calendar, Records Requests, Audit Logs, and Settings. Settings is still planned.
  - Change: add `Roles` at `/admin/roles` with `permissionKey: "admin.roles.manage"` and `currentStatus: "available"`.
  - Preserve: workspace access still requires `board.workspace.access`; nav visibility is only a hint, while page/service/RPC permissions remain authoritative.

- `app/(admin)/admin/users/page.tsx`
  - Current state: manages profiles and property memberships, deliberately not roles.
  - Preserve: do not add role mutation controls here unless only adding a small cross-link to `/admin/roles`.
  - Change: Story 5.5 owns a separate role-management page to avoid mixing property membership permissions with role grants.

### Permission Model

- Use existing `admin.roles.manage` for role assignment and removal.
- Keep existing `board.workspace.access` as the admin layout entry permission. A user needs workspace access to reach admin routes and `admin.roles.manage` to enable the Roles nav/page data.
- Do not use `admin.users.manage` as the authority for role assignment. User management and role management are separate permissions.
- Do not treat `board_member` as equivalent to role management. A board member only manages roles if an active role assignment explicitly grants `admin.roles.manage`.
- Do not add broad permission wildcard semantics in this story.

### Suggested Output Contracts

Use explicit UI-friendly contracts. The exact names may differ, but keep the surface narrow:

```ts
type AdminRoleScope = "community" | "property";
type AdminRoleAssignmentStatus = "active" | "suspended" | "removed";

type AdminRoleDefinition = {
  id: string;
  key: string;
  name: string;
  description: string | null;
  permissions: string[];
  systemRole: boolean;
};

type AdminRoleProfileSummary = {
  id: string;
  displayName: string;
  email: string;
  status: "invited" | "active" | "suspended" | "disabled";
};

type AdminRoleAssignmentSummary = {
  id: string;
  communityId: string;
  profile: AdminRoleProfileSummary;
  role: AdminRoleDefinition;
  scope: AdminRoleScope;
  scopeId: string | null;
  scopeLabel: string;
  status: AdminRoleAssignmentStatus;
  assignedBy: string | null;
  assignedByLabel: string | null;
  assignedAt: string;
  removedAt: string | null;
  updatedAt: string;
};
```

### Validation Guardrails

- Normalize repeated whitespace in search/reason text.
- Reject control characters.
- Validate all IDs as UUIDs.
- Validate role keys against server-known roles; do not accept arbitrary permission arrays.
- Validate scope enum. For this story, expose only `community` and `property` scope controls.
- Treat blank optional scope id/reason as `null`.
- For `community` scope, never accept a browser-provided arbitrary scope id.
- For `property` scope, require a valid same-community property id.
- Return safe `invalid-input`/`role-unavailable` states instead of raw database errors or existence leaks.
- Prevent self-lockout before mutating an actor's own role assignment.

### Architecture Compliance

- Follow Next.js App Router route groups under `app/(admin)/admin`.
- Keep role list/mutation business logic in `server/services/admin/role-management.ts`.
- Keep form mutation parsing in `server/actions/admin-roles.ts`.
- Use user-scoped Supabase clients and permission-checked RPCs for normal admin role operations.
- Keep authorization layered: proxy verifies session, admin layout verifies workspace access, service/RPC verifies `admin.roles.manage`.
- Keep all records scoped to the Spring Meadow community by `community_id`.
- Keep sensitive role mutation handling server-side.
- Use RLS and security-definer RPCs as defense in depth; do not grant table access for convenience.

### UI Requirements

- The roles page should feel like an operations surface, not a marketing page.
- Use compact filters, dense lists/tables, and forms built for repeated admin use.
- Use a single top-level page layout under the admin layout; no nested cards inside cards.
- Provide useful empty states for no roles, no assignments, no matching filters, and permission denial.
- Show role permission keys only to authorized role managers, and keep them readable but secondary to assignment tasks.
- Keep labels, notices, controls, and table cells readable on mobile. Use `min-w-0`, wrapping text, and contained horizontal overflow only when deliberate.
- Use `aria-live` for assign/suspend/remove result notices.
- Use unique IDs for repeated controls, especially assignment row suspend/remove forms.
- Avoid exposing permission-check implementation details, SQL/RPC names, stack traces, token hashes, raw audit internals, or raw errors in visible UI.

### Latest Technical Information

- Local installed versions from `package-lock.json`: Next `^16.0.0`, React `^19.0.0`, TypeScript `^5.0.0`, Tailwind CSS `^4.0.0`, `@supabase/ssr` `^0.10.3`, and `@supabase/supabase-js` `^2.105.3`.
- Official Next.js App Router docs support Server Actions in form `action` attributes and emphasize validating/authenticating/authorizing sensitive server-side work before mutation.
- Official Supabase RLS docs emphasize enabling RLS on exposed-schema tables, granting only needed permissions, and using policies/security-definer helpers carefully for role checks.
- Official Supabase JavaScript docs support `supabase.rpc("function_name", args)` for Postgres functions, matching existing service/RPC patterns in this repo.

### Previous Story Intelligence

- Story 2.5 already created the role foundation. Reuse `roles`, `profile_roles`, `app.has_permission`, `public.has_permission`, `assign_profile_role`, `suspend_profile_role`, `remove_profile_role`, and `server/services/auth/permissions.ts`.
- Story 2.5 code review fixed community-scope duplication by requiring community-scoped profile roles to use the zero UUID sentinel. Preserve that invariant.
- Story 5.1 created the admin workspace shell and nav registry. Add the Roles nav item there; do not bypass the layout.
- Story 5.3 and Story 5.4 established admin service/action/page patterns: server-only services, permission-checked RPCs, defensive `FormData` parsing, safe redirect query params, dense accessible admin pages, and source tests.
- Story 5.4 deliberately excluded role assignment from `/admin/users`; keep membership capabilities and role grants separate.
- Story 5.4 review found invalid state transitions and unsafe query-param labels. For 5.5, make status transitions state-aware from the start and allow-list `roleActionField`.

### Project Structure Notes

- Add new role-specific files instead of modifying unrelated domains:
  - `supabase/migrations/202605110021_role_assignment_management.sql`
  - `server/services/admin/role-management.ts`
  - `server/actions/admin-roles.ts`
  - `app/(admin)/admin/roles/page.tsx`
  - `tests/admin-role-management.test.mjs`
- Update existing files only where role routing/navigation or shared role mutation hardening requires it:
  - `server/services/auth/admin-workspace.ts`
  - `tests/admin-workspace-shell.test.mjs`
  - possibly `server/services/auth/permissions.ts`
  - possibly `supabase/migrations/202605100003_create_roles_and_profile_roles.sql` only if a compatibility fix cannot be safely expressed in the new ordered migration; prefer new migrations for database changes.

### References

- [Epics: Story 5.5](_bmad-output/planning-artifacts/epics.md#story-55-role-assignment-and-permission-management)
- [Previous Story 5.4](_bmad-output/implementation-artifacts/5-4-user-and-membership-management.md)
- [Role Foundation Story 2.5](_bmad-output/implementation-artifacts/2-5-role-and-permission-assignment-foundation.md)
- [Architecture: Authorization Architecture](docs/bmad/phase-2-architecture/architecture.md#7-authorization-architecture)
- [API Design: Admin API](docs/bmad/phase-3-design/api.md#12-admin-api)
- [Data Model: Roles and Profile Roles](docs/bmad/phase-3-design/data-model.md#46-roles-and-profile_roles)
- [Data Model: Audit Logs](docs/bmad/phase-3-design/data-model.md#91-audit_logs)
- [Next.js Forms Guide](https://nextjs.org/docs/app/guides/forms)
- [Next.js `use server` Directive](https://nextjs.org/docs/app/api-reference/directives/use-server)
- [Supabase Row Level Security Docs](https://supabase.com/docs/guides/database/postgres/row-level-security)
- [Supabase RPC Docs](https://supabase.com/docs/client/rpc)

## Dev Agent Record

### Agent Model Used

GPT-5 Codex

### Debug Log References

- `node --test tests/admin-role-management.test.mjs` (red phase: expected missing implementation failures)
- `node --test tests/admin-role-management.test.mjs`
- `node --test tests/admin-workspace-shell.test.mjs`
- `npm run typecheck`
- `npm test`
- `npm run lint`
- `npm run build`
- `git diff --check`
- `node --test tests/admin-role-management.test.mjs tests/role-permission.test.mjs` (after code review chunk 1 patches)
- `npm run typecheck` (after code review chunk 1 patches)
- `npm test` (after code review chunk 1 patches)
- `npm run lint` (after code review chunk 1 patches)
- `npm run build` (after code review chunk 1 patches)
- `git diff --check` (after code review chunk 1 patches)
- `node --test tests/admin-role-management.test.mjs tests/admin-workspace-shell.test.mjs tests/role-permission.test.mjs` (after code review chunk 2 patches)
- `npm run typecheck` (after code review chunk 2 patches)
- `npm run lint` (after code review chunk 2 patches)
- `npm run build` (after code review chunk 2 patches)
- `git diff --check` (after code review chunk 2 patches)

### Completion Notes List

- Ultimate context engine analysis completed - comprehensive developer guide created.
- Added `202605110021_role_assignment_management.sql` with permission-checked role list/target RPCs and hardened `assign_profile_role`, `suspend_profile_role`, and `remove_profile_role` semantics on the existing `roles` and `profile_roles` tables.
- Added a server-only admin role management service with user-scoped Supabase list RPCs, safe typed unions, role-key validation through server-known role definitions, and existing audited role mutation helpers.
- Added defensive admin role server actions with explicit `FormData` parsing, safe redirect query params, ignored untrusted community ids, and rejection of arbitrary permission/role JSON/actor fields.
- Added `/admin/roles` as a server-rendered operations page with filters, role permission summaries, assignment management forms, property/community scopes, accessible notices, and permission-aware empty states.
- Added the Roles admin nav item gated by `admin.roles.manage`.
- Added focused source tests and verified role-management internals do not leak into public, resident, guest, shared client, payment, document, message, dashboard, property, or membership surfaces.
- Code review chunk 1 patches resolved: self-lockout checks now require alternate community-scoped role-management grants, and role mutation helpers preserve safe invalid/unavailable states instead of collapsing them to denied.
- Code review chunk 2 patches resolved: remove-role audit snapshots preserve previous `removed_at`, assignment target lists no longer share assignment pagination, property scope options are not truncated by target pagination, and self-lockout checks serialize concurrent self-removal requests.

### File List

- `_bmad-output/implementation-artifacts/5-5-role-assignment-and-permission-management.md`
- `_bmad-output/implementation-artifacts/sprint-status.yaml`
- `app/(admin)/admin/roles/page.tsx`
- `server/actions/admin-roles.ts`
- `server/services/admin/role-management.ts`
- `server/services/auth/admin-workspace.ts`
- `server/services/auth/permissions.ts`
- `supabase/migrations/202605110021_role_assignment_management.sql`
- `tests/admin-role-management.test.mjs`
- `tests/admin-workspace-shell.test.mjs`
- `tests/role-permission.test.mjs`

### Change Log

- 2026-05-18: Implemented Story 5.5 role assignment and permission management; status moved to review.
- 2026-05-18: Addressed code review chunk 2 patches and marked Story 5.5 done.
