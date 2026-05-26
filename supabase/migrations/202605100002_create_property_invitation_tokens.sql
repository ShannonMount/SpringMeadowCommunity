create table if not exists public.property_invitation_tokens (
  id uuid primary key default gen_random_uuid(),
  token_hash text not null,
  property_membership_id uuid not null references public.property_memberships(id) on delete cascade,
  community_id uuid not null references public.communities(id) on delete cascade,
  property_id uuid not null references public.properties(id) on delete cascade,
  invited_email text not null,
  invited_by uuid references public.profiles(id),
  expires_at timestamptz not null,
  accepted_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists property_invitation_tokens_active_hash_key
  on public.property_invitation_tokens(token_hash)
  where accepted_at is null and revoked_at is null;

create index if not exists property_invitation_tokens_membership_idx
  on public.property_invitation_tokens(property_membership_id);

create index if not exists property_invitation_tokens_property_idx
  on public.property_invitation_tokens(community_id, property_id);

alter table public.property_invitation_tokens enable row level security;

create or replace function public.set_property_invitation_tokens_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_property_invitation_tokens_updated_at on public.property_invitation_tokens;
create trigger set_property_invitation_tokens_updated_at
  before update on public.property_invitation_tokens
  for each row
  execute function public.set_property_invitation_tokens_updated_at();

create or replace function public.accept_property_invitation(incoming_token_hash text)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  profile_record public.profiles%rowtype;
  invitation_record public.property_invitation_tokens%rowtype;
  accepted_membership_id uuid;
begin
  select *
  into profile_record
  from public.profiles
  where auth_user_id = auth.uid()
    and status = 'active'
    and deleted_at is null
  limit 1;

  if not found then
    return 'unavailable';
  end if;

  select pit.*
  into invitation_record
  from public.property_invitation_tokens pit
  join public.property_memberships pm on pm.id = pit.property_membership_id
  join public.properties on properties.id = pit.property_id
  where pit.token_hash = incoming_token_hash
    and pit.accepted_at is null
    and pit.revoked_at is null
    and pit.expires_at > now()
    and lower(pit.invited_email) = lower(profile_record.email)
    and pm.id = pit.property_membership_id
    and pm.profile_id = profile_record.id
    and pm.property_id = pit.property_id
    and pm.community_id = pit.community_id
    and pm.status = 'invited'
    and pm.removed_at is null
    and properties.status = 'active'
    and properties.deleted_at is null
  for update;

  if not found then
    return 'unavailable';
  end if;

  update public.property_memberships
  set
    status = 'active',
    accepted_at = now(),
    updated_at = now()
  where id = invitation_record.property_membership_id
    and status = 'invited'
    and accepted_at is null
  returning id into accepted_membership_id;

  if accepted_membership_id is null then
    return 'unavailable';
  end if;

  update public.property_invitation_tokens
  set
    accepted_at = now(),
    updated_at = now()
  where id = invitation_record.id
    and accepted_at is null
    and revoked_at is null;

  return 'accepted';
end;
$$;
