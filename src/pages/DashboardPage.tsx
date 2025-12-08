import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { AppLayout } from '@/components/layout/AppLayout';
import { StatsCard } from '@/components/dashboard/StatsCard';
import { ActivityFeed } from '@/components/dashboard/ActivityFeed';
import { RecentJobs } from '@/components/dashboard/RecentJobs';
import { TopCandidates } from '@/components/dashboard/TopCandidates';
import { QuickActions } from '@/components/dashboard/QuickActions';
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
  aiMatchesRun: number;
}

export default function DashboardPage() {
  const { profile, tenantId } = useAuth();
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
          aiUsageResult,
          interviewsResult,
          placementsResult
        ] = await Promise.all([
          supabase.from('jobs').select('id, status').eq('tenant_id', tenantId),
          supabase.from('candidates').select('id').eq('tenant_id', tenantId),
          supabase.from('clients').select('id').eq('tenant_id', tenantId),
          supabase.from('ai_usage').select('id').eq('tenant_id', tenantId),
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
        const aiMatchesRun = aiUsageResult.data?.length || 0;
        const interviewsThisWeek = interviewsResult.data?.length || 0;
        const placementsThisMonth = placementsResult.data?.length || 0;

        setStats({
          openJobs,
          totalCandidates,
          interviewsThisWeek,
          placementsThisMonth,
          totalClients,
          aiMatchesRun,
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
      title: 'AI Matches Run',
      value: stats?.aiMatchesRun ?? 0,
      icon: Sparkles,
      subtitle: 'AI analyses completed',
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
            Here's what's happening with your recruitment pipeline today.
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

        {/* Quick Actions */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
        >
          <QuickActions />
        </motion.div>

        {/* Main Content Grid */}
        <div className="grid lg:grid-cols-3 gap-6">
          {/* Recent Jobs */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="lg:col-span-2"
          >
            <RecentJobs />
          </motion.div>

          {/* Activity Feed */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
          >
            <ActivityFeed />
          </motion.div>
        </div>

        {/* Top Candidates */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6 }}
        >
          <TopCandidates />
        </motion.div>
      </div>
    </AppLayout>
  );
}
