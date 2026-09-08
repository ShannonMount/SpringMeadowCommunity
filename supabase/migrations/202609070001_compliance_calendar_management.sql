create or replace function public.list_compliance_calendar(target_community_slug text)
returns jsonb
language plpgsql
security definer
set search_path = public, app
as $$
declare
  actor_profile_id uuid;
  target_community_id uuid;
  event_records jsonb;
  task_records jsonb;
begin
  actor_profile_id := app.current_profile_id();

  select id into target_community_id
  from public.communities
  where slug = nullif(btrim(target_community_slug), '');

  if actor_profile_id is null
    or target_community_id is null
    or not app.has_permission(target_community_id, 'admin.compliance.manage')
       and not app.has_permission(target_community_id, 'legal.workflow.review')
  then
    return jsonb_build_object('status', 'permission_denied');
  end if;

  select coalesce(jsonb_agg(to_jsonb(events) order by events.due_at asc), '[]'::jsonb)
  into event_records
  from public.compliance_calendar_events events
  where events.community_id = target_community_id;

  select coalesce(jsonb_agg(to_jsonb(tasks) order by tasks.due_at asc nulls last), '[]'::jsonb)
  into task_records
  from public.compliance_tasks tasks
  where tasks.community_id = target_community_id;

  return jsonb_build_object(
    'status', 'ok',
    'community_id', target_community_id,
    'events', event_records,
    'tasks', task_records
  );
end;
$$;

create or replace function public.create_compliance_event(
  target_community_slug text,
  event_type text,
  event_title text,
  event_description text,
  event_due_at timestamptz,
  event_starts_at timestamptz default null,
  event_related_property_id uuid default null,
  event_related_meeting_id uuid default null,
  event_related_records_request_id uuid default null,
  event_related_assessment_id uuid default null,
  event_related_lien_case_id uuid default null,
  event_related_fine_case_id uuid default null,
  event_priority text default 'normal',
  event_legal_sensitive boolean default false,
  event_assigned_profile_ids uuid[] default '{}',
  event_status text default 'upcoming'
)
returns jsonb
language plpgsql
security definer
set search_path = public, app
as $$
declare
  actor_profile_id uuid;
  target_community_id uuid;
  status_value compliance_status;
  created_event public.compliance_calendar_events%rowtype;
begin
  actor_profile_id := app.current_profile_id();

  select id into target_community_id
  from public.communities
  where slug = nullif(btrim(target_community_slug), '');

  if actor_profile_id is null
    or target_community_id is null
    or not app.has_permission(target_community_id, 'admin.compliance.manage')
  then
    return jsonb_build_object('status', 'permission_denied');
  end if;

  begin
    status_value := event_status::compliance_status;
  exception when invalid_text_representation then
    return jsonb_build_object('status', 'invalid');
  end;

  event_title := btrim(coalesce(event_title, ''));
  event_description := nullif(btrim(coalesce(event_description, '')), '');

  if event_title = ''
    or length(event_title) > 200
    or (event_description is not null and length(event_description) > 5000)
    or event_due_at is null
    or (event_starts_at is not null and event_starts_at > event_due_at)
  then
    return jsonb_build_object('status', 'invalid');
  end if;

  insert into public.compliance_calendar_events (
    community_id, type, title, description, due_at, starts_at,
    related_property_id, related_meeting_id, related_records_request_id,
    related_assessment_id, related_lien_case_id, related_fine_case_id,
    priority, legal_sensitive, assigned_profile_ids, status
  ) values (
    target_community_id, event_type, event_title, event_description, event_due_at, event_starts_at,
    event_related_property_id, event_related_meeting_id, event_related_records_request_id,
    event_related_assessment_id, event_related_lien_case_id, event_related_fine_case_id,
    event_priority, coalesce(event_legal_sensitive, false), coalesce(event_assigned_profile_ids, '{}'), status_value
  ) returning * into created_event;

  return jsonb_build_object('status', 'created', 'record', to_jsonb(created_event));
exception when check_violation or invalid_text_representation or foreign_key_violation then
  return jsonb_build_object('status', 'invalid');
end;
$$;

create or replace function public.update_compliance_event(
  target_event_id uuid,
  event_type text,
  event_title text,
  event_description text,
  event_due_at timestamptz,
  event_starts_at timestamptz,
  event_related_property_id uuid,
  event_related_meeting_id uuid,
  event_related_records_request_id uuid,
  event_related_assessment_id uuid,
  event_related_lien_case_id uuid,
  event_related_fine_case_id uuid,
  event_priority text,
  event_legal_sensitive boolean,
  event_assigned_profile_ids uuid[],
  event_status text
)
returns jsonb
language plpgsql
security definer
set search_path = public, app
as $$
declare
  actor_profile_id uuid;
  existing_event public.compliance_calendar_events%rowtype;
  updated_event public.compliance_calendar_events%rowtype;
  status_value compliance_status;
