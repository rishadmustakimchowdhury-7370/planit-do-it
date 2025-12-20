import { useState, useEffect, useMemo } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { AppLayout } from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { 
  Plus, Search, Upload, MapPin, Calendar, Loader2, Trash2, Download, 
  CheckSquare, X, UserPlus, LayoutGrid, List, Table2, Briefcase,
  Mail, Phone, Linkedin, MoreHorizontal, Eye, Filter, SlidersHorizontal
} from 'lucide-react';
import { AdvancedSearchPanel, AdvancedSearchFilters } from '@/components/candidates/AdvancedSearchPanel';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth';
import { motion, AnimatePresence } from 'framer-motion';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';
import { Checkbox } from '@/components/ui/checkbox';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

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
  created_by: string | null;
  uploader_name: string | null;
}

// Known countries list for validation
const knownCountries = new Set([
  'usa', 'united states', 'uk', 'united kingdom', 'canada', 'australia', 'germany', 'france',
  'india', 'china', 'japan', 'brazil', 'mexico', 'spain', 'italy', 'netherlands', 'sweden',
  'norway', 'denmark', 'finland', 'switzerland', 'austria', 'belgium', 'portugal', 'poland',
  'ireland', 'new zealand', 'singapore', 'malaysia', 'indonesia', 'thailand', 'vietnam',
  'philippines', 'south korea', 'korea', 'taiwan', 'hong kong', 'uae', 'united arab emirates',
  'saudi arabia', 'israel', 'turkey', 'south africa', 'egypt', 'nigeria', 'kenya', 'argentina',
  'chile', 'colombia', 'peru', 'venezuela', 'pakistan', 'bangladesh', 'sri lanka', 'nepal',
  'russia', 'ukraine', 'czech republic', 'hungary', 'romania', 'greece', 'croatia', 'serbia'
]);

// Helper function to extract country from location string
const extractCountry = (location: string | null): string | null => {
  if (!location) return null;
  
  // Common patterns: "City, Country", "City, State, Country", "Address, City, Country"
  const parts = location.split(',').map(p => p.trim().toLowerCase());
  if (parts.length === 0) return null;
  
  // Check from last to first for a known country
  for (let i = parts.length - 1; i >= 0; i--) {
    const part = parts[i];
    // Skip postal codes
    if (/^\d+$/.test(part) || /^[a-z]{1,2}\d/.test(part)) continue;
    
    if (knownCountries.has(part)) {
      // Return with proper capitalization
      return part.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
    }
  }
  
  return null;
};

interface Job {
  id: string;
  title: string;
  status: string;
}

type ViewMode = 'grid' | 'list' | 'table';

const statusFilters = [
  { id: 'all', label: 'All', icon: null },
  { id: 'new', label: 'New', color: 'bg-slate-500' },
  { id: 'screening', label: 'Screening', color: 'bg-blue-500' },
  { id: 'interviewing', label: 'Interviewing', color: 'bg-purple-500' },
  { id: 'offered', label: 'Offered', color: 'bg-amber-500' },
  { id: 'hired', label: 'Hired', color: 'bg-emerald-500' },
  { id: 'rejected', label: 'Rejected', color: 'bg-red-500' },
];

const statusColors: Record<string, string> = {
  new: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
  screening: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  interviewing: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
  offered: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  hired: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
  rejected: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  withdrawn: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400',
};

// Map candidate status to job pipeline stage
const statusToPipelineStage: Record<string, string> = {
  new: 'applied',
  screening: 'screening',
  interviewing: 'interview',
  offered: 'offer',
  hired: 'hired',
  rejected: 'rejected',
  withdrawn: 'rejected',
};

