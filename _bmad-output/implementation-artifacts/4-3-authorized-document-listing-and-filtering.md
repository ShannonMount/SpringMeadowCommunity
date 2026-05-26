# Story 4.3: Authorized Document Listing and Filtering

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a resident or board/admin user,
I want to browse documents filtered by my authorization,
so that I can find relevant HOA records without seeing restricted files.

## Acceptance Criteria

1. Given a public visitor opens public documents, when the document query runs, then only active public documents are returned, and private document counts, categories, and existence are not leaked.
2. Given a resident with active property membership opens documents, when the document query runs, then resident-visible documents and property-specific documents for linked properties are returned, and board-only, admin-only, vendor-only, and unrelated property-specific documents are excluded.
3. Given a board/admin user with document permissions opens document management or document lists, when the query runs, then documents are returned according to role permissions, community scope, filters, and status, and unauthorized document metadata is not returned.

## Tasks / Subtasks

- [x] Replace the public document placeholder with an authorized public listing. (AC: 1)
  - [x] Update `app/(public)/documents/page.tsx` to call `listDocumentMetadata()` with the default community, `visibility: "public"`, `status: "active"`, bounded pagination, and safe optional filters such as category/search text.
  - [x] Render only safe metadata: title, description, category, content type, size, effective date, expiration date, and an unavailable/empty state. Do not render storage bucket, storage path, uploaded profile IDs, internal profile/property IDs, audit details, private visibility labels, or private document counts.
  - [x] If category filter options are shown, derive them only from the returned public records or from a static public allowlist. Do not query or display all document categories/counts because that leaks private document existence.
  - [x] Keep public page behavior usable without authentication and with generic unavailable/empty states.
- [x] Replace the resident document placeholder with an authorized resident listing. (AC: 2)
  - [x] Update `app/(resident)/portal/(member)/documents/page.tsx` to keep using `getResidentPortalMemberships()` for resident portal gating and `membershipPermissions.canViewDocuments`.
  - [x] Call `listDocumentMetadata()` only after resident membership is active; rely on the SQL/RPC authorization path for final filtering.
  - [x] Support filters that cannot widen access: category, search, and an optional property filter built only from active memberships where `canViewDocuments` is true.
  - [x] For an invalid or unlinked `propertyId` search param, do not render private property details or an existence-specific error. Either omit the property filter or return a generic empty state.
  - [x] Render resident-visible and linked property-specific metadata without showing storage paths, private bucket names, signed URLs, board/admin/vendor-only records, unrelated property records, owner names, full account numbers, or payment data.
  - [x] Preserve the existing document access unavailable state for memberships where `canViewDocuments` is false.
- [x] Extend the admin document page listing and filters without weakening upload security. (AC: 3)
  - [x] Update `app/(admin)/admin/documents/page.tsx` so the listing accepts safe query params for visibility, category, status, search text, effective/expiration date ranges, and page offset, following the filter/pagination style from `app/(admin)/admin/payments/page.tsx` and `app/(admin)/admin/delinquency/page.tsx`.
  - [x] Keep the existing upload form/action from Story 4.2 intact; do not move upload authorization out of `server/services/documents/document-upload.ts`.
  - [x] Use `listDocumentMetadata()` for records and trust its RPC-backed authorization. Admin users with `admin.documents.manage` may list all non-deleted metadata in the community; board users with `board.documents.view` may see only records authorized by `app.can_read_document`.
  - [x] Handle unauthenticated, profile unavailable, permission-limited, empty, invalid-filter, and unavailable states without exposing private metadata. A direct unauthenticated visit to `/admin/documents` must not reveal private rows even if the page still renders generic UI before Epic 5 adds the full admin shell.
  - [x] Do not render file download links, public object URLs, signed URLs, storage bucket/path values, service-role details, raw Supabase errors, audit internals, or private resident/payment identifiers.
