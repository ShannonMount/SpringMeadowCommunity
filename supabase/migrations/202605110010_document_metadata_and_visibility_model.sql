do $$
begin
  create type document_visibility as enum (
    'public',
    'resident',
    'board',
    'vendor',
    'property_specific',
    'admin'
  );
exception
  when duplicate_object then null;
end;
$$;

update public.roles
set
  permissions = case
    when 'admin.documents.manage' = any(permissions) then permissions
    else permissions || array['admin.documents.manage']::text[]
  end,
  updated_at = now()
where key = 'admin';

update public.roles
set
  permissions = case
    when 'board.documents.view' = any(permissions) then permissions
    else permissions || array['board.documents.view']::text[]
  end,
  updated_at = now()
where key in ('board_member', 'admin');

create table if not exists public.documents (
  id uuid primary key default gen_random_uuid(),
  community_id uuid not null references public.communities(id) on delete cascade,
  title text not null,
  description text,
  category text not null,
  visibility document_visibility not null,
  related_property_id uuid references public.properties(id),
  related_vendor_id uuid,
  related_meeting_id uuid,
  related_compliance_task_id uuid,
  related_assessment_id uuid references public.assessments(id),
  storage_provider text not null default 'supabase_storage'
    check (storage_provider in ('supabase_storage', 'cloudflare_r2', 's3')),
  storage_bucket text not null,
  storage_path text not null,
  content_type text not null,
  size_bytes bigint not null,
  checksum text,
  effective_date date,
  expiration_date date,
  status text not null default 'active'
    check (status in ('active', 'archived', 'deleted')),
  uploaded_by uuid not null references public.profiles(id),
  created_by uuid not null references public.profiles(id),
  updated_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  deleted_by uuid references public.profiles(id),
  constraint documents_title_check check (
    btrim(title) <> ''
    and length(btrim(title)) <= 200
  ),
  constraint documents_category_check check (
    btrim(category) <> ''
    and length(btrim(category)) <= 120
  ),
  constraint documents_storage_bucket_check check (
    btrim(storage_bucket) <> ''
    and length(btrim(storage_bucket)) <= 120
  ),
  constraint documents_content_type_check check (
    btrim(content_type) <> ''
    and length(btrim(content_type)) <= 120
  ),
  constraint documents_storage_path_check check (
    btrim(storage_path) <> ''
    and length(btrim(storage_path)) <= 1024
    and left(storage_path, 1) <> '/'
    and position(chr(92) in storage_path) = 0
    and storage_path !~ '(^|/)\.\.(/|$)'
  ),
  constraint documents_size_bytes_check check (size_bytes > 0),
  constraint documents_date_range_check check (
    effective_date is null
    or expiration_date is null
    or expiration_date >= effective_date
  ),
  constraint documents_property_specific_check check (
    visibility <> 'property_specific'::document_visibility
    or related_property_id is not null
  ),
  constraint documents_checksum_check check (
    checksum is null
    or (
      btrim(checksum) <> ''
      and length(btrim(checksum)) <= 128
    )
  )
);

create table if not exists public.document_access_logs (
  id uuid primary key default gen_random_uuid(),
  community_id uuid not null references public.communities(id) on delete cascade,
  document_id uuid not null references public.documents(id) on delete cascade,
  profile_id uuid references public.profiles(id),
  access_type text not null check (access_type in ('view', 'download', 'signed_url_created')),
  result text not null check (result in ('allowed', 'denied')),
  reason text,
  ip_address inet,
  user_agent text,
  created_at timestamptz not null default now()
);

create index if not exists documents_community_visibility_category_status_idx
  on public.documents(community_id, visibility, category, status, created_at desc);

create index if not exists documents_community_status_date_idx
  on public.documents(community_id, status, effective_date, expiration_date, created_at desc);

create index if not exists documents_property_specific_lookup_idx
  on public.documents(community_id, related_property_id, visibility, status, created_at desc)
  where related_property_id is not null;

create index if not exists documents_assessment_lookup_idx
  on public.documents(community_id, related_assessment_id)
  where related_assessment_id is not null;

create index if not exists documents_vendor_lookup_idx
  on public.documents(community_id, related_vendor_id)
  where related_vendor_id is not null;

create index if not exists documents_meeting_lookup_idx
  on public.documents(community_id, related_meeting_id)
  where related_meeting_id is not null;

