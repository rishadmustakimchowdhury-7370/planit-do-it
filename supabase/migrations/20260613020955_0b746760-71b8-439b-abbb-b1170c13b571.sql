
-- ============ Usage log table ============
CREATE TABLE IF NOT EXISTS public.subscription_usage_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  user_id uuid,
  feature_key text NOT NULL,
  delta integer NOT NULL DEFAULT 1,
  action text NOT NULL DEFAULT 'consumed', -- consumed | blocked | check
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.subscription_usage_log TO authenticated;
GRANT ALL ON public.subscription_usage_log TO service_role;

ALTER TABLE public.subscription_usage_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "usage_log_tenant_read" ON public.subscription_usage_log;
CREATE POLICY "usage_log_tenant_read" ON public.subscription_usage_log
FOR SELECT TO authenticated
USING (
  public.is_super_admin(auth.uid())
  OR public.is_owner_or_manager_in_tenant(auth.uid(), tenant_id)
);

DROP POLICY IF EXISTS "usage_log_super_admin_all" ON public.subscription_usage_log;
CREATE POLICY "usage_log_super_admin_all" ON public.subscription_usage_log
FOR ALL TO authenticated
USING (public.is_super_admin(auth.uid()))
WITH CHECK (public.is_super_admin(auth.uid()));

CREATE INDEX IF NOT EXISTS idx_usage_log_tenant_created ON public.subscription_usage_log(tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_usage_log_feature ON public.subscription_usage_log(tenant_id, feature_key, created_at DESC);

-- ============ enforce_feature_limit ============
CREATE OR REPLACE FUNCTION public.enforce_feature_limit(
  _tenant_id uuid,
  _feature_key text,
  _increment integer DEFAULT 1
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_entitlement jsonb;
  v_enabled boolean;
  v_unlimited boolean;
  v_limit integer;
  v_usage integer;
BEGIN
  IF _tenant_id IS NULL THEN
    RAISE EXCEPTION 'FEATURE_LIMIT_EXCEEDED: % (no tenant)', _feature_key;
  END IF;

  v_entitlement := public.get_tenant_feature(_tenant_id, _feature_key);

  IF v_entitlement IS NULL THEN
    -- No entitlement row = treat as blocked
    INSERT INTO public.subscription_usage_log(tenant_id, user_id, feature_key, delta, action, metadata)
    VALUES (_tenant_id, auth.uid(), _feature_key, _increment, 'blocked', jsonb_build_object('reason', 'no_entitlement'));
    RAISE EXCEPTION 'FEATURE_LIMIT_EXCEEDED: %', _feature_key;
  END IF;

  v_enabled := COALESCE((v_entitlement->>'enabled')::boolean, false);
  v_unlimited := COALESCE((v_entitlement->>'unlimited')::boolean, false);
  v_limit := NULLIF(v_entitlement->>'limit', '')::integer;
  v_usage := COALESCE(NULLIF(v_entitlement->>'usage','')::integer, 0);

  IF NOT v_enabled THEN
    INSERT INTO public.subscription_usage_log(tenant_id, user_id, feature_key, delta, action, metadata)
    VALUES (_tenant_id, auth.uid(), _feature_key, _increment, 'blocked', jsonb_build_object('reason','disabled','entitlement', v_entitlement));
    RAISE EXCEPTION 'FEATURE_LIMIT_EXCEEDED: %', _feature_key;
  END IF;

  IF NOT v_unlimited AND v_limit IS NOT NULL AND (v_usage + _increment) > v_limit THEN
    INSERT INTO public.subscription_usage_log(tenant_id, user_id, feature_key, delta, action, metadata)
    VALUES (_tenant_id, auth.uid(), _feature_key, _increment, 'blocked',
            jsonb_build_object('reason','limit','usage', v_usage, 'limit', v_limit));
    RAISE EXCEPTION 'FEATURE_LIMIT_EXCEEDED: %', _feature_key;
  END IF;

  RETURN v_entitlement;
END;
$$;

GRANT EXECUTE ON FUNCTION public.enforce_feature_limit(uuid, text, integer) TO authenticated, service_role;

-- ============ consume_ai_match ============
CREATE OR REPLACE FUNCTION public.consume_ai_match(
  _tenant_id uuid,
  _user_id uuid,
  _action text DEFAULT 'ai_match'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_entitlement jsonb;
BEGIN
  -- Lock the tenant row to serialize concurrent AI consumption
  PERFORM 1 FROM public.tenants WHERE id = _tenant_id FOR UPDATE;

  v_entitlement := public.enforce_feature_limit(_tenant_id, 'ai_matches_monthly', 1);

  INSERT INTO public.subscription_usage_log(tenant_id, user_id, feature_key, delta, action, metadata)
  VALUES (_tenant_id, _user_id, 'ai_matches_monthly', 1, 'consumed',
          jsonb_build_object('action', _action));

  RETURN v_entitlement;
END;
$$;

GRANT EXECUTE ON FUNCTION public.consume_ai_match(uuid, uuid, text) TO authenticated, service_role;

-- ============ Triggers ============

-- jobs
CREATE OR REPLACE FUNCTION public.tg_enforce_job_limit()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Skip for super admins (manual admin ops)
  IF public.is_super_admin(auth.uid()) THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' THEN
    IF COALESCE(NEW.status::text, 'active') IN ('active','open','published') THEN
      PERFORM public.enforce_feature_limit(NEW.tenant_id, 'active_jobs', 1);
    END IF;
  ELSIF TG_OP = 'UPDATE' THEN
    IF COALESCE(NEW.status::text,'') IN ('active','open','published')
       AND COALESCE(OLD.status::text,'') NOT IN ('active','open','published') THEN
      PERFORM public.enforce_feature_limit(NEW.tenant_id, 'active_jobs', 1);
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS jobs_enforce_limit_trg ON public.jobs;
CREATE TRIGGER jobs_enforce_limit_trg
BEFORE INSERT OR UPDATE OF status ON public.jobs
FOR EACH ROW EXECUTE FUNCTION public.tg_enforce_job_limit();

-- candidates
CREATE OR REPLACE FUNCTION public.tg_enforce_candidate_limit()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF public.is_super_admin(auth.uid()) THEN
    RETURN NEW;
  END IF;
  PERFORM public.enforce_feature_limit(NEW.tenant_id, 'candidates', 1);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS candidates_enforce_limit_trg ON public.candidates;
CREATE TRIGGER candidates_enforce_limit_trg
BEFORE INSERT ON public.candidates
FOR EACH ROW EXECUTE FUNCTION public.tg_enforce_candidate_limit();

-- team_invitations
CREATE OR REPLACE FUNCTION public.tg_enforce_team_member_limit()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF public.is_super_admin(auth.uid()) THEN
    RETURN NEW;
  END IF;
  -- Only enforce on new pending invitations (not accepted/cancelled state transitions)
  IF TG_OP = 'INSERT' AND COALESCE(NEW.status, 'pending') = 'pending' THEN
    PERFORM public.enforce_feature_limit(NEW.tenant_id, 'team_members', 1);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS team_invitations_enforce_limit_trg ON public.team_invitations;
CREATE TRIGGER team_invitations_enforce_limit_trg
BEFORE INSERT ON public.team_invitations
FOR EACH ROW EXECUTE FUNCTION public.tg_enforce_team_member_limit();
