# Story 5.4: User and Membership Management

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As an admin,
I want to manage users and property memberships,
so that resident access matches the HOA property records.

## Acceptance Criteria

1. Given an admin has user/property membership permission, when they view a property or user record, then they can see linked memberships, relationship type, status, invitation metadata, accepted date, and membership capability flags, and the view is scoped to the current community.
2. Given an admin invites, activates, suspends, removes, or updates a membership, when the action succeeds, then membership status and relevant metadata are updated, and sensitive membership changes are prepared for audit logging.
3. Given an admin attempts to create duplicate membership for the same profile and property, when the action is submitted, then the system prevents the duplicate, and presents an accessible conflict message.

## Tasks / Subtasks

- [x] Add permission-scoped admin membership RPCs on existing profile/property membership tables. (AC: 1, 2, 3)
  - [x] Add the next ordered migration after `supabase/migrations/202605110019_property_management.sql`, for example `supabase/migrations/202605110020_user_membership_management.sql`.
  - [x] Reuse the existing `admin.users.manage` permission seeded to the `admin` role in `supabase/migrations/202605100003_create_roles_and_profile_roles.sql`; do not add `admin.memberships.manage`, `properties:read`, or broad board access in this story.
  - [x] Keep using existing `profiles`, `properties`, `property_memberships`, and `property_invitation_tokens`; do not create duplicate user, resident, property-user, or membership tables.
  - [x] Add security-definer RPCs such as `public.list_admin_users`, `public.list_admin_memberships`, `public.invite_admin_property_member`, `public.update_admin_property_membership`, `public.activate_admin_property_membership`, `public.suspend_admin_property_membership`, and `public.remove_admin_property_membership`, or a smaller locally consistent set that covers the same states.
  - [x] Every RPC must resolve the active `spring-meadow-community` community or accept a validated target community, call `app.current_profile_id()`, and check `app.has_permission(target_community_id, 'admin.users.manage')` before reading or mutating user/profile/membership data.
  - [x] Revoke public/anon execution and grant execute only to `authenticated`; do not grant broad direct table access to `profiles`, `properties`, `property_memberships`, `property_invitation_tokens`, `profile_roles`, `roles`, `payments`, `documents`, `message_threads`, or `audit_logs`.
  - [x] Preserve existing resident membership RLS from `202605100001_create_properties_and_memberships.sql` and invitation acceptance behavior from `202605100002_create_property_invitation_tokens.sql`.

- [x] Implement membership list and mutation semantics without weakening resident access boundaries. (AC: 1, 2, 3)
  - [x] List views may return profile identity summary fields needed by admin operations: profile id, display name, email, status, and membership counts/statuses. Do not return `auth.users`, password/auth metadata, session state, recovery tokens, provider identities, or raw Supabase Auth details.
  - [x] Property-focused views must include linked memberships with `relationship`, `status`, `can_view_balance`, `can_pay_dues`, `can_view_documents`, `can_invite_members`, `invited_by`, `invited_at`, `accepted_at`, `removed_at`, and safe profile summary fields.
  - [x] User-focused views must include the same membership metadata grouped by linked property, with safe property summary fields from the admin roster contract. Do not expose payment history, document storage paths, message bodies, guest payer contacts, Stripe identifiers, or audit row internals.
  - [x] Invite must first match an existing non-deleted profile by normalized email. If no profile exists, create or invite the Supabase Auth user through a tiny server-only Auth admin helper that imports `createServiceRoleClient` from `lib/supabase/service-role.ts` only after `admin.users.manage` authorization succeeds.
  - [x] When Auth admin invitation creates a new Auth user, create the corresponding `profiles` row with status `invited` or the repo's closest safe local pattern. If Auth/user/profile creation fails, do not create a half-linked membership.
  - [x] Invite may create or reactivate an `invited` `property_memberships` row and, if using the existing invitation acceptance flow, create a hashed `property_invitation_tokens` row. Never store plaintext invitation tokens.
  - [x] Activate must transition an invited/suspended membership to `active`, set `accepted_at` only when appropriate, and clear `removed_at`.
  - [x] Suspend must set `status = 'suspended'` while preserving the durable membership row and historical timestamps.
  - [x] Remove must set `status = 'removed'`, set `removed_at = now()`, and exclude removed memberships from normal resident access and default admin views unless an explicit removed filter is selected.
  - [x] Update must allow relationship and capability flags only. It must not assign board/admin/vendor/legal roles; Story 5.5 owns role assignment and `profile_roles`.
  - [x] Duplicate membership for the same `community_id`, `property_id`, and `profile_id` must return a safe conflict result. Do not surface raw constraint names or SQL error messages.

