import { ReactNode } from 'react';
import { useAuth } from '@/lib/auth';
import { Navigate } from 'react-router-dom';
import { usePermissions, Permission } from '@/hooks/usePermissions';

interface RoleGateProps {
  children: ReactNode;
  allowedRoles: ('super_admin' | 'owner' | 'manager' | 'recruiter')[];
  requiredPermission?: Permission;
  fallback?: ReactNode;
  redirectTo?: string;
}

/**
 * RoleGate - Conditional rendering based on user roles and permissions
 * 
 * Usage:
 * <RoleGate allowedRoles={['owner']}>
 *   <OwnerOnlyContent />
 * </RoleGate>
 * 
 * <RoleGate allowedRoles={['owner', 'manager']} requiredPermission="can_add_jobs" redirectTo="/dashboard">
 *   <AddJobButton />
 * </RoleGate>
 */
export function RoleGate({ children, allowedRoles, requiredPermission, fallback, redirectTo }: RoleGateProps) {
  const { roles, isLoading, isOwner, isSuperAdmin } = useAuth();
  const { hasPermission, isLoading: permissionsLoading } = usePermissions();

  if (isLoading || permissionsLoading) {
    return null; // or a loading spinner
  }

  const userRole = roles[0]?.role;
  const hasRoleAccess = userRole && allowedRoles.includes(userRole);

  // Super admins always have access
  if (isSuperAdmin) {
    return <>{children}</>;
  }

  // Owners have access unless super_admin is specifically required
  if (isOwner && !allowedRoles.every(r => r === 'super_admin')) {
    return <>{children}</>;
  }

  // Check role access first
  if (!hasRoleAccess) {
    if (redirectTo) {
      return <Navigate to={redirectTo} replace />;
    }
    return fallback ? <>{fallback}</> : null;
  }

  // If a permission is required, check it (only for non-owners)
  if (requiredPermission && !hasPermission(requiredPermission)) {
    if (redirectTo) {
      return <Navigate to={redirectTo} replace />;
    }
    return fallback ? <>{fallback}</> : null;
  }

  return <>{children}</>;
}

// Helper hook for checking specific roles
export function useRoleCheck() {
  const { roles } = useAuth();
  const userRole = roles[0]?.role;

  return {
    isSuperAdmin: userRole === 'super_admin',
    isOwner: userRole === 'owner',
    isManager: userRole === 'manager',
    isRecruiter: userRole === 'recruiter',
    role: userRole,
  };
}
