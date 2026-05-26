create index if not exists properties_guest_public_payment_code_lookup_idx
  on public.properties(community_id, lower(public_payment_code))
  where public_payment_code is not null
    and status = 'active'
    and deleted_at is null;

create index if not exists properties_guest_account_postal_lookup_idx
  on public.properties(community_id, lower(account_number), postal_code)
  where status = 'active'
    and deleted_at is null;
