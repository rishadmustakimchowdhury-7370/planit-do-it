-- Create table to track promo code usage per user
CREATE TABLE public.promo_code_usage (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  promo_code_id UUID NOT NULL REFERENCES public.promo_codes(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  used_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  order_id UUID REFERENCES public.orders(id),
  UNIQUE(promo_code_id, user_id)
);

-- Enable RLS
ALTER TABLE public.promo_code_usage ENABLE ROW LEVEL SECURITY;

-- Users can view their own usage
CREATE POLICY "Users can view their own promo usage"
  ON public.promo_code_usage
  FOR SELECT
  USING (user_id = auth.uid() OR is_super_admin(auth.uid()));

-- System can insert usage records
CREATE POLICY "System can insert promo usage"
  ON public.promo_code_usage
  FOR INSERT
  WITH CHECK (true);

-- Create index for faster lookups
CREATE INDEX idx_promo_code_usage_user ON public.promo_code_usage(user_id, promo_code_id);