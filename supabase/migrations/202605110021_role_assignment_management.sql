create or replace function public.list_admin_roles(
  target_community_slug text,
  filter_query text,
  include_inactive boolean
)
returns jsonb
language plpgsql
security definer
set search_path = public, app
as $$
declare
  actor_profile_id uuid;
  target_community_id uuid;
  search_query text;
  roles_json jsonb;
begin
  actor_profile_id := app.current_profile_id();

  select communities.id
  into target_community_id
  from public.communities
  where communities.slug = coalesce(nullif(btrim(target_community_slug), ''), 'spring-meadow-community')
    and communities.status = 'active';

  if target_community_id is null
    or actor_profile_id is null
    or not app.has_permission(target_community_id, 'admin.roles.manage')
  then
    return jsonb_build_object('status', 'permission_denied');
  end if;

  if filter_query is not null
    and length(btrim(filter_query)) > 200
  then
    return jsonb_build_object('status', 'invalid');
  end if;

  search_query := nullif(
    replace(
      replace(
        replace(btrim(coalesce(filter_query, '')), chr(92), chr(92) || chr(92)),
        '%',
        chr(92) || '%'
      ),
      '_',
      chr(92) || '_'
    ),
    ''
  );

  with role_rows as (
    select
      roles.id,
      roles.key,
      roles.name,
      roles.description,
      roles.permissions,
      roles.system_role,
      roles.created_at,
      roles.updated_at,
      count(profile_roles.id) filter (where profile_roles.status = 'active') as active_assignment_count,
      count(profile_roles.id) filter (
        where coalesce(include_inactive, false)
          or profile_roles.status <> 'removed'
      ) as assignment_count
    from public.roles
    left join public.profile_roles
      on profile_roles.role_id = roles.id
      and profile_roles.community_id = target_community_id
    where roles.community_id = target_community_id
      and (
        search_query is null
        or roles.key ilike '%' || search_query || '%' escape chr(92)
        or roles.name ilike '%' || search_query || '%' escape chr(92)
        or coalesce(roles.description, '') ilike '%' || search_query || '%' escape chr(92)
      )
    group by roles.id, roles.key, roles.name, roles.description, roles.permissions, roles.system_role, roles.created_at, roles.updated_at
    order by roles.system_role desc, roles.name asc, roles.key asc
  )
  select coalesce(jsonb_agg(
    jsonb_build_object(
      'id', role_rows.id,
      'key', role_rows.key,
      'name', role_rows.name,
      'description', role_rows.description,
      'permissions', role_rows.permissions,
      'system_role', role_rows.system_role,
      'active_assignment_count', role_rows.active_assignment_count,
      'assignment_count', role_rows.assignment_count,
      'created_at', role_rows.created_at,
      'updated_at', role_rows.updated_at
    )
    order by role_rows.system_role desc, role_rows.name asc, role_rows.key asc
  ), 
  '[]'::jsonb
)
into roles_json
from role_rows;

return jsonb_build_object(
  'status', 'ok',
  'community_id', target_community_id,
  'roles', roles_json
);
end;
$$;

create or replace function public.list_admin_profile_roles(
  target_community_slug text,
  filter_query text,
  filter_status text,
  target_profile_id uuid,
  include_removed boolean,
  page_limit integer,
  page_offset integer
)
returns jsonb
language plpgsql
security definer
set search_path = public, app
as $$
declare
  actor_profile_id uuid;
  target_community_id uuid;
  bounded_limit integer;
  bounded_offset integer;
  search_query text;
  assignments_json jsonb;
