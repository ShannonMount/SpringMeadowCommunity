# Story 4.7: Resident Message Thread Creation

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a resident,
I want to send categorized messages to the HOA board,
so that I can ask questions or raise issues tied to my property.

## Acceptance Criteria

1. Given a resident has active membership for a property, when they create a message thread with subject, category, body, and optional attachments, then the system creates a thread linked to the community, property, sender, and category, and the first message is stored in the thread.
2. Given the resident selects a category, when the message is saved, then the category is one of dues, documents, maintenance, architectural, complaint, or general, and invalid categories are rejected with accessible errors.
3. Given a resident attempts to create a thread for an unrelated property, when the action runs, then the request is denied, and no unrelated property information is exposed.

## Tasks / Subtasks

- [x] Add resident messaging schema, RLS, and creation RPCs. (AC: 1, 2, 3)
  - [x] Add the next ordered migration after `supabase/migrations/202605110014_event_management_and_calendar_display.sql`, likely `supabase/migrations/202605110015_resident_message_thread_creation.sql`.
  - [x] Create `public.message_threads` and `public.messages` if they do not already exist, following the canonical data model fields: `community_id`, `property_id`, subject, category, status, `created_by`, optional `assigned_to`, `last_message_at`, close timestamps, sender/message fields, attachment document IDs, visibility, edit/delete timestamps, and standard timestamps.
  - [x] Enforce message categories exactly: `dues`, `documents`, `maintenance`, `architectural`, `complaint`, and `general`.
  - [x] Enforce thread statuses at least: `open`, `pending_board`, `pending_resident`, `closed`, and `archived`. For initial resident-created threads, use `open` to match the canonical data model default unless the migration, service, and tests deliberately document a `pending_board` initial state.
  - [x] Enforce message sender roles exactly: `resident`, `board_member`, and `admin`; Story 4.7 creates only `resident` first messages.
  - [x] Enforce message visibility exactly: `thread_participants` and `board_admin_only`; Story 4.7 resident-created first messages must use `thread_participants`.
  - [x] Add indexes for board/resident workflow reads: `(community_id, property_id, last_message_at desc)`, `(community_id, status, last_message_at desc)`, `(community_id, assigned_to, status)`, `(community_id, thread_id, created_at)`, and any GIN index needed for `attachment_document_ids`.
  - [x] Enable RLS on both tables, revoke direct table grants from `anon` and `authenticated`, and expose creation through security-definer RPCs with explicit `search_path`.
  - [x] Add database helpers such as `app.can_create_message_thread(target_community_id uuid, target_property_id uuid)` and `app.can_read_message_thread(target_thread_id uuid)` so membership and future history reads are enforced in the database as well as in TypeScript.
  - [x] Add a `public.create_message_thread(...)` RPC that resolves the community, validates active membership for the selected property, validates category/body/subject/attachments, inserts `message_threads`, inserts the first `messages` row in the same transaction, updates `last_message_at`, and returns only a safe JSON record/status.
  - [x] Make unrelated, inactive, deleted, or wrong-community properties return the same generic denied/invalid result. Do not reveal whether the property exists, who owns it, account numbers, balances, member names, payment data, or document metadata.
  - [x] Add best-effort audit logging for successful resident thread creation, for example `message.thread.create`, without duplicating the write from the TypeScript service. If the current audit table contract is insufficient, keep audit insertion best-effort with `exception when others then null`.
