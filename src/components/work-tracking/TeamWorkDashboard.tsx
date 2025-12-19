import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { 
  Users, 
  RefreshCw, 
  Download, 
  Clock, 
  Coffee,
  Play,
  StopCircle,
  Calendar,
  TrendingUp
} from 'lucide-react';
import { useTeamWorkStatus, fetchWorkSessions, formatDuration, WorkStatus } from '@/hooks/useWorkTracking';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth';
import { toast } from 'sonner';
import { format, subDays, startOfWeek, endOfWeek, startOfMonth, endOfMonth } from 'date-fns';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';

const statusConfig: Record<WorkStatus, { label: string; color: string; icon: React.ElementType }> = {
  'working': { label: 'Working', color: 'bg-success text-success-foreground', icon: Play },
  'on_break': { label: 'On Break', color: 'bg-warning text-warning-foreground', icon: Coffee },
  'ended': { label: 'Offline', color: 'bg-muted text-muted-foreground', icon: StopCircle },
};

const DATE_RANGES = [
  { value: 'today', label: 'Today' },
  { value: 'this_week', label: 'This Week' },
  { value: 'last_week', label: 'Last Week' },
  { value: 'this_month', label: 'This Month' },
  { value: 'last_30_days', label: 'Last 30 Days' },
];

interface SessionWithProfile {
  id: string;
  user_id: string;
  date: string;
  started_at: string | null;
  ended_at: string | null;
  total_work_minutes: number;
  total_break_minutes: number;
  status: WorkStatus;
  profiles: {
    full_name: string | null;
    email: string;
    avatar_url: string | null;
  } | null;
}

