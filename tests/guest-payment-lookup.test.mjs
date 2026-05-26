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

describe("guest property lookup for payment", () => {
  it("documents Turnstile env vars without committing secrets", () => {
    const envExample = read(".env.example");

    assert.match(envExample, /NEXT_PUBLIC_TURNSTILE_SITE_KEY=/);
    assert.match(envExample, /TURNSTILE_SECRET_KEY=/);
    assert.doesNotMatch(envExample, /0x[0-9A-Za-z_-]{20,}|sk_live_|sb_secret_[A-Za-z0-9]+|eyJ[A-Za-z0-9_-]+\./);
  });

  it("adds lookup indexes while Story 3.5 owns token persistence", () => {
    const migrationPath =
      "supabase/migrations/202605110004_add_guest_payment_lookup_indexes.sql";

    assert.ok(existsSync(join(root, migrationPath)));
    assert.ok(!existsSync(join(root, "supabase/migrations/202605110004_create_guest_payment_lookup_sessions.sql")));

    const migration = read(migrationPath);

    assert.match(migration, /properties_guest_public_payment_code_lookup_idx/i);
    assert.match(migration, /properties_guest_account_postal_lookup_idx/i);
    assert.doesNotMatch(migration, /guest_payment_lookup_sessions|token_hash|expires_at|used_at/i);
    assert.doesNotMatch(migration, /address_line1 text|postal_code text|account_number text|public_payment_code text|owner_display_name|current_balance_cents|guest_name|guest_email|guest_phone|ip_address|remote_ip/i);
    assert.doesNotMatch(migration, /create policy "[^"]*(anon|guest|public|resident|authenticated)[^"]*"/i);
  });

  it("adds Story 3.5 lookup-session persistence without raw lookup inputs", () => {
    const migrationPath =
      "supabase/migrations/202605110005_create_guest_payment_lookup_sessions.sql";

    assert.ok(existsSync(join(root, migrationPath)));

    const migration = read(migrationPath);

    assert.match(migration, /create table if not exists public\.guest_payment_lookup_sessions/i);
    assert.match(migration, /community_id uuid not null references public\.communities\(id\) on delete cascade/i);
    assert.match(migration, /property_id uuid not null references public\.properties\(id\) on delete cascade/i);
    assert.match(migration, /token_hash text not null unique/i);
    assert.match(migration, /expires_at timestamptz not null/i);
    assert.match(migration, /used_at timestamptz/i);
    assert.match(migration, /guest_payment_lookup_sessions_token_hash_idx/i);
    assert.match(migration, /guest_payment_lookup_sessions_active_expiry_idx/i);
    assert.match(migration, /where used_at is null/i);
    assert.match(migration, /guest_payment_lookup_sessions_property_context_idx/i);
    assert.match(migration, /alter table public\.guest_payment_lookup_sessions enable row level security/i);
    assert.match(migration, /revoke all on public\.guest_payment_lookup_sessions from anon, authenticated/i);
    assert.doesNotMatch(migration, /address_line1|postal_code|account_number|public_payment_code|owner_display_name|current_balance_cents|guest_name|guest_email|guest_phone|ip_address|remote_ip/i);
    assert.doesNotMatch(migration, /create policy/i);
  });

  it("defines public-safe guest lookup validation and messages", () => {
    const modulePath = "lib/public/guest-payment-lookup.ts";

    assert.ok(existsSync(join(root, modulePath)));

    const lookup = read(modulePath);

    assert.match(lookup, /export type GuestPaymentLookupRequest/);
    assert.match(lookup, /export type GuestPaymentLookupErrors/);
    assert.match(lookup, /export type GuestPaymentLookupApiResponse/);
    assert.match(lookup, /export function validateGuestPaymentLookupRequest/);
    assert.match(lookup, /normalizeLookupText/);
    assert.match(lookup, /CONTROL_CHARACTER_PATTERN/);
    assert.match(lookup, /spring-meadow-community/);
    assert.match(lookup, /publicPaymentCode/);
    assert.match(lookup, /postalCode/);
    assert.match(lookup, /turnstileToken/);
    assert.match(lookup, /guestLookupSuccessMessage/);
    assert.match(lookup, /guestLookupNotConfirmedMessage/);
    assert.match(lookup, /guestLookupRateLimitedMessage/);
    assert.match(lookup, /guestLookupTurnstileMessage/);
    assert.doesNotMatch(lookup, /lookupToken|owner|balance|payment history|property exists|account exists|supabase|stripe|service role|secret|provider|ip address|threshold|turnstile.*code/i);
  });

  it("implements a server-only rate-limit helper with generic outcomes", () => {
    const helperPath = "server/public/rate-limit.ts";

    assert.ok(existsSync(join(root, helperPath)));

    const helper = read(helperPath);

    assert.match(helper, /import "server-only"/);
    assert.match(helper, /export function checkPublicRateLimit/);
    assert.match(helper, /export function derivePublicClientIp/);
    assert.match(helper, /export function createPublicRateLimitKey/);
    assert.match(helper, /pruneExpiredBuckets/);
    assert.match(helper, /buckets\.delete/);
    assert.match(helper, /MAX_PUBLIC_RATE_LIMIT_BUCKETS/);
    assert.match(helper, /fingerprint/);
    assert.match(helper, /cf-connecting-ip/);
    assert.match(helper, /x-forwarded-for/);
    assert.match(helper, /Map/);
    assert.match(helper, /windowMs/);
    assert.match(helper, /limit/);
    assert.match(helper, /allowed:\s*false/);
    assert.doesNotMatch(helper, /Response\.json|ip address|threshold|secret|turnstile|stripe|supabase/i);
  });

  it("implements server-only guest property lookup with service-role scoping and safe fields", () => {
    const servicePath = "server/services/payments/guest-property-lookup.ts";

    assert.ok(existsSync(join(root, servicePath)));

    const service = read(servicePath);

    assert.match(service, /import "server-only"/);
    assert.match(service, /createServiceRoleClient/);
    assert.match(service, /createGuestPropertyLookup/);
    assert.match(service, /\.from\("communities"\)/);
    assert.match(service, /\.from\("community_settings"\)/);
    assert.match(service, /guest_payments_enabled/);
    assert.match(service, /\.from\("properties"\)/);
    assert.match(service, /\.from\("guest_payment_lookup_sessions"\)/);
    assert.match(service, /\.eq\("community_id", community\.id\)/);
    assert.match(service, /\.eq\("status", "active"\)/);
    assert.match(service, /\.is\("deleted_at", null\)/);
    assert.match(service, /\.limit\(2\)/);
    assert.match(service, /generateGuestPaymentLookupToken/);
    assert.match(service, /hashGuestPaymentLookupToken/);
    assert.match(service, /token_hash/);
    assert.match(service, /expires_at/);
    assert.match(service, /if \(sessionError\) \{\s*return notConfirmed\(\);\s*\}/s);
    assert.match(service, /\.select\("id, community_id"\)/);
    assert.match(service, /lookup-confirmed/);
    assert.match(service, /not-confirmed/);
    assert.match(service, /payment-unavailable/);
    assert.doesNotMatch(service, /owner_display_name|current_balance_cents|last_payment_at|next_due_date|resident|documents|payment_history|payment_events|stripe_checkout|stripe_payment|guest_email|guest_phone|error\.message|throw new Error/i);
  });

  it("adds a public lookup route with Turnstile, rate limiting, and no payment creation", () => {
    const routePath = "app/api/guest-payments/lookup/route.ts";

    assert.ok(existsSync(join(root, routePath)));

    const route = read(routePath);

    assert.match(route, /export async function POST/);
    assert.match(route, /validateGuestPaymentLookupRequest/);
    assert.match(route, /verifyTurnstile/);
    assert.match(route, /checkPublicRateLimit/);
    assert.match(route, /createPublicRateLimitKey/);
    assert.match(route, /derivePublicClientIp/);
    assert.match(route, /createGuestPropertyLookup/);
    assert.match(route, /deriveRemoteIp/);
    assert.match(route, /Response\.json/);
    assert.match(route, /canProceed:\s*true/);
    assert.match(route, /cookies\.set/);
    assert.match(route, /httpOnly:\s*true/);
    assert.match(route, /sameSite:\s*"lax"/);
    assert.match(route, /path:\s*guestPaymentLookupCookiePath/);
    assert.match(route, /rate-limited/);
    assert.match(route, /bot-protection-failed/);
    assert.doesNotMatch(route, /return "unknown"|guest-payment-lookup:\$\{remoteIp\}/);
    assert.doesNotMatch(route, /lookupToken:\s*lookup\.lookupToken|lookupToken,\s*message/);
    assert.doesNotMatch(route, /lookupToken|createResidentPaymentSession|stripe|checkoutUrl|PaymentIntent|payment_intent|\.from\("payments"\)|guest_email|guest_phone|owner_display_name|current_balance|error\.message|TURNSTILE_SECRET_KEY|SUPABASE_SECRET_KEY|SUPABASE_SERVICE_ROLE_KEY/i);
  });

  it("renders a real accessible guest lookup form without exposing continuation tokens", () => {
    const pagePath = "app/(public)/pay-dues/lookup/page.tsx";
    const formPath = "components/public/guest-payment-lookup-form.tsx";

    assert.ok(existsSync(join(root, pagePath)));
    assert.ok(existsSync(join(root, formPath)));

    const page = read(pagePath);
    const form = read(formPath);

    assert.match(page, /GuestPaymentLookupForm/);
    assert.match(page, /publicPaymentSettings\.communitySlug/);
    assert.match(page, /NEXT_PUBLIC_TURNSTILE_SITE_KEY/);
    assert.doesNotMatch(page, /being prepared|readOnly|aria-disabled|disabled/);

    assert.match(form, /"use client"/);
    assert.match(form, /name="addressLine1"/);
    assert.match(form, /name="postalCode"/);
    assert.match(form, /name="accountNumber"/);
    assert.match(form, /name="publicPaymentCode"/);
    assert.match(form, /cf-turnstile-response/);
    assert.match(form, /development-turnstile-token/);
    assert.match(form, /fetch\("\/api\/guest-payments\/lookup"/);
    assert.match(form, /aria-live="polite"/);
    assert.match(form, /aria-invalid=\{/);
    assert.match(form, /aria-describedby=\{/);
    assert.match(form, /focus-visible:/);
    assert.match(form, /Contact the HOA about dues/);
    assert.match(form, /disabled=\{submitState === "submitting" \|\| submitState === "success"\}/);
    assert.doesNotMatch(form, /lookupToken\}|<[^>]+value=\{[^}]*lookupToken|owner|balance|payment history|property exists|account exists|stripe|checkoutUrl|PaymentIntent|service role|secret/i);
  });

  it("keeps guest lookup isolated from Stripe sessions, resident flows, and private data", () => {
    const implementation = readExisting([
      "app/(public)/pay-dues/lookup/page.tsx",
      "components/public/guest-payment-lookup-form.tsx",
      "lib/public/guest-payment-lookup.ts",
      "app/api/guest-payments/lookup/route.ts",
      "server/services/payments/guest-property-lookup.ts",
      "server/public/rate-limit.ts",
      "server/public/turnstile.ts",
    ]);
    const appRoutes = listFiles("app/api");

    assert.ok(existsSync(join(root, "app/api/guest-payments/create-session/route.ts")));
    assert.ok(appRoutes.includes("app/api/guest-payments/lookup/route.ts"));
    assert.doesNotMatch(implementation, /@\/lib\/stripe\/server|new Stripe|checkout\.sessions|PaymentIntent|checkoutUrl|stripe_checkout_session_id|stripe_payment_intent_id/i);
    assert.doesNotMatch(implementation, /\.from\("payments"\)|\.from\("payment_allocations"\)|\.from\("payment_events"\)/);
    assert.doesNotMatch(implementation, /getResidentPortalMemberships|createResidentPaymentSession|startResidentPaymentSession/);
    assert.doesNotMatch(
      implementation,
      /owner_display_name|current_balance_cents|last_payment_at|next_due_date|public_payment_code[,\s]*owner|resident contacts|private documents|payment history|raw Supabase|raw Stripe/i,
    );
  });
});
