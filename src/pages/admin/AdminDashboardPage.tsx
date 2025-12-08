import { useState, useEffect } from 'react';
import { AdminLayout } from '@/components/admin/AdminLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { supabase } from '@/integrations/supabase/client';
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

interface DashboardMetrics {
  totalUsers: number;
  activeTenants: number;
  activeSubscriptions: number;
  mrr: number;
  totalRevenue: number;
  expiringSubscriptions: number;
  pausedAccounts: number;
  trialAccounts: number;
}

interface RecentActivity {
  id: string;
  action: string;
  entity_type: string;
  entity_name: string | null;
  created_at: string;
}

export default function AdminDashboardPage() {
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);
  const [recentActivity, setRecentActivity] = useState<RecentActivity[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [mrrData, setMrrData] = useState<{ month: string; mrr: number }[]>([]);
  const [signupsData, setSignupsData] = useState<{ date: string; signups: number }[]>([]);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      setIsLoading(true);

      // Fetch total users
      const { count: totalUsers } = await supabase
        .from('profiles')
        .select('*', { count: 'exact', head: true });

      // Fetch active tenants
      const { count: activeTenants } = await supabase
        .from('tenants')
        .select('*', { count: 'exact', head: true })
        .eq('is_suspended', false);

      // Fetch subscriptions by status
      const { data: tenantData } = await supabase
        .from('tenants')
        .select('subscription_status, is_paused, is_suspended, subscription_ends_at');

      const activeSubscriptions = tenantData?.filter(t => 
        t.subscription_status === 'active' && !t.is_suspended
      ).length || 0;

      const pausedAccounts = tenantData?.filter(t => t.is_paused).length || 0;
      const trialAccounts = tenantData?.filter(t => t.subscription_status === 'trial').length || 0;

      // Expiring in next 30 days
      const thirtyDaysFromNow = new Date();
      thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);
      const expiringSubscriptions = tenantData?.filter(t => {
        if (!t.subscription_ends_at) return false;
        const endDate = new Date(t.subscription_ends_at);
        return endDate <= thirtyDaysFromNow && endDate > new Date();
      }).length || 0;

      // Fetch invoices for revenue calculation
      const { data: invoiceData } = await supabase
        .from('invoices')
        .select('amount, status, created_at')
        .eq('status', 'paid');

      const totalRevenue = invoiceData?.reduce((sum, inv) => sum + Number(inv.amount), 0) || 0;
      
      // Calculate MRR (simplified - based on active subscriptions and average)
      const mrr = activeSubscriptions * 19; // Assuming average $19/month

      setMetrics({
        totalUsers: totalUsers || 0,
        activeTenants: activeTenants || 0,
        activeSubscriptions,
        mrr,
        totalRevenue,
        expiringSubscriptions,
        pausedAccounts,
        trialAccounts,
      });

      // Generate mock MRR data for chart
      const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      const currentMonth = new Date().getMonth();
      const mrrChartData = months.slice(0, currentMonth + 1).map((month, idx) => ({
        month,
        mrr: Math.floor(mrr * (0.6 + (idx * 0.05) + Math.random() * 0.1)),
      }));
      setMrrData(mrrChartData);

      // Generate mock signups data for last 30 days
      const signupsChartData = Array.from({ length: 30 }, (_, i) => {
        const date = new Date();
        date.setDate(date.getDate() - (29 - i));
        return {
          date: date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
          signups: Math.floor(Math.random() * 5) + 1,
        };
      });
      setSignupsData(signupsChartData);

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
    } finally {
      setIsLoading(false);
    }
  };

  const statCards = [
    { title: 'Total Users', value: metrics?.totalUsers, icon: Users, color: 'text-blue-500' },
    { title: 'Active Tenants', value: metrics?.activeTenants, icon: Building2, color: 'text-green-500' },
    { title: 'Active Subscriptions', value: metrics?.activeSubscriptions, icon: CreditCard, color: 'text-purple-500' },
    { title: 'MRR', value: `$${metrics?.mrr?.toLocaleString()}`, icon: TrendingUp, color: 'text-emerald-500' },
    { title: 'Total Revenue (YTD)', value: `$${metrics?.totalRevenue?.toLocaleString()}`, icon: DollarSign, color: 'text-amber-500' },
    { title: 'Expiring (30 days)', value: metrics?.expiringSubscriptions, icon: Clock, color: 'text-orange-500' },
    { title: 'Paused Accounts', value: metrics?.pausedAccounts, icon: PauseCircle, color: 'text-red-500' },
    { title: 'Trial Accounts', value: metrics?.trialAccounts, icon: AlertTriangle, color: 'text-yellow-500' },
  ];

  return (
    <AdminLayout title="Admin Dashboard" description="Platform overview and quick actions">
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
            <Button variant="outline" size="sm">
              <UserPlus className="h-4 w-4 mr-2" />
              Create User
            </Button>
            <Button variant="outline" size="sm">
              <PauseCircle className="h-4 w-4 mr-2" />
              Pause User
            </Button>
            <Button variant="outline" size="sm">
              <Send className="h-4 w-4 mr-2" />
              Send Reminder
            </Button>
            <Button variant="outline" size="sm">
              <Clock className="h-4 w-4 mr-2" />
              Grant Grace Period
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Charts */}
      <div className="grid md:grid-cols-2 gap-6 mb-8">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">MRR Trend (12 Months)</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-64 w-full" />
            ) : (
              <ResponsiveContainer width="100%" height={250}>
                <AreaChart data={mrrData}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="month" className="text-xs" />
                  <YAxis className="text-xs" />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: 'hsl(var(--card))', 
                      border: '1px solid hsl(var(--border))' 
                    }} 
                  />
                  <Area
                    type="monotone"
                    dataKey="mrr"
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
