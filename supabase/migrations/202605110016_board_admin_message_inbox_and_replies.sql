update public.roles
set
  permissions = case
    when 'admin.messages.manage' = any(permissions) then permissions
    else permissions || array['admin.messages.manage']::text[]
  end,
  updated_at = now()
where key in ('admin', 'board_member');

revoke all on public.message_threads from anon, authenticated;
revoke all on public.messages from anon, authenticated;

create or replace function app.can_manage_message_thread(target_community_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select app.has_permission(target_community_id, 'admin.messages.manage');
$$;

create or replace function app.can_read_message_thread(target_thread_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.message_threads thread_record
    join public.property_memberships pm on pm.property_id = thread_record.property_id
    join public.properties on properties.id = thread_record.property_id
    where thread_record.id = target_thread_id
      and thread_record.status <> 'archived'
      and pm.community_id = thread_record.community_id
      and pm.profile_id = app.current_profile_id()
      and pm.status = 'active'
      and properties.community_id = thread_record.community_id
      and properties.status = 'active'
      and properties.deleted_at is null
  )
  or exists (
    select 1
    from public.message_threads thread_record
    where thread_record.id = target_thread_id
      and app.can_manage_message_thread(thread_record.community_id)
  );
$$;

create or replace function app.message_profile_summary(target_profile_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select case
    when target_profile_id is null then null
    else coalesce(
      (
        select jsonb_build_object(
          'profile_id', profiles.id,
          'display_name', coalesce(nullif(profiles.display_name, ''), profiles.email, 'Unknown user')
        )
        from public.profiles
        where profiles.id = target_profile_id
          and profiles.deleted_at is null
        limit 1
      ),
      jsonb_build_object(
        'profile_id', target_profile_id,
        'display_name', 'Unknown user'
      )
    )
  end;
$$;

create or replace function app.message_actor_sender_role(target_community_id uuid)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select case
    when not app.can_manage_message_thread(target_community_id) then null
    when exists (
      select 1
      from public.profile_roles pr
      join public.roles on roles.id = pr.role_id
      where pr.community_id = target_community_id
        and pr.profile_id = app.current_profile_id()
        and pr.status = 'active'
        and roles.community_id = target_community_id
        and roles.key = 'admin'
        and 'admin.messages.manage' = any(roles.permissions)
    ) then 'admin'
    else 'board_member'
  end;
$$;

create or replace function app.message_thread_summary_json(thread_record public.message_threads)
returns jsonb
language sql
stable
security definer
set search_path = public, app
as $$
  with property_record as (
    select
      properties.address_line1,
      properties.address_line2,
      properties.city,
      properties.state,
      properties.postal_code
    from public.properties
    where properties.id = ($1).property_id
      and properties.community_id = ($1).community_id
    limit 1
  ),
  message_stats as (
    select
      count(*)::integer as message_count,
      coalesce(sum(cardinality(messages.attachment_document_ids)), 0)::integer as attachment_count
    from public.messages
    where messages.thread_id = ($1).id
      and messages.community_id = ($1).community_id
      and messages.deleted_at is null
  )
  select jsonb_build_object(
    'thread_id', ($1).id,
    'community_id', ($1).community_id,
    'property_id', ($1).property_id,
    'property_label', coalesce(
      (
        select concat_ws(', ',
          property_record.address_line1,
          nullif(property_record.address_line2, ''),
          property_record.city,
          property_record.state,
          property_record.postal_code
        )
        from property_record
      ),
      'Unknown property'
    ),
    'subject', ($1).subject,
    'category', ($1).category,
    'status', ($1).status,
    'assigned_to', app.message_profile_summary(($1).assigned_to),
    'created_by', app.message_profile_summary(($1).created_by),
    'last_message_at', ($1).last_message_at,
    'closed_at', ($1).closed_at,
    'created_at', ($1).created_at,
    'updated_at', ($1).updated_at,
    'message_count', coalesce((select message_stats.message_count from message_stats), 0),
    'attachment_count', coalesce((select message_stats.attachment_count from message_stats), 0)
  );
$$;

create or replace function app.message_json(message_record public.messages)
returns jsonb
language sql
stable
security definer
set search_path = public, app
as $$
  select jsonb_build_object(
    'message_id', ($1).id,
    'thread_id', ($1).thread_id,
    'sender_id', ($1).sender_id,
    'sender_role', ($1).sender_role,
    'sender_display_name', coalesce(
      app.message_profile_summary(($1).sender_id) ->> 'display_name',
      'Unknown user'
    ),
    'body', ($1).body,
    'attachment_count', cardinality(($1).attachment_document_ids),
    'visibility', ($1).visibility,
    'created_at', ($1).created_at
  );
$$;

create or replace function app.admin_message_attachments_are_valid(
  target_community_id uuid,
  target_property_id uuid,
  target_attachment_document_ids uuid[]
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  with attachment_ids as (
    select distinct unnest(coalesce(target_attachment_document_ids, '{}'::uuid[])) as document_id
  )
  select
    cardinality(coalesce(target_attachment_document_ids, '{}'::uuid[])) <= 3
    and (
      select count(*)
      from attachment_ids
    ) = cardinality(coalesce(target_attachment_document_ids, '{}'::uuid[]))
    and not exists (
      select 1
      from attachment_ids
      left join public.documents on documents.id = attachment_ids.document_id
      where documents.id is null
        or documents.community_id <> target_community_id
        or documents.related_property_id <> target_property_id
        or documents.visibility <> 'property_specific'::document_visibility
        or documents.category <> 'message_attachment'
        or documents.status <> 'active'
        or documents.deleted_at is not null
    );
$$;

create or replace function public.list_message_threads(
  target_community_slug text default 'spring-meadow-community',
  filter_status text default null,
  filter_category text default null,
  filter_property_id uuid default null,
  filter_assigned_to uuid default null,
  filter_query text default null,
  filter_last_message_from timestamptz default null,
  filter_last_message_to timestamptz default null,
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
  actor_profile_id uuid;
  bounded_limit integer;
  bounded_offset integer;
  search_query text;
  records jsonb;
begin
  target_community_id := app.resolve_message_community(target_community_slug);
  actor_profile_id := app.current_profile_id();

  if actor_profile_id is null
    or target_community_id is null
    or not app.has_permission(target_community_id, 'admin.messages.manage')
  then
    return jsonb_build_object('status', 'permission_denied');
  end if;

  if filter_status is not null
    and filter_status not in ('open', 'pending_board', 'pending_resident', 'closed', 'archived')
  then
    return jsonb_build_object('status', 'invalid');
  end if;

  if filter_category is not null
    and filter_category not in ('dues', 'documents', 'maintenance', 'architectural', 'complaint', 'general')
  then
    return jsonb_build_object('status', 'invalid');
  end if;

  if filter_query is not null
    and length(btrim(filter_query)) > 200
  then
    return jsonb_build_object('status', 'invalid');
  end if;

  if filter_last_message_from is not null
    and filter_last_message_to is not null
    and filter_last_message_to < filter_last_message_from
  then
    return jsonb_build_object('status', 'invalid');
  end if;

  bounded_limit := least(greatest(coalesce(page_limit, 50), 1), 100);
  bounded_offset := least(greatest(coalesce(page_offset, 0), 0), 10000);
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

  with filtered_threads as (
    select thread_record.*
    from public.message_threads thread_record
    join public.properties on properties.id = thread_record.property_id
      and properties.community_id = thread_record.community_id
    where thread_record.community_id = target_community_id
      and (filter_status is null or thread_record.status = filter_status)
      and (filter_category is null or thread_record.category = filter_category)
      and (filter_property_id is null or thread_record.property_id = filter_property_id)
      and (filter_assigned_to is null or thread_record.assigned_to = filter_assigned_to)
      and (
        filter_last_message_from is null
        or thread_record.last_message_at >= filter_last_message_from
      )
      and (
        filter_last_message_to is null
        or thread_record.last_message_at <= filter_last_message_to
      )
      and (
        search_query is null
        or thread_record.subject ilike '%' || search_query || '%' escape chr(92)
        or properties.address_line1 ilike '%' || search_query || '%' escape chr(92)
        or properties.city ilike '%' || search_query || '%' escape chr(92)
      )
    order by thread_record.last_message_at desc, thread_record.created_at desc, thread_record.id desc
    limit bounded_limit
    offset bounded_offset
  )
  select coalesce(jsonb_agg(
    app.message_thread_summary_json(filtered_threads)
    order by filtered_threads.last_message_at desc, filtered_threads.created_at desc, filtered_threads.id desc
  ), '[]'::jsonb)
  into records
  from filtered_threads;

  return jsonb_build_object(
    'status', 'ok',
    'records', records
  );
end;
$$;

create or replace function public.get_message_thread_detail(target_thread_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, app
as $$
declare
  thread_record public.message_threads%rowtype;
  messages_record jsonb;
begin
  select *
  into thread_record
  from public.message_threads
  where id = target_thread_id;

  if not found then
    return jsonb_build_object('status', 'not_found');
  end if;

  if not app.can_manage_message_thread(thread_record.community_id) then
    return jsonb_build_object('status', 'permission_denied');
  end if;

  select coalesce(jsonb_agg(
    app.message_json(messages)
    order by messages.created_at asc, messages.id asc
  ), '[]'::jsonb)
  into messages_record
  from public.messages
  where messages.thread_id = thread_record.id
    and messages.community_id = thread_record.community_id
    and messages.deleted_at is null;

  return jsonb_build_object(
    'status', 'ok',
    'thread', app.message_thread_summary_json(thread_record),
    'messages', messages_record
  );
end;
$$;

create or replace function public.reply_to_message_thread(
  target_thread_id uuid,
  message_body text default null,
  message_attachment_document_ids uuid[] default '{}'
)
returns jsonb
language plpgsql
security definer
set search_path = public, app
as $$
declare
  thread_record public.message_threads%rowtype;
  updated_thread public.message_threads%rowtype;
  created_message public.messages%rowtype;
  actor_profile_id uuid;
  sender_role_value text;
  reply_visibility text := 'thread_participants';
  body_value text;
  attachment_ids uuid[];
begin
  actor_profile_id := app.current_profile_id();
  body_value := btrim(coalesce(message_body, ''));
  attachment_ids := coalesce(message_attachment_document_ids, '{}'::uuid[]);

  select *
  into thread_record
  from public.message_threads
  where id = target_thread_id
  for update;

  if actor_profile_id is null
    or not found
    or not app.can_manage_message_thread(thread_record.community_id)
  then
    return jsonb_build_object('status', 'permission_denied');
  end if;

  sender_role_value := app.message_actor_sender_role(thread_record.community_id);

  if sender_role_value not in ('admin', 'board_member')
    or thread_record.status = 'archived'
    or body_value = ''
    or length(body_value) > 5000
    or cardinality(attachment_ids) > 3
    or not app.admin_message_attachments_are_valid(
      thread_record.community_id,
      thread_record.property_id,
      attachment_ids
    )
  then
    return jsonb_build_object('status', 'invalid');
  end if;

  insert into public.messages (
    community_id,
    thread_id,
    property_id,
    sender_id,
    sender_role,
    body,
    attachment_document_ids,
    visibility
  )
  values (
    thread_record.community_id,
    thread_record.id,
    thread_record.property_id,
    actor_profile_id,
    sender_role_value,
    body_value,
    attachment_ids,
    reply_visibility
  )
  returning *
  into created_message;

  update public.message_threads
  set last_message_at = created_message.created_at,
    status = 'pending_resident',
    closed_at = null
  where id = thread_record.id
  returning *
  into updated_thread;

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
      updated_thread.community_id,
      actor_profile_id,
      'user',
      'message.thread.reply',
      'message_threads',
      updated_thread.id,
      app.message_thread_summary_json(thread_record),
      app.message_thread_summary_json(updated_thread)
    );
  exception
    when others then null;
  end;

  return jsonb_build_object(
    'status', 'replied',
    'thread', app.message_thread_summary_json(updated_thread)
  );
end;
$$;

create or replace function public.assign_message_thread(
  target_thread_id uuid,
  target_assigned_to uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, app
as $$
declare
  thread_record public.message_threads%rowtype;
  updated_thread public.message_threads%rowtype;
  actor_profile_id uuid;
begin
  actor_profile_id := app.current_profile_id();

  select *
  into thread_record
  from public.message_threads
  where id = target_thread_id
  for update;

  if actor_profile_id is null
    or not found
    or not app.can_manage_message_thread(thread_record.community_id)
  then
    return jsonb_build_object('status', 'permission_denied');
  end if;

  if target_assigned_to is not null
    and not exists (
      select 1
      from public.profiles
      join public.profile_roles pr on pr.profile_id = profiles.id
      join public.roles on roles.id = pr.role_id
      where profiles.id = target_assigned_to
        and profiles.status = 'active'
        and profiles.deleted_at is null
        and pr.community_id = thread_record.community_id
        and pr.status = 'active'
        and roles.community_id = thread_record.community_id
        and roles.key in ('admin', 'board_member')
        and 'admin.messages.manage' = any(roles.permissions)
    )
  then
    return jsonb_build_object('status', 'invalid');
  end if;

  update public.message_threads
  set assigned_to = target_assigned_to
  where id = thread_record.id
  returning *
  into updated_thread;

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
      updated_thread.community_id,
      actor_profile_id,
      'user',
      'message.thread.assign',
      'message_threads',
      updated_thread.id,
      app.message_thread_summary_json(thread_record),
      app.message_thread_summary_json(updated_thread)
    );
  exception
    when others then null;
  end;

  return jsonb_build_object(
    'status', 'assigned',
    'thread', app.message_thread_summary_json(updated_thread)
  );
end;
$$;

create or replace function public.set_message_thread_status(
  target_thread_id uuid,
  target_status text
)
returns jsonb
language plpgsql
security definer
set search_path = public, app
as $$
declare
  thread_record public.message_threads%rowtype;
  updated_thread public.message_threads%rowtype;
  actor_profile_id uuid;
  status_value text;
  audit_action text;
begin
  actor_profile_id := app.current_profile_id();
  status_value := btrim(coalesce(target_status, ''));

  select *
  into thread_record
  from public.message_threads
  where id = target_thread_id
  for update;

  if actor_profile_id is null
    or not found
    or not app.can_manage_message_thread(thread_record.community_id)
  then
    return jsonb_build_object('status', 'permission_denied');
  end if;

  if status_value not in ('open', 'pending_board', 'pending_resident', 'closed', 'archived') then
    return jsonb_build_object('status', 'invalid');
  end if;

  if status_value = 'closed' then
    update public.message_threads
    set
      status = status_value,
      closed_at = now()
    where id = thread_record.id
    returning *
    into updated_thread;
  elsif status_value in ('open', 'pending_board', 'pending_resident') then
    update public.message_threads
    set
      status = status_value,
      closed_at = null
    where id = thread_record.id
    returning *
    into updated_thread;
  else
    update public.message_threads
    set status = status_value
    where id = thread_record.id
    returning *
    into updated_thread;
  end if;

  audit_action := case
    when status_value = 'closed' then 'message.thread.close'
    when status_value = 'archived' then 'message.thread.archive'
    else 'message.thread.reopen'
  end;

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
      updated_thread.community_id,
      actor_profile_id,
      'user',
      audit_action,
      'message_threads',
      updated_thread.id,
      app.message_thread_summary_json(thread_record),
      app.message_thread_summary_json(updated_thread)
    );
  exception
    when others then null;
  end;

  return jsonb_build_object(
    'status', 'status_updated',
    'thread', app.message_thread_summary_json(updated_thread)
  );
end;
$$;

revoke all on function app.can_manage_message_thread(uuid) from public, anon, authenticated;
revoke all on function app.can_read_message_thread(uuid) from public, anon, authenticated;
revoke all on function app.message_profile_summary(uuid) from public, anon, authenticated;
revoke all on function app.message_actor_sender_role(uuid) from public, anon, authenticated;
revoke all on function app.message_thread_summary_json(public.message_threads) from public, anon, authenticated;
revoke all on function app.message_json(public.messages) from public, anon, authenticated;
revoke all on function app.admin_message_attachments_are_valid(uuid, uuid, uuid[]) from public, anon, authenticated;

revoke all on function public.list_message_threads(text, text, text, uuid, uuid, text, timestamptz, timestamptz, integer, integer) from public, anon, authenticated;
revoke all on function public.get_message_thread_detail(uuid) from public, anon, authenticated;
revoke all on function public.reply_to_message_thread(uuid, text, uuid[]) from public, anon, authenticated;
revoke all on function public.assign_message_thread(uuid, uuid) from public, anon, authenticated;
revoke all on function public.set_message_thread_status(uuid, text) from public, anon, authenticated;

grant execute on function public.list_message_threads(text, text, text, uuid, uuid, text, timestamptz, timestamptz, integer, integer) to authenticated;
grant execute on function public.get_message_thread_detail(uuid) to authenticated;
grant execute on function public.reply_to_message_thread(uuid, text, uuid[]) to authenticated;
grant execute on function public.assign_message_thread(uuid, uuid) to authenticated;
grant execute on function public.set_message_thread_status(uuid, text) to authenticated;
