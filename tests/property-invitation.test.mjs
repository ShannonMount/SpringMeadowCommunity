import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();

function read(path) {
  return readFileSync(join(root, path), "utf8");
}

describe("property invitation acceptance", () => {
  it("defines hashed invitation token persistence without direct resident reads", () => {
    const migrationPath = "supabase/migrations/202605100002_create_property_invitation_tokens.sql";

    assert.ok(existsSync(join(root, migrationPath)));

    const migration = read(migrationPath);

    assert.match(migration, /create table if not exists public\.property_invitation_tokens/i);
    assert.match(migration, /token_hash text not null/i);
    assert.match(migration, /property_membership_id uuid not null references public\.property_memberships\(id\) on delete cascade/i);
    assert.match(migration, /community_id uuid not null references public\.communities\(id\) on delete cascade/i);
    assert.match(migration, /property_id uuid not null references public\.properties\(id\) on delete cascade/i);
    assert.match(migration, /invited_email text not null/i);
    assert.match(migration, /invited_by uuid references public\.profiles\(id\)/i);
    assert.match(migration, /expires_at timestamptz not null/i);
    assert.match(migration, /accepted_at timestamptz/i);
    assert.match(migration, /revoked_at timestamptz/i);
    assert.match(migration, /created_at timestamptz not null default now\(\)/i);
    assert.match(migration, /updated_at timestamptz not null default now\(\)/i);
    assert.match(migration, /property_invitation_tokens_active_hash_key/i);
    assert.match(migration, /alter table public\.property_invitation_tokens enable row level security/i);
    assert.match(migration, /public\.accept_property_invitation\(incoming_token_hash text\)/);
    assert.match(migration, /pm\.status = 'invited'/i);
    assert.match(migration, /properties\.status = 'active'/i);
    assert.match(migration, /lower\(pit\.invited_email\) = lower\(profile_record\.email\)/i);
    assert.match(migration, /for update/i);
    assert.match(migration, /update public\.property_memberships/i);
    assert.match(migration, /status = 'active'/i);
    assert.match(migration, /accepted_at = now\(\)/i);

    assert.doesNotMatch(migration, /plain.?text|plaintext|create policy "read/i);
    assert.doesNotMatch(
      migration,
      /create table if not exists public\.(roles|profile_roles|payments|documents|message_threads|audit_logs)/i,
    );
  });

  it("implements server-only token hashing, acceptance, and invitation authority checks", () => {
    const servicePath = "server/services/auth/property-invitations.ts";

    assert.ok(existsSync(join(root, servicePath)));

    const service = read(servicePath);

    assert.match(service, /import "server-only"/);
    assert.match(service, /createHash\("sha256"\)/);
    assert.match(service, /hashInvitationToken/);
    assert.match(service, /acceptPropertyInvitation/);
    assert.match(service, /getCurrentProfile/);
    assert.match(service, /\.rpc\("accept_property_invitation"/);
    assert.match(service, /PROPERTY_INVITATION_UNAVAILABLE_MESSAGE/);
    assert.match(service, /canInvitePropertyMembers/);
    assert.match(service, /\.from\("property_memberships"\)/);
    assert.match(service, /\.eq\("can_invite_members", true\)/);
    assert.match(service, /\.eq\("status", "active"\)/);
    assert.match(service, /\.eq\("properties\.status", "active"\)/);

    assert.doesNotMatch(service, /console\.(log|error|warn)|SERVICE_ROLE|service_role|plain.?text|owner_display_name/i);
    assert.doesNotMatch(
      service,
      /current_balance|dues balance|payment history|private documents|message contents|board-only|admin-only|raw token/i,
    );
  });

  it("renders authenticated invitation acceptance with generic success and error states", () => {
    const routePath = "app/(resident)/portal/invitations/accept/page.tsx";

    assert.ok(existsSync(join(root, routePath)));

    const route = read(routePath);

    assert.match(route, /acceptPropertyInvitation/);
    assert.match(route, /buildLoginRedirect/);
    assert.match(route, /\/login\?next=/);
    assert.match(route, /Invitation accepted/);
    assert.match(route, /Invitation unavailable/);
    assert.match(route, /PROPERTY_INVITATION_UNAVAILABLE_MESSAGE/);
    assert.match(route, /<h1/);
    assert.match(route, /href="\/portal"/);

    assert.doesNotMatch(route, /token_hash|membership\.id|property_id|owner|account number|current_balance/i);
    assert.doesNotMatch(
      route,
      /dues balance|payment history|private documents|message contents|board-only|admin-only|error\.message/i,
    );
  });

  it("keeps invitation work inside the intended scope and privacy boundaries", () => {
    const migration = read("supabase/migrations/202605100002_create_property_invitation_tokens.sql");
    const service = read("server/services/auth/property-invitations.ts");
    const route = read("app/(resident)/portal/invitations/accept/page.tsx");
    const combined = `${migration}\n${service}\n${route}`;

    assert.doesNotMatch(combined, /Resend|sendEmail|stripe|checkout|payment_intent/i);
    assert.doesNotMatch(combined, /SERVICE_ROLE|service_role|profile_roles|hasPermission/);
    assert.doesNotMatch(combined, /owner_display_name|current_balance|payment history|private documents|message contents/i);
    assert.doesNotMatch(combined, /create table if not exists public\.(payments|documents|message_threads|audit_logs)/i);
  });
});
