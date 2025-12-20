import { useState, useEffect, useMemo } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth';
import { toast } from 'sonner';
import { Briefcase, User, Calendar, FileText, Loader2, Users, TrendingUp, Award } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

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
}

export default function JobAssignmentsPage() {
  const { tenantId, isOwner, isManager } = useAuth();
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
        .select('id, title, assigned_to, status, updated_at')
        .eq('tenant_id', tenantId)
        .not('assigned_to', 'is', null);

      if (jobsError) throw jobsError;

      if (!jobs || jobs.length === 0) {
        setAssignments([]);
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

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'open':
        return 'bg-green-500/10 text-green-600 dark:text-green-400';
      case 'draft':
        return 'bg-gray-500/10 text-gray-600 dark:text-gray-400';
      case 'paused':
        return 'bg-yellow-500/10 text-yellow-600 dark:text-yellow-400';
      case 'closed':
        return 'bg-red-500/10 text-red-600 dark:text-red-400';
      default:
        return 'bg-gray-500/10 text-gray-600 dark:text-gray-400';
    }
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
        <div className="flex flex-col sm:flex-row gap-4 justify-between">
          <div className="flex gap-4">
            <Select value={selectedRecruiter} onValueChange={setSelectedRecruiter}>
              <SelectTrigger className="w-[240px]">
                <Users className="h-4 w-4 mr-2" />
                <SelectValue placeholder="All Recruiters" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Recruiters</SelectItem>
                {recruiters.map(recruiter => (
                  <SelectItem key={recruiter.id} value={recruiter.id}>
                    {recruiter.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button onClick={fetchJobAssignments} variant="outline" disabled={isLoading}>
            <Loader2 className={`w-4 h-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>

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
                  <FileText className="h-5 w-5 text-accent" />
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

        {/* Job Assignments Grid */}
        {filteredAssignments.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
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
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {filteredAssignments.map((assignment) => (
              <Card key={assignment.job_id} className="hover:shadow-lg transition-shadow">
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <CardTitle className="text-base mb-2">{assignment.job_title}</CardTitle>
                      <Badge className={getStatusColor(assignment.job_status)}>
                        {assignment.job_status}
                      </Badge>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center gap-3">
                    <Avatar className="h-10 w-10">
                      <AvatarImage src={assignment.assigned_to_avatar || undefined} />
                      <AvatarFallback>
                        {assignment.assigned_to_name.substring(0, 2).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">
                        {assignment.assigned_to_name}
                      </p>
                      <p className="text-xs text-muted-foreground">Assigned Recruiter</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4 pt-4 border-t">
                    <div className="flex flex-col">
                      <div className="flex items-center gap-2 mb-1">
                        <Calendar className="w-4 h-4 text-muted-foreground" />
                        <span className="text-xs text-muted-foreground">Time Active</span>
                      </div>
                      <p className="text-sm font-semibold">
                        {assignment.days_assigned} {assignment.days_assigned === 1 ? 'day' : 'days'}
                      </p>
                    </div>

                    <div className="flex flex-col">
                      <div className="flex items-center gap-2 mb-1">
                        <FileText className="w-4 h-4 text-muted-foreground" />
                        <span className="text-xs text-muted-foreground">CVs Submitted</span>
                      </div>
                      <p className="text-sm font-semibold">
                        {assignment.cv_submissions}
                      </p>
                    </div>
                  </div>

                  <div className="text-xs text-muted-foreground pt-2">
                    Assigned {formatDistanceToNow(new Date(assignment.assigned_at), { addSuffix: true })}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </AppLayout>
  );
}
