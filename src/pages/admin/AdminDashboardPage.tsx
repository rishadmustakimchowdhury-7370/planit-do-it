import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { AdminLayout } from '@/components/admin/AdminLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import {
  Users,
  Building2,
  CreditCard,
  TrendingUp,
  AlertTriangle,
  PauseCircle,
  UserPlus,
  Send,
  Clock,
  DollarSign,
  Mail,
  FileText,
  Video,
  Settings,
  Loader2,
  Archive,
  RefreshCw,
  Trash2,
  Download,
  Building,
  ExternalLink,
} from 'lucide-react';
import { motion } from 'framer-motion';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
} from 'recharts';
import { format, subMonths, startOfMonth, endOfMonth } from 'date-fns';

interface DashboardMetrics {
  totalUsers: number;
  activeTenants: number;
  activeSubscriptions: number;
  mrr: number;
  totalRevenue: number;
  expiringSubscriptions: number;
  pausedAccounts: number;
  trialAccounts: number;
  deletedUsers: number;
  orphanedTenants: number;
}

interface RecentActivity {
  id: string;
  action: string;
  entity_type: string;
  entity_name: string | null;
  created_at: string;
}

interface ArchivedUser {
  id: string;
  email: string;
  full_name: string | null;
  deleted_at: string;
}

interface OrphanedTenant {
  id: string;
  name: string;
  subscription_status: string;
  created_at: string;
  email?: string | null;
}

interface MonthlyRevenue {
  month: string;
  revenue: number;
}

