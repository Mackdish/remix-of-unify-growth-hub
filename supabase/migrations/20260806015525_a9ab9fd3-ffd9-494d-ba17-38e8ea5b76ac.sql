CREATE TABLE public.documents (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title text NOT NULL,
  category text NOT NULL DEFAULT 'other',
  description text,
  file_name text NOT NULL,
  storage_path text NOT NULL,
  mime_type text,
  size_bytes bigint,
  uploaded_by uuid,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.documents TO authenticated;
GRANT ALL ON public.documents TO service_role;

ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members read documents" ON public.documents FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins manage documents" ON public.documents FOR ALL TO authenticated USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));

CREATE TRIGGER update_documents_updated_at BEFORE UPDATE ON public.documents FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.loan_requests ADD COLUMN IF NOT EXISTS due_date date;

-- Storage policies for the documents bucket
CREATE POLICY "Members read documents files" ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'documents');
CREATE POLICY "Admins upload documents files" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'documents' AND public.is_admin(auth.uid()));
CREATE POLICY "Admins update documents files" ON storage.objects FOR UPDATE TO authenticated USING (bucket_id = 'documents' AND public.is_admin(auth.uid()));
CREATE POLICY "Admins delete documents files" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'documents' AND public.is_admin(auth.uid()));