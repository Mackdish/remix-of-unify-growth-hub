DROP POLICY "Public read active notices" ON public.notices;
CREATE POLICY "Anyone reads active notices" ON public.notices FOR SELECT TO anon, authenticated USING (active = true);
CREATE POLICY "Admins read all notices" ON public.notices FOR SELECT TO authenticated USING (public.is_admin(auth.uid()));