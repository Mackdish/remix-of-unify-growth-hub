
CREATE TYPE public.loan_request_status AS ENUM ('pending','approved','rejected','disbursed','cancelled');

CREATE TABLE public.loan_requests (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  member_id uuid NOT NULL REFERENCES public.members(id) ON DELETE CASCADE,
  amount numeric NOT NULL CHECK (amount > 0),
  purpose text NOT NULL,
  repayment_months integer,
  status public.loan_request_status NOT NULL DEFAULT 'pending',
  reviewer_id uuid,
  reviewer_notes text,
  disbursed_transaction_id uuid REFERENCES public.transactions(id) ON DELETE SET NULL,
  created_by uuid,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  reviewed_at timestamp with time zone,
  disbursed_at timestamp with time zone
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.loan_requests TO authenticated;
GRANT ALL ON public.loan_requests TO service_role;

ALTER TABLE public.loan_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members create own loan requests"
  ON public.loan_requests FOR INSERT TO authenticated
  WITH CHECK (
    is_admin(auth.uid())
    OR EXISTS (SELECT 1 FROM public.members m WHERE m.id = member_id AND m.user_id = auth.uid())
  );

CREATE POLICY "Members read own loan requests"
  ON public.loan_requests FOR SELECT TO authenticated
  USING (
    is_admin(auth.uid())
    OR EXISTS (SELECT 1 FROM public.members m WHERE m.id = member_id AND m.user_id = auth.uid())
  );

CREATE POLICY "Members cancel own pending"
  ON public.loan_requests FOR UPDATE TO authenticated
  USING (
    is_admin(auth.uid())
    OR (
      status = 'pending'
      AND EXISTS (SELECT 1 FROM public.members m WHERE m.id = member_id AND m.user_id = auth.uid())
    )
  )
  WITH CHECK (
    is_admin(auth.uid())
    OR (
      EXISTS (SELECT 1 FROM public.members m WHERE m.id = member_id AND m.user_id = auth.uid())
    )
  );

CREATE POLICY "Admins delete loan requests"
  ON public.loan_requests FOR DELETE TO authenticated
  USING (is_admin(auth.uid()));

CREATE TRIGGER update_loan_requests_updated_at
BEFORE UPDATE ON public.loan_requests
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX loan_requests_member_idx ON public.loan_requests(member_id);
CREATE INDEX loan_requests_status_idx ON public.loan_requests(status);
