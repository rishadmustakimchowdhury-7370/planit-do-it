-- Add 'manager' to app_role enum if not exists
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'manager' AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'app_role')) THEN
    ALTER TYPE public.app_role ADD VALUE 'manager';
  END IF;
END $$;

-- Team Invitations table
CREATE TABLE IF NOT EXISTS public.team_invitations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  role public.app_role NOT NULL DEFAULT 'recruiter',
  invited_by UUID NOT NULL,
  token TEXT NOT NULL UNIQUE,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  accepted_at TIMESTAMP WITH TIME ZONE,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'expired', 'cancelled')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Recruiter Activities table (for auto KPI tracking)
CREATE TABLE IF NOT EXISTS public.recruiter_activities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  candidate_id UUID REFERENCES public.candidates(id) ON DELETE SET NULL,
  job_id UUID REFERENCES public.jobs(id) ON DELETE SET NULL,
  client_id UUID REFERENCES public.clients(id) ON DELETE SET NULL,
  action_type TEXT NOT NULL CHECK (action_type IN (
    'cv_uploaded', 'cv_submitted', 'screening_completed', 
    'interview_scheduled', 'interview_completed', 
    'offer_sent', 'candidate_hired', 'candidate_rejected'
  )),
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Branding Settings table
CREATE TABLE IF NOT EXISTS public.branding_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL UNIQUE REFERENCES public.tenants(id) ON DELETE CASCADE,
  company_name TEXT,
  logo_url TEXT,
  logo_position TEXT DEFAULT 'top-left' CHECK (logo_position IN ('top-left', 'top-center', 'top-right')),
  footer_text TEXT,
  apply_to_cv BOOLEAN DEFAULT false,
  apply_to_jd BOOLEAN DEFAULT false,
  primary_color TEXT DEFAULT '#0052CC',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_team_invitations_tenant ON public.team_invitations(tenant_id);
CREATE INDEX IF NOT EXISTS idx_team_invitations_email ON public.team_invitations(email);
CREATE INDEX IF NOT EXISTS idx_team_invitations_token ON public.team_invitations(token);
CREATE INDEX IF NOT EXISTS idx_recruiter_activities_tenant ON public.recruiter_activities(tenant_id);
CREATE INDEX IF NOT EXISTS idx_recruiter_activities_user ON public.recruiter_activities(user_id);
CREATE INDEX IF NOT EXISTS idx_recruiter_activities_action ON public.recruiter_activities(action_type);
CREATE INDEX IF NOT EXISTS idx_recruiter_activities_created ON public.recruiter_activities(created_at);

-- Enable RLS
ALTER TABLE public.team_invitations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.recruiter_activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.branding_settings ENABLE ROW LEVEL SECURITY;

-- Team Invitations RLS Policies
CREATE POLICY "Users can view invitations in their tenant"
ON public.team_invitations FOR SELECT
USING (tenant_id = get_user_tenant_id(auth.uid()) OR is_super_admin(auth.uid()));

CREATE POLICY "Admins can manage invitations in their tenant"
ON public.team_invitations FOR ALL
USING (
  (tenant_id = get_user_tenant_id(auth.uid()) AND has_role(auth.uid(), 'admin'))
  OR is_super_admin(auth.uid())
);

-- Recruiter Activities RLS Policies
CREATE POLICY "Users can view activities in their tenant"
ON public.recruiter_activities FOR SELECT
USING (
  tenant_id = get_user_tenant_id(auth.uid()) 
  OR is_super_admin(auth.uid())
);

CREATE POLICY "Users can insert their own activities"
ON public.recruiter_activities FOR INSERT
WITH CHECK (
  tenant_id = get_user_tenant_id(auth.uid()) 
  AND user_id = auth.uid()
);

CREATE POLICY "Admins can manage all activities in tenant"
ON public.recruiter_activities FOR ALL
USING (
  (tenant_id = get_user_tenant_id(auth.uid()) AND has_role(auth.uid(), 'admin'))
  OR is_super_admin(auth.uid())
);

-- Branding Settings RLS Policies
CREATE POLICY "Users can view branding in their tenant"
ON public.branding_settings FOR SELECT
USING (tenant_id = get_user_tenant_id(auth.uid()) OR is_super_admin(auth.uid()));

CREATE POLICY "Admins can manage branding in their tenant"
ON public.branding_settings FOR ALL
USING (
  (tenant_id = get_user_tenant_id(auth.uid()) AND has_role(auth.uid(), 'admin'))
  OR is_super_admin(auth.uid())
);

-- Update triggers
CREATE TRIGGER update_team_invitations_updated_at
BEFORE UPDATE ON public.team_invitations
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_branding_settings_updated_at
BEFORE UPDATE ON public.branding_settings
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();