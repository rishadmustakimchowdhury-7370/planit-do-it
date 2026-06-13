
-- =========================================
-- billing_settings: restrict SELECT to super_admin only
-- =========================================
DROP POLICY IF EXISTS "Anyone can view billing settings" ON public.billing_settings;

CREATE POLICY "Super admins can view billing settings"
  ON public.billing_settings
  FOR SELECT
  TO authenticated
  USING (public.is_super_admin(auth.uid()));

REVOKE SELECT ON public.billing_settings FROM anon;

-- =========================================
-- platform_settings: restrict SELECT to super_admin only
-- =========================================
DROP POLICY IF EXISTS "Anyone can view settings" ON public.platform_settings;

CREATE POLICY "Super admins can view settings"
  ON public.platform_settings
  FOR SELECT
  TO authenticated
  USING (public.is_super_admin(auth.uid()));

REVOKE SELECT ON public.platform_settings FROM anon;

-- =========================================
-- Whitelisted RPCs to preserve public/authenticated read paths
-- (returns only specific safe keys; no broad table access)
-- =========================================

-- Public (anon): demo_video_url + seo_settings used by LandingPage + useSiteBranding
CREATE OR REPLACE FUNCTION public.get_public_platform_setting(_key text)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT value
  FROM public.platform_settings
  WHERE key = _key
    AND _key IN ('demo_video_url', 'seo_settings');
$$;

REVOKE ALL ON FUNCTION public.get_public_platform_setting(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_public_platform_setting(text) TO anon, authenticated;

-- Authenticated: billing discounts used by CheckoutPage
CREATE OR REPLACE FUNCTION public.get_public_billing_setting(_key text)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT setting_value
  FROM public.billing_settings
  WHERE setting_key = _key
    AND _key IN ('multi_month_discounts');
$$;

REVOKE ALL ON FUNCTION public.get_public_billing_setting(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_public_billing_setting(text) TO authenticated;