- [x] Add a server-only admin user membership service. (AC: 1, 2, 3)
  - [x] Add `server/services/admin/user-membership-management.ts` with `import "server-only"`.
  - [x] Use user-scoped Supabase clients from `lib/supabase/server.ts` and permission-checked RPCs for normal list/mutation flows; isolate any required `createServiceRoleClient` usage to the Auth admin invite helper after authorization succeeds.
  - [x] Reuse `getCurrentProfile`, `hasPermission`, `PROFILE_UNAVAILABLE_MESSAGE`, `PERMISSION_DENIED_MESSAGE`, and `writeAuditLog` patterns from `server/services/admin/property-management.ts`, `server/services/auth/permissions.ts`, and `server/services/audit/write-audit-log.ts`.
  - [x] Return typed safe unions such as `users`, `memberships`, `invited`, `updated`, `activated`, `suspended`, `removed`, `unauthenticated`, `profile-unavailable`, `permission-denied`, `invalid-input`, `conflict`, and `membership-unavailable`.
  - [x] Use narrow, explicit contracts for admin user summaries, property summaries, and membership rows. Avoid generic `Record<string, unknown>` payloads except for audit summaries.
  - [x] Prepare audit logging for invite/update/activate/suspend/remove with before/after summaries. Include relationship, status, capability flags, property id, target profile id/email, and invitation metadata; do not include plaintext tokens, raw errors, provider secrets, payment data, document paths, or message text.

- [x] Add admin membership actions and validation. (AC: 2, 3)
  - [x] Add `server/actions/admin-users.ts` with `"use server"`.
  - [x] Parse `FormData` defensively, ignore untrusted `communityId`, and use the default `spring-meadow-community` community resolution path unless a validated internal id is supplied by the server.
  - [x] Validate UUIDs, email addresses, membership status (`invited`, `active`, `suspended`, `removed`), relationship (`owner`, `co_owner`, `resident`, `renter`, `manager`, `family`, `other`), capability booleans, and optional reason text.
  - [x] Treat unchecked checkbox fields as `false`; do not accept arbitrary JSON capability blobs from the browser.
  - [x] Redirect back to `/admin/users` with safe status/query params such as `userAction=invited|updated|activated|suspended|removed|invalid|denied|unavailable|conflict` and an optional safe field key.
  - [x] Keep UI copy generic and accessible; never include raw SQL constraint names, stack traces, `error.message`, token values, or authorization implementation details.

- [x] Replace the `/admin/users` placeholder with the real user and membership management page. (AC: 1, 2, 3)
  - [x] Update `app/(admin)/admin/users/page.tsx` as a Server Component that calls the new admin membership service.
  - [x] Keep the route under the existing `app/(admin)/admin/layout.tsx` guard and `components/admin/admin-workspace-nav.tsx` navigation from Story 5.1.
  - [x] Render an operational user/membership surface: heading, user search/filter controls, user list or dense table, property membership details, invite/link form, relationship/capability controls, status filters, and useful empty states.
  - [x] Show the Users nav item as `available` and enabled through `admin.users.manage` in `server/services/auth/admin-workspace.ts`.
  - [x] Cross-link to `/admin/properties` where useful, but do not duplicate full property create/update/archive forms from Story 5.3.
  - [x] Display membership status and capability flags as admin context; do not add role assignment controls, role lists, or permission editing in this story.
  - [x] Use existing admin visual language: dense but readable, restrained borders, `rounded-sm`, no marketing hero, no nested cards, no decorative gradients/orbs, no in-app feature explanations.
  - [x] Keep forms keyboard navigable with labels, unique IDs for repeated row controls, `aria-live` notices for action results, focus-visible controls, `min-w-0`, wrapping labels, and no text overflow on mobile.
  - [x] Prefer server-rendered forms. Add a client component only for a concrete interaction that cannot be handled with normal form posts.

