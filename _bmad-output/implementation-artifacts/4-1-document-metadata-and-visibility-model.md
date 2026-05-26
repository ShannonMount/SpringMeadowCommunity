# Story 4.1: Document Metadata and Visibility Model

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As an admin,
I want to classify documents by category, visibility, and related records,
so that residents and board/admin users can find only the documents they are authorized to access.

## Acceptance Criteria

1. Given an authorized admin creates document metadata, when they provide title, category, visibility, storage metadata, and optional related property, meeting, compliance, assessment, or vendor references, then the system stores the metadata scoped to the community, and the document is assigned one of the allowed visibility levels: public, resident, board, vendor, property_specific, or admin.
2. Given a document is property-specific, when metadata is created or updated, then a related property is required, and only authorized users for that property or permitted board/admin users can later access it.
3. Given a document includes effective or expiration dates, when document lists are queried, then those dates are available for display and filtering, and expired or archived documents can be handled according to status.

## Tasks / Subtasks

- [x] Add document metadata and visibility schema foundation. (AC: 1, 2, 3)
  - [x] Add the next ordered migration after `supabase/migrations/202605110009_delinquency_reporting_foundation.sql`, likely `supabase/migrations/202605110010_document_metadata_and_visibility_model.sql`.
  - [x] Create document visibility/status/category constraints without editing historical migrations. Use either Postgres enums or text checks consistent with local migration style, but the allowed visibility values must be exactly `public`, `resident`, `board`, `vendor`, `property_specific`, and `admin`.
  - [x] Create `public.documents` with community scope, title, description, category, visibility, related property/vendor/meeting/compliance/assessment IDs, storage provider/bucket/path, content type, size bytes, checksum, effective date, expiration date, status, uploaded/created actor, timestamps, and deleted metadata.
  - [x] Create `public.document_access_logs` as the future audit surface for view/download/signed-url attempts. Story 4.4 will write download logs, but the schema should exist now if it is part of the document foundation.
  - [x] Add indexes for community/visibility/category/status/date filtering, property-specific lookup, effective/expiration dates, storage path uniqueness, and access-log document/profile history.
  - [x] Enforce `expiration_date >= effective_date` when both are present, positive `size_bytes`, non-empty trimmed title/category/storage path/content type, and no storage paths with leading slash, backslash, or `..` traversal segments.
  - [x] Enforce `visibility = 'property_specific'` requires `related_property_id`. If `related_property_id` or `related_assessment_id` is provided, validate it belongs to the same `community_id`; if both are provided, validate the assessment belongs to that property.
  - [x] Keep vendor, meeting, and compliance references as nullable UUID metadata for now unless the target tables already exist. Do not create vendor, meeting, compliance, records-request, or legal workflow tables in this story.
- [x] Add document permissions, RLS, and read-authorization helper. (AC: 1, 2, 3)
  - [x] Add `admin.documents.manage` to the seeded `admin` role and `board.documents.view` to seeded `board_member` and `admin` roles. Do not grant document management to residents, vendors, pool workers, legal reviewers, anon, or public roles.
  - [x] Enable RLS on `documents` and `document_access_logs`; revoke broad direct access from `anon` and `authenticated`.
  - [x] Create `app.can_read_document(target_document_id uuid)` or equivalent as a security-definer helper with explicit `search_path`, community scoping, and deterministic visibility logic.
  - [x] Allow public metadata only for active public documents that are not deleted and are within effective/expiration windows. Public visibility must not imply access to private buckets or signed URLs.
  - [x] Allow resident-visible documents only to active profiles with an active property membership in the same community where `can_view_documents = true`.
  - [x] Allow property-specific documents only to active members of the related property with `can_view_documents = true`, plus users with `board.documents.view` or `admin.documents.manage` in the same community.
  - [x] Allow board documents to `board.documents.view` or `admin.documents.manage`; allow admin documents only to `admin.documents.manage`.
  - [x] Treat vendor visibility as private by default until vendor portal authorization exists. It may be readable to `admin.documents.manage` and optionally future vendor-scoped roles only if the schema has enough scope to prove access.
