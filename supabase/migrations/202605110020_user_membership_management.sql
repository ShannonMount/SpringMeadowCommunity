create or replace function public.list_admin_users(
  target_community_slug text,
  filter_query text,
  filter_status text,
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
  users_json jsonb;
begin
  actor_profile_id := app.current_profile_id();

  select communities.id
  into target_community_id
  from public.communities
  where communities.slug = coalesce(nullif(btrim(target_community_slug), ''), 'spring-meadow-community')
    and communities.status = 'active';

  if target_community_id is null
    or actor_profile_id is null
    or not app.has_permission(target_community_id, 'admin.users.manage')
  then
    return jsonb_build_object('status', 'permission_denied');
  end if;

  if filter_status is not null
    and filter_status not in ('invited', 'active', 'suspended', 'disabled')
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

  with user_rows as (
    select
      profiles.id,
      profiles.display_name,
      profiles.email,
      profiles.status,
      profiles.created_at,
      profiles.updated_at,
      count(property_memberships.id) filter (
        where coalesce(include_removed, false)
          or property_memberships.status <> 'removed'
      ) as membership_count,
      count(property_memberships.id) filter (where property_memberships.status = 'active') as active_membership_count,
      count(property_memberships.id) filter (where property_memberships.status = 'invited') as invited_membership_count,
      count(property_memberships.id) filter (where property_memberships.status = 'suspended') as suspended_membership_count,
      count(property_memberships.id) filter (where property_memberships.status = 'removed') as removed_membership_count
    from public.profiles
    left join public.property_memberships
      on property_memberships.profile_id = profiles.id
      and property_memberships.community_id = target_community_id
    where profiles.deleted_at is null
      and (filter_status is null or profiles.status = filter_status)
      and (
        search_query is null
        or profiles.email ilike '%' || search_query || '%' escape chr(92)
        or coalesce(profiles.display_name, '') ilike '%' || search_query || '%' escape chr(92)
      )
      and (
        exists (
          select 1
          from public.property_memberships membership_filter
          where membership_filter.community_id = target_community_id
            and membership_filter.profile_id = profiles.id
            and (
              coalesce(include_removed, false)
              or membership_filter.status <> 'removed'
            )
        )
      )
    group by profiles.id, profiles.display_name, profiles.email, profiles.status, profiles.created_at, profiles.updated_at
    order by coalesce(profiles.display_name, profiles.email), profiles.email, profiles.id
    limit bounded_limit
    offset bounded_offset
  )
  select coalesce(jsonb_agg(
    jsonb_build_object(
      'id', user_rows.id,
      'display_name', coalesce(user_rows.display_name, user_rows.email),
      'email', user_rows.email,
      'status', user_rows.status,
      'membership_count', user_rows.membership_count,
      'active_membership_count', user_rows.active_membership_count,
      'invited_membership_count', user_rows.invited_membership_count,
      'suspended_membership_count', user_rows.suspended_membership_count,
      'removed_membership_count', user_rows.removed_membership_count,
      'created_at', user_rows.created_at,
      'updated_at', user_rows.updated_at
    )
    order by coalesce(user_rows.display_name, user_rows.email), user_rows.email, user_rows.id
  ), 
  '[]'::jsonb
)
into users_json
from user_rows;

return jsonb_build_object(
  'status', 'ok',
  'community_id', target_community_id,
  'users', users_json
);
end;
$$;

create or replace function public.list_admin_memberships(
  target_community_slug text,
  filter_query text,
  filter_status text,
  target_property_id uuid,
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
  memberships_json jsonb;
begin
  actor_profile_id := app.current_profile_id();

  select communities.id
  into target_community_id
  from public.communities
  where communities.slug = coalesce(nullif(btrim(target_community_slug), ''), 'spring-meadow-community')
    and communities.status = 'active';

  if target_community_id is null
    or actor_profile_id is null
    or not app.has_permission(target_community_id, 'admin.users.manage')
  then
    return jsonb_build_object('status', 'permission_denied');
  end if;

  if filter_status is not null
    and filter_status not in ('invited', 'active', 'suspended', 'removed')
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

  with membership_rows as (
    select
      property_memberships.id,
      property_memberships.community_id,
      property_memberships.property_id,
      property_memberships.profile_id,
      property_memberships.relationship,
      property_memberships.status,
      property_memberships.can_view_balance,
      property_memberships.can_pay_dues,
      property_memberships.can_view_documents,
      property_memberships.can_invite_members,
      property_memberships.invited_by,
      property_memberships.invited_at,
      property_memberships.accepted_at,
      property_memberships.removed_at,
      property_memberships.created_at,
      property_memberships.updated_at,
      profiles.display_name,
      profiles.email,
      profiles.status as profile_status,
      properties.account_number,
      properties.address_line1,
      properties.address_line2,
      properties.city,
      properties.state,
      properties.postal_code,
      inviter.display_name as invited_by_display_name,
      inviter.email as invited_by_email
    from public.property_memberships
    join public.profiles
      on profiles.id = property_memberships.profile_id
      and profiles.deleted_at is null
    join public.properties
      on properties.id = property_memberships.property_id
      and properties.community_id = target_community_id
      and properties.deleted_at is null
    left join public.profiles inviter
      on inviter.id = property_memberships.invited_by
    where property_memberships.community_id = target_community_id
      and (target_property_id is null or property_memberships.property_id = target_property_id)
      and (target_profile_id is null or property_memberships.profile_id = target_profile_id)
      and (filter_status is null or property_memberships.status::text = filter_status)
      and (
        coalesce(include_removed, false)
        or filter_status = 'removed'
        or property_memberships.status <> 'removed'
      )
      and (
        search_query is null
        or profiles.email ilike '%' || search_query || '%' escape chr(92)
        or coalesce(profiles.display_name, '') ilike '%' || search_query || '%' escape chr(92)
        or properties.account_number ilike '%' || search_query || '%' escape chr(92)
        or properties.address_line1 ilike '%' || search_query || '%' escape chr(92)
        or properties.city ilike '%' || search_query || '%' escape chr(92)
      )
    order by profiles.email asc, properties.account_number asc, property_memberships.id asc
    limit bounded_limit
    offset bounded_offset
  )
  select coalesce(jsonb_agg(
    jsonb_build_object(
      'id', membership_rows.id,
      'community_id', membership_rows.community_id,
      'property_id', membership_rows.property_id,
      'profile_id', membership_rows.profile_id,
      'relationship', membership_rows.relationship,
      'status', membership_rows.status,
      'can_view_balance', membership_rows.can_view_balance,
      'can_pay_dues', membership_rows.can_pay_dues,
      'can_view_documents', membership_rows.can_view_documents,
      'can_invite_members', membership_rows.can_invite_members,
      'invited_by', membership_rows.invited_by,
      'invited_by_display_name', membership_rows.invited_by_display_name,
      'invited_by_email', membership_rows.invited_by_email,
      'invited_at', membership_rows.invited_at,
      'accepted_at', membership_rows.accepted_at,
      'removed_at', membership_rows.removed_at,
      'created_at', membership_rows.created_at,
      'updated_at', membership_rows.updated_at,
      'profile', jsonb_build_object(
        'id', membership_rows.profile_id,
        'display_name', coalesce(membership_rows.display_name, membership_rows.email),
        'email', membership_rows.email,
        'status', membership_rows.profile_status
      ),
      'property', jsonb_build_object(
        'id', membership_rows.property_id,
        'account_number', membership_rows.account_number,
        'address_line1', membership_rows.address_line1,
        'address_line2', membership_rows.address_line2,
        'city', membership_rows.city,
        'state', membership_rows.state,
        'postal_code', membership_rows.postal_code
      )
    )
    order by membership_rows.email asc, membership_rows.account_number asc, membership_rows.id asc
  ), 
  '[]'::jsonb
)
into memberships_json
from membership_rows;

return jsonb_build_object(
  'status', 'ok',
  'community_id', target_community_id,
  'memberships', memberships_json
);
end;
$$;

create or replace function public.invite_admin_property_member(
  target_community_slug text,
  target_property_id uuid,
  target_profile_id uuid,
  target_email text,
  target_display_name text,
  target_relationship text,
  allow_view_balance boolean,
  allow_pay_dues boolean,
  allow_view_documents boolean,
  allow_invite_members boolean,
  invitation_token_hash text,
  invitation_expires_at timestamptz
)
returns jsonb
language plpgsql
security definer
set search_path = public, app
as $$
declare
  actor_profile_id uuid;
  target_community_id uuid;
  profile_record public.profiles%rowtype;
  property_record public.properties%rowtype;
  existing_membership public.property_memberships%rowtype;
  membership_id uuid;
  normalized_relationship text;
begin
  actor_profile_id := app.current_profile_id();

  select communities.id
  into target_community_id
  from public.communities
  where communities.slug = coalesce(nullif(btrim(target_community_slug), ''), 'spring-meadow-community')
    and communities.status = 'active';

  if target_community_id is null
    or actor_profile_id is null
    or not app.has_permission(target_community_id, 'admin.users.manage')
  then
    return jsonb_build_object('status', 'permission_denied');
  end if;

  normalized_relationship := coalesce(nullif(btrim(target_relationship), ''), 'resident');

  if normalized_relationship not in ('owner', 'co_owner', 'resident', 'renter', 'manager', 'family', 'other') then
    return jsonb_build_object('status', 'invalid');
  end if;

  select *
  into property_record
  from public.properties
  where properties.id = target_property_id
    and properties.community_id = target_community_id
    and properties.deleted_at is null
  for update;

  if property_record.id is null then
    return jsonb_build_object('status', 'property_unavailable');
  end if;

  if target_profile_id is not null then
    select *
    into profile_record
    from public.profiles
    where profiles.id = target_profile_id
      and profiles.deleted_at is null
    for update;
  else
    select *
    into profile_record
    from public.profiles
    where lower(profiles.email) = lower(btrim(coalesce(target_email, '')))
      and profiles.deleted_at is null
    for update;
  end if;

  if profile_record.id is null then
    return jsonb_build_object('status', 'profile_unavailable');
  end if;

  select *
  into existing_membership
  from public.property_memberships
  where property_memberships.community_id = target_community_id
    and property_memberships.property_id = target_property_id
    and property_memberships.profile_id = profile_record.id
  for update;

  if existing_membership.id is not null and existing_membership.status <> 'removed' then
    return jsonb_build_object('status', 'membership_conflict');
  end if;

  if existing_membership.id is not null then
    update public.property_memberships
    set
      relationship = normalized_relationship::relationship_type,
      status = 'invited',
      can_view_balance = coalesce(allow_view_balance, false),
      can_pay_dues = coalesce(allow_pay_dues, false),
      can_view_documents = coalesce(allow_view_documents, false),
      can_invite_members = coalesce(allow_invite_members, false),
      invited_by = actor_profile_id,
      invited_at = now(),
      accepted_at = null,
      removed_at = null,
      updated_at = now()
    where property_memberships.id = existing_membership.id
    returning id into membership_id;
  else
    insert into public.property_memberships (
      community_id,
      property_id,
      profile_id,
      relationship,
      status,
      can_view_balance,
      can_pay_dues,
      can_view_documents,
      can_invite_members,
      invited_by,
      invited_at,
      accepted_at,
      removed_at
    )
    values (
      target_community_id,
      target_property_id,
      profile_record.id,
      normalized_relationship::relationship_type,
      'invited',
      coalesce(allow_view_balance, false),
      coalesce(allow_pay_dues, false),
      coalesce(allow_view_documents, false),
      coalesce(allow_invite_members, false),
      actor_profile_id,
      now(),
      null,
      null
    )
    returning id into membership_id;
  end if;

  if nullif(btrim(coalesce(invitation_token_hash, '')), '') is not null then
    update public.property_invitation_tokens
    set
      revoked_at = now(),
      updated_at = now()
    where property_membership_id = membership_id
      and accepted_at is null
      and revoked_at is null;

    insert into public.property_invitation_tokens (
      token_hash,
      property_membership_id,
      community_id,
      property_id,
      invited_email,
      invited_by,
      expires_at
    )
    values (
      invitation_token_hash,
      membership_id,
      target_community_id,
      target_property_id,
      profile_record.email,
      actor_profile_id,
      coalesce(invitation_expires_at, now() + interval '14 days')
    );
  end if;

  return jsonb_build_object(
    'status', 'invited',
    'membership_id', membership_id,
    'community_id', target_community_id,
    'property_id', target_property_id,
    'target_profile_id', profile_record.id,
    'target_profile_email', profile_record.email,
    'invited_by', actor_profile_id,
    'before', case
      when existing_membership.id is null then null
      else jsonb_build_object(
        'status', existing_membership.status,
        'relationship', existing_membership.relationship,
        'can_view_balance', existing_membership.can_view_balance,
        'can_pay_dues', existing_membership.can_pay_dues,
        'can_view_documents', existing_membership.can_view_documents,
        'can_invite_members', existing_membership.can_invite_members,
        'removed_at', existing_membership.removed_at
      )
    end
  );
exception
  when unique_violation then
    return jsonb_build_object('status', 'membership_conflict');
  when check_violation or invalid_text_representation then
    return jsonb_build_object('status', 'invalid');
end;
$$;

create or replace function public.update_admin_property_membership(
  target_membership_id uuid,
  target_community_slug text,
  target_relationship text,
  allow_view_balance boolean,
  allow_pay_dues boolean,
  allow_view_documents boolean,
  allow_invite_members boolean
)
returns jsonb
language plpgsql
security definer
set search_path = public, app
as $$
declare
  actor_profile_id uuid;
  target_community_id uuid;
  membership_record public.property_memberships%rowtype;
  normalized_relationship text;
begin
  actor_profile_id := app.current_profile_id();

  select communities.id
  into target_community_id
  from public.communities
  where communities.slug = coalesce(nullif(btrim(target_community_slug), ''), 'spring-meadow-community')
    and communities.status = 'active';

  if target_community_id is null
    or actor_profile_id is null
    or not app.has_permission(target_community_id, 'admin.users.manage')
  then
    return jsonb_build_object('status', 'permission_denied');
  end if;

  normalized_relationship := coalesce(nullif(btrim(target_relationship), ''), 'resident');

  if normalized_relationship not in ('owner', 'co_owner', 'resident', 'renter', 'manager', 'family', 'other') then
    return jsonb_build_object('status', 'invalid');
  end if;

  select *
  into membership_record
  from public.property_memberships
  where property_memberships.id = target_membership_id
    and property_memberships.community_id = target_community_id
  for update;

  if membership_record.id is null then
    return jsonb_build_object('status', 'membership_unavailable');
  end if;

  update public.property_memberships
  set
    relationship = normalized_relationship::relationship_type,
    can_view_balance = coalesce(allow_view_balance, false),
    can_pay_dues = coalesce(allow_pay_dues, false),
    can_view_documents = coalesce(allow_view_documents, false),
    can_invite_members = coalesce(allow_invite_members, false),
    updated_at = now()
  where property_memberships.id = target_membership_id
    and property_memberships.community_id = target_community_id;

  return jsonb_build_object(
    'status', 'updated',
    'membership_id', target_membership_id,
    'community_id', target_community_id,
    'property_id', membership_record.property_id,
    'target_profile_id', membership_record.profile_id,
    'target_profile_email', (
      select profiles.email
      from public.profiles
      where profiles.id = membership_record.profile_id
    ),
    'updated_by', actor_profile_id,
    'before', jsonb_build_object(
      'status', membership_record.status,
      'relationship', membership_record.relationship,
      'can_view_balance', membership_record.can_view_balance,
      'can_pay_dues', membership_record.can_pay_dues,
      'can_view_documents', membership_record.can_view_documents,
      'can_invite_members', membership_record.can_invite_members,
      'invited_by', membership_record.invited_by,
      'invited_at', membership_record.invited_at,
      'accepted_at', membership_record.accepted_at,
      'removed_at', membership_record.removed_at
    ),
    'after', jsonb_build_object(
      'status', membership_record.status,
      'relationship', normalized_relationship,
      'can_view_balance', coalesce(allow_view_balance, false),
      'can_pay_dues', coalesce(allow_pay_dues, false),
      'can_view_documents', coalesce(allow_view_documents, false),
      'can_invite_members', coalesce(allow_invite_members, false),
      'invited_by', membership_record.invited_by,
      'invited_at', membership_record.invited_at,
      'accepted_at', membership_record.accepted_at,
      'removed_at', membership_record.removed_at
    )
  );
end;
$$;

create or replace function public.activate_admin_property_membership(
  target_membership_id uuid,
  target_community_slug text
)
returns jsonb
language plpgsql
security definer
set search_path = public, app
as $$
declare
  actor_profile_id uuid;
  target_community_id uuid;
  membership_record public.property_memberships%rowtype;
begin
  actor_profile_id := app.current_profile_id();

  select communities.id
  into target_community_id
  from public.communities
  where communities.slug = coalesce(nullif(btrim(target_community_slug), ''), 'spring-meadow-community')
    and communities.status = 'active';

  if target_community_id is null
    or actor_profile_id is null
    or not app.has_permission(target_community_id, 'admin.users.manage')
  then
    return jsonb_build_object('status', 'permission_denied');
  end if;

  select *
  into membership_record
  from public.property_memberships
  where property_memberships.id = target_membership_id
    and property_memberships.community_id = target_community_id
  for update;

  if membership_record.id is null then
    return jsonb_build_object('status', 'membership_unavailable');
  end if;

  if membership_record.status not in ('invited', 'suspended') then
    return jsonb_build_object('status', 'invalid');
  end if;

  update public.property_memberships
  set
    status = 'active',
    accepted_at = coalesce(property_memberships.accepted_at, now()),
    removed_at = null,
    updated_at = now()
  where property_memberships.id = target_membership_id
    and property_memberships.community_id = target_community_id;

  return jsonb_build_object(
    'status', 'activated',
    'membership_id', target_membership_id,
    'community_id', target_community_id,
    'property_id', membership_record.property_id,
    'target_profile_id', membership_record.profile_id,
    'target_profile_email', (
      select profiles.email
      from public.profiles
      where profiles.id = membership_record.profile_id
    ),
    'updated_by', actor_profile_id,
    'before', jsonb_build_object(
      'status', membership_record.status,
      'accepted_at', membership_record.accepted_at,
      'removed_at', membership_record.removed_at
    ),
    'after', jsonb_build_object(
      'status', 'active',
      'relationship', membership_record.relationship,
      'can_view_balance', membership_record.can_view_balance,
      'can_pay_dues', membership_record.can_pay_dues,
      'can_view_documents', membership_record.can_view_documents,
      'can_invite_members', membership_record.can_invite_members,
      'invited_by', membership_record.invited_by,
      'invited_at', membership_record.invited_at,
      'accepted_at', coalesce(membership_record.accepted_at, now()),
      'removed_at', null
    )
  );
end;
$$;

create or replace function public.suspend_admin_property_membership(
  target_membership_id uuid,
  target_community_slug text
)
returns jsonb
language plpgsql
security definer
set search_path = public, app
as $$
declare
  actor_profile_id uuid;
  target_community_id uuid;
  membership_record public.property_memberships%rowtype;
begin
  actor_profile_id := app.current_profile_id();

  select communities.id
  into target_community_id
  from public.communities
  where communities.slug = coalesce(nullif(btrim(target_community_slug), ''), 'spring-meadow-community')
    and communities.status = 'active';

  if target_community_id is null
    or actor_profile_id is null
    or not app.has_permission(target_community_id, 'admin.users.manage')
  then
    return jsonb_build_object('status', 'permission_denied');
  end if;

  select *
  into membership_record
  from public.property_memberships
  where property_memberships.id = target_membership_id
    and property_memberships.community_id = target_community_id
  for update;

  if membership_record.id is null then
    return jsonb_build_object('status', 'membership_unavailable');
  end if;

  if membership_record.status not in ('invited', 'active') then
    return jsonb_build_object('status', 'invalid');
  end if;

  update public.property_memberships
  set
    status = 'suspended',
    updated_at = now()
  where property_memberships.id = target_membership_id
    and property_memberships.community_id = target_community_id;

  update public.property_invitation_tokens
  set
    revoked_at = now(),
    updated_at = now()
  where property_membership_id = target_membership_id
    and accepted_at is null
    and revoked_at is null;

  return jsonb_build_object(
    'status', 'suspended',
    'membership_id', target_membership_id,
    'community_id', target_community_id,
    'property_id', membership_record.property_id,
    'target_profile_id', membership_record.profile_id,
    'target_profile_email', (
      select profiles.email
      from public.profiles
      where profiles.id = membership_record.profile_id
    ),
    'updated_by', actor_profile_id,
    'before', jsonb_build_object(
      'status', membership_record.status,
      'accepted_at', membership_record.accepted_at,
      'removed_at', membership_record.removed_at
    ),
    'after', jsonb_build_object(
      'status', 'suspended',
      'relationship', membership_record.relationship,
      'can_view_balance', membership_record.can_view_balance,
      'can_pay_dues', membership_record.can_pay_dues,
      'can_view_documents', membership_record.can_view_documents,
      'can_invite_members', membership_record.can_invite_members,
      'invited_by', membership_record.invited_by,
      'invited_at', membership_record.invited_at,
      'accepted_at', membership_record.accepted_at,
      'removed_at', membership_record.removed_at
    )
  );
end;
$$;

create or replace function public.remove_admin_property_membership(
  target_membership_id uuid,
  target_community_slug text
)
returns jsonb
language plpgsql
security definer
set search_path = public, app
as $$
declare
  actor_profile_id uuid;
  target_community_id uuid;
  membership_record public.property_memberships%rowtype;
begin
  actor_profile_id := app.current_profile_id();

  select communities.id
  into target_community_id
  from public.communities
  where communities.slug = coalesce(nullif(btrim(target_community_slug), ''), 'spring-meadow-community')
    and communities.status = 'active';

  if target_community_id is null
    or actor_profile_id is null
    or not app.has_permission(target_community_id, 'admin.users.manage')
  then
    return jsonb_build_object('status', 'permission_denied');
  end if;

  select *
  into membership_record
  from public.property_memberships
  where property_memberships.id = target_membership_id
    and property_memberships.community_id = target_community_id
  for update;

  if membership_record.id is null then
    return jsonb_build_object('status', 'membership_unavailable');
  end if;

  if membership_record.status = 'removed' then
    return jsonb_build_object('status', 'invalid');
  end if;

  update public.property_memberships
  set
    status = 'removed',
    removed_at = now(),
    updated_at = now()
  where property_memberships.id = target_membership_id
    and property_memberships.community_id = target_community_id;

  update public.property_invitation_tokens
  set
    revoked_at = now(),
    updated_at = now()
  where property_membership_id = target_membership_id
    and accepted_at is null
    and revoked_at is null;

  return jsonb_build_object(
    'status', 'removed',
    'membership_id', target_membership_id,
    'community_id', target_community_id,
    'property_id', membership_record.property_id,
    'target_profile_id', membership_record.profile_id,
    'target_profile_email', (
      select profiles.email
      from public.profiles
      where profiles.id = membership_record.profile_id
    ),
    'updated_by', actor_profile_id,
    'before', jsonb_build_object(
      'status', membership_record.status,
      'accepted_at', membership_record.accepted_at,
      'removed_at', membership_record.removed_at
    ),
    'after', jsonb_build_object(
      'status', 'removed',
      'relationship', membership_record.relationship,
      'can_view_balance', membership_record.can_view_balance,
      'can_pay_dues', membership_record.can_pay_dues,
      'can_view_documents', membership_record.can_view_documents,
      'can_invite_members', membership_record.can_invite_members,
      'invited_by', membership_record.invited_by,
      'invited_at', membership_record.invited_at,
      'accepted_at', membership_record.accepted_at,
      'removed_at', now()
    )
  );
end;
$$;

revoke all on function public.list_admin_users(text, text, text, boolean, integer, integer) from public, anon;
revoke all on function public.list_admin_memberships(text, text, text, uuid, uuid, boolean, integer, integer) from public, anon;
revoke all on function public.invite_admin_property_member(text, uuid, uuid, text, text, text, boolean, boolean, boolean, boolean, text, timestamptz) from public, anon;
revoke all on function public.update_admin_property_membership(uuid, text, text, boolean, boolean, boolean, boolean) from public, anon;
revoke all on function public.activate_admin_property_membership(uuid, text) from public, anon;
revoke all on function public.suspend_admin_property_membership(uuid, text) from public, anon;
revoke all on function public.remove_admin_property_membership(uuid, text) from public, anon;

grant execute on function public.list_admin_users(text, text, text, boolean, integer, integer) to authenticated;
grant execute on function public.list_admin_memberships(text, text, text, uuid, uuid, boolean, integer, integer) to authenticated;
grant execute on function public.invite_admin_property_member(text, uuid, uuid, text, text, text, boolean, boolean, boolean, boolean, text, timestamptz) to authenticated;
grant execute on function public.update_admin_property_membership(uuid, text, text, boolean, boolean, boolean, boolean) to authenticated;
grant execute on function public.activate_admin_property_membership(uuid, text) to authenticated;
grant execute on function public.suspend_admin_property_membership(uuid, text) to authenticated;
grant execute on function public.remove_admin_property_membership(uuid, text) to authenticated;
