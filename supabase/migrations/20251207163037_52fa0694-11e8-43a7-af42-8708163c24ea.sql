-- ============================================
-- RECRUITSY CRM - COMPLETE DATABASE SCHEMA
-- ============================================

-- 1. ENUMS
-- ============================================
CREATE TYPE public.app_role AS ENUM ('super_admin', 'admin', 'recruiter', 'support', 'viewer');
CREATE TYPE public.subscription_status AS ENUM ('trial', 'active', 'past_due', 'canceled', 'suspended');
CREATE TYPE public.job_status AS ENUM ('draft', 'open', 'paused', 'closed', 'filled');
CREATE TYPE public.candidate_status AS ENUM ('new', 'screening', 'interviewing', 'offered', 'hired', 'rejected', 'withdrawn');
CREATE TYPE public.pipeline_stage AS ENUM ('applied', 'screening', 'interview', 'technical', 'offer', 'hired', 'rejected');
CREATE TYPE public.chat_status AS ENUM ('pending', 'active', 'resolved', 'escalated');
CREATE TYPE public.invoice_status AS ENUM ('draft', 'sent', 'paid', 'overdue', 'canceled');

-- 2. TENANTS (Multi-tenant support)
-- ============================================
CREATE TABLE public.tenants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  logo_url TEXT,
  favicon_url TEXT,
  primary_color TEXT DEFAULT '#0ea5e9',
  subscription_status subscription_status DEFAULT 'trial',
  subscription_plan_id UUID,
  subscription_ends_at TIMESTAMPTZ,
  match_credits_remaining INTEGER DEFAULT 100,
  match_credits_limit INTEGER DEFAULT 100,
  is_suspended BOOLEAN DEFAULT false,
  suspended_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 3. PROFILES (User profiles linked to auth.users)
-- ============================================
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  tenant_id UUID REFERENCES public.tenants(id) ON DELETE SET NULL,
  email TEXT NOT NULL,
  full_name TEXT,
  avatar_url TEXT,
  phone TEXT,
  job_title TEXT,
  is_active BOOLEAN DEFAULT true,
  last_login_at TIMESTAMPTZ,
  must_reset_password BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 4. USER ROLES (Separate table for RBAC)
-- ============================================
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL,
  tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, role, tenant_id)
);

-- 5. SUBSCRIPTION PLANS
-- ============================================
CREATE TABLE public.subscription_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  description TEXT,
  price_monthly DECIMAL(10,2) NOT NULL,
  price_yearly DECIMAL(10,2) NOT NULL,
  match_credits_monthly INTEGER DEFAULT 100,
  max_jobs INTEGER DEFAULT 10,
  max_candidates INTEGER DEFAULT 100,
  max_users INTEGER DEFAULT 3,
  features JSONB DEFAULT '[]',
  is_active BOOLEAN DEFAULT true,
  stripe_price_id_monthly TEXT,
  stripe_price_id_yearly TEXT,
  display_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 6. CLIENTS
-- ============================================
CREATE TABLE public.clients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  industry TEXT,
  website TEXT,
  logo_url TEXT,
  contact_name TEXT,
  contact_email TEXT,
  contact_phone TEXT,
  address TEXT,
  notes TEXT,
  is_active BOOLEAN DEFAULT true,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 7. JOBS
-- ============================================
CREATE TABLE public.jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE NOT NULL,
  client_id UUID REFERENCES public.clients(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  description TEXT,
  requirements TEXT,
  location TEXT,
  salary_min DECIMAL(12,2),
  salary_max DECIMAL(12,2),
  salary_currency TEXT DEFAULT 'USD',
  employment_type TEXT DEFAULT 'full-time',
  experience_level TEXT,
  skills JSONB DEFAULT '[]',
  status job_status DEFAULT 'draft',
  jd_file_url TEXT,
  jd_parsed_text TEXT,
  is_remote BOOLEAN DEFAULT false,
  openings INTEGER DEFAULT 1,
  assigned_to UUID REFERENCES auth.users(id),
  created_by UUID REFERENCES auth.users(id),
  published_at TIMESTAMPTZ,
  closes_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 8. CANDIDATES
-- ============================================
CREATE TABLE public.candidates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE NOT NULL,
  email TEXT NOT NULL,
  full_name TEXT NOT NULL,
  phone TEXT,
  location TEXT,
  current_title TEXT,
  current_company TEXT,
  linkedin_url TEXT,
  linkedin_data JSONB,
  avatar_url TEXT,
  cv_file_url TEXT,
  cv_parsed_data JSONB,
  skills JSONB DEFAULT '[]',
  experience_years INTEGER,
  education JSONB DEFAULT '[]',
  work_history JSONB DEFAULT '[]',
  summary TEXT,
  tags JSONB DEFAULT '[]',
  source TEXT,
  status candidate_status DEFAULT 'new',
  notes TEXT,
  private_notes TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(tenant_id, email)
);

