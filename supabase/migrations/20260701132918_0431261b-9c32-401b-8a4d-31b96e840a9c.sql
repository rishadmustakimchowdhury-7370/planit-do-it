DO $$
DECLARE
  v_qa uuid := 'aa000000-0000-4000-8000-000000000001';
  v_customer uuid;
  v_prev jsonb;
  v_arm_time timestamptz;
  v_disarm_time timestamptz;
  v_qa_enforced boolean;
  v_customer_enforced boolean;
  v_qa_enforced_after boolean;
  v_customer_enforced_after boolean;
BEGIN
  -- pick a real customer tenant that is NOT the QA tenant
  SELECT id INTO v_customer FROM public.tenants
   WHERE id <> v_qa
   ORDER BY created_at ASC
   LIMIT 1;

  -- snapshot previous state
  SELECT value INTO v_prev FROM public.platform_settings WHERE key='enforce_plan_limits';

  -- ARM
  v_arm_time := clock_timestamp();
  INSERT INTO public.platform_settings(key,value,updated_at)
    VALUES('enforce_plan_limits','true'::jsonb, now())
    ON CONFLICT (key) DO UPDATE SET value='true'::jsonb, updated_at=now();

  PERFORM public.write_audit_log(
    _action:='enforcement.arm_global.dry_run',
    _entity_type:='platform_settings', _entity_id:=NULL,
    _old:=v_prev, _new:='true'::jsonb,
    _metadata:=jsonb_build_object('key','enforce_plan_limits','mode','dry_run'),
    _tenant_id:=NULL, _user_id:=NULL);

  -- VERIFY while armed
  v_qa_enforced := public.is_tenant_enforced(v_qa);
  v_customer_enforced := public.is_tenant_enforced(v_customer);

  -- DISARM
  v_disarm_time := clock_timestamp();
  UPDATE public.platform_settings
     SET value='false'::jsonb, updated_at=now()
   WHERE key='enforce_plan_limits';

  PERFORM public.write_audit_log(
    _action:='enforcement.disarm_global.dry_run',
    _entity_type:='platform_settings', _entity_id:=NULL,
    _old:='true'::jsonb, _new:='false'::jsonb,
    _metadata:=jsonb_build_object(
      'key','enforce_plan_limits',
      'mode','dry_run',
      'arm_time', v_arm_time,
      'disarm_time', v_disarm_time,
      'window_ms', extract(epoch from (v_disarm_time - v_arm_time))*1000,
      'qa_tenant', v_qa,
      'qa_enforced_while_armed', v_qa_enforced,
      'customer_tenant', v_customer,
      'customer_enforced_while_armed', v_customer_enforced),
    _tenant_id:=NULL, _user_id:=NULL);

  -- VERIFY after disarm
  v_qa_enforced_after := public.is_tenant_enforced(v_qa);
  v_customer_enforced_after := public.is_tenant_enforced(v_customer);

  RAISE NOTICE 'KILL-SWITCH DRY RUN: armed=% disarmed=% window_ms=% qa_armed=% cust_armed=% qa_after=% cust_after=%',
    v_arm_time, v_disarm_time,
    extract(epoch from (v_disarm_time - v_arm_time))*1000,
    v_qa_enforced, v_customer_enforced,
    v_qa_enforced_after, v_customer_enforced_after;

  -- Safety assertions — abort if anything is wrong
  IF NOT v_qa_enforced OR NOT v_customer_enforced THEN
    RAISE EXCEPTION 'Kill switch did not enforce all tenants while armed (qa=%, cust=%)', v_qa_enforced, v_customer_enforced;
  END IF;
  IF v_customer_enforced_after THEN
    RAISE EXCEPTION 'Disarm failed — customer tenant still enforced';
  END IF;
END $$;

-- Final safety check: flag must be false
SELECT key, value, updated_at FROM public.platform_settings WHERE key='enforce_plan_limits';