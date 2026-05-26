do $$
begin
  create type event_visibility as enum (
    'public',
    'resident',
    'board',
    'admin'
  );
exception
  when duplicate_object then null;
end;
$$;

do $$
begin
  create type event_status as enum (
    'scheduled',
    'cancelled',
    'completed',
    'archived'
  );
exception
  when duplicate_object then null;
end;
$$;

do $$
begin
  create type event_type as enum (
    'hoa_meeting',
    'board_meeting',
    'community_event',
    'pool',
    'maintenance_window',
    'dues_deadline',
    'other'
  );
exception
  when duplicate_object then null;
end;
$$;

update public.roles
set
  permissions = case
    when 'admin.events.manage' = any(permissions) then permissions
    else permissions || array['admin.events.manage']::text[]
  end,
  updated_at = now()
where key in ('admin', 'board_member');

create table if not exists public.events (
  id uuid primary key default gen_random_uuid(),
  community_id uuid not null references public.communities(id) on delete cascade,
  title text not null,
  description text,
  type event_type not null,
  visibility event_visibility not null,
  starts_at timestamptz not null,
  ends_at timestamptz,
  all_day boolean not null default false,
  location text,
  related_meeting_id uuid,
  related_compliance_event_id uuid,
  status event_status not null default 'scheduled',
  created_by uuid not null references public.profiles(id),
  updated_by uuid references public.profiles(id),
  cancelled_by uuid references public.profiles(id),
  cancelled_at timestamptz,
  archived_by uuid references public.profiles(id),
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint events_title_check check (
    btrim(title) <> ''
    and length(btrim(title)) <= 200
  ),
  constraint events_description_check check (
    description is null
    or length(btrim(description)) <= 5000
  ),
  constraint events_location_check check (
    location is null
    or length(btrim(location)) <= 300
  ),
  constraint events_date_range_check check (
    ends_at is null
    or ends_at > starts_at
  )
);

create index if not exists events_calendar_idx
  on public.events(community_id, visibility, starts_at);

create index if not exists events_type_idx
  on public.events(community_id, type, starts_at);

create index if not exists events_status_idx
  on public.events(community_id, status, starts_at);

create index if not exists events_search_idx
  on public.events(community_id, starts_at, id);

alter table public.events enable row level security;
revoke all on public.events from anon, authenticated;

create or replace function public.set_events_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_events_updated_at on public.events;
create trigger set_events_updated_at
  before update on public.events
  for each row
  execute function public.set_events_updated_at();

create or replace function app.can_read_event(target_event_id uuid)
returns boolean
language plpgsql
stable
security definer
set search_path = public, app
as $$
declare
  actor_profile_id uuid;
  event_record public.events%rowtype;
begin
  select *
  into event_record
  from public.events
  where id = target_event_id;

  if not found then
    return false;
  end if;

  if app.has_permission(event_record.community_id, 'admin.events.manage') then
    return true;
  end if;

  if event_record.status = 'archived'::event_status then
    return false;
  end if;

  if event_record.visibility = 'public'::event_visibility then
    return true;
  end if;

  actor_profile_id := app.current_profile_id();

  if actor_profile_id is null then
    return false;
  end if;

  if event_record.visibility = 'resident'::event_visibility then
    return exists (
      select 1
      from public.property_memberships pm
      join public.properties on properties.id = pm.property_id
      where pm.community_id = event_record.community_id
        and pm.profile_id = actor_profile_id
        and pm.status = 'active'
        and properties.community_id = event_record.community_id
        and properties.status = 'active'
        and properties.deleted_at is null
    );
  end if;

  return false;
end;
$$;

drop policy if exists "read authorized events" on public.events;
create policy "read authorized events"
  on public.events
  for select
  to authenticated
  using (app.can_read_event(id));

