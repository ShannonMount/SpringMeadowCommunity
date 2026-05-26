create table if not exists public.assessment_cycles (
  id uuid primary key default gen_random_uuid(),
  community_id uuid not null references public.communities(id) on delete cascade,
  name text not null,
  type text not null check (type in ('annual', 'quarterly', 'monthly', 'special')),
  status text not null default 'draft' check (status in ('draft', 'active', 'closed', 'archived')),
  period_start date not null,
  period_end date not null,
  due_date date not null,
  default_amount_cents integer not null check (default_amount_cents > 0),
  currency text not null default 'USD' check (currency = 'USD'),
  late_fee jsonb,
  interest jsonb,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint assessment_cycles_period_check check (period_end >= period_start)
);

create index if not exists assessment_cycles_status_due_idx
  on public.assessment_cycles(community_id, status, due_date);

create index if not exists assessment_cycles_type_period_idx
  on public.assessment_cycles(community_id, type, period_start desc);

create table if not exists public.assessments (
  id uuid primary key default gen_random_uuid(),
  community_id uuid not null references public.communities(id) on delete cascade,
  property_id uuid not null references public.properties(id) on delete cascade,
  assessment_cycle_id uuid references public.assessment_cycles(id),
  type text not null check (type in ('regular_dues', 'special_assessment', 'late_fee', 'interest', 'fine', 'damage_assessment', 'manual_adjustment')),
  description text not null,
  amount_cents integer not null check (amount_cents >= 0),
  paid_cents integer not null default 0 check (paid_cents >= 0),
  balance_cents integer not null check (balance_cents >= 0),
  currency text not null default 'USD' check (currency = 'USD'),
  due_date date not null,
  status text not null default 'open'
    check (status in ('draft', 'open', 'partially_paid', 'paid', 'overdue', 'waived', 'disputed', 'void')),
  source_workflow_table text,
  source_workflow_id uuid,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint assessments_paid_not_above_amount check (paid_cents <= amount_cents),
  constraint assessments_balance_math check (balance_cents = amount_cents - paid_cents)
);

create index if not exists assessments_property_due_idx
  on public.assessments(community_id, property_id, due_date desc);

create index if not exists assessments_status_due_idx
  on public.assessments(community_id, status, due_date);

create index if not exists assessments_cycle_idx
  on public.assessments(community_id, assessment_cycle_id);

create or replace function public.set_assessment_cycles_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_assessment_cycles_updated_at on public.assessment_cycles;
create trigger set_assessment_cycles_updated_at
  before update on public.assessment_cycles
  for each row
  execute function public.set_assessment_cycles_updated_at();

create or replace function public.set_assessments_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_assessments_updated_at on public.assessments;
create trigger set_assessments_updated_at
  before update on public.assessments
  for each row
  execute function public.set_assessments_updated_at();

create or replace function public.validate_assessment_community_scope()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  property_scope_mismatch boolean;
  cycle_scope_mismatch boolean;
begin
  select properties.community_id <> new.community_id
  into property_scope_mismatch
  from public.properties
  where properties.id = new.property_id;

  if coalesce(property_scope_mismatch, true) then
    raise exception 'assessment property scope mismatch';
  end if;

  if new.assessment_cycle_id is not null then
    select assessment_cycles.community_id <> new.community_id
    into cycle_scope_mismatch
    from public.assessment_cycles
    where assessment_cycles.id = new.assessment_cycle_id;

    if coalesce(cycle_scope_mismatch, true) then
      raise exception 'assessment cycle scope mismatch';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists validate_assessment_community_scope on public.assessments;
create trigger validate_assessment_community_scope
  before insert or update on public.assessments
  for each row
  execute function public.validate_assessment_community_scope();

