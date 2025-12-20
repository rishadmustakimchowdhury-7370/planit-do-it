import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth';
import { toast } from 'sonner';

export interface FeatureUsage {
  used: number;
  limit: number;
  remaining: number;
  percent: number;
  status: 'normal' | 'warning' | 'limit_reached';
}

export interface UserUsageStats {
  cvUploads: FeatureUsage;
  aiTests: FeatureUsage;
  jobs: FeatureUsage;
  planName: string;
  billingCycleEnd: string | null;
}

export interface TeamMemberUsage {
  userId: string;
  fullName: string;
  email: string;
  avatarUrl: string | null;
  planName: string;
  cvUploads: FeatureUsage;
  aiTests: FeatureUsage;
  jobs: FeatureUsage;
  status: 'normal' | 'warning' | 'limit_reached';
}

// CV-related action types to track
const CV_ACTION_TYPES = ['cv_uploaded', 'cv_submitted', 'cv_parsed', 'cv_deleted'];

// AI-related action types to track  
const AI_ACTION_TYPES = ['screening_completed', 'ai_match_run', 'ai_cv_parse', 'ai_email_compose', 'ai_brand_cv'];

function calculateUsage(used: number, limit: number): FeatureUsage {
  // Handle unlimited (-1) limits
  if (limit === -1 || limit === 999999) {
    return {
      used,
      limit: -1,
      remaining: -1,
      percent: 0,
      status: 'normal',
    };
  }
  
  const remaining = Math.max(0, limit - used);
  const percent = limit > 0 ? Math.round((used / limit) * 100) : 0;
  
  let status: 'normal' | 'warning' | 'limit_reached' = 'normal';
  if (percent >= 100) {
    status = 'limit_reached';
  } else if (percent >= 80) {
    status = 'warning';
  }
  
  return { used, limit, remaining, percent, status };
}

