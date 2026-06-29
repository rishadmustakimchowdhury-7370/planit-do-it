
-- 1. Stripe coupon sync columns on promo_codes
ALTER TABLE public.promo_codes
  ADD COLUMN IF NOT EXISTS stripe_coupon_id text,
  ADD COLUMN IF NOT EXISTS stripe_promotion_code_id text,
  ADD COLUMN IF NOT EXISTS last_synced_at timestamptz,
  ADD COLUMN IF NOT EXISTS sync_status text,
  ADD COLUMN IF NOT EXISTS sync_error text;

CREATE INDEX IF NOT EXISTS idx_promo_codes_stripe_promotion ON public.promo_codes(stripe_promotion_code_id);

-- 2. Enriched validate_promo_code — returns server-computed pricing
CREATE OR REPLACE FUNCTION public.validate_promo_code(_code text, _plan_id uuid DEFAULT NULL::uuid, _interval text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_promo public.promo_codes%ROWTYPE;
  v_user uuid := auth.uid();
  v_tenant uuid;
  v_uses_count integer;
  v_user_uses integer;
  v_plan public.subscription_plans%ROWTYPE;
  v_price numeric;
  v_discount numeric := 0;
  v_final numeric := 0;
  v_currency text := 'USD';
BEGIN
  IF _code IS NULL OR length(trim(_code)) = 0 THEN
    RETURN jsonb_build_object('valid', false, 'reason', 'empty_code', 'message', 'Please enter a promo code.');
  END IF;

  SELECT * INTO v_promo FROM public.promo_codes WHERE upper(code) = upper(trim(_code)) LIMIT 1;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('valid', false, 'reason', 'not_found', 'message', 'This promo code is not valid.');
  END IF;
  IF NOT v_promo.is_active THEN
    RETURN jsonb_build_object('valid', false, 'reason', 'inactive', 'message', 'This promo code is no longer active.');
  END IF;
  IF v_promo.valid_from IS NOT NULL AND v_promo.valid_from > now() THEN
    RETURN jsonb_build_object('valid', false, 'reason', 'not_started', 'message', 'This promo code is not yet available.');
  END IF;
  IF v_promo.valid_until IS NOT NULL AND v_promo.valid_until < now() THEN
    RETURN jsonb_build_object('valid', false, 'reason', 'expired', 'message', 'This promo code has expired.');
  END IF;

  IF _interval = 'monthly' AND NOT v_promo.eligible_monthly THEN
    RETURN jsonb_build_object('valid', false, 'reason', 'monthly_not_eligible', 'message', 'This promo code cannot be used on monthly plans.');
  END IF;
  IF _interval = 'yearly' AND NOT v_promo.eligible_yearly THEN
    RETURN jsonb_build_object('valid', false, 'reason', 'yearly_not_eligible', 'message', 'This promo code cannot be used on yearly plans.');
  END IF;
  IF _interval = 'trial' AND NOT v_promo.eligible_trial THEN
    RETURN jsonb_build_object('valid', false, 'reason', 'trial_not_eligible', 'message', 'This promo code cannot be used with a trial.');
  END IF;

  IF v_promo.applicable_plans IS NOT NULL
     AND jsonb_typeof(v_promo.applicable_plans) = 'array'
     AND jsonb_array_length(v_promo.applicable_plans) > 0
     AND _plan_id IS NOT NULL
     AND NOT (v_promo.applicable_plans ? _plan_id::text) THEN
    RETURN jsonb_build_object('valid', false, 'reason', 'plan_not_eligible', 'message', 'This promo code does not apply to the selected plan.');
  END IF;

  IF _plan_id IS NOT NULL THEN
    SELECT * INTO v_plan FROM public.subscription_plans WHERE id = _plan_id LIMIT 1;
    IF FOUND THEN
      v_price := CASE WHEN _interval = 'yearly' THEN COALESCE(v_plan.price_yearly, v_plan.price_monthly) ELSE v_plan.price_monthly END;
      v_currency := COALESCE(v_plan.currency, v_promo.currency, 'USD');
      IF v_promo.min_purchase_amount IS NOT NULL AND v_promo.min_purchase_amount > 0 AND v_price < v_promo.min_purchase_amount THEN
        RETURN jsonb_build_object('valid', false, 'reason', 'below_minimum', 'message', format('This promo requires a minimum purchase of %s.', v_promo.min_purchase_amount));
      END IF;
    END IF;
  END IF;

  SELECT count(*) INTO v_uses_count FROM public.promo_code_uses WHERE promo_code_id = v_promo.id;
  IF v_promo.max_uses IS NOT NULL AND v_uses_count >= v_promo.max_uses THEN
    RETURN jsonb_build_object('valid', false, 'reason', 'max_uses_reached', 'message', 'This promo code has reached its maximum number of redemptions.');
  END IF;

  IF v_user IS NOT NULL THEN
    SELECT tenant_id INTO v_tenant FROM public.profiles WHERE id = v_user LIMIT 1;
    SELECT count(*) INTO v_user_uses
      FROM public.promo_code_uses
     WHERE promo_code_id = v_promo.id
       AND (user_id = v_user OR (v_tenant IS NOT NULL AND tenant_id = v_tenant));
    IF v_promo.per_customer_limit IS NOT NULL THEN
      IF v_user_uses >= v_promo.per_customer_limit THEN
        RETURN jsonb_build_object('valid', false, 'reason', 'per_customer_limit', 'message', 'You have already used this promo code the maximum number of times.');
      END IF;
    ELSIF v_user_uses > 0 THEN
      RETURN jsonb_build_object('valid', false, 'reason', 'already_used', 'message', 'You have already used this promo code.');
    END IF;
  END IF;

  -- Server-side pricing math (single source of truth)
  IF v_price IS NOT NULL THEN
    IF v_promo.discount_type = 'percentage' THEN
      v_discount := round((v_price * v_promo.discount_value / 100.0)::numeric, 2);
    ELSE
      v_discount := LEAST(v_promo.discount_value, v_price);
    END IF;
    v_final := GREATEST(0, v_price - v_discount);
  END IF;

  RETURN jsonb_build_object(
    'valid', true,
    'promo_id', v_promo.id,
    'code', v_promo.code,
    'discount_type', v_promo.discount_type,
    'discount_value', v_promo.discount_value,
    'description', v_promo.description,
    'stripe_coupon_id', v_promo.stripe_coupon_id,
    'stripe_promotion_code_id', v_promo.stripe_promotion_code_id,
    'currency', v_currency,
    'original_amount', v_price,
    'discount_amount', v_discount,
    'final_amount', v_final,
    'message', 'Promo code applied successfully.'
  );
END;
$function$;

-- 3. Unified billing-event notifier (audit + workspace notifications in one call)
CREATE OR REPLACE FUNCTION public.notify_billing_event(
  _tenant_id uuid,
  _event text,
  _title text,
  _message text,
  _link text DEFAULT '/billing',
  _metadata jsonb DEFAULT '{}'::jsonb
) RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
  v_count integer := 0;
BEGIN
  IF _tenant_id IS NULL THEN RETURN 0; END IF;

  v_count := public.notify_workspace_owners(_tenant_id, _event, _title, _message, _link, _metadata);

  PERFORM public.write_audit_log(
    _action      := _event,
    _entity_type := 'billing',
    _entity_id   := NULL,
    _old         := NULL,
    _new         := _metadata,
    _tenant_id   := _tenant_id,
    _user_id     := NULL
  );

  RETURN v_count;
END;
$$;

REVOKE ALL ON FUNCTION public.notify_billing_event(uuid, text, text, text, text, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.notify_billing_event(uuid, text, text, text, text, jsonb) TO service_role;
