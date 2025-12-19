import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth';
import { toast } from 'sonner';

export type WorkAction = 'start_work' | 'start_break' | 'resume_work' | 'end_work';
export type WorkStatus = 'working' | 'on_break' | 'ended';

interface WorkSession {
  id: string;
  user_id: string;
  date: string;
  started_at: string | null;
  ended_at: string | null;
  total_work_minutes: number;
  total_break_minutes: number;
  status: WorkStatus;
}

interface WorkStatusLog {
  id: string;
  user_id: string;
  action: WorkAction;
  timestamp: string;
}

interface TeamMemberStatus {
  user_id: string;
  full_name: string;
  email: string;
  avatar_url: string | null;
  status: WorkStatus;
  started_at: string | null;
  today_work_minutes: number;
  today_break_minutes: number;
}

export function useWorkTracking() {
  const { user, tenantId } = useAuth();
  const [currentStatus, setCurrentStatus] = useState<WorkStatus>('ended');
  const [todaySession, setTodaySession] = useState<WorkSession | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isActionLoading, setIsActionLoading] = useState(false);

  // Fetch today's session status
  const fetchTodaySession = useCallback(async () => {
    if (!user?.id || !tenantId) return;

    try {
      const today = new Date().toISOString().split('T')[0];
      
      const { data, error } = await supabase
        .from('work_sessions')
        .select('*')
        .eq('user_id', user.id)
        .eq('date', today)
        .maybeSingle();

      if (error) throw error;

      if (data) {
        setTodaySession(data as WorkSession);
        setCurrentStatus(data.status as WorkStatus);
      } else {
        setTodaySession(null);
        setCurrentStatus('ended');
      }
    } catch (error) {
      console.error('Error fetching today session:', error);
    } finally {
      setIsLoading(false);
    }
  }, [user?.id, tenantId]);

  useEffect(() => {
    fetchTodaySession();
  }, [fetchTodaySession]);

  // Log a work status action
  const logAction = async (action: WorkAction) => {
    if (!user?.id || !tenantId) {
      toast.error('User not authenticated');
      return false;
    }

    setIsActionLoading(true);

    try {
      const now = new Date();
      const today = now.toISOString().split('T')[0];

      // Validate action based on current status
      const validTransitions: Record<WorkStatus, WorkAction[]> = {
        'ended': ['start_work'],
        'working': ['start_break', 'end_work'],
        'on_break': ['resume_work', 'end_work'],
      };

      if (!validTransitions[currentStatus].includes(action)) {
        toast.error(`Cannot ${action.replace('_', ' ')} while status is "${currentStatus}"`);
        return false;
      }

      // Insert log entry (immutable)
      const { error: logError } = await supabase
        .from('work_status_logs')
        .insert({
          tenant_id: tenantId,
          user_id: user.id,
          action: action,
          timestamp: now.toISOString(),
        });

      if (logError) throw logError;

      // Calculate new status
      const newStatus: WorkStatus = 
        action === 'start_work' ? 'working' :
        action === 'start_break' ? 'on_break' :
        action === 'resume_work' ? 'working' : 'ended';

      // Update or create session
      let sessionData: Record<string, any> = {
        tenant_id: tenantId,
        user_id: user.id,
        date: today,
        status: newStatus,
      };

      if (action === 'start_work') {
        sessionData.started_at = now.toISOString();
      } else if (action === 'end_work') {
        sessionData.ended_at = now.toISOString();
        
        // Calculate total minutes if we have a session
        if (todaySession) {
          const logs = await fetchTodayLogs();
          const { workMinutes, breakMinutes } = calculateMinutesFromLogs(logs);
          sessionData.total_work_minutes = workMinutes;
          sessionData.total_break_minutes = breakMinutes;
        }
      }

      // Upsert session
      const { error: sessionError } = await supabase
        .from('work_sessions')
        .upsert(
          {
            ...sessionData,
            updated_at: now.toISOString(),
          } as any,
          {
            onConflict: 'user_id,date',
          }
        );

      if (sessionError) throw sessionError;

      setCurrentStatus(newStatus);
      await fetchTodaySession();

      // Send email notification to admins
      if (tenantId && user?.email) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('full_name')
          .eq('id', user.id)
          .single();

        // Fire and forget - don't block on email sending
        supabase.functions.invoke('notify-work-activity', {
          body: {
            user_id: user.id,
            user_name: profile?.full_name || '',
            user_email: user.email,
            action: action,
            tenant_id: tenantId,
          }
        }).catch(err => console.error('Email notification error:', err));
      }

      const actionMessages: Record<WorkAction, string> = {
        'start_work': 'Work session started',
        'start_break': 'Break started',
        'resume_work': 'Resumed working',
        'end_work': 'Work session ended',
      };

      toast.success(actionMessages[action]);
      return true;
    } catch (error: any) {
      console.error('Error logging action:', error);
      toast.error(error.message || 'Failed to update status');
      return false;
    } finally {
      setIsActionLoading(false);
    }
  };

  // Fetch today's logs for a user
  const fetchTodayLogs = async (): Promise<WorkStatusLog[]> => {
    if (!user?.id || !tenantId) return [];

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const { data, error } = await supabase
      .from('work_status_logs')
      .select('*')
      .eq('user_id', user.id)
      .gte('timestamp', today.toISOString())
      .lt('timestamp', tomorrow.toISOString())
      .order('timestamp', { ascending: true });

    if (error) {
      console.error('Error fetching logs:', error);
      return [];
    }

    return data as WorkStatusLog[];
  };

  // Calculate work and break minutes from logs
  const calculateMinutesFromLogs = (logs: WorkStatusLog[]): { workMinutes: number; breakMinutes: number } => {
    let workMinutes = 0;
    let breakMinutes = 0;
    let lastWorkStart: Date | null = null;
    let lastBreakStart: Date | null = null;

    for (const log of logs) {
      const timestamp = new Date(log.timestamp);

      switch (log.action) {
        case 'start_work':
          lastWorkStart = timestamp;
          break;
        case 'start_break':
          if (lastWorkStart) {
            workMinutes += Math.floor((timestamp.getTime() - lastWorkStart.getTime()) / 60000);
            lastWorkStart = null;
          }
          lastBreakStart = timestamp;
          break;
        case 'resume_work':
          if (lastBreakStart) {
            breakMinutes += Math.floor((timestamp.getTime() - lastBreakStart.getTime()) / 60000);
            lastBreakStart = null;
          }
          lastWorkStart = timestamp;
          break;
        case 'end_work':
          if (lastWorkStart) {
            workMinutes += Math.floor((timestamp.getTime() - lastWorkStart.getTime()) / 60000);
            lastWorkStart = null;
          }
          if (lastBreakStart) {
            breakMinutes += Math.floor((timestamp.getTime() - lastBreakStart.getTime()) / 60000);
            lastBreakStart = null;
          }
          break;
      }
    }

    // If still working/on break, calculate up to now
    const now = new Date();
    if (lastWorkStart) {
      workMinutes += Math.floor((now.getTime() - lastWorkStart.getTime()) / 60000);
    }
    if (lastBreakStart) {
      breakMinutes += Math.floor((now.getTime() - lastBreakStart.getTime()) / 60000);
    }

    return { workMinutes, breakMinutes };
  };

  // Get available actions based on current status
  const getAvailableActions = (): WorkAction[] => {
    switch (currentStatus) {
      case 'ended':
        return ['start_work'];
      case 'working':
        return ['start_break', 'end_work'];
      case 'on_break':
        return ['resume_work', 'end_work'];
      default:
        return [];
    }
  };

  return {
    currentStatus,
    todaySession,
    isLoading,
    isActionLoading,
    logAction,
    getAvailableActions,
    fetchTodaySession,
    fetchTodayLogs,
    calculateMinutesFromLogs,
  };
}

