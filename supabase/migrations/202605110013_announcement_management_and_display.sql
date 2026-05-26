do $$
begin
  create type announcement_visibility as enum (
    'public',
    'resident',
    'board',
    'property_specific',
    'admin'
  );
exception
  when duplicate_object then null;
end;
$$;

do $$
begin
  create type announcement_status as enum (
    'draft',
    'published',
    'expired',
    'archived'
  );
exception
  when duplicate_object then null;
end;
$$;

update public.roles
set
  permissions = case
    when 'admin.announcements.manage' = any(permissions) then permissions
    else permissions || array['admin.announcements.manage']::text[]
  end,
  updated_at = now()
where key in ('admin', 'board_member');

create table if not exists public.announcements (
  id uuid primary key default gen_random_uuid(),
  community_id uuid not null references public.communities(id) on delete cascade,
  title text not null,
  body text not null,
  visibility announcement_visibility not null,
  property_ids uuid[] not null default '{}',
  status announcement_status not null default 'draft',
  pinned boolean not null default false,
  publish_at timestamptz not null default now(),
  expires_at timestamptz,
  attachment_document_ids uuid[] not null default '{}',
  created_by uuid not null references public.profiles(id),
  updated_by uuid references public.profiles(id),
  archived_by uuid references public.profiles(id),
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint announcements_title_check check (
    btrim(title) <> ''
    and length(btrim(title)) <= 200
  ),
  constraint announcements_body_check check (
    btrim(body) <> ''
    and length(btrim(body)) <= 5000
  ),
  constraint announcements_date_range_check check (
    expires_at is null
    or expires_at > publish_at
  ),
  constraint announcements_property_specific_check check (
    visibility <> 'property_specific'::announcement_visibility
    or cardinality(property_ids) > 0
  )
);

create index if not exists announcements_feed_idx
  on public.announcements(community_id, status, visibility, publish_at desc);

create index if not exists announcements_pinned_idx
  on public.announcements(community_id, pinned, publish_at desc);

create index if not exists announcements_property_gin_idx
  on public.announcements using gin(property_ids);

create index if not exists announcements_attachment_gin_idx
  on public.announcements using gin(attachment_document_ids);

alter table public.announcements enable row level security;
revoke all on public.announcements from anon, authenticated;

create or replace function public.set_announcements_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_announcements_updated_at on public.announcements;
create trigger set_announcements_updated_at
  before update on public.announcements
  for each row
  execute function public.set_announcements_updated_at();

create or replace function app.can_read_announcement(target_announcement_id uuid)
returns boolean
language plpgsql
stable
security definer
set search_path = public, app
as $$
declare
  actor_profile_id uuid;
  announcement_record public.announcements%rowtype;
begin
  select *
  into announcement_record
  from public.announcements
  where id = target_announcement_id;

  if not found then
    return false;
  end if;

  if app.has_permission(announcement_record.community_id, 'admin.announcements.manage') then
    return true;
  end if;

  if announcement_record.status <> 'published'::announcement_status
    or announcement_record.publish_at > now()
    or (
      announcement_record.expires_at is not null
      and announcement_record.expires_at <= now()
    )
  then
    return false;
  end if;

  if announcement_record.visibility = 'public'::announcement_visibility then
    return true;
  end if;

  actor_profile_id := app.current_profile_id();

  if actor_profile_id is null then
    return false;
  end if;

  if announcement_record.visibility = 'resident'::announcement_visibility then
    return exists (
      select 1
      from public.property_memberships pm
      join public.properties on properties.id = pm.property_id
      where pm.community_id = announcement_record.community_id
        and pm.profile_id = actor_profile_id
        and pm.status = 'active'
        and properties.community_id = announcement_record.community_id
        and properties.status = 'active'
        and properties.deleted_at is null
    );
  end if;

  if announcement_record.visibility = 'property_specific'::announcement_visibility then
    return exists (
      select 1
      from public.property_memberships pm
      join public.properties on properties.id = pm.property_id
      where pm.community_id = announcement_record.community_id
        and pm.property_id = any(announcement_record.property_ids)
        and pm.profile_id = actor_profile_id
        and pm.status = 'active'
        and properties.community_id = announcement_record.community_id
        and properties.status = 'active'
        and properties.deleted_at is null
    );
  end if;

  return false;