begin
  actor_profile_id := app.current_profile_id();
  select * into existing_event from public.compliance_calendar_events where id = target_event_id;

  if actor_profile_id is null
    or not found
    or not app.has_permission(existing_event.community_id, 'admin.compliance.manage')
  then
    return jsonb_build_object('status', 'permission_denied');
  end if;

  begin
    status_value := event_status::compliance_status;
  exception when invalid_text_representation then
    return jsonb_build_object('status', 'invalid');
  end;

  event_title := btrim(coalesce(event_title, ''));
  event_description := nullif(btrim(coalesce(event_description, '')), '');

  if event_title = ''
    or length(event_title) > 200
    or (event_description is not null and length(event_description) > 5000)
    or event_due_at is null
    or (event_starts_at is not null and event_starts_at > event_due_at)
  then
    return jsonb_build_object('status', 'invalid');
  end if;

  update public.compliance_calendar_events
  set type = event_type,
      title = event_title,
      description = event_description,
      due_at = event_due_at,
      starts_at = event_starts_at,
      related_property_id = event_related_property_id,
      related_meeting_id = event_related_meeting_id,
      related_records_request_id = event_related_records_request_id,
      related_assessment_id = event_related_assessment_id,
      related_lien_case_id = event_related_lien_case_id,
      related_fine_case_id = event_related_fine_case_id,
      priority = event_priority,
      legal_sensitive = coalesce(event_legal_sensitive, false),
      assigned_profile_ids = coalesce(event_assigned_profile_ids, '{}'),
      status = status_value,
      completed_at = case when status_value = 'completed' then coalesce(completed_at, now()) else completed_at end,
      completed_by = case when status_value = 'completed' then coalesce(completed_by, actor_profile_id) else completed_by end,
      updated_at = now()
  where id = target_event_id
  returning * into updated_event;

  return jsonb_build_object('status', 'updated', 'record', to_jsonb(updated_event));
exception when check_violation or invalid_text_representation or foreign_key_violation then
  return jsonb_build_object('status', 'invalid');
end;
$$;

