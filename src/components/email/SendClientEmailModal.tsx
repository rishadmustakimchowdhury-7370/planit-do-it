import { useState, useEffect, useRef } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
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
  Eye,
  Globe,
  ChevronDown,
  ChevronUp,
  Paperclip,
  X,
  Upload,
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth';
import { toast } from 'sonner';
import { format } from 'date-fns';

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
  { value: 'UTC', label: 'UTC (Coordinated Universal Time)' },
  { value: 'America/New_York', label: 'Eastern Time (ET) - New York' },
  { value: 'America/Chicago', label: 'Central Time (CT) - Chicago' },
  { value: 'America/Denver', label: 'Mountain Time (MT) - Denver' },
  { value: 'America/Los_Angeles', label: 'Pacific Time (PT) - Los Angeles' },
  { value: 'Europe/London', label: 'GMT/BST - London' },
  { value: 'Europe/Paris', label: 'CET/CEST - Paris' },
  { value: 'Asia/Dubai', label: 'Gulf Standard Time - Dubai' },
  { value: 'Asia/Kolkata', label: 'India Standard Time - Mumbai' },
  { value: 'Asia/Singapore', label: 'Singapore Time - Singapore' },
  { value: 'Asia/Tokyo', label: 'Japan Standard Time - Tokyo' },
  { value: 'Australia/Sydney', label: 'Australian Eastern - Sydney' },
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
    .replace(/\{\{contact_first_name\}\}/g, client.contact_name.split(' ')[0])
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
  const [activeTab, setActiveTab] = useState<'compose' | 'preview'>('compose');
  
  // Form state
  const [toEmail, setToEmail] = useState(client.contact_email);
  const [ccEmail, setCcEmail] = useState('');
  const [bccEmail, setBccEmail] = useState('');
  const [showCcBcc, setShowCcBcc] = useState(false);
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [appendSignature, setAppendSignature] = useState(true);
  const [signatureText, setSignatureText] = useState('');
  
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
  const [selectedTemplate, setSelectedTemplate] = useState<string>('');
  
  // Loading states
  const [isSending, setIsSending] = useState(false);

  useEffect(() => {
    try {
      const userTz = Intl.DateTimeFormat().resolvedOptions().timeZone;
      const found = TIMEZONES.find(tz => tz.value === userTz);
      if (found) {
        setTimezone(userTz);
      }
    } catch (e) {
      console.log('Could not detect timezone');
    }
  }, []);

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
      fetchEmailAccounts();
      setToEmail(client.contact_email);
    }
  }, [open, tenantId, client.contact_email]);

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
    try {
      const { data, error } = await supabase
        .from('email_accounts')
        .select('id, display_name, from_email, provider, is_default, status')
        .eq('status', 'connected')
        .order('is_default', { ascending: false });

      if (error) throw error;
      setEmailAccounts(data || []);
      
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
      setSubject(mergePlaceholders(template.subject, client, recruiterName));
      setBody(mergePlaceholders(template.body_text, client, recruiterName));
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

  const getScheduledDateTime = (): string | null => {
    if (!scheduleEnabled || !scheduledDate || !scheduledTime) return null;
    return `${scheduledDate}T${scheduledTime}:00`;
  };

  const handleSend = async () => {
    if (!toEmail || !subject || !body) {
      toast.error('Please fill in all required fields');
      return;
    }

    setIsSending(true);
    try {
      const selectedAccount = emailAccounts.find(a => a.id === selectedAccountId);
      const fromEmail = selectedAccount?.from_email || profile?.email || '';
      const fromName = selectedAccount?.display_name || profile?.full_name || '';
      
      const finalBody = appendSignature && signatureText 
        ? `${body}\n\n${signatureText}` 
        : body;

      const scheduledAt = getScheduledDateTime();

      // Save email to client_emails table
      const emailRecord: any = {
        client_id: client.id,
        tenant_id: tenantId,
        from_email: fromEmail,
        to_email: toEmail,
        subject,
        body_text: finalBody,
        status: scheduledAt ? 'scheduled' : 'sending',
        scheduled_at: scheduledAt,
        timezone,
        from_account_id: selectedAccountId || null,
        attachments: attachments.length > 0 ? attachments : null,
        sent_by: user?.id,
      };
      
      const { error: insertError } = await supabase.from('client_emails').insert(emailRecord);

      if (insertError) throw insertError;

      // If not scheduled, send immediately
      if (!scheduledAt) {
        const { error: sendError } = await supabase.functions.invoke('send-candidate-email', {
          body: {
            to: toEmail,
            cc: ccEmail || undefined,
            bcc: bccEmail || undefined,
            subject,
            body: finalBody,
            from_email: fromEmail,
            from_name: fromName,
            attachments: attachments.length > 0 ? attachments : undefined,
            account_id: selectedAccountId || undefined,
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

      toast.success(scheduledAt ? 'Email scheduled successfully' : 'Email sent successfully');
      onOpenChange(false);
      
      // Reset form
      setSubject('');
      setBody('');
      setCcEmail('');
      setBccEmail('');
      setAttachments([]);
      setScheduleEnabled(false);
      setSelectedTemplate('');
    } catch (error: any) {
      console.error('Error sending email:', error);
      toast.error(error.message || 'Failed to send email');
    } finally {
      setIsSending(false);
    }
  };

  const getPreviewContent = () => {
    let content = body;
    if (appendSignature && signatureText) {
      content += `\n\n${signatureText}`;
    }
    return content;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Mail className="w-5 h-5" />
            Send Email to {client.contact_name || client.name}
          </DialogTitle>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)} className="flex-1 overflow-hidden flex flex-col">
          <TabsList className="w-fit">
            <TabsTrigger value="compose">Compose</TabsTrigger>
            <TabsTrigger value="preview">Preview</TabsTrigger>
          </TabsList>

          <ScrollArea className="flex-1 pr-4">
            <TabsContent value="compose" className="space-y-4 mt-4">
              {/* Sender Account */}
              {emailAccounts.length > 0 && (
                <div className="space-y-2">
                  <Label>From</Label>
                  <Select value={selectedAccountId} onValueChange={setSelectedAccountId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select sender account" />
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

              {/* To */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>To</Label>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowCcBcc(!showCcBcc)}
                    className="text-xs"
                  >
                    {showCcBcc ? <ChevronUp className="w-3 h-3 mr-1" /> : <ChevronDown className="w-3 h-3 mr-1" />}
                    CC/BCC
                  </Button>
                </div>
                <Input
                  value={toEmail}
                  onChange={(e) => setToEmail(e.target.value)}
                  placeholder="recipient@example.com"
                />
              </div>

              {/* CC/BCC */}
              {showCcBcc && (
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>CC</Label>
                    <Input
                      value={ccEmail}
                      onChange={(e) => setCcEmail(e.target.value)}
                      placeholder="cc@example.com"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>BCC</Label>
                    <Input
                      value={bccEmail}
                      onChange={(e) => setBccEmail(e.target.value)}
                      placeholder="bcc@example.com"
                    />
                  </div>
                </div>
              )}

              {/* Template Selection */}
              {templates.length > 0 && (
                <div className="space-y-2">
                  <Label>Template</Label>
                  <Select value={selectedTemplate} onValueChange={handleTemplateSelect}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select a template (optional)" />
                    </SelectTrigger>
                    <SelectContent>
                      {templates.map(template => (
                        <SelectItem key={template.id} value={template.id}>
                          {template.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {/* Subject */}
              <div className="space-y-2">
                <Label>Subject *</Label>
                <Input
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  placeholder="Email subject"
                />
              </div>

              {/* Body */}
              <div className="space-y-2">
                <Label>Message *</Label>
                <Textarea
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  placeholder="Write your message..."
                  rows={8}
                />
              </div>

              {/* Signature */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>Signature</Label>
                  <div className="flex items-center gap-2">
                    <Switch
                      checked={appendSignature}
                      onCheckedChange={setAppendSignature}
                      id="signature-toggle"
                    />
                    <Label htmlFor="signature-toggle" className="text-sm font-normal">
                      Include signature
                    </Label>
                  </div>
                </div>
                {appendSignature && (
                  <Textarea
                    value={signatureText}
                    onChange={(e) => setSignatureText(e.target.value)}
                    rows={4}
                    className="text-sm"
                  />
                )}
              </div>

              <Separator />

              {/* Attachments */}
              <div className="space-y-2">
                <Label>Attachments</Label>
                <div className="flex flex-wrap gap-2">
                  {attachments.map((att, index) => (
                    <Badge key={index} variant="secondary" className="py-1 px-2">
                      {att.name}
                      <button
                        onClick={() => removeAttachment(index)}
                        className="ml-2 hover:text-destructive"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </Badge>
                  ))}
                  <input
                    ref={fileInputRef}
                    type="file"
                    multiple
                    onChange={handleFileSelect}
                    className="hidden"
                    accept=".pdf,.doc,.docx,.xls,.xlsx,.png,.jpg,.jpeg"
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isUploading}
                  >
                    {isUploading ? (
                      <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                    ) : (
                      <Paperclip className="w-4 h-4 mr-1" />
                    )}
                    Attach File
                  </Button>
                </div>
              </div>

              <Separator />

              {/* Schedule */}
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <Switch
                    checked={scheduleEnabled}
                    onCheckedChange={setScheduleEnabled}
                    id="schedule-toggle"
                  />
                  <Label htmlFor="schedule-toggle" className="flex items-center gap-2">
                    <Clock className="w-4 h-4" />
                    Schedule for later
                  </Label>
                </div>
                
                {scheduleEnabled && (
                  <div className="grid grid-cols-3 gap-4">
                    <div className="space-y-2">
                      <Label>Date</Label>
                      <Input
                        type="date"
                        value={scheduledDate}
                        onChange={(e) => setScheduledDate(e.target.value)}
                        min={format(new Date(), 'yyyy-MM-dd')}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Time</Label>
                      <Input
                        type="time"
                        value={scheduledTime}
                        onChange={(e) => setScheduledTime(e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Timezone</Label>
                      <Select value={timezone} onValueChange={setTimezone}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {TIMEZONES.map(tz => (
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

            <TabsContent value="preview" className="mt-4">
              <div className="bg-muted/30 rounded-lg p-6 space-y-4">
                <div>
                  <p className="text-sm text-muted-foreground">To:</p>
                  <p>{toEmail}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Subject:</p>
                  <p className="font-medium">{subject || '(No subject)'}</p>
                </div>
                <Separator />
                <div className="whitespace-pre-wrap">
                  {getPreviewContent() || '(No content)'}
                </div>
                {attachments.length > 0 && (
                  <>
                    <Separator />
                    <div>
                      <p className="text-sm text-muted-foreground mb-2">Attachments:</p>
                      <div className="flex flex-wrap gap-2">
                        {attachments.map((att, i) => (
                          <Badge key={i} variant="outline">{att.name}</Badge>
                        ))}
                      </div>
                    </div>
                  </>
                )}
              </div>
            </TabsContent>
          </ScrollArea>

          <div className="flex justify-end gap-2 pt-4 border-t">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button onClick={handleSend} disabled={isSending || !toEmail || !subject || !body}>
              {isSending ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : scheduleEnabled ? (
                <Clock className="w-4 h-4 mr-2" />
              ) : (
                <Send className="w-4 h-4 mr-2" />
              )}
              {scheduleEnabled ? 'Schedule' : 'Send'}
            </Button>
          </div>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
