import { useState, useEffect, useCallback, useRef } from 'react';
import {
  Dialog,
  DialogContent,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import {
  X,
  Minus,
  Maximize2,
  Send,
  Paperclip,
  Link as LinkIcon,
  MoreVertical,
  Trash2,
  Clock,
  ChevronDown,
  Bold,
  Italic,
  Underline,
  List,
  ListOrdered,
  Undo,
  Redo,
  Sparkles,
  Loader2,
  Type,
  Mail,
  Save,
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

interface Client {
  id: string;
  name: string;
  contact_name: string;
  contact_email: string;
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
}

interface SendClientEmailModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  client: Client;
}

const TIMEZONES = [
  { value: 'UTC', label: 'UTC' },
  { value: 'America/New_York', label: 'Eastern Time (ET)' },
  { value: 'America/Chicago', label: 'Central Time (CT)' },
  { value: 'America/Denver', label: 'Mountain Time (MT)' },
  { value: 'America/Los_Angeles', label: 'Pacific Time (PT)' },
  { value: 'Europe/London', label: 'GMT/BST - London' },
  { value: 'Europe/Paris', label: 'CET - Paris' },
  { value: 'Asia/Dubai', label: 'Gulf - Dubai' },
  { value: 'Asia/Kolkata', label: 'IST - India' },
  { value: 'Asia/Singapore', label: 'Singapore' },
  { value: 'Asia/Tokyo', label: 'JST - Tokyo' },
  { value: 'Australia/Sydney', label: 'AEST - Sydney' },
];

const ALLOWED_FILE_TYPES = [
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'image/png',
  'image/jpeg',
];

const MAX_FILE_SIZE = 10 * 1024 * 1024;

const mergePlaceholders = (
  text: string,
  client: Client,
  recruiterName: string
): string => {
  const today = format(new Date(), 'MMMM d, yyyy');
  return text
    .replace(/\{\{client_name\}\}/g, client.name)
    .replace(/\{\{contact_name\}\}/g, client.contact_name)
    .replace(/\{\{contact_first_name\}\}/g, client.contact_name?.split(' ')[0] || '')
    .replace(/\{\{contact_email\}\}/g, client.contact_email)
    .replace(/\{\{recruiter_name\}\}/g, recruiterName)
    .replace(/\{\{today_date\}\}/g, today);
};

export function SendClientEmailModal({
  open,
  onOpenChange,
  client,
}: SendClientEmailModalProps) {
  const { profile, tenantId, user } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Form state
  const [toEmail, setToEmail] = useState(client.contact_email);
  const [ccEmail, setCcEmail] = useState('');
  const [bccEmail, setBccEmail] = useState('');
  const [showCc, setShowCc] = useState(false);
  const [showBcc, setShowBcc] = useState(false);
  const [subject, setSubject] = useState('');
  const [isMinimized, setIsMinimized] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  
  // Sender account state
  const [emailAccounts, setEmailAccounts] = useState<EmailAccount[]>([]);
  const [selectedAccountId, setSelectedAccountId] = useState<string>('');
  
  // Attachments state
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  
  // Signature state
  const [signature, setSignature] = useState('');
  const [showSignatureEditor, setShowSignatureEditor] = useState(false);
  const [includeSignature, setIncludeSignature] = useState(true);
  
  // Schedule state
  const [scheduleType, setScheduleType] = useState<'now' | 'later'>('now');
  const [scheduledAt, setScheduledAt] = useState('');
  const [timezone, setTimezone] = useState('UTC');
  
  // Data state
  const [templates, setTemplates] = useState<EmailTemplate[]>([]);
  
  // AI state
  const [showAiPanel, setShowAiPanel] = useState(false);
  const [aiPrompt, setAiPrompt] = useState('');
  const [aiTone, setAiTone] = useState('professional');
  const [isGeneratingAI, setIsGeneratingAI] = useState(false);
  // Loading states
  const [isSending, setIsSending] = useState(false);
  const [isSavingTemplate, setIsSavingTemplate] = useState(false);

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
        placeholder: 'Compose your message...',
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
    try {
      const userTz = Intl.DateTimeFormat().resolvedOptions().timeZone;
      const found = TIMEZONES.find(tz => tz.value === userTz);
      if (found) setTimezone(userTz);
    } catch (e) {
      console.log('Could not detect timezone');
    }
  }, []);

  useEffect(() => {
    if (open && tenantId) {
      fetchTemplates();
      fetchEmailAccounts();
      fetchSignature();
      setToEmail(client.contact_email);
    }
  }, [open, tenantId, client.contact_email]);

  const fetchSignature = async () => {
    if (!profile?.id) return;
    try {
      const { data } = await supabase
        .from('profiles')
        .select('email_signature')
        .eq('id', profile.id)
        .single();
      
      const defaultSig = data?.email_signature || 
        `Best regards,\n${profile?.full_name || ''}\n${profile?.job_title || 'Recruiter'}\n${profile?.email || ''}`;
      setSignature(defaultSig);
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

  const fetchEmailAccounts = async () => {
    if (!user?.id) return;
    try {
      // Only fetch the current user's configured SMTP email accounts
      const { data, error } = await supabase
        .from('email_accounts')
        .select('id, display_name, from_email, provider, is_default, status')
        .eq('user_id', user.id)
        .eq('status', 'connected')
        .order('is_default', { ascending: false });

      if (error) throw error;
      setEmailAccounts(data || []);
      
      const defaultAccount = data?.find(a => a.is_default);
      if (defaultAccount) {
        setSelectedAccountId(defaultAccount.id);
      } else if (data && data.length > 0) {
        setSelectedAccountId(data[0].id);
      }
    } catch (error) {
      console.error('Error fetching email accounts:', error);
    }
  };

  const handleTemplateSelect = (templateId: string) => {
    const template = templates.find(t => t.id === templateId);
    if (template && editor) {
      const recruiterName = profile?.full_name || 'Recruiter';
      setSubject(mergePlaceholders(template.subject, client, recruiterName));
      const mergedBody = mergePlaceholders(template.body_text, client, recruiterName);
      editor.commands.setContent(mergedBody);
    }
  };

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
    if (!aiPrompt.trim()) {
      toast.error('Please describe what you want the AI to write');
      return;
    }
    
    setIsGeneratingAI(true);
    try {
      const { data, error } = await supabase.functions.invoke('ai-compose-email', {
        body: {
          candidate_first_name: client.contact_name?.split(' ')[0] || client.name,
          candidate_last_name: client.contact_name?.split(' ').slice(1).join(' ') || '',
          job_title: '',
          location: '',
          company_name: client.name,
          recruiter_name: profile?.full_name || 'Recruiter',
          purpose: 'custom',
          tone: aiTone,
          length: 'medium',
          is_client_email: true,
          custom_instructions: aiPrompt,
        },
      });

      if (error) throw error;

      if (data?.email_body && editor) {
        editor.commands.setContent(data.email_body);
        if (!subject) {
          setSubject(`Regarding ${client.name}`);
        }
        setShowAiPanel(false);
        setAiPrompt('');
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
      const selectedAccount = emailAccounts.find(a => a.id === selectedAccountId);
      const fromEmail = selectedAccount?.from_email || profile?.email || '';
      
      // Don't append signature here - the edge function will handle it
      const finalBody = editor.getHTML();

      const scheduledAtValue = scheduleType === 'later' && scheduledAt ? scheduledAt : null;

      // Save email to client_emails table
      const emailRecord: any = {
        client_id: client.id,
        tenant_id: tenantId,
        from_email: fromEmail,
        to_email: toEmail,
        subject,
        body_text: finalBody,
        status: scheduledAtValue ? 'scheduled' : 'sending',
        scheduled_at: scheduledAtValue,
        timezone,
        from_account_id: selectedAccountId || null,
        attachments: attachments.length > 0 ? attachments : null,
        sent_by: user?.id,
      };
      
      const { error: insertError } = await supabase.from('client_emails').insert(emailRecord);

      if (insertError) throw insertError;

      // If not scheduled, send immediately
      // Send signature separately - edge function will format it properly
      if (!scheduledAtValue) {
        const { error: sendError } = await supabase.functions.invoke('send-candidate-email', {
          body: {
            client_id: client.id,
            to_email: toEmail,
            cc_email: ccEmail || undefined,
            bcc_email: bccEmail || undefined,
            subject,
            body_text: finalBody,
            from_account_id: selectedAccountId || undefined,
            attachments: attachments.length > 0 ? attachments : undefined,
            signature: includeSignature ? signature : undefined,
            use_system_fallback: true,
          },
        });

        if (sendError) throw sendError;
      }

      // Log activity
      await supabase.from('client_activities').insert({
        client_id: client.id,
        tenant_id: tenantId,
        activity_type: 'email',
        description: `Email sent: ${subject}`,
        created_by: user?.id,
        metadata: { to: toEmail, subject },
      });

      // Update last_contact_at
      await supabase
        .from('clients')
        .update({ last_contact_at: new Date().toISOString() })
        .eq('id', client.id);

      toast.success(scheduledAtValue ? 'Email scheduled successfully' : 'Email sent successfully');
      onOpenChange(false);
      resetForm();
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
    setCcEmail('');
    setBccEmail('');
    setShowCc(false);
    setShowBcc(false);
    setScheduleType('now');
    setScheduledAt('');
    setAttachments([]);
    setShowAiPanel(false);
  };

  const handleSaveAsTemplate = async () => {
    const bodyHtml = editor?.getHTML() || '';
    if (!subject.trim() || !bodyHtml || editor?.isEmpty) {
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
          body_text: bodyHtml,
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
            : "max-w-2xl max-h-[85vh]"
        )}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-2 bg-muted/50 border-b rounded-t-lg">
          <div className="flex items-center gap-2">
            <Mail className="h-4 w-4" />
            <span className="text-sm font-medium">New Message to {client.contact_name || client.name}</span>
          </div>
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

        {/* From Account Selector */}
        {emailAccounts.length > 0 && (
          <div className="flex items-center px-4 py-1.5 border-b bg-muted/20">
            <span className="text-sm text-muted-foreground w-14">From</span>
            <Select value={selectedAccountId} onValueChange={setSelectedAccountId}>
              <SelectTrigger className="border-0 shadow-none focus:ring-0 h-8 text-sm">
                <SelectValue placeholder="Select sender" />
              </SelectTrigger>
              <SelectContent>
                {emailAccounts.map(account => (
                  <SelectItem key={account.id} value={account.id}>
                    {account.display_name} ({account.from_email})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        {/* Email Fields */}
        <div className="flex-shrink-0 border-b">
          {/* To Field */}
          <div className="flex items-center px-4 py-1.5 border-b">
            <span className="text-sm text-muted-foreground w-14">To</span>
            <Input
              value={toEmail}
              onChange={(e) => setToEmail(e.target.value)}
              className="border-0 shadow-none focus-visible:ring-0 px-2 h-8"
              placeholder="Recipients"
            />
            <div className="flex gap-2 text-sm text-muted-foreground">
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
              <span className="text-sm text-muted-foreground w-14">Cc</span>
              <Input
                value={ccEmail}
                onChange={(e) => setCcEmail(e.target.value)}
                className="border-0 shadow-none focus-visible:ring-0 px-2 h-8"
                placeholder="Cc recipients"
              />
              <button onClick={() => { setShowCc(false); setCcEmail(''); }} className="text-muted-foreground hover:text-foreground">
                <X className="h-4 w-4" />
              </button>
            </div>
          )}

          {/* BCC Field */}
          {showBcc && (
            <div className="flex items-center px-4 py-1.5 border-b">
              <span className="text-sm text-muted-foreground w-14">Bcc</span>
              <Input
                value={bccEmail}
                onChange={(e) => setBccEmail(e.target.value)}
                className="border-0 shadow-none focus-visible:ring-0 px-2 h-8"
                placeholder="Bcc recipients"
              />
              <button onClick={() => { setShowBcc(false); setBccEmail(''); }} className="text-muted-foreground hover:text-foreground">
                <X className="h-4 w-4" />
              </button>
            </div>
          )}

          {/* Subject Field */}
          <div className="flex items-center px-4 py-1.5">
            <span className="text-sm text-muted-foreground w-14">Subject</span>
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
          {templates.length > 0 && (
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
          )}

          <Button
            variant="outline"
            size="sm"
            className="h-8 gap-1.5 text-xs"
            onClick={() => setShowAiPanel(!showAiPanel)}
          >
            <Sparkles className="h-3.5 w-3.5" />
            AI Compose
          </Button>

          <Button
            variant="outline"
            size="sm"
            className="h-8 gap-1.5 text-xs"
            onClick={handleSaveAsTemplate}
            disabled={isSavingTemplate || !subject.trim() || editor?.isEmpty}
          >
            {isSavingTemplate ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Save className="h-3.5 w-3.5" />
            )}
            Save Template
          </Button>
        </div>

        {/* AI Panel */}
        {showAiPanel && (
          <div className="px-4 py-3 border-b bg-accent/5">
            <div className="space-y-3">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">Describe what you want AI to write</label>
                <Textarea
                  value={aiPrompt}
                  onChange={(e) => setAiPrompt(e.target.value)}
                  placeholder="e.g., Write a follow-up email asking about partnership opportunities, or Write a thank you email for the recent meeting..."
                  className="min-h-[80px] text-sm resize-none"
                />
              </div>
              <div className="flex items-end gap-3">
                <div className="flex-1 space-y-1">
                  <label className="text-xs text-muted-foreground">Tone</label>
                  <Select value={aiTone} onValueChange={setAiTone}>
                    <SelectTrigger className="h-8 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="brief">Brief & Direct</SelectItem>
                      <SelectItem value="professional">Professional</SelectItem>
                      <SelectItem value="friendly">Warm & Friendly</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <Button
                  size="sm"
                  className="h-8 gap-1.5"
                  onClick={handleGenerateAI}
                  disabled={isGeneratingAI || !aiPrompt.trim()}
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
          <div className="px-4 py-2 border-b bg-muted/30">
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
        </div>

        {/* Signature Section */}
        <div className="px-4 py-2 border-t bg-muted/20">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <Switch
                checked={includeSignature}
                onCheckedChange={setIncludeSignature}
                id="sig-toggle"
              />
              <Label htmlFor="sig-toggle" className="text-xs">Include signature</Label>
            </div>
            <Button
              variant="ghost"
              size="sm"
              className="h-6 text-xs"
              onClick={() => setShowSignatureEditor(!showSignatureEditor)}
            >
              {showSignatureEditor ? 'Hide' : 'Edit'}
            </Button>
          </div>
          {showSignatureEditor && (
            <Textarea
              value={signature}
              onChange={(e) => setSignature(e.target.value)}
              rows={4}
              className="text-xs"
              placeholder="Your signature..."
            />
          )}
          {!showSignatureEditor && includeSignature && signature && (
            <div className="text-xs text-muted-foreground whitespace-pre-wrap border-l-2 border-muted pl-2">
              {signature}
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
                  <Send className="h-4 w-4" />
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
          <div className="flex items-center gap-2 px-4 py-2 border-t bg-muted/30 flex-wrap">
            <Clock className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm">Schedule for:</span>
            <Input
              type="datetime-local"
              value={scheduledAt}
              onChange={(e) => setScheduledAt(e.target.value)}
              min={format(new Date(), "yyyy-MM-dd'T'HH:mm")}
              className="w-auto h-8"
            />
            <Select value={timezone} onValueChange={setTimezone}>
              <SelectTrigger className="w-40 h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TIMEZONES.map(tz => (
                  <SelectItem key={tz.value} value={tz.value} className="text-xs">
                    {tz.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
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
