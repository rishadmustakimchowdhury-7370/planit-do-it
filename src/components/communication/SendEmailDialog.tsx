import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth';
import { toast } from 'sonner';
import { Loader2, Send } from 'lucide-react';

interface SendEmailDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  recipientEmail: string;
  recipientName: string;
  context?: 'candidate' | 'job';
  contextData?: {
    jobTitle?: string;
    candidateName?: string;
  };
}

interface EmailTemplate {
  id: string;
  name: string;
  subject: string;
  html_content: string;
}

export function SendEmailDialog({ 
  open, 
  onOpenChange, 
  recipientEmail, 
  recipientName,
  context,
  contextData 
}: SendEmailDialogProps) {
  const { profile, tenantId } = useAuth();
  const [templates, setTemplates] = useState<EmailTemplate[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<string>('');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [signature, setSignature] = useState('');
  const [isSending, setIsSending] = useState(false);

  useEffect(() => {
    if (open) {
      fetchTemplates();
      loadUserSignature();
    }
  }, [open]);

  const fetchTemplates = async () => {
    const { data } = await supabase
      .from('email_templates')
      .select('id, name, subject, html_content')
      .eq('is_active', true);
    setTemplates(data || []);
  };

  const loadUserSignature = async () => {
    if (profile?.email_signature) {
      setSignature(profile.email_signature);
    } else {
      // Default signature
      setSignature(`Best regards,\n${profile?.full_name || 'Recruiter'}\n${profile?.email || ''}`);
    }
  };

  const handleTemplateSelect = (templateId: string) => {
    setSelectedTemplate(templateId);
    const template = templates.find(t => t.id === templateId);
    if (template) {
      let content = template.html_content;
      let subjectLine = template.subject;

      // Replace variables
      const variables: Record<string, string> = {
        '{{name}}': recipientName,
        '{{candidate_name}}': contextData?.candidateName || recipientName,
        '{{job_title}}': contextData?.jobTitle || '',
        '{{company}}': 'Recruitsy',
        '{{sender_name}}': profile?.full_name || 'Recruiter',
      };

      Object.entries(variables).forEach(([key, value]) => {
        content = content.replace(new RegExp(key, 'g'), value);
        subjectLine = subjectLine.replace(new RegExp(key, 'g'), value);
      });

      setSubject(subjectLine);
      // Extract text from HTML for the textarea
      const tempDiv = document.createElement('div');
      tempDiv.innerHTML = content;
      setBody(tempDiv.textContent || tempDiv.innerText || '');
    }
  };

  const handleSend = async () => {
    if (!subject || !body) {
      toast.error('Subject and message are required');
      return;
    }

    setIsSending(true);
    try {
      const fullBody = `${body}\n\n${signature}`;
      
      // Convert plain text to simple HTML
      const htmlContent = `
        <div style="font-family: Arial, sans-serif; line-height: 1.6;">
          ${fullBody.replace(/\n/g, '<br/>')}
        </div>
      `;

      const { error } = await supabase.functions.invoke('send-email', {
        body: {
          to: recipientEmail,
          subject,
          html: htmlContent,
        },
      });

      if (error) throw error;

      // Log the email
      await supabase.from('email_logs').insert({
        recipient_email: recipientEmail,
        subject,
        template_name: selectedTemplate || null,
        status: 'sent',
        tenant_id: tenantId,
        sent_by: profile?.id,
        metadata: { context, contextData },
      });

      toast.success('Email sent successfully');
      onOpenChange(false);
      setSubject('');
      setBody('');
      setSelectedTemplate('');
    } catch (error: any) {
      // Log failure
      await supabase.from('email_logs').insert({
        recipient_email: recipientEmail,
        subject,
        template_name: selectedTemplate || null,
        status: 'failed',
        error_message: error.message,
        tenant_id: tenantId,
        sent_by: profile?.id,
      });
      toast.error('Failed to send email: ' + error.message);
    } finally {
      setIsSending(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Send Email to {recipientName}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <Label>To</Label>
            <Input value={recipientEmail} disabled />
          </div>

          <div>
            <Label>Template (Optional)</Label>
            <Select value={selectedTemplate} onValueChange={handleTemplateSelect}>
              <SelectTrigger>
                <SelectValue placeholder="Select a template..." />
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

          <div>
            <Label>Subject</Label>
            <Input
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="Enter subject..."
            />
          </div>

          <div>
            <Label>Message</Label>
            <Textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="Write your message..."
              rows={8}
            />
          </div>

          <div>
            <Label>Signature</Label>
            <Textarea
              value={signature}
              onChange={(e) => setSignature(e.target.value)}
              rows={3}
              className="text-sm text-muted-foreground"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSend} disabled={isSending}>
            {isSending ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Send className="h-4 w-4 mr-2" />
            )}
            Send Email
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
