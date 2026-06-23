
DROP FUNCTION IF EXISTS public.get_client_invitation_by_token(text);
DROP FUNCTION IF EXISTS public.get_team_invitation_by_token(text);

CREATE FUNCTION public.get_team_invitation_by_token(p_token text)
RETURNS TABLE(
  id uuid, tenant_id uuid, email text, role text, status text,
  expires_at timestamptz, tenant_name text
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT ti.id, ti.tenant_id, ti.email, ti.role::text, ti.status, ti.expires_at, t.name
  FROM public.team_invitations ti
  LEFT JOIN public.tenants t ON t.id = ti.tenant_id
  WHERE ti.token = p_token LIMIT 1
$$;
REVOKE ALL ON FUNCTION public.get_team_invitation_by_token(text) FROM public;
GRANT EXECUTE ON FUNCTION public.get_team_invitation_by_token(text) TO anon, authenticated;

CREATE FUNCTION public.get_client_invitation_by_token(p_token text)
RETURNS TABLE(
  id uuid, tenant_id uuid, email text, role text, status text,
  expires_at timestamptz, client_org_id uuid
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT ci.id, ci.tenant_id, ci.email, ci.role::text, ci.status, ci.expires_at, ci.client_org_id
  FROM public.client_invitations ci
  WHERE ci.token = p_token LIMIT 1
$$;
REVOKE ALL ON FUNCTION public.get_client_invitation_by_token(text) FROM public;
GRANT EXECUTE ON FUNCTION public.get_client_invitation_by_token(text) TO anon, authenticated;
