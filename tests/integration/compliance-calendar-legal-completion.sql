\set ON_ERROR_STOP on

begin;

-- Keep the integration test deterministic without changing persisted permissions.
create or replace function app.has_permission(
  target_community_id uuid,
  permission_key text,
  target_scope text default null,
  target_scope_id uuid default null
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select permission_key = 'legal.workflow.review'
    and current_setting('test.allow_legal_review', true) = 'on';
$$;

select set_config('test.allow_legal_review', 'off', true);

create temporary table compliance_test_ids (
  community_id uuid not null,
  event_id uuid not null,
  task_id uuid not null
) on commit drop;

do $$
declare
  test_community_id uuid;
  test_event_id uuid;
  test_task_id uuid;
begin
  select id into test_community_id
  from public.communities
  where slug = 'spring-meadow-community';

  if test_community_id is null then
    raise exception 'Expected the Spring Meadow community fixture to exist';
  end if;

  insert into public.compliance_calendar_events (
    community_id,
    type,
    title,
    due_at,
    legal_sensitive
  ) values (
    test_community_id,
    'custom',
    'Integration test legal review event',
    now() + interval '1 day',
    true
  )
  returning id into test_event_id;

  insert into public.compliance_tasks (
    community_id,
    compliance_event_id,
    title,
    type,
    status,
    evidence
  ) values (
    test_community_id,
    test_event_id,
    'Integration test legal review task',
    'review',
    'todo',
    '[{"note":"Evidence fixture"}]'::jsonb
  )
  returning id into test_task_id;

  insert into compliance_test_ids values (test_community_id, test_event_id, test_task_id);
end;
$$;

-- The trigger must reject completion when reviewer permission is absent.
do $$
declare
  test_task_id uuid;
begin
  select task_id into test_task_id from compliance_test_ids;

  begin
    update public.compliance_tasks
    set status = 'done'
    where id = test_task_id;
    raise exception 'Expected legal-sensitive completion to be rejected';
  exception
    when insufficient_privilege then
      null;
  end;
end;
$$;

-- The same completion must succeed when reviewer permission is present.
select set_config('test.allow_legal_review', 'on', true);

update public.compliance_tasks
set status = 'done'
where id = (select task_id from compliance_test_ids);

DO $$
begin
  if not exists (
    select 1
    from public.compliance_tasks
    where id = (select task_id from compliance_test_ids)
      and status = 'done'
  ) then
    raise exception 'Expected legal-sensitive completion to succeed for reviewer';
  end if;
end;
$$;

rollback;
