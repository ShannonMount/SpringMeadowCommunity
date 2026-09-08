\set ON_ERROR_STOP on

begin;

select set_config('test.allow_reminder', 'on', true);

create temporary table compliance_reminder_test_ids (
  community_id uuid not null,
  rule_id uuid not null,
  event_id uuid not null
) on commit drop;

do $$
declare
  test_community_id uuid;
  test_rule_id uuid;
  test_event_id uuid;
begin
  select id into test_community_id from public.communities where slug = 'spring-meadow-community';

  if test_community_id is null then
    raise exception 'Expected the Spring Meadow community fixture to exist';
  end if;

  insert into public.compliance_reminder_rules (community_id, name, reminder_type, days_before_due)
  values (test_community_id, 'Integration reminder rule', 'compliance_event', 0)
  returning id into test_rule_id;

  insert into public.compliance_calendar_events (community_id, type, title, due_at)
  values (test_community_id, 'custom', 'Integration reminder event', now())
  returning id into test_event_id;

  insert into compliance_reminder_test_ids values (test_community_id, test_rule_id, test_event_id);
end;
$$;

insert into public.compliance_reminder_deliveries (
  community_id, reminder_rule_id, compliance_event_id,
  recipient_email, due_occurrence, idempotency_key, status
)
select community_id, rule_id, event_id,
  'integration@example.invalid', now(), 'integration-reminder-unique-key', 'queued'
from compliance_reminder_test_ids;

do $$
begin
  begin
    insert into public.compliance_reminder_deliveries (
      community_id, reminder_rule_id, compliance_event_id,
      recipient_email, due_occurrence, idempotency_key, status
    )
    select community_id, rule_id, event_id,
      'integration@example.invalid', now(), 'integration-reminder-unique-key', 'queued'
    from compliance_reminder_test_ids;
    raise exception 'Expected duplicate reminder delivery to be rejected';
  exception when unique_violation then
    null;
  end;
end;
$$;

rollback;
