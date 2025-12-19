-- Create permissions table for granular access control
CREATE TABLE IF NOT EXISTS public.user_permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  permission TEXT NOT NULL,
  granted_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(user_id, tenant_id, permission)
);

-- Enable RLS
ALTER TABLE public.user_permissions ENABLE ROW LEVEL SECURITY;

-- Owners can manage all permissions in their tenant
CREATE POLICY "Owners can manage permissions in their tenant"
ON public.user_permissions
FOR ALL
USING (
  tenant_id = get_user_tenant_id(auth.uid()) AND is_owner(auth.uid())
);

-- Users can view their own permissions
CREATE POLICY "Users can view their own permissions"
ON public.user_permissions
FOR SELECT
USING (user_id = auth.uid() OR is_owner(auth.uid()));

-- Add index for faster lookups
CREATE INDEX idx_user_permissions_user_tenant ON public.user_permissions(user_id, tenant_id);
CREATE INDEX idx_user_permissions_permission ON public.user_permissions(permission);

-- Add updated_at trigger
CREATE TRIGGER update_user_permissions_updated_at
BEFORE UPDATE ON public.user_permissions
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

COMMENT ON TABLE public.user_permissions IS 'Granular permissions for users to control access to specific features';
COMMENT ON COLUMN public.user_permissions.permission IS 'Permission key (e.g., can_add_jobs, can_add_clients, can_use_ai_match, can_view_reports, can_manage_team, can_view_billing)';
