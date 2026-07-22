
-- =========================================================
-- Unify Youth Group — auth, members, transactions, roles
-- =========================================================

-- Roles enum + user_roles table (never on profiles)
CREATE TYPE public.app_role AS ENUM ('super_admin', 'treasurer', 'secretary', 'project_manager', 'member');

CREATE TABLE public.user_roles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role);
$$;

CREATE OR REPLACE FUNCTION public.is_admin(_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id
      AND role IN ('super_admin','treasurer','secretary','project_manager')
  );
$$;

CREATE POLICY "Users see own roles" ON public.user_roles FOR SELECT
  TO authenticated USING (auth.uid() = user_id OR public.is_admin(auth.uid()));

-- Members table
CREATE TABLE public.members (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  member_code TEXT NOT NULL UNIQUE,
  full_name TEXT NOT NULL,
  phone TEXT,
  email TEXT,
  user_id UUID UNIQUE REFERENCES auth.users(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','inactive')),
  joined_date DATE NOT NULL DEFAULT CURRENT_DATE,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.members TO authenticated;
GRANT ALL ON public.members TO service_role;
ALTER TABLE public.members ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members read own profile" ON public.members FOR SELECT
  TO authenticated USING (user_id = auth.uid() OR public.is_admin(auth.uid()));
CREATE POLICY "Admins manage members" ON public.members FOR ALL
  TO authenticated USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));

-- Transaction category enum
CREATE TYPE public.txn_category AS ENUM (
  'monthly_contribution',
  'account_boosting',
  'fine',
  'loan_disbursement',
  'loan_repayment',
  'shirts_loan',
  'interest',
  'due',
  'penalty',
  'other'
);

-- Unified transactions ledger
CREATE TABLE public.transactions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  member_id UUID NOT NULL REFERENCES public.members(id) ON DELETE CASCADE,
  category public.txn_category NOT NULL,
  amount NUMERIC(12,2) NOT NULL,
  transaction_date DATE NOT NULL DEFAULT CURRENT_DATE,
  description TEXT,
  reference TEXT,
  source TEXT NOT NULL DEFAULT 'manual', -- 'manual' | 'imported_2026_07_15' | 'mpesa' ...
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.transactions TO authenticated;
GRANT ALL ON public.transactions TO service_role;
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;

CREATE INDEX idx_transactions_member ON public.transactions (member_id, transaction_date DESC);
CREATE INDEX idx_transactions_category ON public.transactions (category);

CREATE POLICY "Members read own transactions" ON public.transactions FOR SELECT
  TO authenticated USING (
    public.is_admin(auth.uid())
    OR EXISTS (SELECT 1 FROM public.members m WHERE m.id = transactions.member_id AND m.user_id = auth.uid())
  );
CREATE POLICY "Admins manage transactions" ON public.transactions FOR ALL
  TO authenticated USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));

-- updated_at trigger
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;
CREATE TRIGGER trg_members_updated BEFORE UPDATE ON public.members
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_transactions_updated BEFORE UPDATE ON public.transactions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =========================================================
-- Seed: 11 members + opening balances from 15/07/2026 summary
-- =========================================================
INSERT INTO public.members (member_code, full_name) VALUES
  ('UYG-001','Dickson Ngumbi'),
  ('UYG-002','Roberto Itumo'),
  ('UYG-003','Titus Mutuku'),
  ('UYG-004','Cyrus Muema'),
  ('UYG-005','Festus Mutua'),
  ('UYG-006','Bridon Muthoka'),
  ('UYG-007','Jimmy Tama'),
  ('UYG-008','Nebster Muneeni'),
  ('UYG-009','Jackson Mumo'),
  ('UYG-010','Moses Mutisya'),
  ('UYG-011','Joshua Manza');

-- Helper: seed transactions using member_code lookup
INSERT INTO public.transactions (member_id, category, amount, transaction_date, description, source)
SELECT m.id, x.category::public.txn_category, x.amount, DATE '2026-07-15', x.description, 'imported_2026_07_15'
FROM (VALUES
  -- Monthly contributions
  ('UYG-001','monthly_contribution',2000,'Opening balance — imported'),
  ('UYG-002','monthly_contribution',10500,'Opening balance — imported'),
  ('UYG-009','monthly_contribution',2000,'Opening balance — imported'),
  ('UYG-010','monthly_contribution',2000,'Opening balance — imported'),
  -- Account Boosting
  ('UYG-002','account_boosting',8000,'Opening balance — imported'),
  -- Fines
  ('UYG-001','fine',600,'Opening balance — imported'),
  ('UYG-002','fine',4100,'Opening balance — imported'),
  ('UYG-004','fine',200,'Opening balance — imported'),
  ('UYG-005','fine',200,'Opening balance — imported'),
  ('UYG-009','fine',600,'Opening balance — imported'),
  ('UYG-010','fine',500,'Opening balance — imported'),
  ('UYG-011','fine',200,'Opening balance — imported'),
  -- Loans
  ('UYG-001','loan_disbursement',30000,'Opening loan balance — imported'),
  ('UYG-003','loan_disbursement',20000,'Opening loan balance — imported'),
  ('UYG-004','loan_disbursement',15000,'Opening loan balance — imported'),
  ('UYG-005','loan_disbursement',15000,'Opening loan balance — imported'),
  ('UYG-006','loan_disbursement',15000,'Opening loan balance — imported'),
  ('UYG-007','loan_disbursement',15000,'Opening loan balance — imported'),
  ('UYG-008','loan_disbursement',30000,'Opening loan balance — imported'),
  ('UYG-009','loan_disbursement',10000,'Opening loan balance — imported'),
  ('UYG-010','loan_disbursement',30000,'Opening loan balance — imported'),
  ('UYG-011','loan_disbursement',15000,'Opening loan balance — imported'),
  -- Shirts loan
  ('UYG-002','shirts_loan',1700,'Shirts loan — imported'),
  -- Interest
  ('UYG-002','interest',170,'10% interest — imported'),
  ('UYG-002','interest',987,'Additional 10% interest — imported')
) AS x(code, category, amount, description)
JOIN public.members m ON m.member_code = x.code;
