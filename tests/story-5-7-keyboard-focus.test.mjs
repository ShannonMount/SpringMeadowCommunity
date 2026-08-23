import { describe, it } from "node:test";
import assert from "node:assert/strict";
import path from "node:path";

describe("Story 5.7 - StandardTable keyboard & focus", () => {
  it("arrow keys move focus and Enter toggles sort", async () => {
    // setup JSDOM globals before importing react testing helpers
    const { JSDOM } = await import("jsdom");
    const dom = new JSDOM("<!doctype html><html><body></body></html>");
    global.window = dom.window;
    global.document = dom.window.document;
    global.HTMLElement = dom.window.HTMLElement;
    global.Node = dom.window.Node;
    global.getComputedStyle = dom.window.getComputedStyle;
    global.navigator = { userAgent: "node.js" };

    const { render, fireEvent } = await import("@testing-library/react");
    const React = await import("react");

    const compPath = path.join(process.cwd(), "tests", "_test_components", "TestStandardTable.js");
    const mod = await import("file://" + compPath);
    const TestStandardTable = mod.default;

    const columns = [
      { key: "a", title: "A", sortable: true },
      { key: "b", title: "B", sortable: true },
      { key: "c", title: "C", sortable: false },
    ];

    const { container, getByTestId } = render(React.createElement(TestStandardTable, { columns }));
    const headers = container.querySelectorAll("[data-key]");
    assert.strictEqual(headers.length, 3);

    headers[0].focus();
    assert.strictEqual(document.activeElement, headers[0]);

    // move right
    fireEvent.keyDown(headers[0], { key: "ArrowRight" });
    assert.strictEqual(document.activeElement, headers[1]);

    // toggle sort on 'b'
    fireEvent.keyDown(headers[1], { key: "Enter" });
    assert.strictEqual(getByTestId("sort-state").textContent, "b:asc");

    // toggle to desc
    fireEvent.keyDown(headers[1], { key: "Enter" });
    assert.strictEqual(getByTestId("sort-state").textContent, "b:desc");

    // move left back to first
    fireEvent.keyDown(headers[1], { key: "ArrowLeft" });
    assert.strictEqual(document.activeElement, headers[0]);
  });
});
