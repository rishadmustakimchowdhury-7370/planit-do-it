import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Linkedin, ExternalLink, Check, Loader2, Copy } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth';
import { toast } from 'sonner';
import { useRecruiterActivity } from '@/hooks/useRecruiterActivity';

interface SendLinkedInMessageDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  candidate: {
    id: string;
    full_name: string;
    linkedin_url: string;
    current_title?: string | null;
    current_company?: string | null;
  };
  jobId?: string;
  jobTitle?: string;
}

interface Template {
  id: string;
  name: string;
  body: string;
  category: string;
}

const PLACEHOLDERS = [
  { key: '{{candidate_name}}', description: 'Candidate full name' },
  { key: '{{first_name}}', description: 'Candidate first name' },
  { key: '{{job_title}}', description: 'Job title (if selected)' },
  { key: '{{current_company}}', description: 'Current company' },
  { key: '{{current_title}}', description: 'Current job title' },
];

export function SendLinkedInMessageDialog({
  open,
  onOpenChange,
  candidate,
  jobId,
  jobTitle,
}: SendLinkedInMessageDialogProps) {
  const { user, tenantId } = useAuth();
  const { logActivity } = useRecruiterActivity();
  const [templates, setTemplates] = useState<Template[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>('');
  const [messageText, setMessageText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [linkedInOpened, setLinkedInOpened] = useState(false);

  useEffect(() => {
    if (open && tenantId) {
      fetchTemplates();
      setLinkedInOpened(false);
    }
  }, [open, tenantId]);

  const fetchTemplates = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('linkedin_message_templates')
        .select('*')
        .eq('tenant_id', tenantId)
        .eq('is_active', true)
        .order('name');

      if (error) throw error;
      setTemplates(data || []);
    } catch (error) {
      console.error('Error fetching templates:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const replacePlaceholders = (text: string) => {
    const firstName = candidate.full_name.split(' ')[0];
    return text
      .replace(/\{\{candidate_name\}\}/g, candidate.full_name)
      .replace(/\{\{first_name\}\}/g, firstName)
      .replace(/\{\{job_title\}\}/g, jobTitle || '[Job Title]')
      .replace(/\{\{current_company\}\}/g, candidate.current_company || '[Company]')
      .replace(/\{\{current_title\}\}/g, candidate.current_title || '[Title]');
  };

  const handleTemplateSelect = (templateId: string) => {
    setSelectedTemplateId(templateId);
    const template = templates.find(t => t.id === templateId);
    if (template) {
      setMessageText(replacePlaceholders(template.body));
    }
  };

  const handleOpenLinkedIn = () => {
    window.open(candidate.linkedin_url, '_blank');
    setLinkedInOpened(true);
    toast.success('LinkedIn profile opened. Copy the message and send it manually.');
  };

  const handleCopyMessage = async () => {
    try {
      await navigator.clipboard.writeText(messageText);
      toast.success('Message copied to clipboard');
    } catch (error) {
      toast.error('Failed to copy message');
    }
  };

  const handleMarkAsSent = async () => {
    if (!user?.id || !tenantId) {
      toast.error('You must be logged in');
      return;
    }

    if (!messageText.trim()) {
      toast.error('Please enter a message');
      return;
    }

    setIsSaving(true);
    try {
      // Log the message
      const { error: logError } = await supabase
        .from('linkedin_message_logs')
        .insert({
          tenant_id: tenantId,
          candidate_id: candidate.id,
          job_id: jobId || null,
          template_id: selectedTemplateId || null,
          sent_by: user.id,
          message_text: messageText,
          status: 'sent',
        });

      if (logError) throw logError;

      // Log activity
      await logActivity({
        action_type: 'linkedin_message_sent',
        candidate_id: candidate.id,
        job_id: jobId,
        metadata: {
          template_id: selectedTemplateId || null,
          message_length: messageText.length,
        },
      });

      toast.success('LinkedIn message marked as sent');
      onOpenChange(false);
      
      // Reset state
      setMessageText('');
      setSelectedTemplateId('');
      setLinkedInOpened(false);
    } catch (error) {
      console.error('Error logging message:', error);
      toast.error('Failed to log message');
    } finally {
      setIsSaving(false);
    }
  };

  const insertPlaceholder = (placeholder: string) => {
    setMessageText(prev => prev + placeholder);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Linkedin className="w-5 h-5 text-[#0077B5]" />
            Send LinkedIn Message
          </DialogTitle>
          <DialogDescription>
            Compose a message for {candidate.full_name}. You'll need to copy and send it manually on LinkedIn.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Template Selection */}
          <div className="space-y-2">
            <Label>Message Template</Label>
            <Select value={selectedTemplateId} onValueChange={handleTemplateSelect}>
              <SelectTrigger>
                <SelectValue placeholder="Select a template or write from scratch" />
              </SelectTrigger>
              <SelectContent>
                {templates.map((template) => (
                  <SelectItem key={template.id} value={template.id}>
                    <div className="flex items-center gap-2">
                      <span>{template.name}</span>
                      <Badge variant="secondary" className="text-xs">
                        {template.category}
                      </Badge>
                    </div>
                  </SelectItem>
                ))}
                {templates.length === 0 && (
                  <div className="px-2 py-1.5 text-sm text-muted-foreground">
                    No templates available
                  </div>
                )}
              </SelectContent>
            </Select>
          </div>

          {/* Placeholders */}
          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground">Insert placeholder:</Label>
            <div className="flex flex-wrap gap-1">
              {PLACEHOLDERS.map((p) => (
                <Button
                  key={p.key}
                  variant="outline"
                  size="sm"
                  className="h-6 text-xs"
                  onClick={() => insertPlaceholder(p.key)}
                >
                  {p.key}
                </Button>
              ))}
            </div>
          </div>

          {/* Message Editor */}
          <div className="space-y-2">
            <Label>Message</Label>
            <Textarea
              value={messageText}
              onChange={(e) => setMessageText(e.target.value)}
              placeholder="Type your LinkedIn message here..."
              className="min-h-[200px] resize-none"
            />
            <p className="text-xs text-muted-foreground">
              {messageText.length} characters
            </p>
          </div>

          {/* Actions */}
          <div className="flex flex-col sm:flex-row gap-2 pt-4 border-t">
            <Button
              variant="outline"
              onClick={handleCopyMessage}
              disabled={!messageText.trim()}
              className="gap-2"
            >
              <Copy className="w-4 h-4" />
              Copy Message
            </Button>
            <Button
              variant="outline"
              onClick={handleOpenLinkedIn}
              className="gap-2"
            >
              <ExternalLink className="w-4 h-4" />
              Open LinkedIn Profile
            </Button>
            <Button
              onClick={handleMarkAsSent}
              disabled={isSaving || !messageText.trim()}
              className="gap-2 ml-auto bg-[#0077B5] hover:bg-[#005885]"
            >
              {isSaving ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Check className="w-4 h-4" />
              )}
              Mark as Sent
            </Button>
          </div>

          {linkedInOpened && (
            <p className="text-sm text-success flex items-center gap-2">
              <Check className="w-4 h-4" />
              LinkedIn profile opened. Copy the message and paste it in LinkedIn.
            </p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
