# Story 4.8: Board/Admin Message Inbox and Replies

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a board/admin user,
I want to review, assign, reply to, and close resident message threads,
so that resident communication can be handled through a preserved workflow.

## Acceptance Criteria

1. Given a board/admin user has message management permission, when they open the message inbox, then they can filter threads by status, category, property, assigned user, and last message time, and access is scoped to their community permissions.
2. Given a board/admin user replies to a thread, when the reply is submitted, then the message is added to the thread with sender role `board_member` or `admin`, and the thread status and `last_message_at` are updated appropriately.
3. Given a board/admin user assigns, closes, archives, or reopens a thread, when the status action is submitted, then the status change is saved, and the action is prepared for audit or history tracking.

## Tasks / Subtasks

- [x] Add the board/admin message permission and additive database RPCs. (AC: 1, 2, 3)
  - [x] Add the next ordered migration after `supabase/migrations/202605110015_resident_message_thread_creation.sql`, likely `supabase/migrations/202605110016_board_admin_message_inbox_and_replies.sql`.
  - [x] Add `admin.messages.manage` to the `admin` and `board_member` roles with the same idempotent `update public.roles set permissions = case ...` pattern used by announcements and events.
  - [x] Do not edit or reorder the existing 4.7 migration unless a prior migration is actually broken. This story should be implemented as an additive migration that replaces/extends functions and adds new RPCs.
  - [x] Preserve the existing `message_threads` and `messages` table contract from Story 4.7: categories `dues`, `documents`, `maintenance`, `architectural`, `complaint`, `general`; statuses `open`, `pending_board`, `pending_resident`, `closed`, `archived`; sender roles `resident`, `board_member`, `admin`; visibility values `thread_participants`, `board_admin_only`.
  - [x] Extend or replace `app.can_read_message_thread(target_thread_id uuid)` so existing resident reads still require active property membership and do not leak unrelated or archived threads, while board/admin users with `admin.messages.manage` can read community-scoped threads for inbox work.
  - [x] Add a management helper such as `app.can_manage_message_thread(target_community_id uuid)` or use `app.has_permission(target_community_id, 'admin.messages.manage')` directly inside RPCs. Do not grant direct table access to `message_threads` or `messages`.
  - [x] Add `public.list_message_threads(...)` returning safe JSON for the inbox. It must require `admin.messages.manage`, support filters for status, category, property, assigned user, query/subject, `last_message_at` from/to, `page_limit`, and `page_offset`, and bound page size/offset to the local patterns.
  - [x] Add a safe thread-detail/message listing RPC, for example `public.get_message_thread_detail(target_thread_id uuid)`, so the admin page can render existing messages without direct table grants.
  - [x] Add `public.reply_to_message_thread(...)` that requires `admin.messages.manage`, validates body length and optional attachment IDs, inserts a message with `sender_role` derived from the actor's role/permission context (`admin` or `board_member`), defaults reply visibility to `thread_participants`, updates `last_message_at`, and moves the thread to an appropriate status such as `pending_resident`.
  - [x] Add `public.assign_message_thread(...)` that sets or clears `assigned_to` only to a profile in the same community with an active board/admin-capable role, and rejects unrelated profile IDs generically.
  - [x] Add `public.set_message_thread_status(...)` or narrowly named lifecycle RPCs for close, archive, and reopen. Closing should set `closed_at`; reopening should clear `closed_at` and return to `open` or `pending_board`; archiving should preserve the thread but hide it from resident reads.
  - [x] Add best-effort `audit_logs` inserts for reply, assignment, close, archive, and reopen actions using action names such as `message.thread.reply`, `message.thread.assign`, `message.thread.close`, `message.thread.archive`, and `message.thread.reopen`. Use `exception when others then null` so audit failures do not break the workflow.
  - [x] Revoke all helper/RPC function access from `public`, `anon`, and `authenticated` first, then grant execute only on the intended public RPCs to `authenticated`, matching existing migration patterns.