end;
$$;

drop policy if exists "read authorized announcements" on public.announcements;
create policy "read authorized announcements"
  on public.announcements
  for select
  to authenticated
  using (app.can_read_announcement(id));

create or replace function app.announcement_attachments_json(
  announcement_record public.announcements
)
returns jsonb
language sql
stable
security definer
set search_path = public, app
as $$
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'document_id', documents.id,
        'title', documents.title,
        'category', documents.category,
        'content_type', documents.content_type,
        'size_bytes', documents.size_bytes
      )
      order by documents.title asc, documents.id asc
    ),
    '[]'::jsonb
  )
  from public.documents
  where documents.community_id = announcement_record.community_id
    and documents.id = any(announcement_record.attachment_document_ids)
    and app.can_read_document(documents.id);
$$;

create or replace function app.announcement_json(
  announcement_record public.announcements
)
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
    'body', ($1).body,
    'visibility', ($1).visibility,
    'property_ids', case
      when app.has_permission(($1).community_id, 'admin.announcements.manage') then ($1).property_ids
      else '{}'::uuid[]
    end,
    'status', ($1).status,
    'pinned', ($1).pinned,
    'publish_at', ($1).publish_at,
    'expires_at', ($1).expires_at,
    'attachments', app.announcement_attachments_json($1),
    'created_at', ($1).created_at,
    'updated_at', ($1).updated_at
  );
$$;

create or replace function app.resolve_announcement_community(target_community_slug text)
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

