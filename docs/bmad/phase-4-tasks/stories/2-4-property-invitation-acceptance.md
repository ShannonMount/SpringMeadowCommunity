# Story 2.4: Property Invitation Acceptance

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As an invited resident,
I want to accept an invitation to a property,
so that I can securely link my account to the correct HOA property.

## Acceptance Criteria

1. Given an invited user receives a valid invitation token, when they authenticate and accept the invitation before expiration, then the membership status changes to active, and the accepted timestamp and invitation metadata are preserved.
2. Given an invitation token is expired, invalid, already accepted, or intended for a different recipient, when the user attempts to accept it, then the system rejects the request with a privacy-safe accessible error, and no property owner, balance, document, or payment history is exposed.
3. Given a property has invitation permissions configured, when a user without invitation authority attempts to invite or accept on behalf of another user, then the action is denied, and the denial is handled consistently by the authorization layer.

## Tasks / Subtasks

- [x] Add secure invitation token persistence. (AC: 1, 2, 3)
  - [x] Add a new ordered Supabase/Postgres migration after `202605100001_create_properties_and_memberships.sql`.
  - [x] Add a minimal `property_invitation_tokens` table or locally consistent equivalent for hashed invitation tokens; do not store plaintext invitation tokens.
  - [x] Link invitation tokens to `property_memberships.id`, `community_id`, `property_id`, invited email, optional inviter profile, expiration, accepted timestamp, revoked timestamp, created timestamp, and updated timestamp.
  - [x] Enforce uniqueness for active token hashes and preserve the existing `property_memberships.invited_by`, `invited_at`, and `accepted_at` metadata.
  - [x] Enable RLS on the invitation-token table and avoid resident self-read policies that reveal invitation metadata before token validation.
  - [x] Do not add Resend email delivery, admin invitation management UI, roles/profile roles, payments, documents, dashboard data, or audit logs in this story.
- [x] Implement token hashing and validation helpers. (AC: 1, 2)
  - [x] Add a server-only invitation service, for example `server/services/auth/property-invitations.ts`.
  - [x] Use Node crypto or a standard Web Crypto-compatible helper server-side to hash incoming tokens before lookup; never log or persist plaintext tokens.
  - [x] Add a typed `acceptPropertyInvitation(token)` function or server action wrapper that validates authentication, active profile, token hash, expiration, recipient email, membership status, property status, and revoked/accepted state.
  - [x] Treat expired, invalid, already accepted, revoked, wrong-recipient, missing profile, blocked profile, inactive property, and non-invited membership cases as privacy-safe rejection states.
  - [x] On success, update the membership from `invited` to `active`, set `accepted_at`, preserve `invited_by`/`invited_at`, and mark the invitation token accepted.
  - [x] Ensure acceptance is conflict-safe/idempotent under repeated submission; only one valid accept should activate the invited membership.
- [x] Add an authenticated invitation acceptance route/UI. (AC: 1, 2)
  - [x] Add a route such as `app/(resident)/portal/invitations/accept/page.tsx` or a locally consistent resident route.
  - [x] Require a token parameter, validate it server-side through the invitation service, and render only generic success/error messages.
  - [x] Preserve unauthenticated redirect behavior to `/login` with a safe `next` path back to the acceptance route.
  - [x] Do not render property owner, balance, payment history, private documents, message contents, account number, board/admin data, or raw token details.
  - [x] Provide accessible feedback: one page-level heading, readable success/error copy, keyboard-operable actions, and no implementation jargon.
- [x] Enforce invitation authority boundaries. (AC: 3)
  - [x] Use the Story 2.3 `can_invite_members` membership permission as the resident-side authority signal for invitation-related checks.
  - [x] Add a helper such as `canInvitePropertyMembers(propertyId)` or equivalent server-only check that requires an active profile, active property membership, active property, and `can_invite_members = true`.
  - [x] If adding a token creation helper for tests/future admin flows, keep it server-only and require invitation authority; do not expose an invitation creation UI in this story.
  - [x] Deny unauthorized invitation actions with the same privacy-safe error shape and without revealing whether the target property or membership exists.
  - [x] Do not implement board/admin role permissions yet; Story 2.5 owns role and permission assignment foundation.
- [x] Preserve current auth/profile/property behavior. (AC: 1, 2, 3)
  - [x] Preserve `/login`, Supabase SSR helpers, `proxy.ts`, auth callback handling, and sign-in/sign-out.
  - [x] Preserve `getCurrentProfile()` blocked states from Story 2.2.
  - [x] Preserve `getCurrentPropertyMemberships()` and `canAccessProperty()` active-only property access from Story 2.3.
  - [x] Keep public pages, public contact, public pay dues, and vendor placeholder unauthenticated.
  - [x] Do not introduce a Supabase service-role client into browser/client code.
