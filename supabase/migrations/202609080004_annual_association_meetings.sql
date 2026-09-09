create table if not exists public.annual_association_meetings (
  id uuid primary key default gen_random_uuid(),
  community_id uuid not null references public.communities(id) on delete cascade,
  compliance_event_id uuid references public.compliance_calendar_events(id) on delete set null,
  meeting_at timestamptz not null,
  timezone text not null default 'America/New_York',
  location text not null,
  agenda text not null default '',
  status text not null default 'draft' check (status in ('draft', 'scheduled', 'notice_pending', 'notice_sent', 'held', 'cancelled', 'completed')),
  notice_earliest_at timestamptz not null,
  notice_latest_at timestamptz not null,
  notice_sent_at timestamptz,
  notice_sent_by uuid references public.profiles(id),
  notice_override_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint annual_meeting_location_check check (btrim(location) <> '' and length(btrim(location)) <= 500),
  constraint annual_meeting_agenda_check check (length(agenda) <= 10000),
  constraint annual_meeting_notice_window_check check (notice_earliest_at <= notice_latest_at)
);

create index if not exists annual_meetings_community_date_idx
  on public.annual_association_meetings(community_id, meeting_at);

create unique index if not exists annual_meetings_compliance_event_idx
  on public.annual_association_meetings(compliance_event_id)
  where compliance_event_id is not null;

create or replace function public.set_annual_meetings_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_annual_meetings_updated_at on public.annual_association_meetings;
create trigger set_annual_meetings_updated_at
before update on public.annual_association_meetings
for each row execute function public.set_annual_meetings_updated_at();

alter table public.annual_association_meetings enable row level security;
revoke all on public.annual_association_meetings from anon, authenticated;

create or replace function public.list_annual_association_meetings(target_community_slug text)
returns jsonb language plpgsql security definer set search_path = public, app as $$
declare
  community_row public.communities%rowtype;
  meetings jsonb;
begin
  select * into community_row from public.communities where slug = nullif(btrim(target_community_slug), '');
  if community_row.id is null or not app.has_permission(community_row.id, 'admin.meetings.manage') then
    return jsonb_build_object('status', 'permission_denied');
  end if;
  select coalesce(jsonb_agg(to_jsonb(meeting) order by meeting.meeting_at), '[]'::jsonb)
  into meetings from public.annual_association_meetings meeting where meeting.community_id = community_row.id;
  return jsonb_build_object('status', 'ok', 'meetings', meetings);
end;
$$;

create or replace function public.create_annual_association_meeting(
  target_community_slug text,
  meeting_at_value timestamptz,
  location_value text,
  agenda_value text,
  status_value text default 'draft'
)
returns jsonb language plpgsql security definer set search_path = public, app as $$
declare
  community_row public.communities%rowtype;
  settings_row public.community_settings%rowtype;
  meeting_row public.annual_association_meetings%rowtype;
  event_row public.compliance_calendar_events%rowtype;
begin
  select * into community_row from public.communities where slug = nullif(btrim(target_community_slug), '');
  if community_row.id is null or not app.has_permission(community_row.id, 'admin.meetings.manage') then
    return jsonb_build_object('status', 'permission_denied');
  end if;
  select * into settings_row from public.community_settings where community_id = community_row.id;
  if meeting_at_value is null or btrim(coalesce(location_value, '')) = ''
    or status_value not in ('draft', 'scheduled', 'notice_pending') then
    return jsonb_build_object('status', 'invalid');
  end if;
  insert into public.compliance_calendar_events (community_id, type, title, description, due_at, starts_at, status)
  values (community_row.id, 'annual_meeting', 'Annual association meeting', nullif(btrim(agenda_value), ''), meeting_at_value, meeting_at_value, 'upcoming')
  returning * into event_row;
  insert into public.annual_association_meetings (
    community_id, compliance_event_id, meeting_at, timezone, location, agenda, status,
    notice_earliest_at, notice_latest_at
  ) values (
    community_row.id, event_row.id, meeting_at_value, community_row.timezone, btrim(location_value), coalesce(agenda_value, ''), status_value,
    meeting_at_value - make_interval(days => coalesce(settings_row.meeting_notice_earliest_days, 60)),
    meeting_at_value - make_interval(days => coalesce(settings_row.meeting_notice_latest_days, 10))
  ) returning * into meeting_row;
  return jsonb_build_object('status', 'created', 'record', to_jsonb(meeting_row));
exception when check_violation or foreign_key_violation then
  return jsonb_build_object('status', 'invalid');
end;
$$;

create or replace function public.mark_annual_association_notice_sent(
  target_meeting_id uuid,
  notice_at_value timestamptz,
  override_reason_value text default null
)
returns jsonb language plpgsql security definer set search_path = public, app as $$
declare
  meeting_row public.annual_association_meetings%rowtype;
  actor_id uuid;
begin
  actor_id := app.current_profile_id();
  select * into meeting_row from public.annual_association_meetings where id = target_meeting_id;
  if meeting_row.id is null or actor_id is null or not app.has_permission(meeting_row.community_id, 'admin.meetings.manage') then
    return jsonb_build_object('status', 'permission_denied');
  end if;
  if notice_at_value is null or (notice_at_value < meeting_row.notice_earliest_at or notice_at_value > meeting_row.notice_latest_at)
    and nullif(btrim(override_reason_value), '') is null then
    return jsonb_build_object('status', 'notice_out_of_window');
  end if;
  update public.annual_association_meetings
  set status = 'notice_sent', notice_sent_at = notice_at_value, notice_sent_by = actor_id,
      notice_override_reason = nullif(btrim(override_reason_value), ''), updated_at = now()
  where id = target_meeting_id returning * into meeting_row;
  return jsonb_build_object('status', 'updated', 'record', to_jsonb(meeting_row));
end;
$$;

revoke all on function public.list_annual_association_meetings(text) from public, anon, authenticated;
revoke all on function public.create_annual_association_meeting(text, timestamptz, text, text, text) from public, anon, authenticated;
revoke all on function public.mark_annual_association_notice_sent(uuid, timestamptz, text) from public, anon, authenticated;
grant execute on function public.list_annual_association_meetings(text) to authenticated;
grant execute on function public.create_annual_association_meeting(text, timestamptz, text, text, text) to authenticated;
grant execute on function public.mark_annual_association_notice_sent(uuid, timestamptz, text) to authenticated;