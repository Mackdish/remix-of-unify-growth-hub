-- documents table: only users holding an app role (members or admins) may read the shared library
DROP POLICY IF EXISTS "Members read documents" ON public.documents;
CREATE POLICY "Members read documents"
  ON public.documents FOR SELECT TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['super_admin'::app_role, 'treasurer'::app_role, 'secretary'::app_role, 'project_manager'::app_role, 'member'::app_role]));

-- documents bucket: same role check for viewing/signing document files
DROP POLICY IF EXISTS "Members read documents files" ON storage.objects;
CREATE POLICY "Members read documents files"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'documents' AND public.has_any_role(auth.uid(), ARRAY['super_admin'::app_role, 'treasurer'::app_role, 'secretary'::app_role, 'project_manager'::app_role, 'member'::app_role]));

-- site-media bucket: visitors only ever load the stored signed links, so file-level
-- access is needed only by the content admins who upload and sign the images
DROP POLICY IF EXISTS "Public read site media" ON storage.objects;
CREATE POLICY "Content admins read site media"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'site-media' AND public.has_any_role(auth.uid(), ARRAY['super_admin'::app_role, 'secretary'::app_role, 'project_manager'::app_role]));
