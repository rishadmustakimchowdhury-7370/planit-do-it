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
        const [jobsResult, candidatesResult, clientsResult, aiUsageResult] = await Promise.all([
          supabase.from('jobs').select('id, status').eq('tenant_id', tenantId),
          supabase.from('candidates').select('id').eq('tenant_id', tenantId),
          supabase.from('clients').select('id').eq('tenant_id', tenantId),
          supabase.from('ai_usage').select('id').eq('tenant_id', tenantId),
        ]);

        const openJobs = jobsResult.data?.filter(j => j.status === 'open').length || 0;
        const totalCandidates = candidatesResult.data?.length || 0;
        const totalClients = clientsResult.data?.length || 0;
        const aiMatchesRun = aiUsageResult.data?.length || 0;

        // For now, mock interviews and placements
        const interviewsThisWeek = Math.floor(Math.random() * 10) + 3;
        const placementsThisMonth = Math.floor(Math.random() * 5) + 1;

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
      trend: { value: 12, isPositive: true },
      color: 'text-info' as const,
    },
    {
      title: 'Total Candidates',
      value: stats?.totalCandidates ?? 0,
      icon: Users,
      trend: { value: 8, isPositive: true },
      color: 'text-accent' as const,
    },
    {
      title: 'Interviews This Week',
      value: stats?.interviewsThisWeek ?? 0,
      icon: Calendar,
      trend: { value: 5, isPositive: true },
      color: 'text-warning' as const,
    },
    {
      title: 'Placements This Month',
      value: stats?.placementsThisMonth ?? 0,
      icon: Trophy,
      trend: { value: 20, isPositive: true },
      color: 'text-success' as const,
    },
    {
      title: 'Total Clients',
      value: stats?.totalClients ?? 0,
      icon: Building2,
      color: 'text-primary' as const,
    },
    {
      title: 'AI Matches Run',
      value: stats?.aiMatchesRun ?? 0,
      icon: Sparkles,
      color: 'text-accent' as const,
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
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
          {isLoading ? (
            [...Array(6)].map((_, i) => (
              <Skeleton key={i} className="h-32 rounded-lg" />
            ))
          ) : (
            statsCards.map((stat, i) => (
              <motion.div
                key={stat.title}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
              >
                <StatsCard {...stat} />
              </motion.div>
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