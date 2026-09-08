import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const servicePath = "server/services/compliance/compliance-reminder-job.ts";
const routePath = "app/api/jobs/compliance-reminders/route.ts";
const migrationPath = "supabase/migrations/202609080002_compliance_reminder_rules_and_deliveries.sql";
const service = readFileSync(join(root, servicePath), "utf8");
const route = readFileSync(join(root, routePath), "utf8");
const migration = readFileSync(join(root, migrationPath), "utf8");
const timing = readFileSync(join(root, "lib/compliance-reminder-timing.ts"), "utf8");

describe("story 6.3 compliance reminder job", () => {
  it("defines scoped reminder rules and unique delivery claims", () => {
    assert.ok(existsSync(join(root, migrationPath)));
    assert.match(migration, /create table if not exists public\.compliance_reminder_rules/i);
    assert.match(migration, /create table if not exists public\.compliance_reminder_deliveries/i);
    assert.match(migration, /idempotency_key text not null unique/i);
    assert.match(migration, /community_id uuid not null references public\.communities/i);
    assert.match(migration, /compliance_event_id uuid references public\.compliance_calendar_events/i);
    assert.match(migration, /compliance_task_id uuid references public\.compliance_tasks/i);
  });

  it("selects due records, claims idempotently, retries failures, and logs outcomes", () => {
    assert.match(service, /days_before_due/);
    assert.match(service, /\.gte\("due_at"/);
    assert.match(service, /reminderDueWindow/);
    assert.match(service, /roles\.community_id/);
    assert.match(service, /idempotencyKey/);
    assert.match(service, /\.eq\("status", "failed"\)/);
    assert.match(service, /attempt_count: existing\.attempt_count \+ 1/);
    assert.match(service, /sendEmail/);
    assert.match(service, /\.from\("email_logs"\)/);
    assert.match(service, /status: "failed"/);
    assert.match(service, /related_compliance_event_id/);
    assert.match(service, /claim\.attemptCount/);
    assert.match(timing, /Date\.UTC/);
  });

  it("fails closed before loading reminder data", () => {
    assert.match(route, /CRON_SECRET/);
    assert.match(route, /authorization/);
    assert.match(route, /x-cron-secret/);
    assert.match(route, /return NextResponse\.json\(\{ ok: false, code: "unauthorized" \}/);
    assert.match(route, /isAuthorized\(request\)/);
    assert.match(route, /runComplianceReminderJob/);
    assert.ok(route.indexOf("isAuthorized(request)") < route.indexOf("runComplianceReminderJob()"));
  });

  it("documents a real concurrent database claim test", () => {
    const concurrencyTest = readFileSync(join(root, "tests/integration/compliance-reminder-concurrency.sh"), "utf8");
    assert.match(concurrencyTest, /pg_sleep/);
    assert.match(concurrencyTest, /FIRST_PID/);
    assert.match(concurrencyTest, /unique|idempotency_key/i);
  });
});
