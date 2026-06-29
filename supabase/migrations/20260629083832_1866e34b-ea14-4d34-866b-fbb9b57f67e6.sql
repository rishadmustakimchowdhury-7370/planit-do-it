
ALTER TABLE public.subscription_plans
  ADD COLUMN IF NOT EXISTS trial_days       integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS is_featured      boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS cta_label        text    NOT NULL DEFAULT 'Get started',
  ADD COLUMN IF NOT EXISTS currency         text    NOT NULL DEFAULT 'USD',
  ADD COLUMN IF NOT EXISTS stripe_product_id text,
  ADD COLUMN IF NOT EXISTS show_on_pricing  boolean NOT NULL DEFAULT true;

ALTER TABLE public.subscription_features
  ADD COLUMN IF NOT EXISTS unit                 text,
  ADD COLUMN IF NOT EXISTS show_on_pricing_page boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS is_addon             boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS is_metered           boolean NOT NULL DEFAULT false;

ALTER TABLE public.subscription_plan_features
  ADD COLUMN IF NOT EXISTS unlimited     boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS monthly_reset boolean NOT NULL DEFAULT true;

CREATE UNIQUE INDEX IF NOT EXISTS subscription_plan_features_unique
  ON public.subscription_plan_features(plan_id, feature_id);

