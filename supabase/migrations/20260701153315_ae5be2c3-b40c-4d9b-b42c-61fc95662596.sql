-- D7 Fix: Non-raising reservation contract.
-- check_and_reserve_feature_usage returns structured JSONB (allowed:false when blocked)
-- instead of RAISE EXCEPTION. This preserves audit rows in the same transaction:
-- the RPC commits cleanly, so subscription_usage_log + audit_log persist.
-- Callers (edge functions) inspect `allowed` and return HTTP 402.
-- Triggers on tables continue to raise (defense-in-depth) via enforce_feature_limit;
-- app-layer callers pre-check via this RPC so those raises only fire on direct-DB writes.

CREATE OR REPLACE FUNCTION public.check_and_reserve_feature_usage(
  _tenant_id uuid,
  _feature_key text,
  _amount integer DEFAULT 1,
  _user_id uuid DEFAULT NULL::uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_enforce boolean := false;
  v_entitlement jsonb;
  v_enabled boolean;
  v_unlimited boolean;
  v_limit integer;
  v_usage integer;
  v_reserved integer := 0;
  v_new_reserved integer;
  v_period_start timestamptz := date_trunc('month', now());
  v_period_end   timestamptz := (date_trunc('month', now()) + interval '1 month');
  v_amount integer := GREATEST(1, COALESCE(_amount, 1));
  v_uid uuid := COALESCE(_user_id, auth.uid());
  v_correlation uuid := gen_random_uuid();
  v_remaining integer;
BEGIN
  IF _tenant_id IS NULL OR _feature_key IS NULL THEN
    RETURN jsonb_build_object(
      'allowed', false,
      'code', 'FEATURE_LIMIT_EXCEEDED',
      'feature_key', _feature_key,
      'current_usage', 0,
      'allowed_usage', 0,
      'remaining', 0,
      'upgrade_required', true,
      'reason', 'missing_tenant_or_feature',
      'correlation_id', v_correlation
    );
  END IF;

  BEGIN v_enforce := public.is_tenant_enforced(_tenant_id);
  EXCEPTION WHEN OTHERS THEN v_enforce := false; END;

  v_entitlement := public.get_tenant_feature(_tenant_id, _feature_key);

  SELECT COALESCE(reserved,0) INTO v_reserved
    FROM public.subscription_usage_counters
   WHERE tenant_id=_tenant_id AND feature_key=_feature_key AND period_start=v_period_start;
  v_reserved := COALESCE(v_reserved,0);

  IF v_enforce THEN
    IF v_entitlement IS NULL THEN
      PERFORM public._meter_log(_tenant_id, v_uid, _feature_key, 'blocked', v_amount,
        jsonb_build_object('reason','no_entitlement','correlation_id',v_correlation));
      RETURN jsonb_build_object(
        'allowed', false, 'code','FEATURE_LIMIT_EXCEEDED',
        'feature_key', _feature_key, 'current_usage', 0, 'allowed_usage', 0,
        'remaining', 0, 'upgrade_required', true, 'reason','no_entitlement',
        'correlation_id', v_correlation
      );
    END IF;

    v_enabled   := COALESCE((v_entitlement->>'enabled')::boolean, false);
    v_unlimited := COALESCE((v_entitlement->>'unlimited')::boolean, false);
    v_limit     := NULLIF(v_entitlement->>'limit','')::integer;
    v_usage     := COALESCE(NULLIF(v_entitlement->>'usage','')::integer, 0);

    IF NOT v_enabled THEN
      PERFORM public._meter_log(_tenant_id, v_uid, _feature_key, 'blocked', v_amount,
        jsonb_build_object('reason','disabled','correlation_id',v_correlation));
      RETURN jsonb_build_object(
        'allowed', false, 'code','FEATURE_LIMIT_EXCEEDED',
        'feature_key', _feature_key, 'current_usage', v_usage, 'allowed_usage', 0,
        'remaining', 0, 'upgrade_required', true, 'reason','disabled',
        'correlation_id', v_correlation
      );
    END IF;

    IF NOT v_unlimited AND v_limit IS NOT NULL AND (v_usage + v_reserved + v_amount) > v_limit THEN
      v_remaining := GREATEST(0, v_limit - v_usage - v_reserved);
      PERFORM public._meter_log(_tenant_id, v_uid, _feature_key, 'blocked', v_amount,
        jsonb_build_object('reason','limit','usage',v_usage,'reserved',v_reserved,'limit',v_limit,'correlation_id',v_correlation));
      RETURN jsonb_build_object(
        'allowed', false, 'code','FEATURE_LIMIT_EXCEEDED',
        'feature_key', _feature_key, 'current_usage', v_usage,
        'allowed_usage', v_limit, 'remaining', v_remaining,
        'upgrade_required', true, 'reason','limit',
        'correlation_id', v_correlation
      );
    END IF;
  END IF;

  INSERT INTO public.subscription_usage_counters
    (tenant_id, feature_key, period_start, period_end, used, reserved, created_at, updated_at)
  VALUES (_tenant_id, _feature_key, v_period_start, v_period_end, 0, v_amount, now(), now())
  ON CONFLICT (tenant_id, feature_key, period_start)
  DO UPDATE SET reserved = LEAST(2147483000, public.subscription_usage_counters.reserved + EXCLUDED.reserved),
                updated_at = now()
  RETURNING reserved INTO v_new_reserved;

  PERFORM public._meter_log(_tenant_id, v_uid, _feature_key, 'reserved', v_amount,
    jsonb_build_object('enforced',v_enforce,'new_reserved',v_new_reserved,'correlation_id',v_correlation));

  RETURN jsonb_build_object(
    'allowed', true,
    'enforced', v_enforce,
    'feature_key', _feature_key,
    'current_usage', COALESCE(v_usage,0),
    'reserved', v_new_reserved,
    'allowed_usage', COALESCE(v_limit, -1),
    'remaining', CASE WHEN v_unlimited OR v_limit IS NULL THEN -1
                      ELSE GREATEST(0, v_limit - COALESCE(v_usage,0) - v_new_reserved) END,
    'entitlement', v_entitlement,
    'correlation_id', v_correlation
  );
END; $function$;

REVOKE ALL ON FUNCTION public.check_and_reserve_feature_usage(uuid,text,integer,uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.check_and_reserve_feature_usage(uuid,text,integer,uuid) TO authenticated, service_role;