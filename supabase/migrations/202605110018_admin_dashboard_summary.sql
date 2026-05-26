create or replace function public.get_admin_dashboard_summary(
  target_community_slug text default 'spring-meadow-community'
)
returns jsonb
language plpgsql
security definer
set search_path = public, app
as $$
declare
  target_community_id uuid;
  resolved_community_slug text;
  actor_profile_id uuid;
  can_view_payments boolean := false;
  can_manage_documents boolean := false;
  can_view_board_documents boolean := false;
  can_view_documents boolean := false;
  can_view_messages boolean := false;
  property_section jsonb;
  payment_section jsonb;
  document_section jsonb;
  message_section jsonb;
begin
  select communities.id, communities.slug::text
  into target_community_id, resolved_community_slug
  from public.communities
  where communities.slug = coalesce(nullif(btrim(target_community_slug), ''), 'spring-meadow-community')
    and communities.status = 'active'
  limit 1;

  if target_community_id is null then
    return jsonb_build_object('status', 'unavailable');
  end if;

  actor_profile_id := app.current_profile_id();

  if actor_profile_id is null
    or not app.has_permission(target_community_id, 'board.workspace.access')
  then
    return jsonb_build_object('status', 'permission_denied');
  end if;

  can_view_payments := app.has_permission(target_community_id, 'admin.payments.manage');
  can_manage_documents := app.has_permission(target_community_id, 'admin.documents.manage');
  can_view_board_documents := app.has_permission(target_community_id, 'board.documents.view');
  can_view_documents := can_manage_documents or can_view_board_documents;
  can_view_messages := app.has_permission(target_community_id, 'admin.messages.manage');

  with property_counts as (
    select
      count(*)::integer as total_count,
      count(*) filter (where properties.status = 'active')::integer as active_count,
      count(*) filter (where properties.status in ('inactive', 'archived'))::integer as inactive_count,
      count(*) filter (where properties.delinquency_status = 'due_soon')::integer as due_soon_count,
      count(*) filter (where properties.delinquency_status = 'overdue')::integer as overdue_count,
      count(*) filter (where properties.delinquency_status = 'delinquent')::integer as delinquent_count,
      count(*) filter (where properties.delinquency_status = 'lien_review')::integer as lien_review_count,
      count(*) filter (
        where properties.next_due_date is not null
          and properties.next_due_date <= current_date + 30
      )::integer as next_due_count
    from public.properties
    where properties.community_id = target_community_id
      and properties.deleted_at is null
  ),
  overdue_assessments as (
    select count(*)::integer as overdue_assessment_count
    from public.assessments
    where assessments.community_id = target_community_id
      and assessments.balance_cents > 0
      and assessments.status in ('open', 'partially_paid', 'overdue', 'disputed')
      and assessments.due_date < current_date
  )
  select jsonb_build_object(
    'state', case when property_counts.total_count = 0 then 'empty' else 'available' end,
    'active_count', property_counts.active_count,
    'inactive_count', property_counts.inactive_count,
    'due_soon_count', property_counts.due_soon_count,
    'overdue_count', property_counts.overdue_count,
    'delinquent_count', property_counts.delinquent_count,
    'lien_review_count', property_counts.lien_review_count,
    'next_due_count', property_counts.next_due_count,
    'overdue_assessment_count', overdue_assessments.overdue_assessment_count
  )
  into property_section
  from property_counts
  cross join overdue_assessments;

  if can_view_payments then
    with payment_counts as (
      select
        count(*) filter (where payments.status = 'pending')::integer as pending_count,
        count(*) filter (where payments.status = 'failed')::integer as failed_count,
        count(*) filter (
          where payments.status = 'succeeded'
            and coalesce(payments.paid_at, payments.created_at) >= now() - interval '30 days'
        )::integer as succeeded_last_30_days_count,
        coalesce(sum(payments.amount_cents) filter (
          where payments.status = 'succeeded'
            and coalesce(payments.paid_at, payments.created_at) >= now() - interval '30 days'
        ), 0)::integer as succeeded_last_30_days_amount_cents,
        count(*) filter (
          where payments.status = 'pending'
            and payments.method in ('check', 'cash', 'manual', 'other')
        )::integer as offline_pending_count
      from public.payments
      where payments.community_id = target_community_id
    )
    select jsonb_build_object(
      'state',
      case
        when payment_counts.pending_count = 0
          and payment_counts.failed_count = 0
          and payment_counts.succeeded_last_30_days_count = 0
          and payment_counts.offline_pending_count = 0
        then 'empty'
        else 'available'
      end,
      'pending_count', payment_counts.pending_count,
      'failed_count', payment_counts.failed_count,
      'succeeded_last_30_days_count', payment_counts.succeeded_last_30_days_count,
      'succeeded_last_30_days_amount_cents', payment_counts.succeeded_last_30_days_amount_cents,
      'offline_pending_count', payment_counts.offline_pending_count
    )
    into payment_section
    from payment_counts;
  else
    payment_section := jsonb_build_object('state', 'permission_denied');
  end if;

  if can_view_documents then
    with document_counts as (
      select
        count(*) filter (where documents.status = 'active')::integer as active_count,
        count(*) filter (
          where documents.status = 'active'
            and documents.expiration_date is not null
            and documents.expiration_date <= current_date + 30
        )::integer as expiring_soon_count,
        count(*) filter (
          where documents.status = 'active'
            and documents.visibility in ('board', 'admin', 'property_specific')
        )::integer as restricted_count,
        count(*) filter (
          where documents.status = 'active'
            and documents.created_at >= now() - interval '30 days'
        )::integer as recent_upload_count
      from public.documents
      where documents.community_id = target_community_id
        and documents.deleted_at is null
        and (
          can_manage_documents = true
          or documents.visibility in ('public', 'board', 'property_specific')
        )
    )
    select jsonb_build_object(
      'state', case when document_counts.active_count = 0 then 'empty' else 'available' end,
      'active_count', document_counts.active_count,
      'expiring_soon_count', document_counts.expiring_soon_count,
      'restricted_count', document_counts.restricted_count,
      'recent_upload_count', document_counts.recent_upload_count
    )
    into document_section
    from document_counts;
  else
    document_section := jsonb_build_object('state', 'permission_denied');
  end if;

  if can_view_messages then
    with message_counts as (
      select
        count(*) filter (where message_threads.status = 'open')::integer as open_count,
        count(*) filter (where message_threads.status = 'pending_board')::integer as pending_board_count,
        count(*) filter (where message_threads.status = 'pending_resident')::integer as pending_resident_count,
        count(*) filter (
          where message_threads.assigned_to is null
            and message_threads.status in ('open', 'pending_board', 'pending_resident')
        )::integer as unassigned_count,
        min(message_threads.last_message_at) filter (
          where message_threads.status in ('open', 'pending_board', 'pending_resident')
        ) as oldest_open_at
      from public.message_threads
      where message_threads.community_id = target_community_id
        and message_threads.status <> 'archived'
    )
    select jsonb_build_object(
      'state',
      case
        when message_counts.open_count = 0
          and message_counts.pending_board_count = 0
          and message_counts.pending_resident_count = 0
        then 'empty'
        else 'available'
      end,
      'open_count', message_counts.open_count,
      'pending_board_count', message_counts.pending_board_count,
      'pending_resident_count', message_counts.pending_resident_count,
      'unassigned_count', message_counts.unassigned_count,
      'oldest_open_at', message_counts.oldest_open_at
    )
    into message_section
    from message_counts;
  else
    message_section := jsonb_build_object('state', 'permission_denied');
  end if;

  return jsonb_build_object(
    'status', 'ok',
    'community_id', target_community_id,
    'community_slug', resolved_community_slug,
    'generated_at', now(),
    'sections', jsonb_build_object(
      'properties', property_section,
      'payments', payment_section,
      'documents', document_section,
      'messages', message_section,
      'compliance', jsonb_build_object(
        'state', 'not_configured',
        'upcoming_count', 0,
        'overdue_count', 0
      )
    )
  );
end;
$$;

revoke all on function public.get_admin_dashboard_summary(text) from public, anon, authenticated;

grant execute on function public.get_admin_dashboard_summary(text) to authenticated;
