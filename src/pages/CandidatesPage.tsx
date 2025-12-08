import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { AppLayout } from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Plus, Search, Upload, MapPin, Calendar, Loader2, Trash2, Download, CheckSquare, X, UserPlus } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth';
import { motion } from 'framer-motion';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';
import { CandidateStatusSelect } from '@/components/candidates/CandidateStatusSelect';
import { Checkbox } from '@/components/ui/checkbox';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuSubContent,
} from '@/components/ui/dropdown-menu';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';

interface Candidate {
  id: string;
  full_name: string;
  email: string;
  current_title: string | null;
  current_company: string | null;
  location: string | null;
  avatar_url: string | null;
  skills: string[] | null;
  experience_years: number | null;
  status: string;
  created_at: string;
  phone: string | null;
  linkedin_url: string | null;
}

interface Job {
  id: string;
  title: string;
  status: string;
}

const statusFilters = [
  { id: 'all', label: 'All' },
  { id: 'new', label: 'New' },
  { id: 'screening', label: 'Screening' },
  { id: 'interviewing', label: 'Interviewing' },
  { id: 'offered', label: 'Offered' },
  { id: 'hired', label: 'Hired' },
  { id: 'rejected', label: 'Rejected' },
];

const statusColors: Record<string, string> = {
  new: 'bg-muted text-muted-foreground',
  screening: 'bg-info/10 text-info border-info/30',
  interviewing: 'bg-accent/10 text-accent border-accent/30',
  offered: 'bg-warning/10 text-warning border-warning/30',
  hired: 'bg-success/20 text-success border-success/40',
  rejected: 'bg-destructive/10 text-destructive border-destructive/30',
  withdrawn: 'bg-muted text-muted-foreground',
};

