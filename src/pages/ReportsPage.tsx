import { useState, useEffect } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Download, 
  TrendingUp, 
  TrendingDown,
  Users, 
  Briefcase, 
  UserCheck, 
  UserX,
  Calendar,
  BarChart3,
  PieChart,
  Loader2,
  RefreshCcw
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth';
import { toast } from 'sonner';
import { format, subMonths, startOfMonth, endOfMonth, parseISO } from 'date-fns';
import { motion } from 'framer-motion';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart as RechartsPie,
  Pie,
  Cell,
  Legend,
  LineChart,
  Line
} from 'recharts';

interface MonthlyData {
  month: string;
  hired: number;
  interviewing: number;
  rejected: number;
  offered: number;
  applied: number;
}

interface StatusCount {
  name: string;
  value: number;
  color: string;
}

const COLORS = {
  hired: 'hsl(var(--success))',
  interviewing: 'hsl(var(--info))',
  rejected: 'hsl(var(--destructive))',
  offered: 'hsl(var(--warning))',
  applied: 'hsl(var(--accent))',
  screening: 'hsl(var(--muted-foreground))',
};

const ReportsPage = () => {
  const { tenantId } = useAuth();
  const [isLoading, setIsLoading] = useState(true);
  const [monthlyData, setMonthlyData] = useState<MonthlyData[]>([]);
  const [statusCounts, setStatusCounts] = useState<StatusCount[]>([]);
  const [dateRange, setDateRange] = useState('12');
  const [stats, setStats] = useState({
    totalCandidates: 0,
    totalJobs: 0,
    totalHired: 0,
    conversionRate: 0,
    avgTimeToHire: 0,
  });

  useEffect(() => {
    if (tenantId) {
      fetchReportData();
    }
  }, [tenantId, dateRange]);

  const fetchReportData = async () => {
    setIsLoading(true);
    try {
      const months = parseInt(dateRange);
      const startDate = startOfMonth(subMonths(new Date(), months - 1));
      const endDate = endOfMonth(new Date());

      // Fetch job candidates with stage info
      const { data: jobCandidates, error: jcError } = await supabase
        .from('job_candidates')
        .select('stage, created_at, stage_updated_at')
        .eq('tenant_id', tenantId)
        .gte('created_at', startDate.toISOString())
        .lte('created_at', endDate.toISOString());

      if (jcError) throw jcError;

      // Fetch totals
      const [candidatesRes, jobsRes] = await Promise.all([
        supabase.from('candidates').select('id', { count: 'exact' }).eq('tenant_id', tenantId),
        supabase.from('jobs').select('id', { count: 'exact' }).eq('tenant_id', tenantId),
      ]);

      // Process monthly data
      const monthlyMap = new Map<string, MonthlyData>();
      
      for (let i = 0; i < months; i++) {
        const monthDate = subMonths(new Date(), months - 1 - i);
        const monthKey = format(monthDate, 'MMM yyyy');
        monthlyMap.set(monthKey, {
          month: monthKey,
          hired: 0,
          interviewing: 0,
          rejected: 0,
          offered: 0,
          applied: 0,
        });
      }

      // Count by stage and month
      const stageCounts: Record<string, number> = {
        applied: 0,
        screening: 0,
        interview: 0,
        technical: 0,
        offer: 0,
        hired: 0,
        rejected: 0,
      };

      jobCandidates?.forEach((jc) => {
        const monthKey = format(parseISO(jc.created_at), 'MMM yyyy');
        const monthData = monthlyMap.get(monthKey);
        
        if (monthData) {
          switch (jc.stage) {
            case 'hired':
              monthData.hired++;
              break;
            case 'interview':
            case 'technical':
              monthData.interviewing++;
              break;
            case 'rejected':
              monthData.rejected++;
              break;
            case 'offer':
              monthData.offered++;
              break;
            default:
              monthData.applied++;
          }
        }

        if (jc.stage) {
          stageCounts[jc.stage] = (stageCounts[jc.stage] || 0) + 1;
        }
      });

      const totalHired = stageCounts.hired || 0;
      const totalApplications = jobCandidates?.length || 1;

      setMonthlyData(Array.from(monthlyMap.values()));
      setStatusCounts([
        { name: 'Applied', value: stageCounts.applied + stageCounts.screening, color: COLORS.applied },
        { name: 'Interviewing', value: stageCounts.interview + stageCounts.technical, color: COLORS.interviewing },
        { name: 'Offered', value: stageCounts.offer, color: COLORS.offered },
        { name: 'Hired', value: stageCounts.hired, color: COLORS.hired },
        { name: 'Rejected', value: stageCounts.rejected, color: COLORS.rejected },
      ]);
      
      setStats({
        totalCandidates: candidatesRes.count || 0,
        totalJobs: jobsRes.count || 0,
        totalHired,
        conversionRate: Math.round((totalHired / totalApplications) * 100),
        avgTimeToHire: 14, // Placeholder - would need actual calculation
      });

    } catch (error) {
      console.error('Error fetching report data:', error);
      toast.error('Failed to load report data');
    } finally {
      setIsLoading(false);
    }
  };

  const exportToCSV = () => {
    const headers = ['Month', 'Applied', 'Interviewing', 'Offered', 'Hired', 'Rejected'];
    const rows = monthlyData.map(d => [
      d.month,
      d.applied,
      d.interviewing,
      d.offered,
      d.hired,
      d.rejected
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map(r => r.join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `recruitment-report-${format(new Date(), 'yyyy-MM-dd')}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    toast.success('Report exported successfully');
  };

  return (
    <AppLayout title="Reports" subtitle="Hiring funnel and recruitment analytics">
      {/* Filters */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
        <div className="flex items-center gap-3">
          <Select value={dateRange} onValueChange={setDateRange}>
            <SelectTrigger className="w-40">
              <SelectValue placeholder="Date range" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="3">Last 3 months</SelectItem>
              <SelectItem value="6">Last 6 months</SelectItem>
              <SelectItem value="12">Last 12 months</SelectItem>
              <SelectItem value="24">Last 24 months</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" size="icon" onClick={fetchReportData} disabled={isLoading}>
            <RefreshCcw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
          </Button>
        </div>
        <Button onClick={exportToCSV} className="gap-2">
          <Download className="h-4 w-4" />
          Export CSV
        </Button>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <>
          {/* Stats Cards */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
              <Card className="p-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-accent/10">
                    <Users className="h-5 w-5 text-accent" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold">{stats.totalCandidates}</p>
                    <p className="text-sm text-muted-foreground">Total Candidates</p>
                  </div>
                </div>
              </Card>
            </motion.div>
            
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
              <Card className="p-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-info/10">
                    <Briefcase className="h-5 w-5 text-info" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold">{stats.totalJobs}</p>
                    <p className="text-sm text-muted-foreground">Total Jobs</p>
                  </div>
                </div>
              </Card>
            </motion.div>
            
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
              <Card className="p-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-success/10">
                    <UserCheck className="h-5 w-5 text-success" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold">{stats.totalHired}</p>
                    <p className="text-sm text-muted-foreground">Total Hired</p>
                  </div>
                </div>
              </Card>
            </motion.div>
            
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
              <Card className="p-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-warning/10">
                    <TrendingUp className="h-5 w-5 text-warning" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold">{stats.conversionRate}%</p>
                    <p className="text-sm text-muted-foreground">Conversion Rate</p>
                  </div>
                </div>
              </Card>
            </motion.div>
            
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}>
              <Card className="p-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-muted">
                    <Calendar className="h-5 w-5 text-muted-foreground" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold">{stats.avgTimeToHire}d</p>
                    <p className="text-sm text-muted-foreground">Avg Time to Hire</p>
                  </div>
                </div>
              </Card>
            </motion.div>
          </div>

          {/* Charts */}
          <Tabs defaultValue="funnel" className="space-y-6">
            <TabsList>
              <TabsTrigger value="funnel" className="gap-2">
                <BarChart3 className="h-4 w-4" />
                Hiring Funnel
              </TabsTrigger>
              <TabsTrigger value="trend" className="gap-2">
                <TrendingUp className="h-4 w-4" />
                Trend
              </TabsTrigger>
              <TabsTrigger value="distribution" className="gap-2">
                <PieChart className="h-4 w-4" />
                Distribution
              </TabsTrigger>
            </TabsList>

            <TabsContent value="funnel">
              <Card className="p-6">
                <CardHeader className="px-0 pt-0">
                  <CardTitle>Monthly Hiring Funnel</CardTitle>
                  <CardDescription>Candidates by stage over time</CardDescription>
                </CardHeader>
                <CardContent className="px-0 pb-0">
                  <div className="h-80">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={monthlyData} margin={{ top: 20, right: 30, left: 0, bottom: 5 }}>
                        <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                        <XAxis dataKey="month" className="text-xs" />
                        <YAxis className="text-xs" />
                        <Tooltip 
                          contentStyle={{ 
                            backgroundColor: 'hsl(var(--card))', 
                            border: '1px solid hsl(var(--border))',
                            borderRadius: '8px'
                          }} 
                        />
                        <Legend />
                        <Bar dataKey="applied" name="Applied" fill={COLORS.applied} radius={[4, 4, 0, 0]} />
                        <Bar dataKey="interviewing" name="Interviewing" fill={COLORS.interviewing} radius={[4, 4, 0, 0]} />
                        <Bar dataKey="offered" name="Offered" fill={COLORS.offered} radius={[4, 4, 0, 0]} />
                        <Bar dataKey="hired" name="Hired" fill={COLORS.hired} radius={[4, 4, 0, 0]} />
                        <Bar dataKey="rejected" name="Rejected" fill={COLORS.rejected} radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="trend">
              <Card className="p-6">
                <CardHeader className="px-0 pt-0">
                  <CardTitle>Hiring Trend</CardTitle>
                  <CardDescription>Hired candidates over time</CardDescription>
                </CardHeader>
                <CardContent className="px-0 pb-0">
                  <div className="h-80">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={monthlyData} margin={{ top: 20, right: 30, left: 0, bottom: 5 }}>
                        <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                        <XAxis dataKey="month" className="text-xs" />
                        <YAxis className="text-xs" />
                        <Tooltip 
                          contentStyle={{ 
                            backgroundColor: 'hsl(var(--card))', 
                            border: '1px solid hsl(var(--border))',
                            borderRadius: '8px'
                          }} 
                        />
                        <Legend />
                        <Line type="monotone" dataKey="hired" name="Hired" stroke={COLORS.hired} strokeWidth={2} dot={{ fill: COLORS.hired }} />
                        <Line type="monotone" dataKey="interviewing" name="Interviewing" stroke={COLORS.interviewing} strokeWidth={2} dot={{ fill: COLORS.interviewing }} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="distribution">
              <Card className="p-6">
                <CardHeader className="px-0 pt-0">
                  <CardTitle>Status Distribution</CardTitle>
                  <CardDescription>Current candidates by stage</CardDescription>
                </CardHeader>
                <CardContent className="px-0 pb-0">
                  <div className="h-80">
                    <ResponsiveContainer width="100%" height="100%">
                      <RechartsPie>
                        <Pie
                          data={statusCounts}
                          cx="50%"
                          cy="50%"
                          innerRadius={60}
                          outerRadius={100}
                          paddingAngle={5}
                          dataKey="value"
                          label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                        >
                          {statusCounts.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.color} />
                          ))}
                        </Pie>
                        <Tooltip 
                          contentStyle={{ 
                            backgroundColor: 'hsl(var(--card))', 
                            border: '1px solid hsl(var(--border))',
                            borderRadius: '8px'
                          }} 
                        />
                        <Legend />
                      </RechartsPie>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>

          {/* Data Table */}
          <Card className="mt-6">
            <CardHeader>
              <CardTitle>Monthly Data</CardTitle>
              <CardDescription>Raw numbers for export and analysis</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="text-left py-3 px-4 font-medium">Month</th>
                      <th className="text-right py-3 px-4 font-medium">Applied</th>
                      <th className="text-right py-3 px-4 font-medium">Interviewing</th>
                      <th className="text-right py-3 px-4 font-medium">Offered</th>
                      <th className="text-right py-3 px-4 font-medium">Hired</th>
                      <th className="text-right py-3 px-4 font-medium">Rejected</th>
                    </tr>
                  </thead>
                  <tbody>
                    {monthlyData.map((row, idx) => (
                      <tr key={idx} className="border-b border-border/50 hover:bg-muted/50">
                        <td className="py-3 px-4">{row.month}</td>
                        <td className="text-right py-3 px-4">{row.applied}</td>
                        <td className="text-right py-3 px-4">{row.interviewing}</td>
                        <td className="text-right py-3 px-4">{row.offered}</td>
                        <td className="text-right py-3 px-4">
                          <Badge variant="outline" className="bg-success/10 text-success">{row.hired}</Badge>
                        </td>
                        <td className="text-right py-3 px-4">{row.rejected}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </AppLayout>
  );
};

export default ReportsPage;
