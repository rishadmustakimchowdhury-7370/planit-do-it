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
import { Switch } from '@/components/ui/switch';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Mail,
  Sparkles,
  Send,
  Clock,
  Loader2,
  AlertCircle,
  FileText,
  ExternalLink,
  Eye,
  Globe,
  ChevronDown,
  ChevronUp,
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

// Common timezones
const TIMEZONES = [
  { value: 'UTC', label: 'UTC (Coordinated Universal Time)' },
  { value: 'America/New_York', label: 'Eastern Time (ET)' },
  { value: 'America/Chicago', label: 'Central Time (CT)' },
  { value: 'America/Denver', label: 'Mountain Time (MT)' },
  { value: 'America/Los_Angeles', label: 'Pacific Time (PT)' },
  { value: 'Europe/London', label: 'London (GMT/BST)' },
  { value: 'Europe/Paris', label: 'Paris (CET/CEST)' },
  { value: 'Europe/Berlin', label: 'Berlin (CET/CEST)' },
  { value: 'Asia/Dubai', label: 'Dubai (GST)' },
  { value: 'Asia/Kolkata', label: 'India (IST)' },
  { value: 'Asia/Singapore', label: 'Singapore (SGT)' },
  { value: 'Asia/Tokyo', label: 'Tokyo (JST)' },
  { value: 'Australia/Sydney', label: 'Sydney (AEST/AEDT)' },
  { value: 'Asia/Dhaka', label: 'Dhaka (BST)' },
];

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
  const [activeTab, setActiveTab] = useState<'compose' | 'ai' | 'preview'>('compose');
  
  // Form state
  const [toEmail, setToEmail] = useState(candidate.email);
  const [ccEmail, setCcEmail] = useState('');
  const [bccEmail, setBccEmail] = useState('');
  const [showCcBcc, setShowCcBcc] = useState(false);
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [appendSignature, setAppendSignature] = useState(true);
  const [signatureText, setSignatureText] = useState('');
  const [selectedJobId, setSelectedJobId] = useState<string | undefined>(preSelectedJobId);
  
  // Schedule state
  const [scheduleEnabled, setScheduleEnabled] = useState(false);
  const [scheduledDate, setScheduledDate] = useState('');
  const [scheduledTime, setScheduledTime] = useState('');
  const [timezone, setTimezone] = useState(Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC');
  
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

  // Get user timezone on mount
  useEffect(() => {
    try {
      const userTz = Intl.DateTimeFormat().resolvedOptions().timeZone;
      if (userTz && TIMEZONES.some(tz => tz.value === userTz)) {
        setTimezone(userTz);
      }
    } catch (e) {
      console.log('Could not detect timezone');
    }
  }, []);

  // Initialize default signature per-open
  useEffect(() => {
    if (open) {
      const defaultSig = profile?.email_signature || 
        `Best regards,\n${profile?.full_name || ''}\n${profile?.job_title || 'Recruiter'}\n${profile?.email || ''}`;
      setSignatureText(defaultSig.trim());
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
        // Merge placeholders in the AI-generated content
        const mergedBody = mergePlaceholders(data.email_body, candidate, selectedJob, profile?.full_name || 'Recruiter');
        setBody(mergedBody);
        
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
        toast.success('AI email generated! Review and edit before sending.');
      }
    } catch (error: any) {
      console.error('Error generating AI email:', error);
      toast.error(error.message || 'Failed to generate email');
    } finally {
      setIsGeneratingAI(false);
    }
  };

  const getScheduledDateTime = (): string | null => {
    if (!scheduleEnabled || !scheduledDate || !scheduledTime) return null;
    
    // Create ISO string with timezone info
    const dateTimeStr = `${scheduledDate}T${scheduledTime}:00`;
    return dateTimeStr;
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
    if (scheduleEnabled && (!scheduledDate || !scheduledTime)) {
      toast.error('Please select date and time for scheduled send');
      return;
    }

    setIsSending(true);
    try {
      const scheduledAt = getScheduledDateTime();
      
      const { data, error } = await supabase.functions.invoke('send-candidate-email', {
        body: {
          candidate_id: candidate.id,
          job_id: selectedJobId,
          from_email: profile?.email || 'noreply@recruitifycrm.com',
          to_email: toEmail,
          cc_email: ccEmail || null,
          bcc_email: bccEmail || null,
          subject,
          body_text: body,
          template_id: selectedTemplate || null,
          ai_generated: false,
          scheduled_at: scheduledAt,
          timezone: scheduleEnabled ? timezone : null,
          signature: appendSignature ? signatureText : null,
        },
      });

      if (error) throw error;

      if (data?.success) {
        if (scheduleEnabled && scheduledAt) {
          toast.success(`Email scheduled for ${format(new Date(scheduledAt), 'PPp')} (${timezone})`);
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
    let mailtoUrl = `mailto:${toEmail}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(finalBody)}`;
    if (ccEmail) mailtoUrl += `&cc=${encodeURIComponent(ccEmail)}`;
    if (bccEmail) mailtoUrl += `&bcc=${encodeURIComponent(bccEmail)}`;
    window.open(mailtoUrl, '_blank');
    toast.info('Opening your email client...');
  };

  const resetForm = () => {
    setSubject('');
    setBody('');
    setCcEmail('');
    setBccEmail('');
    setShowCcBcc(false);
    setSelectedTemplate('');
    setSelectedJobId(preSelectedJobId);
    setScheduleEnabled(false);
    setScheduledDate('');
    setScheduledTime('');
    setActiveTab('compose');
  };

  // Generate preview content
  const getPreviewContent = () => {
    const sig = appendSignature && signatureText ? `\n\n${signatureText}` : '';
    return body + sig;
  };

  const placeholders = [
    '{{candidate_first_name}}',
    '{{job_title}}',
    '{{company_name}}',
    '{{recruiter_name}}',
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader className="flex-shrink-0">
          <DialogTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5 text-primary" />
            Compose Email to {candidate.full_name}
          </DialogTitle>
          <DialogDescription>
            Write, generate with AI, or preview your email before sending.
          </DialogDescription>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'compose' | 'ai' | 'preview')} className="flex-1 flex flex-col overflow-hidden">
          <TabsList className="grid w-full grid-cols-3 flex-shrink-0">
            <TabsTrigger value="compose" className="gap-2">
              <FileText className="h-4 w-4" />
              Compose
            </TabsTrigger>
            <TabsTrigger value="ai" className="gap-2">
              <Sparkles className="h-4 w-4" />
              AI Compose
            </TabsTrigger>
            <TabsTrigger value="preview" className="gap-2">
              <Eye className="h-4 w-4" />
              Preview
            </TabsTrigger>
          </TabsList>

          <ScrollArea className="flex-1 mt-4">
            <TabsContent value="compose" className="space-y-4 m-0 pr-4">
              {/* From Email */}
              <div className="space-y-2">
                <Label>From</Label>
                <div className="flex items-center gap-2 px-3 py-2 bg-muted/50 rounded-md border">
                  <Mail className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm font-medium">{profile?.email || 'Your email'}</span>
                  <Badge variant="secondary" className="ml-auto text-xs">Reply-to</Badge>
                </div>
              </div>

              {/* To Email */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="to">To</Label>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-6 text-xs"
                    onClick={() => setShowCcBcc(!showCcBcc)}
                  >
                    {showCcBcc ? <ChevronUp className="h-3 w-3 mr-1" /> : <ChevronDown className="h-3 w-3 mr-1" />}
                    CC/BCC
                  </Button>
                </div>
                <Input
                  id="to"
                  type="email"
                  value={toEmail}
                  onChange={(e) => setToEmail(e.target.value)}
                  placeholder="recipient@email.com"
                />
              </div>

              {/* CC/BCC Fields */}
              {showCcBcc && (
                <div className="grid grid-cols-2 gap-4 animate-in fade-in-0 slide-in-from-top-2">
                  <div className="space-y-2">
                    <Label htmlFor="cc">CC</Label>
                    <Input
                      id="cc"
                      type="email"
                      value={ccEmail}
                      onChange={(e) => setCcEmail(e.target.value)}
                      placeholder="cc@email.com"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="bcc">BCC</Label>
                    <Input
                      id="bcc"
                      type="email"
                      value={bccEmail}
                      onChange={(e) => setBccEmail(e.target.value)}
                      placeholder="bcc@email.com"
                    />
                  </div>
                </div>
              )}

              {/* Job & Template Selectors */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Job (optional)</Label>
                  <Select value={selectedJobId || ''} onValueChange={setSelectedJobId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select job..." />
                    </SelectTrigger>
                    <SelectContent>
                      {jobs.map((job) => (
                        <SelectItem key={job.id} value={job.id}>
                          {job.title}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Template</Label>
                  <Select value={selectedTemplate} onValueChange={handleTemplateSelect}>
                    <SelectTrigger>
                      <SelectValue placeholder="Choose template..." />
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
                    {placeholders.map((p) => (
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
                  placeholder="Hi [Name],

[Your introduction and context]

[Your main message or value proposition]

[Call to action or closing]

Best regards,"
                  rows={10}
                  className="resize-none font-mono text-sm"
                />
              </div>

              {/* Signature */}
              <div className="space-y-3 p-4 bg-muted/30 rounded-lg border">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Checkbox
                      id="signature"
                      checked={appendSignature}
                      onCheckedChange={(checked) => setAppendSignature(checked as boolean)}
                    />
                    <Label htmlFor="signature" className="text-sm font-medium cursor-pointer">
                      Include email signature
                    </Label>
                  </div>
                </div>
                {appendSignature && (
                  <Textarea
                    value={signatureText}
                    onChange={(e) => setSignatureText(e.target.value)}
                    rows={4}
                    className="resize-none text-sm"
                    placeholder="Best regards,
Your Name
Your Title
your@email.com"
                  />
                )}
              </div>

              <Separator />

              {/* Schedule Options */}
              <div className="space-y-4 p-4 bg-muted/30 rounded-lg border">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Clock className="h-4 w-4 text-muted-foreground" />
                    <Label className="font-medium">Schedule for later</Label>
                  </div>
                  <Switch
                    checked={scheduleEnabled}
                    onCheckedChange={setScheduleEnabled}
                  />
                </div>
                
                {scheduleEnabled && (
                  <div className="grid grid-cols-3 gap-3 animate-in fade-in-0 slide-in-from-top-2">
                    <div className="space-y-2">
                      <Label className="text-xs text-muted-foreground">Date</Label>
                      <Input
                        type="date"
                        value={scheduledDate}
                        onChange={(e) => setScheduledDate(e.target.value)}
                        min={format(new Date(), 'yyyy-MM-dd')}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs text-muted-foreground">Time</Label>
                      <Input
                        type="time"
                        value={scheduledTime}
                        onChange={(e) => setScheduledTime(e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs text-muted-foreground flex items-center gap-1">
                        <Globe className="h-3 w-3" />
                        Timezone
                      </Label>
                      <Select value={timezone} onValueChange={setTimezone}>
                        <SelectTrigger className="text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {TIMEZONES.map((tz) => (
                            <SelectItem key={tz.value} value={tz.value} className="text-xs">
                              {tz.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                )}
              </div>
            </TabsContent>

            <TabsContent value="ai" className="space-y-4 m-0 pr-4">
              <div className="bg-muted/30 rounded-lg p-4 space-y-4 border">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <AlertCircle className="h-4 w-4" />
                  AI generates professional 3-paragraph emails with proper structure.
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

                <div className="grid grid-cols-3 gap-4">
                  {/* Purpose */}
                  <div className="space-y-2">
                    <Label>Purpose</Label>
                    <Select value={aiPurpose} onValueChange={setAiPurpose}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="job_pitch">Job Pitch</SelectItem>
                        <SelectItem value="screening_call">Screening Call</SelectItem>
                        <SelectItem value="interview_invite">Interview Invite</SelectItem>
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
                        <SelectItem value="formal">Professional</SelectItem>
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
                        <SelectItem value="short">Short</SelectItem>
                        <SelectItem value="medium">Medium</SelectItem>
                        <SelectItem value="long">Long</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
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
                  size="lg"
                >
                  {isGeneratingAI ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Generating Professional Email...
                    </>
                  ) : (
                    <>
                      <Sparkles className="h-4 w-4" />
                      Generate Email with AI
                    </>
                  )}
                </Button>

                <p className="text-xs text-muted-foreground text-center">
                  AI will create a structured email with: Greeting → Introduction → Value → Call-to-Action → Sign-off
                </p>
              </div>
            </TabsContent>

            <TabsContent value="preview" className="m-0 pr-4">
              <div className="border rounded-lg overflow-hidden">
                {/* Email Header Preview */}
                <div className="bg-muted/50 p-4 space-y-2 border-b">
                  <div className="flex items-center gap-2 text-sm">
                    <span className="font-medium text-muted-foreground w-16">From:</span>
                    <span>{profile?.email || 'your@email.com'}</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <span className="font-medium text-muted-foreground w-16">To:</span>
                    <span>{toEmail || candidate.email}</span>
                  </div>
                  {ccEmail && (
                    <div className="flex items-center gap-2 text-sm">
                      <span className="font-medium text-muted-foreground w-16">CC:</span>
                      <span>{ccEmail}</span>
                    </div>
                  )}
                  {bccEmail && (
                    <div className="flex items-center gap-2 text-sm">
                      <span className="font-medium text-muted-foreground w-16">BCC:</span>
                      <span>{bccEmail}</span>
                    </div>
                  )}
                  <div className="flex items-center gap-2 text-sm">
                    <span className="font-medium text-muted-foreground w-16">Subject:</span>
                    <span className="font-medium">{subject || '(No subject)'}</span>
                  </div>
                  {scheduleEnabled && scheduledDate && scheduledTime && (
                    <div className="flex items-center gap-2 text-sm text-primary">
                      <Clock className="h-4 w-4" />
                      <span>Scheduled: {scheduledDate} at {scheduledTime} ({timezone})</span>
                    </div>
                  )}
                </div>
                
                {/* Email Body Preview */}
                <div className="p-6 bg-background min-h-[300px]">
                  {body || appendSignature ? (
                    <div className="whitespace-pre-wrap font-sans text-sm leading-relaxed">
                      {getPreviewContent() || (
                        <span className="text-muted-foreground italic">No message content yet...</span>
                      )}
                    </div>
                  ) : (
                    <div className="text-muted-foreground italic text-center py-8">
                      Compose your email to see the preview here
                    </div>
                  )}
                </div>
              </div>
            </TabsContent>
          </ScrollArea>
        </Tabs>

        {/* Actions */}
        <div className="flex items-center justify-between pt-4 border-t flex-shrink-0">
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
                  {scheduleEnabled ? 'Scheduling...' : 'Sending...'}
                </>
              ) : scheduleEnabled ? (
                <>
                  <Clock className="h-4 w-4" />
                  Schedule Email
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
