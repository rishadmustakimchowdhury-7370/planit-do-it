import { NavLink } from '@/components/NavLink';
import { useLocation } from 'react-router-dom';
import {
  LayoutDashboard,
  Users,
  Package,
  FileText,
  Mail,
  CreditCard,
  Settings,
  Shield,
  Video,
  MessageSquare,
  ScrollText,
  Palette,
  ArrowLeft,
  Calendar,
  Search,
  Tag,
  Building2,
  Megaphone,
  Menu,
  Link2,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { useIsMobile } from '@/hooks/use-mobile';
import { useState } from 'react';

const adminNavItems = [
  { title: 'Dashboard', url: '/admin', icon: LayoutDashboard },
  { title: 'Users', url: '/admin/users', icon: Users },
  { title: 'User Marketing', url: '/admin/marketing', icon: Megaphone },
  { title: 'Orders', url: '/admin/orders', icon: CreditCard },
  { title: 'Packages', url: '/admin/packages', icon: Package },
  { title: 'Promo Codes', url: '/admin/promo-codes', icon: Tag },
  { title: 'Billing Settings', url: '/admin/billing-settings', icon: CreditCard },
  { title: 'Stripe Connect', url: '/admin/stripe-connect', icon: Link2 },
  { title: 'Pages', url: '/admin/pages', icon: FileText },
  { title: 'Testimonials', url: '/admin/testimonials', icon: MessageSquare },
  { title: 'Trusted Clients', url: '/admin/trusted-clients', icon: Building2 },
  { title: 'Branding', url: '/admin/branding', icon: Palette },
  { title: 'SEO Settings', url: '/admin/seo', icon: Search },
  { title: 'Email Templates', url: '/admin/emails', icon: Mail },
  { title: 'Billing', url: '/admin/billing', icon: CreditCard },
  { title: 'Videos', url: '/admin/videos', icon: Video },
  { title: 'Events', url: '/events', icon: Calendar },
  { title: 'Live Chat', url: '/admin/chat', icon: MessageSquare },
  { title: 'Audit Logs', url: '/admin/logs', icon: ScrollText },
  { title: 'Settings', url: '/admin/settings', icon: Settings },
];

function SidebarContent({ onNavigate }: { onNavigate?: () => void }) {
  const location = useLocation();
  const currentPath = location.pathname;

  const isActive = (path: string) => {
    if (path === '/admin') {
      return currentPath === '/admin';
    }
    return currentPath.startsWith(path);
  };

  return (
    <>
      {/* Header */}
      <div className="p-4 border-b border-border">
        <div className="flex items-center gap-2 mb-4">
          <Shield className="h-6 w-6 text-primary" />
          <span className="font-bold text-lg">Super Admin</span>
        </div>
        <NavLink to="/dashboard" onClick={onNavigate}>
          <Button variant="ghost" size="sm" className="w-full justify-start">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to App
          </Button>
        </NavLink>
      </div>

      {/* Navigation */}
      <ScrollArea className="flex-1 overflow-y-auto">
        <nav className="space-y-1 p-3 pb-6">
          {adminNavItems.map((item) => (
            <NavLink
              key={item.url}
              to={item.url}
              end={item.url === '/admin'}
              onClick={onNavigate}
              className={cn(
                'flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors',
                'hover:bg-accent/50 hover:text-accent-foreground',
                isActive(item.url)
                  ? 'bg-primary/10 text-primary'
                  : 'text-muted-foreground'
              )}
              activeClassName="bg-primary/10 text-primary"
            >
              <item.icon className="h-4 w-4" />
              {item.title}
            </NavLink>
          ))}
        </nav>
      </ScrollArea>
    </>
  );
}

export function AdminSidebar() {
  const isMobile = useIsMobile();
  const [mobileOpen, setMobileOpen] = useState(false);

  // Mobile sidebar using Sheet
  if (isMobile) {
    return (
      <>
        {/* Mobile Header with Menu Button */}
        <div className="fixed top-0 left-0 right-0 h-14 bg-card flex items-center px-4 z-50 border-b border-border">
          <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon">
                <Menu className="h-5 w-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-72 p-0 bg-card border-border">
              <div className="flex flex-col h-full">
                <SidebarContent onNavigate={() => setMobileOpen(false)} />
              </div>
            </SheetContent>
          </Sheet>
          <div className="ml-3 flex items-center gap-2">
            <Shield className="h-5 w-5 text-primary" />
            <span className="font-bold">Super Admin</span>
          </div>
        </div>
        {/* Spacer for fixed header */}
        <div className="h-14" />
      </>
    );
  }

  // Desktop sidebar
  return (
    <div className="w-64 border-r border-border bg-card/50 flex flex-col h-full">
      <SidebarContent />
    </div>
  );
}
