# Story 4.2: Secure Document Upload and Storage Routing

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As an authorized board/admin user,
I want to upload public and private HOA documents,
so that official files can be stored safely and made available to the right audience.

## Acceptance Criteria

1. Given an authorized user uploads a public document, when the file and metadata pass validation, then the file is stored in the public document storage path or bucket, and the metadata visibility is public.
2. Given an authorized user uploads a resident, board, vendor, property-specific, or admin document, when the file and metadata pass validation, then the file is stored in private storage, and direct public access is not available.
3. Given the upload is invalid, too large, unsupported, or unauthorized, when upload is attempted, then the system rejects it with accessible errors, and no incomplete private file is exposed through public URLs.

## Tasks / Subtasks

- [x] Add Supabase Storage bucket foundation for document uploads. (AC: 1, 2, 3)
  - [x] Add the next ordered migration after `supabase/migrations/202605110010_document_metadata_and_visibility_model.sql`, likely `supabase/migrations/202605110011_secure_document_upload_and_storage_routing.sql`.
  - [x] Create or upsert the document buckets from the canonical data model: `public-documents` as public, `private-documents` as private, and `uploads-temp` as private staging if the implementation needs temporary upload cleanup.
  - [x] Configure bucket-level `file_size_limit` and `allowed_mime_types`; use `6 MiB` as the MVP limit unless the implementation documents and tests a smaller limit, because Supabase recommends standard uploads for files not larger than 6 MB.
  - [x] Allow only document-safe MIME types needed for HOA records, such as PDF, plain text, CSV, JPEG, PNG, WebP, DOC/DOCX, and XLS/XLSX. Do not allow HTML, SVG, JavaScript, executables, archives, or arbitrary binary uploads in this story.
  - [x] Do not create broad direct authenticated upload policies on `storage.objects`. MVP uploads should go through trusted server code after application authorization, not through browser-side Storage credentials.
  - [x] Do not expose private bucket object listing or private object reads to `anon`, `authenticated`, public pages, resident pages, or client components.
- [x] Add a server-only document upload service. (AC: 1, 2, 3)
  - [x] Add `server/services/documents/document-upload.ts` with `import "server-only"`.
  - [x] Reuse current local patterns from `server/services/documents/document-metadata.ts`, `server/services/payments/admin-payment-management.ts`, `server/services/payments/delinquency-reporting.ts`, and `server/services/auth/permissions.ts`: safe result unions, UUID/date/integer validation, `PROFILE_UNAVAILABLE_MESSAGE`, `PERMISSION_DENIED_MESSAGE`, and explicit permission checks.
  - [x] Use the current document management permission path, `admin.documents.manage`, for upload authorization unless the story intentionally adds and tests a new board upload permission. Do not let a user upload just because they can view documents.
  - [x] Use `createClient()`/`hasPermission()` or existing service helpers for user/profile/community authorization before any service-role storage operation.
  - [x] Use `createServiceRoleClient()` only inside this server-only service for Storage upload/remove operations after authorization and validation pass. Never import service-role clients into pages, components, public libs, resident libs, or client components.
  - [x] Accept input fields for community slug/id, title, description, category, visibility, optional related property/vendor/meeting/compliance/assessment IDs, effective date, expiration date, and exactly one file.
  - [x] Validate file presence, non-empty size, max bytes, supported MIME type, safe original filename, title/category limits, visibility values, property-specific related property requirement, UUID fields, and date range before upload.
  - [x] Generate storage bucket/path server-side from trusted values. Ignore any user-submitted `storageBucket` or `storagePath`.
  - [x] Route `visibility === "public"` to `public-documents`; route `resident`, `board`, `vendor`, `property_specific`, and `admin` to `private-documents`.
  - [x] Use random UUID path segments and sanitized filenames, for example `communities/{communityId}/documents/{visibility}/{uploadId}/{safeFilename}`. Do not include owner names, account numbers, property addresses, public payment codes, raw emails, or user-provided folder segments in paths.
  - [x] Upload with `upsert: false` and the validated `contentType`; do not overwrite existing objects.
  - [x] After Storage upload succeeds, call `createDocumentMetadata()` or the underlying permission-checked RPC with the routed bucket/path, content type, size, optional checksum, and the validated metadata.
  - [x] If metadata creation fails after object upload, remove the uploaded object from the same bucket/path before returning a safe failure result. Cleanup failure must not expose raw Supabase errors.
  - [x] Write or preserve audit coverage for successful uploads. The existing metadata RPC audits metadata creation; add a distinct upload audit event such as `document.storage.upload` if upload itself is not otherwise auditable.
  - [x] Return safe union results only: success with the created metadata record, unauthenticated, profile unavailable, permission denied, invalid input with field errors, and unavailable. Do not return raw Supabase errors, signed URLs, private object contents, service-role details, secret names, or private resident/payment data.