- [x] Extend verification. (AC: 1, 2, 3)
  - [x] Add focused tests or guardrails for invitation-token schema, token hashing, privacy-safe invalid states, successful membership activation, and authority checks.
  - [x] Add tests proving expired, invalid, reused/accepted, revoked, wrong-recipient, inactive property, non-invited membership, and unauthorized inviter paths do not expose property owner, balance, payment history, private documents, messages, account number, or raw token values.
  - [x] Add tests proving successful acceptance updates membership status to active and accepted timestamps while preserving invitation metadata.
  - [x] Preserve Story 2.1, 2.2, and 2.3 guardrail tests.
  - [x] Run `npm test`, `npm run typecheck`, `npm run lint`, and `npm run build`.
  - [x] Manually verify unauthenticated invitation acceptance redirects to login, invalid token renders generic error, and accepted invitation renders generic success if local fixtures or mocks can exercise them without real private data.

### Review Findings

- [x] [Review][Patch] Invitation acceptance RPC is defined in non-exposed `app` schema [server/services/auth/property-invitations.ts:55]
- [x] [Review][Patch] Login redirect drops invitation token for unauthenticated users [lib/supabase/proxy.ts:13]

## Dev Notes

Story 2.4 is the first invited-resident onboarding story. It should let an authenticated resident accept a valid property invitation while keeping token handling, recipient checks, and membership activation server-side.

The central discipline: invitation acceptance may activate an existing invited `property_memberships` row, but it must not become an admin membership-management system, email-delivery system, resident dashboard, role system, or payment/document gateway.

### Current Files To Update

- `server/services/auth/property-memberships.ts`
  - Current state: server-only resolver for active property memberships, returning safe property context and permission booleans; includes `canAccessProperty(propertyId)`.
  - Change: preserve active-only access. Optionally add or reuse an invitation-authority helper requiring active membership and `can_invite_members`.
- `app/(resident)/portal/page.tsx`
  - Current state: resolves active profile, then active property memberships; renders generic no-property state or linked property list with safe fields only.
  - Possible change: usually none unless adding a safe link to an invitation acceptance route. Do not show pending invitations or private property details here.
- `server/services/auth/current-profile.ts`
  - Current state: verifies Supabase Auth with `auth.getUser()` and returns typed active/missing/blocked/error profile states.
  - Change: none expected. Reuse it for recipient/profile identity.
- `supabase/migrations/202605100001_create_properties_and_memberships.sql`
  - Current state: creates minimal `communities`, `properties`, `property_memberships`, active-only RLS, and helper functions.
  - Change: do not edit unless a later migration must reference existing structures. Prefer a new migration for invitation tokens.
- Existing tests:
  - `tests/auth-session.test.mjs`, `tests/profile-resolution.test.mjs`, and `tests/property-membership.test.mjs` must continue to pass.
  - Add a companion invitation test file rather than weakening prior guardrails.

### New Files Likely Needed

- `supabase/migrations/<timestamp>_create_property_invitation_tokens.sql`
  - New migration for hashed invitation-token persistence, RLS, token status/metadata, indexes, and active-token constraints.
- `server/services/auth/property-invitations.ts`
  - Server-only token hashing, validation, acceptance, and invitation-authority helpers.
- `server/actions/property-invitations.ts` or colocated route action
  - Optional server action wrapper if the acceptance route needs form submission.
- `app/(resident)/portal/invitations/accept/page.tsx`
  - Authenticated acceptance surface with generic success/error states.
- `tests/property-invitation.test.mjs`
  - Focused guardrails for schema, token safety, server service behavior, route gating, and privacy boundaries.

### Scope Boundary

In scope:

- Hashed invitation token storage/validation.
- Authenticated invitation acceptance for an existing invited membership.
- Recipient check against the authenticated profile email.
- Expiration, accepted/reused, revoked, inactive property, wrong-recipient, and non-invited membership rejection.
- Updating membership status to `active` and setting `accepted_at`.
- Preserving invitation metadata (`invited_by`, `invited_at`, token accepted timestamp).
- Server-only invitation authority helper using active membership + `can_invite_members`.
- Tests for private-data non-disclosure.

Out of scope:

- Admin/board invitation creation UI.
- Resend email sending or invitation email templates.
- Role/permission tables and `hasPermission()`.
- Full user/membership admin management.
- Audit log implementation.
- Resident dashboard, property detail page, payment data, document access, messages, announcements/events inside the portal, or board/admin workspace.
- Guest payment lookup changes.

