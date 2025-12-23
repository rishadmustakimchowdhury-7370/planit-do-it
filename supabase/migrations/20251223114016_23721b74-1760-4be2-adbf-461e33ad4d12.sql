-- Add trial_expires_at column to tenants table for dynamic trial period management
ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS trial_expires_at TIMESTAMP WITH TIME ZONE;

-- Add trial_days column to track how many days the trial was granted for
ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS trial_days INTEGER DEFAULT 14;

-- Create index for efficient trial expiry queries
CREATE INDEX IF NOT EXISTS idx_tenants_trial_expires_at ON public.tenants(trial_expires_at) WHERE trial_expires_at IS NOT NULL;