# Story 4.9: Message Visibility, History, and Notifications

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a resident and board/admin participant,
I want message history and notifications to respect visibility rules,
so that communication is preserved without leaking private records.

## Acceptance Criteria

1. Given a resident opens their message history, when threads are queried, then they see only threads tied to their active linked properties, and board/admin-only internal notes are not shown to the resident.
2. Given a message thread receives a new resident or board/admin reply, when notification settings allow email notification, then the system sends or queues a message notification through the configured email service, and the email avoids exposing unnecessary sensitive data.
3. Given retention settings apply to messages, when messages are listed or archived, then history is preserved according to retention configuration, and normal user workflows do not hard-delete preserved communication records.

## Tasks / Subtasks

- [x] Add additive database support for resident history, internal notes, notification metadata, and retention settings. (AC: 1, 2, 3)
  - [x] Add the next ordered migration after `supabase/migrations/202605110016_board_admin_message_inbox_and_replies.sql`, likely `supabase/migrations/202605110017_message_visibility_history_and_notifications.sql`.
  - [x] Do not edit or reorder the 4.7 or 4.8 migrations unless a prior migration is actually broken. This story should be additive and may replace/extend helper functions and RPCs.
  - [x] Preserve the existing `message_threads` and `messages` table contract: categories `dues`, `documents`, `maintenance`, `architectural`, `complaint`, `general`; statuses `open`, `pending_board`, `pending_resident`, `closed`, `archived`; sender roles `resident`, `board_member`, `admin`; visibility values `thread_participants`, `board_admin_only`.
  - [x] Add message settings to `public.community_settings` with `alter table ... add column if not exists`, such as `message_notifications_enabled boolean not null default true` and `message_retention_days integer not null default 2555 check (message_retention_days >= 0)`. Do not build settings-management UI; Story 5.6 owns that.
  - [x] Extend `public.email_logs` with message relation columns if absent: `related_message_thread_id uuid references public.message_threads(id)` and `related_message_id uuid references public.messages(id)`, plus useful partial indexes. Keep `email_logs` RLS enabled and direct grants revoked.
  - [x] Preserve or replace `app.can_read_message_thread(target_thread_id uuid)` so residents still require active property membership and cannot read `archived` threads, while board/admin managers still can read community-scoped threads for admin work.
  - [x] Add safe JSON helpers for resident thread summaries and resident messages. Resident message JSON must return only participant-visible fields: ids, property id, subject/category/status, safe property label, sender display summary, sender role, body, attachment count, `created_at`, `last_message_at`, and `closed_at`. It must not return attachment document IDs, storage paths, bucket names, audit IDs, payment details, account numbers, owner names, role permission internals, or notification log data.
  - [x] Add `public.list_resident_message_threads(...)` for resident history. It must require an active profile and active property membership, support filters for property, status, category, query/subject, `page_limit`, and `page_offset`, bound pagination to local patterns, exclude `archived` threads from resident reads, and scope all results to the resident's active linked properties.
  - [x] Add `public.get_resident_message_thread_detail(target_thread_id uuid)` so residents can view conversation history without direct table grants. It must require `app.can_read_message_thread(target_thread_id)` and return only messages where `visibility = 'thread_participants'` and `deleted_at is null`.
  - [x] Add `public.reply_to_resident_message_thread(target_thread_id uuid, message_body text, message_attachment_document_ids uuid[])` for resident replies. It must require active membership for the thread property, reject archived threads, validate body length and attachment IDs with the same ownership/property checks as Story 4.7, insert `sender_role = 'resident'`, force `visibility = 'thread_participants'`, update `last_message_at`, set status to `pending_board`, clear `closed_at`, and return enough safe data for notification side effects, including the new message id.
  - [x] Add `public.add_message_internal_note(target_thread_id uuid, note_body text)` or an equivalent admin-only RPC for board/admin notes. It must require `admin.messages.manage`, insert a `public.messages` row with `visibility = 'board_admin_only'` and `sender_role` derived from the actor role, reject residents, and avoid resident notifications. Prefer not to update `last_message_at` so resident history is not bumped by invisible notes.
  - [x] Add best-effort `audit_logs` inserts for resident reply and internal note actions, using action names such as `message.thread.resident_reply` and `message.thread.internal_note`. Use `exception when others then null`.
  - [x] Revoke all helper/RPC function access from `public`, `anon`, and `authenticated` first, then grant execute only on intended public RPCs to `authenticated`. Do not grant direct table access to `message_threads`, `messages`, `email_logs`, `audit_logs`, or `community_settings`.
  - [x] Do not add any app workflow that hard-deletes `message_threads`, `messages`, `email_logs`, or message attachment documents. Retention in this story is a preservation/configuration guardrail, not a purge job.

