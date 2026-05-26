import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();

function read(path) {
  return readFileSync(join(root, path), "utf8");
}

function listFiles(path) {
  const absolutePath = join(root, path);

  if (!existsSync(absolutePath)) {
    return [];
  }

  return readdirSync(absolutePath).flatMap((entry) => {
    const relativePath = `${path}/${entry}`;
    const entryPath = join(root, relativePath);

    return statSync(entryPath).isDirectory() ? listFiles(relativePath) : [relativePath];
  });
}

function readExisting(paths) {
  return paths.filter((path) => existsSync(join(root, path))).map(read).join("\n");
}

function assertOrdered(content, patterns) {
  let previousIndex = -1;

  for (const pattern of patterns) {
    const match = pattern.exec(content);

    assert.ok(match, `Expected to find ${pattern}`);
    assert.ok(match.index > previousIndex, `Expected ${pattern} to appear in order`);
    previousIndex = match.index;
  }
}

describe("delinquency reporting foundation", () => {
  it("adds scoped report RPC, board/admin permission, safe grants, and narrow fields", () => {
    const migrationPath = "supabase/migrations/202605110009_delinquency_reporting_foundation.sql";

    assert.ok(existsSync(join(root, migrationPath)));

    const migration = read(migrationPath);

    assert.match(migration, /board\.delinquency\.view/i);
    assert.match(migration, /where key in \('board_member', 'admin'\)/i);
    assert.doesNotMatch(migration, /where key = 'resident'[\s\S]*board\.delinquency\.view/i);
    assert.doesNotMatch(migration, /where key = 'legal_reviewer'[\s\S]*board\.delinquency\.view/i);
    assert.match(migration, /create or replace function public\.list_delinquency_report/i);
    assert.match(migration, /security definer/i);
    assert.match(migration, /set search_path = public, app/i);
    assert.match(migration, /app\.current_profile_id\(\)/);
    assert.match(migration, /app\.has_permission\(target_community_id, 'board\.delinquency\.view'\)/);
    assert.match(migration, /revoke all on function public\.list_delinquency_report/i);
    assert.match(migration, /from public, anon/i);
    assert.match(migration, /grant execute on function public\.list_delinquency_report[\s\S]*to authenticated/i);
    assert.match(migration, /search_query text/i);
    assert.match(migration, /replace\(btrim\(coalesce\(filter_query, ''\)\), chr\(92\), chr\(92\) \|\| chr\(92\)\)/i);
    assert.match(migration, /ilike '%' \|\| search_query \|\| '%' escape chr\(92\)/i);
    assert.match(migration, /property_label/i);
    assert.match(migration, /current_balance_cents/i);
    assert.match(migration, /oldest_unpaid_due_date/i);
    assert.match(migration, /days_past_due/i);
    assert.match(migration, /lien_review_candidate/i);
    assert.match(migration, /delinquent_days_past_due/i);
    assert.match(migration, /open_assessment_count/i);
    assert.match(migration, /open_assessment_balance_cents/i);
    assert.match(migration, /lien_readiness_days_past_due/i);
    assert.match(migration, /jsonb_agg[\s\S]*order by/i);
    assert.doesNotMatch(migration, /grant select on public\.(payments|payment_allocations|payment_events|audit_logs|community_settings) to authenticated/i);
    assert.doesNotMatch(migration, /owner_display_name|account_number|public_payment_code|guest_email|guest_phone|stripe_checkout_session_id|stripe_payment_intent_id|stripe_charge_id|raw_lookup/i);
  });

  it("recalculates property delinquency summaries from eligible unpaid assessments only", () => {
    const migration = read("supabase/migrations/202605110009_delinquency_reporting_foundation.sql");
    const webhookMigration = read("supabase/migrations/202605110006_create_stripe_webhook_processing.sql");
    const manualPaymentMigration = read(
      "supabase/migrations/202605110008_admin_payment_records_and_manual_payments.sql",
    );

    assert.match(migration, /create or replace function app\.recalculate_property_assessment_summary/i);
    assert.match(migration, /status in \('open', 'partially_paid', 'overdue', 'disputed'\)/i);
    assert.match(migration, /balance_cents > 0/i);
    assert.match(migration, /add column if not exists delinquent_days_past_due integer not null default 15/i);
    assert.match(migration, /coalesce\(community_settings\.delinquent_days_past_due, 15\)/i);
    assert.match(migration, /lien_readiness_days_past_due/i);
    assert.match(migration, /coalesce\(community_settings\.lien_readiness_days_past_due, 30\)/i);
    assert.match(migration, /when summary_balance <= 0 then 'current'/i);
    assert.match(migration, /when has_disputed then 'disputed'/i);
    assert.match(migration, /when oldest_unpaid_due_date <= current_date - lien_readiness_days then 'lien_review'/i);
    assert.match(migration, /when oldest_unpaid_due_date <= current_date - delinquent_days then 'delinquent'/i);
    assert.match(migration, /when oldest_unpaid_due_date < current_date then 'overdue'/i);
    assert.match(migration, /when has_due_soon then 'due_soon'/i);
    assert.match(migration, /else 'current'/i);
    assert.doesNotMatch(migration, /status in \('draft'|'paid'|'waived'|'void'\)/i);
    assert.match(webhookMigration, /perform app\.recalculate_property_assessment_summary/i);
    assert.match(manualPaymentMigration, /perform app\.recalculate_property_assessment_summary/i);
  });

  it("implements a server-only delinquency report service with validation and safe unions", () => {
    const servicePath = "server/services/payments/delinquency-reporting.ts";

    assert.ok(existsSync(join(root, servicePath)));

    const service = read(servicePath);

    assert.match(service, /import "server-only"/);
    assert.match(service, /createClient/);
    assert.match(service, /hasPermission/);
    assert.match(service, /PERMISSION_DENIED_MESSAGE/);
    assert.match(service, /PROFILE_UNAVAILABLE_MESSAGE/);
    assert.match(service, /board\.delinquency\.view/);
    assert.match(service, /listDelinquencyReport/);
    assert.match(service, /\.rpc\("list_delinquency_report"/);
    assert.match(service, /DelinquencyStage/);
    assert.match(service, /DelinquencyReportRecord/);
    assert.match(service, /isUuid/);
    assert.match(service, /isValidDateOnly/);
    assert.match(service, /isPositiveInteger/);
    assert.match(service, /MAX_PAGE_SIZE = 100/);
    assert.match(service, /MAX_PAGE_OFFSET = 10000/);
    assert.match(service, /MAX_QUERY_LENGTH = 200/);
    assert.match(service, /MAX_RPC_INTEGER_CENTS = 2147483647/);
    assert.match(service, /boundedPageSize/);
    assert.match(service, /boundedPageOffset/);
    assert.match(service, /minimumBalanceCents > MAX_RPC_INTEGER_CENTS/);
    assert.match(service, /delinquentDaysPastDue/);
    assert.match(service, /permissionResultToReport/);

    assertOrdered(service, [
      /resolveCommunity/,
      /hasPermission/,
      /\.rpc\("list_delinquency_report"/,
    ]);

    assert.doesNotMatch(
      service,
      /createServiceRoleClient|from "stripe"|from "resend"|stripe-webhook-processing|payment-receipt-email|guest-payment|resident-dues|error\.message|owner_display_name|account_number|public_payment_code|guest_email|guest_phone|SERVICE_ROLE|SUPABASE_SECRET_KEY|SUPABASE_SERVICE_ROLE_KEY|STRIPE_SECRET_KEY|RESEND_API_KEY/i,
    );
  });

  it("renders a focused permission-backed delinquency report page with filters and review wording", () => {
    const pagePath = "app/(admin)/admin/delinquency/page.tsx";

    assert.ok(existsSync(join(root, pagePath)));

    const page = read(pagePath);

    assert.match(page, /listDelinquencyReport/);
    assert.match(page, /searchParams/);
    assert.match(page, /Delinquency report/);
    assert.match(page, /Property/);
    assert.match(page, /Stage/);
    assert.match(page, /Current balance/);
    assert.match(page, /Oldest due/);
    assert.match(page, /Days past due/);
    assert.match(page, /Disputed/);
    assert.match(page, /Review candidate/);
    assert.match(page, /Open assessments/);
    assert.match(page, /Last payment/);
    assert.match(page, /Next due/);
    assert.match(page, /name="stage"/);
    assert.match(page, /name="query"/);
    assert.match(page, /name="from"/);
    assert.match(page, /name="to"/);
    assert.match(page, /name="minimumBalance"/);
    assert.match(page, /pageOffset/);
    assert.match(page, /PAGE_SIZE \+ 1/);
    assert.match(page, /PaginationControls/);
    assert.match(page, /overflow-x-auto/);
    assert.doesNotMatch(page, /file lien|foreclosure|notice sent|legal approved|attorney approved/i);
    assert.doesNotMatch(
      page,
      /owner_display_name|account_number|public_payment_code|guest_email|guest_phone|stripe_checkout_session_id|stripe_payment_intent_id|SERVICE_ROLE|SUPABASE_SECRET_KEY|SUPABASE_SERVICE_ROLE_KEY|STRIPE_SECRET_KEY|RESEND_API_KEY/i,
    );
  });

  it("keeps delinquency report internals out of public, guest, resident, and client-facing surfaces", () => {
    const clientFacingFiles = readExisting([
      ...listFiles("app/(public)"),
      ...listFiles("app/(resident)"),
      ...listFiles("components/public"),
      ...listFiles("components/resident"),
      ...listFiles("lib/public"),
    ]);

    assert.doesNotMatch(
      clientFacingFiles,
      /delinquency-reporting|listDelinquencyReport|list_delinquency_report|board\.delinquency\.view|lien_review_candidate|open_assessment_balance_cents/i,
    );
  });
});