CREATE TABLE IF NOT EXISTS public.subscription_usage_counters (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id    uuid NOT NULL,
  feature_key  text NOT NULL,
  period_start timestamptz NOT NULL,
  period_end   timestamptz NOT NULL,
  used         integer NOT NULL DEFAULT 0,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS sub_usage_counters_unique
  ON public.subscription_usage_counters(tenant_id, feature_key, period_start);
CREATE INDEX IF NOT EXISTS sub_usage_counters_tenant_idx
  ON public.subscription_usage_counters(tenant_id);

GRANT SELECT ON public.subscription_usage_counters TO authenticated;
GRANT ALL    ON public.subscription_usage_counters TO service_role;

ALTER TABLE public.subscription_usage_counters ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "tenant members read usage" ON public.subscription_usage_counters;
CREATE POLICY "tenant members read usage"
  ON public.subscription_usage_counters
  FOR SELECT TO authenticated
  USING (public.user_belongs_to_tenant(auth.uid(), tenant_id));

CREATE OR REPLACE FUNCTION public.current_billing_period(_tenant_id uuid)
RETURNS TABLE(period_start timestamptz, period_end timestamptz)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT date_trunc('month', now()),
         (date_trunc('month', now()) + interval '1 month')
$$;

CREATE OR REPLACE FUNCTION public.increment_feature_usage(
  _tenant_id uuid, _feature_key text, _amount integer DEFAULT 1
) RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_start timestamptz; v_end timestamptz; v_used integer;
BEGIN
  SELECT period_start, period_end INTO v_start, v_end FROM public.current_billing_period(_tenant_id);
  INSERT INTO public.subscription_usage_counters(tenant_id, feature_key, period_start, period_end, used)
  VALUES (_tenant_id, _feature_key, v_start, v_end, GREATEST(_amount, 0))
  ON CONFLICT (tenant_id, feature_key, period_start)
  DO UPDATE SET used = public.subscription_usage_counters.used + EXCLUDED.used, updated_at = now()
  RETURNING used INTO v_used;
  RETURN v_used;
END;$$;

REVOKE ALL ON FUNCTION public.increment_feature_usage(uuid,text,integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.increment_feature_usage(uuid,text,integer) TO service_role;

CREATE OR REPLACE FUNCTION public.get_feature_usage(_tenant_id uuid, _feature_key text)
RETURNS integer LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT COALESCE((
    SELECT used FROM public.subscription_usage_counters c, public.current_billing_period(_tenant_id) p
    WHERE c.tenant_id = _tenant_id AND c.feature_key = _feature_key AND c.period_start = p.period_start
    LIMIT 1
  ), 0)
$$;
GRANT EXECUTE ON FUNCTION public.get_feature_usage(uuid,text) TO authenticated, service_role;

UPDATE public.subscription_plans SET is_active = false WHERE slug = 'basic';
UPDATE public.subscription_plans SET name='Enterprise', slug='enterprise' WHERE slug='agency';

UPDATE public.subscription_plans SET
  price_monthly=25, price_yearly=250, trial_days=7,
  description='Best for solo recruiters', cta_label='Start free trial',
  display_order=1, is_featured=false, currency='USD'
WHERE slug='starter';

UPDATE public.subscription_plans SET
  name='Professional',
  price_monthly=49, price_yearly=490, trial_days=7,
  description='For growing recruitment teams', cta_label='Start free trial',
  display_order=2, is_featured=true, currency='USD'
WHERE slug='pro';

UPDATE public.subscription_plans SET
  price_monthly=99, price_yearly=990, trial_days=7,
  description='For high-volume agencies and in-house teams',
  cta_label='Contact sales',
  display_order=3, is_featured=false, currency='USD'
WHERE slug='enterprise';

WITH feats(feature_key, feature_name, category, unit, is_metered, sort_order) AS (
  VALUES
    ('users','Users','limits','users',true,10),
    ('candidates','Candidates','limits','records',true,11),
    ('clients','Clients','limits','records',true,12),
    ('active_jobs','Jobs','limits','jobs',true,13),
    ('storage_gb','Storage','limits','GB',true,14),
    ('ai_candidate_discovery','AI Candidate Discovery','ai','searches/month',true,20),
    ('ai_prospect_search','AI Prospect Search','ai','searches/month',true,21),
    ('ai_matching','AI Candidate Matching','ai','runs/month',true,22),
    ('open_web_discovery','Open Web Discovery','ai','searches/month',true,23),
    ('resume_parsing','Resume Parsing','ai','resumes/month',true,24),
    ('executive_assessment','AI Executive Assessment','ai','reports/month',true,25),
    ('ai_email_generation','AI Email Generation','ai','emails/month',true,26),
    ('candidate_crm','Candidate CRM','core',NULL,false,30),
    ('client_crm','Client CRM','core',NULL,false,31),
    ('jobs_module','Jobs','core',NULL,false,32),
    ('pipeline','Pipeline','core',NULL,false,33),
    ('placements','Placements','core',NULL,false,34),
    ('finance','Finance','core',NULL,false,35),
    ('invoices','Invoices','core',NULL,false,36),
    ('reports','Reports','core',NULL,false,37),
    ('calendar','Calendar','core',NULL,false,38),
    ('email_integration','Email Integration','core',NULL,false,39),
    ('csv_import','CSV Import','core',NULL,false,40),
    ('csv_export','CSV Export','core',NULL,false,41),
    ('chrome_extension','Chrome Extension','core',NULL,false,42),
    ('team_dashboard','Team Dashboard','team',NULL,false,50),
    ('recruiter_bonuses','Recruiter Bonuses','team',NULL,false,51),
    ('work_tracking','Work Tracking','team',NULL,false,52),
    ('advanced_reports','Advanced Reports','team',NULL,false,53),
    ('bulk_import','Bulk Import','team',NULL,false,54),
    ('bulk_export','Bulk Export','team',NULL,false,55),
    ('api_access','API Access','enterprise',NULL,false,60),
    ('white_label','White Label','enterprise',NULL,false,61),
    ('custom_branding','Custom Branding','enterprise',NULL,false,62),
    ('audit_logs','Audit Logs','enterprise',NULL,false,63),
    ('advanced_permissions','Advanced Permissions','enterprise',NULL,false,64),
    ('priority_support','Priority Support','enterprise',NULL,false,65)
)
INSERT INTO public.subscription_features (feature_key, feature_name, category, sort_order, unit, is_metered, show_on_pricing_page)
SELECT feature_key, feature_name, category, sort_order, unit, is_metered, true FROM feats
ON CONFLICT (feature_key) DO UPDATE
SET feature_name=EXCLUDED.feature_name, category=EXCLUDED.category, sort_order=EXCLUDED.sort_order,
    unit=EXCLUDED.unit, is_metered=EXCLUDED.is_metered, updated_at=now();

CREATE OR REPLACE FUNCTION public._seed_plan_feature(
  _plan_slug text, _feature_key text, _enabled boolean, _limit integer, _unlimited boolean DEFAULT false
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_plan uuid; v_feat uuid;
BEGIN
  SELECT id INTO v_plan FROM public.subscription_plans WHERE slug=_plan_slug;
  SELECT id INTO v_feat FROM public.subscription_features WHERE feature_key=_feature_key;
  IF v_plan IS NULL OR v_feat IS NULL THEN RETURN; END IF;
  INSERT INTO public.subscription_plan_features(plan_id,feature_id,enabled,limit_value,unlimited)
  VALUES (v_plan,v_feat,_enabled,_limit,_unlimited)
  ON CONFLICT (plan_id,feature_id) DO UPDATE
  SET enabled=EXCLUDED.enabled, limit_value=EXCLUDED.limit_value, unlimited=EXCLUDED.unlimited, updated_at=now();
END;$$;

SELECT public._seed_plan_feature('starter','users',true,1,false);
SELECT public._seed_plan_feature('starter','candidates',true,1000,false);
SELECT public._seed_plan_feature('starter','clients',true,100,false);
SELECT public._seed_plan_feature('starter','active_jobs',true,50,false);
SELECT public._seed_plan_feature('starter','storage_gb',true,10,false);
SELECT public._seed_plan_feature('starter','ai_candidate_discovery',true,50,false);
SELECT public._seed_plan_feature('starter','ai_prospect_search',true,50,false);
SELECT public._seed_plan_feature('starter','ai_matching',true,500,false);
SELECT public._seed_plan_feature('starter','open_web_discovery',true,100,false);
SELECT public._seed_plan_feature('starter','resume_parsing',true,300,false);
SELECT public._seed_plan_feature('starter','executive_assessment',true,100,false);
SELECT public._seed_plan_feature('starter','ai_email_generation',true,300,false);
SELECT public._seed_plan_feature('starter',k,true,NULL,false) FROM unnest(ARRAY['candidate_crm','client_crm','jobs_module','pipeline','placements','finance','invoices','reports','calendar','email_integration','csv_import','csv_export','chrome_extension']) k;
SELECT public._seed_plan_feature('starter',k,false,NULL,false) FROM unnest(ARRAY['team_dashboard','recruiter_bonuses','work_tracking','advanced_reports','bulk_import','bulk_export','api_access','white_label','custom_branding','audit_logs','advanced_permissions','priority_support']) k;

SELECT public._seed_plan_feature('pro','users',true,5,false);
SELECT public._seed_plan_feature('pro','candidates',true,10000,false);
SELECT public._seed_plan_feature('pro','clients',true,1000,false);
SELECT public._seed_plan_feature('pro','active_jobs',true,NULL,true);
SELECT public._seed_plan_feature('pro','storage_gb',true,50,false);
SELECT public._seed_plan_feature('pro','ai_candidate_discovery',true,300,false);
SELECT public._seed_plan_feature('pro','ai_prospect_search',true,300,false);
SELECT public._seed_plan_feature('pro','ai_matching',true,5000,false);
SELECT public._seed_plan_feature('pro','open_web_discovery',true,500,false);
SELECT public._seed_plan_feature('pro','resume_parsing',true,3000,false);
SELECT public._seed_plan_feature('pro','executive_assessment',true,1000,false);
SELECT public._seed_plan_feature('pro','ai_email_generation',true,3000,false);
SELECT public._seed_plan_feature('pro',k,true,NULL,false) FROM unnest(ARRAY['candidate_crm','client_crm','jobs_module','pipeline','placements','finance','invoices','reports','calendar','email_integration','csv_import','csv_export','chrome_extension','team_dashboard','recruiter_bonuses','work_tracking','advanced_reports','bulk_import','bulk_export']) k;
SELECT public._seed_plan_feature('pro',k,false,NULL,false) FROM unnest(ARRAY['api_access','white_label','custom_branding','audit_logs','advanced_permissions','priority_support']) k;

SELECT public._seed_plan_feature('enterprise','users',true,20,false);
SELECT public._seed_plan_feature('enterprise','candidates',true,NULL,true);
SELECT public._seed_plan_feature('enterprise','clients',true,NULL,true);
SELECT public._seed_plan_feature('enterprise','active_jobs',true,NULL,true);
SELECT public._seed_plan_feature('enterprise','storage_gb',true,250,false);
SELECT public._seed_plan_feature('enterprise','ai_candidate_discovery',true,1000,false);
SELECT public._seed_plan_feature('enterprise','ai_prospect_search',true,1000,false);
SELECT public._seed_plan_feature('enterprise','ai_matching',true,NULL,true);
SELECT public._seed_plan_feature('enterprise','open_web_discovery',true,2000,false);
SELECT public._seed_plan_feature('enterprise','resume_parsing',true,NULL,true);
SELECT public._seed_plan_feature('enterprise','executive_assessment',true,NULL,true);
SELECT public._seed_plan_feature('enterprise','ai_email_generation',true,NULL,true);
SELECT public._seed_plan_feature('enterprise',k,true,NULL,false) FROM unnest(ARRAY['candidate_crm','client_crm','jobs_module','pipeline','placements','finance','invoices','reports','calendar','email_integration','csv_import','csv_export','chrome_extension','team_dashboard','recruiter_bonuses','work_tracking','advanced_reports','bulk_import','bulk_export','api_access','white_label','custom_branding','audit_logs','advanced_permissions','priority_support']) k;
