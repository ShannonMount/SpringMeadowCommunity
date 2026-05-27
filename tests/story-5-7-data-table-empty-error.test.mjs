import { describe, it } from "node:test";
import assert from "node:assert/strict";
import path from "node:path";

describe("Story 5.7 - StandardTable accessible empty/error states", () => {
  it("getEmptyState returns sensible defaults and honors action", async () => {
    const utilPath = path.join(process.cwd(), "components", "admin", "data-table", "standard-table-utils.js");
    const mod = await import("file://" + utilPath);

    const { getEmptyState } = mod;

    const empty = getEmptyState();
    assert.strictEqual(typeof empty.title, "string");
    assert.strictEqual(typeof empty.description, "string");

    const withAction = getEmptyState({ action: { href: "/create", label: "Create" } });
    assert.ok(withAction.action, "Expected action to be present");
    assert.strictEqual(withAction.action.href, "/create");
    assert.strictEqual(withAction.action.label, "Create");
  });

  it("getErrorState returns provided message and default title", async () => {
    const utilPath = path.join(process.cwd(), "components", "admin", "data-table", "standard-table-utils.js");
    const mod = await import("file://" + utilPath);

    const { getErrorState } = mod;

    const err = getErrorState("boom");
    assert.strictEqual(err.description, "boom");
    assert.strictEqual(err.title, "Unable to load");
  });
});
