# Story 4.4: Signed Private Document Download

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As an authorized document viewer,
I want private document downloads to use short-lived signed access,
so that private HOA records are protected while remaining usable.

## Acceptance Criteria

1. Given an authorized user requests a private document download, when server-side authorization succeeds, then the system creates a short-lived signed URL or equivalent secure file response, and a document access log records the allowed access.
2. Given a user without access requests a private document, when authorization fails, then no signed URL is created, and a denied access log can be recorded without exposing private metadata.
3. Given a public document is requested, when the file is accessed, then the public access path is used only if the metadata visibility is public and the document is active, and private storage paths are never exposed through listing UI, route error bodies, or unauthorized responses.

## Tasks / Subtasks

- [x] Add an authorization-backed document download metadata RPC. (AC: 1, 2, 3)
  - [x] Add the next ordered migration after `supabase/migrations/202605110011_secure_document_upload_and_storage_routing.sql`, likely `supabase/migrations/202605110012_signed_private_document_download.sql`.
  - [x] Add a narrow `public.get_authorized_document_download_metadata(target_document_id uuid)` or equivalent security-definer function with explicit `search_path`.
  - [x] Reuse `app.can_read_document(target_document_id)` as the source of truth for public, resident, property-specific, board, admin, active, in-window, and deleted/status authorization.
  - [x] Return safe metadata only when access is allowed: document ID, community ID, visibility, status, storage provider, storage bucket, storage path, content type, size bytes, title, and category as needed by the server-only download service.
  - [x] For denied or missing documents, return a generic status without private metadata, storage bucket/path, related property IDs, owner/account data, raw SQL errors, or existence-specific UI details.
  - [x] Keep direct `documents` and `document_access_logs` table grants revoked; grant execute on the new RPC deliberately to `anon` and `authenticated` only if public documents must be downloadable through the same route.
- [x] Add a server-only document download service. (AC: 1, 2, 3)
  - [x] Add `server/services/documents/document-download.ts` with `import "server-only"`.
  - [x] Validate `documentId` as UUID before querying or signing.
  - [x] Call the new user-scoped RPC through `createClient()` for authorization and authorized metadata retrieval. Do not direct-query `documents` with a browser/client Supabase client.
  - [x] Use `createServiceRoleClient()` only after the RPC authorizes access and only inside this server-only service for Storage `createSignedUrl`, `getPublicUrl`, optional private download streaming, or access-log insert operations.
  - [x] For private visibilities (`resident`, `board`, `vendor`, `property_specific`, `admin`), create a short-lived signed URL against `private-documents` only after authorization. Use a short MVP expiry such as 60 seconds unless tests document a different bounded value.
  - [x] For `public` visibility, use the public bucket access path only when the authorized metadata says visibility is `public`, status is `active`, and the bucket is `public-documents`. Do not sign public objects from `private-documents`.
  - [x] Verify the storage bucket matches the visibility contract from Story 4.2: public documents use `public-documents`; every private visibility uses `private-documents`.
  - [x] Insert `document_access_logs` rows for allowed signed/public access and best-effort denied attempts when a target document can be identified. Use `access_type = 'signed_url_created'` for signed URL creation and `result = 'allowed' | 'denied'`.
  - [x] Return safe union results only: signed/public URL success with `expiresInSeconds`, invalid input, unauthenticated, permission denied, not found/unavailable, and documents unavailable. Do not return raw Supabase errors, service-role details, bucket names, storage paths, account numbers, owner names, payment data, or audit internals to route callers.
- [x] Add a download route for document access. (AC: 1, 2, 3)
  - [x] Add `app/api/documents/[documentId]/signed-url/route.ts` following current route-handler patterns in `app/api/guest-payments/...` and `app/api/stripe/webhook/route.ts`.
  - [x] Export `runtime = "nodejs"` and `dynamic = "force-dynamic"` or equivalent no-cache behavior so signed access is never statically cached.
  - [x] Implement `GET` only. Parse `params.documentId`, call the server-only download service, and return generic JSON statuses such as `invalid-request`, `unauthorized`, `not-found`, or `documents-unavailable`.
  - [x] Return `{ ok: true, url, expiresInSeconds }` for JSON clients. If UI links use the same route, an optional safe redirect mode such as `?redirect=1` may redirect only after successful authorization.
  - [x] Set response headers that prevent caching of signed/private access responses.
  - [x] Do not include storage bucket, storage path, raw errors, related property IDs, profile IDs, audit IDs, or private metadata in any failure response.