- [x] Add a server-only board/admin message service. (AC: 1, 2, 3)
  - [x] Add `server/services/messages/admin-message-inbox.ts` with `import "server-only"`.
  - [x] Use the existing `createClient`, `getCurrentProfile`, and safe union result patterns from `server/services/events/event-management.ts` and `server/services/announcements/announcement-management.ts`.
  - [x] Validate all filters before calling RPCs: UUIDs, category/status allowlists, query length 200 or fewer, message body 5000 or fewer, page limit max 100, page offset max 10000, and date/time filters as ISO strings derived server-side.
  - [x] Return safe unions such as `records`, `thread`, `replied`, `assigned`, `status-updated`, `invalid-input`, `unauthenticated`, `profile-unavailable`, `permission-denied`, and `messages-unavailable`.
  - [x] Return safe record shapes only: thread/message IDs, community ID, property ID, safe property display fields already allowed for board/admin operations, subject, category, status, assigned profile summary, sender display summary, attachment count, created timestamps, updated timestamps, `lastMessageAt`, and `closedAt`.
  - [x] Do not return raw SQL errors, storage paths, bucket names, account numbers, payment details, Stripe fields, owner names beyond existing board/admin-safe property summaries, service-role configuration, role permission internals, or audit IDs.
  - [x] Do not use `createServiceRoleClient` in this story's message inbox service. Board/admin message work should go through authenticated RPCs guarded by `admin.messages.manage`.

- [x] Add safe admin message server actions. (AC: 2, 3)
  - [x] Add `server/actions/admin-messages.ts` with `"use server"`.
  - [x] Parse only trusted form keys needed by the action: `communitySlug`, `threadId`, `body`, optional `attachmentDocumentIds`, `assignedTo`, `status`, and current filter params needed for redirects.
  - [x] Ignore untrusted form fields for `senderRole`, `senderId`, `visibility`, `communityId`, `createdAt`, storage metadata, permission keys, and audit values.
  - [x] Redirect back to `/admin/messages` with generic query params such as `message=replied`, `message=assigned`, `message=closed`, `message=archived`, `message=reopened`, `message=invalid&messageField=body`, `message=denied`, `message=signin`, or `message=unavailable`.
  - [x] Preserve active filters across redirects where practical so the inbox does not feel like it loses context after a mutation.

- [x] Add the board/admin message inbox page. (AC: 1, 2, 3)
  - [x] Add `app/(admin)/admin/messages/page.tsx`.
  - [x] Follow the existing admin operational page style from `app/(admin)/admin/documents/page.tsx`, `app/(admin)/admin/announcements/page.tsx`, `app/(admin)/admin/events/page.tsx`, and `app/(admin)/admin/payments/page.tsx`: server-rendered, dense tables/forms, border-y sections, `rounded-sm` controls, plain status notices, and no marketing/landing-page layout.
  - [x] Render filters for status, category, property ID, assigned user ID, query/subject, last message from/to, and page offset.
  - [x] Render a table or split workflow that lets board/admin users scan subject, category, property, status, assigned user, last message time, sender summary, and attachment count without exposing storage or payment/private internals.
  - [x] Render a thread detail/reply area for a selected thread ID using server data only. Include the existing message bodies and metadata needed for reply context.
  - [x] Render reply, assignment, close, archive, and reopen controls with accessible labels, field errors, and `aria-live="polite"` notices.
  - [x] Use America/New_York formatting for displayed timestamps and parse any `datetime-local` filter inputs with the robust New York conversion pattern from `server/actions/events.ts` or keep filters as safe ISO strings if the UI uses plain query inputs.
  - [x] Do not add a full admin workspace shell/navigation here unless the project already has one by implementation time. Story 5.1 owns the board/admin workspace shell and navigation; this story owns the route/page and workflow.

- [x] Keep resident and public surfaces unchanged. (AC: 1, 2, 3)
  - [x] Do not change resident thread creation behavior from Story 4.7 except where the new database read helper must preserve resident safety.
  - [x] Do not build a resident message history UI, resident reply UI, notification emails, retention settings, internal notes, or message visibility history in this story. Story 4.9 owns message visibility, history, and notifications.
  - [x] Do not expose `message_threads`, `messages`, `admin.messages.manage`, storage internals, service-role configuration, raw SQL errors, owner names, unmasked account numbers, payment records, audit internals, private document paths, or attachment document IDs to public, resident client, guest payment, or shared UI surfaces.
  - [x] Do not make message attachments available through the generic document list/download path. Story 4.7 deliberately hid `message_attachment` documents from generic document metadata and signed downloads.