- [x] Preserve existing profile, property, invitation, role, resident, and privacy boundaries. (AC: 1, 2, 3)
  - [x] Do not change Supabase Auth credential handling, `/login`, `app/auth/callback/route.ts`, `lib/supabase/proxy.ts`, or `server/services/auth/current-profile.ts` unless a focused integration issue requires it.
  - [x] Do not change resident membership resolution in `server/services/auth/property-memberships.ts` except for a narrowly required compatibility fix.
  - [x] Do not change invitation acceptance semantics in `server/services/auth/property-invitations.ts` or `app/(resident)/portal/invitations/accept/page.tsx`; admin invitation creation must remain compatible with the existing hashed-token acceptance path.
  - [x] Do not change property CRUD semantics in `server/services/admin/property-management.ts`, `server/actions/admin-properties.ts`, or `app/(admin)/admin/properties/page.tsx` except for safe cross-links or read-only membership counts.
  - [x] Do not change `assignProfileRole`, `suspendProfileRole`, `removeProfileRole`, or role management RPCs; Story 5.5 owns role and permission management UI.
  - [x] Keep suspended/removed memberships out of resident portal reads, resident dues/payment access, resident document access, resident message property selection, and active property detail reads.
  - [x] Avoid direct UI-level fetching from `profiles`, `properties`, `property_memberships`, or `property_invitation_tokens`; the admin page should use the new service.

- [x] Add focused static/source tests. (AC: 1, 2, 3)
  - [x] Add `tests/admin-user-membership-management.test.mjs`.
  - [x] Test that the migration reuses `admin.users.manage`, creates permission-checked RPCs, calls `app.current_profile_id()` and `app.has_permission(..., 'admin.users.manage')`, scopes every query/mutation by `community_id`, preserves the unique membership constraint, soft-removes with `status = 'removed'` and `removed_at`, revokes public execution, grants authenticated execution, and does not grant broad direct table access.
  - [x] Test that the service is server-only, uses safe unions, calls the admin membership RPCs, prepares audit logging, resolves/uses Spring Meadow scope, and keeps any Auth admin/service-role usage isolated behind an authorization-first server-only invitation path.
  - [x] Test that the actions parse explicit fields, reject arbitrary capability JSON, redirect with safe query params, and never trust browser-provided private fields.
  - [x] Test that `app/(admin)/admin/users/page.tsx` imports the service/actions, replaces the placeholder, renders search/filter/list/invite/update/status UI, renders empty and permission-aware states, includes accessible labels/notices, and does not use page-level `<main>`.
  - [x] Test that `server/services/auth/admin-workspace.ts` marks Users `available` through `admin.users.manage`.
  - [x] Add negative assertions that public, guest, resident, shared client, admin navigation, payment, document, message, role-management, and dashboard files do not import admin membership internals or leak private profile/membership data.
  - [x] Run `node --test tests/admin-user-membership-management.test.mjs`, `npm test`, `npm run typecheck`, `npm run lint`, `npm run build`, and `git diff --check`.

### Review Findings

- [x] [Review][Patch] Activate RPC can reactivate removed memberships [supabase/migrations/202605110020_user_membership_management.sql:616]
- [x] [Review][Patch] Status mutation audit summaries omit required membership metadata [server/services/admin/user-membership-management.ts:1093]
- [x] [Review][Patch] Membership details omit required invitation and removal metadata [app/(admin)/admin/users/page.tsx:471]
- [x] [Review][Patch] Membership action controls expose invalid status transitions [app/(admin)/admin/users/page.tsx:402]
- [x] [Review][Patch] Removed membership status filter still excludes removed rows [supabase/migrations/202605110020_user_membership_management.sql:245]
- [x] [Review][Patch] Memberships RPC lacks direct query length guard [supabase/migrations/202605110020_user_membership_management.sql:180]
- [x] [Review][Patch] Action notice field accepts arbitrary query param labels [app/(admin)/admin/users/page.tsx:153]

