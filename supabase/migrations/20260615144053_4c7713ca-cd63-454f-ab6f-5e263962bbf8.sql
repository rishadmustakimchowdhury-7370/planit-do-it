
CREATE TABLE public.apollo_integrations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL UNIQUE,
  api_key_encrypted text,
  api_key_iv text,
  api_key_last_four text,
  status text NOT NULL DEFAULT 'disconnected' CHECK (status IN ('connected','disconnected','error')),
  last_tested_at timestamptz,
  last_error text,
  connected_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.apollo_integrations TO authenticated;
GRANT ALL ON public.apollo_integrations TO service_role;

-- Column-level: hide encrypted key material from all client roles
REVOKE SELECT (api_key_encrypted, api_key_iv) ON public.apollo_integrations FROM authenticated;
REVOKE UPDATE, INSERT ON public.apollo_integrations FROM authenticated;

ALTER TABLE public.apollo_integrations ENABLE ROW LEVEL SECURITY;

-- Owners can read their tenant's row (still cannot see encrypted columns due to REVOKE above)
CREATE POLICY "apollo_owner_select" ON public.apollo_integrations FOR SELECT TO authenticated
  USING (public.is_owner_in_tenant(auth.uid(), tenant_id));

-- Managers can read status only (same row visibility; encrypted columns already revoked)
CREATE POLICY "apollo_manager_select" ON public.apollo_integrations FOR SELECT TO authenticated
  USING (
    public.is_owner_or_manager_in_tenant(auth.uid(), tenant_id)
    AND NOT public.is_owner_in_tenant(auth.uid(), tenant_id)
  );

-- Owners can delete (disconnect fallback); writes still blocked at column level for INSERT/UPDATE
CREATE POLICY "apollo_owner_delete" ON public.apollo_integrations FOR DELETE TO authenticated
  USING (public.is_owner_in_tenant(auth.uid(), tenant_id));

CREATE TRIGGER trg_apollo_integrations_updated_at
  BEFORE UPDATE ON public.apollo_integrations
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
