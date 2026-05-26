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

describe("resident message thread creation", () => {
  it("adds message thread schema, membership-scoped RPCs, RLS, and audit-ready creation", () => {
    const migrationPath = "supabase/migrations/202605110015_resident_message_thread_creation.sql";

    assert.ok(existsSync(join(root, migrationPath)));

    const migration = read(migrationPath);

    assert.match(migration, /create table if not exists public\.message_threads/i);
    assert.match(migration, /create table if not exists public\.messages/i);
    assert.match(migration, /category text not null/i);
    assert.match(
      migration,
      /'dues'[\s\S]*'documents'[\s\S]*'maintenance'[\s\S]*'architectural'[\s\S]*'complaint'[\s\S]*'general'/i,
    );
    assert.match(
      migration,
      /'open'[\s\S]*'pending_board'[\s\S]*'pending_resident'[\s\S]*'closed'[\s\S]*'archived'/i,
    );
    assert.match(migration, /sender_role text not null/i);
    assert.match(migration, /'resident'[\s\S]*'board_member'[\s\S]*'admin'/i);
    assert.match(migration, /attachment_document_ids uuid\[\] not null default '\{\}'/i);
    assert.match(migration, /message_threads_property_idx/i);
    assert.match(migration, /message_threads_status_idx/i);
    assert.match(migration, /message_threads_assigned_idx/i);
    assert.match(migration, /messages_thread_idx/i);
    assert.match(migration, /messages_attachment_document_ids_gin_idx/i);
    assert.match(migration, /alter table public\.message_threads enable row level security/i);
    assert.match(migration, /alter table public\.messages enable row level security/i);
    assert.match(migration, /revoke all on public\.message_threads from anon, authenticated/i);
    assert.match(migration, /revoke all on public\.messages from anon, authenticated/i);
    assert.match(migration, /create or replace function app\.can_create_message_thread/i);
    assert.match(migration, /create or replace function app\.can_read_message_thread/i);
    assert.match(migration, /create or replace function public\.create_message_thread/i);
    assert.match(migration, /app\.current_profile_id\(\)/i);
    assert.match(migration, /pm\.status = 'active'/i);
    assert.match(migration, /properties\.status = 'active'/i);
    assert.match(migration, /properties\.deleted_at is null/i);
    assert.match(migration, /sender_role[\s\S]{0,160}'resident'/i);
    assert.match(migration, /visibility[\s\S]{0,180}'thread_participants'/i);
    assert.match(migration, /private-documents/i);
    assert.match(migration, /message_attachment/i);
    assert.match(migration, /insert into public\.audit_logs/i);
    assert.match(migration, /message\.thread\.create/i);
    assert.match(migration, /exception\s+when others then null/i);
    assert.match(migration, /grant execute on function public\.create_message_thread/i);
    assert.match(migration, /public\.get_authorized_document_download_metadata[\s\S]*document_record\.category = 'message_attachment'[\s\S]*'not_found'/i);
    assert.match(migration, /public\.list_document_metadata[\s\S]*documents\.category <> 'message_attachment'/i);
    assert.doesNotMatch(
      migration,
      /grant (select|insert|update|delete|all) on public\.(message_threads|messages) to (anon|authenticated)/i,
    );
    assert.doesNotMatch(migration, /admin\.messages\.manage|resend|stripe_/i);
  });

  it("implements a server-only resident message service with validation before storage and RPC calls", () => {
    const servicePath = "server/services/messages/resident-message-threads.ts";

    assert.ok(existsSync(join(root, servicePath)));

    const service = read(servicePath);

    assert.match(service, /import "server-only"/);
    assert.match(service, /createClient/);
    assert.match(service, /createServiceRoleClient/);
    assert.match(service, /getCurrentProfile/);
    assert.match(service, /getCurrentPropertyMemberships/);
    assert.match(service, /createResidentMessageThread/);
    assert.match(service, /ResidentMessageThreadResult/);
    assert.match(service, /MESSAGE_CATEGORIES/);
    assert.match(service, /MAX_SUBJECT_LENGTH = 200/);
    assert.match(service, /MAX_BODY_LENGTH = 5000/);
    assert.match(service, /MAX_MESSAGE_ATTACHMENTS = 3/);
    assert.match(service, /MAX_ATTACHMENT_BYTES = 6 \* 1024 \* 1024/);
    assert.match(service, /SUPPORTED_ATTACHMENT_MIME_TYPES/);
    assert.match(service, /PRIVATE_DOCUMENT_BUCKET = "private-documents"/);
    assert.match(service, /buildMessageAttachmentStoragePath/);
    assert.match(service, /sanitizeFileName/);
    assert.match(service, /randomUUID/);
    assert.match(service, /\.storage\s*\.from\(PRIVATE_DOCUMENT_BUCKET\)\s*\.upload/);
    assert.match(service, /\.storage\s*\.from\(PRIVATE_DOCUMENT_BUCKET\)\s*\.remove\(\[attachment\.storagePath\]\)/);
    assert.match(service, /\.from\("documents"\)\s*\.insert/);
    assert.match(service, /\.from\("documents"\)\s*\.update/);
    assert.match(service, /title:\s*safeFilename/);
    assert.match(service, /\.rpc\("create_message_thread"/);
    assert.match(service, /created/);
    assert.match(service, /invalid-input/);
    assert.match(service, /no-active-membership/);
    assert.match(service, /permission-denied/);
    assert.match(service, /messages-unavailable/);

    const createFunction = service.slice(service.indexOf("export async function createResidentMessageThread"));

    assertOrdered(createFunction, [
      /validateThreadInput/,
      /getCurrentPropertyMemberships/,
      /uploadMessageAttachments/,
      /\.rpc\("create_message_thread"/,
    ]);
    assertOrdered(createFunction, [
      /\.rpc\("create_message_thread"/,
      /cleanupMessageAttachments/,
    ]);

    const uploadFunction = service.slice(service.indexOf("async function uploadMessageAttachments"));

    assertOrdered(uploadFunction, [
      /createServiceRoleClient/,
      /\.storage\s*\.from\(PRIVATE_DOCUMENT_BUCKET\)\s*\.upload/,
      /createAttachmentMetadata/,
    ]);

    const metadataFunction = service.slice(service.indexOf("async function createAttachmentMetadata"));

    assertOrdered(metadataFunction, [
      /\.from\("documents"\)\s*\.insert/,
      /\.select\("id"\)/,
    ]);

    assert.doesNotMatch(service, /admin\.documents\.manage|admin\.messages\.manage|error\.message|signedUrl|createSignedUrl|owner_display_name|account_number|public_payment_code|guest_email|guest_phone|stripe_|resend/i);
  });

  it("adds a resident server action that parses FormData safely and ignores untrusted fields", () => {
    const actionPath = "server/actions/resident-messages.ts";

    assert.ok(existsSync(join(root, actionPath)));

    const action = read(actionPath);

    assert.match(action, /"use server"/);
    assert.match(action, /createResidentMessageThread/);
    assert.match(action, /createResidentMessageThreadAction/);
    assert.match(action, /formData\.get\("propertyId"\)/);
    assert.match(action, /formData\.get\("subject"\)/);
    assert.match(action, /formData\.get\("category"\)/);
    assert.match(action, /formData\.get\("body"\)/);
    assert.match(action, /formData\.getAll\("attachments"\)/);
    assert.match(action, /instanceof File/);
    assert.match(action, /redirect\(`\/portal\/contact-board\?/);
    assert.match(action, /messageField/);
    const createAction = action.slice(
      action.indexOf("export async function createResidentMessageThreadAction"),
      action.indexOf("export async function replyToResidentMessageThreadAction"),
    );

    assert.doesNotMatch(
      createAction,
      /storageBucket|storagePath|senderRole|profileId|status|visibility|createServiceRoleClient|SERVICE_ROLE|SUPABASE_SECRET_KEY|SUPABASE_SERVICE_ROLE_KEY|admin\.messages\.manage|admin\.documents\.manage/i,
    );
  });

  it("renders the resident Contact Board form from active memberships without private leakage", () => {
    const pagePath = "app/(resident)/portal/(member)/contact-board/page.tsx";

    assert.ok(existsSync(join(root, pagePath)));

    const page = read(pagePath);

    assert.match(page, /getResidentPortalMemberships/);
    assert.match(page, /createResidentMessageThreadAction/);
    assert.match(page, /Contact Board/);
    assert.match(page, /name="propertyId"/);
    assert.match(page, /name="category"/);
    assert.match(page, /name="subject"/);
    assert.match(page, /name="body"/);
    assert.match(page, /name="attachments"/);
    assert.match(page, /type="file"/);
    assert.match(page, /multiple/);
    assert.match(page, /dues/);
    assert.match(page, /documents/);
    assert.match(page, /maintenance/);
    assert.match(page, /architectural/);
    assert.match(page, /complaint/);
    assert.match(page, /general/);
    assert.match(page, /aria-live="polite"/);
    assert.match(page, /messageField/);
    assert.match(page, /FieldError/);
    assert.match(page, /aria-describedby=\{fieldErrorId\("category"\)\}/);
    assert.match(page, /aria-invalid=\{isFieldInvalid\(message, messageField, "category"\) \|\| undefined\}/);
    assert.match(page, /message-error-attachments/);
    assert.match(page, /maskedAccountNumber/);
    assert.doesNotMatch(
      page,
      /message_threads|admin\.messages\.manage|storagePath|storageBucket|private-documents|createServiceRoleClient|service-role|SUPABASE_SERVICE_ROLE_KEY|error\.message|owner_display_name|account_number|public_payment_code|stripe_|resend|audit_logs/i,
    );
  });

  it("keeps message internals out of public, guest, client, and shared UI surfaces", () => {
    const clientFacingFiles = readExisting([
      ...listFiles("app/(public)"),
      ...listFiles("app/api/guest-payments"),
      ...listFiles("components/public"),
      ...listFiles("components/resident"),
      ...listFiles("lib/public"),
    ]);

    assert.doesNotMatch(
      clientFacingFiles,
      /createServiceRoleClient|service-role|SUPABASE_SERVICE_ROLE_KEY|SUPABASE_SECRET_KEY|storageBucket|storagePath|private-documents|message_threads|admin\.messages\.manage|audit_logs|error\.message|owner_display_name|account_number|public_payment_code|stripe_|resend/i,
    );
  });

  it("keeps message attachments out of the generic document library and signed download path", () => {
    const metadataService = read("server/services/documents/document-metadata.ts");
    const downloadService = read("server/services/documents/document-download.ts");

    assert.match(metadataService, /MESSAGE_ATTACHMENT_CATEGORY = "message_attachment"/);
    assert.match(
      metadataService,
      /\.filter\(\(record\) => record\.category !== MESSAGE_ATTACHMENT_CATEGORY\)/,
    );
    assert.match(downloadService, /MESSAGE_ATTACHMENT_CATEGORY = "message_attachment"/);
    assert.match(
      downloadService,
      /record\.category === MESSAGE_ATTACHMENT_CATEGORY[\s\S]*return \{ kind: "not-found"/,
    );
    const downloadFunction = downloadService.slice(
      downloadService.indexOf("export async function createDocumentDownloadUrl"),
    );

    assertOrdered(downloadFunction, [
      /record\.category === MESSAGE_ATTACHMENT_CATEGORY/,
      /message_attachment_not_available[\s\S]*return \{ kind: "not-found"/,
      /return createPublicUrl\(record\)/,
      /return createSignedPrivateUrl\(record\)/,
    ]);
  });
});