create or replace function app.event_json(event_record public.events)
returns jsonb
language sql
stable
security definer
set search_path = public, app
as $$
  select jsonb_build_object(
    'id', ($1).id,
    'community_id', ($1).community_id,
    'title', ($1).title,
    'description', ($1).description,
    'type', ($1).type,
    'visibility', ($1).visibility,
    'starts_at', ($1).starts_at,
    'ends_at', ($1).ends_at,
    'all_day', ($1).all_day,
    'location', ($1).location,
    'related_meeting_id', case
      when app.has_permission(($1).community_id, 'admin.events.manage') then ($1).related_meeting_id
      else null
    end,
    'related_compliance_event_id', case
      when app.has_permission(($1).community_id, 'admin.events.manage') then ($1).related_compliance_event_id
      else null
    end,
    'status', ($1).status,
    'created_at', ($1).created_at,
    'updated_at', ($1).updated_at
  );
$$;

create or replace function app.resolve_event_community(target_community_slug text)
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select id
  from public.communities
  where slug = coalesce(nullif(btrim(target_community_slug), ''), 'spring-meadow-community')
  limit 1;
$$;

create or replace function public.list_events(
  target_community_slug text default 'spring-meadow-community',
  filter_visibility text default null,
  filter_status text default null,
  filter_type text default null,
  filter_query text default null,
  starts_from timestamptz default null,
  starts_to timestamptz default null,
  include_archived boolean default false,
  upcoming_only boolean default false,
  page_limit integer default 50,
  page_offset integer default 0
)
returns jsonb
language plpgsql
security definer
set search_path = public, app
as $$
declare
  target_community_id uuid;
  bounded_limit integer;
  bounded_offset integer;
  filter_visibility_value event_visibility;
  filter_status_value event_status;
  filter_type_value event_type;
  manager_can_list boolean;
  records jsonb;
begin
  target_community_id := app.resolve_event_community(target_community_slug);

  if target_community_id is null then
    return jsonb_build_object('status', 'unavailable');
  end if;

  bounded_limit := least(greatest(coalesce(page_limit, 50), 1), 100);
  bounded_offset := least(greatest(coalesce(page_offset, 0), 0), 10000);

  if nullif(btrim(coalesce(filter_visibility, '')), '') is not null then
    begin
      filter_visibility_value := filter_visibility::event_visibility;
    exception
      when invalid_text_representation then
        return jsonb_build_object('status', 'invalid');
    end;
  end if;

  if nullif(btrim(coalesce(filter_status, '')), '') is not null then
    begin
      filter_status_value := filter_status::event_status;
    exception
      when invalid_text_representation then
        return jsonb_build_object('status', 'invalid');
    end;
  end if;

  if nullif(btrim(coalesce(filter_type, '')), '') is not null then
    begin
      filter_type_value := filter_type::event_type;
    exception
      when invalid_text_representation then
        return jsonb_build_object('status', 'invalid');
    end;
  end if;

  manager_can_list := app.has_permission(target_community_id, 'admin.events.manage');

  with filtered_events as (
    select events.*
    from public.events
    where events.community_id = target_community_id
      and (
        filter_visibility_value is null
        or events.visibility = filter_visibility_value
      )
      and (
        filter_status_value is null
        or events.status = filter_status_value
      )
      and (
        filter_type_value is null
        or events.type = filter_type_value
      )
      and (
        filter_query is null
        or btrim(filter_query) = ''
        or events.title ilike '%' || replace(replace(btrim(filter_query), '%', chr(92) || '%'), '_', chr(92) || '_') || '%' escape chr(92)
        or coalesce(events.description, '') ilike '%' || replace(replace(btrim(filter_query), '%', chr(92) || '%'), '_', chr(92) || '_') || '%' escape chr(92)
        or coalesce(events.location, '') ilike '%' || replace(replace(btrim(filter_query), '%', chr(92) || '%'), '_', chr(92) || '_') || '%' escape chr(92)
      )
      and (
        starts_from is null
        or coalesce(events.ends_at, events.starts_at) >= starts_from
      )
      and (
        starts_to is null
        or events.starts_at <= starts_to
      )
      and (
        upcoming_only is not true
        or coalesce(events.ends_at, events.starts_at) >= now()
      )
      and (
        include_archived is true
        or events.status <> 'archived'::event_status
      )
      and (
        manager_can_list = true
        or app.can_read_event(events.id)
      )
    order by
      (coalesce(events.ends_at, events.starts_at) < now()) asc,
      case when coalesce(events.ends_at, events.starts_at) >= now() then events.starts_at end asc,
      case when coalesce(events.ends_at, events.starts_at) < now() then events.starts_at end desc,
      events.id asc
    limit bounded_limit
    offset bounded_offset
  )
  select coalesce(
    jsonb_agg(
      app.event_json(filtered_events)
      order by
        (coalesce(filtered_events.ends_at, filtered_events.starts_at) < now()) asc,
        case when coalesce(filtered_events.ends_at, filtered_events.starts_at) >= now() then filtered_events.starts_at end asc,
        case when coalesce(filtered_events.ends_at, filtered_events.starts_at) < now() then filtered_events.starts_at end desc,
        filtered_events.id asc
    ),
    '[]'::jsonb
  )
  into records
  from filtered_events;

  return jsonb_build_object('status', 'ok', 'records', records);