const defaultAdvancedFilters: AdvancedSearchFilters = {
  query: '',
  skills: [],
  title: '',
  location: '',
  experienceMin: '',
  experienceMax: '',
  status: 'all',
  booleanQuery: '',
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
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const [advancedFilters, setAdvancedFilters] = useState<AdvancedSearchFilters>(defaultAdvancedFilters);

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

      // Fetch profiles for created_by users
      const uniqueCreatorIds = [...new Set(data?.map(c => c.created_by).filter(Boolean) || [])];
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, full_name')
        .in('id', uniqueCreatorIds);

      const profileMap = new Map(profiles?.map(p => [p.id, p.full_name]) || []);

      setCandidates((data || []).map(c => ({
        ...c,
        skills: Array.isArray(c.skills) ? c.skills as string[] : null,
        uploader_name: c.created_by ? profileMap.get(c.created_by) || 'Unknown' : 'System',
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

  // Boolean search parser
  const parseBooleanQuery = (query: string, text: string): boolean => {
    if (!query.trim()) return true;
    
    const normalizedText = text.toLowerCase();
    const normalizedQuery = query.toLowerCase();
    
    // Replace operators with JS equivalents
    let expression = normalizedQuery
      .replace(/\bAND\b/gi, '&&')
      .replace(/\bOR\b/gi, '||')
      .replace(/\bNOT\b/gi, '!')
      .replace(/"([^"]+)"/g, (_, phrase) => normalizedText.includes(phrase) ? 'true' : 'false');
    
    // Replace remaining words with boolean checks
    const words = expression.match(/[a-z0-9]+/gi) || [];
    words.forEach(word => {
      if (!['true', 'false', '&&', '||', '!'].includes(word)) {
        const regex = new RegExp(`\\b${word}\\b`, 'gi');
        expression = expression.replace(regex, normalizedText.includes(word) ? 'true' : 'false');
      }
    });
    
    try {
      return eval(expression);
    } catch {
      // Fallback to simple contains check
      return normalizedText.includes(normalizedQuery);
    }
  };

  const filteredCandidates = useMemo(() => {
    return candidates.filter(candidate => {
      // Basic filter
      const statusFilter = advancedFilters.status !== 'all' ? advancedFilters.status : filter;
      const matchesFilter = statusFilter === 'all' || candidate.status === statusFilter;
      
      // Basic search query
      const searchText = [
        candidate.full_name,
        candidate.current_title,
        candidate.email,
        candidate.location,
        ...(candidate.skills || [])
      ].filter(Boolean).join(' ').toLowerCase();
      
      const matchesSearch = !searchQuery || searchText.includes(searchQuery.toLowerCase());
      
      // Advanced filters
      const matchesSkills = advancedFilters.skills.length === 0 || 
        advancedFilters.skills.every(skill => 
          candidate.skills?.some(s => s.toLowerCase().includes(skill.toLowerCase()))
        );
      
      const matchesTitle = !advancedFilters.title || 
        candidate.current_title?.toLowerCase().includes(advancedFilters.title.toLowerCase());
      
      const matchesLocation = !advancedFilters.location || 
        candidate.location?.toLowerCase().includes(advancedFilters.location.toLowerCase());
      
      const expYears = candidate.experience_years || 0;
      const matchesExpMin = !advancedFilters.experienceMin || 
        expYears >= parseInt(advancedFilters.experienceMin);
      const matchesExpMax = !advancedFilters.experienceMax || 
        expYears <= parseInt(advancedFilters.experienceMax);
      
      // Boolean search
      const matchesBoolean = parseBooleanQuery(advancedFilters.booleanQuery, searchText);
      
      return matchesFilter && matchesSearch && matchesSkills && matchesTitle && 
             matchesLocation && matchesExpMin && matchesExpMax && matchesBoolean;
    });
  }, [candidates, filter, searchQuery, advancedFilters]);

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

  // Updated to sync status with job_candidates table
  const handleStatusChange = async (candidateId: string, newStatus: string) => {
    try {
      // Update candidate status
      const { error: candidateError } = await supabase
        .from('candidates')
        .update({ 
          status: newStatus as any,
          updated_at: new Date().toISOString()
        })
        .eq('id', candidateId);

      if (candidateError) throw candidateError;

      // Also update all job_candidates entries for this candidate
      const pipelineStage = statusToPipelineStage[newStatus] || 'applied';
      await supabase
        .from('job_candidates')
        .update({ 
          stage: pipelineStage as any,
          stage_updated_at: new Date().toISOString()
        })
        .eq('candidate_id', candidateId);

      // Log activity
      await supabase.from('activities').insert({
        tenant_id: tenantId,
        user_id: user?.id,
        action: `Changed candidate status to "${newStatus}"`,
        entity_type: 'candidate',
        entity_id: candidateId,
        metadata: { new_status: newStatus }
      });

      setCandidates(prev => prev.map(c => 
        c.id === candidateId ? { ...c, status: newStatus } : c
      ));
      toast.success(`Status updated to ${newStatus}`);
    } catch (error: any) {
      console.error('Error updating status:', error);
      toast.error('Failed to update status');
    }
  };

  const handleBulkStatusChange = async (newStatus: string) => {
    try {
      const { error } = await supabase
        .from('candidates')
        .update({ status: newStatus as any })
        .in('id', selectedIds);

      if (error) throw error;

      // Also update job_candidates for all selected candidates
      const pipelineStage = statusToPipelineStage[newStatus] || 'applied';
      await supabase
        .from('job_candidates')
        .update({ 
          stage: pipelineStage as any,
          stage_updated_at: new Date().toISOString()
        })
        .in('candidate_id', selectedIds);

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
      await supabase
        .from('job_candidates')
        .delete()
        .in('candidate_id', selectedIds);

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
      ['Name', 'Email', 'Phone', 'LinkedIn', 'Title', 'Company', 'Location', 'Status'].join(','),
      ...selectedCandidates.map(c => [
        `"${c.full_name}"`,
        `"${c.email}"`,
        `"${c.phone || ''}"`,
        `"${c.linkedin_url || ''}"`,
        `"${c.current_title || ''}"`,
        `"${c.current_company || ''}"`,
        `"${c.location || ''}"`,
        `"${c.status}"`,
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

  const renderGridView = () => (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
      <AnimatePresence mode="popLayout">
        {filteredCandidates.map((candidate, index) => (
          <motion.div
            key={candidate.id}
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.2, delay: index * 0.02 }}
            layout
          >
            <div
              className={cn(
                "group relative bg-card rounded-xl border overflow-hidden transition-all duration-200",
                selectedIds.includes(candidate.id)
                  ? "border-primary ring-2 ring-primary/20"
                  : "border-border hover:border-primary/40 hover:shadow-lg"
              )}
            >
              {/* Selection checkbox */}
              <div className="absolute top-4 left-4 z-10">
                <Checkbox
                  checked={selectedIds.includes(candidate.id)}
                  onCheckedChange={() => toggleSelection(candidate.id)}
                  className="bg-background/80 backdrop-blur-sm"
                />
              </div>

              {/* Quick actions */}
              <div className="absolute top-4 right-4 z-10 opacity-0 group-hover:opacity-100 transition-opacity">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="secondary" size="icon" className="h-8 w-8 bg-background/80 backdrop-blur-sm">
                      <MoreHorizontal className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => navigate(`/candidates/${candidate.id}`)}>
                      <Eye className="w-4 h-4 mr-2" />
                      View Profile
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem 
                      className="text-destructive"
                      onClick={() => {
                        setSelectedIds([candidate.id]);
                        setShowDeleteDialog(true);
                      }}
                    >
                      <Trash2 className="w-4 h-4 mr-2" />
                      Delete
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>

              <Link to={`/candidates/${candidate.id}`} className="block p-5">
                <div className="flex items-start gap-4">
                  <Avatar className="w-14 h-14 ring-2 ring-background shadow-md">
                    <AvatarImage src={candidate.avatar_url || ''} alt={candidate.full_name} />
                    <AvatarFallback className="text-base font-semibold bg-gradient-to-br from-primary/20 to-primary/10 text-primary">
                      {candidate.full_name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)}
                    </AvatarFallback>
                  </Avatar>
                  
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-foreground truncate group-hover:text-primary transition-colors">
                      {candidate.full_name}
                    </h3>
                    <p className="text-sm text-muted-foreground truncate">
                      {candidate.current_title || 'No title'}
                      {candidate.current_company && (
                        <span className="text-muted-foreground/60"> at {candidate.current_company}</span>
                      )}
                    </p>
                  </div>
                </div>

                <div className="mt-4 space-y-2">
                  {extractCountry(candidate.location) && (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <MapPin className="w-3.5 h-3.5 shrink-0" />
                      <span className="truncate">{extractCountry(candidate.location)}</span>
                    </div>
                  )}
                  {candidate.experience_years && (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Briefcase className="w-3.5 h-3.5 shrink-0" />
                      <span>{candidate.experience_years} years experience</span>
                    </div>
                  )}
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <UserPlus className="w-3.5 h-3.5 shrink-0" />
                    <span>Added by {candidate.uploader_name}</span>
                  </div>
                </div>

                {candidate.skills && candidate.skills.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mt-4">
                    {candidate.skills.slice(0, 3).map((skill) => (
                      <Badge key={skill} variant="secondary" className="text-xs">
                        {skill}
                      </Badge>
                    ))}
                    {candidate.skills.length > 3 && (
                      <Badge variant="outline" className="text-xs">
                        +{candidate.skills.length - 3}
                      </Badge>
                    )}
                  </div>
                )}
              </Link>

              {/* Status */}
              <div className="px-5 pb-4 pt-0">
                <Badge className={cn('text-xs font-medium', statusColors[candidate.status])}>
                  {statusFilters.find(s => s.id === candidate.status)?.label || candidate.status}
                </Badge>
              </div>
            </div>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );

  const renderListView = () => (
    <div className="space-y-2">
      <AnimatePresence mode="popLayout">
        {filteredCandidates.map((candidate, index) => (
          <motion.div
            key={candidate.id}
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.2, delay: index * 0.02 }}
            layout
          >
            <div
              className={cn(
                "group flex items-center gap-4 p-4 bg-card rounded-xl border transition-all duration-200",
                selectedIds.includes(candidate.id)
                  ? "border-primary ring-2 ring-primary/20"
                  : "border-border hover:border-primary/40 hover:shadow-md"
              )}
            >
              <Checkbox
                checked={selectedIds.includes(candidate.id)}
                onCheckedChange={() => toggleSelection(candidate.id)}
              />

              <Link to={`/candidates/${candidate.id}`} className="flex items-center gap-4 flex-1 min-w-0">
                <Avatar className="w-12 h-12 shrink-0">
                  <AvatarImage src={candidate.avatar_url || ''} alt={candidate.full_name} />
                  <AvatarFallback className="bg-gradient-to-br from-primary/20 to-primary/10 text-primary font-semibold">
                    {candidate.full_name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)}
                  </AvatarFallback>
                </Avatar>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold text-foreground group-hover:text-primary transition-colors truncate">
                      {candidate.full_name}
                    </h3>
                  </div>
                  <p className="text-sm text-muted-foreground truncate">
                    {candidate.current_title || 'No title'}
                    {candidate.current_company && ` at ${candidate.current_company}`}
                  </p>
                </div>
              </Link>

              <div className="hidden md:flex items-center gap-6 text-sm text-muted-foreground shrink-0">
                {extractCountry(candidate.location) && (
                  <div className="flex items-center gap-1.5">
                    <MapPin className="w-4 h-4" />
                    <span>{extractCountry(candidate.location)}</span>
                  </div>
                )}
                {candidate.email && (
                  <div className="flex items-center gap-1.5">
                    <Mail className="w-4 h-4" />
                    <span className="max-w-[160px] truncate">{candidate.email}</span>
                  </div>
                )}
                <div className="flex items-center gap-1.5 text-xs">
                  <UserPlus className="w-3.5 h-3.5" />
                  <span>{candidate.uploader_name}</span>
                </div>
              </div>

              <div className="shrink-0 w-32">
                <Badge className={cn('text-xs', statusColors[candidate.status])}>
                  {statusFilters.find(s => s.id === candidate.status)?.label || candidate.status}
                </Badge>
              </div>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0">
                    <MoreHorizontal className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => navigate(`/candidates/${candidate.id}`)}>
                    <Eye className="w-4 h-4 mr-2" />
                    View Profile
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem 
                    className="text-destructive"
                    onClick={() => {
                      setSelectedIds([candidate.id]);
                      setShowDeleteDialog(true);
                    }}
                  >
                    <Trash2 className="w-4 h-4 mr-2" />
                    Delete
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );

  const renderTableView = () => (
    <div className="bg-card rounded-xl border overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow className="bg-muted/50 hover:bg-muted/50">
            <TableHead className="w-12">
              <Checkbox
                checked={selectedIds.length === filteredCandidates.length && filteredCandidates.length > 0}
                onCheckedChange={selectAll}
              />
            </TableHead>
            <TableHead>Name</TableHead>
            <TableHead className="hidden md:table-cell">Email</TableHead>
            <TableHead className="hidden lg:table-cell">Phone</TableHead>
            <TableHead className="hidden lg:table-cell">Location</TableHead>
            <TableHead className="hidden xl:table-cell">Submitted By</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="w-12"></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {filteredCandidates.map((candidate) => (
            <TableRow 
              key={candidate.id}
              className={cn(
                "cursor-pointer transition-colors",
                selectedIds.includes(candidate.id) && "bg-primary/5"
              )}
            >
              <TableCell>
                <Checkbox
                  checked={selectedIds.includes(candidate.id)}
                  onCheckedChange={() => toggleSelection(candidate.id)}
                />
              </TableCell>
              <TableCell>
                <Link to={`/candidates/${candidate.id}`} className="flex items-center gap-3">
                  <Avatar className="w-10 h-10">
                    <AvatarImage src={candidate.avatar_url || ''} alt={candidate.full_name} />
                    <AvatarFallback className="text-xs bg-gradient-to-br from-primary/20 to-primary/10 text-primary font-semibold">
                      {candidate.full_name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <p className="font-medium text-foreground hover:text-primary transition-colors">
                      {candidate.full_name}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {candidate.current_title || 'No title'}
                    </p>
                  </div>
                </Link>
              </TableCell>
              <TableCell className="hidden md:table-cell">
                <span className="text-sm text-muted-foreground truncate max-w-[180px] block">
                  {candidate.email}
                </span>
              </TableCell>
              <TableCell className="hidden lg:table-cell">
                {candidate.phone ? (
                  <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                    <Phone className="w-3.5 h-3.5" />
                    <span>{candidate.phone}</span>
                  </div>
                ) : (
                  <span className="text-muted-foreground/50">—</span>
                )}
              </TableCell>
              <TableCell className="hidden lg:table-cell">
                {extractCountry(candidate.location) ? (
                  <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                    <MapPin className="w-3.5 h-3.5" />
                    <span>{extractCountry(candidate.location)}</span>
                  </div>
                ) : (
                  <span className="text-muted-foreground/50">—</span>
                )}
              </TableCell>
              <TableCell className="hidden xl:table-cell">
                <span className="text-sm text-foreground">
                  {candidate.uploader_name}
                </span>
              </TableCell>
              <TableCell>
                <Badge className={cn('text-xs', statusColors[candidate.status])}>
                  {statusFilters.find(s => s.id === candidate.status)?.label || candidate.status}
                </Badge>
              </TableCell>
              <TableCell>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-8 w-8">
                      <MoreHorizontal className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => navigate(`/candidates/${candidate.id}`)}>
                      <Eye className="w-4 h-4 mr-2" />
                      View Profile
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem 
                      className="text-destructive"
                      onClick={() => {
                        setSelectedIds([candidate.id]);
                        setShowDeleteDialog(true);
                      }}
                    >
                      <Trash2 className="w-4 h-4 mr-2" />
                      Delete
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );

  return (
    <AppLayout title="Candidates" subtitle="Manage your talent pool and track candidate progress.">
      {/* Header Actions */}
      <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4 mb-6">
        <div className="flex items-center gap-3 w-full lg:w-auto">
          <div className="relative flex-1 lg:flex-initial">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search candidates, skills, email..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full lg:w-80 pl-10 bg-card"
            />
          </div>
          
          {/* View Mode Toggle */}
          <div className="flex items-center bg-card border rounded-lg p-1">
            <Button
              variant={viewMode === 'grid' ? 'secondary' : 'ghost'}
              size="icon"
              className="h-8 w-8"
              onClick={() => setViewMode('grid')}
            >
              <LayoutGrid className="h-4 w-4" />
            </Button>
            <Button
              variant={viewMode === 'list' ? 'secondary' : 'ghost'}
              size="icon"
              className="h-8 w-8"
              onClick={() => setViewMode('list')}
            >
              <List className="h-4 w-4" />
            </Button>
            <Button
              variant={viewMode === 'table' ? 'secondary' : 'ghost'}
              size="icon"
              className="h-8 w-8"
              onClick={() => setViewMode('table')}
            >
              <Table2 className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <div className="flex items-center gap-2 w-full lg:w-auto justify-end">
          <AdvancedSearchPanel
            filters={advancedFilters}
            onFiltersChange={setAdvancedFilters}
            onReset={() => setAdvancedFilters(defaultAdvancedFilters)}
          />
          <Button variant="outline" size="sm" onClick={() => navigate('/candidates/new?tab=bulk')}>
            <Upload className="w-4 h-4 mr-2" />
            Bulk Upload
          </Button>
          <Button variant="outline" size="sm" onClick={() => navigate('/candidates/new?tab=cv')}>
            <Upload className="w-4 h-4 mr-2" />
            Upload CV
          </Button>
          <Button size="sm" onClick={() => navigate('/candidates/new')}>
            <Plus className="w-4 h-4 mr-2" />
            Add Candidate
          </Button>
        </div>
      </div>

      {/* Bulk Actions Bar */}
      <AnimatePresence>
        {selectedIds.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: -10, height: 0 }}
            animate={{ opacity: 1, y: 0, height: 'auto' }}
            exit={{ opacity: 0, y: -10, height: 0 }}
            className="mb-4"
          >
            <div className="flex items-center justify-between gap-4 p-4 bg-primary/5 border border-primary/20 rounded-xl">
              <div className="flex items-center gap-3">
                <div className="flex items-center justify-center w-8 h-8 rounded-full bg-primary text-primary-foreground text-sm font-bold">
                  {selectedIds.length}
                </div>
                <span className="font-medium">selected</span>
                <Button variant="ghost" size="sm" onClick={() => setSelectedIds([])}>
                  <X className="w-4 h-4 mr-1" />
                  Clear
                </Button>
              </div>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={() => setShowMoveToJobDialog(true)}>
                  <UserPlus className="w-4 h-4 mr-2" />
                  Add to Job
                </Button>
                <Button variant="outline" size="sm" onClick={handleExport}>
                  <Download className="w-4 h-4 mr-2" />
                  Export
                </Button>
                <Button variant="destructive" size="sm" onClick={() => setShowDeleteDialog(true)}>
                  <Trash2 className="w-4 h-4 mr-2" />
                  Delete
                </Button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Candidates Display */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {[...Array(6)].map((_, i) => (
            <Skeleton key={i} className="h-52 rounded-xl" />
          ))}
        </div>
      ) : filteredCandidates.length === 0 ? (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center py-16"
        >
          <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mx-auto mb-4">
            <Search className="w-8 h-8 text-muted-foreground" />
          </div>
          <h3 className="text-lg font-semibold mb-2">No candidates found</h3>
          <p className="text-muted-foreground mb-6 max-w-sm mx-auto">
            {searchQuery || filter !== 'all' 
              ? "Try adjusting your search or filter criteria" 
              : "Start building your talent pool by adding candidates"}
          </p>
          <Button onClick={() => navigate('/candidates/new')}>
            <Plus className="w-4 h-4 mr-2" />
            Add Your First Candidate
          </Button>
        </motion.div>
      ) : (
        <>
          {viewMode === 'grid' && renderGridView()}
          {viewMode === 'list' && renderListView()}
          {viewMode === 'table' && renderTableView()}
        </>
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
                        ? "bg-primary/10 border border-primary/30"
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
