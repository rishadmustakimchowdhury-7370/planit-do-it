import { useState, useEffect } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Mail,
  Send,
  Eye,
  MousePointer,
  Clock,
  CheckCircle,
  XCircle,
  TrendingUp,
  BarChart3,
  RefreshCw,
  Calendar,
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth';
import { toast } from 'sonner';
import { format, subDays, startOfDay, endOfDay } from 'date-fns';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
} from 'recharts';

interface EmailStats {
  total: number;
  sent: number;
  opened: number;
  clicked: number;
  failed: number;
  scheduled: number;
  openRate: number;
  clickRate: number;
}

interface DailyStats {
  date: string;
  sent: number;
  opened: number;
  clicked: number;
}

const COLORS = ['#0052CC', '#00875A', '#FF5630', '#6554C0', '#FFAB00'];

export default function EmailAnalyticsPage() {
  const { tenantId } = useAuth();
  const [isLoading, setIsLoading] = useState(true);
  const [dateRange, setDateRange] = useState('7');
  const [stats, setStats] = useState<EmailStats>({
    total: 0,
    sent: 0,
    opened: 0,
    clicked: 0,
    failed: 0,
    scheduled: 0,
    openRate: 0,
    clickRate: 0,
  });
  const [dailyStats, setDailyStats] = useState<DailyStats[]>([]);
  const [statusBreakdown, setStatusBreakdown] = useState<{ name: string; value: number }[]>([]);
  const [topPerformers, setTopPerformers] = useState<any[]>([]);

  useEffect(() => {
    if (tenantId) {
      fetchAnalytics();
    }
  }, [tenantId, dateRange]);

  const fetchAnalytics = async () => {
    setIsLoading(true);
    try {
      const days = parseInt(dateRange);
      const startDate = startOfDay(subDays(new Date(), days)).toISOString();
      const endDate = endOfDay(new Date()).toISOString();

      // Fetch all emails in date range
      const { data: emails, error } = await supabase
        .from('candidate_emails')
        .select('id, status, sent_at, created_at, metadata, subject')
        .gte('created_at', startDate)
        .lte('created_at', endDate)
        .order('created_at', { ascending: false });

      if (error) throw error;

      const emailList = emails || [];

      // Calculate stats
      const total = emailList.length;
      const sent = emailList.filter(e => ['sent', 'delivered', 'opened'].includes(e.status)).length;
      const opened = emailList.filter(e => {
        const metadata = e.metadata as Record<string, any>;
        return e.status === 'opened' || metadata?.open_count > 0;
      }).length;
      const clicked = emailList.filter(e => {
        const metadata = e.metadata as Record<string, any>;
        return metadata?.click_count > 0;
      }).length;
      const failed = emailList.filter(e => e.status === 'failed' || e.status === 'bounced').length;
      const scheduled = emailList.filter(e => e.status === 'scheduled').length;

      setStats({
        total,
        sent,
        opened,
        clicked,
        failed,
        scheduled,
        openRate: sent > 0 ? Math.round((opened / sent) * 100) : 0,
        clickRate: opened > 0 ? Math.round((clicked / opened) * 100) : 0,
      });

      // Calculate daily stats
      const dailyMap = new Map<string, DailyStats>();
      for (let i = 0; i <= days; i++) {
        const date = format(subDays(new Date(), i), 'yyyy-MM-dd');
        dailyMap.set(date, { date, sent: 0, opened: 0, clicked: 0 });
      }

      emailList.forEach(email => {
        const date = format(new Date(email.created_at), 'yyyy-MM-dd');
        const existing = dailyMap.get(date);
        if (existing) {
          if (['sent', 'delivered', 'opened'].includes(email.status)) {
            existing.sent++;
          }
          const metadata = email.metadata as Record<string, any>;
          if (email.status === 'opened' || metadata?.open_count > 0) {
            existing.opened++;
          }
          if (metadata?.click_count > 0) {
            existing.clicked++;
          }
        }
      });

      setDailyStats(
        Array.from(dailyMap.values())
          .sort((a, b) => a.date.localeCompare(b.date))
          .map(d => ({ ...d, date: format(new Date(d.date), 'MMM d') }))
      );

      // Status breakdown
      const statusCounts = {
        Sent: emailList.filter(e => e.status === 'sent').length,
        Opened: opened,
        Clicked: clicked,
        Failed: failed,
        Scheduled: scheduled,
      };
      setStatusBreakdown(
        Object.entries(statusCounts)
          .filter(([, v]) => v > 0)
          .map(([name, value]) => ({ name, value }))
      );

      // Top performing emails
      setTopPerformers(
        emailList
          .filter(e => {
            const metadata = e.metadata as Record<string, any>;
            return metadata?.open_count > 0;
          })
          .sort((a, b) => {
            const aMetadata = a.metadata as Record<string, any>;
            const bMetadata = b.metadata as Record<string, any>;
            return (bMetadata?.open_count || 0) - (aMetadata?.open_count || 0);
          })
          .slice(0, 5)
      );
    } catch (error) {
      console.error('Error fetching analytics:', error);
      toast.error('Failed to load analytics');
    } finally {
      setIsLoading(false);
    }
  };

  const StatCard = ({ title, value, icon: Icon, change, color }: any) => (
    <Card>
      <CardContent className="pt-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-muted-foreground">{title}</p>
            <p className="text-2xl font-bold mt-1">{value}</p>
            {change !== undefined && (
              <p className={`text-xs mt-1 ${change >= 0 ? 'text-success' : 'text-destructive'}`}>
                {change >= 0 ? '+' : ''}{change}% from last period
              </p>
            )}
          </div>
          <div className={`p-3 rounded-xl ${color}`}>
            <Icon className="h-6 w-6" />
          </div>
        </div>
      </CardContent>
    </Card>
  );

  if (isLoading) {
    return (
      <AppLayout>
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map(i => (
              <Skeleton key={i} className="h-32" />
            ))}
          </div>
          <Skeleton className="h-80" />
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold">Email Analytics</h1>
            <p className="text-muted-foreground">Track your email performance and engagement</p>
          </div>
          <div className="flex items-center gap-2">
            <Select value={dateRange} onValueChange={setDateRange}>
              <SelectTrigger className="w-40">
                <Calendar className="h-4 w-4 mr-2" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="7">Last 7 days</SelectItem>
                <SelectItem value="14">Last 14 days</SelectItem>
                <SelectItem value="30">Last 30 days</SelectItem>
                <SelectItem value="90">Last 90 days</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="outline" size="icon" onClick={fetchAnalytics}>
              <RefreshCw className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            title="Total Sent"
            value={stats.sent}
            icon={Send}
            color="bg-primary/10 text-primary"
          />
          <StatCard
            title="Opened"
            value={`${stats.opened} (${stats.openRate}%)`}
            icon={Eye}
            color="bg-success/10 text-success"
          />
          <StatCard
            title="Clicked"
            value={`${stats.clicked} (${stats.clickRate}%)`}
            icon={MousePointer}
            color="bg-info/10 text-info"
          />
          <StatCard
            title="Failed"
            value={stats.failed}
            icon={XCircle}
            color="bg-destructive/10 text-destructive"
          />
        </div>

        {/* Charts */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Trend Chart */}
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5" />
                Email Activity Trend
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={dailyStats}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis dataKey="date" className="text-xs" />
                    <YAxis className="text-xs" />
                    <Tooltip 
                      contentStyle={{ 
                        backgroundColor: 'hsl(var(--background))',
                        border: '1px solid hsl(var(--border))',
                        borderRadius: '8px',
                      }}
                    />
                    <Line 
                      type="monotone" 
                      dataKey="sent" 
                      stroke="#0052CC" 
                      strokeWidth={2}
                      name="Sent"
                    />
                    <Line 
                      type="monotone" 
                      dataKey="opened" 
                      stroke="#00875A" 
                      strokeWidth={2}
                      name="Opened"
                    />
                    <Line 
                      type="monotone" 
                      dataKey="clicked" 
                      stroke="#FF5630" 
                      strokeWidth={2}
                      name="Clicked"
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          {/* Status Breakdown */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BarChart3 className="h-5 w-5" />
                Status Breakdown
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={statusBreakdown}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={90}
                      paddingAngle={2}
                      dataKey="value"
                    >
                      {statusBreakdown.map((entry, index) => (
                        <Cell key={entry.name} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="flex flex-wrap gap-2 mt-4 justify-center">
                {statusBreakdown.map((entry, index) => (
                  <div key={entry.name} className="flex items-center gap-1.5 text-xs">
                    <div 
                      className="w-3 h-3 rounded-full" 
                      style={{ backgroundColor: COLORS[index % COLORS.length] }}
                    />
                    {entry.name}: {entry.value}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Top Performing Emails */}
        <Card>
          <CardHeader>
            <CardTitle>Top Performing Emails</CardTitle>
            <CardDescription>Emails with the highest open rates</CardDescription>
          </CardHeader>
          <CardContent>
            {topPerformers.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Mail className="h-12 w-12 mx-auto mb-2 opacity-50" />
                <p>No email engagement data yet</p>
              </div>
            ) : (
              <div className="space-y-4">
                {topPerformers.map((email, index) => {
                  const metadata = email.metadata as Record<string, any>;
                  return (
                    <div
                      key={email.id}
                      className="flex items-center justify-between p-4 rounded-lg bg-muted/30"
                    >
                      <div className="flex items-center gap-3">
                        <div className="flex items-center justify-center w-8 h-8 rounded-full bg-primary/10 text-primary font-semibold text-sm">
                          {index + 1}
                        </div>
                        <div>
                          <p className="font-medium text-sm">{email.subject}</p>
                          <p className="text-xs text-muted-foreground">
                            Sent {format(new Date(email.sent_at || email.created_at), 'MMM d, yyyy')}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        <div className="text-center">
                          <p className="text-lg font-semibold">{metadata?.open_count || 0}</p>
                          <p className="text-xs text-muted-foreground">Opens</p>
                        </div>
                        <div className="text-center">
                          <p className="text-lg font-semibold">{metadata?.click_count || 0}</p>
                          <p className="text-xs text-muted-foreground">Clicks</p>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
