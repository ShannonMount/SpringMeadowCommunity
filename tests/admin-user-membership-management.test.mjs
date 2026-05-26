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

describe("admin user and membership management", () => {
  it("adds permission-scoped membership RPCs without duplicate tables or broad grants", () => {
    const migrationPath = "supabase/migrations/202605110020_user_membership_management.sql";

    assert.ok(existsSync(join(root, migrationPath)));

    const migration = read(migrationPath);

    assert.match(migration, /admin\.users\.manage/);
    assert.doesNotMatch(migration, /admin\.memberships\.manage|properties:read/i);
    assert.match(migration, /create or replace function public\.list_admin_users/i);
    assert.match(migration, /create or replace function public\.list_admin_memberships/i);
    assert.match(migration, /create or replace function public\.invite_admin_property_member/i);
    assert.match(migration, /create or replace function public\.update_admin_property_membership/i);
    assert.match(migration, /create or replace function public\.activate_admin_property_membership/i);
    assert.match(migration, /create or replace function public\.suspend_admin_property_membership/i);
    assert.match(migration, /create or replace function public\.remove_admin_property_membership/i);
    assert.match(migration, /security definer/i);
    assert.match(migration, /app\.current_profile_id\(\)/i);
    assert.match(migration, /app\.has_permission\(target_community_id, 'admin\.users\.manage'\)/i);
    assert.match(migration, /property_memberships\.community_id = target_community_id/i);
    assert.match(migration, /properties\.community_id = target_community_id/i);
    assert.match(migration, /properties\.deleted_at is null/i);
    assert.match(migration, /profiles\.deleted_at is null/i);
    assert.match(
      migration,
      /exists \([\s\S]*membership_filter\.community_id = target_community_id[\s\S]*membership_filter\.profile_id = profiles\.id[\s\S]*coalesce\(include_removed, false\)[\s\S]*membership_filter\.status <> 'removed'/i,
    );
    assert.doesNotMatch(migration, /coalesce\(include_removed, false\)\s+or exists \(/i);
    assert.match(migration, /membership_conflict|unique \(community_id, property_id, profile_id\)|on conflict \(community_id, property_id, profile_id\)/i);
    assert.match(migration, /status = 'removed'/i);
    assert.match(migration, /removed_at = now\(\)/i);
    assert.match(migration, /status = 'suspended'/i);
    assert.match(migration, /status = 'active'/i);
    assert.match(migration, /membership_record\.status not in \('invited', 'suspended'\)/i);
    assert.match(migration, /membership_record\.status not in \('invited', 'active'\)/i);
    assert.match(migration, /membership_record\.status = 'removed'/i);
    assert.match(
      migration,
      /create or replace function public\.list_admin_memberships[\s\S]*length\(btrim\(filter_query\)\) > 200[\s\S]*return jsonb_build_object\('status', 'invalid'\)/i,
    );
    assert.match(
      migration,
      /filter_status = 'removed'[\s\S]*property_memberships\.status <> 'removed'/i,
    );
    assert.match(migration, /'after', jsonb_build_object\(/i);
    assert.match(migration, /'can_view_balance', membership_record\.can_view_balance/i);
    assert.match(migration, /'invited_at', membership_record\.invited_at/i);
    assert.match(migration, /property_invitation_tokens/i);
    assert.match(migration, /token_hash/i);
    assert.match(migration, /accepted_at is null/i);
    assert.match(migration, /revoked_at/i);
    assert.match(migration, /revoke all on function public\.list_admin_users/i);
    assert.match(migration, /revoke all on function public\.list_admin_memberships/i);
    assert.match(migration, /revoke all on function public\.invite_admin_property_member/i);
    assert.match(migration, /revoke all on function public\.update_admin_property_membership/i);
    assert.match(migration, /revoke all on function public\.activate_admin_property_membership/i);
    assert.match(migration, /revoke all on function public\.suspend_admin_property_membership/i);
    assert.match(migration, /revoke all on function public\.remove_admin_property_membership/i);
    assert.match(migration, /grant execute on function public\.list_admin_users[\s\S]*to authenticated/i);
    assert.match(migration, /grant execute on function public\.list_admin_memberships[\s\S]*to authenticated/i);
    assert.match(migration, /grant execute on function public\.invite_admin_property_member[\s\S]*to authenticated/i);
    assert.match(migration, /grant execute on function public\.update_admin_property_membership[\s\S]*to authenticated/i);
    assert.match(migration, /grant execute on function public\.activate_admin_property_membership[\s\S]*to authenticated/i);
    assert.match(migration, /grant execute on function public\.suspend_admin_property_membership[\s\S]*to authenticated/i);
    assert.match(migration, /grant execute on function public\.remove_admin_property_membership[\s\S]*to authenticated/i);

    assert.doesNotMatch(
      migration,
      /create table if not exists public\.(profiles|properties|property_memberships|roles|profile_roles)|drop table|grant (select|insert|update|delete|all) on public\.(profiles|properties|property_memberships|property_invitation_tokens|profile_roles|roles|payments|documents|message_threads|audit_logs) to (anon|authenticated)|delete from public\.property_memberships|error\.message|stripe_|storage_bucket|storage_path|message_body/i,
    );
  });

  it("implements a server-only admin membership service with safe unions and authorization-first Auth admin handling", () => {
    const servicePath = "server/services/admin/user-membership-management.ts";

    assert.ok(existsSync(join(root, servicePath)));

    const service = read(servicePath);

    assert.match(service, /import "server-only"/);
    assert.match(service, /createClient/);
    assert.match(service, /getCurrentProfile/);
    assert.match(service, /hasPermission/);
    assert.match(service, /admin\.users\.manage/);
    assert.match(service, /DEFAULT_COMMUNITY_SLUG = "spring-meadow-community"/);
    assert.match(service, /\.rpc\("list_admin_users"/);
    assert.match(service, /\.rpc\("list_admin_memberships"/);
    assert.match(service, /\.rpc\("invite_admin_property_member"/);
    assert.match(service, /\.rpc\("update_admin_property_membership"/);
    assert.match(service, /\.rpc\("activate_admin_property_membership"/);
    assert.match(service, /\.rpc\("suspend_admin_property_membership"/);
    assert.match(service, /\.rpc\("remove_admin_property_membership"/);
    assert.match(service, /createServiceRoleClient/);
    assert.match(service, /inviteUserByEmail/);
    assert.match(service, /APP_BASE_URL/);
    assert.match(service, /hashInvitationToken/);
    assert.match(service, /randomBytes/);
    assert.match(service, /writeAuditLog/);
    assert.match(service, /membership\.invite/);
    assert.match(service, /membership\.update/);
    assert.match(service, /membership\.activate/);
    assert.match(service, /membership\.suspend/);
    assert.match(service, /membership\.remove/);
    assert.match(service, /kind: "users"/);
    assert.match(service, /kind: "memberships"/);
    assert.match(service, /kind: "invited"/);
    assert.match(service, /kind: "updated"/);
    assert.match(service, /kind: "activated"/);
    assert.match(service, /kind: "suspended"/);
    assert.match(service, /kind: "removed"/);
    assert.match(service, /kind: "conflict"/);
    assert.match(service, /kind: "invalid-input"/);
    assert.match(service, /membership-unavailable/);
    assert.match(service, /permission-denied/);
    assert.match(service, /profile-unavailable/);
    assert.match(service, /unauthenticated/);

    assertBefore(service, "getCurrentProfile()", "hasPermission({");
    assertBefore(service, "hasPermission({", "createServiceRoleClient");
    assert.doesNotMatch(service, /expected\.replace\("d", ""\)/);
    assert.match(service, /after\?: Record<string, unknown> \| null/);
    assert.match(service, /\.\.\.\(rpcResult\?\.after \?\? \{\}\)/);
    assert.match(service, /const membershipStatus = optionalString\(input\.status\)/);
    assert.match(service, /include_removed: input\.includeRemoved === true \|\| membershipStatus === "removed"/);
    assert.match(service, /action === "activate" \? "active" : action === "suspend" \? "suspended" : "removed"/);
    assert.doesNotMatch(
      service,
      /SUPABASE_SERVICE_ROLE_KEY|SUPABASE_SECRET_KEY|error\.message|password_hash|recovery|session|provider|stripe_|storageBucket|storagePath|messageBody|guestEmail|guestPhone/i,
    );
  });

  it("adds safe admin user server actions with explicit field parsing", () => {
    const actionsPath = "server/actions/admin-users.ts";

    assert.ok(existsSync(join(root, actionsPath)));

    const actions = read(actionsPath);

    assert.match(actions, /"use server"/);
    assert.match(actions, /inviteAdminPropertyMemberAction/);
    assert.match(actions, /updateAdminPropertyMembershipAction/);
    assert.match(actions, /activateAdminPropertyMembershipAction/);
    assert.match(actions, /suspendAdminPropertyMembershipAction/);
    assert.match(actions, /removeAdminPropertyMembershipAction/);
    assert.match(actions, /FormData/);
    assert.match(actions, /propertyId/);
    assert.match(actions, /profileId/);
    assert.match(actions, /email/);
    assert.match(actions, /relationship/);
    assert.match(actions, /canViewBalance/);
    assert.match(actions, /canPayDues/);
    assert.match(actions, /canViewDocuments/);
    assert.match(actions, /canInviteMembers/);
    assert.match(actions, /redirect\(`\/admin\/users\?\$\{params\.toString\(\)\}`\)/);
    assert.match(actions, /userAction/);
    assert.match(actions, /userActionField/);
    assert.match(actions, /USER_ACTION_FIELDS/);
    assert.match(actions, /safeActionField/);
    assert.match(actions, /params\.set\("userActionField", safeField\)/);
    assert.match(actions, /invalid|denied|unavailable|conflict/);

    assert.doesNotMatch(
      actions,
      /JSON\.parse|capabilitiesJson|formData\.get\("capabilities"\)|communityId|createServiceRoleClient|service-role|error\.message|SUPABASE_SERVICE_ROLE_KEY|SUPABASE_SECRET_KEY/i,
    );
  });

  it("replaces the users placeholder with an accessible permission-backed management page", () => {
    const pagePath = "app/(admin)/admin/users/page.tsx";

    assert.ok(existsSync(join(root, pagePath)));

    const page = read(pagePath);

    assert.match(page, /listAdminUsers/);
    assert.match(page, /listAdminMemberships/);
    assert.match(page, /inviteAdminPropertyMemberAction/);
    assert.match(page, /updateAdminPropertyMembershipAction/);
    assert.match(page, /activateAdminPropertyMembershipAction/);
    assert.match(page, /suspendAdminPropertyMembershipAction/);
    assert.match(page, /removeAdminPropertyMembershipAction/);
    assert.match(page, /adminUsersHref/);
    assert.match(page, /pageOffset/);
    assert.match(page, /PAGE_SIZE \+ 1/);
    assert.match(page, /PaginationControls/);
    assert.match(page, /ACTION_NOTICE_FIELDS/);
    assert.match(page, /safeNoticeField/);
    assert.match(page, /profileStatus/);
    assert.match(page, /membershipStatus/);
    assert.match(page, /membershipStatus === "removed"/);
    assert.match(page, /User management/);
    assert.match(page, /Invite member/);
    assert.match(page, /Search users/);
    assert.match(page, /Profile status/);
    assert.match(page, /Relationship/);
    assert.match(page, /Membership status/);
    assert.match(page, /Can view balance/);
    assert.match(page, /Can pay dues/);
    assert.match(page, /Can view documents/);
    assert.match(page, /Can invite members/);
    assert.match(page, /Invited by/);
    assert.match(page, /membership\.invitedByLabel/);
    assert.match(page, /Removed/);
    assert.match(page, /membership\.removedAt/);
    assert.match(page, /membership\.status === "invited" \|\| membership\.status === "suspended"/);
    assert.match(page, /membership\.status === "invited" \|\| membership\.status === "active"/);
    assert.match(page, /membership\.status !== "removed"/);
    assert.match(page, /No status actions available/);
    assert.match(page, /No users found|No memberships found/);
    assert.match(page, /Not available for your role|You do not have permission/);
    assert.match(page, /aria-live="polite"/);
    assert.match(page, /htmlFor=/);
    assert.match(page, /focus-visible:outline/);
    assert.match(page, /rounded-sm/);
    assert.match(page, /min-w-0/);
    assert.match(page, /break-words/);
    assert.match(page, /membership-\$\{membership\.id\}/);

    assert.doesNotMatch(
      page,
      /AdminPlaceholderSection|<main\b|<\/main>|createServiceRoleClient|service-role|error\.message|stripe_|storagePath|storageBucket|messageBody|guestEmail|guestPhone|role assignment|admin\.roles\.manage/i,
    );
  });

  it("enables admin user navigation through admin.users.manage", () => {
    const workspacePath = "server/services/auth/admin-workspace.ts";
    const service = read(workspacePath);
    const usersItemStart = service.indexOf('label: "Users"');
    const usersItem = service.slice(usersItemStart, service.indexOf('label: "Payments"', usersItemStart));

    assert.match(usersItem, /href: "\/admin\/users"/);
    assert.match(usersItem, /currentStatus: "available"/);
    assert.match(usersItem, /permissionKey: "admin\.users\.manage"/);
  });

  it("keeps admin membership internals out of public, resident, guest, nav, and adjacent services", () => {
    const forbiddenInternals =
      /user-membership-management|listAdminUsers|listAdminMemberships|inviteAdminPropertyMember|updateAdminPropertyMembership|activateAdminPropertyMembership|suspendAdminPropertyMembership|removeAdminPropertyMembership/i;
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
      "server/services/payments/admin-payment-management.ts",
      "server/services/documents/document-metadata.ts",
      "server/services/messages/admin-message-inbox.ts",
      "server/services/auth/permissions.ts",
    ];
    const content = readExisting(adjacentFiles);

    assert.doesNotMatch(content, forbiddenInternals);
  });
});
