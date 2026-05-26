create table if not exists public.roles (
  id uuid primary key default gen_random_uuid(),
  community_id uuid not null references public.communities(id) on delete cascade,
  key text not null,
  name text not null,
  description text,
  permissions text[] not null default '{}',
  system_role boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (community_id, key)
);

create table if not exists public.profile_roles (
  id uuid primary key default gen_random_uuid(),
  community_id uuid not null references public.communities(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  role_id uuid not null references public.roles(id) on delete cascade,
  scope text not null default 'community'
    check (scope in ('community', 'property', 'vendor', 'amenity')),
  scope_id uuid not null default '00000000-0000-0000-0000-000000000000'::uuid,
  status text not null default 'active'
    check (status in ('active', 'suspended', 'removed')),
  assigned_by uuid references public.profiles(id),
  assigned_at timestamptz not null default now(),
  removed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint profile_roles_scope_id_check check (
    (
      scope = 'community'
      and scope_id = '00000000-0000-0000-0000-000000000000'::uuid
    )
    or (
      scope <> 'community'
      and scope_id <> '00000000-0000-0000-0000-000000000000'::uuid
    )
  ),
  unique (community_id, profile_id, role_id, scope, scope_id)
);

create index if not exists profile_roles_profile_idx
  on public.profile_roles(community_id, profile_id, status);

create index if not exists profile_roles_role_idx
  on public.profile_roles(community_id, role_id, status);

alter table public.roles enable row level security;
alter table public.profile_roles enable row level security;

insert into public.communities (
  name,
  slug,
  public_display_name
)
values (
  'Spring Meadow Community',
  'spring-meadow-community',
  'Spring Meadow Community'
)
on conflict (slug) do update
set
  name = excluded.name,
  public_display_name = excluded.public_display_name,
  updated_at = now();

with spring_meadow as (
  select id as community_id
  from public.communities
  where slug = 'spring-meadow-community'
),
seed_roles(key, name, description, permissions) as (
  values
    (
      'resident',
      'Resident',
      'Resident portal access for linked property members.',
      array['resident.portal.access']::text[]
    ),
    (
      'board_member',
      'Board Member',
      'Board workspace access with conservative member-invitation capability.',
      array['resident.portal.access', 'board.workspace.access', 'property.members.invite']::text[]
    ),
    (
      'admin',
      'Admin',
      'Administrative role management and user management foundation.',
      array[
        'resident.portal.access',
        'board.workspace.access',
        'property.members.invite',
        'admin.roles.manage',
        'admin.users.manage',
        'audit.logs.view'
      ]::text[]
    ),
    (
      'vendor_applicant',
      'Vendor Applicant',
      'Public vendor proposal placeholder access.',
      array['vendor.proposal.submit']::text[]
    ),
    (
      'approved_vendor',
      'Approved Vendor',
      'Approved vendor portal access for later vendor workflows.',
      array['vendor.portal.access']::text[]
    ),
    (
      'pool_worker',
      'Pool Worker',
      'Pool maintenance log submission access.',
      array['pool.logs.submit']::text[]
    ),
    (
      'legal_reviewer',
      'Legal/Compliance Reviewer',
      'Legal-sensitive workflow review access.',
      array['legal.workflow.review']::text[]
    )
)
insert into public.roles (
  community_id,
  key,
  name,
  description,
  permissions,
  system_role
)
select
  spring_meadow.community_id,
  seed_roles.key,
  seed_roles.name,
  seed_roles.description,
  seed_roles.permissions,
  true
from spring_meadow
cross join seed_roles
on conflict (community_id, key) do update
set
  name = excluded.name,
  description = excluded.description,
  permissions = excluded.permissions,
  system_role = true,
  updated_at = now();

create or replace function public.set_roles_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_roles_updated_at on public.roles;
create trigger set_roles_updated_at
  before update on public.roles
  for each row
  execute function public.set_roles_updated_at();

create or replace function public.set_profile_roles_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_profile_roles_updated_at on public.profile_roles;
create trigger set_profile_roles_updated_at
  before update on public.profile_roles
  for each row
  execute function public.set_profile_roles_updated_at();

create or replace function app.has_permission(
  target_community_id uuid,
  permission_key text,
  target_scope text default null,
  target_scope_id uuid default null
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profile_roles pr
    join public.roles on roles.id = pr.role_id
    where pr.profile_id = app.current_profile_id()
      and pr.community_id = target_community_id
      and roles.community_id = target_community_id
      and pr.status = 'active'
      and permission_key = any(roles.permissions)
      and (
        pr.scope = 'community'
        or (
          target_scope is not null
          and pr.scope = target_scope
          and pr.scope_id = target_scope_id
        )
      )
  );
$$;

create or replace function public.has_permission(
  target_community_id uuid,
  permission_key text,
  target_scope text default null,
  target_scope_id uuid default null
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select app.has_permission(target_community_id, permission_key, target_scope, target_scope_id);
$$;

drop policy if exists "read community roles" on public.roles;
create policy "read community roles"
  on public.roles
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.property_memberships pm
      where pm.community_id = roles.community_id
        and pm.profile_id = app.current_profile_id()
        and pm.status = 'active'
    )
    or exists (
      select 1
      from public.profile_roles pr
      where pr.community_id = roles.community_id
        and pr.profile_id = app.current_profile_id()
        and pr.status = 'active'
    )
  );

