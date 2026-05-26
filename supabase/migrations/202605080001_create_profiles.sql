create table if not exists public.profiles (
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid not null references auth.users(id) on delete cascade,
  email text not null,
  email_verified_at timestamptz,
  phone text,
  first_name text,
  last_name text,
  display_name text,
  status text not null default 'active',
  notification_preferences jsonb not null default '{}'::jsonb,
  last_login_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint profiles_auth_user_id_key unique (auth_user_id),
  constraint profiles_email_key unique (email),
  constraint profiles_status_check check (status in ('invited', 'active', 'suspended', 'disabled'))
);

create index if not exists profiles_auth_user_id_idx on public.profiles (auth_user_id);
create index if not exists profiles_email_idx on public.profiles (email);

alter table public.profiles enable row level security;

drop policy if exists "profiles self read" on public.profiles;
create policy "profiles self read"
  on public.profiles
  for select
  to authenticated
  using (auth.uid() = auth_user_id and deleted_at is null);

create or replace function public.set_profiles_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_profiles_updated_at on public.profiles;
create trigger set_profiles_updated_at
  before update on public.profiles
  for each row
  execute function public.set_profiles_updated_at();

create or replace function public.handle_new_auth_user_profile()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  first_name_value text;
  last_name_value text;
  display_name_value text;
begin
  first_name_value := nullif(trim(coalesce(new.raw_user_meta_data ->> 'first_name', '')), '');
  last_name_value := nullif(trim(coalesce(new.raw_user_meta_data ->> 'last_name', '')), '');
  display_name_value := nullif(
    trim(
      coalesce(
        new.raw_user_meta_data ->> 'display_name',
        concat_ws(' ', first_name_value, last_name_value),
        new.email
      )
    ),
    ''
  );

  insert into public.profiles (
    auth_user_id,
    email,
    email_verified_at,
    phone,
    first_name,
    last_name,
    display_name,
    status,
    notification_preferences
  )
  values (
    new.id,
    new.email,
    new.email_confirmed_at,
    new.phone,
    first_name_value,
    last_name_value,
    coalesce(display_name_value, new.email),
    'active',
    '{}'::jsonb
  )
  on conflict (auth_user_id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created_profile on auth.users;
create trigger on_auth_user_created_profile
  after insert on auth.users
  for each row
  execute function public.handle_new_auth_user_profile();
