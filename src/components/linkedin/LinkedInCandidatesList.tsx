import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Search, Linkedin, UserPlus, ExternalLink, Loader2 } from 'lucide-react';
import { SendLinkedInMessageDialog } from './SendLinkedInMessageDialog';

interface Candidate {
  id: string;
  full_name: string;
  email: string;
  current_title: string | null;
  current_company: string | null;
  linkedin_url: string | null;
  avatar_url: string | null;
  location: string | null;
}

export function LinkedInCandidatesList() {
  const { tenantId } = useAuth();
  const [search, setSearch] = useState('');
  const [selectedCandidates, setSelectedCandidates] = useState<string[]>([]);
  const [dialogCandidate, setDialogCandidate] = useState<Candidate | null>(null);

  const { data: candidates, isLoading } = useQuery({
    queryKey: ['linkedin-candidates', tenantId, search],
    queryFn: async () => {
      let query = supabase
        .from('candidates')
        .select('id, full_name, email, current_title, current_company, linkedin_url, avatar_url, location')
        .eq('tenant_id', tenantId!)
        .not('linkedin_url', 'is', null)
        .order('created_at', { ascending: false });

      if (search) {
        query = query.or(`full_name.ilike.%${search}%,current_title.ilike.%${search}%,current_company.ilike.%${search}%`);
      }

      const { data, error } = await query.limit(50);
      if (error) throw error;
      return data as Candidate[];
    },
    enabled: !!tenantId,
  });

  const toggleSelect = (id: string) => {
    setSelectedCandidates(prev => 
      prev.includes(id) ? prev.filter(c => c !== id) : [...prev, id]
    );
  };

  const toggleSelectAll = () => {
    if (!candidates) return;
    if (selectedCandidates.length === candidates.length) {
      setSelectedCandidates([]);
    } else {
      setSelectedCandidates(candidates.map(c => c.id));
    }
  };

  const getInitials = (name: string) => {
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header with search and actions */}
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search candidates with LinkedIn..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10"
          />
        </div>
        
        {selectedCandidates.length > 0 && (
          <div className="flex items-center gap-2">
            <Badge variant="secondary">{selectedCandidates.length} selected</Badge>
            <Button
              size="sm"
              onClick={() => {
                const candidate = candidates?.find(c => c.id === selectedCandidates[0]);
                if (candidate) setDialogCandidate(candidate);
              }}
            >
              <UserPlus className="h-4 w-4 mr-2" />
              Send Request
            </Button>
          </div>
        )}
      </div>

      {/* Select all checkbox */}
      {candidates && candidates.length > 0 && (
        <div className="flex items-center gap-2 px-2">
          <Checkbox
            checked={selectedCandidates.length === candidates.length}
            onCheckedChange={toggleSelectAll}
          />
          <span className="text-sm text-muted-foreground">
            Select all ({candidates.length} candidates with LinkedIn)
          </span>
        </div>
      )}

      {/* Candidates grid */}
      {!candidates || candidates.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Linkedin className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="font-medium mb-1">No candidates with LinkedIn profiles</h3>
            <p className="text-sm text-muted-foreground">
              Add LinkedIn URLs to candidate profiles to send connection requests
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3">
          {candidates.map((candidate) => (
            <Card 
              key={candidate.id} 
              className={`transition-colors ${selectedCandidates.includes(candidate.id) ? 'border-primary bg-primary/5' : ''}`}
            >
              <CardContent className="p-4">
                <div className="flex items-center gap-4">
                  <Checkbox
                    checked={selectedCandidates.includes(candidate.id)}
                    onCheckedChange={() => toggleSelect(candidate.id)}
                  />
                  
                  <Avatar className="h-10 w-10">
                    <AvatarImage src={candidate.avatar_url || undefined} />
                    <AvatarFallback>{getInitials(candidate.full_name)}</AvatarFallback>
                  </Avatar>
                  
                  <div className="flex-1 min-w-0">
                    <h4 className="font-medium truncate">{candidate.full_name}</h4>
                    <p className="text-sm text-muted-foreground truncate">
                      {candidate.current_title}
                      {candidate.current_company && ` at ${candidate.current_company}`}
                    </p>
                    {candidate.location && (
                      <p className="text-xs text-muted-foreground">{candidate.location}</p>
                    )}
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => window.open(candidate.linkedin_url!, '_blank')}
                    >
                      <ExternalLink className="h-4 w-4 mr-1" />
                      View
                    </Button>
                    <Button
                      size="sm"
                      onClick={() => setDialogCandidate(candidate)}
                    >
                      <UserPlus className="h-4 w-4 mr-1" />
                      Connect
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Send message dialog */}
      {dialogCandidate && (
        <SendLinkedInMessageDialog
          open={!!dialogCandidate}
          onOpenChange={(open) => !open && setDialogCandidate(null)}
          candidate={{
            id: dialogCandidate.id,
            full_name: dialogCandidate.full_name,
            linkedin_url: dialogCandidate.linkedin_url,
            current_title: dialogCandidate.current_title,
            current_company: dialogCandidate.current_company,
          }}
        />
      )}
    </div>
  );
}
