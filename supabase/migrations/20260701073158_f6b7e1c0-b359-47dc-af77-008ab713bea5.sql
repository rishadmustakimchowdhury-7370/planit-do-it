
-- PLANS
ALTER TABLE public.subscription_plans
  ADD COLUMN IF NOT EXISTS yearly_discount_percentage numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS yearly_trial_days integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS badge text,
  ADD COLUMN IF NOT EXISTS button_url text,
  ADD COLUMN IF NOT EXISTS highlighted boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS popular boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS enterprise boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS icon text,
  ADD COLUMN IF NOT EXISTS color text,
  ADD COLUMN IF NOT EXISTS is_archived boolean NOT NULL DEFAULT false;

UPDATE public.subscription_plans SET highlighted = true WHERE is_featured = true AND highlighted = false;
UPDATE public.subscription_plans SET popular = true WHERE slug = 'pro' AND popular = false;

-- FEATURE CATALOG
ALTER TABLE public.subscription_features
  ADD COLUMN IF NOT EXISTS icon text,
  ADD COLUMN IF NOT EXISTS default_limit numeric,
  ADD COLUMN IF NOT EXISTS is_ai boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS is_archived boolean NOT NULL DEFAULT false;

-- PLAN FEATURES
ALTER TABLE public.subscription_plan_features
  ADD COLUMN IF NOT EXISTS monthly_limit numeric,
  ADD COLUMN IF NOT EXISTS yearly_limit numeric,
  ADD COLUMN IF NOT EXISTS display_order integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS custom_label text;

UPDATE public.subscription_plan_features
  SET monthly_limit = limit_value
  WHERE monthly_limit IS NULL AND limit_value IS NOT NULL;

-- SEED CATALOG
INSERT INTO public.subscription_features (feature_key, feature_name, category, sort_order, unit, is_ai)
VALUES
  ('ai_candidate_discovery','AI Candidate Discovery','ai',10,'searches',true),
  ('ai_matching','AI Matching','ai',20,'matches',true),
  ('ai_prospect_search','AI Prospect Search','ai',30,'searches',true),
  ('ai_assessment','AI Executive Assessment','ai',40,'assessments',true),
  ('open_web_search','Open Web Search','ai',50,'searches',true),
  ('resume_parsing','Resume Parsing','ai',60,'CVs',true),
  ('voice_notes','Voice Notes','ai',70,'notes',true),
  ('executive_reports','Executive Reports','ai',80,'reports',true),
  ('candidates','Candidates','limits',110,'records',false),
  ('active_jobs','Jobs','limits',120,'records',false),
  ('clients','Clients','limits',130,'records',false),
  ('submissions','Submissions','limits',140,'records',false),
  ('placements','Placements','limits',150,'records',false),
  ('team_members','Team Members','limits',160,'seats',false),
  ('workspaces','Workspaces','limits',170,'workspaces',false),
  ('storage_gb','Storage','limits',180,'GB',false),
  ('exports','Exports','ops',210,'exports',false),
  ('api_access','API Connections','ops',220,null,false),
  ('apollo_integration','Apollo','integrations',230,null,false),
  ('lusha_integration','Lusha','integrations',240,null,false),
  ('vibe_prospecting','Vibe Prospecting','integrations',250,null,false),
  ('custom_branding','Custom Branding','branding',310,null,false),
  ('priority_support','Priority Support','support',320,null,false),
  ('audit_logs','Audit Logs','ops',330,null,false),
  ('webhooks','Webhooks','ops',340,null,false),
  ('candidate_crm','CRM','core',410,null,false),
  ('finance','Finance','core',420,null,false),
  ('invoices','Invoices','core',430,null,false),
  ('usage_dashboard','Usage Dashboard','core',440,null,false)
ON CONFLICT (feature_key) DO NOTHING;

-- REALTIME
DO $$
BEGIN
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.subscription_plans; EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.subscription_features; EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.subscription_plan_features; EXCEPTION WHEN duplicate_object THEN NULL; END;
END $$;