- [x] Reuse and, only if necessary, narrowly extend the document metadata service. (AC: 1, 2, 3)
  - [x] Prefer the existing `server/services/documents/document-metadata.ts` `listDocumentMetadata(input)` contract. It already validates filters, bounds page size/offset, calls `public.list_document_metadata`, and returns safe union results.
  - [x] If UI work needs additional display helpers, add them close to the page/component or as server-only document listing helpers. Do not duplicate authorization logic outside `app.can_read_document`/`public.list_document_metadata`.
  - [x] Do not add service-role clients, direct `documents` table queries from pages, browser Supabase document queries, or client-side filtering as the source of truth.
  - [x] Do not create, update, upload, archive, delete, sign, stream, or download files in this story.
- [x] Preserve document listing privacy boundaries. (AC: 1, 2, 3)
  - [x] Public and resident pages must not import document upload services, `admin.documents.manage`, service-role clients, storage bucket constants, signed URL helpers, or admin-only services.
  - [x] Public pages must not expose private document categories/counts/existence through totals, filter options, hidden fields, empty-state wording, logs, or query params.
  - [x] Resident pages must not expose board/admin/vendor records or unrelated property-specific documents through counts, category filters, disabled options, empty-state wording, or raw `propertyId` echoing.
  - [x] Admin/board listing must remain scoped by community and role permissions; filters can narrow the authorized result set only.
  - [x] Keep `vendor` visibility private/admin-managed until a vendor authorization model exists.
- [x] Extend verification. (AC: 1, 2, 3)
  - [x] Add `tests/document-listing.test.mjs`.
  - [x] Test that `public.list_document_metadata` remains granted to `anon` and `authenticated`, uses `app.can_read_document`, supports bounded filters, and does not return counts or category aggregates that could leak private document existence.
  - [x] Test public document page imports and calls `listDocumentMetadata()` with public/active scope, renders filters/empty states, and forbids private buckets, storage paths, signed URL helpers, service-role clients, admin permissions, raw errors, account numbers, owner names, payment codes, guest PII, and private counts.
  - [x] Test resident document page keeps membership gating, uses `canViewDocuments`, offers only safe filters from authorized memberships/records, and forbids admin/upload/service-role/signed-url/private bucket imports and unrelated property leakage.
  - [x] Test admin document page exposes listing filters and pagination while preserving upload form safety and avoiding storage path/bucket/signed-url/raw-error leaks in rendered UI.
  - [x] Test public, resident, guest, and client-facing files do not import `document-upload`, `uploadDocument`, `uploadAdminDocument`, `createServiceRoleClient`, `service-role`, `private-documents`, `storageBucket`, `storagePath`, `signedUrl`, `createSignedUrl`, or `admin.documents.manage`.
  - [x] Run `npm test`, `npm run typecheck`, `npm run lint`, `npm run build`, and `git diff --check`.

## Dev Notes

Story 4.3 turns the document metadata and upload foundations from Stories 4.1 and 4.2 into usable listing surfaces. The central boundary is this: listing may reveal authorized metadata, but it must not deliver files. Story 4.4 owns signed private downloads and any public file access behavior.

### Current Files To Update

- `app/(public)/documents/page.tsx`
  - Current state: public placeholder using `PlaceholderPage`, intentionally no document data.
  - Change: replace with a real public document listing that calls `listDocumentMetadata({ communitySlug, visibility: "public", status: "active", ...filters })`.
  - Preserve: no private document metadata, no private category/count leaks, no storage paths/buckets, no signed URLs, no property/payment/resident details.
- `app/(resident)/portal/(member)/documents/page.tsx`
  - Current state: member-gated placeholder using `getResidentPortalMemberships()` and `membershipPermissions.canViewDocuments`, then shows linked property cards.
  - Change: render authorized document metadata for resident-visible documents plus property-specific documents for linked properties. Keep membership-derived property filters safe.
  - Preserve: the `canViewDocuments` gate, resident portal layout behavior, generic unavailable states, and no board/admin/vendor/unrelated property leakage.
- `app/(admin)/admin/documents/page.tsx`
  - Current state: focused admin upload page from 4.2 with a recent documents table using `listDocumentMetadata({ pageSize: 25 })`.
  - Change: add document listing filters, pagination, better result states, and safe metadata rendering. Keep the upload form and `uploadAdminDocument` action intact.
  - Preserve: restrained admin page style, accessible controls, generic errors, and no storage path/bucket/signed URL exposure.
