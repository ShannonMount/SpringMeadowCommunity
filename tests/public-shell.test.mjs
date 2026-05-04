import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();

function read(path) {
  return readFileSync(join(root, path), "utf8");
}

describe("public website shell", () => {
  it("defines the public App Router shell files", () => {
    assert.ok(existsSync(join(root, "app/(public)/layout.tsx")));
    assert.ok(existsSync(join(root, "app/(public)/page.tsx")));
    assert.ok(existsSync(join(root, "app/globals.css")));
    assert.ok(existsSync(join(root, "components/public/public-nav.tsx")));
    assert.ok(existsSync(join(root, "lib/public/navigation.ts")));
    assert.ok(existsSync(join(root, "server/.gitkeep")));
  });

  it("renders every required public navigation label", () => {
    const navConfig = read("lib/public/navigation.ts");
    const requiredLabels = [
      "Home",
      "About/Community Info",
      "Announcements",
      "Events",
      "Documents/Public Resources",
      "Contact",
      "Pay Dues",
      "Login",
    ];

    for (const label of requiredLabels) {
      assert.match(navConfig, new RegExp(`label:\\s*"${label.replace("/", "\\/")}"`));
    }
  });

  it("keeps mobile navigation keyboard-operable and stateful", () => {
    const nav = read("components/public/public-nav.tsx");
    assert.match(nav, /<nav[\s\S]*aria-label="Primary"/);
    assert.match(nav, /aria-expanded=\{isOpen\}/);
    assert.match(nav, /aria-controls="public-mobile-menu"/);
    assert.match(nav, /onKeyDown=\{handleMobileMenuKeyDown\}/);
    assert.match(nav, /focus-visible:/);
  });

  it("does not import private data services into the public shell", () => {
    const files = [
      read("app/(public)/layout.tsx"),
      read("app/(public)/page.tsx"),
      read("components/public/public-nav.tsx"),
    ].join("\n");

    assert.doesNotMatch(files, /from\s+["']@\/server\/services/);
    assert.doesNotMatch(files, /from\s+["']@\/server\/queries/);
    assert.doesNotMatch(files, /get(Property|Payment|Document|Resident|Board)/);
    assert.doesNotMatch(files, /property_memberships/);
    assert.doesNotMatch(files, /documents\/private/);
  });
});
