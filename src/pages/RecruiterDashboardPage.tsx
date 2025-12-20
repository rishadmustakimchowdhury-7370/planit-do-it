import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { AppLayout } from '@/components/layout/AppLayout';
import { StatsCard } from '@/components/dashboard/StatsCard';
import { ActivityFeed } from '@/components/dashboard/ActivityFeed';
import { useAuth } from '@/lib/auth';
import { supabase } from '@/integrations/supabase/client';
import { Briefcase, Users, Calendar, Upload, Sparkles, Clock, Building2 } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';
import { Badge } from '@/components/ui/badge';
import { startOfWeek, endOfWeek, format } from 'date-fns';

interface RecruiterStats {
  assignedJobs: number;
  cvsUploaded: number;
  cvsSubmitted: number;
  interviewsThisWeek: number;
  aiCreditsUsed: number;
}

interface AssignedJob {
  id: string;
  title: string;
  client: string;
  status: string;
  location: string;
}

export default function RecruiterDashboardPage() {
  const { profile, tenantId, user } = useAuth();
  const navigate = useNavigate();
  const [stats, setStats] = useState<RecruiterStats | null>(null);
  const [assignedJobs, setAssignedJobs] = useState<AssignedJob[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function fetchStats() {
      if (!tenantId || !user?.id) {
        setIsLoading(false);
        return;
      }

      try {
        const now = new Date();
        const weekStart = startOfWeek(now, { weekStartsOn: 1 }).toISOString();
        const weekEnd = endOfWeek(now, { weekStartsOn: 1 }).toISOString();

        // Get recruiter's activities from recruiter_activities table
        const { data: activitiesData } = await supabase
          .from('recruiter_activities')
          .select('action_type')
          .eq('tenant_id', tenantId)
          .eq('user_id', user.id);

        // Get jobs assigned to this recruiter (via job_assignees table)
        const { data: assigneesData } = await supabase
          .from('job_assignees')
          .select('job_id')
          .eq('tenant_id', tenantId)
          .eq('user_id', user.id);

        const assignedJobIds = assigneesData?.map((a) => a.job_id) || [];

        let jobsData: any[] = [];
        if (assignedJobIds.length > 0) {
          const { data } = await supabase
            .from('jobs')
            .select('id, title, status, location, clients(name)')
            .in('id', assignedJobIds);
          jobsData = data || [];
        }

        // Get interviews this week
        const { data: interviewsData } = await supabase
          .from('job_candidates')
          .select('id')
          .eq('tenant_id', tenantId)
          .in('stage', ['interview', 'technical'])
          .gte('stage_updated_at', weekStart)
          .lte('stage_updated_at', weekEnd);

        // Count activities
        const activities = activitiesData || [];
        const cvsUploaded = activities.filter((a) => a.action_type === 'cv_uploaded').length;
        const cvsSubmitted = activities.filter((a) => a.action_type === 'cv_submitted').length;

        // AI tests (source of truth): count AI match runs from job_candidates.matched_at
        // scoped to jobs assigned to this recruiter
        let aiMatchRuns = 0;
        if (assignedJobIds.length > 0) {
          const { count } = await supabase
            .from('job_candidates')
            .select('id', { count: 'exact', head: true })
            .eq('tenant_id', tenantId)
            .in('job_id', assignedJobIds)
            .not('matched_at', 'is', null);

          aiMatchRuns = count || 0;
        }

        // Other AI actions that are still logged in recruiter_activities
        // (exclude ai_match_run to avoid double counting)
        const otherAiActions = activities.filter((a) =>
          ['ai_cv_parse', 'ai_email_compose', 'ai_brand_cv', 'screening_completed'].includes(a.action_type)
        ).length;

        const aiCreditsUsed = aiMatchRuns + otherAiActions;

        setStats({
          assignedJobs: jobsData.length,
          cvsUploaded,
          cvsSubmitted,
          interviewsThisWeek: interviewsData?.length || 0,
          aiCreditsUsed,
        });

        // Format assigned jobs
        const formattedJobs = jobsData.slice(0, 5).map((job: any) => ({
          id: job.id,
          title: job.title,
          client: job.clients?.name || 'No Client',
          status: job.status,
          location: job.location || 'Remote',
        }));

        setAssignedJobs(formattedJobs);
      } catch (error) {
        console.error('Error fetching recruiter stats:', error);
      } finally {
        setIsLoading(false);
      }
    }

    fetchStats();
  }, [tenantId, user?.id]);

  const statsCards = [
    {
      title: 'Assigned Jobs',
      value: stats?.assignedJobs ?? 0,
      icon: Briefcase,
      subtitle: 'Jobs you can work on',
      variant: 'info' as const,
    },
    {
      title: 'CVs Uploaded',
      value: stats?.cvsUploaded ?? 0,
      icon: Upload,
      subtitle: 'Total uploads',
      variant: 'accent' as const,
    },
    {
      title: 'CVs Submitted',
      value: stats?.cvsSubmitted ?? 0,
      icon: Users,
      subtitle: 'To jobs',
      variant: 'warning' as const,
    },
    {
      title: 'AI Tests',
      value: stats?.aiCreditsUsed ?? 0,
      icon: Sparkles,
      subtitle: 'AI match runs',
      variant: 'success' as const,
    },
  ];

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'open':
        return 'bg-green-500/10 text-green-700 dark:text-green-400';
      case 'draft':
        return 'bg-gray-500/10 text-gray-700 dark:text-gray-400';
      case 'closed':
        return 'bg-red-500/10 text-red-700 dark:text-red-400';
      default:
        return 'bg-blue-500/10 text-blue-700 dark:text-blue-400';
    }
  };

  return (
    <AppLayout>
      <div className="space-y-8">
        {/* Welcome Section */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-1"
        >
          <h1 className="text-3xl font-bold tracking-tight">
            Welcome back, {profile?.full_name?.split(' ')[0] || 'Recruiter'}!
          </h1>
          <p className="text-muted-foreground">
            Here's an overview of your assigned jobs and recruitment activity.
          </p>
        </motion.div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {isLoading ? (
            [...Array(4)].map((_, i) => (
              <Skeleton key={i} className="h-[120px] rounded-2xl" />
            ))
          ) : (
            statsCards.map((stat, i) => (
              <StatsCard
                key={stat.title}
                {...stat}
                delay={i * 0.05}
              />
            ))
          )}
        </div>

        {/* Quick Actions */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Quick Actions</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-3">
              <Button onClick={() => navigate('/candidates/add')} className="flex items-center gap-2">
                <Users className="w-4 h-4" />
                Add Candidate
              </Button>
              <Button onClick={() => navigate('/jobs')} variant="outline" className="flex items-center gap-2">
                <Briefcase className="w-4 h-4" />
                View All Jobs
              </Button>
              <Button onClick={() => navigate('/candidates')} variant="outline" className="flex items-center gap-2">
                <Users className="w-4 h-4" />
                View Candidates
              </Button>
              <Button onClick={() => navigate('/team/work-tracking')} variant="outline" className="flex items-center gap-2">
                <Clock className="w-4 h-4" />
                Log Work Time
              </Button>
            </CardContent>
          </Card>
        </motion.div>

        {/* Main Content Grid */}
        <div className="grid lg:grid-cols-3 gap-6">
          {/* Assigned Jobs */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="lg:col-span-2"
          >
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Your Assigned Jobs</CardTitle>
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <div className="space-y-3">
                    {[...Array(3)].map((_, i) => (
                      <Skeleton key={i} className="h-20 w-full" />
                    ))}
                  </div>
                ) : assignedJobs.length === 0 ? (
                  <div className="text-center py-8">
                    <Briefcase className="w-12 h-12 mx-auto text-muted-foreground mb-3" />
                    <p className="text-muted-foreground">No jobs assigned yet</p>
                    <p className="text-sm text-muted-foreground mt-1">
                      Contact your manager to get jobs assigned to you
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {assignedJobs.map((job) => (
                      <div
                        key={job.id}
                        onClick={() => navigate(`/jobs/${job.id}`)}
                        className="p-4 border rounded-lg hover:bg-accent cursor-pointer transition-colors"
                      >
                        <div className="flex items-start justify-between mb-2">
                          <h3 className="font-semibold text-foreground">{job.title}</h3>
                          <Badge className={getStatusColor(job.status)}>
                            {job.status}
                          </Badge>
                        </div>
                        <div className="flex items-center gap-4 text-sm text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <Building2 className="w-4 h-4" />
                            {job.client}
                          </span>
                          <span>📍 {job.location}</span>
                        </div>
                      </div>
                    ))}
                    {assignedJobs.length >= 5 && (
                      <Button
                        variant="ghost"
                        className="w-full"
                        onClick={() => navigate('/jobs')}
                      >
                        View All Jobs →
                      </Button>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          </motion.div>

          {/* Activity Feed */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
          >
            <ActivityFeed />
          </motion.div>
        </div>
      </div>
    </AppLayout>
  );
}