INSERT INTO public.user_roles (user_id, role)
SELECT id, 'super_admin'::app_role FROM auth.users WHERE lower(email) = 'manzakiilu@gmail.com'
ON CONFLICT (user_id, role) DO NOTHING;