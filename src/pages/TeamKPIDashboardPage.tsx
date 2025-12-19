import { useState, useEffect, useMemo } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { 
  BarChart3, 
  TrendingUp, 
  TrendingDown,
  Users,
  FileText,
  CheckCircle,
  XCircle,
  Calendar,
  Download,
  RefreshCw,
  Filter,
  Target,
  Award
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth';
import { toast } from 'sonner';
import { motion } from 'framer-motion';
import { format, subDays, subMonths, startOfWeek, endOfWeek, startOfMonth, endOfMonth } from 'date-fns';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  Legend,
  AreaChart,
  Area
} from 'recharts';

interface TeamMemberKPI {
  user_id: string;
  full_name: string;
  email: string;
  avatar_url: string | null;
  cv_uploaded: number;
  cv_submitted: number;
  screening_completed: number;
  interview_scheduled: number;
  interview_completed: number;
  offer_sent: number;
  candidate_hired: number;
  candidate_rejected: number;
}

interface ActivitySummary {
  action_type: string;
  count: number;
}

const DATE_RANGES = [
  { value: 'this_week', label: 'This Week' },
  { value: 'last_week', label: 'Last Week' },
  { value: '30_days', label: 'Last 30 Days' },
  { value: '90_days', label: 'Last 90 Days' },
  { value: '24_months', label: 'Last 24 Months' },
];

const ACTION_LABELS: Record<string, string> = {
  cv_uploaded: 'CVs Uploaded',
  cv_submitted: 'CVs Submitted',
  screening_completed: 'Screenings',
  interview_scheduled: 'Interviews Scheduled',
  interview_completed: 'Interviews Completed',
  offer_sent: 'Offers Sent',
  candidate_hired: 'Hired',
  candidate_rejected: 'Rejected',
};

const COLORS = ['#0052CC', '#00C49F', '#FFBB28', '#FF8042', '#8884d8', '#82ca9d', '#ffc658', '#ff7300'];

