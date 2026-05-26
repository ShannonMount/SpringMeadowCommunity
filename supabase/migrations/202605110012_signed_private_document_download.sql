create or replace function public.get_authorized_document_download_metadata(
  target_document_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public, app
as $$
declare
  document_record public.documents%rowtype;
begin
  select *
  into document_record
  from public.documents
  where id = target_document_id
    and deleted_at is null;

  if not found then
    return jsonb_build_object('status', 'not_found');
  end if;

  if not app.can_read_document(document_record.id) then
    return jsonb_build_object('status', 'permission_denied');
  end if;

  return jsonb_build_object('status', 'allowed', 'record', app.document_metadata_json(document_record));
end;
$$;

revoke all on function public.get_authorized_document_download_metadata(uuid) from public, anon, authenticated;
grant execute on function public.get_authorized_document_download_metadata(uuid) to anon, authenticated;
