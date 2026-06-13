
-- Fix Starter price
UPDATE public.subscription_plans SET price_monthly = 19 WHERE slug = 'starter';

-- Upsert feature catalog
INSERT INTO public.subscription_features (feature_key, feature_name, description, category, sort_order) VALUES
  -- Recruitment Core
  ('candidate_crm','Candidate CRM','Manage your candidate database','recruitment_core',10),
  ('resume_database','Resume Database','Centralized resume storage and search','recruitment_core',20),
  ('ai_candidate_matching','AI Candidate Matching','AI-powered matching between candidates and jobs','recruitment_core',30),
  ('job_management','Job Management','Create and manage job openings','recruitment_core',40),
  ('client_management','Client Management','Manage client companies and contacts','recruitment_core',50),
  -- Client Submission
  ('client_submission_reports','Client Submission Reports','Send branded shortlists to clients','client_submission',60),
  ('branded_submission_packs','Branded Submission Packs','Branded PDF / asset packs for clients','client_submission',70),
  ('client_delivery_workspace','Client Delivery Workspace','Workspace for preparing client deliveries','client_submission',80),
  ('client_submission_pipeline','Client Submission Pipeline','Track candidate submissions through pipeline','client_submission',90),
  ('previous_report_history','Previous Report History','Full history of submitted client reports','client_submission',100),
  -- Placement Management
  ('interview_tracking','Interview Tracking','Track interview scheduling and outcomes','placement_management',110),
  ('offer_tracking','Offer Tracking','Track offers extended and accepted','placement_management',120),
  ('placement_tracking','Placement Tracking','Track candidate placements','placement_management',130),
  ('placement_revenue_tracking','Placement Revenue Tracking','Track revenue per placement','placement_management',140),
  -- Team Management
  ('recruiter_performance_dashboard','Recruiter Performance Dashboard','Per-recruiter KPI dashboard','team_management',150),
  ('daily_activity_tracking','Daily Activity Tracking','Automatic activity logging','team_management',160),
  ('work_hour_tracking','Work Hour Tracking','Work session and hours tracking','team_management',170),
  ('team_management','Team Management','Manage team members and roles','team_management',180),
  -- Finance
  ('finance_dashboard','Finance Dashboard','Finance overview dashboard','finance',190),
  ('invoice_management','Invoice Management','Create and manage invoices','finance',200),
  ('invoice_email_delivery','Invoice Email Delivery','Send invoices by email','finance',210),
  ('payment_tracking','Payment Tracking','Record and track payments','finance',220),
  ('recruiter_bonus_tracking','Recruiter Bonus Tracking','Compute and track recruiter bonuses','finance',230),
  ('revenue_analytics','Revenue Analytics','Revenue analytics and reporting','finance',240),
  -- Communication
  ('custom_email_configuration','Custom Email Configuration','Connect SMTP / Gmail accounts','communication',250),
  ('email_templates','Email Templates','Reusable email templates','communication',260),
  ('client_email_tracking','Client Email Tracking','Track emails sent to clients','communication',270),
  -- Analytics / Premium
  ('advanced_analytics','Advanced Analytics','Cross-team analytics and trends','analytics',280),
  ('custom_branding','Custom Branding','Custom logos and colors on deliverables','analytics',290),
  ('api_access','API Access','Programmatic API access','analytics',300),
  ('priority_support','Priority Support','Priority customer support','analytics',310),
  -- Limits
  ('active_jobs','Active Jobs','Number of active jobs','limits',400),
  ('candidates','Candidates','Number of candidates','limits',410),
  ('team_members','Team Members','Number of team members','limits',420),
  ('ai_matches_monthly','AI Matches / Month','Monthly AI match quota','limits',430)
ON CONFLICT (feature_key) DO UPDATE
  SET feature_name = EXCLUDED.feature_name,
      description = EXCLUDED.description,
      category = EXCLUDED.category,
      sort_order = EXCLUDED.sort_order;

-- Helper to upsert plan/feature entitlement
DO $$
DECLARE
  starter UUID; pro UUID; agency UUID;
BEGIN
  SELECT id INTO starter FROM public.subscription_plans WHERE slug='starter';
  SELECT id INTO pro     FROM public.subscription_plans WHERE slug='pro';
  SELECT id INTO agency  FROM public.subscription_plans WHERE slug='agency';

  -- Reset all features for these 3 plans to disabled w/ null limit, then turn on as needed.
  -- We use upsert by (plan_id,feature_id).
  PERFORM 1;

  -- Inline upsert lambda via CTE for each plan
  WITH f AS (SELECT id, feature_key FROM public.subscription_features)
  INSERT INTO public.subscription_plan_features (plan_id, feature_id, enabled, limit_value)
  SELECT starter, f.id,
    f.feature_key = ANY(ARRAY[
      'candidate_crm','resume_database','ai_candidate_matching','job_management','client_management',
      'client_submission_reports','client_submission_pipeline','previous_report_history',
      'interview_tracking','offer_tracking','placement_tracking',
      'recruiter_performance_dashboard','daily_activity_tracking','work_hour_tracking','team_management',
      'custom_email_configuration','email_templates',
      'active_jobs','candidates','team_members','ai_matches_monthly'
    ]),
    CASE f.feature_key
      WHEN 'active_jobs' THEN 10
      WHEN 'candidates' THEN 150
      WHEN 'team_members' THEN 2
      WHEN 'ai_matches_monthly' THEN 50
      ELSE NULL END
  FROM f
  ON CONFLICT (plan_id, feature_id) DO UPDATE
    SET enabled = EXCLUDED.enabled, limit_value = EXCLUDED.limit_value;

  WITH f AS (SELECT id, feature_key FROM public.subscription_features)
  INSERT INTO public.subscription_plan_features (plan_id, feature_id, enabled, limit_value)
  SELECT pro, f.id,
    f.feature_key = ANY(ARRAY[
      'candidate_crm','resume_database','ai_candidate_matching','job_management','client_management',
      'client_submission_reports','branded_submission_packs','client_delivery_workspace','client_submission_pipeline','previous_report_history',
      'interview_tracking','offer_tracking','placement_tracking','placement_revenue_tracking',
      'recruiter_performance_dashboard','daily_activity_tracking','work_hour_tracking','team_management',
      'finance_dashboard','invoice_management','invoice_email_delivery','payment_tracking','recruiter_bonus_tracking','revenue_analytics',
      'custom_email_configuration','email_templates','client_email_tracking',
      'active_jobs','candidates','team_members','ai_matches_monthly'
    ]),
    CASE f.feature_key
      WHEN 'active_jobs' THEN 25
      WHEN 'candidates' THEN 500
      WHEN 'team_members' THEN 5
      WHEN 'ai_matches_monthly' THEN 200
      ELSE NULL END
  FROM f
  ON CONFLICT (plan_id, feature_id) DO UPDATE
    SET enabled = EXCLUDED.enabled, limit_value = EXCLUDED.limit_value;

  WITH f AS (SELECT id, feature_key FROM public.subscription_features)
  INSERT INTO public.subscription_plan_features (plan_id, feature_id, enabled, limit_value)
  SELECT agency, f.id,
    -- Agency has everything enabled
    true,
    CASE f.feature_key
      WHEN 'active_jobs' THEN NULL
      WHEN 'candidates' THEN NULL
      WHEN 'team_members' THEN NULL
      WHEN 'ai_matches_monthly' THEN 1000
      ELSE NULL END
  FROM f
  ON CONFLICT (plan_id, feature_id) DO UPDATE
    SET enabled = EXCLUDED.enabled, limit_value = EXCLUDED.limit_value;
END $$;
