import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { Clock, Calendar as CalendarIcon, Download } from 'lucide-react';
import { useState, useEffect } from 'react';
import { useAuth } from '@/lib/auth';
import { fetchWorkSessions, formatDuration } from '@/hooks/useWorkTracking';
import { format } from 'date-fns';
import { toast } from 'sonner';
import { getTimezoneLabel } from '@/lib/timezones';

export default function RecruiterWorkDashboardPage() {
  const { user, tenantId } = useAuth();
  const [startDate, setStartDate] = useState<Date>(new Date(new Date().setDate(new Date().getDate() - 30)));
  const [endDate, setEndDate] = useState<Date>(new Date());
  const [sessions, setSessions] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (user?.id && tenantId) {
      loadSessions();
    }
  }, [user?.id, tenantId, startDate, endDate]);

  const loadSessions = async () => {
    if (!user?.id || !tenantId) return;
    
    setIsLoading(true);
    try {
      const data = await fetchWorkSessions(tenantId, startDate, endDate, user.id);
      setSessions(data || []);
    } catch (error) {
      toast.error('Failed to load work history');
    } finally {
      setIsLoading(false);
    }
  };

  const totalWork = sessions.reduce((sum, s) => sum + (s.total_work_minutes || 0), 0);
  const totalBreak = sessions.reduce((sum, s) => sum + (s.total_break_minutes || 0), 0);

  const exportCSV = () => {
    const csv = [
      ['Date', 'Started At', 'Ended At', 'Work Time', 'Break Time', 'Timezone', 'BOD Summary', 'EOD Summary'].join(','),
      ...sessions.map(s => [
        s.date,
        s.started_at ? new Date(s.started_at).toLocaleString() : 'N/A',
        s.ended_at ? new Date(s.ended_at).toLocaleString() : 'N/A',
        formatDuration(s.total_work_minutes || 0),
        formatDuration(s.total_break_minutes || 0),
        s.timezone || 'UTC',
        `"${(s.bod_summary || '').replace(/"/g, '""')}"`,
        `"${(s.eod_summary || '').replace(/"/g, '""')}"`,
      ].join(','))
    ].join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `my-work-history-${format(new Date(), 'yyyy-MM-dd')}.csv`;
    a.click();
  };

  return (
    <div className="container mx-auto py-8 space-y-6">
      <div>
        <h1 className="text-3xl font-bold mb-2">My Work History</h1>
        <p className="text-muted-foreground">View your work tracking history</p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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
            <div className="text-2xl font-bold">{sessions.length}</div>
          </CardContent>
        </Card>
      </div>

      {/* History Table */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Work History</CardTitle>
              <CardDescription>Your daily work tracking records</CardDescription>
            </div>
            <div className="flex gap-2">
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
          ) : sessions.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">No work records found</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Work Time</TableHead>
                  <TableHead>Break Time</TableHead>
                  <TableHead>Started</TableHead>
                  <TableHead>Ended</TableHead>
                  <TableHead>Timezone</TableHead>
                  <TableHead>BOD Summary</TableHead>
                  <TableHead>EOD Summary</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sessions.map((session) => (
                  <TableRow key={session.id}>
                    <TableCell className="font-medium">{format(new Date(session.date), 'MMM dd, yyyy')}</TableCell>
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
                    <TableCell className="text-sm">{getTimezoneLabel(session.timezone || 'UTC')}</TableCell>
                    <TableCell className="max-w-xs truncate text-sm">{session.bod_summary || '-'}</TableCell>
                    <TableCell className="max-w-xs truncate text-sm">{session.eod_summary || '-'}</TableCell>
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
