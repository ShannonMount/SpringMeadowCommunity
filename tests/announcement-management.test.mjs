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

describe("announcement management and display", () => {
  it("adds announcement schema, permissions, RLS, safe RPCs, and audit-ready mutations", () => {
    const migrationPath = "supabase/migrations/202605110013_announcement_management_and_display.sql";

    assert.ok(existsSync(join(root, migrationPath)));

    const migration = read(migrationPath);

    assert.match(migration, /create type announcement_visibility as enum/i);
    assert.match(migration, /'public'[\s\S]*'resident'[\s\S]*'board'[\s\S]*'property_specific'[\s\S]*'admin'/i);
    assert.match(migration, /create type announcement_status as enum/i);
    assert.match(migration, /create table if not exists public\.announcements/i);
    assert.match(migration, /property_ids uuid\[\] not null default '\{\}'/i);
    assert.match(migration, /attachment_document_ids uuid\[\] not null default '\{\}'/i);
    assert.match(migration, /announcements_feed_idx/i);
    assert.match(migration, /announcements_property_gin_idx/i);
    assert.match(migration, /alter table public\.announcements enable row level security/i);
    assert.match(migration, /revoke all on public\.announcements from anon, authenticated/i);
    assert.match(migration, /admin\.announcements\.manage/i);
    assert.match(migration, /create or replace function app\.can_read_announcement/i);
    assert.match(migration, /visibility = 'public'::announcement_visibility/i);
    assert.match(migration, /visibility = 'resident'::announcement_visibility/i);
    assert.match(migration, /visibility = 'property_specific'::announcement_visibility/i);
    assert.match(migration, /pm\.property_id = any\(announcement_record\.property_ids\)/i);
    assert.match(migration, /app\.has_permission\(announcement_record\.community_id, 'admin\.announcements\.manage'\)/i);
    assert.match(migration, /create or replace function public\.list_announcements/i);
    assert.match(migration, /create or replace function public\.create_announcement/i);
    assert.match(migration, /create or replace function public\.update_announcement/i);
    assert.match(migration, /create or replace function public\.publish_announcement/i);
    assert.match(migration, /create or replace function public\.expire_announcement/i);
    assert.match(migration, /create or replace function public\.archive_announcement/i);
    assert.match(migration, /insert into public\.audit_logs/i);
    assert.match(migration, /actor_profile_id := app\.current_profile_id\(\);[\s\S]*manager_can_list := app\.has_permission/i);
    assert.match(
      migration,
      /filter_property_id = any\(announcements\.property_ids\)[\s\S]*manager_can_list = true[\s\S]*pm\.property_id = filter_property_id[\s\S]*pm\.profile_id = actor_profile_id/i,
    );
    assert.match(migration, /effective_publish_at := coalesce\(announcement_publish_at, now\(\)\)/i);
    assert.match(migration, /announcement_expires_at <= effective_publish_at/i);
    assert.doesNotMatch(migration, /announcement_expires_at <= announcement_publish_at/i);
    assert.match(
      migration,
      /when app\.has_permission\(\(\$1\)\.community_id, 'admin\.announcements\.manage'\) then \(\$1\)\.property_ids/i,
    );
    assert.match(migration, /exception\s+when others then null/i);
    assert.match(migration, /app\.can_read_document\(documents\.id\)/i);
    assert.match(migration, /documents\.id = any\(announcement_record\.attachment_document_ids\)/i);
    assert.match(migration, /grant execute on function public\.list_announcements/i);
    assert.doesNotMatch(
      migration,
      /grant (select|insert|update|delete|all) on public\.announcements to (anon|authenticated)/i,
    );
    assert.doesNotMatch(migration, /storage_bucket|storage_path|owner_display_name|account_number|public_payment_code/i);
  });

  it("implements a server-only announcement service with safe unions and user-scoped RPC calls", () => {
    const servicePath = "server/services/announcements/announcement-management.ts";

    assert.ok(existsSync(join(root, servicePath)));

    const service = read(servicePath);

    assert.match(service, /import "server-only"/);
    assert.match(service, /createClient/);
    assert.match(service, /getCurrentProfile/);
    assert.match(service, /list_announcements/);
    assert.match(service, /create_announcement/);
    assert.match(service, /update_announcement/);
    assert.match(service, /publish_announcement/);
    assert.match(service, /expire_announcement/);
    assert.match(service, /archive_announcement/);
    assert.match(service, /AnnouncementVisibility/);
    assert.match(service, /AnnouncementStatus/);
    assert.match(service, /unauthenticated/);
    assert.match(service, /profile-unavailable/);
    assert.match(service, /invalid-input/);
    assert.match(service, /permission-denied/);
    assert.match(service, /announcements-unavailable/);
    assert.match(service, /attachmentDocumentIds/);
    assert.match(service, /propertyIds/);
    assert.match(service, /MAX_TITLE_LENGTH/);
    assert.match(service, /MAX_BODY_LENGTH/);

    const listFunction = service.slice(service.indexOf("export async function listAnnouncements"));
    assertOrdered(listFunction, [/validateListInput/, /\.rpc\("list_announcements"/]);

    assert.doesNotMatch(
      service,
      /writeAuditLog|createServiceRoleClient|SUPABASE_SERVICE_ROLE_KEY|SUPABASE_SECRET_KEY|storagePath|storageBucket|error\.message|owner_display_name|account_number|public_payment_code|guest_email|guest_phone|stripe_/i,
    );
  });

  it("adds safe admin actions and an announcement management page", () => {
    const actionsPath = "server/actions/announcements.ts";
    const pagePath = "app/(admin)/admin/announcements/page.tsx";

    assert.ok(existsSync(join(root, actionsPath)));
    assert.ok(existsSync(join(root, pagePath)));
    assert.ok(!existsSync(join(root, "lib/public/announcements.ts")));

    const actions = read(actionsPath);
    const page = read(pagePath);

    assert.match(actions, /"use server"/);
    assert.match(actions, /createAdminAnnouncement/);
    assert.match(actions, /updateAdminAnnouncement/);
    assert.match(actions, /publishAdminAnnouncement/);
    assert.match(actions, /expireAdminAnnouncement/);
    assert.match(actions, /archiveAdminAnnouncement/);
    assert.match(actions, /FormData/);
    assert.match(actions, /redirect\(/);
    assert.match(actions, /announcementField/);
    assert.match(actions, /attachmentDocumentIds/);
    assert.match(actions, /propertyIds/);
    assert.match(actions, /dateTimeLocalToNewYorkIso/);
    assert.match(actions, /timeZone:\s*"America\/New_York"/);
    assert.match(actions, /dateTimePartsMatch/);
    assert.match(actions, /getNewYorkDateTimeParts\(instantDate\), localParts/);

    assert.match(page, /Announcement management/);
    assert.match(page, /createAdminAnnouncement/);
    assert.match(page, /updateAdminAnnouncement/);
    assert.match(page, /publishAdminAnnouncement/);
    assert.match(page, /expireAdminAnnouncement/);
    assert.match(page, /archiveAdminAnnouncement/);
    assert.match(page, /listAnnouncements/);
    assert.match(page, /name="title"/);
    assert.match(page, /name="body"/);
    assert.match(page, /name="visibility"/);
    assert.match(page, /name="publishAt"/);
    assert.match(page, /name="expiresAt"/);
    assert.match(page, /name="pinned"/);
    assert.match(page, /name="status"/);
    assert.match(page, /name="attachmentDocumentIds"/);
    assert.match(page, /name="propertyIds"/);
    assert.match(page, /formatToParts\(date\)/);
    assert.doesNotMatch(page, /toISOString\(\)\.slice\(0, 16\)/);
    assert.doesNotMatch(page, /Private resident,[\s\S]*property,[\s\S]*board/i);

    assert.doesNotMatch(
      `${actions}\n${page}`,
      /error\.message|storagePath|storageBucket|private-documents|public-documents|createServiceRoleClient|service-role|SUPABASE_SERVICE_ROLE_KEY|owner_display_name|account_number|public_payment_code|stripe_/i,
    );
  });

  it("renders public and resident announcements from authorized service results only", () => {
    const publicPage = read("app/(public)/announcements/page.tsx");
    const residentPage = read("app/(resident)/portal/(member)/announcements/page.tsx");
    const dashboardService = read("server/services/auth/resident-dashboard.ts");
    const dashboardContent = existsSync(join(root, "lib/resident/dashboard-content.ts"))
      ? read("lib/resident/dashboard-content.ts")
      : "";

    assert.match(publicPage, /listAnnouncements/);
    assert.match(publicPage, /visibility:\s*"public"/);
    assert.match(publicPage, /status:\s*"published"/);
    assert.match(publicPage, /\/api\/documents\/\$\{attachment\.documentId\}\/signed-url\?redirect=1/);
    assert.doesNotMatch(publicPage, /getVisiblePublicAnnouncements|publicAnnouncements/);

    assert.match(residentPage, /getResidentPortalMemberships/);
    assert.match(residentPage, /listAnnouncements/);
    assert.match(residentPage, /visibility:\s*"resident"/);
    assert.match(residentPage, /visibility:\s*"property_specific"/);
    assert.match(residentPage, /propertyIds\.map\(\(propertyId\)/);
    assert.match(residentPage, /propertyId,/);
    assert.doesNotMatch(residentPage, /record\.propertyIds\.some|activePropertyIds/);
    assert.match(residentPage, /\/api\/documents\/\$\{attachment\.documentId\}\/signed-url\?redirect=1/);

    assert.match(dashboardService, /listAnnouncements/);
    assert.match(dashboardService, /propertyIds\.map\(\(propertyId\)/);
    assert.doesNotMatch(dashboardService, /record\.propertyIds\.some|activePropertyIds/);
    assert.match(dashboardService, /announcements:/);
    assert.doesNotMatch(dashboardService, /getDashboardEvents/);
    assert.doesNotMatch(dashboardContent, /publicAnnouncements|getDashboardAnnouncements/);

    assert.doesNotMatch(
      `${publicPage}\n${residentPage}\n${dashboardService}`,
      /storagePath|storageBucket|private-documents|public-documents|createServiceRoleClient|service-role|owner_display_name|account_number|public_payment_code|guest_email|guest_phone|stripe_|audit_logs|error\.message/i,
    );
  });

  it("keeps announcement internals out of public, resident, guest, and client-facing surfaces", () => {
    const clientFacingFiles = readExisting([
      ...listFiles("app/(public)"),
      ...listFiles("app/(resident)"),
      ...listFiles("components/public"),
      ...listFiles("components/resident"),
      ...listFiles("lib/public"),
    ]);

    assert.doesNotMatch(
      clientFacingFiles,
      /createServiceRoleClient|service-role|SUPABASE_SERVICE_ROLE_KEY|SUPABASE_SECRET_KEY|storageBucket|storagePath|private-documents|public-documents|audit_logs|admin\.announcements\.manage|owner_display_name|account_number|public_payment_code|guest_email|guest_phone|stripe_/i,
    );
  });
});
