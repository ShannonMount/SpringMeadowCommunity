import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const migration = readFileSync(join(root, "supabase/migrations/202609080004_annual_association_meetings.sql"), "utf8");
const permissions = readFileSync(join(root, "supabase/migrations/202609080003_manager_meeting_permissions.sql"), "utf8");
const service = readFileSync(join(root, "server/services/admin/annual-meetings.ts"), "utf8");
const page = readFileSync(join(root, "app/(admin)/admin/meetings/page.tsx"), "utf8");
const workspace = readFileSync(join(root, "server/services/auth/admin-workspace.ts"), "utf8");

describe("story 6.4 annual association meeting workflow", () => {
  it("defines a scoped meeting model and compliance linkage", () => {
    assert.match(migration, /create table if not exists public\.annual_association_meetings/i);
    assert.match(migration, /community_id uuid not null references public\.communities/i);
    assert.match(migration, /compliance_event_id uuid references public\.compliance_calendar_events/i);
    assert.match(migration, /notice_earliest_at timestamptz/i);
    assert.match(migration, /notice_latest_at timestamptz/i);
    assert.match(migration, /type, title, description, due_at, starts_at, status/i);
  });

  it("uses North Carolina 60/10 defaults and enforces override reasons", () => {
    assert.match(migration, /meeting_notice_earliest_days, 60/i);
    assert.match(migration, /meeting_notice_latest_days, 10/i);
    assert.match(migration, /make_interval\(days => coalesce\(settings_row\.meeting_notice_earliest_days, 60\)\)/i);
    assert.match(migration, /make_interval\(days => coalesce\(settings_row\.meeting_notice_latest_days, 10\)\)/i);
    assert.match(migration, /notice_out_of_window/);
    assert.match(migration, /override_reason_value/);
  });

  it("enforces manager/admin permissions and exposes the secured admin workflow", () => {
    assert.match(permissions, /'manager'/);
    assert.match(permissions, /admin\.meetings\.manage/);
    assert.match(permissions, /admin\.compliance\.manage/);
    assert.match(service, /admin\.meetings\.manage/);
    assert.match(service, /create_annual_association_meeting/);
    assert.match(service, /mark_annual_association_notice_sent/);
    assert.match(page, /createAnnualMeetingAction/);
    assert.match(page, /markAnnualNoticeSentAction/);
    assert.match(workspace, /Annual Meetings/);
    assert.match(workspace, /admin\.meetings\.manage/);
  });
});
