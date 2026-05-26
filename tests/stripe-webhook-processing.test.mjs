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

describe("Stripe webhook processing and payment allocation", () => {
  it("documents the webhook secret and keeps Stripe helpers server-only", () => {
    const envExample = read(".env.example");
    const stripeHelper = read("lib/stripe/server.ts");
    const clientFacingFiles = readExisting([
      ...listFiles("app/(public)"),
      ...listFiles("app/(resident)"),
      ...listFiles("components"),
      "lib/supabase/client.ts",
      "lib/supabase/proxy.ts",
      "proxy.ts",
    ]);

    assert.match(envExample, /^STRIPE_WEBHOOK_SECRET=$/m);
    assert.doesNotMatch(envExample, /whsec_[A-Za-z0-9]+|sk_live_|sb_secret_[A-Za-z0-9]+/);

    assert.match(stripeHelper, /import "server-only"/);
    assert.match(stripeHelper, /STRIPE_WEBHOOK_SECRET/);
    assert.match(stripeHelper, /getStripeWebhookSecret/);
    assert.match(stripeHelper, /webhooks\.constructEvent/);

    assert.doesNotMatch(clientFacingFiles, /STRIPE_WEBHOOK_SECRET|getStripeWebhookSecret/);
  });

  it("adds a webhook route that verifies the raw Stripe payload before processing", () => {
    const routePath = "app/api/stripe/webhook/route.ts";

    assert.ok(existsSync(join(root, routePath)));

    const route = read(routePath);

    assert.match(route, /export const runtime = "nodejs"/);
    assert.match(route, /export const dynamic = "force-dynamic"/);
    assert.match(route, /export async function POST/);
    assert.match(route, /request\.text\(\)/);
    assert.match(route, /headers\.get\("stripe-signature"\)/);
    assert.match(route, /getStripeWebhookSecret/);
    assert.match(route, /getStripe\(\)\.webhooks\.constructEvent/);
    assert.match(route, /processStripeWebhookEvent/);
    assert.match(route, /webhookResponse\(400/);
    assert.match(route, /webhookResponse\(result\.retryable \? 500/);
    assert.match(route, /kind === "processed"/);
    assert.match(route, /kind === "duplicate"/);
    assert.match(route, /kind === "ignored"/);

    assertOrdered(route, [
      /request\.text\(\)/,
      /headers\.get\("stripe-signature"\)/,
      /webhooks\.constructEvent/,
      /await processStripeWebhookEvent/,
    ]);

    assert.doesNotMatch(route, /request\.json\(\)/);
    assert.doesNotMatch(route, /createServiceRoleClient|\.from\("payment_events"\)|guest_phone|owner_display_name|current_balance|public_payment_code|error\.message|SUPABASE_SECRET_KEY|SUPABASE_SERVICE_ROLE_KEY|STRIPE_SECRET_KEY/i);
  });

  it("implements a server-only processor with supported events and safe typed outcomes", () => {
    const servicePath = "server/services/payments/stripe-webhook-processing.ts";

    assert.ok(existsSync(join(root, servicePath)));

    const service = read(servicePath);

    assert.match(service, /import "server-only"/);
    assert.match(service, /import Stripe from "stripe"/);
    assert.match(service, /createServiceRoleClient/);
    assert.match(service, /export type StripeWebhookProcessingResult/);
    assert.match(service, /processStripeWebhookEvent/);
    assert.match(service, /checkout\.session\.completed/);
    assert.match(service, /checkout\.session\.async_payment_succeeded/);
    assert.match(service, /checkout\.session\.async_payment_failed/);
    assert.match(service, /payment_intent\.succeeded/);
    assert.match(service, /payment_intent\.payment_failed/);
    assert.match(service, /charge\.refunded/);
    assert.match(service, /\.from\("payment_events"\)/);
    assert.match(service, /\.rpc\("process_stripe_payment_event"/);
    assert.match(service, /retrieveCheckoutSessionForPaymentIntent/);
    assert.match(service, /retrieveBalanceTransaction/);
    assert.match(service, /"succeeded"/);
    assert.match(service, /event_payment_status:\s*"failed"/);
    assert.match(service, /event_payment_status:\s*status/);
    assert.match(service, /processing_status.*"processed"/s);
    assert.match(service, /processing_status.*"ignored"/s);
    assert.match(service, /event_payment_status:\s*"ignored"/);
    assert.match(service, /sanitizeWebhookError/);
    assert.match(service, /stripeAccountIdForEvent/);
    assert.match(service, /event\.account/);
    assert.match(service, /stripeRequestOptionsForEvent/);
    assert.match(service, /stripeAccount/);
    assert.match(service, /checkout\.sessions\.list\([\s\S]*requestOptions/);
    assert.match(service, /paymentIntents\.retrieve\([\s\S]*requestOptions/);
    assert.match(service, /charges\.retrieve\(chargeId, \{\}, requestOptions\)/);
    assert.match(service, /balanceTransactions\.retrieve\([\s\S]*requestOptions/);

    assert.doesNotMatch(service, /owner_display_name|public_payment_code|raw lookup|service role key|SUPABASE_SECRET_KEY|SUPABASE_SERVICE_ROLE_KEY|STRIPE_SECRET_KEY|STRIPE_WEBHOOK_SECRET|error\.message|throw new Error/i);
  });

  it("adds atomic database processing with audit logs, idempotency, allocation, and summary recalculation", () => {
    const migrationPath = "supabase/migrations/202605110006_create_stripe_webhook_processing.sql";

    assert.ok(existsSync(join(root, migrationPath)));

    const migration = read(migrationPath);

    assert.match(migration, /create table if not exists public\.audit_logs/i);
    assert.match(migration, /actor_type text not null check \(actor_type in \('user', 'system', 'webhook', 'job'\)\)/i);
    assert.match(migration, /alter table public\.audit_logs enable row level security/i);
    assert.match(migration, /revoke all on public\.audit_logs from anon, authenticated/i);
    assert.match(migration, /audit_logs_community_created_idx/i);
    assert.match(migration, /create or replace function public\.process_stripe_payment_event/i);
    assert.match(migration, /payment_events/i);
    assert.match(migration, /provider_event_id/i);
    assert.match(migration, /on conflict \(provider, provider_event_id\)/i);
    assert.match(migration, /for update/i);
    assert.match(migration, /processing_status = 'processed'/i);
    assert.match(migration, /processing_status = 'ignored'/i);
    assert.match(migration, /processing_status = 'failed'/i);
    assert.match(migration, /payment_allocations/i);
    assert.match(migration, /on conflict \(payment_id, assessment_id\) do nothing/i);
    assert.match(migration, /order by assessments\.due_date asc, assessments\.created_at asc, assessments\.id asc/i);
    assert.match(migration, /least\(remaining_amount_cents, assessment_record\.balance_cents\)/i);
    assert.match(migration, /perform app\.recalculate_property_assessment_summary/i);
    assert.match(migration, /actor_type,\s*action,\s*target_table,\s*target_id/s);
    assert.match(migration, /'webhook'/);
    assert.match(migration, /stripe_event_id/);
    assert.match(migration, /payment\.webhook\.succeeded|payment\.webhook\.failed|payment\.webhook\.refunded|payment\.webhook\.ignored/);
    assert.match(migration, /event_stripe_account_id text default null/i);
    assert.match(migration, /community_settings\.stripe_account_mode/i);
    assert.match(migration, /community_settings\.stripe_connected_account_id/i);
    assert.match(migration, /stripe connected account mismatch/i);
    assert.match(migration, /unexpected connected account event/i);
    assert.match(migration, /failure_reason[\s\S]*'retryable', false/i);

    assert.doesNotMatch(migration, /grant select on public\.audit_logs to authenticated/i);
    assert.doesNotMatch(migration, /owner_display_name|public_payment_code|guest_phone|raw_lookup|card_number|bank_account/i);
  });

  it("guards payment-level idempotency across distinct success events for one payment", () => {
    const migration = read("supabase/migrations/202605110006_create_stripe_webhook_processing.sql");
    const alreadySucceededBlock = migration.match(
      /if payment_record\.status = 'succeeded' then[\s\S]*?end if;/,
    )?.[0];

    assert.ok(alreadySucceededBlock);
    assert.match(alreadySucceededBlock, /payment_level_idempotent/);
    assert.match(alreadySucceededBlock, /payment already succeeded/);
    assert.match(alreadySucceededBlock, /processing_status = 'processed'/);
    assert.doesNotMatch(
      alreadySucceededBlock,
      /payment_allocations|assessment_record|recalculate_property_assessment_summary/i,
    );
    assert.ok(
      migration.indexOf("if payment_record.status = 'succeeded' then") <
        migration.indexOf("for assessment_record in"),
    );
  });

  it("persists audit logs while preserving existing audit callers", () => {
    const auditServicePath = "server/services/audit/write-audit-log.ts";

    assert.ok(existsSync(join(root, auditServicePath)));

    const auditService = read(auditServicePath);

    assert.match(auditService, /import "server-only"/);
    assert.match(auditService, /createServiceRoleClient/);
    assert.match(auditService, /writeAuditLog/);
    assert.match(auditService, /\.from\("audit_logs"\)/);
    assert.match(auditService, /actor_type/);
    assert.match(auditService, /actor_profile_id/);
    assert.match(auditService, /target_table/);
    assert.match(auditService, /before_data/);
    assert.match(auditService, /after_data/);
    assert.match(auditService, /request_id/);
    assert.match(auditService, /kind:\s*"recorded"/);
    assert.match(auditService, /kind:\s*"skipped"/);

    assert.doesNotMatch(auditService, /throw new Error|error\.message|SUPABASE_SECRET_KEY|SUPABASE_SERVICE_ROLE_KEY|STRIPE_SECRET_KEY|STRIPE_WEBHOOK_SECRET/i);
  });

  it("keeps webhook implementation out of public and client-facing surfaces", () => {
    const publicClientFiles = readExisting([
      ...listFiles("app/(public)"),
      ...listFiles("app/(resident)"),
      ...listFiles("components"),
      ...listFiles("lib/public"),
    ]);

    assert.doesNotMatch(publicClientFiles, /processStripeWebhookEvent|app\/api\/stripe\/webhook|payment_events|audit_logs|stripe_checkout_session_id|stripe_payment_intent_id|stripe_charge_id|stripe_customer_id|STRIPE_WEBHOOK_SECRET|constructEvent/i);
    assert.doesNotMatch(publicClientFiles, /owner_display_name|public_payment_code|raw lookup|guest_phone|service role|service-role/i);
  });
});
