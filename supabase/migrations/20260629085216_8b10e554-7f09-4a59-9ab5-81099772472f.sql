
-- Apply Stripe IDs from project memory
UPDATE public.subscription_plans SET stripe_price_id_monthly='price_1TaWwZBCm829b1DrJclTTgys' WHERE slug='starter';
UPDATE public.subscription_plans SET stripe_price_id_monthly='price_1TaWxABCm829b1Dri0szLO2w' WHERE slug='pro';
UPDATE public.subscription_plans SET stripe_price_id_monthly='price_1TaWzTBCm829b1DroVbwavF0' WHERE slug='enterprise';

-- =========================================================
-- tenant_api_connections (per-workspace BYO data-provider keys)
-- =========================================================
CREATE TABLE IF NOT EXISTS public.tenant_api_connections (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id         uuid NOT NULL,
  provider          text NOT NULL CHECK (provider IN ('apollo','lusha','vibe')),
  api_key_encrypted text,
  status            text NOT NULL DEFAULT 'disconnected' CHECK (status IN ('connected','disconnected','error')),
  last_tested_at    timestamptz,
  last_sync_at      timestamptz,
  last_error        text,
  usage_count       integer NOT NULL DEFAULT 0,
  created_by        uuid,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now(),
  UNIQUE(tenant_id, provider)
);

GRANT SELECT ON public.tenant_api_connections TO authenticated;
GRANT ALL    ON public.tenant_api_connections TO service_role;

-- Hide encrypted column from PostgREST entirely
REVOKE SELECT (api_key_encrypted) ON public.tenant_api_connections FROM authenticated, anon;

ALTER TABLE public.tenant_api_connections ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "tenant members read connections" ON public.tenant_api_connections;
CREATE POLICY "tenant members read connections"
  ON public.tenant_api_connections FOR SELECT TO authenticated
  USING (public.user_belongs_to_tenant(auth.uid(), tenant_id));

-- Writes are RPC-only (service role). No direct INSERT/UPDATE/DELETE policy.

