
CREATE POLICY "Super admins manage roles" ON public.user_roles
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin'))
  WITH CHECK (public.has_role(auth.uid(), 'super_admin'));

CREATE OR REPLACE FUNCTION public.list_users_with_roles()
RETURNS TABLE(user_id uuid, email text, roles text[])
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT u.id, u.email::text,
    COALESCE(array_agg(ur.role::text) FILTER (WHERE ur.role IS NOT NULL), ARRAY[]::text[])
  FROM auth.users u
  LEFT JOIN public.user_roles ur ON ur.user_id = u.id
  WHERE public.has_role(auth.uid(), 'super_admin')
  GROUP BY u.id, u.email
  ORDER BY u.email;
$$;

REVOKE ALL ON FUNCTION public.list_users_with_roles() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.list_users_with_roles() TO authenticated;
