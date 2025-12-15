-- Add new columns to clients table for enhanced client overview
ALTER TABLE public.clients 
ADD COLUMN IF NOT EXISTS company_size TEXT,
ADD COLUMN IF NOT EXISTS billing_terms TEXT,
ADD COLUMN IF NOT EXISTS default_recruiter_id UUID REFERENCES auth.users(id),
ADD COLUMN IF NOT EXISTS preferred_communication TEXT DEFAULT 'email',
ADD COLUMN IF NOT EXISTS linkedin_url TEXT,
ADD COLUMN IF NOT EXISTS headquarters TEXT,
ADD COLUMN IF NOT EXISTS address_line1 TEXT,
ADD COLUMN IF NOT EXISTS address_line2 TEXT,
ADD COLUMN IF NOT EXISTS city TEXT,
ADD COLUMN IF NOT EXISTS state TEXT,
ADD COLUMN IF NOT EXISTS postal_code TEXT,
ADD COLUMN IF NOT EXISTS country TEXT,
ADD COLUMN IF NOT EXISTS tags JSONB DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS custom_fields JSONB DEFAULT '{}'::jsonb,
ADD COLUMN IF NOT EXISTS total_revenue NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS last_contact_at TIMESTAMPTZ;

-- Create client_attachments table
CREATE TABLE IF NOT EXISTS public.client_attachments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id),
  file_name TEXT NOT NULL,
  file_url TEXT NOT NULL,
  file_type TEXT, -- contract, nda, jd, other
  file_size INTEGER,
  uploaded_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Create client_activities table for timeline
CREATE TABLE IF NOT EXISTS public.client_activities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id),
  activity_type TEXT NOT NULL, -- note, email, call, meeting, placement
  description TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Create import_jobs table for tracking CSV imports
CREATE TABLE IF NOT EXISTS public.import_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id),
  import_type TEXT NOT NULL, -- clients, candidates, jobs
  status TEXT DEFAULT 'pending', -- pending, processing, completed, failed
  file_url TEXT,
  total_rows INTEGER DEFAULT 0,
  processed_rows INTEGER DEFAULT 0,
  success_count INTEGER DEFAULT 0,
  error_count INTEGER DEFAULT 0,
  mapping_config JSONB DEFAULT '{}'::jsonb,
  duplicate_policy TEXT DEFAULT 'skip', -- skip, overwrite, merge, create_suffix
  error_report_url TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  completed_at TIMESTAMPTZ
);

-- Create client_emails table for email tracking (similar to candidate_emails)
CREATE TABLE IF NOT EXISTS public.client_emails (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id),
  from_email TEXT NOT NULL,
  to_email TEXT NOT NULL,
  subject TEXT NOT NULL,
  body_text TEXT NOT NULL,
  status TEXT DEFAULT 'sent',
  direction TEXT DEFAULT 'outbound',
  sent_at TIMESTAMPTZ,
  scheduled_at TIMESTAMPTZ,
  timezone TEXT DEFAULT 'UTC',
  from_account_id UUID REFERENCES public.email_accounts(id),
  template_id UUID REFERENCES public.user_email_templates(id),
  attachments JSONB DEFAULT '[]'::jsonb,
  metadata JSONB DEFAULT '{}'::jsonb,
  error_message TEXT,
  sent_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS on new tables
ALTER TABLE public.client_attachments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.client_activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.import_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.client_emails ENABLE ROW LEVEL SECURITY;

-- RLS policies for client_attachments
CREATE POLICY "Users can view attachments in their tenant" ON public.client_attachments
  FOR SELECT USING (tenant_id = get_user_tenant_id(auth.uid()) OR is_super_admin(auth.uid()));

CREATE POLICY "Users can manage attachments in their tenant" ON public.client_attachments
  FOR ALL USING (tenant_id = get_user_tenant_id(auth.uid()) OR is_super_admin(auth.uid()));

-- RLS policies for client_activities
CREATE POLICY "Users can view activities in their tenant" ON public.client_activities
  FOR SELECT USING (tenant_id = get_user_tenant_id(auth.uid()) OR is_super_admin(auth.uid()));

CREATE POLICY "Users can manage activities in their tenant" ON public.client_activities
  FOR ALL USING (tenant_id = get_user_tenant_id(auth.uid()) OR is_super_admin(auth.uid()));

-- RLS policies for import_jobs
CREATE POLICY "Users can view import jobs in their tenant" ON public.import_jobs
  FOR SELECT USING (tenant_id = get_user_tenant_id(auth.uid()) OR is_super_admin(auth.uid()));

CREATE POLICY "Users can manage import jobs in their tenant" ON public.import_jobs
  FOR ALL USING (tenant_id = get_user_tenant_id(auth.uid()) OR is_super_admin(auth.uid()));

-- RLS policies for client_emails
CREATE POLICY "Users can view client emails in their tenant" ON public.client_emails
  FOR SELECT USING (tenant_id = get_user_tenant_id(auth.uid()) OR is_super_admin(auth.uid()));

CREATE POLICY "Users can manage client emails in their tenant" ON public.client_emails
  FOR ALL USING (tenant_id = get_user_tenant_id(auth.uid()) OR is_super_admin(auth.uid()));

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_client_attachments_client_id ON public.client_attachments(client_id);
CREATE INDEX IF NOT EXISTS idx_client_activities_client_id ON public.client_activities(client_id);
CREATE INDEX IF NOT EXISTS idx_client_activities_created_at ON public.client_activities(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_import_jobs_tenant_id ON public.import_jobs(tenant_id);
CREATE INDEX IF NOT EXISTS idx_client_emails_client_id ON public.client_emails(client_id);

-- Trigger for updated_at on client_emails
CREATE TRIGGER update_client_emails_updated_at
  BEFORE UPDATE ON public.client_emails
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();