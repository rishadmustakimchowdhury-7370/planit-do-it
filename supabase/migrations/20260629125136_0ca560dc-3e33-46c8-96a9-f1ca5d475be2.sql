
-- M2: write_audit_log + validate_promo_code RPCs

CREATE OR REPLACE FUNCTION public.write_audit_log(
  _action text,
  _entity_type text,
  _entity_id uuid DEFAULT NULL,
  _old jsonb DEFAULT NULL,
  _new jsonb DEFAULT NULL,
  _metadata jsonb DEFAULT NULL,
  _tenant_id uuid DEFAULT NULL,
  _user_id uuid DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user_id uuid := COALESCE(_user_id, auth.uid());
  v_tenant_id uuid := _tenant_id;
  v_new_values jsonb := _new;
  v_id uuid;
BEGIN
  IF v_tenant_id IS NULL AND v_user_id IS NOT NULL THEN
    SELECT tenant_id INTO v_tenant_id FROM public.profiles WHERE id = v_user_id LIMIT 1;
  END IF;

  IF _metadata IS NOT NULL THEN
    v_new_values := COALESCE(v_new_values, '{}'::jsonb) || jsonb_build_object('_metadata', _metadata);
  END IF;

  INSERT INTO public.audit_log (user_id, tenant_id, action, entity_type, entity_id, old_values, new_values)
  VALUES (v_user_id, v_tenant_id, _action, _entity_type, _entity_id, _old, v_new_values)
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

REVOKE ALL ON FUNCTION public.write_audit_log(text, text, uuid, jsonb, jsonb, jsonb, uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.write_audit_log(text, text, uuid, jsonb, jsonb, jsonb, uuid, uuid) TO authenticated, service_role;


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
BEGIN
  IF _code IS NULL OR length(trim(_code)) = 0 THEN
    RETURN jsonb_build_object('valid', false, 'reason', 'empty_code');
  END IF;

  SELECT * INTO v_promo FROM public.promo_codes WHERE upper(code) = upper(trim(_code)) LIMIT 1;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('valid', false, 'reason', 'not_found');
  END IF;
  IF NOT v_promo.is_active THEN
    RETURN jsonb_build_object('valid', false, 'reason', 'inactive');
  END IF;
  IF v_promo.valid_from IS NOT NULL AND v_promo.valid_from > now() THEN
    RETURN jsonb_build_object('valid', false, 'reason', 'not_started');
  END IF;
  IF v_promo.valid_until IS NOT NULL AND v_promo.valid_until < now() THEN
    RETURN jsonb_build_object('valid', false, 'reason', 'expired');
  END IF;

  IF v_promo.applicable_plans IS NOT NULL
     AND jsonb_typeof(v_promo.applicable_plans) = 'array'
     AND jsonb_array_length(v_promo.applicable_plans) > 0
     AND _plan_id IS NOT NULL
     AND NOT (v_promo.applicable_plans ? _plan_id::text) THEN
    RETURN jsonb_build_object('valid', false, 'reason', 'plan_not_eligible');
  END IF;

  SELECT count(*) INTO v_uses_count FROM public.promo_code_uses WHERE promo_code_id = v_promo.id;
  IF v_promo.max_uses IS NOT NULL AND v_uses_count >= v_promo.max_uses THEN
    RETURN jsonb_build_object('valid', false, 'reason', 'max_uses_reached');
  END IF;

  IF v_user IS NOT NULL THEN
    SELECT tenant_id INTO v_tenant FROM public.profiles WHERE id = v_user LIMIT 1;
    SELECT count(*) INTO v_user_uses
      FROM public.promo_code_uses
     WHERE promo_code_id = v_promo.id
       AND (user_id = v_user OR (v_tenant IS NOT NULL AND tenant_id = v_tenant));
    IF v_user_uses > 0 THEN
      RETURN jsonb_build_object('valid', false, 'reason', 'already_used');
    END IF;
  END IF;

  RETURN jsonb_build_object(
    'valid', true,
    'promo_id', v_promo.id,
    'code', v_promo.code,
    'discount_type', v_promo.discount_type,
    'discount_value', v_promo.discount_value,
    'description', v_promo.description
  );
END;
$$;

REVOKE ALL ON FUNCTION public.validate_promo_code(text, uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.validate_promo_code(text, uuid, text) TO authenticated, service_role;