- `server/services/documents/document-metadata.ts`
  - Current state: server-only metadata service with `createDocumentMetadata`, `updateDocumentMetadata`, `listDocumentMetadata`, safe union results, validation, bounded list filters, and user-scoped Supabase RPC calls.
  - Change: prefer no changes. Only extend if the pages need a narrow display helper or result shape that cannot be handled locally.
  - Preserve: no service-role imports, no direct table reads from pages, no raw Supabase errors, and no client-side authorization as source of truth.
- `supabase/migrations/202605110010_document_metadata_and_visibility_model.sql`
  - Current state: creates `documents`, `document_access_logs`, permissions, `app.can_read_document`, metadata RPCs, RLS, revokes, and `public.list_document_metadata`.
  - Change: do not edit historical migrations unless implementation discovers a true defect. If a fix is required, add a new ordered migration and update tests.
  - Preserve: `app.can_read_document` controls public/resident/board/admin/property-specific visibility, `manager_can_list` is limited to `admin.documents.manage`, and direct table access remains revoked.
- `tests/document-metadata.test.mjs` and `tests/document-upload.test.mjs`
  - Current state: static guardrails for metadata authorization and upload privacy boundaries.
  - Change: keep existing tests passing; add listing-specific coverage in a new file rather than weakening previous story protections.

### New Files Likely Needed

- `tests/document-listing.test.mjs`

Optional, only if it reduces duplication without moving authorization client-side:

- `components/public/document-list.tsx`
- `components/resident/resident-document-list.tsx`
- `components/admin/document-listing-filters.tsx`
- `server/services/documents/document-listing.ts`

Do not add document listing helpers under `lib/public` if they import server-only services. Do not add browser/client document data fetching for protected records.

### Listing Service Contract

Use the existing contract:

```ts
listDocumentMetadata({
  communitySlug?: string | null;
  communityId?: string | null;
  visibility?: "public" | "resident" | "board" | "vendor" | "property_specific" | "admin" | null;
  category?: string | null;
  status?: "active" | "archived" | "deleted" | null;
  relatedPropertyId?: string | null;
  query?: string | null;
  effectiveFrom?: string | null;
  effectiveTo?: string | null;
  expirationFrom?: string | null;
  expirationTo?: string | null;
  pageSize?: number | null;
  pageOffset?: number | null;
});
```

Current safe result shape:

```ts
type DocumentMetadataResult =
  | { kind: "records"; communityId: string; communitySlug: string; records: DocumentMetadataRecord[] }
  | { kind: "unauthenticated" }
  | { kind: "profile-unavailable"; message: string }
  | { kind: "permission-denied"; message: string }
  | { kind: "invalid-input"; message: string; fieldErrors: Record<string, string[]> }
  | { kind: "documents-unavailable"; message: string };
```

`DocumentMetadataRecord` includes storage provider/bucket/path because server-side upload and future download workflows need them. Pages in this story must not render those storage fields.

### Authorization Rules To Preserve

- `public`: active, non-deleted, in-window metadata can be listed publicly. Public listing must not imply access to private buckets, private counts, or file downloads.
- `resident`: active members in the same community with at least one active membership where `can_view_documents = true` can read resident-visible metadata.
- `property_specific`: active members for the related property with `can_view_documents = true` can read it; users with `board.documents.view` or `admin.documents.manage` can also read it in the same community.
- `board`: requires `board.documents.view` or `admin.documents.manage`.
- `admin`: requires `admin.documents.manage`.
- `vendor`: remains private to admin management until vendor portal identity/scope exists.
- `archived`, `deleted`, not-yet-effective, expired, and soft-deleted records are not readable to public/resident/board through `app.can_read_document`. Admin management filters may include status where the RPC permits it, but `deleted_at` rows stay excluded.

### UI Behavior Requirements

