# Story 5.6: Community Settings Management

Status: ready-for-dev

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As an admin,
I want to configure community settings,
so that payment options, fee policy, compliance defaults, feature flags, and branding can be managed without code changes.

## Acceptance Criteria

1. Given an admin has settings permission, when they update payment settings, then fee policy, card enablement, ACH enablement, and guest payment enablement are validated and saved, and payment flows read the updated settings.
2. Given an admin updates compliance defaults, when they save meeting notice, financial statement, records request, lien-readiness, pre-lien, or enforcement-deadline settings, then values are validated and stored for future compliance calculations, and existing records are not silently rewritten unless an explicit recalculation workflow is used.
3. Given an admin updates branding or feature flags, when the settings are saved, then the community-scoped configuration is updated, and unauthorized users cannot change settings.

## Tasks / Subtasks

- [ ] Add permission-scoped admin settings RPC coverage on existing community tables. (AC: 1, 2, 3)
  - [ ] Add the next ordered migration after `supabase/migrations/202605110021_role_assignment_management.sql`, for example `supabase/migrations/202605110022_community_settings_management.sql`.
  - [ ] Reuse existing `public.communities` and `public.community_settings`; do not create duplicate settings, feature flag, branding, payment option, or compliance-default tables.
  - [ ] Add `admin.settings.manage` to the existing `admin` role only. Do not add it to `resident`, `board_member`, vendor, pool, or legal reviewer roles unless a later story explicitly expands settings authority.
  - [ ] Add permission-checked RPCs such as `public.get_admin_community_settings` and `public.update_admin_community_settings`, or a smaller locally consistent set that reads and mutates the same settings surface.
  - [ ] Every settings RPC must resolve the active `spring-meadow-community` community or accept a validated target community, call `app.current_profile_id()`, and check `app.has_permission(target_community_id, 'admin.settings.manage')` before returning or mutating settings.
  - [ ] Revoke public/anon execution and grant execute only to `authenticated` for new settings RPCs. Do not grant direct broad select/update access on `communities`, `community_settings`, `roles`, `profile_roles`, `payments`, `properties`, compliance tables, documents, messages, `audit_logs`, or Auth tables.
  - [ ] If a `community_settings` row is missing for the Spring Meadow community, create it with existing database defaults before returning settings; do not leave payment flows without settings.

- [ ] Implement settings validation and mutation semantics. (AC: 1, 2, 3)
  - [ ] Payment settings must validate `fee_policy`, `allow_card`, `allow_ach`, and `guest_payments_enabled`. The safest MVP UI options for `fee_policy` are `payer_pays` and `hoa_pays`; if `configurable` is exposed, document and test that current payment services intentionally treat it as payer-pays until configurable fee rules exist.
  - [ ] Do not expose or mutate `stripe_account_mode` or `stripe_connected_account_id` in this story unless the implementation also validates Stripe Connect account behavior end-to-end. Existing payment services already read these fields.
  - [ ] Compliance defaults must validate integer ranges and relationships: meeting notice earliest/latest days, annual financial statement due days, unpaid assessment statement due business days, delinquent days past due, lien-readiness days past due, pre-lien notice wait days, and lien enforcement deadline years.
  - [ ] Meeting notice defaults must preserve the North Carolina default shape of earliest notice before latest notice (`60` and `10` days). Reject values where latest notice is later than earliest notice.
  - [ ] Community fiscal-year settings live on `public.communities`; if surfaced, validate month/day pairs as real calendar dates and keep fiscal year close usable by future annual financial statement calculations.
  - [ ] Branding updates must validate `public_display_name`, optional `logo_url`, optional `primary_color`, and optional `secondary_color` on `public.communities`. Keep color inputs to a safe format such as `#RRGGBB`; do not allow arbitrary CSS or scriptable values.
  - [ ] Feature flags must be an allow-listed boolean map in `community_settings.feature_flags`. Do not accept arbitrary JSON blobs from the browser. Preserve unknown existing keys unless the admin explicitly changes an allow-listed key.
  - [ ] Do not silently recalculate or rewrite existing assessments, property summaries, delinquency reports, compliance events, message records, annual financial statement cycles, records requests, or legal-sensitive workflow records when settings change. Future calculations may use the new values; explicit recalculation workflows are out of scope.
  - [ ] Mutation results must be privacy-safe: no raw SQL errors, constraint names, stack traces, permission internals, Stripe account secrets, service-role details, or unrelated community/profile existence leaks.

