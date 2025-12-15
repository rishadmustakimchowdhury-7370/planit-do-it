import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Mail,
  Sparkles,
  Send,
  Clock,
  Loader2,
  AlertCircle,
  FileText,
  ExternalLink,
  Calendar,
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth';
import { toast } from 'sonner';
import { format } from 'date-fns';

interface Candidate {
  id: string;
  full_name: string;
  email: string;
  phone?: string | null;
  current_title?: string | null;
}

interface Job {
  id: string;
  title: string;
  location?: string | null;
  clients?: { name: string } | null;
}

interface EmailTemplate {
  id: string;
  name: string;
  subject: string;
  body_text: string;
}

interface SendCandidateEmailModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  candidate: Candidate;
  preSelectedJobId?: string;
}

// Merge placeholders in text
const mergePlaceholders = (
  text: string,
  candidate: Candidate,
  job: Job | null,
  recruiterName: string
): string => {
  const today = format(new Date(), 'MMMM d, yyyy');
  return text
    .replace(/\{\{candidate_first_name\}\}/g, candidate.full_name.split(' ')[0])
    .replace(/\{\{candidate_last_name\}\}/g, candidate.full_name.split(' ').slice(1).join(' '))
    .replace(/\{\{candidate_email\}\}/g, candidate.email)
    .replace(/\{\{candidate_phone\}\}/g, candidate.phone || '')
    .replace(/\{\{job_title\}\}/g, job?.title || '[Job Title]')
    .replace(/\{\{company_name\}\}/g, job?.clients?.name || '[Company]')
    .replace(/\{\{recruiter_name\}\}/g, recruiterName)
    .replace(/\{\{location\}\}/g, job?.location || '')
    .replace(/\{\{today_date\}\}/g, today);
};

