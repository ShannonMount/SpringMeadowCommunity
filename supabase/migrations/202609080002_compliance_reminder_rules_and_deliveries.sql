create table if not exists public.compliance_reminder_rules (
  id uuid primary key default gen_random_uuid(),
  community_id uuid not null references public.communities(id) on delete cascade,
  name text not null,
  reminder_type text not null check (reminder_type in ('compliance_event', 'compliance_task')),
  days_before_due integer not null check (days_before_due >= 0 and days_before_due <= 365),
  recipient_role text not null default 'board_member',
  enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (community_id, name)
);

create table if not exists public.compliance_reminder_deliveries (
  id uuid primary key default gen_random_uuid(),
  community_id uuid not null references public.communities(id) on delete cascade,
  reminder_rule_id uuid not null references public.compliance_reminder_rules(id) on delete cascade,
  compliance_event_id uuid references public.compliance_calendar_events(id) on delete cascade,
  compliance_task_id uuid references public.compliance_tasks(id) on delete cascade,
  recipient_profile_id uuid references public.profiles(id),
  recipient_email citext not null,
  due_occurrence timestamptz not null,
  idempotency_key text not null unique,
  status text not null default 'queued' check (status in ('queued', 'sent', 'failed', 'suppressed')),
  provider_message_id text,
  error text,
  attempt_count integer not null default 1 check (attempt_count >= 1),
  sent_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint compliance_reminder_delivery_record_check check (
    (compliance_event_id is not null and compliance_task_id is null)
    or (compliance_event_id is null and compliance_task_id is not null)
  ),
  unique (reminder_rule_id, compliance_event_id, compliance_task_id, due_occurrence, recipient_profile_id)
);

create index if not exists compliance_reminder_rules_due_idx
  on public.compliance_reminder_rules(community_id, enabled, days_before_due);

create index if not exists compliance_reminder_deliveries_status_idx
  on public.compliance_reminder_deliveries(community_id, status, created_at desc);

create index if not exists compliance_reminder_deliveries_event_idx
  on public.compliance_reminder_deliveries(compliance_event_id)
  where compliance_event_id is not null;

create index if not exists compliance_reminder_deliveries_task_idx
  on public.compliance_reminder_deliveries(compliance_task_id)
  where compliance_task_id is not null;

create or replace function public.set_compliance_reminder_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_compliance_reminder_rules_updated_at on public.compliance_reminder_rules;
create trigger set_compliance_reminder_rules_updated_at
before update on public.compliance_reminder_rules
for each row execute function public.set_compliance_reminder_updated_at();

drop trigger if exists set_compliance_reminder_deliveries_updated_at on public.compliance_reminder_deliveries;
create trigger set_compliance_reminder_deliveries_updated_at
before update on public.compliance_reminder_deliveries
for each row execute function public.set_compliance_reminder_updated_at();

alter table public.compliance_reminder_rules enable row level security;
alter table public.compliance_reminder_deliveries enable row level security;
revoke all on public.compliance_reminder_rules from anon, authenticated;
revoke all on public.compliance_reminder_deliveries from anon, authenticated;