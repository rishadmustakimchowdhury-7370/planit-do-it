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
  Calendar,
  UsersRound,
  Trophy,
  Menu,
  DollarSign,
  FileText,
  Wallet,
  Lock,
  Radar,
  Contact,
  Download,
  UserSearch,
  Kanban,
  Search as SearchIcon,
  Star,
  Clock,
  Home as HomeIcon,
  Plug,
} from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { useAuth } from '@/lib/auth';
import { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Logo } from '@/components/brand/Logo';
import { usePermissions, Permission } from '@/hooks/usePermissions';
import { useEntitlements } from '@/hooks/useEntitlements';
import { useIsMobile } from '@/hooks/use-mobile';

// Feature-key gating per href
const FEATURE_BY_HREF: Record<string, string> = {
  '/reports': 'advanced_analytics',
  '/finance': 'finance_dashboard',
  '/finance/invoices': 'invoice_management',
  '/finance/bonuses': 'recruiter_bonus_tracking',
  '/finance/settings': 'finance_dashboard',
  '/branding': 'custom_branding',
};
const GATED_FEATURES = Array.from(new Set(Object.values(FEATURE_BY_HREF)));

type Role = 'owner' | 'manager' | 'recruiter' | 'superadmin';
type Badge = 'NEW' | 'BETA' | 'PRO' | 'AI';

interface NavItem {
  name: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  permission?: Permission;
  roles?: Role[]; // if set, only these roles see it
  badge?: Badge;
}

interface NavSection {
  id: string;
  title: string;
  items: NavItem[];
}

const BADGE_STYLES: Record<Badge, string> = {
  NEW: 'bg-emerald-400/10 text-emerald-300 border-emerald-400/20',
  BETA: 'bg-amber-400/10 text-amber-300 border-amber-400/20',
  PRO: 'bg-violet-400/10 text-violet-300 border-violet-400/20',
  AI: 'bg-sky-400/10 text-sky-300 border-sky-400/20',
};

function NavBadge({ badge }: { badge: Badge }) {
  return (
    <span
      className={cn(
        'ml-auto text-[9px] font-medium px-1.5 py-[2px] rounded-full border tracking-wider opacity-75',
        BADGE_STYLES[badge]
      )}
    >
      {badge}
    </span>
  );
}

