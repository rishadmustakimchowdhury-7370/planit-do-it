import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { MatchScoreCircle } from '@/components/matching/MatchScoreCircle';
import { SendEmailDialog } from '@/components/communication/SendEmailDialog';
import { SendWhatsAppDialog } from '@/components/communication/SendWhatsAppDialog';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth';
import { toast } from 'sonner';
import { 
  Sparkles, 
  Mail, 
  MessageCircle, 
  UserPlus, 
  Loader2, 
  MapPin,
  ChevronDown,
  ChevronUp
} from 'lucide-react';
import { openWhatsAppChat, formatWhatsAppNumber } from '@/lib/whatsapp';
import { cn } from '@/lib/utils';

interface Candidate {
  id: string;
  full_name: string;
  email: string;
  phone: string | null;
  current_title: string | null;
  location: string | null;
  avatar_url: string | null;
  skills: string[];
  matchScore: number;
}

interface SuggestedCandidatesProps {
  jobId: string;
  jobTitle: string;
  jobDescription: string | null;
  jobSkills: string[];
  onCandidateAdded: () => void;
}

export function SuggestedCandidates({ 
  jobId, 
  jobTitle, 
  jobDescription, 
  jobSkills,
  onCandidateAdded 
}: SuggestedCandidatesProps) {
  const { tenantId } = useAuth();
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState(true);
  const [addingCandidate, setAddingCandidate] = useState<string | null>(null);
  const [emailDialog, setEmailDialog] = useState<{ open: boolean; candidate: Candidate | null }>({
    open: false,
    candidate: null,
  });
  const [whatsAppDialog, setWhatsAppDialog] = useState<{ open: boolean; candidate: Candidate | null }>({
    open: false,
    candidate: null,
  });

  useEffect(() => {
    if (jobId && tenantId) {
      findMatchingCandidates();
    }
  }, [jobId, tenantId]);

  const calculateMatchScore = (candidateSkills: string[], candidateTitle: string | null): number => {
    let score = 0;
    const totalPoints = 100;
    
    // Skill matching (60% weight)
    if (candidateSkills.length > 0 && jobSkills.length > 0) {
      const matchedSkills = candidateSkills.filter(skill => 
        jobSkills.some(jSkill => 
          jSkill.toLowerCase().includes(skill.toLowerCase()) ||
          skill.toLowerCase().includes(jSkill.toLowerCase())
        )
      );
      score += (matchedSkills.length / Math.max(jobSkills.length, 1)) * 60;
    }
    
    // Title matching (40% weight)
    if (candidateTitle && jobTitle) {
      const titleWords = jobTitle.toLowerCase().split(/\s+/);
      const candidateTitleWords = candidateTitle.toLowerCase().split(/\s+/);
      const matchedWords = titleWords.filter(word => 
        candidateTitleWords.some(cWord => cWord.includes(word) || word.includes(cWord))
      );
      score += (matchedWords.length / Math.max(titleWords.length, 1)) * 40;
    }
    
    return Math.min(Math.round(score), 100);
  };

  const findMatchingCandidates = async () => {
    setLoading(true);
    try {
      // Get all candidates not already in this job
      const { data: existingJobCandidates } = await supabase
        .from('job_candidates')
        .select('candidate_id')
        .eq('job_id', jobId);

      const existingIds = existingJobCandidates?.map(jc => jc.candidate_id) || [];

      const { data: allCandidates, error } = await supabase
        .from('candidates')
        .select('id, full_name, email, phone, current_title, location, avatar_url, skills')
        .eq('tenant_id', tenantId);

      if (error) throw error;

      // Filter and score candidates
      const scoredCandidates = (allCandidates || [])
        .filter(c => !existingIds.includes(c.id))
        .map(candidate => {
          const skills = Array.isArray(candidate.skills) ? candidate.skills as string[] : [];
          const matchScore = calculateMatchScore(skills, candidate.current_title);
          return {
            ...candidate,
            skills,
            matchScore,
          };
        })
        .filter(c => c.matchScore >= 60) // Only show 60%+ matches
        .sort((a, b) => b.matchScore - a.matchScore)
        .slice(0, 10); // Limit to top 10

      setCandidates(scoredCandidates);
    } catch (error) {
      console.error('Error finding matching candidates:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAddToJob = async (candidate: Candidate) => {
    setAddingCandidate(candidate.id);
    try {
      const { error } = await supabase.from('job_candidates').insert({
        job_id: jobId,
        candidate_id: candidate.id,
        tenant_id: tenantId,
        stage: 'applied',
        match_score: candidate.matchScore,
      });

      if (error) throw error;

      toast.success(`${candidate.full_name} added to job`);
      setCandidates(prev => prev.filter(c => c.id !== candidate.id));
      onCandidateAdded();
    } catch (error: any) {
      toast.error('Failed to add candidate: ' + error.message);
    } finally {
      setAddingCandidate(null);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="py-8 text-center">
          <Loader2 className="h-6 w-6 animate-spin mx-auto text-primary" />
          <p className="text-sm text-muted-foreground mt-2">Finding matching candidates...</p>
        </CardContent>
      </Card>
    );
  }

  if (candidates.length === 0) {
    return null;
  }

  return (
    <>
      <Card>
        <CardHeader className="cursor-pointer" onClick={() => setExpanded(!expanded)}>
          <CardTitle className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-accent" />
              Suggested Candidates ({candidates.length})
            </div>
            <Button variant="ghost" size="icon">
              {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </Button>
          </CardTitle>
        </CardHeader>
        {expanded && (
          <CardContent>
            <div className="space-y-3">
              {candidates.map((candidate) => (
                <div 
                  key={candidate.id}
                  className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors"
                >
                  <div className="flex items-center gap-4">
                    <Avatar className="h-12 w-12">
                      <AvatarImage src={candidate.avatar_url || ''} alt={candidate.full_name} />
                      <AvatarFallback className="bg-accent/10 text-accent">
                        {candidate.full_name.split(' ').map(n => n[0]).join('').toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <h4 className="font-medium">{candidate.full_name}</h4>
                      <p className="text-sm text-muted-foreground">{candidate.current_title}</p>
                      {candidate.location && (
                        <p className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
                          <MapPin className="h-3 w-3" />
                          {candidate.location}
                        </p>
                      )}
                      <div className="flex flex-wrap gap-1 mt-2">
                        {candidate.skills.slice(0, 3).map((skill) => (
                          <Badge key={skill} variant="secondary" className="text-xs">
                            {skill}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <MatchScoreCircle score={candidate.matchScore} size="sm" />
                    <div className="flex gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setEmailDialog({ open: true, candidate })}
                        title="Send Email"
                      >
                        <Mail className="h-4 w-4 text-info" />
                      </Button>
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className={cn(
                                "transition-all duration-200",
                                formatWhatsAppNumber(candidate.phone) 
                                  ? "hover:bg-green-100 hover:text-green-600 active:scale-95" 
                                  : "opacity-50 cursor-not-allowed"
                              )}
                              onClick={() => {
                                if (!formatWhatsAppNumber(candidate.phone)) {
                                  toast.error('WhatsApp number not added');
                                  return;
                                }
                                openWhatsAppChat(candidate.phone);
                              }}
                            >
                              <MessageCircle className="h-4 w-4 text-green-500" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>
                            {formatWhatsAppNumber(candidate.phone) 
                              ? 'Open WhatsApp chat' 
                              : 'WhatsApp number not added'}
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                      <Button
                        size="sm"
                        onClick={() => handleAddToJob(candidate)}
                        disabled={addingCandidate === candidate.id}
                      >
                        {addingCandidate === candidate.id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <>
                            <UserPlus className="h-4 w-4 mr-1" />
                            Add
                          </>
                        )}
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        )}
      </Card>

      {emailDialog.candidate && (
        <SendEmailDialog
          open={emailDialog.open}
          onOpenChange={(open) => setEmailDialog({ open, candidate: open ? emailDialog.candidate : null })}
          recipientEmail={emailDialog.candidate.email}
          recipientName={emailDialog.candidate.full_name}
          context="job"
          contextData={{ jobTitle, candidateName: emailDialog.candidate.full_name }}
        />
      )}

      {whatsAppDialog.candidate && whatsAppDialog.candidate.phone && (
        <SendWhatsAppDialog
          open={whatsAppDialog.open}
          onOpenChange={(open) => setWhatsAppDialog({ open, candidate: open ? whatsAppDialog.candidate : null })}
          recipientPhone={whatsAppDialog.candidate.phone}
          recipientName={whatsAppDialog.candidate.full_name}
          context="job"
          contextData={{ jobTitle, candidateName: whatsAppDialog.candidate.full_name }}
        />
      )}
    </>
  );
}
