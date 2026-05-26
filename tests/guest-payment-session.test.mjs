import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();

function read(path) {
  return readFileSync(join(root, path), "utf8");
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

describe("guest Stripe payment session", () => {
  it("creates hashed single-use guest lookup sessions with no raw lookup inputs", () => {
    const migrationPath =
      "supabase/migrations/202605110005_create_guest_payment_lookup_sessions.sql";

    assert.ok(existsSync(join(root, migrationPath)));

    const migration = read(migrationPath);

    assert.match(migration, /public\.guest_payment_lookup_sessions/i);
    assert.match(migration, /token_hash text not null unique/i);
    assert.match(migration, /expires_at timestamptz not null/i);
    assert.match(migration, /used_at timestamptz/i);
    assert.match(migration, /enable row level security/i);
    assert.match(migration, /revoke all on public\.guest_payment_lookup_sessions from anon, authenticated/i);
    assert.match(migration, /guest_payment_lookup_sessions_active_expiry_idx/i);
    assert.match(migration, /guest_payment_lookup_sessions_property_context_idx/i);
    assert.doesNotMatch(migration, /address_line1|postal_code|account_number|public_payment_code|owner_display_name|current_balance_cents|guest_name|guest_email|guest_phone|ip_address|remote_ip/i);
    assert.doesNotMatch(migration, /create policy/i);
  });

  it("validates public guest session requests with deterministic cents and generic messages", () => {
    const modulePath = "lib/public/guest-payment-session.ts";

    assert.ok(existsSync(join(root, modulePath)));

    const module = read(modulePath);

    assert.match(module, /export type GuestPaymentSessionRequest/);
    assert.match(module, /export type GuestPaymentSessionApiResponse/);
    assert.match(module, /export function validateGuestPaymentSessionRequest/);
    assert.match(module, /parseUsdCents/);
    assert.match(module, /AMOUNT_PATTERN/);
    assert.match(module, /MAX_GUEST_PAYMENT_AMOUNT_CENTS/);
    assert.match(module, /payerName/);
    assert.match(module, /payerEmail/);
    assert.match(module, /payerPhone/);
    assert.match(module, /methodPreference/);
    assert.match(module, /turnstileToken/);
    assert.match(module, /guestPaymentLookupExpiredMessage/);
    assert.match(module, /guestPaymentSessionUnavailableMessage/);
    assert.match(module, /guestPaymentReturnSubmittedMessage/);
    assert.match(module, /guestPaymentReturnCancelledMessage/);
    assert.match(module, /guestPaymentReturnUnknownMessage/);
    assert.match(module, /status === "submitted"/);
    assert.match(module, /Payment status unavailable/);
    assert.doesNotMatch(module, /supabase|stripe|service role|secret|provider error|owner|balance|payment history|lookupToken/i);
  });

  it("creates a public API route with validation, rate limiting, Turnstile, cookie context, and safe JSON", () => {
    const routePath = "app/api/guest-payments/create-session/route.ts";

    assert.ok(existsSync(join(root, routePath)));

    const route = read(routePath);

    assert.match(route, /export async function POST/);
    assert.match(route, /NextRequest/);
    assert.match(route, /validateGuestPaymentSessionRequest/);
    assert.match(route, /checkPublicRateLimit/);
    assert.match(route, /verifyTurnstile/);
    assert.match(route, /request\.cookies\.get\(guestPaymentLookupCookieName\)/);
    assert.match(route, /hashGuestPaymentLookupToken/);
    assert.match(route, /createGuestPaymentSession/);
    assert.match(route, /checkoutUrl:\s*session\.checkoutUrl/);
    assert.match(route, /cookies\.set/);
    assert.match(route, /httpOnly:\s*true/);
    assert.match(route, /sameSite:\s*"lax"/);
    assert.match(route, /path:\s*guestPaymentLookupCookiePath/);
    assert.match(route, /options\?: \{ clearLookupCookie\?: boolean \}/);
    assert.match(route, /rate-limited/);
    assert.match(route, /bot-protection-failed/);
    assertOrdered(route, [
      /payload = await request\.json\(\)/,
      /validateGuestPaymentSessionRequest\(payload\)/,
      /const rateLimit = checkPublicRateLimit/,
      /const isHuman = await verifyTurnstile/,
      /request\.cookies\.get\(guestPaymentLookupCookieName\)/,
      /const session = await createGuestPaymentSession/,
    ]);
    assert.doesNotMatch(route, /payment_intent|stripe_checkout_session_id|service role|SUPABASE_SECRET_KEY|SUPABASE_SERVICE_ROLE_KEY|STRIPE_SECRET_KEY|owner_display_name|current_balance|error\.message|lookupSessionTokenHash:\s*[^}]*Response/i);
  });

  it("implements the server-only guest payment session lifecycle without leaking private account data", () => {
    const servicePath = "server/services/payments/guest-payment-session.ts";

    assert.ok(existsSync(join(root, servicePath)));

    const service = read(servicePath);

    assert.match(service, /import "server-only"/);
    assert.match(service, /createServiceRoleClient/);
    assert.match(service, /getStripe/);
    assert.match(service, /getAppBaseUrl/);
    assert.match(service, /createGuestPaymentSession/);
    assert.match(service, /getGuestPaymentPublicSettings/);
    assert.match(service, /\.from\("guest_payment_lookup_sessions"\)/);
    assert.match(service, /\.update\(\{\s*used_at:\s*claimedAt\s*\}\)/s);
    assert.match(service, /\.is\("used_at", null\)/);
    assert.match(service, /\.gt\("expires_at", claimedAt\)/);
    assert.match(service, /\.select\("id, community_id, property_id"\)/);
    assert.match(service, /\.from\("communities"\)/);
    assert.match(service, /\.from\("community_settings"\)/);
    assert.match(service, /guest_payments_enabled/);
    assert.match(service, /\.from\("properties"\)/);
    assert.match(service, /\.from\("payments"\)/);
    assert.match(service, /payer_type:\s*"guest"/);
    assert.match(service, /profile_id:\s*null/);
    assert.match(service, /guest_name:\s*input\.payerName/);
    assert.match(service, /guest_email:\s*input\.payerEmail/);
    assert.match(service, /guest_phone:\s*input\.payerPhone \?\? null/);
    assert.match(service, /status:\s*"created"/);
    assert.match(service, /stripe\.checkout\.sessions\.create/);
    assert.match(service, /mode:\s*"payment"/);
    assert.match(service, /payment_method_types/);
    assert.match(service, /customer_email:\s*input\.payerEmail/);
    assert.match(service, /payerType:\s*"guest"/);
    assert.match(service, /lookupSessionId:\s*lookupSession\.id/);
    assert.match(service, /\.update\(\{\s*status:\s*"pending",\s*stripe_checkout_session_id:\s*session\.id\s*\}\)/s);
    assert.match(service, /\.select\("id"\)/);
    assert.match(service, /if \(updateError \|\| !updatedPayment\)/);
    assert.match(service, /expireCheckoutSession/);
    assert.match(service, /checkout\.sessions\.expire/);
    assert.match(service, /status:\s*"void"/);
    assert.match(service, /checkoutUrl:\s*session\.url/);
    assert.doesNotMatch(service, /public_payment_code|owner_display_name|current_balance_cents|resident_payment_history|payment_allocations|payment_events|stripe_payment_intent_id|raw lookup|error\.message|throw new Error/i);
  });

  it("renders accessible public payment and return screens without client-side token storage", () => {
    const paymentPagePath = "app/(public)/pay-dues/payment/page.tsx";
    const returnPagePath = "app/(public)/pay-dues/return/page.tsx";
    const formPath = "components/public/guest-payment-session-form.tsx";

    assert.ok(existsSync(join(root, paymentPagePath)));
    assert.ok(existsSync(join(root, returnPagePath)));
    assert.ok(existsSync(join(root, formPath)));

    const paymentPage = read(paymentPagePath);
    const returnPage = read(returnPagePath);
    const form = read(formPath);

    assert.match(paymentPage, /GuestPaymentSessionForm/);
    assert.match(paymentPage, /dynamic = "force-dynamic"/);
    assert.match(paymentPage, /getGuestPaymentPublicSettings/);
    assert.match(paymentPage, /paymentSettings\.allowCard/);
    assert.match(paymentPage, /paymentSettings\.allowAch/);
    assert.match(paymentPage, /paymentSettings\.onlinePaymentsAvailable/);
    assert.match(paymentPage, /NEXT_PUBLIC_TURNSTILE_SITE_KEY/);
    assert.doesNotMatch(paymentPage, /owner_display_name|current_balance|payment history|account number|lookupToken/i);

    assert.match(form, /"use client"/);
    assert.match(form, /name="payerName"/);
    assert.match(form, /name="payerEmail"/);
    assert.match(form, /name="payerPhone"/);
    assert.match(form, /name="amount"/);
    assert.match(form, /name="methodPreference"/);
    assert.match(form, /type="radio"/);
    assert.match(form, /value=\{option\.value\}/);
    assert.match(form, /cf-turnstile-response/);
    assert.match(form, /development-turnstile-token/);
    assert.match(form, /fetch\("\/api\/guest-payments\/create-session"/);
    assert.match(form, /window\.location\.assign\(result\.checkoutUrl\)/);
    assert.match(form, /aria-live="polite"/);
    assert.match(form, /aria-invalid=\{/);
    assert.match(form, /fieldset[\s\S]*?aria-invalid=\{Boolean\(errors\.methodPreference\)\}/);
    assert.match(form, /aria-describedby=\{/);
    assert.doesNotMatch(form, /localStorage|sessionStorage|lookupToken|tokenHash|owner|balance|payment history|service role|secret|stripe_checkout_session_id|payment_intent/i);

    assert.match(returnPage, /normalizeGuestPaymentReturnStatus/);
    assert.match(returnPage, /getGuestPaymentReturnContent/);
    assert.match(returnPage, /content\.heading/);
    assert.match(returnPage, /content\.message/);
    assert.doesNotMatch(returnPage, /paymentId|checkout_session|session_id|stripe|supabase|owner|balance|payment history|account number|resident/i);
  });
});
