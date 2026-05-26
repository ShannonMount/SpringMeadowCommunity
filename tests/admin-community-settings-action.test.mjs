import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();

function read(path) {
  return readFileSync(join(root, path), "utf8");
}

describe("admin community settings action and page", () => {
  it("adds a server action that parses settings form data and calls the service", () => {
    const actionPath = "server/actions/admin-settings.ts";

    assert.ok(existsSync(join(root, actionPath)));

    const action = read(actionPath);

    assert.match(action, /"use server"/);
    assert.match(action, /updateAdminCommunitySettings/);
    assert.match(action, /FormData/);
    assert.match(action, /featureFlags/);
    assert.match(action, /delinquentDaysPastDue/);
    assert.match(action, /messageRetentionDays/);
    assert.match(action, /fiscalYearStartMonth/);
    assert.match(action, /redirect\(/);
  });

  it("replaces the settings page with a server-rendered form posting to the action", () => {
    const pagePath = "app/(admin)/admin/settings/page.tsx";

    assert.ok(existsSync(join(root, pagePath)));

    const page = read(pagePath);

    assert.match(page, /getAdminCommunitySettings/);
    assert.match(page, /form action=\{updateAdminSettings\}/);
    assert.match(page, /Feature flags/);
    assert.match(page, /Community posts/);
    assert.match(page, /Maintenance requests/);
    assert.match(page, /Compliance defaults/);
    assert.match(page, /Fiscal year/);
  });
});
