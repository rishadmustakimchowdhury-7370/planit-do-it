
-- =========================================================================
-- Batch A / Step 3 — Staged rollout for plan-limit enforcement
-- Adds tenant allowlist + kill-switch RPCs. Fully backwards compatible.
-- =========================================================================

-- 1) Backup snapshot of current global toggle (for rollback reference) -----
INSERT INTO public.platform_settings (key, value, description)
SELECT 'enforce_plan_limits_backup',
       COALESCE((SELECT value FROM public.platform_settings WHERE key='enforce_plan_limits'), 'false'::jsonb),
       'Pre-rollout snapshot of enforce_plan_limits. Used for emergency rollback.'
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now();

-- 2) Allowlist of tenants enforced ahead of global rollout ----------------
INSERT INTO public.platform_settings (key, value, description)
VALUES ('enforcement_allowlist_tenants', '[]'::jsonb,
        'Array of tenant UUIDs with plan-limit enforcement enabled BEFORE the global switch. Used for staged rollout.')
ON CONFLICT (key) DO NOTHING;

-- 3) Per-tenant enforcement check ----------------------------------------
CREATE OR REPLACE FUNCTION public.is_tenant_enforced(_tenant_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    COALESCE((SELECT (value)::text::boolean FROM public.platform_settings WHERE key='enforce_plan_limits'), false)
    OR (
      _tenant_id IS NOT NULL AND EXISTS (
        SELECT 1
        FROM public.platform_settings ps,
             jsonb_array_elements_text(ps.value) t(tid)
        WHERE ps.key = 'enforcement_allowlist_tenants'
          AND t.tid = _tenant_id::text
      )
    )
$$;

GRANT EXECUTE ON FUNCTION public.is_tenant_enforced(uuid) TO authenticated, service_role, anon;

-- 4) Update triggers to consult per-tenant flag ---------------------------
CREATE OR REPLACE FUNCTION public.trg_enforce_candidates_limit()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE cnt bigint;
BEGIN
  IF NEW.tenant_id IS NULL THEN RETURN NEW; END IF;
  IF NOT public.is_tenant_enforced(NEW.tenant_id) THEN RETURN NEW; END IF;
  IF auth.uid() IS NOT NULL AND public.has_role(auth.uid(), 'admin') THEN RETURN NEW; END IF;

  SELECT COUNT(*) INTO cnt FROM public.candidates WHERE tenant_id = NEW.tenant_id;
  PERFORM public.enforce_feature_limit(NEW.tenant_id, 'candidates', cnt);
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.trg_enforce_clients_limit()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE cnt bigint;
BEGIN
  IF NEW.tenant_id IS NULL THEN RETURN NEW; END IF;
  IF NOT public.is_tenant_enforced(NEW.tenant_id) THEN RETURN NEW; END IF;
  IF auth.uid() IS NOT NULL AND public.has_role(auth.uid(), 'admin') THEN RETURN NEW; END IF;

  SELECT COUNT(*) INTO cnt FROM public.clients WHERE tenant_id = NEW.tenant_id;
  PERFORM public.enforce_feature_limit(NEW.tenant_id, 'clients', cnt);
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.trg_enforce_profiles_seat_limit()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE cnt bigint;
BEGIN
  IF NEW.tenant_id IS NULL THEN RETURN NEW; END IF;
  IF NOT public.is_tenant_enforced(NEW.tenant_id) THEN RETURN NEW; END IF;
  IF auth.uid() IS NOT NULL AND public.has_role(auth.uid(), 'admin') THEN RETURN NEW; END IF;

  SELECT COUNT(*) INTO cnt FROM public.profiles WHERE tenant_id = NEW.tenant_id;
  PERFORM public.enforce_feature_limit(NEW.tenant_id, 'users', cnt);
  PERFORM public.enforce_feature_limit(NEW.tenant_id, 'team_members', cnt);
  RETURN NEW;
END;
$$;

-- 5) Update reserve RPC to honour per-tenant enforcement ------------------
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

  -- Per-tenant enforcement toggle (global OR allowlist).
  BEGIN
    v_enforce := public.is_tenant_enforced(_tenant_id);
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

-- 6) Kill-switch + allowlist management RPCs (super-admin only) -----------
CREATE OR REPLACE FUNCTION public.enforcement_add_tenant(_tenant_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_new jsonb;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'FORBIDDEN: super_admin required';
  END IF;
  IF _tenant_id IS NULL THEN RAISE EXCEPTION 'tenant_id required'; END IF;

  UPDATE public.platform_settings
  SET value = (
        SELECT COALESCE(jsonb_agg(DISTINCT t), '[]'::jsonb)
        FROM jsonb_array_elements_text(value || to_jsonb(_tenant_id::text)) t
      ),
      updated_at = now()
  WHERE key = 'enforcement_allowlist_tenants'
  RETURNING value INTO v_new;

  RETURN jsonb_build_object('allowlist', v_new);
END;
$$;

CREATE OR REPLACE FUNCTION public.enforcement_remove_tenant(_tenant_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_new jsonb;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'FORBIDDEN: super_admin required';
  END IF;

  UPDATE public.platform_settings
  SET value = COALESCE((
        SELECT jsonb_agg(t)
        FROM jsonb_array_elements_text(value) t
        WHERE t <> _tenant_id::text
      ), '[]'::jsonb),
      updated_at = now()
  WHERE key = 'enforcement_allowlist_tenants'
  RETURNING value INTO v_new;

  RETURN jsonb_build_object('allowlist', v_new);
END;
$$;

CREATE OR REPLACE FUNCTION public.enforcement_arm_global()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'FORBIDDEN: super_admin required';
  END IF;
  UPDATE public.platform_settings SET value = 'true'::jsonb, updated_at = now()
   WHERE key = 'enforce_plan_limits';
  RETURN jsonb_build_object('enforce_plan_limits', true);
END;
$$;

CREATE OR REPLACE FUNCTION public.enforcement_disarm_global()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'FORBIDDEN: super_admin required';
  END IF;
  UPDATE public.platform_settings SET value = 'false'::jsonb, updated_at = now()
   WHERE key = 'enforce_plan_limits';
  RETURN jsonb_build_object('enforce_plan_limits', false);
END;
$$;

REVOKE ALL ON FUNCTION public.enforcement_add_tenant(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.enforcement_remove_tenant(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.enforcement_arm_global() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.enforcement_disarm_global() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.enforcement_add_tenant(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.enforcement_remove_tenant(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.enforcement_arm_global() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.enforcement_disarm_global() TO authenticated, service_role;

COMMENT ON FUNCTION public.is_tenant_enforced(uuid) IS
  'Batch A/Phase 3: true if enforce_plan_limits is on globally OR tenant is in enforcement_allowlist_tenants.';
COMMENT ON FUNCTION public.enforcement_arm_global() IS
  'Super-admin only: flips enforce_plan_limits to true. Kill switch = enforcement_disarm_global().';
