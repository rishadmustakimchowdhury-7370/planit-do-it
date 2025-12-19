-- =====================================================
-- CV SUBMISSIONS TABLE (Track who submitted CV to which job)
-- =====================================================
CREATE TABLE IF NOT EXISTS public.cv_submissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  candidate_id UUID NOT NULL REFERENCES public.candidates(id) ON DELETE CASCADE,
  job_id UUID NOT NULL REFERENCES public.jobs(id) ON DELETE CASCADE,
  submitted_by UUID NOT NULL,
  submitted_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(candidate_id, job_id)
);

-- Enable RLS
ALTER TABLE public.cv_submissions ENABLE ROW LEVEL SECURITY;

-- RLS Policies for cv_submissions
CREATE POLICY "Users can view submissions in their tenant"
ON public.cv_submissions FOR SELECT
USING (tenant_id = get_user_tenant_id(auth.uid()) OR is_super_admin(auth.uid()));

CREATE POLICY "Users can insert submissions in their tenant"
ON public.cv_submissions FOR INSERT
WITH CHECK (tenant_id = get_user_tenant_id(auth.uid()));

-- Index for performance
CREATE INDEX idx_cv_submissions_tenant ON public.cv_submissions(tenant_id);
CREATE INDEX idx_cv_submissions_candidate ON public.cv_submissions(candidate_id);
CREATE INDEX idx_cv_submissions_job ON public.cv_submissions(job_id);

-- =====================================================
-- WORK SESSION STATUS ENUM
-- =====================================================
DO $$ BEGIN
  CREATE TYPE work_status AS ENUM ('working', 'on_break', 'ended');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- =====================================================
-- WORK STATUS LOGS TABLE (Immutable audit log)
-- =====================================================
CREATE TABLE IF NOT EXISTS public.work_status_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  action TEXT NOT NULL CHECK (action IN ('start_work', 'start_break', 'resume_work', 'end_work')),
  timestamp TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.work_status_logs ENABLE ROW LEVEL SECURITY;

-- RLS Policies - Users can only insert, never delete or update
CREATE POLICY "Users can view work logs in their tenant"
ON public.work_status_logs FOR SELECT
USING (
  (user_id = auth.uid()) OR 
  (tenant_id = get_user_tenant_id(auth.uid()) AND (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'manager'))) OR 
  is_super_admin(auth.uid())
);

CREATE POLICY "Users can insert their own work logs"
ON public.work_status_logs FOR INSERT
WITH CHECK (
  user_id = auth.uid() AND 
  tenant_id = get_user_tenant_id(auth.uid())
);

-- NO UPDATE OR DELETE POLICIES - Immutable audit log

-- Indexes
CREATE INDEX idx_work_status_logs_tenant ON public.work_status_logs(tenant_id);
CREATE INDEX idx_work_status_logs_user ON public.work_status_logs(user_id);
CREATE INDEX idx_work_status_logs_timestamp ON public.work_status_logs(timestamp);

-- =====================================================
-- WORK SESSIONS TABLE (Calculated from logs)
-- =====================================================
CREATE TABLE IF NOT EXISTS public.work_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  started_at TIMESTAMP WITH TIME ZONE,
  ended_at TIMESTAMP WITH TIME ZONE,
  total_work_minutes INTEGER DEFAULT 0,
  total_break_minutes INTEGER DEFAULT 0,
  status work_status DEFAULT 'ended',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(user_id, date)
);

-- Enable RLS
ALTER TABLE public.work_sessions ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view sessions in their tenant"
ON public.work_sessions FOR SELECT
USING (
  (user_id = auth.uid()) OR 
  (tenant_id = get_user_tenant_id(auth.uid()) AND (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'manager'))) OR 
  is_super_admin(auth.uid())
);

CREATE POLICY "Users can manage their own sessions"
ON public.work_sessions FOR ALL
USING (user_id = auth.uid() AND tenant_id = get_user_tenant_id(auth.uid()))
WITH CHECK (user_id = auth.uid() AND tenant_id = get_user_tenant_id(auth.uid()));

-- Indexes
CREATE INDEX idx_work_sessions_tenant ON public.work_sessions(tenant_id);
CREATE INDEX idx_work_sessions_user ON public.work_sessions(user_id);
CREATE INDEX idx_work_sessions_date ON public.work_sessions(date);

-- =====================================================
-- TENANT WORK SETTINGS TABLE (Auto-end cutoff time per tenant)
-- =====================================================
CREATE TABLE IF NOT EXISTS public.tenant_work_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL UNIQUE REFERENCES public.tenants(id) ON DELETE CASCADE,
  auto_end_time TIME DEFAULT '23:59:00',
  timezone TEXT DEFAULT 'UTC',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.tenant_work_settings ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view their tenant work settings"
ON public.tenant_work_settings FOR SELECT
USING (tenant_id = get_user_tenant_id(auth.uid()) OR is_super_admin(auth.uid()));

CREATE POLICY "Admins can manage tenant work settings"
ON public.tenant_work_settings FOR ALL
USING (
  (tenant_id = get_user_tenant_id(auth.uid()) AND has_role(auth.uid(), 'admin')) OR 
  is_super_admin(auth.uid())
)
WITH CHECK (
  (tenant_id = get_user_tenant_id(auth.uid()) AND has_role(auth.uid(), 'admin')) OR 
  is_super_admin(auth.uid())
);

-- Trigger for updated_at
CREATE TRIGGER update_work_sessions_updated_at
BEFORE UPDATE ON public.work_sessions
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_tenant_work_settings_updated_at
BEFORE UPDATE ON public.tenant_work_settings
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();