create index if not exists documents_compliance_lookup_idx
  on public.documents(community_id, related_compliance_task_id)
  where related_compliance_task_id is not null;

create index if not exists documents_effective_date_idx
  on public.documents(community_id, effective_date)
  where effective_date is not null;

create index if not exists documents_expiration_date_idx
  on public.documents(community_id, expiration_date)
  where expiration_date is not null;

create unique index if not exists documents_storage_path_unique_idx
  on public.documents(community_id, storage_provider, storage_bucket, storage_path)
  where deleted_at is null;

create index if not exists document_access_logs_document_history_idx
  on public.document_access_logs(community_id, document_id, created_at desc);

create index if not exists document_access_logs_profile_history_idx
  on public.document_access_logs(community_id, profile_id, created_at desc)
  where profile_id is not null;

alter table public.documents enable row level security;
alter table public.document_access_logs enable row level security;

revoke all on public.documents from anon, authenticated;
revoke all on public.document_access_logs from anon, authenticated;

create or replace function public.set_documents_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_documents_updated_at on public.documents;
create trigger set_documents_updated_at
  before update on public.documents
  for each row
  execute function public.set_documents_updated_at();

create or replace function public.validate_document_metadata_scope()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  property_community_id uuid;
  assessment_community_id uuid;
  assessment_property_id uuid;
begin
  if new.visibility = 'property_specific'::document_visibility
    and new.related_property_id is null
  then
    raise exception 'property-specific documents require a related property';
  end if;

  if new.related_property_id is not null then
    select properties.community_id
    into property_community_id
    from public.properties
    where properties.id = new.related_property_id
      and properties.deleted_at is null;

    if property_community_id is null
      or property_community_id <> new.community_id
    then
      raise exception 'document property scope mismatch';
    end if;
  end if;

  if new.related_assessment_id is not null then
    select assessments.community_id, assessments.property_id
    into assessment_community_id, assessment_property_id
    from public.assessments
    where assessments.id = new.related_assessment_id;

    if assessment_community_id is null
      or assessment_community_id <> new.community_id
    then
      raise exception 'document assessment scope mismatch';
    end if;

    if new.related_property_id is not null
      and assessment_property_id <> new.related_property_id
    then
      raise exception 'document assessment property mismatch';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists validate_document_metadata_scope on public.documents;
create trigger validate_document_metadata_scope
  before insert or update on public.documents
  for each row
  execute function public.validate_document_metadata_scope();

create or replace function app.document_metadata_json(document_record public.documents)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'id', ($1).id,
    'community_id', ($1).community_id,
    'title', ($1).title,
    'description', ($1).description,
    'category', ($1).category,
    'visibility', ($1).visibility,
    'status', ($1).status,
    'related_property_id', ($1).related_property_id,
    'related_vendor_id', ($1).related_vendor_id,
    'related_meeting_id', ($1).related_meeting_id,
    'related_compliance_task_id', ($1).related_compliance_task_id,
    'related_assessment_id', ($1).related_assessment_id,
    'storage_provider', ($1).storage_provider,
    'storage_bucket', ($1).storage_bucket,
    'storage_path', ($1).storage_path,
    'content_type', ($1).content_type,
    'size_bytes', ($1).size_bytes,
    'checksum', ($1).checksum,
    'effective_date', ($1).effective_date,
    'expiration_date', ($1).expiration_date,
    'uploaded_by', ($1).uploaded_by,
    'created_by', ($1).created_by,
    'updated_by', ($1).updated_by,
    'created_at', ($1).created_at,
    'updated_at', ($1).updated_at
  );
$$;

create or replace function app.can_read_document(target_document_id uuid)
returns boolean
language plpgsql
stable
security definer
set search_path = public, app
as $$
declare
  actor_profile_id uuid;
  document_record public.documents%rowtype;