- [x] Add a server action and minimal admin upload surface. (AC: 1, 2, 3)
  - [x] Add `server/actions/document-upload.ts` with `"use server"` to parse `FormData`, call the upload service, and redirect back to the document management page with generic status/search params.
  - [x] Add a focused `app/(admin)/admin/documents/page.tsx` upload page, following the restrained admin page style already used by `app/(admin)/admin/payments/page.tsx` and `app/(admin)/admin/delinquency/page.tsx`.
  - [x] Render a file input, text inputs, visibility/category controls, optional related ID/date fields, and a submit button with accessible labels and visible field errors. Use `aria-live` for result notices.
  - [x] The page may list recent uploaded metadata only if it uses `listDocumentMetadata()` and preserves authorization. Do not implement resident/public document library browsing in this story; Story 4.3 owns listing UX.
  - [x] The page must handle unauthenticated, profile unavailable, permission denied, invalid input, success, empty, and unavailable states without rendering private metadata to unauthorized users.
  - [x] Do not create a full admin workspace shell/navigation here; Epic 5 owns the complete board/admin workspace.
- [x] Preserve document privacy boundaries and story scope. (AC: 1, 2, 3)
  - [x] Do not generate signed URLs, stream private files, implement downloads, or expose private storage paths in UI. Story 4.4 owns signed private document download.
  - [x] Do not replace public `/documents` or resident `/portal/documents` placeholders with real document browsing; Story 4.3 owns authorized listing and filtering.
  - [x] Do not broaden direct table grants on `documents`, `document_access_logs`, `audit_logs`, `properties`, `property_memberships`, payments, assessments, or storage objects to make upload easier.
  - [x] Do not add vendor portal upload behavior, message attachments, meeting minutes workflows, annual financial statement workflows, records request attachments, legal document generation, or compliance evidence uploads in this story. Later stories consume the upload foundation.
  - [x] Treat `vendor` visibility as private/admin-managed until vendor authorization exists.
- [x] Extend verification. (AC: 1, 2, 3)
  - [x] Add `tests/document-upload.test.mjs`.
  - [x] Test the migration creates/upserts `public-documents`, `private-documents`, and `uploads-temp` buckets with the intended public/private flags, size limit, and allowed MIME restrictions.
  - [x] Test the migration does not add broad direct `anon`/`authenticated` upload, private select, or private listing policies for document buckets.
  - [x] Test the upload service is server-only, checks `admin.documents.manage` before service-role Storage operations, computes/routs bucket/path from visibility, validates file metadata, uses `upsert: false`, calls metadata creation, cleans up uploaded objects after metadata failure, and returns safe union results.
  - [x] Test public visibility maps only to `public-documents`; resident, board, vendor, property-specific, and admin visibility map only to `private-documents`.
  - [x] Test property-specific uploads require a valid related property ID and keep the 4.1 same-community validation path intact.
  - [x] Test the server action parses FormData safely and never accepts user-submitted storage bucket/path fields.
  - [x] Test the admin page renders accessible upload controls and generic status messages without leaking private paths, service-role configuration, or raw errors.
  - [x] Test public, resident, guest, and client-facing files do not import document upload services, service-role clients, private bucket constants, signed URL helpers, or document management permissions.
  - [x] Run `npm test`, `npm run typecheck`, `npm run lint`, `npm run build`, and `git diff --check`.