- [x] Wire download affordances into authorized document lists without leaking storage details. (AC: 1, 2, 3)
  - [x] Update `app/(resident)/portal/(member)/documents/page.tsx` to show a download action only for records returned by authorized listing. The action must reference the document ID, not storage bucket/path.
  - [x] Update `app/(admin)/admin/documents/page.tsx` to show a compact download action in the authorized listing table for records returned by `listDocumentMetadata()`.
  - [x] Update `app/(public)/documents/page.tsx` only if needed to provide a public download action. Public actions must still call the route or public access path by document ID and must not expose private categories, private counts, storage bucket/path, or signed URLs in server-rendered markup.
  - [x] Keep all listing filters from Story 4.3 intact. Do not widen document listing access client-side to make downloads easier.
  - [x] Do not add download actions to pages that have not already obtained authorized metadata from `listDocumentMetadata()`.
- [x] Preserve privacy boundaries and story scope. (AC: 1, 2, 3)
  - [x] Do not create, update, upload, archive, delete, or recategorize documents in this story.
  - [x] Do not move upload authorization out of `server/services/documents/document-upload.ts`.
  - [x] Do not import `createServiceRoleClient`, private bucket constants, storage paths, signed URL helpers, or document download services into public/resident components or client-facing libraries.
  - [x] Do not expose `storagePath`, `storageBucket`, service-role configuration, raw Supabase errors, `document_access_logs` IDs, owner names, account numbers, public payment codes, guest PII, or payment data in UI or API failure bodies.
  - [x] Keep `vendor` visibility private/admin-managed until a vendor authorization model exists. A normal resident must never get vendor document signed access.
- [x] Extend verification. (AC: 1, 2, 3)
  - [x] Add `tests/document-download.test.mjs`.
  - [x] Test the new SQL migration creates the authorized download metadata RPC, reuses `app.can_read_document`, grants execute deliberately, avoids broad table grants, and does not return private metadata on denied paths.
  - [x] Test the download service is server-only, validates UUIDs, calls the authorization RPC before `createServiceRoleClient()`, creates signed URLs only after authorization, uses bounded expiry, enforces public/private bucket contracts, and records allowed/denied `document_access_logs`.
  - [x] Test the route is dynamic/no-cache, accepts `GET`, returns generic safe failures, and does not expose raw errors, storage bucket/path, service-role details, audit internals, or private resident/payment identifiers.
  - [x] Test public/resident/admin document pages add only document-ID based download actions and still do not render storage paths, bucket names, signed URLs, service-role imports, or private counts.
  - [x] Test public, resident, guest, and client-facing files do not import `document-download`, `createServiceRoleClient`, `service-role`, `private-documents`, `storageBucket`, `storagePath`, `createSignedUrl`, or `admin.documents.manage`.
  - [x] Run `node --test tests/document-download.test.mjs`, `npm test`, `npm run typecheck`, `npm run lint`, `npm run build`, and `git diff --check`.

### Review Findings

- [x] [Review][Patch] Valid document UUIDs are rejected [server/services/documents/document-download.ts:25] — Fixed the UUID regex to accept standard `8-4-4-4-12` UUIDs and extended the download guardrail test.
- [x] [Review][Patch] Denied and missing documents return distinguishable failure codes [app/api/documents/[documentId]/signed-url/route.ts:58] — Aligned unauthorized/profile-denied and missing document route outcomes to the same generic `not-found` 404 body and extended the route guardrail test.

## Dev Notes

Story 4.4 is the file delivery layer for the document foundation. Stories 4.1, 4.2, and 4.3 deliberately stopped short of downloads: 4.1 created metadata and `app.can_read_document`, 4.2 uploaded files into public/private buckets, and 4.3 listed authorized metadata without file links. This story must reuse those boundaries instead of inventing a second authorization model.

### Current Files To Update

- `supabase/migrations/202605110010_document_metadata_and_visibility_model.sql`
  - Current state: creates `documents`, `document_access_logs`, `app.can_read_document`, metadata JSON helpers, and `public.list_document_metadata`.
  - Change: do not edit this historical migration. Add a new ordered migration for the download authorization RPC.
  - Preserve: `app.can_read_document` remains the single document read authorization source; direct table access stays revoked.
- `supabase/migrations/202605110011_secure_document_upload_and_storage_routing.sql`
  - Current state: creates `public-documents`, `private-documents`, and `uploads-temp` buckets with size/MIME limits and no broad direct private object policies.
  - Change: do not edit this historical migration. Reuse its bucket names and privacy contract.
  - Preserve: private object reads are not opened through broad Storage RLS policies.