export function SendCandidateEmailModal({
  open,
  onOpenChange,
  candidate,
  preSelectedJobId,
}: SendCandidateEmailModalProps) {
  const { profile, tenantId } = useAuth();
  const [activeTab, setActiveTab] = useState<'compose' | 'ai'>('compose');
  
  // Form state
  const [toEmail, setToEmail] = useState(candidate.email);
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [appendSignature, setAppendSignature] = useState(true);
  const [signatureText, setSignatureText] = useState('');
  const [selectedJobId, setSelectedJobId] = useState<string | undefined>(preSelectedJobId);
  const [scheduleType, setScheduleType] = useState<'now' | 'later'>('now');
  const [scheduledAt, setScheduledAt] = useState('');
  
  // Data state
  const [templates, setTemplates] = useState<EmailTemplate[]>([]);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<string>('');
  const [selectedJob, setSelectedJob] = useState<Job | null>(null);
  
  // AI compose state
  const [aiPurpose, setAiPurpose] = useState<string>('job_pitch');
  const [aiTone, setAiTone] = useState<string>('friendly');
  const [aiLength, setAiLength] = useState<string>('medium');
  const [customInstructions, setCustomInstructions] = useState('');
  
  // Loading states
  const [isLoading, setIsLoading] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [isGeneratingAI, setIsGeneratingAI] = useState(false);

  // Initialize default signature per-open
  useEffect(() => {
    if (open) {
      const defaultSig = (profile?.email_signature || `${profile?.full_name || ''}\n${profile?.email || ''}`).trim();
      setSignatureText(defaultSig || '');
    }
  }, [open, profile]);
  useEffect(() => {
    if (open && tenantId) {
      fetchTemplates();
      fetchJobs();
      setToEmail(candidate.email);
    }
  }, [open, tenantId, candidate.email]);

  useEffect(() => {
    if (selectedJobId) {
      const job = jobs.find(j => j.id === selectedJobId);
      setSelectedJob(job || null);
    } else {
      setSelectedJob(null);
    }
  }, [selectedJobId, jobs]);

  const fetchTemplates = async () => {
    try {
      const { data, error } = await supabase
        .from('user_email_templates')
        .select('id, name, subject, body_text')
        .eq('is_active', true)
        .order('name');

      if (error) throw error;
      setTemplates(data || []);
    } catch (error) {
      console.error('Error fetching templates:', error);
    }
  };

  const fetchJobs = async () => {
    try {
      const { data, error } = await supabase
        .from('jobs')
        .select('id, title, location, clients(name)')
        .eq('status', 'open')
        .order('title');

      if (error) throw error;
      setJobs(data || []);
      
      if (preSelectedJobId) {
        const job = data?.find(j => j.id === preSelectedJobId);
        setSelectedJob(job || null);
      }
    } catch (error) {
      console.error('Error fetching jobs:', error);
    }
  };

  const handleTemplateSelect = (templateId: string) => {
    setSelectedTemplate(templateId);
    const template = templates.find(t => t.id === templateId);
    if (template) {
      const recruiterName = profile?.full_name || 'Recruiter';
      setSubject(mergePlaceholders(template.subject, candidate, selectedJob, recruiterName));
      setBody(mergePlaceholders(template.body_text, candidate, selectedJob, recruiterName));
    }
  };

  const handleGenerateAI = async () => {
    if (!selectedJob) {
      toast.error('Please select a job first');
      return;
    }

    setIsGeneratingAI(true);
    try {
      const { data, error } = await supabase.functions.invoke('ai-compose-email', {
        body: {
          candidate_first_name: candidate.full_name.split(' ')[0],
          candidate_last_name: candidate.full_name.split(' ').slice(1).join(' '),
          job_title: selectedJob.title,
          location: selectedJob.location,
          company_name: selectedJob.clients?.name,
          recruiter_name: profile?.full_name || 'Recruiter',
          purpose: aiPurpose,
          tone: aiTone,
          length: aiLength,
          custom_instructions: customInstructions,
        },
      });

      if (error) throw error;

      if (data?.email_body) {
        setBody(data.email_body);
        // Auto-generate subject based on purpose
        const subjectMap: Record<string, string> = {
          job_pitch: `Exciting ${selectedJob.title} Opportunity`,
          interview_invite: `Interview Invitation - ${selectedJob.title}`,
          screening_call: `Phone Screen Request - ${selectedJob.title}`,
          follow_up: `Following Up - ${selectedJob.title}`,
          offer: `Job Offer - ${selectedJob.title}`,
          rejection: `Update on Your Application - ${selectedJob.title}`,
        };
        if (!subject) {
          setSubject(subjectMap[aiPurpose] || `Re: ${selectedJob.title}`);
        }
        setActiveTab('compose');
        toast.success('AI email generated! You can edit it before sending.');
      }
    } catch (error: any) {
      console.error('Error generating AI email:', error);
      toast.error(error.message || 'Failed to generate email');
    } finally {
      setIsGeneratingAI(false);
    }
  };

  const handleSend = async () => {
    if (!subject.trim()) {
      toast.error('Please enter a subject');
      return;
    }
    if (!body.trim()) {
      toast.error('Please enter a message');
      return;
    }

    setIsSending(true);
    try {
      const { data, error } = await supabase.functions.invoke('send-candidate-email', {
        body: {
          candidate_id: candidate.id,
          job_id: selectedJobId,
          from_email: profile?.email || 'noreply@recruitsy.net',
          to_email: toEmail,
          subject,
          body_text: body,
          template_id: selectedTemplate || null,
          ai_generated: false,
          scheduled_at: scheduleType === 'later' ? scheduledAt : null,
          signature: appendSignature ? signatureText : null,
        },
      });

      if (error) throw error;

      if (data?.success) {
        if (scheduleType === 'later') {
          toast.success(`Email scheduled for ${format(new Date(scheduledAt), 'PPp')}`);
        } else {
          toast.success(`Email sent successfully to ${toEmail}`);
        }
        onOpenChange(false);
        resetForm();
      } else {
        throw new Error(data?.error || 'Failed to send email');
      }
    } catch (error: any) {
      console.error('Error sending email:', error);
      toast.error(error.message || 'Failed to send email');
    } finally {
      setIsSending(false);
    }
  };

  const handleMailtoFallback = () => {
    const signature = appendSignature && signatureText
      ? `\n\n${signatureText}`
      : '';
    const finalBody = body + signature;
    const mailtoUrl = `mailto:${toEmail}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(finalBody)}`;
    window.open(mailtoUrl, '_blank');
    toast.info('Opening your email client...');
  };

  const resetForm = () => {
    setSubject('');
    setBody('');
    setSelectedTemplate('');
    setSelectedJobId(preSelectedJobId);
    setScheduleType('now');
    setScheduledAt('');
    setActiveTab('compose');
  };

  const placeholders = [
    '{{candidate_first_name}}',
    '{{candidate_last_name}}',
    '{{job_title}}',
    '{{company_name}}',
    '{{recruiter_name}}',
    '{{location}}',
    '{{today_date}}',
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5 text-primary" />
            Send Email to {candidate.full_name}
          </DialogTitle>
          <DialogDescription>
            Compose an email using templates or AI, then send or schedule it.
          </DialogDescription>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'compose' | 'ai')}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="compose" className="gap-2">
              <FileText className="h-4 w-4" />
              Compose
            </TabsTrigger>
            <TabsTrigger value="ai" className="gap-2">
              <Sparkles className="h-4 w-4" />
              AI Compose
            </TabsTrigger>
          </TabsList>

          <TabsContent value="compose" className="space-y-4 mt-4">
            {/* From Email - User's registered email */}
            <div className="space-y-2">
              <Label>From</Label>
              <div className="flex items-center gap-2 px-3 py-2 bg-muted/50 rounded-md border">
                <Mail className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium">{profile?.email || 'Your email'}</span>
                <Badge variant="secondary" className="ml-auto text-xs">Reply-to</Badge>
              </div>
              <p className="text-xs text-muted-foreground">
                Emails will be sent from RecruitifyCRM with your email as reply-to address
              </p>
            </div>

            {/* To Email */}
            <div className="space-y-2">
              <Label htmlFor="to">To</Label>
              <Input
                id="to"
                type="email"
                value={toEmail}
                onChange={(e) => setToEmail(e.target.value)}
                placeholder="candidate@email.com"
              />
            </div>

            {/* Job Selector */}
            <div className="space-y-2">
              <Label>Job (optional)</Label>
              <Select value={selectedJobId || ''} onValueChange={setSelectedJobId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a job..." />
                </SelectTrigger>
                <SelectContent>
                  {jobs.map((job) => (
                    <SelectItem key={job.id} value={job.id}>
                      {job.title} {job.clients?.name ? `at ${job.clients.name}` : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Template Selector */}
            <div className="space-y-2">
              <Label>Template (optional)</Label>
              <Select value={selectedTemplate} onValueChange={handleTemplateSelect}>
                <SelectTrigger>
                  <SelectValue placeholder="Choose a template..." />
                </SelectTrigger>
                <SelectContent>
                  {templates.map((template) => (
                    <SelectItem key={template.id} value={template.id}>
                      {template.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Subject */}
            <div className="space-y-2">
              <Label htmlFor="subject">Subject</Label>
              <Input
                id="subject"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="Email subject..."
              />
            </div>

            {/* Body */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="body">Message</Label>
                <div className="flex flex-wrap gap-1">
                  {placeholders.slice(0, 4).map((p) => (
                    <Badge
                      key={p}
                      variant="outline"
                      className="text-xs cursor-pointer hover:bg-muted"
                      onClick={() => setBody(body + ' ' + p)}
                    >
                      {p.replace(/\{\{|\}\}/g, '')}
                    </Badge>
                  ))}
                </div>
              </div>
              <Textarea
                id="body"
                value={body}
                onChange={(e) => setBody(e.target.value)}
                placeholder="Write your message here..."
                rows={8}
                className="resize-none"
              />
            </div>

            {/* Signature Toggle */}
            <div className="space-y-2">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="signature"
                  checked={appendSignature}
                  onCheckedChange={(checked) => setAppendSignature(checked as boolean)}
                />
                <Label htmlFor="signature" className="text-sm font-normal">
                  Append and edit email signature
                </Label>
              </div>
              {appendSignature && (
                <div className="ml-6 space-y-2">
                  <Textarea
                    value={signatureText}
                    onChange={(e) => setSignatureText(e.target.value)}
                    rows={4}
                    className="resize-none"
                    placeholder="Your name\nYour title\nYour company\nYour contact details"
                  />
                  <p className="text-xs text-muted-foreground">
                    This signature applies only to this email. Configure a default signature in Settings.
                  </p>
                </div>
              )}
            </div>

            <Separator />

            {/* Schedule Options */}
            <div className="space-y-3">
              <Label>When to send</Label>
              <div className="flex gap-4">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="schedule"
                    checked={scheduleType === 'now'}
                    onChange={() => setScheduleType('now')}
                    className="text-primary"
                  />
                  <span className="text-sm">Send now</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="schedule"
                    checked={scheduleType === 'later'}
                    onChange={() => setScheduleType('later')}
                    className="text-primary"
                  />
                  <span className="text-sm">Schedule for later</span>
                </label>
              </div>
              {scheduleType === 'later' && (
                <Input
                  type="datetime-local"
                  value={scheduledAt}
                  onChange={(e) => setScheduledAt(e.target.value)}
                  min={format(new Date(), "yyyy-MM-dd'T'HH:mm")}
                />
              )}
            </div>
          </TabsContent>

          <TabsContent value="ai" className="space-y-4 mt-4">
            <div className="bg-muted/50 rounded-lg p-4 space-y-4">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <AlertCircle className="h-4 w-4" />
                Select a job first to generate a relevant email.
              </div>

              {/* Job Selector for AI */}
              <div className="space-y-2">
                <Label>Job *</Label>
                <Select value={selectedJobId || ''} onValueChange={setSelectedJobId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a job..." />
                  </SelectTrigger>
                  <SelectContent>
                    {jobs.map((job) => (
                      <SelectItem key={job.id} value={job.id}>
                        {job.title} {job.clients?.name ? `at ${job.clients.name}` : ''}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Purpose */}
              <div className="space-y-2">
                <Label>Purpose</Label>
                <Select value={aiPurpose} onValueChange={setAiPurpose}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="job_pitch">Job Pitch</SelectItem>
                    <SelectItem value="screening_call">Screening Call Invite</SelectItem>
                    <SelectItem value="interview_invite">Interview Invitation</SelectItem>
                    <SelectItem value="follow_up">Follow Up</SelectItem>
                    <SelectItem value="offer">Job Offer</SelectItem>
                    <SelectItem value="rejection">Polite Rejection</SelectItem>
                    <SelectItem value="custom">Custom</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Tone */}
              <div className="space-y-2">
                <Label>Tone</Label>
                <Select value={aiTone} onValueChange={setAiTone}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="brief">Brief & Direct</SelectItem>
                    <SelectItem value="formal">Professional & Formal</SelectItem>
                    <SelectItem value="friendly">Warm & Friendly</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Length */}
              <div className="space-y-2">
                <Label>Length</Label>
                <Select value={aiLength} onValueChange={setAiLength}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="short">Short (2-3 sentences)</SelectItem>
                    <SelectItem value="medium">Medium (1-2 paragraphs)</SelectItem>
                    <SelectItem value="long">Long (2-3 paragraphs)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Custom Instructions */}
              {aiPurpose === 'custom' && (
                <div className="space-y-2">
                  <Label>Custom Instructions</Label>
                  <Textarea
                    value={customInstructions}
                    onChange={(e) => setCustomInstructions(e.target.value)}
                    placeholder="Describe what you want the email to convey..."
                    rows={3}
                  />
                </div>
              )}

              <Button
                onClick={handleGenerateAI}
                disabled={!selectedJobId || isGeneratingAI}
                className="w-full gap-2"
              >
                {isGeneratingAI ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Generating...
                  </>
                ) : (
                  <>
                    <Sparkles className="h-4 w-4" />
                    Generate Email with AI
                  </>
                )}
              </Button>
            </div>
          </TabsContent>
        </Tabs>

        {/* Actions */}
        <div className="flex items-center justify-between pt-4 border-t">
          <Button variant="outline" onClick={handleMailtoFallback} className="gap-2">
            <ExternalLink className="h-4 w-4" />
            Open in Mail App
          </Button>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button onClick={handleSend} disabled={isSending} className="gap-2">
              {isSending ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Sending...
                </>
              ) : scheduleType === 'later' ? (
                <>
                  <Clock className="h-4 w-4" />
                  Schedule
                </>
              ) : (
                <>
                  <Send className="h-4 w-4" />
                  Send Email
                </>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
