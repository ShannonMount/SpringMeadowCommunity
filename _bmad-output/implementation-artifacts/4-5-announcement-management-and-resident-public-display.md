# Story 4.5: Announcement Management and Resident/Public Display

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a board/admin user,
I want to create and publish targeted announcements,
so that residents and public visitors see the official notices meant for them.

## Acceptance Criteria

1. Given a board/admin user has announcement management permission, when they create or update an announcement, then they can set title, body, visibility, publish date, expiration date, pinned state, status, and attachments, and create, update, publish, expire, and archive actions are prepared for audit logging.
2. Given a resident opens resident announcements or dashboard, when announcements are queried, then resident-visible and authorized property-specific announcements are displayed, and board-only, admin-only, and unrelated property-specific announcements are excluded.
3. Given a public visitor opens public announcements, when announcements are queried, then only published, non-expired public announcements are displayed, and private announcement data is not exposed.

## Tasks / Subtasks

- [x] Add announcement schema, permissions, authorization helpers, and RPCs. (AC: 1, 2, 3)
  - [x] Add the next ordered migration after `supabase/migrations/202605110012_signed_private_document_download.sql`, likely `supabase/migrations/202605110013_announcement_management_and_display.sql`.
  - [x] Create announcement visibility/status types or constrained text fields for `public`, `resident`, `board`, `property_specific`, and `admin` visibility plus `draft`, `published`, `expired`, and `archived` status.
  - [x] Create `public.announcements` with community, title, body, visibility, property targets, status, pinned, publish/expiration timestamps, attachment document IDs, creator/updater/archive metadata, and timestamp fields.
  - [x] Add indexes for feed queries, pinned ordering, status/visibility, and property target lookup. Use a GIN index for `property_ids` if stored as an array.
  - [x] Enable RLS, revoke broad table grants from `anon` and `authenticated`, and expose access through security-definer RPCs with explicit `search_path`.
  - [x] Add/seed `admin.announcements.manage` permission deliberately. Board users may manage only if they have this permission; do not rely on route location alone.
  - [x] Add `app.can_read_announcement(target_announcement_id uuid)` or equivalent that allows current published public announcements to anon users, resident announcements to active property members, property-specific announcements only to active matching property members, board/admin visibility only to users with appropriate management permission, and excludes expired/future/draft/archived rows for non-managers.
  - [x] Add safe JSON helpers or RPC return shapes that never expose raw owner/profile data, account numbers, private document storage fields, service-role details, audit internals, raw SQL errors, or unrelated property IDs to public/resident callers.
  - [x] Add RPCs for list/create/update/publish/expire/archive. Mutating RPCs must check `admin.announcements.manage`, validate community scope, validate property targets, validate attachment document IDs belong to the same community, and return safe status unions.
  - [x] Ensure attachment output is authorized and document-ID based only. Public callers must not receive private attachment document IDs; resident callers must not receive unrelated property/private attachment IDs.
- [x] Add a server-only announcement service. (AC: 1, 2, 3)
  - [x] Add `server/services/announcements/announcement-management.ts` with `import "server-only"`.
  - [x] Follow the union-result style used by `server/services/documents/document-metadata.ts`, `server/services/documents/document-upload.ts`, and payment/admin services.
  - [x] Validate title/body/category-like fields, visibility, status, pinned value, publish/expiration timestamps, property IDs, attachment document IDs, page size, page offset, and optional filters before calling RPCs.
  - [x] Resolve the default community using `communitySlug: "spring-meadow-community"` unless a caller provides an explicit community ID/slug.
  - [x] Use `createClient()` for user-scoped RPC calls. Do not direct-query `announcements` from public/resident/client-facing code.
  - [x] Use `writeAuditLog()` or SQL audit insertion for create, update, publish, expire, and archive. Audit must be best effort and must not leak raw provider/database errors.
  - [x] Return safe announcement records with public/resident display fields and authorized attachment records containing only document ID plus display metadata needed for links.
  - [x] Keep service-role clients, raw storage paths/buckets, raw Supabase errors, owner names, account numbers, payment data, and audit IDs out of returned results.
