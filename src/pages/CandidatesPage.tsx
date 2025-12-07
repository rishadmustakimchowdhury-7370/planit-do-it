import { AppLayout } from '@/components/layout/AppLayout';
import { CandidateCard } from '@/components/candidates/CandidateCard';
import { candidates } from '@/data/mockData';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Plus, Search, Filter, Upload } from 'lucide-react';
import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { PipelineStage } from '@/types/recruitment';

const statusFilters: { id: PipelineStage | 'all'; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'new', label: 'New' },
  { id: 'screening', label: 'Screening' },
  { id: 'shortlisted', label: 'Shortlisted' },
  { id: 'interview', label: 'Interview' },
  { id: 'offer', label: 'Offer' },
  { id: 'placed', label: 'Placed' },
];

const CandidatesPage = () => {
  const [filter, setFilter] = useState<PipelineStage | 'all'>('all');
  const [searchQuery, setSearchQuery] = useState('');

  const filteredCandidates = candidates.filter(candidate => {
    const matchesFilter = filter === 'all' || candidate.status === filter;
    const matchesSearch = candidate.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      candidate.currentTitle.toLowerCase().includes(searchQuery.toLowerCase()) ||
      candidate.skills.some(s => s.toLowerCase().includes(searchQuery.toLowerCase()));
    return matchesFilter && matchesSearch;
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
          <Button variant="outline" className="gap-2">
            <Upload className="w-4 h-4" />
            Upload CV
          </Button>
          <Button className="gap-2">
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
              {status.id === 'all' 
                ? candidates.length 
                : candidates.filter(c => c.status === status.id).length}
            </span>
          </button>
        ))}
      </div>

      {/* Candidates Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {filteredCandidates.map((candidate) => (
          <CandidateCard key={candidate.id} candidate={candidate} />
        ))}
      </div>

      {filteredCandidates.length === 0 && (
        <div className="text-center py-12 text-muted-foreground">
          No candidates found matching your criteria.
        </div>
      )}
    </AppLayout>
  );
};

export default CandidatesPage;
