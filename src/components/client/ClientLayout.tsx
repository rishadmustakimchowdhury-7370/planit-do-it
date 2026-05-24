import { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '@/lib/auth';
import { ClientSidebar } from './ClientSidebar';
import { Loader2 } from 'lucide-react';
import { useClientOrgBranding, hexToHslVar } from '@/hooks/useClientOrgBranding';

interface ClientLayoutProps {
  children: ReactNode;
  title?: string;
  subtitle?: string;
}

export function ClientLayout({ children, title, subtitle }: ClientLayoutProps) {
  const { user, isLoading, isClientUser, isOwner, isManager, isRecruiter, isSuperAdmin } = useAuth();
  const brand = useClientOrgBranding();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-7 w-7 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) return <Navigate to="/auth" replace />;

  // If user is an internal staff member (not a client user), block /client/* access
  if (!isClientUser && (isOwner || isManager || isRecruiter || isSuperAdmin)) {
    return <Navigate to="/dashboard" replace />;
  }

  if (!isClientUser) {
    return <Navigate to="/auth" replace />;
  }

  const primaryHsl = hexToHslVar(brand?.primary_color);
  // White-label: override --primary CSS var so all primary-themed UI follows the client's brand
  const styleOverride: React.CSSProperties = {
    fontFamily: "'Poppins', sans-serif",
    ...(primaryHsl ? ({ ['--primary' as any]: primaryHsl, ['--ring' as any]: primaryHsl }) : {}),
  };

  return (
    <div className="min-h-screen bg-background" style={styleOverride}>
      <ClientSidebar brand={brand} />
      <div className="lg:pl-64">
        {title && (
          <header className="border-b border-border bg-card/30 backdrop-blur-sm px-6 lg:px-10 py-6">
            <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
            {subtitle && <p className="text-sm text-muted-foreground mt-1">{subtitle}</p>}
          </header>
        )}
        <main className="px-4 lg:px-10 py-6 lg:py-8 max-w-[1500px]">{children}</main>
      </div>
    </div>
  );
}
