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

function withoutStripeWebhookRoute(paths) {
  return paths.filter((path) => path !== "app/api/stripe/webhook/route.ts");
}

describe("resident Stripe payment session", () => {
  it("adds only the server-side Stripe dependency and documents server-only env", () => {
    const packageJson = JSON.parse(read("package.json"));
    const envExample = read(".env.example");

    assert.ok(packageJson.dependencies?.stripe);
    assert.ok(!packageJson.dependencies?.["@stripe/stripe-js"]);
    assert.match(envExample, /NEXT_PUBLIC_SUPABASE_URL=/);
    assert.match(envExample, /NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=/);
    assert.match(envExample, /STRIPE_SECRET_KEY=/);
    assert.match(envExample, /(SUPABASE_SECRET_KEY|SUPABASE_SERVICE_ROLE_KEY)=/);
    assert.match(envExample, /APP_BASE_URL=/);
    assert.doesNotMatch(envExample, /sk_live_|sb_secret_[A-Za-z0-9]+|eyJ[A-Za-z0-9_-]+\./);
  });

  it("keeps Stripe and trusted Supabase clients server-only", () => {
    const stripePath = "lib/stripe/server.ts";
    const serviceRolePath = "lib/supabase/service-role.ts";

    assert.ok(existsSync(join(root, stripePath)));
    assert.ok(existsSync(join(root, serviceRolePath)));

    const stripe = read(stripePath);
    const serviceRole = read(serviceRolePath);
    const clientFacingFiles = readExisting([
      ...withoutStripeWebhookRoute(listFiles("app")),
      ...listFiles("components"),
      "lib/supabase/client.ts",
      "lib/supabase/proxy.ts",
      "proxy.ts",
    ]);

    assert.match(stripe, /import "server-only"/);
    assert.match(stripe, /from "stripe"/);
    assert.match(stripe, /STRIPE_SECRET_KEY/);
    assert.match(stripe, /APP_BASE_URL/);
    assert.match(stripe, /new Stripe/);
    assert.match(stripe, /new URL\(baseUrl\)/);
    assert.match(stripe, /protocol/);
    assert.match(stripe, /http:/);
    assert.match(stripe, /https:/);
    assert.match(stripe, /username/);
    assert.match(stripe, /password/);
    assert.match(stripe, /search/);
    assert.match(stripe, /hash/);

    assert.match(serviceRole, /import "server-only"/);
    assert.match(serviceRole, /@supabase\/supabase-js/);
    assert.match(serviceRole, /SUPABASE_SECRET_KEY|SUPABASE_SERVICE_ROLE_KEY/);
    assert.match(serviceRole, /persistSession:\s*false/);
    assert.match(serviceRole, /autoRefreshToken:\s*false/);

    assert.doesNotMatch(clientFacingFiles, /lib\/stripe\/server|@\/lib\/stripe\/server/);
    assert.doesNotMatch(clientFacingFiles, /lib\/supabase\/service-role|@\/lib\/supabase\/service-role/);
    assert.doesNotMatch(clientFacingFiles, /STRIPE_SECRET_KEY|SUPABASE_SECRET_KEY|SUPABASE_SERVICE_ROLE_KEY/);
  });

  it("creates community payment settings with defaults, RLS, and no broad resident reads", () => {
    const migrationPath =
      "supabase/migrations/202605110003_create_community_payment_settings_for_sessions.sql";

    assert.ok(existsSync(join(root, migrationPath)));

    const migration = read(migrationPath);

    assert.match(migration, /create table if not exists public\.community_settings/i);
    assert.match(migration, /community_id uuid primary key references public\.communities\(id\) on delete cascade/i);
    assert.match(migration, /stripe_account_mode text not null default 'platform'/i);
    assert.match(migration, /stripe_connected_account_id text/i);
    assert.match(migration, /fee_policy text not null default 'payer_pays'/i);
    assert.match(migration, /check \(fee_policy in \('payer_pays', 'hoa_pays', 'configurable'\)\)/i);
    assert.match(migration, /allow_card boolean not null default true/i);
    assert.match(migration, /allow_ach boolean not null default true/i);
    assert.match(migration, /guest_payments_enabled boolean not null default true/i);
    assert.match(migration, /feature_flags jsonb not null default '\{\}'::jsonb/i);
    assert.match(migration, /insert into public\.community_settings/i);
    assert.match(migration, /from public\.communities/i);
    assert.match(migration, /on conflict \(community_id\) do nothing/i);
    assert.match(migration, /alter table public\.community_settings enable row level security/i);
    assert.match(migration, /revoke all on public\.community_settings from anon, authenticated/i);
    assert.match(migration, /community_settings_feature_flags_gin_idx/i);
    assert.doesNotMatch(migration, /create policy "[^"]*resident[^"]*"/i);
    assert.doesNotMatch(migration, /grant select on public\.community_settings to authenticated/i);
  });

  it("implements a server-only resident payment session service with layered authorization", () => {
    const servicePath = "server/services/payments/resident-payment-session.ts";

    assert.ok(existsSync(join(root, servicePath)));

    const service = read(servicePath);

    assert.match(service, /import "server-only"/);
    assert.match(service, /getResidentPortalMemberships/);
    assert.match(service, /createServiceRoleClient/);
    assert.match(service, /getStripe/);
    assert.match(service, /getAppBaseUrl/);
    assert.match(service, /createResidentPaymentSession/);
    assert.match(service, /getResidentPaymentSettings/);
    assert.match(service, /canPayDues/);
    assert.match(service, /canViewBalance/);
    assert.match(service, /\.from\("community_settings"\)/);
    assert.match(service, /\.from\("properties"\)/);
    assert.match(service, /\.from\("assessments"\)/);
    assert.match(service, /\.from\("payments"\)/);
    assert.match(service, /\.eq\("community_id", input\.communityId\)/);
    assert.match(service, /\.eq\("property_id", input\.propertyId\)/);
    assert.match(service, /OPEN_ASSESSMENT_STATUSES/);
    assert.match(service, /amountCents/);
    assert.match(service, /MAX_PAYMENT_AMOUNT_CENTS/);
    assert.match(service, /allow_card/);
    assert.match(service, /allow_ach/);
    assert.match(service, /us_bank_account/);
    assert.match(service, /payer_type:\s*"resident"/);
    assert.match(service, /profile_id:\s*profile\.id/);
    assert.match(service, /status:\s*"created"/);
    assert.match(service, /\.update\(\{\s*status:\s*"pending",\s*stripe_checkout_session_id:\s*session\.id\s*\}\)/s);
    assert.match(service, /stripe\.checkout\.sessions\.create/);
    assert.match(service, /mode:\s*"payment"/);
    assert.match(service, /success_url/);
    assert.match(service, /cancel_url/);
    assert.match(service, /metadata/);
    assert.match(service, /stripe_checkout_session_id/);
    assert.match(service, /status:\s*"void"/);
    assert.match(service, /checkoutUrl:\s*session\.url/);
    assert.match(service, /configuration-unavailable/);
    assert.match(service, /payment-unavailable/);
    assert.doesNotMatch(service, /assessmentIds|normalizeAssessmentIds|\.in\("id",\s*assessmentIds\)/);

    assert.doesNotMatch(
      service,
      /throw new Error|error\.message|owner_display_name|public_payment_code|guest_name|guest_email|guest_phone|stripe_secret|service role key|private documents|message contents/i,
    );
  });

  it("adds a server action that parses form data and redirects only to safe outcomes", () => {
    const actionPath = "server/actions/resident-payments.ts";

    assert.ok(existsSync(join(root, actionPath)));

    const action = read(actionPath);

    assert.match(action, /"use server"/);
    assert.match(action, /createResidentPaymentSession/);
    assert.match(action, /FormData/);
    assert.match(action, /communityId/);
    assert.match(action, /propertyId/);
    assert.match(action, /amountCents/);
    assert.match(action, /methodPreference/);
    assert.match(action, /redirect\(result\.checkoutUrl\)/);
    assert.match(action, /\/portal\/payments\?payment=/);
    assert.match(action, /invalid-request/);
    assert.match(action, /unauthorized/);
    assert.match(action, /configuration-unavailable/);
    assert.match(action, /payment-unavailable/);
    assert.doesNotMatch(action, /assessmentIds|getAll\("assessmentIds"\)|parseAssessmentIds/);
    assert.doesNotMatch(action, /error\.message|STRIPE_SECRET_KEY|SUPABASE_SECRET_KEY|SUPABASE_SERVICE_ROLE_KEY|stripe_checkout_session_id|payment_intent|guest_email/i);
  });

  it("renders property-scoped payment forms without weakening resident dues privacy", () => {
    const pagePath = "app/(resident)/portal/(member)/payments/page.tsx";

    assert.ok(existsSync(join(root, pagePath)));

    const page = read(pagePath);

    assert.match(page, /getResidentDuesStatus/);
    assert.match(page, /getResidentPaymentSettings/);
    assert.match(page, /startResidentPaymentSession/);
    assert.match(page, /name="communityId"/);
    assert.match(page, /name="propertyId"/);
    assert.match(page, /name="amount"/);
    assert.match(page, /name="methodPreference"/);
    assert.match(page, /type="radio"/);
    assert.match(page, /value="card"/);
    assert.match(page, /value="ach"/);
    assert.match(page, /property\.canPayDues/);
    assert.match(page, /property\.canViewBalance/);
    assert.match(page, /online payments are temporarily unavailable/i);
    assert.match(page, /payment=cancelled/);
    assert.match(page, /payment=invalid/);
    assert.match(page, /payment=unavailable/);
    assert.match(page, /Date\.UTC\(year, month - 1, day, 12\)/);
    assert.ok(
      page.indexOf("<PaymentAction") > page.indexOf("property.canViewBalance ?"),
      "payment action must remain outside the canViewBalance branch",
    );
    assert.doesNotMatch(page, /name="assessmentIds"/);

    assert.doesNotMatch(
      page,
      /owner_display_name|raw account|public payment code|guest email|guest phone|checkout session|payment_intent|stripe_checkout_session_id|stripe_payment_intent_id|webhook|error\.message|SERVICE_ROLE|service_role/i,
    );
  });
});