- [ ] Add a server-only admin community settings service. (AC: 1, 2, 3)
  - [ ] Add `server/services/admin/community-settings.ts` with `import "server-only"`.
  - [ ] Use user-scoped Supabase clients from `lib/supabase/server.ts` and permission-checked RPCs for normal settings reads and mutations. Do not import `createServiceRoleClient` in this service.
  - [ ] Reuse `getCurrentProfile`, `hasPermission`, `PERMISSION_DENIED_MESSAGE`, `PROFILE_UNAVAILABLE_MESSAGE`, and `writeAuditLog` patterns from existing admin services.
  - [ ] Return typed safe unions such as `settings`, `updated`, `unauthenticated`, `profile-unavailable`, `permission-denied`, `invalid-input`, and `settings-unavailable`.
  - [ ] Use narrow explicit contracts for payment settings, compliance settings, branding settings, feature flags, and audit summaries. Avoid raw Supabase rows and generic blobs except for controlled audit summaries.
  - [ ] Audit settings updates through `writeAuditLog` or equivalent RPC-side audit insertion. Include actor profile id, community id, before/after summaries, changed setting groups, and reason. Do not include service-role secrets, Stripe secret keys, raw connected-account secrets beyond the non-secret account id if it is ever touched, payment PII, document paths, message text, or Auth/session data.

- [ ] Add admin settings server actions and validation. (AC: 1, 2, 3)
  - [ ] Add `server/actions/admin-settings.ts` with `"use server"`.
  - [ ] Parse `FormData` defensively, ignore untrusted `communityId`, `actorProfileId`, `updatedBy`, permission arrays, and arbitrary JSON fields, and resolve Spring Meadow Community server-side.
  - [ ] Validate enum values, booleans, integer ranges, fiscal dates if exposed, hex colors, logo URLs, feature flag keys, and optional reason text.
  - [ ] Reject control characters, overly long display names/logo URLs/reason text, arbitrary permission arrays, arbitrary feature-flag JSON blobs, and client-provided audit/actor fields.
  - [ ] Redirect to `/admin/settings` with safe query params such as `settingsAction=updated|invalid|denied|unavailable` and an allow-listed optional `settingsActionField`.
  - [ ] Keep UI/action copy generic and accessible; never echo raw errors, SQL/RPC names, permission arrays for unauthorized users, or authorization implementation details.

- [ ] Replace the admin settings placeholder with the real settings page. (AC: 1, 2, 3)
  - [ ] Update `app/(admin)/admin/settings/page.tsx` as a Server Component under the existing admin layout. Do not add a page-level `<main>`.
  - [ ] Update `server/services/auth/admin-workspace.ts` and `tests/admin-workspace-shell.test.mjs` so the Settings nav item at `/admin/settings` is enabled by `admin.settings.manage` and has `currentStatus: "available"`.
  - [ ] Render a dense admin operations surface with sections for payment settings, compliance defaults, branding, and feature flags. Use server-rendered forms; add a client component only if a concrete interaction cannot be handled by normal form posts.
  - [ ] Show current values and saved-state notices, but do not expose unavailable module controls as if the module is implemented. Feature flags may be stored, but later module behavior remains out of scope.
  - [ ] Keep forms keyboard navigable with labels, fieldsets/legends for groups, unique IDs, `aria-live` notices, focus-visible controls, `min-w-0`, wrapping labels, and no text overflow on mobile.
  - [ ] Use the existing admin visual language: compact controls, restrained borders, `rounded-sm`, no marketing hero, no nested cards, no decorative gradients/orbs, and no in-app feature explanations.

