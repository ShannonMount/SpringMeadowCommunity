update public.roles
set
  permissions = case
    when 'board.delinquency.view' = any(permissions) then permissions
    else permissions || array['board.delinquency.view']::text[]
  end,
  updated_at = now()
where key in ('board_member', 'admin');

alter table public.community_settings
  add column if not exists delinquent_days_past_due integer not null default 15;

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
  oldest_unpaid_due_date date;
  has_disputed boolean;
  has_due_soon boolean;
  delinquent_days integer;
  lien_readiness_days integer;
begin
  select
    coalesce(community_settings.delinquent_days_past_due, 15),
    coalesce(community_settings.lien_readiness_days_past_due, 30)
  into
    delinquent_days,
    lien_readiness_days
  from public.community_settings
  where community_settings.community_id = target_community_id;

  delinquent_days := greatest(coalesce(delinquent_days, 15), 1);
  lien_readiness_days := coalesce(lien_readiness_days, 30);

  select
    coalesce(sum(balance_cents) filter (
      where status in ('open', 'partially_paid', 'overdue', 'disputed')
        and balance_cents > 0
    ), 0),
    min(due_date) filter (
      where balance_cents > 0
        and status in ('open', 'partially_paid', 'overdue', 'disputed')
    ),
    min(due_date) filter (
      where balance_cents > 0
        and status in ('open', 'partially_paid', 'overdue', 'disputed')
    ),
    coalesce(bool_or(
      balance_cents > 0
      and status = 'disputed'
    ), false),
    coalesce(bool_or(
      balance_cents > 0
      and due_date >= current_date
      and due_date <= current_date + 30
      and status in ('open', 'partially_paid', 'overdue', 'disputed')
    ), false)
  into
    summary_balance,
    summary_next_due,
    oldest_unpaid_due_date,
    has_disputed,
    has_due_soon
  from public.assessments
  where community_id = target_community_id
    and property_id = target_property_id;

  update public.properties
  set
    current_balance_cents = summary_balance,
    next_due_date = summary_next_due,
    delinquency_status = case
      when summary_balance <= 0 then 'current'
      when has_disputed then 'disputed'
      when oldest_unpaid_due_date <= current_date - lien_readiness_days then 'lien_review'
      when oldest_unpaid_due_date <= current_date - delinquent_days then 'delinquent'
      when oldest_unpaid_due_date < current_date then 'overdue'
      when has_due_soon then 'due_soon'
      else 'current'
    end,
    updated_at = now()
  where id = target_property_id
    and community_id = target_community_id;
end;
$$;

revoke all on function app.recalculate_property_assessment_summary(uuid, uuid) from public, anon, authenticated;