- Public listing:
  - Use a full public page layout consistent with the existing public site, not a marketing landing page.
  - Show document cards/table rows optimized for scanning: title, optional description, category, content type, approximate size, effective/expiration date.
  - Use accessible labels for filters. Empty and unavailable states must be generic.
  - Do not show totals unless they are only the count of returned public rows on the current page.
- Resident listing:
  - Keep the resident portal page style and navigation.
  - Show a property filter only from active memberships with `canViewDocuments`.
  - If documents are grouped by property or category, derive groups only from authorized result rows.
  - It is acceptable to show masked account numbers already exposed by resident membership views, but do not add owner names, full account numbers, balances, or payment history.
- Admin listing:
  - Keep the page compact and operational, matching current payment/delinquency admin surfaces.
  - Filters should narrow by status, visibility, category, search text, effective date, expiration date, and pagination.
  - Keep the upload section from 4.2, but make the document table a real management list. No full admin shell/navigation in this story; Epic 5 owns that.

### Previous Story Intelligence

- Story 4.1 created the document visibility model, `public.documents`, `public.document_access_logs`, `app.can_read_document`, metadata RPCs, and `server/services/documents/document-metadata.ts`.
- Story 4.1 review fixes made anonymous public metadata listing possible while keeping `app.can_read_document` as the privacy boundary. Do not accidentally require authentication for public document listing.
- Story 4.1 also fixed optional-field clearing in metadata updates. Avoid touching update code unless necessary.
- Story 4.2 created Storage buckets and the upload flow, but deliberately left public/resident browsing and signed downloads out of scope.
- Story 4.2 keeps uploads behind `admin.documents.manage`, routes public files to `public-documents`, routes all private visibilities to `private-documents`, and keeps service-role Storage operations inside `server/services/documents/document-upload.ts`.
- Existing document tests are static guardrails. Add to them with focused listing assertions instead of replacing them with broad snapshots.

### Current Local Technical Information

- Current installed stack from `npm ls`: Next.js `16.2.4`, React `19.2.5`, `@supabase/ssr` `0.10.3`, `@supabase/supabase-js` `2.105.3`.
- `package.json` scripts: `npm test` runs `node --test tests/*.test.mjs`; `npm run lint` delegates to `npm run typecheck`; `npm run build` uses Next/Turbopack.
- No `project-context.md` file was found during story creation.
- Git history only shows initial scaffold commits; the current story files, migrations, services, and tests are more useful than commit history.
- The workspace already has many pre-existing modified/untracked files from earlier stories. Do not revert unrelated changes.

### Latest Technical Information

- Next.js Server Functions are reachable through direct POST requests, so authorization must be verified inside every Server Function. This matters if listing filters are later coupled to server actions. Source: https://nextjs.org/docs/app/getting-started/mutating-data
- Supabase Storage public buckets bypass access controls for retrieving/serving files by URL, while private buckets require RLS-authorized downloads or signed URLs. Story 4.3 must not generate file URLs; Story 4.4 owns that behavior. Source: https://supabase.com/docs/guides/storage/buckets/fundamentals
- Supabase private bucket assets are not accessible through public URLs; signed URLs are time-limited and should be created server-side only after authorization. Source: https://supabase.com/docs/guides/storage/serving/downloads

### Project Structure Notes

- Public page implementation belongs in `app/(public)/documents/page.tsx`.
- Resident page implementation belongs in `app/(resident)/portal/(member)/documents/page.tsx`.
- Admin listing implementation belongs in `app/(admin)/admin/documents/page.tsx`.
- Server-only document business logic belongs under `server/services/documents/...` with `import "server-only"`.
- Static verification belongs in `tests/document-listing.test.mjs`.
- No database migration should be needed unless a defect is found in the existing list RPC. Do not edit historical migrations for convenience.

### References