- [ ] Preserve existing payment, compliance, messaging, auth, and privacy boundaries. (AC: 1, 2, 3)
  - [ ] Preserve existing payment services that read `community_settings`: `server/services/payments/resident-payment-session.ts`, `server/services/payments/guest-payment-session.ts`, `server/services/payments/guest-property-lookup.ts`, `server/services/payments/admin-payment-management.ts`, and Stripe webhook processing. Do not replace these with static config or public client reads.
  - [ ] Preserve delinquency and message settings consumers: `server/services/payments/delinquency-reporting.ts` and `server/services/messages/message-notifications.ts`.
  - [ ] Do not weaken Supabase Auth handling, `/login`, `app/auth/callback/route.ts`, `lib/supabase/proxy.ts`, or `server/services/auth/current-profile.ts`.
  - [ ] Do not change role assignment semantics in `profile_roles`; Story 5.5 owns role grants. This story only adds the `admin.settings.manage` permission seed and nav/page access.
  - [ ] Do not expose payment history, guest payer contact data, Stripe identifiers, document storage paths, message bodies, Auth internals, session/provider metadata, or raw audit rows in the settings UI.
  - [ ] Do not import the admin settings service into public, resident, guest, shared client, payment, document, message, dashboard, property, membership, or role-management surfaces.

- [ ] Add focused source tests. (AC: 1, 2, 3)
  - [ ] Add `tests/admin-community-settings.test.mjs`.
  - [ ] Test that the migration reuses `communities` and `community_settings`, adds `admin.settings.manage` only to the admin role, creates permission-checked settings RPCs, calls `app.current_profile_id()` and `app.has_permission(..., 'admin.settings.manage')`, validates payment/compliance/branding/feature inputs, revokes public/anon execution, grants authenticated execution, and avoids broad table grants.
  - [ ] Test that the service is server-only, uses safe unions, calls settings RPCs, prepares audit metadata, resolves Spring Meadow scope, and does not import service-role clients or leak raw errors/secrets.
  - [ ] Test that the actions parse explicit fields, reject arbitrary feature flag JSON/permission blobs/actor fields, ignore browser-provided `communityId`, redirect with safe query params, and allow-list action field names.
  - [ ] Test that `app/(admin)/admin/settings/page.tsx` imports the service/actions, replaces the placeholder, renders payment/compliance/branding/feature-flag groups, renders permission-aware states and accessible notices, and does not use page-level `<main>`.
  - [ ] Test that `server/services/auth/admin-workspace.ts` exposes Settings through `admin.settings.manage` with `currentStatus: "available"`.
  - [ ] Add negative assertions that public, guest, resident, shared client, payment, document, message, dashboard, property, membership, and role-management files do not import admin settings internals or expose private settings data.
  - [ ] Run `node --test tests/admin-community-settings.test.mjs`, `npm test`, `npm run typecheck`, `npm run lint`, `npm run build`, and `git diff --check`.

## Dev Notes

Story 5.6 turns the existing settings schema into an admin-facing workflow. The main implementation risk is creating a second settings model or changing calculation behavior as a side effect of saving defaults. The developer must update the existing `communities` and `community_settings` records, keep authorization server-side, and let existing payment/compliance/message consumers continue reading the same database fields.

### Current State To Preserve

- `public.community_settings`
  - Current state: created in `supabase/migrations/202605110003_create_community_payment_settings_for_sessions.sql` with `community_id`, `stripe_account_mode`, `stripe_connected_account_id`, `fee_policy`, `allow_card`, `allow_ach`, `guest_payments_enabled`, meeting notice defaults, annual financial statement due days, unpaid assessment statement due business days, lien-readiness/pre-lien/enforcement defaults, `feature_flags`, timestamps, RLS enabled, and no broad anon/authenticated table grants.
  - Later migrations added `manual_payments_enabled`, `delinquent_days_past_due`, `message_notifications_enabled`, and `message_retention_days`. Preserve these columns and their existing consumers.
  - Change: add permission-checked admin read/update RPCs. Do not grant direct table access for settings management.

