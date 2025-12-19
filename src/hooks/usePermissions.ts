import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth';

export type Permission = 
  | 'can_add_jobs'
  | 'can_add_clients'
  | 'can_use_ai_match'
  | 'can_view_reports'
  | 'can_manage_team'
  | 'can_view_billing';

export function usePermissions(userId?: string) {
  const { user, tenantId } = useAuth();
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function fetchPermissions() {
      const targetUserId = userId || user?.id;
      if (!targetUserId || !tenantId) {
        setIsLoading(false);
        return;
      }

      try {
        const { data, error } = await supabase
          .from('user_permissions')
          .select('permission')
          .eq('user_id', targetUserId)
          .eq('tenant_id', tenantId);

        if (error) throw error;

        setPermissions(data?.map(p => p.permission as Permission) || []);
      } catch (error) {
        console.error('Error fetching permissions:', error);
      } finally {
        setIsLoading(false);
      }
    }

    fetchPermissions();
  }, [userId, user?.id, tenantId]);

  const hasPermission = (permission: Permission) => {
    return permissions.includes(permission);
  };

  return { permissions, hasPermission, isLoading };
}

export const PERMISSION_LABELS: Record<Permission, string> = {
  can_add_jobs: 'Add Jobs',
  can_add_clients: 'Add Clients',
  can_use_ai_match: 'Use AI Matching',
  can_view_reports: 'View Reports',
  can_manage_team: 'Manage Team',
  can_view_billing: 'View Billing',
};

export const PERMISSION_DESCRIPTIONS: Record<Permission, string> = {
  can_add_jobs: 'Create and edit job postings',
  can_add_clients: 'Add and manage client companies',
  can_use_ai_match: 'Run AI-powered candidate matching',
  can_view_reports: 'Access recruitment reports and analytics',
  can_manage_team: 'Invite and manage team members',
  can_view_billing: 'View subscription and billing information',
};
