-- LinkedIn Outreach Campaigns table
CREATE TABLE public.linkedin_outreach_campaigns (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'running', 'paused', 'completed', 'locked')),
  
  -- Outreach settings
  outreach_mode TEXT NOT NULL DEFAULT 'connect_with_note' CHECK (outreach_mode IN ('connect_with_note', 'connect_without_note')),
  message_template_id UUID REFERENCES public.linkedin_message_templates(id) ON DELETE SET NULL,
  custom_message TEXT,
  
  -- Rate limits
  daily_limit INTEGER NOT NULL DEFAULT 20 CHECK (daily_limit >= 1 AND daily_limit <= 35),
  account_type TEXT NOT NULL DEFAULT 'normal' CHECK (account_type IN ('new', 'normal')),
  
  -- Statistics
  total_profiles INTEGER NOT NULL DEFAULT 0,
  visited_today INTEGER NOT NULL DEFAULT 0,
  sent_today INTEGER NOT NULL DEFAULT 0,
  last_reset_date DATE,
  
  -- Timestamps
  started_at TIMESTAMPTZ,
  paused_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  locked_until TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- LinkedIn Outreach Queue table
CREATE TABLE public.linkedin_outreach_queue (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  campaign_id UUID NOT NULL REFERENCES public.linkedin_outreach_campaigns(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  
  -- Profile info
  linkedin_url TEXT NOT NULL,
  candidate_id UUID REFERENCES public.candidates(id) ON DELETE SET NULL,
  first_name TEXT,
  job_title TEXT,
  company TEXT,
  
  -- Status tracking
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'visited', 'connected', 'skipped', 'failed')),
  skip_reason TEXT,
  error_message TEXT,
  
  -- Execution details
  visited_at TIMESTAMPTZ,
  connected_at TIMESTAMPTZ,
  dwell_time_seconds INTEGER,
  connection_sent BOOLEAN DEFAULT false,
  
  -- Timestamps
  position INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  
  UNIQUE(campaign_id, linkedin_url)
);

-- LinkedIn Outreach Daily Logs table
CREATE TABLE public.linkedin_outreach_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  campaign_id UUID NOT NULL REFERENCES public.linkedin_outreach_campaigns(id) ON DELETE CASCADE,
  queue_item_id UUID REFERENCES public.linkedin_outreach_queue(id) ON DELETE SET NULL,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  
  -- Action details
  action TEXT NOT NULL CHECK (action IN ('profile_visit', 'connection_sent', 'skipped', 'error', 'campaign_start', 'campaign_pause', 'campaign_stop', 'limit_reached')),
  details JSONB DEFAULT '{}'::jsonb,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- User Compliance Acknowledgement table
CREATE TABLE public.linkedin_outreach_consent (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  
  acknowledged_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ip_address TEXT,
  user_agent TEXT
);

-- Enable RLS
ALTER TABLE public.linkedin_outreach_campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.linkedin_outreach_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.linkedin_outreach_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.linkedin_outreach_consent ENABLE ROW LEVEL SECURITY;

-- RLS Policies for campaigns
CREATE POLICY "Users can view campaigns in their tenant"
  ON public.linkedin_outreach_campaigns FOR SELECT
  USING (tenant_id = get_user_tenant_id(auth.uid()) OR is_super_admin(auth.uid()));

CREATE POLICY "Users can manage campaigns in their tenant"
  ON public.linkedin_outreach_campaigns FOR ALL
  USING (tenant_id = get_user_tenant_id(auth.uid()) OR is_super_admin(auth.uid()));

-- RLS Policies for queue
CREATE POLICY "Users can view queue items in their tenant"
  ON public.linkedin_outreach_queue FOR SELECT
  USING (tenant_id = get_user_tenant_id(auth.uid()) OR is_super_admin(auth.uid()));

CREATE POLICY "Users can manage queue items in their tenant"
  ON public.linkedin_outreach_queue FOR ALL
  USING (tenant_id = get_user_tenant_id(auth.uid()) OR is_super_admin(auth.uid()));

-- RLS Policies for logs
CREATE POLICY "Users can view logs in their tenant"
  ON public.linkedin_outreach_logs FOR SELECT
  USING (tenant_id = get_user_tenant_id(auth.uid()) OR is_super_admin(auth.uid()));

CREATE POLICY "Users can insert logs in their tenant"
  ON public.linkedin_outreach_logs FOR INSERT
  WITH CHECK (tenant_id = get_user_tenant_id(auth.uid()));

-- RLS Policies for consent
CREATE POLICY "Users can view their own consent"
  ON public.linkedin_outreach_consent FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Users can insert their own consent"
  ON public.linkedin_outreach_consent FOR INSERT
  WITH CHECK (user_id = auth.uid());

-- Indexes for performance
CREATE INDEX idx_linkedin_campaigns_tenant ON public.linkedin_outreach_campaigns(tenant_id);
CREATE INDEX idx_linkedin_campaigns_status ON public.linkedin_outreach_campaigns(status);
CREATE INDEX idx_linkedin_queue_campaign ON public.linkedin_outreach_queue(campaign_id);
CREATE INDEX idx_linkedin_queue_status ON public.linkedin_outreach_queue(status);
CREATE INDEX idx_linkedin_queue_position ON public.linkedin_outreach_queue(campaign_id, position);
CREATE INDEX idx_linkedin_logs_campaign ON public.linkedin_outreach_logs(campaign_id);
CREATE INDEX idx_linkedin_logs_created ON public.linkedin_outreach_logs(created_at DESC);

-- Trigger to update updated_at
CREATE TRIGGER update_linkedin_campaigns_updated_at
  BEFORE UPDATE ON public.linkedin_outreach_campaigns
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_linkedin_queue_updated_at
  BEFORE UPDATE ON public.linkedin_outreach_queue
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();