- `public.communities`
  - Current state: created in `supabase/migrations/202605100001_create_properties_and_memberships.sql` with community identity, jurisdiction, timezone, fiscal-year start/end month/day, public display name, logo URL, primary/secondary colors, status, and timestamps.
  - Change: branding and optional fiscal-year settings may be updated here. Keep updates scoped to the Spring Meadow community and avoid hardcoding display values outside seed/configuration data.

- Payment settings consumers
  - `server/services/payments/resident-payment-session.ts` reads `fee_policy`, `allow_card`, `allow_ach`, `stripe_account_mode`, and `stripe_connected_account_id` for resident payment sessions, and reads `allow_card`/`allow_ach` for resident payment option display.
  - `server/services/payments/guest-payment-session.ts` reads `fee_policy`, `allow_card`, `allow_ach`, `guest_payments_enabled`, and Stripe account fields for guest checkout sessions.
  - `server/services/payments/guest-property-lookup.ts` reads `guest_payments_enabled` before creating guest lookup sessions.
  - `server/services/payments/admin-payment-management.ts` reads `manual_payments_enabled` and `fee_policy` for admin-recorded payments.
  - Preserve: these services use trusted server code where needed and must keep privacy boundaries. Story 5.6 should make their existing DB reads reflect updated settings; do not replace them with static config or public client fetches.

- Compliance/message settings consumers
  - `server/services/payments/delinquency-reporting.ts` reads `delinquent_days_past_due` and `lien_readiness_days_past_due` for assessment summary and delinquency reporting behavior.
  - `server/services/messages/message-notifications.ts` reads `message_notifications_enabled`.
  - Future Epic 6/7 stories will read the meeting notice, records request, annual financial statement, pre-lien, and enforcement settings. This story stores the defaults but does not create those future workflows.

- `server/services/auth/admin-workspace.ts`
  - Current state: Settings exists at `/admin/settings` but is planned and has no permission key. Workspace access still requires `board.workspace.access`; nav visibility is not the authoritative security layer.
  - Change: make Settings available and permission-gated by `admin.settings.manage`. Page/service/RPC permissions remain authoritative.

- `app/(admin)/admin/settings/page.tsx`
  - Current state: placeholder using `AdminPlaceholderSection`.
  - Change: replace with a real server-rendered settings operations page. Keep the admin layout as the only `<main>`.

- `server/services/audit/write-audit-log.ts`
  - Current state: server-only audit service writes to `audit_logs` through a trusted server client when available and returns a skipped result if unavailable.
  - Change: settings update service/RPC should pass enough before/after context for audit without surfacing audit insert failures as raw user errors.

### Permission Model

- Add and use `admin.settings.manage` for community settings reads and writes.
- Keep `board.workspace.access` as the admin layout entry permission.
- Do not use `admin.roles.manage`, `admin.users.manage`, `admin.payments.manage`, or `audit.logs.view` as substitutes for settings management.
- Do not treat `board_member` as equivalent to settings management. A board member only manages settings if an active role assignment explicitly grants `admin.settings.manage`.
- Do not add wildcard permission semantics.

### Suggested Output Contracts

Use explicit UI-friendly contracts. Exact names may differ, but keep the surface narrow:

