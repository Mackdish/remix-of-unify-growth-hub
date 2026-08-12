CREATE OR REPLACE FUNCTION public.has_any_role(_user_id uuid, _roles app_role[])
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = ANY(_roles));
$$;

-- TRANSACTIONS: treasurer/super_admin write, all admins read
DROP POLICY IF EXISTS "Admins manage transactions" ON public.transactions;
CREATE POLICY "Finance admins manage transactions" ON public.transactions FOR ALL TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['super_admin','treasurer']::app_role[]))
  WITH CHECK (public.has_any_role(auth.uid(), ARRAY['super_admin','treasurer']::app_role[]));
CREATE POLICY "Admins read all transactions" ON public.transactions FOR SELECT TO authenticated
  USING (public.is_admin(auth.uid()));

-- MEMBERS: secretary/super_admin write, all admins read
DROP POLICY IF EXISTS "Admins manage members" ON public.members;
CREATE POLICY "Membership admins manage members" ON public.members FOR ALL TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['super_admin','secretary']::app_role[]))
  WITH CHECK (public.has_any_role(auth.uid(), ARRAY['super_admin','secretary']::app_role[]));

-- MEMBER INVITES
DROP POLICY IF EXISTS "Admins manage member invites" ON public.member_invites;
CREATE POLICY "Membership admins manage member invites" ON public.member_invites FOR ALL TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['super_admin','secretary']::app_role[]))
  WITH CHECK (public.has_any_role(auth.uid(), ARRAY['super_admin','secretary']::app_role[]));

-- LOAN REQUESTS
DROP POLICY IF EXISTS "Admins delete loan requests" ON public.loan_requests;
CREATE POLICY "Finance admins delete loan requests" ON public.loan_requests FOR DELETE TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['super_admin','treasurer']::app_role[]));
DROP POLICY IF EXISTS "Members cancel own pending" ON public.loan_requests;
CREATE POLICY "Loan review and member cancel" ON public.loan_requests FOR UPDATE TO authenticated
  USING (
    public.has_any_role(auth.uid(), ARRAY['super_admin','treasurer']::app_role[])
    OR (status = 'pending'::loan_request_status AND EXISTS (
      SELECT 1 FROM public.members m WHERE m.id = loan_requests.member_id AND m.user_id = auth.uid()))
  )
  WITH CHECK (
    public.has_any_role(auth.uid(), ARRAY['super_admin','treasurer']::app_role[])
    OR EXISTS (SELECT 1 FROM public.members m WHERE m.id = loan_requests.member_id AND m.user_id = auth.uid())
  );

-- DOCUMENTS
DROP POLICY IF EXISTS "Admins manage documents" ON public.documents;
CREATE POLICY "Records admins manage documents" ON public.documents FOR ALL TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['super_admin','secretary']::app_role[]))
  WITH CHECK (public.has_any_role(auth.uid(), ARRAY['super_admin','secretary']::app_role[]));

-- NOTICES
DROP POLICY IF EXISTS "Admins manage notices" ON public.notices;
CREATE POLICY "Content admins manage notices" ON public.notices FOR ALL TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['super_admin','secretary','project_manager']::app_role[]))
  WITH CHECK (public.has_any_role(auth.uid(), ARRAY['super_admin','secretary','project_manager']::app_role[]));

-- SITE IMAGES
DROP POLICY IF EXISTS "Admins manage site images" ON public.site_images;
CREATE POLICY "Content admins manage site images" ON public.site_images FOR ALL TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['super_admin','secretary','project_manager']::app_role[]))
  WITH CHECK (public.has_any_role(auth.uid(), ARRAY['super_admin','secretary','project_manager']::app_role[]));