- [x] Add focused static/source tests. (AC: 1, 2, 3)
  - [x] Add `tests/admin-message-inbox.test.mjs`.
  - [x] Test the migration adds `admin.messages.manage` to `admin` and `board_member`, keeps direct table grants revoked, grants only authenticated RPC execution, extends board/admin read authorization, preserves resident thread read restrictions, and adds audit-ready RPCs.
  - [x] Test `list_message_threads`, thread-detail/message list, reply, assign, close, archive, and reopen RPCs validate status/category/body/UUID filters and use `app.has_permission(..., 'admin.messages.manage')`.
  - [x] Test the reply RPC inserts into `public.messages`, uses sender roles `board_member` or `admin`, defaults reply visibility to `thread_participants`, updates `message_threads.last_message_at`, and sets a reply-appropriate status.
  - [x] Test the admin message service is server-only, uses safe unions, calls the new RPCs, validates before RPC calls, and does not import `createServiceRoleClient` or expose raw errors/private fields.
  - [x] Test `server/actions/admin-messages.ts` parses `FormData` safely, ignores untrusted sender/status/storage/audit fields, redirects to `/admin/messages`, and carries field-specific invalid params.
  - [x] Test `app/(admin)/admin/messages/page.tsx` renders filters, inbox records, thread detail/reply controls, assignment/status controls, and accessible notices.
  - [x] Add negative assertions that public, guest, resident client, shared UI, and generic document pages do not contain forbidden message internals.
  - [x] Run `node --test tests/admin-message-inbox.test.mjs`, `npm test`, `npm run typecheck`, `npm run lint`, `npm run build`, and `git diff --check`.

### Review Findings

- [x] [Review][Patch] Replying to a closed thread leaves stale `closed_at` while reopening the status [supabase/migrations/202605110016_board_admin_message_inbox_and_replies.sql:454]
- [x] [Review][Patch] Assignment control reuses the filter `assignedTo` id when thread detail is visible [app/(admin)/admin/messages/page.tsx:631]

## Dev Notes

Story 4.8 builds directly on Story 4.7. The database already has `public.message_threads`, `public.messages`, `public.create_message_thread(...)`, resident membership helpers, private attachment metadata creation, RLS enabled, direct table grants revoked, and generic document listing/download protections for `message_attachment`. This story must add the board/admin handling layer without widening resident, public, guest, or generic document access.

### Current Files To Update Or Read Fully

- `supabase/migrations/202605110015_resident_message_thread_creation.sql`
  - Current state: creates message tables, category/status/sender/visibility constraints, indexes, RLS, resident create/read helpers, resident creation RPC, direct table grant revokes, and generic document protections for message attachments.
  - Change: do not edit in place unless unavoidable. Add a new migration that replaces helper functions or adds new RPCs while preserving 4.7 behavior.
  - Preserve: resident creation must still validate active property membership before insert, first resident messages must stay `sender_role = 'resident'`, `visibility = 'thread_participants'`, and `message_attachment` documents must remain hidden from generic document list/download.

- `server/services/messages/resident-message-threads.ts`
  - Current state: server-only resident creation service validates subject/body/category/property/files, checks current profile and active property membership, uses service role only for private attachment upload/metadata, calls `create_message_thread`, cleans up attachments on failure, and returns safe unions.
  - Change: likely none. If shared constants are extracted, keep the resident service behavior and leakage tests intact.
  - Preserve: no board/admin permission keys, raw errors, signed URLs, storage paths, owner names, account numbers, Stripe, or Resend details in resident/public-facing code.

- `server/actions/resident-messages.ts`
  - Current state: server action parses resident form fields and redirects to `/portal/contact-board` with generic status params.
  - Change: likely none.
  - Preserve: residents cannot submit status, sender role, visibility, storage metadata, or admin permission fields.

- `app/(resident)/portal/(member)/contact-board/page.tsx`
  - Current state: resident server-rendered message creation form for active memberships with property/category/subject/body/attachments and field-specific status messages.
  - Change: likely none.
  - Preserve: no inbox, thread history, reply UI, storage details, message table names, or admin permissions on resident/public surfaces.

- `server/services/events/event-management.ts` and `server/services/announcements/announcement-management.ts`
  - Current state: good local examples for server-only, RPC-backed admin content services with allowlisted filters, bounded pagination, safe result unions, and no service-role usage.
  - Change: do not modify unless shared helpers are intentionally extracted.
  - Reuse pattern: validate first, require active profile when mutating, call authenticated RPCs, map `permission_denied` to generic permission-denied, and map unexpected errors to a generic unavailable result.

- `server/actions/events.ts` and `server/actions/announcements.ts`
  - Current state: good local examples for admin server actions that parse `FormData`, normalize dates, redirect with generic status and field params, and avoid raw errors.
  - Change: do not modify.
  - Reuse pattern: if using `datetime-local` filters/actions, copy the New York date conversion pattern rather than using naive `toISOString().slice(0, 16)`.