- [x] Add resident message attachment handling without widening document access. (AC: 1, 3)
  - [x] Support zero or more optional attachment files from the resident create form, with a conservative MVP limit such as 3 files and the existing `6 MiB` per-file document upload ceiling unless tests document a smaller value.
  - [x] Reuse the document upload MIME allowlist from Story 4.2 where practical: PDF, plain text, CSV, JPEG, PNG, WebP, DOC/DOCX, and XLS/XLSX. Do not allow HTML, SVG, JavaScript, executables, archives, or arbitrary binary uploads.
  - [x] Store resident message attachments in the existing private document storage path/bucket compatible with current signed download behavior: `private-documents`. Do not introduce a new `message-attachments` bucket unless the signed document download service and tests are updated to support it.
  - [x] Generate attachment storage paths server-side with random UUID path segments, for example `communities/{communityId}/messages/{uploadId}/{safeFilename}`. Do not include owner names, account numbers, property addresses, raw emails, subject text, category text, or user-provided folder segments in paths.
  - [x] Create attachment document metadata as property-specific, active, same-community records with category such as `message_attachment`, `related_property_id` set to the selected property, and `uploaded_by`/`created_by` set to the resident profile. Do this through a message-specific, membership-checked RPC or server-only helper; do not grant residents `admin.documents.manage`.
  - [x] Validate that `attachment_document_ids` attached to the first message belong to the same community and selected property, were created/uploaded by the current resident for this message flow, and are not archived/deleted.
  - [x] If an attachment upload succeeds but thread/message creation fails, remove the uploaded storage object and mark or remove the created attachment metadata in a best-effort cleanup path. Cleanup failures must not expose raw Supabase errors or private paths to the resident.
  - [x] Do not generate signed URLs, render attachment download links, list message history, or expose private bucket/path values in this story. Story 4.8/4.9 can consume the attachment IDs and existing signed download path later.
- [x] Add a server-only resident message service. (AC: 1, 2, 3)
  - [x] Add `server/services/messages/resident-message-threads.ts` with `import "server-only"`.
  - [x] Follow the safe union-result style used by `server/services/events/event-management.ts`, `server/services/announcements/announcement-management.ts`, and document/payment services.
  - [x] Use `getCurrentProfile()`, `getCurrentPropertyMemberships()` or equivalent membership helpers, and user-scoped `createClient()` for RPC calls. Use `createServiceRoleClient()` only inside server-only attachment upload/cleanup code after active membership validation passes.
  - [x] Validate subject, category, body, selected property ID, community slug, attachment file count, file sizes, MIME types, safe filenames, and optional attachment IDs before calling creation RPCs.
  - [x] Use explicit max lengths, suggested: subject 200 characters, body 5000 characters, safe filename 180 characters, and category from the fixed set.
  - [x] Return only safe unions such as `created`, `invalid-input`, `unauthenticated`, `profile-unavailable`, `no-active-membership`, `permission-denied`, and `messages-unavailable`.
  - [x] Returned records may include thread ID, subject, category, property ID selected by the resident, status, created timestamp, and attachment count. Do not return raw SQL errors, storage paths, bucket names, account numbers, owner names, payment details, role permission internals, or audit IDs.
- [x] Add a resident server action and replace the Contact Board placeholder. (AC: 1, 2, 3)
  - [x] Add `server/actions/resident-messages.ts` with `"use server"` actions for resident thread creation.
  - [x] Parse `FormData` safely, including `propertyId`, `subject`, `category`, `body`, and attachment file inputs. Ignore any submitted storage bucket/path, profile ID, community ID, role, status, sender role, visibility, or existing attachment IDs that are not produced by the trusted service path.
  - [x] Redirect back to `/portal/contact-board` with generic status params such as `message=created`, `message=invalid&messageField=category`, `message=denied`, `message=signin`, or `message=unavailable`.
  - [x] Update `app/(resident)/portal/(member)/contact-board/page.tsx` from placeholder to a member-gated server-rendered form.
  - [x] Populate the property selector from `getResidentPortalMemberships()` active memberships. If the resident has one active property, keep the value explicit in the form; if multiple, allow choosing among only linked active properties.
  - [x] Render accessible controls for property, category, subject, body, optional attachments, and submit. Use `aria-live="polite"` for result notices and generic field-level messages.
  - [x] Keep the current resident portal visual language: compact sections, simple forms, no nested cards, no implementation-status text, and no private authorization details in visible copy.
  - [x] Do not build board/admin inbox, replies, thread list/history, assignment, close/archive/reopen actions, internal notes, or notification emails in this story.
- [x] Preserve boundaries and prevent regressions. (AC: 1, 2, 3)
  - [x] Do not add a full admin Messages workspace. Story 4.8 owns board/admin message inbox and replies.
  - [x] Do not send Resend message notification emails yet. Story 4.9 owns message notifications and retention behavior.
  - [x] Do not expose `message_threads`, `messages`, `admin.messages.manage`, storage internals, service-role configuration, raw errors, owner names, account numbers, payment records, private document storage, or audit internals to public, resident client, guest payment, or shared UI files.
  - [x] Do not weaken existing public documents, resident documents, signed document download, announcement, event, dashboard, payment, auth, or role guardrails.
  - [x] Because the workspace has many pre-existing modified/untracked files from prior stories, read current files before implementation and do not revert unrelated changes.