export function TeamWorkDashboard() {
  const { tenantId } = useAuth();
  const { teamStatus, isLoading: isStatusLoading, refetch } = useTeamWorkStatus();
  const [dateRange, setDateRange] = useState('this_week');
  const [sessions, setSessions] = useState<SessionWithProfile[]>([]);
  const [isLoadingSessions, setIsLoadingSessions] = useState(false);

  // Calculate date range
  const getDateRange = () => {
    const now = new Date();
    switch (dateRange) {
      case 'today':
        return { start: now, end: now };
      case 'this_week':
        return { start: startOfWeek(now, { weekStartsOn: 1 }), end: endOfWeek(now, { weekStartsOn: 1 }) };
      case 'last_week':
        const lastWeek = subDays(now, 7);
        return { start: startOfWeek(lastWeek, { weekStartsOn: 1 }), end: endOfWeek(lastWeek, { weekStartsOn: 1 }) };
      case 'this_month':
        return { start: startOfMonth(now), end: endOfMonth(now) };
      case 'last_30_days':
        return { start: subDays(now, 30), end: now };
      default:
        return { start: subDays(now, 7), end: now };
    }
  };

  // Fetch sessions for the selected date range
  useEffect(() => {
    const loadSessions = async () => {
      if (!tenantId) return;
      
      setIsLoadingSessions(true);
      try {
        const { start, end } = getDateRange();
        const data = await fetchWorkSessions(tenantId, start, end);
        setSessions(data as SessionWithProfile[]);
      } catch (error) {
        console.error('Error fetching sessions:', error);
      } finally {
        setIsLoadingSessions(false);
      }
    };

    loadSessions();
  }, [tenantId, dateRange]);

  // Calculate summary stats
  const summaryStats = sessions.reduce((acc, session) => {
    acc.totalWorkMinutes += session.total_work_minutes || 0;
    acc.totalBreakMinutes += session.total_break_minutes || 0;
    acc.sessionsCount += 1;
    return acc;
  }, { totalWorkMinutes: 0, totalBreakMinutes: 0, sessionsCount: 0 });

  // Calculate per-member totals
  const memberTotals = sessions.reduce((acc, session) => {
    const userId = session.user_id;
    if (!acc[userId]) {
      acc[userId] = {
        full_name: session.profiles?.full_name || 'Unknown',
        email: session.profiles?.email || '',
        avatar_url: session.profiles?.avatar_url,
        totalWorkMinutes: 0,
        totalBreakMinutes: 0,
        daysWorked: 0,
      };
    }
    acc[userId].totalWorkMinutes += session.total_work_minutes || 0;
    acc[userId].totalBreakMinutes += session.total_break_minutes || 0;
    acc[userId].daysWorked += 1;
    return acc;
  }, {} as Record<string, { full_name: string; email: string; avatar_url: string | null; totalWorkMinutes: number; totalBreakMinutes: number; daysWorked: number }>);

  // Export to CSV
  const handleExport = () => {
    const headers = ['Member', 'Email', 'Date', 'Started', 'Ended', 'Work Hours', 'Break Hours'];
    const rows = sessions.map(s => [
      s.profiles?.full_name || 'Unknown',
      s.profiles?.email || '',
      s.date,
      s.started_at ? format(new Date(s.started_at), 'HH:mm') : '-',
      s.ended_at ? format(new Date(s.ended_at), 'HH:mm') : '-',
      formatDuration(s.total_work_minutes || 0),
      formatDuration(s.total_break_minutes || 0),
    ]);

    const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `work-hours-${dateRange}-${format(new Date(), 'yyyy-MM-dd')}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('Report exported');
  };

  return (
    <div className="space-y-6">
      {/* Live Team Status */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                Live Team Status
              </CardTitle>
              <CardDescription>Real-time team member work status</CardDescription>
            </div>
            <Button variant="outline" size="sm" onClick={refetch}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Refresh
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {isStatusLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-24" />
              ))}
            </div>
          ) : teamStatus.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">No team members found</p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {teamStatus.map((member) => {
                const config = statusConfig[member.status];
                const StatusIcon = config.icon;
                
                return (
                  <motion.div
                    key={member.user_id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="bg-muted/30 rounded-lg p-4 flex items-center gap-3"
                  >
                    <Avatar className="h-12 w-12">
                      <AvatarImage src={member.avatar_url || ''} />
                      <AvatarFallback>
                        {member.full_name.split(' ').map(n => n[0]).join('').toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">{member.full_name}</p>
                      <p className="text-xs text-muted-foreground truncate">{member.email}</p>
                      <Badge className={cn('mt-1 gap-1', config.color)} variant="secondary">
                        <StatusIcon className="h-3 w-3" />
                        {config.label}
                      </Badge>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Summary Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-full bg-success/10">
                <Clock className="h-6 w-6 text-success" />
              </div>
              <div>
                <p className="text-2xl font-bold">{formatDuration(summaryStats.totalWorkMinutes)}</p>
                <p className="text-sm text-muted-foreground">Total Work Hours</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-full bg-warning/10">
                <Coffee className="h-6 w-6 text-warning" />
              </div>
              <div>
                <p className="text-2xl font-bold">{formatDuration(summaryStats.totalBreakMinutes)}</p>
                <p className="text-sm text-muted-foreground">Total Break Time</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-full bg-accent/10">
                <Calendar className="h-6 w-6 text-accent" />
              </div>
              <div>
                <p className="text-2xl font-bold">{summaryStats.sessionsCount}</p>
                <p className="text-sm text-muted-foreground">Work Sessions</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Historical Data */}
      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5" />
                Work History
              </CardTitle>
              <CardDescription>Team member work hours by period</CardDescription>
            </div>
            <div className="flex gap-2">
              <Select value={dateRange} onValueChange={setDateRange}>
                <SelectTrigger className="w-[160px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {DATE_RANGES.map((range) => (
                    <SelectItem key={range.value} value={range.value}>
                      {range.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button variant="outline" size="icon" onClick={handleExport}>
                <Download className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isLoadingSessions ? (
            <div className="space-y-2">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : Object.keys(memberTotals).length === 0 ? (
            <p className="text-center text-muted-foreground py-8">No work sessions in this period</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Team Member</TableHead>
                  <TableHead className="text-right">Days Worked</TableHead>
                  <TableHead className="text-right">Total Work</TableHead>
                  <TableHead className="text-right">Total Break</TableHead>
                  <TableHead className="text-right">Avg/Day</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {Object.entries(memberTotals).map(([userId, data]) => (
                  <TableRow key={userId}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Avatar className="h-8 w-8">
                          <AvatarImage src={data.avatar_url || ''} />
                          <AvatarFallback className="text-xs">
                            {data.full_name.split(' ').map(n => n[0]).join('').toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <p className="font-medium">{data.full_name}</p>
                          <p className="text-xs text-muted-foreground">{data.email}</p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="text-right">{data.daysWorked}</TableCell>
                    <TableCell className="text-right font-medium text-success">
                      {formatDuration(data.totalWorkMinutes)}
                    </TableCell>
                    <TableCell className="text-right text-warning">
                      {formatDuration(data.totalBreakMinutes)}
                    </TableCell>
                    <TableCell className="text-right">
                      {formatDuration(Math.round(data.totalWorkMinutes / data.daysWorked))}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