begin
  actor_profile_id := app.current_profile_id();

  select communities.id
  into target_community_id
  from public.communities
  where communities.slug = coalesce(nullif(btrim(target_community_slug), ''), 'spring-meadow-community')
    and communities.status = 'active';

  if target_community_id is null
    or actor_profile_id is null
    or not app.has_permission(target_community_id, 'admin.roles.manage')
  then
    return jsonb_build_object('status', 'permission_denied');
  end if;

  if filter_status is not null
    and filter_status not in ('active', 'suspended', 'removed')
  then
    return jsonb_build_object('status', 'invalid');
  end if;

  if filter_query is not null
    and length(btrim(filter_query)) > 200
  then
    return jsonb_build_object('status', 'invalid');
  end if;

  bounded_limit := least(greatest(coalesce(page_limit, 100), 1), 200);
  bounded_offset := greatest(coalesce(page_offset, 0), 0);
  search_query := nullif(
    replace(
      replace(
        replace(btrim(coalesce(filter_query, '')), chr(92), chr(92) || chr(92)),
        '%',
        chr(92) || '%'
      ),
      '_',
      chr(92) || '_'
    ),
    ''
  );

  with assignment_rows as (
    select
      profile_roles.id,
      profile_roles.community_id,
      profile_roles.profile_id,
      profile_roles.role_id,
      profile_roles.scope,
      profile_roles.scope_id,
      profile_roles.status,
      profile_roles.assigned_by,
      profile_roles.assigned_at,
      profile_roles.removed_at,
      profile_roles.created_at,
      profile_roles.updated_at,
      roles.key as role_key,
      roles.name as role_name,
      roles.description as role_description,
      roles.permissions as role_permissions,
      roles.system_role,
      profiles.display_name,
      profiles.email,
      profiles.status as profile_status,
      assigner.display_name as assigned_by_display_name,
      assigner.email as assigned_by_email,
      properties.account_number,
      properties.address_line1
    from public.profile_roles
    join public.roles
      on roles.id = profile_roles.role_id
      and roles.community_id = target_community_id
    join public.profiles
      on profiles.id = profile_roles.profile_id
      and profiles.deleted_at is null
    left join public.profiles assigner
      on assigner.id = profile_roles.assigned_by
      and assigner.deleted_at is null
    left join public.properties
      on properties.id = profile_roles.scope_id
      and properties.community_id = target_community_id
      and properties.deleted_at is null
    where profile_roles.community_id = target_community_id
      and (target_profile_id is null or profile_roles.profile_id = target_profile_id)
      and (filter_status is null or profile_roles.status = filter_status)
      and (
        coalesce(include_removed, false)
        or filter_status = 'removed'
        or profile_roles.status <> 'removed'
      )
      and (
        search_query is null
        or profiles.email ilike '%' || search_query || '%' escape chr(92)
        or coalesce(profiles.display_name, '') ilike '%' || search_query || '%' escape chr(92)
        or roles.key ilike '%' || search_query || '%' escape chr(92)
        or roles.name ilike '%' || search_query || '%' escape chr(92)
        or coalesce(properties.account_number, '') ilike '%' || search_query || '%' escape chr(92)
        or coalesce(properties.address_line1, '') ilike '%' || search_query || '%' escape chr(92)
      )
    order by profiles.email asc, roles.name asc, profile_roles.updated_at desc, profile_roles.id asc
    limit bounded_limit
    offset bounded_offset
  )
  select coalesce(jsonb_agg(
    jsonb_build_object(
      'id', assignment_rows.id,
      'community_id', assignment_rows.community_id,
      'profile', jsonb_build_object(
        'id', assignment_rows.profile_id,
        'display_name', coalesce(assignment_rows.display_name, assignment_rows.email),
        'email', assignment_rows.email,
        'status', assignment_rows.profile_status
      ),
      'role', jsonb_build_object(
        'id', assignment_rows.role_id,
        'key', assignment_rows.role_key,
        'name', assignment_rows.role_name,
        'description', assignment_rows.role_description,
        'permissions', assignment_rows.role_permissions,
        'system_role', assignment_rows.system_role
      ),
      'scope', assignment_rows.scope,
      'scope_id', assignment_rows.scope_id,
      'scope_label', case
        when assignment_rows.scope = 'community' then 'Community'
        when assignment_rows.scope = 'property' then coalesce(assignment_rows.account_number || ' - ' || assignment_rows.address_line1, 'Property')
        else 'Unsupported'
      end,
      'status', assignment_rows.status,
      'assigned_by', assignment_rows.assigned_by,
      'assigned_by_label', coalesce(assignment_rows.assigned_by_display_name, assignment_rows.assigned_by_email),
      'assigned_at', assignment_rows.assigned_at,
      'removed_at', assignment_rows.removed_at,
      'created_at', assignment_rows.created_at,
      'updated_at', assignment_rows.updated_at
    )
    order by assignment_rows.email asc, assignment_rows.role_name asc, assignment_rows.updated_at desc, assignment_rows.id asc
  ), 
  '[]'::jsonb
)
into assignments_json
from assignment_rows;