```ts
type AdminFeePolicy = "payer_pays" | "hoa_pays" | "configurable";

type AdminPaymentSettings = {
  feePolicy: AdminFeePolicy;
  allowCard: boolean;
  allowAch: boolean;
  guestPaymentsEnabled: boolean;
  manualPaymentsEnabled: boolean;
};

type AdminComplianceSettings = {
  meetingNoticeEarliestDays: number;
  meetingNoticeLatestDays: number;
  annualFinancialStatementDueDays: number;
  unpaidAssessmentStatementDueBusinessDays: number;
  delinquentDaysPastDue: number;
  lienReadinessDaysPastDue: number;
  preLienNoticeWaitDays: number;
  lienEnforcementDeadlineYears: number;
  messageNotificationsEnabled: boolean;
  messageRetentionDays: number;
};

type AdminBrandingSettings = {
  publicDisplayName: string;
  logoUrl: string | null;
  primaryColor: string | null;
  secondaryColor: string | null;
  fiscalYearStartMonth: number;
  fiscalYearStartDay: number;
  fiscalYearEndMonth: number;
  fiscalYearEndDay: number;
};

type AdminCommunitySettingsSummary = {
  communityId: string;
  communitySlug: string;
  payment: AdminPaymentSettings;
  compliance: AdminComplianceSettings;
  branding: AdminBrandingSettings;
  featureFlags: Record<string, boolean>;
  updatedAt: string;
};
```

### Validation Guardrails

- Normalize repeated whitespace in text fields and reasons.
- Reject control characters in all text inputs.
- Validate all IDs as UUIDs if any are accepted internally; normal browser actions should not need a user-provided `communityId`.
- Validate `fee_policy` against existing database values. If the UI allows `configurable`, tests must prove the effective payment behavior is intentional because existing payment services currently resolve `configurable` as payer-pays.
- Validate booleans from explicit checkbox fields; absence should mean false only for fields the form owns.
- Suggested integer bounds:
  - meeting notice earliest/latest days: `0..365`, with earliest >= latest.
  - annual financial statement due days: `1..365`.
  - unpaid assessment statement due business days: `1..120`.
  - delinquent days past due: `1..365`.
  - lien readiness days past due: `1..3650`.
  - pre-lien notice wait days: `1..365`.
  - lien enforcement deadline years: `1..30`.
  - message retention days: `0..36500`, where `0` means no retention-based purge behavior until a later purge workflow defines it.
- Validate fiscal month/day pairs as actual calendar dates if fiscal settings are editable.
- Validate logo URLs as blank/null, relative paths, or `https://` URLs. Do not allow `javascript:` or data URLs.
- Validate colors as `#RRGGBB` or blank/null. Do not accept arbitrary CSS values.
- Feature flags must be allow-listed boolean keys only. Suggested MVP storage keys: `community_posts`, `maintenance_requests`, `architectural_requests`, `vendor_proposals`, `vendor_invoices`, `pool_maintenance`, `financial_approvals`, and `multi_hoa_mode`. These flags should not imply the corresponding module is implemented.
- Return safe `invalid-input`/`settings-unavailable` states instead of raw database errors or existence leaks.

### Architecture Compliance

- Follow Next.js App Router route groups under `app/(admin)/admin`.
- Keep settings list/mutation business logic in `server/services/admin/community-settings.ts`.
- Keep form parsing in `server/actions/admin-settings.ts`.
- Use user-scoped Supabase clients and permission-checked RPCs for normal admin settings operations.
- Keep authorization layered: proxy verifies session, admin layout verifies workspace access, service/RPC verifies `admin.settings.manage`.
- Keep all records scoped to the Spring Meadow community by `community_id`.
- Use RLS and security-definer RPCs as defense in depth; do not grant table access for convenience.
- Do not introduce new dependencies for form handling, validation, state management, or UI controls unless existing repo patterns are insufficient.

### UI Requirements

- The settings page should feel like an admin operations form, not a marketing page.
- Use compact grouped forms, clear field labels, and saved-state notices. Avoid large hero layouts, decorative cards, or explanatory feature copy.
- Do not put cards inside cards. Use top-level sections or individual repeated items only where genuinely useful.
- Keep labels, helper text, notices, and controls readable on mobile. Use `min-w-0`, wrapping text, and deliberate overflow only for data that truly needs it.
- Use `aria-live` for update result notices.
- Use unique IDs for all form controls.
- Do not show SQL function names, permission-check implementation details, raw audit internals, raw errors, service-role environment names, or Stripe secret data in the UI.

### Latest Technical Information