begin
  select *
  into document_record
  from public.documents
  where id = target_document_id;

  if not found
    or document_record.status <> 'active'
    or document_record.deleted_at is not null
    or (
      document_record.effective_date is not null
      and document_record.effective_date > current_date
    )
    or (
      document_record.expiration_date is not null
      and document_record.expiration_date < current_date
    )
  then
    return false;
  end if;

  if document_record.visibility = 'public'::document_visibility then
    return true;
  end if;

  actor_profile_id := app.current_profile_id();

  if actor_profile_id is null then
    return false;
  end if;

  if app.has_permission(document_record.community_id, 'admin.documents.manage') then
    return true;
  end if;

  if document_record.visibility = 'board'::document_visibility then
    return app.has_permission(document_record.community_id, 'board.documents.view');
  end if;

  if document_record.visibility = 'admin'::document_visibility then
    return false;
  end if;

  if document_record.visibility = 'vendor'::document_visibility then
    return false;
  end if;

  if document_record.visibility = 'resident'::document_visibility then
    return exists (
      select 1
      from public.property_memberships pm
      join public.properties on properties.id = pm.property_id
      where pm.community_id = document_record.community_id
        and pm.profile_id = actor_profile_id
        and pm.status = 'active'
        and pm.can_view_documents = true
        and properties.community_id = document_record.community_id
        and properties.status = 'active'
        and properties.deleted_at is null
    );
  end if;

  if document_record.visibility = 'property_specific'::document_visibility then
    if app.has_permission(document_record.community_id, 'board.documents.view') then
      return true;
    end if;

    return exists (
      select 1
      from public.property_memberships pm
      join public.properties on properties.id = pm.property_id
      where pm.community_id = document_record.community_id
        and pm.property_id = document_record.related_property_id
        and pm.profile_id = actor_profile_id
        and pm.status = 'active'
        and pm.can_view_documents = true
        and properties.status = 'active'
        and properties.deleted_at is null
    );
  end if;

  return false;
end;
$$;

drop policy if exists "read authorized document metadata" on public.documents;
create policy "read authorized document metadata"
  on public.documents
  for select
  to authenticated
  using (app.can_read_document(id));

drop policy if exists "read own document access logs" on public.document_access_logs;
create policy "read own document access logs"
  on public.document_access_logs
  for select
  to authenticated
  using (
    profile_id = app.current_profile_id()
    and app.can_read_document(document_id)
  );

create or replace function public.create_document_metadata(
  target_community_id uuid,
  document_title text,
  document_description text default null,
  document_category text default null,
  document_visibility_value text default null,
  target_related_property_id uuid default null,
  target_related_vendor_id uuid default null,
  target_related_meeting_id uuid default null,
  target_related_compliance_task_id uuid default null,
  target_related_assessment_id uuid default null,
  document_storage_provider text default 'supabase_storage',
  document_storage_bucket text default null,
  document_storage_path text default null,
  document_content_type text default null,
  document_size_bytes bigint default null,
  document_checksum text default null,
  document_effective_date date default null,
  document_expiration_date date default null,
  document_status text default 'active'
)
returns jsonb
language plpgsql
security definer
set search_path = public, app
as $$
declare
  actor_profile_id uuid;
  created_document public.documents%rowtype;
  property_record public.properties%rowtype;
  assessment_record public.assessments%rowtype;
