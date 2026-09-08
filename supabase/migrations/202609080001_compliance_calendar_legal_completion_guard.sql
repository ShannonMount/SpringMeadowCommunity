create or replace function public.guard_legal_compliance_task_completion()
returns trigger
language plpgsql
security definer
set search_path = public, app
as $$
declare
  event_community_id uuid;
  event_is_legal_sensitive boolean;
begin
  if new.status <> 'done' then
    return new;
  end if;

  select community_id, legal_sensitive
  into event_community_id, event_is_legal_sensitive
  from public.compliance_calendar_events
  where id = new.compliance_event_id;

  if coalesce(event_is_legal_sensitive, false)
    and not app.has_permission(event_community_id, 'legal.workflow.review')
  then
    raise exception 'Legal-sensitive compliance tasks require reviewer permission'
      using errcode = '42501';
  end if;

  return new;
end;
$$;

revoke all on function public.guard_legal_compliance_task_completion() from public, anon, authenticated;

drop trigger if exists compliance_tasks_legal_completion_guard on public.compliance_tasks;

create trigger compliance_tasks_legal_completion_guard
before insert or update of status on public.compliance_tasks
for each row
execute function public.guard_legal_compliance_task_completion();
