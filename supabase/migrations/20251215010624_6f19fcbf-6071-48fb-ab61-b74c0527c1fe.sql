-- Email Accounts table (Gmail OAuth + SMTP credentials)
CREATE TABLE public.email_accounts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  provider TEXT NOT NULL CHECK (provider IN ('gmail', 'smtp')),
  display_name TEXT NOT NULL,
  from_email TEXT NOT NULL,
  -- OAuth tokens (encrypted at app level)
  oauth_refresh_token TEXT,
  oauth_access_token TEXT,
  oauth_expires_at TIMESTAMP WITH TIME ZONE,
  -- SMTP credentials
  smtp_host TEXT,
  smtp_port INTEGER,
  smtp_user TEXT,
  smtp_password TEXT,
  smtp_use_tls BOOLEAN DEFAULT true,
  -- Status
  status TEXT NOT NULL DEFAULT 'connected' CHECK (status IN ('connected', 'needs_reauth', 'error')),
  is_default BOOLEAN DEFAULT false,
  last_sync_at TIMESTAMP WITH TIME ZONE,
  error_message TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- User Email Templates (user-specific, not admin templates)
CREATE TABLE public.user_email_templates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  subject TEXT NOT NULL,
  body_text TEXT NOT NULL,
  default_from_account_id UUID REFERENCES public.email_accounts(id) ON DELETE SET NULL,
  tags TEXT[] DEFAULT '{}',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Candidate Email Messages
CREATE TABLE public.candidate_emails (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  candidate_id UUID NOT NULL REFERENCES public.candidates(id) ON DELETE CASCADE,
  job_id UUID REFERENCES public.jobs(id) ON DELETE SET NULL,
  from_account_id UUID REFERENCES public.email_accounts(id) ON DELETE SET NULL,
  sent_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  thread_id TEXT,
  provider_message_id TEXT,
  direction TEXT NOT NULL DEFAULT 'outbound' CHECK (direction IN ('inbound', 'outbound')),
  from_email TEXT NOT NULL,
  to_email TEXT NOT NULL,
  subject TEXT NOT NULL,
  body_text TEXT NOT NULL,
  attachments JSONB DEFAULT '[]',
  template_id UUID REFERENCES public.user_email_templates(id) ON DELETE SET NULL,
  ai_generated BOOLEAN DEFAULT false,
  status TEXT NOT NULL DEFAULT 'sent' CHECK (status IN ('draft', 'scheduled', 'sending', 'sent', 'failed', 'delivered', 'opened', 'bounced')),
  scheduled_at TIMESTAMP WITH TIME ZONE,
  sent_at TIMESTAMP WITH TIME ZONE,
  error_message TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Indexes for performance
CREATE INDEX idx_email_accounts_user ON public.email_accounts(user_id);
CREATE INDEX idx_email_accounts_tenant ON public.email_accounts(tenant_id);
CREATE INDEX idx_user_email_templates_user ON public.user_email_templates(user_id);
CREATE INDEX idx_user_email_templates_tenant ON public.user_email_templates(tenant_id);
CREATE INDEX idx_candidate_emails_candidate ON public.candidate_emails(candidate_id);
CREATE INDEX idx_candidate_emails_tenant ON public.candidate_emails(tenant_id);
CREATE INDEX idx_candidate_emails_thread ON public.candidate_emails(thread_id);
CREATE INDEX idx_candidate_emails_sent_at ON public.candidate_emails(sent_at DESC);

-- Enable RLS
ALTER TABLE public.email_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_email_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.candidate_emails ENABLE ROW LEVEL SECURITY;

-- RLS Policies for email_accounts
CREATE POLICY "Users can manage their own email accounts"
  ON public.email_accounts FOR ALL
  USING (user_id = auth.uid() OR is_super_admin(auth.uid()));

CREATE POLICY "Users can view email accounts in their tenant"
  ON public.email_accounts FOR SELECT
  USING (tenant_id = get_user_tenant_id(auth.uid()) OR is_super_admin(auth.uid()));

-- RLS Policies for user_email_templates
CREATE POLICY "Users can manage their own templates"
  ON public.user_email_templates FOR ALL
  USING (user_id = auth.uid() OR is_super_admin(auth.uid()));

CREATE POLICY "Users can view templates in their tenant"
  ON public.user_email_templates FOR SELECT
  USING (tenant_id = get_user_tenant_id(auth.uid()) OR is_super_admin(auth.uid()));

-- RLS Policies for candidate_emails
CREATE POLICY "Users can manage emails in their tenant"
  ON public.candidate_emails FOR ALL
  USING (tenant_id = get_user_tenant_id(auth.uid()) OR is_super_admin(auth.uid()));

CREATE POLICY "Users can view emails in their tenant"
  ON public.candidate_emails FOR SELECT
  USING (tenant_id = get_user_tenant_id(auth.uid()) OR is_super_admin(auth.uid()));

-- Trigger for updated_at
CREATE TRIGGER update_email_accounts_updated_at
  BEFORE UPDATE ON public.email_accounts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_user_email_templates_updated_at
  BEFORE UPDATE ON public.user_email_templates
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_candidate_emails_updated_at
  BEFORE UPDATE ON public.candidate_emails
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();