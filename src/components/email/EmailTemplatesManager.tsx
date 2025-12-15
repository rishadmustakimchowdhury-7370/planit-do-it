import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Plus,
  Edit2,
  Trash2,
  FileText,
  Loader2,
  Save,
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth';
import { toast } from 'sonner';

interface EmailTemplate {
  id: string;
  name: string;
  subject: string;
  body_text: string;
  tags: string[];
  is_active: boolean;
  created_at: string;
}

const PLACEHOLDERS = [
  { key: '{{candidate_first_name}}', label: 'Candidate First Name' },
  { key: '{{candidate_last_name}}', label: 'Candidate Last Name' },
  { key: '{{candidate_email}}', label: 'Candidate Email' },
  { key: '{{candidate_phone}}', label: 'Candidate Phone' },
  { key: '{{job_title}}', label: 'Job Title' },
  { key: '{{company_name}}', label: 'Company Name' },
  { key: '{{recruiter_name}}', label: 'Recruiter Name' },
  { key: '{{recruiter_email}}', label: 'Recruiter Email' },
  { key: '{{location}}', label: 'Location' },
  { key: '{{today_date}}', label: 'Today\'s Date' },
  { key: '{{application_link}}', label: 'Application Link' },
];

export function EmailTemplatesManager() {
  const { user, tenantId } = useAuth();
  const [templates, setTemplates] = useState<EmailTemplate[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showDialog, setShowDialog] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<EmailTemplate | null>(null);
  const [deleteTemplate, setDeleteTemplate] = useState<EmailTemplate | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // Form state
  const [formName, setFormName] = useState('');
  const [formSubject, setFormSubject] = useState('');
  const [formBody, setFormBody] = useState('');
  const [formTags, setFormTags] = useState('');

  useEffect(() => {
    if (tenantId) {
      fetchTemplates();
    }
  }, [tenantId]);

  const fetchTemplates = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('user_email_templates')
        .select('*')
        .order('name');

      if (error) throw error;
      setTemplates(data || []);
    } catch (error) {
      console.error('Error fetching templates:', error);
      toast.error('Failed to load templates');
    } finally {
      setIsLoading(false);
    }
  };

  const openCreateDialog = () => {
    setEditingTemplate(null);
    setFormName('');
    setFormSubject('');
    setFormBody('');
    setFormTags('');
    setShowDialog(true);
  };

  const openEditDialog = (template: EmailTemplate) => {
    setEditingTemplate(template);
    setFormName(template.name);
    setFormSubject(template.subject);
    setFormBody(template.body_text);
    setFormTags(template.tags?.join(', ') || '');
    setShowDialog(true);
  };

  const handleSave = async () => {
    if (!formName.trim()) {
      toast.error('Please enter a template name');
      return;
    }
    if (!formSubject.trim()) {
      toast.error('Please enter a subject');
      return;
    }
    if (!formBody.trim()) {
      toast.error('Please enter a message body');
      return;
    }

    // Validate no HTML
    if (formBody.includes('<') || formBody.includes('>')) {
      toast.error('HTML is not allowed in templates. Please use plain text only.');
      return;
    }

    setIsSaving(true);
    try {
      const tagsArray = formTags
        .split(',')
        .map((t) => t.trim())
        .filter((t) => t.length > 0);

      if (editingTemplate) {
        // Update existing
        const { error } = await supabase
          .from('user_email_templates')
          .update({
            name: formName.trim(),
            subject: formSubject.trim(),
            body_text: formBody.trim(),
            tags: tagsArray,
          })
          .eq('id', editingTemplate.id);

        if (error) throw error;
        toast.success('Template updated');
      } else {
        // Create new
        const { error } = await supabase
          .from('user_email_templates')
          .insert({
            user_id: user?.id,
            tenant_id: tenantId,
            name: formName.trim(),
            subject: formSubject.trim(),
            body_text: formBody.trim(),
            tags: tagsArray,
          });

        if (error) throw error;
        toast.success('Template created');
      }

      setShowDialog(false);
      fetchTemplates();
    } catch (error: any) {
      console.error('Error saving template:', error);
      toast.error(error.message || 'Failed to save template');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTemplate) return;

    try {
      const { error } = await supabase
        .from('user_email_templates')
        .delete()
        .eq('id', deleteTemplate.id);

      if (error) throw error;

      toast.success('Template deleted');
      setDeleteTemplate(null);
      fetchTemplates();
    } catch (error: any) {
      console.error('Error deleting template:', error);
      toast.error(error.message || 'Failed to delete template');
    }
  };

  const insertPlaceholder = (placeholder: string) => {
    setFormBody((prev) => prev + ' ' + placeholder);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Email Templates</h3>
          <p className="text-sm text-muted-foreground">
            Create reusable email templates with placeholders
          </p>
        </div>
        <Button onClick={openCreateDialog} className="gap-2">
          <Plus className="h-4 w-4" />
          Create Template
        </Button>
      </div>

      {templates.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h4 className="text-lg font-medium mb-2">No templates yet</h4>
            <p className="text-muted-foreground mb-4">
              Create your first email template to speed up your outreach.
            </p>
            <Button onClick={openCreateDialog} className="gap-2">
              <Plus className="h-4 w-4" />
              Create Template
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {templates.map((template) => (
            <Card key={template.id} className="hover:shadow-md transition-shadow">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle className="text-base">{template.name}</CardTitle>
                    <CardDescription className="text-sm mt-1 line-clamp-1">
                      Subject: {template.subject}
                    </CardDescription>
                  </div>
                  <div className="flex gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => openEditDialog(template)}
                    >
                      <Edit2 className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => setDeleteTemplate(template)}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="pt-0">
                <p className="text-sm text-muted-foreground line-clamp-2 mb-3">
                  {template.body_text}
                </p>
                {template.tags && template.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {template.tags.map((tag) => (
                      <Badge key={tag} variant="secondary" className="text-xs">
                        {tag}
                      </Badge>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Create/Edit Dialog */}
      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingTemplate ? 'Edit Template' : 'Create Template'}
            </DialogTitle>
            <DialogDescription>
              Create a reusable email template. Use placeholders to personalize each email.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="name">Template Name *</Label>
              <Input
                id="name"
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                placeholder="e.g., Initial Outreach"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="subject">Subject Line *</Label>
              <Input
                id="subject"
                value={formSubject}
                onChange={(e) => setFormSubject(e.target.value)}
                placeholder="e.g., Exciting {{job_title}} Opportunity at {{company_name}}"
              />
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="body">Email Body (Plain Text) *</Label>
              </div>
              <div className="flex flex-wrap gap-1 mb-2">
                {PLACEHOLDERS.slice(0, 6).map((p) => (
                  <Badge
                    key={p.key}
                    variant="outline"
                    className="text-xs cursor-pointer hover:bg-muted"
                    onClick={() => insertPlaceholder(p.key)}
                  >
                    {p.label}
                  </Badge>
                ))}
              </div>
              <Textarea
                id="body"
                value={formBody}
                onChange={(e) => setFormBody(e.target.value)}
                placeholder="Hi {{candidate_first_name}},&#10;&#10;I came across your profile and thought you'd be a great fit for our {{job_title}} role..."
                rows={10}
                className="resize-none font-mono text-sm"
              />
              <p className="text-xs text-muted-foreground">
                Plain text only. HTML is not allowed.
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="tags">Tags (comma-separated)</Label>
              <Input
                id="tags"
                value={formTags}
                onChange={(e) => setFormTags(e.target.value)}
                placeholder="e.g., outreach, tech, senior"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={isSaving} className="gap-2">
              {isSaving ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="h-4 w-4" />
                  {editingTemplate ? 'Update' : 'Create'}
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteTemplate} onOpenChange={() => setDeleteTemplate(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Template</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{deleteTemplate?.name}"? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
