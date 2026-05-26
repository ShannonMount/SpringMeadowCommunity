create table if not exists public.guest_payment_lookup_sessions (
  id uuid primary key default gen_random_uuid(),
  community_id uuid not null references public.communities(id) on delete cascade,
  property_id uuid not null references public.properties(id) on delete cascade,
  token_hash text not null unique,
  expires_at timestamptz not null,
  used_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists guest_payment_lookup_sessions_token_hash_idx
  on public.guest_payment_lookup_sessions(token_hash);

create index if not exists guest_payment_lookup_sessions_active_expiry_idx
  on public.guest_payment_lookup_sessions(expires_at)
  where used_at is null;

create index if not exists guest_payment_lookup_sessions_property_context_idx
  on public.guest_payment_lookup_sessions(community_id, property_id, created_at desc);

create or replace function public.set_guest_payment_lookup_sessions_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_guest_payment_lookup_sessions_updated_at on public.guest_payment_lookup_sessions;
create trigger set_guest_payment_lookup_sessions_updated_at
  before update on public.guest_payment_lookup_sessions
  for each row
  execute function public.set_guest_payment_lookup_sessions_updated_at();

alter table public.guest_payment_lookup_sessions enable row level security;

revoke all on public.guest_payment_lookup_sessions from anon, authenticated;
