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

const memberPortalPagePath = "app/(resident)/portal/(member)/page.tsx";
const memberPortalLayoutPath = "app/(resident)/portal/(member)/layout.tsx";

describe("resident authentication entry and session handling", () => {
  it("defines Supabase SSR helpers and public env documentation", () => {
    assert.ok(existsSync(join(root, "lib/supabase/client.ts")));
    assert.ok(existsSync(join(root, "lib/supabase/server.ts")));
    assert.ok(existsSync(join(root, "lib/supabase/proxy.ts")));
    assert.ok(existsSync(join(root, ".env.example")));

    const browserClient = read("lib/supabase/client.ts");
    const serverClient = read("lib/supabase/server.ts");
    const proxyHelper = read("lib/supabase/proxy.ts");
    const envExample = read(".env.example");

    assert.match(browserClient, /createBrowserClient/);
    assert.match(browserClient, /NEXT_PUBLIC_SUPABASE_URL/);
    assert.match(browserClient, /NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY/);
    assert.doesNotMatch(browserClient, /SERVICE_ROLE|service_role|SECRET|PRIVATE_KEY/);

    assert.match(serverClient, /createServerClient/);
    assert.match(serverClient, /cookies\(/);
    assert.match(proxyHelper, /createServerClient/);
    assert.match(proxyHelper, /auth\.getClaims\(/);

    assert.match(envExample, /NEXT_PUBLIC_SUPABASE_URL=/);
    assert.match(envExample, /NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=/);
    assert.match(envExample, /STRIPE_SECRET_KEY=/);
    assert.match(envExample, /(SUPABASE_SECRET_KEY|SUPABASE_SERVICE_ROLE_KEY)=/);
    assert.match(envExample, /NEXT_PUBLIC_TURNSTILE_SITE_KEY=/);
    assert.match(envExample, /TURNSTILE_SECRET_KEY=/);
    assert.match(envExample, /APP_BASE_URL=/);
    assert.match(envExample, /RESEND_API_KEY=/);
    assert.match(envExample, /RESEND_FROM_EMAIL=/);
    assert.doesNotMatch(envExample, /CRON/);
    assert.doesNotMatch(envExample, /0x[0-9A-Za-z_-]{20,}|sk_live_|sb_secret_[A-Za-z0-9]+|eyJ[A-Za-z0-9_-]+\./);
  });

  it("renders a real accessible public login form with privacy-safe errors", () => {
    const loginPage = read("app/(public)/login/page.tsx");

    assert.doesNotMatch(loginPage, /PlaceholderPage/);
    assert.match(loginPage, /<h1[^>]*>/);
    assert.match(loginPage, /<form/);
    assert.match(loginPage, /htmlFor="email"/);
    assert.match(loginPage, /name="email"/);
    assert.match(loginPage, /type="email"/);
    assert.match(loginPage, /htmlFor="password"/);
    assert.match(loginPage, /name="password"/);
    assert.match(loginPage, /type="password"/);
    assert.match(loginPage, /aria-describedby/);
    assert.match(loginPage, /role="alert"/);
    assert.match(loginPage, /We could not sign you in with those details/);
    assert.doesNotMatch(loginPage, /account (exists|does not exist)|user not found|invalid login credentials/i);
  });

  it("implements server-side sign-in, logout, and callback handling", () => {
    assert.ok(existsSync(join(root, "server/actions/auth.ts")));
    assert.ok(existsSync(join(root, "app/auth/callback/route.ts")));

    const actions = read("server/actions/auth.ts");
    const callback = read("app/auth/callback/route.ts");

    assert.match(actions, /"use server"/);
    assert.match(actions, /signInWithPassword/);
    assert.match(actions, /signOut/);
    assert.match(actions, /redirect\("\/portal"\)/);
    assert.match(actions, /We could not sign you in with those details/);
    assert.doesNotMatch(actions, /throw new Error|error\.message|SERVICE_ROLE|service_role/);

    assert.match(callback, /exchangeCodeForSession/);
    assert.match(callback, /safeRedirectPath/);
    assert.match(callback, /\/login\?authError=expired/);
    assert.doesNotMatch(callback, /https?:\/\/|error_description|error\.message/);
  });

  it("protects resident portal routes before rendering private content", () => {
    assert.ok(existsSync(join(root, "proxy.ts")));
    assert.ok(existsSync(join(root, memberPortalPagePath)));
    assert.ok(existsSync(join(root, memberPortalLayoutPath)));

    const proxy = read("proxy.ts");
    const proxyHelper = read("lib/supabase/proxy.ts");
    const portalPage = `${read(memberPortalLayoutPath)}\n${read(memberPortalPagePath)}`;

    assert.match(proxy, /export async function proxy/);
    assert.match(proxy, /matcher:\s*\[\s*"\/portal\/:path\*"/);
    assert.match(proxyHelper, /NextResponse\.redirect\(new URL\("\/login"/);
    assert.match(proxyHelper, /auth\.getClaims\(/);
    assert.match(proxyHelper, /request\.nextUrl\.search/);
    assert.doesNotMatch(proxyHelper, /auth\.getSession\(/);

    assert.match(portalPage, /Resident portal/);
    assert.match(portalPage, /signOutResident/);
    assert.doesNotMatch(
      portalPage,
      /owner|account number|dues balance|private documents|property_memberships|board-only|admin-only/i,
    );
  });

  it("keeps auth implementation inside the intended privacy and scope boundaries", () => {
    const authFiles = [
      "app/(public)/login/page.tsx",
      "server/actions/auth.ts",
      "app/auth/callback/route.ts",
      memberPortalLayoutPath,
      memberPortalPagePath,
      "lib/supabase/client.ts",
      "lib/supabase/server.ts",
      "lib/supabase/proxy.ts",
      "proxy.ts",
    ];
    const content = readExisting(authFiles);
    const appFiles = listFiles("app");

    assert.ok(!existsSync(join(root, "middleware.ts")), "Next.js 16 proxy.ts should be used instead");
    assert.ok(appFiles.includes("app/(public)/login/page.tsx"));
    assert.ok(appFiles.includes(memberPortalPagePath));
    assert.ok(appFiles.includes(memberPortalLayoutPath));

    assert.doesNotMatch(content, /password_hash|argon2|bcrypt|SERVICE_ROLE|service_role/i);
    assert.doesNotMatch(content, /property_memberships|canAccessProperty|profile_roles/);
    assert.doesNotMatch(content, /dues balance|private documents|owner name|board-only|admin-only/i);
    assert.doesNotMatch(content, /error_description|invalid login credentials|user not found/i);
  });
});