create or replace function public.list_delinquency_report(
  target_community_id uuid,
  filter_stage text default null,
  filter_from date default null,
  filter_to date default null,
  filter_query text default null,
  filter_minimum_balance_cents bigint default null,
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
  delinquent_days integer;
  lien_readiness_days integer;
  search_query text;
  records jsonb;
begin
  actor_profile_id := app.current_profile_id();

  if actor_profile_id is null
    or not app.has_permission(target_community_id, 'board.delinquency.view')
  then
    return jsonb_build_object('status', 'permission_denied');
  end if;

  if filter_stage is not null
    and filter_stage not in ('current', 'due_soon', 'overdue', 'delinquent', 'lien_review', 'disputed')
  then
    return jsonb_build_object('status', 'invalid');
  end if;

  if filter_query is not null
    and length(btrim(filter_query)) > 200
  then
    return jsonb_build_object('status', 'invalid');
  end if;

  if filter_minimum_balance_cents is not null
    and (
      filter_minimum_balance_cents < 0
      or filter_minimum_balance_cents > 2147483647
    )
  then
    return jsonb_build_object('status', 'invalid');
  end if;

  bounded_limit := least(greatest(coalesce(page_limit, 50), 1), 100);
  bounded_offset := least(greatest(coalesce(page_offset, 0), 0), 10000);
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

  select
    coalesce(community_settings.delinquent_days_past_due, 15),
    coalesce(community_settings.lien_readiness_days_past_due, 30)
  into
    delinquent_days,
    lien_readiness_days
  from public.community_settings
  where community_settings.community_id = target_community_id;

  delinquent_days := greatest(coalesce(delinquent_days, 15), 1);
  lien_readiness_days := coalesce(lien_readiness_days, 30);

  with eligible_assessments as (
    select
      assessments.community_id,
      assessments.property_id,
      assessments.due_date,
      assessments.status,
      assessments.balance_cents
    from public.assessments
    where assessments.community_id = target_community_id
      and assessments.status in ('open', 'partially_paid', 'overdue', 'disputed')
      and assessments.balance_cents > 0
  ),
  property_totals as (
    select
      eligible_assessments.community_id,
      eligible_assessments.property_id,
      count(*)::integer as open_assessment_count,
      coalesce(sum(eligible_assessments.balance_cents), 0)::integer as open_assessment_balance_cents,
      min(eligible_assessments.due_date) as oldest_unpaid_due_date,
      coalesce(bool_or(eligible_assessments.status = 'disputed'), false) as has_disputed_assessment,
      coalesce(bool_or(
        eligible_assessments.due_date >= current_date
        and eligible_assessments.due_date <= current_date + 30
      ), false) as has_due_soon
    from eligible_assessments
    group by eligible_assessments.community_id, eligible_assessments.property_id
  ),
  report_rows as (
    select
      properties.id as property_id,
      properties.community_id,
      concat_ws(', ',
        properties.address_line1,
        nullif(properties.address_line2, ''),
        properties.city,
        properties.state,
        properties.postal_code
      ) as property_label,
      property_totals.open_assessment_balance_cents as current_balance_cents,
      property_totals.open_assessment_count,
      property_totals.open_assessment_balance_cents,
      property_totals.oldest_unpaid_due_date,
      greatest(current_date - property_totals.oldest_unpaid_due_date, 0) as days_past_due,
      property_totals.oldest_unpaid_due_date as next_due_date,
      properties.last_payment_at,
      property_totals.has_disputed_assessment,
      property_totals.oldest_unpaid_due_date <= current_date - lien_readiness_days as lien_review_candidate,
      delinquent_days as delinquent_days_past_due,
      lien_readiness_days as lien_readiness_days_past_due,
      case
        when property_totals.open_assessment_balance_cents <= 0 then 'current'
        when property_totals.has_disputed_assessment then 'disputed'
        when property_totals.oldest_unpaid_due_date <= current_date - lien_readiness_days then 'lien_review'
        when property_totals.oldest_unpaid_due_date <= current_date - delinquent_days then 'delinquent'
        when property_totals.oldest_unpaid_due_date < current_date then 'overdue'
        when property_totals.has_due_soon then 'due_soon'
        else 'current'
      end as stage
    from property_totals
    join public.properties on properties.id = property_totals.property_id
      and properties.community_id = property_totals.community_id
    where properties.community_id = target_community_id
      and properties.status = 'active'
      and properties.deleted_at is null
      and (
        filter_minimum_balance_cents is null
        or property_totals.open_assessment_balance_cents >= filter_minimum_balance_cents
      )
      and (
        filter_from is null
        or property_totals.oldest_unpaid_due_date >= filter_from
      )
      and (
        filter_to is null
        or property_totals.oldest_unpaid_due_date <= filter_to
      )
      and (
        search_query is null
        or properties.address_line1 ilike '%' || search_query || '%' escape chr(92)
        or properties.city ilike '%' || search_query || '%' escape chr(92)
        or properties.postal_code ilike '%' || search_query || '%' escape chr(92)
      )
  ),
  filtered_rows as (
    select *
    from report_rows
    where filter_stage is null
      or stage = filter_stage
    order by
      case stage
        when 'lien_review' then 1
        when 'disputed' then 2
        when 'delinquent' then 3
        when 'overdue' then 4
        when 'due_soon' then 5
        else 6
      end,
      oldest_unpaid_due_date asc,
      current_balance_cents desc,
      property_id asc
    limit bounded_limit
    offset bounded_offset
  )
  select coalesce(jsonb_agg(
    jsonb_build_object(
      'property_id', filtered_rows.property_id,
      'community_id', filtered_rows.community_id,
      'property_label', filtered_rows.property_label,
      'stage', filtered_rows.stage,
      'current_balance_cents', filtered_rows.current_balance_cents,
      'open_assessment_count', filtered_rows.open_assessment_count,
      'open_assessment_balance_cents', filtered_rows.open_assessment_balance_cents,
      'oldest_unpaid_due_date', filtered_rows.oldest_unpaid_due_date,
      'days_past_due', filtered_rows.days_past_due,
      'next_due_date', filtered_rows.next_due_date,
      'last_payment_at', filtered_rows.last_payment_at,
      'has_disputed_assessment', filtered_rows.has_disputed_assessment,
      'lien_review_candidate', filtered_rows.lien_review_candidate,
      'delinquent_days_past_due', filtered_rows.delinquent_days_past_due,
      'lien_readiness_days_past_due', filtered_rows.lien_readiness_days_past_due
    )
    order by
      case filtered_rows.stage
        when 'lien_review' then 1
        when 'disputed' then 2
        when 'delinquent' then 3
        when 'overdue' then 4
        when 'due_soon' then 5
        else 6
      end,
      filtered_rows.oldest_unpaid_due_date asc,
      filtered_rows.current_balance_cents desc,
      filtered_rows.property_id asc
  ), 
  '[]'::jsonb
)
into records
from filtered_rows;

return jsonb_build_object(
  'status', 'ok',
  'records', records
);
end;
$$;

revoke all on function public.list_delinquency_report(
  uuid,
  text,
  date,
  date,
  text,
  bigint,
  integer,
  integer
) from public, anon;

grant execute on function public.list_delinquency_report(
  uuid,
  text,
  date,
  date,
  text,
  bigint,
  integer,
  integer
) to authenticated;