-- =========================================================
-- stripe_processed_events (idempotency)
-- =========================================================
CREATE TABLE IF NOT EXISTS public.stripe_processed_events (
  event_id     text PRIMARY KEY,
  type         text NOT NULL,
  processed_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.stripe_processed_events TO service_role;
ALTER TABLE public.stripe_processed_events ENABLE ROW LEVEL SECURITY;
-- No policies = no access except service_role

-- =========================================================
-- subscription_events (lifecycle audit)
-- =========================================================
CREATE TABLE IF NOT EXISTS public.subscription_events (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id    uuid NOT NULL,
  event_type   text NOT NULL,
  plan_slug    text,
  stripe_event_id text,
  metadata     jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at   timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS subscription_events_tenant_idx ON public.subscription_events(tenant_id, created_at DESC);

GRANT SELECT ON public.subscription_events TO authenticated;
GRANT ALL    ON public.subscription_events TO service_role;

ALTER TABLE public.subscription_events ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "tenant members read events" ON public.subscription_events;
CREATE POLICY "tenant members read events"
  ON public.subscription_events FOR SELECT TO authenticated
  USING (public.user_belongs_to_tenant(auth.uid(), tenant_id));

-- =========================================================
-- Admin RPCs for the Super Admin UI
-- =========================================================
CREATE OR REPLACE FUNCTION public.admin_upsert_plan(
  _id uuid, _slug text, _name text, _description text,
  _price_monthly numeric, _price_yearly numeric, _currency text,
  _trial_days integer, _display_order integer, _is_featured boolean,
  _is_active boolean, _show_on_pricing boolean, _cta_label text,
  _stripe_product_id text, _stripe_price_id_monthly text, _stripe_price_id_yearly text
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_id uuid;
BEGIN
  IF NOT public.is_super_admin(auth.uid()) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;
  IF _id IS NULL THEN
    INSERT INTO public.subscription_plans(slug,name,description,price_monthly,price_yearly,currency,
      trial_days,display_order,is_featured,is_active,show_on_pricing,cta_label,
      stripe_product_id,stripe_price_id_monthly,stripe_price_id_yearly)
    VALUES(_slug,_name,_description,_price_monthly,_price_yearly,COALESCE(_currency,'USD'),
      COALESCE(_trial_days,0),COALESCE(_display_order,0),COALESCE(_is_featured,false),
      COALESCE(_is_active,true),COALESCE(_show_on_pricing,true),COALESCE(_cta_label,'Get started'),
      _stripe_product_id,_stripe_price_id_monthly,_stripe_price_id_yearly)
    RETURNING id INTO v_id;
  ELSE
    UPDATE public.subscription_plans SET
      slug=_slug, name=_name, description=_description,
      price_monthly=_price_monthly, price_yearly=_price_yearly,
      currency=COALESCE(_currency,'USD'), trial_days=COALESCE(_trial_days,0),
      display_order=COALESCE(_display_order,0), is_featured=COALESCE(_is_featured,false),
      is_active=COALESCE(_is_active,true), show_on_pricing=COALESCE(_show_on_pricing,true),
      cta_label=COALESCE(_cta_label,'Get started'),
      stripe_product_id=_stripe_product_id,
      stripe_price_id_monthly=_stripe_price_id_monthly,
      stripe_price_id_yearly=_stripe_price_id_yearly,
      updated_at=now()
    WHERE id=_id RETURNING id INTO v_id;
  END IF;
  RETURN v_id;
END;$$;
GRANT EXECUTE ON FUNCTION public.admin_upsert_plan(uuid,text,text,text,numeric,numeric,text,integer,integer,boolean,boolean,boolean,text,text,text,text) TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_upsert_feature(
  _id uuid, _feature_key text, _feature_name text, _description text,
  _category text, _unit text, _sort_order integer,
  _show_on_pricing_page boolean, _is_addon boolean, _is_metered boolean
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_id uuid;
BEGIN
  IF NOT public.is_super_admin(auth.uid()) THEN RAISE EXCEPTION 'forbidden'; END IF;
  IF _id IS NULL THEN
    INSERT INTO public.subscription_features(feature_key,feature_name,description,category,unit,sort_order,show_on_pricing_page,is_addon,is_metered)
    VALUES(_feature_key,_feature_name,_description,_category,_unit,COALESCE(_sort_order,0),
      COALESCE(_show_on_pricing_page,true),COALESCE(_is_addon,false),COALESCE(_is_metered,false))
    RETURNING id INTO v_id;
  ELSE
    UPDATE public.subscription_features SET
      feature_key=_feature_key, feature_name=_feature_name, description=_description,
      category=_category, unit=_unit, sort_order=COALESCE(_sort_order,0),
      show_on_pricing_page=COALESCE(_show_on_pricing_page,true),
      is_addon=COALESCE(_is_addon,false), is_metered=COALESCE(_is_metered,false),
      updated_at=now()
    WHERE id=_id RETURNING id INTO v_id;
  END IF;
  RETURN v_id;
END;$$;
GRANT EXECUTE ON FUNCTION public.admin_upsert_feature(uuid,text,text,text,text,text,integer,boolean,boolean,boolean) TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_set_plan_feature(
  _plan_id uuid, _feature_id uuid, _enabled boolean,
  _limit_value integer, _unlimited boolean, _monthly_reset boolean
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NOT public.is_super_admin(auth.uid()) THEN RAISE EXCEPTION 'forbidden'; END IF;
  INSERT INTO public.subscription_plan_features(plan_id,feature_id,enabled,limit_value,unlimited,monthly_reset)
  VALUES(_plan_id,_feature_id,COALESCE(_enabled,false),_limit_value,COALESCE(_unlimited,false),COALESCE(_monthly_reset,true))
  ON CONFLICT (plan_id,feature_id) DO UPDATE
  SET enabled=EXCLUDED.enabled, limit_value=EXCLUDED.limit_value,
      unlimited=EXCLUDED.unlimited, monthly_reset=EXCLUDED.monthly_reset, updated_at=now();
END;$$;
GRANT EXECUTE ON FUNCTION public.admin_set_plan_feature(uuid,uuid,boolean,integer,boolean,boolean) TO authenticated;

-- Tenant API connection RPCs (writes via service role only, after edge function encrypts)
CREATE OR REPLACE FUNCTION public.save_tenant_api_connection(
  _tenant_id uuid, _provider text, _ciphertext text, _status text
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.tenant_api_connections(tenant_id, provider, api_key_encrypted, status, last_tested_at, created_by)
  VALUES (_tenant_id, _provider, _ciphertext, COALESCE(_status,'connected'), now(), auth.uid())
  ON CONFLICT (tenant_id, provider) DO UPDATE
  SET api_key_encrypted = EXCLUDED.api_key_encrypted,
      status = EXCLUDED.status,
      last_tested_at = now(),
      last_error = NULL,
      updated_at = now();
END;$$;
REVOKE ALL ON FUNCTION public.save_tenant_api_connection(uuid,text,text,text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.save_tenant_api_connection(uuid,text,text,text) TO service_role;

CREATE OR REPLACE FUNCTION public.get_tenant_api_key_ciphertext(_tenant_id uuid, _provider text)
RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT api_key_encrypted FROM public.tenant_api_connections
   WHERE tenant_id = _tenant_id AND provider = _provider LIMIT 1
$$;
REVOKE ALL ON FUNCTION public.get_tenant_api_key_ciphertext(uuid,text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_tenant_api_key_ciphertext(uuid,text) TO service_role;

CREATE OR REPLACE FUNCTION public.disconnect_tenant_api(_tenant_id uuid, _provider text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT (public.has_role(auth.uid(),'owner'::app_role) OR public.has_role(auth.uid(),'manager'::app_role) OR public.is_super_admin(auth.uid())) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;
  IF NOT public.user_belongs_to_tenant(auth.uid(), _tenant_id) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;
  DELETE FROM public.tenant_api_connections WHERE tenant_id=_tenant_id AND provider=_provider;
END;$$;
GRANT EXECUTE ON FUNCTION public.disconnect_tenant_api(uuid,text) TO authenticated;