- [x] Add a server-only message notification service. (AC: 2, 3)
  - [x] Add `server/services/messages/message-notifications.ts` with `import "server-only"`.
  - [x] Reuse `server/services/email/send-email.ts`, `server/services/email/resend.ts`, and the payment receipt email service's idempotent `email_logs` pattern. Do not create a second Resend wrapper or expose Resend directly to actions/pages.
  - [x] Use `createServiceRoleClient` only inside this server-only notification service, because it needs to resolve recipients and write `email_logs`. Do not use service-role clients in resident history or admin inbox services unless specifically justified.
  - [x] Support notification types for resident-created threads, resident replies, and board/admin replies. Internal notes, assignment changes, status changes, and archived actions must not notify residents by default.
  - [x] Resolve recipients safely:
    - For resident-created threads and resident replies, notify the active assigned board/admin profile if one exists and can manage messages; otherwise notify active `admin`/`board_member` profiles in the same community with `admin.messages.manage`. Cap broad recipient fanout to a small deterministic limit such as 25.
    - For board/admin replies, notify the thread creator only if their profile is active, has an active membership for the thread property, and is not the sender. Do not notify unrelated property members unless explicitly implemented and tested.
  - [x] Respect notification settings. Do not send if `community_settings.message_notifications_enabled = false`. Treat missing profile notification preferences as opt-in, but suppress a recipient when `profiles.notification_preferences` clearly disables message email notifications, for example JSON path `{messages,email}` is boolean `false`.
  - [x] Use stable idempotency keys such as `message-notification/${messageId}/${recipientProfileId}`. Existing `sent`, `delivered`, `bounced`, `suppressed`, or still-fresh `queued` logs should no-op like the receipt service.
  - [x] Insert or update `email_logs` with `type = 'message_notification'`, `related_property_id`, `related_message_thread_id`, `related_message_id`, recipient profile/email, safe subject, provider, status, attempt count, sanitized error, and provider message id.
  - [x] If a recipient is missing a usable email or opted out, write or update a `suppressed` log where practical. Do not leak missing/invalid recipient details to UI callers.
  - [x] Email subject/body must avoid unnecessary sensitive data: no message body, attachment IDs, storage bucket/path, account numbers, payment details, owner names, audit data, role names/permissions, raw errors, or private document metadata. Use generic copy such as "Spring Meadow HOA message update" and a short instruction to sign in to view the message.
  - [x] Notification failure must never roll back or change the result of message creation/reply/internal note RPCs. Return safe notification outcomes only for logging/debugging; UI-facing message actions should still use generic success/error states.

- [x] Wire notifications into message creation and reply workflows. (AC: 2, 3)
  - [x] Update `server/services/messages/resident-message-threads.ts` so `createResidentMessageThread(...)` calls the notification service only after `create_message_thread` succeeds and after durable attachment metadata/thread creation is complete. Use the returned first message id from Story 4.7's RPC result.
  - [x] Add or update resident reply service code so resident replies trigger board/admin notifications only after `reply_to_resident_message_thread` succeeds.
  - [x] Update `server/services/messages/admin-message-inbox.ts` so successful `replyToMessageThread(...)` triggers resident notification after the database RPC succeeds. If the 4.8 RPC response does not yet include the new message id, extend the SQL RPC and TypeScript mapping in this story.
  - [x] Update `server/actions/admin-messages.ts` and the admin messages page only as needed for internal-note submission. Do not let form data specify sender role, sender id, visibility, notification recipients, email subject/body, audit values, or storage metadata.
  - [x] Keep notification calls outside broad `try/catch` blocks that would swallow Next `redirect`. Catch only notification errors inside service helpers or before redirect decisions.
  - [x] Preserve existing 4.7 attachment cleanup behavior and 4.8 admin reply/status/assignment behavior.

