import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Plus, Pencil, Trash2, Loader2, Linkedin } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth';
import { toast } from 'sonner';

interface Template {
  id: string;
  name: string;
  subject: string | null;
  body: string;
  category: string;
  is_active: boolean;
  created_at: string;
}

const CATEGORIES = [
  'general',
  'job_opportunity',
  'follow_up',
  'introduction',
  'networking',
];

const PLACEHOLDERS = [
  '{{candidate_name}}',
  '{{first_name}}',
  '{{job_title}}',
  '{{current_company}}',
  '{{current_title}}',
];

export function LinkedInTemplatesManager() {
  const { user, tenantId } = useAuth();
  const [templates, setTemplates] = useState<Template[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<Template | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const [formData, setFormData] = useState({
    name: '',
    subject: '',
    body: '',
    category: 'general',
    is_active: true,
  });

  useEffect(() => {
    if (tenantId) {
      fetchTemplates();
    }
  }, [tenantId]);

  const fetchTemplates = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('linkedin_message_templates')
        .select('*')
        .eq('tenant_id', tenantId)
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

  const handleOpenDialog = (template?: Template) => {
    if (template) {
      setEditingTemplate(template);
      setFormData({
        name: template.name,
        subject: template.subject || '',
        body: template.body,
        category: template.category,
        is_active: template.is_active,
      });
    } else {
      setEditingTemplate(null);
      setFormData({
        name: '',
        subject: '',
        body: '',
        category: 'general',
        is_active: true,
      });
    }
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!formData.name.trim() || !formData.body.trim()) {
      toast.error('Name and body are required');
      return;
    }

    setIsSaving(true);
    try {
      if (editingTemplate) {
        const { error } = await supabase
          .from('linkedin_message_templates')
          .update({
            name: formData.name,
            subject: formData.subject || null,
            body: formData.body,
            category: formData.category,
            is_active: formData.is_active,
          })
          .eq('id', editingTemplate.id);

        if (error) throw error;
        toast.success('Template updated');
      } else {
        const { error } = await supabase
          .from('linkedin_message_templates')
          .insert({
            tenant_id: tenantId,
            name: formData.name,
            subject: formData.subject || null,
            body: formData.body,
            category: formData.category,
            is_active: formData.is_active,
            created_by: user?.id,
          });

        if (error) throw error;
        toast.success('Template created');
      }

      setDialogOpen(false);
      fetchTemplates();
    } catch (error) {
      console.error('Error saving template:', error);
      toast.error('Failed to save template');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this template?')) return;

    try {
      const { error } = await supabase
        .from('linkedin_message_templates')
        .delete()
        .eq('id', id);

      if (error) throw error;
      toast.success('Template deleted');
      fetchTemplates();
    } catch (error) {
      console.error('Error deleting template:', error);
      toast.error('Failed to delete template');
    }
  };

  const handleToggleActive = async (id: string, isActive: boolean) => {
    try {
      const { error } = await supabase
        .from('linkedin_message_templates')
        .update({ is_active: isActive })
        .eq('id', id);

      if (error) throw error;
      setTemplates(prev =>
        prev.map(t => (t.id === id ? { ...t, is_active: isActive } : t))
      );
    } catch (error) {
      console.error('Error updating template:', error);
      toast.error('Failed to update template');
    }
  };

  const insertPlaceholder = (placeholder: string) => {
    setFormData(prev => ({
      ...prev,
      body: prev.body + placeholder,
    }));
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Linkedin className="w-5 h-5 text-[#0077B5]" />
            LinkedIn Message Templates
          </h2>
          <p className="text-sm text-muted-foreground">
            Create reusable templates for LinkedIn outreach
          </p>
        </div>
        <Button onClick={() => handleOpenDialog()} className="gap-2">
          <Plus className="w-4 h-4" />
          Add Template
        </Button>
      </div>

      {templates.length === 0 ? (
        <div className="text-center py-12 border rounded-lg bg-muted/30">
          <Linkedin className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
          <h3 className="font-medium mb-2">No templates yet</h3>
          <p className="text-sm text-muted-foreground mb-4">
            Create your first LinkedIn message template
          </p>
          <Button onClick={() => handleOpenDialog()}>
            <Plus className="w-4 h-4 mr-2" />
            Create Template
          </Button>
        </div>
      ) : (
        <div className="border rounded-lg overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-[100px]">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {templates.map((template) => (
                <TableRow key={template.id}>
                  <TableCell className="font-medium">{template.name}</TableCell>
                  <TableCell>
                    <Badge variant="secondary" className="capitalize">
                      {template.category.replace('_', ' ')}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Switch
                      checked={template.is_active}
                      onCheckedChange={(checked) =>
                        handleToggleActive(template.id, checked)
                      }
                    />
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleOpenDialog(template)}
                      >
                        <Pencil className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleDelete(template.id)}
                      >
                        <Trash2 className="w-4 h-4 text-destructive" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {editingTemplate ? 'Edit Template' : 'Create Template'}
            </DialogTitle>
            <DialogDescription>
              Create a reusable message template for LinkedIn outreach
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="name">Template Name *</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) =>
                    setFormData({ ...formData, name: e.target.value })
                  }
                  placeholder="e.g., Job Opportunity Intro"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="category">Category</Label>
                <Select
                  value={formData.category}
                  onValueChange={(value) =>
                    setFormData({ ...formData, category: value })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CATEGORIES.map((cat) => (
                      <SelectItem key={cat} value={cat} className="capitalize">
                        {cat.replace('_', ' ')}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Insert Placeholders</Label>
              <div className="flex flex-wrap gap-1">
                {PLACEHOLDERS.map((p) => (
                  <Button
                    key={p}
                    variant="outline"
                    size="sm"
                    className="h-6 text-xs"
                    onClick={() => insertPlaceholder(p)}
                  >
                    {p}
                  </Button>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="body">Message Body *</Label>
              <Textarea
                id="body"
                value={formData.body}
                onChange={(e) =>
                  setFormData({ ...formData, body: e.target.value })
                }
                placeholder="Hi {{first_name}}, I came across your profile and..."
                className="min-h-[200px]"
              />
              <p className="text-xs text-muted-foreground">
                {formData.body.length} characters
              </p>
            </div>

            <div className="flex items-center gap-2">
              <Switch
                id="is_active"
                checked={formData.is_active}
                onCheckedChange={(checked) =>
                  setFormData({ ...formData, is_active: checked })
                }
              />
              <Label htmlFor="is_active">Active</Label>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={isSaving}>
              {isSaving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {editingTemplate ? 'Update' : 'Create'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
