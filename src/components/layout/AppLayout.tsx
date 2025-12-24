import { ReactNode } from 'react';
import { Sidebar } from './Sidebar';
import { Header } from './Header';
import { useIsMobile } from '@/hooks/use-mobile';

interface AppLayoutProps {
  children: ReactNode;
  title?: string;
  subtitle?: string;
}

export function AppLayout({ children, title, subtitle }: AppLayoutProps) {
  const isMobile = useIsMobile();

  return (
    <div className="min-h-screen bg-background">
      <Sidebar />
      <div className={isMobile ? '' : 'pl-20 lg:pl-64 transition-all duration-300'}>
        {title && <Header title={title} subtitle={subtitle} />}
        <main className="p-4 md:p-6 lg:p-8 max-w-[1600px]">
          {children}
        </main>
      </div>
    </div>
  );
}