begin
  document_title := btrim(coalesce(document_title, ''));
  document_description := nullif(btrim(coalesce(document_description, '')), '');
  document_category := btrim(coalesce(document_category, ''));
  document_storage_provider := btrim(coalesce(document_storage_provider, ''));
  document_storage_bucket := btrim(coalesce(document_storage_bucket, ''));
  document_storage_path := btrim(coalesce(document_storage_path, ''));
  document_content_type := btrim(coalesce(document_content_type, ''));
  document_checksum := nullif(btrim(coalesce(document_checksum, '')), '');
  document_status := btrim(coalesce(document_status, ''));

  actor_profile_id := app.current_profile_id();

  if actor_profile_id is null
    or not app.has_permission(target_community_id, 'admin.documents.manage')
  then
    return jsonb_build_object('status', 'permission_denied');
  end if;

  if document_title = ''
    or length(document_title) > 200
    or document_category = ''
    or length(document_category) > 120
    or document_visibility_value is null
    or document_visibility_value not in (
      'public',
      'resident',
      'board',
      'vendor',
      'property_specific',
      'admin'
    )
    or document_status is null
    or document_status not in ('active', 'archived', 'deleted')
    or document_storage_provider not in ('supabase_storage', 'cloudflare_r2', 's3')
    or document_storage_bucket = ''
    or length(document_storage_bucket) > 120
    or document_storage_path = ''
    or length(document_storage_path) > 1024
    or left(document_storage_path, 1) = '/'
    or position(chr(92) in document_storage_path) > 0
    or document_storage_path ~ '(^|/)\.\.(/|$)'
    or document_content_type = ''
    or length(document_content_type) > 120
    or document_size_bytes is null
    or document_size_bytes <= 0
    or (
      document_checksum is not null
      and (
        length(document_checksum) > 128
      )
    )
    or (
      document_effective_date is not null
      and document_expiration_date is not null
      and document_expiration_date < document_effective_date
    )
    or (
      document_visibility_value = 'property_specific'
      and target_related_property_id is null
    )
  then
    return jsonb_build_object('status', 'invalid');
  end if;

  if target_related_property_id is not null then
    select *
    into property_record
    from public.properties
    where id = target_related_property_id
      and community_id = target_community_id
      and deleted_at is null;

    if not found then
      return jsonb_build_object('status', 'invalid');
    end if;
  end if;

  if target_related_assessment_id is not null then
    select *
    into assessment_record
    from public.assessments
    where id = target_related_assessment_id
      and community_id = target_community_id;

    if not found
      or (
        target_related_property_id is not null
        and assessment_record.property_id <> target_related_property_id
      )
    then
      return jsonb_build_object('status', 'invalid');
    end if;
  end if;

  insert into public.documents (
    community_id,
    title,
    description,
    category,
    visibility,
    related_property_id,
    related_vendor_id,
    related_meeting_id,
    related_compliance_task_id,
    related_assessment_id,
    storage_provider,
    storage_bucket,
    storage_path,
    content_type,
    size_bytes,
    checksum,
    effective_date,
    expiration_date,
    status,
    uploaded_by,
    created_by,
    updated_by,
    deleted_at,
    deleted_by
  )
  values (
    target_community_id,
    document_title,
    document_description,
    document_category,
    document_visibility_value::document_visibility,
    target_related_property_id,
    target_related_vendor_id,
    target_related_meeting_id,
    target_related_compliance_task_id,
    target_related_assessment_id,
    document_storage_provider,
    document_storage_bucket,
    document_storage_path,
    document_content_type,
    document_size_bytes,
    document_checksum,
    document_effective_date,
    document_expiration_date,
    document_status,
    actor_profile_id,
    actor_profile_id,
    actor_profile_id,
    case when document_status = 'deleted' then now() else null end,
    case when document_status = 'deleted' then actor_profile_id else null end
  )
  returning *
  into created_document;

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
    target_community_id,
    actor_profile_id,
    'user',
    'document.metadata.create',
    'documents',
    created_document.id,
    null,
    app.document_metadata_json(created_document)
  );

  return jsonb_build_object(
    'status', 'created',
    'record', app.document_metadata_json(created_document)
  );
end;
$$;

