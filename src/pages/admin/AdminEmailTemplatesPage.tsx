import { useState, useEffect } from 'react';
import { AdminLayout } from '@/components/admin/AdminLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Plus, Edit, Trash2, Mail, Loader2, Send, Eye, Code, Type, Sparkles, Wand2 } from 'lucide-react';
import { RichTextEditor } from '@/components/ui/rich-text-editor';

interface EmailTemplate {
  id: string;
  name: string;
  subject: string;
  html_content: string;
  variables: any;
  is_active: boolean;
  created_at: string | null;
  updated_at: string | null;
}

export default function AdminEmailTemplatesPage() {
  const [templates, setTemplates] = useState<EmailTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingTemplate, setEditingTemplate] = useState<EmailTemplate | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [previewHtml, setPreviewHtml] = useState('');
  const [saving, setSaving] = useState(false);
  const [editorMode, setEditorMode] = useState<'visual' | 'html'>('visual');
  const [isGenerating, setIsGenerating] = useState(false);
  const [aiPurpose, setAiPurpose] = useState('');
  const [aiTone, setAiTone] = useState<'formal' | 'friendly' | 'professional'>('professional');
  const [showAiPanel, setShowAiPanel] = useState(false);

  const [formData, setFormData] = useState({
    name: '',
    subject: '',
    html_content: '',
    visual_content: '',
    variables: '',
    is_active: true,
  });

  useEffect(() => {
    fetchTemplates();
  }, []);

  const fetchTemplates = async () => {
    try {
      const { data, error } = await supabase
        .from('email_templates')
        .select('*')
        .order('name');

      if (error) throw error;
      setTemplates(data || []);
    } catch (error: any) {
      toast.error('Failed to fetch templates: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenDialog = (template?: EmailTemplate) => {
    if (template) {
      setEditingTemplate(template);
      setFormData({
        name: template.name,
        subject: template.subject,
        html_content: template.html_content,
        visual_content: extractBodyContent(template.html_content),
        variables: Array.isArray(template.variables) ? template.variables.join(', ') : '',
        is_active: template.is_active,
      });
    } else {
      setEditingTemplate(null);
      setFormData({
        name: '',
        subject: '',
        html_content: defaultTemplate,
        visual_content: '<p>Hello {{name}},</p><p>Thank you for your interest. We wanted to reach out and share some important information with you.</p><p>If you have any questions, please don\'t hesitate to contact us.</p><p>Best regards,<br>The Team</p>',
        variables: 'name, company',
        is_active: true,
      });
    }
    setEditorMode('visual');
    setShowAiPanel(false);
    setIsDialogOpen(true);
  };

  const extractBodyContent = (html: string): string => {
    // Try to extract content from the body section
    const bodyMatch = html.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
    if (bodyMatch) {
      // Try to find the main content table
      const contentMatch = bodyMatch[1].match(/<!-- Body -->[\s\S]*?<td[^>]*>([\s\S]*?)<\/td>[\s\S]*?<!-- Footer -->/i);
      if (contentMatch) {
        return contentMatch[1].trim();
      }
      return bodyMatch[1];
    }
    return html;
  };

  const wrapInEmailTemplate = (content: string): string => {
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>{{subject}}</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f3f4f6; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;">
  <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background-color: #f3f4f6;">
    <tr>
      <td style="padding: 32px 16px;">
        <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="600" style="margin: 0 auto; background-color: #ffffff; border-radius: 12px; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1); overflow: hidden;">
          
          <!-- Header -->
          <tr>
            <td style="padding: 24px 32px; border-bottom: 1px solid #e5e7eb; background: linear-gradient(180deg, #ffffff 0%, #f8fafc 100%);">
              <table role="presentation" cellspacing="0" cellpadding="0" border="0">
                <tr>
                  <td style="background: linear-gradient(135deg, #0052CC 0%, #0066FF 100%); border-radius: 8px; padding: 8px; display: inline-block;">
                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2">
                      <path d="M16 20V4a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/>
                      <rect width="20" height="14" x="2" y="6" rx="2"/>
                    </svg>
                  </td>
                  <td style="padding-left: 12px; font-size: 18px; font-weight: 700; color: #1e293b;">
                    {{company}}
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          
          <!-- Body -->
          <tr>
            <td style="padding: 32px; color: #1f2937; font-size: 15px; line-height: 1.7;">
              ${content}
            </td>
          </tr>
          
          <!-- Footer -->
          <tr>
            <td style="padding: 24px 32px; background-color: #f8fafc; border-top: 1px solid #e5e7eb; text-align: center;">
              <p style="margin: 0 0 8px 0; font-size: 13px; color: #64748b;">
                Sent via {{company}}
              </p>
              <p style="margin: 0; font-size: 12px; color: #94a3b8;">
                © ${new Date().getFullYear()} {{company}}. All rights reserved.
              </p>
            </td>
          </tr>
          
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
  };

  const handleSave = async () => {
    if (!formData.name || !formData.subject) {
      toast.error('Name and subject are required');
      return;
    }

    // Use the appropriate content based on editor mode
    const finalHtmlContent = editorMode === 'visual' 
      ? wrapInEmailTemplate(formData.visual_content)
      : formData.html_content;

    if (!finalHtmlContent) {
      toast.error('Email content is required');
      return;
    }

    setSaving(true);
    try {
      const templateData = {
        name: formData.name,
        subject: formData.subject,
        html_content: finalHtmlContent,
        variables: formData.variables.split(',').map(v => v.trim()).filter(Boolean),
        is_active: formData.is_active,
      };

      if (editingTemplate) {
        const { error } = await supabase
          .from('email_templates')
          .update(templateData)
          .eq('id', editingTemplate.id);
        if (error) throw error;
        toast.success('Template updated successfully');
      } else {
        const { error } = await supabase
          .from('email_templates')
          .insert(templateData);
        if (error) throw error;
        toast.success('Template created successfully');
      }

      setIsDialogOpen(false);
      fetchTemplates();
    } catch (error: any) {
      toast.error('Failed to save template: ' + error.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this template?')) return;

    try {
      const { error } = await supabase.from('email_templates').delete().eq('id', id);
      if (error) throw error;
      toast.success('Template deleted successfully');
      fetchTemplates();
    } catch (error: any) {
      toast.error('Failed to delete template: ' + error.message);
    }
  };

  const handlePreview = (template: EmailTemplate) => {
    setPreviewHtml(template.html_content);
    setIsPreviewOpen(true);
  };

  const handleTestSend = async (template: EmailTemplate) => {
    const email = prompt('Enter email address to send test:');
    if (!email) return;

    try {
      const { error } = await supabase.functions.invoke('send-email', {
        body: {
          to: email,
          subject: `[TEST] ${template.subject}`,
          html: template.html_content,
        },
      });

      if (error) throw error;
      toast.success('Test email sent successfully');
    } catch (error: any) {
      toast.error('Failed to send test email: ' + error.message);
    }
  };

  const handleAiGenerate = async () => {
    if (!aiPurpose.trim()) {
      toast.error('Please describe what kind of email template you need');
      return;
    }

    setIsGenerating(true);
    try {
      const variables = formData.variables.split(',').map(v => v.trim()).filter(Boolean);
      
      const { data, error } = await supabase.functions.invoke('ai-generate-template', {
        body: {
          template_purpose: aiPurpose,
          variables: variables.length > 0 ? variables : ['name', 'company'],
          tone: aiTone,
          company_name: 'HireMetrics',
        },
      });

      if (error) throw error;

      if (data?.html_content) {
        setFormData(prev => ({
          ...prev,
          html_content: data.html_content,
          visual_content: extractBodyContent(data.html_content),
        }));
        setEditorMode('html');
        setShowAiPanel(false);
        toast.success('Template generated successfully!');
      } else {
        throw new Error('No content generated');
      }
    } catch (error: any) {
      console.error('AI generation error:', error);
      if (error.message?.includes('429')) {
        toast.error('Rate limit exceeded. Please try again in a moment.');
      } else if (error.message?.includes('402')) {
        toast.error('AI credits exhausted. Please add funds to continue.');
      } else {
        toast.error('Failed to generate template: ' + error.message);
      }
    } finally {
      setIsGenerating(false);
    }
  };

  const handleCurrentPreview = () => {
    const content = editorMode === 'visual'
      ? wrapInEmailTemplate(formData.visual_content)
      : formData.html_content;
    setPreviewHtml(content);
    setIsPreviewOpen(true);
  };

  return (
    <AdminLayout title="Email Templates" description="Manage email templates">
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <p className="text-muted-foreground">Create and manage email templates with variable support</p>
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button onClick={() => handleOpenDialog()}>
                <Plus className="h-4 w-4 mr-2" />
                Add Template
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>{editingTemplate ? 'Edit Template' : 'Create New Template'}</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 mt-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Template Name</Label>
                    <Input
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      placeholder="Welcome Email"
                    />
                  </div>
                  <div>
                    <Label>Subject Line</Label>
                    <Input
                      value={formData.subject}
                      onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
                      placeholder="Welcome to {{company}}, {{name}}!"
                    />
                  </div>
                </div>
                <div>
                  <Label>Variables (comma separated)</Label>
                  <Input
                    value={formData.variables}
                    onChange={(e) => setFormData({ ...formData, variables: e.target.value })}
                    placeholder="name, company, email"
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Use {"{{variable}}"} in your template to insert dynamic content
                  </p>
                </div>

                {/* AI Generate Panel */}
                {showAiPanel && (
                  <Card className="p-4 bg-gradient-to-r from-primary/5 to-primary/10 border-primary/20">
                    <div className="space-y-4">
                      <div className="flex items-center gap-2">
                        <Sparkles className="h-5 w-5 text-primary" />
                        <Label className="text-base font-semibold">AI Template Generator</Label>
                      </div>
                      <div>
                        <Label>Describe your email template</Label>
                        <Textarea
                          value={aiPurpose}
                          onChange={(e) => setAiPurpose(e.target.value)}
                          placeholder="e.g., A welcome email for new users that introduces them to our platform and guides them to get started..."
                          rows={3}
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <Label>Tone</Label>
                          <Select value={aiTone} onValueChange={(v: any) => setAiTone(v)}>
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="professional">Professional</SelectItem>
                              <SelectItem value="friendly">Friendly</SelectItem>
                              <SelectItem value="formal">Formal</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="flex items-end">
                          <Button 
                            onClick={handleAiGenerate} 
                            disabled={isGenerating}
                            className="w-full"
                          >
                            {isGenerating ? (
                              <>
                                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                Generating...
                              </>
                            ) : (
                              <>
                                <Wand2 className="h-4 w-4 mr-2" />
                                Generate Template
                              </>
                            )}
                          </Button>
                        </div>
                      </div>
                    </div>
                  </Card>
                )}

                {/* Editor Tabs */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <Label>Email Content</Label>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setShowAiPanel(!showAiPanel)}
                        className="text-primary"
                      >
                        <Sparkles className="h-4 w-4 mr-2" />
                        {showAiPanel ? 'Hide AI' : 'AI Generate'}
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handleCurrentPreview}
                      >
                        <Eye className="h-4 w-4 mr-2" />
                        Preview
                      </Button>
                    </div>
                  </div>
                  
                  <Tabs value={editorMode} onValueChange={(v: any) => setEditorMode(v)}>
                    <TabsList className="mb-2">
                      <TabsTrigger value="visual" className="gap-2">
                        <Type className="h-4 w-4" />
                        Visual Editor
                      </TabsTrigger>
                      <TabsTrigger value="html" className="gap-2">
                        <Code className="h-4 w-4" />
                        HTML Code
                      </TabsTrigger>
                    </TabsList>
                    
                    <TabsContent value="visual" className="mt-0">
                      <RichTextEditor
                        content={formData.visual_content}
                        onChange={(content) => setFormData({ ...formData, visual_content: content })}
                        placeholder="Start typing your email content..."
                        className="min-h-[300px]"
                      />
                      <p className="text-xs text-muted-foreground mt-2">
                        Use the visual editor for a Gmail-like experience. Your content will be wrapped in a professional email template.
                      </p>
                    </TabsContent>
                    
                    <TabsContent value="html" className="mt-0">
                      <Textarea
                        value={formData.html_content}
                        onChange={(e) => setFormData({ ...formData, html_content: e.target.value })}
                        placeholder="<html>...</html>"
                        rows={15}
                        className="font-mono text-sm"
                      />
                      <p className="text-xs text-muted-foreground mt-2">
                        Edit the raw HTML for full control over the email template.
                      </p>
                    </TabsContent>
                  </Tabs>
                </div>

                <div className="flex items-center gap-2">
                  <Switch
                    checked={formData.is_active}
                    onCheckedChange={(checked) => setFormData({ ...formData, is_active: checked })}
                  />
                  <Label>Active</Label>
                </div>
                <div className="flex justify-end gap-2">
                  <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
                    Cancel
                  </Button>
                  <Button onClick={handleSave} disabled={saving}>
                    {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                    {editingTemplate ? 'Update' : 'Create'}
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : templates.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <Mail className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium mb-2">No templates yet</h3>
              <p className="text-muted-foreground mb-4">Create your first email template</p>
              <Button onClick={() => handleOpenDialog()}>
                <Plus className="h-4 w-4 mr-2" />
                Create Template
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4">
            {templates.map((template) => (
              <Card key={template.id}>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <Mail className="h-8 w-8 text-primary" />
                      <div>
                        <h3 className="font-medium">{template.name}</h3>
                        <p className="text-sm text-muted-foreground">{template.subject}</p>
                      </div>
                      <Badge variant={template.is_active ? 'default' : 'secondary'}>
                        {template.is_active ? 'Active' : 'Inactive'}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handlePreview(template)}
                        title="Preview"
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleTestSend(template)}
                        title="Send Test"
                      >
                        <Send className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleOpenDialog(template)}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleDelete(template.id)}
                        className="text-destructive hover:text-destructive"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Preview Dialog */}
        <Dialog open={isPreviewOpen} onOpenChange={setIsPreviewOpen}>
          <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Email Preview</DialogTitle>
            </DialogHeader>
            <div
              className="border rounded-lg p-4 bg-white"
              dangerouslySetInnerHTML={{ __html: previewHtml }}
            />
          </DialogContent>
        </Dialog>
      </div>
    </AdminLayout>
  );
}

const defaultTemplate = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>{{subject}}</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f3f4f6; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;">
  <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background-color: #f3f4f6;">
    <tr>
      <td style="padding: 32px 16px;">
        <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="600" style="margin: 0 auto; background-color: #ffffff; border-radius: 12px; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06); overflow: hidden;">
          
          <!-- Header -->
          <tr>
            <td style="padding: 24px 32px; border-bottom: 1px solid #e5e7eb; background: linear-gradient(180deg, #ffffff 0%, #f8fafc 100%);">
              <table role="presentation" cellspacing="0" cellpadding="0" border="0">
                <tr>
                  <td style="background: linear-gradient(135deg, #0052CC 0%, #0066FF 100%); border-radius: 8px; padding: 8px; display: inline-block;">
                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                      <path d="M16 20V4a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/>
                      <rect width="20" height="14" x="2" y="6" rx="2"/>
                    </svg>
                  </td>
                  <td style="padding-left: 12px; font-size: 18px; font-weight: 700; color: #1e293b;">
                    {{company}}
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          
          <!-- Body -->
          <tr>
            <td style="padding: 32px; color: #1f2937; font-size: 15px; line-height: 1.7;">
              <p style="margin: 0 0 16px 0;">Hello {{name}},</p>
              
              <p style="margin: 0 0 16px 0;">Thank you for your interest. We wanted to reach out and share some important information with you.</p>
              
              <p style="margin: 0 0 24px 0;">If you have any questions, please don't hesitate to contact us.</p>
              
              <p style="margin: 0;">Best regards,<br>The Team</p>
            </td>
          </tr>
          
          <!-- Footer -->
          <tr>
            <td style="padding: 24px 32px; background-color: #f8fafc; border-top: 1px solid #e5e7eb; text-align: center;">
              <p style="margin: 0 0 8px 0; font-size: 13px; color: #64748b;">
                Sent via {{company}}
              </p>
              <p style="margin: 0; font-size: 12px; color: #94a3b8;">
                © ${new Date().getFullYear()} {{company}}. All rights reserved.
              </p>
            </td>
          </tr>
          
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
