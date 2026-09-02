alter table public.community_settings
  add column if not exists message_notifications_enabled boolean not null default true,
  add column if not exists message_retention_days integer not null default 2555
    check (message_retention_days >= 0);

alter table public.email_logs
  add column if not exists related_message_thread_id uuid references public.message_threads(id),
  add column if not exists related_message_id uuid references public.messages(id);

create index if not exists email_logs_message_thread_idx
  on public.email_logs(related_message_thread_id, created_at desc)
  where related_message_thread_id is not null;

create index if not exists email_logs_message_idx
  on public.email_logs(related_message_id)
  where related_message_id is not null;

revoke all on public.message_threads from anon, authenticated;
revoke all on public.messages from anon, authenticated;
revoke all on public.email_logs from anon, authenticated;
revoke all on public.audit_logs from anon, authenticated;
revoke all on public.community_settings from anon, authenticated;

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

create or replace function app.resident_message_profile_summary(target_profile_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select case
    when target_profile_id is null then null
    else jsonb_build_object(
      'display_name',
      coalesce(
        (
          select nullif(profiles.display_name, '')
          from public.profiles
          where profiles.id = target_profile_id
            and profiles.deleted_at is null
          limit 1
        ),
        'Participant'
      )
    )
  end;
$$;

create or replace function app.resident_message_thread_summary_json(
  thread_record public.message_threads
)
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
      and messages.visibility = 'thread_participants'
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
    'created_by', app.resident_message_profile_summary(($1).created_by),
    'last_message_at', ($1).last_message_at,
    'closed_at', ($1).closed_at,
    'created_at', ($1).created_at,
    'message_count', coalesce((select message_stats.message_count from message_stats), 0),
    'attachment_count', coalesce((select message_stats.attachment_count from message_stats), 0)
  );
$$;

create or replace function app.resident_message_json(message_record public.messages)
returns jsonb
language sql
stable
security definer
set search_path = public, app
as $$
  select jsonb_build_object(
    'message_id', ($1).id,
    'thread_id', ($1).thread_id,
    'property_id', ($1).property_id,
    'sender_role', ($1).sender_role,
    'sender_display_name', coalesce(
      app.resident_message_profile_summary(($1).sender_id) ->> 'display_name',
      'Participant'
    ),
    'body', ($1).body,
    'attachment_count', cardinality(($1).attachment_document_ids),
    'created_at', ($1).created_at
  );
$$;

create or replace function public.list_resident_message_threads(
  target_community_slug text default 'spring-meadow-community',
  filter_property_id uuid default null,
  filter_status text default null,
  filter_category text default null,
  filter_query text default null,
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

  if actor_profile_id is null or target_community_id is null then
    return jsonb_build_object('status', 'permission_denied');
  end if;

  if filter_status is not null
    and filter_status not in ('open', 'pending_board', 'pending_resident', 'closed')
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

  if filter_property_id is not null
    and not app.can_create_message_thread(target_community_id, filter_property_id)
  then
    return jsonb_build_object('status', 'permission_denied');
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
      and thread_record.status <> 'archived'
      and properties.status = 'active'
      and properties.deleted_at is null
      and (filter_status is null or thread_record.status = filter_status)
      and (filter_category is null or thread_record.category = filter_category)
      and (filter_property_id is null or thread_record.property_id = filter_property_id)
      and exists (
        select 1
        from public.property_memberships pm
        where pm.community_id = thread_record.community_id
          and pm.property_id = thread_record.property_id
          and pm.profile_id = actor_profile_id
          and pm.status = 'active'
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
    app.resident_message_thread_summary_json(filtered_threads)
    order by filtered_threads.last_message_at desc, filtered_threads.created_at desc, filtered_threads.id desc
  ), 
  '[]'::jsonb
)
into records
from filtered_threads;

return jsonb_build_object(
  'status', 'ok',
  'records', records
);
end;
$$;

