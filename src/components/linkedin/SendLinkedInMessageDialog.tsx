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
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Linkedin, ExternalLink, Check, Loader2, Copy, Send, Info, ArrowRight } from 'lucide-react';
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
  const [step, setStep] = useState<'compose' | 'send'>('compose');
  const [messageCopied, setMessageCopied] = useState(false);
  const [linkedInOpened, setLinkedInOpened] = useState(false);

  useEffect(() => {
    if (open && tenantId) {
      fetchTemplates();
      setStep('compose');
      setMessageCopied(false);
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

  const handleCopyAndOpen = async () => {
    try {
      await navigator.clipboard.writeText(messageText);
      setMessageCopied(true);
      toast.success('Message copied to clipboard!');
      
      // Small delay then open LinkedIn
      setTimeout(() => {
        window.open(candidate.linkedin_url, '_blank');
        setLinkedInOpened(true);
        setStep('send');
      }, 500);
    } catch (error) {
      toast.error('Failed to copy message');
    }
  };

  const handleOpenLinkedIn = () => {
    window.open(candidate.linkedin_url, '_blank');
    setLinkedInOpened(true);
  };

  const handleCopyMessage = async () => {
    try {
      await navigator.clipboard.writeText(messageText);
      setMessageCopied(true);
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

      toast.success('LinkedIn connection request tracked!');
      onOpenChange(false);
      
      // Reset state
      setMessageText('');
      setSelectedTemplateId('');
      setStep('compose');
      setMessageCopied(false);
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
            Send LinkedIn Connection Request
          </DialogTitle>
          <DialogDescription>
            Compose a message for {candidate.full_name}
          </DialogDescription>
        </DialogHeader>

        {step === 'compose' ? (
          <div className="space-y-4">
            {/* Quick Info */}
            <Alert className="bg-[#0077B5]/5 border-[#0077B5]/20">
              <Info className="w-4 h-4 text-[#0077B5]" />
              <AlertDescription className="text-sm">
                Compose your message below, then click "Copy & Open LinkedIn" to send it directly.
              </AlertDescription>
            </Alert>

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
              <Label>Connection Message</Label>
              <Textarea
                value={messageText}
                onChange={(e) => setMessageText(e.target.value)}
                placeholder="Hi {{first_name}}, I came across your profile and would love to connect..."
                className="min-h-[150px] resize-none"
              />
              <div className="flex items-center justify-between">
                <p className="text-xs text-muted-foreground">
                  {messageText.length} / 300 characters (LinkedIn limit for connection notes)
                </p>
                {messageText.length > 300 && (
                  <Badge variant="destructive" className="text-xs">
                    Exceeds limit
                  </Badge>
                )}
              </div>
            </div>

            {/* Primary Action */}
            <div className="flex flex-col gap-3 pt-4 border-t">
              <Button
                onClick={handleCopyAndOpen}
                disabled={!messageText.trim() || messageText.length > 300}
                className="w-full gap-2 bg-[#0077B5] hover:bg-[#005885] h-11"
              >
                <Copy className="w-4 h-4" />
                Copy Message & Open LinkedIn
                <ArrowRight className="w-4 h-4 ml-auto" />
              </Button>
              
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleCopyMessage}
                  disabled={!messageText.trim()}
                  className="flex-1 gap-2"
                >
                  <Copy className="w-4 h-4" />
                  Copy Only
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleOpenLinkedIn}
                  className="flex-1 gap-2"
                >
                  <ExternalLink className="w-4 h-4" />
                  Open LinkedIn
                </Button>
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Send Confirmation Step */}
            <div className="text-center space-y-4 py-4">
              <div className="w-16 h-16 rounded-full bg-[#0077B5]/10 flex items-center justify-center mx-auto">
                <Linkedin className="w-8 h-8 text-[#0077B5]" />
              </div>
              
              <div>
                <h3 className="text-lg font-semibold">Almost there!</h3>
                <p className="text-muted-foreground">
                  Complete these steps on LinkedIn:
                </p>
              </div>

              <div className="text-left space-y-3 bg-muted/50 rounded-lg p-4">
                <div className="flex items-start gap-3">
                  <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium ${messageCopied ? 'bg-green-500 text-white' : 'bg-muted-foreground/20 text-muted-foreground'}`}>
                    {messageCopied ? <Check className="w-4 h-4" /> : '1'}
                  </div>
                  <div>
                    <p className="font-medium">Message copied</p>
                    <p className="text-sm text-muted-foreground">Your message is ready to paste</p>
                  </div>
                </div>
                
                <div className="flex items-start gap-3">
                  <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium ${linkedInOpened ? 'bg-green-500 text-white' : 'bg-muted-foreground/20 text-muted-foreground'}`}>
                    {linkedInOpened ? <Check className="w-4 h-4" /> : '2'}
                  </div>
                  <div>
                    <p className="font-medium">LinkedIn profile opened</p>
                    <p className="text-sm text-muted-foreground">Click "Connect" and add a note</p>
                  </div>
                </div>
                
                <div className="flex items-start gap-3">
                  <div className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium bg-muted-foreground/20 text-muted-foreground">
                    3
                  </div>
                  <div>
                    <p className="font-medium">Paste & send</p>
                    <p className="text-sm text-muted-foreground">Paste your message and send the request</p>
                  </div>
                </div>
              </div>

              {!linkedInOpened && (
                <Button
                  variant="outline"
                  onClick={handleOpenLinkedIn}
                  className="gap-2"
                >
                  <ExternalLink className="w-4 h-4" />
                  Open LinkedIn Profile
                </Button>
              )}
            </div>

            {/* Actions */}
            <div className="flex gap-2 pt-4 border-t">
              <Button
                variant="outline"
                onClick={() => setStep('compose')}
                className="flex-1"
              >
                Back to Edit
              </Button>
              <Button
                onClick={handleMarkAsSent}
                disabled={isSaving}
                className="flex-1 gap-2 bg-green-600 hover:bg-green-700"
              >
                {isSaving ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Send className="w-4 h-4" />
                )}
                I Sent the Request
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