// Hook for team leader dashboard
export function useTeamWorkStatus() {
  const { user, tenantId } = useAuth();
  const [teamStatus, setTeamStatus] = useState<TeamMemberStatus[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchTeamStatus = useCallback(async () => {
    if (!tenantId) return;

    try {
      const today = new Date().toISOString().split('T')[0];

      // Fetch all team members
      const { data: rolesData, error: rolesError } = await supabase
        .from('user_roles')
        .select('user_id')
        .eq('tenant_id', tenantId);

      if (rolesError) throw rolesError;

      const userIds = rolesData?.map(r => r.user_id) || [];

      // Fetch profiles
      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('id, full_name, email, avatar_url')
        .in('id', userIds);

      if (profilesError) throw profilesError;

      // Fetch today's sessions
      const { data: sessions, error: sessionsError } = await supabase
        .from('work_sessions')
        .select('*')
        .eq('date', today)
        .in('user_id', userIds);

      if (sessionsError) throw sessionsError;

      // Combine data
      const teamData: TeamMemberStatus[] = (profiles || []).map(profile => {
        const session = sessions?.find(s => s.user_id === profile.id);
        return {
          user_id: profile.id,
          full_name: profile.full_name || 'Unknown',
          email: profile.email,
          avatar_url: profile.avatar_url,
          status: (session?.status as WorkStatus) || 'ended',
          started_at: session?.started_at || null,
          today_work_minutes: session?.total_work_minutes || 0,
          today_break_minutes: session?.total_break_minutes || 0,
        };
      });

      setTeamStatus(teamData);
    } catch (error) {
      console.error('Error fetching team status:', error);
    } finally {
      setIsLoading(false);
    }
  }, [tenantId]);

  useEffect(() => {
    fetchTeamStatus();
    
    // Refresh every 30 seconds
    const interval = setInterval(fetchTeamStatus, 30000);
    return () => clearInterval(interval);
  }, [fetchTeamStatus]);

  return {
    teamStatus,
    isLoading,
    refetch: fetchTeamStatus,
  };
}

// Fetch work sessions for a date range
export async function fetchWorkSessions(
  tenantId: string,
  startDate: Date,
  endDate: Date,
  userId?: string
) {
  let query = supabase
    .from('work_sessions')
    .select('*')
    .eq('tenant_id', tenantId)
    .gte('date', startDate.toISOString().split('T')[0])
    .lte('date', endDate.toISOString().split('T')[0])
    .order('date', { ascending: false });

  if (userId) {
    query = query.eq('user_id', userId);
  }

  const { data: sessions, error } = await query;
  
  if (error) throw error;
  
  // Fetch profiles separately
  const userIds = [...new Set(sessions?.map(s => s.user_id) || [])];
  const { data: profiles } = await supabase
    .from('profiles')
    .select('id, full_name, email, avatar_url')
    .in('id', userIds);
  
  // Combine data
  const data = sessions?.map(session => ({
    ...session,
    profiles: profiles?.find(p => p.id === session.user_id) || null,
  }));
  
  if (error) throw error;
  return data;
}

// Format minutes to hours:minutes
export function formatDuration(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return `${hours}h ${mins}m`;
}
