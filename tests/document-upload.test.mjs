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

describe("secure document upload and storage routing", () => {
  it("adds document storage buckets without broad direct document object policies", () => {
    const migrationPath =
      "supabase/migrations/202605110011_secure_document_upload_and_storage_routing.sql";

    assert.ok(existsSync(join(root, migrationPath)));

    const migration = read(migrationPath);

    assert.match(migration, /insert into storage\.buckets/i);
    assert.match(migration, /public-documents/i);
    assert.match(migration, /private-documents/i);
    assert.match(migration, /uploads-temp/i);
    assert.match(migration, /file_size_limit/i);
    assert.match(migration, /6291456/);
    assert.match(migration, /allowed_mime_types/i);

    for (const mimeType of [
      "application/pdf",
      "text/plain",
      "text/csv",
      "image/jpeg",
      "image/png",
      "image/webp",
      "application/msword",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "application/vnd.ms-excel",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    ]) {
      assert.match(migration, new RegExp(mimeType.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
    }

    assert.match(
      migration,
      /'public-documents',\s*'public-documents',\s*true,\s*6291456,\s*allowed_document_mime_types/i,
    );
    assert.match(
      migration,
      /'private-documents',\s*'private-documents',\s*false,\s*6291456,\s*allowed_document_mime_types/i,
    );
    assert.match(
      migration,
      /'uploads-temp',\s*'uploads-temp',\s*false,\s*6291456,\s*allowed_document_mime_types/i,
    );
    assert.match(migration, /on conflict \(id\) do update/i);
    assert.doesNotMatch(migration, /bucket_id in \('private-documents'[\s\S]*for select to authenticated/i);
    assert.doesNotMatch(migration, /bucket_id in \('private-documents'[\s\S]*for insert to authenticated/i);
    assert.doesNotMatch(migration, /bucket_id = 'private-documents'[\s\S]*to anon/i);
    assert.doesNotMatch(migration, /bucket_id = 'public-documents'[\s\S]*for insert to anon/i);
  });

  it("implements a server-only upload service with permission-first storage routing and cleanup", () => {
    const servicePath = "server/services/documents/document-upload.ts";

    assert.ok(existsSync(join(root, servicePath)));

    const service = read(servicePath);

    assert.match(service, /import "server-only"/);
    assert.match(service, /createClient/);
    assert.match(service, /createServiceRoleClient/);
    assert.match(service, /createDocumentMetadata/);
    assert.match(service, /writeAuditLog/);
    assert.match(service, /admin\.documents\.manage/);
    assert.match(service, /PUBLIC_DOCUMENT_BUCKET = "public-documents"/);
    assert.match(service, /PRIVATE_DOCUMENT_BUCKET = "private-documents"/);
    assert.match(service, /TEMP_DOCUMENT_BUCKET = "uploads-temp"/);
    assert.match(service, /MAX_DOCUMENT_UPLOAD_BYTES = 6 \* 1024 \* 1024/);
    assert.match(service, /SUPPORTED_DOCUMENT_MIME_TYPES/);
    assert.match(service, /uploadDocument/);
    assert.match(service, /DocumentUploadResult/);
    assert.match(service, /kind: "uploaded"/);
    assert.match(service, /kind: "invalid-input"/);
    assert.match(service, /kind: "documents-unavailable"/);
    assert.match(service, /isUuid/);
    assert.match(service, /isValidDateOnly/);
    assert.match(service, /sanitizeFileName/);
    assert.match(service, /buildDocumentStoragePath/);
    assert.match(service, /randomUUID/);
    assert.match(service, /createHash/);
    assert.match(service, /arrayBuffer/);
    assert.match(service, /upsert: false/);
    assert.match(service, /contentType: file\.type/);
    assert.match(service, /\.storage\s*\.from\(bucket\)\s*\.upload/);
    assert.match(service, /\.storage\s*\.from\(bucket\)\s*\.remove\(\[storagePath\]\)/);
    assert.match(service, /document\.storage\.upload/);

    const uploadFunction = service.match(
      /export async function uploadDocument[\s\S]*?\n}/,
    )?.[0];

    assert.ok(uploadFunction);

    assertOrdered(uploadFunction, [
      /validateUploadInput/,
      /requireDocumentUploadPermission/,
      /createServiceRoleClient/,
      /\.storage\s*\.from\(bucket\)\s*\.upload/,
      /createDocumentMetadata/,
    ]);
    assertOrdered(uploadFunction, [
      /createDocumentMetadata/,
      /\.storage\s*\.from\(bucket\)\s*\.remove\(\[storagePath\]\)/,
    ]);

    assert.match(
      service,
      /visibility === "public"[\s\S]{0,120}PUBLIC_DOCUMENT_BUCKET[\s\S]{0,120}PRIVATE_DOCUMENT_BUCKET/,
    );
    assert.match(
      service,
      /visibility === "property_specific"[\s\S]{0,180}relatedPropertyId/i,
    );
    assert.doesNotMatch(service, /board\.documents\.view[\s\S]{0,120}upload/i);
    assert.doesNotMatch(
      service,
      /error\.message|signedUrl|createSignedUrl|downloadTo|owner_display_name|account_number|public_payment_code|guest_email|guest_phone|STRIPE_SECRET_KEY|RESEND_API_KEY/i,
    );
  });

  it("adds a server action that parses FormData safely without accepting storage paths", () => {
    const actionPath = "server/actions/document-upload.ts";

    assert.ok(existsSync(join(root, actionPath)));

    const action = read(actionPath);

    assert.match(action, /"use server"/);
    assert.match(action, /uploadDocument/);
    assert.match(action, /formData\.get\("file"\)/);
    assert.match(action, /instanceof File/);
    assert.match(action, /redirect\(`\/admin\/documents\?/);
    assert.match(action, /documentUploadField/);
    assert.match(action, /invalidFieldFromErrors/);
    assert.match(action, /communitySlug/);
    assert.doesNotMatch(action, /storageBucket|storagePath|private-documents|public-documents|createServiceRoleClient|SERVICE_ROLE|SUPABASE_SECRET_KEY|SUPABASE_SERVICE_ROLE_KEY/i);
  });

  it("renders a focused accessible admin document upload page without exposing private paths", () => {
    const pagePath = "app/(admin)/admin/documents/page.tsx";

    assert.ok(existsSync(join(root, pagePath)));

    const page = read(pagePath);

    assert.match(page, /uploadAdminDocument/);
    assert.match(page, /listDocumentMetadata/);
    assert.match(page, /Document upload/);
    assert.match(page, /name="file"/);
    assert.match(page, /type="file"/);
    assert.match(page, /name="title"/);
    assert.match(page, /name="category"/);
    assert.match(page, /name="visibility"/);
    assert.match(page, /name="relatedPropertyId"/);
    assert.match(page, /htmlFor="relatedVendorId"/);
    assert.match(page, /htmlFor="relatedMeetingId"/);
    assert.match(page, /htmlFor="relatedComplianceTaskId"/);
    assert.match(page, /htmlFor="relatedAssessmentId"/);
    assert.match(page, /name="effectiveDate"/);
    assert.match(page, /name="expirationDate"/);
    assert.match(page, /aria-live="polite"/);
    assert.match(page, /documentUpload/);
    assert.match(page, /documentUploadField/);
    assert.match(page, /overflow-x-auto/);
    assert.doesNotMatch(
      page,
      /storagePath|storageBucket|private-documents|public-documents|signedUrl|createSignedUrl|SERVICE_ROLE|SUPABASE_SECRET_KEY|SUPABASE_SERVICE_ROLE_KEY|error\.message|owner_display_name|account_number|public_payment_code|guest_email|guest_phone/i,
    );
  });

  it("keeps document upload internals out of public, resident, guest, and client-facing surfaces", () => {
    const clientFacingFiles = readExisting([
      ...listFiles("app/(public)"),
      ...listFiles("app/(resident)"),
      ...listFiles("components/public"),
      ...listFiles("components/resident"),
      ...listFiles("lib/public"),
    ]);

    assert.doesNotMatch(
      clientFacingFiles,
      /document-upload|uploadDocument|uploadAdminDocument|admin\.documents\.manage|createServiceRoleClient|service-role|private-documents|public-documents|storageBucket|storagePath|signedUrl|createSignedUrl|SERVICE_ROLE|SUPABASE_SERVICE_ROLE_KEY/i,
    );
  });
});
