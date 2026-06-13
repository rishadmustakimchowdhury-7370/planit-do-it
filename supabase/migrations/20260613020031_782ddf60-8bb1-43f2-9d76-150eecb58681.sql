
-- Phase 1: Feature catalog
CREATE TABLE public.subscription_features (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  feature_key text NOT NULL UNIQUE,
  feature_name text NOT NULL,
  description text,
  category text,
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.subscription_features TO anon, authenticated;
GRANT ALL ON public.subscription_features TO service_role;
ALTER TABLE public.subscription_features ENABLE ROW LEVEL SECURITY;
CREATE POLICY "features readable to all" ON public.subscription_features FOR SELECT USING (true);
CREATE POLICY "super admin manages features" ON public.subscription_features FOR ALL TO authenticated
  USING (public.is_super_admin(auth.uid())) WITH CHECK (public.is_super_admin(auth.uid()));
CREATE TRIGGER trg_subscription_features_updated_at BEFORE UPDATE ON public.subscription_features
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Phase 2: Plan ↔ Feature mapping
CREATE TABLE public.subscription_plan_features (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id uuid NOT NULL REFERENCES public.subscription_plans(id) ON DELETE CASCADE,
  feature_id uuid NOT NULL REFERENCES public.subscription_features(id) ON DELETE CASCADE,
  enabled boolean NOT NULL DEFAULT false,
  limit_value int, -- NULL = unlimited
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (plan_id, feature_id)
);
GRANT SELECT ON public.subscription_plan_features TO anon, authenticated;
GRANT ALL ON public.subscription_plan_features TO service_role;
ALTER TABLE public.subscription_plan_features ENABLE ROW LEVEL SECURITY;
CREATE POLICY "plan features readable to all" ON public.subscription_plan_features FOR SELECT USING (true);
CREATE POLICY "super admin manages plan features" ON public.subscription_plan_features FOR ALL TO authenticated
  USING (public.is_super_admin(auth.uid())) WITH CHECK (public.is_super_admin(auth.uid()));
CREATE TRIGGER trg_subscription_plan_features_updated_at BEFORE UPDATE ON public.subscription_plan_features
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Seed features
INSERT INTO public.subscription_features (feature_key, feature_name, description, category, sort_order) VALUES
  ('core_crm','Core CRM','Jobs, candidates and clients management','core',10),
  ('ai_match','AI Match','AI-powered candidate-to-job matching','ai',20),
  ('client_reports','Client Reports','Generate shareable client-facing reports','clients',30),
  ('client_pipeline','Client Pipeline','Client portal with shared pipeline view','clients',40),
  ('placement_tracking','Placement Tracking','Track placements and outcomes','placements',50),
  ('invoice_management','Invoice Management','Create and send invoices','finance',60),
  ('finance_dashboard','Finance Dashboard','MRR, revenue and cashflow analytics','finance',70),
  ('recruiter_bonus_tracking','Recruiter Bonus Tracking','Bonus calculation and payout tracking','finance',80),
  ('custom_branding','Custom Branding','Custom logos, colors and email templates','branding',90),
  ('api_access','API Access','Programmatic API access','integrations',100),
  ('priority_support','Priority Support','Faster response time on support','support',110),
  ('email_templates','Email Templates','Reusable email templates','communication',120),
  ('advanced_analytics','Advanced Analytics','Team KPI and forecasting dashboards','analytics',130),
  -- Numeric limit features
  ('active_jobs','Active Jobs','Maximum number of active jobs','limits',200),
  ('candidates','Candidates','Maximum number of candidates','limits',210),
  ('team_members','Team Members','Maximum number of team members','limits',220),
  ('ai_matches_monthly','AI Matches / month','Monthly AI match quota','limits',230);

-- Seed plan_features for starter / pro / agency (limit_value NULL = unlimited; -1 also treated unlimited)
DO $$
DECLARE
  starter uuid; pro uuid; agency uuid;
BEGIN
  SELECT id INTO starter FROM public.subscription_plans WHERE slug='starter';
  SELECT id INTO pro     FROM public.subscription_plans WHERE slug='pro';
  SELECT id INTO agency  FROM public.subscription_plans WHERE slug='agency';

  -- helper inserts
  INSERT INTO public.subscription_plan_features (plan_id, feature_id, enabled, limit_value)
  SELECT p.plan_id, f.id, p.enabled, p.lim
  FROM public.subscription_features f
  JOIN (VALUES
    -- (plan, feature_key, enabled, limit_value)
    (starter,'core_crm',true,NULL::int),
    (starter,'ai_match',true,NULL),
    (starter,'client_reports',true,NULL),
    (starter,'client_pipeline',false,NULL),
    (starter,'placement_tracking',true,NULL),
    (starter,'invoice_management',false,NULL),
    (starter,'finance_dashboard',false,NULL),
    (starter,'recruiter_bonus_tracking',false,NULL),
    (starter,'custom_branding',false,NULL),
    (starter,'api_access',false,NULL),
    (starter,'priority_support',false,NULL),
    (starter,'email_templates',true,NULL),
    (starter,'advanced_analytics',false,NULL),
    (starter,'active_jobs',true,10),
    (starter,'candidates',true,150),
    (starter,'team_members',true,2),
    (starter,'ai_matches_monthly',true,50),

    (pro,'core_crm',true,NULL),
    (pro,'ai_match',true,NULL),
    (pro,'client_reports',true,NULL),
    (pro,'client_pipeline',true,NULL),
    (pro,'placement_tracking',true,NULL),
    (pro,'invoice_management',true,NULL),
    (pro,'finance_dashboard',true,NULL),
    (pro,'recruiter_bonus_tracking',true,NULL),
    (pro,'custom_branding',true,NULL),
    (pro,'api_access',false,NULL),
    (pro,'priority_support',false,NULL),
    (pro,'email_templates',true,NULL),
    (pro,'advanced_analytics',true,NULL),
    (pro,'active_jobs',true,25),
    (pro,'candidates',true,500),
    (pro,'team_members',true,5),
    (pro,'ai_matches_monthly',true,200),

    (agency,'core_crm',true,NULL),
    (agency,'ai_match',true,NULL),
    (agency,'client_reports',true,NULL),
    (agency,'client_pipeline',true,NULL),
    (agency,'placement_tracking',true,NULL),
    (agency,'invoice_management',true,NULL),
    (agency,'finance_dashboard',true,NULL),
    (agency,'recruiter_bonus_tracking',true,NULL),
    (agency,'custom_branding',true,NULL),
    (agency,'api_access',true,NULL),
    (agency,'priority_support',true,NULL),
    (agency,'email_templates',true,NULL),
    (agency,'advanced_analytics',true,NULL),
    (agency,'active_jobs',true,NULL),
    (agency,'candidates',true,NULL),
    (agency,'team_members',true,NULL),
    (agency,'ai_matches_monthly',true,1000)
  ) AS p(plan_id, feature_key, enabled, lim) ON p.feature_key = f.feature_key
  ON CONFLICT (plan_id, feature_id) DO NOTHING;
END $$;

-- Phase 7: tenant entitlement helper
CREATE OR REPLACE FUNCTION public.get_tenant_feature(_tenant_id uuid, _feature_key text)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_plan_id uuid;
  v_enabled boolean := false;
  v_limit int;
  v_usage int := 0;
  v_remaining int;
  v_month_start timestamptz := date_trunc('month', now());
BEGIN
  -- AuthZ: caller must be in tenant or super admin
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;
  IF NOT (public.user_belongs_to_tenant(auth.uid(), _tenant_id) OR public.is_super_admin(auth.uid())) THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;

  SELECT subscription_plan_id INTO v_plan_id FROM public.tenants WHERE id = _tenant_id;

  SELECT spf.enabled, spf.limit_value
    INTO v_enabled, v_limit
  FROM public.subscription_plan_features spf
  JOIN public.subscription_features f ON f.id = spf.feature_id
  WHERE spf.plan_id = v_plan_id AND f.feature_key = _feature_key;

  -- Compute usage for tracked counters
  IF _feature_key = 'active_jobs' THEN
    SELECT COUNT(*) INTO v_usage FROM public.jobs
      WHERE tenant_id = _tenant_id AND status IN ('open','draft');
  ELSIF _feature_key = 'candidates' THEN
    SELECT COUNT(*) INTO v_usage FROM public.candidates WHERE tenant_id = _tenant_id;
  ELSIF _feature_key = 'team_members' THEN
    SELECT COUNT(*) INTO v_usage FROM public.profiles
      WHERE tenant_id = _tenant_id AND is_active = true AND deleted_at IS NULL;
  ELSIF _feature_key = 'ai_matches_monthly' THEN
    SELECT COUNT(*) INTO v_usage FROM public.ai_usage
      WHERE tenant_id = _tenant_id AND action_type = 'ai_match' AND created_at >= v_month_start;
  END IF;

  IF v_limit IS NULL OR v_limit < 0 THEN
    v_remaining := -1; -- unlimited
  ELSE
    v_remaining := GREATEST(0, v_limit - v_usage);
  END IF;

  RETURN jsonb_build_object(
    'feature_key', _feature_key,
    'enabled', COALESCE(v_enabled,false),
    'limit', v_limit,
    'usage', v_usage,
    'remaining', v_remaining,
    'unlimited', (v_limit IS NULL OR v_limit < 0)
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_tenant_feature(uuid, text) TO authenticated;
