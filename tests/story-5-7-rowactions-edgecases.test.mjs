import { describe, it, afterEach } from "node:test";
import assert from "node:assert/strict";
import { render } from "@testing-library/react";
import React from "react";
import { JSDOM } from "jsdom";

import path from "node:path";

const dom = new JSDOM("<!doctype html><html><body></body></html>");
Object.assign(globalThis, {
  window: dom.window,
  document: dom.window.document,
  Node: dom.window.Node,
  HTMLElement: dom.window.HTMLElement,
  navigator: dom.window.navigator,
});

const compPath = path.join(process.cwd(), "components", "admin", "data-table", "StandardTable.tsx");
const { default: StandardTable } = await import("file://" + compPath);

describe("Story 5.7 - rowActions edge cases", () => {
  afterEach(() => {
    // cleanup DOM between tests (testing-library cleanup is automatic in v13+ but keep safe)
    // noop
  });

  it("throws when rowActions is array but rowKey is missing", () => {
    const columns = [{ key: "id", title: "ID", sortable: true }];
    const data = [{ id: 1 }, { id: 2 }];
    const rowActions = [React.createElement("div", { key: "a" }, "A"), React.createElement("div", { key: "b" }, "B")];

    let threw = false;
    try {
      render(React.createElement(StandardTable, { columns, data, rowActions }));
    } catch (err) {
      threw = true;
    }

    assert.ok(threw, "Expected StandardTable to throw when rowActions is array and rowKey missing");
  });

  it("warns on duplicate rowKey values when building rowActionMap", () => {
    const columns = [{ key: "id", title: "ID", sortable: true }];
    const data = [{ id: 1 }, { id: 1 }];
    const rowActions = [React.createElement("div", { key: "a" }, "A"), React.createElement("div", { key: "b" }, "B")];

    const warnings = [];
    const origWarn = console.warn;
    console.warn = (...args) => warnings.push(args);

    try {
      render(React.createElement(StandardTable, { columns, data, rowActions, rowKey: "id" }));
    } finally {
      console.warn = origWarn;
    }

    assert.ok(warnings.length >= 1, "Expected at least one duplicate-id warning");
  });

  it("keeps actions aligned when rows are re-hydrated as new object instances (matching ids)", () => {
    const columns = [{ key: "id", title: "ID", sortable: true }];
    const data1 = [{ id: 1 }, { id: 2 }];
    const rowActions = [React.createElement("div", { "data-test-id": "act-1" }, "A1"), React.createElement("div", { "data-test-id": "act-2" }, "A2")];

    const { rerender, container } = render(React.createElement(StandardTable, { columns, data: data1, rowActions, rowKey: "id" }));

    // clone objects to simulate re-hydration
    const data2 = data1.map((d) => ({ ...d }));

    rerender(React.createElement(StandardTable, { columns, data: data2, rowActions, rowKey: "id" }));

    // Actions should still be present in DOM
    const acts = container.querySelectorAll("[data-test-id]");
    assert.strictEqual(acts.length, 2);
  });
});
