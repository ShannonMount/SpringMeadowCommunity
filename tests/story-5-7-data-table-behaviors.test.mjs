import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

describe("Story 5.7 - StandardTable behaviors (unit checks)", () => {
  it("behaves: filterData, sortData, and paginateData", async () => {
    const utilPath = path.join(process.cwd(), "components", "admin", "data-table", "standard-table-utils.js");
    const mod = await import("file://" + utilPath);

    const { filterData, sortData, paginateData } = mod;

    // filterData: case-insensitive match on provided columns
    const data = [
      { id: 1, name: "Alice", city: "Raleigh" },
      { id: 2, name: "Bob", city: "Charlotte" },
      { id: 3, name: "Carol", city: "Asheville" },
    ];

    const cols = [{ key: "name" }, { key: "city" }];
    const filtered = filterData(data, "alice", cols);
    assert.deepStrictEqual(filtered.map((r) => r.id), [1]);

    // sortData: numeric ascending/descending
    const nums = [
      { id: 1, n: 2 },
      { id: 2, n: 10 },
      { id: 3, n: 1 },
    ];

    const sortedAsc = sortData(nums, "n", "asc").map((r) => r.id);
    assert.deepStrictEqual(sortedAsc, [3, 1, 2]);

    const sortedDesc = sortData(nums, "n", "desc").map((r) => r.id);
    assert.deepStrictEqual(sortedDesc, [2, 1, 3]);

    // paginateData: simple slicing
    const arr = Array.from({ length: 7 }, (_, i) => i);
    assert.deepStrictEqual(paginateData(arr, 0, 3), [0, 1, 2]);
    assert.deepStrictEqual(paginateData(arr, 1, 3), [3, 4, 5]);
    assert.deepStrictEqual(paginateData(arr, 2, 3), [6]);
  });
});