### Review Findings

- [x] [Review][Patch] Optional related record inputs are placeholder-only and need accessible labels [app/(admin)/admin/documents/page.tsx:286]

## Dev Notes

Story 4.2 builds directly on Story 4.1. Story 4.1 created document metadata, visibility enums, permission-checked metadata RPCs, `app.can_read_document`, `document_access_logs`, and `server/services/documents/document-metadata.ts`. It intentionally did not create Storage buckets, upload files, generate signed URLs, stream private files, or build document list UI. Keep this story to storage bucket setup, upload routing, metadata creation, cleanup, and upload UX.

### Current Files To Update

- `server/services/documents/document-metadata.ts`
  - Current state: server-only metadata service with `createDocumentMetadata`, `updateDocumentMetadata`, `listDocumentMetadata`, safe unions, user-scoped Supabase RPC calls, validation helpers, and `admin.documents.manage` authorization for metadata writes.
  - Change: prefer reuse from the new upload service instead of duplicating metadata RPC logic. Only change this file if the upload service needs a small exported type/helper; avoid broad refactors.
  - Preserve: metadata validation, visibility values, property-specific requirement, user-scoped RPCs, and no service-role imports in this metadata service.
- `supabase/migrations/202605110010_document_metadata_and_visibility_model.sql`
  - Current state: creates `documents`, `document_access_logs`, document visibility/status constraints, `admin.documents.manage`, `board.documents.view`, `app.can_read_document`, metadata RPCs, RLS, revokes, and audit intent for metadata creation/visibility/status changes.
  - Change: do not edit this historical migration. Add a new ordered migration for buckets and storage upload routing.
  - Preserve: direct table access remains revoked; private metadata remains guarded by database authorization.
- `lib/supabase/service-role.ts`
  - Current state: server-only trusted Supabase client using `SUPABASE_SECRET_KEY` or `SUPABASE_SERVICE_ROLE_KEY`, with browser session persistence disabled.
  - Change: reuse from the new upload service only. Do not duplicate service-role construction.
  - Preserve: this module must remain server-only and must never be imported by client-facing code.
- `server/services/audit/write-audit-log.ts`
  - Current state: server-only audit writer using trusted Supabase access.
  - Change: use for an explicit upload audit event if metadata create audit does not fully satisfy upload auditability.
  - Preserve: do not expose audit internals or raw errors in UI/service results.
- `app/(admin)/admin/payments/page.tsx` and `app/(admin)/admin/delinquency/page.tsx`
  - Current state: focused admin pages with server-side services, search params, filters/status notices, tables/forms, and no full admin shell.
  - Change: use as UI/style precedent for a minimal document upload page.
  - Preserve: restrained admin UI, accessible controls, generic error/success states, and no secret/private-data leakage.
- `app/(public)/documents/page.tsx`
  - Current state: public placeholder only, intentionally no Supabase/private document access.
  - Change: none expected in 4.2.
  - Preserve: no private document metadata, private bucket names, signed URLs, account/property financial data, or server service imports.
- `app/(resident)/portal/(member)/documents/page.tsx`
  - Current state: member-gated placeholder using `getResidentPortalMemberships()` and `membershipPermissions.canViewDocuments`.
  - Change: none expected in 4.2.
  - Preserve: `canViewDocuments` remains the resident document gate; no upload controls here.

### New Files Likely Needed

- `supabase/migrations/202605110011_secure_document_upload_and_storage_routing.sql`
- `server/services/documents/document-upload.ts`
- `server/actions/document-upload.ts`
- `app/(admin)/admin/documents/page.tsx`
- `tests/document-upload.test.mjs`

Optional only if the implementation needs a shared server-only helper:

- `server/services/storage/document-buckets.ts`

Do not add reusable upload helpers under `lib/public`, `components/public`, `components/resident`, or any client component path.

### Suggested Service Contract

Use a narrow contract similar to:

