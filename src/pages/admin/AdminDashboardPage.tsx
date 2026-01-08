import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { AdminLayout } from '@/components/admin/AdminLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
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

interface MonthlyRevenue {
  month: string;
  revenue: number;
}

export default function AdminDashboardPage() {
  const navigate = useNavigate();
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);
  const [recentActivity, setRecentActivity] = useState<RecentActivity[]>([]);
  const [archivedUsers, setArchivedUsers] = useState<ArchivedUser[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [mrrData, setMrrData] = useState<MonthlyRevenue[]>([]);
  const [signupsData, setSignupsData] = useState<{ date: string; signups: number }[]>([]);
  const [isSendingReminders, setIsSendingReminders] = useState(false);
  const [showArchived, setShowArchived] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

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
        .select('id, subscription_status, is_paused, is_suspended, subscription_ends_at, subscription_plan_id');

      // Calculate metrics from actual data
      const activeTenants = tenantData?.filter(t => !t.is_suspended).length || 0;
      
      const activeSubscriptions = tenantData?.filter(t => 
        t.subscription_status === 'active' && !t.is_suspended && !t.is_paused
      ).length || 0;

      const pausedAccounts = tenantData?.filter(t => t.is_paused === true).length || 0;
      const trialAccounts = tenantData?.filter(t => t.subscription_status === 'trial').length || 0;

      // Expiring in next 30 days
      const thirtyDaysFromNow = new Date();
      thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);
      const now = new Date();
      
      const expiringSubscriptions = tenantData?.filter(t => {
        if (!t.subscription_ends_at) return false;
        const endDate = new Date(t.subscription_ends_at);
        return endDate <= thirtyDaysFromNow && endDate > now;
      }).length || 0;

      // Fetch all invoices for revenue calculation
      const { data: allInvoices } = await supabase
        .from('invoices')
        .select('amount, status, created_at, paid_at')
        .eq('status', 'paid');

      const totalRevenue = allInvoices?.reduce((sum, inv) => sum + Number(inv.amount), 0) || 0;
      
      // Calculate actual MRR from paid invoices in the last month
      const lastMonthStart = startOfMonth(subMonths(now, 1));
      const lastMonthEnd = endOfMonth(subMonths(now, 1));
      
      const lastMonthInvoices = allInvoices?.filter(inv => {
        const paidDate = inv.paid_at ? new Date(inv.paid_at) : new Date(inv.created_at);
        return paidDate >= lastMonthStart && paidDate <= lastMonthEnd;
      }) || [];
      
      const mrr = lastMonthInvoices.reduce((sum, inv) => sum + Number(inv.amount), 0);

      // Calculate monthly revenue for the chart (last 12 months)
      const monthlyRevenueData: MonthlyRevenue[] = [];
      for (let i = 11; i >= 0; i--) {
        const monthStart = startOfMonth(subMonths(now, i));
        const monthEnd = endOfMonth(subMonths(now, i));
        
        const monthInvoices = allInvoices?.filter(inv => {
          const paidDate = inv.paid_at ? new Date(inv.paid_at) : new Date(inv.created_at);
          return paidDate >= monthStart && paidDate <= monthEnd;
        }) || [];
        
        const monthRevenue = monthInvoices.reduce((sum, inv) => sum + Number(inv.amount), 0);
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
                      <p className="text-xs text-muted-foreground">{user.email}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary" className="text-xs">
                        Deleted {format(new Date(user.deleted_at), 'MMM d, yyyy')}
                      </Badge>
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => {
                          navigator.clipboard.writeText(user.email);
                          toast.success('Email copied for marketing');
                        }}
                      >
                        <Mail className="h-3 w-3" />
                      </Button>
                    </div>
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
    </AdminLayout>
  );
}