end;
$$;

create or replace function public.create_event(
  target_community_slug text,
  event_title text,
  event_description text,
  event_type_value text,
  event_visibility_value text,
  event_starts_at timestamptz,
  event_ends_at timestamptz default null,
  event_all_day boolean default false,
  event_location text default null,
  event_related_meeting_id uuid default null,
  event_related_compliance_event_id uuid default null,
  event_status_value text default 'scheduled'
)
returns jsonb
language plpgsql
security definer
set search_path = public, app
as $$
declare
  actor_profile_id uuid;
  target_community_id uuid;
  type_value event_type;
  visibility_value event_visibility;
  status_value event_status;
  created_event public.events%rowtype;
begin
  actor_profile_id := app.current_profile_id();
  target_community_id := app.resolve_event_community(target_community_slug);

  if actor_profile_id is null
    or target_community_id is null
    or not app.has_permission(target_community_id, 'admin.events.manage')
  then
    return jsonb_build_object('status', 'permission_denied');
  end if;

  begin
    type_value := event_type_value::event_type;
    visibility_value := event_visibility_value::event_visibility;
    status_value := event_status_value::event_status;
  exception
    when invalid_text_representation then
      return jsonb_build_object('status', 'invalid');
  end;

  event_title := btrim(coalesce(event_title, ''));
  event_description := nullif(btrim(coalesce(event_description, '')), '');
  event_location := nullif(btrim(coalesce(event_location, '')), '');

  if event_title = ''
    or length(event_title) > 200
    or (
      event_description is not null
      and length(event_description) > 5000
    )
    or (
      event_location is not null
      and length(event_location) > 300
    )
    or event_starts_at is null
    or (
      event_ends_at is not null
      and event_ends_at <= event_starts_at
    )
  then
    return jsonb_build_object('status', 'invalid');
  end if;

  insert into public.events (
    community_id,
    title,
    description,
    type,
    visibility,
    starts_at,
    ends_at,
    all_day,
    location,
    related_meeting_id,
    related_compliance_event_id,
    status,
    created_by,
    updated_by,
    cancelled_by,
    cancelled_at,
    archived_by,
    archived_at
  )
  values (
    target_community_id,
    event_title,
    event_description,
    type_value,
    visibility_value,
    event_starts_at,
    event_ends_at,
    coalesce(event_all_day, false),
    event_location,
    event_related_meeting_id,
    event_related_compliance_event_id,
    status_value,
    actor_profile_id,
    actor_profile_id,
    case when status_value = 'cancelled'::event_status then actor_profile_id else null end,
    case when status_value = 'cancelled'::event_status then now() else null end,
    case when status_value = 'archived'::event_status then actor_profile_id else null end,
    case when status_value = 'archived'::event_status then now() else null end
  )
  returning *
  into created_event;

  begin
    insert into public.audit_logs (
      community_id,
      actor_profile_id,
      actor_type,
      action,
      target_table,
      target_id,
      after_data
    )
    values (
      target_community_id,
      actor_profile_id,
      'user',
      'event.create',
      'events',
      created_event.id,
      app.event_json(created_event)
    );
  exception
    when others then null;
  end;

  return jsonb_build_object('status', 'created', 'record', app.event_json(created_event));