- [x] Extend verification. (AC: 1, 2, 3)
  - [x] Add `tests/resident-message-thread.test.mjs`.
  - [x] Test the migration creates `message_threads`, `messages`, category/status/sender/visibility checks, indexes, RLS, revokes, membership helpers, safe creation RPC, safe JSON return shape, and best-effort audit behavior.
  - [x] Test the creation RPC validates active property membership and same-community scope before insert, creates the thread and first message together, sets sender role to `resident`, sets message visibility to `thread_participants`, updates `last_message_at`, and rejects unrelated properties generically.
  - [x] Test attachment handling validates file count, MIME type, size, safe filenames, private bucket routing, random paths, same-community/property metadata, cleanup after downstream failure, and no broad resident document-management grants.
  - [x] Test the service is server-only, validates inputs before RPC/storage calls, checks membership before service-role storage, returns safe unions, and does not expose raw errors, storage paths, bucket names, service-role keys, account numbers, owner data, payment data, audit IDs, Stripe, or Resend.
  - [x] Test the server action parses `FormData` safely, ignores untrusted hidden fields, uses generic redirect statuses, and never accepts submitted bucket/path/status/sender-role/profile IDs.
  - [x] Test the resident Contact Board page renders the form from active memberships, fixed categories, accessible labels, file input, generic status messages, and no private leakage.
  - [x] Test public, guest, resident client components, and shared UI do not import service-role clients, message internals, board/admin permissions, private bucket constants, raw SQL errors, or storage paths.
  - [x] Update `tests/resident-portal-navigation.test.mjs` only if route/nav assertions need to recognize the page is no longer a placeholder; preserve the existing `/portal/contact-board` nav contract.
  - [x] Run `node --test tests/resident-message-thread.test.mjs`, `npm test`, `npm run typecheck`, `npm run lint`, `npm run build`, and `git diff --check`.

### Review Findings

- [x] [Review][Patch] Message attachment documents can leak through the generic document list/download RPCs [supabase/migrations/202605110015_resident_message_thread_creation.sql:363]
- [x] [Review][Patch] Attachment metadata stores raw filenames instead of the validated safe filename [server/services/messages/resident-message-threads.ts:410]
- [x] [Review][Patch] Contact Board validation errors are not associated with their fields [app/(resident)/portal/(member)/contact-board/page.tsx:205]

Story 4.7 turns the resident Contact Board placeholder into the first real resident-to-board workflow. It must create the database foundation for message threads and first messages, but it should not pull in Story 4.8 inbox/reply behavior or Story 4.9 notifications/history. The highest-risk areas are property authorization, attachment cleanup, and accidental leakage of unrelated property/document/payment data.

### Current Files To Update

- `app/(resident)/portal/(member)/contact-board/page.tsx`
  - Current state: placeholder page with no data access or form.
  - Change: render a server-side resident message thread creation form using active memberships.
  - Preserve: resident portal route, semantic section heading, compact portal style, and no client-side authorization source of truth.
- `lib/resident/portal-navigation.ts` and `components/resident/resident-portal-nav.tsx`
  - Current state: already expose `Contact Board` at `/portal/contact-board`.
  - Change: none expected unless tests require active-page behavior updates.
  - Preserve: existing label/href contract and accessible resident nav.
- `server/services/auth/property-memberships.ts` and `server/services/auth/resident-portal.ts`
  - Current state: server-only active membership lookup with masked account number and active property filters.
  - Change: prefer reuse for UI membership options and service authorization checks. Only change if a tiny exported helper is needed.
  - Preserve: active membership/status/deleted filters, masked account numbers, and no private owner/payment leakage.
- `server/services/events/event-management.ts`, `server/actions/events.ts`, and `app/(admin)/admin/events/page.tsx`
  - Current state: closest completed content workflow pattern for safe unions, server actions, RPC calls, validation, generic redirects, and source-inspection tests.
  - Change: do not edit for this story. Use as service/action/page precedent.
- `server/services/documents/document-upload.ts`, `server/services/documents/document-download.ts`, and `server/actions/document-upload.ts`
  - Current state: document uploads use server-only service-role storage after admin authorization; signed downloads currently support `public-documents` and `private-documents`.
  - Change: do not call the admin upload action/service for resident messages because it requires `admin.documents.manage`. Reuse validation ideas and private bucket compatibility only.
  - Preserve: service-role isolation, cleanup discipline, MIME/file limits, and signed download assumptions.
