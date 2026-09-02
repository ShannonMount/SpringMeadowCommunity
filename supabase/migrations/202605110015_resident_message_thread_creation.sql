create table if not exists public.message_threads (
  id uuid primary key default gen_random_uuid(),
  community_id uuid not null references public.communities(id) on delete cascade,
  property_id uuid not null references public.properties(id) on delete cascade,
  subject text not null,
  category text not null
    check (category in ('dues', 'documents', 'maintenance', 'architectural', 'complaint', 'general')),
  status text not null default 'open'
    check (status in ('open', 'pending_board', 'pending_resident', 'closed', 'archived')),
  created_by uuid not null references public.profiles(id),
  assigned_to uuid references public.profiles(id),
  last_message_at timestamptz not null default now(),
  closed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint message_threads_subject_check check (
    btrim(subject) <> ''
    and length(btrim(subject)) <= 200
  )
);

create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  community_id uuid not null references public.communities(id) on delete cascade,
  thread_id uuid not null references public.message_threads(id) on delete cascade,
  property_id uuid not null references public.properties(id) on delete cascade,
  sender_id uuid not null references public.profiles(id),
  sender_role text not null check (sender_role in ('resident', 'board_member', 'admin')),
  body text not null,
  attachment_document_ids uuid[] not null default '{}',
  visibility text not null default 'thread_participants'
    check (visibility in ('thread_participants', 'board_admin_only')),
  created_at timestamptz not null default now(),
  edited_at timestamptz,
  deleted_at timestamptz,
  constraint messages_body_check check (
    btrim(body) <> ''
    and length(btrim(body)) <= 5000
  )
);

create index if not exists message_threads_property_idx
  on public.message_threads(community_id, property_id, last_message_at desc);

create index if not exists message_threads_status_idx
  on public.message_threads(community_id, status, last_message_at desc);

create index if not exists message_threads_assigned_idx
  on public.message_threads(community_id, assigned_to, status);

create index if not exists messages_thread_idx
  on public.messages(community_id, thread_id, created_at);

create index if not exists messages_attachment_document_ids_gin_idx
  on public.messages using gin(attachment_document_ids);

alter table public.message_threads enable row level security;
alter table public.messages enable row level security;

revoke all on public.message_threads from anon, authenticated;
revoke all on public.messages from anon, authenticated;

create or replace function public.set_message_threads_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_message_threads_updated_at on public.message_threads;
create trigger set_message_threads_updated_at
  before update on public.message_threads
  for each row
  execute function public.set_message_threads_updated_at();

create or replace function app.resolve_message_community(target_community_slug text)
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select id
  from public.communities
  where slug = coalesce(nullif(btrim(target_community_slug), ''), 'spring-meadow-community')
    and status = 'active'
  limit 1;
$$;

create or replace function app.can_create_message_thread(
  target_community_id uuid,
  target_property_id uuid
)
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
    where pm.community_id = target_community_id
      and pm.property_id = target_property_id
      and pm.profile_id = app.current_profile_id()
      and pm.status = 'active'
      and properties.community_id = target_community_id
      and properties.status = 'active'
      and properties.deleted_at is null
  );
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
  );
$$;

drop policy if exists "read authorized message threads" on public.message_threads;
create policy "read authorized message threads"
  on public.message_threads
  for select
  to authenticated
  using (app.can_read_message_thread(id));

drop policy if exists "read authorized thread messages" on public.messages;
create policy "read authorized thread messages"
  on public.messages
  for select
  to authenticated
  using (
    visibility = 'thread_participants'
    and app.can_read_message_thread(thread_id)
  );

create or replace function app.message_thread_creation_json(
  thread_record public.message_threads,
  first_message_record public.messages
)
returns jsonb
language sql
stable
security definer
set search_path = public, app
as $$
  select jsonb_build_object(
    'thread_id', thread_record.id,
    'community_id', thread_record.community_id,
    'property_id', thread_record.property_id,
    'subject', thread_record.subject,
    'category', thread_record.category,
    'status', thread_record.status,
    'first_message_id', first_message_record.id,
    'attachment_count', cardinality(first_message_record.attachment_document_ids),
    'created_at', thread_record.created_at
  );
$$;

