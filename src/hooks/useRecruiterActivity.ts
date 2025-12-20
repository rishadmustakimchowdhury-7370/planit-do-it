import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth';

export type ActivityType = 
  | 'cv_uploaded'
  | 'cv_submitted'
  | 'cv_deleted'
  | 'screening_completed'
  | 'interview_scheduled'
  | 'interview_completed'
  | 'offer_sent'
  | 'candidate_hired'
  | 'candidate_rejected'
  | 'job_activated'
  | 'job_closed'
  | 'job_assigned'
  | 'ai_match_run'
  | 'ai_cv_parse'
  | 'ai_email_compose'
  | 'ai_brand_cv';

interface LogActivityParams {
  action_type: ActivityType;
  candidate_id?: string;
  job_id?: string;
  client_id?: string;
  metadata?: Record<string, any>;
}

export function useRecruiterActivity() {
  const { user, tenantId } = useAuth();

  const logActivity = async (params: LogActivityParams) => {
    if (!user?.id || !tenantId) {
      console.warn('Cannot log activity: user or tenant not available');
      return null;
    }

    try {
      const { data, error } = await supabase
        .from('recruiter_activities')
        .insert({
          tenant_id: tenantId,
          user_id: user.id,
          action_type: params.action_type,
          candidate_id: params.candidate_id || null,
          job_id: params.job_id || null,
          client_id: params.client_id || null,
          metadata: params.metadata || {},
        })
        .select()
        .single();

      if (error) {
        console.error('Error logging recruiter activity:', error);
        return null;
      }

      return data;
    } catch (error) {
      console.error('Error logging recruiter activity:', error);
      return null;
    }
  };

  return { logActivity };
}

// Standalone function for use outside of React components
export async function logRecruiterActivity(
  tenantId: string,
  userId: string,
  params: Omit<LogActivityParams, 'tenant_id' | 'user_id'>
) {
  try {
    const { data, error } = await supabase
      .from('recruiter_activities')
      .insert({
        tenant_id: tenantId,
        user_id: userId,
        action_type: params.action_type,
        candidate_id: params.candidate_id || null,
        job_id: params.job_id || null,
        client_id: params.client_id || null,
        metadata: params.metadata || {},
      })
      .select()
      .single();

    if (error) {
      console.error('Error logging recruiter activity:', error);
      return null;
    }

    return data;
  } catch (error) {
    console.error('Error logging recruiter activity:', error);
    return null;
  }
}
