import { useState, useEffect } from 'react';
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
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isAdding, setIsAdding] = useState(false);

  useEffect(() => {
    if (open && tenantId) {
      fetchCandidates();
    }
  }, [open, tenantId]);

  const fetchCandidates = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('candidates')
        .select('id, full_name, email, current_title, avatar_url, skills')
        .eq('tenant_id', tenantId)
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

  const filteredCandidates = candidates.filter(c =>
    c.full_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    c.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
    c.current_title?.toLowerCase().includes(searchQuery.toLowerCase())
  );

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
      // Insert candidates to job_candidates table
      const insertData = selectedIds.map(candidateId => ({
        job_id: jobId,
        candidate_id: candidateId,
        tenant_id: tenantId,
        stage: 'applied' as const,
        applied_at: new Date().toISOString(),
      }));

      const { error } = await supabase
        .from('job_candidates')
        .insert(insertData);

      if (error) throw error;

      // Log activity
      await supabase.from('activities').insert({
        tenant_id: tenantId,
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
            Select candidates from your database to add to "{jobTitle}"
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search candidates..."
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
              <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
                <UserPlus className="h-8 w-8 mb-2" />
                <p className="text-sm">
                  {candidates.length === 0 
                    ? 'No candidates available to add'
                    : 'No candidates match your search'
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
                    />
                    <Avatar className="h-10 w-10">
                      <AvatarImage src={candidate.avatar_url || ''} alt={candidate.full_name} />
                      <AvatarFallback className="bg-accent/10 text-accent text-sm">
                        {candidate.full_name.split(' ').map(n => n[0]).join('').toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">{candidate.full_name}</p>
                      <p className="text-sm text-muted-foreground truncate">
                        {candidate.current_title || candidate.email}
                      </p>
                    </div>
                    {candidate.skills && candidate.skills.length > 0 && (
                      <div className="hidden sm:flex gap-1">
                        {candidate.skills.slice(0, 2).map((skill, i) => (
                          <Badge key={i} variant="secondary" className="text-xs">
                            {skill}
                          </Badge>
                        ))}
                        {candidate.skills.length > 2 && (
                          <Badge variant="secondary" className="text-xs">
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
