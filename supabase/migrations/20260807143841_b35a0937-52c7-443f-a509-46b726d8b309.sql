CREATE TABLE public.member_invites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id uuid REFERENCES public.members(id) ON DELETE SET NULL,
  full_name text NOT NULL,
  member_code text,
  email text,
  phone text,
  role app_role NOT NULL DEFAULT 'member',
  token text NOT NULL UNIQUE,
  invited_by uuid,
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '14 days'),
  accepted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.member_invites TO authenticated;
GRANT ALL ON public.member_invites TO service_role;

ALTER TABLE public.member_invites ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage member invites" ON public.member_invites
  FOR ALL TO authenticated
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

CREATE TRIGGER update_member_invites_updated_at
  BEFORE UPDATE ON public.member_invites
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX member_invites_token_idx ON public.member_invites(token);
