import { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { AppLayout } from '@/components/layout/AppLayout';
import { JobAIMatchSection } from '@/components/matching/JobAIMatchSection';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { GmailComposeModal } from '@/components/email/GmailComposeModal';
import { CandidateEmailsTab } from '@/components/email/CandidateEmailsTab';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

import { 
  ArrowLeft, 
  MapPin, 
  Mail, 
  Phone, 
  Calendar, 
  Sparkles, 
  FileText,
  Download,
  Loader2,
  StickyNote,
  MessageCircle,
  Linkedin,
  Inbox,
  Briefcase,
  Pencil,
  ChevronDown,
  FileDown,
  Stamp
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { motion } from 'framer-motion';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth';
import { toast } from 'sonner';
import { CandidateNotesPanel } from '@/components/candidates/CandidateNotesPanel';
import { CVSubmissionHistory } from '@/components/candidates/CVSubmissionHistory';
import { AddToJobDialog } from '@/components/candidates/AddToJobDialog';
import { getWhatsAppUrl, formatWhatsAppNumber } from '@/lib/whatsapp';
import { useBrandedDownload } from '@/hooks/useBrandedDownload';

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
  const { tenantId, isOwner, isManager } = useAuth();
  const { downloadBranded, isDownloading } = useBrandedDownload();
  const [candidate, setCandidate] = useState<Candidate | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [emailDialogOpen, setEmailDialogOpen] = useState(false);
  
  const [addToJobDialogOpen, setAddToJobDialogOpen] = useState(false);

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
    } catch (error) {
      console.error('Error fetching candidate:', error);
      toast.error('Failed to load candidate');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDownloadBrandedCV = async () => {
    if (!candidate?.cv_file_url) {
      toast.error('No CV file available for this candidate');
      return;
    }

    // Use branded download
    await downloadBranded({
      fileUrl: candidate.cv_file_url,
      documentType: 'cv',
      entityName: candidate.full_name
    });
  };

  const handleDownloadOriginalCV = async () => {
    if (!candidate?.cv_file_url) {
      toast.error('No CV file available for this candidate');
      return;
    }

    try {
      // Get the file from Supabase storage
      const { data, error } = await supabase.storage
        .from('documents')
        .download(candidate.cv_file_url.split('/documents/')[1] || candidate.cv_file_url);

      if (error) {
        // Try direct download if storage path fails
        const response = await fetch(candidate.cv_file_url);
        if (!response.ok) throw new Error('Failed to download file');
        const blob = await response.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${candidate.full_name.replace(/\s+/g, '_')}_CV_Original.pdf`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        toast.success('Original CV downloaded');
        return;
      }

      const url = URL.createObjectURL(data);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${candidate.full_name.replace(/\s+/g, '_')}_CV_Original.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast.success('Original CV downloaded');
    } catch (error: any) {
      console.error('Download error:', error);
      toast.error('Failed to download CV');
    }
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

            <div className="flex flex-col gap-3 w-full lg:w-auto">
              {/* Top row - Primary actions */}
              <div className="flex flex-wrap gap-2">
                <Button 
                  size="sm" 
                  variant="outline"
                  className="gap-2 h-10 px-4 rounded-lg transition-all duration-200 ease-out hover:border-primary/50 hover:bg-primary/5 hover:shadow-sm active:scale-[0.97]" 
                  onClick={() => navigate(`/candidates/${candidate.id}/edit`)}
                >
                  <Pencil className="w-4 h-4" />
                  Edit
                </Button>
                <Button 
                  size="sm" 
                  className="gap-2 h-10 px-4 rounded-lg transition-all duration-200 ease-out hover:shadow-md active:scale-[0.97]" 
                  onClick={() => setAddToJobDialogOpen(true)}
                >
                  <Briefcase className="w-4 h-4" />
                  Add to Job
                </Button>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button 
                      variant="outline" 
                      size="sm" 
                      className="gap-2 h-10 px-4 rounded-lg transition-all duration-200 ease-out hover:border-primary/50 hover:bg-primary/5 hover:shadow-sm active:scale-[0.97]" 
                      disabled={isDownloading || !candidate.cv_file_url}
                    >
                      {isDownloading ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Download className="w-4 h-4" />
                      )}
                      Download CV
                      <ChevronDown className="w-3.5 h-3.5 opacity-60" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-52 p-1.5">
                    <DropdownMenuItem 
                      onClick={handleDownloadBrandedCV}
                      className="gap-2.5 px-3 py-2.5 cursor-pointer rounded-md transition-colors"
                    >
                      <Stamp className="w-4 h-4 text-primary" />
                      <span>Branded CV</span>
                    </DropdownMenuItem>
                    <DropdownMenuItem 
                      onClick={handleDownloadOriginalCV}
                      className="gap-2.5 px-3 py-2.5 cursor-pointer rounded-md transition-colors"
                    >
                      <FileDown className="w-4 h-4 text-muted-foreground" />
                      <span>Original CV</span>
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>

              {/* Bottom row - Communication actions */}
              <div className="flex flex-wrap gap-2">
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="gap-2 h-10 px-4 rounded-lg transition-all duration-200 ease-out hover:border-info/50 hover:bg-info/5 hover:shadow-sm active:scale-[0.97]" 
                  onClick={() => setEmailDialogOpen(true)}
                >
                  <Mail className="w-4 h-4 text-info" />
                  Send Email
                </Button>
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      {formatWhatsAppNumber(candidate.phone) ? (
                        <a
                          href={getWhatsAppUrl(candidate.phone) || '#'}
                          target="_blank"
                          rel="noopener noreferrer"
                          className={cn(
                            "inline-flex items-center justify-center gap-2 h-10 px-4 rounded-lg border border-input bg-background text-sm font-medium transition-all duration-200 ease-out",
                            "hover:border-success/50 hover:bg-success/5 hover:shadow-sm active:scale-[0.97]"
                          )}
                        >
                          <MessageCircle className="w-4 h-4 text-success" />
                          WhatsApp
                        </a>
                      ) : (
                        <Button 
                          variant="outline" 
                          size="sm" 
                          className="gap-2 h-10 px-4 rounded-lg opacity-50 cursor-not-allowed"
                          onClick={() => toast.error('WhatsApp number not added')}
                        >
                          <MessageCircle className="w-4 h-4 text-success" />
                          WhatsApp
                        </Button>
                      )}
                    </TooltipTrigger>
                    <TooltipContent>
                      {formatWhatsAppNumber(candidate.phone) 
                        ? 'Opens WhatsApp if the number is registered' 
                        : 'WhatsApp number not added'}
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
                {candidate.linkedin_url && (
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="gap-2 h-10 px-4 rounded-lg transition-all duration-200 ease-out hover:border-[#0077B5]/50 hover:bg-[#0077B5]/5 hover:shadow-sm active:scale-[0.97]"
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
          <JobAIMatchSection
            candidateId={candidate.id}
            candidateName={candidate.full_name}
            candidateSkills={candidate.skills}
            candidateResume={candidate.summary}
          />
        </TabsContent>

        <TabsContent value="cv" className="mt-6">
          <div className="space-y-6">
            {/* CV Submission History */}
            <CVSubmissionHistory candidateId={candidate.id} />
            
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="bg-card rounded-xl border border-border p-6 shadow-sm"
            >
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-semibold">Resume</h3>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button 
                      variant="outline" 
                      size="sm" 
                      className="gap-1.5 transition-all duration-200 hover:shadow-sm" 
                      disabled={isDownloading || !candidate.cv_file_url}
                    >
                      {isDownloading ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Download className="w-4 h-4" />
                      )}
                      Download
                      <ChevronDown className="w-3.5 h-3.5 ml-1 opacity-60" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-48">
                    <DropdownMenuItem 
                      onClick={handleDownloadBrandedCV}
                      className="gap-2 cursor-pointer"
                    >
                      <Stamp className="w-4 h-4 text-primary" />
                      Download Branded CV
                    </DropdownMenuItem>
                    <DropdownMenuItem 
                      onClick={handleDownloadOriginalCV}
                      className="gap-2 cursor-pointer"
                    >
                      <FileDown className="w-4 h-4 text-muted-foreground" />
                      Download Original CV
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
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
          </div>
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
          <div className="space-y-6">
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

          </div>
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


      {/* Add to Job Dialog */}
      <AddToJobDialog
        open={addToJobDialogOpen}
        onOpenChange={setAddToJobDialogOpen}
        candidateId={candidate.id}
        candidateName={candidate.full_name}
      />
    </AppLayout>
  );
};

export default CandidateDetailPage;