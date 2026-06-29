
-- M3: Promo eligibility extensions + redemption RPC + notification helper

-- 1. Extend promo_codes with eligibility flags & per-customer limit
ALTER TABLE public.promo_codes
  ADD COLUMN IF NOT EXISTS eligible_monthly boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS eligible_yearly  boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS eligible_trial   boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS per_customer_limit integer;

-- 2. Replace validate_promo_code with full eligibility logic
CREATE OR REPLACE FUNCTION public.validate_promo_code(
  _code text,
  _plan_id uuid DEFAULT NULL,
  _interval text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_promo public.promo_codes%ROWTYPE;
  v_user uuid := auth.uid();
  v_tenant uuid;
  v_uses_count integer;
  v_user_uses integer;
  v_plan public.subscription_plans%ROWTYPE;
  v_price numeric;
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

  -- Interval eligibility
  IF _interval = 'monthly' AND NOT v_promo.eligible_monthly THEN
    RETURN jsonb_build_object('valid', false, 'reason', 'monthly_not_eligible', 'message', 'This promo code cannot be used on monthly plans.');
  END IF;
  IF _interval = 'yearly' AND NOT v_promo.eligible_yearly THEN
    RETURN jsonb_build_object('valid', false, 'reason', 'yearly_not_eligible', 'message', 'This promo code cannot be used on yearly plans.');
  END IF;
  IF _interval = 'trial' AND NOT v_promo.eligible_trial THEN
    RETURN jsonb_build_object('valid', false, 'reason', 'trial_not_eligible', 'message', 'This promo code cannot be used with a trial.');
  END IF;

  -- Plan eligibility
  IF v_promo.applicable_plans IS NOT NULL
     AND jsonb_typeof(v_promo.applicable_plans) = 'array'
     AND jsonb_array_length(v_promo.applicable_plans) > 0
     AND _plan_id IS NOT NULL
     AND NOT (v_promo.applicable_plans ? _plan_id::text) THEN
    RETURN jsonb_build_object('valid', false, 'reason', 'plan_not_eligible', 'message', 'This promo code does not apply to the selected plan.');
  END IF;

  -- Minimum purchase amount (against plan price for chosen interval)
  IF _plan_id IS NOT NULL AND v_promo.min_purchase_amount IS NOT NULL AND v_promo.min_purchase_amount > 0 THEN
    SELECT * INTO v_plan FROM public.subscription_plans WHERE id = _plan_id LIMIT 1;
    IF FOUND THEN
      v_price := CASE WHEN _interval = 'yearly' THEN COALESCE(v_plan.price_yearly, v_plan.price_monthly) ELSE v_plan.price_monthly END;
      IF v_price < v_promo.min_purchase_amount THEN
        RETURN jsonb_build_object('valid', false, 'reason', 'below_minimum', 'message', format('This promo requires a minimum purchase of %s.', v_promo.min_purchase_amount));
      END IF;
    END IF;
  END IF;

  -- Global maximum redemptions
  SELECT count(*) INTO v_uses_count FROM public.promo_code_uses WHERE promo_code_id = v_promo.id;
  IF v_promo.max_uses IS NOT NULL AND v_uses_count >= v_promo.max_uses THEN
    RETURN jsonb_build_object('valid', false, 'reason', 'max_uses_reached', 'message', 'This promo code has reached its maximum number of redemptions.');
  END IF;

  -- Per-customer / duplicate redemption
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

  RETURN jsonb_build_object(
    'valid', true,
    'promo_id', v_promo.id,
    'code', v_promo.code,
    'discount_type', v_promo.discount_type,
    'discount_value', v_promo.discount_value,
    'description', v_promo.description,
    'message', 'Promo code applied successfully.'
  );
END;
$$;

REVOKE ALL ON FUNCTION public.validate_promo_code(text, uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.validate_promo_code(text, uuid, text) TO authenticated, service_role;

-- 3. Record a promo redemption atomically with audit log
CREATE OR REPLACE FUNCTION public.record_promo_use(
  _promo_id uuid,
  _order_id uuid,
  _discount numeric
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_tenant uuid;
  v_use_id uuid;
  v_code text;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'auth required';
  END IF;
  SELECT tenant_id INTO v_tenant FROM public.profiles WHERE id = v_user LIMIT 1;
  SELECT code INTO v_code FROM public.promo_codes WHERE id = _promo_id LIMIT 1;

  INSERT INTO public.promo_code_uses (promo_code_id, user_id, tenant_id, order_id, discount_applied)
  VALUES (_promo_id, v_user, v_tenant, _order_id, COALESCE(_discount, 0))
  RETURNING id INTO v_use_id;

  UPDATE public.promo_codes SET uses_count = COALESCE(uses_count,0) + 1 WHERE id = _promo_id;

  PERFORM public.write_audit_log(
    'promo_redeemed', 'promo_code', _promo_id,
    NULL,
    jsonb_build_object('order_id', _order_id, 'discount', _discount, 'code', v_code),
    NULL, v_tenant, v_user
  );

  RETURN v_use_id;
END;
$$;

REVOKE ALL ON FUNCTION public.record_promo_use(uuid, uuid, numeric) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.record_promo_use(uuid, uuid, numeric) TO authenticated, service_role;

-- 4. Server-side notification helper (workspace owners)
CREATE OR REPLACE FUNCTION public.notify_workspace_owners(
  _tenant_id uuid,
  _type text,
  _title text,
  _message text,
  _link text DEFAULT NULL,
  _metadata jsonb DEFAULT NULL
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_count integer := 0;
BEGIN
  IF _tenant_id IS NULL THEN RETURN 0; END IF;

  INSERT INTO public.notifications (tenant_id, user_id, type, title, message, link, metadata)
  SELECT _tenant_id, ur.user_id, _type, _title, _message, _link, COALESCE(_metadata, '{}'::jsonb)
    FROM public.user_roles ur
    JOIN public.profiles p ON p.id = ur.user_id
   WHERE p.tenant_id = _tenant_id
     AND ur.role IN ('owner','super_admin');

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

REVOKE ALL ON FUNCTION public.notify_workspace_owners(uuid, text, text, text, text, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.notify_workspace_owners(uuid, text, text, text, text, jsonb) TO authenticated, service_role;