function getSections(roles: { isOwner: boolean; isManager: boolean; isRecruiter: boolean; isSuperAdmin: boolean }): NavSection[] {
  const { isOwner, isManager, isRecruiter, isSuperAdmin } = roles;
  const recruiterOnly = isRecruiter && !isOwner && !isManager && !isSuperAdmin;

  const operations: NavItem[] = [];
  if (isOwner || isManager) {
    operations.push({ name: 'Team', href: '/team', icon: UsersRound });
    operations.push({ name: 'Work Tracking', href: '/team/work-tracking', icon: Clock });
    operations.push({ name: 'Team Dashboard', href: '/team/manager-dashboard', icon: BarChart3 });
  } else if (isRecruiter) {
    operations.push({ name: 'Work Tracking', href: '/team/work-tracking', icon: Clock });
    operations.push({ name: 'My History', href: '/team/work-dashboard', icon: BarChart3 });
  }
  operations.push({ name: 'Events', href: '/events', icon: Calendar });
  operations.push({ name: 'Reports', href: '/reports', icon: BarChart3, permission: 'can_view_reports' as Permission });
  if (!recruiterOnly) {
    operations.push({ name: 'Export Center', href: '/leads/export', icon: Download });
  }

  const finance: NavItem[] = [];
  if (isOwner || isManager) {
    finance.push({ name: 'Finance Dashboard', href: '/finance', icon: DollarSign });
    finance.push({ name: 'Invoices', href: '/finance/invoices', icon: FileText });
  }
  finance.push({ name: isOwner || isManager ? 'Recruiter Bonuses' : 'My Bonuses', href: '/finance/bonuses', icon: Wallet });
  if (isOwner || isManager) {
    finance.push({ name: 'Finance Settings', href: '/finance/settings', icon: Settings });
  }

  const businessDev: NavItem[] = [
    { name: 'Clients', href: '/clients', icon: Building2, permission: 'can_add_clients' as Permission },
    { name: 'Client Pipeline', href: '/pipeline', icon: Kanban },
  ];
  if (!recruiterOnly) {
    businessDev.push({ name: 'Prospect Search', href: '/leads/prospects', icon: Radar });
    businessDev.push({ name: 'AI Prospect Search', href: '/leads/ai', icon: Sparkles, badge: 'AI' });
  }
  businessDev.push({ name: 'Saved Leads', href: '/leads/saved', icon: Contact });

  const system: NavItem[] = [
    { name: 'Integrations', href: '/candidate-discovery', icon: Plug },
    { name: 'Settings', href: '/settings', icon: Settings },
    { name: 'Billing', href: '/billing', icon: CreditCard, permission: 'can_view_billing' as Permission },
  ];
  if (isSuperAdmin) {
    system.push({ name: 'Super Admin', href: '/admin', icon: Shield });
  }

  return [
    {
      id: 'home',
      title: 'Home',
      items: [{ name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard }],
    },
    {
      id: 'recruitment',
      title: 'Recruitment',
      items: [
        { name: 'Jobs', href: '/jobs', icon: Briefcase },
        { name: 'Candidates', href: '/candidates', icon: Users },
        { name: 'AI Candidate Discovery', href: '/candidate-discovery/ai', icon: Sparkles, badge: 'AI' },
        { name: 'AI Matching', href: '/ai-match', icon: Sparkles, permission: 'can_use_ai_match' as Permission, badge: 'AI' },
        { name: 'Placements', href: '/placements', icon: Trophy },
      ],
    },
    { id: 'business', title: 'Business Development', items: businessDev },
    { id: 'operations', title: 'Operations', items: operations },
    { id: 'finance', title: 'Finance', items: finance },
    { id: 'system', title: 'System', items: system },
  ];
}

// localStorage helpers
const LS_OPEN = 'hm-sidebar-open-sections';
const LS_FAV = 'hm-sidebar-favorites';
const LS_RECENT = 'hm-sidebar-recents';

function readJSON<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function NavLinkItem({
  item,
  collapsed,
  isActive,
  locked,
  onNavigate,
  showFavToggle = true,
  isFavorite,
  onToggleFavorite,
}: {
  item: NavItem;
  collapsed: boolean;
  isActive: boolean;
  locked: boolean;
  onNavigate?: () => void;
  showFavToggle?: boolean;
  isFavorite?: boolean;
  onToggleFavorite?: (href: string) => void;
}) {
  const link = (
    <Link
      to={locked ? '/billing' : item.href}
      onClick={onNavigate}
      title={collapsed ? item.name : locked ? `${item.name} — upgrade required` : undefined}
      className={cn(
        'group relative flex items-center gap-3.5 px-3 py-[9px] rounded-lg transition-all duration-200 ease-out',
        isActive
          ? 'bg-sidebar-primary text-sidebar-primary-foreground font-medium shadow-sm'
          : 'text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground hover:translate-x-0.5',
        collapsed && 'justify-center px-2',
        locked && 'opacity-60'
      )}
    >
      <item.icon className="w-[18px] h-[18px] flex-shrink-0" />
      {!collapsed && (
        <span className="text-sm whitespace-nowrap flex-1 flex items-center gap-2 min-w-0">
          <span className="truncate">{item.name}</span>
          {item.badge && <NavBadge badge={item.badge} />}
          {locked && <Lock className="w-3.5 h-3.5 ml-auto opacity-70" />}
          {showFavToggle && onToggleFavorite && (
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onToggleFavorite(item.href);
              }}
              className={cn(
                'opacity-0 group-hover:opacity-100 transition-opacity ml-1 p-0.5 rounded hover:bg-sidebar-accent/60',
                isFavorite && 'opacity-100'
              )}
              aria-label={isFavorite ? 'Unpin' : 'Pin'}
            >
              <Star className={cn('w-3.5 h-3.5', isFavorite ? 'fill-amber-400 text-amber-400' : 'text-sidebar-foreground/50')} />
            </button>
          )}
        </span>
      )}
    </Link>
  );

  if (!collapsed) return link;
  return (
    <Tooltip delayDuration={100}>
      <TooltipTrigger asChild>{link}</TooltipTrigger>
      <TooltipContent side="right" className="flex items-center gap-2">
        {item.name}
        {item.badge && <NavBadge badge={item.badge} />}
      </TooltipContent>
    </Tooltip>
  );
}

