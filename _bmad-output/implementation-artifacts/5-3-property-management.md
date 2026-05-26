# Story 5.3: Property Management

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As an admin,
I want to create, update, archive, and view properties,
so that the HOA property roster is accurate and reusable for payments, memberships, documents, and compliance.

## Acceptance Criteria

1. Given an admin has property management permission, when they create a property, then the property stores account number, optional public payment code, status, address, county, mailing address, lot/parcel references, balance summary fields, and community scope, and account numbers are unique within the community.
2. Given an admin updates or archives a property, when the action succeeds, then the property record is updated or soft-archived, and sensitive changes are prepared for audit logging.
3. Given a user without property management permission attempts to create, edit, archive, or view the private property roster, when the action runs or the page renders, then the request is denied and no private property roster data is returned.

## Tasks / Subtasks

- [x] Add property management permission and safe property RPCs. (AC: 1, 2, 3)
  - [x] Add `supabase/migrations/202605110019_property_management.sql`.
  - [x] Seed `admin.properties.manage` onto the `admin` role only. Do not grant it to `board_member` unless the product owner explicitly expands this story beyond "As an admin".
  - [x] Keep using the existing `properties` table; do not create a duplicate property roster table.
  - [x] Add security-definer RPCs such as `public.list_admin_properties`, `public.create_admin_property`, `public.update_admin_property`, and `public.archive_admin_property`.
  - [x] Each RPC must resolve the active `spring-meadow-community` community or accept a validated community id/slug, call `app.current_profile_id()`, and check `app.has_permission(target_community_id, 'admin.properties.manage')` before reading or mutating private property roster data.
  - [x] Revoke public/anon execution and grant execute only to `authenticated`; do not grant broad direct table access to `properties`, `property_memberships`, `payments`, `assessments`, `documents`, `message_threads`, or `audit_logs`.
  - [x] Preserve existing resident property RLS behavior from `202605100001_create_properties_and_memberships.sql`.

- [x] Implement create/update/archive semantics without corrupting financial workflows. (AC: 1, 2)
  - [x] Create must insert `community_id`, normalized `account_number`, optional normalized `public_payment_code`, `status`, address fields, `county`, `mailing_address`, `owner_display_name`, `lot_number`, `parcel_number`, and `plat_reference`.
  - [x] Create must initialize balance summary fields safely: `current_balance_cents` defaults to `0`, `last_payment_at` defaults to `null`, `next_due_date` may be `null`, and `delinquency_status` defaults to `current` unless a validated existing status is explicitly supplied.
  - [x] Update must allow roster fields and status changes, but must not implement manual payment, assessment, allocation, receipt, or delinquency recalculation logic. Keep financial mutations in the existing payment/assessment/delinquency stories.
  - [x] Archive must soft-archive the property by setting `status = 'archived'`, setting `deleted_at = now()`, and excluding archived/deleted properties from normal admin lists unless an explicit archived filter is selected.
  - [x] Account number conflicts must return a safe conflict/invalid result, not a raw database error. `public_payment_code` conflicts must also return safe copy.
  - [x] Do not delete rows from `properties`; downstream records depend on durable property ids.

- [x] Add a server-only property management service. (AC: 1, 2, 3)
  - [x] Add `server/services/admin/property-management.ts` with `import "server-only"`.
  - [x] Use user-scoped Supabase clients from `lib/supabase/server.ts` and permission-checked RPCs; do not import `createServiceRoleClient` directly.
  - [x] Reuse `getCurrentProfile`, `hasPermission`, `PROFILE_UNAVAILABLE_MESSAGE`, and `PERMISSION_DENIED_MESSAGE` patterns where helpful, matching `server/services/auth/admin-workspace.ts` and `server/services/payments/assessment-management.ts`.
  - [x] Return typed safe unions such as `properties`, `created`, `updated`, `archived`, `unauthenticated`, `profile-unavailable`, `permission-denied`, `invalid-input`, `conflict`, and `property-unavailable`.
  - [x] Expose only the fields the admin UI needs. It may return private roster fields to authorized admins, but never raw Supabase errors, service-role state, audit row internals, payment provider fields, document storage paths, message bodies, or guest payer contact fields.
  - [x] Prepare audit logging for create/update/archive using the existing `writeAuditLog` helper or equivalent RPC audit inserts. Include before/after summaries for sensitive fields without writing provider secrets or raw errors.

