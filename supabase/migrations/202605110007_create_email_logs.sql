create extension if not exists "citext";

create table if not exists public.email_logs (
  id uuid primary key default gen_random_uuid(),
  community_id uuid references public.communities(id),
  type text not null check (
    type in (
      'payment_receipt',
      'guest_payment_receipt',
      'compliance_warning',
      'records_request',
      'meeting_notice',
      'invitation',
      'message_notification',
      'other'
    )
  ),
  recipient_email citext not null,
  recipient_profile_id uuid references public.profiles(id),
  subject text not null,
  provider text not null default 'resend',
  provider_message_id text,
  status text not null default 'queued'
    check (status in ('queued', 'sent', 'delivered', 'bounced', 'failed', 'suppressed')),
  idempotency_key text not null,
  attempt_count integer not null default 0 check (attempt_count >= 0),
  related_property_id uuid references public.properties(id),
  related_payment_id uuid references public.payments(id),
  related_compliance_event_id uuid,
  related_records_request_id uuid,
  related_meeting_id uuid,
  error text,
  sent_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (idempotency_key)
);

create index if not exists email_logs_type_created_idx
  on public.email_logs(community_id, type, created_at desc);

create index if not exists email_logs_recipient_idx
  on public.email_logs(recipient_email, created_at desc);

create index if not exists email_logs_status_idx
  on public.email_logs(status, created_at desc);

create index if not exists email_logs_payment_idx
  on public.email_logs(related_payment_id)
  where related_payment_id is not null;

create index if not exists email_logs_compliance_idx
  on public.email_logs(related_compliance_event_id)
  where related_compliance_event_id is not null;

create or replace function public.set_email_logs_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_email_logs_updated_at on public.email_logs;
create trigger set_email_logs_updated_at
  before update on public.email_logs
  for each row
  execute function public.set_email_logs_updated_at();

alter table public.email_logs enable row level security;

revoke all on public.email_logs from anon, authenticated;