create or replace function public.update_document_metadata(
  target_community_id uuid,
  target_document_id uuid,
  document_title text default null,
  document_description text default null,
  document_category text default null,
  document_visibility_value text default null,
  target_related_property_id uuid default null,
  target_related_vendor_id uuid default null,
  target_related_meeting_id uuid default null,
  target_related_compliance_task_id uuid default null,
  target_related_assessment_id uuid default null,
  document_storage_provider text default null,
  document_storage_bucket text default null,
  document_storage_path text default null,
  document_content_type text default null,
  document_size_bytes bigint default null,
  document_checksum text default null,
  document_effective_date date default null,
  document_expiration_date date default null,
  document_status text default null,
  clear_description boolean default false,
  clear_related_property_id boolean default false,
  clear_related_vendor_id boolean default false,
  clear_related_meeting_id boolean default false,
  clear_related_compliance_task_id boolean default false,
  clear_related_assessment_id boolean default false,
  clear_checksum boolean default false,
  clear_effective_date boolean default false,
  clear_expiration_date boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path = public, app
as $$
declare
  actor_profile_id uuid;
  existing_document public.documents%rowtype;
  updated_document public.documents%rowtype;
  property_record public.properties%rowtype;
  assessment_record public.assessments%rowtype;
  new_title text;
  new_description text;
  new_category text;
  new_visibility text;
  new_related_property_id uuid;
  new_related_vendor_id uuid;
  new_related_meeting_id uuid;
  new_related_compliance_task_id uuid;
  new_related_assessment_id uuid;
  new_storage_provider text;
  new_storage_bucket text;
  new_storage_path text;
  new_content_type text;
  new_size_bytes bigint;
  new_checksum text;
  new_effective_date date;
  new_expiration_date date;
  new_status text;
begin
  document_title := case
    when document_title is null then null
    else btrim(document_title)
  end;
  document_description := case
    when document_description is null then null
    else nullif(btrim(document_description), '')
  end;
  document_category := case
    when document_category is null then null
    else btrim(document_category)
  end;
  document_visibility_value := case
    when document_visibility_value is null then null
    else btrim(document_visibility_value)
  end;
  document_storage_provider := case
    when document_storage_provider is null then null
    else btrim(document_storage_provider)
  end;
  document_storage_bucket := case
    when document_storage_bucket is null then null
    else btrim(document_storage_bucket)
  end;
  document_storage_path := case
    when document_storage_path is null then null
    else btrim(document_storage_path)
  end;
  document_content_type := case
    when document_content_type is null then null
    else btrim(document_content_type)
  end;
  document_checksum := case
    when document_checksum is null then null
    else nullif(btrim(document_checksum), '')
  end;
  document_status := case
    when document_status is null then null
    else btrim(document_status)
  end;

  actor_profile_id := app.current_profile_id();

  if actor_profile_id is null
    or not app.has_permission(target_community_id, 'admin.documents.manage')
  then
    return jsonb_build_object('status', 'permission_denied');
  end if;

  select *
  into existing_document
  from public.documents
  where id = target_document_id
    and community_id = target_community_id
  for update;

  if not found then
    return jsonb_build_object('status', 'unavailable');
  end if;

  new_title := case
    when document_title is null then existing_document.title
    else btrim(document_title)
  end;
  new_description := case
    when clear_description then null
    when document_description is null then existing_document.description
    else document_description
  end;
  new_category := case
    when document_category is null then existing_document.category
    else btrim(document_category)
  end;
  new_visibility := coalesce(document_visibility_value, existing_document.visibility::text);
  new_related_property_id := case
    when clear_related_property_id then null
    when target_related_property_id is null then existing_document.related_property_id
    else target_related_property_id
  end;
  new_related_vendor_id := case
    when clear_related_vendor_id then null
    when target_related_vendor_id is null then existing_document.related_vendor_id
    else target_related_vendor_id
  end;
  new_related_meeting_id := case
    when clear_related_meeting_id then null
    when target_related_meeting_id is null then existing_document.related_meeting_id
    else target_related_meeting_id
  end;
  new_related_compliance_task_id := case
    when clear_related_compliance_task_id then null
    when target_related_compliance_task_id is null then existing_document.related_compliance_task_id
    else target_related_compliance_task_id
  end;
  new_related_assessment_id := case
    when clear_related_assessment_id then null
    when target_related_assessment_id is null then existing_document.related_assessment_id
    else target_related_assessment_id
  end;
  new_storage_provider := coalesce(document_storage_provider, existing_document.storage_provider);
  new_storage_bucket := case
    when document_storage_bucket is null then existing_document.storage_bucket
    else btrim(document_storage_bucket)
  end;
  new_storage_path := case
    when document_storage_path is null then existing_document.storage_path
    else btrim(document_storage_path)
  end;
  new_content_type := case
    when document_content_type is null then existing_document.content_type
    else btrim(document_content_type)
  end;
  new_size_bytes := coalesce(document_size_bytes, existing_document.size_bytes);
  new_checksum := case
    when clear_checksum then null
    when document_checksum is null then existing_document.checksum
    else document_checksum
  end;
  new_effective_date := case
    when clear_effective_date then null
    when document_effective_date is null then existing_document.effective_date
    else document_effective_date
  end;
  new_expiration_date := case
    when clear_expiration_date then null
    when document_expiration_date is null then existing_document.expiration_date
    else document_expiration_date
  end;
  new_status := coalesce(document_status, existing_document.status);

  if new_title = ''
    or length(new_title) > 200
    or new_category = ''
    or length(new_category) > 120
    or new_visibility not in (
      'public',
      'resident',
      'board',
      'vendor',
      'property_specific',
      'admin'
    )
    or new_status not in ('active', 'archived', 'deleted')
    or new_storage_provider not in ('supabase_storage', 'cloudflare_r2', 's3')
    or new_storage_bucket = ''
    or length(new_storage_bucket) > 120
    or new_storage_path = ''
    or length(new_storage_path) > 1024
    or left(new_storage_path, 1) = '/'
    or position(chr(92) in new_storage_path) > 0
    or new_storage_path ~ '(^|/)\.\.(/|$)'
    or new_content_type = ''
    or length(new_content_type) > 120
    or new_size_bytes <= 0
    or (
      new_checksum is not null
      and (
        btrim(new_checksum) = ''
        or length(btrim(new_checksum)) > 128
      )
    )
    or (
      new_effective_date is not null
      and new_expiration_date is not null
      and new_expiration_date < new_effective_date
    )
    or (
      new_visibility = 'property_specific'
      and new_related_property_id is null
    )
  then
    return jsonb_build_object('status', 'invalid');
  end if;

  if new_related_property_id is not null then
    select *
    into property_record
    from public.properties
    where id = new_related_property_id
      and community_id = target_community_id
      and deleted_at is null;

    if not found then
      return jsonb_build_object('status', 'invalid');
    end if;
  end if;

  if new_related_assessment_id is not null then
    select *
    into assessment_record
    from public.assessments
    where id = new_related_assessment_id
      and community_id = target_community_id;

    if not found
      or (
        new_related_property_id is not null
        and assessment_record.property_id <> new_related_property_id
      )
    then
      return jsonb_build_object('status', 'invalid');
    end if;
  end if;

  update public.documents
  set
    title = new_title,
    description = new_description,
    category = new_category,
    visibility = new_visibility::document_visibility,
    related_property_id = new_related_property_id,
    related_vendor_id = new_related_vendor_id,
    related_meeting_id = new_related_meeting_id,
    related_compliance_task_id = new_related_compliance_task_id,
    related_assessment_id = new_related_assessment_id,
    storage_provider = new_storage_provider,
    storage_bucket = new_storage_bucket,
    storage_path = new_storage_path,
    content_type = new_content_type,
    size_bytes = new_size_bytes,
    checksum = new_checksum,
    effective_date = new_effective_date,
    expiration_date = new_expiration_date,
    status = new_status,
    updated_by = actor_profile_id,
    deleted_at = case
      when new_status = 'deleted' and existing_document.deleted_at is null then now()
      when new_status = 'deleted' then existing_document.deleted_at
      else null
    end,
    deleted_by = case
      when new_status = 'deleted' then coalesce(existing_document.deleted_by, actor_profile_id)
      else null
    end
  where id = target_document_id
    and community_id = target_community_id
  returning *
  into updated_document;

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
    target_community_id,
    actor_profile_id,
    'user',
    case
      when existing_document.visibility <> updated_document.visibility
        or existing_document.status <> updated_document.status
      then 'document.metadata.visibility_or_status_change'
      else 'document.metadata.update'
    end,
    'documents',
    updated_document.id,
    app.document_metadata_json(existing_document),
    app.document_metadata_json(updated_document)
  );

  return jsonb_build_object(
    'status', 'updated',
    'record', app.document_metadata_json(updated_document),
    'previous_visibility', existing_document.visibility,
    'previous_status', existing_document.status
  );
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

