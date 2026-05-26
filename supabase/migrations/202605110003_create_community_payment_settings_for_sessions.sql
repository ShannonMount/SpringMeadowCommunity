create table if not exists public.community_settings (
  community_id uuid primary key references public.communities(id) on delete cascade,
  stripe_account_mode text not null default 'platform'
    check (stripe_account_mode in ('platform', 'direct')),
  stripe_connected_account_id text,
  fee_policy text not null default 'payer_pays'
    check (fee_policy in ('payer_pays', 'hoa_pays', 'configurable')),
  allow_card boolean not null default true,
  allow_ach boolean not null default true,
  guest_payments_enabled boolean not null default true,
  meeting_notice_earliest_days integer not null default 60,
  meeting_notice_latest_days integer not null default 10,
  annual_financial_statement_due_days integer not null default 75,
  unpaid_assessment_statement_due_business_days integer not null default 10,
  lien_readiness_days_past_due integer not null default 30,
  pre_lien_notice_wait_days integer not null default 15,
  lien_enforcement_deadline_years integer not null default 3,
  feature_flags jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists community_settings_feature_flags_gin_idx
  on public.community_settings using gin(feature_flags);

create or replace function public.set_community_settings_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_community_settings_updated_at on public.community_settings;
create trigger set_community_settings_updated_at
  before update on public.community_settings
  for each row
  execute function public.set_community_settings_updated_at();

insert into public.community_settings (
  community_id,
  allow_card,
  allow_ach,
  fee_policy
)
select
  communities.id,
  true,
  true,
  'payer_pays'
from public.communities
on conflict (community_id) do nothing;

alter table public.community_settings enable row level security;

revoke all on public.community_settings from anon, authenticated;
