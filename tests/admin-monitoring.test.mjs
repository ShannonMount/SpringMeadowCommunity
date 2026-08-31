import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();

function read(relativePath) {
  return readFileSync(join(root, relativePath), "utf8");
}

describe("Story 5.9 - admin monitoring", () => {
  it("adds a permission-gated monitoring summary service and page", () => {
    const servicePath = "server/services/admin/monitoring-summary.ts";
    const pagePath = "app/(admin)/admin/monitoring/page.tsx";

    assert.ok(existsSync(join(root, servicePath)), `Expected monitoring service at ${servicePath}`);
    assert.ok(existsSync(join(root, pagePath)), `Expected monitoring page at ${pagePath}`);

    const service = read(servicePath);
    const page = read(pagePath);

    assert.match(service, /board\.workspace\.access|WORKSPACE_ACCESS_PERMISSION/i, "Expected monitoring service to require workspace access");
    assert.match(service, /payment_events|email_logs|monitoring/i, "Expected monitoring summary to aggregate operational logs");
    assert.match(service, /receivedCount|processedCount|failedCount|ignoredCount|queuedCount|sentCount|deliveredCount|bouncedCount|suppressedCount/i, "Expected summary to enumerate status counts");
    assert.doesNotMatch(service, /STRIPE_SECRET_KEY|SUPABASE_SERVICE_ROLE_KEY|RESEND_API_KEY|private key|secret/i, "Expected monitoring service to avoid exposing credentials");
    assert.doesNotMatch(service, /recipient_email|guest_email|guest_phone|payload|raw_payload|provider_payload|event_payload/i, "Expected monitoring service to avoid raw recipient and payload exposure");

    assert.match(page, /getAdminMonitoringSummary|Monitoring/i, "Expected page to render the monitoring summary");
    assert.match(page, /Webhook|Email|Job|failed|queued|sent|delivered|bounced|suppressed|processing_status/i, "Expected page to surface operation status summaries");
    assert.doesNotMatch(page, /recipient_email|guest_email|guest_phone|payload|raw_payload|provider_payload|event_payload/i, "Expected page to avoid raw sensitive operational details");
  });
});