create or replace function app.message_attachments_are_valid(
  target_community_id uuid,
  target_property_id uuid,
  actor_profile_id uuid,
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
        or documents.uploaded_by <> actor_profile_id
        or documents.created_by <> actor_profile_id
        or documents.visibility <> 'property_specific'::document_visibility
        or documents.category <> 'message_attachment'
        or documents.status <> 'active'
        or documents.deleted_at is not null
        or documents.storage_bucket <> 'private-documents'
    );
$$;

create or replace function public.create_message_thread(
  target_community_slug text default 'spring-meadow-community',
  target_property_id uuid default null,
  message_subject text default null,
  message_category text default null,
  message_body text default null,
  message_attachment_document_ids uuid[] default '{}'
)
returns jsonb
language plpgsql
security definer
set search_path = public, app
as $$
declare
  target_community_id uuid;
  actor_profile_id uuid;
  subject_value text;
  body_value text;
  category_value text;
  attachment_ids uuid[];
  created_thread public.message_threads%rowtype;
  created_message public.messages%rowtype;
begin
  target_community_id := app.resolve_message_community(target_community_slug);
  actor_profile_id := app.current_profile_id();
  subject_value := btrim(coalesce(message_subject, ''));
  body_value := btrim(coalesce(message_body, ''));
  category_value := btrim(coalesce(message_category, ''));
  attachment_ids := coalesce(message_attachment_document_ids, '{}'::uuid[]);

  if actor_profile_id is null or target_community_id is null then
    return jsonb_build_object('status', 'permission_denied');
  end if;

  if target_property_id is null
    or not app.can_create_message_thread(target_community_id, target_property_id)
  then
    return jsonb_build_object('status', 'permission_denied');
  end if;

  if subject_value = ''
    or length(subject_value) > 200
    or body_value = ''
    or length(body_value) > 5000
    or category_value not in ('dues', 'documents', 'maintenance', 'architectural', 'complaint', 'general')
    or cardinality(attachment_ids) > 3
    or not app.message_attachments_are_valid(
      target_community_id,
      target_property_id,
      actor_profile_id,
      attachment_ids
    )
  then
    return jsonb_build_object('status', 'invalid');
  end if;

  insert into public.message_threads (
    community_id,
    property_id,
    subject,
    category,
    status,
    created_by,
    last_message_at
  )
  values (
    target_community_id,
    target_property_id,
    subject_value,
    category_value,
    'open',
    actor_profile_id,
    now()
  )
  returning *
  into created_thread;

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
    target_community_id,
    created_thread.id,
    target_property_id,
    actor_profile_id,
    'resident',
    body_value,
    attachment_ids,
    'thread_participants'
  )
  returning *
  into created_message;

  update public.message_threads
  set last_message_at = created_message.created_at
  where id = created_thread.id
  returning *
  into created_thread;

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
      'message.thread.create',
      'message_threads',
      created_thread.id,
      app.message_thread_creation_json(created_thread, created_message)
    );
  exception
    when others then null;
  end;

  return jsonb_build_object(
    'status', 'created',
    'record', app.message_thread_creation_json(created_thread, created_message)
  );
end;
$$;

revoke all on function app.resolve_message_community(text) from public, anon, authenticated;
revoke all on function app.can_create_message_thread(uuid, uuid) from public, anon, authenticated;
revoke all on function app.can_read_message_thread(uuid) from public, anon, authenticated;
revoke all on function app.message_thread_creation_json(public.message_threads, public.messages) from public, anon, authenticated;
revoke all on function app.message_attachments_are_valid(uuid, uuid, uuid, uuid[]) from public, anon, authenticated;
revoke all on function public.create_message_thread(text, uuid, text, text, text, uuid[]) from public, anon, authenticated;

grant execute on function public.create_message_thread(text, uuid, text, text, text, uuid[]) to authenticated;