- [x] Add permission-checked metadata RPCs or server-safe database functions. (AC: 1, 2, 3)
  - [x] Add `public.create_document_metadata(...)`, `public.update_document_metadata(...)`, and a narrow `public.list_document_metadata(...)` or equivalent RPC set. Revoke execute from `public`; grant create/update only to `authenticated`, grant list to `anon` and `authenticated` for public metadata, set safe `search_path`, and check `app.current_profile_id()` plus `app.has_permission(target_community_id, 'admin.documents.manage')` for create/update.
  - [x] The list RPC must apply authorization server-side, not client-side. Public, resident, board/admin, property-specific, and admin visibility must be filtered by database logic or a service that uses database authorization helpers.
  - [x] Return safe metadata only: document ID, community ID, title, description, category, visibility, status, related IDs needed for routing, storage provider/bucket/path, content type, size bytes, checksum, effective/expiration dates, uploaded/created/updated timestamps, and uploaded profile ID where appropriate.
  - [x] Do not expose raw Supabase errors, service-role details, secret names, private storage signed URLs, object contents, owner display names, account numbers, public payment codes, guest PII, raw payment processor data, audit internals, or unrelated property metadata through the RPC contract.
  - [x] Use append-only audit intent for metadata creation and visibility/status changes, either by writing `audit_logs` in SQL or by returning enough safe before/after detail for the TypeScript service to call `writeAuditLog`.
- [x] Add a server-only document metadata service. (AC: 1, 2, 3)
  - [x] Add `server/services/documents/document-metadata.ts` with `import "server-only"`.
  - [x] Reuse `hasPermission`/`PERMISSION_DENIED_MESSAGE`, `PROFILE_UNAVAILABLE_MESSAGE`, current UUID/date/integer validation patterns, result-union style, and user-scoped `createClient()` access from `server/services/payments/admin-payment-management.ts`, `server/services/payments/delinquency-reporting.ts`, and `server/services/auth/permissions.ts`.
  - [x] Expose typed functions such as `createDocumentMetadata(input)`, `updateDocumentMetadata(input)`, and `listDocumentMetadata(input)` returning safe unions for success/records, unauthenticated, profile unavailable, permission denied, invalid input, and unavailable.
  - [x] Validate server-side: community ID/slug, document ID, title length, category, visibility, related property/assessment/vendor/meeting/compliance UUIDs, storage provider, storage bucket, storage path, content type, size bytes, checksum length/format if present, effective/expiration date range, status, bounded page size/offset, and search/filter text.
  - [x] Do not use service-role clients for normal metadata create/update/list operations. Reserve service role for later storage signing/upload routes only when explicitly required by Story 4.2 or 4.4.
- [x] Keep 4.1 tightly scoped to metadata and visibility. (AC: 1, 2, 3)
  - [x] Do not create Supabase Storage buckets, upload files, generate signed URLs, stream private files, build a full document upload UI, or implement public/resident document listing pages in this story. Stories 4.2, 4.3, and 4.4 own those workflows.
  - [x] Do not replace existing public `/documents` or resident `/portal/documents` placeholder pages except for imports/tests proving they remain privacy-safe.
  - [x] Do not add full admin workspace navigation; Epic 5 owns the complete board/admin shell.
  - [x] Do not broaden direct table grants on properties, assessments, payments, payment allocations, community settings, audit logs, or future workflow tables to make document metadata easier.
  - [x] Do not implement announcements, events, resident message threads, compliance calendar records, meeting minutes workflows, vendor invoice workflows, legal document generation, or lien-related workflows.