return jsonb_build_object(
  'status', 'ok',
  'community_id', target_community_id,
  'assignments', assignments_json
);
end;
$$;

create or replace function public.list_admin_role_targets(
  target_community_slug text,
  filter_query text,
  page_limit integer,
  page_offset integer
)
returns jsonb
language plpgsql
security definer
set search_path = public, app
as $$
declare
  actor_profile_id uuid;
  target_community_id uuid;
  bounded_limit integer;
  bounded_offset integer;
  search_query text;
  profiles_json jsonb;
  properties_json jsonb;
begin
  actor_profile_id := app.current_profile_id();

  select communities.id
  into target_community_id
  from public.communities
  where communities.slug = coalesce(nullif(btrim(target_community_slug), ''), 'spring-meadow-community')
    and communities.status = 'active';

  if target_community_id is null
    or actor_profile_id is null
    or not app.has_permission(target_community_id, 'admin.roles.manage')
  then
    return jsonb_build_object('status', 'permission_denied');
  end if;

  if filter_query is not null
    and length(btrim(filter_query)) > 200
  then
    return jsonb_build_object('status', 'invalid');
  end if;

  bounded_limit := least(greatest(coalesce(page_limit, 100), 1), 200);
  bounded_offset := greatest(coalesce(page_offset, 0), 0);
  search_query := nullif(
    replace(
      replace(
        replace(btrim(coalesce(filter_query, '')), chr(92), chr(92) || chr(92)),
        '%',
        chr(92) || '%'
      ),
      '_',
      chr(92) || '_'
    ),
    ''
  );

  with profile_rows as (
    select
      profiles.id,
      profiles.display_name,
      profiles.email,
      profiles.status
    from public.profiles
    where profiles.deleted_at is null
      and profiles.status in ('active', 'invited')
      and (
        exists (
          select 1
          from public.property_memberships
          where property_memberships.community_id = target_community_id
            and property_memberships.profile_id = profiles.id
            and property_memberships.status <> 'removed'
        )
        or exists (
          select 1
          from public.profile_roles
          where profile_roles.community_id = target_community_id
            and profile_roles.profile_id = profiles.id
            and profile_roles.status <> 'removed'
        )
      )
      and (
        search_query is null
        or profiles.email ilike '%' || search_query || '%' escape chr(92)
        or coalesce(profiles.display_name, '') ilike '%' || search_query || '%' escape chr(92)
      )
    order by coalesce(profiles.display_name, profiles.email), profiles.email, profiles.id
    limit bounded_limit
    offset bounded_offset
  )
  select coalesce(jsonb_agg(
    jsonb_build_object(
      'id', profile_rows.id,
      'display_name', coalesce(profile_rows.display_name, profile_rows.email),
      'email', profile_rows.email,
      'status', profile_rows.status
    )
    order by coalesce(profile_rows.display_name, profile_rows.email), profile_rows.email, profile_rows.id
  ), 
  '[]'::jsonb
)
into profiles_json
from profile_rows;