## Dev Notes

Story 5.4 turns the safe `/admin/users` placeholder from Story 5.1 into the first real admin user/property membership workflow. The high-risk mistakes are duplicating the existing membership model, mixing membership management with role assignment, leaking profile/property details to resident or public surfaces, storing plaintext invitation tokens, and weakening resident active-membership boundaries.

### Current State To Preserve

- `public.profiles`
  - Current state: created in `supabase/migrations/202605080001_create_profiles.sql`; `server/services/auth/current-profile.ts` resolves only active, non-deleted profiles through Supabase Auth.
  - Preserve: Supabase Auth owns credentials in `auth.users`; application code must not store or expose password hashes, recovery tokens, provider identities, or session details in admin membership UI.
  - Change: admin user list may expose safe profile summary fields only to `admin.users.manage`. Admin invite may create an invited profile only through a server-only Auth admin path that also creates the Supabase Auth user.

- `public.properties`
  - Current state: durable property roster from `202605100001_create_properties_and_memberships.sql`, with admin CRUD from `202605110019_property_management.sql`.
  - Preserve: do not create duplicate property records or mutate financial/balance fields in this story.
  - Change: user membership UI may read safe admin property summaries to link memberships.

- `public.property_memberships`
  - Current state: links profiles to properties with `relationship`, `status`, capability flags, invitation metadata, timestamps, and unique `(community_id, property_id, profile_id)`.
  - Preserve: resident access depends on `status = 'active'` plus active, non-deleted properties.
  - Change: add admin-controlled list and mutation boundaries around the existing table.

- `public.property_invitation_tokens`
  - Current state: hashed-token table plus `public.accept_property_invitation()`; acceptance requires active profile, matching email, invited membership, active property, unexpired/unaccepted/unrevoked token.
  - Preserve: no plaintext token persistence; generic invalid invitation states.
  - Change: admin invite flow can create tokens for invited memberships if the implementation includes invitation email/link creation.

- `public.roles` and `public.profile_roles`
  - Current state: `admin.users.manage` already exists on the admin role; role mutation helpers require `admin.roles.manage`.
  - Preserve: no role assignment or permission editing in Story 5.4. Story 5.5 owns role assignment.
  - Change: Users nav should become available through `admin.users.manage`.

- `app/(admin)/admin/users/page.tsx`
  - Current state: generic `AdminPlaceholderSection`.
  - Change: replace with the real user/membership management page.
  - Preserve: keep the page under the existing admin layout and do not add a page-level `<main>`.

- `server/services/auth/admin-workspace.ts`
  - Current state: Users nav exists as `planned` and is permission-keyed by `admin.users.manage`.
  - Change: make Users `available` and keep `admin.users.manage` as its enablement permission.
  - Preserve: navigation remains a safe server-built hint; page/service/RPC permissions remain authoritative.

- `server/services/auth/property-memberships.ts`
  - Current state: active-only resident property membership resolver masks account numbers and returns capability flags for resident surfaces.
  - Preserve: residents must not see admin user lists, invitation metadata beyond their own acceptance flow, removed/suspended memberships, owner display names, or unrelated properties.

- `server/services/admin/property-management.ts`
  - Current state: property management service uses `admin.properties.manage`, permission-checked RPCs, safe unions, user-scoped Supabase client, and audit-log preparation.
  - Preserve: property CRUD remains separate from membership CRUD.
  - Change: use its patterns for service shape, validation, action redirects, UI notices, and tests.

### Permission Model