- `supabase/migrations/202605110010_document_metadata_and_visibility_model.sql`, `202605110011_secure_document_upload_and_storage_routing.sql`, `202605110012_signed_private_document_download.sql`, and `202605110014_event_management_and_calendar_display.sql`
  - Current state: documents, storage buckets, signed private downloads, and events are already defined in historical migrations.
  - Change: do not edit historical migrations. Add a new ordered migration for messaging.
  - Preserve: direct table grants remain revoked and private document/download rules remain intact.

### New Files Likely Needed

- `supabase/migrations/202605110015_resident_message_thread_creation.sql`
- `server/services/messages/resident-message-threads.ts`
- `server/actions/resident-messages.ts`
- `tests/resident-message-thread.test.mjs`

Optional only if it keeps message code small and server-only:

- `server/services/messages/resident-message-attachments.ts`
- `server/services/messages/message-validation.ts`

Do not put message authorization, service-role storage, protected Supabase calls, or private table details in `lib/public`, `components/public`, `components/resident`, client components, or public/guest pages.

### Suggested Service Contract

Use a narrow contract similar to:

```ts
type ResidentMessageCategory =
  | "dues"
  | "documents"
  | "maintenance"
  | "architectural"
  | "complaint"
  | "general";

type ResidentMessageThreadInput = {
  communitySlug?: string | null;
  propertyId: string;
  subject: string;
  category: string;
  body: string;
  attachmentFiles?: File[] | null;
};

type ResidentMessageThreadRecord = {
  threadId: string;
  communityId: string;
  propertyId: string;
  subject: string;
  category: ResidentMessageCategory;
  status: "open" | "pending_board" | "pending_resident" | "closed" | "archived";
  firstMessageId: string;
  attachmentCount: number;
  createdAt: string;
};

type ResidentMessageThreadResult =
  | { kind: "created"; record: ResidentMessageThreadRecord }
  | { kind: "unauthenticated" }
  | { kind: "profile-unavailable"; message: string }
  | { kind: "no-active-membership"; message: string }
  | { kind: "permission-denied"; message: string }
  | { kind: "invalid-input"; message: string; fieldErrors: Record<string, string[]> }
  | { kind: "messages-unavailable"; message: string };
```

RPC arguments should stay explicit and boring:

```ts
await supabase.rpc("create_message_thread", {
  target_community_slug: communitySlug,
  target_property_id: propertyId,
  message_subject: subject,
  message_category: category,
  message_body: body,
  message_attachment_document_ids: attachmentDocumentIds,
});
```

### Database And Authorization Rules

- `community_id` is mandatory on both tables. Resolve it from the configured/default community slug; do not hardcode a raw UUID.
- A resident can create a thread only for a property where they have an active `property_memberships` row, the property is active, the property belongs to the same community, and `properties.deleted_at is null`.
- The server action and service must validate membership, but the SQL RPC must enforce it again. Page-level or form-level checks are not sufficient.
- Unrelated property, missing property, inactive property, deleted property, and wrong-community property failures should be indistinguishable to the resident.
- The first message should be inserted with `sender_id = current profile`, `sender_role = 'resident'`, `visibility = 'thread_participants'`, and no `edited_at`/`deleted_at`.
- Keep direct `anon` and `authenticated` table grants revoked. Use RPCs for create behavior and RLS helpers for defense in depth.
- Do not seed broad message management permissions in 4.7 unless needed for audit/read helpers. Story 4.8 should introduce and test board/admin message-management permissions.

### Attachment Rules

- Attachments are optional. A thread without files must still create correctly.
- Attachment upload is resident-authorized by active property membership, not by document management permission.
- Use `private-documents` for attachment storage to stay compatible with the current signed document download service. A future dedicated `message-attachments` bucket is possible only if download authorization and tests are updated in the same story.
- Attachment metadata should be `property_specific`, related to the selected property, active, same-community, and created/uploaded by the resident profile.
- Attachment UI should show only selected filenames before submit and generic success/error messages after submit. Do not render stored private paths, buckets, signed URLs, raw provider errors, or document IDs to the resident.
- If multiple attachments are allowed, process them deterministically and fail the whole submission if any file is invalid before upload starts.