create or replace function app.recalculate_property_assessment_summary(
  target_community_id uuid,
  target_property_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  summary_balance integer;
  summary_next_due date;
  has_overdue boolean;
  has_due_soon boolean;
begin
  select
    coalesce(sum(balance_cents) filter (
      where status in ('open', 'partially_paid', 'overdue', 'disputed')
    ), 0),
    min(due_date) filter (
      where balance_cents > 0
        and status in ('open', 'partially_paid', 'overdue', 'disputed')
    ),
    coalesce(bool_or(
      balance_cents > 0
      and due_date < current_date
      and status in ('open', 'partially_paid', 'overdue', 'disputed')
    ), false),
    coalesce(bool_or(
      balance_cents > 0
      and due_date >= current_date
      and due_date <= current_date + 30
      and status in ('open', 'partially_paid', 'overdue', 'disputed')
    ), false)
  into summary_balance, summary_next_due, has_overdue, has_due_soon
  from public.assessments
  where community_id = target_community_id
    and property_id = target_property_id;

  update public.properties
  set
    current_balance_cents = summary_balance,
    next_due_date = summary_next_due,
    delinquency_status = case
      when summary_balance <= 0 then 'current'
      when has_overdue then 'overdue'
      when has_due_soon then 'due_soon'
      else 'current'
    end,
    updated_at = now()
  where id = target_property_id
    and community_id = target_community_id;
end;
$$;

alter table public.assessment_cycles enable row level security;
alter table public.assessments enable row level security;

drop policy if exists "manage assessment cycles" on public.assessment_cycles;
drop policy if exists "read assessment cycles for managers" on public.assessment_cycles;
create policy "read assessment cycles for managers"
  on public.assessment_cycles
  for select
  to authenticated
  using (app.has_permission(community_id, 'admin.assessments.manage'));

drop policy if exists "manage assessments" on public.assessments;
drop policy if exists "read assessments for managers" on public.assessments;
create policy "read assessments for managers"
  on public.assessments
  for select
  to authenticated
  using (app.has_permission(community_id, 'admin.assessments.manage'));

update public.roles
set
  permissions = case
    when 'admin.assessments.manage' = any(permissions) then permissions
    else permissions || array['admin.assessments.manage']::text[]
  end,
  updated_at = now()
where key = 'admin';

create or replace function public.create_assessment_cycle(
  target_community_id uuid,
  cycle_name text,
  cycle_type text,
  cycle_period_start date,
  cycle_period_end date,
  cycle_due_date date,
  cycle_default_amount_cents integer,
  cycle_currency text default 'USD',
  cycle_late_fee jsonb default null,
  cycle_interest jsonb default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  actor_profile_id uuid;
  created_cycle_id uuid;
begin
  actor_profile_id := app.current_profile_id();

  if actor_profile_id is null
    or not app.has_permission(target_community_id, 'admin.assessments.manage')
  then
    return jsonb_build_object('status', 'unavailable');
  end if;

  if cycle_name is null
    or btrim(cycle_name) = ''
    or cycle_type not in ('annual', 'quarterly', 'monthly', 'special')
    or cycle_period_start is null
    or cycle_period_end is null
    or cycle_period_end < cycle_period_start
    or cycle_due_date is null
    or cycle_default_amount_cents is null
    or cycle_default_amount_cents <= 0
    or cycle_currency <> 'USD'
  then
    return jsonb_build_object('status', 'unavailable');
  end if;

  insert into public.assessment_cycles (
    community_id,
    name,
    type,
    period_start,
    period_end,
    due_date,
    default_amount_cents,
    currency,
    late_fee,
    interest,
    created_by
  )
  values (
    target_community_id,
    btrim(cycle_name),
    cycle_type,
    cycle_period_start,
    cycle_period_end,
    cycle_due_date,
    cycle_default_amount_cents,
    cycle_currency,
    cycle_late_fee,
    cycle_interest,
    actor_profile_id
  )
  returning id into created_cycle_id;

  return jsonb_build_object(
    'status', 'created',
    'assessment_cycle_id', created_cycle_id,
    'community_id', target_community_id,
    'created_by', actor_profile_id
  );
end;
$$;

create or replace function public.create_property_assessment(
  target_community_id uuid,
  target_property_id uuid,
  target_assessment_cycle_id uuid default null,
  assessment_type text default 'regular_dues',
  assessment_description text default '',
  assessment_amount_cents integer default null,
  assessment_due_date date default null,
  assessment_currency text default 'USD',
  assessment_status text default 'open'
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  actor_profile_id uuid;
  property_record public.properties%rowtype;
  cycle_record public.assessment_cycles%rowtype;
  created_assessment_id uuid;
begin
  actor_profile_id := app.current_profile_id();

  if actor_profile_id is null
    or not app.has_permission(target_community_id, 'admin.assessments.manage')
  then
    return jsonb_build_object('status', 'unavailable');
  end if;

  if assessment_type not in ('regular_dues', 'special_assessment', 'late_fee', 'interest', 'fine', 'damage_assessment', 'manual_adjustment')
    or assessment_description is null
    or btrim(assessment_description) = ''
    or assessment_amount_cents is null
    or assessment_amount_cents < 0
    or assessment_due_date is null
    or assessment_currency <> 'USD'
    or assessment_status not in ('draft', 'open')
  then
    return jsonb_build_object('status', 'unavailable');
  end if;

  select *
  into property_record
  from public.properties
  where id = target_property_id
    and community_id = target_community_id
    and status = 'active'
    and deleted_at is null
  for update;

  if not found then
    return jsonb_build_object('status', 'unavailable');
  end if;

  if target_assessment_cycle_id is not null then
    select *
    into cycle_record
    from public.assessment_cycles
    where id = target_assessment_cycle_id
      and community_id = target_community_id
    for update;

    if not found then
      return jsonb_build_object('status', 'unavailable');
    end if;
  end if;

  insert into public.assessments (
    community_id,
    property_id,
    assessment_cycle_id,
    type,
    description,
    amount_cents,
    paid_cents,
    balance_cents,
    currency,
    due_date,
    status,
    created_by
  )
  values (
    target_community_id,
    target_property_id,
    target_assessment_cycle_id,
    assessment_type,
    btrim(assessment_description),
    assessment_amount_cents,
    0,
    assessment_amount_cents,
    assessment_currency,
    assessment_due_date,
    assessment_status,
    actor_profile_id
  )
  returning id into created_assessment_id;

  perform app.recalculate_property_assessment_summary(target_community_id, target_property_id);

  return jsonb_build_object(
    'status', 'created',
    'assessment_id', created_assessment_id,
    'community_id', target_community_id,
    'property_id', target_property_id,
    'assessment_cycle_id', target_assessment_cycle_id,
    'created_by', actor_profile_id
  );
end;
$$;

create or replace function public.generate_property_assessments_for_cycle(
  target_community_id uuid,
  target_assessment_cycle_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  actor_profile_id uuid;
  cycle_record public.assessment_cycles%rowtype;
  generated_count integer;
  property_record record;
begin
  actor_profile_id := app.current_profile_id();

  if actor_profile_id is null
    or not app.has_permission(target_community_id, 'admin.assessments.manage')
  then
    return jsonb_build_object('status', 'unavailable');
  end if;

  select *
  into cycle_record
  from public.assessment_cycles
  where id = target_assessment_cycle_id
    and community_id = target_community_id
  for update;

  if not found then
    return jsonb_build_object('status', 'unavailable');
  end if;

  with inserted as (
    insert into public.assessments (
      community_id,
      property_id,
      assessment_cycle_id,
      type,
      description,
      amount_cents,
      paid_cents,
      balance_cents,
      currency,
      due_date,
      status,
      created_by
    )
    select
      target_community_id,
      properties.id,
      target_assessment_cycle_id,
      case
        when cycle_record.type = 'special' then 'special_assessment'
        else 'regular_dues'
      end,
      cycle_record.name,
      cycle_record.default_amount_cents,
      0,
      cycle_record.default_amount_cents,
      cycle_record.currency,
      cycle_record.due_date,
      'open',
      actor_profile_id
    from public.properties
    where properties.community_id = target_community_id
      and properties.status = 'active'
      and properties.deleted_at is null
      and not exists (
        select 1
        from public.assessments existing
        where existing.community_id = target_community_id
          and existing.property_id = properties.id
          and existing.assessment_cycle_id = target_assessment_cycle_id
      )
    returning property_id
  )
  select count(*)
  into generated_count
  from inserted;

  for property_record in
    select id
    from public.properties
    where community_id = target_community_id
      and status = 'active'
      and deleted_at is null
  loop
    perform app.recalculate_property_assessment_summary(target_community_id, property_record.id);
  end loop;

  return jsonb_build_object(
    'status', 'generated',
    'assessment_cycle_id', target_assessment_cycle_id,
    'community_id', target_community_id,
    'generated_count', generated_count,
    'created_by', actor_profile_id
  );
end;
$$;

create or replace function public.update_assessment(
  target_community_id uuid,
  target_assessment_id uuid,
  assessment_description text default null,
  assessment_due_date date default null,
  assessment_amount_cents integer default null,
  assessment_paid_cents integer default null,
  assessment_status text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  actor_profile_id uuid;
  assessment_record public.assessments%rowtype;
  new_description text;
  new_due_date date;
  new_amount_cents integer;
  new_paid_cents integer;
  new_status text;
begin
  actor_profile_id := app.current_profile_id();

  if actor_profile_id is null
    or not app.has_permission(target_community_id, 'admin.assessments.manage')
  then
    return jsonb_build_object('status', 'unavailable');
  end if;

  select *
  into assessment_record
  from public.assessments
  where id = target_assessment_id
    and community_id = target_community_id
  for update;

  if not found then
    return jsonb_build_object('status', 'unavailable');
  end if;

  new_description := coalesce(nullif(btrim(assessment_description), ''), assessment_record.description);
  new_due_date := coalesce(assessment_due_date, assessment_record.due_date);
  new_amount_cents := coalesce(assessment_amount_cents, assessment_record.amount_cents);
  new_paid_cents := coalesce(assessment_paid_cents, assessment_record.paid_cents);
  new_status := coalesce(assessment_status, assessment_record.status);

  if new_amount_cents < 0
    or new_paid_cents < 0
    or new_paid_cents > new_amount_cents
    or new_due_date is null
    or new_status not in ('draft', 'open', 'partially_paid', 'paid', 'overdue', 'waived', 'disputed', 'void')
  then
    return jsonb_build_object('status', 'unavailable');
  end if;

  update public.assessments
  set
    description = new_description,
    due_date = new_due_date,
    amount_cents = new_amount_cents,
    paid_cents = new_paid_cents,
    balance_cents = new_amount_cents - new_paid_cents,
    status = new_status
  where id = target_assessment_id
    and community_id = target_community_id;

  perform app.recalculate_property_assessment_summary(
    target_community_id,
    assessment_record.property_id
  );

  return jsonb_build_object(
    'status', 'updated',
    'assessment_id', target_assessment_id,
    'community_id', target_community_id,
    'property_id', assessment_record.property_id,
    'previous_amount_cents', assessment_record.amount_cents,
    'previous_paid_cents', assessment_record.paid_cents,
    'previous_balance_cents', assessment_record.balance_cents,
    'previous_status', assessment_record.status,
    'updated_by', actor_profile_id
  );
end;
$$;
