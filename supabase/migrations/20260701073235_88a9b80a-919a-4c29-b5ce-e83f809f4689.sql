
CREATE OR REPLACE FUNCTION public.get_public_pricing()
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT jsonb_build_object(
    'plans', COALESCE((
      SELECT jsonb_agg(row_to_json(p) ORDER BY p.sort_order, p.price_monthly)
      FROM (
        SELECT id, name, slug, description, price_monthly, price_yearly,
               yearly_discount_percentage, currency, stripe_price_id_monthly,
               stripe_price_id_yearly, trial_days AS monthly_trial_days,
               yearly_trial_days, badge, cta_label AS button_text, button_url,
               display_order AS sort_order, highlighted, is_active AS active,
               popular, enterprise, icon, color,
               max_jobs, max_candidates, max_users, match_credits_monthly
        FROM public.subscription_plans
        WHERE is_active = true AND is_archived = false AND show_on_pricing = true
      ) p
    ), '[]'::jsonb),
    'features', COALESCE((
      SELECT jsonb_agg(row_to_json(f) ORDER BY f.sort_order)
      FROM (
        SELECT id, category, feature_key, feature_name AS display_name,
               description, icon, default_limit, unit, is_ai, sort_order
        FROM public.subscription_features
        WHERE is_archived = false
      ) f
    ), '[]'::jsonb),
    'plan_features', COALESCE((
      SELECT jsonb_agg(row_to_json(pf))
      FROM (
        SELECT pf.plan_id, pf.feature_id, pf.enabled, pf.unlimited,
               pf.monthly_limit, pf.yearly_limit, pf.display_order, pf.custom_label
        FROM public.subscription_plan_features pf
        JOIN public.subscription_plans p ON p.id = pf.plan_id
        WHERE p.is_active = true AND p.is_archived = false
      ) pf
    ), '[]'::jsonb)
  );
$$;

REVOKE ALL ON FUNCTION public.get_public_pricing() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_public_pricing() TO anon, authenticated;
