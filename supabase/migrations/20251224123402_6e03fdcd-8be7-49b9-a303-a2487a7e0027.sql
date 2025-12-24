-- Add show_as_banner field to promo_codes
ALTER TABLE public.promo_codes 
ADD COLUMN IF NOT EXISTS show_as_banner BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS banner_text TEXT;