const CandidatesPage = () => {
  const navigate = useNavigate();
  const { tenantId, user } = useAuth();
  const [filter, setFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [showMoveToJobDialog, setShowMoveToJobDialog] = useState(false);
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);
  const [isMoving, setIsMoving] = useState(false);

  useEffect(() => {
    if (tenantId) {
      fetchCandidates();
      fetchJobs();
    }
  }, [tenantId]);

  const fetchCandidates = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('candidates')
        .select('*')
        .eq('tenant_id', tenantId)
        .order('created_at', { ascending: false });

      if (error) throw error;

      setCandidates((data || []).map(c => ({
        ...c,
        skills: Array.isArray(c.skills) ? c.skills as string[] : null,
      })));
    } catch (error) {
      console.error('Error fetching candidates:', error);
      toast.error('Failed to load candidates');
    } finally {
      setIsLoading(false);
    }
  };

  const fetchJobs = async () => {
    try {
      const { data, error } = await supabase
        .from('jobs')
        .select('id, title, status')
        .eq('tenant_id', tenantId)
        .in('status', ['open', 'draft'])
        .order('created_at', { ascending: false });

      if (error) throw error;
      setJobs(data || []);
    } catch (error) {
      console.error('Error fetching jobs:', error);
    }
  };

  const filteredCandidates = candidates.filter(candidate => {
    const matchesFilter = filter === 'all' || candidate.status === filter;
    const matchesSearch = 
      candidate.full_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      candidate.current_title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      candidate.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      candidate.skills?.some(s => s.toLowerCase().includes(searchQuery.toLowerCase()));
    return matchesFilter && matchesSearch;
  });

  const statusCounts: Record<string, number> = {
    all: candidates.length,
  };
  statusFilters.slice(1).forEach(status => {
    statusCounts[status.id] = candidates.filter(c => c.status === status.id).length;
  });

  const toggleSelection = (id: string) => {
    setSelectedIds(prev =>
      prev.includes(id) ? prev.filter(cid => cid !== id) : [...prev, id]
    );
  };

  const selectAll = () => {
    if (selectedIds.length === filteredCandidates.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(filteredCandidates.map(c => c.id));
    }
  };

  const handleBulkStatusChange = async (newStatus: string) => {
    try {
      const { error } = await supabase
        .from('candidates')
        .update({ status: newStatus as 'new' | 'screening' | 'interviewing' | 'offered' | 'hired' | 'rejected' | 'withdrawn' })
        .in('id', selectedIds);

      if (error) throw error;
      toast.success(`Updated ${selectedIds.length} candidate(s) to ${newStatus}`);
      fetchCandidates();
      setSelectedIds([]);
    } catch (error) {
      console.error('Error updating candidates:', error);
      toast.error('Failed to update candidates');
    }
  };

  const handleBulkDelete = async () => {
    setIsDeleting(true);
    try {
      // First delete from job_candidates
      await supabase
        .from('job_candidates')
        .delete()
        .in('candidate_id', selectedIds);

      // Then delete candidates
      const { error } = await supabase
        .from('candidates')
        .delete()
        .in('id', selectedIds);

      if (error) throw error;
      toast.success(`Deleted ${selectedIds.length} candidate(s)`);
      fetchCandidates();
      setSelectedIds([]);
      setShowDeleteDialog(false);
    } catch (error) {
      console.error('Error deleting candidates:', error);
      toast.error('Failed to delete candidates');
    } finally {
      setIsDeleting(false);
    }
  };

  const handleMoveToJob = async () => {
    if (!selectedJobId) return;
    
    setIsMoving(true);
    try {
      // Check which candidates are already in the job
      const { data: existing } = await supabase
        .from('job_candidates')
        .select('candidate_id')
        .eq('job_id', selectedJobId)
        .in('candidate_id', selectedIds);

      const existingIds = existing?.map(e => e.candidate_id) || [];
      const newIds = selectedIds.filter(id => !existingIds.includes(id));

      if (newIds.length === 0) {
        toast.info('All selected candidates are already in this job');
        setShowMoveToJobDialog(false);
        return;
      }

      const insertData = newIds.map(candidateId => ({
        job_id: selectedJobId,
        candidate_id: candidateId,
        tenant_id: tenantId,
        stage: 'applied' as const,
        applied_at: new Date().toISOString(),
      }));

      const { error } = await supabase
        .from('job_candidates')
        .insert(insertData);

      if (error) throw error;

      const job = jobs.find(j => j.id === selectedJobId);
      toast.success(`Added ${newIds.length} candidate(s) to ${job?.title || 'job'}`);
      setSelectedIds([]);
      setShowMoveToJobDialog(false);
      setSelectedJobId(null);
    } catch (error: any) {
      console.error('Error moving candidates:', error);
      toast.error('Failed to add candidates to job');
    } finally {
      setIsMoving(false);
    }
  };

  const handleExport = () => {
    const selectedCandidates = candidates.filter(c => selectedIds.includes(c.id));
    
    const csvContent = [
      ['Name', 'Email', 'Phone', 'LinkedIn', 'Title', 'Company', 'Location'].join(','),
      ...selectedCandidates.map(c => [
        `"${c.full_name}"`,
        `"${c.email}"`,
        `"${c.phone || ''}"`,
        `"${c.linkedin_url || ''}"`,
        `"${c.current_title || ''}"`,
        `"${c.current_company || ''}"`,
        `"${c.location || ''}"`,
      ].join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `candidates_export_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success(`Exported ${selectedCandidates.length} candidate(s)`);
  };

  return (
    <AppLayout title="Candidates" subtitle="Manage your talent pool and track candidate progress.">
      {/* Header Actions */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
        <div className="flex items-center gap-3 flex-wrap">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search candidates, skills..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-72 pl-9 bg-card"
            />
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" className="gap-2" onClick={() => navigate('/candidates/new?tab=bulk')}>
            <Upload className="w-4 h-4" />
            Bulk Upload
          </Button>
          <Button variant="outline" className="gap-2" onClick={() => navigate('/candidates/new?tab=cv')}>
            <Upload className="w-4 h-4" />
            Upload CV
          </Button>
          <Button className="gap-2" onClick={() => navigate('/candidates/new')}>
            <Plus className="w-4 h-4" />
            Add Candidate
          </Button>
        </div>
      </div>

      {/* Bulk Actions Bar */}
      {selectedIds.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center justify-between gap-4 mb-4 p-3 bg-accent/10 border border-accent/30 rounded-lg"
        >
          <div className="flex items-center gap-3">
            <CheckSquare className="w-5 h-5 text-accent" />
            <span className="font-medium">{selectedIds.length} selected</span>
            <Button variant="ghost" size="sm" onClick={() => setSelectedIds([])}>
              <X className="w-4 h-4 mr-1" />
              Clear
            </Button>
          </div>
          <div className="flex items-center gap-2">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm">Change Status</Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                {statusFilters.slice(1).map(status => (
                  <DropdownMenuItem 
                    key={status.id} 
                    onClick={() => handleBulkStatusChange(status.id)}
                  >
                    {status.label}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => setShowMoveToJobDialog(true)}
            >
              <UserPlus className="w-4 h-4 mr-1" />
              Add to Job
            </Button>
            <Button variant="outline" size="sm" onClick={handleExport}>
              <Download className="w-4 h-4 mr-1" />
              Export
            </Button>
            <Button 
              variant="destructive" 
              size="sm"
              onClick={() => setShowDeleteDialog(true)}
            >
              <Trash2 className="w-4 h-4 mr-1" />
              Delete
            </Button>
          </div>
        </motion.div>
      )}

      {/* Status Filters */}
      <div className="flex items-center gap-2 mb-6 overflow-x-auto pb-2">
        <button
          onClick={selectAll}
          className={cn(
            'px-3 py-2 text-sm font-medium rounded-full transition-colors whitespace-nowrap flex items-center gap-2',
            selectedIds.length === filteredCandidates.length && filteredCandidates.length > 0
              ? 'bg-accent text-accent-foreground'
              : 'bg-muted text-muted-foreground hover:text-foreground hover:bg-muted/80'
          )}
        >
          <Checkbox 
            checked={selectedIds.length === filteredCandidates.length && filteredCandidates.length > 0}
            onCheckedChange={selectAll}
          />
          Select All
        </button>
        {statusFilters.map((status) => (
          <button
            key={status.id}
            onClick={() => setFilter(status.id)}
            className={cn(
              'px-4 py-2 text-sm font-medium rounded-full transition-colors whitespace-nowrap',
              filter === status.id 
                ? 'bg-accent text-accent-foreground' 
                : 'bg-muted text-muted-foreground hover:text-foreground hover:bg-muted/80'
            )}
          >
            {status.label}
            <span className="ml-1.5 opacity-70">
              {statusCounts[status.id] || 0}
            </span>
          </button>
        ))}
      </div>

      {/* Candidates Grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-40 rounded-xl" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {filteredCandidates.map((candidate) => (
            <motion.div
              key={candidate.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              whileHover={{ y: -2 }}
              transition={{ duration: 0.2 }}
            >
              <div
                className={cn(
                  "block bg-card rounded-xl border p-5 transition-all cursor-pointer",
                  selectedIds.includes(candidate.id)
                    ? "border-accent shadow-lg"
                    : "border-border hover:shadow-lg hover:border-accent/30"
                )}
              >
                <div className="flex items-start gap-4">
                  <div className="flex items-center gap-3">
                    <Checkbox
                      checked={selectedIds.includes(candidate.id)}
                      onCheckedChange={() => toggleSelection(candidate.id)}
                      onClick={(e) => e.stopPropagation()}
                    />
                    <Link to={`/candidates/${candidate.id}`}>
                      <Avatar className="w-14 h-14">
                        <AvatarImage src={candidate.avatar_url || ''} alt={candidate.full_name} />
                        <AvatarFallback className="text-lg bg-accent/10 text-accent font-medium">
                          {candidate.full_name.split(' ').map(n => n[0]).join('').toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                    </Link>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <Link to={`/candidates/${candidate.id}`} className="flex-1">
                        <h3 className="font-semibold text-foreground hover:text-accent transition-colors">{candidate.full_name}</h3>
                        <p className="text-sm text-accent">
                          {candidate.current_title || 'No title'}
                          {candidate.current_company && ` at ${candidate.current_company}`}
                        </p>
                      </Link>
                      <div onClick={(e) => e.stopPropagation()}>
                        <CandidateStatusSelect
                          candidateId={candidate.id}
                          currentStatus={candidate.status}
                          onStatusChange={(newStatus) => {
                            setCandidates(prev => prev.map(c => 
                              c.id === candidate.id ? { ...c, status: newStatus } : c
                            ));
                          }}
                          compact
                        />
                      </div>
                    </div>
                    
                    <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2 text-sm text-muted-foreground">
                      {candidate.location && (
                        <span className="flex items-center gap-1">
                          <MapPin className="w-3.5 h-3.5" />
                          {candidate.location}
                        </span>
                      )}
                      {candidate.experience_years && (
                        <span className="flex items-center gap-1">
                          <Calendar className="w-3.5 h-3.5" />
                          {candidate.experience_years} years exp.
                        </span>
                      )}
                    </div>
                    
                    {candidate.skills && candidate.skills.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 mt-3">
                        {candidate.skills.slice(0, 4).map((skill) => (
                          <Badge key={skill} variant="secondary" className="text-xs bg-muted/50">
                            {skill}
                          </Badge>
                        ))}
                        {candidate.skills.length > 4 && (
                          <Badge variant="secondary" className="text-xs bg-muted/50">
                            +{candidate.skills.length - 4}
                          </Badge>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      )}

      {!isLoading && filteredCandidates.length === 0 && (
        <div className="text-center py-12">
          <p className="text-muted-foreground mb-4">No candidates found matching your criteria.</p>
          <Button onClick={() => navigate('/candidates/new')}>
            <Plus className="w-4 h-4 mr-2" />
            Add Your First Candidate
          </Button>
        </div>
      )}

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {selectedIds.length} candidate(s)?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete the selected candidates and remove them from all jobs.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleBulkDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={isDeleting}
            >
              {isDeleting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Deleting...
                </>
              ) : (
                'Delete'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Move to Job Dialog */}
      <Dialog open={showMoveToJobDialog} onOpenChange={setShowMoveToJobDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add to Job</DialogTitle>
            <DialogDescription>
              Select a job to add {selectedIds.length} candidate(s) to.
            </DialogDescription>
          </DialogHeader>
          <ScrollArea className="h-64 border rounded-lg">
            <div className="p-2 space-y-1">
              {jobs.length === 0 ? (
                <p className="text-center text-muted-foreground py-4">No open jobs available</p>
              ) : (
                jobs.map(job => (
                  <div
                    key={job.id}
                    className={cn(
                      "flex items-center gap-3 p-3 rounded-lg cursor-pointer transition-colors",
                      selectedJobId === job.id
                        ? "bg-accent/10 border border-accent/30"
                        : "hover:bg-muted/50 border border-transparent"
                    )}
                    onClick={() => setSelectedJobId(job.id)}
                  >
                    <Checkbox
                      checked={selectedJobId === job.id}
                      onCheckedChange={() => setSelectedJobId(job.id)}
                    />
                    <div className="flex-1">
                      <p className="font-medium">{job.title}</p>
                      <p className="text-sm text-muted-foreground capitalize">{job.status}</p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </ScrollArea>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowMoveToJobDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleMoveToJob} disabled={!selectedJobId || isMoving}>
              {isMoving ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Adding...
                </>
              ) : (
                <>
                  <UserPlus className="w-4 h-4 mr-2" />
                  Add to Job
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
};

export default CandidatesPage;
