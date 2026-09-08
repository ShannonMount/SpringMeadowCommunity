import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { filterComplianceEvents, inclusiveEnd } from "../lib/compliance-calendar-filters";

const event = (overrides: Partial<Parameters<typeof filterComplianceEvents>[0][number]> = {}) => ({
  dueAt: "2026-09-08T18:00:00.000Z",
  status: "upcoming",
  type: "board_meeting",
  assignedProfileIds: ["profile-1"],
  ...overrides,
});

describe("compliance calendar filtering", () => {
  it("includes events throughout the selected end date", () => {
    const selectedEnd = inclusiveEnd("2026-09-08");
    assert.equal(selectedEnd, Date.parse("2026-09-08T23:59:59.999Z"));
    assert.equal(filterComplianceEvents([event()], { to: "2026-09-08" }).length, 1);
  });

  it("derives overdue status for filtering without changing completed events", () => {
    const now = Date.parse("2026-09-09T00:00:00.000Z");
    assert.equal(filterComplianceEvents([event()], { status: "overdue" }, now).length, 1);
    assert.equal(filterComplianceEvents([event({ status: "completed" })], { status: "overdue" }, now).length, 0);
  });

  it("applies type and assignment filters together", () => {
    const events = [event(), event({ type: "annual_meeting", assignedProfileIds: ["profile-2"] })];
    assert.equal(filterComplianceEvents(events, { type: "annual_meeting", assignedProfileId: "profile-2" }).length, 1);
  });
});