### Resident UI Rules

- Keep `/portal/contact-board` as the first screen for this workflow. It is an operational portal page, not a landing page.
- Use a simple server-rendered form: property select, category select, subject input, body textarea, optional file input, and submit button.
- Fixed category labels should be resident-friendly while values remain exact: Dues, Documents, Maintenance, Architectural, Complaint, General.
- Do not show database permission names, RLS details, internal status names beyond resident-friendly confirmation text, attachment storage details, account numbers beyond already-masked membership labels, owner names, balances, or payment history.
- Form errors should be accessible and generic: invalid category, invalid subject/body, invalid attachment, denied, unavailable.
- The page may show the selected property address from the resident membership helper because the resident already has active access. Do not query arbitrary properties by submitted ID for display.

### Previous Story Intelligence

- Story 4.6 completed the event schema/service/action/page pattern and is now marked done. Start after migration `202605110014_event_management_and_calendar_display.sql`; do not create another `202605110014` file.
- Story 4.6 fixed `datetime-local` timezone parsing for admin filters. 4.7 does not need event date handling, but it should preserve the same lesson: parse and validate server-side, never trust browser-local assumptions or hidden fields.
- Story 4.5/4.6 established the current content-management RPC style: safe JSON result objects, explicit validation, direct table grants revoked, best-effort SQL audit writes, and source-inspection tests.
- Story 4.2 established service-role storage discipline: validate and authorize before storage, generate paths server-side, upload with `upsert: false`, pass `contentType`, and clean up on downstream failure.
- Story 4.3/4.4 established that authorized private records may be displayed/downloaded only through permission-checked services and must not leak storage metadata, private IDs, counts, or existence through public/resident failure states.
- Existing tests are fast `node:test` source-inspection guardrails. Add focused message tests instead of introducing a live Supabase integration harness.

### Testing Requirements

