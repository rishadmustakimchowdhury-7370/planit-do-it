CREATE TABLE IF NOT EXISTS public._rc_lifecycle_probe (
  id serial PRIMARY KEY,
  ran_at timestamptz NOT NULL DEFAULT now(),
  step text NOT NULL,
  correlation_id uuid,
  result jsonb
);
GRANT SELECT ON public._rc_lifecycle_probe TO authenticated, anon, service_role;

DO $$
DECLARE
  v_tenant uuid := 'aa000000-0000-4000-8000-000000000001'::uuid;
  v_qa_owner uuid;
  v_plan uuid;
  v_feature_id uuid;
  v_res jsonb;
  v_probe_key text := 'rc_probe_feature';
BEGIN
  SELECT id INTO v_qa_owner FROM public.profiles WHERE tenant_id = v_tenant ORDER BY created_at LIMIT 1;
  SELECT subscription_plan_id INTO v_plan FROM public.tenants WHERE id = v_tenant;

  INSERT INTO public.subscription_features(feature_key, feature_name, description, category)
  VALUES (v_probe_key, 'RC Probe Feature', 'Temporary lifecycle probe', 'internal')
  ON CONFLICT (feature_key) DO UPDATE SET description = EXCLUDED.description
  RETURNING id INTO v_feature_id;

  INSERT INTO public.subscription_plan_features(plan_id, feature_id, enabled, limit_value)
  VALUES (v_plan, v_feature_id, true, 1)
  ON CONFLICT (plan_id, feature_id) DO UPDATE SET enabled = true, limit_value = 1;

  DELETE FROM public.subscription_usage_counters WHERE tenant_id = v_tenant AND feature_key = v_probe_key;

  PERFORM set_config('request.jwt.claims',
    json_build_object('sub', v_qa_owner::text, 'role','authenticated')::text, true);
  PERFORM set_config('role','authenticated', true);

  v_res := public.check_and_reserve_feature_usage(v_tenant, v_probe_key, 1, v_qa_owner);
  PERFORM set_config('role','postgres', true);
  INSERT INTO public._rc_lifecycle_probe(step, correlation_id, result)
  VALUES ('reserve', NULLIF(v_res->>'correlation_id','')::uuid, v_res);

  PERFORM set_config('role','authenticated', true);
  v_res := public.commit_feature_usage(v_tenant, v_probe_key, 1, v_qa_owner);
  PERFORM set_config('role','postgres', true);
  INSERT INTO public._rc_lifecycle_probe(step, result) VALUES ('commit', v_res);

  PERFORM set_config('role','authenticated', true);
  v_res := public.check_and_reserve_feature_usage(v_tenant, v_probe_key, 1, v_qa_owner);
  PERFORM set_config('role','postgres', true);
  INSERT INTO public._rc_lifecycle_probe(step, correlation_id, result)
  VALUES ('reserve_before_refund', NULLIF(v_res->>'correlation_id','')::uuid, v_res);

  PERFORM set_config('role','authenticated', true);
  v_res := jsonb_build_object('refund_returned',
    public.refund_feature_usage(v_tenant, v_probe_key, 1, v_qa_owner, 'rc_probe'));
  PERFORM set_config('role','postgres', true);
  INSERT INTO public._rc_lifecycle_probe(step, result) VALUES ('refund', v_res);

  PERFORM set_config('role','authenticated', true);
  v_res := public.check_and_reserve_feature_usage(v_tenant, v_probe_key, 1, v_qa_owner);
  PERFORM set_config('role','postgres', true);
  INSERT INTO public._rc_lifecycle_probe(step, correlation_id, result)
  VALUES ('blocked', NULLIF(v_res->>'correlation_id','')::uuid, v_res);

  DELETE FROM public.subscription_plan_features WHERE plan_id = v_plan AND feature_id = v_feature_id;
  DELETE FROM public.subscription_usage_counters WHERE tenant_id = v_tenant AND feature_key = v_probe_key;
  DELETE FROM public.subscription_features WHERE feature_key = v_probe_key;
END $$;