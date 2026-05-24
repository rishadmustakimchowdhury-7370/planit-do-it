import { useEffect, useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { LayoutDashboard, Briefcase, Users, CalendarClock, Bell, LogOut, Building2 } from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';

const items = [
  { to: '/client/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/client/jobs', label: 'Jobs', icon: Briefcase },
  { to: '/client/candidates', label: 'Candidates', icon: Users },
  { to: '/client/interviews', label: 'Interviews', icon: CalendarClock },
  { to: '/client/notifications', label: 'Notifications', icon: Bell },
];

export function ClientSidebar() {
  const { pathname } = useLocation();
  const { user, profile, clientPortal, signOut } = useAuth();
  const [unread, setUnread] = useState(0);

  useEffect(() => {
    if (!user) return;
    const load = async () => {
      const { count } = await supabase
        .from('notifications')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .eq('is_read', false);
      setUnread(count || 0);
    };
    load();
    const channel = supabase
      .channel(`client-sidebar-notif-${user.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'notifications', filter: `user_id=eq.${user.id}` }, load)
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user?.id]);

  return (
    <aside className="hidden lg:flex fixed left-0 top-0 bottom-0 w-64 flex-col border-r border-border bg-card/40 backdrop-blur-sm z-30"
           style={{ fontFamily: "'Poppins', sans-serif" }}>
      <div className="px-6 py-6 border-b border-border">
        <div className="flex items-center gap-2 mb-1">
          <div className="h-9 w-9 rounded-lg bg-gradient-to-br from-primary to-accent flex items-center justify-center">
            <Building2 className="h-4.5 w-4.5 text-primary-foreground" />
          </div>
          <div>
            <div className="text-sm font-semibold tracking-tight">Client Portal</div>
            <div className="text-[11px] text-muted-foreground">HireMetrics</div>
          </div>
        </div>
      </div>

      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        {items.map(({ to, label, icon: Icon }) => {
          const active = pathname === to || pathname.startsWith(to + '/');
          const showBadge = to === '/client/notifications' && unread > 0;
          return (
            <NavLink
              key={to}
              to={to}
              className={cn(
                'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all',
                active
                  ? 'bg-primary text-primary-foreground shadow-sm'
                  : 'text-muted-foreground hover:bg-muted hover:text-foreground'
              )}
            >
              <Icon className="h-4 w-4" />
              <span className="flex-1">{label}</span>
              {showBadge && (
                <span className={cn(
                  'text-[10px] font-semibold rounded-full h-5 min-w-5 px-1.5 flex items-center justify-center',
                  active ? 'bg-primary-foreground text-primary' : 'bg-primary text-primary-foreground'
                )}>
                  {unread > 99 ? '99+' : unread}
                </span>
              )}
            </NavLink>
          );
        })}
      </nav>

      <div className="px-3 py-4 border-t border-border space-y-2">
        <div className="px-3 py-2 rounded-lg bg-muted/40">
          <div className="text-xs font-semibold truncate">{profile?.full_name || clientPortal?.full_name || profile?.email}</div>
          <div className="text-[11px] text-muted-foreground truncate">{profile?.email}</div>
        </div>
        <Button variant="ghost" size="sm" className="w-full justify-start gap-2" onClick={signOut}>
          <LogOut className="h-4 w-4" /> Sign out
        </Button>
      </div>
    </aside>
  );
}