- [Epics: Story 4.3](/home/smount/Websites/SpringMeadowCommunity/_bmad-output/planning-artifacts/epics.md)
- [Requirements: Documents and Privacy](/home/smount/Websites/SpringMeadowCommunity/docs/bmad/phase-1-requirements/requirements.md)
- [Architecture: Authorization and Document Architecture](/home/smount/Websites/SpringMeadowCommunity/docs/bmad/phase-2-architecture/architecture.md)
- [Data Model: Documents, Access Logs, and Storage Security](/home/smount/Websites/SpringMeadowCommunity/docs/bmad/phase-3-design/data-model.md)
- [API Design: Documents API](/home/smount/Websites/SpringMeadowCommunity/docs/bmad/phase-3-design/api.md)
- [Tasks: TASK-PAGE-008, TASK-PAGE-021, TASK-QA-004](/home/smount/Websites/SpringMeadowCommunity/docs/bmad/phase-4-tasks/tasks-v1.md)
- [Previous Story 4.2](/home/smount/Websites/SpringMeadowCommunity/_bmad-output/implementation-artifacts/4-2-secure-document-upload-and-storage-routing.md)
- [Previous Story 4.1](/home/smount/Websites/SpringMeadowCommunity/_bmad-output/implementation-artifacts/4-1-document-metadata-and-visibility-model.md)
- [Document Metadata Service](/home/smount/Websites/SpringMeadowCommunity/server/services/documents/document-metadata.ts)
- [Document Upload Service](/home/smount/Websites/SpringMeadowCommunity/server/services/documents/document-upload.ts)
- [Public Documents Placeholder](/home/smount/Websites/SpringMeadowCommunity/app/(public)/documents/page.tsx)
- [Resident Documents Placeholder](/home/smount/Websites/SpringMeadowCommunity/app/(resident)/portal/(member)/documents/page.tsx)
- [Admin Documents Page](/home/smount/Websites/SpringMeadowCommunity/app/(admin)/admin/documents/page.tsx)
- [Document Metadata Migration](/home/smount/Websites/SpringMeadowCommunity/supabase/migrations/202605110010_document_metadata_and_visibility_model.sql)

## Dev Agent Record

### Agent Model Used

GPT-5 Codex

### Debug Log References

- `node --test tests/document-listing.test.mjs` - failed in red phase because public/resident pages were placeholders and admin listing lacked filters/pagination.
- `node --test tests/document-listing.test.mjs` - passed after implementing listing pages and guardrails.
- `npm test` - failed once because the older Story 4.1 metadata boundary test still forbade intentional 4.3 listing-service imports in public/resident document pages.
- `npm test` - passed after narrowing the older boundary test while preserving create/update/storage/signing prohibitions.
- `npm run typecheck` - passed.
- `npm run lint` - passed.
- `npm run build` - passed.
- `git diff --check` - passed.

### Implementation Plan

- Replaced the public document placeholder with a server-rendered public document library that calls `listDocumentMetadata()` with public/active scope and safe category/search filters.
- Replaced the resident document placeholder with a member-gated listing that queries resident-visible and linked property-specific documents separately, preserving `canViewDocuments` and property-filter safety.
- Extended the admin documents page with listing filters, pagination, and safe result states while leaving the Story 4.2 upload form/action intact.
- Added document-listing guardrail tests and updated the older metadata guardrail to allow only the intentional 4.3 listing imports in public/resident document pages.

### Completion Notes List

- Ultimate context engine analysis completed - comprehensive developer guide created.
- Implemented authorized document listing and filtering for public, resident, and admin document surfaces.
- Reused the existing metadata listing service and did not add service-role clients, direct table reads, uploads, downloads, signed URLs, or new migrations.
- Preserved Story 4.4 scope by rendering metadata only and omitting file access links.
- Verified with the new listing test, full test suite, typecheck/lint, production build, and diff whitespace check.

### File List

- `_bmad-output/implementation-artifacts/4-3-authorized-document-listing-and-filtering.md`
- `_bmad-output/implementation-artifacts/sprint-status.yaml`
- `app/(public)/documents/page.tsx`
- `app/(resident)/portal/(member)/documents/page.tsx`
- `app/(admin)/admin/documents/page.tsx`
- `tests/document-listing.test.mjs`
- `tests/document-metadata.test.mjs`

### Change Log

- 2026-05-15: Created Story 4.3 context for authorized document listing and filtering.
- 2026-05-15: Implemented Story 4.3 authorized document listing and filtering; story moved to review.
