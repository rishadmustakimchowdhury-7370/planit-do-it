-- Orders table for tracking all purchases
CREATE TABLE IF NOT EXISTS public.orders (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID REFERENCES public.tenants(id),
  user_id UUID REFERENCES auth.users(id),
  plan_id UUID REFERENCES public.subscription_plans(id),
  stripe_customer_id TEXT,
  stripe_payment_intent_id TEXT,
  stripe_subscription_id TEXT,
  stripe_invoice_id TEXT,
  stripe_checkout_session_id TEXT,
  amount NUMERIC NOT NULL,
  currency TEXT NOT NULL DEFAULT 'usd',
  billing_cycle TEXT NOT NULL DEFAULT 'monthly', -- monthly or yearly
  status TEXT NOT NULL DEFAULT 'pending', -- pending, completed, failed, refunded
  approval_status TEXT NOT NULL DEFAULT 'pending_approval', -- pending_approval, approved, rejected
  approved_by UUID,
  approved_at TIMESTAMP WITH TIME ZONE,
  rejection_reason TEXT,
  payment_method TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;

-- RLS policies for orders
CREATE POLICY "Users can view their own orders"
  ON public.orders FOR SELECT
  USING (user_id = auth.uid() OR is_super_admin(auth.uid()));

CREATE POLICY "System can insert orders"
  ON public.orders FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Super admins can manage all orders"
  ON public.orders FOR ALL
  USING (is_super_admin(auth.uid()));

-- Indexes for orders
CREATE INDEX idx_orders_user_id ON public.orders(user_id);
CREATE INDEX idx_orders_tenant_id ON public.orders(tenant_id);
CREATE INDEX idx_orders_status ON public.orders(status);
CREATE INDEX idx_orders_approval_status ON public.orders(approval_status);
CREATE INDEX idx_orders_created_at ON public.orders(created_at DESC);
CREATE INDEX idx_orders_stripe_checkout ON public.orders(stripe_checkout_session_id);

-- Trigger for updated_at
CREATE TRIGGER update_orders_updated_at
  BEFORE UPDATE ON public.orders
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();