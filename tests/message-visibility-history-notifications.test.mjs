import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();

function read(path) {
  return readFileSync(join(root, path), "utf8");
}

function listFiles(path) {
  const absolutePath = join(root, path);

  if (!existsSync(absolutePath)) {
    return [];
  }

  return readdirSync(absolutePath).flatMap((entry) => {
    const relativePath = `${path}/${entry}`;
    const entryPath = join(root, relativePath);

    return statSync(entryPath).isDirectory() ? listFiles(relativePath) : [relativePath];
  });
}

function readExisting(paths) {
  return paths.filter((path) => existsSync(join(root, path))).map(read).join("\n");
}

function assertOrdered(content, patterns) {
  let previousIndex = -1;

  for (const pattern of patterns) {
    const match = pattern.exec(content);

    assert.ok(match, `Expected to find ${pattern}`);
    assert.ok(match.index > previousIndex, `Expected ${pattern} to appear in order`);
    previousIndex = match.index;
  }
}

describe("message visibility, history, and notifications", () => {
  it("adds additive database support for resident history, internal notes, notifications, and retention", () => {
    const migrationPath =
      "supabase/migrations/202605110017_message_visibility_history_and_notifications.sql";

    assert.ok(existsSync(join(root, migrationPath)));

    const migration = read(migrationPath);

    assert.match(migration, /alter table public\.community_settings[\s\S]*message_notifications_enabled boolean not null default true/i);
    assert.match(migration, /message_retention_days integer not null default 2555/i);
    assert.match(migration, /message_retention_days >= 0/i);
    assert.match(migration, /alter table public\.email_logs[\s\S]*related_message_thread_id uuid references public\.message_threads\(id\)/i);
    assert.match(migration, /related_message_id uuid references public\.messages\(id\)/i);
    assert.match(migration, /email_logs_message_thread_idx/i);
    assert.match(migration, /email_logs_message_idx/i);
    assert.match(migration, /revoke all on public\.email_logs from anon, authenticated/i);
    assert.match(migration, /revoke all on public\.community_settings from anon, authenticated/i);

    assert.match(migration, /create or replace function app\.can_read_message_thread/i);
    assert.match(
      migration,
      /thread_record\.status <> 'archived'[\s\S]*pm\.status = 'active'[\s\S]*properties\.deleted_at is null[\s\S]*app\.can_manage_message_thread/i,
    );
    assert.match(migration, /create or replace function app\.resident_message_profile_summary/i);
    assert.match(migration, /create or replace function app\.resident_message_thread_summary_json/i);
    assert.match(migration, /create or replace function app\.resident_message_json/i);
    assert.match(migration, /create or replace function public\.list_resident_message_threads/i);
    assert.match(migration, /create or replace function public\.get_resident_message_thread_detail/i);
    assert.match(migration, /create or replace function public\.reply_to_resident_message_thread/i);
    assert.match(migration, /create or replace function public\.add_message_internal_note/i);
    assert.match(migration, /least\(greatest\(coalesce\(page_limit, 50\), 1\), 100\)/i);
    assert.match(migration, /least\(greatest\(coalesce\(page_offset, 0\), 0\), 10000\)/i);
    assert.match(migration, /filter_category not in \('dues', 'documents', 'maintenance', 'architectural', 'complaint', 'general'\)/i);
    assert.match(migration, /filter_status not in \('open', 'pending_board', 'pending_resident', 'closed'\)/i);
    assert.match(migration, /thread_record\.status <> 'archived'/i);
    assert.match(migration, /visibility = 'thread_participants'/i);
    assert.match(migration, /messages\.deleted_at is null/i);
    assert.match(migration, /attachment_count/i);
    assert.match(migration, /sender_display_name/i);

    const residentProfileSummary = migration.slice(
      migration.indexOf("create or replace function app.resident_message_profile_summary"),
      migration.indexOf("create or replace function app.resident_message_thread_summary_json"),
    );
    assert.match(residentProfileSummary, /'display_name'/i);
    assert.match(residentProfileSummary, /'Participant'/i);
    assert.doesNotMatch(residentProfileSummary, /profiles\.email|'profile_id'|app\.message_profile_summary/i);

    const residentThreadSummary = migration.slice(
      migration.indexOf("create or replace function app.resident_message_thread_summary_json"),
      migration.indexOf("create or replace function app.resident_message_json"),
    );
    assert.match(residentThreadSummary, /'created_by', app\.resident_message_profile_summary/i);
    assert.doesNotMatch(residentThreadSummary, /app\.message_profile_summary|'profile_id'|profiles\.email/i);

    const residentMessageJson = migration.slice(
      migration.indexOf("create or replace function app.resident_message_json"),
      migration.indexOf("create or replace function public.list_resident_message_threads"),
    );
    assert.match(residentMessageJson, /sender_display_name[\s\S]*app\.resident_message_profile_summary/i);
    assert.doesNotMatch(residentMessageJson, /app\.message_profile_summary|'profile_id'|profiles\.email/i);

    const residentList = migration.slice(
      migration.indexOf("create or replace function public.list_resident_message_threads"),
      migration.indexOf("create or replace function public.get_resident_message_thread_detail"),
    );
    assertOrdered(residentList, [
      /join public\.properties/,
      /properties\.status = 'active'/,
      /properties\.deleted_at is null/,
      /pm\.status = 'active'/,
    ]);

    const residentDetail = migration.slice(
      migration.indexOf("create or replace function public.get_resident_message_thread_detail"),
      migration.indexOf("create or replace function public.reply_to_resident_message_thread"),
    );
    assert.match(residentDetail, /if not found then[\s\S]*'status', 'permission_denied'/i);
    assert.doesNotMatch(residentDetail, /'not_found'/i);
    assert.doesNotMatch(
      migration,
      /storage_path|storage_bucket|audit_id|payment_details|account_number|owner_display_name|provider_message_id|idempotency_key/i,
    );

    const residentReply = migration.slice(
      migration.indexOf("create or replace function public.reply_to_resident_message_thread"),
    );
    assertOrdered(residentReply, [
      /app\.can_create_message_thread/,
      /thread_record\.status = 'archived'/,
      /app\.message_attachments_are_valid/,
      /insert into public\.messages/,
      /'resident'/,
      /'thread_participants'/,
      /status = 'pending_board'/,
      /closed_at = null/,
      /message\.thread\.resident_reply/,
    ]);
    assert.match(residentReply, /'message_id', created_message\.id/i);

    const internalNote = migration.slice(
      migration.indexOf("create or replace function public.add_message_internal_note"),
    );
    assertOrdered(internalNote, [
      /app\.can_manage_message_thread/,
      /sender_role_value := app\.message_actor_sender_role/,
      /insert into public\.messages/,
      /'board_admin_only'/,
      /message\.thread\.internal_note/,
    ]);
    assert.doesNotMatch(internalNote.slice(0, internalNote.indexOf("return jsonb_build_object")), /last_message_at =/i);

    assert.match(migration, /revoke all on function public\.list_resident_message_threads/i);
    assert.match(migration, /revoke all on function public\.get_resident_message_thread_detail/i);
    assert.match(migration, /revoke all on function public\.reply_to_resident_message_thread/i);
    assert.match(migration, /revoke all on function public\.add_message_internal_note/i);
    assert.match(migration, /grant execute on function public\.list_resident_message_threads/i);
    assert.match(migration, /grant execute on function public\.get_resident_message_thread_detail/i);
    assert.match(migration, /grant execute on function public\.reply_to_resident_message_thread/i);
    assert.match(migration, /grant execute on function public\.add_message_internal_note/i);
    assert.doesNotMatch(
      migration,
      /grant (select|insert|update|delete|all) on public\.(message_threads|messages|email_logs|audit_logs|community_settings) to (anon|authenticated)/i,
    );
    assert.doesNotMatch(migration, /delete from public\.(message_threads|messages|email_logs|documents)/i);
  });

  it("implements server-only best-effort message notifications with safe email logs", () => {
    const servicePath = "server/services/messages/message-notifications.ts";

    assert.ok(existsSync(join(root, servicePath)));

    const service = read(servicePath);

    assert.match(service, /import "server-only"/);
    assert.match(service, /createServiceRoleClient/);
    assert.match(service, /sendEmail/);
    assert.match(service, /sendMessageNotificationForMessage/);
    assert.match(service, /resident_thread_created/);
    assert.match(service, /resident_reply/);
    assert.match(service, /board_admin_reply/);
    assert.match(service, /\.from\("message_threads"\)/);
    assert.match(service, /\.from\("messages"\)/);
    assert.match(service, /sender_role, visibility, deleted_at/);
    assert.match(service, /assigned_to, status/);
    assert.match(service, /isEligibleNotificationContext/);
    assert.match(service, /visibility !== PARTICIPANT_VISIBLE_MESSAGE/);
    assert.match(service, /message\.deleted_at/);
    assert.match(service, /thread\.status === ARCHIVED_THREAD_STATUS/);
    assert.match(service, /sender_role === "resident"/);
    assert.match(service, /sender_role === "board_member" \|\| context\.message\.sender_role === "admin"/);
    assert.match(service, /\.from\("community_settings"\)/);
    assert.match(service, /message_notifications_enabled/);
    assert.match(service, /\.from\("profiles"\)/);
    assert.match(service, /notification_preferences/);
    assert.match(service, /messages\?\.email|messages.*email|message email/i);
    assert.match(service, /\.from\("email_logs"\)/);
    assert.match(service, /message_notification/);
    assert.match(service, /related_message_thread_id/);
    assert.match(service, /related_message_id/);
    assert.match(service, /related_property_id/);
    assert.match(service, /recipient_profile_id/);
    assert.match(service, /message-notification\/\$\{message\.id\}\/\$\{recipient\.profileId\}/);
    assert.match(service, /suppressed/);
    assert.match(service, /already-sent/);
    assert.match(service, /\["sent", "delivered", "bounced", "suppressed"\]\.includes\(emailLog\.status\)/);
    assert.match(service, /QUEUED_EMAIL_RETRY_AFTER_MS/);
    assert.match(service, /providerMessageId/);
    assert.match(service, /sanitizeNotificationError/);
    assert.match(service, /Spring Meadow HOA message update/);
    assert.match(service, /sign in to view/i);
    assert.match(service, /limit\(25\)/);

    assertOrdered(service, [
      /const context = await getNotificationContext/,
      /if \(!context\)/,
      /if \(!isEligibleNotificationContext\(context, input\.type\)\)/,
      /if \(!\(await notificationsEnabled/,
      /const recipients = await resolveRecipients/,
    ]);

    assertOrdered(service, [
      /const existingLog = await existingEmailLog/,
      /if \(existingLog && isNonRetryableEmailLog\(existingLog\)\)/,
      /const claimedLog = await claimEmailLog/,
      /const sendResult = await sendEmail/,
      /await updateEmailLogAfterSend/,
    ]);

    assert.doesNotMatch(
      service,
      /message\.body|attachment_document_ids|storage_path|storage_bucket|account_number|owner_display_name|payment|audit_logs|provider_payload|error\.message|throw new Error|RESEND_API_KEY|SUPABASE_SERVICE_ROLE_KEY|SUPABASE_SECRET_KEY/i,
    );
  });

  it("wires notifications only after durable create and reply RPCs", () => {
    const createService = read("server/services/messages/resident-message-threads.ts");
    const historyService = read("server/services/messages/resident-message-history.ts");
    const adminService = read("server/services/messages/admin-message-inbox.ts");

    assert.match(createService, /sendMessageNotificationForMessage/);
    assert.match(historyService, /sendMessageNotificationForMessage/);
    assert.match(adminService, /sendMessageNotificationForMessage/);

    assertOrdered(createService.slice(createService.indexOf("export async function createResidentMessageThread")), [
      /\.rpc\("create_message_thread"/,
      /result\.status !== "created"/,
      /await sendMessageNotificationForMessage\(\{\s*messageId:\s*record\.firstMessageId,\s*type:\s*"resident_thread_created"/,
      /return \{ kind: "created"/,
    ]);

    assertOrdered(historyService.slice(historyService.indexOf("export async function replyToResidentMessageThread")), [
      /\.rpc\("reply_to_resident_message_thread"/,
      /result\?\.status === "replied"/,
      /await sendMessageNotificationForMessage\(\{\s*messageId:\s*record\.messageId,\s*type:\s*"resident_reply"/,
      /return \{ kind: "replied"/,
    ]);

    assertOrdered(adminService.slice(adminService.indexOf("export async function replyToMessageThread")), [
      /\.rpc\("reply_to_message_thread"/,
      /rpcResultToMutation\(data as MessageRpcResult \| null, "replied"\)/,
      /await sendMessageNotificationForMessage\(\{\s*messageId:\s*mutation\.messageId,\s*type:\s*"board_admin_reply"/,
      /return mutation/,
    ]);

    assert.doesNotMatch(createService, /catch[\s\S]{0,160}redirect/i);
    assert.doesNotMatch(historyService, /catch[\s\S]{0,160}redirect/i);
    assert.doesNotMatch(adminService, /catch[\s\S]{0,160}redirect/i);
  });

  it("adds resident message history service, reply action, page, and navigation", () => {
    const servicePath = "server/services/messages/resident-message-history.ts";
    const actionPath = "server/actions/resident-messages.ts";
    const pagePath = "app/(resident)/portal/(member)/messages/page.tsx";
    const navPath = "lib/resident/portal-navigation.ts";

    assert.ok(existsSync(join(root, servicePath)));
    assert.ok(existsSync(join(root, pagePath)));

    const service = read(servicePath);
    const action = read(actionPath);
    const page = read(pagePath);
    const nav = read(navPath);

    assert.match(service, /import "server-only"/);
    assert.match(service, /createClient/);
    assert.match(service, /getCurrentProfile/);
    assert.match(service, /getResidentPortalMemberships/);
    assert.match(service, /listResidentMessageThreads/);
    assert.match(service, /getResidentMessageThreadDetail/);
    assert.match(service, /replyToResidentMessageThread/);
    assert.match(service, /list_resident_message_threads/);
    assert.match(service, /get_resident_message_thread_detail/);
    assert.match(service, /reply_to_resident_message_thread/);
    assert.match(service, /MAX_BODY_LENGTH = 5000/);
    assert.match(service, /MAX_QUERY_LENGTH = 200/);
    assert.match(service, /MAX_PAGE_SIZE = 100/);
    assert.match(service, /MAX_PAGE_OFFSET = 10000/);
    assert.match(service, /records/);
    assert.match(service, /thread/);
    assert.match(service, /replied/);
    assert.match(service, /invalid-input/);
    assert.match(service, /permission-denied/);
    assert.match(service, /messages-unavailable/);
    assert.doesNotMatch(
      service,
      /createServiceRoleClient|service-role|SUPABASE_SERVICE_ROLE_KEY|SUPABASE_SECRET_KEY|storagePath|storageBucket|email_logs|provider_message_id|idempotency_key|owner_display_name|account_number|payment|audit_logs|error\.message/i,
    );

    assert.match(action, /replyToResidentMessageThreadAction/);
    assert.match(action, /formData\.get\("threadId"\)/);
    assert.match(action, /formData\.get\("body"\)/);
    assert.match(action, /formData\.get\("attachmentDocumentIds"\)/);
    assert.match(action, /redirect\(`\/portal\/messages\?/);
    assert.doesNotMatch(
      action,
      /senderRole|senderId|visibility|notification|recipient|email|storageBucket|storagePath|audit|createServiceRoleClient|SERVICE_ROLE|error\.message/i,
    );

    assert.match(page, /listResidentMessageThreads/);
    assert.match(page, /getResidentMessageThreadDetail/);
    assert.match(page, /replyToResidentMessageThreadAction/);
    assert.match(page, /Message history/);
    assert.match(page, /name="propertyId"/);
    assert.match(page, /name="status"/);
    assert.match(page, /name="category"/);
    assert.match(page, /name="query"/);
    assert.match(page, /name="threadId"/);
    assert.match(page, /name="body"/);
    assert.match(page, /Attachment count/);
    assert.match(page, /aria-live="polite"/);
    assert.match(page, /timeZone:\s*"America\/New_York"/);
    assert.doesNotMatch(
      page,
      /board_admin_only|message_threads|public\.messages|storagePath|storageBucket|private-documents|email_logs|provider_message_id|idempotency_key|admin\.messages\.manage|audit_logs|account_number|owner_display_name|payment|error\.message/i,
    );

    assert.match(nav, /label:\s*"Messages"/);
    assert.match(nav, /href:\s*"\/portal\/messages"/);
  });

  it("adds admin internal notes without exposing them to residents", () => {
    const actionsPath = "server/actions/admin-messages.ts";
    const servicePath = "server/services/messages/admin-message-inbox.ts";
    const pagePath = "app/(admin)/admin/messages/page.tsx";

    const actions = read(actionsPath);
    const service = read(servicePath);
    const page = read(pagePath);

    assert.match(service, /addInternalNoteToMessageThread/);
    assert.match(service, /add_message_internal_note/);
    assert.match(service, /noted/);
    assert.match(actions, /addInternalNoteToMessageThreadAction/);
    assert.match(actions, /formData\.get\("noteBody"\)/);
    assert.match(actions, /"noted"/);
    assert.doesNotMatch(actions, /visibility|senderRole|senderId|notification|recipient|email|audit|storage/i);

    assert.match(page, /addInternalNoteToMessageThreadAction/);
    assert.match(page, /Internal note/);
    assert.match(page, /name="noteBody"/);
    assert.match(page, /board_admin_only/);
    assert.match(page, /Board\/admin note/);
    assert.doesNotMatch(page, /createServiceRoleClient|service-role|email_logs|provider_message_id|idempotency_key|storagePath|storageBucket|audit_logs|error\.message/i);
  });

  it("keeps preserved message records and sensitive internals out of unsafe surfaces", () => {
    const appAndServer = readExisting([
      ...listFiles("app"),
      ...listFiles("server"),
      ...listFiles("lib/resident"),
      ...listFiles("components"),
    ]);
    const unsafeResidentAndPublic = readExisting([
      ...listFiles("app/(public)"),
      ...listFiles("app/api/guest-payments"),
      ...listFiles("app/(resident)"),
      ...listFiles("components/public"),
      ...listFiles("components/resident"),
      ...listFiles("lib/public"),
      "lib/supabase/client.ts",
      "lib/supabase/proxy.ts",
      "proxy.ts",
    ]);

    assert.doesNotMatch(appAndServer, /\.from\("message_threads"\)\.delete|\.from\("messages"\)\.delete|delete from public\.(message_threads|messages|email_logs)/i);
    assert.doesNotMatch(
      unsafeResidentAndPublic,
      /createServiceRoleClient|service-role|SUPABASE_SERVICE_ROLE_KEY|SUPABASE_SECRET_KEY|storagePath|storageBucket|private-documents|email_logs|provider_message_id|idempotency_key|admin\.messages\.manage|roles\.permissions|audit_logs|owner_display_name|account_number|public_payment_code|stripe_|resend|error\.message/i,
    );
  });
});