export default function AdminDashboardPage() {
  const navigate = useNavigate();
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);
  const [recentActivity, setRecentActivity] = useState<RecentActivity[]>([]);
  const [archivedUsers, setArchivedUsers] = useState<ArchivedUser[]>([]);
  const [orphanedTenants, setOrphanedTenants] = useState<OrphanedTenant[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [mrrData, setMrrData] = useState<MonthlyRevenue[]>([]);
  const [signupsData, setSignupsData] = useState<{ date: string; signups: number }[]>([]);
  const [isSendingReminders, setIsSendingReminders] = useState(false);
  const [showArchived, setShowArchived] = useState(false);
  const [showOrphaned, setShowOrphaned] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [selectedOrphaned, setSelectedOrphaned] = useState<Set<string>>(new Set());
  const [showDeleteOrphanedDialog, setShowDeleteOrphanedDialog] = useState(false);
  const [isDeletingOrphaned, setIsDeletingOrphaned] = useState(false);

  const fetchDashboardData = useCallback(async () => {
    try {
      setIsLoading(true);

      // Fetch total active users (not deleted)
      const { count: totalUsers } = await supabase
        .from('profiles')
        .select('*', { count: 'exact', head: true })
        .is('deleted_at', null);

      // Fetch deleted users count for archive
      const { count: deletedUsers, data: deletedUsersData } = await supabase
        .from('profiles')
        .select('id, email, full_name, deleted_at', { count: 'exact' })
        .not('deleted_at', 'is', null)
        .order('deleted_at', { ascending: false })
        .limit(50);

      setArchivedUsers(deletedUsersData as ArchivedUser[] || []);

      // Fetch all tenants with their subscription info
      const { data: tenantData } = await supabase
        .from('tenants')
        .select('id, name, subscription_status, is_paused, is_suspended, subscription_ends_at, subscription_plan_id, created_at');

      // Fetch all profiles to identify orphaned tenants
      const { data: profilesData } = await supabase
        .from('profiles')
        .select('tenant_id')
        .is('deleted_at', null);

      const tenantIdsWithUsers = new Set(profilesData?.map(p => p.tenant_id) || []);
      
      // Identify orphaned tenants (tenants without users)
      const orphanedTenantsList = tenantData?.filter(t => !tenantIdsWithUsers.has(t.id)) || [];
      
      // Fetch emails from email_accounts for orphaned tenants (for marketing)
      const orphanedTenantIds = orphanedTenantsList.map(t => t.id);
      const { data: emailAccounts } = await supabase
        .from('email_accounts')
        .select('tenant_id, from_email')
        .in('tenant_id', orphanedTenantIds);

      const emailMap = new Map<string, string>();
      emailAccounts?.forEach(ea => {
        if (!emailMap.has(ea.tenant_id)) {
          emailMap.set(ea.tenant_id, ea.from_email);
        }
      });

      const orphanedWithEmails: OrphanedTenant[] = orphanedTenantsList.map(t => ({
        id: t.id,
        name: t.name,
        subscription_status: t.subscription_status,
        created_at: t.created_at,
        email: emailMap.get(t.id) || null,
      }));

      setOrphanedTenants(orphanedWithEmails);

      // Calculate metrics from actual data
      const activeTenants = tenantData?.filter(t => !t.is_suspended && tenantIdsWithUsers.has(t.id)).length || 0;
      
      const activeSubscriptions = tenantData?.filter(t => 
        t.subscription_status === 'active' && !t.is_suspended && !t.is_paused && tenantIdsWithUsers.has(t.id)
      ).length || 0;

      const pausedAccounts = tenantData?.filter(t => t.is_paused === true && tenantIdsWithUsers.has(t.id)).length || 0;
      const trialAccounts = tenantData?.filter(t => t.subscription_status === 'trial' && tenantIdsWithUsers.has(t.id)).length || 0;

      // Expiring in next 30 days
      const thirtyDaysFromNow = new Date();
      thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);
      const now = new Date();
      
      const expiringSubscriptions = tenantData?.filter(t => {
        if (!t.subscription_ends_at || !tenantIdsWithUsers.has(t.id)) return false;
        const endDate = new Date(t.subscription_ends_at);
        return endDate <= thirtyDaysFromNow && endDate > now;
      }).length || 0;

      // Fetch completed orders for revenue calculation (primary payment source)
      const { data: allOrders } = await supabase
        .from('orders')
        .select('amount, status, billing_cycle, created_at, approved_at')
        .eq('status', 'completed');

      // Fetch paid invoices as secondary source
      const { data: paidInvoices } = await supabase
        .from('invoices')
        .select('amount, status, created_at, paid_at')
        .eq('status', 'paid');

      // Calculate Total Revenue from both orders and invoices
      const ordersRevenue = allOrders?.reduce((sum, order) => sum + Number(order.amount), 0) || 0;
      const invoicesRevenue = paidInvoices?.reduce((sum, inv) => sum + Number(inv.amount), 0) || 0;
      const totalRevenue = ordersRevenue + invoicesRevenue;
      
      // Calculate MRR from active monthly subscriptions (current month recurring revenue)
      const currentMonthStart = startOfMonth(now);
      const currentMonthEnd = endOfMonth(now);
      
      // MRR = sum of all monthly recurring payments this month
      const currentMonthOrders = allOrders?.filter(order => {
        const paidDate = order.approved_at ? new Date(order.approved_at) : new Date(order.created_at);
        return paidDate >= currentMonthStart && paidDate <= currentMonthEnd && order.billing_cycle === 'monthly';
      }) || [];
      
      const currentMonthInvoices = paidInvoices?.filter(inv => {
        const paidDate = inv.paid_at ? new Date(inv.paid_at) : new Date(inv.created_at);
        return paidDate >= currentMonthStart && paidDate <= currentMonthEnd;
      }) || [];
      
      const mrrFromOrders = currentMonthOrders.reduce((sum, order) => sum + Number(order.amount), 0);
      const mrrFromInvoices = currentMonthInvoices.reduce((sum, inv) => sum + Number(inv.amount), 0);
      const mrr = mrrFromOrders + mrrFromInvoices;

      // Calculate monthly revenue for the chart (last 12 months)
      const monthlyRevenueData: MonthlyRevenue[] = [];
      for (let i = 11; i >= 0; i--) {
        const monthStart = startOfMonth(subMonths(now, i));
        const monthEnd = endOfMonth(subMonths(now, i));
        
        const monthOrders = allOrders?.filter(order => {
          const paidDate = order.approved_at ? new Date(order.approved_at) : new Date(order.created_at);
          return paidDate >= monthStart && paidDate <= monthEnd;
        }) || [];
        
        const monthInvoices = paidInvoices?.filter(inv => {
          const paidDate = inv.paid_at ? new Date(inv.paid_at) : new Date(inv.created_at);
          return paidDate >= monthStart && paidDate <= monthEnd;
        }) || [];
        
        const monthRevenue = monthOrders.reduce((sum, order) => sum + Number(order.amount), 0) + 
                            monthInvoices.reduce((sum, inv) => sum + Number(inv.amount), 0);
        monthlyRevenueData.push({
          month: format(monthStart, 'MMM'),
          revenue: monthRevenue,
        });
      }
      setMrrData(monthlyRevenueData);

      // Fetch actual signups data from profiles (last 30 days, active users only)
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      
      const { data: recentProfiles } = await supabase
        .from('profiles')
        .select('created_at')
        .is('deleted_at', null)
        .gte('created_at', thirtyDaysAgo.toISOString());

      // Group signups by date
      const signupsByDate: { [key: string]: number } = {};
      for (let i = 0; i < 30; i++) {
        const date = new Date();
        date.setDate(date.getDate() - (29 - i));
        const dateKey = format(date, 'MMM d');
        signupsByDate[dateKey] = 0;
      }

      recentProfiles?.forEach(profile => {
        const dateKey = format(new Date(profile.created_at!), 'MMM d');
        if (signupsByDate[dateKey] !== undefined) {
          signupsByDate[dateKey]++;
        }
      });

      const signupsChartData = Object.entries(signupsByDate).map(([date, signups]) => ({
        date,
        signups,
      }));
      setSignupsData(signupsChartData);

      setMetrics({
        totalUsers: totalUsers || 0,
        activeTenants,
        activeSubscriptions,
        mrr,
        totalRevenue,
        expiringSubscriptions,
        pausedAccounts,
        trialAccounts,
        deletedUsers: deletedUsers || 0,
        orphanedTenants: orphanedTenantsList.length,
      });

      // Fetch recent activity
      const { data: activityData } = await supabase
        .from('audit_log')
        .select('id, action, entity_type, created_at')
        .order('created_at', { ascending: false })
        .limit(10);

      setRecentActivity(activityData?.map(a => ({
        ...a,
        entity_name: null,
      })) || []);

    } catch (error) {
      console.error('Error fetching dashboard data:', error);
      toast.error('Failed to load dashboard data');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchDashboardData();
  }, [fetchDashboardData]);

  // Real-time subscription for live updates
  useEffect(() => {
    const channel = supabase
      .channel('admin-dashboard-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'profiles' }, () => {
        fetchDashboardData();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tenants' }, () => {
        fetchDashboardData();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'invoices' }, () => {
        fetchDashboardData();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, () => {
        fetchDashboardData();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchDashboardData]);

  const handleRefresh = () => {
    setIsRefreshing(true);
    fetchDashboardData();
    toast.success('Dashboard refreshed');
  };

  const handleSendRenewalReminders = async () => {
    setIsSendingReminders(true);
    try {
      const { data, error } = await supabase.functions.invoke('send-renewal-reminders');
      
      if (error) throw error;
      
      toast.success(`Renewal reminders sent to ${data?.sent || 0} users`);
    } catch (error: any) {
      console.error('Error sending reminders:', error);
      toast.error('Failed to send renewal reminders');
    } finally {
      setIsSendingReminders(false);
    }
  };

  const handleSelectOrphanedTenant = (id: string) => {
    const newSelected = new Set(selectedOrphaned);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedOrphaned(newSelected);
  };

  const handleSelectAllOrphaned = () => {
    if (selectedOrphaned.size === orphanedTenants.length) {
      setSelectedOrphaned(new Set());
    } else {
      setSelectedOrphaned(new Set(orphanedTenants.map(t => t.id)));
    }
  };

  const handleDeleteSelectedOrphaned = async () => {
    if (selectedOrphaned.size === 0) return;
    
    setIsDeletingOrphaned(true);
    try {
      const idsToDelete = Array.from(selectedOrphaned);
      
      // Delete orphaned tenants
      const { error } = await supabase
        .from('tenants')
        .delete()
        .in('id', idsToDelete);

      if (error) throw error;

      // Log audit action
      await supabase.from('audit_log').insert({
        action: 'delete_orphaned_tenants',
        entity_type: 'tenant',
        new_values: { deleted_count: idsToDelete.length, tenant_ids: idsToDelete } as any,
      });

      toast.success(`Deleted ${idsToDelete.length} orphaned workspaces`);
      setSelectedOrphaned(new Set());
      setShowDeleteOrphanedDialog(false);
      fetchDashboardData();
    } catch (error: any) {
      console.error('Error deleting orphaned tenants:', error);
      toast.error(error.message || 'Failed to delete orphaned workspaces');
    } finally {
      setIsDeletingOrphaned(false);
    }
  };

  const handleExportOrphanedEmails = () => {
    const emailsWithNames = orphanedTenants
      .filter(t => t.email)
      .map(t => `${t.name},${t.email},${t.subscription_status},${format(new Date(t.created_at), 'yyyy-MM-dd')}`);
    
    if (emailsWithNames.length === 0) {
      toast.error('No emails found in orphaned workspaces');
      return;
    }

    const csv = 'Workspace Name,Email,Status,Created At\n' + emailsWithNames.join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `orphaned-workspaces-${format(new Date(), 'yyyy-MM-dd')}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success(`Exported ${emailsWithNames.length} emails for marketing`);
  };

  const statCards = [
    { title: 'Total Users', value: metrics?.totalUsers, icon: Users, color: 'text-blue-500' },
    { title: 'Active Tenants', value: metrics?.activeTenants, icon: Building2, color: 'text-green-500' },
    { title: 'Active Subscriptions', value: metrics?.activeSubscriptions, icon: CreditCard, color: 'text-purple-500' },
    { title: 'MRR', value: `£${metrics?.mrr?.toLocaleString() || 0}`, icon: TrendingUp, color: 'text-emerald-500' },
    { title: 'Total Revenue (YTD)', value: `£${metrics?.totalRevenue?.toLocaleString() || 0}`, icon: DollarSign, color: 'text-amber-500' },
    { title: 'Expiring (30 days)', value: metrics?.expiringSubscriptions, icon: Clock, color: 'text-orange-500' },
    { title: 'Paused Accounts', value: metrics?.pausedAccounts, icon: PauseCircle, color: 'text-red-500' },
    { title: 'Trial Accounts', value: metrics?.trialAccounts, icon: AlertTriangle, color: 'text-yellow-500' },
  ];

  const quickActions = [
    { label: 'Create User', icon: UserPlus, onClick: () => navigate('/admin/users') },
    { label: 'Manage Users', icon: Users, onClick: () => navigate('/admin/users') },
    { label: 'Send Renewal Reminders', icon: Mail, onClick: handleSendRenewalReminders, loading: isSendingReminders },
    { label: 'Email Templates', icon: Send, onClick: () => navigate('/admin/email-templates') },
    { label: 'Manage Pages', icon: FileText, onClick: () => navigate('/admin/pages') },
    { label: 'Video Tutorials', icon: Video, onClick: () => navigate('/admin/videos') },
    { label: 'Settings', icon: Settings, onClick: () => navigate('/admin/settings') },
  ];

  return (
    <AdminLayout title="Admin Dashboard" description="Platform overview and quick actions">
      {/* Refresh Button */}
      <div className="flex justify-end mb-4">
        <Button variant="outline" size="sm" onClick={handleRefresh} disabled={isRefreshing}>
          <RefreshCw className={`h-4 w-4 mr-2 ${isRefreshing ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        {statCards.map((stat, idx) => (
          <motion.div
            key={stat.title}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: idx * 0.05 }}
          >
            <Card>
              <CardContent className="p-4">
                {isLoading ? (
                  <Skeleton className="h-16 w-full" />
                ) : (
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">{stat.title}</p>
                      <p className="text-2xl font-bold">{stat.value}</p>
                    </div>
                    <stat.icon className={`h-5 w-5 ${stat.color}`} />
                  </div>
                )}
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>

      {/* Quick Actions */}
      <Card className="mb-8">
        <CardHeader>
          <CardTitle className="text-lg">Quick Actions</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-3">
            {quickActions.map((action) => (
              <Button 
                key={action.label} 
                variant="outline" 
                size="sm" 
                onClick={action.onClick}
                disabled={action.loading}
              >
                {action.loading ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <action.icon className="h-4 w-4 mr-2" />
                )}
                {action.label}
              </Button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Charts */}
      <div className="grid md:grid-cols-2 gap-6 mb-8">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Monthly Revenue (12 Months)</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-64 w-full" />
            ) : (
              <ResponsiveContainer width="100%" height={250}>
                <AreaChart data={mrrData}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="month" className="text-xs" />
                  <YAxis className="text-xs" tickFormatter={(value) => `£${value}`} />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: 'hsl(var(--card))', 
                      border: '1px solid hsl(var(--border))' 
                    }}
                    formatter={(value: number) => [`£${value.toLocaleString()}`, 'Revenue']}
                  />
                  <Area
                    type="monotone"
                    dataKey="revenue"
                    stroke="hsl(var(--primary))"
                    fill="hsl(var(--primary) / 0.2)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">New Signups (30 Days)</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-64 w-full" />
            ) : (
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={signupsData.slice(-14)}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="date" className="text-xs" />
                  <YAxis className="text-xs" />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: 'hsl(var(--card))', 
                      border: '1px solid hsl(var(--border))' 
                    }} 
                  />
                  <Bar dataKey="signups" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Orphaned Workspaces Section */}
      <Card className="mb-8">
        <CardHeader className="flex flex-row items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-3">
            <Building className="h-5 w-5 text-orange-500" />
            <div>
              <CardTitle className="text-lg">Orphaned Workspaces</CardTitle>
              <p className="text-sm text-muted-foreground">
                {metrics?.orphanedTenants || 0} workspaces without users (available for cleanup/marketing)
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {showOrphaned && orphanedTenants.length > 0 && (
              <>
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={handleExportOrphanedEmails}
                >
                  <Download className="h-4 w-4 mr-2" />
                  Export Emails
                </Button>
                {selectedOrphaned.size > 0 && (
                  <Button 
                    variant="destructive" 
                    size="sm"
                    onClick={() => setShowDeleteOrphanedDialog(true)}
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    Delete Selected ({selectedOrphaned.size})
                  </Button>
                )}
              </>
            )}
            <div className="flex items-center space-x-2">
              <Switch
                id="show-orphaned"
                checked={showOrphaned}
                onCheckedChange={setShowOrphaned}
              />
              <Label htmlFor="show-orphaned">Show Details</Label>
            </div>
          </div>
        </CardHeader>
        {showOrphaned && (
          <CardContent>
            {orphanedTenants.length === 0 ? (
              <p className="text-muted-foreground text-sm text-center py-8">No orphaned workspaces found</p>
            ) : (
              <div className="space-y-2 max-h-80 overflow-y-auto">
                <div className="flex items-center gap-2 pb-2 border-b">
                  <Checkbox 
                    checked={selectedOrphaned.size === orphanedTenants.length && orphanedTenants.length > 0}
                    onCheckedChange={handleSelectAllOrphaned}
                  />
                  <span className="text-sm font-medium">Select All</span>
                </div>
                {orphanedTenants.map((tenant) => (
                  <div
                    key={tenant.id}
                    className="flex items-center justify-between py-2 px-3 bg-muted/50 rounded-lg hover:bg-muted/80 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <Checkbox 
                        checked={selectedOrphaned.has(tenant.id)}
                        onCheckedChange={() => handleSelectOrphanedTenant(tenant.id)}
                      />
                      <div>
                        <p className="text-sm font-medium">{tenant.name}</p>
                        {tenant.email ? (
                          <button
                            onClick={() => {
                              navigator.clipboard.writeText(tenant.email!);
                              toast.success('Email copied');
                            }}
                            className="text-xs text-primary hover:underline flex items-center gap-1"
                          >
                            <Mail className="h-3 w-3" />
                            {tenant.email}
                            <ExternalLink className="h-3 w-3" />
                          </button>
                        ) : (
                          <p className="text-xs text-muted-foreground">No email found</p>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge 
                        variant={tenant.subscription_status === 'active' ? 'default' : 'secondary'}
                        className="text-xs"
                      >
                        {tenant.subscription_status}
                      </Badge>
                      <span className="text-xs text-muted-foreground">
                        {format(new Date(tenant.created_at), 'MMM d, yyyy')}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        )}
      </Card>

      {/* Archived Users Section */}
      <Card className="mb-8">
        <CardHeader className="flex flex-row items-center justify-between">
          <div className="flex items-center gap-3">
            <Archive className="h-5 w-5 text-muted-foreground" />
            <div>
              <CardTitle className="text-lg">Archived Users</CardTitle>
              <p className="text-sm text-muted-foreground">
                {metrics?.deletedUsers || 0} deleted users available for marketing
              </p>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            <Switch
              id="show-archived"
              checked={showArchived}
              onCheckedChange={setShowArchived}
            />
            <Label htmlFor="show-archived">Show Archive</Label>
          </div>
        </CardHeader>
        {showArchived && (
          <CardContent>
            {archivedUsers.length === 0 ? (
              <p className="text-muted-foreground text-sm text-center py-8">No archived users found</p>
            ) : (
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {archivedUsers.map((user) => (
                  <div
                    key={user.id}
                    className="flex items-center justify-between py-2 px-3 bg-muted/50 rounded-lg"
                  >
                    <div>
                      <p className="text-sm font-medium">{user.full_name || 'No name'}</p>
                      <button
                        onClick={() => {
                          navigator.clipboard.writeText(user.email);
                          toast.success('Email copied for marketing');
                        }}
                        className="text-xs text-primary hover:underline flex items-center gap-1"
                      >
                        <Mail className="h-3 w-3" />
                        {user.email}
                        <ExternalLink className="h-3 w-3" />
                      </button>
                    </div>
                    <Badge variant="secondary" className="text-xs">
                      Deleted {format(new Date(user.deleted_at), 'MMM d, yyyy')}
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        )}
      </Card>

      {/* Recent Activity */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Recent Admin Activity</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-3">
              {[1, 2, 3, 4, 5].map((i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : recentActivity.length === 0 ? (
            <p className="text-muted-foreground text-sm text-center py-8">No recent activity</p>
          ) : (
            <div className="space-y-3">
              {recentActivity.map((activity) => (
                <div
                  key={activity.id}
                  className="flex items-center justify-between py-2 border-b border-border last:border-0"
                >
                  <div className="flex items-center gap-3">
                    <Badge variant="outline" className="text-xs">
                      {activity.entity_type}
                    </Badge>
                    <span className="text-sm">{activity.action}</span>
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {new Date(activity.created_at).toLocaleString()}
                  </span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Delete Orphaned Confirmation Dialog */}
      <AlertDialog open={showDeleteOrphanedDialog} onOpenChange={setShowDeleteOrphanedDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Orphaned Workspaces</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to permanently delete {selectedOrphaned.size} orphaned workspace(s)? 
              This will remove all associated data and cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleDeleteSelectedOrphaned}
              disabled={isDeletingOrphaned}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeletingOrphaned ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Deleting...
                </>
              ) : (
                <>
                  <Trash2 className="h-4 w-4 mr-2" />
                  Delete {selectedOrphaned.size} Workspace(s)
                </>
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AdminLayout>
  );
}
