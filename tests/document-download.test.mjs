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

describe("signed private document download", () => {
  it("adds an authorized download metadata RPC without broad table grants", () => {
    const migrationPath = "supabase/migrations/202605110012_signed_private_document_download.sql";

    assert.ok(existsSync(join(root, migrationPath)));

    const migration = read(migrationPath);

    assert.match(migration, /create or replace function public\.get_authorized_document_download_metadata/i);
    assert.match(migration, /security definer/i);
    assert.match(migration, /set search_path = public, app/i);
    assert.match(migration, /target_document_id uuid/i);
    assert.match(migration, /from public\.documents/i);
    assert.match(migration, /app\.can_read_document\(document_record\.id\)/i);
    assert.match(migration, /jsonb_build_object\('status', 'allowed'/i);
    assert.match(migration, /app\.document_metadata_json\(document_record\)/i);
    assert.match(migration, /jsonb_build_object\('status', 'permission_denied'\)/i);
    assert.match(migration, /jsonb_build_object\('status', 'not_found'\)/i);
    assert.match(
      migration,
      /grant execute on function public\.get_authorized_document_download_metadata\(uuid\) to anon, authenticated/i,
    );
    assert.doesNotMatch(
      migration,
      /grant (select|insert|update|delete|all) on public\.(documents|document_access_logs) to (anon|authenticated)/i,
    );
    assert.doesNotMatch(
      migration,
      /storage_bucket.*permission_denied|storage_path.*permission_denied|related_property_id.*permission_denied/i,
    );
  });

  it("implements a server-only download service with authorization-before-signing and access logs", () => {
    const servicePath = "server/services/documents/document-download.ts";

    assert.ok(existsSync(join(root, servicePath)));

    const service = read(servicePath);

    assert.match(service, /import "server-only"/);
    assert.match(service, /createClient/);
    assert.match(service, /createServiceRoleClient/);
    assert.match(service, /get_authorized_document_download_metadata/);
    assert.match(
      service,
      /\^\[0-9a-f\]\{8\}-\[0-9a-f\]\{4\}-\[1-5\]\[0-9a-f\]\{3\}-\[89ab\]\[0-9a-f\]\{3\}-\[0-9a-f\]\{12\}\$/,
    );
    assert.match(service, /SIGNED_DOCUMENT_URL_EXPIRES_SECONDS\s*=\s*60/);
    assert.match(service, /PUBLIC_DOCUMENT_BUCKET\s*=\s*"public-documents"/);
    assert.match(service, /PRIVATE_DOCUMENT_BUCKET\s*=\s*"private-documents"/);
    assert.match(service, /createSignedUrl\(record\.storagePath,\s*SIGNED_DOCUMENT_URL_EXPIRES_SECONDS\)/);
    assert.match(service, /getPublicUrl\(record\.storagePath\)/);
    assert.match(service, /document_access_logs/);
    assert.match(service, /access_type:\s*"signed_url_created"/);
    assert.match(service, /result:\s*"allowed"/);
    assert.match(service, /result:\s*"denied"/);
    assert.match(service, /invalid-input/);
    assert.match(service, /permission-denied/);
    assert.match(service, /documents-unavailable/);

    const downloadFunction = service.slice(service.indexOf("export async function createDocumentDownloadUrl"));

    assertOrdered(downloadFunction, [
      /\.rpc\("get_authorized_document_download_metadata"/,
      /return createPublicUrl\(record\)/,
      /return createSignedPrivateUrl\(record\)/,
    ]);
    assert.doesNotMatch(
      service,
      /error\.message|owner_display_name|account_number|public_payment_code|guest_email|guest_phone|stripe_checkout_session_id|stripe_payment_intent_id|SUPABASE_SERVICE_ROLE_KEY|SUPABASE_SECRET_KEY/i,
    );
  });

  it("adds a dynamic signed-url route with safe generic responses", () => {
    const routePath = "app/api/documents/[documentId]/signed-url/route.ts";

    assert.ok(existsSync(join(root, routePath)));

    const route = read(routePath);

    assert.match(route, /runtime\s*=\s*"nodejs"/);
    assert.match(route, /dynamic\s*=\s*"force-dynamic"/);
    assert.match(route, /export async function GET/);
    assert.match(route, /createDocumentDownloadUrl/);
    assert.match(route, /NextResponse\.json/);
    assert.match(route, /NextResponse\.redirect/);
    assert.match(route, /Cache-Control/);
    assert.match(route, /no-store/);
    assert.match(route, /invalid-request/);
    assert.match(route, /not-found/);
    assert.match(route, /documents-unavailable/);
    assert.match(route, /expiresInSeconds/);
    assert.doesNotMatch(route, /unauthorized/);
    assert.match(
      route,
      /permission-denied"[\s\S]*\|\|[\s\S]*result\.kind === "not-found"[\s\S]*failure\("not-found", "Document is unavailable\.", 404\)/,
    );
    assert.doesNotMatch(
      route,
      /storagePath|storageBucket|private-documents|public-documents|createServiceRoleClient|service-role|error\.message|relatedPropertyId|profileId|document_access_logs|account_number|owner_display_name|guest_email|guest_phone/i,
    );
  });

  it("wires document-ID based download actions into authorized listing pages only", () => {
    const publicPage = read("app/(public)/documents/page.tsx");
    const residentPage = read("app/(resident)/portal/(member)/documents/page.tsx");
    const adminPage = read("app/(admin)/admin/documents/page.tsx");

    for (const page of [publicPage, residentPage, adminPage]) {
      assert.match(page, /\/api\/documents\/\$\{record\.id\}\/signed-url\?redirect=1/);
      assert.doesNotMatch(
        page,
        /storagePath|storageBucket|private-documents|public-documents|createSignedUrl|signedUrl|createServiceRoleClient|service-role|admin\.documents\.manage|error\.message/i,
      );
    }
  });

  it("keeps download internals out of public, resident, guest, and client-facing surfaces", () => {
    const clientFacingFiles = readExisting([
      ...listFiles("app/(public)"),
      ...listFiles("app/(resident)"),
      ...listFiles("components/public"),
      ...listFiles("components/resident"),
      ...listFiles("lib/public"),
    ]);

    assert.doesNotMatch(
      clientFacingFiles,
      /document-download|createDocumentDownloadUrl|createServiceRoleClient|service-role|private-documents|public-documents|storageBucket|storagePath|createSignedUrl|signedUrl|SUPABASE_SERVICE_ROLE_KEY|SUPABASE_SECRET_KEY/i,
    );
  });
});