- [x] Add admin property actions and validation. (AC: 1, 2, 3)
  - [x] Add `server/actions/admin-properties.ts` with `"use server"`.
  - [x] Parse `FormData` defensively, ignore untrusted `communityId`, and use the default `spring-meadow-community` community resolution path unless a validated internal id is already supplied by the server.
  - [x] Validate and normalize: account number, optional public payment code, property status (`active`, `inactive`, `archived` only), address line 1, address line 2, city, state, postal code, county, owner display name, lot number, parcel number, plat reference, next due date, and delinquency status.
  - [x] Represent `mailing_address` as a narrow object built from explicit form fields such as mailing address line 1/2, city, state, postal code, and county. Do not accept arbitrary JSON from the browser.
  - [x] Redirect back to `/admin/properties` with safe status/query params such as `propertyAction=created|updated|archived|invalid|denied|unavailable` and an optional safe field key.
  - [x] Keep returned UI copy generic and accessible; never include raw SQL constraint names, stack traces, or `error.message`.

- [x] Replace the `/admin/properties` placeholder with the real property management page. (AC: 1, 2, 3)
  - [x] Update `app/(admin)/admin/properties/page.tsx` as a Server Component that calls the new service.
  - [x] Keep the route under the existing `app/(admin)/admin/layout.tsx` guard and `components/admin/admin-workspace-nav.tsx` navigation from Story 5.1.
  - [x] Render an operational roster surface: heading, create-property form, status/search filters, property table or dense list, edit controls, archive controls, and useful empty states.
  - [x] Show account number and public payment code only to authorized admins on this page. Do not expose this roster data to public, resident, guest, shared client, or admin nav files.
  - [x] Display balance summary fields as admin context, but do not add manual balance/payment editing controls in this story.
  - [x] Use existing admin visual language: dense but readable, restrained borders, `rounded-sm`, no marketing hero, no nested cards, no decorative gradients/orbs, no in-app feature explanations.
  - [x] Keep forms keyboard navigable with labels, unique IDs for repeated row edit/archive controls, `aria-live` notices for action results, focus-visible controls, `min-w-0`, wrapping labels, and no text overflow on mobile.
  - [x] Update `server/services/auth/admin-workspace.ts` so the Properties nav item is `available` and enabled only with `admin.properties.manage`.

- [x] Preserve existing property consumers and privacy boundaries. (AC: 1, 2, 3)
  - [x] Do not change resident property detail behavior in `server/services/auth/resident-property-detail.ts` or `app/(resident)/portal/(member)/my-property/...` unless a focused integration issue requires it.
  - [x] Do not change guest property lookup semantics in `server/services/payments/guest-property-lookup.ts`; active, non-deleted properties with public payment codes must still work.
  - [x] Do not change payment, assessment, document, message, dashboard, auth redirect, or resident membership flows unless required for property management integration.
  - [x] Keep archived/deleted properties out of resident reads, guest payment lookup, normal dashboard active counts, and normal admin property lists.
  - [x] Avoid direct UI-level fetching from `properties`; the admin page should use the property management service.