- [x] Extend verification. (AC: 1, 2, 3)
  - [x] Add `tests/document-metadata.test.mjs`.
  - [x] Test the migration creates document visibility/status/category constraints, `documents`, `document_access_logs`, indexes, RLS, revokes, permission seed updates, and safe function grants/search paths.
  - [x] Test property-specific metadata requires a related property, validates property/assessment community scope, and rejects unrelated-community or unrelated-property references.
  - [x] Test `app.can_read_document` authorization logic for public, resident, board, admin, property-specific, vendor, inactive, archived, deleted, not-yet-effective, and expired documents.
  - [x] Test metadata create/update/list RPCs check permissions inside SQL, use safe input validation, return narrow contracts, and avoid raw errors/private storage URLs/secret names/private PII.
  - [x] Test the server-only service validates inputs, uses user-scoped Supabase RPC calls, returns safe union results, and does not import service-role, Stripe, Resend, guest payment, payment receipt, or public lookup modules.
  - [x] Test public, resident, guest, and client-facing files do not import document metadata management services, `admin.documents.manage`, private bucket paths, signed URL helpers, service-role clients, or unauthorized private metadata.
  - [x] Run `npm test`, `npm run typecheck`, `npm run lint`, `npm run build`, and `git diff --check`.

### Review Findings

- [x] [Review][Patch] Public document metadata listing is not actually public — resolved by allowing anonymous `list_document_metadata` execution while preserving active, non-deleted, in-window public-only filtering through `app.can_read_document`.
- [x] [Review][Patch] `update_document_metadata` grants target the old function signature [supabase/migrations/202605110010_document_metadata_and_visibility_model.sql:1124]
- [x] [Review][Patch] Server update path still cannot clear optional metadata fields or dates [server/services/documents/document-metadata.ts:103]

## Dev Notes

Story 4.1 is the foundation for Epic 4 document access. It should create the durable metadata and visibility authorization model that later upload, listing, and download stories can trust. The main implementation trap is mixing metadata with file delivery. This story stores and authorizes metadata; it must not make private files downloadable or public by accident.

### Current Files To Update

- `supabase/migrations/202605100001_create_properties_and_memberships.sql`
  - Current state: creates `communities`, `properties`, `property_memberships`, `app.current_profile_id()`, and `app.can_access_property(target_property_id)`.
  - Change: do not edit this historical migration. Reuse `app.current_profile_id()` and the membership/property model from a new document migration.
  - Preserve: `can_view_documents` on memberships controls whether a resident can see document metadata for linked properties.
- `supabase/migrations/202605100003_create_roles_and_profile_roles.sql`
  - Current state: seeds `resident`, `board_member`, `admin`, vendor/pool/legal roles and exposes `app.has_permission(target_community_id, permission_key, target_scope, target_scope_id)`.
  - Change: add document permission keys in the new migration by appending to existing role permission arrays.
  - Preserve: no direct broad access for non-admin roles; board document viewing should be explicit and read-oriented.
- `supabase/migrations/202605110001_create_assessment_cycles_and_assessments.sql`
  - Current state: creates `assessment_cycles`, `assessments`, manager read policies, and assessment management RPCs.
  - Change: only use `assessments` as an optional metadata reference. Do not change assessment mutation behavior.
  - Preserve: assessment visibility and payment/allocation behavior from Epic 3.
- `supabase/migrations/202605110006_create_stripe_webhook_processing.sql`
  - Current state: creates persistent `audit_logs` and payment webhook processing.
  - Change: use the existing audit shape if metadata create/update writes audit entries or if the service calls `writeAuditLog`.
  - Preserve: webhook processing, payment idempotency, and financial audit semantics.
- `app/(public)/documents/page.tsx`
  - Current state: public placeholder only, intentionally no Supabase/private document access.
  - Change: none expected in 4.1.
  - Preserve: no private document metadata, private bucket names, signed URLs, account/property financial data, or server service imports.
- `app/(resident)/portal/(member)/documents/page.tsx`
  - Current state: member-gated placeholder using `getResidentPortalMemberships()` and `membershipPermissions.canViewDocuments`.
  - Change: none expected in 4.1; Story 4.3 owns real listing UI.
  - Preserve: `canViewDocuments` remains the resident document gate.
