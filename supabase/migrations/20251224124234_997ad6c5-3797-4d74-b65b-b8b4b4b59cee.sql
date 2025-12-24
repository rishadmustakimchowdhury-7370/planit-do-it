-- Create billing settings table for multi-month discounts
CREATE TABLE public.billing_settings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  setting_key TEXT NOT NULL UNIQUE,
  setting_value JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.billing_settings ENABLE ROW LEVEL SECURITY;

-- Super admins can manage billing settings
CREATE POLICY "Super admins can manage billing settings" 
ON public.billing_settings 
FOR ALL 
USING (is_super_admin(auth.uid()));

-- Anyone can view billing settings (for checkout page)
CREATE POLICY "Anyone can view billing settings" 
ON public.billing_settings 
FOR SELECT 
USING (true);

-- Insert default multi-month discounts
INSERT INTO public.billing_settings (setting_key, setting_value) VALUES 
('multi_month_discounts', '{"3": 5, "6": 10, "12": 15}'::jsonb);

-- Add is_active column to promo_codes if not exists
ALTER TABLE public.promo_codes ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT true;