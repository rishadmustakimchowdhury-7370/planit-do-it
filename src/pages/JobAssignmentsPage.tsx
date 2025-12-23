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
import { Briefcase, User, Calendar, FileText, Loader2, Users, TrendingUp, Award, RefreshCcw, Eye, UserMinus, UserPlus } from 'lucide-react';
import { formatDistanceToNow, format } from 'date-fns';
import { useNavigate } from 'react-router-dom';
import { AssignJobDialog } from '@/components/jobs/AssignJobDialog';
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

interface JobAssignment {
  job_id: string;
  job_title: string;
  assignees: Array<{
    user_id: string;
    user_name: string;
    user_avatar: string | null;
    assigned_at: string;
  }>;
  cv_submissions: number;
  job_status: string;
  client_name?: string;
}

export default function JobAssignmentsPage() {
  const { tenantId, isOwner, isManager, user } = useAuth();
  const navigate = useNavigate();
  const [assignments, setAssignments] = useState<JobAssignment[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedRecruiter, setSelectedRecruiter] = useState<string>('all');
  const [recruiters, setRecruiters] = useState<Array<{ id: string; name: string; avatar: string | null }>>([]);
  
  // Dialog states
  const [assignDialogJob, setAssignDialogJob] = useState<{ id: string; title: string; assigneeIds: string[] } | null>(null);
  const [unassignDialog, setUnassignDialog] = useState<{ jobId: string; jobTitle: string; userId: string; userName: string } | null>(null);
  const [isUnassigning, setIsUnassigning] = useState(false);

  useEffect(() => {
    if (tenantId && (isOwner || isManager)) {
      fetchJobAssignments();
    }
  }, [tenantId, isOwner, isManager]);

  const fetchJobAssignments = async () => {
    setIsLoading(true);
    try {
      // Get all job assignees with job details
      const { data: jobAssignees, error: assigneesError } = await supabase
        .from('job_assignees')
        .select(`
          job_id,
          user_id,
          assigned_at,
          jobs:job_id (id, title, status, client_id, clients(name))
        `)
        .eq('tenant_id', tenantId);

      if (assigneesError) throw assigneesError;

      if (!jobAssignees || jobAssignees.length === 0) {
        setAssignments([]);
        setIsLoading(false);
        return;
      }

      // Get unique user IDs
      const userIds = [...new Set(jobAssignees.map(a => a.user_id))];
      
      // Get profiles for assignees
      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('id, full_name, avatar_url')
        .in('id', userIds);

      if (profilesError) throw profilesError;

      // Get unique job IDs
      const jobIds = [...new Set(jobAssignees.map(a => a.job_id))];

      // Get candidate counts per job (from job_candidates table)
      const { data: candidates, error: candidatesError } = await supabase
        .from('job_candidates')
        .select('job_id')
        .eq('tenant_id', tenantId)
        .in('job_id', jobIds);

      if (candidatesError) throw candidatesError;

      // Group by job
      const jobMap = new Map<string, JobAssignment>();

      for (const assignee of jobAssignees) {
        const job = assignee.jobs as any;
        if (!job) continue;

        const profile = profiles?.find(p => p.id === assignee.user_id);
        const jobCandidates = candidates?.filter(c => c.job_id === assignee.job_id) || [];

        if (!jobMap.has(assignee.job_id)) {
          jobMap.set(assignee.job_id, {
            job_id: job.id,
            job_title: job.title,
            assignees: [],
            cv_submissions: jobCandidates.length,
            job_status: job.status,
            client_name: job.clients?.name || undefined,
          });
        }

        const jobEntry = jobMap.get(assignee.job_id)!;
        jobEntry.assignees.push({
          user_id: assignee.user_id,
          user_name: profile?.full_name || 'Unknown',
          user_avatar: profile?.avatar_url || null,
          assigned_at: assignee.assigned_at,
        });
      }

      setAssignments(Array.from(jobMap.values()));

      // Extract unique recruiters for the filter
      const uniqueRecruiters = new Map<string, { id: string; name: string; avatar: string | null }>();
      for (const assignment of jobMap.values()) {
        for (const assignee of assignment.assignees) {
          if (!uniqueRecruiters.has(assignee.user_id)) {
            uniqueRecruiters.set(assignee.user_id, {
              id: assignee.user_id,
              name: assignee.user_name,
              avatar: assignee.user_avatar,
            });
          }
        }
      }
      setRecruiters(Array.from(uniqueRecruiters.values()));
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
    return assignments.filter(a => 
      a.assignees.some(assignee => assignee.user_id === selectedRecruiter)
    );
  }, [assignments, selectedRecruiter]);

  // Calculate stats for the selected view
  const stats = useMemo(() => {
    const data = filteredAssignments;
    const allAssignees = data.flatMap(a => a.assignees);
    return {
      totalJobs: data.length,
      totalAssignments: allAssignees.length,
      totalSubmissions: data.reduce((sum, a) => sum + a.cv_submissions, 0),
      activeRecruiters: new Set(allAssignees.map(a => a.user_id)).size,
    };
  }, [filteredAssignments]);

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

  const handleUnassign = async () => {
    if (!unassignDialog) return;
    
    setIsUnassigning(true);
    try {
      const { error } = await supabase
        .from('job_assignees')
        .delete()
        .eq('job_id', unassignDialog.jobId)
        .eq('user_id', unassignDialog.userId);

      if (error) throw error;

      // Log activity
      await supabase.from('activities').insert({
        tenant_id: tenantId,
        action: 'job_unassigned',
        entity_type: 'job',
        entity_id: unassignDialog.jobId,
        entity_name: unassignDialog.jobTitle,
        metadata: { 
          unassigned_user_id: unassignDialog.userId,
          unassigned_user_name: unassignDialog.userName,
        }
      });

      toast.success(`${unassignDialog.userName} unassigned from job`);
      fetchJobAssignments();
    } catch (error: any) {
      console.error('Error unassigning:', error);
      toast.error(error.message || 'Failed to unassign');
    } finally {
      setIsUnassigning(false);
      setUnassignDialog(null);
    }
  };

  if (isLoading) {
    return (
      <AppLayout title="Job Assignments" subtitle="Track recruiter assignments by job">
        <div className="flex items-center justify-center h-96">
          <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout title="Job Assignments" subtitle="Track recruiter assignments by job">
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
                  <p className="text-sm text-muted-foreground">Jobs Assigned</p>
                  <p className="text-2xl font-bold">{stats.totalJobs}</p>
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
                  <p className="text-sm text-muted-foreground">Total Assignments</p>
                  <p className="text-2xl font-bold">{stats.totalAssignments}</p>
                </div>
                <div className="p-2 bg-accent/10 rounded-lg">
                  <Users className="h-5 w-5 text-accent-foreground" />
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
                <div className="p-2 bg-warning/10 rounded-lg">
                  <FileText className="h-5 w-5 text-warning" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Active Recruiters</p>
                  <p className="text-2xl font-bold">{stats.activeRecruiters}</p>
                </div>
                <div className="p-2 bg-success/10 rounded-lg">
                  <User className="h-5 w-5 text-success" />
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
                    ? 'Assign jobs to team members to track their progress here'
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
                      <TableHead>Assigned Team Members</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-center">CVs</TableHead>
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
                          <div className="flex flex-col gap-2">
                            {assignment.assignees.map((assignee) => (
                              <div key={assignee.user_id} className="flex items-center justify-between gap-2 group">
                                <div className="flex items-center gap-2">
                                  <Avatar className="h-7 w-7">
                                    <AvatarImage src={assignee.user_avatar || undefined} />
                                    <AvatarFallback className="text-xs">
                                      {assignee.user_name.substring(0, 2).toUpperCase()}
                                    </AvatarFallback>
                                  </Avatar>
                                  <div>
                                    <span className="text-sm font-medium">{assignee.user_name}</span>
                                    <div className="text-xs text-muted-foreground">
                                      {formatDistanceToNow(new Date(assignee.assigned_at), { addSuffix: true })}
                                    </div>
                                  </div>
                                </div>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity text-destructive hover:text-destructive hover:bg-destructive/10"
                                  onClick={() => setUnassignDialog({
                                    jobId: assignment.job_id,
                                    jobTitle: assignment.job_title,
                                    userId: assignee.user_id,
                                    userName: assignee.user_name,
                                  })}
                                >
                                  <UserMinus className="h-4 w-4" />
                                </Button>
                              </div>
                            ))}
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
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setAssignDialogJob({
                                id: assignment.job_id,
                                title: assignment.job_title,
                                assigneeIds: assignment.assignees.map(a => a.user_id),
                              })}
                            >
                              <UserPlus className="h-4 w-4 mr-1" />
                              Assign
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => navigate(`/jobs/${assignment.job_id}`)}
                            >
                              <Eye className="h-4 w-4 mr-1" />
                              View
                            </Button>
                          </div>
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

      {/* Assign Job Dialog */}
      {assignDialogJob && (
        <AssignJobDialog
          open={!!assignDialogJob}
          onOpenChange={(open) => !open && setAssignDialogJob(null)}
          jobId={assignDialogJob.id}
          jobTitle={assignDialogJob.title}
          currentAssigneeIds={assignDialogJob.assigneeIds}
          onAssignmentComplete={() => {
            setAssignDialogJob(null);
            fetchJobAssignments();
          }}
        />
      )}

      {/* Unassign Confirmation Dialog */}
      <AlertDialog open={!!unassignDialog} onOpenChange={() => setUnassignDialog(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <UserMinus className="h-5 w-5 text-destructive" />
              Unassign Team Member
            </AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to unassign <strong>{unassignDialog?.userName}</strong> from "{unassignDialog?.jobTitle}"?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isUnassigning}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleUnassign}
              disabled={isUnassigning}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isUnassigning && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Unassign
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppLayout>
  );
}