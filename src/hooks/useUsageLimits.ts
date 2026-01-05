import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useAuth } from '@/lib/auth';

export interface UsageStats {
  limits: {
    max_users: number;
    max_jobs: number;
    max_candidates: number;
    match_credits_monthly: number;
  };
  usage: {
    aiCredits: {
      used: number;
      limit: number;
      remaining: number;
      percent: number;
      warning: boolean;
      blocked: boolean;
    };
    jobs: {
      used: number;
      limit: number;
      remaining: number;
      percent: number;
      warning: boolean;
      blocked: boolean;
    };
    candidates: {
      used: number;
      limit: number;
      remaining: number;
      percent: number;
      warning: boolean;
      blocked: boolean;
    };
    teamMembers: {
      used: number;
      limit: number;
      remaining: number;
      percent: number;
      warning: boolean;
      blocked: boolean;
    };
  };
  hasWarnings: boolean;
  hasBlocks: boolean;
}

// Unlimited stats for super admins
const UNLIMITED_STATS: UsageStats = {
  limits: { max_users: 999999, max_jobs: 999999, max_candidates: 999999, match_credits_monthly: 999999 },
  usage: {
    aiCredits: { used: 0, limit: 999999, remaining: 999999, percent: 0, warning: false, blocked: false },
    jobs: { used: 0, limit: 999999, remaining: 999999, percent: 0, warning: false, blocked: false },
    candidates: { used: 0, limit: 999999, remaining: 999999, percent: 0, warning: false, blocked: false },
    teamMembers: { used: 0, limit: 999999, remaining: 999999, percent: 0, warning: false, blocked: false },
  },
  hasWarnings: false,
  hasBlocks: false,
};

export function useUsageLimits() {
  const { tenantId, user, isSuperAdmin } = useAuth();
  const [usageStats, setUsageStats] = useState<UsageStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [lastWarned, setLastWarned] = useState<Set<string>>(new Set());

  const fetchUsageStats = useCallback(async () => {
    // Don't fetch if no user or tenant
    if (!user || !tenantId) {
      setIsLoading(false);
      return;
    }

    // Super admins get unlimited access - no need to fetch stats
    if (isSuperAdmin) {
      setUsageStats(UNLIMITED_STATS);
      setIsLoading(false);
      return;
    }

    try {
      const { data, error } = await supabase.functions.invoke('get-usage-stats');

      if (error) throw error;
      
      if (data) {
        setUsageStats(data);
        
        // Show warnings for features approaching limits (only once per session)
        const newWarnings = new Set<string>();
        
        if (data.usage.aiCredits.warning && !lastWarned.has('aiCredits')) {
          toast.warning('AI Credits Low', {
            description: `You've used ${data.usage.aiCredits.percent}% of your AI match credits. Consider upgrading your plan.`,
          });
          newWarnings.add('aiCredits');
        }
        
        if (data.usage.jobs.warning && !lastWarned.has('jobs')) {
          toast.warning('Active Jobs Limit Approaching', {
            description: `You're using ${data.usage.jobs.percent}% of your job limit. Consider upgrading your plan.`,
          });
          newWarnings.add('jobs');
        }
        
        if (data.usage.candidates.warning && !lastWarned.has('candidates')) {
          toast.warning('Candidates Limit Approaching', {
            description: `You're using ${data.usage.candidates.percent}% of your candidate limit. Consider upgrading your plan.`,
          });
          newWarnings.add('candidates');
        }
        
        if (data.usage.teamMembers.warning && !lastWarned.has('teamMembers')) {
          toast.warning('Team Members Limit Approaching', {
            description: `You're using ${data.usage.teamMembers.percent}% of your team member limit. Consider upgrading your plan.`,
          });
          newWarnings.add('teamMembers');
        }
        
        setLastWarned(prev => new Set([...prev, ...newWarnings]));
      }
    } catch (error) {
      console.error('Error fetching usage stats:', error);
      // Set default stats on error to prevent infinite loading
      setUsageStats({
        limits: { max_users: 2, max_jobs: 10, max_candidates: 150, match_credits_monthly: 50 },
        usage: {
          aiCredits: { used: 0, limit: 50, remaining: 50, percent: 0, warning: false, blocked: false },
          jobs: { used: 0, limit: 10, remaining: 10, percent: 0, warning: false, blocked: false },
          candidates: { used: 0, limit: 150, remaining: 150, percent: 0, warning: false, blocked: false },
          teamMembers: { used: 0, limit: 2, remaining: 2, percent: 0, warning: false, blocked: false },
        },
        hasWarnings: false,
        hasBlocks: false,
      });
    } finally {
      setIsLoading(false);
    }
  }, [user, tenantId, isSuperAdmin, lastWarned]);

  useEffect(() => {
    fetchUsageStats();
    
    // Refresh every 30 seconds only if user is authenticated
    if (user && tenantId) {
      const interval = setInterval(fetchUsageStats, 30000);
      return () => clearInterval(interval);
    }
  }, [user, tenantId, fetchUsageStats]);

  const checkLimit = (feature: 'aiCredits' | 'jobs' | 'candidates' | 'teamMembers'): boolean => {
    // Super admins never hit limits
    if (isSuperAdmin) return false;
    if (!usageStats) return false;
    return usageStats.usage[feature].blocked;
  };

  const showLimitError = (feature: string) => {
    toast.error('Limit Reached', {
      description: `You've reached your ${feature} limit. Please upgrade your plan to continue.`,
      action: {
        label: 'Upgrade',
        onClick: () => window.location.href = '/billing',
      },
    });
  };

  return {
    usageStats,
    isLoading,
    checkLimit,
    showLimitError,
    refreshUsage: fetchUsageStats,
  };
}
