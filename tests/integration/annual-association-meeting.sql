\set ON_ERROR_STOP on

begin;

create temporary table annual_meeting_test_ids (community_id uuid, event_id uuid, meeting_id uuid) on commit drop;

do $$
declare
  test_community_id uuid;
  test_event_id uuid;
  test_meeting_id uuid;
  meeting_date timestamptz := '2026-12-31 15:00:00+00';
begin
  select id into test_community_id from public.communities where slug = 'spring-meadow-community';
  if test_community_id is null then raise exception 'Expected Spring Meadow community fixture'; end if;

  insert into public.compliance_calendar_events (community_id, type, title, due_at, starts_at)
  values (test_community_id, 'annual_meeting', 'Integration annual meeting', meeting_date, meeting_date)
  returning id into test_event_id;

  insert into public.annual_association_meetings (
    community_id, compliance_event_id, meeting_at, timezone, location, agenda, status,
    notice_earliest_at, notice_latest_at
  ) values (
    test_community_id, test_event_id, meeting_date, 'America/New_York', 'Community clubhouse', 'Budget agenda', 'scheduled',
    meeting_date - interval '60 days', meeting_date - interval '10 days'
  ) returning id into test_meeting_id;

  insert into annual_meeting_test_ids values (test_community_id, test_event_id, test_meeting_id);
end;
$$;

DO $$
begin
  if not exists (
    select 1 from public.annual_association_meetings meeting
    join public.compliance_calendar_events event on event.id = meeting.compliance_event_id
    where meeting.id = (select meeting_id from annual_meeting_test_ids)
      and event.type = 'annual_meeting'
      and meeting.notice_earliest_at = meeting.meeting_at - interval '60 days'
      and meeting.notice_latest_at = meeting.meeting_at - interval '10 days'
  ) then
    raise exception 'Expected annual meeting linkage and notice window';
  end if;
end;
$$;

rollback;
