import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { reminderDueWindow } from "../lib/compliance-reminder-timing";

describe("compliance reminder timing", () => {
  it("selects the full UTC calendar day instead of a moving 24-hour window", () => {
    const { dueStart, dueEnd } = reminderDueWindow(new Date("2026-09-08T23:45:00.000Z"), 1);

    assert.equal(dueStart.toISOString(), "2026-09-09T00:00:00.000Z");
    assert.equal(dueEnd.toISOString(), "2026-09-10T00:00:00.000Z");
  });
});