- [x] Add admin announcement actions and page. (AC: 1)
  - [x] Add `server/actions/announcements.ts` with `"use server"` actions for create/update and lifecycle operations, using `redirect()` outcomes like existing admin payment and document-upload actions.
  - [x] Add `app/(admin)/admin/announcements/page.tsx` for a focused management page. Keep it quiet and operational like the current admin documents/payments pages.
  - [x] Provide create/edit controls for title, body, visibility, property IDs, publish date/time, expiration date/time, pinned state, status, and attachment document IDs. Use document IDs only for attachments; do not accept storage paths or buckets.
  - [x] Include compact lifecycle actions for publish, expire, and archive on records returned by authorized listing.
  - [x] Add filters/pagination for status, visibility, query, and publish window as needed for admin scanning.
  - [x] Render only generic action messages such as created/updated/published/expired/archived/invalid/denied/unavailable. Do not render raw errors or audit internals.
- [x] Replace public announcement display with database-backed public-safe listing. (AC: 3)
  - [x] Update `app/(public)/announcements/page.tsx` to call the server-only announcement service from the server component instead of `lib/public/announcements.ts` static fixtures.
  - [x] Preserve the public route, metadata, semantic layout, pinned-first ordering, publish/expiration rules, empty state, and contact fallback.
  - [x] Public output must include only currently published, non-expired `public` announcements and authorized public attachment links by document ID.
  - [x] Do not expose resident/board/admin/property-specific labels, private counts, private categories, property IDs, attachment storage paths, signed URLs, owner/profile data, account numbers, or payment data in public markup.
  - [x] Remove or narrow `lib/public/announcements.ts` only if tests are updated precisely to preserve Story 1.3 privacy intent.
- [x] Add resident announcement display and dashboard integration. (AC: 2)
  - [x] Update `app/(resident)/portal/(member)/announcements/page.tsx` from placeholder to authorized resident announcement listing.
  - [x] Use existing membership gate patterns from `app/(resident)/portal/(member)/documents/page.tsx` and `getResidentPortalMemberships()`.
  - [x] List public, resident, and authorized property-specific published/current announcements; exclude board-only, admin-only, expired/future/draft/archived, and unrelated property-specific announcements.
  - [x] Update the resident dashboard path so dashboard announcements come from the new announcement service instead of static `lib/public/announcements.ts` fixture data.
  - [x] Keep event dashboard helpers intact until Story 4.6 owns database-backed events.
  - [x] Do not render property account numbers, owner names, payment details, private document metadata, raw property IDs, audit data, or raw errors in resident announcement surfaces.
- [x] Preserve boundaries and avoid scope creep. (AC: 1, 2, 3)
  - [x] Do not implement event management in this story; Story 4.6 owns events.
  - [x] Do not implement resident community posts; Story 8.2 owns future moderated posts and official announcements must remain distinct.
  - [x] Do not add email/push notifications for announcements.
  - [x] Do not add rich text, Markdown rendering, image uploads, or document upload changes. Attachments are existing document IDs routed through existing document download authorization.
  - [x] Do not import `createServiceRoleClient`, storage bucket names, storage paths, or document download internals into public/resident pages or client components.
  - [x] Do not weaken existing public document, resident document, dashboard, payment, or auth guardrails.
- [x] Extend verification. (AC: 1, 2, 3)
  - [x] Add `tests/announcement-management.test.mjs`.
  - [x] Test the migration creates the announcements table, permissions, RLS/revokes, indexes, `app.can_read_announcement`, safe list/mutation RPCs, attachment same-community validation, and no broad table grants.
  - [x] Test the service is server-only, validates inputs, calls RPCs through `createClient()`, returns safe unions, uses best-effort audit logging, and does not expose raw errors, service-role keys, storage fields, account numbers, owner data, payment data, or audit IDs.
  - [x] Test admin actions and admin page include create/update/lifecycle controls with safe redirect outcomes and document-ID attachment inputs only.
  - [x] Test public announcements use database-backed service calls, preserve public-only published/current filtering, pinned ordering, safe empty state, and no private metadata leakage.
  - [x] Test resident announcements and dashboard use authorized announcement service results, include resident/authorized property-specific records, and exclude board/admin/unrelated property-specific records.
  - [x] Update existing `tests/public-shell.test.mjs` and `tests/resident-dashboard-summary.test.mjs` only where Story 4.5 intentionally replaces static fixtures; keep their original privacy intent intact.
  - [x] Run `node --test tests/announcement-management.test.mjs`, `npm test`, `npm run typecheck`, `npm run lint`, `npm run build`, and `git diff --check`.