end;
$$;

create or replace function public.update_event(
  target_event_id uuid,
  event_title text,
  event_description text,
  event_type_value text,
  event_visibility_value text,
  event_starts_at timestamptz,
  event_ends_at timestamptz default null,
  event_all_day boolean default false,
  event_location text default null,
  event_related_meeting_id uuid default null,
  event_related_compliance_event_id uuid default null,
  event_status_value text default 'scheduled'
)
returns jsonb
language plpgsql
security definer
set search_path = public, app
as $$
declare
  actor_profile_id uuid;
  type_value event_type;
  visibility_value event_visibility;
  status_value event_status;
  existing_event public.events%rowtype;
  updated_event public.events%rowtype;
begin
  actor_profile_id := app.current_profile_id();

  select *
  into existing_event
  from public.events
  where id = target_event_id;

  if actor_profile_id is null
    or not found
    or not app.has_permission(existing_event.community_id, 'admin.events.manage')
  then
    return jsonb_build_object('status', 'permission_denied');
  end if;

  begin
    type_value := event_type_value::event_type;
    visibility_value := event_visibility_value::event_visibility;
    status_value := event_status_value::event_status;
  exception
    when invalid_text_representation then
      return jsonb_build_object('status', 'invalid');
  end;

  event_title := btrim(coalesce(event_title, ''));
  event_description := nullif(btrim(coalesce(event_description, '')), '');
  event_location := nullif(btrim(coalesce(event_location, '')), '');

  if event_title = ''
    or length(event_title) > 200
    or (
      event_description is not null
      and length(event_description) > 5000
    )
    or (
      event_location is not null
      and length(event_location) > 300
    )
    or event_starts_at is null
    or (
      event_ends_at is not null
      and event_ends_at <= event_starts_at
    )
  then
    return jsonb_build_object('status', 'invalid');
  end if;

  update public.events
  set
    title = event_title,
    description = event_description,
    type = type_value,
    visibility = visibility_value,
    starts_at = event_starts_at,
    ends_at = event_ends_at,
    all_day = coalesce(event_all_day, false),
    location = event_location,
    related_meeting_id = event_related_meeting_id,
    related_compliance_event_id = event_related_compliance_event_id,
    status = status_value,
    updated_by = actor_profile_id,
    cancelled_by = case when status_value = 'cancelled'::event_status then actor_profile_id else cancelled_by end,
    cancelled_at = case when status_value = 'cancelled'::event_status then coalesce(cancelled_at, now()) else cancelled_at end,
    archived_by = case when status_value = 'archived'::event_status then actor_profile_id else archived_by end,
    archived_at = case when status_value = 'archived'::event_status then coalesce(archived_at, now()) else archived_at end
  where id = target_event_id
  returning *
  into updated_event;

  begin
    insert into public.audit_logs (
      community_id,
      actor_profile_id,
      actor_type,
      action,
      target_table,
      target_id,
      before_data,
      after_data
    )
    values (
      updated_event.community_id,
      actor_profile_id,
      'user',
      'event.update',
      'events',
      updated_event.id,
      app.event_json(existing_event),
      app.event_json(updated_event)
    );
  exception
    when others then null;
  end;

  return jsonb_build_object(
    'status', 'updated',
    'record', app.event_json(updated_event),
    'before_record', app.event_json(existing_event)
  );