- Local installed versions from `package-lock.json`: Next `16.2.4`, React `19.2.5`, TypeScript `5.9.3`, Tailwind CSS `4.2.4`, `@supabase/ssr` `0.10.3`, `@supabase/supabase-js` `2.105.3`, and Stripe `22.1.1`.
- Official Next.js App Router docs for the `use server` directive support Server Functions/Actions and emphasize authenticating and authorizing sensitive server-side work before mutation.
- Official Supabase RLS docs emphasize enabling RLS on exposed-schema tables and using policies/security-definer functions carefully; for this story, keep admin settings access behind permission-checked RPCs instead of broad table grants.
- Official Supabase JavaScript docs support `supabase.rpc("function_name", args)` for Postgres functions, matching existing service/RPC patterns in this repo.

### Previous Story Intelligence

- Story 5.1 created the admin workspace shell and a Settings placeholder. Replace only the settings page and nav metadata needed for this story; do not bypass the layout.
- Stories 5.3, 5.4, and 5.5 established admin service/action/page patterns: server-only services, permission-checked RPCs, defensive `FormData` parsing, safe redirect query params, dense accessible admin pages, and source tests.
- Story 5.4 review found invalid state transitions and unsafe query-param labels. For 5.6, make every redirect field allow-listed from the start.
- Story 5.5 review fixed self-lockout, privacy-safe mutation states, audit snapshot correctness, pagination coupling, and concurrent self-removal. For 5.6, avoid shared pagination coupling between unrelated settings groups and keep audit before/after snapshots precise.
- Existing payment stories already created `community_settings` and made resident/guest/admin payment flows read it. Do not reimplement those payment services; ensure the settings UI writes the fields they already consume.

### Project Structure Notes

- Add new settings-specific files instead of modifying unrelated domains:
  - `supabase/migrations/202605110022_community_settings_management.sql`
  - `server/services/admin/community-settings.ts`
  - `server/actions/admin-settings.ts`
  - `tests/admin-community-settings.test.mjs`
- Replace:
  - `app/(admin)/admin/settings/page.tsx`
- Update existing files only where routing/navigation or settings permission seeding requires it:
  - `server/services/auth/admin-workspace.ts`
  - `tests/admin-workspace-shell.test.mjs`
  - possibly payment/message/compliance tests if source assertions need to prove existing settings consumers still read `community_settings`.
- Prefer a new ordered migration for all database changes. Do not edit older migrations unless a compatibility fix cannot be safely expressed in the new migration.

### References

- [Epics: Story 5.6](_bmad-output/planning-artifacts/epics.md#story-56-community-settings-management)
- [Previous Story 5.5](_bmad-output/implementation-artifacts/5-5-role-assignment-and-permission-management.md)
- [Architecture: Board/Admin Access](docs/bmad/phase-2-architecture/architecture.md#74-boardadmin-access)
- [Architecture: Future Multi-HOA Readiness](docs/bmad/phase-2-architecture/architecture.md#25-future-multi-hoa-readiness)
- [Data Model: Communities](docs/bmad/phase-3-design/data-model.md#41-communities)
- [Data Model: Community Settings](docs/bmad/phase-3-design/data-model.md#42-community_settings)
- [Existing Community Settings Migration](supabase/migrations/202605110003_create_community_payment_settings_for_sessions.sql)
- [Manual Payments Settings Extension](supabase/migrations/202605110008_admin_payment_records_and_manual_payments.sql)
- [Delinquency Settings Extension](supabase/migrations/202605110009_delinquency_reporting_foundation.sql)
- [Message Settings Extension](supabase/migrations/202605110017_message_visibility_history_and_notifications.sql)
- [Next.js `use server` Directive](https://nextjs.org/docs/app/api-reference/directives/use-server)
- [Supabase Row Level Security Docs](https://supabase.com/docs/guides/database/postgres/row-level-security)
- [Supabase RPC Docs](https://supabase.com/docs/reference/javascript/rpc)

## Dev Agent Record

### Agent Model Used

GPT-5 Codex

### Debug Log References

### Completion Notes List

- Ultimate context engine analysis completed - comprehensive developer guide created.

### File List
