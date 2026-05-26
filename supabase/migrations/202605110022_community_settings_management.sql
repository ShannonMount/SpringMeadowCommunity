-- Migration: Add permission-gated admin community settings RPCs
-- Creates get_admin_community_settings and update_admin_community_settings

create or replace function public.get_admin_community_settings(
  target_community_slug text
)
returns jsonb
language plpgsql
security definer
set search_path = public, app
as $$
declare
  actor_profile_id uuid;
  target_community_id uuid;
  settings_row jsonb;
begin
  actor_profile_id := app.current_profile_id();

  select communities.id
  into target_community_id
  from public.communities
  where communities.slug = coalesce(nullif(btrim(target_community_slug), ''), 'spring-meadow-community')
    and communities.status = 'active';

  if target_community_id is null
    or actor_profile_id is null
    or not app.has_permission(target_community_id, 'admin.settings.manage')
  then
    return jsonb_build_object('status', 'permission_denied');
  end if;

  select to_jsonb(cs) into settings_row
  from (
    select
      community_id,
      fee_policy,
      allow_card,
      allow_ach,
      guest_payments_enabled,
      manual_payments_enabled,
      delinquent_days_past_due,
      message_notifications_enabled,
      message_retention_days,
      feature_flags,
      updated_at
    from public.community_settings
    where community_id = target_community_id
    limit 1
  ) cs;

  if settings_row is null then
    -- ensure a row is present; create with defaults if missing
    insert into public.community_settings (community_id)
    values (target_community_id)
    on conflict do nothing;

    select to_jsonb(cs) into settings_row
    from (
      select
        community_id,
        fee_policy,
        allow_card,
        allow_ach,
        guest_payments_enabled,
        manual_payments_enabled,
        delinquent_days_past_due,
        message_notifications_enabled,
        message_retention_days,
        feature_flags,
        updated_at
      from public.community_settings
      where community_id = target_community_id
      limit 1
    ) cs;
  end if;

  return jsonb_build_object(
    'status', 'ok',
    'community_id', target_community_id,
    'settings', coalesce(settings_row, '{}'::jsonb)
  );
end;
$$;

