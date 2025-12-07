import { AppLayout } from '@/components/layout/AppLayout';
import { StatsCard } from '@/components/dashboard/StatsCard';
import { ActivityFeed } from '@/components/dashboard/ActivityFeed';
import { RecentJobs } from '@/components/dashboard/RecentJobs';
import { TopCandidates } from '@/components/dashboard/TopCandidates';
import { QuickActions } from '@/components/dashboard/QuickActions';
import { dashboardStats, activities, jobs, candidates } from '@/data/mockData';
import { Briefcase, Users, Calendar, Award, Building2, Sparkles } from 'lucide-react';

const Index = () => {
  return (
    <AppLayout title="Dashboard" subtitle="Welcome back, Alex! Here's your recruitment overview.">
      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4 mb-8">
        <StatsCard
          title="Open Jobs"
          value={dashboardStats.openJobs}
          icon={Briefcase}
          change={{ value: '2', positive: true }}
          variant="accent"
          delay={0}
        />
        <StatsCard
          title="Active Candidates"
          value={dashboardStats.activeCandidates}
          icon={Users}
          change={{ value: '12%', positive: true }}
          delay={0.1}
        />
        <StatsCard
          title="Interviews"
          value={dashboardStats.interviewsScheduled}
          icon={Calendar}
          change={{ value: '3', positive: true }}
          variant="warning"
          delay={0.2}
        />
        <StatsCard
          title="Placements"
          value={dashboardStats.placements}
          icon={Award}
          change={{ value: '8%', positive: true }}
          variant="success"
          delay={0.3}
        />
        <StatsCard
          title="Clients"
          value={dashboardStats.totalClients}
          icon={Building2}
          delay={0.4}
        />
        <StatsCard
          title="AI Matches"
          value={dashboardStats.matchesRun}
          icon={Sparkles}
          change={{ value: '45', positive: true }}
          variant="accent"
          delay={0.5}
        />
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column - Jobs & Activity */}
        <div className="lg:col-span-2 space-y-6">
          <RecentJobs jobs={jobs} />
          <ActivityFeed activities={activities} />
        </div>

        {/* Right Column - Quick Actions & Top Candidates */}
        <div className="space-y-6">
          <QuickActions />
          <TopCandidates candidates={candidates} />
        </div>
      </div>
    </AppLayout>
  );
};

export default Index;