- `server/services/auth/permissions.ts`
  - Current state: server-only permission helper and role mutation service using user-scoped Supabase RPCs and safe union results.
  - Change: use as the permission pattern for document metadata services.
- `server/services/audit/write-audit-log.ts`
  - Current state: server-only audit writer using trusted Supabase only inside server code.
  - Change: document metadata service may call it for metadata create/update/visibility/status changes if SQL does not write the audit record directly.
- `server/services/payments/admin-payment-management.ts`
  - Current state: closest local pattern for admin service validation, community resolution, permission checks, bounded pagination, escaped search, and safe result unions.
  - Change: use as a pattern only. Do not import payment services into documents code.
- `server/services/payments/delinquency-reporting.ts`
  - Current state: recent read-only board/admin report service using `board.delinquency.view`, RPC access, strict filters, and safe page behavior.
  - Change: use its guardrails for report/list-style document metadata queries.

### New Files Likely Needed

- `supabase/migrations/202605110010_document_metadata_and_visibility_model.sql`
- `server/services/documents/document-metadata.ts`
- `tests/document-metadata.test.mjs`

Optional only if the implementation chooses to expose a reusable server action for later UI:

- `server/actions/document-metadata.ts`

Do not add a full admin document management route in this story unless implementation discovers an existing local pattern that requires it; Story 4.2/4.3 and Epic 5 own upload/listing/shell UI.

### Suggested Data Contract

Use narrow typed contracts similar to:

```ts
type DocumentVisibility =
  | "public"
  | "resident"
  | "board"
  | "vendor"
  | "property_specific"
  | "admin";

type DocumentStatus = "active" | "archived" | "deleted";

type DocumentMetadataRecord = {
  id: string;
  communityId: string;
  title: string;
  description: string | null;
  category: string;
  visibility: DocumentVisibility;
  status: DocumentStatus;
  relatedPropertyId: string | null;
  relatedVendorId: string | null;
  relatedMeetingId: string | null;
  relatedComplianceTaskId: string | null;
  relatedAssessmentId: string | null;
  storageProvider: "supabase_storage" | "cloudflare_r2" | "s3";
  storageBucket: string;
  storagePath: string;
  contentType: string;
  sizeBytes: number;
  checksum: string | null;
  effectiveDate: string | null;
  expirationDate: string | null;
  uploadedBy: string | null;
  createdAt: string;
  updatedAt: string;
};
```

Safe service result shape should follow local union patterns:

```ts
type DocumentMetadataResult =
  | { kind: "record"; record: DocumentMetadataRecord }
  | { kind: "records"; records: DocumentMetadataRecord[] }
  | { kind: "unauthenticated" }
  | { kind: "profile-unavailable"; message: string }
  | { kind: "permission-denied"; message: string }
  | { kind: "invalid-input"; message: string; fieldErrors: Record<string, string[]> }
  | { kind: "documents-unavailable"; message: string };
```

### Visibility Rules

- `public`: active, non-deleted metadata may be listed publicly only when effective/expiration windows allow it. The metadata being public does not authorize private bucket access.
- `resident`: active members in the same community with `can_view_documents = true` may read metadata.
- `property_specific`: requires `related_property_id`; active members for that property with `can_view_documents = true` may read metadata; `board.documents.view` and `admin.documents.manage` can also read it in the same community.
- `board`: requires `board.documents.view` or `admin.documents.manage`.
- `admin`: requires `admin.documents.manage`.
- `vendor`: exists as a visibility value, but vendor portal identity/scope is not implemented yet. Keep it private to admins unless a reliable vendor-scoped authorization path exists locally.

### Authorization and Privacy Requirements