function SidebarContent({ collapsed = false, onNavigate }: { collapsed?: boolean; onNavigate?: () => void }) {
  const location = useLocation();
  const navigate = useNavigate();
  const { profile, signOut, isOwner, isManager, isRecruiter, isSuperAdmin } = useAuth();
  const { hasPermission } = usePermissions();
  const { entitlements } = useEntitlements(GATED_FEATURES);

  const sections = useMemo(
    () => getSections({ isOwner, isManager, isRecruiter, isSuperAdmin }),
    [isOwner, isManager, isRecruiter, isSuperAdmin]
  );

  // Flat map of all items for search + label lookup
  const allItems = useMemo(() => sections.flatMap((s) => s.items), [sections]);

  const [openSections, setOpenSections] = useState<Record<string, boolean>>(() => {
    const stored = readJSON<Record<string, boolean>>(LS_OPEN, {});
    const init: Record<string, boolean> = {};
    sections.forEach((s) => {
      init[s.id] = stored[s.id] ?? true;
    });
    return init;
  });
  const [favorites, setFavorites] = useState<string[]>(() => readJSON<string[]>(LS_FAV, []));
  const [recents, setRecents] = useState<string[]>(() => readJSON<string[]>(LS_RECENT, []));
  const [query, setQuery] = useState('');

  useEffect(() => {
    localStorage.setItem(LS_OPEN, JSON.stringify(openSections));
  }, [openSections]);
  useEffect(() => {
    localStorage.setItem(LS_FAV, JSON.stringify(favorites));
  }, [favorites]);

  // Recents tracking removed — navigation items are always available in sections

  const gateFor = (href: string): 'show' | 'lock' | 'hide' => {
    const fk = FEATURE_BY_HREF[href];
    if (!fk) return 'show';
    const ent = entitlements[fk];
    if (!ent) return 'show';
    if (ent.enabled) return 'show';
    if (isOwner || isManager) return 'lock';
    return 'hide';
  };

  const isItemVisible = (item: NavItem) => {
    if (isRecruiter && !isOwner && !isManager) {
      if (item.permission && !hasPermission(item.permission)) return false;
    }
    if (gateFor(item.href) === 'hide') return false;
    return true;
  };

  const isActive = (href: string) =>
    location.pathname === href || (href !== '/' && href !== '/dashboard' && location.pathname.startsWith(href));

  const toggleFavorite = (href: string) =>
    setFavorites((prev) => (prev.includes(href) ? prev.filter((h) => h !== href) : [...prev, href]));

  const handleSignOut = async () => {
    await signOut();
    navigate('/');
  };

  const userName = profile?.full_name || profile?.email?.split('@')[0] || 'User';
  const userEmail = profile?.email || '';
  const workspaceName = (profile as any)?.organization_name || (profile as any)?.workspace_name || 'Workspace';

  const q = query.trim().toLowerCase();
  const isSearching = q.length > 0;

  const favItems = favorites
    .map((h) => allItems.find((i) => i.href === h))
    .filter((i): i is NavItem => !!i && isItemVisible(i));
  const recentItems = recents
    .map((h) => allItems.find((i) => i.href === h))
    .filter((i): i is NavItem => !!i && isItemVisible(i))
    .filter((i) => !favorites.includes(i.href));

  const renderItem = (item: NavItem, opts?: { showFav?: boolean }) => {
    const gate = gateFor(item.href);
    const locked = gate === 'lock';
    return (
      <NavLinkItem
        key={item.href}
        item={item}
        collapsed={collapsed}
        isActive={isActive(item.href)}
        locked={locked}
        onNavigate={onNavigate}
        showFavToggle={opts?.showFav ?? !collapsed}
        isFavorite={favorites.includes(item.href)}
        onToggleFavorite={toggleFavorite}
      />
    );
  };

  return (
    <TooltipProvider>
      {/* Search */}
      {!collapsed && (
        <div className="px-3 pt-3 pb-2">
          <div className="relative">
            <SearchIcon className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-sidebar-foreground/40" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search navigation…"
              className="h-8 pl-8 text-xs bg-sidebar-accent/40 border-sidebar-border/40 text-sidebar-foreground placeholder:text-sidebar-foreground/40 focus-visible:ring-1 focus-visible:ring-sidebar-primary"
            />
          </div>
        </div>
      )}

      <nav className="flex-1 pb-2 px-2 overflow-y-auto">
        {isSearching ? (
          <div className="space-y-0.5">
            {allItems
              .filter((i) => isItemVisible(i) && i.name.toLowerCase().includes(q))
              .map((i) => renderItem(i))}
            {allItems.filter((i) => isItemVisible(i) && i.name.toLowerCase().includes(q)).length === 0 && (
              <p className="text-xs text-sidebar-foreground/40 px-3 py-4 text-center">No results</p>
            )}
          </div>
        ) : (
          <>
            {/* Favorites */}
            {favItems.length > 0 && (
              <div className="mb-3">
                {!collapsed && (
                  <p className="px-3 mt-2 mb-1 text-[10px] font-semibold uppercase tracking-wider text-sidebar-foreground/40 flex items-center gap-1.5">
                    <Star className="w-3 h-3 fill-amber-400 text-amber-400" /> Pinned
                  </p>
                )}
                <div className="space-y-0.5">{favItems.map((i) => renderItem(i))}</div>
              </div>
            )}

            {/* Recent */}
            {!collapsed && recentItems.length > 0 && (
              <div className="mb-3">
                <p className="px-3 mt-2 mb-1 text-[10px] font-semibold uppercase tracking-wider text-sidebar-foreground/40 flex items-center gap-1.5">
                  <Clock className="w-3 h-3" /> Recent
                </p>
                <div className="space-y-0.5">{recentItems.slice(0, 3).map((i) => renderItem(i))}</div>
              </div>
            )}

            {/* Sections */}
            {sections.map((section) => {
              const visible = section.items.filter(isItemVisible);
              if (visible.length === 0) return null;

              if (collapsed) {
                return (
                  <div key={section.id} className="py-1 border-t border-sidebar-border/30 first:border-t-0">
                    <div className="space-y-0.5 py-1">{visible.map((i) => renderItem(i))}</div>
                  </div>
                );
              }

              const open = openSections[section.id] ?? true;
              return (
                <Collapsible
                  key={section.id}
                  open={open}
                  onOpenChange={(v) => setOpenSections((s) => ({ ...s, [section.id]: v }))}
                  className="mb-1"
                >
                  <CollapsibleTrigger asChild>
                    <button className="flex items-center justify-between w-full px-3 mt-3 mb-1 text-[10px] font-semibold uppercase tracking-wider text-sidebar-foreground/40 hover:text-sidebar-foreground/70 transition-colors">
                      <span>{section.title}</span>
                      <ChevronDown className={cn('w-3 h-3 transition-transform duration-200', !open && '-rotate-90')} />
                    </button>
                  </CollapsibleTrigger>
                  <CollapsibleContent className="space-y-0.5 data-[state=open]:animate-fade-in">
                    {visible.map((i) => renderItem(i))}
                  </CollapsibleContent>
                </Collapsible>
              );
            })}
          </>
        )}
      </nav>

      {/* Fixed bottom: workspace + user + sign out */}
      <div className="border-t border-sidebar-border/50 bg-sidebar">
        {!collapsed && (
          <div className="px-4 pt-3 pb-2">
            <p className="text-[10px] uppercase tracking-wider text-sidebar-foreground/40 font-semibold">Workspace</p>
            <p className="text-xs text-sidebar-foreground/80 truncate">{workspaceName}</p>
          </div>
        )}
        <div className={cn('px-3 py-2 flex items-center gap-3', collapsed && 'justify-center')}>
          <Avatar className="w-8 h-8 flex-shrink-0 ring-2 ring-sidebar-border">
            <AvatarImage src={profile?.avatar_url || ''} alt={userName} />
            <AvatarFallback className="bg-sidebar-primary text-sidebar-primary-foreground text-xs font-medium">
              {userName.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2)}
            </AvatarFallback>
          </Avatar>
          {!collapsed && (
            <div className="flex-1 min-w-0">
              <p className="font-medium text-sm text-sidebar-foreground truncate">{userName}</p>
              <p className="text-xs text-sidebar-foreground/50 truncate">{userEmail}</p>
            </div>
          )}
        </div>
        <div className="px-2 pb-3">
          <Button
            variant="ghost"
            onClick={handleSignOut}
            className={cn(
              'w-full text-sidebar-foreground/60 hover:bg-sidebar-accent hover:text-sidebar-foreground justify-start',
              collapsed && 'px-2 justify-center'
            )}
            size="sm"
          >
            <LogOut className="w-4 h-4" />
            {!collapsed && <span className="ml-2 text-sm">Sign Out</span>}
          </Button>
        </div>
      </div>
    </TooltipProvider>
  );
}

