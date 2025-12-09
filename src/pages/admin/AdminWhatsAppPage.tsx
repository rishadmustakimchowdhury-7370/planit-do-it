import { useState, useEffect } from 'react';
import { AdminLayout } from '@/components/admin/AdminLayout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Loader2, MessageSquare, Plus, Settings, Send, Clock, CheckCircle, XCircle, Edit, Trash2 } from 'lucide-react';
import { format } from 'date-fns';

interface WhatsAppTemplate {
  id: string;
  name: string;
  message: string;
  category: string;
  variables: string[];
  is_active: boolean;
  created_at: string;
}

interface WhatsAppLog {
  id: string;
  phone_number: string;
  message: string;
  status: string;
  error_message: string | null;
  sent_at: string | null;
  created_at: string;
}

interface WhatsAppSettings {
  id: string;
  api_provider: string;
  api_key: string | null;
  api_secret: string | null;
  phone_number_id: string | null;
  business_account_id: string | null;
  is_configured: boolean;
}

export default function AdminWhatsAppPage() {
  const [templates, setTemplates] = useState<WhatsAppTemplate[]>([]);
  const [logs, setLogs] = useState<WhatsAppLog[]>([]);
  const [settings, setSettings] = useState<WhatsAppSettings | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [showTemplateDialog, setShowTemplateDialog] = useState(false);
  const [showTestDialog, setShowTestDialog] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<WhatsAppTemplate | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // Template form
  const [templateForm, setTemplateForm] = useState({
    name: '',
    message: '',
    category: 'general',
    is_active: true,
  });

  // Settings form
  const [settingsForm, setSettingsForm] = useState({
    api_provider: 'twilio',
    api_key: '',
    api_secret: '',
    phone_number_id: '',
    business_account_id: '',
  });

  // Test message form
  const [testForm, setTestForm] = useState({
    phone_number: '',
    message: '',
    template_id: '',
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [templatesRes, logsRes, settingsRes] = await Promise.all([
        supabase.from('whatsapp_templates').select('*').order('created_at', { ascending: false }),
        supabase.from('whatsapp_logs').select('*').order('created_at', { ascending: false }).limit(100),
        supabase.from('whatsapp_settings').select('*').maybeSingle(),
      ]);

      if (templatesRes.error) throw templatesRes.error;
      if (logsRes.error) throw logsRes.error;

      const templatesData = (templatesRes.data || []).map((t: any) => ({
        ...t,
        variables: Array.isArray(t.variables) ? t.variables : [],
      }));
      setTemplates(templatesData);
      setLogs(logsRes.data || []);
      
      if (settingsRes.data) {
        setSettings(settingsRes.data);
        setSettingsForm({
          api_provider: settingsRes.data.api_provider || 'twilio',
          api_key: settingsRes.data.api_key || '',
          api_secret: settingsRes.data.api_secret || '',
          phone_number_id: settingsRes.data.phone_number_id || '',
          business_account_id: settingsRes.data.business_account_id || '',
        });
      }
    } catch (error: any) {
      toast.error('Failed to load data: ' + error.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSaveSettings = async () => {
    setIsSaving(true);
    try {
      const settingsData = {
        api_provider: settingsForm.api_provider,
        api_key: settingsForm.api_key || null,
        api_secret: settingsForm.api_secret || null,
        phone_number_id: settingsForm.phone_number_id || null,
        business_account_id: settingsForm.business_account_id || null,
        is_configured: !!(settingsForm.api_key && settingsForm.phone_number_id),
        updated_at: new Date().toISOString(),
      };

      if (settings?.id) {
        const { error } = await supabase
          .from('whatsapp_settings')
          .update(settingsData)
          .eq('id', settings.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('whatsapp_settings')
          .insert(settingsData);
        if (error) throw error;
      }

      toast.success('Settings saved');
      fetchData();
    } catch (error: any) {
      toast.error('Failed to save settings: ' + error.message);
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveTemplate = async () => {
    if (!templateForm.name || !templateForm.message) {
      toast.error('Name and message are required');
      return;
    }

    setIsSaving(true);
    try {
      // Extract variables from message
      const variableMatches = templateForm.message.match(/{{(\w+)}}/g) || [];
      const variables = variableMatches.map(v => v.replace(/{{|}}/g, ''));

      const templateData = {
        name: templateForm.name,
        message: templateForm.message,
        category: templateForm.category,
        is_active: templateForm.is_active,
        variables: variables,
      };

      if (editingTemplate) {
        const { error } = await supabase
          .from('whatsapp_templates')
          .update(templateData)
          .eq('id', editingTemplate.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('whatsapp_templates')
          .insert(templateData);
        if (error) throw error;
      }

      toast.success(editingTemplate ? 'Template updated' : 'Template created');
      setShowTemplateDialog(false);
      setEditingTemplate(null);
      setTemplateForm({ name: '', message: '', category: 'general', is_active: true });
      fetchData();
    } catch (error: any) {
      toast.error('Failed to save template: ' + error.message);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteTemplate = async (id: string) => {
    if (!confirm('Are you sure you want to delete this template?')) return;

    try {
      const { error } = await supabase.from('whatsapp_templates').delete().eq('id', id);
      if (error) throw error;
      toast.success('Template deleted');
      fetchData();
    } catch (error: any) {
      toast.error('Failed to delete template: ' + error.message);
    }
  };

  const handleSendTest = async () => {
    if (!testForm.phone_number || !testForm.message) {
      toast.error('Phone number and message are required');
      return;
    }

    setIsSaving(true);
    try {
      const { data, error } = await supabase.functions.invoke('send-whatsapp', {
        body: {
          phone_number: testForm.phone_number,
          message: testForm.message,
          template_id: testForm.template_id || undefined,
        },
      });

      if (error) throw error;

      if (data?.success) {
        toast.success('Message sent successfully');
        setShowTestDialog(false);
        setTestForm({ phone_number: '', message: '', template_id: '' });
        fetchData();
      } else {
        toast.error(data?.error || 'Failed to send message');
      }
    } catch (error: any) {
      toast.error('Failed to send: ' + error.message);
    } finally {
      setIsSaving(false);
    }
  };

  const openEditTemplate = (template: WhatsAppTemplate) => {
    setEditingTemplate(template);
    setTemplateForm({
      name: template.name,
      message: template.message,
      category: template.category,
      is_active: template.is_active,
    });
    setShowTemplateDialog(true);
  };

  const openNewTemplate = () => {
    setEditingTemplate(null);
    setTemplateForm({ name: '', message: '', category: 'general', is_active: true });
    setShowTemplateDialog(true);
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'sent':
        return <Badge className="bg-green-600"><CheckCircle className="h-3 w-3 mr-1" />Sent</Badge>;
      case 'failed':
        return <Badge variant="destructive"><XCircle className="h-3 w-3 mr-1" />Failed</Badge>;
      case 'pending':
        return <Badge variant="secondary"><Clock className="h-3 w-3 mr-1" />Pending</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  if (isLoading) {
    return (
      <AdminLayout title="WhatsApp Notifications" description="Manage WhatsApp messaging">
        <div className="flex justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout title="WhatsApp Notifications" description="Send automated WhatsApp messages to candidates">
      <Tabs defaultValue="templates" className="space-y-6">
        <TabsList>
          <TabsTrigger value="templates">Templates</TabsTrigger>
          <TabsTrigger value="logs">Message Logs</TabsTrigger>
          <TabsTrigger value="settings">Settings</TabsTrigger>
        </TabsList>

        {/* Templates Tab */}
        <TabsContent value="templates" className="space-y-4">
          <div className="flex justify-between items-center">
            <div>
              <h3 className="text-lg font-semibold">Message Templates</h3>
              <p className="text-sm text-muted-foreground">Create reusable templates with variables</p>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setShowTestDialog(true)}>
                <Send className="h-4 w-4 mr-2" />
                Send Test
              </Button>
              <Button onClick={openNewTemplate}>
                <Plus className="h-4 w-4 mr-2" />
                New Template
              </Button>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {templates.map((template) => (
              <Card key={template.id} className="hover:shadow-md transition-shadow">
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between">
                    <div>
                      <CardTitle className="text-base">{template.name}</CardTitle>
                      <Badge variant="outline" className="mt-1">{template.category}</Badge>
                    </div>
                    <Switch checked={template.is_active} disabled />
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground line-clamp-3 mb-3">{template.message}</p>
                  {template.variables.length > 0 && (
                    <div className="flex flex-wrap gap-1 mb-3">
                      {template.variables.map((v) => (
                        <Badge key={v} variant="secondary" className="text-xs">
                          {`{{${v}}}`}
                        </Badge>
                      ))}
                    </div>
                  )}
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" onClick={() => openEditTemplate(template)}>
                      <Edit className="h-3 w-3 mr-1" />
                      Edit
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => handleDeleteTemplate(template.id)}>
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}

            {templates.length === 0 && (
              <Card className="col-span-full py-8">
                <CardContent className="flex flex-col items-center text-center">
                  <MessageSquare className="h-12 w-12 text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">No templates yet</p>
                  <Button variant="link" onClick={openNewTemplate}>Create your first template</Button>
                </CardContent>
              </Card>
            )}
          </div>
        </TabsContent>

        {/* Logs Tab */}
        <TabsContent value="logs">
          <Card>
            <CardHeader>
              <CardTitle>Message History</CardTitle>
              <CardDescription>View all sent WhatsApp messages</CardDescription>
            </CardHeader>
            <CardContent>
              {logs.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <MessageSquare className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No messages sent yet</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Phone</TableHead>
                      <TableHead>Message</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Sent At</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {logs.map((log) => (
                      <TableRow key={log.id}>
                        <TableCell className="font-mono">{log.phone_number}</TableCell>
                        <TableCell className="max-w-xs truncate">{log.message}</TableCell>
                        <TableCell>
                          {getStatusBadge(log.status)}
                          {log.error_message && (
                            <p className="text-xs text-destructive mt-1">{log.error_message}</p>
                          )}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {log.sent_at 
                            ? format(new Date(log.sent_at), 'MMM d, HH:mm')
                            : format(new Date(log.created_at), 'MMM d, HH:mm')}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Settings Tab */}
        <TabsContent value="settings">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Settings className="h-5 w-5" />
                WhatsApp API Configuration
              </CardTitle>
              <CardDescription>
                Configure your WhatsApp Business API credentials (Twilio or Meta)
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>API Provider</Label>
                <Select
                  value={settingsForm.api_provider}
                  onValueChange={(value) => setSettingsForm({ ...settingsForm, api_provider: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="twilio">Twilio</SelectItem>
                    <SelectItem value="meta">Meta Business (Cloud API)</SelectItem>
                    <SelectItem value="mock">Mock (Testing)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {settingsForm.api_provider === 'twilio' && (
                <>
                  <div className="space-y-2">
                    <Label>Account SID (API Key)</Label>
                    <Input
                      type="password"
                      value={settingsForm.api_key}
                      onChange={(e) => setSettingsForm({ ...settingsForm, api_key: e.target.value })}
                      placeholder="ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Auth Token (API Secret)</Label>
                    <Input
                      type="password"
                      value={settingsForm.api_secret}
                      onChange={(e) => setSettingsForm({ ...settingsForm, api_secret: e.target.value })}
                      placeholder="Your Twilio Auth Token"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>WhatsApp Phone Number</Label>
                    <Input
                      value={settingsForm.phone_number_id}
                      onChange={(e) => setSettingsForm({ ...settingsForm, phone_number_id: e.target.value })}
                      placeholder="+1234567890"
                    />
                  </div>
                </>
              )}

              {settingsForm.api_provider === 'meta' && (
                <>
                  <div className="space-y-2">
                    <Label>Access Token</Label>
                    <Input
                      type="password"
                      value={settingsForm.api_key}
                      onChange={(e) => setSettingsForm({ ...settingsForm, api_key: e.target.value })}
                      placeholder="Your Meta Access Token"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Phone Number ID</Label>
                    <Input
                      value={settingsForm.phone_number_id}
                      onChange={(e) => setSettingsForm({ ...settingsForm, phone_number_id: e.target.value })}
                      placeholder="Your WhatsApp Phone Number ID"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Business Account ID</Label>
                    <Input
                      value={settingsForm.business_account_id}
                      onChange={(e) => setSettingsForm({ ...settingsForm, business_account_id: e.target.value })}
                      placeholder="Your WhatsApp Business Account ID"
                    />
                  </div>
                </>
              )}

              <div className="pt-4">
                <Button onClick={handleSaveSettings} disabled={isSaving}>
                  {isSaving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  Save Settings
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Template Dialog */}
      <Dialog open={showTemplateDialog} onOpenChange={setShowTemplateDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingTemplate ? 'Edit Template' : 'Create Template'}</DialogTitle>
            <DialogDescription>
              Use {"{{variable_name}}"} for dynamic content like {"{{candidate_name}}"}, {"{{job_title}}"}, {"{{interview_time}}"}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Template Name</Label>
              <Input
                value={templateForm.name}
                onChange={(e) => setTemplateForm({ ...templateForm, name: e.target.value })}
                placeholder="Interview Reminder"
              />
            </div>
            <div className="space-y-2">
              <Label>Category</Label>
              <Select
                value={templateForm.category}
                onValueChange={(value) => setTemplateForm({ ...templateForm, category: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="general">General</SelectItem>
                  <SelectItem value="interview">Interview</SelectItem>
                  <SelectItem value="reminder">Reminder</SelectItem>
                  <SelectItem value="status_update">Status Update</SelectItem>
                  <SelectItem value="offer">Offer</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Message</Label>
              <Textarea
                rows={5}
                value={templateForm.message}
                onChange={(e) => setTemplateForm({ ...templateForm, message: e.target.value })}
                placeholder="Hi {{candidate_name}}, this is a reminder for your interview for {{job_title}} scheduled at {{interview_time}}."
              />
            </div>
            <div className="flex items-center gap-2">
              <Switch
                checked={templateForm.is_active}
                onCheckedChange={(checked) => setTemplateForm({ ...templateForm, is_active: checked })}
              />
              <Label>Active</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowTemplateDialog(false)}>Cancel</Button>
            <Button onClick={handleSaveTemplate} disabled={isSaving}>
              {isSaving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {editingTemplate ? 'Update' : 'Create'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Test Message Dialog */}
      <Dialog open={showTestDialog} onOpenChange={setShowTestDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Send Test Message</DialogTitle>
            <DialogDescription>Send a test WhatsApp message</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Phone Number</Label>
              <Input
                value={testForm.phone_number}
                onChange={(e) => setTestForm({ ...testForm, phone_number: e.target.value })}
                placeholder="+1234567890"
              />
            </div>
            <div className="space-y-2">
              <Label>Template (Optional)</Label>
              <Select
                value={testForm.template_id}
                onValueChange={(value) => {
                  const template = templates.find(t => t.id === value);
                  setTestForm({ 
                    ...testForm, 
                    template_id: value,
                    message: template?.message || testForm.message,
                  });
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select template" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">None</SelectItem>
                  {templates.map((t) => (
                    <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Message</Label>
              <Textarea
                rows={4}
                value={testForm.message}
                onChange={(e) => setTestForm({ ...testForm, message: e.target.value })}
                placeholder="Enter your message..."
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowTestDialog(false)}>Cancel</Button>
            <Button onClick={handleSendTest} disabled={isSaving}>
              {isSaving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              <Send className="h-4 w-4 mr-2" />
              Send
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
}
