
-- M1: Tenants past_due_since + race-safe usage counters

ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS past_due_since timestamptz;

CREATE UNIQUE INDEX IF NOT EXISTS subscription_usage_counters_tenant_feature_period_uidx
  ON public.subscription_usage_counters (tenant_id, feature_key, period_start);

CREATE OR REPLACE FUNCTION public.increment_feature_usage(
  _tenant_id uuid,
  _feature_key text,
  _amount integer DEFAULT 1,
  _period_start timestamptz DEFAULT date_trunc('month', now()),
  _period_end timestamptz DEFAULT (date_trunc('month', now()) + interval '1 month')
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  new_used integer;
BEGIN
  INSERT INTO public.subscription_usage_counters (tenant_id, feature_key, period_start, period_end, used)
  VALUES (_tenant_id, _feature_key, _period_start, _period_end, GREATEST(0, _amount))
  ON CONFLICT (tenant_id, feature_key, period_start)
  DO UPDATE SET used = GREATEST(0, public.subscription_usage_counters.used + EXCLUDED.used),
                updated_at = now()
  RETURNING used INTO new_used;
  RETURN new_used;
END;
$$;

CREATE OR REPLACE FUNCTION public.reset_usage_counters_for_period(
  _tenant_id uuid,
  _period_start timestamptz,
  _period_end timestamptz
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  UPDATE public.subscription_usage_counters
     SET used = 0, period_start = _period_start, period_end = _period_end, updated_at = now()
   WHERE tenant_id = _tenant_id
     AND period_end <= _period_start;
END;
$$;

REVOKE ALL ON FUNCTION public.increment_feature_usage(uuid, text, integer, timestamptz, timestamptz) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.increment_feature_usage(uuid, text, integer, timestamptz, timestamptz) TO authenticated, service_role;
REVOKE ALL ON FUNCTION public.reset_usage_counters_for_period(uuid, timestamptz, timestamptz) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.reset_usage_counters_for_period(uuid, timestamptz, timestamptz) TO service_role;

CREATE INDEX IF NOT EXISTS audit_log_tenant_created_idx ON public.audit_log (tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS audit_log_action_created_idx ON public.audit_log (action, created_at DESC);
CREATE INDEX IF NOT EXISTS webhook_logs_event_id_idx ON public.webhook_logs (event_id);
CREATE INDEX IF NOT EXISTS webhook_logs_status_created_idx ON public.webhook_logs (status, created_at DESC);