create or replace function public.update_admin_community_settings(
  target_community_slug text,
  payment_settings jsonb,
  compliance_settings jsonb,
  branding_settings jsonb,
  feature_flags jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public, app
as $$
declare
  actor_profile_id uuid;
  target_community_id uuid;
  new_fee_policy text;
  opt boolean;
begin
  actor_profile_id := app.current_profile_id();

  select communities.id
  into target_community_id
  from public.communities
  where communities.slug = coalesce(nullif(btrim(target_community_slug), ''), 'spring-meadow-community')
    and communities.status = 'active';

  if target_community_id is null
    or actor_profile_id is null
    or not app.has_permission(target_community_id, 'admin.settings.manage')
  then
    return jsonb_build_object('status', 'permission_denied');
  end if;

  -- basic payment validation: fee_policy allowed values
  if payment_settings is not null and payment_settings ? 'fee_policy' then
    new_fee_policy := (payment_settings ->> 'fee_policy')::text;
    if new_fee_policy not in ('payer_pays', 'hoa_pays', 'configurable') then
      return jsonb_build_object('status', 'invalid');
    end if;
  end if;

  -- apply updates to community_settings when provided
  update public.community_settings
  set
    fee_policy = case when payment_settings is not null and payment_settings ? 'fee_policy' then (payment_settings->>'fee_policy') else fee_policy end,
    allow_card = case when payment_settings is not null and payment_settings ? 'allow_card' then (payment_settings->>'allow_card')::boolean else allow_card end,
    allow_ach = case when payment_settings is not null and payment_settings ? 'allow_ach' then (payment_settings->>'allow_ach')::boolean else allow_ach end,
    guest_payments_enabled = case when payment_settings is not null and payment_settings ? 'guest_payments_enabled' then (payment_settings->>'guest_payments_enabled')::boolean else guest_payments_enabled end,
    feature_flags = case when feature_flags is not null then feature_flags else feature_flags end,
    updated_at = now()
  where community_id = target_community_id;

  -- apply compliance updates to community_settings when provided
  if compliance_settings is not null then
    -- basic validation examples
    if compliance_settings ? 'delinquentDaysPastDue' then
      if ((compliance_settings ->> 'delinquentDaysPastDue')::integer) < 1 then
        return jsonb_build_object('status', 'invalid');
      end if;
    end if;

    if compliance_settings ? 'messageRetentionDays' then
      if ((compliance_settings ->> 'messageRetentionDays')::integer) < 0 then
        return jsonb_build_object('status', 'invalid');
      end if;
    end if;

    update public.community_settings
    set
      delinquent_days_past_due = case when compliance_settings ? 'delinquentDaysPastDue' then (compliance_settings->>'delinquentDaysPastDue')::integer else delinquent_days_past_due end,
      message_notifications_enabled = case when compliance_settings ? 'messageNotificationsEnabled' then (compliance_settings->>'messageNotificationsEnabled')::boolean else message_notifications_enabled end,
      message_retention_days = case when compliance_settings ? 'messageRetentionDays' then (compliance_settings->>'messageRetentionDays')::integer else message_retention_days end,
      meeting_notice_earliest_days = case when compliance_settings ? 'meetingNoticeEarliestDays' then (compliance_settings->>'meetingNoticeEarliestDays')::integer else meeting_notice_earliest_days end,
      meeting_notice_latest_days = case when compliance_settings ? 'meetingNoticeLatestDays' then (compliance_settings->>'meetingNoticeLatestDays')::integer else meeting_notice_latest_days end,
      updated_at = now()
    where community_id = target_community_id;

    -- allow updating community fiscal year via compliance payload
    if (compliance_settings ? 'fiscalYearStartMonth') or (compliance_settings ? 'fiscalYearStartDay') or (compliance_settings ? 'fiscalYearEndMonth') or (compliance_settings ? 'fiscalYearEndDay') then
      -- validate month/day ranges
      if compliance_settings ? 'fiscalYearStartMonth' then
        if ((compliance_settings->>'fiscalYearStartMonth')::integer) < 1 or ((compliance_settings->>'fiscalYearStartMonth')::integer) > 12 then
          return jsonb_build_object('status', 'invalid');
        end if;
      end if;
      if compliance_settings ? 'fiscalYearEndMonth' then
        if ((compliance_settings->>'fiscalYearEndMonth')::integer) < 1 or ((compliance_settings->>'fiscalYearEndMonth')::integer) > 12 then
          return jsonb_build_object('status', 'invalid');
        end if;
      end if;
      if compliance_settings ? 'fiscalYearStartDay' then
        if ((compliance_settings->>'fiscalYearStartDay')::integer) < 1 or ((compliance_settings->>'fiscalYearStartDay')::integer) > 31 then
          return jsonb_build_object('status', 'invalid');
        end if;
      end if;
      if compliance_settings ? 'fiscalYearEndDay' then
        if ((compliance_settings->>'fiscalYearEndDay')::integer) < 1 or ((compliance_settings->>'fiscalYearEndDay')::integer) > 31 then
          return jsonb_build_object('status', 'invalid');
        end if;
      end if;

      update public.communities
      set
        fiscal_year_start_month = case when compliance_settings ? 'fiscalYearStartMonth' then (compliance_settings->>'fiscalYearStartMonth')::integer else fiscal_year_start_month end,
        fiscal_year_start_day = case when compliance_settings ? 'fiscalYearStartDay' then (compliance_settings->>'fiscalYearStartDay')::integer else fiscal_year_start_day end,
        fiscal_year_end_month = case when compliance_settings ? 'fiscalYearEndMonth' then (compliance_settings->>'fiscalYearEndMonth')::integer else fiscal_year_end_month end,
        fiscal_year_end_day = case when compliance_settings ? 'fiscalYearEndDay' then (compliance_settings->>'fiscalYearEndDay')::integer else fiscal_year_end_day end,
        updated_at = now()
      where id = target_community_id;
    end if;
  end if;

  -- apply branding updates to communities table when provided
  if branding_settings is not null then
    update public.communities
    set
      public_display_name = case when branding_settings ? 'publicDisplayName' then nullif(btrim(branding_settings->>'publicDisplayName'), '') else public_display_name end,
      logo_url = case when branding_settings ? 'logoUrl' then nullif(btrim(branding_settings->>'logoUrl'), '') else logo_url end,
      primary_color = case when branding_settings ? 'primaryColor' then nullif(btrim(branding_settings->>'primaryColor'), '') else primary_color end,
      secondary_color = case when branding_settings ? 'secondaryColor' then nullif(btrim(branding_settings->>'secondaryColor'), '') else secondary_color end,
      updated_at = now()
    where id = target_community_id;
  end if;

  -- return current settings snapshot
  return public.get_admin_community_settings(target_community_slug);
end;
$$;

-- Revoke broad execute and grant only to authenticated
revoke all on function public.get_admin_community_settings(text) from public, anon, authenticated;
grant execute on function public.get_admin_community_settings(text) to authenticated;

revoke all on function public.update_admin_community_settings(text, jsonb, jsonb, jsonb, jsonb) from public, anon, authenticated;
grant execute on function public.update_admin_community_settings(text, jsonb, jsonb, jsonb, jsonb) to authenticated;
