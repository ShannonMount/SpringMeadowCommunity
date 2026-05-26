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

describe("authorized document listing and filtering", () => {
  it("keeps the list metadata RPC public-safe and bounded without aggregate leakage", () => {
    const migration = read(
      "supabase/migrations/202605110010_document_metadata_and_visibility_model.sql",
    );
    const listFunction = migration.match(
      /create or replace function public\.list_document_metadata[\s\S]*?\nend;\n\$\$/i,
    )?.[0];

    assert.ok(listFunction);
    assert.match(migration, /grant execute on function public\.list_document_metadata[\s\S]*to anon, authenticated/i);
    assert.match(listFunction, /app\.can_read_document\(documents\.id\)/);
    assert.match(listFunction, /filter_visibility/);
    assert.match(listFunction, /filter_category/);
    assert.match(listFunction, /filter_status/);
    assert.match(listFunction, /filter_related_property_id/);
    assert.match(listFunction, /filter_query/);
    assert.match(listFunction, /filter_effective_from/);
    assert.match(listFunction, /filter_expiration_to/);
    assert.match(listFunction, /bounded_limit := least\(greatest\(coalesce\(page_limit, 50\), 1\), 100\)/i);
    assert.match(listFunction, /bounded_offset := least\(greatest\(coalesce\(page_offset, 0\), 0\), 10000\)/i);
    assert.doesNotMatch(listFunction, /count\(\*\)|category_count|group by documents\.category|jsonb_object_agg/i);
  });

  it("renders public document metadata through public-only active filters without private leakage", () => {
    const pagePath = "app/(public)/documents/page.tsx";

    assert.ok(existsSync(join(root, pagePath)));

    const page = read(pagePath);

    assert.match(page, /listDocumentMetadata/);
    assert.match(page, /visibility:\s*"public"/);
    assert.match(page, /status:\s*"active"/);
    assert.match(page, /pageSize:\s*PUBLIC_DOCUMENT_PAGE_SIZE/);
    assert.match(page, /query:/);
    assert.match(page, /category:/);
    assert.match(page, /Public resources/);
    assert.match(page, /Document library/);
    assert.match(page, /name="query"/);
    assert.match(page, /name="category"/);
    assert.match(page, /aria-labelledby="document-library-heading"/);
    assert.match(page, /No public documents are available right now/);
    assert.match(page, /Document library is temporarily unavailable/);
    assert.match(page, /record\.title/);
    assert.match(page, /record\.category/);
    assert.match(page, /record\.contentType/);
    assert.match(page, /formatBytes\(record\.sizeBytes\)/);
    assert.match(page, /formatDateOnly\(record\.effectiveDate\)/);
    assert.match(page, /formatDateOnly\(record\.expirationDate\)/);
    assert.match(page, /new Set\(records\.map\(\(record\) => record\.category\)\)/);
    assert.doesNotMatch(
      page,
      /PlaceholderPage|storagePath|storageBucket|uploadedBy|createdBy|updatedBy|relatedPropertyId|relatedVendorId|private-documents|public-documents|signedUrl|createSignedUrl|admin\.documents\.manage|board\.documents\.view|createServiceRoleClient|service-role|error\.message|owner_display_name|account_number|public_payment_code|guest_email|guest_phone|private document count|private count/i,
    );
  });

  it("renders resident documents after membership gating with safe resident/property filters", () => {
    const pagePath = "app/(resident)/portal/(member)/documents/page.tsx";

    assert.ok(existsSync(join(root, pagePath)));

    const page = read(pagePath);

    assert.match(page, /getResidentPortalMemberships/);
    assert.match(page, /listDocumentMetadata/);
    assert.match(page, /membership\.membershipPermissions\.canViewDocuments/);
    assert.match(page, /documentMemberships/);
    assert.match(page, /authorizedPropertyIds/);
    assert.match(page, /selectedPropertyId/);
    assert.match(page, /relatedPropertyId:\s*selectedPropertyId/);
    assert.match(page, /name="propertyId"/);
    assert.match(page, /name="query"/);
    assert.match(page, /name="category"/);
    assert.match(page, /Resident documents/);
    assert.match(page, /Document access unavailable/);
    assert.match(page, /No documents are available for this view/);
    assert.match(page, /Document library is temporarily unavailable/);
    assert.match(page, /record\.title/);
    assert.match(page, /record\.category/);
    assert.match(page, /record\.visibility/);
    assert.match(page, /record\.relatedPropertyId/);
    assert.match(page, /formatBytes\(record\.sizeBytes\)/);
    assert.match(page, /formatDateOnly\(record\.expirationDate\)/);
    assert.match(page, /new Set\(records\.map\(\(record\) => record\.category\)\)/);
    assert.doesNotMatch(
      page,
      /document-upload|uploadDocument|uploadAdminDocument|admin\.documents\.manage|private-documents|public-documents|storagePath|storageBucket|signedUrl|createSignedUrl|createServiceRoleClient|service-role|owner_display_name|account_number|current_balance|payment history|raw propertyId|error\.message/i,
    );
  });

  it("extends the admin document page with authorized filters and pagination without leaking storage internals", () => {
    const pagePath = "app/(admin)/admin/documents/page.tsx";

    assert.ok(existsSync(join(root, pagePath)));

    const page = read(pagePath);

    assert.match(page, /uploadAdminDocument/);
    assert.match(page, /listDocumentMetadata/);
    assert.match(page, /parsePageOffset/);
    assert.match(page, /documentsHref/);
    assert.match(page, /visibility\?: string \| string\[\]/);
    assert.match(page, /status\?: string \| string\[\]/);
    assert.match(page, /category\?: string \| string\[\]/);
    assert.match(page, /query\?: string \| string\[\]/);
    assert.match(page, /effectiveFrom\?: string \| string\[\]/);
    assert.match(page, /expirationTo\?: string \| string\[\]/);
    assert.match(page, /pageOffset\?: string \| string\[\]/);
    assert.match(page, /name="visibility"/);
    assert.match(page, /name="status"/);
    assert.match(page, /name="category"/);
    assert.match(page, /name="query"/);
    assert.match(page, /name="effectiveFrom"/);
    assert.match(page, /name="expirationTo"/);
    assert.match(page, /Previous/);
    assert.match(page, /Next/);
    assert.match(page, /Document library is temporarily unavailable/);
    assert.match(page, /Check the document filters and try again/);
    assert.match(page, /record\.title/);
    assert.match(page, /record\.visibility/);
    assert.match(page, /record\.status/);
    assert.match(page, /formatBytes\(record\.sizeBytes\)/);
    assert.doesNotMatch(
      page,
      /storagePath|storageBucket|private-documents|public-documents|signedUrl|createSignedUrl|createServiceRoleClient|SERVICE_ROLE|SUPABASE_SECRET_KEY|SUPABASE_SERVICE_ROLE_KEY|error\.message|owner_display_name|account_number|public_payment_code|guest_email|guest_phone/i,
    );
  });

  it("keeps listing internals out of public, resident, guest, and client-facing surfaces", () => {
    const clientFacingFiles = readExisting([
      ...listFiles("app/(public)"),
      ...listFiles("app/(resident)"),
      ...listFiles("components/public"),
      ...listFiles("components/resident"),
      ...listFiles("lib/public"),
    ]);

    assert.doesNotMatch(
      clientFacingFiles,
      /document-upload|uploadDocument|uploadAdminDocument|createDocumentMetadata|updateDocumentMetadata|create_document_metadata|update_document_metadata|admin\.documents\.manage|createServiceRoleClient|service-role|private-documents|public-documents|storageBucket|storagePath|signedUrl|createSignedUrl|SERVICE_ROLE|SUPABASE_SERVICE_ROLE_KEY/i,
    );
  });
});