export function useUsageTracking() {
  const { tenantId, user, isOwner, isManager } = useAuth();
  const [usageStats, setUsageStats] = useState<UserUsageStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const fetchUsageStats = useCallback(async () => {
    if (!tenantId || !user) {
      setIsLoading(false);
      return;
    }

    try {
      // Fetch tenant with plan info
      const { data: tenantData } = await supabase
        .from('tenants')
        .select('subscription_plan_id, subscription_ends_at')
        .eq('id', tenantId)
        .single();

      let planName = 'Free';
      let cvLimit = 100;
      let aiTestLimit = 50;
      let jobLimit = 10;
      const billingCycleEnd = tenantData?.subscription_ends_at || null;

      // Fetch plan details if subscription exists
      if (tenantData?.subscription_plan_id) {
        const { data: planData } = await supabase
          .from('subscription_plans')
          .select('name, max_candidates, match_credits_monthly, max_jobs')
          .eq('id', tenantData.subscription_plan_id)
          .single();

        if (planData) {
          planName = planData.name || 'Free';
          cvLimit = planData.max_candidates ?? 100;
          aiTestLimit = planData.match_credits_monthly ?? 50;
          jobLimit = planData.max_jobs ?? 10;
        }
      }

      // Get current period start (beginning of current month)
      const periodStart = new Date();
      periodStart.setDate(1);
      periodStart.setHours(0, 0, 0, 0);
      const periodStartISO = periodStart.toISOString();

      // For owners/managers, count ALL CV activities for the tenant
      // For regular users, count only their personal activities
      const cvQuery = supabase
        .from('recruiter_activities')
        .select('id', { count: 'exact', head: true })
        .eq('tenant_id', tenantId)
        .in('action_type', CV_ACTION_TYPES)
        .gte('created_at', periodStartISO);
      
      if (!isOwner && !isManager) {
        cvQuery.eq('user_id', user.id);
      }
      
      const { count: cvCount } = await cvQuery;

      // Count ALL AI-related activities
      const aiActivityQuery = supabase
        .from('recruiter_activities')
        .select('id', { count: 'exact', head: true })
        .eq('tenant_id', tenantId)
        .in('action_type', AI_ACTION_TYPES)
        .gte('created_at', periodStartISO);
        
      if (!isOwner && !isManager) {
        aiActivityQuery.eq('user_id', user.id);
      }
      
      const { count: aiActivityCount } = await aiActivityQuery;
      
      console.log('🔍 AI Activity Debug:', {
        tenantId,
        periodStartISO,
        AI_ACTION_TYPES,
        aiActivityCount,
        isOwner,
        isManager,
        userId: user.id
      });

      // Also check ai_usage table for AI credits used
      const aiUsageQuery = supabase
        .from('ai_usage')
        .select('id', { count: 'exact', head: true })
        .eq('tenant_id', tenantId)
        .gte('created_at', periodStartISO);
        
      if (!isOwner && !isManager) {
        aiUsageQuery.eq('user_id', user.id);
      }
      
      const { count: aiUsageCount } = await aiUsageQuery;
      
      console.log('🔍 AI Usage Count:', aiUsageCount);

      const totalAiTests = (aiActivityCount || 0) + (aiUsageCount || 0);
      
      console.log('📊 Total AI Tests:', totalAiTests);

      // Count active jobs for tenant (jobs may not have created_by set)
      const { count: jobCount } = await supabase
        .from('jobs')
        .select('id', { count: 'exact', head: true })
        .eq('tenant_id', tenantId)
        .eq('status', 'open');

      setUsageStats({
        cvUploads: calculateUsage(cvCount || 0, cvLimit),
        aiTests: calculateUsage(totalAiTests, aiTestLimit),
        jobs: calculateUsage(jobCount || 0, jobLimit),
        planName,
        billingCycleEnd,
      });

    } catch (error) {
      console.error('Error fetching usage stats:', error);
    } finally {
      setIsLoading(false);
    }
  }, [tenantId, user]);

  // Set up real-time subscription for activities
  useEffect(() => {
    fetchUsageStats();
    
    // Subscribe to real-time changes
    const channel = supabase
      .channel(`usage-tracking:${tenantId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'recruiter_activities',
          filter: `tenant_id=eq.${tenantId}`,
        },
        () => {
          fetchUsageStats();
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'ai_usage',
          filter: `tenant_id=eq.${tenantId}`,
        },
        () => {
          fetchUsageStats();
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'jobs',
          filter: `tenant_id=eq.${tenantId}`,
        },
        () => {
          fetchUsageStats();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchUsageStats]);

  const checkAndWarn = useCallback((feature: 'cvUploads' | 'aiTests' | 'jobs'): boolean => {
    if (!usageStats) return false;
    
    const usage = usageStats[feature];
    
    // Unlimited plans never block
    if (usage.limit === -1) return false;
    
    if (usage.status === 'limit_reached') {
      toast.error('Limit Reached', {
        description: 'You have reached your plan limit. Please upgrade to continue.',
        action: {
          label: 'Upgrade',
          onClick: () => window.location.href = '/billing',
        },
      });
      return true;
    }
    
    if (usage.status === 'warning') {
      toast.warning('Approaching Limit', {
        description: 'You are close to your monthly limit.',
      });
    }
    
    return false;
  }, [usageStats]);

  return {
    usageStats,
    isLoading,
    checkAndWarn,
    refreshUsage: fetchUsageStats,
  };
}

// Hook for owners to see team usage
export function useTeamUsageTracking() {
  const { tenantId } = useAuth();
  const [teamUsage, setTeamUsage] = useState<TeamMemberUsage[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchTeamUsage = useCallback(async () => {
    if (!tenantId) {
      setIsLoading(false);
      return;
    }

    try {
      // Get tenant's plan limits
      const { data: tenantData } = await supabase
        .from('tenants')
        .select('subscription_plan_id')
        .eq('id', tenantId)
        .single();

      let planName = 'Free';
      let cvLimit = 100;
      let aiTestLimit = 50;
      let jobLimit = 10;

      if (tenantData?.subscription_plan_id) {
        const { data: planData } = await supabase
          .from('subscription_plans')
          .select('name, max_candidates, match_credits_monthly, max_jobs')
          .eq('id', tenantData.subscription_plan_id)
          .single();

        if (planData) {
          planName = planData.name || 'Free';
          cvLimit = planData.max_candidates ?? 100;
          aiTestLimit = planData.match_credits_monthly ?? 50;
          jobLimit = planData.max_jobs ?? 10;
        }
      }

      // Get all team members (based on profiles in this tenant)
      const { data: profilesData } = await supabase
        .from('profiles')
        .select('id, full_name, email, avatar_url, is_active')
        .eq('tenant_id', tenantId)
        .eq('is_active', true);

      if (!profilesData || profilesData.length === 0) {
        setTeamUsage([]);
        setIsLoading(false);
        return;
      }

      const userIds = profilesData.map((p) => p.id);

      // Get current period start
      const periodStart = new Date();
      periodStart.setDate(1);
      periodStart.setHours(0, 0, 0, 0);
      const periodStartISO = periodStart.toISOString();

      // Get all activities for the team
      const { data: activitiesData } = await supabase
        .from('recruiter_activities')
        .select('user_id, action_type')
        .eq('tenant_id', tenantId)
        .gte('created_at', periodStartISO);

      // Get AI usage data
      const { data: aiUsageData } = await supabase
        .from('ai_usage')
        .select('user_id')
        .eq('tenant_id', tenantId)
        .gte('created_at', periodStartISO);

      // Get total active jobs for tenant
      const { count: totalJobCount } = await supabase
        .from('jobs')
        .select('id', { count: 'exact', head: true })
        .eq('tenant_id', tenantId)
        .eq('status', 'open');

      // Build usage per member
      const memberUsage: TeamMemberUsage[] = userIds.map(userId => {
        const profile = profilesData?.find(p => p.id === userId);
        const userActivities = activitiesData?.filter(a => a.user_id === userId) || [];
        const userAiUsage = aiUsageData?.filter(a => a.user_id === userId) || [];
        
        // Count CV activities using all CV action types
        const cvUploads = userActivities.filter(a => CV_ACTION_TYPES.includes(a.action_type)).length;
        
        // Count AI activities using all AI action types
        const aiFromActivities = userActivities.filter(a => AI_ACTION_TYPES.includes(a.action_type)).length;
        const aiTests = aiFromActivities + userAiUsage.length;
        
        // Jobs are shared at tenant level, distribute equally or show tenant total
        const jobs = Math.ceil((totalJobCount || 0) / userIds.length);

        const cvUsage = calculateUsage(cvUploads, cvLimit);
        const aiUsage = calculateUsage(aiTests, aiTestLimit);
        const jobUsage = calculateUsage(jobs, jobLimit);

        let overallStatus: 'normal' | 'warning' | 'limit_reached' = 'normal';
        if (cvUsage.status === 'limit_reached' || aiUsage.status === 'limit_reached' || jobUsage.status === 'limit_reached') {
          overallStatus = 'limit_reached';
        } else if (cvUsage.status === 'warning' || aiUsage.status === 'warning' || jobUsage.status === 'warning') {
          overallStatus = 'warning';
        }

        return {
          userId,
          fullName: profile?.full_name || 'Unknown',
          email: profile?.email || '',
          avatarUrl: profile?.avatar_url,
          planName,
          cvUploads: cvUsage,
          aiTests: aiUsage,
          jobs: jobUsage,
          status: overallStatus,
        };
      });

      setTeamUsage(memberUsage);

    } catch (error) {
      console.error('Error fetching team usage:', error);
    } finally {
      setIsLoading(false);
    }
  }, [tenantId]);

  // Set up real-time subscription
  useEffect(() => {
    fetchTeamUsage();
    
    const channel = supabase
      .channel(`team-usage-tracking:${tenantId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'recruiter_activities',
          filter: `tenant_id=eq.${tenantId}`,
        },
        () => {
          fetchTeamUsage();
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'ai_usage',
          filter: `tenant_id=eq.${tenantId}`,
        },
        () => {
          fetchTeamUsage();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchTeamUsage]);

  return {
    teamUsage,
    isLoading,
    refreshTeamUsage: fetchTeamUsage,
  };
}
