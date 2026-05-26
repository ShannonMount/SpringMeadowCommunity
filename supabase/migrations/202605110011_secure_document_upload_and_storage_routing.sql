do $$
declare
  allowed_document_mime_types text[] := array[
    'application/pdf',
    'text/plain',
    'text/csv',
    'image/jpeg',
    'image/png',
    'image/webp',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  ];
begin
  insert into storage.buckets (
    id,
    name,
    public,
    file_size_limit,
    allowed_mime_types
  )
  values
    (
      'public-documents',
      'public-documents',
      true,
      6291456,
      allowed_document_mime_types
    ),
    (
      'private-documents',
      'private-documents',
      false,
      6291456,
      allowed_document_mime_types
    ),
    (
      'uploads-temp',
      'uploads-temp',
      false,
      6291456,
      allowed_document_mime_types
    )
  on conflict (id) do update
  set
    name = excluded.name,
    public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types,
    updated_at = now();
end;
$$;