### Technical Requirements

- Use Next.js + TypeScript App Router and existing Supabase SSR helpers.
- Use Supabase Auth identity and Story 2.2 `getCurrentProfile()` as the authenticated profile source.
- Use Story 2.3 property membership schema and helpers as the authorization foundation.
- Invitation tokens must be high-entropy values at issuance time and stored only as hashes. This story may implement the acceptance/validation hash path and a server-only creation helper for tests/future flows.
- Token comparison should use a deterministic cryptographic hash lookup; avoid logging tokens, embedding tokens in rendered output, or storing plaintext.
- Recipient validation must compare the invitation intended email to the authenticated active profile email in a normalized/case-insensitive way.
- Only `property_memberships.status = 'invited'` can transition to `active` through acceptance.
- `accepted_at` should be set with the database clock or server timestamp, and the token record should also record acceptance so repeated submissions are rejected generically.
- Acceptance must verify the related property is active and not deleted.
- Do not rely on client-provided profile IDs, membership IDs, property IDs, or recipient emails for authorization.
- Error and denied states must be generic and privacy-safe.

### Architecture Compliance

- Layered authorization remains: authenticated user, active profile, property membership state, invitation token validation, then later role/workflow checks.
- Private actions/routes must read Supabase session server-side and resolve the current profile before mutation.
- Property invitation acceptance must verify token, expiration, recipient, and membership state.
- `can_invite_members` is the only membership-level invite authority available before Story 2.5. Do not invent role permissions early.
- RLS should be enabled on any new private invitation-token table. Application service code may perform mutation server-side through existing Supabase SSR client/RLS-compatible paths.
- Do not broaden Proxy into invitation validation; route/server action code should own token validation.

### UX and Accessibility Requirements

- Invitation acceptance screens must use one clear heading and readable success/error copy.
- Invalid, expired, reused, wrong-recipient, revoked, unauthorized, and inactive-property states should collapse to generic copy such as "This invitation cannot be accepted. Please contact the HOA for help."
- Success copy may say the resident account has been linked, but should not reveal owner name, balance, private documents, payment history, message content, or board/admin data.
- Preserve keyboard-operable controls and visible focus states.
- Do not render plaintext tokens, token hashes, membership IDs, or raw Supabase errors.
- Keep mobile layouts stable and avoid overlapping content.

### Testing Requirements

- Follow the existing lightweight Node/file-content guardrail style unless stronger tests exist by implementation time.
- Minimum checks:
  - Migration creates `property_invitation_tokens` or equivalent with token hash, membership/property/community linkage, invited email, expires/accepted/revoked timestamps, and RLS enabled.
  - Invitation service is server-only, hashes tokens, and does not persist/log plaintext.
  - Acceptance service uses `getCurrentProfile()`, checks normalized profile email against invited email, requires invited membership status, active property, unexpired/unaccepted/unrevoked token, and updates membership/token accepted timestamps.
  - Invitation authority helper requires active property membership and `can_invite_members = true`.
  - Acceptance route redirects unauthenticated users to login with a safe `next` path and renders generic success/error states.
  - Files do not include property owner display, balance, payment history, private documents, message contents, board/admin-only data, service-role imports in client/browser code, raw token rendering, or raw provider errors.
- Required verification commands:
  - `npm test`
  - `npm run typecheck`
  - `npm run lint`
  - `npm run build`

### Previous Story Intelligence

- Story 2.1 established `/login`, Supabase SSR helpers, auth callback handling, sign-in/sign-out, and protected `/portal` routing.
- Story 2.2 added `getCurrentProfile()` and profile-gated portal behavior. Reuse this instead of duplicating profile lookup.
- Story 2.3 added minimal `communities`, `properties`, `property_memberships`, `app.current_profile_id()`, `app.can_access_property()`, `server/services/auth/property-memberships.ts`, and active-only portal property context.
- Story 2.3 intentionally did not implement invitation token storage, invitation acceptance, email delivery, roles, audit logs, payments, documents, or dashboard data. Story 2.4 may add token storage and acceptance only.
- Current membership fields available for invitation acceptance: `status`, `invited_by`, `invited_at`, `accepted_at`, `removed_at`, and permission booleans including `can_invite_members`.
- Existing tests are fast Node file-content guardrails and do not import TypeScript modules directly.
- Supabase migrations have been created but not necessarily applied to a live/local database from these sessions.
- The worktree contains older uncommitted Epic 1 and Epic 2 changes. Do not revert unrelated dirty files.
- The project currently has no `project-context.md`.