- Use existing `admin.users.manage` for admin user and property membership management.
- Authorize with `admin.users.manage` before any Supabase Auth admin invite call or service-role operation.
- Do not add or use `admin.roles.manage` for this story except to explicitly avoid role work.
- Do not use `property.members.invite` for admin membership management; that permission is a resident/board-side invitation capability from earlier stories.
- Do not grant `board_member` access to user/membership management unless the product owner explicitly expands this story beyond "As an admin".

### Suggested Output Contracts

Use narrow, UI-friendly contracts so the page receives exactly what it needs:

```ts
type AdminMembershipStatus = "invited" | "active" | "suspended" | "removed";
type AdminMembershipRelationship =
  | "owner"
  | "co_owner"
  | "resident"
  | "renter"
  | "manager"
  | "family"
  | "other";

type AdminUserSummary = {
  id: string;
  displayName: string;
  email: string;
  status: "invited" | "active" | "suspended" | "disabled";
  membershipCount: number;
  activeMembershipCount: number;
  invitedMembershipCount: number;
};

type AdminMembershipSummary = {
  id: string;
  communityId: string;
  property: {
    id: string;
    accountNumber: string;
    addressLine1: string;
    addressLine2: string | null;
    city: string;
    state: string;
    postalCode: string;
  };
  profile: {
    id: string;
    displayName: string;
    email: string;
    status: AdminUserSummary["status"];
  };
  relationship: AdminMembershipRelationship;
  status: AdminMembershipStatus;
  capabilities: {
    canViewBalance: boolean;
    canPayDues: boolean;
    canViewDocuments: boolean;
    canInviteMembers: boolean;
  };
  invitedBy: string | null;
  invitedAt: string | null;
  acceptedAt: string | null;
  removedAt: string | null;
  createdAt: string;
  updatedAt: string;
};
```

The exact shape may differ, but keep it explicit and stable. Avoid passing raw Supabase rows or generic blobs to the page.

### Validation Guardrails

- Normalize repeated whitespace in display name/search/reason text.
- Reject control characters.
- Validate email format conservatively and compare existing invitation recipient email case-insensitively.
- Validate all IDs as UUIDs.
- Validate enum/status inputs against the existing database values only.
- Treat blank optional fields as `null`.
- Treat checkbox absence as `false`; do not trust hidden boolean strings without validation.
- For duplicate membership conflicts, return a safe `conflict` state keyed to `profileId` or `email`, not raw database constraint details.

### Architecture Compliance

- Follow Next.js App Router route groups under `app/(admin)/admin`.
- Keep business logic in `server/services/admin/user-membership-management.ts`.
- Keep form mutation parsing in `server/actions/admin-users.ts`.
- Use user-scoped Supabase clients and permission-checked RPCs for normal admin membership operations.
- Keep authorization layered: proxy verifies session, layout verifies workspace access, service/RPC verifies `admin.users.manage`.
- Keep all records scoped to the Spring Meadow community by `community_id`.
- Keep sensitive invite/token handling server-side.
- Do not weaken existing RLS policies or grant broad table access for admin convenience.

### UI Requirements

- The users page should feel like an operations surface, not a marketing page.
- Use compact filters, dense lists/tables, and forms built for repeated admin use.
- Provide useful empty states for no users, no memberships, no matching filters, and permission denial.
- Avoid nested cards. Repeated rows/forms may use restrained borders and `rounded-sm`.
- Keep labels, notices, controls, and table cells readable on mobile. Use `min-w-0`, wrapping text, and horizontal overflow only when deliberate and contained.
- Use `aria-live` for invite/update/status result notices.
- Use unique IDs for repeated controls, especially membership row update/suspend/remove/activate forms.
- Avoid exposing permission keys, SQL/RPC names, stack traces, token hashes, or raw errors in visible UI.

### Latest Technical Information