create or replace function public.complete_compliance_event(target_event_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, app
as $$
declare
  actor_profile_id uuid;
  updated_event public.compliance_calendar_events%rowtype;
begin
  actor_profile_id := app.current_profile_id();

  update public.compliance_calendar_events
  set status = 'completed', completed_at = coalesce(completed_at, now()), completed_by = actor_profile_id, updated_at = now()
  where id = target_event_id
    and actor_profile_id is not null
    and app.has_permission(community_id, 'admin.compliance.manage')
  returning * into updated_event;

  if not found then
    return jsonb_build_object('status', 'permission_denied');
  end if;

  return jsonb_build_object('status', 'completed', 'record', to_jsonb(updated_event));
end;
$$;

create or replace function public.create_compliance_task(
  target_event_id uuid,
  task_title text,
  task_description text,
  task_type text,
  task_status text default 'todo',
  task_due_at timestamptz default null,
  task_assigned_to uuid default null,
  task_evidence jsonb default '[]'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public, app
as $$
declare
  actor_profile_id uuid;
  event_community_id uuid;
  created_task public.compliance_tasks%rowtype;
begin
  actor_profile_id := app.current_profile_id();
  select community_id into event_community_id from public.compliance_calendar_events where id = target_event_id;

  if actor_profile_id is null
    or event_community_id is null
    or not app.has_permission(event_community_id, 'admin.compliance.manage')
  then
    return jsonb_build_object('status', 'permission_denied');
  end if;

  task_title := btrim(coalesce(task_title, ''));
  task_description := nullif(btrim(coalesce(task_description, '')), '');

  if task_title = '' or length(task_title) > 200 or jsonb_typeof(coalesce(task_evidence, '[]'::jsonb)) <> 'array' then
    return jsonb_build_object('status', 'invalid');
  end if;

  insert into public.compliance_tasks (
    community_id, compliance_event_id, title, description, type, status, due_at, assigned_to, evidence
  ) values (
    event_community_id, target_event_id, task_title, task_description, task_type, task_status,
    task_due_at, task_assigned_to, coalesce(task_evidence, '[]'::jsonb)
  ) returning * into created_task;

  return jsonb_build_object('status', 'created', 'record', to_jsonb(created_task));
exception when check_violation or invalid_text_representation or foreign_key_violation then
  return jsonb_build_object('status', 'invalid');
end;
$$;

create or replace function public.update_compliance_task(
  target_task_id uuid,
  task_title text,
  task_description text,
  task_type text,
  task_status text,
  task_due_at timestamptz,
  task_assigned_to uuid,
  task_evidence jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public, app
as $$
declare
  actor_profile_id uuid;
  existing_task public.compliance_tasks%rowtype;
  updated_task public.compliance_tasks%rowtype;
begin
  actor_profile_id := app.current_profile_id();
  select * into existing_task from public.compliance_tasks where id = target_task_id;

  if actor_profile_id is null
    or not found
    or not app.has_permission(existing_task.community_id, 'admin.compliance.manage')
  then
    return jsonb_build_object('status', 'permission_denied');
  end if;

  task_title := btrim(coalesce(task_title, ''));
  task_description := nullif(btrim(coalesce(task_description, '')), '');

  if task_title = '' or length(task_title) > 200 or jsonb_typeof(coalesce(task_evidence, '[]'::jsonb)) <> 'array' then
    return jsonb_build_object('status', 'invalid');
  end if;

  update public.compliance_tasks
  set title = task_title,
      description = task_description,
      type = task_type,
      status = task_status,
      due_at = task_due_at,
      assigned_to = task_assigned_to,
      evidence = coalesce(task_evidence, '[]'::jsonb),
      completed_at = case when task_status = 'done' then coalesce(completed_at, now()) else completed_at end,
      completed_by = case when task_status = 'done' then coalesce(completed_by, actor_profile_id) else completed_by end,
      updated_at = now()
  where id = target_task_id
  returning * into updated_task;

  return jsonb_build_object('status', 'updated', 'record', to_jsonb(updated_task));
exception when check_violation or invalid_text_representation or foreign_key_violation then
  return jsonb_build_object('status', 'invalid');
end;
$$;

create or replace function public.complete_compliance_task(target_task_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, app
as $$
declare
  actor_profile_id uuid;
  updated_task public.compliance_tasks%rowtype;
begin
  actor_profile_id := app.current_profile_id();

  update public.compliance_tasks
  set status = 'done', completed_at = coalesce(completed_at, now()), completed_by = actor_profile_id, updated_at = now()
  where id = target_task_id
    and actor_profile_id is not null
    and app.has_permission(community_id, 'admin.compliance.manage')
  returning * into updated_task;

  if not found then
    return jsonb_build_object('status', 'permission_denied');
  end if;

  return jsonb_build_object('status', 'completed', 'record', to_jsonb(updated_task));
end;
$$;

revoke all on function public.list_compliance_calendar(text) from public, anon, authenticated;
revoke all on function public.create_compliance_event(text, text, text, text, timestamptz, timestamptz, uuid, uuid, uuid, uuid, uuid, uuid, text, boolean, uuid[], text) from public, anon, authenticated;
revoke all on function public.update_compliance_event(uuid, text, text, text, timestamptz, timestamptz, uuid, uuid, uuid, uuid, uuid, uuid, text, boolean, uuid[], text) from public, anon, authenticated;
revoke all on function public.complete_compliance_event(uuid) from public, anon, authenticated;
revoke all on function public.create_compliance_task(uuid, text, text, text, text, timestamptz, uuid, jsonb) from public, anon, authenticated;
revoke all on function public.update_compliance_task(uuid, text, text, text, text, timestamptz, uuid, jsonb) from public, anon, authenticated;
revoke all on function public.complete_compliance_task(uuid) from public, anon, authenticated;

grant execute on function public.list_compliance_calendar(text) to authenticated;
grant execute on function public.create_compliance_event(text, text, text, text, timestamptz, timestamptz, uuid, uuid, uuid, uuid, uuid, uuid, text, boolean, uuid[], text) to authenticated;
grant execute on function public.update_compliance_event(uuid, text, text, text, timestamptz, timestamptz, uuid, uuid, uuid, uuid, uuid, uuid, text, boolean, uuid[], text) to authenticated;
grant execute on function public.complete_compliance_event(uuid) to authenticated;
grant execute on function public.create_compliance_task(uuid, text, text, text, text, timestamptz, uuid, jsonb) to authenticated;
grant execute on function public.update_compliance_task(uuid, text, text, text, text, timestamptz, uuid, jsonb) to authenticated;
grant execute on function public.complete_compliance_task(uuid) to authenticated;