drop policy if exists "read own active profile roles" on public.profile_roles;
create policy "read own active profile roles"
  on public.profile_roles
  for select
  to authenticated
  using (
    profile_id = app.current_profile_id()
    and status = 'active'
  );

create or replace function public.assign_profile_role(
  target_community_id uuid,
  target_profile_id uuid,
  target_role_key text,
  target_scope text default 'community',
  target_scope_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  actor_profile_id uuid;
  target_role_id uuid;
  profile_role_id uuid;
  effective_scope_id uuid;
  previous_assignment public.profile_roles%rowtype;
  assigned_at_value timestamptz;
begin
  actor_profile_id := app.current_profile_id();

  if actor_profile_id is null
    or not app.has_permission(target_community_id, 'admin.roles.manage')
    or target_scope is null
    or target_scope not in ('community', 'property', 'vendor', 'amenity')
  then
    return jsonb_build_object('status', 'unavailable');
  end if;

  if target_scope = 'community' then
    effective_scope_id := '00000000-0000-0000-0000-000000000000'::uuid;
  elsif target_scope_id is null
    or target_scope_id = '00000000-0000-0000-0000-000000000000'::uuid
  then
    return jsonb_build_object('status', 'unavailable');
  else
    effective_scope_id := target_scope_id;
  end if;

  select id
  into target_role_id
  from public.roles
  where community_id = target_community_id
    and key = target_role_key
  limit 1;

  if target_role_id is null then
    return jsonb_build_object('status', 'unavailable');
  end if;

  select *
  into previous_assignment
  from public.profile_roles
  where community_id = target_community_id
    and profile_id = target_profile_id
    and role_id = target_role_id
    and scope = target_scope
    and scope_id = effective_scope_id
  for update;

  insert into public.profile_roles (
    community_id,
    profile_id,
    role_id,
    scope,
    scope_id,
    status,
    assigned_by,
    assigned_at,
    removed_at
  )
  values (
    target_community_id,
    target_profile_id,
    target_role_id,
    target_scope,
    effective_scope_id,
    'active',
    actor_profile_id,
    now(),
    null
  )
  on conflict (community_id, profile_id, role_id, scope, scope_id) do update
  set
    status = 'active',
    assigned_by = actor_profile_id,
    assigned_at = now(),
    removed_at = null,
    updated_at = now()
  returning id, assigned_at into profile_role_id, assigned_at_value;

  return jsonb_build_object(
    'status', 'assigned',
    'profile_role_id', profile_role_id,
    'previous_status', previous_assignment.status,
    'previous_removed_at', previous_assignment.removed_at,
    'community_id', target_community_id,
    'target_profile_id', target_profile_id,
    'role_id', target_role_id,
    'role_key', target_role_key,
    'scope', target_scope,
    'scope_id', effective_scope_id,
    'assigned_by', actor_profile_id,
    'assigned_at', assigned_at_value,
    'removed_at', null
  );
end;
$$;

create or replace function public.suspend_profile_role(
  target_profile_role_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  role_record public.profile_roles%rowtype;
  role_key text;
begin
  select *
  into role_record
  from public.profile_roles
  where id = target_profile_role_id
  for update;

  if not found
    or not app.has_permission(role_record.community_id, 'admin.roles.manage')
  then
    return jsonb_build_object('status', 'unavailable');
  end if;

  select key
  into role_key
  from public.roles
  where id = role_record.role_id;

  update public.profile_roles
  set
    status = 'suspended',
    updated_at = now()
  where id = target_profile_role_id;

  return jsonb_build_object(
    'status', 'suspended',
    'profile_role_id', target_profile_role_id,
    'previous_status', role_record.status,
    'community_id', role_record.community_id,
    'target_profile_id', role_record.profile_id,
    'role_id', role_record.role_id,
    'role_key', role_key,
    'scope', role_record.scope,
    'scope_id', role_record.scope_id,
    'assigned_by', role_record.assigned_by,
    'assigned_at', role_record.assigned_at,
    'removed_at', role_record.removed_at
  );
end;
$$;

create or replace function public.remove_profile_role(
  target_profile_role_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  role_record public.profile_roles%rowtype;
  role_key text;
  removed_at_value timestamptz;
begin
  select *
  into role_record
  from public.profile_roles
  where id = target_profile_role_id
  for update;

  if not found
    or not app.has_permission(role_record.community_id, 'admin.roles.manage')
  then
    return jsonb_build_object('status', 'unavailable');
  end if;

  select key
  into role_key
  from public.roles
  where id = role_record.role_id;

  removed_at_value := now();

  update public.profile_roles
  set
    status = 'removed',
    removed_at = removed_at_value,
    updated_at = now()
  where id = target_profile_role_id;

  return jsonb_build_object(
    'status', 'removed',
    'profile_role_id', target_profile_role_id,
    'previous_status', role_record.status,
    'previous_removed_at', role_record.removed_at,
    'community_id', role_record.community_id,
    'target_profile_id', role_record.profile_id,
    'role_id', role_record.role_id,
    'role_key', role_key,
    'scope', role_record.scope,
    'scope_id', role_record.scope_id,
    'assigned_by', role_record.assigned_by,
    'assigned_at', role_record.assigned_at,
    'removed_at', removed_at_value
  );
end;
$$;
