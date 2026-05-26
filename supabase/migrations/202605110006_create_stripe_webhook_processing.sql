create table if not exists public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  community_id uuid references public.communities(id),
  actor_profile_id uuid references public.profiles(id),
  actor_type text not null check (actor_type in ('user', 'system', 'webhook', 'job')),
  action text not null,
  target_table text not null,
  target_id uuid,
  before_data jsonb,
  after_data jsonb,
  ip_address inet,
  user_agent text,
  request_id text,
  reason text,
  created_at timestamptz not null default now()
);

create index if not exists audit_logs_community_created_idx
  on public.audit_logs(community_id, created_at desc);

create index if not exists audit_logs_actor_idx
  on public.audit_logs(community_id, actor_profile_id, created_at desc);

create index if not exists audit_logs_target_idx
  on public.audit_logs(target_table, target_id, created_at desc);

create index if not exists audit_logs_action_idx
  on public.audit_logs(action, created_at desc);

alter table public.audit_logs enable row level security;

revoke all on public.audit_logs from anon, authenticated;

create index if not exists payment_events_community_received_idx
  on public.payment_events(community_id, received_at desc);

create or replace function public.process_stripe_payment_event(
  stripe_event_id text,
  stripe_event_type text,
  event_stripe_account_id text default null,
  target_payment_id uuid default null,
  target_community_id uuid default null,
  target_property_id uuid default null,
  target_checkout_session_id text default null,
  target_payment_intent_id text default null,
  target_charge_id text default null,
  target_customer_id text default null,
  target_receipt_url text default null,
  target_receipt_number text default null,
  event_payment_status text default null,
  event_paid_at timestamptz default null,
  event_processor_fee_cents integer default null,
  event_net_amount_cents integer default null,
  event_payload_hash text default null,
  event_error text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, app
as $$
declare
  event_record public.payment_events%rowtype;
  payment_record public.payments%rowtype;
  before_payment jsonb;
  after_payment jsonb;
  assessment_record public.assessments%rowtype;
  existing_allocated_cents integer;
  remaining_amount_cents integer;
  allocation_cents integer;
  inserted_allocation_count integer;
  generated_receipt_number text;
  failure_reason text;
  community_stripe_account_mode text;
  community_stripe_connected_account_id text;
begin
  if stripe_event_id is null
    or btrim(stripe_event_id) = ''
    or stripe_event_type is null
    or btrim(stripe_event_type) = ''
    or event_payment_status not in (
      'pending',
      'succeeded',
      'failed',
      'refunded',
      'partially_refunded',
      'ignored'
    )
  then
    return jsonb_build_object('status', 'failed', 'retryable', false);
  end if;

  insert into public.payment_events (
    community_id,
    payment_id,
    provider,
    provider_event_id,
    event_type,
    processing_status,
    payload_hash
  )
  values (
    target_community_id,
    target_payment_id,
    'stripe',
    stripe_event_id,
    stripe_event_type,
    'received',
    event_payload_hash
  )
  on conflict (provider, provider_event_id)
  do update
    set
      event_type = excluded.event_type,
      payload_hash = coalesce(public.payment_events.payload_hash, excluded.payload_hash)
  returning *
  into event_record;

  select *
  into event_record
  from public.payment_events
  where id = event_record.id
  for update;

  if event_record.processing_status = 'processed'
    or event_record.processing_status = 'ignored'
  then
    return jsonb_build_object(
      'status', 'duplicate',
      'payment_id', event_record.payment_id,
      'retryable', false
    );
  end if;

  if event_payment_status = 'ignored' then
    update public.payment_events
    set
      community_id = target_community_id,
      payment_id = target_payment_id,
      processing_status = 'ignored',
      processed_at = now(),
      error = null,
      payload_hash = coalesce(payload_hash, event_payload_hash)
    where id = event_record.id
    returning *
    into event_record;

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
      null,
      'webhook',
      'payment.webhook.ignored',
      'payment_events',
      event_record.id,
      null,
      jsonb_build_object(
        'stripe_event_id', stripe_event_id,
        'stripe_event_type', stripe_event_type,
        'stripe_account_id', event_stripe_account_id
      ),
      stripe_event_id,
      null
    );

    return jsonb_build_object(
      'status', 'ignored',
      'payment_id', null,
      'retryable', false
    );
  end if;

  if target_payment_id is not null then
    select *
    into payment_record
    from public.payments
    where id = target_payment_id
    for update;
  elsif target_checkout_session_id is not null then
    select *
    into payment_record
    from public.payments
    where stripe_checkout_session_id = target_checkout_session_id
    for update;
  elsif target_payment_intent_id is not null then
    select *
    into payment_record
    from public.payments
    where stripe_payment_intent_id = target_payment_intent_id
    for update;
  elsif target_charge_id is not null then
    select *
    into payment_record
    from public.payments
    where stripe_charge_id = target_charge_id
    for update;
  end if;

  if payment_record.id is null then
    failure_reason := 'payment not found';
  elsif target_community_id is not null and payment_record.community_id <> target_community_id then
    failure_reason := 'payment community mismatch';
  elsif target_property_id is not null and payment_record.property_id <> target_property_id then
    failure_reason := 'payment property mismatch';
  elsif target_checkout_session_id is not null
    and payment_record.stripe_checkout_session_id is not null
    and payment_record.stripe_checkout_session_id <> target_checkout_session_id
  then
    failure_reason := 'checkout session mismatch';
  elsif target_payment_intent_id is not null
    and payment_record.stripe_payment_intent_id is not null
    and payment_record.stripe_payment_intent_id <> target_payment_intent_id
  then
    failure_reason := 'payment intent mismatch';
  elsif target_charge_id is not null
    and payment_record.stripe_charge_id is not null
    and payment_record.stripe_charge_id <> target_charge_id
  then
    failure_reason := 'charge mismatch';
  end if;

  if failure_reason is null then
    select
      community_settings.stripe_account_mode,
      community_settings.stripe_connected_account_id
    into
      community_stripe_account_mode,
      community_stripe_connected_account_id
    from public.community_settings
    where community_settings.community_id = payment_record.community_id;

    if coalesce(community_stripe_account_mode, 'platform') = 'direct' then
      if event_stripe_account_id is null
        or community_stripe_connected_account_id is null
        or event_stripe_account_id <> community_stripe_connected_account_id
      then
        failure_reason := 'stripe connected account mismatch';
      end if;
    elsif event_stripe_account_id is not null then
      failure_reason := 'unexpected connected account event';
    end if;
  end if;

  if failure_reason is not null then
    update public.payment_events
    set
      community_id = coalesce(target_community_id, payment_record.community_id),
      payment_id = payment_record.id,
      processing_status = 'failed',
      processed_at = now(),
      error = failure_reason,
      payload_hash = coalesce(payload_hash, event_payload_hash)
    where id = event_record.id;

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
      coalesce(target_community_id, payment_record.community_id),
      null,
      'webhook',
      'payment.webhook.failed',
      'payment_events',
      event_record.id,
      null,
      jsonb_build_object(
        'stripe_event_id', stripe_event_id,
        'stripe_event_type', stripe_event_type,
        'stripe_account_id', event_stripe_account_id
      ),
      stripe_event_id,
      failure_reason
    );

    return jsonb_build_object(
      'status', 'failed',
      'payment_id', payment_record.id,
      'retryable', false
    );
  end if;

  before_payment := to_jsonb(payment_record);

  if event_payment_status = 'pending' then
    update public.payments
    set
      stripe_payment_intent_id = coalesce(stripe_payment_intent_id, target_payment_intent_id),
      stripe_charge_id = coalesce(stripe_charge_id, target_charge_id),
      stripe_customer_id = coalesce(stripe_customer_id, target_customer_id),
      stripe_receipt_url = coalesce(stripe_receipt_url, target_receipt_url)
    where id = payment_record.id
    returning *
    into payment_record;

    after_payment := to_jsonb(payment_record);

    update public.payment_events
    set
      community_id = payment_record.community_id,
      payment_id = payment_record.id,
      processing_status = 'processed',
      processed_at = now(),
      error = null,
      payload_hash = coalesce(payload_hash, event_payload_hash)
    where id = event_record.id;

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
      payment_record.community_id,
      null,
      'webhook',
      'payment.webhook.pending',
      'payments',
      payment_record.id,
      before_payment,
      after_payment,
      stripe_event_id,
      null
    );

    return jsonb_build_object(
      'status', 'processed',
      'payment_id', payment_record.id,
      'retryable', false
    );
  end if;

  if event_payment_status = 'failed' then
    update public.payments
    set
      status = case
        when status in ('created', 'pending') then 'failed'
        else status
      end,
      stripe_payment_intent_id = coalesce(stripe_payment_intent_id, target_payment_intent_id),
      stripe_charge_id = coalesce(stripe_charge_id, target_charge_id),
      stripe_customer_id = coalesce(stripe_customer_id, target_customer_id),
      stripe_receipt_url = coalesce(stripe_receipt_url, target_receipt_url)
    where id = payment_record.id
    returning *
    into payment_record;

    after_payment := to_jsonb(payment_record);

    update public.payment_events
    set
      community_id = payment_record.community_id,
      payment_id = payment_record.id,
      processing_status = 'processed',
      processed_at = now(),
      error = coalesce(event_error, 'Stripe payment failed.'),
      payload_hash = coalesce(payload_hash, event_payload_hash)
    where id = event_record.id;

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
      payment_record.community_id,
      null,
      'webhook',
      'payment.webhook.failed',
      'payments',
      payment_record.id,
      before_payment,
      after_payment,
      stripe_event_id,
      coalesce(event_error, 'Stripe payment failed.')
    );

    return jsonb_build_object(
      'status', 'processed',
      'payment_id', payment_record.id,
      'retryable', false
    );
  end if;

  if event_payment_status in ('refunded', 'partially_refunded') then
    update public.payments
    set
      status = event_payment_status,
      stripe_payment_intent_id = coalesce(stripe_payment_intent_id, target_payment_intent_id),
      stripe_charge_id = coalesce(stripe_charge_id, target_charge_id),
      stripe_customer_id = coalesce(stripe_customer_id, target_customer_id),
      stripe_receipt_url = coalesce(stripe_receipt_url, target_receipt_url),
      processor_fee_cents = coalesce(event_processor_fee_cents, processor_fee_cents),
      net_amount_cents = coalesce(event_net_amount_cents, net_amount_cents)
    where id = payment_record.id
    returning *
    into payment_record;

    after_payment := to_jsonb(payment_record);

    update public.payment_events
    set
      community_id = payment_record.community_id,
      payment_id = payment_record.id,
      processing_status = 'processed',
      processed_at = now(),
      error = null,
      payload_hash = coalesce(payload_hash, event_payload_hash)
    where id = event_record.id;

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
      payment_record.community_id,
      null,
      'webhook',
      'payment.webhook.refunded',
      'payments',
      payment_record.id,
      before_payment,
      after_payment,
      stripe_event_id,
      null
    );

    return jsonb_build_object(
      'status', 'processed',
      'payment_id', payment_record.id,
      'retryable', false
    );
  end if;

  if event_payment_status = 'succeeded' then
    if payment_record.status in ('void', 'failed', 'refunded', 'partially_refunded') then
      update public.payment_events
      set
        community_id = payment_record.community_id,
        payment_id = payment_record.id,
        processing_status = 'failed',
        processed_at = now(),
        error = 'payment status cannot be succeeded',
        payload_hash = coalesce(payload_hash, event_payload_hash)
      where id = event_record.id;

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
        payment_record.community_id,
        null,
        'webhook',
        'payment.webhook.failed',
        'payments',
        payment_record.id,
        before_payment,
        before_payment,
        stripe_event_id,
        'payment status cannot be succeeded'
      );

      return jsonb_build_object(
        'status', 'failed',
        'payment_id', payment_record.id,
        'retryable', false
      );
    end if;

    if payment_record.status = 'succeeded' then
      generated_receipt_number := coalesce(
        payment_record.receipt_number,
        target_receipt_number,
        'SMC-' || upper(substr(replace(payment_record.id::text, '-', ''), 1, 12))
      );

      update public.payments
      set
        stripe_payment_intent_id = coalesce(stripe_payment_intent_id, target_payment_intent_id),
        stripe_charge_id = coalesce(stripe_charge_id, target_charge_id),
        stripe_customer_id = coalesce(stripe_customer_id, target_customer_id),
        stripe_receipt_url = coalesce(stripe_receipt_url, target_receipt_url),
        receipt_number = generated_receipt_number,
        paid_at = coalesce(paid_at, event_paid_at, now()),
        processor_fee_cents = coalesce(event_processor_fee_cents, processor_fee_cents),
        net_amount_cents = coalesce(event_net_amount_cents, net_amount_cents)
      where id = payment_record.id
      returning *
      into payment_record;

      after_payment := to_jsonb(payment_record) || jsonb_build_object(
        'payment_level_idempotent', true
      );

      update public.payment_events
      set
        community_id = payment_record.community_id,
        payment_id = payment_record.id,
        processing_status = 'processed',
        processed_at = now(),
        error = null,
        payload_hash = coalesce(payload_hash, event_payload_hash)
      where id = event_record.id;

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
        payment_record.community_id,
        null,
        'webhook',
        'payment.webhook.succeeded',
        'payments',
        payment_record.id,
        before_payment,
        after_payment,
        stripe_event_id,
        'payment already succeeded'
      );

      return jsonb_build_object(
        'status', 'processed',
        'payment_id', payment_record.id,
        'retryable', false
      );
    end if;

    generated_receipt_number := coalesce(
      payment_record.receipt_number,
      target_receipt_number,
      'SMC-' || upper(substr(replace(payment_record.id::text, '-', ''), 1, 12))
    );

    update public.payments
    set
      status = 'succeeded',
      stripe_payment_intent_id = coalesce(stripe_payment_intent_id, target_payment_intent_id),
      stripe_charge_id = coalesce(stripe_charge_id, target_charge_id),
      stripe_customer_id = coalesce(stripe_customer_id, target_customer_id),
      stripe_receipt_url = coalesce(stripe_receipt_url, target_receipt_url),
      receipt_number = generated_receipt_number,
      paid_at = coalesce(paid_at, event_paid_at, now()),
      processor_fee_cents = coalesce(event_processor_fee_cents, processor_fee_cents),
      net_amount_cents = coalesce(event_net_amount_cents, net_amount_cents)
    where id = payment_record.id
    returning *
    into payment_record;

    select coalesce(sum(amount_cents), 0)
    into existing_allocated_cents
    from public.payment_allocations
    where community_id = payment_record.community_id
      and payment_id = payment_record.id;

    remaining_amount_cents := greatest(payment_record.amount_cents - existing_allocated_cents, 0);

    for assessment_record in
      select *
      from public.assessments
      where community_id = payment_record.community_id
        and property_id = payment_record.property_id
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
        payment_record.community_id,
        payment_record.id,
        assessment_record.id,
        allocation_cents
      )
      on conflict (payment_id, assessment_id) do nothing;

      get diagnostics inserted_allocation_count = row_count;

      if inserted_allocation_count > 0 then
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
          and community_id = payment_record.community_id;

        remaining_amount_cents := remaining_amount_cents - allocation_cents;
      end if;
    end loop;

    perform app.recalculate_property_assessment_summary(
      payment_record.community_id,
      payment_record.property_id
    );

    after_payment := to_jsonb(payment_record) || jsonb_build_object(
      'allocated_cents', payment_record.amount_cents - remaining_amount_cents,
      'unapplied_cents', remaining_amount_cents
    );

    update public.payment_events
    set
      community_id = payment_record.community_id,
      payment_id = payment_record.id,
      processing_status = 'processed',
      processed_at = now(),
      error = null,
      payload_hash = coalesce(payload_hash, event_payload_hash)
    where id = event_record.id;

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
      payment_record.community_id,
      null,
      'webhook',
      'payment.webhook.succeeded',
      'payments',
      payment_record.id,
      before_payment,
      after_payment,
      stripe_event_id,
      null
    );

    return jsonb_build_object(
      'status', 'processed',
      'payment_id', payment_record.id,
      'retryable', false
    );
  end if;

  update public.payment_events
  set
    community_id = payment_record.community_id,
    payment_id = payment_record.id,
    processing_status = 'failed',
    processed_at = now(),
    error = coalesce(event_error, 'unsupported payment status'),
    payload_hash = coalesce(payload_hash, event_payload_hash)
  where id = event_record.id;

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
    payment_record.community_id,
    null,
    'webhook',
    'payment.webhook.failed',
    'payments',
    payment_record.id,
    before_payment,
    before_payment,
    stripe_event_id,
    coalesce(event_error, 'unsupported payment status')
  );

  return jsonb_build_object(
    'status', 'failed',
    'payment_id', payment_record.id,
    'retryable', false
  );
end;
$$;