end;
$$;

create or replace function public.set_event_lifecycle_status(
  target_event_id uuid,
  next_status event_status,
  audit_action text
)
returns jsonb
language plpgsql
security definer
set search_path = public, app
as $$
declare
  actor_profile_id uuid;
  existing_event public.events%rowtype;
  updated_event public.events%rowtype;
begin
  actor_profile_id := app.current_profile_id();

  select *
  into existing_event
  from public.events
  where id = target_event_id;

  if actor_profile_id is null
    or not found
    or not app.has_permission(existing_event.community_id, 'admin.events.manage')
  then
    return jsonb_build_object('status', 'permission_denied');
  end if;

  update public.events
  set
    status = next_status,
    updated_by = actor_profile_id,
    cancelled_by = case when next_status = 'cancelled'::event_status then actor_profile_id else cancelled_by end,
    cancelled_at = case when next_status = 'cancelled'::event_status then coalesce(cancelled_at, now()) else cancelled_at end,
    archived_by = case when next_status = 'archived'::event_status then actor_profile_id else archived_by end,
    archived_at = case when next_status = 'archived'::event_status then coalesce(archived_at, now()) else archived_at end
  where id = target_event_id
  returning *
  into updated_event;

  begin
    insert into public.audit_logs (
      community_id,
      actor_profile_id,
      actor_type,
      action,
      target_table,
      target_id,
      before_data,
      after_data
    )
    values (
      updated_event.community_id,
      actor_profile_id,
      'user',
      audit_action,
      'events',
      updated_event.id,
      app.event_json(existing_event),
      app.event_json(updated_event)
    );
  exception
    when others then null;
  end;

  return jsonb_build_object(
    'status', next_status::text,
    'record', app.event_json(updated_event),
    'before_record', app.event_json(existing_event)
  );
end;
$$;

create or replace function public.cancel_event(target_event_id uuid)
returns jsonb
language sql
security definer
set search_path = public, app
as $$
  select public.set_event_lifecycle_status(
    target_event_id,
    'cancelled'::event_status,
    'event.cancel'
  );
$$;

create or replace function public.archive_event(target_event_id uuid)
returns jsonb
language sql
security definer
set search_path = public, app
as $$
  select public.set_event_lifecycle_status(
    target_event_id,
    'archived'::event_status,
    'event.archive'
  );
$$;

revoke all on function public.set_events_updated_at() from public, anon, authenticated;
revoke all on function app.can_read_event(uuid) from public, anon, authenticated;
revoke all on function app.event_json(public.events) from public, anon, authenticated;
revoke all on function app.resolve_event_community(text) from public, anon, authenticated;
revoke all on function public.set_event_lifecycle_status(uuid, event_status, text) from public, anon, authenticated;

revoke all on function public.list_events(text, text, text, text, text, timestamptz, timestamptz, boolean, boolean, integer, integer) from public, anon, authenticated;
revoke all on function public.create_event(text, text, text, text, text, timestamptz, timestamptz, boolean, text, uuid, uuid, text) from public, anon, authenticated;
revoke all on function public.update_event(uuid, text, text, text, text, timestamptz, timestamptz, boolean, text, uuid, uuid, text) from public, anon, authenticated;
revoke all on function public.cancel_event(uuid) from public, anon, authenticated;
revoke all on function public.archive_event(uuid) from public, anon, authenticated;

grant execute on function public.list_events(text, text, text, text, text, timestamptz, timestamptz, boolean, boolean, integer, integer) to anon, authenticated;
grant execute on function public.create_event(text, text, text, text, text, timestamptz, timestamptz, boolean, text, uuid, uuid, text) to authenticated;
grant execute on function public.update_event(uuid, text, text, text, text, timestamptz, timestamptz, boolean, text, uuid, uuid, text) to authenticated;
grant execute on function public.cancel_event(uuid) to authenticated;
grant execute on function public.archive_event(uuid) to authenticated;