- [x] Add focused static/source tests. (AC: 1, 2, 3)
  - [x] Add `tests/admin-property-management.test.mjs`.
  - [x] Test that the migration seeds `admin.properties.manage`, creates permission-checked RPCs, checks `app.current_profile_id()` and `app.has_permission(..., 'admin.properties.manage')`, scopes every query/mutation by `community_id`, soft-archives with `status = 'archived'` and `deleted_at`, revokes public execution, grants authenticated execution, and does not grant broad direct table access.
  - [x] Test that the service is server-only, uses safe unions, calls the property RPCs, prepares audit logging, resolves/uses Spring Meadow scope, and does not import service-role clients directly or expose raw errors.
  - [x] Test that the actions parse explicit form fields, reject arbitrary mailing-address JSON, redirect with safe query params, and never trust browser-provided private fields.
  - [x] Test that `app/(admin)/admin/properties/page.tsx` imports the service/actions, replaces the placeholder, renders create/update/archive UI, renders empty and permission-aware states, includes accessible form labels/notices, and does not use page-level `<main>`.
  - [x] Test that `server/services/auth/admin-workspace.ts` enables Properties through `admin.properties.manage`.
  - [x] Add negative assertions that public, guest, resident, shared client, admin navigation, payment, document, message, and dashboard files do not import property management internals or leak owner/account/payment-code roster data.
  - [x] Run `node --test tests/admin-property-management.test.mjs`, `npm test`, `npm run typecheck`, `npm run lint`, `npm run build`, and `git diff --check`.

### Review Findings

- [x] [Review][Patch] RPC/service accept arbitrary mailing_address JSON [supabase/migrations/202605110019_property_management.sql:220]
- [x] [Review][Patch] Property audit summaries omit mailing address changes [server/services/admin/property-management.ts:553]
- [x] [Review][Patch] Roster page silently hides properties after the first page [app/(admin)/admin/properties/page.tsx:550]

## Dev Notes

Story 5.3 turns the safe `/admin/properties` placeholder from Story 5.1 into the first real admin property roster workflow. The high-risk mistakes are bypassing property permissions, leaking account/public payment code data outside the admin page, corrupting payment/assessment-maintained balance fields, and breaking resident/guest property reads.

### Current State To Preserve

- `public.properties`
  - Current state: created in `supabase/migrations/202605100001_create_properties_and_memberships.sql` with `community_id`, `account_number`, optional `public_payment_code`, `status`, address fields, `mailing_address`, owner/lot/parcel/plat fields, balance summary fields, `delinquency_status`, timestamps, `deleted_at`, and unique `(community_id, account_number)`.
  - Preserve: durable property ids and existing constraints. Do not drop/recreate the table.
  - Change: add permission-checked admin RPCs around this existing table.

- `public.property_memberships`
  - Current state: links profiles to properties and powers resident access.
  - Preserve: Story 5.3 should not implement admin membership management; Story 5.4 owns user/property membership management.

- `app/(admin)/admin/properties/page.tsx`
  - Current state: generic placeholder using `AdminPlaceholderSection`.
  - Change: replace with the real property management page.
  - Preserve: keep the page under the existing admin layout and do not add a page-level `<main>`.

- `server/services/auth/admin-workspace.ts`
  - Current state: Properties nav exists but is `planned` and has no property-specific permission key.
  - Change: make Properties `available` and enable it through `admin.properties.manage`.
  - Preserve: navigation remains a safe server-built hint; page/service permissions remain authoritative.

- `server/services/auth/resident-property-detail.ts`
  - Current state: resident property details are scoped to active memberships and active, non-deleted properties, and mask account numbers.
  - Preserve: residents must not see admin roster fields or archived/deleted properties.

- `server/services/payments/guest-property-lookup.ts`
  - Current state: guest lookup uses service role internally, matches only active non-deleted properties, and can match by public payment code, account/postal, or address/postal without exposing property details.
  - Preserve: no private lookup details are exposed; public payment code changes from admin property management must keep this flow working.

- `server/services/admin/dashboard-summary.ts` and `supabase/migrations/202605110018_admin_dashboard_summary.sql`
  - Current state: property aggregate summary is workspace-gated and aggregate-only.
  - Preserve: do not duplicate dashboard UI in the property management page. Normal active property counts should continue excluding archived/deleted properties.

### Permission Model

