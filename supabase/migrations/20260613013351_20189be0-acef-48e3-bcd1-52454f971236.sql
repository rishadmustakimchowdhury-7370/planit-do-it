
-- 1. New isolated table for MFA secrets
CREATE TABLE public.user_mfa_secrets (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  totp_secret text,
  phone text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 2. Grants (no anon access; service_role for edge functions)
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_mfa_secrets TO authenticated;
GRANT ALL ON public.user_mfa_secrets TO service_role;

-- 3. RLS — only the owning user or a super admin
ALTER TABLE public.user_mfa_secrets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own MFA secret"
  ON public.user_mfa_secrets FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_super_admin(auth.uid()));

CREATE POLICY "Users can insert own MFA secret"
  ON public.user_mfa_secrets FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() OR public.is_super_admin(auth.uid()));

CREATE POLICY "Users can update own MFA secret"
  ON public.user_mfa_secrets FOR UPDATE TO authenticated
  USING (user_id = auth.uid() OR public.is_super_admin(auth.uid()))
  WITH CHECK (user_id = auth.uid() OR public.is_super_admin(auth.uid()));

CREATE POLICY "Users can delete own MFA secret"
  ON public.user_mfa_secrets FOR DELETE TO authenticated
  USING (user_id = auth.uid() OR public.is_super_admin(auth.uid()));

-- 4. updated_at trigger
CREATE TRIGGER trg_user_mfa_secrets_updated_at
  BEFORE UPDATE ON public.user_mfa_secrets
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 5. Migrate existing data from profiles
INSERT INTO public.user_mfa_secrets (user_id, totp_secret, phone)
SELECT id, two_factor_secret, two_factor_phone
FROM public.profiles
WHERE two_factor_secret IS NOT NULL OR two_factor_phone IS NOT NULL
ON CONFLICT (user_id) DO NOTHING;

-- 6. Drop secret columns from profiles (keep two_factor_enabled flag)
ALTER TABLE public.profiles DROP COLUMN IF EXISTS two_factor_secret;
ALTER TABLE public.profiles DROP COLUMN IF EXISTS two_factor_phone;
