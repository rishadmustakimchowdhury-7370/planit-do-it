import { ReactNode } from 'react';
import { useAuth } from '@/lib/auth';
import { Navigate } from 'react-router-dom';

interface RoleGateProps {
  children: ReactNode;
  allowedRoles: ('owner' | 'manager' | 'recruiter')[];
  fallback?: ReactNode;
  redirectTo?: string;
}

/**
 * RoleGate - Conditional rendering based on user roles
 * 
 * Usage:
 * <RoleGate allowedRoles={['owner']}>
 *   <OwnerOnlyContent />
 * </RoleGate>
 * 
 * <RoleGate allowedRoles={['owner', 'manager']} redirectTo="/dashboard">
 *   <ManagementContent />
 * </RoleGate>
 */
export function RoleGate({ children, allowedRoles, fallback, redirectTo }: RoleGateProps) {
  const { roles, isLoading } = useAuth();

  if (isLoading) {
    return null; // or a loading spinner
  }

  const userRole = roles[0]?.role;
  const hasAccess = userRole && allowedRoles.includes(userRole);

  if (!hasAccess) {
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
    isOwner: userRole === 'owner',
    isManager: userRole === 'manager',
    isRecruiter: userRole === 'recruiter',
    role: userRole,
  };
}
