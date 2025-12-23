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
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';

const adminNavItems = [
  { title: 'Dashboard', url: '/admin', icon: LayoutDashboard },
  { title: 'Users', url: '/admin/users', icon: Users },
  { title: 'Orders', url: '/admin/orders', icon: CreditCard },
  { title: 'Packages', url: '/admin/packages', icon: Package },
  { title: 'Promo Codes', url: '/admin/promo-codes', icon: Tag },
  { title: 'Pages', url: '/admin/pages', icon: FileText },
  { title: 'Testimonials', url: '/admin/testimonials', icon: MessageSquare },
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

export function AdminSidebar() {
  const location = useLocation();
  const currentPath = location.pathname;

  const isActive = (path: string) => {
    if (path === '/admin') {
      return currentPath === '/admin';
    }
    return currentPath.startsWith(path);
  };

  return (
    <div className="w-64 border-r border-border bg-card/50 flex flex-col h-full">
      {/* Header */}
      <div className="p-4 border-b border-border">
        <div className="flex items-center gap-2 mb-4">
          <Shield className="h-6 w-6 text-primary" />
          <span className="font-bold text-lg">Super Admin</span>
        </div>
        <NavLink to="/dashboard">
          <Button variant="ghost" size="sm" className="w-full justify-start">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to App
          </Button>
        </NavLink>
      </div>

      {/* Navigation */}
      <ScrollArea className="flex-1 p-3">
        <nav className="space-y-1">
          {adminNavItems.map((item) => (
            <NavLink
              key={item.url}
              to={item.url}
              end={item.url === '/admin'}
              className={cn(
                'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors',
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
    </div>
  );
}