### Review Findings

- [x] [Review][Patch] Direct mutation RPCs can throw table constraint errors instead of returning safe invalid unions [supabase/migrations/202605110013_announcement_management_and_display.sql:465]
- [x] [Review][Patch] Non-manager property filters can act as an unrelated property-target oracle [supabase/migrations/202605110013_announcement_management_and_display.sql:367]
- [x] [Review][Patch] Public/resident RPC records expose property target IDs [supabase/migrations/202605110013_announcement_management_and_display.sql:225] — `app.announcement_json` always includes raw `property_ids`, and the service maps them into `propertyIds`, so a resident authorized for one targeted property can receive unrelated target property IDs from the same announcement.
- [x] [Review][Patch] Announcement mutations double-write audit records and the SQL audit write is not best effort [supabase/migrations/202605110013_announcement_management_and_display.sql:502] — the RPCs insert directly into `public.audit_logs`, then the TypeScript service calls `writeAuditLog()` again after success; a failed SQL audit insert can abort the mutation and a successful path creates duplicate/inconsistent audit entries.
- [x] [Review][Patch] Mutation service never returns unauthenticated or profile-unavailable union outcomes [server/services/announcements/announcement-management.ts:436] — all RPC `permission_denied` statuses are collapsed to `permission-denied`, so unauthenticated and inactive/missing-profile callers do not follow the safe union-result style required by the story.
- [x] [Review][Patch] Resident property-specific announcements are filtered out after safe `propertyIds` redaction [app/(resident)/portal/(member)/announcements/page.tsx:146] — the resident page and dashboard still require `record.propertyIds` to overlap the user's memberships, but chunk 1 now redacts those IDs for non-managers. The authorized RPC already filters property-specific records, so this extra client/service filter drops valid property-specific announcements.
- [x] [Review][Patch] Announcement date/time form values are timezone-dependent [server/actions/announcements.ts:43] — the admin action passes `datetime-local` strings directly to `new Date(...)` in the service, and the edit form renders existing UTC timestamps with `toISOString().slice(0, 16)`. On a UTC deployment this shifts HOA-local publish/expiration times instead of preserving America/New_York times.
- [x] [Review][Patch] Public announcements copy exposes private audience categories [app/(public)/announcements/page.tsx:125]
- [x] [Review][Patch] Announcement local-time parsing accepts nonexistent New York DST times [server/actions/announcements.ts:110]

## Dev Notes

Story 4.5 is the first database-backed content-management story. Earlier public/resident announcement displays were intentionally static placeholders or fixture-backed lists. This story must replace those fixtures with authorized Supabase-backed services while preserving the public and resident privacy boundaries those earlier stories established.

### Current Files To Update

- `lib/public/announcements.ts`
  - Current state: static in-memory announcement fixture data with public filtering helpers. It intentionally includes non-public sample records to prove public filtering.
  - Change: replace with server-backed behavior or narrow this file to public-safe formatting/types only.
  - Preserve: public pages must not expose resident, board, admin, property-specific, draft, archived, expired, future, private attachment, storage, account, owner, or payment details.
- `app/(public)/announcements/page.tsx`
  - Current state: server component that imports `getVisiblePublicAnnouncements()` from `lib/public/announcements.ts`, renders public announcement cards, public-safe attachment links, and an empty state.
  - Change: call the new server-only announcement service and render returned public-safe records.
  - Preserve: route `/announcements`, metadata, pinned-first UX, public empty state, contact fallback, and no client-side data fetching.
