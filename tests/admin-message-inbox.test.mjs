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

describe("admin message inbox and replies", () => {
  it("adds message management permission, scoped RPCs, safe grants, and audit-ready mutations", () => {
    const migrationPath =
      "supabase/migrations/202605110016_board_admin_message_inbox_and_replies.sql";

    assert.ok(existsSync(join(root, migrationPath)));

    const migration = read(migrationPath);

    assert.match(migration, /admin\.messages\.manage/i);
    assert.match(migration, /where key in \('admin', 'board_member'\)/i);
    assert.match(migration, /create or replace function app\.can_manage_message_thread/i);
    assert.match(migration, /create or replace function app\.can_read_message_thread/i);
    assert.match(
      migration,
      /thread_record\.status <> 'archived'[\s\S]*pm\.status = 'active'[\s\S]*app\.can_manage_message_thread/i,
    );
    assert.match(migration, /create or replace function public\.list_message_threads/i);
    assert.match(migration, /create or replace function public\.get_message_thread_detail/i);
    assert.match(migration, /create or replace function public\.reply_to_message_thread/i);
    assert.match(migration, /create or replace function public\.assign_message_thread/i);
    assert.match(migration, /create or replace function public\.set_message_thread_status/i);
    assert.match(migration, /app\.has_permission\(target_community_id, 'admin\.messages\.manage'\)/i);
    assert.match(
      migration,
      /'dues'[\s\S]*'documents'[\s\S]*'maintenance'[\s\S]*'architectural'[\s\S]*'complaint'[\s\S]*'general'/i,
    );
    assert.match(
      migration,
      /'open'[\s\S]*'pending_board'[\s\S]*'pending_resident'[\s\S]*'closed'[\s\S]*'archived'/i,
    );
    assert.match(migration, /page_limit integer default 50/i);
    assert.match(migration, /least\(greatest\(coalesce\(page_limit, 50\), 1\), 100\)/i);
    assert.match(migration, /insert into public\.messages/i);
    assert.match(migration, /sender_role[\s\S]{0,260}'admin'[\s\S]{0,260}'board_member'/i);
    assert.match(migration, /visibility[\s\S]{0,180}'thread_participants'/i);
    assert.match(migration, /set last_message_at = created_message\.created_at/i);
    assert.match(migration, /status = 'pending_resident'/i);
    assert.match(migration, /closed_at = now\(\)/i);
    assert.match(migration, /closed_at = null/i);
    assert.match(migration, /message\.thread\.reply/i);
    assert.match(migration, /message\.thread\.assign/i);
    assert.match(migration, /message\.thread\.close/i);
    assert.match(migration, /message\.thread\.archive/i);
    assert.match(migration, /message\.thread\.reopen/i);
    assert.match(migration, /exception\s+when others then null/i);
    assert.match(migration, /revoke all on public\.message_threads from anon, authenticated/i);
    assert.match(migration, /revoke all on public\.messages from anon, authenticated/i);
    assert.match(migration, /grant execute on function public\.list_message_threads/i);
    assert.match(migration, /grant execute on function public\.get_message_thread_detail/i);
    assert.match(migration, /grant execute on function public\.reply_to_message_thread/i);
    assert.match(migration, /grant execute on function public\.assign_message_thread/i);
    assert.match(migration, /grant execute on function public\.set_message_thread_status/i);
    assert.doesNotMatch(
      migration,
      /grant (select|insert|update|delete|all) on public\.(message_threads|messages) to (anon|authenticated)/i,
    );
    assert.doesNotMatch(migration, /stripe_|resend|storage_bucket|storage_path/i);

    const replyFunction = migration.slice(
      migration.indexOf("create or replace function public.reply_to_message_thread"),
    );

    assertOrdered(replyFunction, [
      /not app\.can_manage_message_thread/,
      /insert into public\.messages/,
      /update public\.message_threads/,
      /closed_at = null/,
      /insert into public\.audit_logs/,
    ]);
  });

  it("implements a server-only admin message service with safe unions and RPC-backed operations", () => {
    const servicePath = "server/services/messages/admin-message-inbox.ts";

    assert.ok(existsSync(join(root, servicePath)));

    const service = read(servicePath);

    assert.match(service, /import "server-only"/);
    assert.match(service, /createClient/);
    assert.match(service, /getCurrentProfile/);
    assert.match(service, /AdminMessageThreadSummary/);
    assert.match(service, /AdminMessageResult/);
    assert.match(service, /list_message_threads/);
    assert.match(service, /get_message_thread_detail/);
    assert.match(service, /reply_to_message_thread/);
    assert.match(service, /assign_message_thread/);
    assert.match(service, /set_message_thread_status/);
    assert.match(service, /MAX_BODY_LENGTH = 5000/);
    assert.match(service, /MAX_QUERY_LENGTH = 200/);
    assert.match(service, /MAX_PAGE_SIZE = 100/);
    assert.match(service, /MAX_PAGE_OFFSET = 10000/);
    assert.match(service, /unauthenticated/);
    assert.match(service, /profile-unavailable/);
    assert.match(service, /invalid-input/);
    assert.match(service, /permission-denied/);
    assert.match(service, /messages-unavailable/);
    assert.match(service, /status-updated/);

    const listFunction = service.slice(service.indexOf("export async function listMessageThreads"));
    assertOrdered(listFunction, [/validateListInput/, /requireActiveProfile/, /\.rpc\("list_message_threads"/]);

    const replyFunction = service.slice(service.indexOf("export async function replyToMessageThread"));
    assertOrdered(replyFunction, [/validateReplyInput/, /requireActiveProfile/, /\.rpc\("reply_to_message_thread"/]);

    assert.doesNotMatch(
      service,
      /createServiceRoleClient|SUPABASE_SERVICE_ROLE_KEY|SUPABASE_SECRET_KEY|storagePath|storageBucket|error\.message|owner_display_name|account_number|public_payment_code|guest_email|guest_phone|stripe_|resend|audit_logs/i,
    );
  });

  it("adds safe admin actions and an operational message inbox page", () => {
    const actionsPath = "server/actions/admin-messages.ts";
    const pagePath = "app/(admin)/admin/messages/page.tsx";

    assert.ok(existsSync(join(root, actionsPath)));
    assert.ok(existsSync(join(root, pagePath)));

    const actions = read(actionsPath);
    const page = read(pagePath);

    assert.match(actions, /"use server"/);
    assert.match(actions, /replyToMessageThread/);
    assert.match(actions, /assignMessageThread/);
    assert.match(actions, /setMessageThreadStatus/);
    assert.match(actions, /formData\.get\("threadId"\)/);
    assert.match(actions, /formData\.get\("body"\)/);
    assert.match(actions, /formData\.get\("assignedTo"\)/);
    assert.match(actions, /formData\.get\("status"\)/);
    assert.match(actions, /attachmentDocumentIds/);
    assert.match(actions, /redirect\(`\/admin\/messages\?/);
    assert.match(actions, /messageField/);
    assert.doesNotMatch(
      actions,
      /senderRole|senderId|visibility|createdAt|storageBucket|storagePath|createServiceRoleClient|SERVICE_ROLE|SUPABASE_SECRET_KEY|SUPABASE_SERVICE_ROLE_KEY|audit_logs|error\.message/i,
    );

    assert.match(page, /Message inbox/);
    assert.match(page, /listMessageThreads/);
    assert.match(page, /getMessageThreadDetail/);
    assert.match(page, /replyToMessageThreadAction/);
    assert.match(page, /assignMessageThreadAction/);
    assert.match(page, /setMessageThreadStatusAction/);
    assert.match(page, /name="status"/);
    assert.match(page, /name="category"/);
    assert.match(page, /name="propertyId"/);
    assert.match(page, /name="assignedTo"/);
    assert.match(page, /name="lastMessageFrom"/);
    assert.match(page, /name="lastMessageTo"/);
    assert.match(page, /name="threadId"/);
    assert.match(page, /name="body"/);
    assert.match(page, /name="attachmentDocumentIds"/);
    assert.match(page, /const assignedToInputId = `assignedTo-\$\{thread\.threadId\}`/);
    assert.match(page, /htmlFor=\{assignedToInputId\}/);
    assert.match(page, /id=\{assignedToInputId\}/);
    assert.match(page, /aria-live="polite"/);
    assert.match(page, /timeZone:\s*"America\/New_York"/);
    assert.match(page, /Attachment count/);
    assert.doesNotMatch(
      page,
      /storagePath|storageBucket|private-documents|public-documents|createServiceRoleClient|service-role|SUPABASE_SERVICE_ROLE_KEY|owner_display_name|account_number|public_payment_code|stripe_|resend|audit_logs|error\.message/i,
    );
  });

  it("keeps admin message internals out of public, guest, resident, and shared UI surfaces", () => {
    const clientFacingFiles = readExisting([
      ...listFiles("app/(public)"),
      ...listFiles("app/api/guest-payments"),
      ...listFiles("app/(resident)"),
      ...listFiles("components/public"),
      ...listFiles("components/resident"),
      ...listFiles("lib/public"),
    ]);

    assert.doesNotMatch(
      clientFacingFiles,
      /createServiceRoleClient|service-role|SUPABASE_SERVICE_ROLE_KEY|SUPABASE_SECRET_KEY|storageBucket|storagePath|private-documents|public-documents|message_threads|public\.messages|\.from\("messages"\)|admin\.messages\.manage|audit_logs|error\.message|owner_display_name|account_number|public_payment_code|guest_email|guest_phone|stripe_|resend/i,
    );
  });
});
