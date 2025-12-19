import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

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

export function useUsageLimits() {
  const [usageStats, setUsageStats] = useState<UsageStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [lastWarned, setLastWarned] = useState<Set<string>>(new Set());

  const fetchUsageStats = async () => {
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
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchUsageStats();
    
    // Refresh every 30 seconds
    const interval = setInterval(fetchUsageStats, 30000);
    
    return () => clearInterval(interval);
  }, []);

  const checkLimit = (feature: 'aiCredits' | 'jobs' | 'candidates' | 'teamMembers'): boolean => {
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