create or replace function app.announcement_targets_are_valid(
  target_community_id uuid,
  target_property_ids uuid[]
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select not exists (
    select 1
    from unnest(coalesce(target_property_ids, '{}'::uuid[])) as property_id
    left join public.properties properties
      on properties.id = property_id
      and properties.community_id = target_community_id
      and properties.status = 'active'
      and properties.deleted_at is null
    where properties.id is null
  );
$$;

create or replace function app.announcement_attachments_are_valid(
  target_community_id uuid,
  target_attachment_document_ids uuid[]
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select not exists (
    select 1
    from unnest(coalesce(target_attachment_document_ids, '{}'::uuid[])) as document_id
    left join public.documents documents
      on documents.id = document_id
      and documents.community_id = target_community_id
      and documents.deleted_at is null
    where documents.id is null
  );
$$;

create or replace function public.list_announcements(
  target_community_slug text default 'spring-meadow-community',
  filter_visibility text default null,
  filter_status text default null,
  filter_query text default null,
  filter_property_id uuid default null,
  current_only boolean default true,
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
  filter_visibility_value announcement_visibility;
  filter_status_value announcement_status;
  actor_profile_id uuid;
  manager_can_list boolean;
  records jsonb;
begin
  target_community_id := app.resolve_announcement_community(target_community_slug);

  if target_community_id is null then
    return jsonb_build_object('status', 'unavailable');
  end if;

  bounded_limit := least(greatest(coalesce(page_limit, 50), 1), 100);
  bounded_offset := least(greatest(coalesce(page_offset, 0), 0), 10000);

  if nullif(btrim(coalesce(filter_visibility, '')), '') is not null then
    begin
      filter_visibility_value := filter_visibility::announcement_visibility;
    exception
      when invalid_text_representation then
        return jsonb_build_object('status', 'invalid');
    end;
  end if;

  if nullif(btrim(coalesce(filter_status, '')), '') is not null then
    begin
      filter_status_value := filter_status::announcement_status;
    exception
      when invalid_text_representation then
        return jsonb_build_object('status', 'invalid');
    end;
  end if;

  actor_profile_id := app.current_profile_id();
  manager_can_list := app.has_permission(target_community_id, 'admin.announcements.manage');

  with filtered_announcements as (
    select announcements.*
    from public.announcements
    where announcements.community_id = target_community_id
      and (
        filter_visibility_value is null
        or announcements.visibility = filter_visibility_value
      )
      and (
        filter_status_value is null
        or announcements.status = filter_status_value
      )
      and (
        filter_property_id is null
        or (
          filter_property_id = any(announcements.property_ids)
          and (
            manager_can_list = true
            or exists (
              select 1
              from public.property_memberships pm
              join public.properties on properties.id = pm.property_id
              where pm.community_id = target_community_id
                and pm.property_id = filter_property_id
                and pm.profile_id = actor_profile_id
                and pm.status = 'active'
                and properties.community_id = target_community_id
                and properties.status = 'active'
                and properties.deleted_at is null
            )
          )
        )
      )
      and (
        filter_query is null
        or btrim(filter_query) = ''
        or announcements.title ilike '%' || replace(replace(btrim(filter_query), '%', chr(92) || '%'), '_', chr(92) || '_') || '%' escape chr(92)
        or announcements.body ilike '%' || replace(replace(btrim(filter_query), '%', chr(92) || '%'), '_', chr(92) || '_') || '%' escape chr(92)
      )
      and (
        current_only is not true
        or (
          announcements.status = 'published'::announcement_status
          and announcements.publish_at <= now()
          and (
            announcements.expires_at is null
            or announcements.expires_at > now()
          )
        )
      )
      and (
        manager_can_list = true
        or app.can_read_announcement(announcements.id)
      )
    order by announcements.pinned desc, announcements.publish_at desc, announcements.created_at desc, announcements.id asc
    limit bounded_limit
    offset bounded_offset
  )
  select coalesce(
    jsonb_agg(
      app.announcement_json(filtered_announcements)
      order by filtered_announcements.pinned desc, filtered_announcements.publish_at desc, filtered_announcements.created_at desc, filtered_announcements.id asc
    ),
    '[]'::jsonb
  )
  into records
  from filtered_announcements;

  return jsonb_build_object('status', 'ok', 'records', records);
end;
$$;

create or replace function public.create_announcement(
  target_community_slug text,
  announcement_title text,
  announcement_body text,
  announcement_visibility_value text,
  announcement_property_ids uuid[] default '{}',
  announcement_status_value text default 'draft',
  announcement_pinned boolean default false,
  announcement_publish_at timestamptz default now(),
  announcement_expires_at timestamptz default null,
  announcement_attachment_document_ids uuid[] default '{}'
)
returns jsonb
language plpgsql
security definer
set search_path = public, app
as $$
declare
  actor_profile_id uuid;
  target_community_id uuid;
  visibility_value announcement_visibility;
  status_value announcement_status;
  effective_publish_at timestamptz;
  created_announcement public.announcements%rowtype;
begin
  actor_profile_id := app.current_profile_id();
  target_community_id := app.resolve_announcement_community(target_community_slug);

  if actor_profile_id is null
    or target_community_id is null
    or not app.has_permission(target_community_id, 'admin.announcements.manage')
  then
    return jsonb_build_object('status', 'permission_denied');
  end if;

  begin
    visibility_value := announcement_visibility_value::announcement_visibility;
    status_value := announcement_status_value::announcement_status;
  exception
    when invalid_text_representation then
      return jsonb_build_object('status', 'invalid');
  end;

  announcement_title := btrim(coalesce(announcement_title, ''));
  announcement_body := btrim(coalesce(announcement_body, ''));
  announcement_property_ids := coalesce(announcement_property_ids, '{}'::uuid[]);
  announcement_attachment_document_ids := coalesce(announcement_attachment_document_ids, '{}'::uuid[]);
  effective_publish_at := coalesce(announcement_publish_at, now());

  if announcement_title = ''
    or length(announcement_title) > 200
    or announcement_body = ''
    or length(announcement_body) > 5000
    or (
      visibility_value = 'property_specific'::announcement_visibility
      and cardinality(announcement_property_ids) = 0
    )
    or (
      announcement_expires_at is not null
      and announcement_expires_at <= effective_publish_at
    )
    or not app.announcement_targets_are_valid(target_community_id, announcement_property_ids)
    or not app.announcement_attachments_are_valid(target_community_id, announcement_attachment_document_ids)
  then
    return jsonb_build_object('status', 'invalid');
  end if;

  insert into public.announcements (
    community_id,
    title,
    body,
    visibility,
    property_ids,
    status,
    pinned,
    publish_at,
    expires_at,
    attachment_document_ids,
    created_by,
    updated_by
  )
  values (
    target_community_id,
    announcement_title,
    announcement_body,
    visibility_value,
    announcement_property_ids,
    status_value,
    coalesce(announcement_pinned, false),
    effective_publish_at,
    announcement_expires_at,
    announcement_attachment_document_ids,
    actor_profile_id,
    actor_profile_id
  )
  returning *
  into created_announcement;

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
      'announcement.create',
      'announcements',
      created_announcement.id,
      app.announcement_json(created_announcement)
    );
  exception
    when others then null;
  end;

  return jsonb_build_object('status', 'created', 'record', app.announcement_json(created_announcement));
end;
$$;

create or replace function public.update_announcement(
  target_announcement_id uuid,
  announcement_title text,
  announcement_body text,
  announcement_visibility_value text,
  announcement_property_ids uuid[] default '{}',
  announcement_status_value text default 'draft',
  announcement_pinned boolean default false,
  announcement_publish_at timestamptz default now(),
  announcement_expires_at timestamptz default null,
  announcement_attachment_document_ids uuid[] default '{}'
)
returns jsonb
language plpgsql
security definer
set search_path = public, app
as $$
declare
  actor_profile_id uuid;
  visibility_value announcement_visibility;
  status_value announcement_status;
  effective_publish_at timestamptz;
  existing_announcement public.announcements%rowtype;
  updated_announcement public.announcements%rowtype;
begin
  actor_profile_id := app.current_profile_id();

  select *
  into existing_announcement
  from public.announcements
  where id = target_announcement_id;

  if actor_profile_id is null
    or not found
    or not app.has_permission(existing_announcement.community_id, 'admin.announcements.manage')
  then
    return jsonb_build_object('status', 'permission_denied');
  end if;

  begin
    visibility_value := announcement_visibility_value::announcement_visibility;
    status_value := announcement_status_value::announcement_status;
  exception
    when invalid_text_representation then
      return jsonb_build_object('status', 'invalid');
  end;

  announcement_title := btrim(coalesce(announcement_title, ''));
  announcement_body := btrim(coalesce(announcement_body, ''));
  announcement_property_ids := coalesce(announcement_property_ids, '{}'::uuid[]);
  announcement_attachment_document_ids := coalesce(announcement_attachment_document_ids, '{}'::uuid[]);
  effective_publish_at := coalesce(announcement_publish_at, now());

  if announcement_title = ''
    or length(announcement_title) > 200
    or announcement_body = ''
    or length(announcement_body) > 5000
    or (
      visibility_value = 'property_specific'::announcement_visibility
      and cardinality(announcement_property_ids) = 0
    )
    or (
      announcement_expires_at is not null
      and announcement_expires_at <= effective_publish_at
    )
    or not app.announcement_targets_are_valid(existing_announcement.community_id, announcement_property_ids)
    or not app.announcement_attachments_are_valid(existing_announcement.community_id, announcement_attachment_document_ids)
  then
    return jsonb_build_object('status', 'invalid');
  end if;

  update public.announcements
  set
    title = announcement_title,
    body = announcement_body,
    visibility = visibility_value,
    property_ids = announcement_property_ids,
    status = status_value,
    pinned = coalesce(announcement_pinned, false),
    publish_at = effective_publish_at,
    expires_at = announcement_expires_at,
    attachment_document_ids = announcement_attachment_document_ids,
    updated_by = actor_profile_id,
    archived_by = case when status_value = 'archived'::announcement_status then actor_profile_id else archived_by end,
    archived_at = case when status_value = 'archived'::announcement_status then coalesce(archived_at, now()) else archived_at end
  where id = target_announcement_id
  returning *
  into updated_announcement;

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
      updated_announcement.community_id,
      actor_profile_id,
      'user',
      'announcement.update',
      'announcements',
      updated_announcement.id,
      app.announcement_json(existing_announcement),
      app.announcement_json(updated_announcement)
    );
  exception
    when others then null;
  end;

  return jsonb_build_object(
    'status', 'updated',
    'record', app.announcement_json(updated_announcement),
    'before_record', app.announcement_json(existing_announcement)
  );
end;
$$;

create or replace function public.set_announcement_lifecycle_status(
  target_announcement_id uuid,
  next_status announcement_status,
  audit_action text
)
returns jsonb
language plpgsql
security definer
set search_path = public, app
as $$
declare
  actor_profile_id uuid;
  existing_announcement public.announcements%rowtype;
  updated_announcement public.announcements%rowtype;
begin
  actor_profile_id := app.current_profile_id();

  select *
  into existing_announcement
  from public.announcements
  where id = target_announcement_id;

  if actor_profile_id is null
    or not found
    or not app.has_permission(existing_announcement.community_id, 'admin.announcements.manage')
  then
    return jsonb_build_object('status', 'permission_denied');
  end if;

  update public.announcements
  set
    status = next_status,
    updated_by = actor_profile_id,
    archived_by = case when next_status = 'archived'::announcement_status then actor_profile_id else archived_by end,
    archived_at = case when next_status = 'archived'::announcement_status then coalesce(archived_at, now()) else archived_at end
  where id = target_announcement_id
  returning *
  into updated_announcement;

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
      updated_announcement.community_id,
      actor_profile_id,
      'user',
      audit_action,
      'announcements',
      updated_announcement.id,
      app.announcement_json(existing_announcement),
      app.announcement_json(updated_announcement)
    );
  exception
    when others then null;
  end;

  return jsonb_build_object(
    'status', next_status::text,
    'record', app.announcement_json(updated_announcement),
    'before_record', app.announcement_json(existing_announcement)
  );
