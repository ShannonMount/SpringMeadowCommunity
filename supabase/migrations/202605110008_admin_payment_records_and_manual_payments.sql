alter table public.community_settings
  add column if not exists manual_payments_enabled boolean not null default false;

update public.roles
set
  permissions = case
    when 'admin.payments.manage' = any(permissions) then permissions
    else permissions || array['admin.payments.manage']::text[]
  end,
  updated_at = now()
where key = 'admin';

create table if not exists public.manual_payment_requests (
  id uuid primary key default gen_random_uuid(),
  community_id uuid not null references public.communities(id) on delete cascade,
  request_id uuid not null,
  payment_id uuid references public.payments(id),
  actor_profile_id uuid references public.profiles(id),
  status text not null default 'received'
    check (status in ('received', 'recorded', 'failed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (community_id, request_id)
);

create index if not exists manual_payment_requests_payment_idx
  on public.manual_payment_requests(community_id, payment_id)
  where payment_id is not null;

alter table public.manual_payment_requests enable row level security;

revoke all on public.manual_payment_requests from anon, authenticated;

drop trigger if exists set_manual_payment_requests_updated_at on public.manual_payment_requests;
drop function if exists public.set_manual_payment_requests_updated_at();

create or replace function app.set_manual_payment_requests_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger set_manual_payment_requests_updated_at
  before update on public.manual_payment_requests
  for each row
  execute function app.set_manual_payment_requests_updated_at();

revoke all on function app.set_manual_payment_requests_updated_at() from public, anon, authenticated;

create or replace function public.list_admin_payment_records(
  target_community_id uuid,
  filter_status text default null,
  filter_payer_type text default null,
  filter_method text default null,
  filter_property_id uuid default null,
  filter_from timestamptz default null,
  filter_to timestamptz default null,
  filter_query text default null,
  page_limit integer default 50,
  page_offset integer default 0
)
returns jsonb
language plpgsql
security definer
set search_path = public, app
as $$
declare
  actor_profile_id uuid;
  bounded_limit integer;
  bounded_offset integer;
  manual_enabled boolean;
  search_query text;
  records jsonb;
begin
  actor_profile_id := app.current_profile_id();

  if actor_profile_id is null
    or not app.has_permission(target_community_id, 'admin.payments.manage')
  then
    return jsonb_build_object('status', 'permission_denied');
  end if;

  if filter_status is not null
    and filter_status not in ('created', 'pending', 'succeeded', 'failed', 'refunded', 'partially_refunded', 'void')
  then
    return jsonb_build_object('status', 'invalid');
  end if;

  if filter_payer_type is not null
    and filter_payer_type not in ('resident', 'guest', 'admin_recorded')
  then
    return jsonb_build_object('status', 'invalid');
  end if;

  if filter_method is not null
    and filter_method not in ('card', 'ach', 'check', 'cash', 'manual', 'other')
  then
    return jsonb_build_object('status', 'invalid');
  end if;

  if filter_query is not null
    and length(btrim(filter_query)) > 200
  then
    return jsonb_build_object('status', 'invalid');
  end if;

  bounded_limit := least(greatest(coalesce(page_limit, 50), 1), 100);
  bounded_offset := greatest(coalesce(page_offset, 0), 0);
  search_query := nullif(
    replace(
      replace(
        replace(btrim(coalesce(filter_query, '')), chr(92), chr(92) || chr(92)),
        '%',
        chr(92) || '%'
      ),
      '_',
      chr(92) || '_'
    ),
    ''
  );

  select coalesce(community_settings.manual_payments_enabled, false)
  into manual_enabled
  from public.community_settings
  where community_settings.community_id = target_community_id;

  with allocation_totals as (
    select
      payment_allocations.payment_id,
      coalesce(sum(payment_allocations.amount_cents), 0)::integer as allocated_cents
    from public.payment_allocations
    where payment_allocations.community_id = target_community_id
    group by payment_allocations.payment_id
  ),
  filtered_payments as (
    select
      payments.id,
      payments.community_id,
      payments.property_id,
      properties.address_line1,
      properties.address_line2,
      properties.city,
      properties.state,
      properties.postal_code,
      payments.status,
      payments.payer_type,
      payments.amount_cents,
      payments.currency,
      payments.fee_policy,
      payments.method,
      payments.receipt_number,
      payments.stripe_checkout_session_id,
      payments.stripe_payment_intent_id,
      payments.stripe_charge_id,
      payments.processor_fee_cents,
      payments.net_amount_cents,
      payments.paid_at,
      payments.created_at,
      payments.updated_at,
      coalesce(allocation_totals.allocated_cents, 0) as allocated_cents
    from public.payments
    join public.properties on properties.id = payments.property_id
      and properties.community_id = payments.community_id
    left join allocation_totals on allocation_totals.payment_id = payments.id
    where payments.community_id = target_community_id
      and (filter_status is null or payments.status = filter_status)
      and (filter_payer_type is null or payments.payer_type = filter_payer_type)
      and (filter_method is null or payments.method = filter_method)
      and (filter_property_id is null or payments.property_id = filter_property_id)
      and (filter_from is null or coalesce(payments.paid_at, payments.created_at) >= filter_from)
      and (filter_to is null or coalesce(payments.paid_at, payments.created_at) <= filter_to)
      and (
        search_query is null
        or payments.receipt_number ilike '%' || search_query || '%' escape chr(92)
        or properties.address_line1 ilike '%' || search_query || '%' escape chr(92)
        or properties.city ilike '%' || search_query || '%' escape chr(92)
      )
    order by coalesce(payments.paid_at, payments.created_at) desc, payments.created_at desc, payments.id desc
    limit bounded_limit
    offset bounded_offset
  )
  select coalesce(jsonb_agg(
    jsonb_build_object(
      'id', filtered_payments.id,
      'community_id', filtered_payments.community_id,
      'property_id', filtered_payments.property_id,
      'property_label', concat_ws(', ',
        filtered_payments.address_line1,
        nullif(filtered_payments.address_line2, ''),
        filtered_payments.city,
        filtered_payments.state,
        filtered_payments.postal_code
      ),
      'status', filtered_payments.status,
      'payer_type', filtered_payments.payer_type,
      'amount_cents', filtered_payments.amount_cents,
      'currency', filtered_payments.currency,
      'fee_policy', filtered_payments.fee_policy,
      'method', filtered_payments.method,
      'receipt_number', filtered_payments.receipt_number,
      'stripe_checkout_session_id', filtered_payments.stripe_checkout_session_id,
      'stripe_payment_intent_id', filtered_payments.stripe_payment_intent_id,
      'stripe_charge_id', filtered_payments.stripe_charge_id,
      'processor_fee_cents', filtered_payments.processor_fee_cents,
      'net_amount_cents', filtered_payments.net_amount_cents,
      'paid_at', filtered_payments.paid_at,
      'created_at', filtered_payments.created_at,
      'updated_at', filtered_payments.updated_at,
      'allocated_cents', filtered_payments.allocated_cents,
      'unapplied_cents', greatest(filtered_payments.amount_cents - filtered_payments.allocated_cents, 0)
    )
    order by
      coalesce(filtered_payments.paid_at, filtered_payments.created_at) desc,
      filtered_payments.created_at desc,
      filtered_payments.id desc
    )
  ), '[]'::jsonb)
  into records
  from filtered_payments;

  return jsonb_build_object(
    'status', 'ok',
    'manual_payments_enabled', coalesce(manual_enabled, false),
    'records', records
  );
end;
$$;

create or replace function public.record_manual_payment(
  target_community_id uuid,
  target_property_id uuid,
  request_id uuid,
  payment_amount_cents integer,
  payment_method text,
  payment_paid_at timestamptz default null,
  allocation_input jsonb default '[]'::jsonb,
  payment_reason text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, app
as $$
declare
  actor_profile_id uuid;
  settings_record public.community_settings%rowtype;
  property_record public.properties%rowtype;
  request_record public.manual_payment_requests%rowtype;
  existing_payment public.payments%rowtype;
  existing_allocated_cents integer := 0;
  existing_unapplied_cents integer := 0;
  created_payment_id uuid;
  created_paid_at timestamptz;
  created_receipt_number text;
  payment_fee_policy text;
  latest_succeeded_payment_at timestamptz;
  allocation_record jsonb;
  allocation_assessment_id uuid;
  requested_allocation_cents integer;
  explicit_allocation_total bigint := 0;
  seen_assessment_ids uuid[] := '{}'::uuid[];
  remaining_amount_cents integer;
  allocation_cents integer;
  assessment_record public.assessments%rowtype;
begin
  actor_profile_id := app.current_profile_id();

  if actor_profile_id is null
    or not app.has_permission(target_community_id, 'admin.payments.manage')
  then
    return jsonb_build_object('status', 'permission_denied');
  end if;

  if target_community_id is null
    or record_manual_payment.request_id is null
  then
    return jsonb_build_object('status', 'invalid');
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended(target_community_id::text || ':' || record_manual_payment.request_id::text, 0)
  );

  select *
  into request_record
  from public.manual_payment_requests
  where manual_payment_requests.community_id = target_community_id
    and manual_payment_requests.request_id = record_manual_payment.request_id
  for update;

  if request_record.payment_id is not null then
    select *
    into existing_payment
    from public.payments
    where id = request_record.payment_id;

    select coalesce(sum(amount_cents)::integer, 0)
    into existing_allocated_cents
    from public.payment_allocations
    where payment_id = request_record.payment_id;

    existing_unapplied_cents := greatest(
      coalesce(existing_payment.amount_cents, 0) - existing_allocated_cents,
      0
    );
  end if;

  if request_record.status = 'recorded'
    and request_record.payment_id is not null
  then
    return jsonb_build_object('status', 'recorded',
      'existing', true,
      'payment_id', request_record.payment_id,
      'allocated_cents', existing_allocated_cents,
      'unapplied_cents', existing_unapplied_cents
    );
  end if;

  if request_record.id is not null then
    return jsonb_build_object('status', 'unavailable');
  end if;

  if target_property_id is null
    or payment_amount_cents is null
    or payment_amount_cents <= 0
    or payment_amount_cents > 100000000
    or (
      payment_paid_at is not null
      and (
        payment_paid_at > now() + interval '5 minutes'
        or payment_paid_at < '2000-01-01'::timestamptz
      )
    )
    or payment_method is null
    or payment_method not in ('check', 'cash', 'manual', 'other')
    or payment_method in ('card', 'ach')
    or jsonb_typeof(coalesce(allocation_input, '[]'::jsonb)) <> 'array'
    or jsonb_array_length(coalesce(allocation_input, '[]'::jsonb)) > 100
    or (
      nullif(btrim(payment_reason), '') is not null
      and (
        length(btrim(payment_reason)) > 500
        or
        payment_reason ~* '(card number|credit card|debit card|cvv|cvc|routing number|bank account|account number|aba routing|iban|swift|micr)'
        or payment_reason ~ '([0-9][ -]?){9,}'
      )
    )
  then
    return jsonb_build_object('status', 'invalid');
  end if;

  select *
  into settings_record
  from public.community_settings
  where community_id = target_community_id
  for update;

  if settings_record.community_id is null then
    return jsonb_build_object('status', 'unavailable');
  end if;

  if settings_record.manual_payments_enabled = true then
    null;
  else
    return jsonb_build_object('status', 'configuration_disabled');
  end if;

  select *
  into property_record
  from public.properties
  where id = target_property_id
    and community_id = target_community_id
    and status = 'active'
    and deleted_at is null
  for update;

  if property_record.id is null then
    return jsonb_build_object('status', 'unavailable');
  end if;

  for allocation_record in
    select value
    from jsonb_array_elements(coalesce(allocation_input, '[]'::jsonb))
  loop
    if (allocation_record->>'assessmentId') is null
      or (allocation_record->>'amountCents') is null
      or not ((allocation_record->>'assessmentId') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$')
      or not ((allocation_record->>'amountCents') ~ '^[0-9]+$')
      or length(allocation_record->>'amountCents') > 9
    then
      return jsonb_build_object('status', 'invalid');
    end if;

    allocation_assessment_id := (allocation_record->>'assessmentId')::uuid;
    requested_allocation_cents := (allocation_record->>'amountCents')::integer;

    if requested_allocation_cents <= 0
      or requested_allocation_cents > payment_amount_cents
    then
      return jsonb_build_object('status', 'invalid');
    end if;

    if allocation_assessment_id = any(seen_assessment_ids) then
      return jsonb_build_object('status', 'invalid');
    end if;

    seen_assessment_ids := array_append(seen_assessment_ids, allocation_assessment_id);

    select *
    into assessment_record
    from public.assessments
    where id = allocation_assessment_id
      and community_id = target_community_id
      and property_id = target_property_id
      and status in ('open', 'partially_paid', 'overdue', 'disputed')
      and balance_cents > 0
    for update;

    if assessment_record.id is null
      or requested_allocation_cents > assessment_record.balance_cents
    then
      return jsonb_build_object('status', 'invalid');
    end if;

    explicit_allocation_total := explicit_allocation_total + requested_allocation_cents;

    if explicit_allocation_total > payment_amount_cents then
      return jsonb_build_object('status', 'invalid');
    end if;
  end loop;

  if explicit_allocation_total > payment_amount_cents then
    return jsonb_build_object('status', 'invalid');
  end if;

  insert into public.manual_payment_requests (
    community_id,
    request_id,
    actor_profile_id,
    status
  )
  values (
    target_community_id,
    record_manual_payment.request_id,
    actor_profile_id,
    'received'
  )
  on conflict (community_id, request_id) do update
  set updated_at = public.manual_payment_requests.updated_at
  returning *
  into request_record;

  if request_record.status = 'recorded'
    and request_record.payment_id is not null
  then
    select *
    into existing_payment
    from public.payments
    where id = request_record.payment_id;

    select coalesce(sum(amount_cents)::integer, 0)
    into existing_allocated_cents
    from public.payment_allocations
    where payment_id = request_record.payment_id;

    existing_unapplied_cents := greatest(
      coalesce(existing_payment.amount_cents, 0) - existing_allocated_cents,
      0
    );

    return jsonb_build_object('status', 'recorded',
      'existing', true,
      'payment_id', request_record.payment_id,
      'allocated_cents', existing_allocated_cents,
      'unapplied_cents', existing_unapplied_cents
    );
  end if;

  if request_record.status <> 'received' then
    return jsonb_build_object('status', 'unavailable');
  end if;

  created_payment_id := gen_random_uuid();
  created_paid_at := coalesce(payment_paid_at, now());
  created_receipt_number := 'SMC-' || upper(substr(replace(created_payment_id::text, '-', ''), 1, 12));
  payment_fee_policy := case
    when settings_record.fee_policy = 'hoa_pays' then 'hoa_pays'
    else 'payer_pays'
  end;

  insert into public.payments (
    id,
    community_id,
    property_id,
    payer_type,
    profile_id,
    property_account_snapshot,
    property_address_snapshot,
    amount_cents,
    currency,
    fee_policy,
    method,
    status,
    receipt_number,
    paid_at,
    created_by
  )
  values (
    created_payment_id,
    target_community_id,
    target_property_id,
    'admin_recorded',
    null,
    property_record.account_number,
    concat_ws(', ',
      property_record.address_line1,
      nullif(property_record.address_line2, ''),
      property_record.city,
      property_record.state,
      property_record.postal_code
    ),
    payment_amount_cents,
    'USD',
    payment_fee_policy,
    payment_method,
    'succeeded',
    created_receipt_number,
    created_paid_at,
    actor_profile_id
  );

  remaining_amount_cents := payment_amount_cents;

  if jsonb_array_length(coalesce(allocation_input, '[]'::jsonb)) > 0 then
    for allocation_record in
      select value
      from jsonb_array_elements(allocation_input)
    loop
      allocation_assessment_id := (allocation_record->>'assessmentId')::uuid;
      allocation_cents := (allocation_record->>'amountCents')::integer;

      select *
      into assessment_record
      from public.assessments
      where id = allocation_assessment_id
        and community_id = target_community_id
        and property_id = target_property_id
        and status in ('open', 'partially_paid', 'overdue', 'disputed')
        and balance_cents > 0
      for update;

      insert into public.payment_allocations (
        community_id,
        payment_id,
        assessment_id,
        amount_cents
      )
      values (
        target_community_id,
        created_payment_id,
        assessment_record.id,
        allocation_cents
      );

      update public.assessments
      set
        paid_cents = paid_cents + allocation_cents,
        balance_cents = amount_cents - (paid_cents + allocation_cents),
        status = case
          when amount_cents - (paid_cents + allocation_cents) = 0 then 'paid'
          when status = 'disputed' then 'disputed'
          when status = 'overdue' then 'overdue'
          else 'partially_paid'
        end
      where id = assessment_record.id
        and community_id = target_community_id;

      remaining_amount_cents := remaining_amount_cents - allocation_cents;
    end loop;
  else
    for assessment_record in
      select *
      from public.assessments
      where community_id = target_community_id
        and property_id = target_property_id
        and status in ('open', 'partially_paid', 'overdue', 'disputed')
        and balance_cents > 0
      order by assessments.due_date asc, assessments.created_at asc, assessments.id asc
      for update
    loop
      exit when remaining_amount_cents <= 0;

      allocation_cents := least(remaining_amount_cents, assessment_record.balance_cents);

      insert into public.payment_allocations (
        community_id,
        payment_id,
        assessment_id,
        amount_cents
      )
      values (
        target_community_id,
        created_payment_id,
        assessment_record.id,
        allocation_cents
      );

      update public.assessments
      set
        paid_cents = paid_cents + allocation_cents,
        balance_cents = amount_cents - (paid_cents + allocation_cents),
        status = case
          when amount_cents - (paid_cents + allocation_cents) = 0 then 'paid'
          when status = 'disputed' then 'disputed'
          when status = 'overdue' then 'overdue'
          else 'partially_paid'
        end
      where id = assessment_record.id
        and community_id = target_community_id;

      remaining_amount_cents := remaining_amount_cents - allocation_cents;
    end loop;
  end if;

  perform app.recalculate_property_assessment_summary(target_community_id, target_property_id);

  select max(coalesce(payments.paid_at, payments.created_at))
  into latest_succeeded_payment_at
  from public.payments
  where payments.community_id = target_community_id
    and payments.property_id = target_property_id
    and payments.status = 'succeeded';

  update public.properties
  set
    last_payment_at = latest_succeeded_payment_at,
    updated_at = now()
  where id = target_property_id
    and community_id = target_community_id;

  update public.manual_payment_requests
  set
    payment_id = created_payment_id,
    status = 'recorded'
  where id = request_record.id;

  -- Manual payments are user actions, not provider events; do not create payment_events rows here.
  insert into public.audit_logs (
    community_id,
    actor_profile_id,
    actor_type,
    action,
    target_table,
    target_id,
    before_data,
    after_data,
    request_id,
    reason
  )
  values (
    target_community_id,
    actor_profile_id,
    'user',
    'payment.manual.create',
    'payments',
    created_payment_id,
    null,
    jsonb_build_object(
      'payment_id', created_payment_id,
      'property_id', target_property_id,
      'amount_cents', payment_amount_cents,
      'method', payment_method,
      'receipt_number', created_receipt_number,
      'allocated_cents', payment_amount_cents - remaining_amount_cents,
      'unapplied_cents', remaining_amount_cents
    ),
    record_manual_payment.request_id::text,
    nullif(btrim(payment_reason), '')
  );

  return jsonb_build_object(
    'status', 'recorded',
    'existing', false,
    'payment_id', created_payment_id,
    'allocated_cents', payment_amount_cents - remaining_amount_cents,
    'unapplied_cents', remaining_amount_cents
  );
end;
$$;

revoke all on function public.list_admin_payment_records(
  uuid,
  text,
  text,
  text,
  uuid,
  timestamptz,
  timestamptz,
  text,
  integer,
  integer
) from public, anon;

revoke all on function public.record_manual_payment(
  uuid,
  uuid,
  uuid,
  integer,
  text,
  timestamptz,
  jsonb,
  text
) from public, anon;

grant execute on function public.list_admin_payment_records(
  uuid,
  text,
  text,
  text,
  uuid,
  timestamptz,
  timestamptz,
  text,
  integer,
  integer
) to authenticated;

grant execute on function public.record_manual_payment(
  uuid,
  uuid,
  uuid,
  integer,
  text,
  timestamptz,
  jsonb,
  text
) to authenticated;
