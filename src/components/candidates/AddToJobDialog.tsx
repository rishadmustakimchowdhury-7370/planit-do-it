import { useState, useEffect, useMemo } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Search, Briefcase, Loader2, MapPin, Users } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth';
import { toast } from 'sonner';

interface Job {
  id: string;
  title: string;
  status: string;
  location: string | null;
  clients?: { name: string } | null;
}

interface AddToJobDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  candidateId: string;
  candidateName: string;
  onSuccess?: () => void;
}

export function AddToJobDialog({
  open,
  onOpenChange,
  candidateId,
  candidateName,
  onSuccess
}: AddToJobDialogProps) {
  const { tenantId, user } = useAuth();
  const [jobs, setJobs] = useState<Job[]>([]);
  const [existingJobIds, setExistingJobIds] = useState<string[]>([]);
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isAdding, setIsAdding] = useState(false);

  useEffect(() => {
    if (open && tenantId) {
      fetchData();
      setSearchQuery('');
      setSelectedJobId(null);
    }
  }, [open, tenantId]);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      // Fetch all open jobs
      const { data: jobsData, error: jobsError } = await supabase
        .from('jobs')
        .select('id, title, status, location, clients(name)')
        .eq('tenant_id', tenantId)
        .in('status', ['open', 'draft'])
        .order('created_at', { ascending: false });

      if (jobsError) throw jobsError;

      // Fetch jobs candidate is already in
      const { data: existingData, error: existingError } = await supabase
        .from('job_candidates')
        .select('job_id')
        .eq('candidate_id', candidateId)
        .eq('tenant_id', tenantId);

      if (existingError) throw existingError;

      setJobs(jobsData || []);
      setExistingJobIds((existingData || []).map(e => e.job_id));
    } catch (error) {
      console.error('Error fetching jobs:', error);
      toast.error('Failed to load jobs');
    } finally {
      setIsLoading(false);
    }
  };

  const availableJobs = useMemo(() => {
    return jobs.filter(j => !existingJobIds.includes(j.id));
  }, [jobs, existingJobIds]);

  const filteredJobs = useMemo(() => {
    const query = searchQuery.toLowerCase().trim();
    if (!query) return availableJobs;
    
    return availableJobs.filter(j =>
      j.title.toLowerCase().includes(query) ||
      j.clients?.name?.toLowerCase().includes(query) ||
      j.location?.toLowerCase().includes(query)
    );
  }, [availableJobs, searchQuery]);

  const handleAdd = async () => {
    if (!selectedJobId) {
      toast.error('Please select a job');
      return;
    }

    setIsAdding(true);
    try {
      const selectedJob = jobs.find(j => j.id === selectedJobId);

      // Insert into job_candidates
      const { error } = await supabase
        .from('job_candidates')
        .insert({
          job_id: selectedJobId,
          candidate_id: candidateId,
          tenant_id: tenantId,
          stage: 'applied',
          applied_at: new Date().toISOString(),
        });

      if (error) throw error;

      // Log CV submission
      await supabase.from('cv_submissions').insert({
        tenant_id: tenantId,
        candidate_id: candidateId,
        job_id: selectedJobId,
        submitted_by: user?.id || '',
        submitted_at: new Date().toISOString(),
        metadata: { source: 'candidate_detail_page' }
      });

      // Log activity
      await supabase.from('activities').insert({
        tenant_id: tenantId,
        user_id: user?.id,
        action: `Added candidate to job`,
        entity_type: 'candidate',
        entity_id: candidateId,
        entity_name: candidateName,
        metadata: { job_id: selectedJobId, job_title: selectedJob?.title }
      });

      toast.success(`${candidateName} added to "${selectedJob?.title}"`);
      setSelectedJobId(null);
      onOpenChange(false);
      onSuccess?.();
    } catch (error: any) {
      console.error('Error adding to job:', error);
      if (error.code === '23505') {
        toast.error('Candidate is already added to this job');
      } else {
        toast.error(error.message || 'Failed to add candidate to job');
      }
    } finally {
      setIsAdding(false);
    }
  };

  const statusColors: Record<string, string> = {
    open: 'bg-emerald-100 text-emerald-700',
    draft: 'bg-muted text-muted-foreground',
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Briefcase className="h-5 w-5" />
            Add to Job
          </DialogTitle>
          <DialogDescription>
            Select a job to add {candidateName} to
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search jobs..."
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
            ) : filteredJobs.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-muted-foreground p-4">
                <Briefcase className="h-8 w-8 mb-2" />
                <p className="text-sm text-center">
                  {availableJobs.length === 0 
                    ? 'No available jobs. Candidate may already be added to all jobs.'
                    : `No jobs match "${searchQuery}"`
                  }
                </p>
              </div>
            ) : (
              <div className="p-2 space-y-1">
                {filteredJobs.map((job) => (
                  <div
                    key={job.id}
                    className={`flex items-center gap-3 p-3 rounded-lg cursor-pointer transition-colors ${
                      selectedJobId === job.id
                        ? 'bg-primary/10 border border-primary/30'
                        : 'hover:bg-muted/50 border border-transparent'
                    }`}
                    onClick={() => setSelectedJobId(job.id)}
                  >
                    <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                      <Briefcase className="w-5 h-5 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="font-medium truncate">{job.title}</p>
                        <Badge className={statusColors[job.status] || ''} variant="secondary">
                          {job.status}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-3 text-sm text-muted-foreground mt-0.5">
                        {job.clients?.name && (
                          <span className="truncate">{job.clients.name}</span>
                        )}
                        {job.location && (
                          <span className="flex items-center gap-1">
                            <MapPin className="w-3 h-3" />
                            {job.location}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleAdd} disabled={isAdding || !selectedJobId}>
            {isAdding ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Adding...
              </>
            ) : (
              <>
                <Briefcase className="h-4 w-4 mr-2" />
                Add to Job
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}