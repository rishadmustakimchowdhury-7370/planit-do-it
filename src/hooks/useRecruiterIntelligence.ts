// Recruiter Intelligence dashboard data hook — tenant-scoped, recruiter-only.

import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";

export interface IntelligenceSummary {
  funnel: Record<string, number>;
  ecosystems: Array<{ signal_type: string; signal_key: string; weight: number; sample_size: number; confidence: string }>;
  paths: Array<{ signal_type: string; signal_key: string; weight: number; sample_size: number; confidence: string }>;
  recruiters: Array<{ recruiter_id: string; total: number; wins: number; losses: number }>;
  clients: Array<{ client_org_id: string; preferences: any; sample_size: number; confidence: string; refreshed_at: string }>;
  generated_at: string;
}

export function useRecruiterIntelligence() {
  const { tenantId } = useAuth();
  return useQuery({
    queryKey: ["recruiter-intelligence", tenantId],
    enabled: !!tenantId,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("recruiter_intelligence_summary", { _tenant_id: tenantId! });
      if (error) throw error;
      return data as unknown as IntelligenceSummary;
    },
  });
}
