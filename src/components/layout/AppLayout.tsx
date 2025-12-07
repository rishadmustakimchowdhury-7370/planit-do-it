import { ReactNode } from 'react';
import { Sidebar } from './Sidebar';
import { Header } from './Header';

interface AppLayoutProps {
  children: ReactNode;
  title?: string;
  subtitle?: string;
}

export function AppLayout({ children, title, subtitle }: AppLayoutProps) {
  return (
    <div className="min-h-screen bg-background">
      <Sidebar />
      <div className="pl-20 md:pl-[280px] transition-all duration-300">
        {title && <Header title={title} subtitle={subtitle} />}
        <main className="p-6">
          {children}
        </main>
      </div>
    </div>
  );
}