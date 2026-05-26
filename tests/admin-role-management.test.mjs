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

describe("admin role assignment and permission management", () => {
  it("adds permission-scoped role RPCs without duplicate tables or broad grants", () => {
    const migrationPath = "supabase/migrations/202605110021_role_assignment_management.sql";

    assert.ok(existsSync(join(root, migrationPath)));

    const migration = read(migrationPath);
    const propertyRowsStart = migration.indexOf("with property_rows as");
    const propertyRowsEnd = migration.indexOf("select coalesce(jsonb_agg", propertyRowsStart);
    const propertyRowsCte = migration.slice(propertyRowsStart, propertyRowsEnd);

    assert.match(migration, /admin\.roles\.manage/);
    assert.match(migration, /create or replace function public\.list_admin_roles/i);
    assert.match(migration, /create or replace function public\.list_admin_profile_roles/i);
    assert.match(migration, /create or replace function public\.list_admin_role_targets/i);
    assert.match(migration, /create or replace function public\.assign_profile_role/i);
    assert.match(migration, /create or replace function public\.suspend_profile_role/i);
    assert.match(migration, /create or replace function public\.remove_profile_role/i);
    assert.match(migration, /security definer/i);
    assert.match(migration, /app\.current_profile_id\(\)/i);
    assert.match(migration, /app\.has_permission\(target_community_id, 'admin\.roles\.manage'\)/i);
    assert.match(migration, /where roles\.community_id = target_community_id/i);
    assert.match(migration, /profiles\.deleted_at is null/i);
    assert.match(migration, /profiles\.status in \('active', 'invited'\)/i);
    assert.match(migration, /properties\.community_id = target_community_id/i);
    assert.match(migration, /properties\.deleted_at is null/i);
    assert.match(migration, /scope = 'community'[\s\S]*'00000000-0000-0000-0000-000000000000'::uuid/i);
    assert.match(migration, /target_scope not in \('community', 'property'\)/i);
    assert.match(migration, /status = 'active'[\s\S]*assigned_by = actor_profile_id[\s\S]*assigned_at = now\(\)[\s\S]*removed_at = null/i);
    assert.match(migration, /status = 'suspended'[\s\S]*removed_at = role_record\.removed_at/i);
    assert.match(migration, /status = 'removed'[\s\S]*removed_at = removed_at_value/i);
    assert.match(migration, /role_record\.profile_id = actor_profile_id[\s\S]*admin\.roles\.manage[\s\S]*return jsonb_build_object\('status', 'invalid'\)/i);
    assert.match(migration, /role_record\.scope = 'community'[\s\S]*role_record\.scope_id = '00000000-0000-0000-0000-000000000000'::uuid/i);
    assert.match(migration, /other_profile_roles\.scope = 'community'[\s\S]*other_profile_roles\.scope_id = '00000000-0000-0000-0000-000000000000'::uuid/i);
    assert.match(migration, /pg_advisory_xact_lock[\s\S]*profile-role-self-lockout/i);
    assert.match(
      migration,
      /with property_rows as \([\s\S]*order by properties\.account_number asc, properties\.address_line1 asc, properties\.id asc\s*\)/i,
    );
    assert.doesNotMatch(propertyRowsCte, /limit bounded_limit/i);
    assert.match(migration, /previous_status/);
    assert.match(migration, /assigned_by/);
    assert.match(migration, /assigned_at/);
    assert.match(migration, /removed_at/);
    assert.match(migration, /revoke all on function public\.list_admin_roles/i);
    assert.match(migration, /revoke all on function public\.list_admin_profile_roles/i);
    assert.match(migration, /revoke all on function public\.list_admin_role_targets/i);
    assert.match(migration, /revoke all on function public\.assign_profile_role/i);
    assert.match(migration, /revoke all on function public\.suspend_profile_role/i);
    assert.match(migration, /revoke all on function public\.remove_profile_role/i);
    assert.match(migration, /grant execute on function public\.list_admin_roles[\s\S]*to authenticated/i);
    assert.match(migration, /grant execute on function public\.list_admin_profile_roles[\s\S]*to authenticated/i);
    assert.match(migration, /grant execute on function public\.list_admin_role_targets[\s\S]*to authenticated/i);
    assert.match(migration, /grant execute on function public\.assign_profile_role[\s\S]*to authenticated/i);
    assert.match(migration, /grant execute on function public\.suspend_profile_role[\s\S]*to authenticated/i);
    assert.match(migration, /grant execute on function public\.remove_profile_role[\s\S]*to authenticated/i);

    assert.doesNotMatch(
      migration,
      /create table if not exists public\.(roles|profile_roles|profiles|properties|property_memberships|audit_logs)|drop table|grant (select|insert|update|delete|all) on public\.(roles|profile_roles|profiles|properties|property_memberships|audit_logs|payments|documents|message_threads) to (anon|authenticated)|delete from public\.profile_roles|error\.message|password|stripe_|storage_path|message_body/i,
    );
  });

  it("implements a server-only role management service with safe unions and existing role helpers", () => {
    const servicePath = "server/services/admin/role-management.ts";
    const permissionsPath = "server/services/auth/permissions.ts";

    assert.ok(existsSync(join(root, servicePath)));
    assert.ok(existsSync(join(root, permissionsPath)));

    const service = read(servicePath);
    const permissions = read(permissionsPath);

    assert.match(service, /import "server-only"/);
    assert.match(service, /createClient/);
    assert.match(service, /getCurrentProfile/);
    assert.match(service, /hasPermission/);
    assert.match(service, /PERMISSION_DENIED_MESSAGE/);
    assert.match(service, /PROFILE_UNAVAILABLE_MESSAGE/);
    assert.match(service, /assignProfileRole/);
    assert.match(service, /suspendProfileRole/);
    assert.match(service, /removeProfileRole/);
    assert.match(service, /DEFAULT_COMMUNITY_SLUG = "spring-meadow-community"/);
    assert.match(service, /ROLE_MANAGEMENT_PERMISSION = "admin\.roles\.manage"/);
    assert.match(service, /\.rpc\("list_admin_roles"/);
    assert.match(service, /\.rpc\("list_admin_profile_roles"/);
    assert.match(service, /\.rpc\("list_admin_role_targets"/);
    assert.match(service, /kind: "roles"/);
    assert.match(service, /kind: "assignments"/);
    assert.match(service, /kind: "targets"/);
    assert.match(service, /kind: "assigned"/);
    assert.match(service, /kind: "suspended"/);
    assert.match(service, /kind: "removed"/);
    assert.match(service, /kind: "invalid-input"/);
    assert.match(service, /kind: "role-unavailable"/);
    assert.match(service, /permission-denied/);
    assert.match(service, /profile-unavailable/);
    assert.match(service, /unauthenticated/);
    assert.match(service, /type AdminRoleDefinition/);
    assert.match(service, /type AdminRoleAssignmentSummary/);
    assert.match(service, /type AdminRoleTargetProfile/);
    assert.match(service, /type AdminRolePropertyScopeOption/);
    assert.match(service, /scope: "community" \| "property"/);
    assert.match(service, /roleKeys\.has\(input\.roleKey/);
    assert.match(service, /writeAuditLog|role\.assign|role\.suspend|role\.remove/);
    assert.match(service, /result\.kind === "invalid-input"/);
    assert.match(service, /result\.kind === "role-unavailable"/);
    assert.match(permissions, /status\?: "assigned" \| "suspended" \| "removed" \| "invalid" \| "unavailable"/);
    assert.match(permissions, /function mutationInvalid/);
    assert.match(permissions, /function mutationUnavailable/);
    assert.match(permissions, /hasFallbackRemovedAt/);
    assert.match(permissions, /removedAt: hasFallbackRemovedAt \? fallback\.removedAt \?\? null : result\.removed_at \?\? null/);
    assert.match(permissions, /result\.status === "invalid"/);

    assertBefore(service, "getCurrentProfile()", "hasPermission({");
    assert.doesNotMatch(
      service,
      /createServiceRoleClient|service-role|SUPABASE_SERVICE_ROLE_KEY|SUPABASE_SECRET_KEY|JSON\.parse|roles\.permissions\s*=|password|recovery|session|provider|stripe_|storageBucket|storagePath|messageBody|guestEmail|guestPhone|error\.message/i,
    );
  });

  it("adds safe role server actions with explicit field parsing", () => {
    const actionsPath = "server/actions/admin-roles.ts";

    assert.ok(existsSync(join(root, actionsPath)));

    const actions = read(actionsPath);

    assert.match(actions, /"use server"/);
    assert.match(actions, /assignAdminProfileRoleAction/);
    assert.match(actions, /suspendAdminProfileRoleAction/);
    assert.match(actions, /removeAdminProfileRoleAction/);
    assert.match(actions, /FormData/);
    assert.match(actions, /targetProfileId/);
    assert.match(actions, /profileRoleId/);
    assert.match(actions, /roleKey/);
    assert.match(actions, /scope/);
    assert.match(actions, /scopeId/);
    assert.match(actions, /reason/);
    assert.match(actions, /ROLE_ACTION_FIELDS/);
    assert.match(actions, /safeActionField/);
    assert.match(actions, /redirect\(`\/admin\/roles\?\$\{params\.toString\(\)\}`\)/);
    assert.match(actions, /roleAction/);
    assert.match(actions, /roleActionField/);
    assert.match(actions, /assigned|suspended|removed|invalid|denied|unavailable/);
    assert.match(actions, /CONTROL_CHARACTER_PATTERN/);
    assert.match(actions, /formData\.has\("permissions"\)/);
    assert.match(actions, /formData\.has\("roleJson"\)/);
    assert.match(actions, /formData\.has\("communityId"\)/);
    assert.match(actions, /formData\.has\("actorProfileId"\)/);
    assert.match(actions, /DEFAULT_COMMUNITY_SLUG/);

    assert.doesNotMatch(
      actions,
      /JSON\.parse|permissions\[\]|createServiceRoleClient|service-role|error\.message|SUPABASE_SERVICE_ROLE_KEY|SUPABASE_SECRET_KEY/i,
    );
  });

  it("builds an accessible permission-backed admin roles page", () => {
    const pagePath = "app/(admin)/admin/roles/page.tsx";

    assert.ok(existsSync(join(root, pagePath)));

    const page = read(pagePath);

    assert.match(page, /listAdminRoles/);
    assert.match(page, /listAdminProfileRoles/);
    assert.match(page, /listAdminRoleTargets/);
    assert.match(page, /TARGET_LIST_SIZE = 200/);
    assert.match(page, /pageOffset: 0/);
    assert.match(page, /const hasNextPage = assignmentsResult\.assignments\.length > PAGE_SIZE/);
    assert.match(page, /assignAdminProfileRoleAction/);
    assert.match(page, /suspendAdminProfileRoleAction/);
    assert.match(page, /removeAdminProfileRoleAction/);
    assert.match(page, /adminRolesHref/);
    assert.match(page, /ACTION_NOTICE_FIELDS/);
    assert.match(page, /safeNoticeField/);
    assert.match(page, /Role management/);
    assert.match(page, /Assign role/);
    assert.match(page, /Search roles/);
    assert.match(page, /Role status/);
    assert.match(page, /Scope/);
    assert.match(page, /Permission summary/);
    assert.match(page, /Assignments/);
    assert.match(page, /Suspend/);
    assert.match(page, /Remove/);
    assert.match(page, /No roles found|No assignments found|No target profiles found/);
    assert.match(page, /Not available for your role|You do not have permission/);
    assert.match(page, /href="\/admin\/users"/);
    assert.match(page, /aria-live="polite"/);
    assert.match(page, /htmlFor=/);
    assert.match(page, /focus-visible:outline/);
    assert.match(page, /rounded-sm/);
    assert.match(page, /min-w-0/);
    assert.match(page, /break-words/);
    assert.match(page, /assignment-\$\{assignment\.id\}/);

    assert.doesNotMatch(
      page,
      /<main\b|<\/main>|AdminPlaceholderSection|createServiceRoleClient|service-role|error\.message|password|recovery|session|provider|stripe_|storagePath|storageBucket|messageBody|guestEmail|guestPhone/i,
    );
  });

  it("enables role navigation through admin.roles.manage", () => {
    const workspacePath = "server/services/auth/admin-workspace.ts";
    const service = read(workspacePath);
    const rolesItemStart = service.indexOf('label: "Roles"');
    const rolesItem = service.slice(rolesItemStart, service.indexOf('label: "Payments"', rolesItemStart));

    assert.match(rolesItem, /href: "\/admin\/roles"/);
    assert.match(rolesItem, /currentStatus: "available"/);
    assert.match(rolesItem, /permissionKey: "admin\.roles\.manage"/);
  });

  it("keeps role management internals out of public, resident, guest, client, and adjacent services", () => {
    const forbiddenInternals =
      /role-management|listAdminRoles|listAdminProfileRoles|listAdminRoleTargets|assignAdminProfileRole|suspendAdminProfileRole|removeAdminProfileRole|admin-roles/i;
    const adjacentFiles = [
      ...listFiles("app/(public)"),
      ...listFiles("app/(resident)"),
      ...listFiles("components/public"),
      ...listFiles("components/resident"),
      "components/admin/admin-workspace-nav.tsx",
      "lib/supabase/client.ts",
      "server/services/payments/guest-property-lookup.ts",
      "server/services/admin/dashboard-summary.ts",
      "server/services/admin/property-management.ts",
      "server/services/admin/user-membership-management.ts",
      "server/services/payments/admin-payment-management.ts",
      "server/services/documents/document-metadata.ts",
      "server/services/messages/admin-message-inbox.ts",
    ];
    const content = readExisting(adjacentFiles);

    assert.doesNotMatch(
      content,
      forbiddenInternals,
    );
  });
});
