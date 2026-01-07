import { useState, useEffect, useRef } from 'react';
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
  Paperclip,
  X,
  Upload,
  Save,
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
  jd_file_url?: string | null;
}

interface EmailTemplate {
  id: string;
  name: string;
  subject: string;
  body_text: string;
}

interface EmailAccount {
  id: string;
  display_name: string;
  from_email: string;
  provider: string;
  is_default: boolean;
  status: string;
}

interface Attachment {
  name: string;
  url: string;
  size: number;
  type: string;
  file?: File;
}

interface SendCandidateEmailModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  candidate: Candidate;
  preSelectedJobId?: string;
}

// IANA Timezones - comprehensive list
const TIMEZONES = [
  { value: 'UTC', label: 'UTC (Coordinated Universal Time)' },
  { value: 'America/New_York', label: 'Eastern Time (ET) - New York' },
  { value: 'America/Chicago', label: 'Central Time (CT) - Chicago' },
  { value: 'America/Denver', label: 'Mountain Time (MT) - Denver' },
  { value: 'America/Los_Angeles', label: 'Pacific Time (PT) - Los Angeles' },
  { value: 'America/Anchorage', label: 'Alaska Time - Anchorage' },
  { value: 'Pacific/Honolulu', label: 'Hawaii Time - Honolulu' },
  { value: 'America/Toronto', label: 'Eastern Time - Toronto' },
  { value: 'America/Vancouver', label: 'Pacific Time - Vancouver' },
  { value: 'America/Mexico_City', label: 'Central Time - Mexico City' },
  { value: 'America/Sao_Paulo', label: 'Brasília Time - São Paulo' },
  { value: 'America/Buenos_Aires', label: 'Argentina Time - Buenos Aires' },
  { value: 'Europe/London', label: 'GMT/BST - London' },
  { value: 'Europe/Paris', label: 'CET/CEST - Paris' },
  { value: 'Europe/Berlin', label: 'CET/CEST - Berlin' },
  { value: 'Europe/Amsterdam', label: 'CET/CEST - Amsterdam' },
  { value: 'Europe/Madrid', label: 'CET/CEST - Madrid' },
  { value: 'Europe/Rome', label: 'CET/CEST - Rome' },
  { value: 'Europe/Moscow', label: 'Moscow Time - Moscow' },
  { value: 'Europe/Istanbul', label: 'Turkey Time - Istanbul' },
  { value: 'Asia/Dubai', label: 'Gulf Standard Time - Dubai' },
  { value: 'Asia/Karachi', label: 'Pakistan Time - Karachi' },
  { value: 'Asia/Kolkata', label: 'India Standard Time - Mumbai' },
  { value: 'Asia/Dhaka', label: 'Bangladesh Time - Dhaka' },
  { value: 'Asia/Bangkok', label: 'Indochina Time - Bangkok' },
  { value: 'Asia/Singapore', label: 'Singapore Time - Singapore' },
  { value: 'Asia/Hong_Kong', label: 'Hong Kong Time - Hong Kong' },
  { value: 'Asia/Shanghai', label: 'China Standard Time - Shanghai' },
  { value: 'Asia/Tokyo', label: 'Japan Standard Time - Tokyo' },
  { value: 'Asia/Seoul', label: 'Korea Standard Time - Seoul' },
  { value: 'Australia/Perth', label: 'Australian Western - Perth' },
  { value: 'Australia/Adelaide', label: 'Australian Central - Adelaide' },
  { value: 'Australia/Sydney', label: 'Australian Eastern - Sydney' },
  { value: 'Australia/Melbourne', label: 'Australian Eastern - Melbourne' },
  { value: 'Pacific/Auckland', label: 'New Zealand Time - Auckland' },
  { value: 'Africa/Johannesburg', label: 'South Africa Time - Johannesburg' },
  { value: 'Africa/Cairo', label: 'Eastern European Time - Cairo' },
  { value: 'Africa/Lagos', label: 'West Africa Time - Lagos' },
];

