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

function assertBefore(content, first, second) {
  const firstIndex = content.indexOf(first);
  const secondIndex = content.indexOf(second);

  assert.ok(firstIndex >= 0, `Expected to find ${first}`);
  assert.ok(secondIndex >= 0, `Expected to find ${second}`);
  assert.ok(firstIndex < secondIndex, `Expected ${first} before ${second}`);
}

const adminPagePaths = [
  "app/(admin)/admin/page.tsx",
  "app/(admin)/admin/payments/page.tsx",
  "app/(admin)/admin/delinquency/page.tsx",
  "app/(admin)/admin/documents/page.tsx",
  "app/(admin)/admin/announcements/page.tsx",
  "app/(admin)/admin/events/page.tsx",
  "app/(admin)/admin/messages/page.tsx",
  "app/(admin)/admin/properties/page.tsx",
  "app/(admin)/admin/users/page.tsx",
  "app/(admin)/admin/roles/page.tsx",
  "app/(admin)/admin/assessments/page.tsx",
  "app/(admin)/admin/compliance/page.tsx",
  "app/(admin)/admin/records/page.tsx",
  "app/(admin)/admin/audit/page.tsx",
  "app/(admin)/admin/settings/page.tsx",
];

describe("board/admin workspace shell and navigation", () => {
  it("implements a server-only workspace context with safe permission-aware navigation", () => {
    const servicePath = "server/services/auth/admin-workspace.ts";

    assert.ok(existsSync(join(root, servicePath)));

    const service = read(servicePath);

    assert.match(service, /import "server-only"/);
    assert.match(service, /createClient/);
    assert.match(service, /getCurrentProfile/);
    assert.match(service, /hasPermission/);
    assert.match(service, /board\.workspace\.access/);
    assert.match(service, /DEFAULT_COMMUNITY_SLUG = "spring-meadow-community"/);
    assert.match(service, /\.from\("communities"\)/);
    assert.match(service, /\.eq\("slug", DEFAULT_COMMUNITY_SLUG\)/);
    assert.match(service, /workspace-unavailable/);
    assert.match(service, /profile-unavailable/);
    assert.match(service, /permission-denied/);
    assert.match(service, /unauthenticated/);
    assert.match(service, /kind: "workspace"/);

    for (const [label, href] of [
      ["Dashboard", "/admin"],
      ["Properties", "/admin/properties"],
      ["Users", "/admin/users"],
      ["Roles", "/admin/roles"],
      ["Payments", "/admin/payments"],
      ["Assessments", "/admin/assessments"],
      ["Documents", "/admin/documents"],
      ["Announcements", "/admin/announcements"],
      ["Events", "/admin/events"],
      ["Messages", "/admin/messages"],
      ["Compliance Calendar", "/admin/compliance"],
      ["Records Requests", "/admin/records"],
      ["Audit Logs", "/admin/audit"],
      ["Settings", "/admin/settings"],
    ]) {
      assert.match(service, new RegExp(`label:\\s*"${label}"`));
      assert.match(service, new RegExp(`href:\\s*"${href.replaceAll("/", "\\/")}"`));
    }

    // Settings should be gated and available
    assert.match(service, /permissionKey:\s*"admin.settings.manage"/);
    assert.match(service, /currentStatus:\s*"available"/);

    for (const permission of [
      "admin.users.manage",
      "admin.roles.manage",
      "admin.payments.manage",
      "admin.assessments.manage",
      "admin.documents.manage",
      "board.documents.view",
      "admin.announcements.manage",
      "admin.events.manage",
      "admin.messages.manage",
      "audit.logs.view",
    ]) {
      assert.match(service, new RegExp(permission.replaceAll(".", "\\.")));
    }

    const workspaceFunction = service.slice(service.indexOf("export async function getAdminWorkspaceContext"));
    assertBefore(workspaceFunction, "getCurrentProfile()", "hasPermission({");
    assert.doesNotMatch(
      service,
      /createServiceRoleClient|service-role|roles\.permissions|profile_roles|audit_logs|error\.message|owner_display_name|account_number|public_payment_code|stripe_|resend|SUPABASE_SECRET_KEY|SUPABASE_SERVICE_ROLE_KEY/i,
    );
  });

  it("adds a guarded server layout, dashboard route, and isolated client nav", () => {
    const layoutPath = "app/(admin)/admin/layout.tsx";
    const dashboardPath = "app/(admin)/admin/page.tsx";
    const navPath = "components/admin/admin-workspace-nav.tsx";

    assert.ok(existsSync(join(root, layoutPath)));
    assert.ok(existsSync(join(root, dashboardPath)));
    assert.ok(existsSync(join(root, navPath)));

    const layout = read(layoutPath);
    const dashboard = read(dashboardPath);
    const nav = read(navPath);

    assert.match(layout, /getAdminWorkspaceContext/);
    assert.match(layout, /redirect\(`\/login\?next=\$\{encodeURIComponent\("\/admin"\)\}`\)/);
    assert.match(layout, /AdminWorkspaceNav/);
    assert.match(layout, /signOutCommunityUser/);
    assert.match(layout, /Access unavailable/);
    assert.match(layout, /Access denied/);
    assert.match(layout, /<main/);
    assertBefore(layout, "const workspaceResult = await getAdminWorkspaceContext();", "{children}");
    assert.doesNotMatch(
      layout,
      /listAdminPaymentRecords|listDelinquencyReport|listDocumentMetadata|listAnnouncements|listEvents|listMessageThreads|getMessageThreadDetail|createServiceRoleClient|service-role|error\.message/i,
    );

    assert.match(dashboard, /getAdminDashboardSummary/);
    assert.match(dashboard, /Operations dashboard/);
    assert.doesNotMatch(
      dashboard,
      /Spring Meadow Community operations area|Board\/admin workspace|listAdminPaymentRecords|listDocumentMetadata|listMessageThreads|listEvents|listAnnouncements|createServiceRoleClient|service-role|error\.message/i,
    );

    assert.match(nav, /"use client"/);
    assert.match(nav, /usePathname/);
    assert.match(nav, /useState/);
    assert.match(nav, /type AdminWorkspaceNavItem/);
    assert.match(nav, /aria-expanded=\{isOpen\}/);
    assert.match(nav, /aria-controls="admin-mobile-menu"/);
    assert.match(nav, /admin-mobile-menu/);
    assert.match(nav, /Escape/);
    assert.match(nav, /aria-current=\{isActive \? "page" : undefined\}/);
    assert.match(nav, /focus-visible:outline/);
    assert.match(nav, /break-words/);
    assert.match(nav, /min-w-0/);
    assert.doesNotMatch(
      nav,
      /@\/lib\/supabase|@\/server|hasPermission|getCurrentProfile|board\.workspace\.access|admin\.[a-z.]+|createServiceRoleClient|service-role|\.from\(/i,
    );
  });

  it("keeps current admin pages under the shell without nested main landmarks", () => {
    for (const path of adminPagePaths) {
      assert.ok(existsSync(join(root, path)), `${path} should exist`);
    }

    for (const path of adminPagePaths) {
      const page = read(path);

      assert.doesNotMatch(page, /<main\b/, `${path} should let the admin layout own <main>`);
      assert.doesNotMatch(page, /<\/main>/, `${path} should let the admin layout own </main>`);
      assert.doesNotMatch(page, /createServiceRoleClient|service-role|error\.message/i);
    }

    const pageContent = readExisting(adminPagePaths);
    assert.match(pageContent, /listAdminPaymentRecords/);
    assert.match(pageContent, /listDelinquencyReport/);
    assert.match(pageContent, /listDocumentMetadata/);
    assert.match(pageContent, /listAnnouncements/);
    assert.match(pageContent, /listEvents/);
    assert.match(pageContent, /listMessageThreads/);
  });

  it("protects admin routes through proxy and safe login redirect handoff", () => {
    const proxy = read("proxy.ts");
    const proxyHelper = read("lib/supabase/proxy.ts");
    const safeRedirect = read("lib/auth/safe-redirect.ts");
    const loginPage = read("app/(public)/login/page.tsx");
    const authActions = read("server/actions/auth.ts");
    const callback = read("app/auth/callback/route.ts");

    assert.match(proxy, /matcher:\s*\[\s*"\/portal\/:path\*",\s*"\/admin\/:path\*"\s*\]/);
    assert.match(proxyHelper, /isProtectedRoute/);
    assert.match(proxyHelper, /pathname === "\/admin"/);
    assert.match(proxyHelper, /pathname\.startsWith\("\/admin\/"\)/);
    assert.match(proxyHelper, /auth\.getClaims\(/);
    assert.match(proxyHelper, /request\.nextUrl\.search/);
    assert.match(proxyHelper, /loginUrl\.searchParams\.set\("next"/);
    assert.doesNotMatch(proxyHelper, /auth\.getSession\(/);

    assert.match(safeRedirect, /safeCommunityRedirectPath/);
    assert.match(safeRedirect, /SAFE_REDIRECT_ROOTS = \["\/portal", "\/admin"\]/);
    assert.match(safeRedirect, /new URL\(value, LOCAL_REDIRECT_ORIGIN\)/);
    assert.match(safeRedirect, /value\.startsWith\("\/\/"\)/);
    assert.match(safeRedirect, /hasUnsafePathSegment/);
    assert.match(safeRedirect, /decoded === "\.\."/);
    assert.match(safeRedirect, /decoded === "\."/);
    assert.match(safeRedirect, /redirectUrl\.search/);

    for (const content of [loginPage, authActions, callback]) {
      assert.match(content, /safeCommunityRedirectPath/);
      assert.doesNotMatch(content, /https?:\/\/|protocol-relative|error\.message|SERVICE_ROLE|service_role/i);
    }

    assert.match(authActions, /signOutCommunityUser/);
    assert.match(authActions, /signOutResident/);
  });

  it("does not leak admin workspace internals into public, guest, resident, or shared client surfaces", () => {
    const clientFacingFiles = [
      ...listFiles("app/(public)"),
      ...listFiles("app/(resident)"),
      ...listFiles("components/public"),
      ...listFiles("components/resident"),
      "lib/supabase/client.ts",
    ];
    const content = readExisting(clientFacingFiles);

    assert.doesNotMatch(
      content,
      /admin-workspace|admin-workspace-nav|board\.workspace\.access|admin\.users\.manage|admin\.payments\.manage|admin\.assessments\.manage|admin\.documents\.manage|admin\.announcements\.manage|admin\.events\.manage|admin\.messages\.manage|audit\.logs\.view|createServiceRoleClient|service-role|profile_roles|audit_logs|message_threads|payment_allocations|owner_display_name|account_number|public_payment_code|stripe_|resend|error\.message/i,
    );
  });
});