- Add exactly one new permission for this story: `admin.properties.manage`.
- Seed it to the `admin` role.
- Use it for list, create, update, archive, and Properties nav enablement.
- Do not add `board.properties.view`, `properties:read`, or broad board access in this story unless the product owner asks. The data model docs mention `properties:read` as an example policy name, but this codebase uses dotted permission keys such as `admin.payments.manage`, `admin.documents.manage`, and `board.workspace.access`.

### Data Contract Guidance

A practical admin property row can include:

```ts
type AdminPropertySummary = {
  id: string;
  communityId: string;
  accountNumber: string;
  publicPaymentCode: string | null;
  status: "active" | "inactive" | "archived";
  addressLine1: string;
  addressLine2: string | null;
  city: string;
  state: string;
  postalCode: string;
  county: string | null;
  mailingAddress: {
    line1?: string;
    line2?: string;
    city?: string;
    state?: string;
    postalCode?: string;
    county?: string;
  } | null;
  ownerDisplayName: string | null;
  lotNumber: string | null;
  parcelNumber: string | null;
  platReference: string | null;
  currentBalanceCents: number;
  lastPaymentAt: string | null;
  nextDueDate: string | null;
  delinquencyStatus: "current" | "due_soon" | "overdue" | "delinquent" | "lien_review" | "disputed";
  createdAt: string;
  updatedAt: string;
};
```

The exact shape may differ, but keep it typed, explicit, and UI-friendly. Do not pass generic `Record<string, unknown>` blobs to the page when a typed contract is practical.

### Validation Guardrails

- Normalize repeated whitespace in text inputs.
- Reject control characters.
- Keep account numbers and public payment codes compatible with guest lookup expectations. Existing public lookup accepts letters/numbers plus spaces, dots, underscores, and hyphens. Normalize public payment codes consistently before storage, preferably uppercase.
- Treat blank optional fields as `null`.
- Validate dates as `YYYY-MM-DD` date-only strings.
- Validate `delinquency_status` against the existing DB check values only.
- Do not accept arbitrary JSON for `mailing_address`; build it from explicit validated fields and store `null` if all mailing fields are blank.

### Architecture Compliance

- Follow Next.js App Router route groups under `app/(admin)/admin`.
- Keep business logic in `server/services/admin/property-management.ts`.
- Keep form mutation parsing in `server/actions/admin-properties.ts`.
- Use user-scoped Supabase clients and permission-checked RPCs for admin property operations. Do not use direct service-role table reads for the roster.
- Keep authorization layered: proxy verifies session, layout verifies workspace access, property service/RPC verifies `admin.properties.manage`.
- Keep all records scoped to the Spring Meadow community by `community_id`.
- Do not weaken existing RLS policies or grant broad table access for admin convenience.

### UI Requirements

- The property page should feel like an operations surface, not a marketing page.
- Use a compact roster with filters and forms built for repeated admin use.
- Avoid nested cards. Repeated rows/forms may use restrained borders and `rounded-sm`.
- Keep labels, notices, controls, and table cells readable on mobile. Use `min-w-0`, wrapping text, and horizontal overflow only when it is deliberate and contained.
- Use `aria-live` for create/update/archive result notices.
- Use unique IDs for repeated edit/archive controls, especially if each row has its own form.
- Do not add a client component unless there is a concrete interaction that cannot be handled with server-rendered forms.

### Latest Technical Information

- Local dependencies in `package.json`: Next `^16.0.0`, React `^19.0.0`, `@supabase/ssr` `^0.10.3`, `@supabase/supabase-js` `^2.105.3`, Tailwind `^4.0.0`, TypeScript `^5.0.0`.
- Official Next App Router docs support fetching data directly in Server Components and keeping sensitive query logic on the server. Keep the property roster fetch in the Server Component/service layer, not in a client component.
- Official Next mutating-data docs support Server Actions for form submissions. Use the repo's existing server action redirect pattern for property create/update/archive results.
- Official Supabase RLS docs reinforce enabling RLS on exposed-schema tables and using security-definer helpers carefully. Story 5.3 should keep property access permission-checked rather than adding broad direct grants.
- Official Supabase JavaScript docs support calling Postgres functions with `supabase.rpc(...)`, matching existing repo service patterns.