- [x] Add resident message history and resident reply UI. (AC: 1, 3)
  - [x] Add `server/services/messages/resident-message-history.ts` with `import "server-only"`.
  - [x] Use the existing `createClient`, `getCurrentProfile`, `getResidentPortalMemberships`, and safe union patterns from resident payments/documents/message creation services. Validate all filters before RPC calls: UUIDs, status/category allowlists, query length 200 or fewer, body length 5000 or fewer, page limit max 100, and page offset max 10000.
  - [x] Return safe unions such as `records`, `thread`, `replied`, `invalid-input`, `unauthenticated`, `profile-unavailable`, `no-active-membership`, `permission-denied`, and `messages-unavailable`.
  - [x] Add resident reply action handling to `server/actions/resident-messages.ts` or a narrowly named new action module. Parse only trusted fields: `threadId`, `body`, optional attachment files or attachment document IDs if supported, and current filter params. Ignore untrusted sender role, sender id, visibility, notification settings, recipient IDs, email fields, storage metadata, permission keys, and audit values.
  - [x] Add `app/(resident)/portal/(member)/messages/page.tsx` as a server-rendered resident history page. It should render filters, a compact thread list, selected-thread detail, visible message bodies, attachment counts only, reply form, accessible labels, field-specific errors, and an `aria-live="polite"` notice.
  - [x] Update `lib/resident/portal-navigation.ts` and any affected nav tests to include a resident "Messages" link to `/portal/messages` without removing the existing Contact Board creation page.
  - [x] Keep `/portal/contact-board` focused on creating new threads. It may link to `/portal/messages`, but do not turn it into a client-heavy inbox.
  - [x] Display timestamps in `America/New_York`. Do not show board/admin-only internal notes, attachment document IDs, storage internals, private document paths, email logs, audit logs, account numbers, payment data, or owner names on resident surfaces.

- [x] Add board/admin internal note support without leaking notes to residents. (AC: 1, 3)
  - [x] Extend `server/services/messages/admin-message-inbox.ts` with an `addInternalNoteToMessageThread(...)` mutation using the new admin-only RPC and the existing safe union style.
  - [x] Extend `server/actions/admin-messages.ts` with an internal-note action that redirects back to `/admin/messages` with generic outcomes such as `message=noted`, `message=invalid&messageField=noteBody`, `message=denied`, `message=signin`, or `message=unavailable`.
  - [x] Extend `app/(admin)/admin/messages/page.tsx` to render an internal-note form and distinguish `board_admin_only` messages in admin detail. Keep the existing operational style: dense forms, border-y sections, `rounded-sm` controls, plain notices, no admin shell/navigation refactor.
  - [x] Ensure internal-note forms never send resident notifications and never appear on resident history/detail RPCs.
  - [x] Do not implement full message visibility editing, message deletion, note redaction, notification preference UI, retention purge UI, or full audit-log viewer in this story.

