import { useState, useEffect } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Progress } from '@/components/ui/progress';
import { 
  Users, 
  Briefcase, 
  UserCheck, 
  Zap,
  TrendingUp,
  Activity,
  AlertTriangle
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { motion } from 'framer-motion';

interface TenantUsage {
  tenant_id: string;
  tenant_name: string;
  subscription_plan: string;
  ai_credits_used: number;
  ai_credits_limit: number;
  jobs_count: number;
  jobs_limit: number;
  candidates_count: number;
  candidates_limit: number;
  team_members_count: number;
  team_members_limit: number;
}

export default function AdminUsageAnalyticsPage() {
  const [tenantUsage, setTenantUsage] = useState<TenantUsage[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchUsageAnalytics();
  }, []);

  const fetchUsageAnalytics = async () => {
    setIsLoading(true);
    try {
      // Fetch all tenants
      const { data: tenants, error: tenantsError } = await supabase
        .from('tenants')
        .select('id, name, subscription_plan_id')
        .order('name');

      if (tenantsError) throw tenantsError;

      // Fetch subscription plans separately
      const { data: plans } = await supabase
        .from('subscription_plans')
        .select('id, name, max_users, max_jobs, max_candidates, match_credits_monthly');
      
      const plansMap = new Map((plans || []).map(p => [p.id, p]));

      if (tenantsError) throw tenantsError;

      // Get current month start
      const now = new Date();
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

      const usageData = await Promise.all(
        (tenants || []).map(async (tenant: any) => {
          // Count AI usage for current month
          const { count: aiUsageCount } = await supabase
            .from('ai_usage')
            .select('*', { count: 'exact', head: true })
            .eq('tenant_id', tenant.id)
            .eq('action_type', 'ai_match')
            .gte('created_at', monthStart);

          // Count active jobs
          const { count: jobsCount } = await supabase
            .from('jobs')
            .select('*', { count: 'exact', head: true })
            .eq('tenant_id', tenant.id)
            .in('status', ['open', 'draft']);

          // Count candidates
          const { count: candidatesCount } = await supabase
            .from('candidates')
            .select('*', { count: 'exact', head: true })
            .eq('tenant_id', tenant.id);

          // Count team members
          const { count: teamCount } = await supabase
            .from('profiles')
            .select('*', { count: 'exact', head: true })
            .eq('tenant_id', tenant.id)
            .eq('is_active', true);

          const plan = plansMap.get(tenant.subscription_plan_id) || {} as any;
          return {
            tenant_id: tenant.id,
            tenant_name: tenant.name,
            subscription_plan: plan.name || 'Free',
            ai_credits_used: aiUsageCount || 0,
            ai_credits_limit: plan.match_credits_monthly || 50,
            jobs_count: jobsCount || 0,
            jobs_limit: plan.max_jobs || 10,
            candidates_count: candidatesCount || 0,
            candidates_limit: plan.max_candidates || 150,
            team_members_count: teamCount || 0,
            team_members_limit: plan.max_users || 2,
          };
        })
      );

      setTenantUsage(usageData);
    } catch (error) {
      console.error('Error fetching usage analytics:', error);
      toast.error('Failed to load usage analytics');
    } finally {
      setIsLoading(false);
    }
  };

  const calculatePercent = (used: number, limit: number) => {
    if (limit === -1) return 0;
    return Math.round((used / limit) * 100);
  };

  const getStatusColor = (percent: number) => {
    if (percent >= 100) return 'bg-destructive';
    if (percent >= 80) return 'bg-warning';
    return 'bg-accent';
  };

  if (isLoading) {
    return (
      <AppLayout title="Usage Analytics" subtitle="Monitor tenant resource consumption">
        <div className="space-y-6">
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-96 w-full" />
        </div>
      </AppLayout>
    );
  }

  // Calculate aggregate statistics
  const totalAICreditsUsed = tenantUsage.reduce((sum, t) => sum + t.ai_credits_used, 0);
  const totalJobs = tenantUsage.reduce((sum, t) => sum + t.jobs_count, 0);
  const totalCandidates = tenantUsage.reduce((sum, t) => sum + t.candidates_count, 0);
  const totalTeamMembers = tenantUsage.reduce((sum, t) => sum + t.team_members_count, 0);

  return (
    <AppLayout title="Usage Analytics" subtitle="Monitor tenant resource consumption">
      <div className="space-y-6">
        {/* Aggregate Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between mb-2">
                  <Zap className="h-5 w-5 text-accent" />
                  <Badge variant="secondary">{tenantUsage.length} Tenants</Badge>
                </div>
                <p className="text-2xl font-bold">{totalAICreditsUsed}</p>
                <p className="text-sm text-muted-foreground">Total AI Credits Used</p>
              </CardContent>
            </Card>
          </motion.div>

          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between mb-2">
                  <Briefcase className="h-5 w-5 text-accent" />
                  <Activity className="h-4 w-4 text-muted-foreground" />
                </div>
                <p className="text-2xl font-bold">{totalJobs}</p>
                <p className="text-sm text-muted-foreground">Total Active Jobs</p>
              </CardContent>
            </Card>
          </motion.div>

          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between mb-2">
                  <UserCheck className="h-5 w-5 text-accent" />
                  <TrendingUp className="h-4 w-4 text-success" />
                </div>
                <p className="text-2xl font-bold">{totalCandidates}</p>
                <p className="text-sm text-muted-foreground">Total Candidates</p>
              </CardContent>
            </Card>
          </motion.div>

          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between mb-2">
                  <Users className="h-5 w-5 text-accent" />
                  <Activity className="h-4 w-4 text-muted-foreground" />
                </div>
                <p className="text-2xl font-bold">{totalTeamMembers}</p>
                <p className="text-sm text-muted-foreground">Total Team Members</p>
              </CardContent>
            </Card>
          </motion.div>
        </div>

        {/* Tenant Usage Details */}
        <Card>
          <CardHeader>
            <CardTitle>Tenant Resource Usage</CardTitle>
            <CardDescription>Monitor how each tenant is using their allocated resources</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-6">
              {tenantUsage.map((tenant, i) => (
                <motion.div
                  key={tenant.tenant_id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.05 }}
                  className="border rounded-lg p-4"
                >
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <h3 className="font-semibold">{tenant.tenant_name}</h3>
                      <p className="text-sm text-muted-foreground">{tenant.subscription_plan} Plan</p>
                    </div>
                    <div className="flex gap-2">
                      {calculatePercent(tenant.ai_credits_used, tenant.ai_credits_limit) >= 80 && (
                        <Badge variant="destructive" className="gap-1">
                          <AlertTriangle className="h-3 w-3" />
                          High Usage
                        </Badge>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* AI Credits */}
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-medium">AI Credits</span>
                        <span className="text-sm text-muted-foreground">
                          {tenant.ai_credits_used} / {tenant.ai_credits_limit === -1 ? '∞' : tenant.ai_credits_limit}
                        </span>
                      </div>
                      <Progress 
                        value={Math.min(100, calculatePercent(tenant.ai_credits_used, tenant.ai_credits_limit))} 
                        className="h-2"
                      />
                      <p className="text-xs text-muted-foreground mt-1">
                        {calculatePercent(tenant.ai_credits_used, tenant.ai_credits_limit)}% used
                      </p>
                    </div>

                    {/* Jobs */}
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-medium">Active Jobs</span>
                        <span className="text-sm text-muted-foreground">
                          {tenant.jobs_count} / {tenant.jobs_limit === -1 ? '∞' : tenant.jobs_limit}
                        </span>
                      </div>
                      <Progress 
                        value={Math.min(100, calculatePercent(tenant.jobs_count, tenant.jobs_limit))} 
                        className="h-2"
                      />
                      <p className="text-xs text-muted-foreground mt-1">
                        {calculatePercent(tenant.jobs_count, tenant.jobs_limit)}% used
                      </p>
                    </div>

                    {/* Candidates */}
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-medium">Candidates</span>
                        <span className="text-sm text-muted-foreground">
                          {tenant.candidates_count} / {tenant.candidates_limit === -1 ? '∞' : tenant.candidates_limit}
                        </span>
                      </div>
                      <Progress 
                        value={Math.min(100, calculatePercent(tenant.candidates_count, tenant.candidates_limit))} 
                        className="h-2"
                      />
                      <p className="text-xs text-muted-foreground mt-1">
                        {calculatePercent(tenant.candidates_count, tenant.candidates_limit)}% used
                      </p>
                    </div>

                    {/* Team Members */}
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-medium">Team Members</span>
                        <span className="text-sm text-muted-foreground">
                          {tenant.team_members_count} / {tenant.team_members_limit === -1 ? '∞' : tenant.team_members_limit}
                        </span>
                      </div>
                      <Progress 
                        value={Math.min(100, calculatePercent(tenant.team_members_count, tenant.team_members_limit))} 
                        className="h-2"
                      />
                      <p className="text-xs text-muted-foreground mt-1">
                        {calculatePercent(tenant.team_members_count, tenant.team_members_limit)}% used
                      </p>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
