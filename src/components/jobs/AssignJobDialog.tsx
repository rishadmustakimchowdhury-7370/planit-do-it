import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth';
import { toast } from 'sonner';
import { Loader2, Users, X } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';

interface AssignJobDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  jobId: string;
  jobTitle: string;
  currentAssigneeIds?: string[];
  onAssignmentComplete: () => void;
}

interface TeamMember {
  id: string;
  full_name: string;
  email: string;
  avatar_url: string | null;
  role: string;
}

export function AssignJobDialog({
  open,
  onOpenChange,
  jobId,
  jobTitle,
  currentAssigneeIds = [],
  onAssignmentComplete,
}: AssignJobDialogProps) {
  const { tenantId, user } = useAuth();
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isFetching, setIsFetching] = useState(true);

  useEffect(() => {
    if (open && tenantId) {
      fetchTeamMembers();
    }
  }, [open, tenantId]);

  useEffect(() => {
    setSelectedIds(currentAssigneeIds);
  }, [currentAssigneeIds]);

  const fetchTeamMembers = async () => {
    setIsFetching(true);
    try {
      // Fetch all users with recruiter or manager role
      const { data: userRoles, error: rolesError } = await supabase
        .from('user_roles')
        .select('user_id, role')
        .eq('tenant_id', tenantId)
        .in('role', ['recruiter', 'manager']);

      if (rolesError) throw rolesError;

      const userIds = userRoles.map(r => r.user_id);

      if (userIds.length === 0) {
        setTeamMembers([]);
        return;
      }

      // Fetch profiles for these users
      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('id, full_name, email, avatar_url')
        .in('id', userIds)
        .eq('is_active', true);

      if (profilesError) throw profilesError;

      // Combine with roles
      const members = (profiles || []).map(profile => {
        const roleEntry = userRoles.find(r => r.user_id === profile.id);
        return {
          ...profile,
          role: roleEntry?.role || 'recruiter',
        };
      });

      setTeamMembers(members);
    } catch (error) {
      console.error('Error fetching team members:', error);
      toast.error('Failed to load team members');
    } finally {
      setIsFetching(false);
    }
  };

  const toggleMember = (memberId: string) => {
    setSelectedIds(prev => 
      prev.includes(memberId) 
        ? prev.filter(id => id !== memberId)
        : [...prev, memberId]
    );
  };

  const handleSave = async () => {
    setIsLoading(true);
    try {
      // Get current assignees from database
      const { data: currentAssignees, error: fetchError } = await supabase
        .from('job_assignees')
        .select('user_id')
        .eq('job_id', jobId);

      if (fetchError) throw fetchError;

      const currentIds = (currentAssignees || []).map(a => a.user_id);
      
      // Determine adds and removes
      const toAdd = selectedIds.filter(id => !currentIds.includes(id));
      const toRemove = currentIds.filter(id => !selectedIds.includes(id));

      // Remove unselected
      if (toRemove.length > 0) {
        const { error: deleteError } = await supabase
          .from('job_assignees')
          .delete()
          .eq('job_id', jobId)
          .in('user_id', toRemove);

        if (deleteError) throw deleteError;
      }

      // Add newly selected
      if (toAdd.length > 0) {
        const insertData = toAdd.map(userId => ({
          job_id: jobId,
          user_id: userId,
          tenant_id: tenantId,
          assigned_by: user?.id,
        }));

        const { error: insertError } = await supabase
          .from('job_assignees')
          .insert(insertData);

        if (insertError) throw insertError;

        // Send notification emails to newly assigned members
        for (const userId of toAdd) {
          const member = teamMembers.find(m => m.id === userId);
          if (member) {
            try {
              await supabase.functions.invoke('send-job-assignment', {
                body: {
                  job_id: jobId,
                  job_title: jobTitle,
                  recruiter_email: member.email,
                  recruiter_name: member.full_name,
                }
              });
            } catch (emailError) {
              console.error('Email sending failed:', emailError);
            }
          }
        }
      }

      // Also update the legacy assigned_to field (for backward compatibility)
      const primaryAssignee = selectedIds.length > 0 ? selectedIds[0] : null;
      await supabase
        .from('jobs')
        .update({ 
          assigned_to: primaryAssignee,
          updated_at: new Date().toISOString()
        })
        .eq('id', jobId);

      // Log activity
      const assignedNames = teamMembers
        .filter(m => selectedIds.includes(m.id))
        .map(m => m.full_name);

      await supabase.from('activities').insert({
        tenant_id: tenantId,
        action: selectedIds.length > 0 ? 'job_assigned' : 'job_unassigned',
        entity_type: 'job',
        entity_id: jobId,
        entity_name: jobTitle,
        metadata: { 
          assigned_to: selectedIds, 
          assigned_to_names: assignedNames,
          added: toAdd,
          removed: toRemove,
        }
      });

      if (selectedIds.length === 0) {
        toast.success('All assignees removed from job');
      } else if (toAdd.length > 0 && toRemove.length > 0) {
        toast.success(`Job assignments updated`);
      } else if (toAdd.length > 0) {
        toast.success(`${toAdd.length} team member(s) assigned`);
      } else if (toRemove.length > 0) {
        toast.success(`${toRemove.length} team member(s) unassigned`);
      } else {
        toast.info('No changes made');
      }

      onAssignmentComplete();
      onOpenChange(false);
    } catch (error: any) {
      console.error('Error updating job assignments:', error);
      toast.error(error.message || 'Failed to update assignments');
    } finally {
      setIsLoading(false);
    }
  };

  const handleUnassignAll = async () => {
    setIsLoading(true);
    try {
      // Remove all assignees
      const { error: deleteError } = await supabase
        .from('job_assignees')
        .delete()
        .eq('job_id', jobId);

      if (deleteError) throw deleteError;

      // Clear legacy field
      await supabase
        .from('jobs')
        .update({ 
          assigned_to: null,
          updated_at: new Date().toISOString()
        })
        .eq('id', jobId);

      // Log activity
      await supabase.from('activities').insert({
        tenant_id: tenantId,
        action: 'job_unassigned',
        entity_type: 'job',
        entity_id: jobId,
        entity_name: jobTitle,
        metadata: { previously_assigned_to: currentAssigneeIds }
      });

      toast.success('All assignees removed from job');
      onAssignmentComplete();
      onOpenChange(false);
    } catch (error: any) {
      console.error('Error unassigning job:', error);
      toast.error(error.message || 'Failed to unassign job');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Assign Team Members
          </DialogTitle>
          <DialogDescription>
            Select team members to assign to "{jobTitle}". They will receive email notifications.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Selected Members Preview */}
          {selectedIds.length > 0 && (
            <div className="space-y-2">
              <Label className="text-sm font-medium">Selected ({selectedIds.length})</Label>
              <div className="flex flex-wrap gap-2">
                {selectedIds.map(id => {
                  const member = teamMembers.find(m => m.id === id);
                  if (!member) return null;
                  return (
                    <Badge 
                      key={id} 
                      variant="secondary" 
                      className="flex items-center gap-1 pr-1"
                    >
                      {member.full_name}
                      <button
                        type="button"
                        onClick={() => toggleMember(id)}
                        className="ml-1 hover:bg-muted rounded-full p-0.5"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </Badge>
                  );
                })}
              </div>
            </div>
          )}

          {/* Team Members List */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">Team Members</Label>
            {isFetching ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
              </div>
            ) : teamMembers.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">
                No team members found. Add recruiters or managers to your team first.
              </p>
            ) : (
              <ScrollArea className="h-[280px] rounded-md border p-2">
                <div className="space-y-1">
                  {teamMembers.map((member) => (
                    <div
                      key={member.id}
                      className={`flex items-center gap-3 p-2 rounded-lg cursor-pointer transition-colors ${
                        selectedIds.includes(member.id) 
                          ? 'bg-primary/10 border border-primary/20' 
                          : 'hover:bg-muted'
                      }`}
                      onClick={() => toggleMember(member.id)}
                    >
                      <Checkbox 
                        checked={selectedIds.includes(member.id)}
                        onCheckedChange={() => toggleMember(member.id)}
                      />
                      <Avatar className="h-9 w-9">
                        <AvatarImage src={member.avatar_url || undefined} />
                        <AvatarFallback className="text-xs">
                          {member.full_name.substring(0, 2).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm truncate">{member.full_name}</p>
                        <p className="text-xs text-muted-foreground truncate">{member.email}</p>
                      </div>
                      <Badge variant="outline" className="text-xs capitalize">
                        {member.role}
                      </Badge>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            )}
          </div>
        </div>

        <div className="flex justify-between gap-2">
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isLoading}>
              Cancel
            </Button>
            {currentAssigneeIds.length > 0 && (
              <Button 
                variant="destructive" 
                onClick={handleUnassignAll} 
                disabled={isLoading}
              >
                {isLoading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                Unassign All
              </Button>
            )}
          </div>
          <Button 
            onClick={handleSave} 
            disabled={isLoading || teamMembers.length === 0}
          >
            {isLoading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            Save Assignments
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}