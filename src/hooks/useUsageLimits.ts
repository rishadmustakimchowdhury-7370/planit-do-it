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

const DEFAULT_USAGE_STATS: UsageStats = {
  limits: { max_users: 2, max_jobs: 10, max_candidates: 150, match_credits_monthly: 50 },
  usage: {
    aiCredits: { used: 0, limit: 50, remaining: 50, percent: 0, warning: false, blocked: false },
    jobs: { used: 0, limit: 10, remaining: 10, percent: 0, warning: false, blocked: false },
    candidates: { used: 0, limit: 150, remaining: 150, percent: 0, warning: false, blocked: false },
    teamMembers: { used: 0, limit: 2, remaining: 2, percent: 0, warning: false, blocked: false },
  },
  hasWarnings: false,
  hasBlocks: false,
};

function normalizeUsageStats(data: any): UsageStats {
  const safeMeter = (meter: any, fallback: UsageStats['usage']['aiCredits']) => ({
    used: Number.isFinite(Number(meter?.used)) ? Number(meter.used) : fallback.used,
    limit: Number.isFinite(Number(meter?.limit)) ? Number(meter.limit) : fallback.limit,
    remaining: Number.isFinite(Number(meter?.remaining)) ? Number(meter.remaining) : fallback.remaining,
    percent: Number.isFinite(Number(meter?.percent)) ? Number(meter.percent) : fallback.percent,
    warning: Boolean(meter?.warning),
    blocked: Boolean(meter?.blocked),
  });

  const usage = {
    aiCredits: safeMeter(data?.usage?.aiCredits, DEFAULT_USAGE_STATS.usage.aiCredits),
    jobs: safeMeter(data?.usage?.jobs, DEFAULT_USAGE_STATS.usage.jobs),
    candidates: safeMeter(data?.usage?.candidates, DEFAULT_USAGE_STATS.usage.candidates),
    teamMembers: safeMeter(data?.usage?.teamMembers, DEFAULT_USAGE_STATS.usage.teamMembers),
  };

  return {
    limits: {
      max_users: Number.isFinite(Number(data?.limits?.max_users)) ? Number(data.limits.max_users) : DEFAULT_USAGE_STATS.limits.max_users,
      max_jobs: Number.isFinite(Number(data?.limits?.max_jobs)) ? Number(data.limits.max_jobs) : DEFAULT_USAGE_STATS.limits.max_jobs,
      max_candidates: Number.isFinite(Number(data?.limits?.max_candidates)) ? Number(data.limits.max_candidates) : DEFAULT_USAGE_STATS.limits.max_candidates,
      match_credits_monthly: Number.isFinite(Number(data?.limits?.match_credits_monthly)) ? Number(data.limits.match_credits_monthly) : DEFAULT_USAGE_STATS.limits.match_credits_monthly,
    },
    usage,
    hasWarnings: Boolean(data?.hasWarnings ?? Object.values(usage).some((m) => m.warning)),
    hasBlocks: Boolean(data?.hasBlocks ?? Object.values(usage).some((m) => m.blocked)),
  };
}

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
        const normalized = normalizeUsageStats(data);
        setUsageStats(normalized);
        
        // Show warnings for features approaching limits (only once per session)
        const newWarnings = new Set<string>();
        
        if (normalized.usage.aiCredits.warning && !lastWarned.has('aiCredits')) {
          toast.warning('AI Credits Low', {
            description: `You've used ${normalized.usage.aiCredits.percent}% of your AI match credits. Consider upgrading your plan.`,
          });
          newWarnings.add('aiCredits');
        }
        
        if (normalized.usage.jobs.warning && !lastWarned.has('jobs')) {
          toast.warning('Active Jobs Limit Approaching', {
            description: `You're using ${normalized.usage.jobs.percent}% of your job limit. Consider upgrading your plan.`,
          });
          newWarnings.add('jobs');
        }
        
        if (normalized.usage.candidates.warning && !lastWarned.has('candidates')) {
          toast.warning('Candidates Limit Approaching', {
            description: `You're using ${normalized.usage.candidates.percent}% of your candidate limit. Consider upgrading your plan.`,
          });
          newWarnings.add('candidates');
        }
        
        if (normalized.usage.teamMembers.warning && !lastWarned.has('teamMembers')) {
          toast.warning('Team Members Limit Approaching', {
            description: `You're using ${normalized.usage.teamMembers.percent}% of your team member limit. Consider upgrading your plan.`,
          });
          newWarnings.add('teamMembers');
        }
        
        setLastWarned(prev => new Set([...prev, ...newWarnings]));
      }
    } catch (error) {
      console.error('Error fetching usage stats:', error);
      // Set default stats on error to prevent infinite loading
      setUsageStats(DEFAULT_USAGE_STATS);
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
