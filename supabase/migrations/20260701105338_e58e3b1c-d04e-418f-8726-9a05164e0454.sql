
-- =========================================================================
-- Batch A / Step 2 — Central DB enforcement (Phase 1)
-- Additive only. Disabled by default. Zero breaking changes.
-- =========================================================================

-- 1) Platform toggle (idempotent) -----------------------------------------
INSERT INTO public.platform_settings (key, value, description)
VALUES ('enforce_plan_limits', 'false'::jsonb, 'Master switch for server-side plan limit enforcement triggers. When false, triggers are no-ops.')
ON CONFLICT (key) DO NOTHING;

CREATE OR REPLACE FUNCTION public.enforcement_enabled()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE((SELECT (value)::text::boolean FROM public.platform_settings WHERE key='enforce_plan_limits'), false);
$$;

-- 2) Central limit checker -------------------------------------------------
CREATE OR REPLACE FUNCTION public.enforce_feature_limit(
  _tenant_id uuid,
  _feature_key text,
  _current_count bigint
) RETURNS void
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  ent jsonb;
  v_enabled boolean;
  v_unlimited boolean;
  v_limit numeric;
BEGIN
  IF _tenant_id IS NULL THEN RETURN; END IF;

  BEGIN
    ent := public.get_tenant_feature(_tenant_id, _feature_key);
  EXCEPTION WHEN OTHERS THEN
    -- Fail-open on any lookup error to avoid breaking existing tenants
    RETURN;
  END;

  IF ent IS NULL THEN RETURN; END IF;

  v_enabled   := COALESCE((ent->>'enabled')::boolean, true);
  v_unlimited := COALESCE((ent->>'unlimited')::boolean, false);
  v_limit     := NULLIF(ent->>'limit','')::numeric;

  IF NOT v_enabled THEN
    RAISE EXCEPTION 'FEATURE_LIMIT_EXCEEDED: %', _feature_key
      USING HINT = 'Feature not included on current plan';
  END IF;

  IF v_unlimited OR v_limit IS NULL THEN RETURN; END IF;

  IF (_current_count + 1) > v_limit THEN
    RAISE EXCEPTION 'FEATURE_LIMIT_EXCEEDED: %', _feature_key
      USING HINT = 'Plan limit reached; upgrade to add more';
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.enforce_feature_limit(uuid, text, bigint) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.enforce_feature_limit(uuid, text, bigint) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.enforcement_enabled() TO authenticated, service_role, anon;

-- 3) Per-table trigger functions ------------------------------------------
-- Super-admin session bypass; no bypass for service_role (edge functions
-- must respect plan limits by design). Fail-open on any unexpected error.

CREATE OR REPLACE FUNCTION public.trg_enforce_candidates_limit()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE cnt bigint;
BEGIN
  IF NOT public.enforcement_enabled() THEN RETURN NEW; END IF;
  IF NEW.tenant_id IS NULL THEN RETURN NEW; END IF;
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
  IF NOT public.enforcement_enabled() THEN RETURN NEW; END IF;
  IF NEW.tenant_id IS NULL THEN RETURN NEW; END IF;
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
  IF NOT public.enforcement_enabled() THEN RETURN NEW; END IF;
  IF NEW.tenant_id IS NULL THEN RETURN NEW; END IF;
  IF auth.uid() IS NOT NULL AND public.has_role(auth.uid(), 'admin') THEN RETURN NEW; END IF;

  SELECT COUNT(*) INTO cnt FROM public.profiles WHERE tenant_id = NEW.tenant_id;
  -- Checks both keys; whichever is defined on plan applies.
  PERFORM public.enforce_feature_limit(NEW.tenant_id, 'users', cnt);
  PERFORM public.enforce_feature_limit(NEW.tenant_id, 'team_members', cnt);
  RETURN NEW;
END;
$$;

-- 4) Attach triggers (idempotent) -----------------------------------------
DROP TRIGGER IF EXISTS enforce_candidates_limit ON public.candidates;
CREATE TRIGGER enforce_candidates_limit
  BEFORE INSERT ON public.candidates
  FOR EACH ROW EXECUTE FUNCTION public.trg_enforce_candidates_limit();

DROP TRIGGER IF EXISTS enforce_clients_limit ON public.clients;
CREATE TRIGGER enforce_clients_limit
  BEFORE INSERT ON public.clients
  FOR EACH ROW EXECUTE FUNCTION public.trg_enforce_clients_limit();

DROP TRIGGER IF EXISTS enforce_profiles_seat_limit ON public.profiles;
CREATE TRIGGER enforce_profiles_seat_limit
  BEFORE INSERT ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.trg_enforce_profiles_seat_limit();

COMMENT ON FUNCTION public.enforce_feature_limit(uuid, text, bigint) IS
  'Batch A/Phase 1: raises FEATURE_LIMIT_EXCEEDED: <key> when a tenant exceeds a plan cap. Fail-open when plan/feature unknown.';
COMMENT ON FUNCTION public.enforcement_enabled() IS
  'Batch A/Phase 1: master toggle read by all enforcement triggers.';
