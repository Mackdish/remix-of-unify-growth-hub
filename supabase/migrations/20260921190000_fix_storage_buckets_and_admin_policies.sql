-- Restore application storage buckets after migrating the database.
-- Documents are private and accessed through signed URLs.
-- Site media is also private because the app stores signed URLs.

insert into storage.buckets (id, name, public, file_size_limit)
values
  ('documents', 'documents', false, 52428800),
  ('site-media', 'site-media', false, 8388608)
on conflict (id) do update
set
  name = excluded.name,
  public = excluded.public,
  file_size_limit = excluded.file_size_limit;

-- Documents: authenticated members may read; document managers may write/delete.
drop policy if exists "documents_select_authenticated" on storage.objects;
create policy "documents_select_authenticated"
on storage.objects
for select
to authenticated
using (bucket_id = 'documents');

drop policy if exists "documents_insert_managers" on storage.objects;
create policy "documents_insert_managers"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'documents'
  and public.has_any_role(
    auth.uid(),
    array['super_admin','secretary']::public.app_role[]
  )
);

drop policy if exists "documents_delete_managers" on storage.objects;
create policy "documents_delete_managers"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'documents'
  and public.has_any_role(
    auth.uid(),
    array['super_admin','secretary']::public.app_role[]
  )
);

-- Site media: authenticated users may read signed objects; content managers may write/delete.
drop policy if exists "site_media_select_authenticated" on storage.objects;
create policy "site_media_select_authenticated"
on storage.objects
for select
to authenticated
using (bucket_id = 'site-media');

drop policy if exists "site_media_insert_managers" on storage.objects;
create policy "site_media_insert_managers"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'site-media'
  and public.has_any_role(
    auth.uid(),
    array['super_admin','secretary','project_manager']::public.app_role[]
  )
);

drop policy if exists "site_media_delete_managers" on storage.objects;
create policy "site_media_delete_managers"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'site-media'
  and public.has_any_role(
    auth.uid(),
    array['super_admin','secretary','project_manager']::public.app_role[]
  )
);
