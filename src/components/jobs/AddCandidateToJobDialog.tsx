import { useState, useEffect, useMemo } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Search, UserPlus, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth';
import { toast } from 'sonner';
import { useRecruiterActivity } from '@/hooks/useRecruiterActivity';

interface Candidate {
  id: string;
  full_name: string;
  email: string;
  current_title: string | null;
  avatar_url: string | null;
  skills: string[] | null;
}

interface AddCandidateToJobDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  jobId: string;
  jobTitle: string;
  existingCandidateIds: string[];
  onSuccess: () => void;
}

export function AddCandidateToJobDialog({
  open,
  onOpenChange,
  jobId,
  jobTitle,
  existingCandidateIds,
  onSuccess
}: AddCandidateToJobDialogProps) {
  const { tenantId, user } = useAuth();
  const { logActivity } = useRecruiterActivity();
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isAdding, setIsAdding] = useState(false);

  useEffect(() => {
    if (open) {
      fetchCandidates();
      setSearchQuery('');
      setSelectedIds([]);
    }
  }, [open]);

  const fetchCandidates = async () => {
    setIsLoading(true);
    try {
      // Get user's tenant_id from profile if not available
      let currentTenantId = tenantId;
      if (!currentTenantId && user) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('tenant_id')
          .eq('id', user.id)
          .maybeSingle();
        currentTenantId = profile?.tenant_id || null;
      }

      if (!currentTenantId) {
        console.error('No tenant ID available');
        setCandidates([]);
        return;
      }

      const { data, error } = await supabase
        .from('candidates')
        .select('id, full_name, email, current_title, avatar_url, skills')
        .eq('tenant_id', currentTenantId)
        .order('full_name');

      if (error) throw error;

      // Filter out already added candidates
      const availableCandidates = (data || []).filter(
        c => !existingCandidateIds.includes(c.id)
      ).map(c => ({
        ...c,
        skills: Array.isArray(c.skills) ? c.skills as string[] : null
      }));

      setCandidates(availableCandidates);
    } catch (error) {
      console.error('Error fetching candidates:', error);
      toast.error('Failed to load candidates');
    } finally {
      setIsLoading(false);
    }
  };

  // Use useMemo for filtered candidates with case-insensitive search
  const filteredCandidates = useMemo(() => {
    const query = searchQuery.toLowerCase().trim();
    if (!query) return candidates;
    
    return candidates.filter(c =>
      c.full_name.toLowerCase().includes(query) ||
      c.email.toLowerCase().includes(query) ||
      (c.current_title && c.current_title.toLowerCase().includes(query))
    );
  }, [candidates, searchQuery]);

  const toggleCandidate = (id: string) => {
    setSelectedIds(prev =>
      prev.includes(id)
        ? prev.filter(cid => cid !== id)
        : [...prev, id]
    );
  };

  const handleAdd = async () => {
    if (selectedIds.length === 0) {
      toast.error('Please select at least one candidate');
      return;
    }

    setIsAdding(true);
    try {
      // Get tenant ID
      let currentTenantId = tenantId;
      if (!currentTenantId && user) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('tenant_id')
          .eq('id', user.id)
          .maybeSingle();
        currentTenantId = profile?.tenant_id || null;
      }

      if (!currentTenantId) {
        toast.error('Unable to determine tenant');
        return;
      }

      // Insert candidates to job_candidates table
      const insertData = selectedIds.map(candidateId => ({
        job_id: jobId,
        candidate_id: candidateId,
        tenant_id: currentTenantId,
        stage: 'applied' as const,
        applied_at: new Date().toISOString(),
      }));

      const { error } = await supabase
        .from('job_candidates')
        .insert(insertData);

      if (error) throw error;

      // Log CV submissions for tracking
      const submissionData = selectedIds.map(candidateId => ({
        tenant_id: currentTenantId,
        candidate_id: candidateId,
        job_id: jobId,
        submitted_by: user?.id || '',
        submitted_at: new Date().toISOString(),
        metadata: { source: 'add_candidate_dialog' }
      }));

      await supabase.from('cv_submissions').insert(submissionData);

      // Log recruiter activity for KPI tracking (one for each candidate)
      for (const candidateId of selectedIds) {
        await logActivity({
          action_type: 'cv_submitted',
          candidate_id: candidateId,
          job_id: jobId,
          metadata: { job_title: jobTitle }
        });
      }

      // Log activity
      await supabase.from('activities').insert({
        tenant_id: currentTenantId,
        user_id: user?.id,
        action: `Added ${selectedIds.length} candidate(s) to job`,
        entity_type: 'job',
        entity_id: jobId,
        entity_name: jobTitle,
        metadata: { candidate_ids: selectedIds }
      });

      toast.success(`${selectedIds.length} candidate(s) added to job`);
      setSelectedIds([]);
      onOpenChange(false);
      onSuccess();
    } catch (error: any) {
      console.error('Error adding candidates:', error);
      if (error.code === '23505') {
        toast.error('Some candidates are already added to this job');
      } else {
        toast.error(error.message || 'Failed to add candidates');
      }
    } finally {
      setIsAdding(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserPlus className="h-5 w-5" />
            Add Candidates to Job
          </DialogTitle>
          <DialogDescription>
            Select candidates from your CRM to add to "{jobTitle}"
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by name, email, or title..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>

          <ScrollArea className="h-72 border rounded-lg">
            {isLoading ? (
              <div className="flex items-center justify-center h-full">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : filteredCandidates.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-muted-foreground p-4">
                <UserPlus className="h-8 w-8 mb-2" />
                <p className="text-sm text-center">
                  {candidates.length === 0 
                    ? 'No candidates available to add. Add candidates first.'
                    : `No candidates match "${searchQuery}"`
                  }
                </p>
              </div>
            ) : (
              <div className="p-2 space-y-1">
                {filteredCandidates.map((candidate) => (
                  <div
                    key={candidate.id}
                    className={`flex items-center gap-3 p-3 rounded-lg cursor-pointer transition-colors ${
                      selectedIds.includes(candidate.id)
                        ? 'bg-accent/10 border border-accent/30'
                        : 'hover:bg-muted/50 border border-transparent'
                    }`}
                    onClick={() => toggleCandidate(candidate.id)}
                  >
                    <Checkbox
                      checked={selectedIds.includes(candidate.id)}
                      onCheckedChange={() => toggleCandidate(candidate.id)}
                      className="shrink-0"
                    />
                    <Avatar className="h-10 w-10 shrink-0">
                      <AvatarImage src={candidate.avatar_url || ''} alt={candidate.full_name} />
                      <AvatarFallback className="bg-accent/10 text-accent text-sm">
                        {candidate.full_name.split(' ').map(n => n[0]).join('').toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0 overflow-hidden">
                      <p className="font-medium truncate">{candidate.full_name}</p>
                      <p className="text-sm text-muted-foreground truncate">
                        {candidate.current_title || candidate.email}
                      </p>
                    </div>
                    {candidate.skills && candidate.skills.length > 0 && (
                      <div className="hidden sm:flex gap-1 shrink-0">
                        {candidate.skills.slice(0, 2).map((skill, i) => (
                          <Badge key={i} variant="secondary" className="text-xs whitespace-nowrap">
                            {skill}
                          </Badge>
                        ))}
                        {candidate.skills.length > 2 && (
                          <Badge variant="secondary" className="text-xs whitespace-nowrap">
                            +{candidate.skills.length - 2}
                          </Badge>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>

          {selectedIds.length > 0 && (
            <p className="text-sm text-muted-foreground">
              {selectedIds.length} candidate(s) selected
            </p>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleAdd} disabled={isAdding || selectedIds.length === 0}>
            {isAdding ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Adding...
              </>
            ) : (
              <>
                <UserPlus className="h-4 w-4 mr-2" />
                Add {selectedIds.length > 0 ? `(${selectedIds.length})` : ''}
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
