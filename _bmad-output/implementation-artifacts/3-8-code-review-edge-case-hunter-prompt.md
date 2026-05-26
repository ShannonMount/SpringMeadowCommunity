# Edge Case Hunter Review Prompt

You are an Edge Case Hunter reviewer. You receive this unified diff and may inspect the project read-only. Walk branching paths, boundaries, invalid inputs, authorization states, idempotency, concurrency, and privacy edge cases. Invoke the bmad-review-edge-case-hunter skill if available in your session.

Output findings as a Markdown list. Each finding must include: severity, one-line title, evidence from the diff/project, and the unhandled edge case. If there are no findings, say so clearly.

```diff
diff --git a/supabase/migrations/202605110008_admin_payment_records_and_manual_payments.sql b/supabase/migrations/202605110008_admin_payment_records_and_manual_payments.sql
new file mode 100644
index 0000000..72e9137
--- /dev/null
+++ b/supabase/migrations/202605110008_admin_payment_records_and_manual_payments.sql
@@ -0,0 +1,742 @@
+alter table public.community_settings
+  add column if not exists manual_payments_enabled boolean not null default false;
+
+update public.roles
+set
+  permissions = case
+    when 'admin.payments.manage' = any(permissions) then permissions
+    else permissions || array['admin.payments.manage']::text[]
+  end,
+  updated_at = now()
+where key = 'admin';
+
+create table if not exists public.manual_payment_requests (
+  id uuid primary key default gen_random_uuid(),
+  community_id uuid not null references public.communities(id) on delete cascade,
+  request_id uuid not null,
+  payment_id uuid references public.payments(id),
+  actor_profile_id uuid references public.profiles(id),
+  status text not null default 'received'
+    check (status in ('received', 'recorded', 'failed')),
+  created_at timestamptz not null default now(),
+  updated_at timestamptz not null default now(),
+  unique (community_id, request_id)
+);
+
+create index if not exists manual_payment_requests_payment_idx
+  on public.manual_payment_requests(community_id, payment_id)
+  where payment_id is not null;
+
+alter table public.manual_payment_requests enable row level security;
+
+revoke all on public.manual_payment_requests from anon, authenticated;
+
+drop trigger if exists set_manual_payment_requests_updated_at on public.manual_payment_requests;
+drop function if exists public.set_manual_payment_requests_updated_at();
+
+create or replace function app.set_manual_payment_requests_updated_at()
+returns trigger
+language plpgsql
+set search_path = public
+as $$
+begin
+  new.updated_at = now();
+  return new;
+end;
+$$;
+
+create trigger set_manual_payment_requests_updated_at
+  before update on public.manual_payment_requests
+  for each row
+  execute function app.set_manual_payment_requests_updated_at();
+
+revoke all on function app.set_manual_payment_requests_updated_at() from public, anon, authenticated;
+
+create or replace function public.list_admin_payment_records(
+  target_community_id uuid,
+  filter_status text default null,
+  filter_payer_type text default null,
+  filter_method text default null,
+  filter_property_id uuid default null,
+  filter_from timestamptz default null,
+  filter_to timestamptz default null,
+  filter_query text default null,
+  page_limit integer default 50,
+  page_offset integer default 0
+)
+returns jsonb
+language plpgsql
+security definer
+set search_path = public, app
+as $$
+declare
+  actor_profile_id uuid;
+  bounded_limit integer;
+  bounded_offset integer;
+  manual_enabled boolean;
+  search_query text;
+  records jsonb;
+begin
+  actor_profile_id := app.current_profile_id();
+
+  if actor_profile_id is null
+    or not app.has_permission(target_community_id, 'admin.payments.manage')
+  then
+    return jsonb_build_object('status', 'permission_denied');
+  end if;
+
+  if filter_status is not null
+    and filter_status not in ('created', 'pending', 'succeeded', 'failed', 'refunded', 'partially_refunded', 'void')
+  then
+    return jsonb_build_object('status', 'invalid');
+  end if;
+
+  if filter_payer_type is not null
+    and filter_payer_type not in ('resident', 'guest', 'admin_recorded')
+  then
+    return jsonb_build_object('status', 'invalid');
+  end if;
+
+  if filter_method is not null
+    and filter_method not in ('card', 'ach', 'check', 'cash', 'manual', 'other')
+  then
+    return jsonb_build_object('status', 'invalid');
+  end if;
+
+  if filter_query is not null
+    and length(btrim(filter_query)) > 200
+  then
+    return jsonb_build_object('status', 'invalid');
+  end if;
+
+  bounded_limit := least(greatest(coalesce(page_limit, 50), 1), 100);
+  bounded_offset := greatest(coalesce(page_offset, 0), 0);
+  search_query := nullif(
+    replace(
+      replace(
+        replace(btrim(coalesce(filter_query, '')), chr(92), chr(92) || chr(92)),
+        '%',
+        chr(92) || '%'
+      ),
+      '_',
+      chr(92) || '_'
+    ),
+    ''
+  );
+
+  select coalesce(community_settings.manual_payments_enabled, false)
+  into manual_enabled
+  from public.community_settings
+  where community_settings.community_id = target_community_id;
+
+  with allocation_totals as (
+    select
+      payment_allocations.payment_id,
+      coalesce(sum(payment_allocations.amount_cents), 0)::integer as allocated_cents
+    from public.payment_allocations
+    where payment_allocations.community_id = target_community_id
+    group by payment_allocations.payment_id
+  ),
+  filtered_payments as (
+    select
+      payments.id,
+      payments.community_id,
+      payments.property_id,
+      properties.address_line1,
+      properties.address_line2,
+      properties.city,
+      properties.state,
+      properties.postal_code,
+      payments.status,
+      payments.payer_type,
+      payments.amount_cents,
+      payments.currency,
+      payments.fee_policy,
+      payments.method,
+      payments.receipt_number,
+      payments.stripe_checkout_session_id,
+      payments.stripe_payment_intent_id,
+      payments.stripe_charge_id,
+      payments.processor_fee_cents,
+      payments.net_amount_cents,
+      payments.paid_at,
+      payments.created_at,
+      payments.updated_at,
+      coalesce(allocation_totals.allocated_cents, 0) as allocated_cents
+    from public.payments
+    join public.properties on properties.id = payments.property_id
+      and properties.community_id = payments.community_id
+    left join allocation_totals on allocation_totals.payment_id = payments.id
+    where payments.community_id = target_community_id
+      and (filter_status is null or payments.status = filter_status)
+      and (filter_payer_type is null or payments.payer_type = filter_payer_type)
+      and (filter_method is null or payments.method = filter_method)
+      and (filter_property_id is null or payments.property_id = filter_property_id)
+      and (filter_from is null or coalesce(payments.paid_at, payments.created_at) >= filter_from)
+      and (filter_to is null or coalesce(payments.paid_at, payments.created_at) <= filter_to)
+      and (
+        search_query is null
+        or payments.receipt_number ilike '%' || search_query || '%' escape chr(92)
+        or properties.address_line1 ilike '%' || search_query || '%' escape chr(92)
+        or properties.city ilike '%' || search_query || '%' escape chr(92)
+      )
+    order by coalesce(payments.paid_at, payments.created_at) desc, payments.created_at desc, payments.id desc
+    limit bounded_limit
+    offset bounded_offset
+  )
+  select coalesce(jsonb_agg(
+    jsonb_build_object(
+      'id', filtered_payments.id,
+      'community_id', filtered_payments.community_id,
+      'property_id', filtered_payments.property_id,
+      'property_label', concat_ws(', ',
+        filtered_payments.address_line1,
+        nullif(filtered_payments.address_line2, ''),
+        filtered_payments.city,
+        filtered_payments.state,
+        filtered_payments.postal_code
+      ),
+      'status', filtered_payments.status,
+      'payer_type', filtered_payments.payer_type,
+      'amount_cents', filtered_payments.amount_cents,
+      'currency', filtered_payments.currency,
+      'fee_policy', filtered_payments.fee_policy,
+      'method', filtered_payments.method,
+      'receipt_number', filtered_payments.receipt_number,
+      'stripe_checkout_session_id', filtered_payments.stripe_checkout_session_id,
+      'stripe_payment_intent_id', filtered_payments.stripe_payment_intent_id,
+      'stripe_charge_id', filtered_payments.stripe_charge_id,
+      'processor_fee_cents', filtered_payments.processor_fee_cents,
+      'net_amount_cents', filtered_payments.net_amount_cents,
+      'paid_at', filtered_payments.paid_at,
+      'created_at', filtered_payments.created_at,
+      'updated_at', filtered_payments.updated_at,
+      'allocated_cents', filtered_payments.allocated_cents,
+      'unapplied_cents', greatest(filtered_payments.amount_cents - filtered_payments.allocated_cents, 0)
+    )
+    order by
+      coalesce(filtered_payments.paid_at, filtered_payments.created_at) desc,
+      filtered_payments.created_at desc,
+      filtered_payments.id desc
+    )
+  ), '[]'::jsonb)
+  into records
+  from filtered_payments;
+
+  return jsonb_build_object(
+    'status', 'ok',
+    'manual_payments_enabled', coalesce(manual_enabled, false),
+    'records', records
+  );
+end;
+$$;
+
+create or replace function public.record_manual_payment(
+  target_community_id uuid,
+  target_property_id uuid,
+  request_id uuid,
+  payment_amount_cents integer,
+  payment_method text,
+  payment_paid_at timestamptz default null,
+  allocation_input jsonb default '[]'::jsonb,
+  payment_reason text default null
+)
+returns jsonb
+language plpgsql
+security definer
+set search_path = public, app
+as $$
+declare
+  actor_profile_id uuid;
+  settings_record public.community_settings%rowtype;
+  property_record public.properties%rowtype;
+  request_record public.manual_payment_requests%rowtype;
+  existing_payment public.payments%rowtype;
+  existing_allocated_cents integer := 0;
+  existing_unapplied_cents integer := 0;
+  created_payment_id uuid;
+  created_paid_at timestamptz;
+  created_receipt_number text;
+  payment_fee_policy text;
+  latest_succeeded_payment_at timestamptz;
+  allocation_record jsonb;
+  allocation_assessment_id uuid;
+  requested_allocation_cents integer;
+  explicit_allocation_total bigint := 0;
+  seen_assessment_ids uuid[] := '{}'::uuid[];
+  remaining_amount_cents integer;
+  allocation_cents integer;
+  assessment_record public.assessments%rowtype;
+begin
+  actor_profile_id := app.current_profile_id();
+
+  if actor_profile_id is null
+    or not app.has_permission(target_community_id, 'admin.payments.manage')
+  then
+    return jsonb_build_object('status', 'permission_denied');
+  end if;
+
+  if target_community_id is null
+    or record_manual_payment.request_id is null
+  then
+    return jsonb_build_object('status', 'invalid');
+  end if;
+
+  perform pg_advisory_xact_lock(
+    hashtextextended(target_community_id::text || ':' || record_manual_payment.request_id::text, 0)
+  );
+
+  select *
+  into request_record
+  from public.manual_payment_requests
+  where manual_payment_requests.community_id = target_community_id
+    and manual_payment_requests.request_id = record_manual_payment.request_id
+  for update;
+
+  if request_record.payment_id is not null then
+    select *
+    into existing_payment
+    from public.payments
+    where id = request_record.payment_id;
+
+    select coalesce(sum(amount_cents)::integer, 0)
+    into existing_allocated_cents
+    from public.payment_allocations
+    where payment_id = request_record.payment_id;
+
+    existing_unapplied_cents := greatest(
+      coalesce(existing_payment.amount_cents, 0) - existing_allocated_cents,
+      0
+    );
+  end if;
+
+  if request_record.status = 'recorded'
+    and request_record.payment_id is not null
+  then
+    return jsonb_build_object('status', 'recorded',
+      'existing', true,
+      'payment_id', request_record.payment_id,
+      'allocated_cents', existing_allocated_cents,
+      'unapplied_cents', existing_unapplied_cents
+    );
+  end if;
+
+  if request_record.id is not null then
+    return jsonb_build_object('status', 'unavailable');
+  end if;
+
+  if target_property_id is null
+    or payment_amount_cents is null
+    or payment_amount_cents <= 0
+    or payment_amount_cents > 100000000
+    or (
+      payment_paid_at is not null
+      and (
+        payment_paid_at > now() + interval '5 minutes'
+        or payment_paid_at < '2000-01-01'::timestamptz
+      )
+    )
+    or payment_method is null
+    or payment_method not in ('check', 'cash', 'manual', 'other')
+    or payment_method in ('card', 'ach')
+    or jsonb_typeof(coalesce(allocation_input, '[]'::jsonb)) <> 'array'
+    or jsonb_array_length(coalesce(allocation_input, '[]'::jsonb)) > 100
+    or (
+      nullif(btrim(payment_reason), '') is not null
+      and (
+        length(btrim(payment_reason)) > 500
+        or
+        payment_reason ~* '(card number|credit card|debit card|cvv|cvc|routing number|bank account|account number|aba routing|iban|swift|micr)'
+        or payment_reason ~ '([0-9][ -]?){9,}'
+      )
+    )
+  then
+    return jsonb_build_object('status', 'invalid');
+  end if;
+
+  select *
+  into settings_record
+  from public.community_settings
+  where community_id = target_community_id
+  for update;
+
+  if settings_record.community_id is null then
+    return jsonb_build_object('status', 'unavailable');
+  end if;
+
+  if settings_record.manual_payments_enabled = true then
+    null;
+  else
+    return jsonb_build_object('status', 'configuration_disabled');
+  end if;
+
+  select *
+  into property_record
+  from public.properties
+  where id = target_property_id
+    and community_id = target_community_id
+    and status = 'active'
+    and deleted_at is null
+  for update;
+
+  if property_record.id is null then
+    return jsonb_build_object('status', 'unavailable');
+  end if;
+
+  for allocation_record in
+    select value
+    from jsonb_array_elements(coalesce(allocation_input, '[]'::jsonb))
+  loop
+    if (allocation_record->>'assessmentId') is null
+      or (allocation_record->>'amountCents') is null
+      or not ((allocation_record->>'assessmentId') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$')
+      or not ((allocation_record->>'amountCents') ~ '^[0-9]+$')
+      or length(allocation_record->>'amountCents') > 9
+    then
+      return jsonb_build_object('status', 'invalid');
+    end if;
+
+    allocation_assessment_id := (allocation_record->>'assessmentId')::uuid;
+    requested_allocation_cents := (allocation_record->>'amountCents')::integer;
+
+    if requested_allocation_cents <= 0
+      or requested_allocation_cents > payment_amount_cents
+    then
+      return jsonb_build_object('status', 'invalid');
+    end if;
+
+    if allocation_assessment_id = any(seen_assessment_ids) then
+      return jsonb_build_object('status', 'invalid');
+    end if;
+
+    seen_assessment_ids := array_append(seen_assessment_ids, allocation_assessment_id);
+
+    select *
+    into assessment_record
+    from public.assessments
+    where id = allocation_assessment_id
+      and community_id = target_community_id
+      and property_id = target_property_id
+      and status in ('open', 'partially_paid', 'overdue', 'disputed')
+      and balance_cents > 0
+    for update;
+
+    if assessment_record.id is null
+      or requested_allocation_cents > assessment_record.balance_cents
+    then
+      return jsonb_build_object('status', 'invalid');
+    end if;
+
+    explicit_allocation_total := explicit_allocation_total + requested_allocation_cents;
+
+    if explicit_allocation_total > payment_amount_cents then
+      return jsonb_build_object('status', 'invalid');
+    end if;
+  end loop;
+
+  if explicit_allocation_total > payment_amount_cents then
+    return jsonb_build_object('status', 'invalid');
+  end if;
+
+  insert into public.manual_payment_requests (
+    community_id,
+    request_id,
+    actor_profile_id,
+    status
+  )
+  values (
+    target_community_id,
+    record_manual_payment.request_id,
+    actor_profile_id,
+    'received'
+  )
+  on conflict (community_id, request_id) do update
+  set updated_at = public.manual_payment_requests.updated_at
+  returning *
+  into request_record;
+
+  if request_record.status = 'recorded'
+    and request_record.payment_id is not null
+  then
+    select *
+    into existing_payment
+    from public.payments
+    where id = request_record.payment_id;
+
+    select coalesce(sum(amount_cents)::integer, 0)
+    into existing_allocated_cents
+    from public.payment_allocations
+    where payment_id = request_record.payment_id;
+
+    existing_unapplied_cents := greatest(
+      coalesce(existing_payment.amount_cents, 0) - existing_allocated_cents,
+      0
+    );
+
+    return jsonb_build_object('status', 'recorded',
+      'existing', true,
+      'payment_id', request_record.payment_id,
+      'allocated_cents', existing_allocated_cents,
+      'unapplied_cents', existing_unapplied_cents
+    );
+  end if;
+
+  if request_record.status <> 'received' then
+    return jsonb_build_object('status', 'unavailable');
+  end if;
+
+  created_payment_id := gen_random_uuid();
+  created_paid_at := coalesce(payment_paid_at, now());
+  created_receipt_number := 'SMC-' || upper(substr(replace(created_payment_id::text, '-', ''), 1, 12));
+  payment_fee_policy := case
+    when settings_record.fee_policy = 'hoa_pays' then 'hoa_pays'
+    else 'payer_pays'
+  end;
+
+  insert into public.payments (
+    id,
+    community_id,
+    property_id,
+    payer_type,
+    profile_id,
+    property_account_snapshot,
+    property_address_snapshot,
+    amount_cents,
+    currency,
+    fee_policy,
+    method,
+    status,
+    receipt_number,
+    paid_at,
+    created_by
+  )
+  values (
+    created_payment_id,
+    target_community_id,
+    target_property_id,
+    'admin_recorded',
+    null,
+    property_record.account_number,
+    concat_ws(', ',
+      property_record.address_line1,
+      nullif(property_record.address_line2, ''),
+      property_record.city,
+      property_record.state,
+      property_record.postal_code
+    ),
+    payment_amount_cents,
+    'USD',
+    payment_fee_policy,
+    payment_method,
+    'succeeded',
+    created_receipt_number,
+    created_paid_at,
+    actor_profile_id
+  );
+
+  remaining_amount_cents := payment_amount_cents;
+
+  if jsonb_array_length(coalesce(allocation_input, '[]'::jsonb)) > 0 then
+    for allocation_record in
+      select value
+      from jsonb_array_elements(allocation_input)
+    loop
+      allocation_assessment_id := (allocation_record->>'assessmentId')::uuid;
+      allocation_cents := (allocation_record->>'amountCents')::integer;
+
+      select *
+      into assessment_record
+      from public.assessments
+      where id = allocation_assessment_id
+        and community_id = target_community_id
+        and property_id = target_property_id
+        and status in ('open', 'partially_paid', 'overdue', 'disputed')
+        and balance_cents > 0
+      for update;
+
+      insert into public.payment_allocations (
+        community_id,
+        payment_id,
+        assessment_id,
+        amount_cents
+      )
+      values (
+        target_community_id,
+        created_payment_id,
+        assessment_record.id,
+        allocation_cents
+      );
+
+      update public.assessments
+      set
+        paid_cents = paid_cents + allocation_cents,
+        balance_cents = amount_cents - (paid_cents + allocation_cents),
+        status = case
+          when amount_cents - (paid_cents + allocation_cents) = 0 then 'paid'
+          when status = 'disputed' then 'disputed'
+          when status = 'overdue' then 'overdue'
+          else 'partially_paid'
+        end
+      where id = assessment_record.id
+        and community_id = target_community_id;
+
+      remaining_amount_cents := remaining_amount_cents - allocation_cents;
+    end loop;
+  else
+    for assessment_record in
+      select *
+      from public.assessments
+      where community_id = target_community_id
+        and property_id = target_property_id
+        and status in ('open', 'partially_paid', 'overdue', 'disputed')
+        and balance_cents > 0
+      order by assessments.due_date asc, assessments.created_at asc, assessments.id asc
+      for update
+    loop
+      exit when remaining_amount_cents <= 0;
+
+      allocation_cents := least(remaining_amount_cents, assessment_record.balance_cents);
+
+      insert into public.payment_allocations (
+        community_id,
+        payment_id,
+        assessment_id,
+        amount_cents
+      )
+      values (
+        target_community_id,
+        created_payment_id,
+        assessment_record.id,
+        allocation_cents
+      );
+
+      update public.assessments
+      set
+        paid_cents = paid_cents + allocation_cents,
+        balance_cents = amount_cents - (paid_cents + allocation_cents),
+        status = case
+          when amount_cents - (paid_cents + allocation_cents) = 0 then 'paid'
+          when status = 'disputed' then 'disputed'
+          when status = 'overdue' then 'overdue'
+          else 'partially_paid'
+        end
+      where id = assessment_record.id
+        and community_id = target_community_id;
+
+      remaining_amount_cents := remaining_amount_cents - allocation_cents;
+    end loop;
+  end if;
+
+  perform app.recalculate_property_assessment_summary(target_community_id, target_property_id);
+
+  select max(coalesce(payments.paid_at, payments.created_at))
+  into latest_succeeded_payment_at
+  from public.payments
+  where payments.community_id = target_community_id
+    and payments.property_id = target_property_id
+    and payments.status = 'succeeded';
+
+  update public.properties
+  set
+    last_payment_at = latest_succeeded_payment_at,
+    updated_at = now()
+  where id = target_property_id
+    and community_id = target_community_id;
+
+  update public.manual_payment_requests
+  set
+    payment_id = created_payment_id,
+    status = 'recorded'
+  where id = request_record.id;
+
+  -- Manual payments are user actions, not provider events; do not create payment_events rows here.
+  insert into public.audit_logs (
+    community_id,
+    actor_profile_id,
+    actor_type,
+    action,
+    target_table,
+    target_id,
+    before_data,
+    after_data,
+    request_id,
+    reason
+  )
+  values (
+    target_community_id,
+    actor_profile_id,
+    'user',
+    'payment.manual.create',
+    'payments',
+    created_payment_id,
+    null,
+    jsonb_build_object(
+      'payment_id', created_payment_id,
+      'property_id', target_property_id,
+      'amount_cents', payment_amount_cents,
+      'method', payment_method,
+      'receipt_number', created_receipt_number,
+      'allocated_cents', payment_amount_cents - remaining_amount_cents,
+      'unapplied_cents', remaining_amount_cents
+    ),
+    record_manual_payment.request_id::text,
+    nullif(btrim(payment_reason), '')
+  );
+
+  return jsonb_build_object(
+    'status', 'recorded',
+    'existing', false,
+    'payment_id', created_payment_id,
+    'allocated_cents', payment_amount_cents - remaining_amount_cents,
+    'unapplied_cents', remaining_amount_cents
+  );
+end;
+$$;
+
+revoke all on function public.list_admin_payment_records(
+  uuid,
+  text,
+  text,
+  text,
+  uuid,
+  timestamptz,
+  timestamptz,
+  text,
+  integer,
+  integer
+) from public, anon;
+
+revoke all on function public.record_manual_payment(
+  uuid,
+  uuid,
+  uuid,
+  integer,
+  text,
+  timestamptz,
+  jsonb,
+  text
+) from public, anon;
+
+grant execute on function public.list_admin_payment_records(
+  uuid,
+  text,
+  text,
+  text,
+  uuid,
+  timestamptz,
+  timestamptz,
+  text,
+  integer,
+  integer
+) to authenticated;
+
+grant execute on function public.record_manual_payment(
+  uuid,
+  uuid,
+  uuid,
+  integer,
+  text,
+  timestamptz,
+  jsonb,
+  text
+) to authenticated;

diff --git a/server/services/payments/admin-payment-management.ts b/server/services/payments/admin-payment-management.ts
new file mode 100644
index 0000000..7585ec9
--- /dev/null
+++ b/server/services/payments/admin-payment-management.ts
@@ -0,0 +1,712 @@
+import "server-only";
+
+import { createClient } from "@/lib/supabase/server";
+import { PROFILE_UNAVAILABLE_MESSAGE } from "@/server/services/auth/current-profile";
+import * as permissionService from "@/server/services/auth/permissions";
+import type { PermissionResult } from "@/server/services/auth/permissions";
+
+const ADMIN_PAYMENT_PERMISSION = "admin.payments.manage";
+const DEFAULT_COMMUNITY_SLUG = "spring-meadow-community";
+const ADMIN_PAYMENT_UNAVAILABLE_MESSAGE =
+  "Payment records are unavailable. Please contact the HOA for help.";
+const INVALID_ADMIN_PAYMENT_INPUT_MESSAGE = "Please check the payment details and try again.";
+const MANUAL_PAYMENTS_DISABLED_MESSAGE = "Manual payment recording is disabled.";
+const ADMIN_PAYMENT_TIME_ZONE = "America/New_York";
+const MAX_PAGE_SIZE = 100;
+const DEFAULT_PAGE_SIZE = 50;
+const MAX_PAGE_OFFSET = 10000;
+const MAX_PAYMENT_AMOUNT_CENTS = 100000000;
+const MAX_QUERY_LENGTH = 200;
+const MAX_REASON_LENGTH = 500;
+const MAX_MANUAL_ALLOCATIONS = 100;
+
+const UUID_PATTERN =
+  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
+const DATE_ONLY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
+const DATE_TIME_LOCAL_PATTERN =
+  /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2})(?:\.(\d{1,3}))?)?$/;
+const SENSITIVE_PAYMENT_REASON_PATTERN =
+  /\b(card number|credit card|debit card|cvv|cvc|routing number|bank account|account number|aba routing|iban|swift|micr)\b|(\d[ -]?){9,}/i;
+
+const PAYMENT_STATUSES = [
+  "created",
+  "pending",
+  "succeeded",
+  "failed",
+  "refunded",
+  "partially_refunded",
+  "void",
+] as const;
+const PAYER_TYPES = ["resident", "guest", "admin_recorded"] as const;
+const PAYMENT_METHODS = ["card", "ach", "check", "cash", "manual", "other"] as const;
+export const OFFLINE_PAYMENT_METHODS = ["check", "cash", "manual", "other"] as const;
+
+type FieldErrors = Record<string, string[]>;
+
+export type AdminPaymentStatus = (typeof PAYMENT_STATUSES)[number];
+export type AdminPaymentPayerType = (typeof PAYER_TYPES)[number];
+export type AdminPaymentMethod = (typeof PAYMENT_METHODS)[number];
+export type OfflinePaymentMethod = (typeof OFFLINE_PAYMENT_METHODS)[number];
+
+export type AdminPaymentRecord = {
+  id: string;
+  communityId: string;
+  propertyId: string;
+  propertyLabel: string;
+  status: AdminPaymentStatus;
+  payerType: AdminPaymentPayerType;
+  amountCents: number;
+  currency: "USD";
+  feePolicy: "payer_pays" | "hoa_pays";
+  method: AdminPaymentMethod;
+  receiptNumber: string | null;
+  stripeCheckoutSessionId: string | null;
+  stripePaymentIntentId: string | null;
+  stripeChargeId: string | null;
+  processorFeeCents: number | null;
+  netAmountCents: number | null;
+  paidAt: string | null;
+  createdAt: string;
+  updatedAt: string;
+  allocatedCents: number;
+  unappliedCents: number;
+};
+
+export type AdminPaymentRecordFilters = {
+  communityId?: string | null;
+  communitySlug?: string | null;
+  status?: string | null;
+  payerType?: string | null;
+  method?: string | null;
+  propertyId?: string | null;
+  from?: string | null;
+  to?: string | null;
+  query?: string | null;
+  pageSize?: number | null;
+  pageOffset?: number | null;
+};
+
+export type ManualPaymentAllocationInput = {
+  assessmentId: string;
+  amountCents: number;
+};
+
+export type RecordManualPaymentInput = {
+  communityId?: string | null;
+  communitySlug?: string | null;
+  propertyId: string;
+  requestId: string;
+  amountCents: number;
+  method: string;
+  paidAt?: string | null;
+  allocations?: ManualPaymentAllocationInput[];
+  reason?: string | null;
+};
+
+type CommunityResolution =
+  | { kind: "resolved"; communityId: string; communitySlug: string }
+  | { kind: "invalid-input"; fieldErrors: FieldErrors }
+  | { kind: "payment-unavailable"; message: typeof ADMIN_PAYMENT_UNAVAILABLE_MESSAGE };
+
+type AdminPaymentRecordsRpcResult = {
+  status?: "ok" | "permission_denied" | "invalid";
+  manual_payments_enabled?: boolean;
+  records?: AdminPaymentRpcRow[];
+};
+
+type ManualPaymentRpcResult = {
+  status?: "recorded" | "permission_denied" | "configuration_disabled" | "invalid" | "unavailable";
+  payment_id?: string | null;
+  allocated_cents?: number | null;
+  unapplied_cents?: number | null;
+};
+
+type AdminPaymentRpcRow = {
+  id?: string | null;
+  community_id?: string | null;
+  property_id?: string | null;
+  property_label?: string | null;
+  status?: string | null;
+  payer_type?: string | null;
+  amount_cents?: number | null;
+  currency?: string | null;
+  fee_policy?: string | null;
+  method?: string | null;
+  receipt_number?: string | null;
+  stripe_checkout_session_id?: string | null;
+  stripe_payment_intent_id?: string | null;
+  stripe_charge_id?: string | null;
+  processor_fee_cents?: number | null;
+  net_amount_cents?: number | null;
+  paid_at?: string | null;
+  created_at?: string | null;
+  updated_at?: string | null;
+  allocated_cents?: number | null;
+  unapplied_cents?: number | null;
+};
+
+export type AdminPaymentRecordsResult =
+  | {
+      kind: "records";
+      communityId: string;
+      communitySlug: string;
+      manualPaymentsEnabled: boolean;
+      records: AdminPaymentRecord[];
+    }
+  | { kind: "unauthenticated" }
+  | { kind: "profile-unavailable"; message: typeof PROFILE_UNAVAILABLE_MESSAGE }
+  | { kind: "permission-denied"; message: typeof permissionService.PERMISSION_DENIED_MESSAGE }
+  | {
+      kind: "invalid-input";
+      message: typeof INVALID_ADMIN_PAYMENT_INPUT_MESSAGE;
+      fieldErrors: FieldErrors;
+    }
+  | { kind: "payment-unavailable"; message: typeof ADMIN_PAYMENT_UNAVAILABLE_MESSAGE };
+
+export type RecordManualPaymentResult =
+  | { kind: "recorded"; paymentId: string; allocatedCents: number; unappliedCents: number }
+  | { kind: "configuration-disabled"; message: typeof MANUAL_PAYMENTS_DISABLED_MESSAGE }
+  | {
+      kind: "invalid-input";
+      message: typeof INVALID_ADMIN_PAYMENT_INPUT_MESSAGE;
+      fieldErrors: FieldErrors;
+    }
+  | { kind: "permission-denied"; message: typeof permissionService.PERMISSION_DENIED_MESSAGE }
+  | { kind: "unauthenticated" }
+  | { kind: "profile-unavailable"; message: typeof PROFILE_UNAVAILABLE_MESSAGE }
+  | { kind: "payment-unavailable"; message: typeof ADMIN_PAYMENT_UNAVAILABLE_MESSAGE };
+
+function isUuid(value: string | null | undefined): value is string {
+  return typeof value === "string" && UUID_PATTERN.test(value);
+}
+
+function isValidDateParts(year: number, month: number, day: number) {
+  const date = new Date(Date.UTC(year, month - 1, day));
+
+  return (
+    date.getUTCFullYear() === year &&
+    date.getUTCMonth() === month - 1 &&
+    date.getUTCDate() === day
+  );
+}
+
+function isValidDateOnly(value: string) {
+  const [year, month, day] = value.split("-").map(Number);
+
+  return isValidDateParts(year, month, day);
+}
+
+function isValidDateTimeLocal(value: string) {
+  const match = DATE_TIME_LOCAL_PATTERN.exec(value);
+
+  if (!match) {
+    return false;
+  }
+
+  const [, year, month, day, hour, minute, second = "0"] = match;
+  const yearValue = Number(year);
+  const monthValue = Number(month);
+  const dayValue = Number(day);
+  const hourValue = Number(hour);
+  const minuteValue = Number(minute);
+  const secondValue = Number(second);
+
+  return (
+    isValidDateParts(yearValue, monthValue, dayValue) &&
+    hourValue >= 0 &&
+    hourValue <= 23 &&
+    minuteValue >= 0 &&
+    minuteValue <= 59 &&
+    secondValue >= 0 &&
+    secondValue <= 59
+  );
+}
+
+function isDateTime(value: string | null | undefined): value is string {
+  if (typeof value !== "string" || value.trim() === "") {
+    return false;
+  }
+
+  const trimmed = value.trim();
+
+  if (DATE_ONLY_PATTERN.test(trimmed)) {
+    return isValidDateOnly(trimmed);
+  }
+
+  if (DATE_TIME_LOCAL_PATTERN.test(trimmed)) {
+    return isValidDateTimeLocal(trimmed);
+  }
+
+  return !Number.isNaN(Date.parse(trimmed));
+}
+
+function isPositiveInteger(value: number | null | undefined): value is number {
+  return Number.isInteger(value) && Number(value) > 0;
+}
+
+function isIncluded<T extends readonly string[]>(values: T, value: string): value is T[number] {
+  return values.includes(value);
+}
+
+function safeString(value: string | null | undefined) {
+  return typeof value === "string" ? value.trim() : "";
+}
+
+function optionalString(value: string | null | undefined) {
+  const trimmed = safeString(value);
+
+  return trimmed || null;
+}
+
+function boundedPageSize(value: number | null | undefined) {
+  if (!Number.isInteger(value)) {
+    return DEFAULT_PAGE_SIZE;
+  }
+
+  return Math.min(Math.max(Number(value), 1), MAX_PAGE_SIZE);
+}
+
+function boundedPageOffset(value: number | null | undefined) {
+  if (!Number.isInteger(value)) {
+    return 0;
+  }
+
+  return Math.min(Math.max(Number(value), 0), MAX_PAGE_OFFSET);
+}
+
+function getTimeZoneOffsetMs(date: Date, timeZone = ADMIN_PAYMENT_TIME_ZONE) {
+  const parts = new Intl.DateTimeFormat("en-US", {
+    timeZone,
+    year: "numeric",
+    month: "2-digit",
+    day: "2-digit",
+    hour: "2-digit",
+    minute: "2-digit",
+    second: "2-digit",
+    hourCycle: "h23",
+  }).formatToParts(date);
+  const values = Object.fromEntries(
+    parts
+      .filter((part) => part.type !== "literal")
+      .map((part) => [part.type, Number(part.value)]),
+  );
+
+  return (
+    Date.UTC(
+      values.year,
+      values.month - 1,
+      values.day,
+      values.hour,
+      values.minute,
+      values.second,
+    ) - date.getTime()
+  );
+}
+
+function dateTimeLocalToTimeZoneIso(value: string) {
+  const match = DATE_TIME_LOCAL_PATTERN.exec(value);
+
+  if (!match) {
+    return value;
+  }
+
+  const [, year, month, day, hour, minute, second = "0", millisecond = "0"] = match;
+  const localAsUtc = Date.UTC(
+    Number(year),
+    Number(month) - 1,
+    Number(day),
+    Number(hour),
+    Number(minute),
+    Number(second),
+    Number(millisecond.padEnd(3, "0").slice(0, 3)),
+  );
+  let instant = localAsUtc - getTimeZoneOffsetMs(new Date(localAsUtc));
+  instant = localAsUtc - getTimeZoneOffsetMs(new Date(instant));
+
+  return new Date(instant).toISOString();
+}
+
+function normalizeDateTime(value: string | null | undefined, dateOnlyTime: string) {
+  const trimmed = safeString(value);
+
+  if (!trimmed) {
+    return null;
+  }
+
+  if (DATE_ONLY_PATTERN.test(trimmed)) {
+    return dateTimeLocalToTimeZoneIso(`${trimmed}${dateOnlyTime}`);
+  }
+
+  return new Date(trimmed).toISOString();
+}
+
+function normalizeFromDateTime(value: string | null | undefined) {
+  return normalizeDateTime(value, "T00:00:00.000");
+}
+
+function normalizeToDateTime(value: string | null | undefined) {
+  return normalizeDateTime(value, "T23:59:59.999");
+}
+
+function invalid(fieldErrors: FieldErrors): Extract<AdminPaymentRecordsResult, { kind: "invalid-input" }> {
+  return {
+    kind: "invalid-input",
+    message: INVALID_ADMIN_PAYMENT_INPUT_MESSAGE,
+    fieldErrors,
+  };
+}
+
+function invalidManual(
+  fieldErrors: FieldErrors,
+): Extract<RecordManualPaymentResult, { kind: "invalid-input" }> {
+  return {
+    kind: "invalid-input",
+    message: INVALID_ADMIN_PAYMENT_INPUT_MESSAGE,
+    fieldErrors,
+  };
+}
+
+function unavailable(): Extract<AdminPaymentRecordsResult, { kind: "payment-unavailable" }> {
+  return { kind: "payment-unavailable", message: ADMIN_PAYMENT_UNAVAILABLE_MESSAGE };
+}
+
+function manualUnavailable(): Extract<RecordManualPaymentResult, { kind: "payment-unavailable" }> {
+  return { kind: "payment-unavailable", message: ADMIN_PAYMENT_UNAVAILABLE_MESSAGE };
+}
+
+async function resolveCommunity(input: {
+  communityId?: string | null;
+  communitySlug?: string | null;
+}): Promise<CommunityResolution> {
+  const fieldErrors: FieldErrors = {};
+  const communityId = safeString(input.communityId);
+  const communitySlug = safeString(input.communitySlug) || DEFAULT_COMMUNITY_SLUG;
+
+  if (communityId) {
+    if (!isUuid(communityId)) {
+      fieldErrors.communityId = ["Community is required."];
+
+      return { kind: "invalid-input", fieldErrors };
+    }
+
+    return { kind: "resolved", communityId, communitySlug };
+  }
+
+  if (!communitySlug) {
+    fieldErrors.communitySlug = ["Community is required."];
+
+    return { kind: "invalid-input", fieldErrors };
+  }
+
+  const supabase = await createClient();
+  const { data, error } = await supabase
+    .from("communities")
+    .select("id, slug")
+    .eq("slug", communitySlug)
+    .maybeSingle<{ id: string; slug: string }>();
+
+  if (error || !data?.id) {
+    return { kind: "payment-unavailable", message: ADMIN_PAYMENT_UNAVAILABLE_MESSAGE };
+  }
+
+  return { kind: "resolved", communityId: data.id, communitySlug: data.slug };
+}
+
+const hasPermission = permissionService.hasPermission;
+const PERMISSION_DENIED_MESSAGE = permissionService.PERMISSION_DENIED_MESSAGE;
+
+function permissionResultToRecords(result: PermissionResult): AdminPaymentRecordsResult | null {
+  if (result.kind === "unauthenticated") {
+    return { kind: "unauthenticated" };
+  }
+
+  if (result.kind === "profile-unavailable") {
+    return { kind: "profile-unavailable", message: PROFILE_UNAVAILABLE_MESSAGE };
+  }
+
+  if (result.kind === "permission-denied") {
+    return { kind: "permission-denied", message: PERMISSION_DENIED_MESSAGE };
+  }
+
+  return null;
+}
+
+function permissionResultToManual(result: PermissionResult): RecordManualPaymentResult | null {
+  if (result.kind === "unauthenticated") {
+    return { kind: "unauthenticated" };
+  }
+
+  if (result.kind === "profile-unavailable") {
+    return { kind: "profile-unavailable", message: PROFILE_UNAVAILABLE_MESSAGE };
+  }
+
+  if (result.kind === "permission-denied") {
+    return { kind: "permission-denied", message: PERMISSION_DENIED_MESSAGE };
+  }
+
+  return null;
+}
+
+function validateRecordFilters(input: AdminPaymentRecordFilters): FieldErrors {
+  const fieldErrors: FieldErrors = {};
+
+  if (input.status && !isIncluded(PAYMENT_STATUSES, input.status)) {
+    fieldErrors.status = ["Payment status is not supported."];
+  }
+
+  if (input.payerType && !isIncluded(PAYER_TYPES, input.payerType)) {
+    fieldErrors.payerType = ["Payer type is not supported."];
+  }
+
+  if (input.method && !isIncluded(PAYMENT_METHODS, input.method)) {
+    fieldErrors.method = ["Payment method is not supported."];
+  }
+
+  if (input.propertyId && !isUuid(input.propertyId)) {
+    fieldErrors.propertyId = ["Property is invalid."];
+  }
+
+  if (input.from && !isDateTime(input.from)) {
+    fieldErrors.from = ["From date is invalid."];
+  }
+
+  if (input.to && !isDateTime(input.to)) {
+    fieldErrors.to = ["To date is invalid."];
+  }
+
+  if (input.query && safeString(input.query).length > MAX_QUERY_LENGTH) {
+    fieldErrors.query = ["Search text is too long."];
+  }
+
+  if (input.from && input.to && isDateTime(input.from) && isDateTime(input.to)) {
+    if (Date.parse(input.to) < Date.parse(input.from)) {
+      fieldErrors.to = ["To date must be after from date."];
+    }
+  }
+
+  return fieldErrors;
+}
+
+function validateManualPayment(input: RecordManualPaymentInput): FieldErrors {
+  const fieldErrors: FieldErrors = {};
+
+  if (!isUuid(input.propertyId)) {
+    fieldErrors.propertyId = ["Property is required."];
+  }
+
+  if (!isUuid(input.requestId)) {
+    fieldErrors.requestId = ["Request ID is required."];
+  }
+
+  if (!isPositiveInteger(input.amountCents) || input.amountCents > MAX_PAYMENT_AMOUNT_CENTS) {
+    fieldErrors.amountCents = ["Amount must be positive integer cents."];
+  }
+
+  if (!isIncluded(OFFLINE_PAYMENT_METHODS, input.method)) {
+    fieldErrors.method = ["Payment method is not supported."];
+  }
+
+  if (input.paidAt && !isDateTime(input.paidAt)) {
+    fieldErrors.paidAt = ["Paid date is invalid."];
+  }
+
+  const reason = optionalString(input.reason);
+
+  if (reason && reason.length > MAX_REASON_LENGTH) {
+    fieldErrors.reason = ["Reason is too long."];
+  } else if (reason && SENSITIVE_PAYMENT_REASON_PATTERN.test(reason)) {
+    fieldErrors.reason = ["Reason cannot include payment instrument details."];
+  }
+
+  let allocationTotal = 0;
+  const allocations = input.allocations ?? [];
+
+  if (allocations.length > MAX_MANUAL_ALLOCATIONS) {
+    fieldErrors.allocations = ["Too many allocations."];
+  }
+
+  for (const [index, allocation] of allocations.entries()) {
+    if (!isUuid(allocation.assessmentId)) {
+      fieldErrors[`allocations.${index}.assessmentId`] = ["Assessment is invalid."];
+    }
+
+    if (!isPositiveInteger(allocation.amountCents)) {
+      fieldErrors[`allocations.${index}.amountCents`] = ["Allocation amount must be positive."];
+    } else {
+      allocationTotal += allocation.amountCents;
+    }
+  }
+
+  if (allocationTotal > input.amountCents) {
+    fieldErrors.allocations = ["Allocations cannot exceed the payment amount."];
+  }
+
+  return fieldErrors;
+}
+
+function asRecord(row: AdminPaymentRpcRow): AdminPaymentRecord {
+  const status = row.status ?? "";
+  const payerType = row.payer_type ?? "";
+  const method = row.method ?? "";
+
+  return {
+    id: row.id ?? "",
+    communityId: row.community_id ?? "",
+    propertyId: row.property_id ?? "",
+    propertyLabel: row.property_label ?? "Unknown property",
+    status: isIncluded(PAYMENT_STATUSES, status) ? status : "created",
+    payerType: isIncluded(PAYER_TYPES, payerType) ? payerType : "resident",
+    amountCents: row.amount_cents ?? 0,
+    currency: row.currency === "USD" ? "USD" : "USD",
+    feePolicy: row.fee_policy === "hoa_pays" ? "hoa_pays" : "payer_pays",
+    method: isIncluded(PAYMENT_METHODS, method) ? method : "other",
+    receiptNumber: row.receipt_number ?? null,
+    stripeCheckoutSessionId: row.stripe_checkout_session_id ?? null,
+    stripePaymentIntentId: row.stripe_payment_intent_id ?? null,
+    stripeChargeId: row.stripe_charge_id ?? null,
+    processorFeeCents: row.processor_fee_cents ?? null,
+    netAmountCents: row.net_amount_cents ?? null,
+    paidAt: row.paid_at ?? null,
+    createdAt: row.created_at ?? "",
+    updatedAt: row.updated_at ?? "",
+    allocatedCents: row.allocated_cents ?? 0,
+    unappliedCents: row.unapplied_cents ?? 0,
+  };
+}
+
+export async function listAdminPaymentRecords(
+  input: AdminPaymentRecordFilters = {},
+): Promise<AdminPaymentRecordsResult> {
+  const community = await resolveCommunity(input);
+
+  if (community.kind === "invalid-input") {
+    return invalid(community.fieldErrors);
+  }
+
+  if (community.kind !== "resolved") {
+    return unavailable();
+  }
+
+  const fieldErrors = validateRecordFilters(input);
+
+  if (Object.keys(fieldErrors).length > 0) {
+    return invalid(fieldErrors);
+  }
+
+  const permission = await hasPermission({
+    communityId: community.communityId,
+    permissionKey: ADMIN_PAYMENT_PERMISSION,
+  });
+
+  if (permission.kind !== "authorized") {
+    return permissionResultToRecords(permission) ?? unavailable();
+  }
+
+  const supabase = await createClient();
+  const { data, error } = await supabase.rpc("list_admin_payment_records", {
+    target_community_id: community.communityId,
+    filter_status: optionalString(input.status),
+    filter_payer_type: optionalString(input.payerType),
+    filter_method: optionalString(input.method),
+    filter_property_id: optionalString(input.propertyId),
+    filter_from: normalizeFromDateTime(input.from),
+    filter_to: normalizeToDateTime(input.to),
+    filter_query: optionalString(input.query),
+    page_limit: boundedPageSize(input.pageSize),
+    page_offset: boundedPageOffset(input.pageOffset),
+  });
+  const result = data as AdminPaymentRecordsRpcResult | null;
+
+  if (error || !result) {
+    return unavailable();
+  }
+
+  if (result.status === "permission_denied") {
+    return { kind: "permission-denied", message: PERMISSION_DENIED_MESSAGE };
+  }
+
+  if (result.status === "invalid") {
+    return invalid({ form: ["Payment filters are invalid."] });
+  }
+
+  if (result.status !== "ok") {
+    return unavailable();
+  }
+
+  return {
+    kind: "records",
+    communityId: community.communityId,
+    communitySlug: community.communitySlug,
+    manualPaymentsEnabled: result.manual_payments_enabled === true,
+    records: (result.records ?? []).map(asRecord),
+  };
+}
+
+export async function recordManualPayment(
+  input: RecordManualPaymentInput,
+): Promise<RecordManualPaymentResult> {
+  const community = await resolveCommunity(input);
+
+  if (community.kind === "invalid-input") {
+    return invalidManual(community.fieldErrors);
+  }
+
+  if (community.kind !== "resolved") {
+    return manualUnavailable();
+  }
+
+  const fieldErrors = validateManualPayment(input);
+
+  if (Object.keys(fieldErrors).length > 0) {
+    return invalidManual(fieldErrors);
+  }
+
+  const permission = await hasPermission({
+    communityId: community.communityId,
+    permissionKey: ADMIN_PAYMENT_PERMISSION,
+  });
+
+  if (permission.kind !== "authorized") {
+    return permissionResultToManual(permission) ?? manualUnavailable();
+  }
+
+  const supabase = await createClient();
+  const { data, error } = await supabase.rpc("record_manual_payment", {
+    target_community_id: community.communityId,
+    target_property_id: input.propertyId,
+    request_id: input.requestId,
+    payment_amount_cents: input.amountCents,
+    payment_method: input.method,
+    payment_paid_at: normalizeFromDateTime(input.paidAt),
+    allocation_input: input.allocations ?? [],
+    payment_reason: optionalString(input.reason),
+  });
+  const result = data as ManualPaymentRpcResult | null;
+
+  if (error || !result) {
+    return manualUnavailable();
+  }
+
+  if (result.status === "permission_denied") {
+    return { kind: "permission-denied", message: PERMISSION_DENIED_MESSAGE };
+  }
+
+  if (result.status === "configuration_disabled") {
+    return { kind: "configuration-disabled", message: MANUAL_PAYMENTS_DISABLED_MESSAGE };
+  }
+
+  if (result.status === "invalid") {
+    return invalidManual({ form: ["Manual payment details are invalid."] });
+  }
+
+  if (result.status !== "recorded" || !result.payment_id) {
+    return manualUnavailable();
+  }
+
+  return {
+    kind: "recorded",
+    paymentId: result.payment_id,
+    allocatedCents: result.allocated_cents ?? 0,
+    unappliedCents: result.unapplied_cents ?? 0,
+  };
+}

diff --git a/server/actions/admin-payments.ts b/server/actions/admin-payments.ts
new file mode 100644
index 0000000..61611dd
--- /dev/null
+++ b/server/actions/admin-payments.ts
@@ -0,0 +1,312 @@
+"use server";
+
+import { redirect } from "next/navigation";
+import {
+  recordManualPayment,
+  type ManualPaymentAllocationInput,
+  type RecordManualPaymentResult,
+} from "@/server/services/payments/admin-payment-management";
+
+const DEFAULT_COMMUNITY_SLUG = "spring-meadow-community";
+const DECIMAL_DOLLAR_PATTERN = /^\d{1,9}(\.\d{1,2})?$/;
+const GROUPED_DECIMAL_DOLLAR_PATTERN = /^\d{1,3}(,\d{3})+(\.\d{1,2})?$/;
+const DATE_TIME_LOCAL_PATTERN =
+  /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?$/;
+const ALLOCATION_LINE_PATTERN =
+  /^([0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})[\s,:]+(\d{1,9}(?:\.\d{1,2})?)$/i;
+
+function stringValue(value: FormDataEntryValue | null) {
+  return typeof value === "string" ? value.trim() : "";
+}
+
+function parseDollarAmountCents(value: string) {
+  const pattern = value.includes(",") ? GROUPED_DECIMAL_DOLLAR_PATTERN : DECIMAL_DOLLAR_PATTERN;
+
+  if (!pattern.test(value)) {
+    return null;
+  }
+
+  const amount = value.replaceAll(",", "");
+  const [dollars, cents = ""] = amount.split(".");
+  const parsed = Number(`${dollars}${cents.padEnd(2, "0")}`);
+
+  return Number.isSafeInteger(parsed) ? parsed : null;
+}
+
+function parseAmountCents(formData: FormData) {
+  const amount = stringValue(formData.get("amount"));
+
+  return amount ? parseDollarAmountCents(amount) : null;
+}
+
+function getNewYorkOffsetMs(date: Date) {
+  const parts = new Intl.DateTimeFormat("en-US", {
+    timeZone: "America/New_York",
+    year: "numeric",
+    month: "2-digit",
+    day: "2-digit",
+    hour: "2-digit",
+    minute: "2-digit",
+    second: "2-digit",
+    hourCycle: "h23",
+  }).formatToParts(date);
+  const values = Object.fromEntries(
+    parts
+      .filter((part) => part.type !== "literal")
+      .map((part) => [part.type, Number(part.value)]),
+  );
+
+  return (
+    Date.UTC(
+      values.year,
+      values.month - 1,
+      values.day,
+      values.hour,
+      values.minute,
+      values.second,
+    ) - date.getTime()
+  );
+}
+
+function isValidDateParts(year: number, month: number, day: number) {
+  const date = new Date(Date.UTC(year, month - 1, day));
+
+  return (
+    date.getUTCFullYear() === year &&
+    date.getUTCMonth() === month - 1 &&
+    date.getUTCDate() === day
+  );
+}
+
+function isValidDateTimeLocalMatch(match: RegExpExecArray) {
+  const [, year, month, day, hour, minute, second = "0"] = match;
+  const yearValue = Number(year);
+  const monthValue = Number(month);
+  const dayValue = Number(day);
+  const hourValue = Number(hour);
+  const minuteValue = Number(minute);
+  const secondValue = Number(second);
+
+  return (
+    isValidDateParts(yearValue, monthValue, dayValue) &&
+    hourValue >= 0 &&
+    hourValue <= 23 &&
+    minuteValue >= 0 &&
+    minuteValue <= 59 &&
+    secondValue >= 0 &&
+    secondValue <= 59
+  );
+}
+
+function dateTimeLocalToTimeZoneIso(value: string) {
+  const match = DATE_TIME_LOCAL_PATTERN.exec(value);
+
+  if (!match || !isValidDateTimeLocalMatch(match)) {
+    return null;
+  }
+
+  const [, year, month, day, hour, minute, second = "0"] = match;
+  const localAsUtc = Date.UTC(
+    Number(year),
+    Number(month) - 1,
+    Number(day),
+    Number(hour),
+    Number(minute),
+    Number(second),
+  );
+  let instant = localAsUtc - getNewYorkOffsetMs(new Date(localAsUtc));
+  instant = localAsUtc - getNewYorkOffsetMs(new Date(instant));
+
+  return new Date(instant).toISOString();
+}
+
+function parsePaidAt(formData: FormData) {
+  const paidAt = stringValue(formData.get("paidAt"));
+
+  if (!paidAt) {
+    return { kind: "empty" } as const;
+  }
+
+  const value = dateTimeLocalToTimeZoneIso(paidAt);
+
+  return value ? ({ kind: "value", value } as const) : ({ kind: "invalid" } as const);
+}
+
+function parseManualMethod(value: string) {
+  return value === "check" || value === "cash" || value === "manual" || value === "other"
+    ? value
+    : "";
+}
+
+function parseAllocationObject(value: unknown): ManualPaymentAllocationInput | null {
+  if (!value || typeof value !== "object") {
+    return null;
+  }
+
+  const allocation = value as { assessmentId?: unknown; amountCents?: unknown };
+  const assessmentId = typeof allocation.assessmentId === "string" ? allocation.assessmentId : "";
+  const amountCents =
+    typeof allocation.amountCents === "number" && Number.isSafeInteger(allocation.amountCents)
+      ? allocation.amountCents
+      : null;
+
+  if (!assessmentId || !amountCents || amountCents <= 0) {
+    return null;
+  }
+
+  return { assessmentId, amountCents };
+}
+
+function parseAllocations(formData: FormData): ManualPaymentAllocationInput[] | null {
+  const allocations = stringValue(formData.get("allocations"));
+
+  if (!allocations) {
+    return [];
+  }
+
+  if (allocations.startsWith("[")) {
+    try {
+      const parsed = JSON.parse(allocations) as unknown;
+
+      if (!Array.isArray(parsed)) {
+        return null;
+      }
+
+      const mapped = parsed.map(parseAllocationObject);
+
+      return mapped.every(Boolean) ? (mapped as ManualPaymentAllocationInput[]) : null;
+    } catch {
+      return null;
+    }
+  }
+
+  const parsedLines: ManualPaymentAllocationInput[] = [];
+
+  for (const line of allocations.split(/\r?\n/)) {
+    const trimmed = line.trim();
+
+    if (!trimmed) {
+      continue;
+    }
+
+    const match = ALLOCATION_LINE_PATTERN.exec(trimmed);
+
+    if (!match) {
+      return null;
+    }
+
+    const amountCents = parseDollarAmountCents(match[2]);
+
+    if (!amountCents) {
+      return null;
+    }
+
+    parsedLines.push({ assessmentId: match[1], amountCents });
+  }
+
+  return parsedLines;
+}
+
+function redirectToAdminPayments(input: {
+  communitySlug: string;
+  status: string;
+  field?: string | null;
+}): never {
+  const params = new URLSearchParams({
+    manualPayment: input.status,
+    communitySlug: input.communitySlug,
+  });
+
+  if (input.field) {
+    params.set("manualPaymentField", input.field);
+  }
+
+  redirect(`/admin/payments?${params.toString()}`);
+}
+
+function invalidFieldFromErrors(fieldErrors: Record<string, string[]>) {
+  const [firstField] = Object.keys(fieldErrors);
+
+  if (!firstField) {
+    return "form";
+  }
+
+  if (firstField.startsWith("allocations")) {
+    return "allocations";
+  }
+
+  if (firstField === "amountCents") {
+    return "amount";
+  }
+
+  if (firstField === "method") {
+    return "manualMethod";
+  }
+
+  return firstField;
+}
+
+function manualPaymentStatusKey(result: Exclude<RecordManualPaymentResult, { kind: "recorded" | "invalid-input" }>) {
+  switch (result.kind) {
+    case "configuration-disabled":
+      return "disabled";
+    case "permission-denied":
+      return "denied";
+    case "unauthenticated":
+      return "signin";
+    case "profile-unavailable":
+    case "payment-unavailable":
+      return "unavailable";
+  }
+}
+
+export async function recordAdminManualPayment(formData: FormData) {
+  const amountCents = parseAmountCents(formData);
+  const method = parseManualMethod(
+    stringValue(formData.get("manualMethod")) || stringValue(formData.get("method")),
+  );
+  const allocations = parseAllocations(formData);
+  const communitySlug = stringValue(formData.get("communitySlug")) || DEFAULT_COMMUNITY_SLUG;
+  const paidAt = parsePaidAt(formData);
+
+  if (!amountCents) {
+    redirectToAdminPayments({ communitySlug, status: "invalid", field: "amount" });
+  }
+
+  if (!method) {
+    redirectToAdminPayments({ communitySlug, status: "invalid", field: "manualMethod" });
+  }
+
+  if (allocations === null) {
+    redirectToAdminPayments({ communitySlug, status: "invalid", field: "allocations" });
+  }
+
+  if (paidAt.kind === "invalid") {
+    redirectToAdminPayments({ communitySlug, status: "invalid", field: "paidAt" });
+  }
+
+  const result = await recordManualPayment({
+    communitySlug,
+    propertyId: stringValue(formData.get("propertyId")),
+    requestId: stringValue(formData.get("requestId")),
+    amountCents,
+    method,
+    paidAt: paidAt.kind === "value" ? paidAt.value : null,
+    reason: stringValue(formData.get("reason")) || null,
+    allocations,
+  });
+
+  if (result.kind === "recorded") {
+    redirectToAdminPayments({ communitySlug, status: "recorded" });
+  }
+
+  if (result.kind === "invalid-input") {
+    redirectToAdminPayments({
+      communitySlug,
+      status: "invalid",
+      field: invalidFieldFromErrors(result.fieldErrors),
+    });
+  }
+
+  redirectToAdminPayments({ communitySlug, status: manualPaymentStatusKey(result) });
+}

diff --git a/app/(admin)/admin/payments/page.tsx b/app/(admin)/admin/payments/page.tsx
new file mode 100644
index 0000000..4ccbbe6
--- /dev/null
+++ b/app/(admin)/admin/payments/page.tsx
@@ -0,0 +1,763 @@
+import { recordAdminManualPayment } from "@/server/actions/admin-payments";
+import {
+  listAdminPaymentRecords,
+  type AdminPaymentMethod,
+  type AdminPaymentPayerType,
+  type AdminPaymentRecord,
+  type AdminPaymentStatus,
+} from "@/server/services/payments/admin-payment-management";
+
+const DEFAULT_COMMUNITY_SLUG = "spring-meadow-community";
+const PAGE_SIZE = 50;
+const MAX_PAGE_OFFSET = 10000;
+
+type AdminPaymentsPageProps = {
+  searchParams?: Promise<{
+    communitySlug?: string | string[];
+    status?: string | string[];
+    payerType?: string | string[];
+    method?: string | string[];
+    query?: string | string[];
+    from?: string | string[];
+    to?: string | string[];
+    pageOffset?: string | string[];
+    manualPayment?: string | string[];
+    manualPaymentField?: string | string[];
+  }>;
+};
+
+function getSingleSearchParam(value: string | string[] | undefined) {
+  return Array.isArray(value) ? value[0] : value;
+}
+
+function parsePageOffset(value: string | undefined) {
+  const parsed = Number(value);
+
+  return Number.isInteger(parsed) && parsed > 0 ? Math.min(parsed, MAX_PAGE_OFFSET) : 0;
+}
+
+function formatCurrency(value: number | null) {
+  if (value === null) {
+    return "Not available";
+  }
+
+  return new Intl.NumberFormat("en-US", {
+    style: "currency",
+    currency: "USD",
+  }).format(value / 100);
+}
+
+function formatDateTime(value: string | null) {
+  if (!value) {
+    return "Not available";
+  }
+
+  const date = new Date(value);
+
+  if (Number.isNaN(date.getTime())) {
+    return "Not available";
+  }
+
+  return new Intl.DateTimeFormat("en-US", {
+    month: "short",
+    day: "numeric",
+    year: "numeric",
+    hour: "numeric",
+    minute: "2-digit",
+    timeZone: "America/New_York",
+  }).format(date);
+}
+
+function formatStatus(value: AdminPaymentStatus) {
+  const labels: Record<AdminPaymentStatus, string> = {
+    created: "Created",
+    pending: "Pending",
+    succeeded: "Succeeded",
+    failed: "Failed",
+    refunded: "Refunded",
+    partially_refunded: "Partially refunded",
+    void: "Void",
+  };
+
+  return labels[value];
+}
+
+function formatPayerType(value: AdminPaymentPayerType) {
+  const labels: Record<AdminPaymentPayerType, string> = {
+    resident: "Resident",
+    guest: "Guest",
+    admin_recorded: "HOA recorded",
+  };
+
+  return labels[value];
+}
+
+function formatMethod(value: AdminPaymentMethod) {
+  const labels: Record<AdminPaymentMethod, string> = {
+    card: "Card",
+    ach: "ACH",
+    check: "Check",
+    cash: "Cash",
+    manual: "Manual",
+    other: "Other",
+  };
+
+  return labels[value];
+}
+
+function formatFeePolicy(value: AdminPaymentRecord["feePolicy"]) {
+  return value === "hoa_pays" ? "HOA pays" : "Payer pays";
+}
+
+function shortToken(value: string) {
+  if (value.length <= 14) {
+    return value;
+  }
+
+  return `${value.slice(0, 8)}...${value.slice(-4)}`;
+}
+
+function stripeSummary(payment: AdminPaymentRecord) {
+  const entries = [
+    payment.stripeCheckoutSessionId ? `Session ${shortToken(payment.stripeCheckoutSessionId)}` : null,
+    payment.stripePaymentIntentId ? `Intent ${shortToken(payment.stripePaymentIntentId)}` : null,
+    payment.stripeChargeId ? `Charge ${shortToken(payment.stripeChargeId)}` : null,
+  ].filter(Boolean);
+
+  return entries.length > 0 ? entries.join(" / ") : "None";
+}
+
+function selected(current: string | undefined, value: string) {
+  return current === value;
+}
+
+function setOptionalParam(params: URLSearchParams, key: string, value: string | undefined) {
+  if (value) {
+    params.set(key, value);
+  }
+}
+
+function paymentRecordsHref(input: {
+  communitySlug: string;
+  status?: string;
+  payerType?: string;
+  method?: string;
+  query?: string;
+  from?: string;
+  to?: string;
+  pageOffset: number;
+}) {
+  const params = new URLSearchParams({ communitySlug: input.communitySlug });
+
+  setOptionalParam(params, "status", input.status);
+  setOptionalParam(params, "payerType", input.payerType);
+  setOptionalParam(params, "method", input.method);
+  setOptionalParam(params, "query", input.query);
+  setOptionalParam(params, "from", input.from);
+  setOptionalParam(params, "to", input.to);
+
+  if (input.pageOffset > 0) {
+    params.set("pageOffset", String(input.pageOffset));
+  }
+
+  return `/admin/payments?${params.toString()}`;
+}
+
+function ManualPaymentNotice({ value }: { value: string | undefined }) {
+  const notices: Record<string, string> = {
+    recorded: "Manual payment recorded.",
+    invalid: "Check the manual payment details and try again.",
+    disabled: "Manual payment recording is disabled.",
+    denied: "You do not have permission to record payments.",
+    signin: "Sign in before recording payments.",
+    unavailable: "Manual payment recording is temporarily unavailable.",
+  };
+  const message = value ? notices[value] : null;
+
+  return (
+    <p
+      id="manual-payment-status"
+      aria-live="polite"
+      className="min-h-6 text-sm leading-6 text-[#4f5f5a]"
+    >
+      {message}
+    </p>
+  );
+}
+
+const manualPaymentErrorIds: Record<string, string> = {
+  propertyId: "manual-payment-error-propertyId",
+  amount: "manual-payment-error-amount",
+  manualMethod: "manual-payment-error-manualMethod",
+  paidAt: "manual-payment-error-paidAt",
+  allocations: "manual-payment-error-allocations",
+  reason: "manual-payment-error-reason",
+  form: "manual-payment-error-form",
+};
+
+function manualPaymentErrorId(field: string) {
+  return manualPaymentErrorIds[field] ?? manualPaymentErrorIds.form;
+}
+
+function manualPaymentErrorMessage(field: string) {
+  const messages: Record<string, string> = {
+    propertyId: "Enter a valid property ID.",
+    amount: "Enter a valid payment amount.",
+    manualMethod: "Choose an offline payment method.",
+    paidAt: "Enter a valid paid date and time.",
+    allocations: "Check the allocation lines.",
+    reason: "Remove payment instrument details from the reason.",
+    form: "Check the manual payment details.",
+  };
+
+  return messages[field] ?? messages.form;
+}
+
+function isManualPaymentFieldInvalid(
+  manualPayment: string | undefined,
+  manualPaymentField: string | undefined,
+  field: string,
+) {
+  return manualPayment === "invalid" && manualPaymentField === field;
+}
+
+function manualPaymentDescribedBy(
+  manualPayment: string | undefined,
+  manualPaymentField: string | undefined,
+  field: string,
+) {
+  return isManualPaymentFieldInvalid(manualPayment, manualPaymentField, field)
+    ? `manual-payment-status ${manualPaymentErrorId(field)}`
+    : "manual-payment-status";
+}
+
+function ManualPaymentFieldError({
+  field,
+  active,
+}: {
+  field: string;
+  active: boolean;
+}) {
+  if (!active) {
+    return null;
+  }
+
+  return (
+    <p id={manualPaymentErrorId(field)} className="text-sm leading-6 text-[#8a3f2d]">
+      {manualPaymentErrorMessage(field)}
+    </p>
+  );
+}
+
+function Filters({
+  communitySlug,
+  status,
+  payerType,
+  method,
+  query,
+  from,
+  to,
+}: {
+  communitySlug: string;
+  status?: string;
+  payerType?: string;
+  method?: string;
+  query?: string;
+  from?: string;
+  to?: string;
+}) {
+  const inputClass =
+    "min-h-10 rounded-sm border border-[var(--border)] bg-white px-3 py-2 text-sm text-[var(--foreground)] outline-none focus:border-[var(--accent)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--gold)]";
+
+  return (
+    <form className="mt-6 grid gap-3 border-y border-[var(--border)] py-4 lg:grid-cols-6">
+      <input type="hidden" name="communitySlug" value={communitySlug} />
+      <div className="grid gap-1">
+        <label htmlFor="status" className="text-xs font-semibold uppercase text-[var(--accent)]">
+          Status
+        </label>
+        <select id="status" name="status" defaultValue={status ?? ""} className={inputClass}>
+          <option value="">All</option>
+          {["created", "pending", "succeeded", "failed", "refunded", "partially_refunded", "void"].map(
+            (option) => (
+              <option key={option} value={option}>
+                {formatStatus(option as AdminPaymentStatus)}
+              </option>
+            ),
+          )}
+        </select>
+      </div>
+      <div className="grid gap-1">
+        <label htmlFor="payerType" className="text-xs font-semibold uppercase text-[var(--accent)]">
+          Payer
+        </label>
+        <select id="payerType" name="payerType" defaultValue={payerType ?? ""} className={inputClass}>
+          <option value="">All</option>
+          <option value="resident">Resident</option>
+          <option value="guest">Guest</option>
+          <option value="admin_recorded">HOA recorded</option>
+        </select>
+      </div>
+      <div className="grid gap-1">
+        <label htmlFor="method" className="text-xs font-semibold uppercase text-[var(--accent)]">
+          Method
+        </label>
+        <select id="method" name="method" defaultValue={method ?? ""} className={inputClass}>
+          <option value="">All</option>
+          <option value="card">Card</option>
+          <option value="ach">ACH</option>
+          <option value="check">Check</option>
+          <option value="cash">Cash</option>
+          <option value="manual">Manual</option>
+          <option value="other">Other</option>
+        </select>
+      </div>
+      <div className="grid gap-1">
+        <label htmlFor="query" className="text-xs font-semibold uppercase text-[var(--accent)]">
+          Property
+        </label>
+        <input id="query" name="query" type="search" defaultValue={query ?? ""} className={inputClass} />
+      </div>
+      <div className="grid gap-1">
+        <label htmlFor="from" className="text-xs font-semibold uppercase text-[var(--accent)]">
+          From
+        </label>
+        <input id="from" name="from" type="date" defaultValue={from ?? ""} className={inputClass} />
+      </div>
+      <div className="grid gap-1">
+        <label htmlFor="to" className="text-xs font-semibold uppercase text-[var(--accent)]">
+          To
+        </label>
+        <input id="to" name="to" type="date" defaultValue={to ?? ""} className={inputClass} />
+      </div>
+      <div className="lg:col-span-6">
+        <button
+          type="submit"
+          className="inline-flex min-h-10 items-center justify-center rounded-sm bg-[var(--foreground)] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#24483e] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--gold)]"
+        >
+          Apply filters
+        </button>
+      </div>
+    </form>
+  );
+}
+
+function PaymentTable({ records }: { records: AdminPaymentRecord[] }) {
+  if (records.length === 0) {
+    return (
+      <p className="mt-6 border-b border-[var(--border)] pb-6 text-sm leading-6 text-[#4f5f5a]">
+        No payment records match the current filters.
+      </p>
+    );
+  }
+
+  return (
+    <div className="mt-6 overflow-x-auto">
+      <table className="min-w-[1040px] border-collapse text-left text-sm">
+        <thead>
+          <tr className="border-b border-[var(--border)] text-xs uppercase text-[var(--accent)]">
+            <th scope="col" className="py-2 pr-4 font-semibold">
+              Paid
+            </th>
+            <th scope="col" className="py-2 pr-4 font-semibold">
+              Created
+            </th>
+            <th scope="col" className="py-2 pr-4 font-semibold">
+              Updated
+            </th>
+            <th scope="col" className="py-2 pr-4 font-semibold">
+              Property
+            </th>
+            <th scope="col" className="py-2 pr-4 font-semibold">
+              Status
+            </th>
+            <th scope="col" className="py-2 pr-4 font-semibold">
+              Payer
+            </th>
+            <th scope="col" className="py-2 pr-4 font-semibold">
+              Amount
+            </th>
+            <th scope="col" className="py-2 pr-4 font-semibold">
+              Method
+            </th>
+            <th scope="col" className="py-2 pr-4 font-semibold">
+              Fee policy
+            </th>
+            <th scope="col" className="py-2 pr-4 font-semibold">
+              Receipt
+            </th>
+            <th scope="col" className="py-2 pr-4 font-semibold">
+              Stripe
+            </th>
+            <th scope="col" className="py-2 pr-4 font-semibold">
+              Allocated
+            </th>
+            <th scope="col" className="py-2 pr-4 font-semibold">
+              Unapplied
+            </th>
+          </tr>
+        </thead>
+        <tbody>
+          {records.map((payment) => (
+            <tr key={payment.id} className="border-b border-[var(--border)] last:border-0">
+              <td className="py-3 pr-4 text-[var(--foreground)]">
+                {formatDateTime(payment.paidAt)}
+              </td>
+              <td className="py-3 pr-4 text-[#4f5f5a]">
+                {formatDateTime(payment.createdAt)}
+              </td>
+              <td className="py-3 pr-4 text-[#4f5f5a]">
+                {formatDateTime(payment.updatedAt)}
+              </td>
+              <td className="max-w-[240px] py-3 pr-4 text-[var(--foreground)]">
+                {payment.propertyLabel}
+              </td>
+              <td className="py-3 pr-4 text-[#4f5f5a]">{formatStatus(payment.status)}</td>
+              <td className="py-3 pr-4 text-[#4f5f5a]">{formatPayerType(payment.payerType)}</td>
+              <td className="py-3 pr-4 font-semibold text-[var(--foreground)]">
+                {formatCurrency(payment.amountCents)}
+              </td>
+              <td className="py-3 pr-4 text-[#4f5f5a]">{formatMethod(payment.method)}</td>
+              <td className="py-3 pr-4 text-[#4f5f5a]">{formatFeePolicy(payment.feePolicy)}</td>
+              <td className="py-3 pr-4 text-[#4f5f5a]">{payment.receiptNumber ?? "None"}</td>
+              <td className="max-w-[220px] py-3 pr-4 text-[#4f5f5a]">
+                <span
+                  title={[
+                    payment.stripeCheckoutSessionId,
+                    payment.stripePaymentIntentId,
+                    payment.stripeChargeId,
+                  ]
+                    .filter(Boolean)
+                    .join(" / ")}
+                >
+                  {stripeSummary(payment)}
+                </span>
+              </td>
+              <td className="py-3 pr-4 text-[#4f5f5a]">{formatCurrency(payment.allocatedCents)}</td>
+              <td className="py-3 pr-4 text-[#4f5f5a]">{formatCurrency(payment.unappliedCents)}</td>
+            </tr>
+          ))}
+        </tbody>
+      </table>
+    </div>
+  );
+}
+
+function PaginationControls({
+  communitySlug,
+  status,
+  payerType,
+  method,
+  query,
+  from,
+  to,
+  pageOffset,
+  hasNextPage,
+}: {
+  communitySlug: string;
+  status?: string;
+  payerType?: string;
+  method?: string;
+  query?: string;
+  from?: string;
+  to?: string;
+  pageOffset: number;
+  hasNextPage: boolean;
+}) {
+  const hasPreviousPage = pageOffset > 0;
+  const linkClass =
+    "inline-flex min-h-10 items-center justify-center rounded-sm border border-[var(--border)] px-3 py-2 text-sm font-semibold text-[var(--foreground)] transition hover:border-[var(--accent)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--gold)]";
+  const disabledClass =
+    "inline-flex min-h-10 items-center justify-center rounded-sm border border-[var(--border)] px-3 py-2 text-sm font-semibold text-[#8a9792]";
+
+  if (!hasPreviousPage && !hasNextPage) {
+    return null;
+  }
+
+  return (
+    <nav aria-label="Payment records pages" className="mt-4 flex items-center gap-3">
+      {hasPreviousPage ? (
+        <a
+          href={paymentRecordsHref({
+            communitySlug,
+            status,
+            payerType,
+            method,
+            query,
+            from,
+            to,
+            pageOffset: Math.max(pageOffset - PAGE_SIZE, 0),
+          })}
+          className={linkClass}
+        >
+          Previous
+        </a>
+      ) : (
+        <span aria-disabled="true" className={disabledClass}>
+          Previous
+        </span>
+      )}
+      {hasNextPage ? (
+        <a
+          href={paymentRecordsHref({
+            communitySlug,
+            status,
+            payerType,
+            method,
+            query,
+            from,
+            to,
+            pageOffset: pageOffset + PAGE_SIZE,
+          })}
+          className={linkClass}
+        >
+          Next
+        </a>
+      ) : (
+        <span aria-disabled="true" className={disabledClass}>
+          Next
+        </span>
+      )}
+    </nav>
+  );
+}
+
+function ManualPaymentForm({
+  communitySlug,
+  manualPayment,
+  manualPaymentField,
+}: {
+  communitySlug: string;
+  manualPayment?: string;
+  manualPaymentField?: string;
+}) {
+  const inputClass =
+    "min-h-11 rounded-sm border border-[var(--border)] bg-white px-3 py-2 text-base text-[var(--foreground)] outline-none focus:border-[var(--accent)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--gold)]";
+  const fieldInvalid = (field: string) =>
+    isManualPaymentFieldInvalid(manualPayment, manualPaymentField, field);
+  const fieldDescribedBy = (field: string) =>
+    manualPaymentDescribedBy(manualPayment, manualPaymentField, field);
+
+  return (
+    <form action={recordAdminManualPayment} className="mt-5 grid gap-4 border-t border-[var(--border)] pt-5">
+      <input type="hidden" name="communitySlug" value={communitySlug} />
+      <input type="hidden" name="requestId" value={crypto.randomUUID()} />
+      <div className="grid gap-4 md:grid-cols-2">
+        <div className="grid gap-2">
+          <label htmlFor="propertyId" className="text-sm font-semibold text-[var(--foreground)]">
+            Property ID
+          </label>
+          <input
+            id="propertyId"
+            name="propertyId"
+            type="text"
+            required
+            aria-invalid={fieldInvalid("propertyId")}
+            aria-describedby={fieldDescribedBy("propertyId")}
+            className={inputClass}
+          />
+          <ManualPaymentFieldError field="propertyId" active={fieldInvalid("propertyId")} />
+        </div>
+        <div className="grid gap-2">
+          <label htmlFor="amount" className="text-sm font-semibold text-[var(--foreground)]">
+            Amount
+          </label>
+          <input
+            id="amount"
+            name="amount"
+            type="text"
+            inputMode="decimal"
+            required
+            pattern="^[0-9]+(\\.[0-9]{1,2})?$"
+            aria-invalid={fieldInvalid("amount")}
+            aria-describedby={fieldDescribedBy("amount")}
+            className={inputClass}
+          />
+          <ManualPaymentFieldError field="amount" active={fieldInvalid("amount")} />
+        </div>
+        <div className="grid gap-2">
+          <label htmlFor="manualMethod" className="text-sm font-semibold text-[var(--foreground)]">
+            Method
+          </label>
+          <select
+            id="manualMethod"
+            name="manualMethod"
+            required
+            aria-invalid={fieldInvalid("manualMethod")}
+            aria-describedby={fieldDescribedBy("manualMethod")}
+            className={inputClass}
+          >
+            <option value="check">Check</option>
+            <option value="cash">Cash</option>
+            <option value="manual">Manual</option>
+            <option value="other">Other</option>
+          </select>
+          <ManualPaymentFieldError field="manualMethod" active={fieldInvalid("manualMethod")} />
+        </div>
+        <div className="grid gap-2">
+          <label htmlFor="paidAt" className="text-sm font-semibold text-[var(--foreground)]">
+            Paid at
+          </label>
+          <input
+            id="paidAt"
+            name="paidAt"
+            type="datetime-local"
+            aria-invalid={fieldInvalid("paidAt")}
+            aria-describedby={fieldDescribedBy("paidAt")}
+            className={inputClass}
+          />
+          <ManualPaymentFieldError field="paidAt" active={fieldInvalid("paidAt")} />
+        </div>
+      </div>
+      <div className="grid gap-2">
+        <label htmlFor="allocations" className="text-sm font-semibold text-[var(--foreground)]">
+          Allocations
+        </label>
+        <textarea
+          id="allocations"
+          name="allocations"
+          rows={4}
+          aria-invalid={fieldInvalid("allocations")}
+          aria-describedby={fieldDescribedBy("allocations")}
+          className={`${inputClass} resize-y`}
+        />
+        <ManualPaymentFieldError field="allocations" active={fieldInvalid("allocations")} />
+      </div>
+      <div className="grid gap-2">
+        <label htmlFor="reason" className="text-sm font-semibold text-[var(--foreground)]">
+          Reason
+        </label>
+        <textarea
+          id="reason"
+          name="reason"
+          rows={3}
+          aria-invalid={fieldInvalid("reason")}
+          aria-describedby={fieldDescribedBy("reason")}
+          className={`${inputClass} resize-y`}
+        />
+        <ManualPaymentFieldError field="reason" active={fieldInvalid("reason")} />
+      </div>
+      <div>
+        <button
+          type="submit"
+          className="inline-flex min-h-11 items-center justify-center rounded-sm bg-[var(--foreground)] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#24483e] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--gold)]"
+        >
+          Record offline payment
+        </button>
+      </div>
+    </form>
+  );
+}
+
+function ManualPaymentPanel({
+  communitySlug,
+  manualPaymentsEnabled,
+  manualPayment,
+  manualPaymentField,
+}: {
+  communitySlug: string;
+  manualPaymentsEnabled: boolean;
+  manualPayment?: string;
+  manualPaymentField?: string;
+}) {
+  return (
+    <section className="mt-8 border-t border-[var(--border)] pt-6">
+      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
+        <div>
+          <p className="text-xs font-semibold uppercase text-[var(--accent)]">Offline payments</p>
+          <h2 className="mt-2 text-xl font-semibold text-[var(--foreground)]">Record manual payment</h2>
+        </div>
+        <ManualPaymentNotice value={manualPayment} />
+      </div>
+      {manualPaymentsEnabled ? (
+        <ManualPaymentForm
+          communitySlug={communitySlug}
+          manualPayment={manualPayment}
+          manualPaymentField={manualPaymentField}
+        />
+      ) : (
+        <p className="mt-5 border-t border-[var(--border)] pt-5 text-sm leading-6 text-[#4f5f5a]">
+          Manual payment recording is disabled for this community.
+        </p>
+      )}
+    </section>
+  );
+}
+
+export default async function AdminPaymentsPage({ searchParams }: AdminPaymentsPageProps) {
+  const params = await searchParams;
+  const communitySlug = getSingleSearchParam(params?.communitySlug) || DEFAULT_COMMUNITY_SLUG;
+  const status = getSingleSearchParam(params?.status);
+  const payerType = getSingleSearchParam(params?.payerType);
+  const method = getSingleSearchParam(params?.method);
+  const query = getSingleSearchParam(params?.query);
+  const from = getSingleSearchParam(params?.from);
+  const to = getSingleSearchParam(params?.to);
+  const pageOffset = parsePageOffset(getSingleSearchParam(params?.pageOffset));
+  const manualPayment = getSingleSearchParam(params?.manualPayment);
+  const manualPaymentField = getSingleSearchParam(params?.manualPaymentField);
+  const result = await listAdminPaymentRecords({
+    communitySlug,
+    status,
+    payerType,
+    method,
+    query,
+    from,
+    to,
+    pageSize: PAGE_SIZE + 1,
+    pageOffset,
+  });
+
+  if (result.kind !== "records") {
+    return (
+      <main className="min-h-screen px-4 py-6 sm:px-6 lg:px-8">
+        <section className="mx-auto max-w-7xl">
+          <p className="text-sm font-semibold uppercase text-[var(--accent)]">Admin</p>
+          <h1 className="mt-3 text-3xl font-semibold text-[var(--foreground)]">Payment records</h1>
+          <p className="mt-4 max-w-2xl text-sm leading-6 text-[#4f5f5a]">
+            Payment records are unavailable.
+          </p>
+        </section>
+      </main>
+    );
+  }
+
+  const visibleRecords = result.records.slice(0, PAGE_SIZE);
+  const hasNextPage = result.records.length > PAGE_SIZE;
+
+  return (
+    <main className="min-h-screen px-4 py-6 sm:px-6 lg:px-8">
+      <section className="mx-auto max-w-7xl">
+        <p className="text-sm font-semibold uppercase text-[var(--accent)]">Admin</p>
+        <h1 className="mt-3 text-3xl font-semibold text-[var(--foreground)]">Payment records</h1>
+        <Filters
+          communitySlug={result.communitySlug}
+          status={status}
+          payerType={payerType}
+          method={method}
+          query={query}
+          from={from}
+          to={to}
+        />
+        <PaymentTable records={visibleRecords} />
+        <PaginationControls
+          communitySlug={result.communitySlug}
+          status={status}
+          payerType={payerType}
+          method={method}
+          query={query}
+          from={from}
+          to={to}
+          pageOffset={pageOffset}
+          hasNextPage={hasNextPage}
+        />
+        <ManualPaymentPanel
+          communitySlug={result.communitySlug}
+          manualPaymentsEnabled={result.manualPaymentsEnabled}
+          manualPayment={manualPayment}
+          manualPaymentField={manualPaymentField}
+        />
+      </section>
+    </main>
+  );
+}

diff --git a/tests/admin-payment-management.test.mjs b/tests/admin-payment-management.test.mjs
new file mode 100644
index 0000000..ce545b9
--- /dev/null
+++ b/tests/admin-payment-management.test.mjs
@@ -0,0 +1,334 @@
+import { describe, it } from "node:test";
+import assert from "node:assert/strict";
+import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
+import { join } from "node:path";
+
+const root = process.cwd();
+
+function read(path) {
+  return readFileSync(join(root, path), "utf8");
+}
+
+function listFiles(path) {
+  const absolutePath = join(root, path);
+
+  if (!existsSync(absolutePath)) {
+    return [];
+  }
+
+  return readdirSync(absolutePath).flatMap((entry) => {
+    const relativePath = `${path}/${entry}`;
+    const entryPath = join(root, relativePath);
+
+    return statSync(entryPath).isDirectory() ? listFiles(relativePath) : [relativePath];
+  });
+}
+
+function readExisting(paths) {
+  return paths.filter((path) => existsSync(join(root, path))).map(read).join("\n");
+}
+
+function assertOrdered(content, patterns) {
+  let previousIndex = -1;
+
+  for (const pattern of patterns) {
+    const match = pattern.exec(content);
+
+    assert.ok(match, `Expected to find ${pattern}`);
+    assert.ok(match.index > previousIndex, `Expected ${pattern} to appear in order`);
+    previousIndex = match.index;
+  }
+}
+
+describe("admin payment records and manual payments", () => {
+  it("adds schema, permission, config, idempotency, and scoped admin RPCs", () => {
+    const migrationPath =
+      "supabase/migrations/202605110008_admin_payment_records_and_manual_payments.sql";
+
+    assert.ok(existsSync(join(root, migrationPath)));
+
+    const migration = read(migrationPath);
+
+    assert.match(migration, /manual_payments_enabled boolean not null default false/i);
+    assert.match(migration, /admin\.payments\.manage/i);
+    assert.match(migration, /where key = 'admin'/i);
+    assert.doesNotMatch(migration, /where key = 'resident'[\s\S]*admin\.payments\.manage/i);
+    assert.match(migration, /create table if not exists public\.manual_payment_requests/i);
+    assert.match(migration, /request_id uuid not null/i);
+    assert.match(migration, /unique \(community_id, request_id\)/i);
+    assert.match(migration, /payment_id uuid references public\.payments\(id\)/i);
+    assert.match(migration, /alter table public\.manual_payment_requests enable row level security/i);
+    assert.match(migration, /revoke all on public\.manual_payment_requests from anon, authenticated/i);
+    assert.match(migration, /create or replace function app\.set_manual_payment_requests_updated_at/i);
+    assert.match(migration, /set search_path = public/i);
+    assert.match(migration, /execute function app\.set_manual_payment_requests_updated_at/i);
+    assert.match(migration, /revoke all on function app\.set_manual_payment_requests_updated_at\(\) from public, anon, authenticated/i);
+    assert.match(migration, /create or replace function public\.list_admin_payment_records/i);
+    assert.match(migration, /create or replace function public\.record_manual_payment/i);
+    assert.match(migration, /security definer/i);
+    assert.match(migration, /set search_path = public, app/i);
+    assert.match(migration, /app\.current_profile_id\(\)/);
+    assert.match(migration, /app\.has_permission\(target_community_id, 'admin\.payments\.manage'\)/);
+    assert.match(migration, /revoke all on function public\.list_admin_payment_records/i);
+    assert.match(migration, /revoke all on function public\.record_manual_payment/i);
+    assert.match(migration, /grant execute on function public\.list_admin_payment_records[\s\S]*to authenticated/i);
+    assert.match(migration, /grant execute on function public\.record_manual_payment[\s\S]*to authenticated/i);
+    assert.match(migration, /jsonb_agg/i);
+    assert.match(migration, /search_query text/i);
+    assert.match(migration, /replace\(btrim\(coalesce\(filter_query, ''\)\), chr\(92\), chr\(92\) \|\| chr\(92\)\)/i);
+    assert.match(migration, /ilike '%' \|\| search_query \|\| '%' escape chr\(92\)/i);
+    assert.match(migration, /allocated_cents/i);
+    assert.match(migration, /unapplied_cents/i);
+    assert.match(migration, /stripe_checkout_session_id/i);
+    assert.match(migration, /stripe_payment_intent_id/i);
+    assert.match(migration, /stripe_charge_id/i);
+    assert.doesNotMatch(migration, /grant select on public\.(payments|payment_allocations|payment_events|audit_logs|email_logs) to authenticated/i);
+    assert.doesNotMatch(migration, /owner_display_name|public_payment_code|guest_phone|raw_lookup|card_number|bank_account|routing_number/i);
+  });
+
+  it("records manual payments atomically with allocation, summary, last-payment, audit, and duplicate-submit safety", () => {
+    const migration = read(
+      "supabase/migrations/202605110008_admin_payment_records_and_manual_payments.sql",
+    );
+
+    assert.match(migration, /manual_payments_enabled = true/i);
+    assert.match(migration, /select \*[\s\S]*from public\.manual_payment_requests[\s\S]*for update/i);
+    assert.match(migration, /status = 'recorded'/i);
+    assert.match(migration, /return jsonb_build_object\('status', 'recorded'[\s\S]*'existing', true/i);
+    assert.match(migration, /insert into public\.payments/i);
+    assert.match(migration, /payer_type,\s*profile_id/s);
+    assert.match(migration, /'admin_recorded'/);
+    assert.match(migration, /'succeeded'/);
+    assert.match(migration, /created_by/);
+    assert.match(migration, /'SMC-' \|\| upper\(substr\(replace\(created_payment_id::text, '-'/i);
+    assert.match(migration, /payment_method not in \('check', 'cash', 'manual', 'other'\)/i);
+    assert.match(migration, /payment_method in \('card', 'ach'\)/i);
+    assert.match(migration, /payment_amount_cents > 100000000/i);
+    assert.match(migration, /payment_paid_at > now\(\) \+ interval '5 minutes'/i);
+    assert.match(migration, /pg_advisory_xact_lock/i);
+    assert.match(migration, /manual_payment_requests\.request_id = record_manual_payment\.request_id/i);
+    assert.match(migration, /on conflict \(community_id, request_id\) do update/i);
+    assert.match(migration, /jsonb_array_length\(coalesce\(allocation_input, '\[\]'::jsonb\)\) > 100/i);
+    assert.match(migration, /length\(btrim\(payment_reason\)\) > 500/i);
+    assert.match(migration, /card number[\s\S]*routing number[\s\S]*bank account[\s\S]*\(\[0-9\]\[ -\]\?\)\{9,\}/i);
+    assert.match(migration, /from public\.community_settings[\s\S]*for update/i);
+    assert.match(migration, /seen_assessment_ids/i);
+    assert.match(migration, /allocation_assessment_id = any\(seen_assessment_ids\)/i);
+    assert.match(migration, /length\(allocation_record->>'amountCents'\) > 9/i);
+    assert.match(migration, /explicit_allocation_total bigint/i);
+    assert.match(migration, /for update/i);
+    assert.match(migration, /order by assessments\.due_date asc, assessments\.created_at asc, assessments\.id asc/i);
+    assert.match(migration, /least\(remaining_amount_cents, assessment_record\.balance_cents\)/i);
+    assert.match(migration, /insert into public\.payment_allocations/i);
+    assert.doesNotMatch(migration, /on conflict \(payment_id, assessment_id\) do nothing/i);
+    assert.match(migration, /paid_cents = paid_cents \+ allocation_cents/i);
+    assert.match(migration, /perform app\.recalculate_property_assessment_summary/i);
+    assert.match(migration, /last_payment_at/i);
+    assert.match(migration, /max\(coalesce\(payments\.paid_at, payments\.created_at\)\)/i);
+    assert.match(migration, /insert into public\.audit_logs/i);
+    assert.match(migration, /'user'/);
+    assert.match(migration, /'payment\.manual\.create'/);
+    assert.match(migration, /request_id::text/);
+    assert.match(migration, /payment_events/);
+
+    const duplicateBlock = migration.match(
+      /if request_record\.status = 'recorded'[\s\S]*?end if;/i,
+    )?.[0];
+
+    assert.ok(duplicateBlock);
+    assert.doesNotMatch(duplicateBlock, /insert into public\.payments|payment_allocations|paid_cents = paid_cents/i);
+
+    const functionBody = migration.match(
+      /create or replace function public\.record_manual_payment[\s\S]*?end;\n\$\$/i,
+    )?.[0];
+    assert.ok(functionBody);
+
+    const requestInsertIndex = functionBody.indexOf("insert into public.manual_payment_requests");
+    assert.ok(requestInsertIndex > 0);
+    const beforeRequestInsert = functionBody.slice(0, requestInsertIndex);
+
+    assert.doesNotMatch(
+      beforeRequestInsert,
+      /update public\.manual_payment_requests\s+set\s+status = 'failed'/i,
+    );
+  });
+
+  it("implements a server-only admin payment management service with safe typed results", () => {
+    const servicePath = "server/services/payments/admin-payment-management.ts";
+
+    assert.ok(existsSync(join(root, servicePath)));
+
+    const service = read(servicePath);
+
+    assert.match(service, /import "server-only"/);
+    assert.match(service, /createClient/);
+    assert.match(service, /hasPermission/);
+    assert.match(service, /PERMISSION_DENIED_MESSAGE/);
+    assert.match(service, /PROFILE_UNAVAILABLE_MESSAGE/);
+    assert.match(service, /admin\.payments\.manage/);
+    assert.match(service, /listAdminPaymentRecords/);
+    assert.match(service, /recordManualPayment/);
+    assert.match(service, /\.rpc\("list_admin_payment_records"/);
+    assert.match(service, /\.rpc\("record_manual_payment"/);
+    assert.match(service, /isUuid/);
+    assert.match(service, /isDateTime/);
+    assert.match(service, /isPositiveInteger/);
+    assert.match(service, /OFFLINE_PAYMENT_METHODS/);
+    assert.match(service, /check/);
+    assert.match(service, /cash/);
+    assert.match(service, /manual/);
+    assert.match(service, /other/);
+    assert.match(service, /configuration-disabled/);
+    assert.match(service, /invalid-input/);
+    assert.match(service, /payment-unavailable/);
+    assert.match(service, /ADMIN_PAYMENT_TIME_ZONE = "America\/New_York"/);
+    assert.match(service, /MAX_PAGE_OFFSET = 10000/);
+    assert.match(service, /MAX_QUERY_LENGTH = 200/);
+    assert.match(service, /MAX_REASON_LENGTH = 500/);
+    assert.match(service, /MAX_MANUAL_ALLOCATIONS = 100/);
+    assert.match(service, /manualPaymentsEnabled/);
+    assert.match(service, /allocatedCents/);
+    assert.match(service, /unappliedCents/);
+    assert.match(service, /DATE_ONLY_PATTERN/);
+    assert.match(service, /DATE_TIME_LOCAL_PATTERN/);
+    assert.match(service, /isValidDateTimeLocal/);
+    assert.match(service, /dateTimeLocalToTimeZoneIso/);
+    assert.match(service, /normalizeFromDateTime/);
+    assert.match(service, /normalizeToDateTime/);
+    assert.match(service, /T23:59:59\.999/);
+    assert.match(service, /filter_from: normalizeFromDateTime\(input\.from\)/);
+    assert.match(service, /filter_to: normalizeToDateTime\(input\.to\)/);
+    assert.match(service, /SENSITIVE_PAYMENT_REASON_PATTERN/);
+    assert.match(service, /\(\\d\[ -\]\?\)\{9,\}/);
+    assert.match(service, /Math\.min\(Math\.max\(Number\(value\), 0\), MAX_PAGE_OFFSET\)/);
+    assert.match(service, /reason\.length > MAX_REASON_LENGTH/);
+    assert.match(service, /allocations\.length > MAX_MANUAL_ALLOCATIONS/);
+
+    assertOrdered(service, [
+      /resolveCommunity/,
+      /hasPermission/,
+      /\.rpc\("list_admin_payment_records"/,
+    ]);
+
+    assert.doesNotMatch(
+      service,
+      /createServiceRoleClient|from "stripe"|from "resend"|error\.message|owner_display_name|public_payment_code|guest_phone|raw lookup|card_number|bank_account|routing_number|SERVICE_ROLE|SUPABASE_SECRET_KEY|SUPABASE_SERVICE_ROLE_KEY|STRIPE_SECRET_KEY|RESEND_API_KEY/i,
+    );
+  });
+
+  it("adds a server action that parses manual payment form data safely", () => {
+    const actionPath = "server/actions/admin-payments.ts";
+
+    assert.ok(existsSync(join(root, actionPath)));
+
+    const action = read(actionPath);
+
+    assert.match(action, /"use server"/);
+    assert.match(action, /recordManualPayment/);
+    assert.match(action, /FormData/);
+    assert.match(action, /requestId/);
+    assert.match(action, /communitySlug/);
+    assert.match(action, /propertyId/);
+    assert.match(action, /amountCents|parseAmountCents/);
+    assert.match(action, /method/);
+    assert.match(action, /paidAt/);
+    assert.match(action, /parsePaidAt/);
+    assert.match(action, /dateTimeLocalToTimeZoneIso/);
+    assert.match(action, /GROUPED_DECIMAL_DOLLAR_PATTERN/);
+    assert.match(action, /isValidDateTimeLocalMatch/);
+    assert.match(action, /paidAt\.kind === "invalid"/);
+    assert.match(action, /timeZone:\s*"America\/New_York"/);
+    assert.match(action, /reason/);
+    assert.match(action, /allocations/);
+    assert.match(action, /manualPaymentField/);
+    assert.match(action, /redirect\(`\/admin\/payments\?\$\{params\.toString\(\)\}`\)/);
+    assert.doesNotMatch(action, /formData\.get\("amountCents"\)/);
+    assert.doesNotMatch(action, /parseIntegerCents/);
+    assert.doesNotMatch(action, /error\.message|owner_display_name|public_payment_code|guest_phone|stripe_checkout_session_id|payment_intent|SERVICE_ROLE|SUPABASE_SECRET_KEY|SUPABASE_SERVICE_ROLE_KEY|STRIPE_SECRET_KEY|RESEND_API_KEY/i);
+  });
+
+  it("renders a focused, permission-backed admin payments page with filters and manual payment controls", () => {
+    const pagePath = "app/(admin)/admin/payments/page.tsx";
+
+    assert.ok(existsSync(join(root, pagePath)));
+
+    const page = read(pagePath);
+
+    assert.match(page, /listAdminPaymentRecords/);
+    assert.match(page, /recordAdminManualPayment/);
+    assert.match(page, /searchParams/);
+    assert.match(page, /Payment records/);
+    assert.match(page, /Status/);
+    assert.match(page, /Payer/);
+    assert.match(page, /Property/);
+    assert.match(page, /Amount/);
+    assert.match(page, /Method/);
+    assert.match(page, /Fee policy/);
+    assert.match(page, /Receipt/);
+    assert.match(page, /Stripe/);
+    assert.match(page, /Allocated/);
+    assert.match(page, /Unapplied/);
+    assert.match(page, /Paid/);
+    assert.match(page, /Created/);
+    assert.match(page, /Updated/);
+    assert.match(page, /name="status"/);
+    assert.match(page, /name="payerType"/);
+    assert.match(page, /name="method"/);
+    assert.match(page, /name="query"/);
+    assert.match(page, /name="from"/);
+    assert.match(page, /name="to"/);
+    assert.match(page, /pageOffset/);
+    assert.match(page, /MAX_PAGE_OFFSET = 10000/);
+    assert.match(page, /PAGE_SIZE \+ 1/);
+    assert.match(page, /PaginationControls/);
+    assert.match(page, /manualPaymentsEnabled/);
+    assert.match(page, /name="requestId"/);
+    assert.match(page, /crypto\.randomUUID/);
+    assert.match(page, /name="propertyId"/);
+    assert.match(page, /name="amount"/);
+    assert.match(page, /name="manualMethod"/);
+    assert.match(page, /name="paidAt"/);
+    assert.match(page, /name="allocations"/);
+    assert.match(page, /name="reason"/);
+    assert.match(page, /manualPaymentField/);
+    assert.match(page, /manual-payment-error-amount/);
+    assert.match(page, /manual-payment-error-manualMethod/);
+    assert.match(page, /manualPaymentField === field/);
+    assert.match(page, /aria-live/);
+    assert.match(page, /aria-invalid/);
+    assert.match(page, /overflow-x-auto/);
+
+    assert.doesNotMatch(
+      page,
+      /guest_phone|owner_display_name|public_payment_code|raw lookup|card number|bank account|routing number|SERVICE_ROLE|SUPABASE_SECRET_KEY|SUPABASE_SERVICE_ROLE_KEY|STRIPE_SECRET_KEY|RESEND_API_KEY/i,
+    );
+  });
+
+  it("keeps admin payment internals out of public and resident-facing surfaces", () => {
+    const clientFacingFiles = readExisting([
+      ...listFiles("app/(public)"),
+      ...listFiles("app/(resident)"),
+      ...listFiles("components/public"),
+      ...listFiles("components/resident"),
+      ...listFiles("lib/public"),
+    ]);
+
+    assert.doesNotMatch(
+      clientFacingFiles,
+      /admin-payment-management|admin-payments|recordManualPayment|listAdminPaymentRecords|admin\.payments\.manage|manual_payment_requests|manual_payments_enabled|payment\.manual\.create/i,
+    );
+  });
+
+  it("asserts Story 3.7 receipt eligibility still excludes admin-recorded payments", () => {
+    const receiptService = read("server/services/payments/payment-receipt-email.ts");
+    const receiptTypeBlock = receiptService.match(
+      /function receiptTypeForPayment[\s\S]*?return null;\n}/,
+    )?.[0];
+
+    assert.ok(receiptTypeBlock);
+    assert.match(receiptTypeBlock, /payment\.payer_type === "resident"[\s\S]*"payment_receipt"/);
+    assert.match(receiptTypeBlock, /payment\.payer_type === "guest"[\s\S]*"guest_payment_receipt"/);
+    assert.match(receiptService, /payer_type: "resident" \| "guest" \| "admin_recorded"/);
+    assert.doesNotMatch(receiptTypeBlock, /admin_recorded[\s\S]*payment_receipt/);
+  });
+});

```
