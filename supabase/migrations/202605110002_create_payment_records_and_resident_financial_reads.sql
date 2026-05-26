create extension if not exists "citext";

create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(),
  community_id uuid not null references public.communities(id) on delete cascade,
  property_id uuid not null references public.properties(id),
  payer_type text not null check (payer_type in ('resident', 'guest', 'admin_recorded')),
  profile_id uuid references public.profiles(id),
  guest_name text,
  guest_email citext,
  guest_phone text,
  property_account_snapshot text not null,
  property_address_snapshot text not null,
  amount_cents integer not null check (amount_cents > 0),
  currency text not null default 'USD' check (currency = 'USD'),
  fee_policy text not null check (fee_policy in ('payer_pays', 'hoa_pays')),
  processor_fee_cents integer check (processor_fee_cents is null or processor_fee_cents >= 0),
  net_amount_cents integer check (net_amount_cents is null or net_amount_cents >= 0),
  method text not null check (method in ('card', 'ach', 'check', 'cash', 'manual', 'other')),
  status text not null default 'created'
    check (status in ('created', 'pending', 'succeeded', 'failed', 'refunded', 'partially_refunded', 'void')),
  stripe_checkout_session_id text unique,
  stripe_payment_intent_id text unique,
  stripe_charge_id text,
  stripe_customer_id text,
  stripe_receipt_url text,
  receipt_number text unique,
  paid_at timestamptz,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists payments_property_created_idx
  on public.payments(community_id, property_id, created_at desc);

create index if not exists payments_profile_created_idx
  on public.payments(community_id, profile_id, created_at desc);

create index if not exists payments_status_created_idx
  on public.payments(community_id, status, created_at desc);

create table if not exists public.payment_allocations (
  id uuid primary key default gen_random_uuid(),
  community_id uuid not null references public.communities(id) on delete cascade,
  payment_id uuid not null references public.payments(id) on delete cascade,
  assessment_id uuid not null references public.assessments(id),
  amount_cents integer not null check (amount_cents > 0),
  created_at timestamptz not null default now(),
  unique (payment_id, assessment_id)
);

create index if not exists payment_allocations_assessment_idx
  on public.payment_allocations(community_id, assessment_id);

create table if not exists public.payment_events (
  id uuid primary key default gen_random_uuid(),
  community_id uuid references public.communities(id),
  payment_id uuid references public.payments(id),
  provider text not null default 'stripe',
  provider_event_id text not null,
  event_type text not null,
  received_at timestamptz not null default now(),
  processed_at timestamptz,
  processing_status text not null default 'received'
    check (processing_status in ('received', 'processed', 'failed', 'ignored')),
  error text,
  payload_hash text,
  unique (provider, provider_event_id)
);

create index if not exists payment_events_status_idx
  on public.payment_events(processing_status, received_at desc);

drop view if exists public.resident_payment_history;
create view public.resident_payment_history
with (security_invoker = true)
as
select
  payments.id,
  payments.community_id,
  payments.property_id,
  payments.amount_cents,
  payments.currency,
  payments.method,
  payments.status,
  payments.payer_type,
  payments.paid_at,
  payments.receipt_number,
  payments.created_at,
  row_number() over (
    partition by payments.community_id, payments.property_id
    order by payments.paid_at desc nulls last, payments.created_at desc
  ) as resident_history_rank
from public.payments
where payments.status in ('succeeded', 'refunded', 'partially_refunded');

create or replace function public.set_payments_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_payments_updated_at on public.payments;
create trigger set_payments_updated_at
  before update on public.payments
  for each row
  execute function public.set_payments_updated_at();

create or replace function public.validate_payment_community_scope()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  property_scope_mismatch boolean;
begin
  select properties.community_id <> new.community_id
  into property_scope_mismatch
  from public.properties
  where properties.id = new.property_id;

  if coalesce(property_scope_mismatch, true) then
    raise exception 'payment property scope mismatch';
  end if;

  return new;
end;
$$;

drop trigger if exists validate_payment_community_scope on public.payments;
create trigger validate_payment_community_scope
  before insert or update on public.payments
  for each row
  execute function public.validate_payment_community_scope();

create or replace function public.validate_payment_allocation_community_scope()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  payment_scope_mismatch boolean;
  assessment_scope_mismatch boolean;
  payment_property_id uuid;
  assessment_property_id uuid;
begin
  select payments.community_id <> new.community_id, payments.property_id
  into payment_scope_mismatch, payment_property_id
  from public.payments
  where payments.id = new.payment_id;

  if coalesce(payment_scope_mismatch, true) then
    raise exception 'payment allocation payment scope mismatch';
  end if;

  select assessments.community_id <> new.community_id, assessments.property_id
  into assessment_scope_mismatch, assessment_property_id
  from public.assessments
  where assessments.id = new.assessment_id;

  if coalesce(assessment_scope_mismatch, true) then
    raise exception 'payment allocation assessment scope mismatch';
  end if;

  if payment_property_id <> assessment_property_id then
    raise exception 'payment allocation property scope mismatch';
  end if;

  return new;
end;
$$;

drop trigger if exists validate_payment_allocation_community_scope on public.payment_allocations;
create trigger validate_payment_allocation_community_scope
  before insert or update on public.payment_allocations
  for each row
  execute function public.validate_payment_allocation_community_scope();

alter table public.payments enable row level security;
alter table public.payment_allocations enable row level security;
alter table public.payment_events enable row level security;

revoke all on public.payments from anon, authenticated;
revoke all on public.payment_allocations from anon, authenticated;
revoke all on public.payment_events from anon, authenticated;

grant select (
  id,
  community_id,
  property_id,
  amount_cents,
  currency,
  method,
  status,
  payer_type,
  paid_at,
  receipt_number,
  created_at
) on public.payments to authenticated;

grant select on public.resident_payment_history to authenticated;

drop policy if exists "read resident payments" on public.payments;
create policy "read resident payments"
  on public.payments
  for select
  to authenticated
  using (
    payments.status in ('succeeded', 'refunded', 'partially_refunded')
    and exists (
      select 1
      from public.property_memberships pm
      join public.properties linked_property on linked_property.id = pm.property_id
      where pm.community_id = payments.community_id
        and pm.property_id = payments.property_id
        and pm.profile_id = app.current_profile_id()
        and pm.status = 'active'
        and pm.can_view_balance = true
        and linked_property.status = 'active'
        and linked_property.deleted_at is null
    )
  );

drop policy if exists "read resident assessments" on public.assessments;
create policy "read resident assessments"
  on public.assessments
  for select
  to authenticated
  using (
    assessments.status in ('open', 'partially_paid', 'paid', 'overdue', 'waived', 'disputed')
    and exists (
      select 1
      from public.property_memberships pm
      join public.properties linked_property on linked_property.id = pm.property_id
      where pm.community_id = assessments.community_id
        and pm.property_id = assessments.property_id
        and pm.profile_id = app.current_profile_id()
        and pm.status = 'active'
        and pm.can_view_balance = true
        and linked_property.status = 'active'
        and linked_property.deleted_at is null
    )
  );
