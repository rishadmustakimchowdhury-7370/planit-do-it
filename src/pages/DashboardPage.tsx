import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { AppLayout } from '@/components/layout/AppLayout';
import { StatsCard } from '@/components/dashboard/StatsCard';
import { ActivityFeed } from '@/components/dashboard/ActivityFeed';
import { RecentJobs } from '@/components/dashboard/RecentJobs';
import { TopCandidates } from '@/components/dashboard/TopCandidates';
import { QuickActions } from '@/components/dashboard/QuickActions';
import { VideoTutorials } from '@/components/dashboard/VideoTutorials';
import { CreditsDisplay } from '@/components/credits/CreditsDisplay';
import { useAuth } from '@/lib/auth';
import { supabase } from '@/integrations/supabase/client';
import { Briefcase, Users, Calendar, Trophy, Sparkles, Building2 } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { startOfWeek, endOfWeek, startOfMonth, endOfMonth } from 'date-fns';

interface DashboardStats {
  openJobs: number;
  totalCandidates: number;
  interviewsThisWeek: number;
  placementsThisMonth: number;
  totalClients: number;
  cvsUploaded: number;
  cvsDeleted: number;
  jobsActivated: number;
  aiCreditsUsed: number;
}

export default function DashboardPage() {
  const { profile, tenantId, isOwner, isManager, isRecruiter } = useAuth();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function fetchStats() {
      if (!tenantId) {
        setIsLoading(false);
        return;
      }

      try {
        const now = new Date();
        const weekStart = startOfWeek(now, { weekStartsOn: 1 }).toISOString();
        const weekEnd = endOfWeek(now, { weekStartsOn: 1 }).toISOString();
        const monthStart = startOfMonth(now).toISOString();
        const monthEnd = endOfMonth(now).toISOString();

        const [
          jobsResult,
          candidatesResult,
          clientsResult,
          activitiesResult,
          interviewsResult,
          placementsResult
        ] = await Promise.all([
          supabase.from('jobs').select('id, status').eq('tenant_id', tenantId),
          supabase.from('candidates').select('id').eq('tenant_id', tenantId),
          supabase.from('clients').select('id').eq('tenant_id', tenantId),
          supabase.from('recruiter_activities').select('action_type').eq('tenant_id', tenantId),
          // Interviews this week (candidates in interview or technical stage updated this week)
          supabase
            .from('job_candidates')
            .select('id')
            .eq('tenant_id', tenantId)
            .in('stage', ['interview', 'technical'])
            .gte('stage_updated_at', weekStart)
            .lte('stage_updated_at', weekEnd),
          // Placements this month (candidates hired this month)
          supabase
            .from('job_candidates')
            .select('id')
            .eq('tenant_id', tenantId)
            .eq('stage', 'hired')
            .gte('stage_updated_at', monthStart)
            .lte('stage_updated_at', monthEnd),
        ]);

        const openJobs = jobsResult.data?.filter(j => j.status === 'open').length || 0;
        const totalCandidates = candidatesResult.data?.length || 0;
        const totalClients = clientsResult.data?.length || 0;
        const interviewsThisWeek = interviewsResult.data?.length || 0;
        const placementsThisMonth = placementsResult.data?.length || 0;
        
        // Count activities from recruiter_activities table
        const activities = activitiesResult.data || [];
        const cvsUploaded = activities.filter(a => a.action_type === 'cv_uploaded').length;
        const cvsDeleted = activities.filter(a => a.action_type === 'cv_deleted').length;
        const jobsActivated = activities.filter(a => a.action_type === 'job_activated').length;
        const aiCreditsUsed = activities.filter(a => 
          ['ai_match_run', 'ai_cv_parse', 'ai_email_compose', 'ai_brand_cv'].includes(a.action_type)
        ).length;

        setStats({
          openJobs,
          totalCandidates,
          interviewsThisWeek,
          placementsThisMonth,
          totalClients,
          cvsUploaded,
          cvsDeleted,
          jobsActivated,
          aiCreditsUsed,
        });
      } catch (error) {
        console.error('Error fetching dashboard stats:', error);
      } finally {
        setIsLoading(false);
      }
    }

    fetchStats();
  }, [tenantId]);

  const statsCards = [
    {
      title: 'Open Jobs',
      value: stats?.openJobs ?? 0,
      icon: Briefcase,
      subtitle: 'Active positions',
      variant: 'info' as const,
    },
    {
      title: 'Total Candidates',
      value: stats?.totalCandidates ?? 0,
      icon: Users,
      subtitle: 'In your database',
      variant: 'accent' as const,
    },
    {
      title: 'Interviews This Week',
      value: stats?.interviewsThisWeek ?? 0,
      icon: Calendar,
      subtitle: 'Scheduled interviews',
      variant: 'warning' as const,
    },
    {
      title: 'Placements This Month',
      value: stats?.placementsThisMonth ?? 0,
      icon: Trophy,
      subtitle: 'Successful hires',
      variant: 'success' as const,
    },
    {
      title: 'Total Clients',
      value: stats?.totalClients ?? 0,
      icon: Building2,
      subtitle: 'Active clients',
      variant: 'primary' as const,
    },
    {
      title: 'AI Credits Used',
      value: stats?.aiCreditsUsed ?? 0,
      icon: Sparkles,
      subtitle: 'AI actions performed',
      variant: 'accent' as const,
    },
  ];

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
            Welcome back, {profile?.full_name?.split(' ')[0] || 'there'}!
          </h1>
          <p className="text-muted-foreground">
            {isOwner && "Here's an overview of your team's performance and recruitment pipeline."}
            {isManager && "Monitor your team's activity and recruitment metrics."}
            {isRecruiter && "Here's what's happening with your recruitment pipeline today."}
          </p>
        </motion.div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
          {isLoading ? (
            [...Array(6)].map((_, i) => (
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

        {/* Quick Actions & Credits */}
        <div className="grid lg:grid-cols-4 gap-6">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="lg:col-span-3"
          >
            <QuickActions />
          </motion.div>
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.35 }}
          >
            <CreditsDisplay />
          </motion.div>
        </div>

        {/* Role-based Performance Section */}
        {(isOwner || isManager) && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.35 }}
          >
            <div className="grid gap-4 md:grid-cols-2">
              <div className="p-6 border rounded-lg bg-card cursor-pointer hover:shadow-lg transition-shadow" onClick={() => window.location.href = isOwner ? "/work-tracking" : "/manager-dashboard"}>
                <h3 className="text-lg font-semibold mb-4">
                  {isOwner ? "Team Performance" : "Recruiter Performance"}
                </h3>
                <p className="text-sm text-muted-foreground mb-4">
                  {isOwner 
                    ? "View detailed performance metrics for managers and recruiters"
                    : "Monitor your recruiters' activity and productivity"
                  }
                </p>
                <span className="text-primary hover:underline text-sm font-medium">
                  View Details →
                </span>
              </div>
              
              {isOwner && (
                <div className="p-6 border rounded-lg bg-card cursor-pointer hover:shadow-lg transition-shadow" onClick={() => window.location.href = "/team-kpis"}>
                  <h3 className="text-lg font-semibold mb-4">Team KPIs</h3>
                  <p className="text-sm text-muted-foreground mb-4">
                    Comprehensive analytics and key performance indicators
                  </p>
                  <span className="text-primary hover:underline text-sm font-medium">
                    View Analytics →
                  </span>
                </div>
              )}
            </div>
          </motion.div>
        )}

        {/* Video Tutorials Section */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
        >
          <VideoTutorials />
        </motion.div>

        {/* Main Content Grid */}
        <div className="grid lg:grid-cols-3 gap-6">
          {/* Recent Jobs */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
            className="lg:col-span-2"
          >
            <RecentJobs />
          </motion.div>

          {/* Activity Feed */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6 }}
          >
            <ActivityFeed />
          </motion.div>
        </div>

        {/* Top Candidates */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.7 }}
        >
          <TopCandidates />
        </motion.div>
      </div>
    </AppLayout>
  );
}