- `server/services/documents/document-metadata.ts`
  - Current state: server-only create/update/list metadata service with validation and user-scoped RPC calls. It returns `DocumentMetadataRecord`, including storage bucket/path for server workflows, but pages must not render those fields.
  - Change: prefer not to change this service. Add a separate download service rather than mixing signing into metadata list/create/update.
  - Preserve: no service-role import in metadata service.
- `server/services/documents/document-upload.ts`
  - Current state: server-only upload service that validates input, checks `admin.documents.manage`, routes public/private buckets, uploads with service-role Storage, creates metadata, and cleans up after metadata failure.
  - Change: do not move upload logic. Reuse constants or duplicate small bucket name literals only if importing upload constants would create a bad dependency.
  - Preserve: upload remains admin-managed and does not generate signed URLs.
- `lib/supabase/service-role.ts`
  - Current state: server-only trusted Supabase client using `SUPABASE_SECRET_KEY` or `SUPABASE_SERVICE_ROLE_KEY`, with browser session persistence disabled.
  - Change: reuse only inside server-only download/audit code after authorization.
  - Preserve: never import this module in public/resident pages, client components, `lib/public`, or route response contracts.
- `app/api/guest-payments/lookup/route.ts`, `app/api/guest-payments/create-session/route.ts`, and `app/api/stripe/webhook/route.ts`
  - Current state: route-handler examples with safe JSON responses, validation before service work, rate limiting where public abuse-prone, and no raw provider errors.
  - Change: use as route style precedent.
  - Preserve: no unrelated payment, Stripe, or Turnstile dependencies in document download code.
- `app/(public)/documents/page.tsx`
  - Current state: server-rendered public document library using `listDocumentMetadata({ visibility: "public", status: "active" })`; it renders safe metadata only and no file links.
  - Change: add a safe public download action by document ID if implementing public access from listing.
  - Preserve: no private metadata counts/categories/existence, no private visibility labels, no storage bucket/path, no signed URLs in markup.
- `app/(resident)/portal/(member)/documents/page.tsx`
  - Current state: member-gated resident listing using `getResidentPortalMemberships()`, `canViewDocuments`, and two `listDocumentMetadata()` calls for resident and property-specific records.
  - Change: add download actions for authorized returned records only.
  - Preserve: property filter safety, generic invalid/unlinked property behavior, and no board/admin/vendor/unrelated property leakage.
- `app/(admin)/admin/documents/page.tsx`
  - Current state: focused admin upload and authorized listing page with filters, pagination, and safe metadata rendering.
  - Change: add compact download actions in the authorized listing.
  - Preserve: upload form/action, filter behavior, generic unavailable/invalid states, and no raw storage paths/buckets.

### New Files Likely Needed

- `supabase/migrations/202605110012_signed_private_document_download.sql`
- `server/services/documents/document-download.ts`
- `app/api/documents/[documentId]/signed-url/route.ts`
- `tests/document-download.test.mjs`

Optional only if the implementation chooses server-side form redirects instead of route links:

- `server/actions/document-download.ts`

Do not add download helpers under `lib/public`, `components/public`, `components/resident`, or client components.

### Suggested Service Contract

Use a narrow contract similar to:

```ts
type DocumentDownloadInput = {
  documentId: string;
};

type DocumentDownloadResult =
  | { kind: "download-url"; url: string; expiresInSeconds: number; access: "signed" | "public" }
  | { kind: "invalid-input"; message: string; fieldErrors: Record<string, string[]> }
  | { kind: "unauthenticated" }
  | { kind: "permission-denied"; message: string }
  | { kind: "not-found"; message: string }
  | { kind: "documents-unavailable"; message: string };
```

Recommended constants:

```ts
const PUBLIC_DOCUMENT_BUCKET = "public-documents";
const PRIVATE_DOCUMENT_BUCKET = "private-documents";
const SIGNED_DOCUMENT_URL_EXPIRES_SECONDS = 60;
```

### Authorization and Delivery Rules

- Authorization must happen server-side for every route/action call. Page-level presence of a download button is only a convenience.
- The authorization RPC should call `app.can_read_document(target_document_id)`. Do not reimplement visibility logic in TypeScript as the source of truth.
- Public documents can be delivered by public bucket URL only if metadata says `visibility = "public"`, `status = "active"`, and the bucket is `public-documents`.
- Private documents can be delivered only after authorization and only from `private-documents`. Use a short-lived signed URL or a server-streamed response.
- If using signed URLs, create them after authorization with trusted server credentials. Do not write signed URLs into server-rendered markup, logs, database records, or long-lived state.
- If using a redirect mode for UI download links, return/redirect only after authorization and set no-cache headers.
- Denied responses must be generic. They may say the document is unavailable, but must not reveal title, category, visibility, bucket, path, related property, or whether a private document exists.
- Access logging should be best effort and must never block a safe denial or leak raw errors. Allowed private signed URL creation should be logged as `access_type = 'signed_url_created', result = 'allowed'`. Denied attempts should use `result = 'denied'` when the target document can be identified safely server-side.

