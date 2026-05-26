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

describe("admin community settings", () => {
  it("adds a server-only admin community settings service with safe unions and RPC mapping", () => {
    const servicePath = "server/services/admin/community-settings.ts";

    assert.ok(existsSync(join(root, servicePath)));

    const service = read(servicePath);

    assert.match(service, /import "server-only"/);
    assert.match(service, /createClient/);
    assert.match(service, /getCurrentProfile/);
    assert.match(service, /hasPermission/);
    assert.match(service, /admin\.settings\.manage/);
    assert.match(service, /DEFAULT_COMMUNITY_SLUG = "spring-meadow-community"/);
    assert.match(service, /\.from\("communities"\)/);
    assert.match(service, /\.eq\("slug", communitySlug\)/);
    assert.match(service, /\.rpc\("get_admin_community_settings"/);
    assert.match(service, /\.rpc\("update_admin_community_settings"/);
    assert.match(service, /permission-denied/);
    assert.match(service, /settings-unavailable/);
    assert.match(service, /invalid-input/);
    assert.match(service, /unauthenticated/);
    assert.match(service, /kind: "settings"/);

    assert.doesNotMatch(
      service,
      /createServiceRoleClient|service-role|roles\.permissions|profile_roles|audit_logs|error\.message|stripe_|SUPABASE_SERVICE_ROLE_KEY/i,
    );
  });

  it("adds permission-gated RPC migration without leaking private fields", () => {
    const migrationPath = "supabase/migrations/202605110022_community_settings_management.sql";

    assert.ok(existsSync(join(root, migrationPath)));

    const migration = read(migrationPath);

    assert.match(migration, /create or replace function public\.get_admin_community_settings/i);
    assert.match(migration, /create or replace function public\.update_admin_community_settings/i);
    assert.match(migration, /returns jsonb/i);
    assert.match(migration, /security definer/i);
    assert.match(migration, /app\.current_profile_id\(\)/i);
    assert.match(migration, /app\.has_permission\(target_community_id, 'admin\.settings\.manage'\)/i);
    assert.match(migration, /revoke all on function public\.get_admin_community_settings\(text\) from public, anon, authenticated/i);
    assert.match(migration, /grant execute on function public\.get_admin_community_settings\(text\) to authenticated/i);
    assert.match(migration, /revoke all on function public\.update_admin_community_settings\(text, jsonb, jsonb, jsonb, jsonb\) from public, anon, authenticated/i);
    assert.match(migration, /grant execute on function public\.update_admin_community_settings\(text, jsonb, jsonb, jsonb, jsonb\) to authenticated/i);

    assert.doesNotMatch(
      migration,
      /owner_display_name|account_number|guest_email|guest_phone|message_body|storage_bucket|storage_path|stripe_checkout_session_id|stripe_payment_intent_id|stripe_charge_id|stripe_customer_id|stripe_receipt_url|SUPABASE_SERVICE_ROLE_KEY/i,
    );
  });
});
