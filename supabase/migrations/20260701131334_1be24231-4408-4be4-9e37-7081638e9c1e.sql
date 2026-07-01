
REVOKE ALL ON FUNCTION public.commit_feature_usage(uuid,text,integer,uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.enforcement_arm_global() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.enforcement_disarm_global() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.enforcement_add_tenant(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.enforcement_remove_tenant(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public._meter_log(uuid,uuid,text,text,integer,jsonb) FROM PUBLIC, anon, authenticated;
