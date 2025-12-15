import { useState, useEffect } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
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
  Mail,
  Plus,
  Trash2,
  Settings,
  CheckCircle,
  XCircle,
  AlertCircle,
  RefreshCw,
  ExternalLink,
  Loader2,
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth';
import { toast } from 'sonner';
import { format } from 'date-fns';

interface EmailAccount {
  id: string;
  provider: string;
  from_email: string;
  display_name: string;
  status: string;
  is_default: boolean;
  last_sync_at: string | null;
  error_message: string | null;
  created_at: string;
}

const providerIcons: Record<string, string> = {
  gmail: '📧',
  outlook: '📬',
  smtp: '⚙️',
  resend: '✉️',
};

export default function EmailAccountsPage() {
  const { user, profile, tenantId } = useAuth();
  const [accounts, setAccounts] = useState<EmailAccount[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [formData, setFormData] = useState({
    provider: 'smtp',
    from_email: '',
    display_name: '',
    smtp_host: '',
    smtp_port: 587,
    smtp_user: '',
    smtp_password: '',
    smtp_use_tls: true,
  });

  useEffect(() => {
    if (tenantId) {
      fetchAccounts();
    }
  }, [tenantId]);

  const fetchAccounts = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('email_accounts')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setAccounts(data || []);
    } catch (error) {
      console.error('Error fetching accounts:', error);
      toast.error('Failed to load email accounts');
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddAccount = async () => {
    if (!formData.from_email || !formData.display_name) {
      toast.error('Please fill in all required fields');
      return;
    }

    setIsSaving(true);
    try {
      const { error } = await supabase
        .from('email_accounts')
        .insert({
          user_id: user?.id,
          tenant_id: tenantId,
          provider: formData.provider,
          from_email: formData.from_email,
          display_name: formData.display_name,
          smtp_host: formData.provider === 'smtp' ? formData.smtp_host : null,
          smtp_port: formData.provider === 'smtp' ? formData.smtp_port : null,
          smtp_user: formData.provider === 'smtp' ? formData.smtp_user : null,
          smtp_password: formData.provider === 'smtp' ? formData.smtp_password : null,
          smtp_use_tls: formData.provider === 'smtp' ? formData.smtp_use_tls : null,
          status: 'connected',
          is_default: accounts.length === 0,
        });

      if (error) throw error;

      toast.success('Email account added successfully');
      setShowAddDialog(false);
      fetchAccounts();
      resetForm();
    } catch (error: any) {
      console.error('Error adding account:', error);
      toast.error(error.message || 'Failed to add account');
    } finally {
      setIsSaving(false);
    }
  };

  const resetForm = () => {
    setFormData({
      provider: 'smtp',
      from_email: '',
      display_name: '',
      smtp_host: '',
      smtp_port: 587,
      smtp_user: '',
      smtp_password: '',
      smtp_use_tls: true,
    });
  };

  const handleSetDefault = async (accountId: string) => {
    try {
      // Remove default from all accounts
      await supabase
        .from('email_accounts')
        .update({ is_default: false })
        .eq('tenant_id', tenantId);

      // Set new default
      await supabase
        .from('email_accounts')
        .update({ is_default: true })
        .eq('id', accountId);

      toast.success('Default account updated');
      fetchAccounts();
    } catch (error) {
      console.error('Error updating default:', error);
      toast.error('Failed to update default account');
    }
  };

  const handleDeleteAccount = async (accountId: string) => {
    if (!confirm('Are you sure you want to remove this email account?')) {
      return;
    }

    try {
      const { error } = await supabase
        .from('email_accounts')
        .delete()
        .eq('id', accountId);

      if (error) throw error;

      toast.success('Account removed');
      fetchAccounts();
    } catch (error) {
      console.error('Error deleting account:', error);
      toast.error('Failed to remove account');
    }
  };

  const handleGmailConnect = () => {
    toast.info('Gmail OAuth integration coming soon! For now, you can use SMTP settings.');
  };

  const getStatusBadge = (status: string) => {
    const config: Record<string, { color: string; icon: React.ElementType }> = {
      connected: { color: 'bg-success/10 text-success', icon: CheckCircle },
      disconnected: { color: 'bg-destructive/10 text-destructive', icon: XCircle },
      error: { color: 'bg-warning/10 text-warning', icon: AlertCircle },
    };
    const { color, icon: Icon } = config[status] || config.disconnected;
    
    return (
      <Badge variant="outline" className={`${color} gap-1`}>
        <Icon className="h-3 w-3" />
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </Badge>
    );
  };

  if (isLoading) {
    return (
      <AppLayout>
        <div className="space-y-4">
          <Skeleton className="h-10 w-48" />
          {[1, 2].map(i => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Email Accounts</h1>
            <p className="text-muted-foreground">
              Manage your connected email accounts for sending messages
            </p>
          </div>
          <Button onClick={() => setShowAddDialog(true)} className="gap-2">
            <Plus className="h-4 w-4" />
            Add Account
          </Button>
        </div>

        {/* Quick Connect Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={handleGmailConnect}>
            <CardContent className="flex items-center gap-4 pt-6">
              <div className="p-3 rounded-lg bg-red-100">
                <Mail className="h-6 w-6 text-red-600" />
              </div>
              <div>
                <h3 className="font-semibold">Connect Gmail</h3>
                <p className="text-sm text-muted-foreground">Use your Gmail account to send</p>
              </div>
            </CardContent>
          </Card>

          <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => setShowAddDialog(true)}>
            <CardContent className="flex items-center gap-4 pt-6">
              <div className="p-3 rounded-lg bg-blue-100">
                <Settings className="h-6 w-6 text-blue-600" />
              </div>
              <div>
                <h3 className="font-semibold">SMTP Settings</h3>
                <p className="text-sm text-muted-foreground">Configure custom SMTP server</p>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-primary/5 border-primary/20">
            <CardContent className="flex items-center gap-4 pt-6">
              <div className="p-3 rounded-lg bg-primary/10">
                <CheckCircle className="h-6 w-6 text-primary" />
              </div>
              <div>
                <h3 className="font-semibold">RecruitifyCRM</h3>
                <p className="text-sm text-muted-foreground">Default system email (Active)</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Connected Accounts */}
        <Card>
          <CardHeader>
            <CardTitle>Connected Accounts</CardTitle>
            <CardDescription>
              Accounts you can use to send emails to candidates
            </CardDescription>
          </CardHeader>
          <CardContent>
            {accounts.length === 0 ? (
              <div className="text-center py-8">
                <Mail className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="font-semibold mb-2">No email accounts connected</h3>
                <p className="text-muted-foreground mb-4">
                  Add an email account to start sending personalized emails
                </p>
                <Button onClick={() => setShowAddDialog(true)} className="gap-2">
                  <Plus className="h-4 w-4" />
                  Add Account
                </Button>
              </div>
            ) : (
              <div className="space-y-4">
                {accounts.map(account => (
                  <div
                    key={account.id}
                    className="flex items-center justify-between p-4 rounded-lg border bg-card"
                  >
                    <div className="flex items-center gap-4">
                      <div className="text-2xl">
                        {providerIcons[account.provider] || '📧'}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{account.display_name}</span>
                          {account.is_default && (
                            <Badge variant="secondary" className="text-xs">Default</Badge>
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground">{account.from_email}</p>
                        {account.last_sync_at && (
                          <p className="text-xs text-muted-foreground mt-1">
                            Last synced: {format(new Date(account.last_sync_at), 'MMM d, h:mm a')}
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {getStatusBadge(account.status)}
                      {!account.is_default && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleSetDefault(account.id)}
                        >
                          Set Default
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="icon"
                        className="text-destructive hover:text-destructive"
                        onClick={() => handleDeleteAccount(account.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Add Account Dialog */}
      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Add Email Account</DialogTitle>
            <DialogDescription>
              Configure a new email account for sending messages
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Provider</Label>
              <Select
                value={formData.provider}
                onValueChange={(v) => setFormData({ ...formData, provider: v })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="smtp">Custom SMTP</SelectItem>
                  <SelectItem value="gmail" disabled>Gmail (Coming Soon)</SelectItem>
                  <SelectItem value="outlook" disabled>Outlook (Coming Soon)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Display Name *</Label>
              <Input
                value={formData.display_name}
                onChange={(e) => setFormData({ ...formData, display_name: e.target.value })}
                placeholder="My Work Email"
              />
            </div>

            <div className="space-y-2">
              <Label>From Email *</Label>
              <Input
                type="email"
                value={formData.from_email}
                onChange={(e) => setFormData({ ...formData, from_email: e.target.value })}
                placeholder="you@company.com"
              />
            </div>

            {formData.provider === 'smtp' && (
              <>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>SMTP Host</Label>
                    <Input
                      value={formData.smtp_host}
                      onChange={(e) => setFormData({ ...formData, smtp_host: e.target.value })}
                      placeholder="smtp.gmail.com"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Port</Label>
                    <Input
                      type="number"
                      value={formData.smtp_port}
                      onChange={(e) => setFormData({ ...formData, smtp_port: parseInt(e.target.value) })}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>SMTP Username</Label>
                  <Input
                    value={formData.smtp_user}
                    onChange={(e) => setFormData({ ...formData, smtp_user: e.target.value })}
                    placeholder="username"
                  />
                </div>

                <div className="space-y-2">
                  <Label>SMTP Password</Label>
                  <Input
                    type="password"
                    value={formData.smtp_password}
                    onChange={(e) => setFormData({ ...formData, smtp_password: e.target.value })}
                    placeholder="••••••••"
                  />
                </div>

                <div className="flex items-center justify-between">
                  <Label>Use TLS</Label>
                  <Switch
                    checked={formData.smtp_use_tls}
                    onCheckedChange={(v) => setFormData({ ...formData, smtp_use_tls: v })}
                  />
                </div>
              </>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleAddAccount} disabled={isSaving}>
              {isSaving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Add Account
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