-- 9. JOB CANDIDATES (Pipeline tracking)
-- ============================================
CREATE TABLE public.job_candidates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE NOT NULL,
  job_id UUID REFERENCES public.jobs(id) ON DELETE CASCADE NOT NULL,
  candidate_id UUID REFERENCES public.candidates(id) ON DELETE CASCADE NOT NULL,
  stage pipeline_stage DEFAULT 'applied',
  match_score INTEGER,
  match_explanation TEXT,
  match_strengths JSONB DEFAULT '[]',
  match_gaps JSONB DEFAULT '[]',
  match_confidence DECIMAL(5,2),
  matched_at TIMESTAMPTZ,
  notes TEXT,
  rejection_reason TEXT,
  applied_at TIMESTAMPTZ DEFAULT now(),
  stage_updated_at TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(job_id, candidate_id)
);

-- 10. AI USAGE TRACKING
-- ============================================
CREATE TABLE public.ai_usage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  action_type TEXT NOT NULL,
  job_id UUID REFERENCES public.jobs(id) ON DELETE SET NULL,
  candidate_id UUID REFERENCES public.candidates(id) ON DELETE SET NULL,
  credits_used INTEGER DEFAULT 1,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 11. ACTIVITIES
-- ============================================
CREATE TABLE public.activities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id UUID,
  entity_name TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 12. INVOICES
-- ============================================
CREATE TABLE public.invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE NOT NULL,
  invoice_number TEXT UNIQUE NOT NULL,
  stripe_invoice_id TEXT,
  amount DECIMAL(12,2) NOT NULL,
  currency TEXT DEFAULT 'USD',
  status invoice_status DEFAULT 'draft',
  pdf_url TEXT,
  line_items JSONB DEFAULT '[]',
  notes TEXT,
  due_date DATE,
  paid_at TIMESTAMPTZ,
  sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 13. SCHEDULED ACTIONS
-- ============================================
CREATE TABLE public.scheduled_actions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE,
  action_type TEXT NOT NULL,
  payload JSONB DEFAULT '{}',
  scheduled_for TIMESTAMPTZ NOT NULL,
  executed_at TIMESTAMPTZ,
  status TEXT DEFAULT 'pending',
  result JSONB,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 14. CHAT CONVERSATIONS
-- ============================================
CREATE TABLE public.chat_conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE,
  visitor_id TEXT,
  visitor_name TEXT,
  visitor_email TEXT,
  assigned_to UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  status chat_status DEFAULT 'pending',
  is_bot_handled BOOLEAN DEFAULT true,
  metadata JSONB DEFAULT '{}',
  started_at TIMESTAMPTZ DEFAULT now(),
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 15. CHAT MESSAGES
-- ============================================
CREATE TABLE public.chat_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID REFERENCES public.chat_conversations(id) ON DELETE CASCADE NOT NULL,
  sender_type TEXT NOT NULL,
  sender_id UUID,
  message TEXT NOT NULL,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 16. CMS PAGES (Owner page builder)
-- ============================================
CREATE TABLE public.cms_pages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT UNIQUE NOT NULL,
  title TEXT NOT NULL,
  content JSONB DEFAULT '{}',
  meta_title TEXT,
  meta_description TEXT,
  is_published BOOLEAN DEFAULT false,
  published_at TIMESTAMPTZ,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 17. PLATFORM SETTINGS
