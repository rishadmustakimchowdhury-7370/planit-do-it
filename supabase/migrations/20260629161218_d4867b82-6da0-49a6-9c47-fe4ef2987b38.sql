
CREATE TABLE IF NOT EXISTS public.tenant_billing_details (
  tenant_id uuid PRIMARY KEY REFERENCES public.tenants(id) ON DELETE CASCADE,
  company_name text,
  billing_email text,
  vat_number text,
  tax_number text,
  address_line1 text,
  address_line2 text,
  city text,
  region text,
  postal_code text,
  country text,
  currency text DEFAULT 'USD',
  timezone text DEFAULT 'UTC',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE ON public.tenant_billing_details TO authenticated;
GRANT ALL ON public.tenant_billing_details TO service_role;

ALTER TABLE public.tenant_billing_details ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners view billing details"
  ON public.tenant_billing_details FOR SELECT TO authenticated
  USING (public.is_owner_in_tenant(auth.uid(), tenant_id) OR public.is_super_admin(auth.uid()));

CREATE POLICY "Owners insert billing details"
  ON public.tenant_billing_details FOR INSERT TO authenticated
  WITH CHECK (public.is_owner_in_tenant(auth.uid(), tenant_id));

CREATE POLICY "Owners update billing details"
  ON public.tenant_billing_details FOR UPDATE TO authenticated
  USING (public.is_owner_in_tenant(auth.uid(), tenant_id))
  WITH CHECK (public.is_owner_in_tenant(auth.uid(), tenant_id));

CREATE OR REPLACE FUNCTION public.touch_tenant_billing_details()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

DROP TRIGGER IF EXISTS trg_touch_tenant_billing_details ON public.tenant_billing_details;
CREATE TRIGGER trg_touch_tenant_billing_details
  BEFORE UPDATE ON public.tenant_billing_details
  FOR EACH ROW EXECUTE FUNCTION public.touch_tenant_billing_details();

CREATE OR REPLACE FUNCTION public.get_billing_timeline(
  p_tenant_id uuid, p_limit int DEFAULT 50, p_offset int DEFAULT 0
) RETURNS TABLE (
  id uuid, action text, entity_type text, entity_id uuid,
  metadata jsonb, created_at timestamptz, actor uuid
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT a.id, a.action, a.entity_type, a.entity_id,
         COALESCE(a.new_values, a.old_values, '{}'::jsonb), a.created_at, a.user_id
  FROM public.audit_log a
  WHERE a.tenant_id = p_tenant_id
    AND (a.action ILIKE 'billing.%' OR a.action ILIKE 'subscription.%'
      OR a.action ILIKE 'invoice.%' OR a.action ILIKE 'payment.%'
      OR a.action ILIKE 'promo.%' OR a.action ILIKE 'trial.%'
      OR a.entity_type IN ('subscription','invoice','payment','promo_code','tenant_billing'))
    AND (public.is_owner_in_tenant(auth.uid(), p_tenant_id) OR public.is_super_admin(auth.uid()))
  ORDER BY a.created_at DESC
  LIMIT GREATEST(1, LEAST(p_limit, 200)) OFFSET GREATEST(0, p_offset);
$$;
GRANT EXECUTE ON FUNCTION public.get_billing_timeline(uuid,int,int) TO authenticated;

CREATE OR REPLACE FUNCTION public.get_billing_notifications(
  p_tenant_id uuid, p_limit int DEFAULT 25
) RETURNS TABLE (
  id uuid, type text, title text, message text,
  link text, is_read boolean, metadata jsonb, created_at timestamptz
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT n.id, n.type, n.title, n.message, n.link, n.is_read, n.metadata, n.created_at
  FROM public.notifications n
  WHERE n.tenant_id = p_tenant_id
    AND (n.type ILIKE 'billing%' OR n.type ILIKE 'payment%'
         OR n.type ILIKE 'subscription%' OR n.type ILIKE 'invoice%'
         OR n.type ILIKE 'trial%' OR n.type ILIKE 'promo%' OR n.type ILIKE 'usage%')
    AND (public.is_owner_in_tenant(auth.uid(), p_tenant_id) OR public.is_super_admin(auth.uid()))
  ORDER BY n.created_at DESC
  LIMIT GREATEST(1, LEAST(p_limit, 100));
$$;
GRANT EXECUTE ON FUNCTION public.get_billing_notifications(uuid,int) TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_billing_overview()
RETURNS TABLE (
  tenant_id uuid, tenant_name text, plan_name text, plan_slug text,
  subscription_status text, trial_expires_at timestamptz, subscription_ends_at timestamptz,
  is_suspended boolean, past_due_since timestamptz,
  stripe_customer_id text, stripe_subscription_id text,
  total_orders int, last_order_at timestamptz, last_webhook_at timestamptz
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT t.id, t.name, p.name, p.slug,
    t.subscription_status::text, t.trial_expires_at, t.subscription_ends_at,
    t.is_suspended, t.past_due_since,
    (SELECT o.stripe_customer_id FROM public.orders o
       WHERE o.tenant_id = t.id AND o.stripe_customer_id IS NOT NULL
       ORDER BY o.created_at DESC LIMIT 1),
    (SELECT o.stripe_subscription_id FROM public.orders o
       WHERE o.tenant_id = t.id AND o.stripe_subscription_id IS NOT NULL
       ORDER BY o.created_at DESC LIMIT 1),
    (SELECT COUNT(*)::int FROM public.orders o WHERE o.tenant_id = t.id),
    (SELECT MAX(o.created_at) FROM public.orders o WHERE o.tenant_id = t.id),
    (SELECT MAX(w.processed_at) FROM public.webhook_logs w WHERE w.tenant_id = t.id)
  FROM public.tenants t
  LEFT JOIN public.subscription_plans p ON p.id = t.subscription_plan_id
  WHERE public.is_super_admin(auth.uid())
  ORDER BY t.created_at DESC;
$$;
GRANT EXECUTE ON FUNCTION public.admin_billing_overview() TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_request_stripe_resync(p_tenant_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.is_super_admin(auth.uid()) THEN RAISE EXCEPTION 'forbidden'; END IF;
  INSERT INTO public.audit_log(user_id, tenant_id, action, entity_type, entity_id, new_values)
  VALUES (auth.uid(), p_tenant_id, 'billing.resync_requested', 'subscription', p_tenant_id,
          jsonb_build_object('requested_at', now()));
END; $$;
GRANT EXECUTE ON FUNCTION public.admin_request_stripe_resync(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_reset_tenant_usage(p_tenant_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.is_super_admin(auth.uid()) THEN RAISE EXCEPTION 'forbidden'; END IF;
  UPDATE public.subscription_usage_counters
     SET used = 0, updated_at = now()
   WHERE tenant_id = p_tenant_id AND period_end > now();
  INSERT INTO public.audit_log(user_id, tenant_id, action, entity_type, entity_id, new_values)
  VALUES (auth.uid(), p_tenant_id, 'billing.usage_reset', 'subscription', p_tenant_id,
          jsonb_build_object('reset_at', now()));
END; $$;
GRANT EXECUTE ON FUNCTION public.admin_reset_tenant_usage(uuid) TO authenticated;