create or replace function public.get_resident_message_thread_detail(target_thread_id uuid)
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
    return jsonb_build_object('status', 'permission_denied');
  end if;

  if not app.can_read_message_thread(target_thread_id)
    or not app.can_create_message_thread(thread_record.community_id, thread_record.property_id)
    or thread_record.status = 'archived'
  then
    return jsonb_build_object('status', 'permission_denied');
  end if;

  select coalesce(jsonb_agg(
    app.resident_message_json(messages)
    order by messages.created_at asc, messages.id asc
  ), 
  '[]'::jsonb
)
into messages_record
from public.messages
where messages.thread_id = thread_record.id
  and messages.community_id = thread_record.community_id
  and messages.visibility = 'thread_participants'
  and messages.deleted_at is null;

return jsonb_build_object(
  'status', 'ok',
  'thread', app.resident_message_thread_summary_json(thread_record),
  'messages', messages_record
);
end;
$$;

create or replace function public.reply_to_resident_message_thread(
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
    or not app.can_create_message_thread(thread_record.community_id, thread_record.property_id)
  then
    return jsonb_build_object('status', 'permission_denied');
  end if;

  if thread_record.status = 'archived'
    or body_value = ''
    or length(body_value) > 5000
    or cardinality(attachment_ids) > 3
    or not app.message_attachments_are_valid(
      thread_record.community_id,
      thread_record.property_id,
      actor_profile_id,
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
    'resident',
    body_value,
    attachment_ids,
    'thread_participants'
  )
  returning *
  into created_message;

  update public.message_threads
  set last_message_at = created_message.created_at,
    status = 'pending_board',
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
      'message.thread.resident_reply',
      'message_threads',
      updated_thread.id,
      app.resident_message_thread_summary_json(thread_record),
      app.resident_message_thread_summary_json(updated_thread)
    );
  exception
    when others then null;
  end;

  return jsonb_build_object(
    'status', 'replied',
    'message_id', created_message.id,
    'thread', app.resident_message_thread_summary_json(updated_thread)
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
    'message_id', created_message.id,
    'thread', app.message_thread_summary_json(updated_thread)
  );
end;
$$;

create or replace function public.add_message_internal_note(
  target_thread_id uuid,
  note_body text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, app
as $$
declare
  thread_record public.message_threads%rowtype;
  created_message public.messages%rowtype;
  actor_profile_id uuid;
  sender_role_value text;
  body_value text;
begin
  actor_profile_id := app.current_profile_id();
  body_value := btrim(coalesce(note_body, ''));

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
    or body_value = ''
    or length(body_value) > 5000
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
    '{}'::uuid[],
    'board_admin_only'
  )
  returning *
  into created_message;

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
      thread_record.community_id,
      actor_profile_id,
      'user',
      'message.thread.internal_note',
      'message_threads',
      thread_record.id,
      app.message_thread_summary_json(thread_record),
      app.message_json(created_message)
    );
  exception
    when others then null;
  end;

  return jsonb_build_object(
    'status', 'noted',
    'message_id', created_message.id,
    'thread', app.message_thread_summary_json(thread_record)
  );
end;
$$;

revoke all on function app.can_read_message_thread(uuid) from public, anon, authenticated;
revoke all on function app.resident_message_profile_summary(uuid) from public, anon, authenticated;
revoke all on function app.resident_message_thread_summary_json(public.message_threads) from public, anon, authenticated;
revoke all on function app.resident_message_json(public.messages) from public, anon, authenticated;

revoke all on function public.list_resident_message_threads(text, uuid, text, text, text, integer, integer) from public, anon, authenticated;
revoke all on function public.get_resident_message_thread_detail(uuid) from public, anon, authenticated;
revoke all on function public.reply_to_resident_message_thread(uuid, text, uuid[]) from public, anon, authenticated;
revoke all on function public.reply_to_message_thread(uuid, text, uuid[]) from public, anon, authenticated;
revoke all on function public.add_message_internal_note(uuid, text) from public, anon, authenticated;

grant execute on function public.list_resident_message_threads(text, uuid, text, text, text, integer, integer) to authenticated;
grant execute on function public.get_resident_message_thread_detail(uuid) to authenticated;
grant execute on function public.reply_to_resident_message_thread(uuid, text, uuid[]) to authenticated;
grant execute on function public.reply_to_message_thread(uuid, text, uuid[]) to authenticated;
grant execute on function public.add_message_internal_note(uuid, text) to authenticated;
