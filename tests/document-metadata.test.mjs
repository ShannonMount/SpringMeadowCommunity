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

describe("document metadata and visibility model", () => {
  it("adds document visibility schema, tables, constraints, indexes, RLS, and role permissions", () => {
    const migrationPath =
      "supabase/migrations/202605110010_document_metadata_and_visibility_model.sql";

    assert.ok(existsSync(join(root, migrationPath)));

    const migration = read(migrationPath);

    assert.match(migration, /create type document_visibility as enum/i);
    assertOrdered(migration, [
      /'public'/,
      /'resident'/,
      /'board'/,
      /'vendor'/,
      /'property_specific'/,
      /'admin'/,
    ]);
    assert.match(migration, /admin\.documents\.manage/i);
    assert.match(migration, /board\.documents\.view/i);
    assert.match(migration, /where key = 'admin'/i);
    assert.match(migration, /where key in \('board_member', 'admin'\)/i);
    assert.doesNotMatch(migration, /where key = 'resident'[\s\S]*admin\.documents\.manage/i);
    assert.doesNotMatch(migration, /where key = 'approved_vendor'[\s\S]*admin\.documents\.manage/i);

    assert.match(migration, /create table if not exists public\.documents/i);
    assert.match(migration, /community_id uuid not null references public\.communities\(id\) on delete cascade/i);
    assert.match(migration, /title text not null/i);
    assert.match(migration, /description text/i);
    assert.match(migration, /category text not null/i);
    assert.match(migration, /visibility document_visibility not null/i);
    assert.match(migration, /related_property_id uuid references public\.properties\(id\)/i);
    assert.match(migration, /related_vendor_id uuid/i);
    assert.match(migration, /related_meeting_id uuid/i);
    assert.match(migration, /related_compliance_task_id uuid/i);
    assert.match(migration, /related_assessment_id uuid references public\.assessments\(id\)/i);
    assert.match(migration, /storage_provider text not null default 'supabase_storage'/i);
    assert.match(migration, /storage_bucket text not null/i);
    assert.match(migration, /storage_path text not null/i);
    assert.match(migration, /content_type text not null/i);
    assert.match(migration, /size_bytes bigint not null/i);
    assert.match(migration, /checksum text/i);
    assert.match(migration, /effective_date date/i);
    assert.match(migration, /expiration_date date/i);
    assert.match(migration, /status text not null default 'active'/i);
    assert.match(migration, /uploaded_by uuid not null references public\.profiles\(id\)/i);
    assert.match(migration, /created_by uuid not null references public\.profiles\(id\)/i);
    assert.match(migration, /updated_by uuid references public\.profiles\(id\)/i);
    assert.match(migration, /deleted_at timestamptz/i);
    assert.match(migration, /deleted_by uuid references public\.profiles\(id\)/i);

    assert.match(migration, /documents_title_check/i);
    assert.match(migration, /documents_category_check/i);
    assert.match(migration, /documents_storage_bucket_check/i);
    assert.match(migration, /documents_content_type_check/i);
    assert.match(migration, /documents_storage_path_check/i);
    assert.match(migration, /left\(storage_path, 1\) <> '\/'/i);
    assert.match(migration, /position\(chr\(92\) in storage_path\) = 0/i);
    assert.match(migration, /storage_path !~ '\(\^\|\/\)\\\.\\\.\(\/\|\$\)'/i);
    assert.match(migration, /documents_size_bytes_check check \(size_bytes > 0\)/i);
    assert.match(migration, /documents_date_range_check/i);
    assert.match(migration, /expiration_date >= effective_date/i);
    assert.match(migration, /documents_property_specific_check/i);
    assert.match(migration, /visibility <> 'property_specific'::document_visibility/i);
    assert.match(migration, /related_property_id is not null/i);
    assert.match(migration, /status in \('active', 'archived', 'deleted'\)/i);

    assert.match(migration, /create table if not exists public\.document_access_logs/i);
    assert.match(migration, /document_id uuid not null references public\.documents\(id\) on delete cascade/i);
    assert.match(migration, /access_type text not null check \(access_type in \('view', 'download', 'signed_url_created'\)\)/i);
    assert.match(migration, /result text not null check \(result in \('allowed', 'denied'\)\)/i);

    for (const indexName of [
      "documents_community_visibility_category_status_idx",
      "documents_community_status_date_idx",
      "documents_property_specific_lookup_idx",
      "documents_assessment_lookup_idx",
      "documents_vendor_lookup_idx",
      "documents_meeting_lookup_idx",
      "documents_compliance_lookup_idx",
      "documents_effective_date_idx",
      "documents_expiration_date_idx",
      "documents_storage_path_unique_idx",
      "document_access_logs_document_history_idx",
      "document_access_logs_profile_history_idx",
    ]) {
      assert.match(migration, new RegExp(indexName, "i"));
    }

    assert.match(migration, /create unique index if not exists documents_storage_path_unique_idx/i);
    assert.match(migration, /where deleted_at is null/i);
    assert.match(migration, /alter table public\.documents enable row level security/i);
    assert.match(migration, /alter table public\.document_access_logs enable row level security/i);
    assert.match(migration, /revoke all on public\.documents from anon, authenticated/i);
    assert.match(migration, /revoke all on public\.document_access_logs from anon, authenticated/i);
    assert.match(migration, /create policy "read authorized document metadata"/i);
    assert.match(migration, /using \(app\.can_read_document\(id\)\)/i);
  });

  it("validates property-specific scope and same-community assessment relationships in SQL", () => {
    const migration = read(
      "supabase/migrations/202605110010_document_metadata_and_visibility_model.sql",
    );

    assert.match(migration, /create or replace function public\.validate_document_metadata_scope/i);
    assert.match(migration, /security definer/i);
    assert.match(migration, /set search_path = public/i);
    assert.match(migration, /new\.visibility = 'property_specific'::document_visibility/i);
    assert.match(migration, /new\.related_property_id is null/i);
    assert.match(migration, /property-specific documents require a related property/i);
    assert.match(migration, /from public\.properties/i);
    assert.match(migration, /properties\.community_id/i);
    assert.match(migration, /property_community_id <> new\.community_id/i);
    assert.match(migration, /document property scope mismatch/i);
    assert.match(migration, /from public\.assessments/i);
    assert.match(migration, /assessments\.community_id, assessments\.property_id/i);
    assert.match(migration, /assessment_community_id <> new\.community_id/i);
    assert.match(migration, /assessment_record\.property_id <> target_related_property_id/i);
    assert.match(migration, /assessment_record\.property_id <> new_related_property_id/i);
    assert.match(migration, /document assessment property mismatch/i);
    assert.match(migration, /execute function public\.validate_document_metadata_scope/i);
  });

  it("implements deterministic read authorization and permission-checked metadata RPCs", () => {
    const migration = read(
      "supabase/migrations/202605110010_document_metadata_and_visibility_model.sql",
    );

    assert.match(migration, /create or replace function app\.can_read_document\(target_document_id uuid\)/i);
    assert.match(migration, /security definer/i);
    assert.match(migration, /set search_path = public, app/i);
    assert.match(migration, /document_record\.status <> 'active'/i);
    assert.match(migration, /document_record\.deleted_at is not null/i);
    assert.match(migration, /document_record\.effective_date > current_date/i);
    assert.match(migration, /document_record\.expiration_date < current_date/i);
    assert.match(migration, /document_record\.visibility = 'public'::document_visibility[\s\S]*return true/i);
    assert.match(migration, /actor_profile_id := app\.current_profile_id\(\)/i);
    assert.match(migration, /app\.has_permission\(document_record\.community_id, 'admin\.documents\.manage'\)/i);
    assert.match(migration, /document_record\.visibility = 'board'::document_visibility/i);
    assert.match(migration, /app\.has_permission\(document_record\.community_id, 'board\.documents\.view'\)/i);
    assert.match(migration, /document_record\.visibility = 'admin'::document_visibility[\s\S]*return false/i);
    assert.match(migration, /document_record\.visibility = 'vendor'::document_visibility[\s\S]*return false/i);
    assert.match(migration, /document_record\.visibility = 'resident'::document_visibility/i);
    assert.match(migration, /pm\.can_view_documents = true/i);
    assert.match(migration, /document_record\.visibility = 'property_specific'::document_visibility/i);
    assert.match(migration, /pm\.property_id = document_record\.related_property_id/i);

    for (const functionName of ["create_document_metadata", "update_document_metadata"]) {
      assert.match(migration, new RegExp(`create or replace function public\\.${functionName}`, "i"));
      assert.match(migration, new RegExp(`revoke all on function public\\.${functionName}`, "i"));
      assert.match(migration, new RegExp(`grant execute on function public\\.${functionName}[\\s\\S]*to authenticated`, "i"));
    }

    assert.match(migration, /create or replace function public\.list_document_metadata/i);
    assert.match(migration, /revoke all on function public\.list_document_metadata/i);
    assert.match(migration, /grant execute on function public\.list_document_metadata[\s\S]*to anon, authenticated/i);
    assert.match(
      migration,
      /revoke all on function public\.update_document_metadata\([\s\S]*text,\s*boolean,\s*boolean,\s*boolean,\s*boolean,\s*boolean,\s*boolean,\s*boolean,\s*boolean,\s*boolean\s*\) from public, anon/i,
    );
    assert.match(
      migration,
      /grant execute on function public\.update_document_metadata\([\s\S]*text,\s*boolean,\s*boolean,\s*boolean,\s*boolean,\s*boolean,\s*boolean,\s*boolean,\s*boolean,\s*boolean\s*\) to authenticated/i,
    );
    assert.doesNotMatch(
      migration,
      /actor_profile_id is null[\s\S]{0,120}return jsonb_build_object\('status', 'permission_denied'\)[\s\S]{0,120}filter_visibility/i,
    );
    assert.match(migration, /app\.has_permission\(target_community_id, 'admin\.documents\.manage'\)/i);
    assert.match(migration, /return jsonb_build_object\('status', 'permission_denied'\)/i);
    assert.match(migration, /return jsonb_build_object\('status', 'invalid'\)/i);
    assert.match(migration, /insert into public\.documents/i);
    assert.match(migration, /update public\.documents/i);
    assert.match(migration, /app\.can_read_document\(documents\.id\)/i);
    assert.match(
      migration,
      /manager_can_list := actor_profile_id is not null\s+and app\.has_permission\(target_community_id, 'admin\.documents\.manage'\)/i,
    );
    assert.match(migration, /jsonb_agg\(\s*app\.document_metadata_json\(filtered_documents\)/i);
    assert.match(migration, /replace\(btrim\(coalesce\(filter_query, ''\)\), chr\(92\), chr\(92\) \|\| chr\(92\)\)/i);
    assert.match(migration, /ilike '%' \|\| search_query \|\| '%' escape chr\(92\)/i);
    assert.match(migration, /insert into public\.audit_logs/i);
    assert.match(migration, /document\.metadata\.create/i);
    assert.match(migration, /document\.metadata\.visibility_or_status_change/i);
  });

  it("returns only the narrow safe metadata contract from SQL helpers", () => {
    const migration = read(
      "supabase/migrations/202605110010_document_metadata_and_visibility_model.sql",
    );

    assert.match(migration, /create or replace function app\.document_metadata_json/i);

    for (const key of [
      "id",
      "community_id",
      "title",
      "description",
      "category",
      "visibility",
      "status",
      "related_property_id",
      "related_vendor_id",
      "related_meeting_id",
      "related_compliance_task_id",
      "related_assessment_id",
      "storage_provider",
      "storage_bucket",
      "storage_path",
      "content_type",
      "size_bytes",
      "checksum",
      "effective_date",
      "expiration_date",
      "uploaded_by",
      "created_by",
      "updated_by",
      "created_at",
      "updated_at",
    ]) {
      assert.match(migration, new RegExp(`'${key}'`));
    }

    assert.doesNotMatch(
      migration,
      /owner_display_name|account_number|public_payment_code|guest_email|guest_phone|stripe_checkout_session_id|stripe_payment_intent_id|stripe_charge_id|raw_lookup|service_role|SERVICE_ROLE|SUPABASE_SERVICE_ROLE_KEY|STRIPE_SECRET_KEY|RESEND_API_KEY/i,
    );
  });

  it("implements a server-only document metadata service with validation and user-scoped RPC calls", () => {
    const servicePath = "server/services/documents/document-metadata.ts";

    assert.ok(existsSync(join(root, servicePath)));

    const service = read(servicePath);

    assert.match(service, /import "server-only"/);
    assert.match(service, /createClient/);
    assert.doesNotMatch(service, /getCurrentProfile/);
    assert.match(service, /hasPermission/);
    assert.match(service, /PERMISSION_DENIED_MESSAGE/);
    assert.match(service, /PROFILE_UNAVAILABLE_MESSAGE/);
    assert.match(service, /admin\.documents\.manage/);
    assert.match(service, /DocumentVisibility/);
    assert.match(service, /DocumentStatus/);
    assert.match(service, /DocumentMetadataRecord/);
    assert.match(service, /createDocumentMetadata/);
    assert.match(service, /updateDocumentMetadata/);
    assert.match(service, /listDocumentMetadata/);
    assert.match(service, /\.rpc\("create_document_metadata"/);
    assert.match(service, /\.rpc\("update_document_metadata"/);
    assert.match(service, /\.rpc\("list_document_metadata"/);
    assert.match(service, /invalid-input/);
    assert.match(service, /documents-unavailable/);
    assert.match(service, /permission-denied/);
    assert.match(service, /profile-unavailable/);
    assert.match(service, /unauthenticated/);
    assert.match(service, /isUuid/);
    assert.match(service, /isValidDateOnly/);
    assert.match(service, /isPositiveInteger/);
    assert.match(service, /isNonNegativeInteger/);
    assert.match(service, /CHECKSUM_PATTERN/);
    assert.match(service, /hasUnsafeStoragePathSegment/);
    assert.match(service, /startsWith\("\/"\)/);
    assert.match(service, /includes\("\\\\"\)/);
    assert.match(service, /segment === "\.\."/);
    assert.match(service, /MAX_PAGE_SIZE = 100/);
    assert.match(service, /MAX_PAGE_OFFSET = 10000/);
    assert.match(service, /MAX_QUERY_LENGTH = 200/);
    assert.match(service, /MAX_TITLE_LENGTH = 200/);
    assert.match(service, /MAX_STORAGE_PATH_LENGTH = 1024/);
    assert.match(service, /Math\.min\(Math\.max\(Number\(value\), 0\), MAX_PAGE_OFFSET\)/);
    assert.match(service, /filter_effective_from: optionalString\(input\.effectiveFrom\)/);
    assert.match(service, /filter_expiration_to: optionalString\(input\.expirationTo\)/);
    assert.match(service, /document_storage_path: safeString\(input\.storagePath\)/);
    assert.match(service, /target_related_assessment_id: optionalString\(input\.relatedAssessmentId\)/);
    assert.match(service, /clearDescription\?: boolean \| null/);
    assert.match(service, /shouldClearOptionalString/);
    assert.match(service, /clear_description: shouldClearOptionalString\(input\.description, input\.clearDescription\)/);
    assert.match(service, /clear_related_property_id: shouldClearOptionalString/);
    assert.match(service, /clear_related_assessment_id: shouldClearOptionalString/);
    assert.match(service, /clear_effective_date: shouldClearOptionalString/);
    assert.match(service, /clear_expiration_date: shouldClearOptionalString/);

    assertOrdered(service, [
      /resolveCommunity/,
      /validateCreateInput/,
      /requireDocumentManagementPermission/,
      /\.rpc\("create_document_metadata"/,
    ]);

    assert.doesNotMatch(
      service,
      /createServiceRoleClient|service-role|from "stripe"|from "resend"|guest-payment|payment-receipt|stripe-webhook-processing|public_payment_code|owner_display_name|account_number|guest_email|guest_phone|error\.message|signedUrl|createSignedUrl|SERVICE_ROLE|SUPABASE_SECRET_KEY|SUPABASE_SERVICE_ROLE_KEY|STRIPE_SECRET_KEY|RESEND_API_KEY/i,
    );
  });

  it("keeps 4.1 scoped to metadata and out of public, resident, guest, and client-facing surfaces", () => {
    const migration = read(
      "supabase/migrations/202605110010_document_metadata_and_visibility_model.sql",
    );
    const service = read("server/services/documents/document-metadata.ts");
    const combinedServerWork = `${migration}\n${service}`;
    const documentListingPagePaths = [
      "app/(public)/documents/page.tsx",
      "app/(resident)/portal/(member)/documents/page.tsx",
    ];
    const clientFacingFiles = readExisting([
      ...listFiles("app/(public)"),
      ...listFiles("app/(resident)"),
      ...listFiles("components/public"),
      ...listFiles("components/resident"),
      ...listFiles("lib/public"),
    ].filter((path) => !documentListingPagePaths.includes(path)));
    const documentListingPages = readExisting(documentListingPagePaths);

    assert.doesNotMatch(
      combinedServerWork,
      /storage\.buckets|storage\.objects|createSignedUrl|signedUrl|downloadTo|upload\(|private-documents|public-documents|create bucket|insert into storage/i,
    );
    assert.doesNotMatch(
      combinedServerWork,
      /create table if not exists public\.(vendors|meetings|compliance_calendar_events|records_requests|legal_workflows|announcements|events|message_threads|messages)/i,
    );
    assert.doesNotMatch(
      clientFacingFiles,
      /document-metadata|createDocumentMetadata|updateDocumentMetadata|listDocumentMetadata|create_document_metadata|update_document_metadata|list_document_metadata|admin\.documents\.manage|board\.documents\.view|storage_path|storage_bucket|private-documents|signedUrl|SERVICE_ROLE|SUPABASE_SERVICE_ROLE_KEY/i,
    );
    assert.match(documentListingPages, /listDocumentMetadata/);
    assert.doesNotMatch(
      documentListingPages,
      /createDocumentMetadata|updateDocumentMetadata|create_document_metadata|update_document_metadata|admin\.documents\.manage|board\.documents\.view|storage_path|storage_bucket|private-documents|signedUrl|SERVICE_ROLE|SUPABASE_SERVICE_ROLE_KEY/i,
    );
  });
});