-- ============================================
CREATE TABLE public.platform_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key TEXT UNIQUE NOT NULL,
  value JSONB NOT NULL,
  description TEXT,
  updated_by UUID REFERENCES auth.users(id),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 18. CHATBOT CONFIG
-- ============================================
CREATE TABLE public.chatbot_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE,
  greeting_message TEXT DEFAULT 'Hello! How can I help you today?',
  fallback_message TEXT DEFAULT 'I''m not sure I understand. Let me connect you with a human.',
  faq_flows JSONB DEFAULT '[]',
  is_active BOOLEAN DEFAULT true,
  escalate_after_failures INTEGER DEFAULT 3,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 19. SUPPORT TICKETS
-- ============================================
CREATE TABLE public.support_tickets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE,
  conversation_id UUID REFERENCES public.chat_conversations(id) ON DELETE SET NULL,
  subject TEXT NOT NULL,
  description TEXT,
  priority TEXT DEFAULT 'medium',
  status TEXT DEFAULT 'open',
  assigned_to UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_by UUID REFERENCES auth.users(id),
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 20. USER INVITES
-- ============================================
CREATE TABLE public.user_invites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  role app_role NOT NULL,
  invited_by UUID REFERENCES auth.users(id),
  token TEXT UNIQUE NOT NULL DEFAULT gen_random_uuid()::text,
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '7 days'),
  accepted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 21. AUDIT LOG
-- ============================================
CREATE TABLE public.audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  tenant_id UUID REFERENCES public.tenants(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  entity_type TEXT,
  entity_id UUID,
  old_values JSONB,
  new_values JSONB,
  ip_address TEXT,
  user_agent TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================
-- INDEXES
-- ============================================
CREATE INDEX idx_profiles_tenant ON public.profiles(tenant_id);
CREATE INDEX idx_user_roles_user ON public.user_roles(user_id);
CREATE INDEX idx_user_roles_tenant ON public.user_roles(tenant_id);
CREATE INDEX idx_clients_tenant ON public.clients(tenant_id);
CREATE INDEX idx_jobs_tenant ON public.jobs(tenant_id);
CREATE INDEX idx_jobs_status ON public.jobs(status);
CREATE INDEX idx_candidates_tenant ON public.candidates(tenant_id);
CREATE INDEX idx_candidates_email ON public.candidates(email);
CREATE INDEX idx_job_candidates_job ON public.job_candidates(job_id);
CREATE INDEX idx_job_candidates_candidate ON public.job_candidates(candidate_id);
CREATE INDEX idx_activities_tenant ON public.activities(tenant_id);
CREATE INDEX idx_activities_created ON public.activities(created_at DESC);
CREATE INDEX idx_invoices_tenant ON public.invoices(tenant_id);
CREATE INDEX idx_chat_conversations_tenant ON public.chat_conversations(tenant_id);
CREATE INDEX idx_chat_messages_conversation ON public.chat_messages(conversation_id);
CREATE INDEX idx_scheduled_actions_scheduled ON public.scheduled_actions(scheduled_for);

-- ============================================
-- FUNCTIONS
-- ============================================

-- Security definer function for role checking
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
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
      AND role = _role
  )
$$;

-- Get user's tenant
CREATE OR REPLACE FUNCTION public.get_user_tenant_id(_user_id uuid)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT tenant_id FROM public.profiles WHERE id = _user_id
$$;

-- Check if user is super admin
CREATE OR REPLACE FUNCTION public.is_super_admin(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = 'super_admin'
  )
