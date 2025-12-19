-- Phase 5: Credits System
-- Tamper-proof credit tracking with full audit trail

-- Create credits table (one row per tenant)
CREATE TABLE IF NOT EXISTS public.credits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL UNIQUE REFERENCES public.tenants(id) ON DELETE CASCADE,
  balance integer NOT NULL DEFAULT 0 CHECK (balance >= 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT credits_balance_positive CHECK (balance >= 0)
);

-- Create credit_transactions table (immutable audit log)
CREATE TABLE IF NOT EXISTS public.credit_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  action_type text NOT NULL, -- 'ai_match', 'cv_parse', 'email_compose', 'purchase', 'refund', 'admin_adjustment'
  cost integer NOT NULL, -- positive for deductions, negative for additions
  balance_before integer NOT NULL,
  balance_after integer NOT NULL,
  metadata jsonb DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT credit_transactions_balance_check CHECK (balance_after >= 0)
);

-- Enable RLS on both tables
ALTER TABLE public.credits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.credit_transactions ENABLE ROW LEVEL SECURITY;

-- RLS Policies for credits table
CREATE POLICY "Users can view credits in their tenant"
ON public.credits FOR SELECT
USING (tenant_id = get_user_tenant_id(auth.uid()) OR is_owner(auth.uid()));

CREATE POLICY "Only system can modify credits"
ON public.credits FOR ALL
USING (false)
WITH CHECK (false);

-- RLS Policies for credit_transactions (immutable, view-only)
CREATE POLICY "Owners can view all transactions"
ON public.credit_transactions FOR SELECT
USING (
  (tenant_id = get_user_tenant_id(auth.uid()) AND is_owner(auth.uid())) 
  OR is_owner(auth.uid())
);

CREATE POLICY "System can insert transactions"
ON public.credit_transactions FOR INSERT
WITH CHECK (true);

-- No UPDATE or DELETE policies - transactions are immutable

-- Function to deduct credits (atomic operation)
CREATE OR REPLACE FUNCTION public.deduct_credits(
  p_tenant_id uuid,
  p_user_id uuid,
  p_action_type text,
  p_cost integer,
  p_metadata jsonb DEFAULT '{}'
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_current_balance integer;
  v_new_balance integer;
BEGIN
  -- Lock the credits row for update
  SELECT balance INTO v_current_balance
  FROM public.credits
  WHERE tenant_id = p_tenant_id
  FOR UPDATE;
  
  -- If no credits record exists, create one with 0 balance
  IF NOT FOUND THEN
    INSERT INTO public.credits (tenant_id, balance)
    VALUES (p_tenant_id, 0)
    RETURNING balance INTO v_current_balance;
  END IF;
  
  -- Check if sufficient credits
  IF v_current_balance < p_cost THEN
    RETURN false;
  END IF;
  
  -- Calculate new balance
  v_new_balance := v_current_balance - p_cost;
  
  -- Update credits
  UPDATE public.credits
  SET balance = v_new_balance,
      updated_at = now()
  WHERE tenant_id = p_tenant_id;
  
  -- Log transaction (immutable)
  INSERT INTO public.credit_transactions (
    tenant_id,
    user_id,
    action_type,
    cost,
    balance_before,
    balance_after,
    metadata
  ) VALUES (
    p_tenant_id,
    p_user_id,
    p_action_type,
    p_cost,
    v_current_balance,
    v_new_balance,
    p_metadata
  );
  
  RETURN true;
END;
$$;

-- Function to add credits (for purchases/refunds)
CREATE OR REPLACE FUNCTION public.add_credits(
  p_tenant_id uuid,
  p_user_id uuid,
  p_action_type text,
  p_amount integer,
  p_metadata jsonb DEFAULT '{}'
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_current_balance integer;
  v_new_balance integer;
BEGIN
  -- Lock the credits row for update
  SELECT balance INTO v_current_balance
  FROM public.credits
  WHERE tenant_id = p_tenant_id
  FOR UPDATE;
  
  -- If no credits record exists, create one
  IF NOT FOUND THEN
    INSERT INTO public.credits (tenant_id, balance)
    VALUES (p_tenant_id, 0)
    RETURNING balance INTO v_current_balance;
  END IF;
  
  -- Calculate new balance
  v_new_balance := v_current_balance + p_amount;
  
  -- Update credits
  UPDATE public.credits
  SET balance = v_new_balance,
      updated_at = now()
  WHERE tenant_id = p_tenant_id;
  
  -- Log transaction with negative cost (credit addition)
  INSERT INTO public.credit_transactions (
    tenant_id,
    user_id,
    action_type,
    cost,
    balance_before,
    balance_after,
    metadata
  ) VALUES (
    p_tenant_id,
    p_user_id,
    p_action_type,
    -p_amount, -- Negative to indicate addition
    v_current_balance,
    v_new_balance,
    p_metadata
  );
END;
$$;

-- Function to check if tenant has sufficient credits
CREATE OR REPLACE FUNCTION public.has_sufficient_credits(
  p_tenant_id uuid,
  p_required_credits integer
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_balance integer;
BEGIN
  SELECT balance INTO v_balance
  FROM public.credits
  WHERE tenant_id = p_tenant_id;
  
  -- If no record exists, balance is 0
  IF NOT FOUND THEN
    RETURN p_required_credits <= 0;
  END IF;
  
  RETURN v_balance >= p_required_credits;
END;
$$;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_credits_tenant ON public.credits(tenant_id);
CREATE INDEX IF NOT EXISTS idx_credit_transactions_tenant ON public.credit_transactions(tenant_id);
CREATE INDEX IF NOT EXISTS idx_credit_transactions_user ON public.credit_transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_credit_transactions_created ON public.credit_transactions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_credit_transactions_action ON public.credit_transactions(action_type);

-- Initialize credits for existing tenants (100 free credits)
INSERT INTO public.credits (tenant_id, balance)
SELECT id, 100
FROM public.tenants
WHERE id NOT IN (SELECT tenant_id FROM public.credits)
ON CONFLICT (tenant_id) DO NOTHING;