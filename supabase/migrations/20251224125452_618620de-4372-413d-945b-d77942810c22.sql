-- Create function to increment promo code uses
CREATE OR REPLACE FUNCTION public.increment_promo_uses(promo_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.promo_codes
  SET uses_count = uses_count + 1
  WHERE id = promo_id;
END;
$$;