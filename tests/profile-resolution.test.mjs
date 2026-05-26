import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();

function read(path) {
  return readFileSync(join(root, path), "utf8");
}

const memberPortalPagePath = "app/(resident)/portal/(member)/page.tsx";
const memberPortalLayoutPath = "app/(resident)/portal/(member)/layout.tsx";

describe("application profile resolution", () => {
  it("defines a narrow profiles schema with RLS and auth user creation hook", () => {
    const migrationPath = "supabase/migrations/202605080001_create_profiles.sql";

    assert.ok(existsSync(join(root, migrationPath)));

    const migration = read(migrationPath);

    assert.match(migration, /create table if not exists public\.profiles/i);
    assert.match(migration, /auth_user_id uuid not null/i);
    assert.match(migration, /references auth\.users\(id\) on delete cascade/i);
    assert.match(migration, /unique \(auth_user_id\)/i);
    assert.match(migration, /email text not null/i);
    assert.match(migration, /unique \(email\)/i);
    assert.match(migration, /email_verified_at timestamptz/i);
    assert.match(migration, /phone text/i);
    assert.match(migration, /first_name text/i);
    assert.match(migration, /last_name text/i);
    assert.match(migration, /display_name text/i);
    assert.match(migration, /status text not null/i);
    assert.match(migration, /invited/);
    assert.match(migration, /active/);
    assert.match(migration, /suspended/);
    assert.match(migration, /disabled/);
    assert.match(migration, /notification_preferences jsonb not null default '\{\}'::jsonb/i);
    assert.match(migration, /last_login_at timestamptz/i);
    assert.match(migration, /created_at timestamptz/i);
    assert.match(migration, /updated_at timestamptz/i);
    assert.match(migration, /deleted_at timestamptz/i);
    assert.match(migration, /alter table public\.profiles enable row level security/i);
    assert.match(migration, /create policy "profiles self read"/i);
    assert.match(migration, /handle_new_auth_user_profile/i);
    assert.match(migration, /on auth\.users/i);

    assert.doesNotMatch(migration, /property_memberships|profile_roles|payments|documents|dashboard/i);
  });

  it("implements server-side current profile resolution with blocked states", () => {
    const resolverPath = "server/services/auth/current-profile.ts";

    assert.ok(existsSync(join(root, resolverPath)));

    const resolver = read(resolverPath);

    assert.match(resolver, /createClient/);
    assert.match(resolver, /auth\.getUser\(\)/);
    assert.match(resolver, /\.from\("profiles"\)/);
    assert.match(resolver, /\.eq\("auth_user_id", user\.id\)/);
    assert.match(resolver, /\.is\("deleted_at", null\)/);
    assert.match(resolver, /maybeSingle/);
    assert.match(resolver, /missing-profile/);
    assert.match(resolver, /blocked-profile/);
    assert.match(resolver, /suspended/);
    assert.match(resolver, /disabled/);
    assert.match(resolver, /Your resident profile is not available\. Please contact the HOA for help\./);
    assert.match(resolver, /notification_preferences/);

    assert.doesNotMatch(
      resolver,
      /cookies\(|SERVICE_ROLE|service_role|password_hash|property_memberships|profile_roles|dues balance|private documents|board-only|admin-only/i,
    );
  });

  it("gates the resident portal on an active resolved profile with privacy-safe UI", () => {
    const portalPage = `${read(memberPortalLayoutPath)}\n${read(memberPortalPagePath)}`;

    assert.match(portalPage, /function ResidentPortalPage/);
    assert.match(portalPage, /getResidentPortalMemberships/);
    assert.match(portalPage, /redirect\(`\/login\?next=\$\{encodeURIComponent\(nextPath\)\}`\)/);
    assert.match(portalPage, /membershipResult\.kind === "profile-unavailable"/);
    assert.match(portalPage, /PROFILE_UNAVAILABLE_MESSAGE/);
    assert.match(portalPage, /profile\.displayName/);
    assert.match(portalPage, /profile\.displayName/);
    assert.match(portalPage, /signOutResident/);

    assert.doesNotMatch(
      portalPage,
      /owner|profile_roles|dues balance|private documents|board-only|admin-only|password_hash/i,
    );
  });
});