- `app/(admin)/admin/documents/page.tsx`, `app/(admin)/admin/announcements/page.tsx`, `app/(admin)/admin/events/page.tsx`, and `app/(admin)/admin/payments/page.tsx`
  - Current state: existing admin pages are standalone server-rendered operational pages with dense filters, tables/forms, status notices, and no shared admin shell yet.
  - Change: add `app/(admin)/admin/messages/page.tsx` in the same visual/interaction style.
  - Preserve: Story 5.1 owns the full board/admin workspace shell/navigation; do not use this story to refactor admin layout.

### Suggested New Files

- `supabase/migrations/202605110016_board_admin_message_inbox_and_replies.sql`
- `server/services/messages/admin-message-inbox.ts`
- `server/actions/admin-messages.ts`
- `app/(admin)/admin/messages/page.tsx`
- `tests/admin-message-inbox.test.mjs`

Optional only if it reduces duplication without introducing a broad abstraction:

- `server/services/messages/message-shared.ts`

Do not place board/admin message authorization, protected Supabase calls, message internals, private table names, or admin permission checks in `lib/public`, `components/public`, `components/resident`, public/guest pages, or client components.

### Database And Authorization Rules

- Use `admin.messages.manage` as the single permission for Story 4.8 board/admin message management.
- Seed `admin.messages.manage` for the `admin` and `board_member` roles, matching the Story 4.5/4.6 pattern for `admin.announcements.manage` and `admin.events.manage`.
- Keep `message_threads` and `messages` direct grants revoked from `anon` and `authenticated`; all access should go through security-definer RPCs with explicit permission/membership checks.
- Board/admin list/detail/reply/assignment/status RPCs must require a resolved active actor profile and `app.has_permission(target_community_id, 'admin.messages.manage')`.
- Thread filters must stay community scoped. A board/admin user from another community must receive a generic permission denied or empty result, not metadata about the thread/property.
- Resident read behavior from 4.7 must remain active-membership scoped. If `app.can_read_message_thread` is replaced, keep the resident branch and add the board/admin branch deliberately.
- Archived threads should be visible only to message managers, not resident reads, unless a later story explicitly changes resident history.
- Replies should insert a new `public.messages` row and update the parent `public.message_threads.last_message_at` in the same RPC. Keep this transactional at the database function boundary rather than chaining independent client writes.
- Use `thread_participants` for board/admin replies in this story. Do not add internal notes or `board_admin_only` note UI unless the story is intentionally expanded and tests cover resident invisibility.
- Assignment must validate `assigned_to` in the same community. Prefer active profiles with active `admin` or `board_member` role capability; reject unrelated IDs generically.
- Status changes must validate the target status allowlist. Close sets `closed_at`; archive preserves data and removes resident visibility; reopen clears `closed_at` and restores an active status.
- Add best-effort audit records for successful mutations. Include `before_data`/`after_data` where available, but never return audit IDs or audit internals to the UI.

### Suggested Service Contract

```ts
export type AdminMessageCategory =
  | "dues"
  | "documents"
  | "maintenance"
  | "architectural"
  | "complaint"
  | "general";

export type AdminMessageThreadStatus =
  | "open"
  | "pending_board"
  | "pending_resident"
  | "closed"
  | "archived";

export type AdminMessageThreadSummary = {
  threadId: string;
  communityId: string;
  propertyId: string;
  propertyLabel: string;
  subject: string;
  category: AdminMessageCategory;
  status: AdminMessageThreadStatus;
  assignedTo: { profileId: string; displayName: string } | null;
  createdBy: { profileId: string; displayName: string } | null;
  lastMessageAt: string;
  closedAt: string | null;
  messageCount: number;
  attachmentCount: number;
};

export type AdminMessage = {
  messageId: string;
  threadId: string;
  senderId: string;
  senderRole: "resident" | "board_member" | "admin";
  senderDisplayName: string;
  body: string;
  attachmentCount: number;
  visibility: "thread_participants" | "board_admin_only";
  createdAt: string;
};

export type AdminMessageResult =
  | { kind: "records"; records: AdminMessageThreadSummary[] }
  | { kind: "thread"; thread: AdminMessageThreadSummary; messages: AdminMessage[] }
  | { kind: "replied" | "assigned" | "status-updated"; thread: AdminMessageThreadSummary }
  | { kind: "unauthenticated" }
  | { kind: "profile-unavailable"; message: string }
  | { kind: "permission-denied"; message: string }
  | { kind: "invalid-input"; message: string; fieldErrors: Record<string, string[]> }
  | { kind: "messages-unavailable"; message: string };
```

