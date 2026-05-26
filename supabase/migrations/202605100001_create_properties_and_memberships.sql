create extension if not exists "pgcrypto";
create extension if not exists "citext";

create schema if not exists app;

do $$
begin
  create type community_status as enum ('active', 'inactive', 'archived');
exception
  when duplicate_object then null;
end;
$$;

do $$
begin
  create type property_status as enum ('active', 'inactive', 'archived');
exception
  when duplicate_object then null;
end;
$$;

do $$
begin
  create type membership_status as enum ('invited', 'active', 'suspended', 'removed');
exception
  when duplicate_object then null;
end;
$$;

do $$
begin
  create type relationship_type as enum ('owner', 'co_owner', 'resident', 'renter', 'manager', 'family', 'other');
exception
  when duplicate_object then null;
end;
$$;

create table if not exists public.communities (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug citext not null unique,
  legal_name text,
  status community_status not null default 'active',
  timezone text not null default 'America/New_York',
  jurisdiction_country text not null default 'US',
  jurisdiction_state text not null default 'NC',
  jurisdiction_type text not null default 'unknown'
    check (jurisdiction_type in ('planned_community', 'condominium', 'unknown')),
  statute_chapter text check (statute_chapter in ('47F', '47C')),
  fiscal_year_start_month integer not null default 1 check (fiscal_year_start_month between 1 and 12),
  fiscal_year_start_day integer not null default 1 check (fiscal_year_start_day between 1 and 31),
  fiscal_year_end_month integer not null default 12 check (fiscal_year_end_month between 1 and 12),
  fiscal_year_end_day integer not null default 31 check (fiscal_year_end_day between 1 and 31),
  public_display_name text not null,
  logo_url text,
  primary_color text,
  secondary_color text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists communities_status_idx on public.communities(status);

create table if not exists public.properties (
  id uuid primary key default gen_random_uuid(),
  community_id uuid not null references public.communities(id) on delete cascade,
  account_number text not null,
  public_payment_code text unique,
  status property_status not null default 'active',
  address_line1 text not null,
  address_line2 text,
  city text not null,
  state text not null default 'NC',
  postal_code text not null,
  county text,
  mailing_address jsonb,
  owner_display_name text,
  lot_number text,
  parcel_number text,
  plat_reference text,
  current_balance_cents integer not null default 0,
  last_payment_at timestamptz,
  next_due_date date,
  delinquency_status text not null default 'current'
    check (delinquency_status in ('current', 'due_soon', 'overdue', 'delinquent', 'lien_review', 'disputed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique (community_id, account_number)
);

create index if not exists properties_community_status_idx on public.properties(community_id, status);
create index if not exists properties_address_lookup_idx on public.properties(community_id, lower(address_line1), postal_code);
create index if not exists properties_delinquency_idx on public.properties(community_id, delinquency_status);
create index if not exists properties_next_due_idx on public.properties(community_id, next_due_date);

create table if not exists public.property_memberships (
  id uuid primary key default gen_random_uuid(),
  community_id uuid not null references public.communities(id) on delete cascade,
  property_id uuid not null references public.properties(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  relationship relationship_type not null default 'resident',
  status membership_status not null default 'invited',
  can_view_balance boolean not null default true,
  can_pay_dues boolean not null default true,
  can_view_documents boolean not null default true,
  can_invite_members boolean not null default false,
  invited_by uuid references public.profiles(id),
  invited_at timestamptz,
  accepted_at timestamptz,
  removed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (community_id, property_id, profile_id)
);

create index if not exists property_memberships_user_idx on public.property_memberships(community_id, profile_id, status);
create index if not exists property_memberships_property_idx on public.property_memberships(community_id, property_id, status);

alter table public.properties enable row level security;
alter table public.property_memberships enable row level security;

create or replace function app.current_profile_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select profiles.id
  from public.profiles
  where profiles.auth_user_id = auth.uid()
    and profiles.status = 'active'
    and profiles.deleted_at is null
  limit 1;
$$;

create or replace function app.can_access_property(target_property_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.property_memberships pm
    join public.properties on properties.id = pm.property_id
    where pm.property_id = target_property_id
      and pm.profile_id = app.current_profile_id()
      and pm.status = 'active'
      and properties.status = 'active'
      and properties.deleted_at is null
  );
$$;

drop policy if exists "read own memberships" on public.property_memberships;
create policy "read own memberships"
  on public.property_memberships
  for select
  to authenticated
  using (profile_id = app.current_profile_id());

drop policy if exists "read active linked properties" on public.properties;
create policy "read active linked properties"
  on public.properties
  for select
  to authenticated
  using (
    properties.status = 'active'
    and properties.deleted_at is null
    and app.can_access_property(properties.id)
  );