// Allowed file types
const ALLOWED_FILE_TYPES = [
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'image/png',
  'image/jpeg',
  'image/jpg',
];

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

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

// Candidate composer uses a plain-text textarea; normalize content so emails render with real paragraph breaks.
// - If input is HTML (templates), convert to plain text with blank lines between paragraphs.
// - If input is plain text (AI), ensure section/paragraph breaks are separated by blank lines.
const normalizeEmailContentToPlainText = (input: string): string => {
  let text = (input ?? '').trim();
  if (!text) return '';

  const isHtml = text.startsWith('<') && /<(p|div|br|ul|ol|li|h\d)\b/i.test(text);
  if (isHtml) {
    text = text
      // paragraph-ish boundaries -> blank line
      .replace(/<\s*br\s*\/?\s*>/gi, '\n')
      .replace(/<\s*\/p\s*>/gi, '\n\n')
      .replace(/<\s*\/div\s*>/gi, '\n\n')
      // strip remaining tags
      .replace(/<[^>]+>/g, '')
      // decode common entities
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'");
  }

  // Normalize newlines
  text = text
    .replace(/\r\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

  // Ensure greeting and sign-off have spacing
  text = text
    .replace(/^(Hello[^\n]*,)(\n)?/i, '$1\n\n')
    .replace(/\n?(Kind regards,|Best regards,|Regards,|Sincerely,|Thanks,|Thank you,)(\n)?/gi, '\n\n$1\n\n');

  return text.replace(/\n{3,}/g, '\n\n').trim();
};

export function SendCandidateEmailModal({
  open,
  onOpenChange,
  candidate,
  preSelectedJobId,
}: SendCandidateEmailModalProps) {
  const { profile, tenantId, user } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);
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
  
  // Sender account state
  const [emailAccounts, setEmailAccounts] = useState<EmailAccount[]>([]);
  const [selectedAccountId, setSelectedAccountId] = useState<string>('');
  
  // Attachments state
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  
  // Schedule state
  const [scheduleEnabled, setScheduleEnabled] = useState(false);
  const [scheduledDate, setScheduledDate] = useState('');
  const [scheduledTime, setScheduledTime] = useState('');
  const [timezone, setTimezone] = useState('UTC');
  
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
  const [isSavingTemplate, setIsSavingTemplate] = useState(false);

  // Get user timezone on mount
  useEffect(() => {
    try {
      const userTz = Intl.DateTimeFormat().resolvedOptions().timeZone;
      const found = TIMEZONES.find(tz => tz.value === userTz);
      if (found) {
        setTimezone(userTz);
      }
    } catch (e) {
      console.log('Could not detect timezone, using UTC');
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
      fetchEmailAccounts();
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
    if (!user?.id || !tenantId) {
      console.log('fetchJobs: No user or tenant, skipping');
      return;
    }
    
    try {
      // First check if user is a recruiter
      const { data: roleData, error: roleError } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', user.id)
        .eq('tenant_id', tenantId)
        .single();

      if (roleError) {
        console.error('Error fetching user role:', roleError);
      }

      const isRecruiter = roleData?.role === 'recruiter';
      console.log('User role:', roleData?.role, 'isRecruiter:', isRecruiter);

      let jobsData: Job[] = [];

      if (isRecruiter) {
        // Recruiters only see jobs assigned to them via job_assignees
        const { data: assignedJobs, error } = await supabase
          .from('job_assignees')
          .select('job_id, jobs:job_id(id, title, location, jd_file_url, clients(name), status)')
          .eq('user_id', user.id)
          .eq('tenant_id', tenantId);

        if (error) throw error;
        
        console.log('Assigned jobs for recruiter:', assignedJobs?.length || 0);
        
        // Filter for open jobs and extract job data
        jobsData = (assignedJobs || [])
          .filter((a: any) => a.jobs?.status === 'open')
          .map((a: any) => ({
            id: a.jobs.id,
            title: a.jobs.title,
            location: a.jobs.location,
            jd_file_url: a.jobs.jd_file_url,
            clients: a.jobs.clients,
          }));
      } else {
        // Owners/Managers see all tenant jobs
        const { data, error } = await supabase
          .from('jobs')
          .select('id, title, location, jd_file_url, clients(name)')
          .eq('tenant_id', tenantId)
          .eq('status', 'open')
          .order('title');

        if (error) throw error;
        jobsData = data || [];
      }

      console.log('Jobs loaded:', jobsData.length);
      setJobs(jobsData);
      
      if (preSelectedJobId) {
        const job = jobsData.find(j => j.id === preSelectedJobId);
        setSelectedJob(job || null);
      }
    } catch (error) {
      console.error('Error fetching jobs:', error);
    }
  };

  const fetchEmailAccounts = async () => {
    try {
      const { data, error } = await supabase
        .from('email_accounts')
        .select('id, display_name, from_email, provider, is_default, status')
        .eq('status', 'connected')
        .order('is_default', { ascending: false });

      if (error) throw error;
      setEmailAccounts(data || []);
      
      // Auto-select default account if available
      const defaultAccount = data?.find(a => a.is_default);
      if (defaultAccount) {
        setSelectedAccountId(defaultAccount.id);
      }
    } catch (error) {
      console.error('Error fetching email accounts:', error);
    }
  };

  const handleTemplateSelect = (templateId: string) => {
    setSelectedTemplate(templateId);
    const template = templates.find(t => t.id === templateId);
    if (template) {
      const recruiterName = profile?.full_name || 'Recruiter';
      setSubject(mergePlaceholders(template.subject, candidate, selectedJob, recruiterName));

      const merged = mergePlaceholders(template.body_text, candidate, selectedJob, recruiterName);
      setBody(normalizeEmailContentToPlainText(merged));
    }
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setIsUploading(true);
    const newAttachments: Attachment[] = [];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      
      // Validate file type
      if (!ALLOWED_FILE_TYPES.includes(file.type)) {
        toast.error(`${file.name}: File type not allowed`);
        continue;
      }
      
      // Validate file size
      if (file.size > MAX_FILE_SIZE) {
        toast.error(`${file.name}: File too large (max 10MB)`);
        continue;
      }

      try {
        // Upload to Supabase Storage
        const fileName = `${Date.now()}-${file.name}`;
        const filePath = `${tenantId}/email-attachments/${fileName}`;
        
        const { error: uploadError } = await supabase.storage
          .from('documents')
          .upload(filePath, file);

        if (uploadError) throw uploadError;

        // Get public URL
        const { data: urlData } = supabase.storage
          .from('documents')
          .getPublicUrl(filePath);

        newAttachments.push({
          name: file.name,
          url: urlData.publicUrl,
          size: file.size,
          type: file.type,
        });
      } catch (error: any) {
        console.error('Error uploading file:', error);
        toast.error(`Failed to upload ${file.name}`);
      }
    }

    setAttachments(prev => [...prev, ...newAttachments]);
    setIsUploading(false);
    
    // Reset file input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const removeAttachment = (index: number) => {
    setAttachments(prev => prev.filter((_, i) => i !== index));
  };

  const handleAttachJD = async () => {
    if (!selectedJob?.jd_file_url) {
      toast.error('No JD file available for the selected job');
      return;
    }

    // Check if JD is already attached
    const jdAlreadyAttached = attachments.some(a => a.name.includes('JD_') || a.name.includes('Job_Description'));
    if (jdAlreadyAttached) {
      toast.info('Job Description is already attached');
      return;
    }

    setIsUploading(true);
    try {
      // Extract the file path from the URL
      let filePath = selectedJob.jd_file_url;
      if (filePath.includes('/documents/')) {
        filePath = filePath.split('/documents/').pop() || filePath;
      }
      filePath = filePath.split('?')[0];

      // Get the file from storage
      const { data: fileData, error: downloadError } = await supabase.storage
        .from('documents')
        .download(filePath);

      if (downloadError) throw downloadError;

      // Determine file extension
      const extension = filePath.split('.').pop() || 'pdf';
      const fileName = `JD_${selectedJob.title.replace(/\s+/g, '_')}.${extension}`;

      // Upload as email attachment
      const attachmentPath = `${tenantId}/email-attachments/${Date.now()}-${fileName}`;
      const { error: uploadError } = await supabase.storage
        .from('documents')
        .upload(attachmentPath, fileData);

      if (uploadError) throw uploadError;

      // Get public URL
      const { data: urlData } = supabase.storage
        .from('documents')
        .getPublicUrl(attachmentPath);

      setAttachments(prev => [...prev, {
        name: fileName,
        url: urlData.publicUrl,
        size: fileData.size,
        type: fileData.type || 'application/pdf',
      }]);

      toast.success('Job Description attached');
    } catch (error: any) {
      console.error('Error attaching JD:', error);
      toast.error('Failed to attach Job Description');
    } finally {
      setIsUploading(false);
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
        // Candidate composer is plain-text: normalize so paragraphs show and backend can format reliably
        setBody(normalizeEmailContentToPlainText(data.email_body));

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

  const handleSaveAsTemplate = async () => {
    if (!subject.trim() || !body.trim()) {
      toast.error('Please enter both subject and message before saving as template');
      return;
    }

    const templateName = window.prompt('Enter a name for this template:');
    if (!templateName?.trim()) {
      return;
    }

    setIsSavingTemplate(true);
    try {
      if (!user?.id || !tenantId) {
        throw new Error('User not authenticated');
      }

      const { error } = await supabase
        .from('user_email_templates')
        .insert({
          tenant_id: tenantId,
          user_id: user.id,
          name: templateName.trim(),
          subject: subject,
          body_text: body,
          is_active: true,
        });

      if (error) throw error;
      
      toast.success('Template saved successfully!');
      fetchTemplates(); // Refresh templates list
    } catch (error: any) {
      console.error('Error saving template:', error);
      toast.error(error.message || 'Failed to save template');
    } finally {
      setIsSavingTemplate(false);
    }
  };

  const getScheduledDateTime = (): string | null => {
    if (!scheduleEnabled || !scheduledDate || !scheduledTime) return null;
    return `${scheduledDate}T${scheduledTime}:00`;
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
      
      // Get selected account email
      const selectedAccount = emailAccounts.find(a => a.id === selectedAccountId);
      const fromEmail = selectedAccount?.from_email || profile?.email || 'noreply@hiremetrics.io';
      
      const { data, error } = await supabase.functions.invoke('send-candidate-email', {
        body: {
          candidate_id: candidate.id,
          job_id: selectedJobId,
          from_email: fromEmail,
          from_account_id: selectedAccountId || null,
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
          attachments: attachments.map(a => ({ name: a.name, url: a.url, size: a.size, type: a.type })),
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
    setAttachments([]);
  };

  const getPreviewContent = () => {
    const sig = appendSignature && signatureText ? `\n\n${signatureText}` : '';
    return body + sig;
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  const placeholders = [
    '{{candidate_first_name}}',
    '{{job_title}}',
    '{{company_name}}',
    '{{recruiter_name}}',
  ];

  const selectedAccount = emailAccounts.find(a => a.id === selectedAccountId);
  const displayFromEmail = selectedAccount?.from_email || profile?.email || 'System Email';

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
              {/* From Email - Sender Selection */}
              <div className="space-y-2">
                <Label>From</Label>
                {emailAccounts.length > 0 ? (
                  <Select value={selectedAccountId} onValueChange={setSelectedAccountId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select sender account..." />
                    </SelectTrigger>
                    <SelectContent>
                      {emailAccounts.map((account) => (
                        <SelectItem key={account.id} value={account.id}>
                          <div className="flex items-center gap-2">
                            <span>{account.display_name}</span>
                            <span className="text-muted-foreground text-sm">({account.from_email})</span>
                            {account.is_default && <Badge variant="secondary" className="text-xs">Default</Badge>}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <div className="flex items-center gap-2 px-3 py-2 bg-muted/50 rounded-md border">
                    <Mail className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm font-medium">{displayFromEmail}</span>
                    <Badge variant="secondary" className="ml-auto text-xs">Reply-to</Badge>
                  </div>
                )}
                <p className="text-xs text-muted-foreground">
                  Emails sent from info@hiremetrics.io with your email as reply-to. 
                  <a href="/email-accounts" className="text-primary ml-1 hover:underline">Configure SMTP</a> to send from your domain.
                </p>
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
                      placeholder="cc@email.com, cc2@email.com"
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

              {/* Attachments */}
              <div className="space-y-3 p-4 bg-muted/30 rounded-lg border">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Paperclip className="h-4 w-4 text-muted-foreground" />
                    <Label className="font-medium">Attachments</Label>
                    {attachments.length > 0 && (
                      <Badge variant="secondary" className="text-xs">{attachments.length}</Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    {selectedJob && (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={handleAttachJD}
                        disabled={isUploading || !selectedJob.jd_file_url}
                        className="gap-2"
                        title={!selectedJob.jd_file_url ? 'No JD file uploaded for this job' : 'Attach Job Description'}
                      >
                        <FileText className="h-4 w-4" />
                        {selectedJob.jd_file_url ? 'Attach JD' : 'No JD Available'}
                      </Button>
                    )}
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={isUploading}
                      className="gap-2"
                    >
                      {isUploading ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Upload className="h-4 w-4" />
                      )}
                      Add Files
                    </Button>
                  </div>
                  <input
                    ref={fileInputRef}
                    type="file"
                    multiple
                    accept=".pdf,.doc,.docx,.xls,.xlsx,.png,.jpg,.jpeg"
                    onChange={handleFileSelect}
                    className="hidden"
                  />
                </div>
                
                {attachments.length > 0 && (
                  <div className="space-y-2">
                    {attachments.map((att, index) => (
                      <div key={index} className="flex items-center justify-between p-2 bg-background rounded border">
                        <div className="flex items-center gap-2 min-w-0">
                          <FileText className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                          <span className="text-sm truncate">{att.name}</span>
                          <span className="text-xs text-muted-foreground">({formatFileSize(att.size)})</span>
                        </div>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-6 w-6 p-0 text-muted-foreground hover:text-destructive"
                          onClick={() => removeAttachment(index)}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
                
                <p className="text-xs text-muted-foreground">
                  Allowed: PDF, DOC, DOCX, XLS, XLSX, PNG, JPG. Max 10MB per file.
                  {selectedJob?.jd_file_url && ' Use "Attach JD" to include the job description.'}
                </p>
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
                  <div className="space-y-4 animate-in fade-in-0 slide-in-from-top-2">
                    <div className="grid grid-cols-2 gap-4">
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
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs text-muted-foreground flex items-center gap-1">
                        <Globe className="h-3 w-3" />
                        Timezone
                      </Label>
                      <Select value={timezone} onValueChange={setTimezone}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="max-h-60">
                          {TIMEZONES.map((tz) => (
                            <SelectItem key={tz.value} value={tz.value}>
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
                    <span>{displayFromEmail}</span>
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
                  {attachments.length > 0 && (
                    <div className="flex items-center gap-2 text-sm">
                      <Paperclip className="h-4 w-4 text-muted-foreground" />
                      <span>{attachments.length} attachment{attachments.length > 1 ? 's' : ''}</span>
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
          <div className="flex gap-2">
            <Button variant="outline" onClick={handleMailtoFallback} className="gap-2">
              <ExternalLink className="h-4 w-4" />
              Open in Mail App
            </Button>
            <Button 
              variant="outline" 
              onClick={handleSaveAsTemplate} 
              disabled={isSavingTemplate || !subject.trim() || !body.trim()}
              className="gap-2"
            >
              {isSavingTemplate ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Save className="h-4 w-4" />
              )}
              Save as Template
            </Button>
          </div>
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
