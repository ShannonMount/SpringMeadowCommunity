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

function assertBefore(content, first, second) {
  const firstIndex = content.indexOf(first);
  const secondIndex = content.indexOf(second);

  assert.ok(firstIndex >= 0, `Expected to find ${first}`);
  assert.ok(secondIndex >= 0, `Expected to find ${second}`);
  assert.ok(firstIndex < secondIndex, `Expected ${first} before ${second}`);
}

describe("admin dashboard summary", () => {
  it("adds a server-only dashboard summary service with safe unions and RPC mapping", () => {
    const servicePath = "server/services/admin/dashboard-summary.ts";

    assert.ok(existsSync(join(root, servicePath)));

    const service = read(servicePath);

    assert.match(service, /import "server-only"/);
    assert.match(service, /createClient/);
    assert.match(service, /getCurrentProfile/);
    assert.match(service, /hasPermission/);
    assert.match(service, /board\.workspace\.access/);
    assert.match(service, /DEFAULT_COMMUNITY_SLUG = "spring-meadow-community"/);
    assert.match(service, /\.from\("communities"\)/);
    assert.match(service, /\.eq\("slug", communitySlug\)/);
    assert.match(service, /\.rpc\("get_admin_dashboard_summary"/);
    assert.match(service, /dashboard-unavailable/);
    assert.match(service, /profile-unavailable/);
    assert.match(service, /permission-denied/);
    assert.match(service, /unauthenticated/);
    assert.match(service, /kind: "dashboard"/);
    assert.match(service, /DashboardSectionState/);
    assert.match(service, /not_configured/);
    assert.match(service, /permission_denied/);
    assert.match(service, /empty/);

    assertBefore(service, "getCurrentProfile()", "hasPermission({");
    assertBefore(service, "hasPermission({", '.rpc("get_admin_dashboard_summary"');

    assert.doesNotMatch(
      service,
      /createServiceRoleClient|service-role|roles\.permissions|profile_roles|audit_logs|error\.message|owner_display_name|account_number|public_payment_code|guest_email|guest_phone|message_body|body:|storage_bucket|storage_path|stripe_|resend|SUPABASE_SECRET_KEY|SUPABASE_SERVICE_ROLE_KEY/i,
    );
  });

  it("adds a permission-gated aggregate RPC migration without row-level private fields", () => {
    const migrationPath = "supabase/migrations/202605110018_admin_dashboard_summary.sql";

    assert.ok(existsSync(join(root, migrationPath)));

    const migration = read(migrationPath);

    assert.match(migration, /create or replace function public\.get_admin_dashboard_summary/i);
    assert.match(migration, /returns jsonb/i);
    assert.match(migration, /security definer/i);
    assert.match(migration, /app\.current_profile_id\(\)/i);
    assert.match(migration, /app\.has_permission\(target_community_id, 'board\.workspace\.access'\)/i);
    assert.match(migration, /app\.has_permission\(target_community_id, 'admin\.payments\.manage'\)/i);
    assert.match(migration, /app\.has_permission\(target_community_id, 'admin\.documents\.manage'\)/i);
    assert.match(migration, /app\.has_permission\(target_community_id, 'board\.documents\.view'\)/i);
    assert.match(migration, /can_manage_documents := app\.has_permission\(target_community_id, 'admin\.documents\.manage'\)/i);
    assert.match(migration, /can_view_board_documents := app\.has_permission\(target_community_id, 'board\.documents\.view'\)/i);
    assert.match(migration, /can_view_documents := can_manage_documents or can_view_board_documents/i);
    assert.match(
      migration,
      /can_manage_documents = true[\s\S]*documents\.visibility in \('public', 'board', 'property_specific'\)/i,
    );
    assert.match(migration, /app\.has_permission\(target_community_id, 'admin\.messages\.manage'\)/i);
    assert.match(migration, /'not_configured'/i);
    assert.match(migration, /'permission_denied'/i);
    assert.match(migration, /properties\.community_id = target_community_id/i);
    assert.match(migration, /payments\.community_id = target_community_id/i);
    assert.match(migration, /documents\.community_id = target_community_id/i);
    assert.match(migration, /message_threads\.community_id = target_community_id/i);
    assert.match(migration, /revoke all on function public\.get_admin_dashboard_summary/i);
    assert.match(migration, /from public, anon, authenticated/i);
    assert.match(migration, /grant execute on function public\.get_admin_dashboard_summary[\s\S]*to authenticated/i);

    assert.doesNotMatch(
      migration,
      /owner_display_name|account_number|public_payment_code|guest_name|guest_email|guest_phone|message_body|messages\.body|storage_bucket|storage_path|stripe_checkout_session_id|stripe_payment_intent_id|stripe_charge_id|stripe_customer_id|stripe_receipt_url|provider_message_id|audit_logs|compliance_calendar_events|compliance_tasks/i,
    );
  });

  it("replaces the admin dashboard placeholder with compact permission-aware summaries", () => {
    const pagePath = "app/(admin)/admin/page.tsx";

    assert.ok(existsSync(join(root, pagePath)));

    const page = read(pagePath);

    assert.match(page, /getAdminDashboardSummary/);
    assert.match(page, /formatCurrency/);
    assert.match(page, /MetricTile/);
    assert.match(page, /SectionPanel/);
    assert.match(page, /No failed payments/);
    assert.match(page, /No active messages/);
    assert.match(page, /No documents expiring soon/);
    assert.match(page, /Compliance tracking has not been configured yet/);
    assert.match(page, /Not available for your role/);
    assert.match(page, /\/admin\/payments/);
    assert.match(page, /\/admin\/documents/);
    assert.match(page, /\/admin\/messages/);
    assert.match(page, /\/admin\/delinquency/);
    assert.match(page, /focus-visible:outline/);
    assert.match(page, /min-w-0/);
    assert.match(page, /break-words/);

    assert.doesNotMatch(page, /Spring Meadow Community operations area/);
    assert.doesNotMatch(page, /Board\/admin workspace/);
    assert.doesNotMatch(page, /<main\b|<\/main>/);
    assert.doesNotMatch(
      page,
      /\.from\("payments"\)|\.from\("documents"\)|\.from\("message_threads"\)|listAdminPaymentRecords|listDocumentMetadata|listMessageThreads|createServiceRoleClient|service-role|error\.message|storagePath|storageBucket|stripe_|resend/i,
    );
  });

  it("keeps dashboard-only internals out of client-facing and nav surfaces", () => {
    const dashboardServiceName = /dashboard-summary|getAdminDashboardSummary|get_admin_dashboard_summary/i;
    const clientFacingFiles = [
      ...listFiles("app/(public)"),
      ...listFiles("app/(resident)"),
      ...listFiles("components/public"),
      ...listFiles("components/resident"),
      "components/admin/admin-workspace-nav.tsx",
      "lib/supabase/client.ts",
    ];
    const content = readExisting(clientFacingFiles);

    assert.doesNotMatch(content, dashboardServiceName);
    assert.doesNotMatch(
      content,
      /admin_dashboard|board\.workspace\.access|admin\.payments\.manage|admin\.documents\.manage|admin\.messages\.manage|payment_events|message_threads|audit_logs|owner_display_name|account_number|public_payment_code|guest_email|guest_phone|stripe_|resend|error\.message/i,
    );
  });
});
