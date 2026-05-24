import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useEffect } from 'react';

export interface RediscoveredMatch {
  id: string;
  job_id: string;
  candidate_id: string;
  match_score: number;
  semantic_score: number | null;
  ai_score: number | null;
  ai_summary: string | null;
  strengths: string[];
  gaps: string[];
  insights: string[];
  confidence: 'low' | 'medium' | 'high';
  dismissed: boolean;
  created_at: string;
  updated_at: string;
  candidate: {
    id: string;
    full_name: string;
    email: string | null;
    phone: string | null;
    avatar_url: string | null;
    current_title: string | null;
    location: string | null;
    notice_period: string | null;
    experience_years: number | null;
    updated_at: string | null;
    owner_id: string | null;
  };
}

export interface RediscoveryRun {
  id: string;
  status: string;
  matches_found: number;
  candidates_scanned: number;
  completed_at: string | null;
  started_at: string;
  error: string | null;
}

export function useRediscoveredMatches(jobId: string | undefined) {
  const queryClient = useQueryClient();

  const matchesQuery = useQuery({
    queryKey: ['rediscovered-matches', jobId],
    enabled: !!jobId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('rediscovered_matches')
        .select(`
          *,
          candidate:candidates!rediscovered_matches_candidate_id_fkey (
            id, full_name, email, phone, avatar_url, current_title, location,
            notice_period, experience_years, updated_at, owner_id
          )
        `)
        .eq('job_id', jobId!)
        .eq('dismissed', false)
        .order('match_score', { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as RediscoveredMatch[];
    },
  });

  const lastRunQuery = useQuery({
    queryKey: ['rediscovery-runs', jobId],
    enabled: !!jobId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('rediscovery_runs')
        .select('*')
        .eq('job_id', jobId!)
        .order('started_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data as RediscoveryRun | null;
    },
  });

  // Realtime invalidation on new matches
  useEffect(() => {
    if (!jobId) return;
    const channel = supabase
      .channel(`rediscovered-${jobId}`)
      .on('postgres_changes', {
        event: '*', schema: 'public', table: 'rediscovered_matches',
        filter: `job_id=eq.${jobId}`,
      }, () => {
        queryClient.invalidateQueries({ queryKey: ['rediscovered-matches', jobId] });
      })
      .on('postgres_changes', {
        event: '*', schema: 'public', table: 'rediscovery_runs',
        filter: `job_id=eq.${jobId}`,
      }, () => {
        queryClient.invalidateQueries({ queryKey: ['rediscovery-runs', jobId] });
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [jobId, queryClient]);

  const scanMutation = useMutation<any, Error, boolean | void>({
    mutationFn: async (force) => {
      if (!jobId) throw new Error('No job');
      const { data, error } = await supabase.functions.invoke('rediscover-candidates', {
        body: { job_id: jobId, force: !!force },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      return data;
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ['rediscovered-matches', jobId] });
      queryClient.invalidateQueries({ queryKey: ['rediscovery-runs', jobId] });
      if (data?.cached) {
        toast.success('Using recent results (under 24h old). Re-scan to force refresh.');
      } else if (typeof data?.matches === 'number') {
        toast.success(`Rediscovery complete — ${data.matches} candidate${data.matches === 1 ? '' : 's'} matched.`);
      }
    },
    onError: (err: any) => {
      const msg = err?.message ?? 'Rediscovery failed';
      if (msg.includes('RATE_LIMIT')) toast.error('AI rate limit hit — try again in a moment.');
      else if (msg.includes('CREDITS')) toast.error('AI credits exhausted. Add credits in Settings → Usage.');
      else toast.error(msg);
    },
  });

  const dismissMutation = useMutation({
    mutationFn: async (matchId: string) => {
      const { error } = await supabase
        .from('rediscovered_matches')
        .update({ dismissed: true })
        .eq('id', matchId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['rediscovered-matches', jobId] });
    },
  });

  return {
    matches: matchesQuery.data ?? [],
    lastRun: lastRunQuery.data ?? null,
    isLoading: matchesQuery.isLoading,
    isScanning: scanMutation.isPending,
    runScan: (force = false) => scanMutation.mutate(force),
    dismiss: dismissMutation.mutate,
  };
}
