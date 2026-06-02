-- Store public registration signatures as private files instead of large
-- base64 blobs in the registrations row.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'registration-signatures',
  'registration-signatures',
  false,
  524288,
  array['image/png', 'image/jpeg', 'image/webp']
)
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

alter table public.registrations
  add column if not exists signature_storage_path text;

drop policy if exists "registration signatures admin read" on storage.objects;
drop policy if exists "registration signatures admin delete" on storage.objects;

create policy "registration signatures admin read" on storage.objects
  for select to authenticated
  using (bucket_id = 'registration-signatures' and public.is_admin());

create policy "registration signatures admin delete" on storage.objects
  for delete to authenticated
  using (bucket_id = 'registration-signatures' and public.is_admin());

comment on column public.registrations.signature_storage_path is
  'Private storage path for the family signature captured during registration.';
