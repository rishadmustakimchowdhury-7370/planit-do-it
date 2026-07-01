
-- Atomic check-and-reserve for server-side metering.
-- Respects platform_settings.enforce_plan_limits toggle so existing tenants keep working.

CREATE OR REPLACE FUNCTION public.check_and_reserve_feature_usage(
  _tenant_id uuid,
  _feature_key text,
  _amount integer DEFAULT 1,
  _user_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
  v_enforce boolean := false;
  v_entitlement jsonb;
  v_enabled boolean;
  v_unlimited boolean;
  v_limit integer;
  v_usage integer;
  v_new_used integer;
  v_period_start timestamptz := date_trunc('month', now());
  v_period_end   timestamptz := (date_trunc('month', now()) + interval '1 month');
  v_amount integer := GREATEST(1, COALESCE(_amount, 1));
BEGIN
  IF _tenant_id IS NULL OR _feature_key IS NULL THEN
    RAISE EXCEPTION 'FEATURE_LIMIT_EXCEEDED: tenant_id and feature_key required';
  END IF;

  -- Read enforcement toggle (default off = current production behaviour)
  BEGIN
    SELECT COALESCE((value)::boolean, false) INTO v_enforce
    FROM public.platform_settings WHERE key='enforce_plan_limits';
  EXCEPTION WHEN OTHERS THEN v_enforce := false;
  END;

  v_entitlement := public.get_tenant_feature(_tenant_id, _feature_key);

  IF v_enforce THEN
    IF v_entitlement IS NULL THEN
      INSERT INTO public.subscription_usage_log(tenant_id, user_id, feature_key, delta, action, metadata)
      VALUES (_tenant_id, COALESCE(_user_id, auth.uid()), _feature_key, v_amount, 'blocked',
              jsonb_build_object('reason','no_entitlement'));
      RAISE EXCEPTION 'FEATURE_LIMIT_EXCEEDED:%:{"feature_key":"%","current_usage":0,"allowed_usage":0,"remaining":0,"upgrade_required":true}',
        _feature_key, _feature_key;
    END IF;

    v_enabled   := COALESCE((v_entitlement->>'enabled')::boolean, false);
    v_unlimited := COALESCE((v_entitlement->>'unlimited')::boolean, false);
    v_limit     := NULLIF(v_entitlement->>'limit','')::integer;
    v_usage     := COALESCE(NULLIF(v_entitlement->>'usage','')::integer, 0);

    IF NOT v_enabled THEN
      INSERT INTO public.subscription_usage_log(tenant_id, user_id, feature_key, delta, action, metadata)
      VALUES (_tenant_id, COALESCE(_user_id, auth.uid()), _feature_key, v_amount, 'blocked',
              jsonb_build_object('reason','disabled'));
      RAISE EXCEPTION 'FEATURE_LIMIT_EXCEEDED:%:{"feature_key":"%","current_usage":%,"allowed_usage":0,"remaining":0,"upgrade_required":true}',
        _feature_key, _feature_key, v_usage;
    END IF;

    IF NOT v_unlimited AND v_limit IS NOT NULL AND (v_usage + v_amount) > v_limit THEN
      INSERT INTO public.subscription_usage_log(tenant_id, user_id, feature_key, delta, action, metadata)
      VALUES (_tenant_id, COALESCE(_user_id, auth.uid()), _feature_key, v_amount, 'blocked',
              jsonb_build_object('reason','limit','usage',v_usage,'limit',v_limit));
      RAISE EXCEPTION 'FEATURE_LIMIT_EXCEEDED:%:{"feature_key":"%","current_usage":%,"allowed_usage":%,"remaining":%,"upgrade_required":true}',
        _feature_key, _feature_key, v_usage, v_limit, GREATEST(0, v_limit - v_usage);
    END IF;
  END IF;

  -- Atomic reservation: increment counter now, caller refunds if action fails.
  INSERT INTO public.subscription_usage_counters
    (tenant_id, feature_key, period_start, period_end, used, created_at, updated_at)
  VALUES (_tenant_id, _feature_key, v_period_start, v_period_end, v_amount, now(), now())
  ON CONFLICT (tenant_id, feature_key, period_start)
  DO UPDATE SET used = LEAST(2147483000, public.subscription_usage_counters.used + EXCLUDED.used),
                updated_at = now()
  RETURNING used INTO v_new_used;

  INSERT INTO public.subscription_usage_log(tenant_id, user_id, feature_key, delta, action, metadata)
  VALUES (_tenant_id, COALESCE(_user_id, auth.uid()), _feature_key, v_amount, 'reserved',
          jsonb_build_object('enforced', v_enforce, 'new_used', v_new_used));

  RETURN jsonb_build_object(
    'allowed', true,
    'enforced', v_enforce,
    'feature_key', _feature_key,
    'current_usage', v_new_used,
    'allowed_usage', COALESCE(v_limit, -1),
    'remaining', CASE WHEN v_unlimited OR v_limit IS NULL THEN -1
                      ELSE GREATEST(0, v_limit - v_new_used) END,
    'entitlement', v_entitlement
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.check_and_reserve_feature_usage(uuid, text, integer, uuid) TO authenticated, service_role;

-- Refund on failure. Never goes below zero.
CREATE OR REPLACE FUNCTION public.refund_feature_usage(
  _tenant_id uuid,
  _feature_key text,
  _amount integer DEFAULT 1,
  _user_id uuid DEFAULT NULL,
  _reason text DEFAULT 'action_failed'
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
  v_period_start timestamptz := date_trunc('month', now());
  v_new_used integer;
  v_amount integer := GREATEST(1, COALESCE(_amount, 1));
BEGIN
  IF _tenant_id IS NULL OR _feature_key IS NULL THEN RETURN 0; END IF;

  UPDATE public.subscription_usage_counters
     SET used = GREATEST(0, used - v_amount), updated_at = now()
   WHERE tenant_id = _tenant_id
     AND feature_key = _feature_key
     AND period_start = v_period_start
  RETURNING used INTO v_new_used;

  INSERT INTO public.subscription_usage_log(tenant_id, user_id, feature_key, delta, action, metadata)
  VALUES (_tenant_id, COALESCE(_user_id, auth.uid()), _feature_key, -v_amount, 'refunded',
          jsonb_build_object('reason', _reason, 'new_used', COALESCE(v_new_used,0)));

  RETURN COALESCE(v_new_used, 0);
END;
$$;

GRANT EXECUTE ON FUNCTION public.refund_feature_usage(uuid, text, integer, uuid, text) TO authenticated, service_role;
