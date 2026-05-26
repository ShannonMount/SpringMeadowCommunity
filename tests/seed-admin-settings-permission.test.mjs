import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();

function read(path) {
  return readFileSync(join(root, path), "utf8");
}

describe("migration seeds admin.settings.manage", () => {
  it("adds admin.settings.manage to the admin role via migration", () => {
    const migrationPath = "supabase/migrations/202605110023_seed_admin_settings_permission.sql";

    assert.ok(existsSync(join(root, migrationPath)), `${migrationPath} should exist`);

    const migration = read(migrationPath);

    assert.match(migration, /admin.settings.manage/);
    assert.match(migration, /update public.roles/);
  });
});
