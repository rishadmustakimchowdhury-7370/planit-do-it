import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth';
import { toast } from 'sonner';

export interface CreditBalance {
  balance: number;
  tenant_id: string;
}

export interface CreditTransaction {
  id: string;
  tenant_id: string;
  user_id: string;
  action_type: string;
  cost: number;
  balance_before: number;
  balance_after: number;
  metadata: any;
  created_at: string;
}

// Credit costs for different actions
export const CREDIT_COSTS = {
  ai_match: 5,
  cv_parse: 2,
  email_compose: 1,
  brand_cv: 3,
} as const;

export function useCredits() {
  const { tenantId, user } = useAuth();
  const [balance, setBalance] = useState<number>(0);
  const [isLoading, setIsLoading] = useState(true);

  const fetchBalance = useCallback(async () => {
    if (!tenantId) return;

    try {
      const { data, error } = await supabase
        .from('credits')
        .select('balance')
        .eq('tenant_id', tenantId)
        .maybeSingle();

      if (error) throw error;
      setBalance(data?.balance || 0);
    } catch (error) {
      console.error('Error fetching credits:', error);
    } finally {
      setIsLoading(false);
    }
  }, [tenantId]);

  useEffect(() => {
    fetchBalance();
  }, [fetchBalance]);

  const checkSufficientCredits = async (requiredCredits: number): Promise<boolean> => {
    if (!tenantId) return false;

    try {
      const { data, error } = await supabase.rpc('has_sufficient_credits', {
        p_tenant_id: tenantId,
        p_required_credits: requiredCredits,
      });

      if (error) throw error;
      
      if (!data) {
        toast.error(`Insufficient credits. You need ${requiredCredits} credits but have ${balance}.`);
      }
      
      return data;
    } catch (error) {
      console.error('Error checking credits:', error);
      return false;
    }
  };

  const deductCredits = async (actionType: keyof typeof CREDIT_COSTS, metadata?: any): Promise<boolean> => {
    if (!tenantId || !user?.id) return false;

    const cost = CREDIT_COSTS[actionType];
    
    try {
      const { data, error } = await supabase.rpc('deduct_credits', {
        p_tenant_id: tenantId,
        p_user_id: user.id,
        p_action_type: actionType,
        p_cost: cost,
        p_metadata: metadata || {},
      });

      if (error) throw error;

      if (data) {
        await fetchBalance();
        return true;
      } else {
        toast.error(`Insufficient credits. This action requires ${cost} credits.`);
        return false;
      }
    } catch (error: any) {
      console.error('Error deducting credits:', error);
      toast.error(error.message || 'Failed to deduct credits');
      return false;
    }
  };

  return {
    balance,
    isLoading,
    checkSufficientCredits,
    deductCredits,
    refreshBalance: fetchBalance,
  };
}

export function useCreditTransactions() {
  const { tenantId } = useAuth();
  const [transactions, setTransactions] = useState<CreditTransaction[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchTransactions = useCallback(async () => {
    if (!tenantId) return;

    try {
      const { data, error } = await supabase
        .from('credit_transactions')
        .select('*')
        .eq('tenant_id', tenantId)
        .order('created_at', { ascending: false })
        .limit(100);

      if (error) throw error;
      setTransactions(data || []);
    } catch (error) {
      console.error('Error fetching transactions:', error);
      toast.error('Failed to load transaction history');
    } finally {
      setIsLoading(false);
    }
  }, [tenantId]);

  useEffect(() => {
    fetchTransactions();
  }, [fetchTransactions]);

  return {
    transactions,
    isLoading,
    refreshTransactions: fetchTransactions,
  };
}