- Follow the existing `node:test` static/source-inspection style.
- Include ordered assertions that validation and membership checks happen before service-role storage and before `.rpc("create_message_thread", ...)`.
- Include ordered assertions that attachment cleanup happens after downstream thread/message creation failure.
- Include negative assertions for forbidden strings/imports in public, guest, client, and shared UI surfaces: `createServiceRoleClient`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_SECRET_KEY`, `storageBucket`, `storagePath`, `private-documents`, `message_threads`, `messages`, `admin.messages.manage`, `audit_logs`, `error.message`, `account_number`, `owner_display_name`, `public_payment_code`, `stripe_`, and `resend`.
- It is acceptable for server-only message service/tests/migration to contain private table/bucket names where required; keep the leakage assertions scoped like the document/event tests do.

### Current Local Technical Information

- Current installed stack from `npm ls`: Next.js `16.2.4`, React `19.2.5`, `@supabase/ssr` `0.10.3`, and `@supabase/supabase-js` `2.105.3`.
- `package.json` scripts: `npm test` runs `node --test tests/*.test.mjs`; `npm run lint` delegates to `npm run typecheck`; `npm run build` uses Next/Turbopack.
- No `project-context.md` file was found during story creation.
- Current resident Contact Board route exists at `app/(resident)/portal/(member)/contact-board/page.tsx` but is a placeholder.
- Current resident navigation already includes `Contact Board` at `/portal/contact-board`.
- No `message_threads` or `messages` implementation exists yet in app/server/migrations beyond planning docs and static test guardrails.
- Current signed document download service accepts private documents only from `private-documents`, so message attachments should use that bucket unless the download service is intentionally updated.
- Git history only shows initial scaffold commits; current story files, migrations, services, pages, and tests are more useful than commit history.
- The workspace already has many pre-existing modified/untracked files from earlier stories. Do not revert unrelated changes.

### Latest Technical Information

- Next.js forms can call Server Actions through the `action` attribute and pass `FormData`; the official Forms guide also says to verify authentication and authorization inside each Server Action even when the form is rendered on an authenticated page. Source: https://nextjs.org/docs/app/guides/forms
- Supabase JavaScript calls Postgres functions with `supabase.rpc(fn, args)`, matching the current service/RPC pattern. Source: https://supabase.com/docs/reference/javascript/rpc
- Supabase recommends enabling RLS on tables in exposed schemas and granting only the permissions each Postgres role needs; service keys bypass RLS and must never be exposed in the browser. Source: https://supabase.com/docs/guides/database/postgres/row-level-security
- Supabase Storage standard uploads support `.upload(path, file, { contentType })`; overwrites should be avoided, and new unique paths are recommended. Source: https://supabase.com/docs/guides/storage/uploads/standard-uploads

### Project Structure Notes

- Messaging database/RPC changes belong in a new ordered migration. Do not edit historical migrations.
- Resident message business logic belongs under `server/services/messages/...` with `import "server-only"`.
- Form parsing belongs under `server/actions/resident-messages.ts` with `"use server"`.
- Resident UI belongs in `app/(resident)/portal/(member)/contact-board/page.tsx`.
- Static verification belongs in `tests/resident-message-thread.test.mjs`, with narrow updates to existing resident portal navigation tests only if necessary.
- Full board/admin inbox, message replies, internal notes, notification emails, retention configuration, and message history views belong to Stories 4.8 and 4.9.

### Project Context Reference

- No `project-context.md` file was found.

### References

- [Epics: Story 4.7](/home/smount/Websites/SpringMeadowCommunity/_bmad-output/planning-artifacts/epics.md)
- [Requirements: Resident-to-Board Communication](/home/smount/Websites/SpringMeadowCommunity/docs/bmad/phase-1-requirements/requirements.md)
- [Architecture: Application Architecture and API Security](/home/smount/Websites/SpringMeadowCommunity/docs/bmad/phase-2-architecture/architecture.md)
- [Data Model: Message Threads and Messages](/home/smount/Websites/SpringMeadowCommunity/docs/bmad/phase-3-design/data-model.md)
- [API Design: Create Message Thread](/home/smount/Websites/SpringMeadowCommunity/docs/bmad/phase-3-design/api.md)
- [Tasks: TASK-MSG-001 and TASK-PAGE-011](/home/smount/Websites/SpringMeadowCommunity/docs/bmad/phase-4-tasks/tasks-v1.md)
- [Previous Story 4.6](/home/smount/Websites/SpringMeadowCommunity/_bmad-output/implementation-artifacts/4-6-event-management-and-calendar-display.md)
- [Resident Portal Membership Service](/home/smount/Websites/SpringMeadowCommunity/server/services/auth/property-memberships.ts)
- [Resident Contact Board Placeholder](/home/smount/Websites/SpringMeadowCommunity/app/(resident)/portal/(member)/contact-board/page.tsx)

## Change Log

- 2026-05-16: Implemented resident message thread creation with membership-scoped SQL RPCs, private attachment handling, server action, Contact Board form, and source-inspection guardrails.
- 2026-05-17: Resolved code review findings for message attachment document exposure, safe attachment titles, cleanup resilience, and field-associated form errors.

## Dev Agent Record

### Agent Model Used

GPT-5

### Debug Log References

- `node --test tests/resident-message-thread.test.mjs`
- `npm test`
- `npm run typecheck`
- `npm run lint`
- `npm run build`
- `git diff --check`

### Completion Notes List

- Added the message thread/message schema and `public.create_message_thread` RPC with active property membership checks, exact category/status/sender/visibility constraints, direct table grant revokes, safe JSON output, and best-effort audit logging.
- Added a server-only resident message service that validates inputs, checks active membership before trusted storage, uploads optional private attachments, creates property-specific document metadata with safe filenames, and cleans up storage/metadata if thread creation fails.
- Replaced the Contact Board placeholder with a server-rendered resident form sourced from active memberships and generic field-associated success/error notices.
- Code review patch hides message attachments from generic document listing/download paths until the message-specific attachment UX is implemented.
- Added `tests/resident-message-thread.test.mjs` and verified all required commands pass.

### File List

- `_bmad-output/implementation-artifacts/4-7-resident-message-thread-creation.md`
- `_bmad-output/implementation-artifacts/sprint-status.yaml`
- `app/(resident)/portal/(member)/contact-board/page.tsx`
- `server/actions/resident-messages.ts`
- `server/services/documents/document-download.ts`
- `server/services/documents/document-metadata.ts`
- `server/services/messages/resident-message-threads.ts`
- `supabase/migrations/202605110015_resident_message_thread_creation.sql`
- `tests/resident-message-thread.test.mjs`