- `app/(resident)/portal/(member)/announcements/page.tsx`
  - Current state: placeholder text under the member-only resident shell.
  - Change: render authorized resident announcement cards with current/published filtering and property-specific authorization.
  - Preserve: resident member-only route group and no client-side portal context/provider.
- `server/services/auth/resident-dashboard.ts`
  - Current state: server-only resident dashboard service. Dues/property summaries are database-backed; announcements/events come from `lib/resident/dashboard-content.ts`.
  - Change: fetch dashboard announcements through the new announcement service after membership resolution. Keep events unchanged for Story 4.6.
  - Preserve: property summary authorization, balance visibility checks, safe dashboard union results, and no raw database errors.
- `lib/resident/dashboard-content.ts`
  - Current state: resident-safe static announcement and event helper. Announcement helper uses public fixtures; event helper uses static public events.
  - Change: remove or stop using announcement fixture logic once dashboard announcements are server-backed. Keep event helper intact until Story 4.6.
  - Preserve: event helper behavior and tests unrelated to announcements.
- `server/services/audit/write-audit-log.ts`
  - Current state: server-only best-effort audit writer using the trusted Supabase client.
  - Change: reuse from the announcement service if audit logging is implemented in TypeScript.
  - Preserve: never throw raw errors or expose service-role details.
- `app/(admin)/admin/documents/page.tsx`, `app/(admin)/admin/payments/page.tsx`, `app/(admin)/admin/delinquency/page.tsx`
  - Current state: examples of focused admin operational pages with server-side filtering/actions and safe messages.
  - Change: do not edit unless absolutely necessary; use as UI/action patterns for a new announcement management page.

### New Files Likely Needed

- `supabase/migrations/202605110013_announcement_management_and_display.sql`
- `server/services/announcements/announcement-management.ts`
- `server/actions/announcements.ts`
- `app/(admin)/admin/announcements/page.tsx`
- `tests/announcement-management.test.mjs`

### Suggested Service Contract

Use a narrow contract similar to:

```ts
type AnnouncementVisibility = "public" | "resident" | "board" | "property_specific" | "admin";
type AnnouncementStatus = "draft" | "published" | "expired" | "archived";

type AnnouncementAttachment = {
  documentId: string;
  title: string;
  category: string;
  contentType: string;
  sizeBytes: number;
};

type AnnouncementRecord = {
  id: string;
  communityId: string;
  title: string;
  body: string;
  visibility: AnnouncementVisibility;
  propertyIds: string[];
  status: AnnouncementStatus;
  pinned: boolean;
  publishAt: string;
  expiresAt: string | null;
  attachments: AnnouncementAttachment[];
  createdAt: string;
  updatedAt: string;
};
```

Mutations should return safe union results: `created`, `updated`, `published`, `expired`, `archived`, `invalid-input`, `unauthenticated`, `profile-unavailable`, `permission-denied`, and `announcements-unavailable`.

### Authorization And Display Rules

- Public visitors may see only `visibility = public`, `status = published`, `publish_at <= now()`, and `expires_at is null or expires_at > now()`.
- Residents may see public and resident published/current announcements plus property-specific published/current announcements only when they have an active membership for at least one targeted property.
- Board/admin-only announcements must not appear on public or normal resident pages.
- Admin management should be permission-backed by `admin.announcements.manage`. The page route alone is not authorization.
- Property-specific announcements must require at least one property target. Empty `property_ids` with `property_specific` visibility should be invalid.
- Attachments are existing document IDs. Render attachment links through `/api/documents/{documentId}/signed-url?redirect=1` or equivalent document-ID route only after the announcement service has returned an authorized attachment record.
- Do not expose signed URLs in server-rendered announcement markup.
- Do not show public visitors or residents any private attachment IDs that the current caller cannot read via document authorization.

### Public, Resident, And Admin UI Rules

