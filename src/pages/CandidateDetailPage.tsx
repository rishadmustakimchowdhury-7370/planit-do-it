import { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { AppLayout } from '@/components/layout/AppLayout';
import { MatchScoreCircle } from '@/components/matching/MatchScoreCircle';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { GmailComposeModal } from '@/components/email/GmailComposeModal';
import { CandidateEmailsTab } from '@/components/email/CandidateEmailsTab';
import { SendWhatsAppDialog } from '@/components/communication/SendWhatsAppDialog';
import { 
  ArrowLeft, 
  MapPin, 
  Mail, 
  Phone, 
  Calendar, 
  Sparkles, 
  FileText,
  Download,
  CheckCircle,
  XCircle,
  AlertCircle,
  Loader2,
  StickyNote,
  MessageCircle,
  Linkedin,
  Inbox
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { motion } from 'framer-motion';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth';
import { toast } from 'sonner';
import { CandidateNotesPanel } from '@/components/candidates/CandidateNotesPanel';
import { openWhatsAppChat, formatWhatsAppNumber } from '@/lib/whatsapp';

interface Candidate {
  id: string;
  full_name: string;
  email: string;
  phone: string | null;
  location: string | null;
  current_title: string | null;
  current_company: string | null;
  linkedin_url: string | null;
  avatar_url: string | null;
  cv_file_url: string | null;
  summary: string | null;
  skills: string[] | null;
  experience_years: number | null;
  status: string;
  created_at: string;
  notes: string | null;
  private_notes: string | null;
}

interface JobCandidate {
  id: string;
  job_id: string;
  match_score: number | null;
  match_strengths: string[] | null;
  match_gaps: string[] | null;
  match_explanation: string | null;
  stage: string;
}

const statusColors: Record<string, string> = {
  new: 'bg-muted text-muted-foreground',
  screening: 'bg-info/10 text-info border-info/30',
  interviewing: 'bg-accent/10 text-accent border-accent/30',
  offered: 'bg-warning/10 text-warning border-warning/30',
  hired: 'bg-success/20 text-success border-success/40',
  rejected: 'bg-destructive/10 text-destructive border-destructive/30',
  withdrawn: 'bg-muted text-muted-foreground',
};

const CandidateDetailPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { tenantId } = useAuth();
  const [candidate, setCandidate] = useState<Candidate | null>(null);
  const [jobCandidate, setJobCandidate] = useState<JobCandidate | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRunningMatch, setIsRunningMatch] = useState(false);
  const [emailDialogOpen, setEmailDialogOpen] = useState(false);
  const [whatsAppDialogOpen, setWhatsAppDialogOpen] = useState(false);

  useEffect(() => {
    if (id && tenantId) {
      fetchCandidate();
    }
  }, [id, tenantId]);

  const fetchCandidate = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('candidates')
        .select('*')
        .eq('id', id)
        .single();

      if (error) throw error;

      setCandidate({
        ...data,
        skills: Array.isArray(data.skills) ? data.skills as string[] : null,
      });

      // Fetch job_candidates for match data
      const { data: jcData } = await supabase
        .from('job_candidates')
        .select('*')
        .eq('candidate_id', id)
        .order('match_score', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (jcData) {
        setJobCandidate({
          ...jcData,
          match_strengths: Array.isArray(jcData.match_strengths) ? jcData.match_strengths as string[] : null,
          match_gaps: Array.isArray(jcData.match_gaps) ? jcData.match_gaps as string[] : null,
        });
      }
    } catch (error) {
      console.error('Error fetching candidate:', error);
      toast.error('Failed to load candidate');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDownloadCV = async () => {
    if (!candidate?.cv_file_url) {
      toast.error('No CV file available for this candidate');
      return;
    }

    try {
      // Extract just the file path from the URL if it's a full URL
      let filePath = candidate.cv_file_url;
      
      // If it's a full URL, extract the path after /documents/
      if (filePath.includes('/documents/')) {
        filePath = filePath.split('/documents/').pop() || filePath;
      }
      
      // Remove any query parameters
      filePath = filePath.split('?')[0];

      const { data, error } = await supabase.storage
        .from('documents')
        .download(filePath);

      if (error) {
        console.error('Download error:', error);
        throw error;
      }

      // Determine file extension from original path
      const extension = filePath.split('.').pop() || 'pdf';
      
      // Create download link
      const url = URL.createObjectURL(data);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${candidate.full_name.replace(/\s+/g, '_')}_CV.${extension}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      toast.success('CV downloaded successfully');
    } catch (error: any) {
      console.error('Error downloading CV:', error);
      toast.error(error.message || 'Failed to download CV. The file may not exist.');
    }
  };

  const handleRunAIMatch = () => {
    navigate(`/ai-match?candidateId=${id}`);
  };

  if (isLoading) {
    return (
      <AppLayout>
        <div className="space-y-6">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-48 w-full" />
          <Skeleton className="h-64 w-full" />
        </div>
      </AppLayout>
    );
  }

  if (!candidate) {
    return (
      <AppLayout title="Candidate Not Found">
        <div className="text-center py-12">
          <p className="text-muted-foreground">This candidate doesn't exist.</p>
          <Link to="/candidates" className="text-accent hover:underline mt-2 inline-block">
            Back to Candidates
          </Link>
        </div>
      </AppLayout>
    );
  }

  const matchScore = jobCandidate?.match_score || null;

  return (
    <AppLayout title={candidate.full_name} subtitle={candidate.current_title || undefined}>
      {/* Header */}
      <div className="mb-6">
        <Link 
          to="/candidates" 
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors mb-4"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Candidates
        </Link>

        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-card rounded-xl border border-border p-6 shadow-sm"
        >
          <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-6">
            <div className="flex items-start gap-4">
              <Avatar className="w-20 h-20">
                <AvatarImage src={candidate.avatar_url || ''} alt={candidate.full_name} />
                <AvatarFallback className="text-2xl bg-accent/10 text-accent">
                  {candidate.full_name.split(' ').map(n => n[0]).join('').toUpperCase()}
                </AvatarFallback>
              </Avatar>
              
              <div>
                <div className="flex items-center gap-3 flex-wrap">
                  <h1 className="text-2xl font-bold text-foreground">{candidate.full_name}</h1>
                  <Badge 
                    variant="outline" 
                    className={cn('capitalize', statusColors[candidate.status] || statusColors.new)}
                  >
                    {candidate.status}
                  </Badge>
                </div>
                {candidate.current_title && (
                  <p className="text-accent text-lg mt-1">
                    {candidate.current_title}
                    {candidate.current_company && ` at ${candidate.current_company}`}
                  </p>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-4">
                  {candidate.location && (
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <MapPin className="w-4 h-4 text-accent" />
                      <span className="text-sm">{candidate.location}</span>
                    </div>
                  )}
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Mail className="w-4 h-4 text-info" />
                    <span className="text-sm">{candidate.email}</span>
                  </div>
                  {candidate.phone && (
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Phone className="w-4 h-4 text-success" />
                      <span className="text-sm">{candidate.phone}</span>
                    </div>
                  )}
                </div>

                {candidate.skills && candidate.skills.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mt-4">
                    {candidate.skills.map((skill) => (
                      <Badge key={skill} variant="secondary" className="text-xs">
                        {skill}
                      </Badge>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="flex flex-col items-center gap-3">
              {matchScore && (
                <MatchScoreCircle score={matchScore} size="lg" />
              )}
              <div className="flex flex-wrap gap-2">
                <Button variant="outline" size="sm" className="gap-1.5" onClick={handleDownloadCV}>
                  <Download className="w-4 h-4" />
                  Download CV
                </Button>
                <Button size="sm" className="gap-1.5" onClick={handleRunAIMatch}>
                  <Sparkles className="w-4 h-4" />
                  Run AI Match
                </Button>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setEmailDialogOpen(true)}>
                  <Mail className="w-4 h-4" />
                  Send Email
                </Button>
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button 
                        variant="outline" 
                        size="sm" 
                        className={cn(
                          "gap-1.5 transition-all duration-200",
                          formatWhatsAppNumber(candidate.phone) 
                            ? "hover:bg-green-50 hover:border-green-300 active:scale-95" 
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
                        <MessageCircle className="w-4 h-4 text-green-500" />
                        WhatsApp
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                      {formatWhatsAppNumber(candidate.phone) 
                        ? `Open WhatsApp: ${candidate.phone}` 
                        : 'WhatsApp number not added'}
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
                {candidate.linkedin_url && (
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="gap-1.5"
                    onClick={() => window.open(candidate.linkedin_url!, '_blank')}
                  >
                    <Linkedin className="w-4 h-4 text-[#0077B5]" />
                    LinkedIn
                  </Button>
                )}
              </div>
            </div>
          </div>
        </motion.div>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="match" className="w-full">
        <TabsList className="bg-muted/50 p-1">
          <TabsTrigger value="match" className="gap-2">
            <Sparkles className="w-4 h-4" />
            AI Match Analysis
          </TabsTrigger>
          <TabsTrigger value="emails" className="gap-2">
            <Inbox className="w-4 h-4" />
            Emails
          </TabsTrigger>
          <TabsTrigger value="cv" className="gap-2">
            <FileText className="w-4 h-4" />
            CV & Experience
          </TabsTrigger>
          <TabsTrigger value="notes" className="gap-2">
            <StickyNote className="w-4 h-4" />
            Notes
          </TabsTrigger>
          <TabsTrigger value="activity" className="gap-2">
            <Calendar className="w-4 h-4" />
            Activity
          </TabsTrigger>
        </TabsList>

        <TabsContent value="emails" className="mt-6">
          <CandidateEmailsTab 
            candidateId={candidate.id} 
            onComposeClick={() => setEmailDialogOpen(true)} 
          />
        </TabsContent>

        <TabsContent value="match" className="mt-6">
          {jobCandidate && jobCandidate.match_score ? (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Score Summary */}
              <motion.div 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="lg:col-span-1 bg-card rounded-xl border border-border p-6 text-center"
              >
                <h3 className="text-lg font-semibold mb-4">Match Score</h3>
                <div className="flex justify-center mb-4">
                  <MatchScoreCircle score={jobCandidate.match_score} size="lg" />
                </div>
                {jobCandidate.match_explanation && (
                  <p className="text-sm text-muted-foreground">{jobCandidate.match_explanation}</p>
                )}
              </motion.div>

              {/* Strengths & Gaps */}
              <motion.div 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
                className="lg:col-span-2 space-y-4"
              >
                {/* Strengths */}
                <div className="bg-card rounded-xl border border-border p-6">
                  <h3 className="text-lg font-semibold flex items-center gap-2 mb-4">
                    <CheckCircle className="w-5 h-5 text-success" />
                    Strengths
                  </h3>
                  {jobCandidate.match_strengths && jobCandidate.match_strengths.length > 0 ? (
                    <ul className="space-y-2">
                      {jobCandidate.match_strengths.map((strength, i) => (
                        <li key={i} className="flex items-start gap-2 text-sm text-muted-foreground">
                          <span className="w-1.5 h-1.5 rounded-full bg-success mt-2 flex-shrink-0" />
                          {strength}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-sm text-muted-foreground">No strengths data available.</p>
                  )}
                </div>

                {/* Skill Gaps */}
                <div className="bg-card rounded-xl border border-border p-6">
                  <h3 className="text-lg font-semibold flex items-center gap-2 mb-4">
                    <XCircle className="w-5 h-5 text-destructive" />
                    Skill Gaps
                  </h3>
                  {jobCandidate.match_gaps && jobCandidate.match_gaps.length > 0 ? (
                    <div className="flex flex-wrap gap-2">
                      {jobCandidate.match_gaps.map((gap, i) => (
                        <Badge key={i} variant="outline" className="bg-destructive/10 text-destructive border-destructive/30">
                          {gap}
                        </Badge>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">No skill gaps identified.</p>
                  )}
                </div>
              </motion.div>
            </div>
          ) : (
            <div className="bg-card rounded-xl border border-border p-12 text-center">
              <Sparkles className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">No AI Match Results</h3>
              <p className="text-muted-foreground mb-4">Run an AI match to see how this candidate fits your jobs.</p>
              <Button className="gap-2" onClick={handleRunAIMatch}>
                <Sparkles className="w-4 h-4" />
                Run AI Match
              </Button>
            </div>
          )}
        </TabsContent>

        <TabsContent value="cv" className="mt-6">
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="bg-card rounded-xl border border-border p-6 shadow-sm"
          >
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-semibold">Resume</h3>
              <Button variant="outline" size="sm" className="gap-1.5" onClick={handleDownloadCV}>
                <Download className="w-4 h-4" />
                Download
              </Button>
            </div>
            <div className="prose prose-sm max-w-none text-muted-foreground">
              {candidate.summary && (
                <>
                  <h4>Summary</h4>
                  <p>{candidate.summary}</p>
                </>
              )}
              
              <h4>Experience</h4>
              <p>
                <strong>{candidate.current_title || 'Professional'}</strong>
                {candidate.current_company && ` at ${candidate.current_company}`}
                {candidate.experience_years && ` - ${candidate.experience_years} years of experience`}
              </p>
              
              {candidate.skills && candidate.skills.length > 0 && (
                <>
                  <h4>Skills</h4>
                  <div className="flex flex-wrap gap-2 not-prose">
                    {candidate.skills.map((skill) => (
                      <Badge key={skill} variant="secondary">
                        {skill}
                      </Badge>
                    ))}
                  </div>
                </>
              )}
            </div>
          </motion.div>
        </TabsContent>

        <TabsContent value="notes" className="mt-6">
          <CandidateNotesPanel
            candidateId={candidate.id}
            candidateName={candidate.full_name}
            existingNotes={candidate.notes}
            privateNotes={candidate.private_notes}
            onNotesUpdate={fetchCandidate}
          />
        </TabsContent>

        <TabsContent value="activity" className="mt-6">
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="bg-card rounded-xl border border-border p-6 shadow-sm"
          >
            <h3 className="text-lg font-semibold mb-4">Activity Timeline</h3>
            <div className="space-y-4">
              <div className="flex items-start gap-3">
                <div className="w-2 h-2 rounded-full bg-accent mt-2" />
                <div>
                  <p className="text-sm font-medium">Status: {candidate.status}</p>
                  <p className="text-xs text-muted-foreground">Current status</p>
                </div>
              </div>
              {matchScore && (
                <div className="flex items-start gap-3">
                  <div className="w-2 h-2 rounded-full bg-info mt-2" />
                  <div>
                    <p className="text-sm font-medium">AI Match completed - {matchScore}% match</p>
                    <p className="text-xs text-muted-foreground">Match score calculated</p>
                  </div>
                </div>
              )}
              <div className="flex items-start gap-3">
                <div className="w-2 h-2 rounded-full bg-success mt-2" />
                <div>
                  <p className="text-sm font-medium">Candidate added</p>
                  <p className="text-xs text-muted-foreground">
                    {new Date(candidate.created_at).toLocaleDateString()}
                  </p>
                </div>
              </div>
            </div>
          </motion.div>
        </TabsContent>
      </Tabs>

      {/* Email Modal */}
      <GmailComposeModal
        open={emailDialogOpen}
        onOpenChange={setEmailDialogOpen}
        candidate={{
          id: candidate.id,
          full_name: candidate.full_name,
          email: candidate.email,
          phone: candidate.phone,
          current_title: candidate.current_title,
        }}
      />

      {/* WhatsApp Dialog */}
      {candidate.phone && (
        <SendWhatsAppDialog
          open={whatsAppDialogOpen}
          onOpenChange={setWhatsAppDialogOpen}
          recipientPhone={candidate.phone}
          recipientName={candidate.full_name}
          context="candidate"
          contextData={{ candidateName: candidate.full_name }}
        />
      )}
    </AppLayout>
  );
};

export default CandidateDetailPage;