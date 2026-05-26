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
const memberPaymentsPagePath = "app/(resident)/portal/(member)/payments/page.tsx";

describe("property membership model", () => {
  it("defines community, property, and membership schema foundations with active-only RLS", () => {
    const migrationPath = "supabase/migrations/202605100001_create_properties_and_memberships.sql";

    assert.ok(existsSync(join(root, migrationPath)));

    const migration = read(migrationPath);

    assert.match(migration, /create extension if not exists "pgcrypto"/i);
    assert.match(migration, /create extension if not exists "citext"/i);
    assert.match(migration, /create schema if not exists app/i);
    assert.match(migration, /create type community_status/i);
    assert.match(migration, /create type property_status/i);
    assert.match(migration, /create type membership_status/i);
    assert.match(migration, /create type relationship_type/i);
    assert.match(migration, /create table if not exists public\.communities/i);
    assert.match(migration, /slug citext not null unique/i);
    assert.match(migration, /create table if not exists public\.properties/i);
    assert.match(migration, /community_id uuid not null references public\.communities\(id\) on delete cascade/i);
    assert.match(migration, /account_number text not null/i);
    assert.match(migration, /public_payment_code text unique/i);
    assert.match(migration, /status property_status not null default 'active'/i);
    assert.match(migration, /address_line1 text not null/i);
    assert.match(migration, /current_balance_cents integer not null default 0/i);
    assert.match(migration, /deleted_at timestamptz/i);
    assert.match(migration, /unique \(community_id, account_number\)/i);
    assert.match(migration, /create table if not exists public\.property_memberships/i);
    assert.match(migration, /property_id uuid not null references public\.properties\(id\) on delete cascade/i);
    assert.match(migration, /profile_id uuid not null references public\.profiles\(id\) on delete cascade/i);
    assert.match(migration, /relationship relationship_type not null default 'resident'/i);
    assert.match(migration, /status membership_status not null default 'invited'/i);
    assert.match(migration, /can_view_balance boolean not null default true/i);
    assert.match(migration, /can_pay_dues boolean not null default true/i);
    assert.match(migration, /can_view_documents boolean not null default true/i);
    assert.match(migration, /can_invite_members boolean not null default false/i);
    assert.match(migration, /unique \(community_id, property_id, profile_id\)/i);
    assert.match(migration, /property_memberships_user_idx/i);
    assert.match(migration, /property_memberships_property_idx/i);
    assert.match(migration, /alter table public\.properties enable row level security/i);
    assert.match(migration, /alter table public\.property_memberships enable row level security/i);
    assert.match(migration, /app\.current_profile_id\(\)/);
    assert.match(migration, /app\.can_access_property\(target_property_id uuid\)/);
    assert.match(migration, /create policy "read own memberships"/i);
    assert.match(migration, /create policy "read active linked properties"/i);
    assert.match(migration, /pm\.status = 'active'/i);
    assert.match(migration, /properties\.status = 'active'/i);
    assert.match(migration, /properties\.deleted_at is null/i);

    assert.doesNotMatch(
      migration,
      /create table if not exists public\.(profile_roles|roles|assessment_cycles|payments|documents|message_threads|audit_logs)/i,
    );
  });

  it("implements server-side active property membership resolution without private data leakage", () => {
    const resolverPath = "server/services/auth/property-memberships.ts";

    assert.ok(existsSync(join(root, resolverPath)));

    const resolver = read(resolverPath);

    assert.match(resolver, /import "server-only"/);
    assert.match(resolver, /getCurrentProfile/);
    assert.match(resolver, /\.from\("property_memberships"\)/);
    assert.match(resolver, /\.eq\("status", ACTIVE_MEMBERSHIP_STATUS\)/);
    assert.match(resolver, /\.eq\("properties\.status", ACTIVE_PROPERTY_STATUS\)/);
    assert.match(resolver, /\.is\("properties\.deleted_at", null\)/);
    assert.match(resolver, /getCurrentPropertyMemberships/);
    assert.match(resolver, /canAccessProperty/);
    assert.match(resolver, /no-active-membership/);
    assert.match(resolver, /property-membership-error/);
    assert.match(resolver, /membershipPermissions/);
    assert.match(resolver, /maskAccountNumber/);

    assert.doesNotMatch(
      resolver,
      /cookies\(|SERVICE_ROLE|service_role|password_hash|current_balance|dues balance|payment history|private documents|message contents|owner_display_name|board-only|admin-only/i,
    );
  });

  it("gates the resident portal on active property memberships with privacy-safe UI", () => {
    const portalPage = `${read(memberPortalLayoutPath)}\n${read(memberPortalPagePath)}\n${read(memberPaymentsPagePath)}`;

    assert.match(portalPage, /getResidentPortalMemberships/);
    assert.match(portalPage, /membershipResult\.kind === "profile-unavailable"/);
    assert.match(portalPage, /membershipResult\.kind !== "active-memberships"/);
    assert.match(portalPage, /No property access available/);
    assert.match(portalPage, /PROPERTY_MEMBERSHIP_UNAVAILABLE_MESSAGE/);
    assert.match(portalPage, /Dues status/);
    assert.match(portalPage, /property\.addressLine1/);
    assert.match(portalPage, /property\.relationship/);
    assert.match(portalPage, /property\.canPayDues/);

    assert.doesNotMatch(
      portalPage,
      /owner|owner_display_name|current_balance|dues balance|private documents|message contents|board-only|admin-only|password_hash|SERVICE_ROLE|service_role/i,
    );
  });
});
