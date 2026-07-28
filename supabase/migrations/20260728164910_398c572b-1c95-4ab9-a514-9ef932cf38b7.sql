
CREATE TABLE public.report_schedule_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  singleton boolean NOT NULL DEFAULT true UNIQUE,
  enabled boolean NOT NULL DEFAULT false,
  day_of_month integer NOT NULL DEFAULT 1 CHECK (day_of_month BETWEEN 1 AND 28),
  hour integer NOT NULL DEFAULT 8 CHECK (hour BETWEEN 0 AND 23),
  minute integer NOT NULL DEFAULT 0 CHECK (minute BETWEEN 0 AND 59),
  timezone text NOT NULL DEFAULT 'Africa/Nairobi',
  last_run_at timestamptz,
  last_run_status text,
  updated_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.report_schedule_settings TO authenticated;
GRANT ALL ON public.report_schedule_settings TO service_role;

ALTER TABLE public.report_schedule_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Super admins manage schedule" ON public.report_schedule_settings
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'super_admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'super_admin'::app_role));

CREATE POLICY "Admins read schedule" ON public.report_schedule_settings
  FOR SELECT TO authenticated
  USING (is_admin(auth.uid()));

CREATE TRIGGER update_report_schedule_settings_updated_at
  BEFORE UPDATE ON public.report_schedule_settings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO public.report_schedule_settings (singleton) VALUES (true) ON CONFLICT DO NOTHING;
