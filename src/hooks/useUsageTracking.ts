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

// Job usage is based on active jobs and assignments (not on who clicked “assign”).
// This makes team reports reflect “jobs a person is responsible for”.

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
  // Use one decimal place for small percentages, round for larger ones
  const rawPercent = limit > 0 ? (used / limit) * 100 : 0;
  const percent = rawPercent < 1 && rawPercent > 0 
    ? parseFloat(rawPercent.toFixed(1)) 
    : Math.round(rawPercent);
  
  let status: 'normal' | 'warning' | 'limit_reached' = 'normal';
  if (rawPercent >= 100) {
    status = 'limit_reached';
  } else if (rawPercent >= 80) {
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

      // Count AI match runs from job_candidates.matched_at (the source of truth)
      // For owners/managers: count all matches in tenant
      // For regular users: count matches where they created the candidate
      let aiMatchCount = 0;
      
      if (isOwner || isManager) {
        const { count } = await supabase
          .from('job_candidates')
          .select('id', { count: 'exact', head: true })
          .eq('tenant_id', tenantId)
          .not('matched_at', 'is', null)
          .gte('matched_at', periodStartISO);
        aiMatchCount = count || 0;
      } else {
        // For regular users, count matches on candidates they created
        const { data: userCandidates } = await supabase
          .from('candidates')
          .select('id')
          .eq('tenant_id', tenantId)
          .eq('created_by', user.id);
        
        if (userCandidates && userCandidates.length > 0) {
          const candidateIds = userCandidates.map(c => c.id);
          const { count } = await supabase
            .from('job_candidates')
            .select('id', { count: 'exact', head: true })
            .eq('tenant_id', tenantId)
            .in('candidate_id', candidateIds)
            .not('matched_at', 'is', null)
            .gte('matched_at', periodStartISO);
          aiMatchCount = count || 0;
        }
      }

      const totalAiTests = aiMatchCount;

      // Jobs usage:
      // - Owner/Manager: total active jobs in tenant
      // - Recruiter: active jobs they created OR that are assigned to them
      const { data: activeJobs } = await supabase
        .from('jobs')
        .select('id, created_by')
        .eq('tenant_id', tenantId)
        .eq('status', 'open');

      const activeJobIds = new Set((activeJobs || []).map(j => j.id));

      let jobsUsed = 0;
      if (isOwner || isManager) {
        jobsUsed = activeJobs?.length || 0;
      } else {
        const createdJobIds = (activeJobs || [])
          .filter(j => j.created_by === user.id)
          .map(j => j.id);

        const { data: userAssignees } = await supabase
          .from('job_assignees')
          .select('job_id')
          .eq('tenant_id', tenantId)
          .eq('user_id', user.id);

        const assignedActiveJobIds = (userAssignees || [])
          .map(a => a.job_id)
          .filter(jobId => activeJobIds.has(jobId));

        jobsUsed = new Set([...createdJobIds, ...assignedActiveJobIds]).size;
      }

      setUsageStats({
        cvUploads: calculateUsage(cvCount || 0, cvLimit),
        aiTests: calculateUsage(totalAiTests, aiTestLimit),
        jobs: calculateUsage(jobsUsed, jobLimit),
        planName,
        billingCycleEnd,
      });

    } catch (error) {
      console.error('Error fetching usage stats:', error);
    } finally {
      setIsLoading(false);
    }
  }, [tenantId, user]);

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
          table: 'job_candidates',
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

      // Get all activities for the team (for CV counting)
      const { data: activitiesData } = await supabase
        .from('recruiter_activities')
        .select('user_id, action_type')
        .eq('tenant_id', tenantId)
        .gte('created_at', periodStartISO);

      // Get AI match counts per user from job_candidates (source of truth)
      // Join with candidates to get who created each candidate
      const { data: matchData } = await supabase
        .from('job_candidates')
        .select('candidate_id, candidates!inner(created_by)')
        .eq('tenant_id', tenantId)
        .not('matched_at', 'is', null)
        .gte('matched_at', periodStartISO);

      // Active jobs + assignments (used for per-member “Jobs”)
      const { data: activeJobs } = await supabase
        .from('jobs')
        .select('id, created_by')
        .eq('tenant_id', tenantId)
        .eq('status', 'open');

      const activeJobIds = new Set((activeJobs || []).map(j => j.id));

      const { data: jobAssignees } = await supabase
        .from('job_assignees')
        .select('user_id, job_id')
        .eq('tenant_id', tenantId);

      // Build usage per member
      const memberUsage: TeamMemberUsage[] = userIds.map(userId => {
        const profile = profilesData?.find(p => p.id === userId);
        const userActivities = activitiesData?.filter(a => a.user_id === userId) || [];

        // Count CV activities using all CV action types
        const cvUploads = userActivities.filter(a => CV_ACTION_TYPES.includes(a.action_type)).length;

        // Count AI matches for candidates created by this user
        const aiTests = matchData?.filter(m => (m.candidates as any)?.created_by === userId).length || 0;

        // Jobs = active jobs created by user OR active jobs assigned to user
        const createdJobIds = (activeJobs || [])
          .filter(j => j.created_by === userId)
          .map(j => j.id);

        const assignedJobIds = (jobAssignees || [])
          .filter(ja => ja.user_id === userId && activeJobIds.has(ja.job_id))
          .map(ja => ja.job_id);

        const jobs = new Set([...createdJobIds, ...assignedJobIds]).size;

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
          table: 'job_candidates',
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