### Previous Story Intelligence

- Story 5.1 created the admin shell and placeholder `/admin/properties` page. Replace only the property placeholder in this story.
- Story 5.1 established that admin pages should not render their own `<main>` because the admin layout owns the main landmark.
- Story 5.1 code review fixed repeated-control behavior in the nav; keep Escape/focus behavior intact and do not move server data fetching into `components/admin/admin-workspace-nav.tsx`.
- Story 5.2 intentionally used workspace access for aggregate property counts because no property management permission existed yet. Story 5.3 now owns introducing `admin.properties.manage`.
- Story 5.2 code review found a permission-scope leak in document aggregates. Apply that lesson here: a section permission gate is not enough; every query and returned field must match the actor's permission.
- Stories 3.8, 3.9, and 5.2 use source-inspection tests for admin permissions, RPCs, privacy boundaries, and route integration. Follow that style.
- Story 4.8 code review fixed duplicate form input IDs when multiple forms render on one page. Property row edit/archive forms must generate unique ids.
- Story 3.9 owns full delinquency reporting. The property roster may show delinquency status as context, but must not duplicate the delinquency report workflow.
- Story 5.4 owns user/property membership management. Do not add membership invite/link/remove UI here.

### Testing Requirements

- Follow the existing `node:test` source-inspection style with `assert`, `readFileSync`, `existsSync`, recursive file listing helpers, regex assertions, and order checks where guard order matters.
- Add positive tests for migration/RPC permission checks, server-only service, server actions, `/admin/properties` page, nav availability, archive semantics, and safe empty/permission states.
- Add negative privacy tests across public, resident, guest, shared client, dashboard, payment, document, message, and nav files.
- Run focused tests first, then the full suite and quality commands listed in Tasks.

### Project Structure Notes

- Add or update:
  - `supabase/migrations/202605110019_property_management.sql`
  - `server/services/admin/property-management.ts`
  - `server/actions/admin-properties.ts`
  - `app/(admin)/admin/properties/page.tsx`
  - `server/services/auth/admin-workspace.ts`
  - `tests/admin-property-management.test.mjs`
- Do not add a new dependency for tables, icons, forms, or validation unless the user explicitly approves it. Existing code uses standard TypeScript helpers, server actions, and Tailwind classes.
- No `project-context.md` file was found under the project root during story creation.

### References