$$;

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Handle new user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_tenant_id uuid;
BEGIN
  -- Create a default tenant for the user if none exists
  INSERT INTO public.tenants (name, slug)
  VALUES (
    COALESCE(NEW.raw_user_meta_data ->> 'full_name', split_part(NEW.email, '@', 1)) || '''s Workspace',
    gen_random_uuid()::text
  )
  RETURNING id INTO v_tenant_id;
  
  -- Create profile
  INSERT INTO public.profiles (id, email, full_name, tenant_id)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data ->> 'full_name', split_part(NEW.email, '@', 1)),
    v_tenant_id
  );
  
  -- Assign admin role for their tenant
  INSERT INTO public.user_roles (user_id, role, tenant_id)
  VALUES (NEW.id, 'admin', v_tenant_id);
  
  RETURN NEW;
END;
$$;

-- Generate invoice number
CREATE OR REPLACE FUNCTION public.generate_invoice_number()
RETURNS TEXT
LANGUAGE plpgsql
AS $$
DECLARE
  v_year TEXT;
  v_count INTEGER;
BEGIN
  v_year := to_char(now(), 'YYYY');
  SELECT COUNT(*) + 1 INTO v_count FROM public.invoices WHERE invoice_number LIKE 'INV-' || v_year || '-%';
  RETURN 'INV-' || v_year || '-' || LPAD(v_count::TEXT, 5, '0');
END;
$$;

-- ============================================
-- TRIGGERS
-- ============================================

-- Updated at triggers
CREATE TRIGGER update_tenants_updated_at BEFORE UPDATE ON public.tenants FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_clients_updated_at BEFORE UPDATE ON public.clients FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_jobs_updated_at BEFORE UPDATE ON public.jobs FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_candidates_updated_at BEFORE UPDATE ON public.candidates FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_job_candidates_updated_at BEFORE UPDATE ON public.job_candidates FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_invoices_updated_at BEFORE UPDATE ON public.invoices FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_chat_conversations_updated_at BEFORE UPDATE ON public.chat_conversations FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_cms_pages_updated_at BEFORE UPDATE ON public.cms_pages FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_support_tickets_updated_at BEFORE UPDATE ON public.support_tickets FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- New user trigger
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============================================
-- ROW LEVEL SECURITY
-- ============================================

ALTER TABLE public.tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscription_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.candidates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.job_candidates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_usage ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scheduled_actions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cms_pages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.platform_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chatbot_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.support_tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_invites ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;

-- ============================================
-- RLS POLICIES
-- ============================================

-- TENANTS
CREATE POLICY "Users can view their own tenant" ON public.tenants FOR SELECT USING (
  id = public.get_user_tenant_id(auth.uid()) OR public.is_super_admin(auth.uid())
);
CREATE POLICY "Super admins can manage all tenants" ON public.tenants FOR ALL USING (public.is_super_admin(auth.uid()));

-- PROFILES
CREATE POLICY "Users can view profiles in their tenant" ON public.profiles FOR SELECT USING (
  tenant_id = public.get_user_tenant_id(auth.uid()) OR public.is_super_admin(auth.uid()) OR id = auth.uid()
);
CREATE POLICY "Users can update their own profile" ON public.profiles FOR UPDATE USING (id = auth.uid());
CREATE POLICY "Super admins can manage all profiles" ON public.profiles FOR ALL USING (public.is_super_admin(auth.uid()));

-- USER ROLES
CREATE POLICY "Users can view roles in their tenant" ON public.user_roles FOR SELECT USING (
  tenant_id = public.get_user_tenant_id(auth.uid()) OR public.is_super_admin(auth.uid()) OR user_id = auth.uid()
);
CREATE POLICY "Super admins can manage all roles" ON public.user_roles FOR ALL USING (public.is_super_admin(auth.uid()));

-- SUBSCRIPTION PLANS (publicly readable)
CREATE POLICY "Anyone can view active plans" ON public.subscription_plans FOR SELECT USING (is_active = true);
CREATE POLICY "Super admins can manage plans" ON public.subscription_plans FOR ALL USING (public.is_super_admin(auth.uid()));

-- CLIENTS
CREATE POLICY "Users can view clients in their tenant" ON public.clients FOR SELECT USING (
  tenant_id = public.get_user_tenant_id(auth.uid()) OR public.is_super_admin(auth.uid())
);
CREATE POLICY "Users can manage clients in their tenant" ON public.clients FOR ALL USING (
  tenant_id = public.get_user_tenant_id(auth.uid()) OR public.is_super_admin(auth.uid())
);

-- JOBS
CREATE POLICY "Users can view jobs in their tenant" ON public.jobs FOR SELECT USING (
  tenant_id = public.get_user_tenant_id(auth.uid()) OR public.is_super_admin(auth.uid())
);
CREATE POLICY "Users can manage jobs in their tenant" ON public.jobs FOR ALL USING (
  tenant_id = public.get_user_tenant_id(auth.uid()) OR public.is_super_admin(auth.uid())
);

-- CANDIDATES
CREATE POLICY "Users can view candidates in their tenant" ON public.candidates FOR SELECT USING (
  tenant_id = public.get_user_tenant_id(auth.uid()) OR public.is_super_admin(auth.uid())
);
CREATE POLICY "Users can manage candidates in their tenant" ON public.candidates FOR ALL USING (
  tenant_id = public.get_user_tenant_id(auth.uid()) OR public.is_super_admin(auth.uid())
);

-- JOB CANDIDATES
CREATE POLICY "Users can view job candidates in their tenant" ON public.job_candidates FOR SELECT USING (
  tenant_id = public.get_user_tenant_id(auth.uid()) OR public.is_super_admin(auth.uid())
);
CREATE POLICY "Users can manage job candidates in their tenant" ON public.job_candidates FOR ALL USING (
  tenant_id = public.get_user_tenant_id(auth.uid()) OR public.is_super_admin(auth.uid())
);

-- AI USAGE
CREATE POLICY "Users can view ai usage in their tenant" ON public.ai_usage FOR SELECT USING (
  tenant_id = public.get_user_tenant_id(auth.uid()) OR public.is_super_admin(auth.uid())
);
CREATE POLICY "Users can insert ai usage" ON public.ai_usage FOR INSERT WITH CHECK (
  tenant_id = public.get_user_tenant_id(auth.uid())
);

-- ACTIVITIES
CREATE POLICY "Users can view activities in their tenant" ON public.activities FOR SELECT USING (
  tenant_id = public.get_user_tenant_id(auth.uid()) OR public.is_super_admin(auth.uid())
);
CREATE POLICY "Users can insert activities" ON public.activities FOR INSERT WITH CHECK (
  tenant_id = public.get_user_tenant_id(auth.uid())
);

-- INVOICES
CREATE POLICY "Users can view invoices in their tenant" ON public.invoices FOR SELECT USING (
  tenant_id = public.get_user_tenant_id(auth.uid()) OR public.is_super_admin(auth.uid())
);
CREATE POLICY "Super admins can manage invoices" ON public.invoices FOR ALL USING (public.is_super_admin(auth.uid()));

-- SCHEDULED ACTIONS
CREATE POLICY "Super admins can manage scheduled actions" ON public.scheduled_actions FOR ALL USING (public.is_super_admin(auth.uid()));

-- CHAT CONVERSATIONS
CREATE POLICY "Users can view chats in their tenant or support staff" ON public.chat_conversations FOR SELECT USING (
  tenant_id = public.get_user_tenant_id(auth.uid()) OR public.is_super_admin(auth.uid()) OR 
  assigned_to = auth.uid() OR public.has_role(auth.uid(), 'support')
);
CREATE POLICY "Support can manage chats" ON public.chat_conversations FOR ALL USING (
  public.is_super_admin(auth.uid()) OR public.has_role(auth.uid(), 'support')
);

-- CHAT MESSAGES
CREATE POLICY "Users can view messages for accessible conversations" ON public.chat_messages FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM public.chat_conversations c
    WHERE c.id = conversation_id AND (
      c.tenant_id = public.get_user_tenant_id(auth.uid()) OR 
      public.is_super_admin(auth.uid()) OR
      c.assigned_to = auth.uid()
    )
  )
);
CREATE POLICY "Users can insert messages" ON public.chat_messages FOR INSERT WITH CHECK (true);

-- CMS PAGES
CREATE POLICY "Anyone can view published pages" ON public.cms_pages FOR SELECT USING (is_published = true OR public.is_super_admin(auth.uid()));
CREATE POLICY "Super admins can manage pages" ON public.cms_pages FOR ALL USING (public.is_super_admin(auth.uid()));

-- PLATFORM SETTINGS
CREATE POLICY "Anyone can view settings" ON public.platform_settings FOR SELECT USING (true);
CREATE POLICY "Super admins can manage settings" ON public.platform_settings FOR ALL USING (public.is_super_admin(auth.uid()));

-- CHATBOT CONFIG
CREATE POLICY "Users can view chatbot config" ON public.chatbot_config FOR SELECT USING (
  tenant_id = public.get_user_tenant_id(auth.uid()) OR public.is_super_admin(auth.uid()) OR tenant_id IS NULL
);
CREATE POLICY "Super admins can manage chatbot config" ON public.chatbot_config FOR ALL USING (public.is_super_admin(auth.uid()));

-- SUPPORT TICKETS
CREATE POLICY "Users can view tickets in their tenant" ON public.support_tickets FOR SELECT USING (
  tenant_id = public.get_user_tenant_id(auth.uid()) OR public.is_super_admin(auth.uid()) OR
  assigned_to = auth.uid() OR public.has_role(auth.uid(), 'support')
);
CREATE POLICY "Support can manage tickets" ON public.support_tickets FOR ALL USING (
  public.is_super_admin(auth.uid()) OR public.has_role(auth.uid(), 'support')
);

-- USER INVITES
CREATE POLICY "Users can view invites in their tenant" ON public.user_invites FOR SELECT USING (
  tenant_id = public.get_user_tenant_id(auth.uid()) OR public.is_super_admin(auth.uid())
);
CREATE POLICY "Admins can manage invites" ON public.user_invites FOR ALL USING (
  public.has_role(auth.uid(), 'admin') OR public.is_super_admin(auth.uid())
);

-- AUDIT LOG
CREATE POLICY "Super admins can view audit log" ON public.audit_log FOR SELECT USING (public.is_super_admin(auth.uid()));
CREATE POLICY "System can insert audit log" ON public.audit_log FOR INSERT WITH CHECK (true);

-- ============================================
-- SEED DATA
-- ============================================

-- Insert default subscription plans
INSERT INTO public.subscription_plans (name, slug, description, price_monthly, price_yearly, match_credits_monthly, max_jobs, max_candidates, max_users, features, display_order)
VALUES 
  ('Starter', 'starter', 'Perfect for small teams getting started', 9.00, 90.00, 50, 5, 50, 2, 
   '["5 Active Jobs", "50 Candidates", "50 AI Matches/month", "Email Support", "Basic Analytics"]', 1),
  ('Pro', 'pro', 'For growing recruitment teams', 29.00, 290.00, 200, 25, 500, 5, 
   '["25 Active Jobs", "500 Candidates", "200 AI Matches/month", "Priority Support", "Advanced Analytics", "API Access", "Custom Branding"]', 2),
  ('Agency', 'agency', 'For agencies and large teams', 79.00, 790.00, 1000, -1, -1, -1, 
   '["Unlimited Jobs", "Unlimited Candidates", "1000 AI Matches/month", "24/7 Support", "Full Analytics", "API Access", "White Label", "Dedicated Account Manager"]', 3);

-- Insert default platform settings
INSERT INTO public.platform_settings (key, value, description)
VALUES 
  ('site_name', '"Recruitsy"', 'Platform name'),
  ('site_logo', '"/logo.svg"', 'Main logo URL'),
  ('site_favicon', '"/favicon.ico"', 'Favicon URL'),
  ('primary_color', '"#0ea5e9"', 'Primary brand color'),
  ('social_links', '{"facebook": "", "linkedin": "", "twitter": "", "instagram": "", "pinterest": ""}', 'Social media links'),
  ('contact_email', '"support@recruitsy.com"', 'Support email'),
  ('footer_text', '"© 2024 Recruitsy. All rights reserved."', 'Footer copyright text');

-- Insert default chatbot config
INSERT INTO public.chatbot_config (greeting_message, fallback_message, faq_flows, is_active)
VALUES (
  'Hi there! 👋 I''m the Recruitsy assistant. How can I help you today?',
  'I''m not sure I understand. Let me connect you with a human support agent.',
  '[{"trigger": "pricing", "response": "We have three plans: Starter ($9/mo), Pro ($29/mo), and Agency ($79/mo). Would you like more details?"}, {"trigger": "demo", "response": "I''d be happy to help you schedule a demo! Please leave your email and our team will reach out."}]',
  true
);