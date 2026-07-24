
-- Pending invites table
CREATE TABLE public.pending_invites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL,
  role public.app_role NOT NULL,
  invited_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (email, role)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.pending_invites TO authenticated;
GRANT ALL ON public.pending_invites TO service_role;

ALTER TABLE public.pending_invites ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Super admins manage invites"
  ON public.pending_invites FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin'))
  WITH CHECK (public.has_role(auth.uid(), 'super_admin'));

-- Trigger: on new user signup, redeem any pending invites for that email,
-- AND if no super_admin exists yet, bootstrap this user as super_admin.
CREATE OR REPLACE FUNCTION public.handle_new_user_roles()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  has_super boolean;
  email_lc text := lower(NEW.email);
BEGIN
  -- Redeem invites matching this email
  INSERT INTO public.user_roles (user_id, role)
  SELECT NEW.id, pi.role
  FROM public.pending_invites pi
  WHERE lower(pi.email) = email_lc
  ON CONFLICT (user_id, role) DO NOTHING;

  DELETE FROM public.pending_invites WHERE lower(email) = email_lc;

  -- Bootstrap: first-ever user with no super_admin becomes super_admin
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles WHERE role = 'super_admin'
  ) INTO has_super;

  IF NOT has_super THEN
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, 'super_admin')
    ON CONFLICT (user_id, role) DO NOTHING;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created_roles ON auth.users;
CREATE TRIGGER on_auth_user_created_roles
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user_roles();
