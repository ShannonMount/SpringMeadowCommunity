import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

describe("Story 5.8 - audit log viewer", () => {
  it("has a real admin audit log service and page wiring", () => {
    const servicePath = path.join(process.cwd(), "server", "services", "admin", "audit-log-viewer.ts");
    const pagePath = path.join(process.cwd(), "app", "(admin)", "admin", "audit", "page.tsx");

    assert.ok(fs.existsSync(servicePath), `Expected audit log service at ${servicePath}`);

    const pageSource = fs.readFileSync(pagePath, "utf8");
    assert.match(pageSource, /listAuditLogs|getAuditLogViewer|StandardTable/i, "Expected admin audit page to use the real audit log viewer");
    assert.match(pageSource, /audit\.logs\.view|AUDIT_LOGS_ACCESS_PERMISSION/i, "Expected page wiring to include the audit permission gate");
  });

  it("renders audit details without exposing destructive delete actions", () => {
    const pagePath = path.join(process.cwd(), "app", "(admin)", "admin", "audit", "page.tsx");
    const pageSource = fs.readFileSync(pagePath, "utf8");

    assert.match(pageSource, /targetId|target_id|requestId|request_id|beforeData|afterData|metadata/i, "Expected audit viewer to expose reviewable audit details");
    assert.match(pageSource, /Action|Actor|Target|Reason|Request|Before|After/i, "Expected audit table to show key review columns");
    assert.doesNotMatch(pageSource, /delete.*audit|erase.*audit|remove.*audit|archive.*audit/i, "Expected audit logs to remain read-only");
  });
});