- Keep the public page editorial and scannable. It is not a landing page; it should render the actual public notices immediately.
- Keep resident announcement pages work-focused and consistent with resident documents/payments pages.
- Keep admin UI compact and operational: one management page with create/edit/lifecycle controls is enough for this story.
- Use existing form/action patterns instead of introducing a client-heavy editor. Native date/time inputs, checkboxes, selects, text inputs, and textarea controls are sufficient.
- Do not render visible instructional text explaining implementation details, database rules, permissions, or tests.

### Previous Story Intelligence

- Story 1.3 created static public announcement fixtures and guardrails. 4.5 may replace those fixtures, but must keep public filtering, pinned-first ordering, publish/expiration windows, public-safe attachment links, and private-data exclusions.
- Story 2.7 added resident dashboard announcements from static helpers. 4.5 should move dashboard announcements to the DB-backed announcement service without changing dues/payment/property summary behavior.
- Story 4.1-4.4 established the document visibility and download route. Announcement attachments should use document IDs and existing document download authorization rather than storage paths or direct signed URL generation.
- Story 4.4 review found that distinguishable denied/missing route responses can leak existence. Apply that lesson: public/resident announcement failures should be generic and should not reveal whether private announcements exist.
- Existing tests are static guardrails; add focused announcement guardrails and narrow older public/dashboard assertions rather than deleting privacy checks.

### Testing Requirements

- Follow the repo's `node:test` source-inspection style. There is no live Supabase integration harness.
- Include migration assertions for RLS, revoked table grants, permission seeding, `app.can_read_announcement`, public/resident/property-specific visibility checks, and mutation permission checks.
- Include service assertions that `import "server-only"` appears, `createClient()` is used for user-scoped RPCs, `writeAuditLog()` or SQL audit insertion exists for mutations, and `createServiceRoleClient` is not imported directly into public/resident/client-facing code.
- Include UI assertions that public and resident pages use the new service, no longer rely on static announcement fixtures for DB-backed display, and do not render private visibility labels/counts, property IDs, storage paths, service-role keys, account numbers, owner names, payment data, or raw errors.
- Keep `npm test` passing after updating older public/resident announcement fixture expectations.

### Current Local Technical Information

- Current dependencies from `package.json`: Next.js `^16.0.0`, React `^19.0.0`, `@supabase/ssr` `^0.10.3`, `@supabase/supabase-js` `^2.105.3`, Stripe `^22.1.1`, Resend `^6.12.3`.
- `package.json` scripts: `npm test` runs `node --test tests/*.test.mjs`; `npm run lint` delegates to `npm run typecheck`; `npm run build` uses Next/Turbopack.
- No `project-context.md` file was found during story creation.
- Git history only shows initial scaffold commits; current implementation artifacts and tests are more useful than commit history.
- The workspace already has many pre-existing modified/untracked files from earlier stories. Do not revert unrelated changes.

### Latest Technical Information

- Next.js App Router supports Server Components and Server Functions, and form controls nested in a `<form>` can invoke Server Actions via `action`/`formAction`. Source: https://nextjs.org/docs/app/guides/forms
- Supabase recommends RLS for exposed `public` schema tables and granting only the minimum role permissions needed. Source: https://supabase.com/docs/guides/database/postgres/row-level-security
- Supabase JavaScript calls Postgres functions through `supabase.rpc(functionName, args)`. Source: https://supabase.com/docs/reference/javascript/rpc

### Project Structure Notes

- Announcement database/RPC changes belong in a new ordered migration. Do not edit historical migrations.
- Server-only announcement business logic belongs under `server/services/announcements/...`.
- Admin form actions belong under `server/actions/announcements.ts`.
- Public display belongs in `app/(public)/announcements/page.tsx`; resident display belongs in `app/(resident)/portal/(member)/announcements/page.tsx`; admin management belongs in `app/(admin)/admin/announcements/page.tsx`.
- Static verification belongs in `tests/announcement-management.test.mjs`, with precise updates to existing public/dashboard tests.
- Do not place private announcement authorization or mutation logic in `lib/public`, client components, or browser-accessible helpers.

### References

