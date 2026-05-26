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

describe("admin payment records and manual payments", () => {
  it("adds schema, permission, config, idempotency, and scoped admin RPCs", () => {
    const migrationPath =
      "supabase/migrations/202605110008_admin_payment_records_and_manual_payments.sql";

    assert.ok(existsSync(join(root, migrationPath)));

    const migration = read(migrationPath);

    assert.match(migration, /manual_payments_enabled boolean not null default false/i);
    assert.match(migration, /admin\.payments\.manage/i);
    assert.match(migration, /where key = 'admin'/i);
    assert.doesNotMatch(migration, /where key = 'resident'[\s\S]*admin\.payments\.manage/i);
    assert.match(migration, /create table if not exists public\.manual_payment_requests/i);
    assert.match(migration, /request_id uuid not null/i);
    assert.match(migration, /unique \(community_id, request_id\)/i);
    assert.match(migration, /payment_id uuid references public\.payments\(id\)/i);
    assert.match(migration, /alter table public\.manual_payment_requests enable row level security/i);
    assert.match(migration, /revoke all on public\.manual_payment_requests from anon, authenticated/i);
    assert.match(migration, /create or replace function app\.set_manual_payment_requests_updated_at/i);
    assert.match(migration, /set search_path = public/i);
    assert.match(migration, /execute function app\.set_manual_payment_requests_updated_at/i);
    assert.match(migration, /revoke all on function app\.set_manual_payment_requests_updated_at\(\) from public, anon, authenticated/i);
    assert.match(migration, /create or replace function public\.list_admin_payment_records/i);
    assert.match(migration, /create or replace function public\.record_manual_payment/i);
    assert.match(migration, /security definer/i);
    assert.match(migration, /set search_path = public, app/i);
    assert.match(migration, /app\.current_profile_id\(\)/);
    assert.match(migration, /app\.has_permission\(target_community_id, 'admin\.payments\.manage'\)/);
    assert.match(migration, /revoke all on function public\.list_admin_payment_records/i);
    assert.match(migration, /revoke all on function public\.record_manual_payment/i);
    assert.match(migration, /grant execute on function public\.list_admin_payment_records[\s\S]*to authenticated/i);
    assert.match(migration, /grant execute on function public\.record_manual_payment[\s\S]*to authenticated/i);
    assert.match(migration, /jsonb_agg/i);
    assert.match(migration, /search_query text/i);
    assert.match(migration, /replace\(btrim\(coalesce\(filter_query, ''\)\), chr\(92\), chr\(92\) \|\| chr\(92\)\)/i);
    assert.match(migration, /ilike '%' \|\| search_query \|\| '%' escape chr\(92\)/i);
    assert.match(migration, /allocated_cents/i);
    assert.match(migration, /unapplied_cents/i);
    assert.match(migration, /stripe_checkout_session_id/i);
    assert.match(migration, /stripe_payment_intent_id/i);
    assert.match(migration, /stripe_charge_id/i);
    assert.doesNotMatch(migration, /grant select on public\.(payments|payment_allocations|payment_events|audit_logs|email_logs) to authenticated/i);
    assert.doesNotMatch(migration, /owner_display_name|public_payment_code|guest_phone|raw_lookup|card_number|bank_account|routing_number/i);
  });

  it("records manual payments atomically with allocation, summary, last-payment, audit, and duplicate-submit safety", () => {
    const migration = read(
      "supabase/migrations/202605110008_admin_payment_records_and_manual_payments.sql",
    );

    assert.match(migration, /manual_payments_enabled = true/i);
    assert.match(migration, /select \*[\s\S]*from public\.manual_payment_requests[\s\S]*for update/i);
    assert.match(migration, /status = 'recorded'/i);
    assert.match(migration, /return jsonb_build_object\('status', 'recorded'[\s\S]*'existing', true/i);
    assert.match(migration, /insert into public\.payments/i);
    assert.match(migration, /payer_type,\s*profile_id/s);
    assert.match(migration, /'admin_recorded'/);
    assert.match(migration, /'succeeded'/);
    assert.match(migration, /created_by/);
    assert.match(migration, /'SMC-' \|\| upper\(substr\(replace\(created_payment_id::text, '-'/i);
    assert.match(migration, /payment_method not in \('check', 'cash', 'manual', 'other'\)/i);
    assert.match(migration, /payment_method in \('card', 'ach'\)/i);
    assert.match(migration, /payment_amount_cents > 100000000/i);
    assert.match(migration, /payment_paid_at > now\(\) \+ interval '5 minutes'/i);
    assert.match(migration, /pg_advisory_xact_lock/i);
    assert.match(migration, /manual_payment_requests\.request_id = record_manual_payment\.request_id/i);
    assert.match(migration, /on conflict \(community_id, request_id\) do update/i);
    assert.match(migration, /jsonb_array_length\(coalesce\(allocation_input, '\[\]'::jsonb\)\) > 100/i);
    assert.match(migration, /length\(btrim\(payment_reason\)\) > 500/i);
    assert.match(migration, /card number[\s\S]*routing number[\s\S]*bank account[\s\S]*\(\[0-9\]\[ -\]\?\)\{9,\}/i);
    assert.match(migration, /from public\.community_settings[\s\S]*for update/i);
    assert.match(migration, /seen_assessment_ids/i);
    assert.match(migration, /allocation_assessment_id = any\(seen_assessment_ids\)/i);
    assert.match(migration, /length\(allocation_record->>'amountCents'\) > 9/i);
    assert.match(migration, /explicit_allocation_total bigint/i);
    assert.match(migration, /for update/i);
    assert.match(migration, /order by assessments\.due_date asc, assessments\.created_at asc, assessments\.id asc/i);
    assert.match(migration, /least\(remaining_amount_cents, assessment_record\.balance_cents\)/i);
    assert.match(migration, /insert into public\.payment_allocations/i);
    assert.doesNotMatch(migration, /on conflict \(payment_id, assessment_id\) do nothing/i);
    assert.match(migration, /paid_cents = paid_cents \+ allocation_cents/i);
    assert.match(migration, /perform app\.recalculate_property_assessment_summary/i);
    assert.match(migration, /last_payment_at/i);
    assert.match(migration, /max\(coalesce\(payments\.paid_at, payments\.created_at\)\)/i);
    assert.match(migration, /insert into public\.audit_logs/i);
    assert.match(migration, /'user'/);
    assert.match(migration, /'payment\.manual\.create'/);
    assert.match(migration, /request_id::text/);
    assert.match(migration, /payment_events/);

    const duplicateBlock = migration.match(
      /if request_record\.status = 'recorded'[\s\S]*?end if;/i,
    )?.[0];

    assert.ok(duplicateBlock);
    assert.doesNotMatch(duplicateBlock, /insert into public\.payments|payment_allocations|paid_cents = paid_cents/i);

    const functionBody = migration.match(
      /create or replace function public\.record_manual_payment[\s\S]*?end;\n\$\$/i,
    )?.[0];
    assert.ok(functionBody);

    const requestInsertIndex = functionBody.indexOf("insert into public.manual_payment_requests");
    assert.ok(requestInsertIndex > 0);
    const beforeRequestInsert = functionBody.slice(0, requestInsertIndex);

    assert.doesNotMatch(
      beforeRequestInsert,
      /update public\.manual_payment_requests\s+set\s+status = 'failed'/i,
    );
  });

  it("implements a server-only admin payment management service with safe typed results", () => {
    const servicePath = "server/services/payments/admin-payment-management.ts";

    assert.ok(existsSync(join(root, servicePath)));

    const service = read(servicePath);

    assert.match(service, /import "server-only"/);
    assert.match(service, /createClient/);
    assert.match(service, /hasPermission/);
    assert.match(service, /PERMISSION_DENIED_MESSAGE/);
    assert.match(service, /PROFILE_UNAVAILABLE_MESSAGE/);
    assert.match(service, /admin\.payments\.manage/);
    assert.match(service, /listAdminPaymentRecords/);
    assert.match(service, /recordManualPayment/);
    assert.match(service, /\.rpc\("list_admin_payment_records"/);
    assert.match(service, /\.rpc\("record_manual_payment"/);
    assert.match(service, /isUuid/);
    assert.match(service, /isDateTime/);
    assert.match(service, /isPositiveInteger/);
    assert.match(service, /OFFLINE_PAYMENT_METHODS/);
    assert.match(service, /check/);
    assert.match(service, /cash/);
    assert.match(service, /manual/);
    assert.match(service, /other/);
    assert.match(service, /configuration-disabled/);
    assert.match(service, /invalid-input/);
    assert.match(service, /payment-unavailable/);
    assert.match(service, /ADMIN_PAYMENT_TIME_ZONE = "America\/New_York"/);
    assert.match(service, /MAX_PAGE_OFFSET = 10000/);
    assert.match(service, /MAX_QUERY_LENGTH = 200/);
    assert.match(service, /MAX_REASON_LENGTH = 500/);
    assert.match(service, /MAX_MANUAL_ALLOCATIONS = 100/);
    assert.match(service, /manualPaymentsEnabled/);
    assert.match(service, /allocatedCents/);
    assert.match(service, /unappliedCents/);
    assert.match(service, /DATE_ONLY_PATTERN/);
    assert.match(service, /DATE_TIME_LOCAL_PATTERN/);
    assert.match(service, /isValidDateTimeLocal/);
    assert.match(service, /dateTimeLocalToTimeZoneIso/);
    assert.match(service, /normalizeFromDateTime/);
    assert.match(service, /normalizeToDateTime/);
    assert.match(service, /DATE_TIME_LOCAL_PATTERN\.test\(trimmed\)[\s\S]*dateTimeLocalToTimeZoneIso\(trimmed\)/);
    assert.match(service, /T23:59:59\.999/);
    assert.match(service, /filter_from: normalizeFromDateTime\(input\.from\)/);
    assert.match(service, /filter_to: normalizeToDateTime\(input\.to\)/);
    assert.match(service, /SENSITIVE_PAYMENT_REASON_PATTERN/);
    assert.match(service, /\(\\d\[ -\]\?\)\{9,\}/);
    assert.match(service, /Math\.min\(Math\.max\(Number\(value\), 0\), MAX_PAGE_OFFSET\)/);
    assert.match(service, /reason\.length > MAX_REASON_LENGTH/);
    assert.match(service, /allocations\.length > MAX_MANUAL_ALLOCATIONS/);

    assertOrdered(service, [
      /resolveCommunity/,
      /hasPermission/,
      /\.rpc\("list_admin_payment_records"/,
    ]);

    assert.doesNotMatch(
      service,
      /createServiceRoleClient|from "stripe"|from "resend"|error\.message|owner_display_name|public_payment_code|guest_phone|raw lookup|card_number|bank_account|routing_number|SERVICE_ROLE|SUPABASE_SECRET_KEY|SUPABASE_SERVICE_ROLE_KEY|STRIPE_SECRET_KEY|RESEND_API_KEY/i,
    );
  });

  it("adds a server action that parses manual payment form data safely", () => {
    const actionPath = "server/actions/admin-payments.ts";

    assert.ok(existsSync(join(root, actionPath)));

    const action = read(actionPath);

    assert.match(action, /"use server"/);
    assert.match(action, /recordManualPayment/);
    assert.match(action, /FormData/);
    assert.match(action, /requestId/);
    assert.match(action, /communitySlug/);
    assert.match(action, /propertyId/);
    assert.match(action, /amountCents|parseAmountCents/);
    assert.match(action, /method/);
    assert.match(action, /paidAt/);
    assert.match(action, /parsePaidAt/);
    assert.match(action, /dateTimeLocalToTimeZoneIso/);
    assert.match(action, /GROUPED_DECIMAL_DOLLAR_PATTERN/);
    assert.match(action, /isValidDateTimeLocalMatch/);
    assert.match(action, /paidAt\.kind === "invalid"/);
    assert.match(action, /timeZone:\s*"America\/New_York"/);
    assert.match(action, /reason/);
    assert.match(action, /allocations/);
    assert.match(action, /manualPaymentField/);
    assert.match(action, /redirect\(`\/admin\/payments\?\$\{params\.toString\(\)\}`\)/);
    assert.doesNotMatch(action, /formData\.get\("amountCents"\)/);
    assert.doesNotMatch(action, /parseIntegerCents/);
    assert.doesNotMatch(action, /error\.message|owner_display_name|public_payment_code|guest_phone|stripe_checkout_session_id|payment_intent|SERVICE_ROLE|SUPABASE_SECRET_KEY|SUPABASE_SERVICE_ROLE_KEY|STRIPE_SECRET_KEY|RESEND_API_KEY/i);
  });

  it("renders a focused, permission-backed admin payments page with filters and manual payment controls", () => {
    const pagePath = "app/(admin)/admin/payments/page.tsx";

    assert.ok(existsSync(join(root, pagePath)));

    const page = read(pagePath);

    assert.match(page, /listAdminPaymentRecords/);
    assert.match(page, /recordAdminManualPayment/);
    assert.match(page, /searchParams/);
    assert.match(page, /Payment records/);
    assert.match(page, /Status/);
    assert.match(page, /Payer/);
    assert.match(page, /Property/);
    assert.match(page, /Amount/);
    assert.match(page, /Method/);
    assert.match(page, /Fee policy/);
    assert.match(page, /Receipt/);
    assert.match(page, /Stripe/);
    assert.match(page, /Allocated/);
    assert.match(page, /Unapplied/);
    assert.match(page, /Paid/);
    assert.match(page, /Created/);
    assert.match(page, /Updated/);
    assert.match(page, /name="status"/);
    assert.match(page, /name="payerType"/);
    assert.match(page, /name="method"/);
    assert.match(page, /name="query"/);
    assert.match(page, /name="from"/);
    assert.match(page, /name="to"/);
    assert.match(page, /pageOffset/);
    assert.match(page, /MAX_PAGE_OFFSET = 10000/);
    assert.match(page, /PAGE_SIZE \+ 1/);
    assert.match(page, /PaginationControls/);
    assert.match(page, /manualPaymentsEnabled/);
    assert.match(page, /name="requestId"/);
    assert.match(page, /crypto\.randomUUID/);
    assert.match(page, /name="propertyId"/);
    assert.match(page, /name="amount"/);
    assert.match(page, /name="manualMethod"/);
    assert.match(page, /name="paidAt"/);
    assert.match(page, /name="allocations"/);
    assert.match(page, /name="reason"/);
    assert.match(page, /manualPaymentField/);
    assert.match(page, /manual-payment-error-amount/);
    assert.match(page, /manual-payment-error-manualMethod/);
    assert.match(page, /manualPaymentField === field/);
    assert.match(page, /aria-live/);
    assert.match(page, /aria-invalid/);
    assert.match(page, /overflow-x-auto/);

    assert.doesNotMatch(
      page,
      /guest_phone|owner_display_name|public_payment_code|raw lookup|card number|bank account|routing number|SERVICE_ROLE|SUPABASE_SECRET_KEY|SUPABASE_SERVICE_ROLE_KEY|STRIPE_SECRET_KEY|RESEND_API_KEY/i,
    );
  });

  it("keeps admin payment internals out of public and resident-facing surfaces", () => {
    const clientFacingFiles = readExisting([
      ...listFiles("app/(public)"),
      ...listFiles("app/(resident)"),
      ...listFiles("components/public"),
      ...listFiles("components/resident"),
      ...listFiles("lib/public"),
    ]);

    assert.doesNotMatch(
      clientFacingFiles,
      /admin-payment-management|admin-payments|recordManualPayment|listAdminPaymentRecords|admin\.payments\.manage|manual_payment_requests|manual_payments_enabled|payment\.manual\.create/i,
    );
  });

  it("asserts Story 3.7 receipt eligibility still excludes admin-recorded payments", () => {
    const receiptService = read("server/services/payments/payment-receipt-email.ts");
    const receiptTypeBlock = receiptService.match(
      /function receiptTypeForPayment[\s\S]*?return null;\n}/,
    )?.[0];

    assert.ok(receiptTypeBlock);
    assert.match(receiptTypeBlock, /payment\.payer_type === "resident"[\s\S]*"payment_receipt"/);
    assert.match(receiptTypeBlock, /payment\.payer_type === "guest"[\s\S]*"guest_payment_receipt"/);
    assert.match(receiptService, /payer_type: "resident" \| "guest" \| "admin_recorded"/);
    assert.doesNotMatch(receiptTypeBlock, /admin_recorded[\s\S]*payment_receipt/);
  });
});
