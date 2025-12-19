import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';

interface AssignJobDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  jobId: string;
  jobTitle: string;
  currentAssigneeId?: string | null;
  onAssignmentComplete: () => void;
}

interface Recruiter {
  id: string;
  full_name: string;
  email: string;
}

export function AssignJobDialog({
  open,
  onOpenChange,
  jobId,
  jobTitle,
  currentAssigneeId,
  onAssignmentComplete,
}: AssignJobDialogProps) {
  const { tenantId } = useAuth();
  const [recruiters, setRecruiters] = useState<Recruiter[]>([]);
  const [selectedRecruiterId, setSelectedRecruiterId] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);
  const [isFetching, setIsFetching] = useState(true);

  useEffect(() => {
    if (open && tenantId) {
      fetchRecruiters();
    }
  }, [open, tenantId]);

  useEffect(() => {
    if (currentAssigneeId) {
      setSelectedRecruiterId(currentAssigneeId);
    }
  }, [currentAssigneeId]);

  const fetchRecruiters = async () => {
    setIsFetching(true);
    try {
      // Fetch users with recruiter role
      const { data: recruiterRoles, error: rolesError } = await supabase
        .from('user_roles')
        .select('user_id')
        .eq('tenant_id', tenantId)
        .eq('role', 'recruiter');

      if (rolesError) throw rolesError;

      const recruiterIds = recruiterRoles.map(r => r.user_id);

      if (recruiterIds.length === 0) {
        setRecruiters([]);
        return;
      }

      // Fetch profiles for these users
      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('id, full_name, email')
        .in('id', recruiterIds)
        .eq('is_active', true);

      if (profilesError) throw profilesError;

      setRecruiters(profiles as Recruiter[] || []);
    } catch (error) {
      console.error('Error fetching recruiters:', error);
      toast.error('Failed to load recruiters');
    } finally {
      setIsFetching(false);
    }
  };

  const handleAssign = async () => {
    if (!selectedRecruiterId) {
      toast.error('Please select a recruiter');
      return;
    }

    setIsLoading(true);
    try {
      // Update job with assigned recruiter
      const { error: updateError } = await supabase
        .from('jobs')
        .update({ 
          assigned_to: selectedRecruiterId,
          updated_at: new Date().toISOString()
        })
        .eq('id', jobId);

      if (updateError) throw updateError;

      // Get recruiter details
      const recruiter = recruiters.find(r => r.id === selectedRecruiterId);
      if (!recruiter) throw new Error('Recruiter not found');

      // Send notification email via edge function
      const { error: emailError } = await supabase.functions.invoke('send-job-assignment', {
        body: {
          job_id: jobId,
          job_title: jobTitle,
          recruiter_email: recruiter.email,
          recruiter_name: recruiter.full_name,
        }
      });

      if (emailError) {
        console.error('Email error:', emailError);
        toast.warning('Job assigned, but notification email failed to send');
      } else {
        toast.success(`Job assigned to ${recruiter.full_name} and notification sent`);
      }

      // Log activity
      await supabase.from('activities').insert({
        tenant_id: tenantId,
        action: 'job_assigned',
        entity_type: 'job',
        entity_id: jobId,
        entity_name: jobTitle,
        metadata: { assigned_to: selectedRecruiterId, assigned_to_name: recruiter.full_name }
      });

      onAssignmentComplete();
      onOpenChange(false);
    } catch (error: any) {
      console.error('Error assigning job:', error);
      toast.error(error.message || 'Failed to assign job');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Assign Job to Recruiter</DialogTitle>
          <DialogDescription>
            Assign "{jobTitle}" to a recruiter. They will receive an email notification.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="recruiter">Select Recruiter</Label>
            {isFetching ? (
              <div className="flex items-center justify-center py-4">
                <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
              </div>
            ) : recruiters.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4">No recruiters found in your team</p>
            ) : (
              <Select value={selectedRecruiterId} onValueChange={setSelectedRecruiterId}>
                <SelectTrigger id="recruiter">
                  <SelectValue placeholder="Choose a recruiter" />
                </SelectTrigger>
                <SelectContent>
                  {recruiters.map((recruiter) => (
                    <SelectItem key={recruiter.id} value={recruiter.id}>
                      {recruiter.full_name} ({recruiter.email})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>
        </div>

        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isLoading}>
            Cancel
          </Button>
          <Button 
            onClick={handleAssign} 
            disabled={isLoading || !selectedRecruiterId || recruiters.length === 0}
          >
            {isLoading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            Assign Job
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