- Check document management permission in both TypeScript service code and database RPCs. Server Actions/functions can be invoked directly, so page-level guards are insufficient.
- Prefer user-scoped Supabase clients for normal metadata operations. Do not use service-role clients for user-initiated metadata reads/writes.
- Keep `documents` and `document_access_logs` RLS enabled with direct table access revoked unless a specific narrow policy is required and tested.
- If a SQL view is used, create it with explicit security behavior. Prefer permission-checked functions over exposed views.
- Never include signed URLs, private storage object contents, raw storage errors, raw Supabase errors, service-role details, secret names, owner display names, account numbers, public payment codes, guest contacts, Stripe identifiers, or audit internals in public/resident contracts.
- IDs are acceptable in typed server results and React keys, but avoid rendering raw internal IDs as ordinary UI text unless needed for admin operations.

### Testing Requirements

- Follow the existing fast `node:test` guardrail style used by `tests/admin-payment-management.test.mjs`, `tests/delinquency-reporting.test.mjs`, and related story tests.
- Tests should inspect SQL and TypeScript source for schema/permission/privacy boundaries because there is no live Supabase integration test harness in this repo yet.
- Include negative assertions for wrong imports and private leakage. This project has repeatedly caught issues by testing for forbidden service-role, secret, raw error, and private-data strings in public/resident/client-facing files.
- Add tests that would fail if a developer implements storage upload/download or signed URL creation in 4.1.

### Current Local Technical Information

- Current installed stack from `npm ls`: Next.js `16.2.4`, React `19.2.5`, `@supabase/ssr` `0.10.3`, `@supabase/supabase-js` `2.105.3`.
- `package.json` scripts: `npm test` runs `node --test tests/*.test.mjs`; `npm run lint` delegates to `npm run typecheck`; `npm run build` uses Next/Turbopack.
- No `project-context.md` file was found during story creation.
- Git history only shows initial scaffold commits; current story files, migrations, and tests are more useful than commit history for implementation patterns.
- The workspace has many pre-existing untracked/modified files from earlier stories. Do not revert unrelated changes.

### Latest Technical Information

- Next.js Server Functions/Actions are reachable via direct POST requests, so official docs say to verify authentication and authorization inside every Server Function. Source: https://nextjs.org/docs/app/getting-started/mutating-data
- Supabase Storage access control is based on RLS policies on `storage.objects`; by default Storage does not allow uploads without policies, and service keys bypass RLS and must not be public. Source: https://supabase.com/docs/guides/storage/security/access-control
- Supabase private buckets are private by default; private downloads require authorized download requests or time-limited signed URLs. Public buckets bypass access controls for serving assets, so only truly public documents should ever be placed there. Source: https://supabase.com/docs/guides/storage/buckets/fundamentals
- Supabase database function guidance says `security definer` functions must set `search_path`, and function execution should be revoked from broad roles then granted deliberately. Source: https://supabase.com/docs/guides/database/functions

### Project Structure Notes

- Database schema/RPC changes belong in a new ordered migration. Do not edit historical migrations.
- Document business logic belongs under `server/services/documents/...` with `import "server-only"`.
- Optional document metadata form actions belong under `server/actions/...` with `"use server"`, but only if needed for this story's metadata mutation surface.
- Keep public utilities under `lib/public` free of private document metadata. Do not place document metadata management in `lib/public`, `components/public`, or `components/resident`.
- Keep admin document UI minimal or absent in this story. Full admin workspace shell/navigation is Epic 5; upload/listing/download UI is Story 4.2-4.4.

### References