with property_rows as (
  select
    properties.id,
    properties.account_number,
    properties.address_line1,
    properties.city,
    properties.state,
    properties.postal_code
  from public.properties
  where properties.community_id = target_community_id
    and properties.deleted_at is null
  order by properties.account_number asc, properties.address_line1 asc, properties.id asc
)
  select coalesce(jsonb_agg(
    jsonb_build_object(
      'id', property_rows.id,
      'label', property_rows.account_number || ' - ' || property_rows.address_line1,
      'account_number', property_rows.account_number,
      'address_line1', property_rows.address_line1,
      'city', property_rows.city,
      'state', property_rows.state,
      'postal_code', property_rows.postal_code
    )
    order by property_rows.account_number asc, property_rows.address_line1 asc, property_rows.id asc
  ), 
  '[]'::jsonb
  )
  into properties_json
  from property_rows;

  return jsonb_build_object(
    'status', 'ok',
    'community_id', target_community_id,
    'profiles', profiles_json,
    'properties', properties_json
  );
end;
$$;

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
set search_path = public, app
as $$
declare
  actor_profile_id uuid;
  target_role_id uuid;
  profile_role_id uuid;
  effective_scope_id uuid;
  normalized_scope text;
  previous_assignment public.profile_roles%rowtype;
  target_profile public.profiles%rowtype;
  assigned_at_value timestamptz;
begin
  actor_profile_id := app.current_profile_id();
  normalized_scope := coalesce(nullif(btrim(target_scope), ''), 'community');

  if actor_profile_id is null
    or target_community_id is null
    or target_profile_id is null
    or not app.has_permission(target_community_id, 'admin.roles.manage')
    or normalized_scope is null
    or target_scope not in ('community', 'property')
  then
    return jsonb_build_object('status', 'unavailable');
  end if;

  select *
  into target_profile
  from public.profiles
  where profiles.id = target_profile_id
    and profiles.deleted_at is null
    and profiles.status in ('active', 'invited')
  for update;

  if target_profile.id is null then
    return jsonb_build_object('status', 'unavailable');
  end if;

  if normalized_scope = 'community' then
    effective_scope_id := '00000000-0000-0000-0000-000000000000'::uuid;
  elsif target_scope_id is null
    or target_scope_id = '00000000-0000-0000-0000-000000000000'::uuid
    or not exists (
      select 1
      from public.properties
      where properties.id = target_scope_id
        and properties.community_id = target_community_id
        and properties.deleted_at is null
    )
  then
    return jsonb_build_object('status', 'unavailable');
  else
    effective_scope_id := target_scope_id;
  end if;

  select id
  into target_role_id
  from public.roles
  where roles.community_id = target_community_id
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
    and scope = normalized_scope
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
    normalized_scope,
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
    'scope', normalized_scope,
    'scope_id', effective_scope_id,
    'assigned_by', actor_profile_id,
    'assigned_at', assigned_at_value,
    'removed_at', null
  );
exception
  when unique_violation or check_violation or invalid_text_representation then
    return jsonb_build_object('status', 'unavailable');
end;
$$;

