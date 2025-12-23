-- Create table for LinkedIn user connections
CREATE TABLE public.linkedin_connections (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  linkedin_profile_id VARCHAR(100),
  linkedin_profile_url TEXT,
  linkedin_name TEXT,
  linkedin_email TEXT,
  linkedin_avatar_url TEXT,
  access_token_encrypted TEXT,
  token_expires_at TIMESTAMP WITH TIME ZONE,
  is_connected BOOLEAN NOT NULL DEFAULT false,
  connected_at TIMESTAMP WITH TIME ZONE,
  disconnected_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, tenant_id)
);

-- Enable RLS
ALTER TABLE public.linkedin_connections ENABLE ROW LEVEL SECURITY;

-- Users can only view their own LinkedIn connection
CREATE POLICY "Users can view own LinkedIn connection"
ON public.linkedin_connections
FOR SELECT
USING (auth.uid() = user_id);

-- Users can insert their own LinkedIn connection
CREATE POLICY "Users can insert own LinkedIn connection"
ON public.linkedin_connections
FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Users can update their own LinkedIn connection
CREATE POLICY "Users can update own LinkedIn connection"
ON public.linkedin_connections
FOR UPDATE
USING (auth.uid() = user_id);

-- Users can delete their own LinkedIn connection
CREATE POLICY "Users can delete own LinkedIn connection"
ON public.linkedin_connections
FOR DELETE
USING (auth.uid() = user_id);

-- Create index for faster lookups
CREATE INDEX idx_linkedin_connections_user ON public.linkedin_connections(user_id);
CREATE INDEX idx_linkedin_connections_tenant ON public.linkedin_connections(tenant_id);

-- Trigger for updating timestamps
CREATE TRIGGER update_linkedin_connections_updated_at
BEFORE UPDATE ON public.linkedin_connections
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();