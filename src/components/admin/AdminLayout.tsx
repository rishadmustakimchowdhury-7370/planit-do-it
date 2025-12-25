import { ReactNode, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/lib/auth';
import { AdminSidebar } from './AdminSidebar';
import { Loader2, Shield } from 'lucide-react';
import { useIsMobile } from '@/hooks/use-mobile';

interface AdminLayoutProps {
  children: ReactNode;
  title: string;
  description?: string;
}

export function AdminLayout({ children, title, description }: AdminLayoutProps) {
  const { isSuperAdmin, isLoading } = useAuth();
  const navigate = useNavigate();
  const isMobile = useIsMobile();

  useEffect(() => {
    if (!isLoading && !isSuperAdmin) {
      navigate('/dashboard');
    }
  }, [isSuperAdmin, isLoading, navigate]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!isSuperAdmin) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center px-4">
          <Shield className="h-16 w-16 text-destructive mx-auto mb-4" />
          <h1 className="text-2xl font-bold mb-2">Access Denied</h1>
          <p className="text-muted-foreground">You don't have permission to access this area.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className={isMobile ? 'min-h-screen' : 'flex min-h-screen'}>
        <AdminSidebar />
        <main className={isMobile ? 'w-full' : 'flex-1'}>
          <div className="p-4 md:p-6 lg:p-8">
            {/* Header */}
            <header className="mb-6 md:mb-8">
              <h1 className="text-xl md:text-2xl lg:text-3xl font-bold text-foreground">{title}</h1>
              {description && (
                <p className="text-sm md:text-base text-muted-foreground mt-1">{description}</p>
              )}
            </header>

            {/* Content */}
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
