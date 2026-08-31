do $$
begin
  create type compliance_status as enum (
    'upcoming',
    'in_progress',
    'ready_for_review',
    'completed',
    'blocked',
    'deferred',
    'overdue',
    'legal_review_required'
  );
exception
  when duplicate_object then null;
end;
$$;

update public.roles
set
  permissions = case
    when key = 'legal_reviewer' and 'legal.workflow.review' = any(permissions) then permissions
    when key = 'legal_reviewer' then permissions || array['legal.workflow.review']::text[]
    when 'admin.compliance.manage' = any(permissions) then permissions
    else permissions || array['admin.compliance.manage']::text[]
  end,
  updated_at = now()
where key in ('admin', 'board_member', 'legal_reviewer');

create table if not exists public.compliance_calendar_events (
  id uuid primary key default gen_random_uuid(),
  community_id uuid not null references public.communities(id) on delete cascade,
  type text not null check (type in ('annual_meeting', 'board_meeting', 'financial_statement', 'records_request', 'assessment_due', 'delinquency_review', 'lien_review', 'fine_hearing', 'audit_review', 'custom')),
  title text not null,
  description text,
  related_property_id uuid references public.properties(id),
  related_meeting_id uuid,
  related_records_request_id uuid,
  related_assessment_id uuid references public.assessments(id),
  related_lien_case_id uuid,
  related_fine_case_id uuid,
  due_at timestamptz not null,
  starts_at timestamptz,
  status compliance_status not null default 'upcoming',
  priority text not null default 'normal' check (priority in ('low', 'normal', 'high', 'critical')),
  legal_sensitive boolean not null default false,
  assigned_profile_ids uuid[] not null default '{}',
  completed_at timestamptz,
  completed_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint compliance_calendar_events_title_check check (
    btrim(title) <> ''
    and length(btrim(title)) <= 200
  ),
  constraint compliance_calendar_events_description_check check (
    description is null
    or length(btrim(description)) <= 5000
  ),
  constraint compliance_calendar_events_due_range_check check (
    starts_at is null
    or starts_at <= due_at
  )
);

create index if not exists compliance_due_idx
  on public.compliance_calendar_events(community_id, due_at, status);

create index if not exists compliance_type_due_idx
  on public.compliance_calendar_events(community_id, type, due_at);

create index if not exists compliance_legal_idx
  on public.compliance_calendar_events(community_id, legal_sensitive, status);

create index if not exists compliance_assigned_gin_idx
  on public.compliance_calendar_events using gin(assigned_profile_ids);

create table if not exists public.compliance_tasks (
  id uuid primary key default gen_random_uuid(),
  community_id uuid not null references public.communities(id) on delete cascade,
  compliance_event_id uuid not null references public.compliance_calendar_events(id) on delete cascade,
  title text not null,
  description text,
  type text not null check (type in ('notice', 'document_upload', 'review', 'mailing', 'hearing', 'approval', 'deadline', 'custom')),
  status text not null default 'todo' check (status in ('todo', 'in_progress', 'done', 'blocked', 'deferred')),
  due_at timestamptz,
  assigned_to uuid references public.profiles(id),
  evidence jsonb not null default '[]'::jsonb,
  completed_at timestamptz,
  completed_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint compliance_tasks_title_check check (
    btrim(title) <> ''
    and length(btrim(title)) <= 200
  ),
  constraint compliance_tasks_evidence_check check (
    jsonb_typeof(evidence) = 'array'
  )
);

create index if not exists compliance_tasks_event_idx
  on public.compliance_tasks(community_id, compliance_event_id, status);

create index if not exists compliance_tasks_assigned_idx
  on public.compliance_tasks(community_id, assigned_to, due_at);

create index if not exists compliance_tasks_status_due_idx
  on public.compliance_tasks(community_id, status, due_at);

alter table public.compliance_calendar_events enable row level security;
alter table public.compliance_tasks enable row level security;

revoke all on public.compliance_calendar_events from anon, authenticated;
revoke all on public.compliance_tasks from anon, authenticated;
