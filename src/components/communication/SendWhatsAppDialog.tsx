import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth';
import { toast } from 'sonner';
import { MessageCircle, ExternalLink } from 'lucide-react';

interface SendWhatsAppDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  recipientPhone: string;
  recipientName: string;
  context?: 'candidate' | 'job';
  contextData?: {
    jobTitle?: string;
    candidateName?: string;
  };
}

interface WhatsAppTemplate {
  id: string;
  name: string;
  message: string;
}

export function SendWhatsAppDialog({ 
  open, 
  onOpenChange, 
  recipientPhone, 
  recipientName,
  context,
  contextData 
}: SendWhatsAppDialogProps) {
  const { profile } = useAuth();
  const [templates, setTemplates] = useState<WhatsAppTemplate[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<string>('');
  const [message, setMessage] = useState('');
  const [signature, setSignature] = useState('');

  useEffect(() => {
    if (open) {
      fetchTemplates();
      loadUserSignature();
    }
  }, [open]);

  const fetchTemplates = async () => {
    const { data } = await supabase
      .from('whatsapp_templates')
      .select('id, name, message')
      .eq('is_active', true);
    setTemplates(data || []);
  };

  const loadUserSignature = () => {
    setSignature(`\n\nBest regards,\n${profile?.full_name || 'Recruiter'}`);
  };

  const handleTemplateSelect = (templateId: string) => {
    setSelectedTemplate(templateId);
    const template = templates.find(t => t.id === templateId);
    if (template) {
      let content = template.message;

      // Replace variables
      const variables: Record<string, string> = {
        '{{name}}': recipientName,
        '{{candidate_name}}': contextData?.candidateName || recipientName,
        '{{job_title}}': contextData?.jobTitle || '',
        '{{sender_name}}': profile?.full_name || 'Recruiter',
      };

      Object.entries(variables).forEach(([key, value]) => {
        content = content.replace(new RegExp(key, 'g'), value);
      });

      setMessage(content);
    }
  };

  const formatPhoneNumber = (phone: string): string => {
    // Remove all non-numeric characters
    let cleaned = phone.replace(/\D/g, '');
    
    // If it starts with 0, remove it and add country code
    if (cleaned.startsWith('0')) {
      cleaned = '1' + cleaned.substring(1); // Default to US country code
    }
    
    // If no country code, assume US
    if (cleaned.length === 10) {
      cleaned = '1' + cleaned;
    }
    
    return cleaned;
  };

  const handleSendWhatsApp = () => {
    if (!message) {
      toast.error('Please enter a message');
      return;
    }

    const fullMessage = `${message}${signature}`;
    const formattedPhone = formatPhoneNumber(recipientPhone);
    const encodedMessage = encodeURIComponent(fullMessage);
    
    // Open WhatsApp Web with pre-filled message
    const whatsappUrl = `https://wa.me/${formattedPhone}?text=${encodedMessage}`;
    window.open(whatsappUrl, '_blank');
    
    toast.success('WhatsApp opened with your message');
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MessageCircle className="h-5 w-5 text-green-500" />
            Send WhatsApp to {recipientName}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <Label>Phone Number</Label>
            <div className="text-sm text-muted-foreground bg-muted px-3 py-2 rounded">
              {recipientPhone}
            </div>
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
            <Label>Message</Label>
            <Textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Write your WhatsApp message..."
              rows={6}
            />
          </div>

          <div>
            <Label>Signature</Label>
            <Textarea
              value={signature}
              onChange={(e) => setSignature(e.target.value)}
              rows={2}
              className="text-sm text-muted-foreground"
            />
          </div>

          <p className="text-xs text-muted-foreground">
            This will open WhatsApp Web with your pre-filled message
          </p>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSendWhatsApp} className="bg-green-600 hover:bg-green-700">
            <ExternalLink className="h-4 w-4 mr-2" />
            Open WhatsApp
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