- [x] Preserve privacy, retention, and existing public/resident/admin behavior. (AC: 1, 2, 3)
  - [x] Do not weaken the Story 4.7 generic document protections for `message_attachment`; attachments must remain hidden from generic document metadata/download paths unless a message-specific authorization/download story is created.
  - [x] Do not add public, guest, or client-component access to message tables, message services, notification services, `email_logs`, Resend helpers, service-role clients, or admin permission keys.
  - [x] Do not expose raw Supabase errors, `error.message`, `RESEND_API_KEY`, `RESEND_FROM_EMAIL`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_SECRET_KEY`, provider payloads, provider message ids, idempotency keys, storage buckets, storage paths, account numbers, payment fields, owner names, role permission internals, or audit internals to UI code.
  - [x] Preserve archived thread behavior: archived threads remain manager-visible and resident-hidden unless the implementation explicitly changes that with tests. Closing/reopening should not delete messages.
  - [x] Keep message retention settings additive and conservative. A future settings/admin job may alter retention policy, but normal create/reply/list/archive workflows in this story must preserve existing records.

- [x] Add focused static/source tests. (AC: 1, 2, 3)
  - [x] Add `tests/message-visibility-history-notifications.test.mjs`.
  - [x] Test the migration adds message notification/retention settings, message relation columns/indexes on `email_logs`, resident list/detail/reply RPCs, admin internal-note RPC, direct table grant revokes, authenticated RPC grants only, and no hard-delete workflow for preserved messages.
  - [x] Test resident detail/list RPCs require active property membership, exclude archived resident threads, filter messages to `visibility = 'thread_participants'`, and never return board/admin-only internal notes to residents.
  - [x] Test resident reply RPC validates UUID/body/category/status/attachments, inserts `sender_role = 'resident'`, forces `visibility = 'thread_participants'`, updates `last_message_at`, sets status to `pending_board`, clears `closed_at`, and returns a safe message id for notifications.
  - [x] Test admin internal-note RPC requires `admin.messages.manage`, inserts `visibility = 'board_admin_only'`, does not update resident-visible `last_message_at` unless intentionally justified, and is not wired to resident notifications.
  - [x] Test `message-notifications.ts` is server-only, reuses `sendEmail`, uses service role only there, writes `email_logs` with `message_notification`, related message/thread IDs, idempotency keys, suppressed states, provider results, sanitized errors, and notification preference/community setting checks.
  - [x] Test notification calls happen after successful durable RPCs in resident creation, resident reply, and admin reply services, and that notification failure is best-effort/non-blocking.
  - [x] Test resident history service/actions/page render filters, records, thread detail, reply controls, accessible notices, and safe field errors without importing service-role or email helpers.
  - [x] Test admin messages page/actions/service add internal note support and label `board_admin_only` messages for managers.
  - [x] Update resident navigation tests to include `/portal/messages`.
  - [x] Add negative assertions that public, guest, resident client, shared UI, generic document pages, and public API routes do not contain forbidden message, email, storage, service-role, audit, payment, or raw-error internals.
  - [x] Run `node --test tests/message-visibility-history-notifications.test.mjs`, `npm test`, `npm run typecheck`, `npm run lint`, `npm run build`, and `git diff --check`.

### Review Findings

- [x] [Review][Patch] Resident thread listing can include inactive/deleted-property threads [supabase/migrations/202605110017_message_visibility_history_and_notifications.sql:203] - `list_resident_message_threads` checks active memberships but does not apply the same `properties.status = 'active'` and `properties.deleted_at is null` constraints used by `app.can_read_message_thread`/`app.can_create_message_thread`, so a stale active membership on an inactive or soft-deleted property can still surface resident history rows.
- [x] [Review][Patch] Resident-safe JSON can expose profile identities/emails through shared admin profile summaries [supabase/migrations/202605110017_message_visibility_history_and_notifications.sql:104] - resident thread/message helpers call `app.message_profile_summary`, which includes profile IDs and falls back to `profiles.email` when `display_name` is blank. The resident RPC/page only needs a safe display label, so this can leak unnecessary participant/admin identity data through the resident history API.
- [x] [Review][Patch] Resident detail RPC exposes a thread-existence oracle [supabase/migrations/202605110017_message_visibility_history_and_notifications.sql:260] - `get_resident_message_thread_detail` returns `not_found` before checking caller visibility, while inaccessible existing threads return `permission_denied`. Because the RPC is granted to all authenticated users, callers can distinguish nonexistent UUIDs from existing-but-private/archived message threads.
- [x] [Review][Patch] Message notification service can send for ineligible private/deleted/archived messages [server/services/messages/message-notifications.ts:151] - `getNotificationContext` loads only ids/sender role and `resolveRecipients` trusts the requested notification type, so an accidental server-side call with a `board_admin_only` internal note, deleted message, mismatched sender role, or archived thread can still notify residents. The service should load message visibility/deleted state and thread status, then no-op unless the message/type pair is an eligible participant-visible resident create/reply or board/admin reply.
- [x] [Review][Patch] Suppressed message notification logs are retried instead of no-oping [server/services/messages/message-notifications.ts:357] - `isNonRetryableEmailLog` treats `sent`, `delivered`, `bounced`, and fresh `queued` as terminal, but excludes `suppressed`. Story 4.9 requires existing `suppressed` message notification logs to no-op, so a recipient who later gains an email or changes preferences can receive a notification for a message that was already intentionally suppressed.

## Dev Notes

Story 4.9 completes the Epic 4 message workflow started in Stories 4.7 and 4.8. The core data tables already exist, the board/admin inbox exists, generic document attachment leaks have been closed, and payment receipt email infrastructure already provides the Resend and `email_logs` pattern. This story should build on those pieces instead of creating a parallel messaging or email stack.

### Current Files To Update Or Read Fully

- `supabase/migrations/202605110015_resident_message_thread_creation.sql`
  - Current state: creates `message_threads`, `messages`, resident create/read helpers, `public.create_message_thread(...)`, RLS, direct grant revokes, private attachment validation, and generic document protections for `message_attachment`.
  - Change: do not edit in place unless unavoidable. Add a 4.9 migration that extends resident read/reply/detail behavior and preserves active-membership scoping.
  - Preserve: resident create remains membership-scoped; first resident message remains `sender_role = 'resident'` and `visibility = 'thread_participants'`; message attachments remain hidden from generic document list/download.

- `supabase/migrations/202605110016_board_admin_message_inbox_and_replies.sql`
  - Current state: adds `admin.messages.manage`, board/admin list/detail/reply/assignment/status RPCs, manager read access, direct table grant revokes, safe JSON helpers, and audit-ready mutations.
  - Change: extend or replace functions additively for new return fields, resident reply support, and internal notes. If replacing 4.8 RPCs, keep all existing 4.8 behavior and tests green.
  - Preserve: board/admin filters, assignment/status behavior, direct grant revokes, and the code-review fix that clears `closed_at` when a manager reply reopens a closed thread.

- `supabase/migrations/202605110007_create_email_logs.sql`
  - Current state: creates private `email_logs` with `message_notification` as an allowed type, idempotency key, statuses, attempt count, provider fields, related payment/property/compliance IDs, RLS, and no direct anon/authenticated grants.
  - Change: add message relation columns/indexes with `alter table ... add column if not exists`.
  - Preserve: no direct email log reads to residents, guests, public users, or broad authenticated clients.

- `supabase/migrations/202605110003_create_community_payment_settings_for_sessions.sql`
  - Current state: creates `community_settings` with payment/compliance defaults, `feature_flags`, RLS, and direct grant revokes.
  - Change: add message notification/retention settings only. Do not create the full settings-management UI or loosen direct settings grants.

- `server/services/messages/resident-message-threads.ts`
  - Current state: server-only resident creation service validates subject/body/category/property/files, checks current profile and active property membership, uses service role only for private attachment upload/metadata, calls `create_message_thread`, cleans up attachments on failure, and returns safe unions.
  - Change: call the notification service after successful thread creation. Keep attachment cleanup resilient and do not let notification failure roll back created threads.
  - Preserve: no raw errors, signed URLs, storage paths, owner names, account numbers, Stripe fields, Resend config, or admin permissions in resident/public output.

- `server/services/messages/admin-message-inbox.ts`
  - Current state: server-only admin message service validates filters/mutations, uses authenticated RPCs, returns safe unions, and does not use service-role clients.
  - Change: trigger resident notifications after successful board/admin reply; add internal-note mutation; map any new SQL response fields safely.
  - Preserve: no service-role client in this service unless explicitly justified; keep all existing list/detail/reply/assign/status results and redirects working.

- `server/actions/admin-messages.ts`
  - Current state: server actions parse trusted admin form keys and redirect to `/admin/messages` with generic query params while preserving filters.
  - Change: add internal-note action and redirect outcomes.
  - Preserve: ignore untrusted sender/visibility/notification/audit/storage fields.

- `server/actions/resident-messages.ts`
  - Current state: server action for creating resident message threads and redirecting to `/portal/contact-board` with generic status params.
  - Change: either add resident reply action here or add a focused new action module for resident history replies.
  - Preserve: create-thread behavior and privacy-safe redirects.

- `app/(resident)/portal/(member)/contact-board/page.tsx`
  - Current state: resident server-rendered new-thread form with active membership properties, category/subject/body/attachments, and field-specific notices.
  - Change: likely minimal. It may link to `/portal/messages`, but the history UI should live in a dedicated route.
  - Preserve: creation form remains simple and does not expose thread history internals, storage metadata, admin permissions, or email logs.

- `app/(admin)/admin/messages/page.tsx`
  - Current state: server-rendered operational inbox with filters, table, selected-thread detail, reply, assignment, and status controls. It already receives each message's `visibility`.
  - Change: add internal-note form and display/label board-admin-only messages for managers.
  - Preserve: existing style, filters, reply/status behavior, and no admin shell/navigation refactor.

- `server/services/payments/payment-receipt-email.ts`
  - Current state: good local pattern for service-role email side effects, idempotency keys, suppressed logs, retry windows, sanitized Resend errors, and non-blocking receipt sends after durable payment success.
  - Change: do not modify unless extracting a small shared helper is clearly worth it. Prefer copying the local pattern into `message-notifications.ts` instead of introducing a broad abstraction.
  - Preserve: payment receipt behavior and tests.

- `server/services/email/resend.ts` and `server/services/email/send-email.ts`
  - Current state: server-only Resend wrapper with `RESEND_API_KEY`, `RESEND_FROM_EMAIL`, idempotency key support, provider message ID handling, sanitized errors, and retryability mapping.
  - Change: likely none.
  - Preserve: do not expose these helpers outside server-only services.

- `lib/resident/portal-navigation.ts` and `components/resident/resident-portal-nav.tsx`
  - Current state: resident nav config and client nav component already render resident routes.
  - Change: add `Messages` nav item if adding `/portal/messages`. The component likely needs no change.
  - Preserve: keyboard behavior, active state, mobile menu, and existing route labels.

### Suggested New Files

- `supabase/migrations/202605110017_message_visibility_history_and_notifications.sql`
- `server/services/messages/resident-message-history.ts`
- `server/services/messages/message-notifications.ts`
- `app/(resident)/portal/(member)/messages/page.tsx`
- `tests/message-visibility-history-notifications.test.mjs`

Optional only if it keeps scope tight:

- `server/actions/resident-message-history.ts` if adding reply actions to `server/actions/resident-messages.ts` would make that file too broad.

### Message Visibility And Retention Rules

- Residents can see only threads for active linked properties and only messages with `visibility = 'thread_participants'`.
- Board/admin users with `admin.messages.manage` can see both `thread_participants` and `board_admin_only` messages in the admin inbox.
- Internal notes are board/admin-only messages. They should not show up in resident history, resident message counts, resident notifications, or resident timestamps in a way that leaks their existence.
- Archived threads remain hidden from resident history unless this story explicitly changes that and tests the privacy impact. Managers can still list/detail archived threads.
- Closing, reopening, replying, and archiving must preserve thread/message rows. Do not add `.delete()` calls or SQL `delete from public.messages/message_threads` in normal app workflows.
- Retention settings in this story are configuration and preservation guardrails. Do not implement a purge job, TTL, scheduled delete, or hard-delete UI.

### Notification Rules

- Send notifications only after the database mutation succeeds.
- Notification send/log failures are best-effort and must not change the user-visible result of the message mutation.
- Use `email_logs` idempotency before calling Resend so retries do not duplicate emails.
- `message_notification` emails should be minimal: community name, generic update copy, and instruction to sign in. Do not include message body, attachment names/IDs, property account numbers, payment details, owner names, storage paths, or internal note content.
- Default to opt-in when notification preferences are missing. Suppress only when the profile preference clearly disables message email notifications.
- Avoid notifying the actor who just sent the message.

### Previous Story Intelligence

- Story 4.8 explicitly left resident history UI, resident reply UI, notification emails, retention settings, internal notes, and message visibility history for Story 4.9.
- Story 4.8 code review found two bugs that matter here: replies reopening closed threads must clear `closed_at`, and action controls must use unique ids when multiple forms render on one page. Keep both lessons in resident reply and internal-note work.
- Story 4.7 and 4.8 use static `node:test` source-inspection guardrails instead of a live Supabase harness. Continue that pattern.
- Story 4.7 deliberately hid `message_attachment` documents from generic document metadata and signed download paths. 4.9 must not undo that while adding resident history.
- Story 3.7's email work established the expected Resend pattern: server-only helper, idempotent `email_logs`, safe/suppressed outcomes, and no raw provider errors in UI-facing code.

### Git Intelligence Summary

- `git log` currently shows only initial scaffold commits, so recent implementation patterns are better inferred from the working tree and completed story artifacts.
- Completed message stories use additive Supabase migrations, security-definer RPCs, server-only services, server actions with generic redirects, server-rendered App Router pages, and static `node:test` guardrails.
- Preserve those local patterns rather than adding a client state library, API route layer for internal messaging, live database test harness, or broad shared abstraction.

### Current Local Technical Information

- Local dependencies in `package.json`: Next `^16.0.0`, React `^19.0.0`, `@supabase/ssr` `^0.10.3`, `@supabase/supabase-js` `^2.105.3`, Resend `^6.12.3`, Stripe `^22.1.1`, Tailwind `^4.0.0`, TypeScript `^5.0.0`.
- Official Next docs state `redirect` can be used after mutations in Server Functions/Server Actions and that code after `redirect` will not execute. Keep redirects outside broad `try/catch` blocks.
- Official React 19 docs state Server Functions can be passed to form actions and forms can automatically submit to the server. The current codebase already uses this pattern through `"use server"` action modules.
- Official Supabase JavaScript docs call Postgres functions with `supabase.rpc(functionName, args)`. Continue using RPCs for transactional message mutations instead of multi-step client writes.
- Official Supabase RLS docs recommend security-definer helper functions for policy checks but warn not to put security-definer functions in exposed schemas. This project already uses `app.*` helpers plus exposed `public.*` RPC wrappers.
- Official Resend Node.js examples support passing an `idempotencyKey` option with `emails.send(...)`. Reuse the existing `sendEmail(...)` helper rather than calling Resend directly.

### Project Context Reference

- No `project-context.md` file was found under the project root during story creation. Use the planning artifacts, architecture/design docs, completed story files, and current code as authoritative context.

### References

- [Epic 4 Story 4.9 Source](/home/smount/Websites/SpringMeadowCommunity/_bmad-output/planning-artifacts/epics.md)
- [Requirements: Messages and Retention](/home/smount/Websites/SpringMeadowCommunity/docs/bmad/phase-1-requirements/requirements.md)
- [Architecture: Messaging and Email](/home/smount/Websites/SpringMeadowCommunity/docs/bmad/phase-2-architecture/architecture.md)
- [API Design: Messages API](/home/smount/Websites/SpringMeadowCommunity/docs/bmad/phase-3-design/api.md)
- [Data Model: Message Threads, Email Logs, Settings](/home/smount/Websites/SpringMeadowCommunity/docs/bmad/phase-3-design/data-model.md)
- [Tasks: Messaging Integration](/home/smount/Websites/SpringMeadowCommunity/docs/bmad/phase-4-tasks/tasks-v1.md)
- [Previous Story 4.8](/home/smount/Websites/SpringMeadowCommunity/_bmad-output/implementation-artifacts/4-8-board-admin-message-inbox-and-replies.md)
- [Previous Story 4.7](/home/smount/Websites/SpringMeadowCommunity/_bmad-output/implementation-artifacts/4-7-resident-message-thread-creation.md)
- [Resident Message Creation Service](/home/smount/Websites/SpringMeadowCommunity/server/services/messages/resident-message-threads.ts)
- [Admin Message Inbox Service](/home/smount/Websites/SpringMeadowCommunity/server/services/messages/admin-message-inbox.ts)
- [Payment Receipt Email Service Pattern](/home/smount/Websites/SpringMeadowCommunity/server/services/payments/payment-receipt-email.ts)
- [Resend Helper](/home/smount/Websites/SpringMeadowCommunity/server/services/email/send-email.ts)
- [Resident Portal Navigation](/home/smount/Websites/SpringMeadowCommunity/lib/resident/portal-navigation.ts)
- [Next.js Redirecting Docs](https://nextjs.org/docs/app/guides/redirecting)
- [React Server Functions Docs](https://react.dev/reference/rsc/server-functions)
- [Supabase JavaScript RPC Docs](https://supabase.com/docs/reference/javascript/rpc)
- [Supabase RLS Docs](https://supabase.com/docs/guides/database/postgres/row-level-security)
- [Resend Node.js Send Email Docs](https://resend.com/docs/send-with-nodejs)
- [Resend Idempotency Keys Docs](https://resend.com/docs/dashboard/emails/idempotency-keys)

## Dev Agent Record

### Agent Model Used

GPT-5 Codex

### Debug Log References

- `node --test tests/message-visibility-history-notifications.test.mjs` - passed
- `npm run typecheck` - passed
- `npm test` - passed
- `npm run lint` - passed
- `npm run build` - passed
- `git diff --check` - passed
- `node --test tests/message-visibility-history-notifications.test.mjs` - passed after code review chunk 2 notification fixes.
- `npm run typecheck` - passed after code review chunk 2 notification fixes.
- `npm test` - passed after code review chunk 2 notification fixes.
- `npm run lint` - passed after code review chunk 2 notification fixes.
- `npm run build` - passed after code review chunk 2 notification fixes.
- `git diff --check` - passed after code review chunk 2 notification fixes.

### Completion Notes List

- Ultimate context engine analysis completed - comprehensive developer guide created.
- Added additive 4.9 migration for resident history/detail/reply RPCs, admin internal notes, message notification settings, message email log relations, safe JSON helpers, revokes/grants, and preservation-oriented retention guardrails.
- Added server-only message notification service using the existing `sendEmail`/`email_logs` idempotency pattern with safe recipient resolution, opt-out suppression, generic message copy, and best-effort failure behavior.
- Added resident message history service, resident reply action, `/portal/messages` page, and resident navigation link while keeping `/portal/contact-board` focused on new thread creation.
- Extended admin message inbox service/actions/page with board/admin-only internal notes and resident notification after successful board/admin replies.
- Added Story 4.9 source tests and updated affected resident navigation/contact-board guardrails.
- Resolved code review chunk 2 notification findings by enforcing message/thread eligibility before recipient resolution and treating suppressed message notification logs as terminal.

### File List

- `_bmad-output/implementation-artifacts/4-9-message-visibility-history-and-notifications.md`
- `_bmad-output/implementation-artifacts/sprint-status.yaml`
- `app/(admin)/admin/messages/page.tsx`
- `app/(resident)/portal/(member)/messages/page.tsx`
- `lib/resident/portal-navigation.ts`
- `server/actions/admin-messages.ts`
- `server/actions/resident-messages.ts`
- `server/services/messages/admin-message-inbox.ts`
- `server/services/messages/message-notifications.ts`
- `server/services/messages/resident-message-history.ts`
- `server/services/messages/resident-message-threads.ts`
- `supabase/migrations/202605110017_message_visibility_history_and_notifications.sql`
- `tests/message-visibility-history-notifications.test.mjs`
- `tests/resident-message-thread.test.mjs`
- `tests/resident-portal-navigation.test.mjs`

### Change Log

- 2026-05-17 - Implemented Story 4.9 message visibility, resident history/replies, internal notes, notifications, retention guardrails, and focused source tests; moved story to review.
- 2026-05-17 - Addressed code review chunk 2 notification findings and moved story to done.