### Public, Resident, And Admin UI Rules

- Download controls should be plain command links/buttons in existing document cards/tables. Keep the current restrained page styles; do not add a landing page, modal-heavy workflow, or full admin shell.
- Use document IDs in link/action inputs. Never use storage bucket/path in hrefs, hidden inputs, query params, or rendered text.
- Public documents: keep category datalist options derived only from returned public records; adding a public download action must not introduce totals or private categories.
- Resident documents: keep the membership gate, `canViewDocuments`, and property filter safety from 4.3. Do not show actions for records not returned by authorized listing.
- Admin documents: keep upload controls and listing filters unchanged; add download action without exposing storage internals.

### Previous Story Intelligence

- Story 4.1 created `public.documents`, `public.document_access_logs`, `app.can_read_document`, metadata RPCs, and `server/services/documents/document-metadata.ts`.
- Story 4.1 review fixed anonymous public metadata listing while preserving `app.can_read_document`; do not accidentally require login for public document downloads.
- Story 4.2 created Storage buckets and upload routing. Public documents go to `public-documents`; resident, board, vendor, property-specific, and admin documents go to `private-documents`.
- Story 4.2 keeps service-role Storage operations inside server-only code after authorization. Follow that pattern for signing/downloading.
- Story 4.3 created public, resident, and admin listing pages. Those pages intentionally render no storage fields or signed URLs. Add only document-ID based download actions.
- Existing document tests are static guardrails. Add focused download assertions instead of weakening metadata, upload, or listing privacy tests.

### Testing Requirements

- Follow the existing `node:test` source-inspection style. There is no live Supabase Storage integration harness in this repo.
- Include ordering assertions: validation and authorization RPC must happen before `createServiceRoleClient()` and before `.storage.from(...).createSignedUrl(...)` or `.download(...)`.
- Include negative assertions for `error.message`, `storagePath`, `storageBucket`, `private-documents`, `public-documents`, `createServiceRoleClient`, `service-role`, `SUPABASE_SERVICE_ROLE_KEY`, owner names, account numbers, public payment codes, guest emails/phones, and payment data in public/resident/client-facing surfaces.
- Keep older story tests passing. If a 4.1, 4.2, or 4.3 guardrail needs narrowing because 4.4 intentionally adds download behavior, narrow it precisely and keep the original privacy intent.

### Current Local Technical Information

- Current installed dependencies from `package.json`: Next.js `^16.0.0`, React `^19.0.0`, `@supabase/ssr` `^0.10.3`, `@supabase/supabase-js` `^2.105.3`, Stripe `^22.1.1`, Resend `^6.12.3`.
- `package.json` scripts: `npm test` runs `node --test tests/*.test.mjs`; `npm run lint` delegates to `npm run typecheck`; `npm run build` uses Next/Turbopack.
- No `project-context.md` file was found during story creation.
- Git history only shows initial scaffold commits; current story files, migrations, services, pages, and tests are more useful than commit history.
- The workspace already has many pre-existing modified/untracked files from earlier stories. Do not revert unrelated changes.

### Latest Technical Information

- Supabase private buckets require authorized downloads or time-limited signed URLs; public buckets bypass retrieval access controls for anyone with the asset URL. Source: https://supabase.com/docs/guides/storage/buckets/fundamentals
- Supabase JavaScript Storage `createSignedUrl(path, expiresIn)` creates a URL for a fixed amount of time and requires the object path plus expiry seconds. Source: https://supabase.com/docs/reference/javascript/storage-from-createsignedurls
- Supabase Storage serving docs describe authenticated private downloads and signed URLs for private assets. Source: https://supabase.com/docs/guides/storage/serving/downloads
- Next.js Route Handlers live in `route.ts` files under `app`, support `GET`, and use the Web `Request`/`Response` APIs. Source: https://nextjs.org/docs/app/building-your-application/routing/route-handlers
- Next.js redirects can be used in Route Handlers when a browser-friendly download redirect is chosen. Source: https://nextjs.org/docs/app/building-your-application/routing/redirecting