export function Sidebar() {
  const isMobile = useIsMobile();
  const [collapsed, setCollapsed] = useState<boolean>(() => {
    try {
      return localStorage.getItem('hm-sidebar-collapsed') === '1';
    } catch {
      return false;
    }
  });
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    try {
      localStorage.setItem('hm-sidebar-collapsed', collapsed ? '1' : '0');
    } catch {
      /* ignore */
    }
  }, [collapsed]);

  if (isMobile) {
    return (
      <>
        <div className="fixed top-0 left-0 right-0 h-14 bg-primary flex items-center px-4 z-[60] border-b border-primary-foreground/20 shadow-md">
          <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="text-primary-foreground hover:bg-primary-foreground/10">
                <Menu className="h-6 w-6" />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-[280px] p-0 bg-sidebar border-sidebar-border">
              <div className="h-14 flex items-center px-4 border-b border-sidebar-border/50">
                <Link to="/dashboard" className="flex items-center gap-3" onClick={() => setMobileOpen(false)}>
                  <Logo size="md" showText variant="light" />
                </Link>
              </div>
              <div className="flex flex-col h-[calc(100vh-3.5rem)]">
                <SidebarContent onNavigate={() => setMobileOpen(false)} />
              </div>
            </SheetContent>
          </Sheet>
          <Link to="/dashboard" className="ml-3">
            <Logo size="sm" showText variant="light" />
          </Link>
        </div>
        <div className="h-14" />
      </>
    );
  }

  return (
    <motion.aside
      initial={false}
      animate={{ width: collapsed ? 72 : 270 }}
      transition={{ duration: 0.2, ease: 'easeOut' }}
      className="fixed left-0 top-0 h-screen bg-sidebar flex flex-col z-50 shadow-xl"
    >
      <div className="h-16 flex items-center px-4 border-b border-sidebar-border/50">
        <Link to="/dashboard" className="flex items-center gap-3">
          <Logo size={collapsed ? 'sm' : 'md'} showText={!collapsed} variant="light" />
        </Link>
      </div>

      <Button
        variant="ghost"
        size="icon"
        onClick={() => setCollapsed(!collapsed)}
        className="absolute -right-3 top-20 w-6 h-6 rounded-full bg-card border border-border shadow-sm text-muted-foreground hover:bg-secondary hover:text-foreground z-10"
        aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
      >
        {collapsed ? <ChevronRight className="w-3 h-3" /> : <ChevronLeft className="w-3 h-3" />}
      </Button>

      <SidebarContent collapsed={collapsed} />
    </motion.aside>
  );
}