The exact names may vary, but keep the same shape: safe unions, typed allowlists, and no raw Supabase result exposure.

### Admin UI Rules

- This is an operational admin page. Use compact headings, dense filters, tables, and inline forms rather than a landing page or decorative composition.
- Keep controls stable and accessible: labels for all fields, `aria-live="polite"` notices, field-specific error IDs, keyboard-usable buttons/forms, and readable empty states.
- Use select controls for status/category, text/search inputs for subject/property/assigned filters, and submit buttons for commands.
- Keep text inside buttons concise so it fits on narrow widths. Prefer existing admin styling over new components.
- Display timestamps in `America/New_York`, as the existing admin events/announcements/payment pages do.
- If showing attachment counts, show counts only. Do not add attachment download links in this story unless a message-specific authorization path is also designed and tested.

### Previous Story Intelligence

- Story 4.7 intentionally stopped before board/admin inbox, replies, history, internal notes, and notifications. 4.8 must consume its schema and attachment IDs without widening access.
- Story 4.7 review fixed message attachment leaks through generic document list/download RPCs. Keep `message_attachment` excluded from generic document metadata and signed download paths.
- Story 4.7 review fixed safe attachment titles and field-associated resident form errors. Continue using sanitized/safe display values and field-specific query params for admin form errors.
- Story 4.7 established fast `node:test` source-inspection guardrails for message work. Add a focused admin message test instead of introducing a live Supabase harness.
- Earlier admin event work fixed naive `datetime-local` timezone conversion. If 4.8 uses date/time inputs, reuse the robust America/New_York conversion pattern from event actions/pages.

### Git Intelligence Summary

- The repository currently shows only initial scaffold commits in `git log`, so recent implementation patterns are better inferred from the existing working tree and completed story files.
- Completed stories 4.5, 4.6, and 4.7 consistently use additive Supabase migrations, security-definer RPCs, server-only TypeScript services, server actions with redirect status params, server-rendered App Router pages, and static `node:test` guardrails.
- Preserve those local patterns rather than introducing a new state-management library, API route layer, client-heavy admin UI, or database integration test harness.

### Current Local Technical Information

- Local dependencies in `package.json`: Next `^16.0.0`, React `^19.0.0`, `@supabase/ssr` `^0.10.3`, `@supabase/supabase-js` `^2.105.3`, Resend `^6.12.3`, Stripe `^22.1.1`, Tailwind `^4.0.0`, TypeScript `^5.0.0`.
- Official Next docs state `redirect` can be used after mutations in Server Functions/Server Actions and that code after `redirect` will not execute. Keep redirects outside broad `try/catch` blocks and do any needed cache work before redirect.
- Official React 19 docs state Server Functions can be passed to form actions and forms can automatically submit to the server. The current codebase already uses this pattern through `"use server"` action modules.
- Official Supabase JavaScript docs call Postgres functions with `supabase.rpc(functionName, args)`. Continue using RPCs for transactional message mutations instead of direct multi-step client writes.
- Official Supabase RLS docs recommend security-definer helpers for policy checks but warn not to put security-definer functions in exposed schemas. This project already uses `app.*` helpers plus exposed `public.*` RPC wrappers; keep helper functions in `app` and expose only the intended authenticated RPCs.

### Testing Requirements