end;
$$;

create or replace function public.publish_announcement(target_announcement_id uuid)
returns jsonb
language sql
security definer
set search_path = public, app
as $$
  select public.set_announcement_lifecycle_status(
    target_announcement_id,
    'published'::announcement_status,
    'announcement.publish'
  );
$$;

create or replace function public.expire_announcement(target_announcement_id uuid)
returns jsonb
language sql
security definer
set search_path = public, app
as $$
  select public.set_announcement_lifecycle_status(
    target_announcement_id,
    'expired'::announcement_status,
    'announcement.expire'
  );
$$;

create or replace function public.archive_announcement(target_announcement_id uuid)
returns jsonb
language sql
security definer
set search_path = public, app
as $$
  select public.set_announcement_lifecycle_status(
    target_announcement_id,
    'archived'::announcement_status,
    'announcement.archive'
  );
$$;

revoke all on function public.set_announcements_updated_at() from public, anon, authenticated;
revoke all on function app.can_read_announcement(uuid) from public, anon, authenticated;
revoke all on function app.announcement_attachments_json(public.announcements) from public, anon, authenticated;
revoke all on function app.announcement_json(public.announcements) from public, anon, authenticated;
revoke all on function app.resolve_announcement_community(text) from public, anon, authenticated;
revoke all on function app.announcement_targets_are_valid(uuid, uuid[]) from public, anon, authenticated;
revoke all on function app.announcement_attachments_are_valid(uuid, uuid[]) from public, anon, authenticated;
revoke all on function public.set_announcement_lifecycle_status(uuid, announcement_status, text) from public, anon, authenticated;

revoke all on function public.list_announcements(text, text, text, text, uuid, boolean, integer, integer) from public, anon, authenticated;
revoke all on function public.create_announcement(text, text, text, text, uuid[], text, boolean, timestamptz, timestamptz, uuid[]) from public, anon, authenticated;
revoke all on function public.update_announcement(uuid, text, text, text, uuid[], text, boolean, timestamptz, timestamptz, uuid[]) from public, anon, authenticated;
revoke all on function public.publish_announcement(uuid) from public, anon, authenticated;
revoke all on function public.expire_announcement(uuid) from public, anon, authenticated;
revoke all on function public.archive_announcement(uuid) from public, anon, authenticated;

grant execute on function public.list_announcements(text, text, text, text, uuid, boolean, integer, integer) to anon, authenticated;
grant execute on function public.create_announcement(text, text, text, text, uuid[], text, boolean, timestamptz, timestamptz, uuid[]) to authenticated;
grant execute on function public.update_announcement(uuid, text, text, text, uuid[], text, boolean, timestamptz, timestamptz, uuid[]) to authenticated;
grant execute on function public.publish_announcement(uuid) to authenticated;
grant execute on function public.expire_announcement(uuid) to authenticated;
grant execute on function public.archive_announcement(uuid) to authenticated;
