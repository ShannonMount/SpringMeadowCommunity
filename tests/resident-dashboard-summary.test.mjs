import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();

function read(path) {
  return readFileSync(join(root, path), "utf8");
}

describe("resident dashboard summary", () => {
  it("renders the portal home as a resident dashboard using the dashboard service", () => {
    const pagePath = "app/(resident)/portal/(member)/page.tsx";
    const loadingPath = "app/(resident)/portal/(member)/loading.tsx";

    assert.ok(existsSync(join(root, pagePath)));
    assert.ok(existsSync(join(root, loadingPath)));

    const page = read(pagePath);
    const loading = read(loadingPath);

    assert.match(page, /getResidentDashboardSummary/);
    assert.match(page, /Dues status/);
    assert.match(page, /Pay dues/);
    assert.match(page, /Announcements/);
    assert.match(page, /Upcoming events/);
    assert.match(page, /dashboardResult\.properties/);
    assert.match(page, /property\.canPayDues/);
    assert.match(page, /property\.canViewBalance/);
    assert.match(page, /formatCurrency/);
    assert.match(page, /formatDashboardDate/);
    assert.match(page, /DATE_ONLY_PATTERN/);
    assert.match(page, /Date\.UTC\(year, month - 1, day, 12\)/);
    assert.doesNotMatch(page, /Linked properties/);
    assert.doesNotMatch(page, /format\(new Date\(value\)\)/);
    assert.doesNotMatch(loading, /error\.message|Supabase|implementation|database table/i);
  });

  it("implements a server-only resident dashboard service with scoped property summary queries", () => {
    const servicePath = "server/services/auth/resident-dashboard.ts";

    assert.ok(existsSync(join(root, servicePath)));

    const service = read(servicePath);

    assert.match(service, /import "server-only"/);
    assert.match(service, /getResidentPortalMemberships/);
    assert.match(service, /\.from\("properties"\)/);
    assert.match(service, /current_balance_cents/);
    assert.match(service, /next_due_date/);
    assert.match(service, /last_payment_at/);
    assert.match(service, /delinquency_status/);
    assert.match(service, /\.in\("id", propertyIds\)/);
    assert.match(service, /\.in\("community_id", communityIds\)/);
    assert.match(service, /\.eq\("status", ACTIVE_PROPERTY_STATUS\)/);
    assert.match(service, /\.is\("deleted_at", null\)/);
    assert.match(service, /canViewBalance/);
    assert.match(service, /canPayDues/);
    assert.match(service, /currentBalanceCents:\s*canViewBalance \? row\?\.current_balance_cents \?\? null : null/);
    assert.match(service, /nextDueDate:\s*canViewBalance \? row\?\.next_due_date \?\? null : null/);
    assert.match(service, /lastPaymentAt:\s*canViewBalance \? row\?\.last_payment_at \?\? null : null/);
    assert.match(service, /dashboard-error/);

    assert.doesNotMatch(
      service,
      /owner_display_name|account_number|payment history|private documents|message contents|SERVICE_ROLE|service_role|error\.message/i,
    );
  });

  it("filters resident dashboard announcements and events without weakening public visibility", () => {
    const dashboardServicePath = "server/services/auth/resident-dashboard.ts";

    const dashboardService = read(dashboardServicePath);

    assert.match(dashboardService, /listAnnouncements/);
    assert.match(dashboardService, /visibility:\s*"public"/);
    assert.match(dashboardService, /visibility:\s*"resident"/);
    assert.match(dashboardService, /visibility:\s*"property_specific"/);
    assert.match(dashboardService, /status:\s*"published"/);
    assert.match(dashboardService, /propertyIds\.map\(\(propertyId\)/);
    assert.match(dashboardService, /propertyId,/);
    assert.doesNotMatch(dashboardService, /record\.propertyIds\.some|activePropertyIds/);
    assert.match(dashboardService, /listEvents/);
    assert.match(dashboardService, /status:\s*"scheduled"/);
    assert.match(dashboardService, /upcomingOnly:\s*true/);
    assert.match(dashboardService, /DASHBOARD_EVENT_LIMIT/);
    assert.match(dashboardService, /slice\(0, DASHBOARD_ANNOUNCEMENT_LIMIT\)/);
    assert.match(dashboardService, /slice\(0, DASHBOARD_EVENT_LIMIT\)/);
    assert.doesNotMatch(
      dashboardService,
      /visibility === "board"|visibility === "admin"|vendor/i,
    );
    assert.doesNotMatch(dashboardService, /getDashboardEvents|publicEvents/);
    assert.doesNotMatch(dashboardService, /belong in later authenticated portal work|belong in later resident experiences/i);
  });

  it("keeps dashboard implementation inside story privacy and scope boundaries", () => {
    const dashboardFiles = [
      "app/(resident)/portal/(member)/page.tsx",
      "app/(resident)/portal/(member)/loading.tsx",
      "server/services/auth/resident-dashboard.ts",
    ]
      .map(read)
      .join("\n");

    assert.doesNotMatch(
      dashboardFiles,
      /owner_display_name|raw account|account_number|private documents|message contents|board-only|admin-only|vendor-only|SERVICE_ROLE|service_role|error\.message/i,
    );
    assert.doesNotMatch(dashboardFiles, /createResidentPaymentSession|stripe|checkout/i);
    assert.doesNotMatch(dashboardFiles, /assessment_cycles|payment_allocations|document_access_logs|message_threads/i);
  });
});
