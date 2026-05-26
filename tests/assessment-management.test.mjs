import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();

function read(path) {
  return readFileSync(join(root, path), "utf8");
}

describe("assessment cycle and property assessment management", () => {
  it("defines assessment schema, constraints, indexes, RLS, and admin permission seed", () => {
    const migrationPath =
      "supabase/migrations/202605110001_create_assessment_cycles_and_assessments.sql";

    assert.ok(existsSync(join(root, migrationPath)));

    const migration = read(migrationPath);

    assert.match(migration, /create table if not exists public\.assessment_cycles/i);
    assert.match(migration, /community_id uuid not null references public\.communities\(id\) on delete cascade/i);
    assert.match(migration, /type text not null check \(type in \('annual', 'quarterly', 'monthly', 'special'\)\)/i);
    assert.match(migration, /status text not null default 'draft' check \(status in \('draft', 'active', 'closed', 'archived'\)\)/i);
    assert.match(migration, /period_start date not null/i);
    assert.match(migration, /period_end date not null/i);
    assert.match(migration, /due_date date not null/i);
    assert.match(migration, /default_amount_cents integer not null/i);
    assert.match(migration, /default_amount_cents > 0/i);
    assert.match(migration, /currency text not null default 'USD'/i);
    assert.match(migration, /late_fee jsonb/i);
    assert.match(migration, /interest jsonb/i);
    assert.match(migration, /created_by uuid references public\.profiles\(id\)/i);

    assert.match(migration, /create table if not exists public\.assessments/i);
    assert.match(migration, /property_id uuid not null references public\.properties\(id\) on delete cascade/i);
    assert.match(migration, /assessment_cycle_id uuid references public\.assessment_cycles\(id\)/i);
    assert.match(migration, /type text not null check \(type in \('regular_dues', 'special_assessment', 'late_fee', 'interest', 'fine', 'damage_assessment', 'manual_adjustment'\)\)/i);
    assert.match(migration, /amount_cents integer not null/i);
    assert.match(migration, /paid_cents integer not null default 0/i);
    assert.match(migration, /balance_cents integer not null/i);
    assert.match(migration, /paid_cents <= amount_cents/i);
    assert.match(migration, /balance_cents = amount_cents - paid_cents/i);
    assert.match(migration, /status text not null default 'open'/i);
    assert.match(migration, /source_workflow_table text/i);
    assert.match(migration, /source_workflow_id uuid/i);

    for (const indexName of [
      "assessment_cycles_status_due_idx",
      "assessment_cycles_type_period_idx",
      "assessments_property_due_idx",
      "assessments_status_due_idx",
      "assessments_cycle_idx",
    ]) {
      assert.match(migration, new RegExp(indexName, "i"));
    }

    assert.match(migration, /validate_assessment_community_scope/i);
    assert.match(migration, /properties\.community_id <> new\.community_id/i);
    assert.match(migration, /assessment_cycles\.community_id <> new\.community_id/i);
    assert.match(migration, /recalculate_property_assessment_summary/i);
    assert.match(migration, /current_balance_cents/i);
    assert.match(migration, /next_due_date/i);
    assert.match(migration, /delinquency_status/i);
    assert.match(migration, /alter table public\.assessment_cycles enable row level security/i);
    assert.match(migration, /alter table public\.assessments enable row level security/i);
    assert.match(migration, /create policy "read assessment cycles for managers"/i);
    assert.match(migration, /create policy "read assessments for managers"/i);
    assert.match(migration, /for select/i);
    assert.match(migration, /app\.has_permission\(community_id, 'admin\.assessments\.manage'/i);
    assert.doesNotMatch(migration, /create policy "manage assessment cycles"[\s\S]*for all/i);
    assert.doesNotMatch(migration, /create policy "manage assessments"[\s\S]*for all/i);
    assert.doesNotMatch(migration, /with check \(app\.has_permission\(community_id, 'admin\.assessments\.manage'\)\)/i);
    assert.match(migration, /admin\.assessments\.manage/i);
    assert.match(migration, /where key = 'admin'/i);
    assert.doesNotMatch(migration, /where key = 'resident'[\s\S]*admin\.assessments\.manage/i);

    assert.doesNotMatch(
      migration,
      /create table if not exists public\.(payments|payment_allocations|payment_events|documents|message_threads|audit_logs)/i,
    );
  });

  it("defines permission-checked RPCs for transactional assessment mutations", () => {
    const migration = read(
      "supabase/migrations/202605110001_create_assessment_cycles_and_assessments.sql",
    );

    for (const functionName of [
      "create_assessment_cycle",
      "create_property_assessment",
      "generate_property_assessments_for_cycle",
      "update_assessment",
    ]) {
      assert.match(migration, new RegExp(`public\\.${functionName}\\(`));
    }

    assert.match(migration, /app\.current_profile_id\(\)/);
    assert.match(migration, /app\.has_permission\(target_community_id, 'admin\.assessments\.manage'\)/);
    assert.match(migration, /return jsonb_build_object\('status', 'unavailable'\)/i);
    assert.match(migration, /target_property_id uuid/);
    assert.match(migration, /target_assessment_cycle_id uuid/);
    assert.match(migration, /for update/i);
    assert.match(migration, /perform app\.recalculate_property_assessment_summary/i);
    assert.match(migration, /insert into public\.assessments/i);
    assert.match(migration, /update public\.assessments/i);
    assert.match(migration, /not exists/i);
  });

  it("implements server-only assessment management service with validation and audit intent", () => {
    const servicePath = "server/services/payments/assessment-management.ts";

    assert.ok(existsSync(join(root, servicePath)));

    const service = read(servicePath);

    assert.match(service, /import "server-only"/);
    assert.match(service, /createClient/);
    assert.match(service, /hasPermission/);
    assert.match(service, /writeAuditLog/);
    assert.match(service, /admin\.assessments\.manage/);
    assert.match(service, /createAssessmentCycle/);
    assert.match(service, /createPropertyAssessment/);
    assert.match(service, /generatePropertyAssessmentsForCycle/);
    assert.match(service, /updateAssessment/);
    assert.match(service, /\.rpc\("create_assessment_cycle"/);
    assert.match(service, /\.rpc\("create_property_assessment"/);
    assert.match(service, /\.rpc\("generate_property_assessments_for_cycle"/);
    assert.match(service, /\.rpc\("update_assessment"/);
    assert.match(service, /isUuid/);
    assert.match(service, /isDateOnly/);
    assert.match(service, /isPositiveInteger/);
    assert.match(service, /fieldErrors/);
    assert.match(service, /assessment\.cycle\.create/);
    assert.match(service, /assessment\.create/);
    assert.match(service, /assessment\.generate/);
    assert.match(service, /assessment\.update/);

    const permissionIndex = service.indexOf("requireAssessmentManagementPermission");
    const firstRpcIndex = service.indexOf(".rpc(");

    assert.ok(permissionIndex > -1);
    assert.ok(firstRpcIndex > permissionIndex);
    assert.doesNotMatch(service, /\.from\("properties"\)|\.from\("assessments"\)|\.from\("assessment_cycles"\)/);
    assert.doesNotMatch(
      service,
      /SERVICE_ROLE|service_role|error\.message|owner_display_name|account_number|public_payment_code|mailing_address|guest lookup|checkout|webhook|payment_allocations|private documents|message contents/i,
    );
  });
});
