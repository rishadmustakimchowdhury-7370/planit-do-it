import { useState, useEffect, useMemo } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth';
import { toast } from 'sonner';
import { Briefcase, User, Calendar, FileText, Loader2, Users, TrendingUp, Award, RefreshCcw, Eye } from 'lucide-react';
import { formatDistanceToNow, format } from 'date-fns';
import { useNavigate } from 'react-router-dom';

interface JobAssignment {
  job_id: string;
  job_title: string;
  assigned_to: string;
  assigned_to_name: string;
  assigned_to_avatar: string | null;
  assigned_at: string;
  days_assigned: number;
  cv_submissions: number;
  job_status: string;
  client_name?: string;
}

export default function JobAssignmentsPage() {
  const { tenantId, isOwner, isManager } = useAuth();
  const navigate = useNavigate();
  const [assignments, setAssignments] = useState<JobAssignment[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedRecruiter, setSelectedRecruiter] = useState<string>('all');
  const [recruiters, setRecruiters] = useState<Array<{ id: string; name: string; avatar: string | null }>>([]);

  useEffect(() => {
    if (tenantId && (isOwner || isManager)) {
      fetchJobAssignments();
    }
  }, [tenantId, isOwner, isManager]);

  const fetchJobAssignments = async () => {
    setIsLoading(true);
    try {
      // Get all jobs with assigned recruiters
      const { data: jobs, error: jobsError } = await supabase
        .from('jobs')
        .select('id, title, assigned_to, status, updated_at, client_id, clients(name)')
        .eq('tenant_id', tenantId)
        .not('assigned_to', 'is', null);

      if (jobsError) throw jobsError;

      if (!jobs || jobs.length === 0) {
        setAssignments([]);
        setIsLoading(false);
        return;
      }

      // Get profiles for assigned recruiters
      const recruiterIds = [...new Set(jobs.map(j => j.assigned_to).filter(Boolean))];
      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('id, full_name, avatar_url')
        .in('id', recruiterIds);

      if (profilesError) throw profilesError;

      // Get CV submission counts per job
      const { data: submissions, error: submissionsError } = await supabase
        .from('cv_submissions')
        .select('job_id, submitted_by')
        .eq('tenant_id', tenantId)
        .in('job_id', jobs.map(j => j.id));

      if (submissionsError) throw submissionsError;

      // Get assignment dates from activities
      const { data: activities, error: activitiesError } = await supabase
        .from('activities')
        .select('entity_id, created_at, metadata')
        .eq('tenant_id', tenantId)
        .eq('action', 'job_assigned')
        .in('entity_id', jobs.map(j => j.id))
        .order('created_at', { ascending: false });

      if (activitiesError) throw activitiesError;

      // Process the data
      const assignmentMap = new Map<string, JobAssignment>();

      for (const job of jobs) {
        const profile = profiles?.find(p => p.id === job.assigned_to);
        const jobSubmissions = submissions?.filter(
          s => s.job_id === job.id && s.submitted_by === job.assigned_to
        ) || [];
        
        // Find the most recent assignment activity
        const assignmentActivity = activities?.find(
          a => a.entity_id === job.id
        );

        const assignedAt = assignmentActivity?.created_at || job.updated_at;
        const daysAssigned = Math.floor(
          (new Date().getTime() - new Date(assignedAt).getTime()) / (1000 * 60 * 60 * 24)
        );

        assignmentMap.set(job.id, {
          job_id: job.id,
          job_title: job.title,
          assigned_to: job.assigned_to,
          assigned_to_name: profile?.full_name || 'Unknown',
          assigned_to_avatar: profile?.avatar_url || null,
          assigned_at: assignedAt,
          days_assigned: daysAssigned,
          cv_submissions: jobSubmissions.length,
          job_status: job.status,
          client_name: (job.clients as any)?.name || undefined,
        });
      }

      setAssignments(Array.from(assignmentMap.values()));

      // Extract unique recruiters for the filter
      const uniqueRecruiters = Array.from(
        new Map(
          Array.from(assignmentMap.values()).map(a => [
            a.assigned_to,
            { id: a.assigned_to, name: a.assigned_to_name, avatar: a.assigned_to_avatar }
          ])
        ).values()
      );
      setRecruiters(uniqueRecruiters);
    } catch (error) {
      console.error('Error fetching job assignments:', error);
      toast.error('Failed to load job assignments');
    } finally {
      setIsLoading(false);
    }
  };

  // Filter assignments by selected recruiter
  const filteredAssignments = useMemo(() => {
    if (selectedRecruiter === 'all') {
      return assignments;
    }
    return assignments.filter(a => a.assigned_to === selectedRecruiter);
  }, [assignments, selectedRecruiter]);

  // Calculate stats for the selected view
  const stats = useMemo(() => {
    const data = selectedRecruiter === 'all' ? assignments : filteredAssignments;
    return {
      totalAssignments: data.length,
      totalSubmissions: data.reduce((sum, a) => sum + a.cv_submissions, 0),
      avgDaysActive: data.length > 0 
        ? Math.round(data.reduce((sum, a) => sum + a.days_assigned, 0) / data.length)
        : 0,
      activeRecruiters: selectedRecruiter === 'all' 
        ? new Set(data.map(a => a.assigned_to)).size 
        : 1,
    };
  }, [assignments, filteredAssignments, selectedRecruiter]);

  const getStatusBadge = (status: string) => {
    const variants: Record<string, { variant: 'default' | 'secondary' | 'destructive' | 'outline', className: string }> = {
      open: { variant: 'default', className: 'bg-success/10 text-success border-success/20' },
      draft: { variant: 'secondary', className: 'bg-muted text-muted-foreground' },
      paused: { variant: 'outline', className: 'bg-warning/10 text-warning border-warning/20' },
      closed: { variant: 'destructive', className: 'bg-destructive/10 text-destructive border-destructive/20' },
    };
    const style = variants[status] || variants.draft;
    return <Badge variant={style.variant} className={style.className}>{status}</Badge>;
  };

  if (isLoading) {
    return (
      <AppLayout title="Job Assignments" subtitle="Track recruiter performance by job">
        <div className="flex items-center justify-center h-96">
          <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout title="Job Assignments" subtitle="Track recruiter performance by job">
      <div className="space-y-6">
        {/* Filter Bar */}
        <Card className="p-4">
          <div className="flex flex-col sm:flex-row gap-4 justify-between items-center">
            <div className="flex gap-4 items-center">
              <div className="flex items-center gap-2">
                <Users className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium">Filter by Recruiter:</span>
              </div>
              <Select value={selectedRecruiter} onValueChange={setSelectedRecruiter}>
                <SelectTrigger className="w-[220px]">
                  <SelectValue placeholder="All Recruiters" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Recruiters</SelectItem>
                  {recruiters.map(recruiter => (
                    <SelectItem key={recruiter.id} value={recruiter.id}>
                      <div className="flex items-center gap-2">
                        <Avatar className="h-5 w-5">
                          <AvatarImage src={recruiter.avatar || undefined} />
                          <AvatarFallback className="text-xs">
                            {recruiter.name.substring(0, 2).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        {recruiter.name}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button onClick={fetchJobAssignments} variant="outline" size="sm" disabled={isLoading}>
              <RefreshCcw className={`w-4 h-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
          </div>
        </Card>

        {/* Stats Dashboard */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Active Jobs</p>
                  <p className="text-2xl font-bold">{stats.totalAssignments}</p>
                </div>
                <div className="p-2 bg-primary/10 rounded-lg">
                  <Briefcase className="h-5 w-5 text-primary" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Total CVs</p>
                  <p className="text-2xl font-bold">{stats.totalSubmissions}</p>
                </div>
                <div className="p-2 bg-accent/10 rounded-lg">
                  <FileText className="h-5 w-5 text-accent-foreground" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Avg Days Active</p>
                  <p className="text-2xl font-bold">{stats.avgDaysActive}</p>
                </div>
                <div className="p-2 bg-warning/10 rounded-lg">
                  <Calendar className="h-5 w-5 text-warning" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Recruiters</p>
                  <p className="text-2xl font-bold">{stats.activeRecruiters}</p>
                </div>
                <div className="p-2 bg-success/10 rounded-lg">
                  <Users className="h-5 w-5 text-success" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Job Assignments Table */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Briefcase className="h-5 w-5" />
              {selectedRecruiter === 'all' ? 'All Job Assignments' : `Assignments for ${recruiters.find(r => r.id === selectedRecruiter)?.name || 'Recruiter'}`}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {filteredAssignments.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <Briefcase className="w-12 h-12 text-muted-foreground mb-4" />
                <p className="text-lg font-medium mb-2">
                  {assignments.length === 0 ? 'No Job Assignments' : 'No Jobs Found'}
                </p>
                <p className="text-muted-foreground">
                  {assignments.length === 0 
                    ? 'Assign jobs to recruiters to track their performance here'
                    : 'No jobs found for the selected recruiter'
                  }
                </p>
              </div>
            ) : (
              <div className="rounded-lg border">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/50">
                      <TableHead>Job Title</TableHead>
                      <TableHead>Client</TableHead>
                      <TableHead>Assigned Recruiter</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-center">CVs Submitted</TableHead>
                      <TableHead className="text-center">Days Active</TableHead>
                      <TableHead>Assigned Date</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredAssignments.map((assignment) => (
                      <TableRow key={assignment.job_id} className="hover:bg-muted/30">
                        <TableCell>
                          <div className="font-medium">{assignment.job_title}</div>
                        </TableCell>
                        <TableCell>
                          <span className="text-muted-foreground">
                            {assignment.client_name || '-'}
                          </span>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Avatar className="h-8 w-8">
                              <AvatarImage src={assignment.assigned_to_avatar || undefined} />
                              <AvatarFallback className="text-xs">
                                {assignment.assigned_to_name.substring(0, 2).toUpperCase()}
                              </AvatarFallback>
                            </Avatar>
                            <span className="font-medium">{assignment.assigned_to_name}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          {getStatusBadge(assignment.job_status)}
                        </TableCell>
                        <TableCell className="text-center">
                          <Badge variant="outline" className="font-mono">
                            {assignment.cv_submissions}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-center">
                          <span className={`font-medium ${assignment.days_assigned > 30 ? 'text-warning' : ''}`}>
                            {assignment.days_assigned}
                          </span>
                        </TableCell>
                        <TableCell>
                          <div className="text-sm">
                            <div>{format(new Date(assignment.assigned_at), 'MMM dd, yyyy')}</div>
                            <div className="text-xs text-muted-foreground">
                              {formatDistanceToNow(new Date(assignment.assigned_at), { addSuffix: true })}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => navigate(`/jobs/${assignment.job_id}`)}
                          >
                            <Eye className="h-4 w-4 mr-1" />
                            View
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
