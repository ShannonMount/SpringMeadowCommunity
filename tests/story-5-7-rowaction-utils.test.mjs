import { describe, it } from "node:test";
import assert from "node:assert/strict";
import path from "node:path";

const utilPath = path.join(process.cwd(), "components", "admin", "data-table", "row-action-utils.js");
const mod = await import("file://" + utilPath);
const { buildRowActionMap, buildStableIdMap } = mod;

describe("row-action-utils", () => {
  it("throws when rowActions array provided without rowKey", () => {
    const data = [{ id: 1 }, { id: 2 }];
    const actions = [1, 2];
    let threw = false;
    try {
      buildRowActionMap(actions, data, undefined);
    } catch (e) {
      threw = true;
    }
    assert.ok(threw, "Expected throw when rowKey missing");
  });

  it("returns a map and warns on duplicate ids", () => {
    const data = [{ id: 1 }, { id: 1 }];
    const actions = ["a", "b"];
    const warnings = [];
    const origWarn = console.warn;
    console.warn = (...args) => warnings.push(args);

    try {
      const m = buildRowActionMap(actions, data, "id");
      assert.strictEqual(m.get('1'), 'b');
    } finally {
      console.warn = origWarn;
    }

    assert.ok(warnings.length >= 1);
  });

  it("buildStableIdMap assigns stable ids even without rowKey", () => {
    const data = [{ foo: 1 }, { foo: 2 }];
    const m = buildStableIdMap(data, undefined);
    const ids = Array.from(m.values());
    assert.strictEqual(ids.length, 2);
    assert.ok(ids[0].startsWith('__gen_'));
  });
});
