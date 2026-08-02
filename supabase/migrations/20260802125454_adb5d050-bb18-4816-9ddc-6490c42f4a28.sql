CREATE POLICY "Public read site media" ON storage.objects FOR SELECT TO anon, authenticated USING (bucket_id = 'site-media');
CREATE POLICY "Admins upload site media" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'site-media' AND public.is_admin(auth.uid()));
CREATE POLICY "Admins update site media" ON storage.objects FOR UPDATE TO authenticated USING (bucket_id = 'site-media' AND public.is_admin(auth.uid()));
CREATE POLICY "Admins delete site media" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'site-media' AND public.is_admin(auth.uid()));