import { useState, useEffect, useCallback, useRef } from 'react';
import {
  Dialog,
  DialogContent,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Badge } from '@/components/ui/badge';
import {
  X,
  Minus,
  Maximize2,
  Send,
  Paperclip,
  Link as LinkIcon,
  Smile,
  Image,
  MoreVertical,
  Trash2,
  Clock,
  ChevronDown,
  Bold,
  Italic,
  Underline,
  List,
  ListOrdered,
  AlignLeft,
  Undo,
  Redo,
  Sparkles,
  Loader2,
  Type,
  Upload,
} from 'lucide-react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import TiptapLink from '@tiptap/extension-link';
import Placeholder from '@tiptap/extension-placeholder';
import TiptapUnderline from '@tiptap/extension-underline';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

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

interface Attachment {
  name: string;
  url: string;
  size: number;
  type: string;
}

interface GmailComposeModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  candidate: Candidate;
  preSelectedJobId?: string;
}

const ALLOWED_FILE_TYPES = [
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'image/png',
  'image/jpeg',
];

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

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

export function GmailComposeModal({
  open,
  onOpenChange,
  candidate,
  preSelectedJobId,
}: GmailComposeModalProps) {
  const { profile, tenantId } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Form state
  const [toEmail, setToEmail] = useState(candidate.email);
  const [ccEmail, setCcEmail] = useState('');
  const [bccEmail, setBccEmail] = useState('');
  const [showCc, setShowCc] = useState(false);
  const [showBcc, setShowBcc] = useState(false);
  const [subject, setSubject] = useState('');
  const [selectedJobId, setSelectedJobId] = useState<string | undefined>(preSelectedJobId);
  const [isMinimized, setIsMinimized] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  
  // Attachments state
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  
  // Data state
  const [templates, setTemplates] = useState<EmailTemplate[]>([]);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [selectedJob, setSelectedJob] = useState<Job | null>(null);
  const [signature, setSignature] = useState('');
  
  // AI state
  const [showAiPanel, setShowAiPanel] = useState(false);
  const [aiPurpose, setAiPurpose] = useState('job_pitch');
  const [aiTone, setAiTone] = useState('friendly');
  const [isGeneratingAI, setIsGeneratingAI] = useState(false);
  
  // Loading states
  const [isSending, setIsSending] = useState(false);
  const [scheduleType, setScheduleType] = useState<'now' | 'later'>('now');
  const [scheduledAt, setScheduledAt] = useState('');

  const editor = useEditor({
    extensions: [
      StarterKit,
      TiptapLink.configure({
        openOnClick: false,
        HTMLAttributes: {
          class: 'text-primary underline cursor-pointer',
        },
      }),
      TiptapUnderline,
      Placeholder.configure({
        placeholder: 'Compose email...',
      }),
    ],
    content: '',
    editorProps: {
      attributes: {
        class: 'prose prose-sm max-w-none focus:outline-none min-h-[200px] px-4 py-3 text-sm',
      },
    },
  });

  useEffect(() => {
    if (open && tenantId) {
      fetchTemplates();
      fetchJobs();
      fetchSignature();
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

  const fetchSignature = async () => {
    if (!profile?.id) return;
    try {
      const { data } = await supabase
        .from('profiles')
        .select('email_signature')
        .eq('id', profile.id)
        .single();
      
      if (data?.email_signature) {
        setSignature(data.email_signature);
      }
    } catch (error) {
      console.error('Error fetching signature:', error);
    }
  };

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
    const template = templates.find(t => t.id === templateId);
    if (template && editor) {
      const recruiterName = profile?.full_name || 'Recruiter';
      setSubject(mergePlaceholders(template.subject, candidate, selectedJob, recruiterName));
      const mergedBody = mergePlaceholders(template.body_text, candidate, selectedJob, recruiterName);
      editor.commands.setContent(mergedBody);
    }
  };

  // File upload handlers
  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setIsUploading(true);
    const newAttachments: Attachment[] = [];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      
      if (!ALLOWED_FILE_TYPES.includes(file.type)) {
        toast.error(`${file.name}: File type not allowed`);
        continue;
      }
      
      if (file.size > MAX_FILE_SIZE) {
        toast.error(`${file.name}: File too large (max 10MB)`);
        continue;
      }

      try {
        const fileName = `${Date.now()}-${file.name}`;
        const filePath = `${tenantId}/email-attachments/${fileName}`;
        
        const { error: uploadError } = await supabase.storage
          .from('documents')
          .upload(filePath, file);

        if (uploadError) throw uploadError;

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
    
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const removeAttachment = (index: number) => {
    setAttachments(prev => prev.filter((_, i) => i !== index));
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
          length: 'medium',
        },
      });

      if (error) throw error;

      if (data?.email_body && editor) {
        editor.commands.setContent(data.email_body);
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
        setShowAiPanel(false);
        toast.success('AI email generated!');
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
    if (!editor?.getHTML() || editor.isEmpty) {
      toast.error('Please enter a message');
      return;
    }

    setIsSending(true);
    try {
      let finalBody = editor.getHTML();
      if (signature) {
        finalBody += `<br><br>${signature}`;
      }

      const { data, error } = await supabase.functions.invoke('send-candidate-email', {
        body: {
          candidate_id: candidate.id,
          job_id: selectedJobId,
          from_email: profile?.email || 'noreply@recruitsy.net',
          to_email: toEmail,
          cc_email: ccEmail || null,
          bcc_email: bccEmail || null,
          subject,
          body_text: finalBody,
          ai_generated: false,
          scheduled_at: scheduleType === 'later' ? scheduledAt : null,
          attachments: attachments.length > 0 ? attachments : undefined,
        },
      });

      if (error) throw error;

      if (data?.success) {
        if (scheduleType === 'later') {
          toast.success(`Email scheduled for ${format(new Date(scheduledAt), 'PPp')}`);
        } else {
          toast.success(`Email sent to ${toEmail}`);
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

  const resetForm = () => {
    setSubject('');
    editor?.commands.clearContent();
    setSelectedJobId(preSelectedJobId);
    setCcEmail('');
    setBccEmail('');
    setShowCc(false);
    setShowBcc(false);
    setScheduleType('now');
    setScheduledAt('');
    setAttachments([]);
  };

  const setLink = useCallback(() => {
    if (!editor) return;
    const previousUrl = editor.getAttributes('link').href;
    const url = window.prompt('URL', previousUrl);
    if (url === null) return;
    if (url === '') {
      editor.chain().focus().extendMarkRange('link').unsetLink().run();
      return;
    }
    editor.chain().focus().extendMarkRange('link').setLink({ href: url }).run();
  }, [editor]);

  const insertSignature = () => {
    if (signature && editor) {
      editor.commands.insertContent(`<br><br>${signature}`);
    }
  };

  const ToolbarButton = ({ onClick, active, disabled, children, tooltip }: any) => (
    <TooltipProvider delayDuration={300}>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onClick}
            disabled={disabled}
            className={cn(
              "h-8 w-8 p-0 text-muted-foreground hover:text-foreground",
              active && "bg-muted text-foreground"
            )}
          >
            {children}
          </Button>
        </TooltipTrigger>
        <TooltipContent side="top" className="text-xs">
          {tooltip}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );

  if (isMinimized) {
    return (
      <div 
        className="fixed bottom-0 right-4 w-72 bg-background border rounded-t-lg shadow-lg cursor-pointer z-50"
        onClick={() => setIsMinimized(false)}
      >
        <div className="flex items-center justify-between px-3 py-2 bg-primary text-primary-foreground rounded-t-lg">
          <span className="text-sm font-medium truncate">
            {subject || 'New Message'}
          </span>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="sm"
              className="h-6 w-6 p-0 hover:bg-primary-foreground/20"
              onClick={(e) => {
                e.stopPropagation();
                setIsMinimized(false);
              }}
            >
              <Maximize2 className="h-3.5 w-3.5" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="h-6 w-6 p-0 hover:bg-primary-foreground/20"
              onClick={(e) => {
                e.stopPropagation();
                onOpenChange(false);
              }}
            >
              <X className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent 
        className={cn(
          "p-0 gap-0 flex flex-col",
          isFullscreen 
            ? "max-w-[100vw] h-[100vh] rounded-none" 
            : "max-w-2xl max-h-[80vh]"
        )}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-2 bg-muted/50 border-b rounded-t-lg">
          <span className="text-sm font-medium">New Message</span>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="sm"
              className="h-7 w-7 p-0"
              onClick={() => setIsMinimized(true)}
            >
              <Minus className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 w-7 p-0"
              onClick={() => setIsFullscreen(!isFullscreen)}
            >
              <Maximize2 className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 w-7 p-0"
              onClick={() => onOpenChange(false)}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Email Fields */}
        <div className="flex-shrink-0 border-b">
          {/* To Field */}
          <div className="flex items-center px-4 py-1.5 border-b">
            <span className="text-sm text-muted-foreground w-12">To</span>
            <Input
              value={toEmail}
              onChange={(e) => setToEmail(e.target.value)}
              className="border-0 shadow-none focus-visible:ring-0 px-2 h-8"
              placeholder="Recipients"
            />
            <div className="flex gap-1 text-sm text-muted-foreground">
              {!showCc && (
                <button onClick={() => setShowCc(true)} className="hover:text-foreground">
                  Cc
                </button>
              )}
              {!showBcc && (
                <button onClick={() => setShowBcc(true)} className="hover:text-foreground">
                  Bcc
                </button>
              )}
            </div>
          </div>

          {/* CC Field */}
          {showCc && (
            <div className="flex items-center px-4 py-1.5 border-b">
              <span className="text-sm text-muted-foreground w-12">Cc</span>
              <Input
                value={ccEmail}
                onChange={(e) => setCcEmail(e.target.value)}
                className="border-0 shadow-none focus-visible:ring-0 px-2 h-8"
                placeholder="Cc recipients"
              />
            </div>
          )}

          {/* BCC Field */}
          {showBcc && (
            <div className="flex items-center px-4 py-1.5 border-b">
              <span className="text-sm text-muted-foreground w-12">Bcc</span>
              <Input
                value={bccEmail}
                onChange={(e) => setBccEmail(e.target.value)}
                className="border-0 shadow-none focus-visible:ring-0 px-2 h-8"
                placeholder="Bcc recipients"
              />
            </div>
          )}

          {/* Subject Field */}
          <div className="flex items-center px-4 py-1.5">
            <span className="text-sm text-muted-foreground w-12">Subject</span>
            <Input
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              className="border-0 shadow-none focus-visible:ring-0 px-2 h-8"
              placeholder="Subject"
            />
          </div>
        </div>

        {/* Quick Actions Row */}
        <div className="flex items-center gap-2 px-4 py-2 border-b bg-muted/30">
          <Select onValueChange={setSelectedJobId} value={selectedJobId || ''}>
            <SelectTrigger className="w-48 h-8 text-xs">
              <SelectValue placeholder="Select job..." />
            </SelectTrigger>
            <SelectContent>
              {jobs.map((job) => (
                <SelectItem key={job.id} value={job.id} className="text-xs">
                  {job.title}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select onValueChange={handleTemplateSelect}>
            <SelectTrigger className="w-40 h-8 text-xs">
              <SelectValue placeholder="Use template..." />
            </SelectTrigger>
            <SelectContent>
              {templates.map((template) => (
                <SelectItem key={template.id} value={template.id} className="text-xs">
                  {template.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Button
            variant="outline"
            size="sm"
            className="h-8 gap-1.5 text-xs"
            onClick={() => setShowAiPanel(!showAiPanel)}
          >
            <Sparkles className="h-3.5 w-3.5" />
            AI Compose
          </Button>
        </div>

        {/* AI Panel */}
        {showAiPanel && (
          <div className="px-4 py-3 border-b bg-accent/5">
            <div className="flex items-end gap-3">
              <div className="flex-1 space-y-1">
                <label className="text-xs text-muted-foreground">Purpose</label>
                <Select value={aiPurpose} onValueChange={setAiPurpose}>
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="job_pitch">Job Pitch</SelectItem>
                    <SelectItem value="screening_call">Screening Call</SelectItem>
                    <SelectItem value="interview_invite">Interview Invite</SelectItem>
                    <SelectItem value="follow_up">Follow Up</SelectItem>
                    <SelectItem value="offer">Job Offer</SelectItem>
                    <SelectItem value="rejection">Polite Rejection</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex-1 space-y-1">
                <label className="text-xs text-muted-foreground">Tone</label>
                <Select value={aiTone} onValueChange={setAiTone}>
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="brief">Brief & Direct</SelectItem>
                    <SelectItem value="formal">Professional</SelectItem>
                    <SelectItem value="friendly">Warm & Friendly</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button
                size="sm"
                className="h-8 gap-1.5"
                onClick={handleGenerateAI}
                disabled={!selectedJobId || isGeneratingAI}
              >
                {isGeneratingAI ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Sparkles className="h-3.5 w-3.5" />
                )}
                Generate
              </Button>
            </div>
          </div>
        )}

        {/* Hidden file input */}
        <input
          ref={fileInputRef}
          type="file"
          multiple
          onChange={handleFileSelect}
          className="hidden"
          accept=".pdf,.doc,.docx,.xls,.xlsx,.png,.jpg,.jpeg"
        />

        {/* Attachments Preview */}
        {attachments.length > 0 && (
          <div className="px-4 py-2 border-t bg-muted/30">
            <div className="flex flex-wrap gap-2">
              {attachments.map((att, index) => (
                <Badge key={index} variant="secondary" className="py-1 px-2 gap-1">
                  <Paperclip className="h-3 w-3" />
                  <span className="max-w-[150px] truncate">{att.name}</span>
                  <button
                    onClick={() => removeAttachment(index)}
                    className="ml-1 hover:text-destructive"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </Badge>
              ))}
            </div>
          </div>
        )}

        {/* Editor Area */}
        <div className="flex-1 overflow-y-auto">
          <EditorContent editor={editor} />
          
          {/* Signature Preview */}
          {signature && (
            <div className="px-4 py-2 text-xs text-muted-foreground border-t border-dashed">
              <div dangerouslySetInnerHTML={{ __html: signature }} />
            </div>
          )}
        </div>

        {/* Bottom Toolbar - Gmail Style */}
        <div className="flex items-center justify-between px-3 py-2 border-t bg-background">
          <div className="flex items-center gap-1">
            <Button
              onClick={handleSend}
              disabled={isSending || isUploading}
              className="gap-2"
              size="sm"
            >
              {isSending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <>
                  Send
                  <ChevronDown className="h-3 w-3" />
                </>
              )}
            </Button>

            {/* Formatting Toolbar */}
            <Separator orientation="vertical" className="h-6 mx-1" />
            
            <ToolbarButton
              onClick={() => editor?.chain().focus().toggleBold().run()}
              active={editor?.isActive('bold')}
              tooltip="Bold (Ctrl+B)"
            >
              <Bold className="h-4 w-4" />
            </ToolbarButton>

            <ToolbarButton
              onClick={() => editor?.chain().focus().toggleItalic().run()}
              active={editor?.isActive('italic')}
              tooltip="Italic (Ctrl+I)"
            >
              <Italic className="h-4 w-4" />
            </ToolbarButton>

            <ToolbarButton
              onClick={() => editor?.chain().focus().toggleUnderline().run()}
              active={editor?.isActive('underline')}
              tooltip="Underline (Ctrl+U)"
            >
              <Underline className="h-4 w-4" />
            </ToolbarButton>

            <Separator orientation="vertical" className="h-6 mx-1" />

            <ToolbarButton
              onClick={() => editor?.chain().focus().toggleBulletList().run()}
              active={editor?.isActive('bulletList')}
              tooltip="Bulleted list"
            >
              <List className="h-4 w-4" />
            </ToolbarButton>

            <ToolbarButton
              onClick={() => editor?.chain().focus().toggleOrderedList().run()}
              active={editor?.isActive('orderedList')}
              tooltip="Numbered list"
            >
              <ListOrdered className="h-4 w-4" />
            </ToolbarButton>

            <Separator orientation="vertical" className="h-6 mx-1" />

            <ToolbarButton onClick={setLink} tooltip="Insert link">
              <LinkIcon className="h-4 w-4" />
            </ToolbarButton>

            <ToolbarButton
              onClick={() => editor?.chain().focus().undo().run()}
              disabled={!editor?.can().undo()}
              tooltip="Undo"
            >
              <Undo className="h-4 w-4" />
            </ToolbarButton>

            <ToolbarButton
              onClick={() => editor?.chain().focus().redo().run()}
              disabled={!editor?.can().redo()}
              tooltip="Redo"
            >
              <Redo className="h-4 w-4" />
            </ToolbarButton>

            <Separator orientation="vertical" className="h-6 mx-1" />

            {/* Attachment Button */}
            <ToolbarButton
              onClick={() => fileInputRef.current?.click()}
              disabled={isUploading}
              tooltip="Attach files"
            >
              {isUploading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Paperclip className="h-4 w-4" />
              )}
            </ToolbarButton>
          </div>

          <div className="flex items-center gap-1">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                  <MoreVertical className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={insertSignature}>
                  <Type className="h-4 w-4 mr-2" />
                  Insert signature
                </DropdownMenuItem>
                <DropdownMenuItem 
                  onClick={() => setScheduleType(scheduleType === 'now' ? 'later' : 'now')}
                >
                  <Clock className="h-4 w-4 mr-2" />
                  Schedule send
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem 
                  className="text-destructive"
                  onClick={() => {
                    resetForm();
                    onOpenChange(false);
                  }}
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Discard draft
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            <Button
              variant="ghost"
              size="sm"
              className="h-8 w-8 p-0 text-destructive hover:text-destructive"
              onClick={() => {
                resetForm();
                onOpenChange(false);
              }}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Schedule Panel */}
        {scheduleType === 'later' && (
          <div className="flex items-center gap-2 px-4 py-2 border-t bg-muted/30">
            <Clock className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm">Schedule for:</span>
            <Input
              type="datetime-local"
              value={scheduledAt}
              onChange={(e) => setScheduledAt(e.target.value)}
              min={format(new Date(), "yyyy-MM-dd'T'HH:mm")}
              className="w-auto h-8"
            />
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setScheduleType('now')}
            >
              Cancel
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
