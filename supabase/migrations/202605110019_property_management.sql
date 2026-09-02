update public.roles
set
  permissions = case
    when 'admin.properties.manage' = any(permissions) then permissions
    else permissions || array['admin.properties.manage']::text[]
  end,
  updated_at = now()
where key = 'admin';

create or replace function app.admin_property_mailing_address_is_valid(mailing_address jsonb)
returns boolean
language sql
immutable
set search_path = public, app
as $$
  select case
    when mailing_address is null then true
    when jsonb_typeof(mailing_address) <> 'object' then false
    else not exists (
        select 1
        from jsonb_each(mailing_address) as fields(key, value)
        where fields.key not in ('line1', 'line2', 'city', 'state', 'postalCode', 'county')
          or jsonb_typeof(fields.value) <> 'string'
          or length(coalesce(fields.value #>> '{}', '')) > 200
          or coalesce(fields.value #>> '{}', '') ~ '[[:cntrl:]]'
      )
    end;
$$;

create or replace function public.list_admin_properties(
  target_community_slug text,
  include_archived boolean,
  filter_status text,
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
    or not app.has_permission(target_community_id, 'admin.properties.manage')
  then
    return jsonb_build_object('status', 'permission_denied');
  end if;

  if filter_status is not null
    and filter_status not in ('active', 'inactive', 'archived')
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

  with filtered_properties as (
    select
      properties.id,
      properties.community_id,
      properties.account_number,
      properties.public_payment_code,
      properties.status,
      properties.address_line1,
      properties.address_line2,
      properties.city,
      properties.state,
      properties.postal_code,
      properties.county,
      properties.mailing_address,
      properties.owner_display_name,
      properties.lot_number,
      properties.parcel_number,
      properties.plat_reference,
      properties.current_balance_cents,
      properties.last_payment_at,
      properties.next_due_date,
      properties.delinquency_status,
      properties.created_at,
      properties.updated_at
    from public.properties
    where properties.community_id = target_community_id
      and (
        coalesce(include_archived, false)
        or filter_status = 'archived'
        or (
          properties.status <> 'archived'
          and properties.deleted_at is null
        )
      )
      and (filter_status is null or properties.status::text = filter_status)
      and (
        search_query is null
        or properties.account_number ilike '%' || search_query || '%' escape chr(92)
        or coalesce(properties.public_payment_code, '') ilike '%' || search_query || '%' escape chr(92)
        or properties.address_line1 ilike '%' || search_query || '%' escape chr(92)
        or properties.city ilike '%' || search_query || '%' escape chr(92)
        or coalesce(properties.owner_display_name, '') ilike '%' || search_query || '%' escape chr(92)
        or coalesce(properties.lot_number, '') ilike '%' || search_query || '%' escape chr(92)
        or coalesce(properties.parcel_number, '') ilike '%' || search_query || '%' escape chr(92)
      )
    order by properties.account_number asc, properties.address_line1 asc, properties.id asc
    limit bounded_limit
    offset bounded_offset
  )
  select coalesce(jsonb_agg(
    jsonb_build_object(
      'id', filtered_properties.id,
      'community_id', filtered_properties.community_id,
      'account_number', filtered_properties.account_number,
      'public_payment_code', filtered_properties.public_payment_code,
      'status', filtered_properties.status,
      'address_line1', filtered_properties.address_line1,
      'address_line2', filtered_properties.address_line2,
      'city', filtered_properties.city,
      'state', filtered_properties.state,
      'postal_code', filtered_properties.postal_code,
      'county', filtered_properties.county,
      'mailing_address', filtered_properties.mailing_address,
      'owner_display_name', filtered_properties.owner_display_name,
      'lot_number', filtered_properties.lot_number,
      'parcel_number', filtered_properties.parcel_number,
      'plat_reference', filtered_properties.plat_reference,
      'current_balance_cents', filtered_properties.current_balance_cents,
      'last_payment_at', filtered_properties.last_payment_at,
      'next_due_date', filtered_properties.next_due_date,
      'delinquency_status', filtered_properties.delinquency_status,
      'created_at', filtered_properties.created_at,
      'updated_at', filtered_properties.updated_at
    )
    order by filtered_properties.account_number asc, filtered_properties.address_line1 asc, filtered_properties.id asc
  ), 
  '[]'::jsonb
)
into properties_json
from filtered_properties;

return jsonb_build_object(
  'status', 'ok',
  'community_id', target_community_id,
  'properties', properties_json
);
end;
$$;

create or replace function public.create_admin_property(
  target_community_slug text,
  property_account_number text,
  property_public_payment_code text,
  property_status text,
  property_address_line1 text,
  property_address_line2 text,
  property_city text,
  property_state text,
  property_postal_code text,
  property_county text,
  property_mailing_address jsonb,
  property_owner_display_name text,
  property_lot_number text,
  property_parcel_number text,
  property_plat_reference text,
  property_next_due_date date,
  property_delinquency_status text
)
returns jsonb
language plpgsql
security definer
set search_path = public, app
as $$
declare
  actor_profile_id uuid;
  target_community_id uuid;
  created_property_id uuid;
  normalized_account_number text;
  normalized_payment_code text;
  normalized_status text;
  normalized_delinquency_status text;
begin
  actor_profile_id := app.current_profile_id();

  select communities.id
  into target_community_id
  from public.communities
  where communities.slug = coalesce(nullif(btrim(target_community_slug), ''), 'spring-meadow-community')
    and communities.status = 'active';

  if target_community_id is null
    or actor_profile_id is null
    or not app.has_permission(target_community_id, 'admin.properties.manage')
  then
    return jsonb_build_object('status', 'permission_denied');
  end if;

  normalized_account_number := upper(regexp_replace(btrim(coalesce(property_account_number, '')), '\s+', ' ', 'g'));
  normalized_payment_code := nullif(upper(regexp_replace(btrim(coalesce(property_public_payment_code, '')), '\s+', ' ', 'g')), '');
  normalized_status := coalesce(nullif(btrim(property_status), ''), 'active');
  normalized_delinquency_status := coalesce(nullif(btrim(property_delinquency_status), ''), 'current');

  if normalized_account_number = ''
    or btrim(coalesce(property_address_line1, '')) = ''
    or btrim(coalesce(property_city, '')) = ''
    or btrim(coalesce(property_state, '')) = ''
    or btrim(coalesce(property_postal_code, '')) = ''
    or normalized_status not in ('active', 'inactive', 'archived')
    or normalized_delinquency_status not in ('current', 'due_soon', 'overdue', 'delinquent', 'lien_review', 'disputed')
    or not app.admin_property_mailing_address_is_valid(property_mailing_address)
  then
    return jsonb_build_object('status', 'invalid');
  end if;

  if exists (
    select 1
    from public.properties
    where properties.community_id = target_community_id
      and upper(properties.account_number) = normalized_account_number
  ) then
    return jsonb_build_object('status', 'account_conflict');
  end if;

  if normalized_payment_code is not null
    and exists (
      select 1
      from public.properties
      where upper(properties.public_payment_code) = normalized_payment_code
    )
  then
    return jsonb_build_object('status', 'payment_code_conflict');
  end if;

  insert into public.properties (
    community_id,
    account_number,
    public_payment_code,
    status,
    address_line1,
    address_line2,
    city,
    state,
    postal_code,
    county,
    mailing_address,
    owner_display_name,
    lot_number,
    parcel_number,
    plat_reference,
    current_balance_cents,
    last_payment_at,
    next_due_date,
    delinquency_status,
    deleted_at
  )
  values (
    target_community_id,
    normalized_account_number,
    normalized_payment_code,
    normalized_status::property_status,
    btrim(property_address_line1),
    nullif(btrim(coalesce(property_address_line2, '')), ''),
    btrim(property_city),
    upper(btrim(property_state)),
    btrim(property_postal_code),
    nullif(btrim(coalesce(property_county, '')), ''),
    property_mailing_address,
    nullif(btrim(coalesce(property_owner_display_name, '')), ''),
    nullif(btrim(coalesce(property_lot_number, '')), ''),
    nullif(btrim(coalesce(property_parcel_number, '')), ''),
    nullif(btrim(coalesce(property_plat_reference, '')), ''),
    0,
    null,
    property_next_due_date,
    normalized_delinquency_status,
    case when normalized_status = 'archived' then now() else null end
  )
  returning id into created_property_id;

  return jsonb_build_object(
    'status', 'created',
    'property_id', created_property_id,
    'community_id', target_community_id,
    'created_by', actor_profile_id
  );
exception
  when unique_violation then
    return jsonb_build_object('status', 'account_conflict');
  when check_violation or invalid_text_representation then
    return jsonb_build_object('status', 'invalid');
end;
$$;

create or replace function public.update_admin_property(
  target_property_id uuid,
  target_community_slug text,
  property_account_number text,
  property_public_payment_code text,
  property_status text,
  property_address_line1 text,
  property_address_line2 text,
  property_city text,
  property_state text,
  property_postal_code text,
  property_county text,
  property_mailing_address jsonb,
  property_owner_display_name text,
  property_lot_number text,
  property_parcel_number text,
  property_plat_reference text,
  property_next_due_date date,
  property_delinquency_status text
)
returns jsonb
language plpgsql
security definer
set search_path = public, app
as $$
declare
  actor_profile_id uuid;
  target_community_id uuid;
  property_record public.properties%rowtype;
  normalized_account_number text;
  normalized_payment_code text;
  normalized_status text;
  normalized_delinquency_status text;
begin
  actor_profile_id := app.current_profile_id();

  select communities.id
  into target_community_id
  from public.communities
  where communities.slug = coalesce(nullif(btrim(target_community_slug), ''), 'spring-meadow-community')
    and communities.status = 'active';

  if target_community_id is null
    or actor_profile_id is null
    or not app.has_permission(target_community_id, 'admin.properties.manage')
  then
    return jsonb_build_object('status', 'permission_denied');
  end if;

  select *
  into property_record
  from public.properties
  where properties.id = target_property_id
    and properties.community_id = target_community_id
  for update;

  if property_record.id is null then
    return jsonb_build_object('status', 'property_unavailable');
  end if;

  normalized_account_number := upper(regexp_replace(btrim(coalesce(property_account_number, '')), '\s+', ' ', 'g'));
  normalized_payment_code := nullif(upper(regexp_replace(btrim(coalesce(property_public_payment_code, '')), '\s+', ' ', 'g')), '');
  normalized_status := coalesce(nullif(btrim(property_status), ''), property_record.status::text);
  normalized_delinquency_status := coalesce(nullif(btrim(property_delinquency_status), ''), property_record.delinquency_status);

  if normalized_account_number = ''
    or btrim(coalesce(property_address_line1, '')) = ''
    or btrim(coalesce(property_city, '')) = ''
    or btrim(coalesce(property_state, '')) = ''
    or btrim(coalesce(property_postal_code, '')) = ''
    or normalized_status not in ('active', 'inactive', 'archived')
    or normalized_delinquency_status not in ('current', 'due_soon', 'overdue', 'delinquent', 'lien_review', 'disputed')
    or not app.admin_property_mailing_address_is_valid(property_mailing_address)
  then
    return jsonb_build_object('status', 'invalid');
  end if;

  if exists (
    select 1
    from public.properties
    where properties.community_id = target_community_id
      and properties.id <> target_property_id
      and upper(properties.account_number) = normalized_account_number
  ) then
    return jsonb_build_object('status', 'account_conflict');
  end if;

  if normalized_payment_code is not null
    and exists (
      select 1
      from public.properties
      where properties.id <> target_property_id
        and upper(properties.public_payment_code) = normalized_payment_code
    )
  then
    return jsonb_build_object('status', 'payment_code_conflict');
  end if;

  update public.properties
  set
    account_number = normalized_account_number,
    public_payment_code = normalized_payment_code,
    status = normalized_status::property_status,
    address_line1 = btrim(property_address_line1),
    address_line2 = nullif(btrim(coalesce(property_address_line2, '')), ''),
    city = btrim(property_city),
    state = upper(btrim(property_state)),
    postal_code = btrim(property_postal_code),
    county = nullif(btrim(coalesce(property_county, '')), ''),
    mailing_address = property_mailing_address,
    owner_display_name = nullif(btrim(coalesce(property_owner_display_name, '')), ''),
    lot_number = nullif(btrim(coalesce(property_lot_number, '')), ''),
    parcel_number = nullif(btrim(coalesce(property_parcel_number, '')), ''),
    plat_reference = nullif(btrim(coalesce(property_plat_reference, '')), ''),
    next_due_date = property_next_due_date,
    delinquency_status = normalized_delinquency_status,
    deleted_at = case
      when normalized_status = 'archived' then coalesce(properties.deleted_at, now())
      else null
    end,
    updated_at = now()
  where properties.id = target_property_id
    and properties.community_id = target_community_id;

  return jsonb_build_object(
    'status', 'updated',
    'property_id', target_property_id,
    'community_id', target_community_id,
    'updated_by', actor_profile_id,
    'before', jsonb_build_object(
      'account_number', property_record.account_number,
      'public_payment_code', property_record.public_payment_code,
      'status', property_record.status,
      'address_line1', property_record.address_line1,
      'address_line2', property_record.address_line2,
      'city', property_record.city,
      'state', property_record.state,
      'postal_code', property_record.postal_code,
      'county', property_record.county,
      'mailing_address', property_record.mailing_address,
      'owner_display_name', property_record.owner_display_name,
      'lot_number', property_record.lot_number,
      'parcel_number', property_record.parcel_number,
      'plat_reference', property_record.plat_reference,
      'next_due_date', property_record.next_due_date,
      'delinquency_status', property_record.delinquency_status
    )
  );
exception
  when unique_violation then
    return jsonb_build_object('status', 'account_conflict');
  when check_violation or invalid_text_representation then
    return jsonb_build_object('status', 'invalid');
end;
$$;

create or replace function public.archive_admin_property(
  target_property_id uuid,
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
  property_record public.properties%rowtype;
begin
  actor_profile_id := app.current_profile_id();

  select communities.id
  into target_community_id
  from public.communities
  where communities.slug = coalesce(nullif(btrim(target_community_slug), ''), 'spring-meadow-community')
    and communities.status = 'active';

  if target_community_id is null
    or actor_profile_id is null
    or not app.has_permission(target_community_id, 'admin.properties.manage')
  then
    return jsonb_build_object('status', 'permission_denied');
  end if;

  select *
  into property_record
  from public.properties
  where properties.id = target_property_id
    and properties.community_id = target_community_id
  for update;

  if property_record.id is null then
    return jsonb_build_object('status', 'property_unavailable');
  end if;

  update public.properties
  set
    status = 'archived',
    deleted_at = now(),
    updated_at = now()
  where properties.id = target_property_id
    and properties.community_id = target_community_id;

  return jsonb_build_object(
    'status', 'archived',
    'property_id', target_property_id,
    'community_id', target_community_id,
    'archived_by', actor_profile_id,
    'before', jsonb_build_object(
      'status', property_record.status,
      'deleted_at', property_record.deleted_at,
      'account_number', property_record.account_number,
      'public_payment_code', property_record.public_payment_code
    )
  );
end;
$$;

revoke all on function public.list_admin_properties(
  text,
  boolean,
  text,
  text,
  integer,
  integer
) from public, anon;

revoke all on function public.create_admin_property(
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  jsonb,
  text,
  text,
  text,
  text,
  date,
  text
) from public, anon;

revoke all on function public.update_admin_property(
  uuid,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  jsonb,
  text,
  text,
  text,
  text,
  date,
  text
) from public, anon;

revoke all on function public.archive_admin_property(
  uuid,
  text
) from public, anon;

revoke all on function app.admin_property_mailing_address_is_valid(jsonb) from public, anon, authenticated;

grant execute on function public.list_admin_properties(
  text,
  boolean,
  text,
  text,
  integer,
  integer
) to authenticated;

grant execute on function public.create_admin_property(
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  jsonb,
  text,
  text,
  text,
  text,
  date,
  text
) to authenticated;

grant execute on function public.update_admin_property(
  uuid,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  jsonb,
  text,
  text,
  text,
  text,
  date,
  text
) to authenticated;

grant execute on function public.archive_admin_property(
  uuid,
  text
) to authenticated;