```ts
type DocumentUploadInput = {
  communityId?: string | null;
  communitySlug?: string | null;
  title: string;
  description?: string | null;
  category: string;
  visibility: string;
  relatedPropertyId?: string | null;
  relatedVendorId?: string | null;
  relatedMeetingId?: string | null;
  relatedComplianceTaskId?: string | null;
  relatedAssessmentId?: string | null;
  effectiveDate?: string | null;
  expirationDate?: string | null;
  file: File;
};

type DocumentUploadResult =
  | { kind: "uploaded"; record: DocumentMetadataRecord }
  | { kind: "unauthenticated" }
  | { kind: "profile-unavailable"; message: string }
  | { kind: "permission-denied"; message: string }
  | { kind: "invalid-input"; message: string; fieldErrors: Record<string, string[]> }
  | { kind: "documents-unavailable"; message: string };
```

Recommended constants:

```ts
const PUBLIC_DOCUMENT_BUCKET = "public-documents";
const PRIVATE_DOCUMENT_BUCKET = "private-documents";
const TEMP_DOCUMENT_BUCKET = "uploads-temp";
const MAX_DOCUMENT_UPLOAD_BYTES = 6 * 1024 * 1024;

const PRIVATE_VISIBILITIES = new Set([
  "resident",
  "board",
  "vendor",
  "property_specific",
  "admin",
]);
```

### Upload Routing Rules

- `public`: upload to `public-documents`; metadata `visibility` must be `public`.
- `resident`: upload to `private-documents`; metadata `visibility` must be `resident`.
- `board`: upload to `private-documents`; metadata `visibility` must be `board`.
- `vendor`: upload to `private-documents`; metadata `visibility` must be `vendor`; readable only through admin-managed/future vendor authorization from Story 4.1.
- `property_specific`: upload to `private-documents`; metadata `visibility` must be `property_specific` and `relatedPropertyId` is required.
- `admin`: upload to `private-documents`; metadata `visibility` must be `admin`.

The service should choose bucket and path after validation. Never accept bucket/path from form data or query params.

### Failure and Cleanup Rules

- Validate metadata, permission, MIME type, size, and safe filename before upload.
- If validation or authorization fails, do not call Storage.
- If Storage upload fails, return a generic unavailable or invalid-input result without raw provider details.
- If metadata creation fails after Storage upload succeeds, remove the uploaded object from the same bucket/path.
- If cleanup fails, return a safe error and preserve enough server-side audit/logging context for maintainers. Do not surface private paths or raw Supabase errors to the user.
- Do not generate public URLs, signed URLs, or download links in this story.

### Permission Notes

Story 4.1 currently grants:

- `admin.documents.manage` to `admin`
- `board.documents.view` to `board_member` and `admin`

For 4.2, the safest implementation is to require `admin.documents.manage` for uploads because metadata creation already uses that permission. If product intent requires board members to upload documents now, add a new explicit permission such as `board.documents.manage`, seed it deliberately, update metadata create/update authorization to accept it where appropriate, and test that residents/vendors/legal reviewers still cannot upload. Do not silently treat `board.documents.view` as upload permission.

### Security and Privacy Guardrails

- Server Functions/actions are callable through direct POST requests. Page-level UI guards are not enough; authorization must happen inside the upload service/action.
- The service-role key bypasses Supabase RLS. Use it only after explicit application authorization and only for Storage upload/remove operations.
- Public buckets make object retrieval public to anyone with the URL. Public bucket paths must be random and only used for documents whose validated visibility is `public`.
- Private documents must never be uploaded to `public-documents`, even temporarily.
- Do not store private user/property/payment data in object paths, file names, public result messages, query params, or test fixture names.
- Do not expose `storagePath`, `storageBucket`, private bucket constants, service-role configuration, signed URL helpers, or raw provider errors in public/resident/client-facing code.

### Testing Requirements

