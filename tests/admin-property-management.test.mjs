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

describe("admin property management", () => {
  it("adds permission-scoped property management RPCs without broad table grants", () => {
    const migrationPath = "supabase/migrations/202605110019_property_management.sql";

    assert.ok(existsSync(join(root, migrationPath)));

    const migration = read(migrationPath);

    assert.match(migration, /admin\.properties\.manage/);
    assert.match(migration, /where key = 'admin'/i);
    assert.doesNotMatch(migration, /where key in \('board_member', 'admin'\)/i);
    assert.match(migration, /create or replace function public\.list_admin_properties/i);
    assert.match(migration, /create or replace function public\.create_admin_property/i);
    assert.match(migration, /create or replace function public\.update_admin_property/i);
    assert.match(migration, /create or replace function public\.archive_admin_property/i);
    assert.match(migration, /security definer/i);
    assert.match(migration, /app\.current_profile_id\(\)/i);
    assert.match(migration, /app\.has_permission\(target_community_id, 'admin\.properties\.manage'\)/i);
    assert.match(migration, /properties\.community_id = target_community_id/i);
    assert.match(migration, /status = 'archived'/i);
    assert.match(migration, /deleted_at = now\(\)/i);
    assert.match(migration, /current_balance_cents/i);
    assert.match(migration, /last_payment_at/i);
    assert.match(migration, /next_due_date/i);
    assert.match(migration, /delinquency_status/i);
    assert.match(migration, /mailing_address/i);
    assert.match(migration, /unique_property_account|account_conflict|payment_code_conflict/i);
    assert.match(migration, /admin_property_mailing_address_is_valid/i);
    assert.match(migration, /jsonb_each\(mailing_address\)/i);
    assert.match(migration, /fields\.key not in \('line1', 'line2', 'city', 'state', 'postalCode', 'county'\)/i);
    assert.match(migration, /app\.admin_property_mailing_address_is_valid\(property_mailing_address\)/i);
    assert.match(migration, /revoke all on function public\.list_admin_properties/i);
    assert.match(migration, /revoke all on function public\.create_admin_property/i);
    assert.match(migration, /revoke all on function public\.update_admin_property/i);
    assert.match(migration, /revoke all on function public\.archive_admin_property/i);
    assert.match(migration, /grant execute on function public\.list_admin_properties[\s\S]*to authenticated/i);
    assert.match(migration, /grant execute on function public\.create_admin_property[\s\S]*to authenticated/i);
    assert.match(migration, /grant execute on function public\.update_admin_property[\s\S]*to authenticated/i);
    assert.match(migration, /grant execute on function public\.archive_admin_property[\s\S]*to authenticated/i);

    assert.doesNotMatch(
      migration,
      /create table if not exists public\.properties|drop table|grant (select|insert|update|delete|all) on public\.(properties|property_memberships|payments|assessments|documents|message_threads|audit_logs) to (anon|authenticated)|delete from public\.properties|stripe_|storage_bucket|storage_path|guest_email|guest_phone|message_body|error\.message/i,
    );
  });

  it("implements a server-only property management service with safe typed results", () => {
    const servicePath = "server/services/admin/property-management.ts";

    assert.ok(existsSync(join(root, servicePath)));

    const service = read(servicePath);

    assert.match(service, /import "server-only"/);
    assert.match(service, /createClient/);
    assert.match(service, /getCurrentProfile/);
    assert.match(service, /hasPermission/);
    assert.match(service, /admin\.properties\.manage/);
    assert.match(service, /DEFAULT_COMMUNITY_SLUG = "spring-meadow-community"/);
    assert.match(service, /\.rpc\("list_admin_properties"/);
    assert.match(service, /\.rpc\("create_admin_property"/);
    assert.match(service, /\.rpc\("update_admin_property"/);
    assert.match(service, /\.rpc\("archive_admin_property"/);
    assert.match(service, /writeAuditLog/);
    assert.match(service, /MAILING_ADDRESS_KEYS/);
    assert.match(service, /mailingAddress: normalizeMailingAddress\(input\.mailingAddress\)/);
    assert.match(service, /kind: "properties"/);
    assert.match(service, /kind: "created"/);
    assert.match(service, /kind: "updated"/);
    assert.match(service, /kind: "archived"/);
    assert.match(service, /kind: "conflict"/);
    assert.match(service, /kind: "invalid-input"/);
    assert.match(service, /property-unavailable/);
    assert.match(service, /profile-unavailable/);
    assert.match(service, /permission-denied/);
    assert.match(service, /unauthenticated/);

    assertBefore(service, "getCurrentProfile()", "hasPermission({");
    assertBefore(service, "hasPermission({", '.rpc("list_admin_properties"');
    assert.doesNotMatch(
      service,
      /createServiceRoleClient|service-role|SUPABASE_SECRET_KEY|SUPABASE_SERVICE_ROLE_KEY|error\.message|stripe_|storageBucket|storagePath|messageBody|guestEmail|guestPhone/i,
    );
  });

  it("adds safe admin property server actions with explicit form parsing", () => {
    const actionsPath = "server/actions/admin-properties.ts";

    assert.ok(existsSync(join(root, actionsPath)));

    const actions = read(actionsPath);

    assert.match(actions, /"use server"/);
    assert.match(actions, /createAdminProperty/);
    assert.match(actions, /updateAdminProperty/);
    assert.match(actions, /archiveAdminProperty/);
    assert.match(actions, /FormData/);
    assert.match(actions, /accountNumber/);
    assert.match(actions, /publicPaymentCode/);
    assert.match(actions, /mailingAddressLine1/);
    assert.match(actions, /mailingAddressPostalCode/);
    assert.match(actions, /redirect\(`\/admin\/properties\?\$\{params\.toString\(\)\}`\)/);
    assert.match(actions, /propertyAction/);
    assert.match(actions, /propertyActionField/);
    assert.match(actions, /invalid|denied|unavailable|conflict/);

    assert.doesNotMatch(
      actions,
      /JSON\.parse|mailingAddressJson|formData\.get\("mailingAddress"\)|communityId|createServiceRoleClient|service-role|error\.message|SUPABASE_SERVICE_ROLE_KEY|SUPABASE_SECRET_KEY/i,
    );
  });

  it("replaces the properties placeholder with an accessible permission-backed roster page", () => {
    const pagePath = "app/(admin)/admin/properties/page.tsx";

    assert.ok(existsSync(join(root, pagePath)));

    const page = read(pagePath);

    assert.match(page, /listAdminProperties/);
    assert.match(page, /createAdminPropertyAction/);
    assert.match(page, /updateAdminPropertyAction/);
    assert.match(page, /archiveAdminPropertyAction/);
    assert.match(page, /pageOffset/);
    assert.match(page, /PAGE_SIZE \+ 1/);
    assert.match(page, /PaginationControls/);
    assert.match(page, /adminPropertiesHref/);
    assert.match(page, /Property management/);
    assert.match(page, /Create property/);
    assert.match(page, /Account number/);
    assert.match(page, /Public payment code/);
    assert.match(page, /Mailing address/);
    assert.match(page, /Archive/);
    assert.match(page, /No properties found/);
    assert.match(page, /Not available for your role|You do not have permission/);
    assert.match(page, /aria-live="polite"/);
    assert.match(page, /htmlFor=/);
    assert.match(page, /focus-visible:outline/);
    assert.match(page, /rounded-sm/);
    assert.match(page, /min-w-0/);
    assert.match(page, /break-words/);
    assert.match(page, /property-\$\{property\.id\}/);

    assert.doesNotMatch(page, /AdminPlaceholderSection|<main\b|<\/main>|createServiceRoleClient|service-role|error\.message|stripe_|storagePath|storageBucket|messageBody|guestEmail|guestPhone/i);
  });

  it("enables admin property navigation through the new permission", () => {
    const workspacePath = "server/services/auth/admin-workspace.ts";
    const service = read(workspacePath);
    const propertiesItemStart = service.indexOf('label: "Properties"');
    const propertiesItem = service.slice(propertiesItemStart, service.indexOf('label: "Users"', propertiesItemStart));

    assert.match(propertiesItem, /href: "\/admin\/properties"/);
    assert.match(propertiesItem, /currentStatus: "available"/);
    assert.match(propertiesItem, /permissionKey: "admin\.properties\.manage"/);
  });

  it("keeps property management internals out of public, resident, guest, nav, and adjacent admin surfaces", () => {
    const forbiddenInternals =
      /property-management|listAdminProperties|createAdminProperty|updateAdminProperty|archiveAdminProperty|admin\.properties\.manage/i;
    const clientFacingFiles = [
      ...listFiles("app/(public)"),
      ...listFiles("app/(resident)"),
      ...listFiles("components/public"),
      ...listFiles("components/resident"),
      "components/admin/admin-workspace-nav.tsx",
      "lib/supabase/client.ts",
      "server/services/payments/guest-property-lookup.ts",
      "server/services/admin/dashboard-summary.ts",
      "server/services/payments/admin-payment-management.ts",
      "server/services/documents/document-metadata.ts",
      "server/services/messages/admin-message-inbox.ts",
    ];
    const content = readExisting(clientFacingFiles);

    assert.doesNotMatch(content, forbiddenInternals);
  });
});
