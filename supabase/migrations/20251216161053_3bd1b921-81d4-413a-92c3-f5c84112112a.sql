-- Update subscription plans with new GBP pricing and limits
UPDATE public.subscription_plans SET 
  price_monthly = 29,
  price_yearly = 290,
  max_jobs = 10,
  max_candidates = 150,
  max_users = 2,
  match_credits_monthly = 50,
  features = '["10 Active Jobs", "150 Candidates", "2 Team Members", "50 AI Matches/month", "Email Support", "Basic Analytics"]'::jsonb
WHERE slug = 'starter';

UPDATE public.subscription_plans SET 
  price_monthly = 49,
  price_yearly = 490,
  max_jobs = 25,
  max_candidates = 500,
  max_users = 5,
  match_credits_monthly = 200,
  features = '["25 Active Jobs", "500 Candidates", "5 Team Members", "200 AI Matches/month", "Priority Support", "Advanced Analytics", "Email Templates"]'::jsonb
WHERE slug = 'pro';

UPDATE public.subscription_plans SET 
  price_monthly = 149,
  price_yearly = 1490,
  max_jobs = -1,
  max_candidates = -1,
  max_users = -1,
  match_credits_monthly = 1000,
  features = '["Unlimited Active Jobs", "Unlimited Candidates", "Unlimited Team Members", "1000 AI Matches/month", "Premium Support", "Custom Branding", "API Access", "White Label"]'::jsonb
WHERE slug = 'agency';

-- Create promo_codes table for coupon management
CREATE TABLE IF NOT EXISTS public.promo_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL UNIQUE,
  description TEXT,
  discount_type TEXT NOT NULL DEFAULT 'percentage', -- 'percentage' or 'fixed'
  discount_value NUMERIC NOT NULL, -- e.g., 20 for 20% or 20 for £20 off
  currency TEXT DEFAULT 'GBP', -- only used for fixed discounts
  max_uses INTEGER, -- null means unlimited
  uses_count INTEGER DEFAULT 0,
  valid_from TIMESTAMPTZ DEFAULT now(),
  valid_until TIMESTAMPTZ,
  applicable_plans JSONB DEFAULT '[]'::jsonb, -- empty means all plans
  min_purchase_amount NUMERIC DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Create promo_code_uses table to track usage
CREATE TABLE IF NOT EXISTS public.promo_code_uses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  promo_code_id UUID NOT NULL REFERENCES public.promo_codes(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id),
  tenant_id UUID REFERENCES public.tenants(id),
  order_id UUID REFERENCES public.orders(id),
  discount_applied NUMERIC NOT NULL,
  used_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.promo_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.promo_code_uses ENABLE ROW LEVEL SECURITY;

-- RLS policies for promo_codes (super admin only can manage)
CREATE POLICY "Super admins can manage promo codes" ON public.promo_codes
  FOR ALL USING (is_super_admin(auth.uid()));

CREATE POLICY "Anyone can view active promo codes" ON public.promo_codes
  FOR SELECT USING (is_active = true AND (valid_until IS NULL OR valid_until > now()));

-- RLS policies for promo_code_uses
CREATE POLICY "Super admins can view all promo code uses" ON public.promo_code_uses
  FOR SELECT USING (is_super_admin(auth.uid()));

CREATE POLICY "Users can view their own promo code uses" ON public.promo_code_uses
  FOR SELECT USING (user_id = auth.uid());