- Follow the existing fast `node:test` static guardrail style used by `tests/document-metadata.test.mjs`, `tests/admin-payment-management.test.mjs`, and `tests/delinquency-reporting.test.mjs`.
- Static tests should inspect the migration, upload service, server action, admin page, and client-facing files because there is no live Supabase Storage integration harness in this repo yet.
- Include negative assertions for forbidden imports and leakage: `createServiceRoleClient` outside server-only upload/audit/storage files, `SUPABASE_SERVICE_ROLE_KEY`, raw `error.message`, `signedUrl`, `createSignedUrl`, `private-documents` in public/resident UI, owner names, account numbers, public payment codes, guest emails/phones, and direct browser Storage upload calls.
- Include ordering assertions that permission validation happens before `createServiceRoleClient()` and before `.storage.from(...).upload(...)`.
- Include cleanup assertions that `.remove(...)` is called when metadata creation fails after upload.

### Current Local Technical Information

- Current installed stack from `npm ls`: Next.js `16.2.4`, React `19.2.5`, `@supabase/ssr` `0.10.3`, `@supabase/supabase-js` `2.105.3`.
- `package.json` scripts: `npm test` runs `node --test tests/*.test.mjs`; `npm run lint` delegates to `npm run typecheck`; `npm run build` uses Next/Turbopack.
- No `project-context.md` file was found during story creation.
- Git history only shows initial scaffold commits; current story files, migrations, services, and tests are more useful than commit history for implementation patterns.
- The workspace already has many pre-existing modified/untracked files from earlier stories. Do not revert unrelated changes.

### Previous Story Intelligence

- Story 4.1 established the document visibility model and database-level read rules. Reuse it rather than creating a parallel upload metadata table.
- Story 4.1 review fixes included anonymous public metadata listing behavior and full optional-field clearing for updates. Preserve those fixes.
- Story 4.1 tests intentionally failed if upload, signed URL, or bucket behavior leaked into metadata scope. 4.2 should add those behaviors in new upload-specific files/tests and update only the test boundaries that are intentionally superseded.
- Existing tests frequently prevent mistakes by checking forbidden imports/strings in public, resident, guest, and client-facing code. Keep that pattern for upload privacy.

### Latest Technical Information

- Supabase Storage buckets can define public/private access, max file size, and allowed MIME types. Private buckets are private by default; public buckets bypass retrieval access controls for anyone with an asset URL, while uploads/deletes still require policies or trusted server credentials. Source: https://supabase.com/docs/guides/storage/buckets/fundamentals
- Supabase Storage access control uses RLS policies on `storage.objects`. By default, uploads are not allowed without policies; service keys bypass RLS and must never be shared publicly. Source: https://supabase.com/docs/guides/storage/security/access-control
- Supabase bucket creation supports client libraries and SQL, and bucket options can restrict MIME types and max file size. Source: https://supabase.com/docs/guides/storage/buckets/creating-buckets/
- Supabase standard uploads are best suited for files not larger than 6 MB; larger uploads should use resumable upload patterns later. Uploads should pass `contentType` explicitly and avoid overwriting paths. Source: https://supabase.com/docs/guides/storage/uploads/standard-uploads
- Next.js Server Functions are reachable through direct POST requests, so authentication and authorization must be verified inside every Server Function. Source: https://nextjs.org/docs/app/getting-started/mutating-data

### Project Structure Notes

- Database/storage bucket changes belong in a new ordered migration. Do not edit historical migrations.
- Document upload business logic belongs under `server/services/documents/...` with `import "server-only"`.
- Upload form parsing belongs in `server/actions/document-upload.ts` with `"use server"`.
- The minimal admin upload page belongs under `app/(admin)/admin/documents/page.tsx`.
- Public and resident document pages should remain privacy-safe placeholders until Story 4.3.
- Full signed download routes belong to Story 4.4, likely `app/api/documents/[id]/signed-url/route.ts`.

### References