- Local installed versions from `package-lock.json`: Next `16.2.4`, React `19.2.5`, `@supabase/ssr` `0.10.3`, `@supabase/supabase-js` `2.105.3`, Resend `6.12.3`, Stripe `22.1.1`.
- Official Next App Router docs list the current App Router latest version as `16.2.2`, while this repo currently resolves Next `16.2.4`; follow local lockfile behavior for implementation.
- Official Next data-fetching docs support database access in Server Components because query logic and credentials stay out of the client bundle, but still require proper authentication and authorization.
- Official Next updating-data and `use server` docs support Server Functions/Actions for form submissions and emphasize validating input, authenticating/authorizing sensitive operations, and returning only the data the UI needs.
- Official Supabase RLS docs reinforce enabling RLS on exposed tables, using `TO authenticated` policies intentionally, and treating security-definer functions carefully. For this story, keep admin membership access behind permission-checked RPCs instead of broad table grants.
- Official Supabase JavaScript docs support calling Postgres functions with `supabase.rpc(...)`, matching this repo's service/RPC pattern.
- Official Supabase Auth docs describe Auth users as records in the Auth schema tied to access tokens and RLS policies. Do not expose Auth internals in the admin UI.
- Official Supabase `inviteUserByEmail` docs describe an admin API for sending email invite links. If this story uses it, isolate it to a server-only, authorization-first path because Supabase admin APIs require privileged server-side handling.

### Previous Story Intelligence

- Story 5.1 created the admin shell and placeholder `/admin/users` page. Replace only the users placeholder in this story.
- Story 5.1 established that admin pages should not render their own `<main>` because the admin layout owns the main landmark.
- Story 5.2 showed that section permission gates are not enough by themselves; every query and returned field must match the actor's permission.
- Story 5.3 introduced `admin.properties.manage` and real property CRUD. Reuse its service/action/page/test patterns, but do not modify property financial fields or rebuild property management.
- Story 5.3 explicitly left user/property membership management to Story 5.4. It should now become legal to link memberships, but property create/update/archive remains Story 5.3.
- Story 2.4 owns invitation acceptance through hashed tokens. Admin invite creation must feed that existing acceptance path or stay as an invited membership status without pretending email delivery is complete.
- Story 2.5 owns role and permission assignment foundation; Story 5.5 owns admin role assignment UI. Keep role assignment out of Story 5.4.
- Story 4.8 and 5.3 code review lessons: repeated row forms need unique IDs, and list pages must not silently hide records after the first page. Include pagination or bounded result handling.
- Stories 3.8, 3.9, 5.2, and 5.3 use source-inspection tests for admin permissions, RPCs, privacy boundaries, and route integration. Follow that style.

### Testing Requirements

- Follow the existing `node:test` source-inspection style with `assert`, `readFileSync`, `existsSync`, recursive file listing helpers, regex assertions, and order checks where guard order matters.
- Add positive tests for migration/RPC permission checks, server-only service, server actions, `/admin/users` page, nav availability, duplicate conflict handling, soft removal, invitation compatibility, and safe empty/permission states.
- Add negative privacy tests across public, resident, guest, shared client, dashboard, payment, document, message, property, role-management, and nav files.
- Run focused tests first, then the full suite and quality commands listed in Tasks.

### Project Structure Notes

- Add or update:
  - `supabase/migrations/202605110020_user_membership_management.sql`
  - `server/services/admin/user-membership-management.ts`
  - `server/actions/admin-users.ts`
  - `app/(admin)/admin/users/page.tsx`
  - `server/services/auth/admin-workspace.ts`
  - `tests/admin-user-membership-management.test.mjs`
- Touch only if required for safe cross-links or compatibility:
  - `server/services/auth/property-invitations.ts`
  - `server/services/auth/property-memberships.ts`
  - `server/services/admin/property-management.ts`
  - `app/(admin)/admin/properties/page.tsx`
- Do not add new dependencies for tables, forms, validation, icons, or email unless the user explicitly approves it.
- No `project-context.md` file was found under the project root during story creation.

### References