create or replace function public.suspend_profile_role(
  target_profile_role_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public, app
as $$
declare
  actor_profile_id uuid;
  role_record public.profile_roles%rowtype;
  role_key text;
begin
  actor_profile_id := app.current_profile_id();

  select *
  into role_record
  from public.profile_roles
  where id = target_profile_role_id
  for update;

  if not found
    or actor_profile_id is null
    or not app.has_permission(role_record.community_id, 'admin.roles.manage')
  then
    return jsonb_build_object('status', 'unavailable');
  end if;

  select key
  into role_key
  from public.roles
  where id = role_record.role_id
    and roles.community_id = role_record.community_id;

  if role_record.profile_id = actor_profile_id then
    perform pg_advisory_xact_lock(
      hashtextextended(
        'profile-role-self-lockout:' || role_record.community_id::text || ':' || actor_profile_id::text,
        0
      )
    );
  end if;

  if role_record.status <> 'active' then
    return jsonb_build_object('status', 'invalid');
  end if;

  if role_record.profile_id = actor_profile_id
    and role_record.scope = 'community'
    and role_record.scope_id = '00000000-0000-0000-0000-000000000000'::uuid
    and exists (
      select 1
      from public.roles
      where roles.id = role_record.role_id
        and roles.community_id = role_record.community_id
        and 'admin.roles.manage' = any(roles.permissions)
    )
    and not exists (
      select 1
      from public.profile_roles other_profile_roles
      join public.roles other_roles
        on other_roles.id = other_profile_roles.role_id
        and other_roles.community_id = other_profile_roles.community_id
      where other_profile_roles.id <> role_record.id
        and other_profile_roles.community_id = role_record.community_id
        and other_profile_roles.profile_id = actor_profile_id
        and other_profile_roles.status = 'active'
        and other_profile_roles.scope = 'community'
        and other_profile_roles.scope_id = '00000000-0000-0000-0000-000000000000'::uuid
        and 'admin.roles.manage' = any(other_roles.permissions)
    )
  then
    return jsonb_build_object('status', 'invalid');
  end if;

  update public.profile_roles
  set
    status = 'suspended',
    removed_at = role_record.removed_at,
    updated_at = now()
  where id = target_profile_role_id;

  return jsonb_build_object(
    'status', 'suspended',
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
set search_path = public, app
as $$
declare
  actor_profile_id uuid;
  role_record public.profile_roles%rowtype;
  role_key text;
  removed_at_value timestamptz;
begin
  actor_profile_id := app.current_profile_id();

  select *
  into role_record
  from public.profile_roles
  where id = target_profile_role_id
  for update;

  if not found
    or actor_profile_id is null
    or not app.has_permission(role_record.community_id, 'admin.roles.manage')
  then
    return jsonb_build_object('status', 'unavailable');
  end if;

  select key
  into role_key
  from public.roles
  where id = role_record.role_id
    and roles.community_id = role_record.community_id;

  if role_record.profile_id = actor_profile_id then
    perform pg_advisory_xact_lock(
      hashtextextended(
        'profile-role-self-lockout:' || role_record.community_id::text || ':' || actor_profile_id::text,
        0
      )
    );
  end if;

  if role_record.status = 'removed' then
    return jsonb_build_object('status', 'invalid');
  end if;

  if role_record.profile_id = actor_profile_id
    and role_record.status = 'active'
    and role_record.scope = 'community'
    and role_record.scope_id = '00000000-0000-0000-0000-000000000000'::uuid
    and exists (
      select 1
      from public.roles
      where roles.id = role_record.role_id
        and roles.community_id = role_record.community_id
        and 'admin.roles.manage' = any(roles.permissions)
    )
    and not exists (
      select 1
      from public.profile_roles other_profile_roles
      join public.roles other_roles
        on other_roles.id = other_profile_roles.role_id
        and other_roles.community_id = other_profile_roles.community_id
      where other_profile_roles.id <> role_record.id
        and other_profile_roles.community_id = role_record.community_id
        and other_profile_roles.profile_id = actor_profile_id
        and other_profile_roles.status = 'active'
        and other_profile_roles.scope = 'community'
        and other_profile_roles.scope_id = '00000000-0000-0000-0000-000000000000'::uuid
        and 'admin.roles.manage' = any(other_roles.permissions)
    )
  then
    return jsonb_build_object('status', 'invalid');
  end if;

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

revoke all on function public.list_admin_roles(text, text, boolean) from public, anon, authenticated;
revoke all on function public.list_admin_profile_roles(text, text, text, uuid, boolean, integer, integer) from public, anon, authenticated;
revoke all on function public.list_admin_role_targets(text, text, integer, integer) from public, anon, authenticated;
revoke all on function public.assign_profile_role(uuid, uuid, text, text, uuid) from public, anon, authenticated;
revoke all on function public.suspend_profile_role(uuid) from public, anon, authenticated;
revoke all on function public.remove_profile_role(uuid) from public, anon, authenticated;

grant execute on function public.list_admin_roles(text, text, boolean) to authenticated;
grant execute on function public.list_admin_profile_roles(text, text, text, uuid, boolean, integer, integer) to authenticated;
grant execute on function public.list_admin_role_targets(text, text, integer, integer) to authenticated;
grant execute on function public.assign_profile_role(uuid, uuid, text, text, uuid) to authenticated;
grant execute on function public.suspend_profile_role(uuid) to authenticated;
grant execute on function public.remove_profile_role(uuid) to authenticated;