### Project Structure Notes

- Database/RPC changes belong in a new ordered migration. Do not edit historical migrations.
- Document download business logic belongs under `server/services/documents/...` with `import "server-only"`.
- The document signed URL route belongs under `app/api/documents/[documentId]/signed-url/route.ts`.
- Server actions belong under `server/actions/...` only if needed for redirect-based forms.
- Static verification belongs in `tests/document-download.test.mjs`.
- Do not place private download logic in `lib/public`, public/resident components, or browser/client code.

### References

- [Epics: Story 4.4](/home/smount/Websites/SpringMeadowCommunity/_bmad-output/planning-artifacts/epics.md)
- [Requirements: Documents](/home/smount/Websites/SpringMeadowCommunity/docs/bmad/phase-1-requirements/requirements.md)
- [Architecture: Explicit Authorization and Document Access](/home/smount/Websites/SpringMeadowCommunity/docs/bmad/phase-2-architecture/architecture.md)
- [Data Model: Storage Buckets and Document Access Logs](/home/smount/Websites/SpringMeadowCommunity/docs/bmad/phase-3-design/data-model.md)
- [API Design: Signed Download URL](/home/smount/Websites/SpringMeadowCommunity/docs/bmad/phase-3-design/api.md)
- [Tasks: TASK-DOC-003](/home/smount/Websites/SpringMeadowCommunity/docs/bmad/phase-4-tasks/tasks-v1.md)
- [Previous Story 4.3](/home/smount/Websites/SpringMeadowCommunity/_bmad-output/implementation-artifacts/4-3-authorized-document-listing-and-filtering.md)
- [Previous Story 4.2](/home/smount/Websites/SpringMeadowCommunity/_bmad-output/implementation-artifacts/4-2-secure-document-upload-and-storage-routing.md)
- [Previous Story 4.1](/home/smount/Websites/SpringMeadowCommunity/_bmad-output/implementation-artifacts/4-1-document-metadata-and-visibility-model.md)
- [Document Metadata Service](/home/smount/Websites/SpringMeadowCommunity/server/services/documents/document-metadata.ts)
- [Document Upload Service](/home/smount/Websites/SpringMeadowCommunity/server/services/documents/document-upload.ts)
- [Service Role Client](/home/smount/Websites/SpringMeadowCommunity/lib/supabase/service-role.ts)
- [Public Documents Page](/home/smount/Websites/SpringMeadowCommunity/app/(public)/documents/page.tsx)
- [Resident Documents Page](/home/smount/Websites/SpringMeadowCommunity/app/(resident)/portal/(member)/documents/page.tsx)
- [Admin Documents Page](/home/smount/Websites/SpringMeadowCommunity/app/(admin)/admin/documents/page.tsx)

## Dev Agent Record

### Agent Model Used

GPT-5 Codex

### Debug Log References

- `node --test tests/document-download.test.mjs`
- `npm test`
- `npm run typecheck`
- `npm run lint`
- `npm run build`
- `git diff --check`

### Completion Notes List

- Added a security-definer download metadata RPC that reuses `app.can_read_document` and returns generic statuses without private metadata on denied/missing documents.
- Added a server-only download service that validates UUID input, authorizes with the user-scoped RPC before any trusted Storage operation, creates 60-second signed URLs for private documents, uses public URLs only for active public records in the public bucket, and records best-effort access logs.
- Added a dynamic no-cache `GET` route for JSON clients and safe redirect-mode download links.
- Added document-ID based download actions to public, resident, and admin document listings without rendering storage bucket/path or signed URLs.
- Added static guardrail coverage for the migration, server service, route, UI links, and client-facing privacy boundaries.
- Addressed code review findings for valid UUID acceptance and indistinguishable denied/missing route responses.

### File List

- `_bmad-output/implementation-artifacts/4-4-signed-private-document-download.md`
- `_bmad-output/implementation-artifacts/sprint-status.yaml`
- `app/(admin)/admin/documents/page.tsx`
- `app/(public)/documents/page.tsx`
- `app/(resident)/portal/(member)/documents/page.tsx`
- `app/api/documents/[documentId]/signed-url/route.ts`
- `server/services/documents/document-download.ts`
- `supabase/migrations/202605110012_signed_private_document_download.sql`
- `tests/document-download.test.mjs`

### Change Log

- 2026-05-15: Created Story 4.4 context for signed private document download.
- 2026-05-15: Implemented signed/private and public document download route, service, RPC, UI actions, and verification guardrails.
- 2026-05-15: Addressed code review findings and marked Story 4.4 done.