- Follow the existing tests' source-inspection style: `node:test`, `assert`, `readFileSync`, `existsSync`, `listFiles`, and `assertOrdered` helpers.
- Include ordered assertions that admin message service validation happens before `.rpc(...)` calls.
- Include ordered assertions that reply RPC permission checks happen before insert into `public.messages`.
- Include negative assertions for forbidden strings/imports in public, guest, resident client, and shared UI surfaces: `createServiceRoleClient`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_SECRET_KEY`, `storageBucket`, `storagePath`, `private-documents`, `message_threads`, `messages`, `admin.messages.manage`, `audit_logs`, `error.message`, `account_number`, `owner_display_name`, `public_payment_code`, `stripe_`, and `resend`.
- It is acceptable for server-only admin message service/tests/migration to contain private table names and `admin.messages.manage` where required. Keep leakage assertions scoped like the document/event/message tests do.

### Project Structure Notes

- Board/admin message business logic belongs under `server/services/messages/...` with `import "server-only"`.
- Form parsing belongs under `server/actions/admin-messages.ts` with `"use server"`.
- Admin UI belongs in `app/(admin)/admin/messages/page.tsx`.
- Static verification belongs in `tests/admin-message-inbox.test.mjs`.
- Full admin workspace shell/navigation belongs to Story 5.1, not this story.

### Project Context Reference

- No `project-context.md` file was found under the project root during story creation. Use the planning artifacts, architecture/design docs, completed story files, and current code as authoritative context.

### References

- [Epic 4 Story 4.8 Source](/home/smount/Websites/SpringMeadowCommunity/_bmad-output/planning-artifacts/epics.md)
- [Architecture: Messaging and Board/Admin Access](/home/smount/Websites/SpringMeadowCommunity/docs/bmad/phase-2-architecture/architecture.md)
- [API Design: Messages API](/home/smount/Websites/SpringMeadowCommunity/docs/bmad/phase-3-design/api.md)
- [Data Model: Message Threads and Messages](/home/smount/Websites/SpringMeadowCommunity/docs/bmad/phase-3-design/data-model.md)
- [Previous Story 4.7](/home/smount/Websites/SpringMeadowCommunity/_bmad-output/implementation-artifacts/4-7-resident-message-thread-creation.md)
- [Resident Message Service](/home/smount/Websites/SpringMeadowCommunity/server/services/messages/resident-message-threads.ts)
- [Resident Message Migration](/home/smount/Websites/SpringMeadowCommunity/supabase/migrations/202605110015_resident_message_thread_creation.sql)
- [Event Service Pattern](/home/smount/Websites/SpringMeadowCommunity/server/services/events/event-management.ts)
- [Announcement Service Pattern](/home/smount/Websites/SpringMeadowCommunity/server/services/announcements/announcement-management.ts)
- [Event Action Date Pattern](/home/smount/Websites/SpringMeadowCommunity/server/actions/events.ts)
- [Admin Events Page Pattern](/home/smount/Websites/SpringMeadowCommunity/app/(admin)/admin/events/page.tsx)
- [Admin Documents Page Pattern](/home/smount/Websites/SpringMeadowCommunity/app/(admin)/admin/documents/page.tsx)
- [Admin Message Test Precedent](/home/smount/Websites/SpringMeadowCommunity/tests/resident-message-thread.test.mjs)
- [Next.js Redirecting Docs](https://nextjs.org/docs/app/guides/redirecting)
- [Next.js Updating Data Docs](https://nextjs.org/docs/app/getting-started/updating-data)
- [React Server Functions Docs](https://react.dev/reference/rsc/server-functions)
- [Supabase JavaScript RPC Docs](https://supabase.com/docs/reference/javascript/rpc)
- [Supabase RLS Docs](https://supabase.com/docs/guides/database/postgres/row-level-security)

## Change Log

- 2026-05-17: Implemented board/admin message inbox and replies with authenticated SQL RPCs, server-only service/actions, admin message page, and source-inspection guardrails.
- 2026-05-17: Resolved code review findings for closed-thread reply timestamps and duplicate assignment input IDs; moved story to done.

## Dev Agent Record

### Agent Model Used

GPT-5 Codex

### Debug Log References

- `node --test tests/admin-message-inbox.test.mjs`
- `npm test`
- `npm run typecheck`
- `npm run lint`
- `npm run build`
- `git diff --check`

### Completion Notes List

- Added the additive 4.8 migration with `admin.messages.manage`, manager-scoped inbox/detail/reply/assignment/status RPCs, preserved resident read safety, direct table grant revokes, and best-effort audit logging.
- Added the server-only admin message inbox service and server actions with allowlisted validation, safe unions, generic redirects, and no service-role client usage.
- Added the `/admin/messages` server-rendered operational inbox with filters, thread detail, replies, assignment, close/archive/reopen controls, and accessible notices.
- Added `tests/admin-message-inbox.test.mjs` covering migration authorization, RPC behavior, service/action safety, page affordances, and public/resident leakage guardrails.
- Code review patch clears `closed_at` when a manager reply reopens a closed thread and gives the assignment action a unique input id.

### File List

- `_bmad-output/implementation-artifacts/4-8-board-admin-message-inbox-and-replies.md`
- `_bmad-output/implementation-artifacts/sprint-status.yaml`
- `app/(admin)/admin/messages/page.tsx`
- `server/actions/admin-messages.ts`
- `server/services/messages/admin-message-inbox.ts`
- `supabase/migrations/202605110016_board_admin_message_inbox_and_replies.sql`
- `tests/admin-message-inbox.test.mjs`
