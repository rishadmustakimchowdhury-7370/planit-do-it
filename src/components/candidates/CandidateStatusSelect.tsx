import { useState } from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface CandidateStatusSelectProps {
  candidateId: string;
  jobCandidateId?: string;
  currentStatus: string;
  onStatusChange?: (newStatus: string) => void;
  isJobCandidate?: boolean;
  compact?: boolean;
}

const candidateStatuses = [
  { value: 'new', label: 'New', color: 'bg-muted text-muted-foreground' },
  { value: 'screening', label: 'Screening', color: 'bg-info/10 text-info border-info/30' },
  { value: 'interviewing', label: 'Interviewing', color: 'bg-accent/10 text-accent border-accent/30' },
  { value: 'offered', label: 'Offered', color: 'bg-warning/10 text-warning border-warning/30' },
  { value: 'hired', label: 'Hired', color: 'bg-success/20 text-success border-success/40' },
  { value: 'rejected', label: 'Rejected', color: 'bg-destructive/10 text-destructive border-destructive/30' },
  { value: 'withdrawn', label: 'Withdrawn', color: 'bg-muted text-muted-foreground' },
];

const pipelineStages = [
  { value: 'applied', label: 'Applied', color: 'bg-muted text-muted-foreground' },
  { value: 'screening', label: 'Screening', color: 'bg-info/10 text-info border-info/30' },
  { value: 'interview', label: 'Interview', color: 'bg-accent/10 text-accent border-accent/30' },
  { value: 'technical', label: 'Technical', color: 'bg-warning/10 text-warning border-warning/30' },
  { value: 'offer', label: 'Offer', color: 'bg-success/10 text-success border-success/30' },
  { value: 'hired', label: 'Hired', color: 'bg-success/20 text-success border-success/40' },
  { value: 'rejected', label: 'Rejected', color: 'bg-destructive/10 text-destructive border-destructive/30' },
];

export function CandidateStatusSelect({
  candidateId,
  jobCandidateId,
  currentStatus,
  onStatusChange,
  isJobCandidate = false,
  compact = false,
}: CandidateStatusSelectProps) {
  const { tenantId, user } = useAuth();
  const [isUpdating, setIsUpdating] = useState(false);
  const [status, setStatus] = useState(currentStatus);

  const statuses = isJobCandidate ? pipelineStages : candidateStatuses;
  const currentStatusInfo = statuses.find(s => s.value === status) || statuses[0];

  const handleChange = async (newStatus: string) => {
    if (newStatus === status) return;
    
    setIsUpdating(true);
    try {
      if (isJobCandidate && jobCandidateId) {
        // Update job_candidates table
        const { error } = await supabase
          .from('job_candidates')
          .update({ 
            stage: newStatus as any,
            stage_updated_at: new Date().toISOString()
          })
          .eq('id', jobCandidateId);

        if (error) throw error;
      } else {
        // Update candidates table
        const { error } = await supabase
          .from('candidates')
          .update({ 
            status: newStatus as any,
            updated_at: new Date().toISOString()
          })
          .eq('id', candidateId);

        if (error) throw error;
      }

      // Log activity
      await supabase.from('activities').insert({
        tenant_id: tenantId,
        user_id: user?.id,
        action: `Changed status from "${status}" to "${newStatus}"`,
        entity_type: 'candidate',
        entity_id: candidateId,
        entity_name: 'Candidate',
        metadata: { old_status: status, new_status: newStatus }
      });

      setStatus(newStatus);
      onStatusChange?.(newStatus);
      toast.success(`Status updated to ${newStatus}`);
    } catch (error: any) {
      console.error('Error updating status:', error);
      toast.error(error.message || 'Failed to update status');
    } finally {
      setIsUpdating(false);
    }
  };

  if (compact) {
    return (
      <Select value={status} onValueChange={handleChange} disabled={isUpdating}>
        <SelectTrigger className="h-7 w-28 text-xs">
          {isUpdating ? (
            <Loader2 className="h-3 w-3 animate-spin" />
          ) : (
            <SelectValue />
          )}
        </SelectTrigger>
        <SelectContent>
          {statuses.map((s) => (
            <SelectItem key={s.value} value={s.value} className="text-xs">
              {s.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    );
  }

  return (
    <Select value={status} onValueChange={handleChange} disabled={isUpdating}>
      <SelectTrigger className="w-36">
        {isUpdating ? (
          <div className="flex items-center gap-2">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span>Updating...</span>
          </div>
        ) : (
          <Badge variant="outline" className={cn('capitalize', currentStatusInfo.color)}>
            {currentStatusInfo.label}
          </Badge>
        )}
      </SelectTrigger>
      <SelectContent>
        {statuses.map((s) => (
          <SelectItem key={s.value} value={s.value}>
            <Badge variant="outline" className={cn('capitalize', s.color)}>
              {s.label}
            </Badge>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
