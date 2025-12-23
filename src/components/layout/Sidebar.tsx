import { Link, useLocation, useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { 
  LayoutDashboard, 
  Briefcase, 
  Users, 
  Building2, 
  Sparkles, 
  Settings, 
  CreditCard,
  BarChart3,
  LogOut,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Shield,
  Video,
  Calendar,
  UsersRound,
  Clock,
  TrendingUp,
  ClipboardList,
  Linkedin
} from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { useAuth } from '@/lib/auth';
import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Logo } from '@/components/brand/Logo';
import { usePermissions, Permission } from '@/hooks/usePermissions';

const navigation = [
  { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
  { name: 'Jobs', href: '/jobs', icon: Briefcase },
  { name: 'Candidates', href: '/candidates', icon: Users },
  { name: 'Clients', href: '/clients', icon: Building2, permission: 'can_add_clients' as Permission },
  { name: 'Events', href: '/events', icon: Calendar },
  { name: 'AI Matching', href: '/ai-match', icon: Sparkles, permission: 'can_use_ai_match' as Permission },
  { name: 'LinkedIn Outreach', href: '/linkedin-outreach', icon: Linkedin },
  { name: 'Team Performance', href: '/team/kpi', icon: TrendingUp, permission: 'can_view_reports' as Permission },
  { name: 'Reports', href: '/reports', icon: BarChart3, permission: 'can_view_reports' as Permission },
  { name: 'Tutorials', href: '/tutorials', icon: Video },
];

const bottomNav = [
  { name: 'Settings', href: '/settings', icon: Settings },
  { name: 'Billing', href: '/billing', icon: CreditCard, permission: 'can_view_billing' as Permission },
];

const adminNav = { name: 'Super Admin', href: '/admin', icon: Shield };

export function Sidebar() {
  const location = useLocation();
  const navigate = useNavigate();
  const { profile, signOut, isOwner, isManager, isRecruiter } = useAuth();
  const { hasPermission } = usePermissions();
  const [collapsed, setCollapsed] = useState(false);
  
  // Calculate if current route is a team route
  const isOnTeamRoute = (location.pathname.startsWith('/team') && location.pathname !== '/team/kpi') || 
    location.pathname === '/jobs/assignments';
  
  const [teamMenuOpen, setTeamMenuOpen] = useState(isOnTeamRoute);

  // Keep team menu open when navigating to team routes
  useEffect(() => {
    if (isOnTeamRoute) {
      setTeamMenuOpen(true);
    }
  }, [isOnTeamRoute]);

  const handleSignOut = async () => {
    await signOut();
    navigate('/');
  };

  const userName = profile?.full_name || profile?.email?.split('@')[0] || 'User';
  const userEmail = profile?.email || '';

  // Team submenu items based on role
  const getTeamMenuItems = () => {
    const items = [];
    
    // Team Members link for owner/manager at top of menu
    if (isOwner || isManager) {
      items.push({ name: 'Team Members', href: '/team', icon: UsersRound });
    }
    
    if (isRecruiter) {
      items.push({ name: 'Work Tracking', href: '/team/work-tracking', icon: Clock });
    }
    
    if (isRecruiter && !isOwner && !isManager) {
      items.push({ name: 'My History', href: '/team/work-dashboard', icon: BarChart3 });
    }
    
    if (isOwner || isManager) {
      items.push(
        { name: 'Work Tracking', href: '/team/work-tracking', icon: Clock },
        { name: 'Team Dashboard', href: '/team/manager-dashboard', icon: BarChart3 },
        { name: 'Job Assignments', href: '/jobs/assignments', icon: ClipboardList }
      );
    }
    
    return items;
  };

  const teamMenuItems = getTeamMenuItems();
  const isTeamActive = isOnTeamRoute;

  return (
    <motion.aside
      initial={false}
      animate={{ width: collapsed ? 72 : 260 }}
      transition={{ duration: 0.2, ease: 'easeOut' }}
      className="fixed left-0 top-0 h-screen bg-sidebar flex flex-col z-50 shadow-xl"
    >
      {/* Logo */}
      <div className="h-16 flex items-center px-4 border-b border-sidebar-border/50">
        <Link to="/dashboard" className="flex items-center gap-3">
          <Logo size={collapsed ? 'sm' : 'md'} showText={!collapsed} />
        </Link>
      </div>

      {/* Collapse Button */}
      <Button
        variant="ghost"
        size="icon"
        onClick={() => setCollapsed(!collapsed)}
        className="absolute -right-3 top-20 w-6 h-6 rounded-full bg-card border border-border shadow-sm text-muted-foreground hover:bg-secondary hover:text-foreground"
      >
        {collapsed ? <ChevronRight className="w-3 h-3" /> : <ChevronLeft className="w-3 h-3" />}
      </Button>

      {/* Main Navigation */}
      <nav className="flex-1 py-4 px-3 space-y-1 overflow-y-auto">
        <AnimatePresence>
          {!collapsed && (
            <motion.p 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="px-3 mb-2 text-xs font-semibold uppercase tracking-wider text-sidebar-foreground/40"
            >
              Main Menu
            </motion.p>
          )}
        </AnimatePresence>
        {navigation.map((item) => {
          // Hide certain items from recruiters who don't have permissions
          if (isRecruiter && !isOwner && !isManager) {
            // If item requires permission, check it
            if (item.permission && !hasPermission(item.permission)) {
              return null;
            }
          }

          const isActive = location.pathname === item.href || 
            (item.href !== '/' && location.pathname.startsWith(item.href));
          
          return (
            <Link
              key={item.name}
              to={item.href}
              className={cn(
                'flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-150',
                isActive
                  ? 'bg-sidebar-primary text-sidebar-primary-foreground font-medium'
                  : 'text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground'
              )}
            >
              <item.icon className="w-5 h-5 flex-shrink-0" />
              <AnimatePresence>
                {!collapsed && (
                  <motion.span
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.15 }}
                    className="text-sm whitespace-nowrap"
                  >
                    {item.name}
                  </motion.span>
                )}
              </AnimatePresence>
            </Link>
          );
        })}

        {/* Team Section with Submenu */}
        {teamMenuItems.length > 0 && (
          <>
            <AnimatePresence>
              {!collapsed && (
                <motion.p 
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="px-3 mt-4 mb-2 text-xs font-semibold uppercase tracking-wider text-sidebar-foreground/40"
                >
                  Team
                </motion.p>
              )}
            </AnimatePresence>
            
            {collapsed ? (
              // When collapsed, show just icons
              teamMenuItems.map((item) => {
                const isActive = location.pathname === item.href;
                return (
                  <Link
                    key={item.name}
                    to={item.href}
                    className={cn(
                      'flex items-center justify-center px-3 py-2.5 rounded-lg transition-all duration-150',
                      isActive
                        ? 'bg-sidebar-primary text-sidebar-primary-foreground font-medium'
                        : 'text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground'
                    )}
                  >
                    <item.icon className="w-5 h-5" />
                  </Link>
                );
              })
            ) : (
              // When expanded, show collapsible menu
              <Collapsible open={teamMenuOpen} onOpenChange={setTeamMenuOpen}>
                <CollapsibleTrigger asChild>
                  <button
                    className={cn(
                      'flex items-center justify-between w-full px-3 py-2.5 rounded-lg transition-all duration-150',
                      isTeamActive
                        ? 'bg-sidebar-accent text-sidebar-foreground font-medium'
                        : 'text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground'
                    )}
                  >
                    <div className="flex items-center gap-3">
                      <UsersRound className="w-5 h-5 flex-shrink-0" />
                      <span className="text-sm">Team</span>
                    </div>
                    <ChevronDown className={cn(
                      'w-4 h-4 transition-transform duration-200',
                      teamMenuOpen && 'rotate-180'
                    )} />
                  </button>
                </CollapsibleTrigger>
                <CollapsibleContent className="mt-1 ml-4 space-y-1">
                  {teamMenuItems.map((item) => {
                    const isActive = location.pathname === item.href;
                    return (
                      <Link
                        key={item.name}
                        to={item.href}
                        className={cn(
                          'flex items-center gap-3 px-3 py-2 rounded-lg transition-all duration-150 text-sm',
                          isActive
                            ? 'bg-sidebar-primary text-sidebar-primary-foreground font-medium'
                            : 'text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground'
                        )}
                      >
                        <item.icon className="w-4 h-4 flex-shrink-0" />
                        <span>{item.name}</span>
                      </Link>
                    );
                  })}
                </CollapsibleContent>
              </Collapsible>
            )}
          </>
        )}
      </nav>

      {/* Bottom Navigation */}
      <div className="py-3 px-3 space-y-1 border-t border-sidebar-border/50">
        <AnimatePresence>
          {!collapsed && (
            <motion.p 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="px-3 mb-2 text-xs font-semibold uppercase tracking-wider text-sidebar-foreground/40"
            >
              Settings
            </motion.p>
          )}
        </AnimatePresence>
        
        {bottomNav.map((item) => {
          // Hide certain items from recruiters who don't have permissions
          if (isRecruiter && !isOwner && !isManager) {
            // If item requires permission, check it
            if (item.permission && !hasPermission(item.permission)) {
              return null;
            }
          }

          const isActive = location.pathname === item.href;
          
          return (
            <Link
              key={item.name}
              to={item.href}
              className={cn(
                'flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-150',
                isActive
                  ? 'bg-sidebar-accent text-sidebar-foreground font-medium'
                  : 'text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground'
              )}
            >
              <item.icon className="w-5 h-5 flex-shrink-0" />
              <AnimatePresence>
                {!collapsed && (
                  <motion.span
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.15 }}
                    className="text-sm whitespace-nowrap"
                  >
                    {item.name}
                  </motion.span>
                )}
              </AnimatePresence>
            </Link>
          );
        })}

        {/* Owner/Admin Link */}
        {isOwner && (
          <Link
            to={adminNav.href}
            className={cn(
              'flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-150',
              location.pathname.startsWith('/admin')
                ? 'bg-primary text-primary-foreground font-medium'
                : 'text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground'
            )}
          >
            <adminNav.icon className="w-5 h-5 flex-shrink-0" />
            <AnimatePresence>
              {!collapsed && (
                <motion.span
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.15 }}
                  className="text-sm whitespace-nowrap"
                >
                  {adminNav.name}
                </motion.span>
              )}
            </AnimatePresence>
          </Link>
        )}
      </div>

      {/* User Profile */}
      <div className="p-3 border-t border-sidebar-border/50">
        <div className={cn(
          'flex items-center gap-3 p-2 rounded-lg hover:bg-sidebar-accent/50 transition-colors cursor-pointer',
          collapsed && 'justify-center'
        )}>
          <Avatar className="w-8 h-8 flex-shrink-0 ring-2 ring-sidebar-border">
            <AvatarImage src={profile?.avatar_url || ''} alt={userName} />
            <AvatarFallback className="bg-sidebar-primary text-sidebar-primary-foreground text-xs font-medium">
              {userName.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)}
            </AvatarFallback>
          </Avatar>
          <AnimatePresence>
            {!collapsed && (
              <motion.div
                initial={{ opacity: 0, width: 0 }}
                animate={{ opacity: 1, width: 'auto' }}
                exit={{ opacity: 0, width: 0 }}
                transition={{ duration: 0.15 }}
                className="flex-1 overflow-hidden"
              >
                <p className="font-medium text-sm text-sidebar-foreground truncate">{userName}</p>
                <p className="text-xs text-sidebar-foreground/50 truncate">{userEmail}</p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
        
        {/* Logout Button */}
        <Button
          variant="ghost"
          onClick={handleSignOut}
          className={cn(
            'w-full mt-2 text-sidebar-foreground/60 hover:bg-sidebar-accent hover:text-sidebar-foreground justify-start',
            collapsed && 'px-2 justify-center'
          )}
          size="sm"
        >
          <LogOut className="w-4 h-4" />
          <AnimatePresence>
            {!collapsed && (
              <motion.span
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="ml-2 text-sm"
              >
                Sign Out
              </motion.span>
            )}
          </AnimatePresence>
        </Button>
      </div>
    </motion.aside>
  );
}