export default function TeamKPIDashboardPage() {
  const { profile, tenantId, user } = useAuth();
  const [isLoading, setIsLoading] = useState(true);
  const [dateRange, setDateRange] = useState('30_days');
  const [selectedMember, setSelectedMember] = useState<string | null>(null);
  const [teamKPIs, setTeamKPIs] = useState<TeamMemberKPI[]>([]);
  const [trendData, setTrendData] = useState<any[]>([]);
  const [teamMembers, setTeamMembers] = useState<any[]>([]);

  // Check if current user is admin/manager
  const [userRole, setUserRole] = useState<string | null>(null);

  useEffect(() => {
    if (tenantId && user?.id) {
      fetchUserRole();
    }
  }, [tenantId, user?.id]);

  useEffect(() => {
    if (tenantId && userRole) {
      fetchKPIData();
    }
  }, [tenantId, dateRange, selectedMember, userRole]);

  const fetchUserRole = async () => {
    try {
      const { data } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', user?.id)
        .eq('tenant_id', tenantId)
        .single();

      setUserRole(data?.role || 'recruiter');
    } catch (error) {
      console.error('Error fetching user role:', error);
      setUserRole('recruiter');
    }
  };

  const getDateRange = () => {
    const now = new Date();
    switch (dateRange) {
      case 'this_week':
        return { start: startOfWeek(now), end: endOfWeek(now) };
      case 'last_week':
        const lastWeekStart = startOfWeek(subDays(now, 7));
        return { start: lastWeekStart, end: endOfWeek(lastWeekStart) };
      case '30_days':
        return { start: subDays(now, 30), end: now };
      case '90_days':
        return { start: subDays(now, 90), end: now };
      case '24_months':
        return { start: subMonths(now, 24), end: now };
      default:
        return { start: subDays(now, 30), end: now };
    }
  };

  const fetchKPIData = async () => {
    setIsLoading(true);
    try {
      const { start, end } = getDateRange();

      // Fetch team members if admin/manager
      if (userRole === 'owner' || userRole === 'manager') {
        const { data: rolesData } = await supabase
          .from('user_roles')
          .select('user_id')
          .eq('tenant_id', tenantId);

        if (rolesData) {
          const userIds = rolesData.map(r => r.user_id);
          const { data: profilesData } = await supabase
            .from('profiles')
            .select('id, full_name, email, avatar_url')
            .in('id', userIds);

          setTeamMembers(profilesData || []);
        }
      }

      // Build query based on role
      let query = supabase
        .from('recruiter_activities')
        .select('*')
        .eq('tenant_id', tenantId)
        .gte('created_at', start.toISOString())
        .lte('created_at', end.toISOString());

      // If not admin/manager, only show own data
      if (userRole !== 'owner' && userRole !== 'manager') {
        query = query.eq('user_id', user?.id);
      } else if (selectedMember) {
        query = query.eq('user_id', selectedMember);
      }

      const { data: activities, error } = await query;

      if (error) throw error;

      // Process activities into KPIs
      const kpiMap = new Map<string, TeamMemberKPI>();
      
      for (const activity of activities || []) {
        if (!kpiMap.has(activity.user_id)) {
          const memberProfile = teamMembers.find(m => m.id === activity.user_id) || { full_name: 'Unknown', email: '', avatar_url: null };
          kpiMap.set(activity.user_id, {
            user_id: activity.user_id,
            full_name: memberProfile.full_name || 'Unknown',
            email: memberProfile.email || '',
            avatar_url: memberProfile.avatar_url,
            cv_uploaded: 0,
            cv_submitted: 0,
            screening_completed: 0,
            interview_scheduled: 0,
            interview_completed: 0,
            offer_sent: 0,
            candidate_hired: 0,
            candidate_rejected: 0,
          });
        }

        const kpi = kpiMap.get(activity.user_id)!;
        const actionType = activity.action_type as keyof Omit<TeamMemberKPI, 'user_id' | 'full_name' | 'email' | 'avatar_url'>;
        if (actionType in kpi) {
          (kpi[actionType] as number)++;
        }
      }

      setTeamKPIs(Array.from(kpiMap.values()));

      // Generate trend data
      const trendMap = new Map<string, any>();
      for (const activity of activities || []) {
        const date = format(new Date(activity.created_at), dateRange === '24_months' ? 'MMM yyyy' : 'MMM dd');
        if (!trendMap.has(date)) {
          trendMap.set(date, { date, cv_uploaded: 0, cv_submitted: 0, interview_scheduled: 0, candidate_hired: 0 });
        }
        const trend = trendMap.get(date);
        if (activity.action_type in trend) {
          trend[activity.action_type]++;
        }
      }

      setTrendData(Array.from(trendMap.values()));

    } catch (error) {
      console.error('Error fetching KPI data:', error);
      toast.error('Failed to load KPI data');
    } finally {
      setIsLoading(false);
    }
  };

  // Calculate totals
  const totals = useMemo(() => {
    return teamKPIs.reduce((acc, kpi) => ({
      cv_uploaded: acc.cv_uploaded + kpi.cv_uploaded,
      cv_submitted: acc.cv_submitted + kpi.cv_submitted,
      screening_completed: acc.screening_completed + kpi.screening_completed,
      interview_scheduled: acc.interview_scheduled + kpi.interview_scheduled,
      interview_completed: acc.interview_completed + kpi.interview_completed,
      offer_sent: acc.offer_sent + kpi.offer_sent,
      candidate_hired: acc.candidate_hired + kpi.candidate_hired,
      candidate_rejected: acc.candidate_rejected + kpi.candidate_rejected,
    }), {
      cv_uploaded: 0,
      cv_submitted: 0,
      screening_completed: 0,
      interview_scheduled: 0,
      interview_completed: 0,
      offer_sent: 0,
      candidate_hired: 0,
      candidate_rejected: 0,
    });
  }, [teamKPIs]);

  // Calculate conversion ratios
  const ratios = useMemo(() => {
    const cvToInterview = totals.cv_submitted > 0 ? ((totals.interview_scheduled / totals.cv_submitted) * 100).toFixed(1) : '0';
    const interviewToOffer = totals.interview_completed > 0 ? ((totals.offer_sent / totals.interview_completed) * 100).toFixed(1) : '0';
    const offerToHire = totals.offer_sent > 0 ? ((totals.candidate_hired / totals.offer_sent) * 100).toFixed(1) : '0';
    return { cvToInterview, interviewToOffer, offerToHire };
  }, [totals]);

  // Funnel data for chart
  const funnelData = useMemo(() => [
    { name: 'CVs Submitted', value: totals.cv_submitted, fill: '#0052CC' },
    { name: 'Screened', value: totals.screening_completed, fill: '#00B8D9' },
    { name: 'Interviewed', value: totals.interview_completed, fill: '#00C49F' },
    { name: 'Offers', value: totals.offer_sent, fill: '#FFBB28' },
    { name: 'Hired', value: totals.candidate_hired, fill: '#00875A' },
  ], [totals]);

  const canViewTeam = userRole === 'owner' || userRole === 'manager';

  const handleExport = () => {
    const csvData = teamKPIs.map(kpi => ({
      Name: kpi.full_name,
      Email: kpi.email,
      'CVs Uploaded': kpi.cv_uploaded,
      'CVs Submitted': kpi.cv_submitted,
      'Screenings': kpi.screening_completed,
      'Interviews Scheduled': kpi.interview_scheduled,
      'Interviews Completed': kpi.interview_completed,
      'Offers Sent': kpi.offer_sent,
      'Hired': kpi.candidate_hired,
      'Rejected': kpi.candidate_rejected,
    }));

    const headers = Object.keys(csvData[0] || {});
    const csv = [
      headers.join(','),
      ...csvData.map(row => headers.map(h => `"${row[h as keyof typeof row]}"`).join(','))
    ].join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `team-kpi-${format(new Date(), 'yyyy-MM-dd')}.csv`;
    a.click();
  };

  return (
    <AppLayout title="Team KPI Dashboard" subtitle="Track recruitment performance metrics">
      <div className="space-y-6">
        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-4 justify-between">
          <div className="flex gap-4">
            <Select value={dateRange} onValueChange={setDateRange}>
              <SelectTrigger className="w-[180px]">
                <Calendar className="h-4 w-4 mr-2" />
                <SelectValue placeholder="Select period" />
              </SelectTrigger>
              <SelectContent>
                {DATE_RANGES.map(range => (
                  <SelectItem key={range.value} value={range.value}>
                    {range.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {canViewTeam && teamMembers.length > 0 && (
              <Select value={selectedMember || 'all'} onValueChange={(v) => setSelectedMember(v === 'all' ? null : v)}>
                <SelectTrigger className="w-[200px]">
                  <Users className="h-4 w-4 mr-2" />
                  <SelectValue placeholder="All members" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Team Members</SelectItem>
                  {teamMembers.map(member => (
                    <SelectItem key={member.id} value={member.id}>
                      {member.full_name || member.email}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          <div className="flex gap-2">
            <Button variant="outline" onClick={fetchKPIData}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Refresh
            </Button>
            <Button variant="outline" onClick={handleExport}>
              <Download className="h-4 w-4 mr-2" />
              Export
            </Button>
          </div>
        </div>

        {/* KPI Summary Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">CVs Submitted</p>
                  <p className="text-2xl font-bold">{totals.cv_submitted}</p>
                </div>
                <div className="p-2 bg-primary/10 rounded-lg">
                  <FileText className="h-5 w-5 text-primary" />
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Interviews</p>
                  <p className="text-2xl font-bold">{totals.interview_completed}</p>
                </div>
                <div className="p-2 bg-accent/10 rounded-lg">
                  <Calendar className="h-5 w-5 text-accent" />
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Offers Sent</p>
                  <p className="text-2xl font-bold">{totals.offer_sent}</p>
                </div>
                <div className="p-2 bg-warning/10 rounded-lg">
                  <Target className="h-5 w-5 text-warning" />
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Hired</p>
                  <p className="text-2xl font-bold">{totals.candidate_hired}</p>
                </div>
                <div className="p-2 bg-success/10 rounded-lg">
                  <CheckCircle className="h-5 w-5 text-success" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Conversion Ratios */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-muted-foreground">CV → Interview</span>
                <Badge variant="outline">{ratios.cvToInterview}%</Badge>
              </div>
              <Progress value={parseFloat(ratios.cvToInterview)} className="h-2" />
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-muted-foreground">Interview → Offer</span>
                <Badge variant="outline">{ratios.interviewToOffer}%</Badge>
              </div>
              <Progress value={parseFloat(ratios.interviewToOffer)} className="h-2" />
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-muted-foreground">Offer → Hire</span>
                <Badge variant="outline">{ratios.offerToHire}%</Badge>
              </div>
              <Progress value={parseFloat(ratios.offerToHire)} className="h-2" />
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="funnel">
          <TabsList>
            <TabsTrigger value="funnel">
              <BarChart3 className="h-4 w-4 mr-2" />
              Hiring Funnel
            </TabsTrigger>
            <TabsTrigger value="trend">
              <TrendingUp className="h-4 w-4 mr-2" />
              Trend
            </TabsTrigger>
            {canViewTeam && (
              <TabsTrigger value="team">
                <Users className="h-4 w-4 mr-2" />
                Team Performance
              </TabsTrigger>
            )}
          </TabsList>

          <TabsContent value="funnel" className="mt-4">
            <Card>
              <CardHeader>
                <CardTitle>Hiring Funnel</CardTitle>
                <CardDescription>Candidate progression through stages</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-[400px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={funnelData} layout="vertical">
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis type="number" />
                      <YAxis dataKey="name" type="category" width={120} />
                      <Tooltip />
                      <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                        {funnelData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.fill} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="trend" className="mt-4">
            <Card>
              <CardHeader>
                <CardTitle>Activity Trend</CardTitle>
                <CardDescription>Performance over time</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-[400px]">
                  {trendData.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={trendData}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="date" />
                        <YAxis />
                        <Tooltip />
                        <Legend />
                        <Area type="monotone" dataKey="cv_submitted" stackId="1" stroke="#0052CC" fill="#0052CC" fillOpacity={0.6} name="CVs Submitted" />
                        <Area type="monotone" dataKey="interview_scheduled" stackId="1" stroke="#00C49F" fill="#00C49F" fillOpacity={0.6} name="Interviews" />
                        <Area type="monotone" dataKey="candidate_hired" stackId="1" stroke="#00875A" fill="#00875A" fillOpacity={0.6} name="Hired" />
                      </AreaChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="flex items-center justify-center h-full text-muted-foreground">
                      No activity data for the selected period
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {canViewTeam && (
            <TabsContent value="team" className="mt-4">
              <Card>
                <CardHeader>
                  <CardTitle>Team Performance</CardTitle>
                  <CardDescription>Individual recruiter metrics</CardDescription>
                </CardHeader>
                <CardContent>
                  {isLoading ? (
                    <div className="text-center py-8 text-muted-foreground">Loading...</div>
                  ) : teamKPIs.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      No activity data for the selected period
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {teamKPIs.map((kpi, index) => (
                        <motion.div
                          key={kpi.user_id}
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: index * 0.05 }}
                          className="p-4 border rounded-lg hover:bg-muted/50 transition-colors"
                        >
                          <div className="flex items-center justify-between mb-4">
                            <div className="flex items-center gap-3">
                              <Avatar>
                                <AvatarImage src={kpi.avatar_url || undefined} />
                                <AvatarFallback>{kpi.full_name?.charAt(0) || 'U'}</AvatarFallback>
                              </Avatar>
                              <div>
                                <p className="font-medium">{kpi.full_name}</p>
                                <p className="text-sm text-muted-foreground">{kpi.email}</p>
                              </div>
                            </div>
                            <Badge variant="outline" className="flex items-center gap-1">
                              <Award className="h-3 w-3" />
                              {kpi.candidate_hired} hires
                            </Badge>
                          </div>
                          <div className="grid grid-cols-4 md:grid-cols-8 gap-2 text-center text-sm">
                            <div className="p-2 bg-muted/50 rounded">
                              <p className="font-semibold">{kpi.cv_uploaded}</p>
                              <p className="text-xs text-muted-foreground">Uploaded</p>
                            </div>
                            <div className="p-2 bg-muted/50 rounded">
                              <p className="font-semibold">{kpi.cv_submitted}</p>
                              <p className="text-xs text-muted-foreground">Submitted</p>
                            </div>
                            <div className="p-2 bg-muted/50 rounded">
                              <p className="font-semibold">{kpi.screening_completed}</p>
                              <p className="text-xs text-muted-foreground">Screened</p>
                            </div>
                            <div className="p-2 bg-muted/50 rounded">
                              <p className="font-semibold">{kpi.interview_scheduled}</p>
                              <p className="text-xs text-muted-foreground">Int. Sched.</p>
                            </div>
                            <div className="p-2 bg-muted/50 rounded">
                              <p className="font-semibold">{kpi.interview_completed}</p>
                              <p className="text-xs text-muted-foreground">Int. Done</p>
                            </div>
                            <div className="p-2 bg-muted/50 rounded">
                              <p className="font-semibold">{kpi.offer_sent}</p>
                              <p className="text-xs text-muted-foreground">Offers</p>
                            </div>
                            <div className="p-2 bg-success/10 rounded">
                              <p className="font-semibold text-success">{kpi.candidate_hired}</p>
                              <p className="text-xs text-muted-foreground">Hired</p>
                            </div>
                            <div className="p-2 bg-destructive/10 rounded">
                              <p className="font-semibold text-destructive">{kpi.candidate_rejected}</p>
                              <p className="text-xs text-muted-foreground">Rejected</p>
                            </div>
                          </div>
                        </motion.div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          )}
        </Tabs>
      </div>
    </AppLayout>
  );
}
