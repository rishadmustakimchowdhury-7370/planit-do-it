
-- =============== PHASE 1: Finance Module Schema ===============

-- 1. Extend invoices table
ALTER TABLE public.invoices
  ADD COLUMN IF NOT EXISTS placement_id uuid REFERENCES public.placements(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS client_id uuid REFERENCES public.clients(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS client_org_id uuid REFERENCES public.client_organizations(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS issue_date date DEFAULT CURRENT_DATE,
  ADD COLUMN IF NOT EXISTS subtotal numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS tax_pct numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS tax_amount numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS vat_pct numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS vat_amount numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_amount numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS amount_paid numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS balance numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS sent_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS sent_to_email text,
  ADD COLUMN IF NOT EXISTS payment_terms text,
  ADD COLUMN IF NOT EXISTS bank_details jsonb,
  ADD COLUMN IF NOT EXISTS pdf_storage_path text;

ALTER TABLE public.invoices ALTER COLUMN currency SET DEFAULT 'USD';

-- 2. Invoice payments
CREATE TABLE IF NOT EXISTS public.invoice_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  invoice_id uuid NOT NULL REFERENCES public.invoices(id) ON DELETE CASCADE,
  amount numeric NOT NULL,
  currency text NOT NULL DEFAULT 'USD',
  payment_date date NOT NULL DEFAULT CURRENT_DATE,
  payment_method text,
  reference text,
  notes text,
  recorded_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.invoice_payments TO authenticated;
GRANT ALL ON public.invoice_payments TO service_role;
ALTER TABLE public.invoice_payments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owner/Manager manage invoice payments" ON public.invoice_payments
  FOR ALL TO authenticated
  USING (public.is_owner_or_manager_in_tenant(auth.uid(), tenant_id))
  WITH CHECK (public.is_owner_or_manager_in_tenant(auth.uid(), tenant_id));

-- 3. Invoice status history
CREATE TABLE IF NOT EXISTS public.invoice_status_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  invoice_id uuid NOT NULL REFERENCES public.invoices(id) ON DELETE CASCADE,
  from_status text,
  to_status text NOT NULL,
  changed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.invoice_status_history TO authenticated;
GRANT ALL ON public.invoice_status_history TO service_role;
ALTER TABLE public.invoice_status_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owner/Manager view invoice history" ON public.invoice_status_history
  FOR SELECT TO authenticated
  USING (public.is_owner_or_manager_in_tenant(auth.uid(), tenant_id));
CREATE POLICY "Owner/Manager insert invoice history" ON public.invoice_status_history
  FOR INSERT TO authenticated
  WITH CHECK (public.is_owner_or_manager_in_tenant(auth.uid(), tenant_id));

-- 4. Recruiter bonuses (NOT auto-created)
DO $$ BEGIN
  CREATE TYPE public.bonus_status AS ENUM ('pending','approved','paid','cancelled');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.bonus_type AS ENUM ('percent','fixed');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS public.recruiter_bonuses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  placement_id uuid NOT NULL REFERENCES public.placements(id) ON DELETE CASCADE,
  recruiter_user_id uuid NOT NULL,
  bonus_type public.bonus_type NOT NULL DEFAULT 'percent',
  bonus_pct numeric,
  bonus_fixed numeric,
  bonus_amount numeric NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'USD',
  status public.bonus_status NOT NULL DEFAULT 'pending',
  notes text,
  approved_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  approved_at timestamptz,
  paid_at timestamptz,
  paid_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.recruiter_bonuses TO authenticated;
GRANT ALL ON public.recruiter_bonuses TO service_role;
ALTER TABLE public.recruiter_bonuses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owner/Manager manage bonuses" ON public.recruiter_bonuses
  FOR ALL TO authenticated
  USING (public.is_owner_or_manager_in_tenant(auth.uid(), tenant_id))
  WITH CHECK (public.is_owner_or_manager_in_tenant(auth.uid(), tenant_id));
CREATE POLICY "Recruiter views own bonuses" ON public.recruiter_bonuses
  FOR SELECT TO authenticated
  USING (recruiter_user_id = auth.uid());

-- 5. Finance settings
CREATE TABLE IF NOT EXISTS public.finance_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL UNIQUE,
  agency_name text,
  agency_address text,
  agency_phone text,
  agency_email text,
  agency_website text,
  agency_logo_url text,
  bank_name text,
  bank_account_name text,
  bank_account_number text,
  bank_sort_code text,
  bank_iban text,
  bank_swift text,
  default_currency text NOT NULL DEFAULT 'USD',
  default_payment_terms_days int DEFAULT 14,
  default_tax_pct numeric DEFAULT 0,
  default_vat_pct numeric DEFAULT 0,
  invoice_number_prefix text DEFAULT 'INV',
  invoice_footer_note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.finance_settings TO authenticated;
GRANT ALL ON public.finance_settings TO service_role;
ALTER TABLE public.finance_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owner/Manager manage finance settings" ON public.finance_settings
  FOR ALL TO authenticated
  USING (public.is_owner_or_manager_in_tenant(auth.uid(), tenant_id))
  WITH CHECK (public.is_owner_or_manager_in_tenant(auth.uid(), tenant_id));

-- 6. Finance audit log
CREATE TABLE IF NOT EXISTS public.finance_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  entity_type text NOT NULL, -- invoice, payment, bonus
  entity_id uuid NOT NULL,
  action text NOT NULL,      -- created, sent, paid, approved, etc.
  performed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.finance_audit_log TO authenticated;
GRANT ALL ON public.finance_audit_log TO service_role;
ALTER TABLE public.finance_audit_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owner/Manager view finance audit" ON public.finance_audit_log
  FOR SELECT TO authenticated
  USING (public.is_owner_or_manager_in_tenant(auth.uid(), tenant_id));
CREATE POLICY "Owner/Manager insert finance audit" ON public.finance_audit_log
  FOR INSERT TO authenticated
  WITH CHECK (public.is_owner_or_manager_in_tenant(auth.uid(), tenant_id));

-- 7. updated_at triggers
CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END $$;

DROP TRIGGER IF EXISTS trg_invoice_payments_updated ON public.invoice_payments;
CREATE TRIGGER trg_invoice_payments_updated BEFORE UPDATE ON public.invoice_payments
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

DROP TRIGGER IF EXISTS trg_recruiter_bonuses_updated ON public.recruiter_bonuses;
CREATE TRIGGER trg_recruiter_bonuses_updated BEFORE UPDATE ON public.recruiter_bonuses
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

DROP TRIGGER IF EXISTS trg_finance_settings_updated ON public.finance_settings;
CREATE TRIGGER trg_finance_settings_updated BEFORE UPDATE ON public.finance_settings
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- 8. Auto-update invoice balance/status on payments
CREATE OR REPLACE FUNCTION public.recalc_invoice_balance()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
DECLARE
  v_invoice_id uuid;
  v_paid numeric;
  v_total numeric;
  v_status invoice_status;
BEGIN
  v_invoice_id := COALESCE(NEW.invoice_id, OLD.invoice_id);
  SELECT COALESCE(SUM(amount),0) INTO v_paid FROM public.invoice_payments WHERE invoice_id = v_invoice_id;
  SELECT total_amount, status INTO v_total, v_status FROM public.invoices WHERE id = v_invoice_id;
  UPDATE public.invoices
    SET amount_paid = v_paid,
        balance = COALESCE(v_total,0) - v_paid,
        status = CASE
          WHEN v_paid >= COALESCE(v_total,0) AND v_paid > 0 THEN 'paid'::invoice_status
          WHEN v_paid > 0 AND v_paid < COALESCE(v_total,0) THEN COALESCE(v_status,'sent'::invoice_status)
          ELSE v_status
        END,
        paid_at = CASE WHEN v_paid >= COALESCE(v_total,0) AND v_paid > 0 THEN now() ELSE paid_at END
  WHERE id = v_invoice_id;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_recalc_invoice_balance ON public.invoice_payments;
CREATE TRIGGER trg_recalc_invoice_balance
  AFTER INSERT OR UPDATE OR DELETE ON public.invoice_payments
  FOR EACH ROW EXECUTE FUNCTION public.recalc_invoice_balance();
