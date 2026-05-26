import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();

function read(path) {
  return readFileSync(join(root, path), "utf8");
}

describe("role and permission assignment foundation", () => {
  it("defines roles/profile_roles schema, indexes, RLS, and default role seeds", () => {
    const migrationPath = "supabase/migrations/202605100003_create_roles_and_profile_roles.sql";

    assert.ok(existsSync(join(root, migrationPath)));

    const migration = read(migrationPath);

    assert.match(migration, /create table if not exists public\.roles/i);
    assert.match(migration, /community_id uuid not null references public\.communities\(id\) on delete cascade/i);
    assert.match(migration, /key text not null/i);
    assert.match(migration, /permissions text\[\] not null default '\{\}'/i);
    assert.match(migration, /system_role boolean not null default false/i);
    assert.match(migration, /unique \(community_id, key\)/i);
    assert.match(migration, /create table if not exists public\.profile_roles/i);
    assert.match(migration, /profile_id uuid not null references public\.profiles\(id\) on delete cascade/i);
    assert.match(migration, /role_id uuid not null references public\.roles\(id\) on delete cascade/i);
    assert.match(migration, /scope text not null default 'community'/i);
    assert.match(migration, /scope_id uuid/i);
    assert.match(migration, /status text not null default 'active'/i);
    assert.match(migration, /assigned_by uuid references public\.profiles\(id\)/i);
    assert.match(migration, /assigned_at timestamptz not null default now\(\)/i);
    assert.match(migration, /removed_at timestamptz/i);
    assert.match(migration, /constraint profile_roles_scope_id_check check/i);
    assert.match(migration, /unique \(community_id, profile_id, role_id, scope, scope_id\)/i);
    assert.match(migration, /profile_roles_profile_idx/i);
    assert.match(migration, /profile_roles_role_idx/i);
    assert.match(migration, /alter table public\.roles enable row level security/i);
    assert.match(migration, /alter table public\.profile_roles enable row level security/i);
    assert.match(migration, /create policy "read community roles"/i);
    assert.match(migration, /create policy "read own active profile roles"/i);

    for (const role of [
      "resident",
      "board_member",
      "admin",
      "vendor_applicant",
      "approved_vendor",
      "pool_worker",
      "legal_reviewer",
    ]) {
      assert.match(migration, new RegExp(`'${role}'`));
    }

    for (const permission of [
      "resident.portal.access",
      "property.members.invite",
      "admin.roles.manage",
      "admin.users.manage",
      "board.workspace.access",
      "audit.logs.view",
      "legal.workflow.review",
      "vendor.portal.access",
      "pool.logs.submit",
    ]) {
      assert.match(migration, new RegExp(permission.replaceAll(".", "\\.")));
    }

    assert.match(migration, /on conflict \(community_id, key\) do update/i);
    assert.doesNotMatch(
      migration,
      /create table if not exists public\.(payments|documents|message_threads|compliance|audit_logs)/i,
    );
  });

  it("defines active-only permission helpers and permission-gated assignment RPCs", () => {
    const migration = read("supabase/migrations/202605100003_create_roles_and_profile_roles.sql");

    assert.match(migration, /app\.has_permission\(/);
    assert.match(migration, /target_community_id uuid/);
    assert.match(migration, /permission_key text/);
    assert.match(migration, /target_scope text default null/);
    assert.match(migration, /target_scope_id uuid default null/);
    assert.match(migration, /pr\.status = 'active'/i);
    assert.match(migration, /roles\.community_id = target_community_id/i);
    assert.match(migration, /permission_key = any\(roles\.permissions\)/i);
    assert.match(migration, /pr\.scope = 'community'/i);
    assert.match(migration, /pr\.scope = target_scope/i);
    assert.match(migration, /pr\.scope_id = target_scope_id/i);
    assert.match(migration, /public\.has_permission\(/);
    assert.match(migration, /public\.assign_profile_role\(/);
    assert.match(migration, /public\.suspend_profile_role\(/);
    assert.match(migration, /public\.remove_profile_role\(/);
    assert.match(migration, /app\.has_permission\(target_community_id, 'admin\.roles\.manage'/);
    assert.match(migration, /target_scope is null/i);
    assert.match(migration, /if target_scope = 'community' then/i);
    assert.match(migration, /target_scope_id = '00000000-0000-0000-0000-000000000000'::uuid/i);
    assert.match(migration, /insert into public\.profile_roles/i);
    assert.match(migration, /status = 'suspended'/i);
    assert.match(migration, /status = 'removed'/i);
    assert.match(migration, /removed_at = removed_at_value/i);
    assert.match(migration, /'target_profile_id'/i);
    assert.match(migration, /'role_key'/i);
    assert.match(migration, /'scope_id'/i);
    assert.match(migration, /'assigned_at'/i);
    assert.match(migration, /'previous_removed_at'/i);
  });

  it("implements server-only permission and role assignment services with audit intent", () => {
    const permissionServicePath = "server/services/auth/permissions.ts";
    const auditPath = "server/services/audit/write-audit-log.ts";

    assert.ok(existsSync(join(root, permissionServicePath)));
    assert.ok(existsSync(join(root, auditPath)));

    const service = read(permissionServicePath);
    const audit = read(auditPath);

    assert.match(service, /import "server-only"/);
    assert.match(service, /getCurrentProfile/);
    assert.match(service, /hasPermission/);
    assert.match(service, /\.rpc\("has_permission"/);
    assert.match(service, /assignProfileRole/);
    assert.match(service, /suspendProfileRole/);
    assert.match(service, /removeProfileRole/);
    assert.match(service, /\.rpc\("assign_profile_role"/);
    assert.match(service, /\.rpc\("suspend_profile_role"/);
    assert.match(service, /\.rpc\("remove_profile_role"/);
    assert.match(service, /writeAuditLog/);
    assert.match(service, /role\.assign/);
    assert.match(service, /role\.suspend/);
    assert.match(service, /role\.remove/);
    assert.match(service, /permission-denied/);
    assert.match(service, /authorized/);
    assert.match(service, /function roleMutationDetails/);
    assert.match(service, /targetProfileId: result\.target_profile_id/);
    assert.match(service, /roleKey: result\.role_key/);
    assert.match(service, /assignedAt: result\.assigned_at/);
    assert.match(service, /hasFallbackRemovedAt/);
    assert.match(service, /removedAt: hasFallbackRemovedAt \? fallback\.removedAt \?\? null : result\.removed_at \?\? null/);

    assert.match(audit, /import "server-only"/);
    assert.match(audit, /writeAuditLog/);
    assert.match(audit, /actorProfileId/);
    assert.match(audit, /targetType/);
    assert.match(audit, /before/);
    assert.match(audit, /after/);

    assert.doesNotMatch(
      `${service}\n${audit}`,
      /SERVICE_ROLE|service_role|raw Supabase error|error\.message|owner_display_name|current_balance|payment history|private documents|message contents/i,
    );
  });

  it("keeps role and permission work inside the intended privacy and scope boundaries", () => {
    const migration = read("supabase/migrations/202605100003_create_roles_and_profile_roles.sql");
    const service = read("server/services/auth/permissions.ts");
    const audit = read("server/services/audit/write-audit-log.ts");
    const combined = `${migration}\n${service}\n${audit}`;

    assert.doesNotMatch(combined, /stripe|checkout|payment_intent|document_access|message_threads/i);
    assert.doesNotMatch(combined, /dues balance|payment history|private documents|owner name|message contents/i);
    assert.doesNotMatch(combined, /SERVICE_ROLE|service_role/);
  });
});
