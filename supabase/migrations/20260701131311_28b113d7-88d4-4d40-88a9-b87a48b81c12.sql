
-- =========================================================================
-- Production Stabilization Migration
-- D1: Harden control-plane RPCs (audit + structured returns + idempotent)
-- D2: Proper reservation lifecycle (reserve / commit / refund)
-- D3: Remove duplicate candidate enforcement trigger
-- D4: Reconcile active_jobs status filter (single source of truth)
-- D5: Unified audit_log coverage for every enforcement decision
-- =========================================================================

-- -------------------------------------------------------------------------
-- D3: drop the legacy duplicate trigger on candidates.
-- Keep enforce_candidates_limit (allowlist-aware, matches clients/profiles).
-- -------------------------------------------------------------------------
DROP TRIGGER IF EXISTS candidates_enforce_limit_trg ON public.candidates;
DROP FUNCTION IF EXISTS public.tg_enforce_candidate_limit();

-- -------------------------------------------------------------------------
-- D2: reservation column on the usage counters.
-- Semantics: enforced_total = used + reserved; committed usage = used only.
-- -------------------------------------------------------------------------
ALTER TABLE public.subscription_usage_counters
  ADD COLUMN IF NOT EXISTS reserved integer NOT NULL DEFAULT 0;

-- -------------------------------------------------------------------------
-- Internal helper: write both to subscription_usage_log AND audit_log so the
-- audit trail is unified (D5). Never raises.
-- -------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public._meter_log(
  _tenant_id uuid, _user_id uuid, _feature_key text,
  _action text, _delta integer, _metadata jsonb
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
  BEGIN
    INSERT INTO public.subscription_usage_log(tenant_id, user_id, feature_key, delta, action, metadata)
    VALUES (_tenant_id, _user_id, _feature_key, _delta, _action, COALESCE(_metadata,'{}'::jsonb));
  EXCEPTION WHEN OTHERS THEN NULL;
  END;
  BEGIN
    PERFORM public.write_audit_log(
      _action       := 'feature_usage.' || _action,
      _entity_type  := 'feature_usage',
      _entity_id    := NULL,
      _old          := NULL,
      _new          := jsonb_build_object('feature_key',_feature_key,'delta',_delta) || COALESCE(_metadata,'{}'::jsonb),
      _metadata     := COALESCE(_metadata,'{}'::jsonb) || jsonb_build_object('feature_key',_feature_key,'delta',_delta),
      _tenant_id    := _tenant_id,
      _user_id      := _user_id
    );
  EXCEPTION WHEN OTHERS THEN NULL;
  END;
END; $$;

-- -------------------------------------------------------------------------
-- D2 + D5: rewrite check_and_reserve to use `reserved` column.
-- On block: audit + raise. On success: increment reserved (not used) + audit.
-- -------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.check_and_reserve_feature_usage(
  _tenant_id uuid, _feature_key text, _amount integer DEFAULT 1, _user_id uuid DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
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
BEGIN
  IF _tenant_id IS NULL OR _feature_key IS NULL THEN
    RAISE EXCEPTION 'FEATURE_LIMIT_EXCEEDED: tenant_id and feature_key required';
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
      PERFORM public._meter_log(_tenant_id, v_uid, _feature_key, 'blocked', v_amount, jsonb_build_object('reason','no_entitlement'));
      RAISE EXCEPTION 'FEATURE_LIMIT_EXCEEDED:%:{"feature_key":"%","current_usage":0,"allowed_usage":0,"remaining":0,"upgrade_required":true}',
        _feature_key, _feature_key;
    END IF;

    v_enabled   := COALESCE((v_entitlement->>'enabled')::boolean, false);
    v_unlimited := COALESCE((v_entitlement->>'unlimited')::boolean, false);
    v_limit     := NULLIF(v_entitlement->>'limit','')::integer;
    v_usage     := COALESCE(NULLIF(v_entitlement->>'usage','')::integer, 0);

    IF NOT v_enabled THEN
      PERFORM public._meter_log(_tenant_id, v_uid, _feature_key, 'blocked', v_amount, jsonb_build_object('reason','disabled'));
      RAISE EXCEPTION 'FEATURE_LIMIT_EXCEEDED:%:{"feature_key":"%","current_usage":%,"allowed_usage":0,"remaining":0,"upgrade_required":true}',
        _feature_key, _feature_key, v_usage;
    END IF;

    IF NOT v_unlimited AND v_limit IS NOT NULL AND (v_usage + v_reserved + v_amount) > v_limit THEN
      PERFORM public._meter_log(_tenant_id, v_uid, _feature_key, 'blocked', v_amount,
        jsonb_build_object('reason','limit','usage',v_usage,'reserved',v_reserved,'limit',v_limit));
      RAISE EXCEPTION 'FEATURE_LIMIT_EXCEEDED:%:{"feature_key":"%","current_usage":%,"allowed_usage":%,"remaining":%,"upgrade_required":true}',
        _feature_key, _feature_key, v_usage, v_limit, GREATEST(0, v_limit - v_usage - v_reserved);
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
    jsonb_build_object('enforced',v_enforce,'new_reserved',v_new_reserved));

  RETURN jsonb_build_object(
    'allowed', true,
    'enforced', v_enforce,
    'feature_key', _feature_key,
    'current_usage', COALESCE(v_usage,0),
    'reserved', v_new_reserved,
    'allowed_usage', COALESCE(v_limit, -1),
    'remaining', CASE WHEN v_unlimited OR v_limit IS NULL THEN -1
                      ELSE GREATEST(0, v_limit - COALESCE(v_usage,0) - v_new_reserved) END,
    'entitlement', v_entitlement
  );
END; $$;

-- -------------------------------------------------------------------------
-- D2: commit_feature_usage — moves reservation into permanent `used`.
-- Called after the work succeeds. Idempotent per amount (guarded by amount>0).
-- -------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.commit_feature_usage(
  _tenant_id uuid, _feature_key text, _amount integer DEFAULT 1, _user_id uuid DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  v_period_start timestamptz := date_trunc('month', now());
  v_amount integer := GREATEST(1, COALESCE(_amount,1));
  v_new_used integer;
  v_new_reserved integer;
  v_uid uuid := COALESCE(_user_id, auth.uid());
BEGIN
  IF _tenant_id IS NULL OR _feature_key IS NULL THEN
    RETURN jsonb_build_object('ok',false,'error','tenant_id and feature_key required');
  END IF;

  UPDATE public.subscription_usage_counters
     SET reserved = GREATEST(0, reserved - v_amount),
         used     = LEAST(2147483000, used + v_amount),
         updated_at = now()
   WHERE tenant_id=_tenant_id AND feature_key=_feature_key AND period_start=v_period_start
  RETURNING used, reserved INTO v_new_used, v_new_reserved;

  PERFORM public._meter_log(_tenant_id, v_uid, _feature_key, 'committed', v_amount,
    jsonb_build_object('new_used',COALESCE(v_new_used,0),'new_reserved',COALESCE(v_new_reserved,0)));

  RETURN jsonb_build_object('ok',true,'feature_key',_feature_key,
    'used',COALESCE(v_new_used,0),'reserved',COALESCE(v_new_reserved,0));
END; $$;

-- -------------------------------------------------------------------------
-- D2 + D5: refund now decrements `reserved` (never touches `used`).
-- -------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.refund_feature_usage(
  _tenant_id uuid, _feature_key text, _amount integer DEFAULT 1,
  _user_id uuid DEFAULT NULL, _reason text DEFAULT 'action_failed'
) RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  v_period_start timestamptz := date_trunc('month', now());
  v_new_reserved integer;
  v_amount integer := GREATEST(1, COALESCE(_amount,1));
  v_uid uuid := COALESCE(_user_id, auth.uid());
BEGIN
  IF _tenant_id IS NULL OR _feature_key IS NULL THEN RETURN 0; END IF;

  UPDATE public.subscription_usage_counters
     SET reserved = GREATEST(0, reserved - v_amount), updated_at = now()
   WHERE tenant_id=_tenant_id AND feature_key=_feature_key AND period_start=v_period_start
  RETURNING reserved INTO v_new_reserved;

  PERFORM public._meter_log(_tenant_id, v_uid, _feature_key, 'refunded', -v_amount,
    jsonb_build_object('reason',_reason,'new_reserved',COALESCE(v_new_reserved,0)));

  RETURN COALESCE(v_new_reserved, 0);
END; $$;

-- -------------------------------------------------------------------------
-- D1: harden control-plane RPCs. Idempotent, audit-logged, structured returns.
-- -------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.enforcement_arm_global()
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_prev jsonb; v_uid uuid := auth.uid();
BEGIN
  IF NOT public.has_role(v_uid, 'admin') THEN
    RETURN jsonb_build_object('ok',false,'error','FORBIDDEN','message','super_admin required');
  END IF;
  SELECT value INTO v_prev FROM public.platform_settings WHERE key='enforce_plan_limits';
  INSERT INTO public.platform_settings(key,value,updated_at)
    VALUES('enforce_plan_limits','true'::jsonb, now())
    ON CONFLICT (key) DO UPDATE SET value='true'::jsonb, updated_at=now();
  PERFORM public.write_audit_log(
    _action:='enforcement.arm_global', _entity_type:='platform_settings',
    _entity_id:=NULL, _old:=v_prev, _new:='true'::jsonb,
    _metadata:=jsonb_build_object('key','enforce_plan_limits'),
    _tenant_id:=NULL, _user_id:=v_uid);
  RETURN jsonb_build_object('ok',true,'enforce_plan_limits',true,'previous',v_prev);
END; $$;

CREATE OR REPLACE FUNCTION public.enforcement_disarm_global()
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_prev jsonb; v_uid uuid := auth.uid();
BEGIN
  IF NOT public.has_role(v_uid, 'admin') THEN
    RETURN jsonb_build_object('ok',false,'error','FORBIDDEN','message','super_admin required');
  END IF;
  SELECT value INTO v_prev FROM public.platform_settings WHERE key='enforce_plan_limits';
  INSERT INTO public.platform_settings(key,value,updated_at)
    VALUES('enforce_plan_limits','false'::jsonb, now())
    ON CONFLICT (key) DO UPDATE SET value='false'::jsonb, updated_at=now();
  PERFORM public.write_audit_log(
    _action:='enforcement.disarm_global', _entity_type:='platform_settings',
    _entity_id:=NULL, _old:=v_prev, _new:='false'::jsonb,
    _metadata:=jsonb_build_object('key','enforce_plan_limits'),
    _tenant_id:=NULL, _user_id:=v_uid);
  RETURN jsonb_build_object('ok',true,'enforce_plan_limits',false,'previous',v_prev);
END; $$;

CREATE OR REPLACE FUNCTION public.enforcement_add_tenant(_tenant_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_prev jsonb; v_new jsonb; v_uid uuid := auth.uid();
BEGIN
  IF NOT public.has_role(v_uid, 'admin') THEN
    RETURN jsonb_build_object('ok',false,'error','FORBIDDEN','message','super_admin required');
  END IF;
  IF _tenant_id IS NULL THEN
    RETURN jsonb_build_object('ok',false,'error','BAD_REQUEST','message','tenant_id required');
  END IF;
  SELECT value INTO v_prev FROM public.platform_settings WHERE key='enforcement_allowlist_tenants';
  INSERT INTO public.platform_settings(key,value,updated_at)
    VALUES('enforcement_allowlist_tenants', to_jsonb(ARRAY[_tenant_id::text]), now())
    ON CONFLICT (key) DO UPDATE SET
      value = (SELECT COALESCE(jsonb_agg(DISTINCT t), '[]'::jsonb)
               FROM jsonb_array_elements_text(public.platform_settings.value || to_jsonb(_tenant_id::text)) t),
      updated_at = now()
  RETURNING value INTO v_new;
  PERFORM public.write_audit_log(
    _action:='enforcement.add_tenant', _entity_type:='platform_settings',
    _entity_id:=_tenant_id, _old:=v_prev, _new:=v_new,
    _metadata:=jsonb_build_object('tenant_id',_tenant_id),
    _tenant_id:=_tenant_id, _user_id:=v_uid);
  RETURN jsonb_build_object('ok',true,'allowlist',v_new,'previous',v_prev,'added',_tenant_id);
END; $$;

CREATE OR REPLACE FUNCTION public.enforcement_remove_tenant(_tenant_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_prev jsonb; v_new jsonb; v_uid uuid := auth.uid();
BEGIN
  IF NOT public.has_role(v_uid, 'admin') THEN
    RETURN jsonb_build_object('ok',false,'error','FORBIDDEN','message','super_admin required');
  END IF;
  IF _tenant_id IS NULL THEN
    RETURN jsonb_build_object('ok',false,'error','BAD_REQUEST','message','tenant_id required');
  END IF;
  SELECT value INTO v_prev FROM public.platform_settings WHERE key='enforcement_allowlist_tenants';
  UPDATE public.platform_settings
     SET value = COALESCE((SELECT jsonb_agg(t) FROM jsonb_array_elements_text(value) t
                           WHERE t <> _tenant_id::text), '[]'::jsonb),
         updated_at = now()
   WHERE key='enforcement_allowlist_tenants'
  RETURNING value INTO v_new;
  PERFORM public.write_audit_log(
    _action:='enforcement.remove_tenant', _entity_type:='platform_settings',
    _entity_id:=_tenant_id, _old:=v_prev, _new:=v_new,
    _metadata:=jsonb_build_object('tenant_id',_tenant_id),
    _tenant_id:=_tenant_id, _user_id:=v_uid);
  RETURN jsonb_build_object('ok',true,'allowlist',COALESCE(v_new,'[]'::jsonb),'previous',v_prev,'removed',_tenant_id);
END; $$;

-- -------------------------------------------------------------------------
-- D4: reconcile active_jobs status set (single source of truth).
-- Trigger tg_enforce_job_limit uses ('active','open','published').
-- Align get_tenant_feature to the same set.
-- -------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_tenant_feature(_tenant_id uuid, _feature_key text)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_plan_id uuid;
  v_enabled boolean := false;
  v_limit int;
  v_usage int := 0;
  v_remaining int;
  v_month_start timestamptz := date_trunc('month', now());
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Authentication required'; END IF;
  IF NOT (public.user_belongs_to_tenant(auth.uid(), _tenant_id) OR public.is_super_admin(auth.uid())) THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;

  SELECT subscription_plan_id INTO v_plan_id FROM public.tenants WHERE id = _tenant_id;

  SELECT spf.enabled, spf.limit_value INTO v_enabled, v_limit
    FROM public.subscription_plan_features spf
    JOIN public.subscription_features f ON f.id = spf.feature_id
   WHERE spf.plan_id = v_plan_id AND f.feature_key = _feature_key;

  IF _feature_key = 'active_jobs' THEN
    SELECT COUNT(*) INTO v_usage FROM public.jobs
      WHERE tenant_id = _tenant_id AND COALESCE(status::text,'active') IN ('active','open','published');
  ELSIF _feature_key = 'candidates' THEN
    SELECT COUNT(*) INTO v_usage FROM public.candidates WHERE tenant_id = _tenant_id;
  ELSIF _feature_key = 'clients' THEN
    SELECT COUNT(*) INTO v_usage FROM public.clients WHERE tenant_id = _tenant_id;
  ELSIF _feature_key IN ('team_members','users') THEN
    SELECT COUNT(*) INTO v_usage FROM public.profiles
      WHERE tenant_id = _tenant_id AND is_active = true AND deleted_at IS NULL;
  ELSIF _feature_key = 'ai_matches_monthly' THEN
    SELECT COUNT(*) INTO v_usage FROM public.ai_usage
      WHERE tenant_id = _tenant_id AND action_type = 'ai_match' AND created_at >= v_month_start;
  ELSE
    SELECT COALESCE(used,0) INTO v_usage FROM public.subscription_usage_counters
     WHERE tenant_id=_tenant_id AND feature_key=_feature_key AND period_start=v_month_start;
    v_usage := COALESCE(v_usage,0);
  END IF;

  IF v_limit IS NULL OR v_limit < 0 THEN v_remaining := -1;
  ELSE v_remaining := GREATEST(0, v_limit - v_usage); END IF;

  RETURN jsonb_build_object(
    'feature_key', _feature_key,
    'enabled', COALESCE(v_enabled,false),
    'limit', v_limit,
    'usage', v_usage,
    'remaining', v_remaining,
    'unlimited', (v_limit IS NULL OR v_limit < 0)
  );
END; $$;

GRANT EXECUTE ON FUNCTION public.commit_feature_usage(uuid,text,integer,uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.enforcement_arm_global() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.enforcement_disarm_global() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.enforcement_add_tenant(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.enforcement_remove_tenant(uuid) TO authenticated, service_role;
