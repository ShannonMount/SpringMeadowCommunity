import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();

function read(path) {
  return readFileSync(join(root, path), "utf8");
}

describe("resident dues status and payment history", () => {
  it("defines payment tables and resident-safe financial read policies", () => {
    const migrationPath =
      "supabase/migrations/202605110002_create_payment_records_and_resident_financial_reads.sql";

    assert.ok(existsSync(join(root, migrationPath)));

    const migration = read(migrationPath);

    assert.match(migration, /create table if not exists public\.payments/i);
    assert.match(migration, /payer_type text not null check \(payer_type in \('resident', 'guest', 'admin_recorded'\)\)/i);
    assert.match(migration, /amount_cents integer not null check \(amount_cents > 0\)/i);
    assert.match(migration, /method text not null check \(method in \('card', 'ach', 'check', 'cash', 'manual', 'other'\)\)/i);
    assert.match(migration, /status text not null default 'created'/i);
    assert.match(migration, /check \(status in \('created', 'pending', 'succeeded', 'failed', 'refunded', 'partially_refunded', 'void'\)\)/i);
    assert.match(migration, /stripe_checkout_session_id text unique/i);
    assert.match(migration, /stripe_payment_intent_id text unique/i);
    assert.match(migration, /receipt_number text unique/i);
    assert.match(migration, /create table if not exists public\.payment_allocations/i);
    assert.match(migration, /payment_id uuid not null references public\.payments\(id\) on delete cascade/i);
    assert.match(migration, /assessment_id uuid not null references public\.assessments\(id\)/i);
    assert.match(migration, /unique \(payment_id, assessment_id\)/i);
    assert.match(migration, /create table if not exists public\.payment_events/i);
    assert.match(migration, /provider_event_id text not null/i);
    assert.match(migration, /unique \(provider, provider_event_id\)/i);
    assert.match(migration, /create view public\.resident_payment_history/i);
    assert.match(migration, /with \(security_invoker = true\)/i);
    assert.match(migration, /resident_history_rank/i);

    for (const index of [
      "payments_property_created_idx",
      "payments_profile_created_idx",
      "payments_status_created_idx",
      "payment_allocations_assessment_idx",
      "payment_events_status_idx",
    ]) {
      assert.match(migration, new RegExp(index, "i"));
    }

    assert.match(migration, /alter table public\.payments enable row level security/i);
    assert.match(migration, /alter table public\.payment_allocations enable row level security/i);
    assert.match(migration, /alter table public\.payment_events enable row level security/i);
    assert.match(migration, /create policy "read resident payments"/i);
    assert.match(migration, /create policy "read resident assessments"/i);
    assert.match(migration, /pm\.profile_id = app\.current_profile_id\(\)/i);
    assert.match(migration, /pm\.can_view_balance = true/i);
    assert.match(migration, /payments\.status in \('succeeded', 'refunded', 'partially_refunded'\)/i);
    assert.match(migration, /assessments\.status in \('open', 'partially_paid', 'paid', 'overdue', 'waived', 'disputed'\)/i);
    assert.match(migration, /revoke all on public\.payments from anon, authenticated/i);
    assert.match(migration, /grant select \([\s\S]*receipt_number[\s\S]*\) on public\.payments to authenticated/i);
    assert.match(migration, /grant select on public\.resident_payment_history to authenticated/i);
    assert.match(migration, /payment_property_id <> assessment_property_id/i);
    assert.match(migration, /payment allocation property scope mismatch/i);
    assert.doesNotMatch(migration, /create policy "read resident payment events"/i);
    assert.doesNotMatch(migration, /create policy "create resident payments"/i);
    assert.doesNotMatch(migration, /for insert\s+to authenticated/i);
    assert.doesNotMatch(migration, /for update\s+to authenticated/i);
    assert.doesNotMatch(migration, /for delete\s+to authenticated/i);
    assert.doesNotMatch(migration, /grant select \([\s\S]*(guest_name|guest_email|guest_phone|stripe_checkout_session_id|stripe_payment_intent_id|stripe_charge_id|stripe_customer_id|stripe_receipt_url)[\s\S]*\) on public\.payments to authenticated/i);
  });

  it("implements a server-only resident dues service with scoped financial reads", () => {
    const servicePath = "server/services/payments/resident-dues.ts";

    assert.ok(existsSync(join(root, servicePath)));

    const service = read(servicePath);

    assert.match(service, /import "server-only"/);
    assert.match(service, /getResidentPortalMemberships/);
    assert.match(service, /createClient/);
    assert.match(service, /getResidentDuesStatus/);
    assert.match(service, /\.from\("properties"\)/);
    assert.match(service, /\.from\("assessments"\)/);
    assert.match(service, /\.from\("resident_payment_history"\)/);
    assert.match(service, /\.in\("id", visiblePropertyIds\)/);
    assert.match(service, /\.in\("property_id", visiblePropertyIds\)/);
    assert.match(service, /\.in\("community_id", visibleCommunityIds\)/);
    assert.match(service, /\.in\("status", POSTED_PAYMENT_STATUSES\)/);
    assert.match(service, /\.lte\("resident_history_rank", PAYMENT_HISTORY_LIMIT_PER_PROPERTY\)/);
    assert.match(service, /canViewBalance/);
    assert.match(service, /currentBalanceCents:\s*canViewBalance \? propertyRow\?\.current_balance_cents \?\? null : null/);
    assert.match(service, /openAssessments:\s*canViewBalance \? assessmentRowsByProperty\.get\(propertyKey\) \?\? \[\] : \[\]/);
    assert.match(service, /paymentHistory:\s*canViewBalance \? paymentRowsByProperty\.get\(propertyKey\) \?\? \[\] : \[\]/);
    assert.match(service, /dues-unavailable/);

    assert.doesNotMatch(
      service,
      /owner_display_name|account_number|public_payment_code|guest_name|guest_email|guest_phone|stripe_checkout_session_id|stripe_payment_intent_id|stripe_charge_id|stripe_customer_id|stripe_receipt_url|payload_hash|error\.message|SERVICE_ROLE|service_role|private documents|message contents/i,
    );
  });

  it("renders the resident payments page with dues status, history, and permission states", () => {
    const pagePath = "app/(resident)/portal/(member)/payments/page.tsx";

    assert.ok(existsSync(join(root, pagePath)));

    const page = read(pagePath);

    assert.match(page, /getResidentDuesStatus/);
    assert.match(page, /Dues status/);
    assert.match(page, /Current balance/);
    assert.match(page, /Next due date/);
    assert.match(page, /Open dues/);
    assert.match(page, /Payment history/);
    assert.match(page, /No payment history is available/);
    assert.match(page, /Balance and payment history are unavailable/);
    assert.match(page, /property\.canViewBalance/);
    assert.match(page, /property\.paymentHistory\.length/);
    assert.match(page, /property\.openAssessments\.length/);
    assert.ok(page.indexOf("<PaymentAction") > page.indexOf("property.canViewBalance ?"));
    assert.match(page, /formatCurrency/);
    assert.match(page, /DATE_ONLY_PATTERN/);
    assert.match(page, /Date\.UTC\(year, month - 1, day, 12\)/);
    assert.doesNotMatch(page, /rounded-sm border border-\[var\(--border\)\] bg-\[var\(--surface-muted\)\] p-3/);

    assert.doesNotMatch(
      page,
      /owner_display_name|raw account|public payment code|guest email|guest phone|checkout session|payment_intent|webhook|error\.message|SERVICE_ROLE|service_role/i,
    );
  });

  it("keeps dashboard payment history entry points gated by balance visibility", () => {
    const dashboardPath = "app/(resident)/portal/(member)/page.tsx";
    const dashboard = read(dashboardPath);

    assert.match(dashboard, /View payment history/);
    assert.match(dashboard, /property\.canViewBalance/);
    assert.match(dashboard, /Balance and payment history are unavailable for this membership/);
    assert.match(dashboard, /formatDashboardDate/);
    assert.match(dashboard, /DATE_ONLY_PATTERN/);
    assert.doesNotMatch(dashboard, /paymentHistory|payments\.map|stripe|checkout/i);
  });
});
