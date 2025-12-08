import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { AppLayout } from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Plus, Search, Upload, MapPin, Calendar, Loader2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth';
import { motion } from 'framer-motion';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { MatchScoreCircle } from '@/components/matching/MatchScoreCircle';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';
import { CandidateStatusSelect } from '@/components/candidates/CandidateStatusSelect';

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
  const { tenantId } = useAuth();
  const [filter, setFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (tenantId) {
      fetchCandidates();
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

      {/* Status Filters */}
      <div className="flex items-center gap-2 mb-6 overflow-x-auto pb-2">
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
              <Link
                to={`/candidates/${candidate.id}`}
                className="block bg-card rounded-xl border border-border p-5 hover:shadow-lg hover:border-accent/30 transition-all"
              >
                <div className="flex items-start gap-4">
                  <Avatar className="w-14 h-14">
                    <AvatarImage src={candidate.avatar_url || ''} alt={candidate.full_name} />
                    <AvatarFallback className="text-lg bg-accent/10 text-accent font-medium">
                      {candidate.full_name.split(' ').map(n => n[0]).join('').toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <h3 className="font-semibold text-foreground">{candidate.full_name}</h3>
                        <p className="text-sm text-accent">
                          {candidate.current_title || 'No title'}
                          {candidate.current_company && ` at ${candidate.current_company}`}
                        </p>
                      </div>
                      <div onClick={(e) => e.preventDefault()}>
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
              </Link>
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
    </AppLayout>
  );
};

export default CandidatesPage;