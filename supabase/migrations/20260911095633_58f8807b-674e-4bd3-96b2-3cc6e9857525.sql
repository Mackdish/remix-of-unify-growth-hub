ALTER TABLE public.site_settings
  ADD COLUMN IF NOT EXISTS about_intro text NOT NULL DEFAULT 'Founded to promote unity, financial cooperation and youth empowerment, Unify Youth Group brings members together around shared savings, loans, and community projects.',
  ADD COLUMN IF NOT EXISTS vision text NOT NULL DEFAULT 'A united and financially empowered youth community that leads sustainable development in Makueni and beyond.',
  ADD COLUMN IF NOT EXISTS mission text NOT NULL DEFAULT 'To empower our members through disciplined savings, fair internal lending, transparent record-keeping, and community projects that create real, lasting impact.';

CREATE TABLE IF NOT EXISTS public.projects (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title text NOT NULL,
  description text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'Ongoing',
  progress integer NOT NULL DEFAULT 0,
  image_url text,
  sort_order integer NOT NULL DEFAULT 0,
  created_by uuid,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

GRANT SELECT ON public.projects TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.projects TO authenticated;
GRANT ALL ON public.projects TO service_role;

ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read projects" ON public.projects FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Content admins manage projects" ON public.projects FOR ALL TO authenticated
  USING (has_any_role(auth.uid(), ARRAY['super_admin'::app_role, 'secretary'::app_role, 'project_manager'::app_role]))
  WITH CHECK (has_any_role(auth.uid(), ARRAY['super_admin'::app_role, 'secretary'::app_role, 'project_manager'::app_role]));

CREATE TRIGGER update_projects_updated_at BEFORE UPDATE ON public.projects
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO public.projects (title, description, status, progress, sort_order) VALUES
  ('Green Makueni', 'Tree-planting drives to restore land and provide shade around Wote.', 'Ongoing', 45, 1),
  ('Youth Skills Hub', 'Weekly workshops on entrepreneurship, digital skills and financial literacy.', 'Ongoing', 30, 2),
  ('Members'' Savings Programme', 'Monthly contributions, account boosting, and internal lending, tracked transparently.', 'Live', 100, 3);