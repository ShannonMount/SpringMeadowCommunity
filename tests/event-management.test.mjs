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

describe("event management and calendar display", () => {
  it("adds event schema, permissions, RLS, safe RPCs, and audit-ready mutations", () => {
    const migrationPath = "supabase/migrations/202605110014_event_management_and_calendar_display.sql";

    assert.ok(existsSync(join(root, migrationPath)));

    const migration = read(migrationPath);

    assert.match(migration, /create type event_visibility as enum/i);
    assert.match(migration, /'public'[\s\S]*'resident'[\s\S]*'board'[\s\S]*'admin'/i);
    assert.match(migration, /create type event_status as enum/i);
    assert.match(migration, /'scheduled'[\s\S]*'cancelled'[\s\S]*'completed'[\s\S]*'archived'/i);
    assert.match(migration, /create type event_type as enum/i);
    assert.match(
      migration,
      /'hoa_meeting'[\s\S]*'board_meeting'[\s\S]*'community_event'[\s\S]*'pool'[\s\S]*'maintenance_window'[\s\S]*'dues_deadline'[\s\S]*'other'/i,
    );
    assert.match(migration, /create table if not exists public\.events/i);
    assert.match(migration, /related_meeting_id uuid/i);
    assert.match(migration, /related_compliance_event_id uuid/i);
    assert.doesNotMatch(migration, /related_meeting_id uuid references/i);
    assert.doesNotMatch(migration, /related_compliance_event_id uuid references/i);
    assert.match(migration, /events_calendar_idx/i);
    assert.match(migration, /events_type_idx/i);
    assert.match(migration, /events_status_idx/i);
    assert.match(migration, /alter table public\.events enable row level security/i);
    assert.match(migration, /revoke all on public\.events from anon, authenticated/i);
    assert.match(migration, /admin\.events\.manage/i);
    assert.match(migration, /create or replace function app\.can_read_event/i);
    assert.match(migration, /visibility = 'public'::event_visibility/i);
    assert.match(migration, /visibility = 'resident'::event_visibility/i);
    assert.match(migration, /status = 'archived'::event_status/i);
    assert.match(migration, /app\.has_permission\(event_record\.community_id, 'admin\.events\.manage'\)/i);
    assert.match(migration, /create or replace function public\.list_events/i);
    assert.match(migration, /create or replace function public\.create_event/i);
    assert.match(migration, /create or replace function public\.update_event/i);
    assert.match(migration, /create or replace function public\.cancel_event/i);
    assert.match(migration, /create or replace function public\.archive_event/i);
    assert.match(migration, /insert into public\.audit_logs/i);
    assert.match(migration, /exception\s+when others then null/i);
    assert.match(
      migration,
      /when app\.has_permission\(\(\$1\)\.community_id, 'admin\.events\.manage'\) then \(\$1\)\.related_meeting_id/i,
    );
    assert.match(migration, /grant execute on function public\.list_events/i);
    assert.doesNotMatch(
      migration,
      /grant (select|insert|update|delete|all) on public\.events to (anon|authenticated)/i,
    );
    assert.doesNotMatch(
      migration,
      /storage_bucket|storage_path|owner_display_name|account_number|public_payment_code|stripe_|resend/i,
    );
  });

  it("implements a server-only event service with safe unions and user-scoped RPC calls", () => {
    const servicePath = "server/services/events/event-management.ts";

    assert.ok(existsSync(join(root, servicePath)));

    const service = read(servicePath);

    assert.match(service, /import "server-only"/);
    assert.match(service, /createClient/);
    assert.match(service, /getCurrentProfile/);
    assert.match(service, /list_events/);
    assert.match(service, /create_event/);
    assert.match(service, /update_event/);
    assert.match(service, /cancel_event/);
    assert.match(service, /archive_event/);
    assert.match(service, /EventVisibility/);
    assert.match(service, /EventStatus/);
    assert.match(service, /EventType/);
    assert.match(service, /unauthenticated/);
    assert.match(service, /profile-unavailable/);
    assert.match(service, /invalid-input/);
    assert.match(service, /permission-denied/);
    assert.match(service, /events-unavailable/);
    assert.match(service, /relatedMeetingId/);
    assert.match(service, /relatedComplianceEventId/);
    assert.match(service, /MAX_TITLE_LENGTH/);
    assert.match(service, /MAX_DESCRIPTION_LENGTH/);

    const listFunction = service.slice(service.indexOf("export async function listEvents"));
    assertOrdered(listFunction, [/validateListInput/, /\.rpc\("list_events"/]);

    const createFunction = service.slice(service.indexOf("export async function createEvent"));
    assertOrdered(createFunction, [/validateMutationInput/, /requireActiveProfile/, /\.rpc\("create_event"/]);

    assert.doesNotMatch(
      service,
      /writeAuditLog|createServiceRoleClient|SUPABASE_SERVICE_ROLE_KEY|SUPABASE_SECRET_KEY|storagePath|storageBucket|error\.message|owner_display_name|account_number|public_payment_code|guest_email|guest_phone|stripe_|resend/i,
    );
  });

  it("adds safe admin actions and an event management page", () => {
    const actionsPath = "server/actions/events.ts";
    const pagePath = "app/(admin)/admin/events/page.tsx";

    assert.ok(existsSync(join(root, actionsPath)));
    assert.ok(existsSync(join(root, pagePath)));

    const actions = read(actionsPath);
    const page = read(pagePath);

    assert.match(actions, /"use server"/);
    assert.match(actions, /createAdminEvent/);
    assert.match(actions, /updateAdminEvent/);
    assert.match(actions, /cancelAdminEvent/);
    assert.match(actions, /archiveAdminEvent/);
    assert.match(actions, /FormData/);
    assert.match(actions, /redirect\(/);
    assert.match(actions, /eventField/);
    assert.match(actions, /relatedMeetingId/);
    assert.match(actions, /relatedComplianceEventId/);
    assert.match(actions, /dateTimeLocalToNewYorkIso/);
    assert.match(actions, /timeZone:\s*"America\/New_York"/);

    assert.match(page, /Event management/);
    assert.match(page, /createAdminEvent/);
    assert.match(page, /updateAdminEvent/);
    assert.match(page, /cancelAdminEvent/);
    assert.match(page, /archiveAdminEvent/);
    assert.match(page, /listEvents/);
    assert.match(page, /name="title"/);
    assert.match(page, /name="description"/);
    assert.match(page, /name="type"/);
    assert.match(page, /name="visibility"/);
    assert.match(page, /name="startsAt"/);
    assert.match(page, /name="endsAt"/);
    assert.match(page, /name="allDay"/);
    assert.match(page, /name="location"/);
    assert.match(page, /name="status"/);
    assert.match(page, /name="relatedMeetingId"/);
    assert.match(page, /name="relatedComplianceEventId"/);
    assert.match(page, /formatToParts\(date\)/);
    assert.match(page, /dateTimeLocalToNewYorkIso/);
    assert.match(page, /eventFilterDateTimeValue/);
    assert.match(page, /const startsFromFilter = eventFilterDateTimeValue\(startsFrom\)/);
    assert.match(page, /startsFrom: startsFromFilter/);
    assert.doesNotMatch(page, /toISOString\(\)\.slice\(0, 16\)/);

    assert.doesNotMatch(
      `${actions}\n${page}`,
      /error\.message|storagePath|storageBucket|private-documents|public-documents|createServiceRoleClient|service-role|SUPABASE_SERVICE_ROLE_KEY|owner_display_name|account_number|public_payment_code|stripe_|resend/i,
    );
  });

  it("renders public and resident events from authorized service results only", () => {
    const publicPage = read("app/(public)/events/page.tsx");
    const residentPage = read("app/(resident)/portal/(member)/events/page.tsx");
    const dashboardService = read("server/services/auth/resident-dashboard.ts");
    const dashboardContent = existsSync(join(root, "lib/resident/dashboard-content.ts"))
      ? read("lib/resident/dashboard-content.ts")
      : "";

    assert.match(publicPage, /listEvents/);
    assert.match(publicPage, /visibility:\s*"public"/);
    assert.match(publicPage, /includeArchived:\s*false/);
    assert.match(publicPage, /eventEmptyState/);
    assert.match(publicPage, /formatEventDate/);
    assert.match(publicPage, /formatEventTimeRange/);
    assert.match(publicPage, /getEventStatusLabel/);
    assert.match(publicPage, /<time dateTime=\{event\.startsAt\}/);
    assert.doesNotMatch(publicPage, /getVisiblePublicEvents|publicEvents/);

    assert.match(residentPage, /getResidentPortalMemberships/);
    assert.match(residentPage, /listEvents/);
    assert.match(residentPage, /visibility:\s*"public"/);
    assert.match(residentPage, /visibility:\s*"resident"/);
    assert.match(residentPage, /includeArchived:\s*false/);
    assert.match(residentPage, /upcomingOnly:\s*true/);
    assert.doesNotMatch(residentPage, /visibility:\s*"board"|visibility:\s*"admin"/);

    assert.match(dashboardService, /listEvents/);
    assert.match(dashboardService, /visibility:\s*"public"/);
    assert.match(dashboardService, /visibility:\s*"resident"/);
    assert.match(dashboardService, /upcomingOnly:\s*true/);
    assert.match(dashboardService, /DASHBOARD_EVENT_LIMIT/);
    assert.doesNotMatch(dashboardService, /getDashboardEvents|publicEvents/);
    assert.doesNotMatch(dashboardContent, /publicEvents|getDashboardEvents/);

    assert.doesNotMatch(
      `${publicPage}\n${residentPage}\n${dashboardService}`,
      /storagePath|storageBucket|private-documents|public-documents|createServiceRoleClient|service-role|owner_display_name|account_number|public_payment_code|guest_email|guest_phone|stripe_|audit_logs|error\.message|related_meeting_id|related_compliance_event_id/i,
    );
  });

  it("keeps event internals out of public, resident, guest, and client-facing surfaces", () => {
    const clientFacingFiles = readExisting([
      ...listFiles("app/(public)"),
      ...listFiles("app/(resident)"),
      ...listFiles("components/public"),
      ...listFiles("components/resident"),
      ...listFiles("lib/public"),
    ]);

    assert.doesNotMatch(
      clientFacingFiles,
      /createServiceRoleClient|service-role|SUPABASE_SERVICE_ROLE_KEY|SUPABASE_SECRET_KEY|storageBucket|storagePath|private-documents|public-documents|audit_logs|admin\.events\.manage|related_meeting_id|related_compliance_event_id|owner_display_name|account_number|public_payment_code|guest_email|guest_phone|stripe_|resend/i,
    );
  });
});
