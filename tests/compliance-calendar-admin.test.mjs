import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();

function read(relativePath) {
  return readFileSync(join(root, relativePath), "utf8");
}

describe("story 6.1 compliance calendar admin access", () => {
  it("adds a permission-gated compliance calendar service and page", () => {
    const servicePath = "server/services/admin/compliance-calendar.ts";
    const pagePath = "app/(admin)/admin/compliance/page.tsx";

    assert.ok(existsSync(join(root, servicePath)), `Expected compliance service at ${servicePath}`);
    assert.ok(existsSync(join(root, pagePath)), `Expected compliance page at ${pagePath}`);

    const service = read(servicePath);
    const page = read(pagePath);

    assert.match(service, /admin\.compliance\.manage|legal\.workflow\.review|hasPermission/i, "Expected compliance service to enforce compliance permissions");
    assert.match(service, /compliance_calendar_events|compliance_tasks|community_id/i, "Expected compliance service to query the event/task foundation");
    assert.match(page, /listComplianceCalendar|getComplianceCalendar|Compliance Calendar|Upcoming|Overdue/i, "Expected admin compliance page to render live compliance data");
    assert.doesNotMatch(page, /placeholder|Not configured yet/i, "Expected the page to be a real compliance dashboard instead of the placeholder stub");
  });
});