- [Epic 5 and Story 5.4 Source](/home/smount/Websites/SpringMeadowCommunity/_bmad-output/planning-artifacts/epics.md)
- [Previous Story 5.3](/home/smount/Websites/SpringMeadowCommunity/_bmad-output/implementation-artifacts/5-3-property-management.md)
- [Previous Story 5.2](/home/smount/Websites/SpringMeadowCommunity/_bmad-output/implementation-artifacts/5-2-admin-dashboard-summary.md)
- [Previous Story 2.4](/home/smount/Websites/SpringMeadowCommunity/_bmad-output/implementation-artifacts/2-4-property-invitation-acceptance.md)
- [Requirements: Property-Centered Accounts and Role Model](/home/smount/Websites/SpringMeadowCommunity/docs/bmad/phase-1-requirements/requirements.md)
- [Requirements: Authentication and Accounts](/home/smount/Websites/SpringMeadowCommunity/docs/bmad/phase-1-requirements/requirements.md)
- [Requirements: Admin Tools](/home/smount/Websites/SpringMeadowCommunity/docs/bmad/phase-1-requirements/requirements.md)
- [Architecture: Property Membership and Audit Logging](/home/smount/Websites/SpringMeadowCommunity/docs/bmad/phase-2-architecture/architecture.md)
- [Architecture: Authorization and Board/Admin Access](/home/smount/Websites/SpringMeadowCommunity/docs/bmad/phase-2-architecture/architecture.md)
- [API Design: Admin API](/home/smount/Websites/SpringMeadowCommunity/docs/bmad/phase-3-design/api.md)
- [Data Model: Profiles](/home/smount/Websites/SpringMeadowCommunity/docs/bmad/phase-3-design/data-model.md)
- [Data Model: Property Memberships](/home/smount/Websites/SpringMeadowCommunity/docs/bmad/phase-3-design/data-model.md)
- [Data Model: Roles and Profile Roles](/home/smount/Websites/SpringMeadowCommunity/docs/bmad/phase-3-design/data-model.md)
- [Profile Migration](/home/smount/Websites/SpringMeadowCommunity/supabase/migrations/202605080001_create_profiles.sql)
- [Property Membership Migration](/home/smount/Websites/SpringMeadowCommunity/supabase/migrations/202605100001_create_properties_and_memberships.sql)
- [Property Invitation Migration](/home/smount/Websites/SpringMeadowCommunity/supabase/migrations/202605100002_create_property_invitation_tokens.sql)
- [Roles and Permissions Migration](/home/smount/Websites/SpringMeadowCommunity/supabase/migrations/202605100003_create_roles_and_profile_roles.sql)
- [Property Management Migration](/home/smount/Websites/SpringMeadowCommunity/supabase/migrations/202605110019_property_management.sql)
- [Current Profile Service](/home/smount/Websites/SpringMeadowCommunity/server/services/auth/current-profile.ts)
- [Resident Membership Service](/home/smount/Websites/SpringMeadowCommunity/server/services/auth/property-memberships.ts)
- [Property Invitation Service](/home/smount/Websites/SpringMeadowCommunity/server/services/auth/property-invitations.ts)
- [Permission Service](/home/smount/Websites/SpringMeadowCommunity/server/services/auth/permissions.ts)
- [Audit Log Helper](/home/smount/Websites/SpringMeadowCommunity/server/services/audit/write-audit-log.ts)
- [Admin Workspace Context](/home/smount/Websites/SpringMeadowCommunity/server/services/auth/admin-workspace.ts)
- [Admin Users Placeholder](/home/smount/Websites/SpringMeadowCommunity/app/(admin)/admin/users/page.tsx)
- [Admin Property Management Service](/home/smount/Websites/SpringMeadowCommunity/server/services/admin/property-management.ts)
- [Next.js Fetching Data Docs](https://nextjs.org/docs/app/getting-started/fetching-data)
- [Next.js Updating Data Docs](https://nextjs.org/docs/app/getting-started/updating-data)
- [Next.js use server Docs](https://nextjs.org/docs/app/api-reference/directives/use-server)
- [Supabase Row Level Security Docs](https://supabase.com/docs/guides/database/postgres/row-level-security)
- [Supabase JavaScript RPC Docs](https://supabase.com/docs/reference/javascript/rpc)
- [Supabase Auth Users Docs](https://supabase.com/docs/guides/auth/users)
- [Supabase Auth Admin Invite Docs](https://supabase.com/docs/reference/javascript/auth-admin-inviteuserbyemail)

## Dev Agent Record

### Agent Model Used

GPT-5 Codex

### Debug Log References

- `node --test tests/admin-user-membership-management.test.mjs`
- `npm run typecheck`
- `npm test`
- `npm run lint`
- `git diff --check`
- `npm run build`
- `node --test tests/admin-user-membership-management.test.mjs` (after chunk 1 review patches)
- `npm run typecheck` (after chunk 1 review patches)
- `npm test` (after chunk 1 review patches)
- `git diff --check` (after chunk 1 review patches)
- `node --test tests/admin-user-membership-management.test.mjs` (after chunk 2 review patches)
- `npm run typecheck` (after chunk 2 review patches)
- `npm test` (after chunk 2 review patches)
- `npm run lint` (after chunk 2 review patches)
- `git diff --check` (after chunk 2 review patches)
- `npm run build` (after chunk 2 review patches)
- `node --test tests/admin-user-membership-management.test.mjs` (after chunk 3 review patches)
- `npm run typecheck` (after chunk 3 review patches)
- `npm test` (after chunk 3 review patches)
- `npm run lint` (after chunk 3 review patches)
- `git diff --check` (after chunk 3 review patches)
- `npm run build` (after chunk 3 review patches)

### Completion Notes List

- Ultimate context engine analysis completed - comprehensive developer guide created.
- Story 5.4 is scoped to admin user and property membership management, not role assignment or property CRUD.
- Reuses existing `admin.users.manage` rather than introducing a new membership permission.
- Preserves resident active-membership boundaries and existing hashed invitation acceptance flow.
- Requires audit-log preparation for invite/update/activate/suspend/remove membership changes.
- Added permission-checked admin user and membership RPCs on the existing profile/property membership tables, with community scoping, soft removal, duplicate conflict handling, hashed invitation token support, and authenticated-only execution grants.
- Added a server-only admin user membership service with typed safe unions, user-scoped RPC flows, authorization-first Auth admin invitation/profile creation, and audit-log summaries for invite/update/activate/suspend/remove.
- Added defensive admin membership server actions with explicit `FormData` parsing, UUID/email/relationship/capability validation, safe redirects, and generic accessible outcomes.
- Replaced the `/admin/users` placeholder with a server-rendered operations page for user filters, profile/membership status filters, invite/link forms, membership updates, status actions, pagination, permission states, empty states, and accessible notices.
- Enabled the Users admin nav item through `admin.users.manage` while keeping role assignment and permission editing out of this story.
- Added focused source tests covering RPC permissions, service/action/page integration, navigation availability, pagination/status filter guardrails, audit status summaries, and privacy-boundary negative assertions.
- Code review chunk 1 patches resolved: activation now rejects non-invited/non-suspended memberships, and mutation audit summaries now carry RPC-provided relationship, capability, and invitation metadata.
- Code review chunk 2 patches resolved: the admin users page now renders invited-by and removed metadata, status action controls are state-aware, and removed membership status mutations are rejected server-side.
- Code review chunk 3 patches resolved: explicit removed membership filters now include removed rows, the memberships RPC validates direct query length, and action notice field labels are allow-listed.

### File List

- `_bmad-output/implementation-artifacts/5-4-user-and-membership-management.md`
- `_bmad-output/implementation-artifacts/sprint-status.yaml`
- `app/(admin)/admin/users/page.tsx`
- `server/actions/admin-users.ts`
- `server/services/admin/user-membership-management.ts`
- `server/services/auth/admin-workspace.ts`
- `supabase/migrations/202605110020_user_membership_management.sql`
- `tests/admin-user-membership-management.test.mjs`

### Change Log

- 2026-05-17: Implemented Story 5.4 user and membership management and marked ready for review.