- [Epic 5 and Story 5.3 Source](/home/smount/Websites/SpringMeadowCommunity/_bmad-output/planning-artifacts/epics.md)
- [Previous Story 5.2](/home/smount/Websites/SpringMeadowCommunity/_bmad-output/implementation-artifacts/5-2-admin-dashboard-summary.md)
- [Previous Story 5.1](/home/smount/Websites/SpringMeadowCommunity/_bmad-output/implementation-artifacts/5-1-board-admin-workspace-shell-and-navigation.md)
- [Requirements: Authentication and Accounts](/home/smount/Websites/SpringMeadowCommunity/docs/bmad/phase-1-requirements/requirements.md)
- [Requirements: Admin Tools and NFRs](/home/smount/Websites/SpringMeadowCommunity/docs/bmad/phase-1-requirements/requirements.md)
- [Architecture: Property-Centered Design](/home/smount/Websites/SpringMeadowCommunity/docs/bmad/phase-2-architecture/architecture.md)
- [Architecture: Explicit Authorization and Board/Admin Access](/home/smount/Websites/SpringMeadowCommunity/docs/bmad/phase-2-architecture/architecture.md)
- [API Design: Cross-Cutting Requirements](/home/smount/Websites/SpringMeadowCommunity/docs/bmad/phase-3-design/api.md)
- [Data Model: Properties](/home/smount/Websites/SpringMeadowCommunity/docs/bmad/phase-3-design/data-model.md)
- [Data Model: RLS and Permission Helpers](/home/smount/Websites/SpringMeadowCommunity/docs/bmad/phase-3-design/data-model.md)
- [Property Schema Migration](/home/smount/Websites/SpringMeadowCommunity/supabase/migrations/202605100001_create_properties_and_memberships.sql)
- [Admin Workspace Context](/home/smount/Websites/SpringMeadowCommunity/server/services/auth/admin-workspace.ts)
- [Admin Properties Placeholder](/home/smount/Websites/SpringMeadowCommunity/app/(admin)/admin/properties/page.tsx)
- [Resident Property Detail Service](/home/smount/Websites/SpringMeadowCommunity/server/services/auth/resident-property-detail.ts)
- [Guest Property Lookup Service](/home/smount/Websites/SpringMeadowCommunity/server/services/payments/guest-property-lookup.ts)
- [Assessment Management Pattern](/home/smount/Websites/SpringMeadowCommunity/server/services/payments/assessment-management.ts)
- [Audit Log Helper](/home/smount/Websites/SpringMeadowCommunity/server/services/audit/write-audit-log.ts)
- [Next.js Fetching Data Docs](https://nextjs.org/docs/app/getting-started/fetching-data)
- [Next.js Mutating Data Docs](https://nextjs.org/docs/app/getting-started/mutating-data)
- [Supabase Row Level Security Docs](https://supabase.com/docs/guides/database/postgres/row-level-security)
- [Supabase JavaScript RPC Docs](https://supabase.com/docs/client/rpc)

## Dev Agent Record

### Agent Model Used

GPT-5 Codex

### Debug Log References

- `node --test tests/admin-property-management.test.mjs`
- `npm run typecheck`
- `npm run lint`
- `npm test`
- `npm run build`
- `git diff --check`
- `node --test tests/admin-property-management.test.mjs` (after code review patches)
- `npm run typecheck` (after code review patches)
- `npm run lint` (after code review patches)
- `npm test` (after code review patches)
- `npm run build` (after code review patches)
- `git diff --check` (after code review patches)

### Completion Notes List

- Ultimate context engine analysis completed - comprehensive developer guide created.
- Story 5.3 is scoped to admin property roster management, not membership management or financial recalculation.
- Introduces `admin.properties.manage` as the first property management permission.
- Preserves resident and guest property privacy while enabling authorized admin roster CRUD.
- Added permission-checked property management RPCs for list/create/update/archive on the existing `properties` table.
- Added a server-only admin property service with safe typed results, user-scoped Supabase RPC calls, validation, conflict mapping, and audit-log preparation.
- Added defensive admin property server actions that build mailing addresses from explicit form fields and redirect with generic safe status params.
- Replaced the `/admin/properties` placeholder with an authorized dense roster, filters, create/edit/archive forms, balance context, empty states, and accessible action notices.
- Enabled the admin Properties nav item only for `admin.properties.manage`.
- Verified no property management internals were imported into public, resident, guest, shared client, navigation, payment, document, message, or dashboard surfaces.
- Code review patches resolved: mailing address JSON is constrained to the narrow field contract at service/RPC layers, mailing address changes are included in audit summaries, and the admin roster now has pagination.

### File List

- `_bmad-output/implementation-artifacts/5-3-property-management.md`
- `_bmad-output/implementation-artifacts/sprint-status.yaml`
- `app/(admin)/admin/properties/page.tsx`
- `server/actions/admin-properties.ts`
- `server/services/admin/property-management.ts`
- `server/services/auth/admin-workspace.ts`
- `supabase/migrations/202605110019_property_management.sql`
- `tests/admin-property-management.test.mjs`

### Change Log

- 2026-05-17: Implemented Story 5.3 property management and marked ready for review.
- 2026-05-17: Addressed code review findings and marked Story 5.3 done.
