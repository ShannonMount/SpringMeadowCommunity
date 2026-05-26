import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();

function read(path) {
  return readFileSync(join(root, path), "utf8");
}

describe("resident portal layout and navigation", () => {
  it("defines the member-only resident route shell without wrapping invitation acceptance", () => {
    const memberLayoutPath = "app/(resident)/portal/(member)/layout.tsx";
    const memberHomePath = "app/(resident)/portal/(member)/page.tsx";
    const invitationPath = "app/(resident)/portal/invitations/accept/page.tsx";
    const portalServicePath = "server/services/auth/resident-portal.ts";

    assert.ok(existsSync(join(root, memberLayoutPath)));
    assert.ok(existsSync(join(root, memberHomePath)));
    assert.ok(existsSync(join(root, invitationPath)));
    assert.ok(existsSync(join(root, portalServicePath)));
    assert.ok(!existsSync(join(root, "app/(resident)/portal/page.tsx")));
    assert.ok(!existsSync(join(root, "app/(resident)/portal/layout.tsx")));
    assert.ok(!existsSync(join(root, "components/resident/resident-portal-context.tsx")));

    const layout = read(memberLayoutPath);
    const invitation = read(invitationPath);
    const portalService = read(portalServicePath);

    assert.match(layout, /getResidentPortalMemberships/);
    assert.match(portalService, /import "server-only"/);
    assert.match(portalService, /cache/);
    assert.match(portalService, /getCurrentPropertyMemberships/);
    assert.match(layout, /redirect\(`\/login\?next=\$\{encodeURIComponent\(nextPath\)\}`\)/);
    assert.match(layout, /PROFILE_UNAVAILABLE_MESSAGE/);
    assert.match(layout, /PROPERTY_MEMBERSHIP_UNAVAILABLE_MESSAGE/);
    assert.match(layout, /ResidentPortalNav/);
    assert.match(layout, /signOutResident/);
    assert.doesNotMatch(layout, /ResidentPortalProvider|membershipResult\.memberships|acceptPropertyInvitation|token=/);
    assert.match(invitation, /acceptPropertyInvitation/);
    assert.match(invitation, /buildLoginRedirect\(token\)/);
    assert.match(invitation, /\/portal\/invitations\/accept\?token=/);
  });

  it("defines all required resident navigation labels and hrefs", () => {
    const navConfigPath = "lib/resident/portal-navigation.ts";

    assert.ok(existsSync(join(root, navConfigPath)));

    const navConfig = read(navConfigPath);

    for (const [label, href] of [
      ["Dashboard", "/portal"],
      ["Payments", "/portal/payments"],
      ["Documents", "/portal/documents"],
      ["Announcements", "/portal/announcements"],
      ["Events", "/portal/events"],
      ["Messages", "/portal/messages"],
      ["Contact Board", "/portal/contact-board"],
      ["My Property", "/portal/my-property"],
    ]) {
      assert.match(navConfig, new RegExp(`label:\\s*"${label}"`));
      assert.match(navConfig, new RegExp(`href:\\s*"${href.replaceAll("/", "\\/")}"`));
    }
  });

  it("implements keyboard-reachable desktop and mobile resident navigation with active state", () => {
    const navPath = "components/resident/resident-portal-nav.tsx";

    assert.ok(existsSync(join(root, navPath)));

    const nav = read(navPath);

    assert.match(nav, /"use client"/);
    assert.match(nav, /usePathname/);
    assert.match(nav, /useState/);
    assert.match(nav, /residentPortalNavigationItems/);
    assert.match(nav, /aria-label="Resident portal"/);
    assert.match(nav, /aria-current=\{isActive \? "page" : undefined\}/);
    assert.match(nav, /aria-expanded=\{isOpen\}/);
    assert.match(nav, /aria-controls="resident-mobile-menu"/);
    assert.match(nav, /onKeyDown=\{handleMobileMenuKeyDown\}/);
    assert.match(nav, /Escape/);
    assert.match(nav, /focus-visible:outline/);
    assert.match(nav, /break-words/);
    assert.match(nav, /min-w-0/);
  });

  it("adds safe member-only section routes with permission-aware payments and documents", () => {
    for (const path of [
      "app/(resident)/portal/(member)/payments/page.tsx",
      "app/(resident)/portal/(member)/documents/page.tsx",
      "app/(resident)/portal/(member)/announcements/page.tsx",
      "app/(resident)/portal/(member)/events/page.tsx",
      "app/(resident)/portal/(member)/messages/page.tsx",
      "app/(resident)/portal/(member)/contact-board/page.tsx",
      "app/(resident)/portal/(member)/my-property/page.tsx",
    ]) {
      assert.ok(existsSync(join(root, path)));
    }

    const payments = read("app/(resident)/portal/(member)/payments/page.tsx");
    const documents = read("app/(resident)/portal/(member)/documents/page.tsx");
    const myProperty = read("app/(resident)/portal/(member)/my-property/page.tsx");
    const propertyDetailService = read("server/services/auth/resident-property-detail.ts");
    const memberPageContent = `${payments}\n${documents}\n${myProperty}`;

    assert.match(payments, /getResidentDuesStatus/);
    assert.match(documents, /getResidentPortalMemberships/);
    assert.match(myProperty, /getResidentPropertyDetails/);
    assert.match(propertyDetailService, /getResidentPortalMemberships/);
    assert.match(payments, /property\.canPayDues/);
    assert.match(payments, /Payment history/);
    assert.match(payments, /Payment access unavailable/);
    assert.match(documents, /memberships\.some/);
    assert.match(documents, /membership\.membershipPermissions\.canViewDocuments/);
    assert.match(documents, /Document access unavailable/);
    assert.match(propertyDetailService, /maskedAccountNumber/);
    assert.doesNotMatch(memberPageContent, /"use client"|useResidentPortalContext|ResidentPortalProvider/);

    assert.doesNotMatch(
      memberPageContent,
      /owner_display_name|current_balance|private documents|message contents|SERVICE_ROLE|service_role|error\.message/i,
    );
    assert.doesNotMatch(
      propertyDetailService,
      /owner_display_name|private documents|message contents|SERVICE_ROLE|service_role|error\.message/i,
    );
  });
});
