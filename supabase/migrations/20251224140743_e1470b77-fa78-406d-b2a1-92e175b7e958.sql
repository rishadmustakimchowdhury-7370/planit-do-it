-- Create table to store Stripe Connect credentials (single row for platform)
CREATE TABLE public.stripe_connect (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  stripe_account_id TEXT,
  stripe_publishable_key TEXT,
  stripe_secret_key_encrypted TEXT,
  stripe_webhook_secret_encrypted TEXT,
  is_connected BOOLEAN DEFAULT false,
  connected_at TIMESTAMP WITH TIME ZONE,
  connected_by UUID,
  account_name TEXT,
  account_email TEXT,
  livemode BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.stripe_connect ENABLE ROW LEVEL SECURITY;

-- Create security definer function to check super_admin role
CREATE OR REPLACE FUNCTION public.is_super_admin(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = 'super_admin'
  )
$$;

-- Only super admins can access stripe connect settings
CREATE POLICY "Super admins can view stripe connect" 
ON public.stripe_connect 
FOR SELECT
TO authenticated
USING (public.is_super_admin(auth.uid()));

CREATE POLICY "Super admins can insert stripe connect" 
ON public.stripe_connect 
FOR INSERT
TO authenticated
WITH CHECK (public.is_super_admin(auth.uid()));

CREATE POLICY "Super admins can update stripe connect" 
ON public.stripe_connect 
FOR UPDATE
TO authenticated
USING (public.is_super_admin(auth.uid()));

-- Create trigger for updated_at
CREATE TRIGGER update_stripe_connect_updated_at
BEFORE UPDATE ON public.stripe_connect
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();