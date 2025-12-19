import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Calendar as CalendarIcon, Download, Users } from 'lucide-react';
import { useState, useEffect } from 'react';
import { useAuth } from '@/lib/auth';
import { supabase } from '@/integrations/supabase/client';
import { fetchWorkSessions, formatDuration } from '@/hooks/useWorkTracking';
import { format } from 'date-fns';
import { toast } from 'sonner';
import { getTimezoneLabel } from '@/lib/timezones';

interface TeamMember {
  id: string;
  full_name: string;
  email: string;
  avatar_url: string | null;
}

export default function ManagerWorkDashboardPage() {
  const { tenantId } = useAuth();
  const [startDate, setStartDate] = useState<Date>(new Date(new Date().setDate(new Date().getDate() - 7)));
  const [endDate, setEndDate] = useState<Date>(new Date());
  const [sessions, setSessions] = useState<any[]>([]);
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [selectedMember, setSelectedMember] = useState<string>('all');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (tenantId) {
      loadTeamMembers();
    }
  }, [tenantId]);

  useEffect(() => {
    if (tenantId) {
      loadSessions();
    }
  }, [tenantId, startDate, endDate, selectedMember]);

  const loadTeamMembers = async () => {
    if (!tenantId) return;

    try {
      const { data: rolesData } = await supabase
        .from('user_roles')
        .select('user_id')
        .eq('tenant_id', tenantId)
        .eq('role', 'recruiter');

      const userIds = rolesData?.map(r => r.user_id) || [];

      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, full_name, email, avatar_url')
        .in('id', userIds);

      setTeamMembers(profiles || []);
    } catch (error) {
      console.error('Error loading team members:', error);
    }
  };

  const loadSessions = async () => {
    if (!tenantId) return;
    
    setIsLoading(true);
    try {
      const data = await fetchWorkSessions(
        tenantId, 
        startDate, 
        endDate, 
        selectedMember === 'all' ? undefined : selectedMember
      );
      setSessions(data || []);
    } catch (error) {
      toast.error('Failed to load work history');
    } finally {
      setIsLoading(false);
    }
  };

  const filteredSessions = sessions.filter(s => 
    selectedMember === 'all' || s.user_id === selectedMember
  );

  const totalWork = filteredSessions.reduce((sum, s) => sum + (s.total_work_minutes || 0), 0);
  const totalBreak = filteredSessions.reduce((sum, s) => sum + (s.total_break_minutes || 0), 0);

  const exportCSV = () => {
    const csv = [
      ['Date', 'Team Member', 'Work Time', 'Break Time', 'Started At', 'Ended At', 'Timezone'].join(','),
      ...filteredSessions.map(s => [
        s.date,
        s.profiles?.full_name || 'Unknown',
        formatDuration(s.total_work_minutes || 0),
        formatDuration(s.total_break_minutes || 0),
        s.started_at ? new Date(s.started_at).toLocaleString() : 'N/A',
        s.ended_at ? new Date(s.ended_at).toLocaleString() : 'N/A',
        s.timezone || 'UTC',
      ].join(','))
    ].join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `team-work-history-${format(new Date(), 'yyyy-MM-dd')}.csv`;
    a.click();
  };

  return (
    <AppLayout title="Team Work Dashboard" subtitle="Monitor your team's work tracking">
      <div className="space-y-6">

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Team Members</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{teamMembers.length}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Total Work Time</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-success">{formatDuration(totalWork)}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Total Break Time</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-warning">{formatDuration(totalBreak)}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Work Days</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{filteredSessions.length}</div>
          </CardContent>
        </Card>
      </div>

      {/* History Table with Filters */}
      <Card>
        <CardHeader>
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <div>
              <CardTitle>Team Work History</CardTitle>
              <CardDescription>View and filter team work records</CardDescription>
            </div>
            <div className="flex flex-wrap gap-2">
              <Select value={selectedMember} onValueChange={setSelectedMember}>
                <SelectTrigger className="w-[200px]">
                  <Users className="mr-2 h-4 w-4" />
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Team Members</SelectItem>
                  {teamMembers.map(member => (
                    <SelectItem key={member.id} value={member.id}>
                      {member.full_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" size="sm">
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {format(startDate, 'MMM dd')} - {format(endDate, 'MMM dd')}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="end">
                  <div className="p-4 space-y-4">
                    <div>
                      <p className="text-sm font-medium mb-2">Start Date</p>
                      <Calendar
                        mode="single"
                        selected={startDate}
                        onSelect={(date) => date && setStartDate(date)}
                      />
                    </div>
                    <div>
                      <p className="text-sm font-medium mb-2">End Date</p>
                      <Calendar
                        mode="single"
                        selected={endDate}
                        onSelect={(date) => date && setEndDate(date)}
                      />
                    </div>
                  </div>
                </PopoverContent>
              </Popover>

              <Button onClick={exportCSV} variant="outline" size="sm">
                <Download className="mr-2 h-4 w-4" />
                Export CSV
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8 text-muted-foreground">Loading...</div>
          ) : filteredSessions.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">No work records found</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Team Member</TableHead>
                  <TableHead>Work Time</TableHead>
                  <TableHead>Break Time</TableHead>
                  <TableHead>Started</TableHead>
                  <TableHead>Ended</TableHead>
                  <TableHead>Timezone</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredSessions.map((session) => (
                  <TableRow key={session.id}>
                    <TableCell className="font-medium">{format(new Date(session.date), 'MMM dd, yyyy')}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Avatar className="h-6 w-6">
                          <AvatarImage src={session.profiles?.avatar_url} />
                          <AvatarFallback>
                            {session.profiles?.full_name?.split(' ').map((n: string) => n[0]).join('') || '?'}
                          </AvatarFallback>
                        </Avatar>
                        <span className="text-sm">{session.profiles?.full_name || 'Unknown'}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="bg-success/10 text-success">
                        {formatDuration(session.total_work_minutes || 0)}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="bg-warning/10 text-warning">
                        {formatDuration(session.total_break_minutes || 0)}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm">
                      {session.started_at ? new Date(session.started_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'N/A'}
                    </TableCell>
                    <TableCell className="text-sm">
                      {session.ended_at ? new Date(session.ended_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'N/A'}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">{getTimezoneLabel(session.timezone || 'UTC')}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
      </div>
    </AppLayout>
  );
}