### Latest Technical Information

- Continue using `@supabase/ssr` and the existing `lib/supabase/server.ts` helper for server-side Supabase access.
- Next.js Server Components and Server Actions can validate invitation state before rendering or mutating; keep sensitive validation server-side.
- Use server-only modules (`import "server-only"`) for hashing, token lookup, and mutation logic.
- If using Node `crypto`, keep the module server-only so no crypto/token code is bundled to the browser.

### Project Context Reference

- No `project-context.md` file was found.

### References

- [Epics: Story 2.4](/home/smount/Websites/SpringMeadowCommunity/_bmad-output/planning-artifacts/epics.md)
- [Previous Story 2.3](/home/smount/Websites/SpringMeadowCommunity/_bmad-output/implementation-artifacts/2-3-property-membership-model.md)
- [Previous Story 2.2](/home/smount/Websites/SpringMeadowCommunity/_bmad-output/implementation-artifacts/2-2-application-profile-resolution.md)
- [Architecture: Property Membership](/home/smount/Websites/SpringMeadowCommunity/docs/bmad/phase-2-architecture/architecture.md)
- [Architecture: Authorization Architecture](/home/smount/Websites/SpringMeadowCommunity/docs/bmad/phase-2-architecture/architecture.md)
- [API Design: Profile and Invitation Acceptance](/home/smount/Websites/SpringMeadowCommunity/docs/bmad/phase-3-design/api.md)
- [Data Model: Property Memberships](/home/smount/Websites/SpringMeadowCommunity/docs/bmad/phase-3-design/data-model.md)
- [Tasks v1: Property Membership Auth](/home/smount/Websites/SpringMeadowCommunity/docs/bmad/phase-4-tasks/tasks-v1.md)

## Dev Agent Record

### Agent Model Used

GPT-5 Codex

### Debug Log References

- 2026-05-10: Red phase confirmed `tests/property-invitation.test.mjs` failed before the invitation migration, service, and acceptance route existed.
- 2026-05-10: Verification passed with `npm test`, `npm run typecheck`, `npm run lint`, and `npm run build`.

### Implementation Plan

- Add an ordered migration for hashed invitation-token persistence, RLS, and a security-definer acceptance function that validates current profile, recipient email, invited membership state, active property state, expiration, and reused/revoked token state.
- Implement a server-only invitation service that hashes incoming tokens, calls the database acceptance function, returns privacy-safe result states, and exposes `canInvitePropertyMembers()` using active membership plus `can_invite_members`.
- Add a protected resident invitation acceptance route with generic success/error states and safe login redirect behavior.
- Extend guardrail tests for schema, hashing, acceptance, authority checks, route behavior, and private-data non-disclosure.

### Completion Notes List

- Ultimate context engine analysis completed - comprehensive developer guide created.
- Implemented hashed property invitation token persistence with token hash, membership/property/community links, invited email, inviter metadata, expiration, accepted/revoked timestamps, RLS, and active-token uniqueness.
- Added `public.accept_property_invitation()` as a security-definer database boundary so invitation metadata is not directly readable by residents before token validation.
- Added server-only invitation hashing, acceptance, and invitation authority helpers with generic unavailable/unauthorized states.
- Added the authenticated `/portal/invitations/accept` route with safe login redirect, generic success/error UI, and no private property/payment/document details.
- Added Story 2.4 guardrail tests and preserved prior Story 2.1-2.3 test coverage.
- Resolved review finding by exposing the invitation acceptance RPC through the public schema for Supabase RPC access.
- Resolved review finding by preserving invitation query parameters through unauthenticated login redirects.

### File List

- `_bmad-output/implementation-artifacts/2-4-property-invitation-acceptance.md`
- `docs/bmad/phase-4-tasks/stories/2-4-property-invitation-acceptance.md`
- `_bmad-output/implementation-artifacts/sprint-status.yaml`
- `docs/bmad/phase-4-tasks/sprint-status.yaml`
- `app/(resident)/portal/invitations/accept/page.tsx`
- `server/services/auth/property-invitations.ts`
- `supabase/migrations/202605100002_create_property_invitation_tokens.sql`
- `tests/property-invitation.test.mjs`
- `lib/supabase/proxy.ts`
- `tests/auth-session.test.mjs`

### Change Log

- 2026-05-10: Created Story 2.4 context for property invitation acceptance.
- 2026-05-10: Implemented property invitation token persistence, secure acceptance, invitation authority helper, protected acceptance UI, and verification guardrails.
- 2026-05-10: Addressed code review findings for RPC schema exposure and invitation token redirect preservation.
