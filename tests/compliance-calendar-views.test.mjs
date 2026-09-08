import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const service = readFileSync(join(root, "server/services/admin/compliance-calendar.ts"), "utf8");
const page = readFileSync(join(root, "app/(admin)/admin/compliance/page.tsx"), "utf8");
const migration = readFileSync(join(root, "supabase/migrations/202609080001_compliance_calendar_legal_completion_guard.sql"), "utf8");
const managementMigration = readFileSync(join(root, "supabase/migrations/202609070001_compliance_calendar_management.sql"), "utf8");
const story = readFileSync(join(root, "_bmad-output/implementation-artifacts/6-2-compliance-calendar-views-and-status-tracking.md"), "utf8");

describe("story 6.2 compliance calendar views", () => {
  it("supports scoped date, status, type, and assignment filtering", () => {
    assert.match(service, /filters\?: ComplianceCalendarFilters/);
    assert.match(service, /from\?: string/);
    assert.match(service, /assignedProfileId\?: string/);
    assert.match(service, /filterComplianceEvents\(events, input\.filters\)/);
    const filters = readFileSync(join(root, "lib/compliance-calendar-filters.ts"), "utf8");
    assert.match(filters, /event\.assignedProfileIds\.includes/);
    assert.match(filters, /filtered|return events\.filter/);
    assert.match(service, /tasks: filteredTasks/);
  });

  it("renders month and list views with accessible status labels", () => {
    assert.match(page, /MonthView/);
    assert.match(page, /value="month"/);
    assert.match(page, /name="status"/);
    assert.match(page, /name="type"/);
    assert.match(page, /name="assignedProfileId"/);
    assert.match(page, /Previous month/);
    assert.match(page, /Next month/);
    assert.match(page, /monthHref/);
    assert.match(page, /aria-label={`Status:/);
    assert.match(page, /sr-only/);
    for (const status of ["upcoming", "in_progress", "ready_for_review", "completed", "blocked", "deferred", "overdue", "legal_review_required"]) {
      assert.match(page, new RegExp(`"${status}"`));
    }
  });

  it("keeps the story requirements explicit", () => {
    assert.match(story, /month and list views/i);
    assert.match(story, /date range, status, type, and assignment filters/i);
    assert.match(story, /accessible/i);
    assert.match(story, /legal-sensitive completion/i);
  });

  it("requires reviewer permission for legal-sensitive task completion", () => {
    assert.match(migration, /event_is_legal_sensitive/);
    assert.match(migration, /legal\.workflow\.review/);
    assert.match(migration, /new\.status <> 'done'/);
    assert.match(migration, /before insert or update of status/);
    assert.match(managementMigration, /evidence = coalesce\(task_evidence/);
  });
});