revoke all on function public.set_documents_updated_at() from public, anon, authenticated;
revoke all on function public.validate_document_metadata_scope() from public, anon, authenticated;
revoke all on function app.document_metadata_json(public.documents) from public, anon, authenticated;
revoke all on function app.can_read_document(uuid) from public, anon, authenticated;

revoke all on function public.create_document_metadata(
  uuid,
  text,
  text,
  text,
  text,
  uuid,
  uuid,
  uuid,
  uuid,
  uuid,
  text,
  text,
  text,
  text,
  bigint,
  text,
  date,
  date,
  text
) from public, anon;

revoke all on function public.update_document_metadata(
  uuid,
  uuid,
  text,
  text,
  text,
  text,
  uuid,
  uuid,
  uuid,
  uuid,
  uuid,
  text,
  text,
  text,
  text,
  bigint,
  text,
  date,
  date,
  text,
  boolean,
  boolean,
  boolean,
  boolean,
  boolean,
  boolean,
  boolean,
  boolean,
  boolean
) from public, anon;

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

grant execute on function public.create_document_metadata(
  uuid,
  text,
  text,
  text,
  text,
  uuid,
  uuid,
  uuid,
  uuid,
  uuid,
  text,
  text,
  text,
  text,
  bigint,
  text,
  date,
  date,
  text
) to authenticated;

grant execute on function public.update_document_metadata(
  uuid,
  uuid,
  text,
  text,
  text,
  text,
  uuid,
  uuid,
  uuid,
  uuid,
  uuid,
  text,
  text,
  text,
  text,
  bigint,
  text,
  date,
  date,
  text,
  boolean,
  boolean,
  boolean,
  boolean,
  boolean,
  boolean,
  boolean,
  boolean,
  boolean
) to authenticated;

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