create or replace function public.get_authorized_document_download_metadata(
  target_document_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public, app
as $$
declare
  document_record public.documents%rowtype;
begin
  select *
  into document_record
  from public.documents
  where id = target_document_id
    and deleted_at is null;

  if not found or document_record.category = 'message_attachment' then
    return jsonb_build_object('status', 'not_found');
  end if;

  if not app.can_read_document(document_record.id) then
    return jsonb_build_object('status', 'permission_denied');
  end if;

  return jsonb_build_object('status', 'allowed', 'record', app.document_metadata_json(document_record));
end;
$$;

create or replace function public.list_document_metadata(
  target_community_id uuid,
  filter_visibility text default null,
  filter_category text default null,
  filter_status text default null,
  filter_related_property_id uuid default null,
  filter_query text default null,
  filter_effective_from date default null,
  filter_effective_to date default null,
  filter_expiration_from date default null,
  filter_expiration_to date default null,
  page_limit integer default 50,
  page_offset integer default 0
)
returns jsonb
language plpgsql
security definer
set search_path = public, app
as $$
declare
  actor_profile_id uuid;
  manager_can_list boolean;
  bounded_limit integer;
  bounded_offset integer;
  search_query text;
  records jsonb;
begin
  actor_profile_id := app.current_profile_id();

  if filter_visibility is not null
    and filter_visibility not in (
      'public',
      'resident',
      'board',
      'vendor',
      'property_specific',
      'admin'
    )
  then
    return jsonb_build_object('status', 'invalid');
  end if;

  if filter_status is not null
    and filter_status not in ('active', 'archived', 'deleted')
  then
    return jsonb_build_object('status', 'invalid');
  end if;

  if filter_category is not null
    and length(btrim(filter_category)) > 120
  then
    return jsonb_build_object('status', 'invalid');
  end if;

  if filter_query is not null
    and length(btrim(filter_query)) > 200
  then
    return jsonb_build_object('status', 'invalid');
  end if;

  if filter_effective_from is not null
    and filter_effective_to is not null
    and filter_effective_to < filter_effective_from
  then
    return jsonb_build_object('status', 'invalid');
  end if;

  if filter_expiration_from is not null
    and filter_expiration_to is not null
    and filter_expiration_to < filter_expiration_from
  then
    return jsonb_build_object('status', 'invalid');
  end if;

  bounded_limit := least(greatest(coalesce(page_limit, 50), 1), 100);
  bounded_offset := least(greatest(coalesce(page_offset, 0), 0), 10000);
  manager_can_list := actor_profile_id is not null
    and app.has_permission(target_community_id, 'admin.documents.manage');
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

  with filtered_documents as (
    select documents.*
    from public.documents
    where documents.community_id = target_community_id
      and documents.deleted_at is null
      and documents.category <> 'message_attachment'
      and (
        filter_visibility is null
        or documents.visibility::text = filter_visibility
      )
      and (
        filter_category is null
        or lower(documents.category) = lower(btrim(filter_category))
      )
      and (
        filter_status is null
        or documents.status = filter_status
      )
      and (
        filter_related_property_id is null
        or documents.related_property_id = filter_related_property_id
      )
      and (
        filter_effective_from is null
        or documents.effective_date >= filter_effective_from
      )
      and (
        filter_effective_to is null
        or documents.effective_date <= filter_effective_to
      )
      and (
        filter_expiration_from is null
        or documents.expiration_date >= filter_expiration_from
      )
      and (
        filter_expiration_to is null
        or documents.expiration_date <= filter_expiration_to
      )
      and (
        search_query is null
        or documents.title ilike '%' || search_query || '%' escape chr(92)
        or documents.description ilike '%' || search_query || '%' escape chr(92)
        or documents.category ilike '%' || search_query || '%' escape chr(92)
      )
      and (
        manager_can_list = true
        or app.can_read_document(documents.id)
      )
    order by documents.created_at desc, documents.id asc
    limit bounded_limit
    offset bounded_offset
  )
  select coalesce(jsonb_agg(
    app.document_metadata_json(filtered_documents)
    order by filtered_documents.created_at desc, filtered_documents.id asc
  ), 
  '[]'::jsonb
)
into records
from filtered_documents;

return jsonb_build_object(
  'status', 'ok',
  'records', records
);
end;
$$;

revoke all on function public.get_authorized_document_download_metadata(uuid) from public, anon, authenticated;
grant execute on function public.get_authorized_document_download_metadata(uuid) to anon, authenticated;

revoke all on function public.list_document_metadata(
  uuid,
  text,
  text,
  text,
  uuid,
  text,
  date,
  date,
  date,
  date,
  integer,
  integer
) from public, anon;

grant execute on function public.list_document_metadata(
  uuid,
  text,
  text,
  text,
  uuid,
  text,
  date,
  date,
  date,
  date,
  integer,
  integer
) to anon, authenticated;