- [Epics: Story 4.1](/home/smount/Websites/SpringMeadowCommunity/_bmad-output/planning-artifacts/epics.md)
- [Requirements: Documents](/home/smount/Websites/SpringMeadowCommunity/docs/bmad/phase-1-requirements/requirements.md)
- [Architecture: Authorization and Document Architecture](/home/smount/Websites/SpringMeadowCommunity/docs/bmad/phase-2-architecture/architecture.md)
- [Data Model: Documents and Document Access Logs](/home/smount/Websites/SpringMeadowCommunity/docs/bmad/phase-3-design/data-model.md)
- [API Design: Documents API](/home/smount/Websites/SpringMeadowCommunity/docs/bmad/phase-3-design/api.md)
- [Tasks: TASK-DB-012, TASK-DOC-001 through TASK-DOC-004, TASK-QA-004](/home/smount/Websites/SpringMeadowCommunity/docs/bmad/phase-4-tasks/tasks-v1.md)
- [Previous Story 3.9](/home/smount/Websites/SpringMeadowCommunity/_bmad-output/implementation-artifacts/3-9-delinquency-reporting-foundation.md)
- [Previous Story 3.8](/home/smount/Websites/SpringMeadowCommunity/_bmad-output/implementation-artifacts/3-8-admin-payment-records-and-manual-payments.md)
- [Role and Permission Foundation](/home/smount/Websites/SpringMeadowCommunity/_bmad-output/implementation-artifacts/2-5-role-and-permission-assignment-foundation.md)
- [Resident Portal Navigation Placeholder Documents](/home/smount/Websites/SpringMeadowCommunity/_bmad-output/implementation-artifacts/2-6-resident-portal-layout-and-navigation.md)

## Dev Agent Record

### Agent Model Used

GPT-5 Codex

### Debug Log References

- `node --test tests/document-metadata.test.mjs` - failed once on an overbroad signed-url vocabulary assertion, then passed after narrowing the test to forbid generation code instead of the required access-log event label
- `npm run typecheck` - passed
- `npm test` - passed
- `npm run lint` - passed
- `npm run build` - passed
- `git diff --check` - passed
- `node --test tests/document-metadata.test.mjs` - failed once on a stale public-list assertion during code review fixes, then passed
- `npm run typecheck` - passed after code review fixes
- `npm test` - passed after code review fixes
- `npm run build` - passed after code review fixes
- `git diff --check` - passed after code review fixes

### Implementation Plan

- Add a new ordered migration for document metadata, visibility constraints, document access log foundation, role permission seed updates, RLS, authorization helpers, and metadata RPCs.
- Keep document metadata create/update behind `admin.documents.manage` in TypeScript and SQL while letting list authorization remain server-side through `app.can_read_document`.
- Add a server-only document metadata service using user-scoped Supabase RPC calls, safe unions, bounded filters, and validation for IDs, dates, storage metadata, status, and visibility.
- Verify the metadata-only scope with source guardrail tests so uploads, signed URLs, storage buckets, and UI listing work remain with later stories.

### Completion Notes List

- Ultimate context engine analysis completed - comprehensive developer guide created.
- Implemented `document_visibility`, `public.documents`, and `public.document_access_logs` in a new ordered migration with document status/category/storage/date constraints, property-specific requirements, same-community property/assessment validation, indexes, RLS, and direct table access revokes.
- Added document permissions for admin management and board viewing, plus `app.can_read_document` for active, non-deleted, in-window public/resident/board/admin/property-specific authorization while keeping vendor visibility private to admins for now.
- Added permission-checked create/update/list metadata RPCs with safe search paths, user/profile checks, server-side list filtering, safe JSON contracts, and SQL audit-log writes for creation and visibility/status changes.
- Added `server/services/documents/document-metadata.ts` with server-only typed create/update/list functions, user-scoped Supabase access, validation, bounded filters, and safe union results.
- Added `tests/document-metadata.test.mjs` covering schema/RPC permissions, scope validation, read authorization, service boundaries, privacy guardrails, and metadata-only story scope.
- Resolved code review findings by enabling anonymous public-only metadata listing, correcting the `update_document_metadata` grant signature for clear flags, and exposing clear semantics through the server update service.

### File List

- `_bmad-output/implementation-artifacts/4-1-document-metadata-and-visibility-model.md`
- `_bmad-output/implementation-artifacts/sprint-status.yaml`
- `server/services/documents/document-metadata.ts`
- `supabase/migrations/202605110010_document_metadata_and_visibility_model.sql`
- `tests/document-metadata.test.mjs`

### Change Log

- 2026-05-15: Created Story 4.1 context for document metadata and visibility model.
- 2026-05-15: Implemented Story 4.1 document metadata and visibility model; story moved to review.
- 2026-05-15: Addressed code review findings and moved Story 4.1 to done.