- [Epics: Story 4.2](/home/smount/Websites/SpringMeadowCommunity/_bmad-output/planning-artifacts/epics.md)
- [Requirements: Documents](/home/smount/Websites/SpringMeadowCommunity/docs/bmad/phase-1-requirements/requirements.md)
- [Architecture: Document Access and Controls](/home/smount/Websites/SpringMeadowCommunity/docs/bmad/phase-2-architecture/architecture.md)
- [Data Model: Documents, Buckets, and Storage Security](/home/smount/Websites/SpringMeadowCommunity/docs/bmad/phase-3-design/data-model.md)
- [API Design: Documents API](/home/smount/Websites/SpringMeadowCommunity/docs/bmad/phase-3-design/api.md)
- [Tasks: TASK-DOC-001, TASK-DOC-002, TASK-DOC-004, TASK-FE-009, TASK-PAGE-021](/home/smount/Websites/SpringMeadowCommunity/docs/bmad/phase-4-tasks/tasks-v1.md)
- [Previous Story 4.1](/home/smount/Websites/SpringMeadowCommunity/_bmad-output/implementation-artifacts/4-1-document-metadata-and-visibility-model.md)
- [Document Metadata Service](/home/smount/Websites/SpringMeadowCommunity/server/services/documents/document-metadata.ts)
- [Service Role Client](/home/smount/Websites/SpringMeadowCommunity/lib/supabase/service-role.ts)
- [Admin Payments Page Pattern](/home/smount/Websites/SpringMeadowCommunity/app/(admin)/admin/payments/page.tsx)
- [Delinquency Report Page Pattern](/home/smount/Websites/SpringMeadowCommunity/app/(admin)/admin/delinquency/page.tsx)

## Dev Agent Record

### Agent Model Used

GPT-5 Codex

### Debug Log References

- `node --test tests/document-upload.test.mjs` - failed in red phase because the migration, upload service, server action, and admin page did not exist.
- `node --test tests/document-upload.test.mjs` - failed once after implementation on an overbroad ordering assertion that matched imports before function body; fixed the test and upload option typo.
- `node --test tests/document-upload.test.mjs` - passed.
- `npm run typecheck` - passed.
- `npm test` - passed.
- `npm run lint` - passed.
- `npm run build` - passed.
- `git diff --check` - passed.
- `node --test tests/document-upload.test.mjs` - passed after code review fix.
- `npm run typecheck` - passed after code review fix.
- `npm test` - passed after code review fix.
- `git diff --check` - passed after code review fix.

### Implementation Plan

- Added a Supabase Storage bucket migration for public/private/temp document buckets with 6 MiB limits and document-safe MIME allowlists.
- Added a server-only upload service that validates metadata and files, checks `admin.documents.manage`, routes bucket/path server-side, uploads with service-role Storage only after authorization, creates metadata through the 4.1 service, cleans up objects on metadata failure, and writes upload audit intent.
- Added a server action and focused admin upload page with accessible controls and generic status feedback.
- Added static guardrail coverage for bucket setup, upload routing, cleanup, server action parsing, admin page safety, and public/resident/client-facing privacy boundaries.
- Addressed code review finding by replacing placeholder-only optional related-record controls with explicit labels and adding test coverage for those labels.

### Completion Notes List

- Ultimate context engine analysis completed - comprehensive developer guide created.
- Implemented secure document upload and storage routing for public vs private visibility.
- Preserved Story 4.3 and 4.4 scope by not adding public/resident listing or signed download behavior.
- Verified with the new upload test, full test suite, typecheck/lint, production build, and diff whitespace check.
- Resolved review finding: optional related-record inputs now have accessible labels.

### Change Log

- 2026-05-15: Implemented Story 4.2 secure document upload and storage routing.
- 2026-05-15: Addressed code review finding for optional related-record field labels.

### File List

- `_bmad-output/implementation-artifacts/4-2-secure-document-upload-and-storage-routing.md`
- `_bmad-output/implementation-artifacts/sprint-status.yaml`
- `supabase/migrations/202605110011_secure_document_upload_and_storage_routing.sql`
- `server/services/documents/document-upload.ts`
- `server/actions/document-upload.ts`
- `app/(admin)/admin/documents/page.tsx`
- `tests/document-upload.test.mjs`
