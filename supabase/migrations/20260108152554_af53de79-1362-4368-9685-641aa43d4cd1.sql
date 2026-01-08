-- Add TOTP secret column for Google Authenticator 2FA
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS two_factor_secret TEXT;

-- Add comment for clarity
COMMENT ON COLUMN public.profiles.two_factor_secret IS 'Base32 encoded TOTP secret for Google Authenticator';
