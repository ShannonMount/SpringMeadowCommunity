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

describe("payment receipt emails", () => {
  it("documents Resend server configuration and keeps helpers server-only", () => {
    const packageJson = JSON.parse(read("package.json"));
    const envExample = read(".env.example");
    const resendHelperPath = "server/services/email/resend.ts";
    const sendEmailPath = "server/services/email/send-email.ts";

    assert.match(packageJson.dependencies?.resend ?? "", /^\^?\d+\.\d+\.\d+/);
    assert.match(envExample, /^RESEND_API_KEY=$/m);
    assert.match(envExample, /^RESEND_FROM_EMAIL=$/m);
    assert.doesNotMatch(envExample, /re_[A-Za-z0-9_-]{20,}|@springmeadow|@resend\.dev/i);

    assert.ok(existsSync(join(root, resendHelperPath)));
    assert.ok(existsSync(join(root, sendEmailPath)));

    const resendHelper = read(resendHelperPath);
    const sendEmail = read(sendEmailPath);

    assert.match(resendHelper, /import "server-only"/);
    assert.match(resendHelper, /from "resend"/);
    assert.match(resendHelper, /new Resend/);
    assert.match(resendHelper, /RESEND_API_KEY/);
    assert.match(resendHelper, /RESEND_FROM_EMAIL/);
    assert.match(resendHelper, /getResend/);
    assert.match(resendHelper, /getResendFromEmail/);
    assert.match(resendHelper, /sanitizeEmailError/);

    assert.match(sendEmail, /import "server-only"/);
    assert.match(sendEmail, /emails\.send/);
    assert.match(sendEmail, /idempotencyKey/);
    assert.match(sendEmail, /providerMessageId/);

    assert.doesNotMatch(`${resendHelper}\n${sendEmail}`, /NEXT_PUBLIC|throw new Error\(".*RESEND|error\.message/);
  });

  it("adds private email log storage with receipt idempotency", () => {
    const migrationPath = "supabase/migrations/202605110007_create_email_logs.sql";

    assert.ok(existsSync(join(root, migrationPath)));

    const migration = read(migrationPath);

    assert.match(migration, /create extension if not exists "citext"/i);
    assert.match(migration, /create table if not exists public\.email_logs/i);
    assert.match(migration, /idempotency_key text not null/i);
    assert.match(migration, /unique \(idempotency_key\)/i);
    assert.match(migration, /attempt_count integer not null default 0/i);
    assert.match(migration, /type text not null check/i);
    assert.match(migration, /'payment_receipt'/);
    assert.match(migration, /'guest_payment_receipt'/);
    assert.match(migration, /status text not null default 'queued'/i);
    assert.match(migration, /'queued', 'sent', 'delivered', 'bounced', 'failed', 'suppressed'/);
    assert.match(migration, /related_payment_id uuid references public\.payments\(id\)/i);
    assert.match(migration, /related_property_id uuid references public\.properties\(id\)/i);
    assert.match(migration, /email_logs_type_created_idx/i);
    assert.match(migration, /email_logs_recipient_idx/i);
    assert.match(migration, /email_logs_status_idx/i);
    assert.match(migration, /email_logs_payment_idx/i);
    assert.match(migration, /alter table public\.email_logs enable row level security/i);
    assert.match(migration, /revoke all on public\.email_logs from anon, authenticated/i);

    assert.doesNotMatch(migration, /grant select on public\.email_logs to (anon|authenticated)/i);
    assert.doesNotMatch(migration, /raw_provider|provider_payload|stack_trace|card_number|bank_account/i);
  });

  it("implements a server-only receipt service with resident and guest privacy boundaries", () => {
    const servicePath = "server/services/payments/payment-receipt-email.ts";

    assert.ok(existsSync(join(root, servicePath)));

    const service = read(servicePath);

    assert.match(service, /import "server-only"/);
    assert.match(service, /createServiceRoleClient/);
    assert.match(service, /sendEmail/);
    assert.match(service, /sendPaymentReceiptEmailForPayment/);
    assert.match(service, /\.from\("payments"\)/);
    assert.match(service, /\.eq\("status", "succeeded"\)/);
    assert.match(service, /payer_type/);
    assert.match(service, /profile_id/);
    assert.match(service, /guest_email/);
    assert.match(service, /\.from\("profiles"\)/);
    assert.match(service, /\.from\("email_logs"\)/);
    assert.match(service, /idempotency_key/);
    assert.match(service, /payment_receipt/);
    assert.match(service, /guest_payment_receipt/);
    assert.match(service, /payment-receipt\/\$\{payment\.id\}/);
    assert.match(service, /guest-payment-receipt\/\$\{payment\.id\}/);
    assert.match(service, /already-sent/);
    assert.match(service, /missing-recipient/);
    assert.match(service, /not-eligible/);
    assert.match(service, /failed/);
    assert.match(service, /amount_cents/);
    assert.match(service, /receipt_number/);
    assert.match(service, /stripe_receipt_url/);
    assert.match(service, /escapeHtml/);
    assert.match(service, /QUEUED_EMAIL_RETRY_AFTER_MS/);
    assert.match(service, /isActiveQueuedEmailLog/);
    assert.match(service, /Date\.now\(\) - updatedAtMs < QUEUED_EMAIL_RETRY_AFTER_MS/);
    assert.match(service, /\["sent", "delivered", "bounced"\]/);
    assert.match(service, /existingLog,\s*\n\s*idempotencyKey/);

    assertOrdered(service, [
      /const idempotencyKey = idempotencyKeyForPayment/,
      /const existingLog = await existingEmailLog/,
      /if \(existingLog && isNonRetryableEmailLog\(existingLog\)\)/,
      /const recipient = await resolveRecipient/,
    ]);

    assert.doesNotMatch(
      service,
      /current_balance_cents|owner_display_name|resident contacts|private documents|payment history|raw lookup|guest_phone|public_payment_code|property_account_snapshot|stripe_checkout_session_id|stripe_payment_intent_id|stripe_charge_id|stripe_customer_id|event_stripe_account_id|processor_fee_cents|net_amount_cents|error\.message|throw new Error|SUPABASE_SECRET_KEY|SUPABASE_SERVICE_ROLE_KEY|RESEND_API_KEY/i,
    );
    assert.doesNotMatch(service, /upsert\(/);
    assert.doesNotMatch(service, /\["queued", "sent", "delivered"\]\.includes/);
  });

  it("triggers receipts only after verified successful payment processing", () => {
    const webhookService = read("server/services/payments/stripe-webhook-processing.ts");
    const webhookRoute = read("app/api/stripe/webhook/route.ts");

    assert.match(webhookService, /sendPaymentReceiptEmailForPayment/);
    assert.match(webhookService, /rpcInput\.event_payment_status === "succeeded"/);
    assert.match(webhookService, /result\.payment_id/);
    assert.match(webhookService, /await sendPaymentReceiptEmailForPayment/);
    assert.match(webhookService, /stripeEventId:\s*event\.id/);
    assert.match(webhookService, /receiptResult/);
    assert.doesNotMatch(webhookService, /receiptResult[\s\S]{0,120}retryable: true/);

    assertOrdered(webhookService, [
      /\.rpc\("process_stripe_payment_event"/,
      /result\?\.status === "processed"/,
      /await sendPaymentReceiptEmailForPayment/,
      /return\s*\{\s*kind:\s*"processed"/,
    ]);

    assert.doesNotMatch(webhookRoute, /resend|sendPaymentReceiptEmailForPayment|email_logs/i);
    assert.doesNotMatch(webhookService, /request\.json\(\)|constructEvent|RESEND_API_KEY|RESEND_FROM_EMAIL/);
  });

  it("keeps receipt internals out of public and client-facing surfaces", () => {
    const clientFacingFiles = readExisting([
      ...listFiles("app/(public)"),
      ...listFiles("app/(resident)"),
      ...listFiles("components"),
      ...listFiles("lib/public"),
      "lib/supabase/client.ts",
      "lib/supabase/proxy.ts",
      "proxy.ts",
    ]);

    assert.doesNotMatch(
      clientFacingFiles,
      /from "resend"|RESEND_API_KEY|RESEND_FROM_EMAIL|email_logs|sendPaymentReceiptEmailForPayment|payment-receipt-email|provider_message_id|idempotency_key/i,
    );
  });
});