- [Epics: Story 4.5](/home/smount/Websites/SpringMeadowCommunity/_bmad-output/planning-artifacts/epics.md)
- [Requirements: Announcements](/home/smount/Websites/SpringMeadowCommunity/docs/bmad/phase-1-requirements/requirements.md)
- [Architecture: Public/Resident/Admin Access](/home/smount/Websites/SpringMeadowCommunity/docs/bmad/phase-2-architecture/architecture.md)
- [Data Model: Announcements](/home/smount/Websites/SpringMeadowCommunity/docs/bmad/phase-3-design/data-model.md)
- [API Design: Announcement Server Queries/Actions](/home/smount/Websites/SpringMeadowCommunity/docs/bmad/phase-3-design/api.md)
- [Tasks: TASK-DB-013, TASK-PAGE-003, TASK-PAGE-009, TASK-PAGE-022, TASK-CONTENT-001](/home/smount/Websites/SpringMeadowCommunity/docs/bmad/phase-4-tasks/tasks-v1.md)
- [Previous Story 4.4](/home/smount/Websites/SpringMeadowCommunity/_bmad-output/implementation-artifacts/4-4-signed-private-document-download.md)
- [Public Announcements Page](/home/smount/Websites/SpringMeadowCommunity/app/(public)/announcements/page.tsx)
- [Public Announcement Fixture](/home/smount/Websites/SpringMeadowCommunity/lib/public/announcements.ts)
- [Resident Announcements Page](/home/smount/Websites/SpringMeadowCommunity/app/(resident)/portal/(member)/announcements/page.tsx)
- [Resident Dashboard Service](/home/smount/Websites/SpringMeadowCommunity/server/services/auth/resident-dashboard.ts)
- [Resident Dashboard Content Helper](/home/smount/Websites/SpringMeadowCommunity/lib/resident/dashboard-content.ts)
- [Audit Writer](/home/smount/Websites/SpringMeadowCommunity/server/services/audit/write-audit-log.ts)

## Dev Agent Record

### Agent Model Used

GPT-5 Codex

### Debug Log References

- `node --test tests/announcement-management.test.mjs`
- `npm test`
- `npm run typecheck`
- `npm run lint`
- `npm run build`
- `git diff --check`

### Completion Notes List

- Ultimate context engine analysis completed - comprehensive developer guide created.
- Implemented and verified database-backed announcement management across migration/RPCs, server-only announcement service, admin actions/page, public announcement display, resident announcement display, and resident dashboard integration.
- Public and resident announcement surfaces now use authorized service results and document-ID attachment links without exposing private metadata, raw property targets, storage internals, audit internals, account numbers, owner data, or payment data.
- Validated Story 4.5 with focused announcement tests, full repo tests, TypeScript, lint, production build, and whitespace checks.
- Resolved code review chunk 1 migration findings by validating mutation date ranges against the effective publish timestamp and restricting non-manager property filters to actively linked properties.
- Resolved code review chunk 3 display/action findings by removing private audience-category copy from the public announcements page and rejecting nonexistent New York local times in announcement actions.

### File List

- `_bmad-output/implementation-artifacts/4-5-announcement-management-and-resident-public-display.md`
- `_bmad-output/implementation-artifacts/sprint-status.yaml`
- `app/(admin)/admin/announcements/page.tsx`
- `app/(public)/announcements/page.tsx`
- `app/(resident)/portal/(member)/announcements/page.tsx`
- `server/actions/announcements.ts`
- `server/services/announcements/announcement-management.ts`
- `server/services/auth/resident-dashboard.ts`
- `supabase/migrations/202605110013_announcement_management_and_display.sql`
- `tests/announcement-management.test.mjs`
- `tests/public-shell.test.mjs`
- `tests/resident-dashboard-summary.test.mjs`

### Change Log

- 2026-05-15: Created Story 4.5 context for announcement management and resident/public display.
- 2026-05-16: Completed Story 4.5 implementation validation and marked ready for review.
- 2026-05-16: Addressed code review chunk 1 migration/RPC findings.
- 2026-05-16: Addressed code review chunk 3 announcement display/action findings and marked story done.
