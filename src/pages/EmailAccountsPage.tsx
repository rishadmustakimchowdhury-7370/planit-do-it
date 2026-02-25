import { useState, useEffect } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from '@/components/ui/separator';
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
  Alert,
  AlertDescription,
} from '@/components/ui/alert';
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
  Send,
  ShieldCheck,
  Key,
  Server,
  Lock,
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
  smtp_host?: string | null;
  smtp_port?: number | null;
}

const providerIcons: Record<string, React.ReactNode> = {
  gmail: <Mail className="h-5 w-5 text-red-500" />,
  outlook: <Mail className="h-5 w-5 text-blue-500" />,
  smtp: <Server className="h-5 w-5 text-primary" />,
};

const providerLabels: Record<string, string> = {
  gmail: 'Gmail',
  outlook: 'Outlook',
  smtp: 'SMTP',
};

export default function EmailAccountsPage() {
  const { user, profile, tenantId } = useAuth();
  const [accounts, setAccounts] = useState<EmailAccount[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [isDeleting, setIsDeleting] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<EmailAccount | null>(null);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [newDefaultId, setNewDefaultId] = useState<string>('');
  
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
      // Filter by current user's ID to only show their own accounts
      const { data, error } = await supabase
        .from('email_accounts')
        .select('*')
        .eq('user_id', user?.id)
        .order('is_default', { ascending: false })
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

  const handleTestConnection = async () => {
    if (!formData.smtp_host || !formData.smtp_user || !formData.smtp_password || !formData.from_email) {
      toast.error('Please fill in all SMTP fields');
      return;
    }

    setIsTesting(true);
    setTestResult(null);

    try {
      const { data, error } = await supabase.functions.invoke('test-smtp', {
        body: {
          smtp_host: formData.smtp_host,
          smtp_port: formData.smtp_port,
          smtp_user: formData.smtp_user,
          smtp_password: formData.smtp_password,
          smtp_use_tls: formData.smtp_use_tls,
          from_email: formData.from_email,
          display_name: formData.display_name || 'Test User',
          send_test_email: true,
        },
      });

      if (error) {
        // Surface helpful error message coming from the edge function
        const ctx: any = (error as any).context;
        const serverError = ctx?.error as { error?: string; message?: string } | undefined;
        const serverMessage = serverError?.error || serverError?.message;
        const errorMessage = serverMessage || error.message || 'Connection test failed';
        setTestResult({ success: false, message: errorMessage });
        toast.error(errorMessage);
        return;
      }

      if (data?.success) {
        setTestResult({ success: true, message: data.message || 'Connection successful!' });
        toast.success('SMTP connection verified! Test email sent.');
      } else {
        const errorMessage = data?.error || 'Test failed';
        setTestResult({ success: false, message: errorMessage });
        toast.error(errorMessage);
      }
    } catch (error: any) {
      console.error('Test connection error:', error);
      const errorMessage = error.message || 'Connection test failed';
      setTestResult({ success: false, message: errorMessage });
      toast.error(errorMessage);
    } finally {
      setIsTesting(false);
    }
  };
  const handleAddAccount = async () => {
    if (!formData.from_email || !formData.display_name) {
      toast.error('Please fill in all required fields');
      return;
    }

    if (formData.provider === 'smtp') {
      if (!formData.smtp_host || !formData.smtp_user || !formData.smtp_password) {
        toast.error('Please fill in all SMTP configuration fields');
        return;
      }
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
    setTestResult(null);
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

  const initiateDelete = (account: EmailAccount) => {
    // Only account — block deletion
    if (accounts.length <= 1) {
      toast.error('You must have at least one sending account configured.');
      return;
    }
    setDeleteTarget(account);
    setNewDefaultId('');
    setShowDeleteDialog(true);
  };

  const handleDeleteAccount = async () => {
    if (!deleteTarget) return;

    setIsDeleting(deleteTarget.id);
    try {
      // If deleting the default account, reassign default first
      if (deleteTarget.is_default) {
        if (!newDefaultId) {
          toast.error('Please select a new default account before deleting.');
          setIsDeleting(null);
          return;
        }
        // Set new default
        await supabase
          .from('email_accounts')
          .update({ is_default: false })
          .eq('id', deleteTarget.id);
        const { error: defaultErr } = await supabase
          .from('email_accounts')
          .update({ is_default: true })
          .eq('id', newDefaultId);
        if (defaultErr) throw defaultErr;
      }

      const { error } = await supabase
        .from('email_accounts')
        .delete()
        .eq('id', deleteTarget.id)
        .eq('user_id', user?.id);

      if (error) {
        if (error.message?.includes('foreign key') || error.code === '23503') {
          toast.error('This account is referenced by existing emails and cannot be deleted right now.');
        } else if (error.message?.includes('row-level security') || error.code === '42501') {
          toast.error('Permission denied. You can only delete your own accounts.');
        } else {
          throw error;
        }
        return;
      }

      toast.success('Account removed successfully.');
      setShowDeleteDialog(false);
      setDeleteTarget(null);
      fetchAccounts();
    } catch (error: any) {
      console.error('Error deleting account:', error);
      toast.error(error.message || 'Failed to remove account');
    } finally {
      setIsDeleting(null);
    }
  };

  const handleGmailConnect = () => {
    // Pre-fill Gmail SMTP settings (use port 465 for direct TLS)
    setFormData({
      provider: 'smtp',
      from_email: '',
      display_name: 'Gmail Account',
      smtp_host: 'smtp.gmail.com',
      smtp_port: 465,
      smtp_user: '',
      smtp_password: '',
      smtp_use_tls: true,
    });
    setShowAddDialog(true);
    toast.info('Enter your Gmail address and App Password to connect. Port 465 with SSL/TLS is recommended.');
  };

  const handleOutlookConnect = () => {
    // Pre-fill Outlook SMTP settings
    setFormData({
      provider: 'smtp',
      from_email: '',
      display_name: 'Outlook Account',
      smtp_host: 'smtp.office365.com',
      smtp_port: 587,
      smtp_user: '',
      smtp_password: '',
      smtp_use_tls: true,
    });
    setShowAddDialog(true);
    toast.info('Enter your Outlook address and App Password to connect.');
  };

  const getStatusBadge = (status: string, errorMessage?: string | null) => {
    const config: Record<string, { variant: 'default' | 'secondary' | 'destructive' | 'outline'; className: string; icon: React.ElementType }> = {
      connected: { variant: 'default', className: 'bg-green-500/10 text-green-600 border-green-500/20', icon: CheckCircle },
      disconnected: { variant: 'destructive', className: 'bg-destructive/10 text-destructive', icon: XCircle },
      error: { variant: 'outline', className: 'bg-yellow-500/10 text-yellow-600 border-yellow-500/20', icon: AlertCircle },
    };
    const { variant, className, icon: Icon } = config[status] || config.disconnected;
    
    return (
      <Badge variant={variant} className={`${className} gap-1`}>
        <Icon className="h-3 w-3" />
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </Badge>
    );
  };

  if (isLoading) {
    return (
      <AppLayout>
        <div className="space-y-6">
          <Skeleton className="h-10 w-48" />
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[1, 2, 3].map(i => (
              <Skeleton key={i} className="h-24" />
            ))}
          </div>
          <Skeleton className="h-64" />
        </div>
      </AppLayout>
    );
  }

  const hasConfiguredAccount = accounts.some(a => a.status === 'connected');

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Email Integration</h1>
            <p className="text-muted-foreground">
              Configure your email accounts to send personalized emails to candidates
            </p>
          </div>
          <Button onClick={() => setShowAddDialog(true)} className="gap-2">
            <Plus className="h-4 w-4" />
            Add Account
          </Button>
        </div>

        {/* Important Notice */}
        {!hasConfiguredAccount && (
          <Alert className="border-yellow-500/50 bg-yellow-50 dark:bg-yellow-950/20">
            <AlertCircle className="h-4 w-4 text-yellow-600" />
            <AlertDescription className="text-yellow-800 dark:text-yellow-200">
              <strong>Email configuration required.</strong> You must configure at least one email account to send emails. 
              Without a configured account, emails cannot be sent.
            </AlertDescription>
          </Alert>
        )}

        {/* Quick Connect Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card 
            className="cursor-pointer hover:shadow-md transition-all border-2 hover:border-red-500/50 group"
            onClick={handleGmailConnect}
          >
            <CardContent className="flex items-center gap-4 pt-6">
              <div className="p-3 rounded-lg bg-red-100 dark:bg-red-900/30 group-hover:bg-red-200 dark:group-hover:bg-red-900/50 transition-colors">
                <Mail className="h-6 w-6 text-red-600" />
              </div>
              <div className="flex-1">
                <h3 className="font-semibold">Connect Gmail</h3>
                <p className="text-sm text-muted-foreground">Use App Password</p>
              </div>
              <Badge variant="default" className="text-xs bg-red-500">Quick Setup</Badge>
            </CardContent>
          </Card>

          <Card 
            className="cursor-pointer hover:shadow-md transition-all border-2 hover:border-blue-500/50 group"
            onClick={handleOutlookConnect}
          >
            <CardContent className="flex items-center gap-4 pt-6">
              <div className="p-3 rounded-lg bg-blue-100 dark:bg-blue-900/30 group-hover:bg-blue-200 dark:group-hover:bg-blue-900/50 transition-colors">
                <Mail className="h-6 w-6 text-blue-600" />
              </div>
              <div className="flex-1">
                <h3 className="font-semibold">Connect Outlook</h3>
                <p className="text-sm text-muted-foreground">Use App Password</p>
              </div>
              <Badge variant="default" className="text-xs bg-blue-500">Quick Setup</Badge>
            </CardContent>
          </Card>

          <Card 
            className="cursor-pointer hover:shadow-md transition-all border-2 border-primary hover:border-primary group"
            onClick={() => {
              resetForm();
              setShowAddDialog(true);
            }}
          >
            <CardContent className="flex items-center gap-4 pt-6">
              <div className="p-3 rounded-lg bg-primary/10 group-hover:bg-primary/20 transition-colors">
                <Server className="h-6 w-6 text-primary" />
              </div>
              <div className="flex-1">
                <h3 className="font-semibold">Custom SMTP</h3>
                <p className="text-sm text-muted-foreground">Any email server</p>
              </div>
              <Badge variant="default" className="text-xs bg-primary">Available</Badge>
            </CardContent>
          </Card>
        </div>

        {/* Connected Accounts */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-primary" />
              Connected Accounts
            </CardTitle>
            <CardDescription>
              Email accounts configured for sending. Your default account will be used when composing emails.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {accounts.length === 0 ? (
              <div className="text-center py-12 border-2 border-dashed rounded-lg">
                <Mail className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="font-semibold mb-2">No email accounts connected</h3>
                <p className="text-muted-foreground mb-4 max-w-md mx-auto">
                  Add an email account to start sending personalized emails from your own address
                </p>
                <Button onClick={() => setShowAddDialog(true)} className="gap-2">
                  <Plus className="h-4 w-4" />
                  Add Your First Account
                </Button>
              </div>
            ) : (
              <div className="space-y-3">
                {accounts.map(account => (
                  <div
                    key={account.id}
                    className={`flex items-center justify-between p-4 rounded-lg border-2 transition-all ${
                      account.is_default ? 'border-primary bg-primary/5' : 'border-border bg-card hover:border-muted-foreground/30'
                    }`}
                  >
                    <div className="flex items-center gap-4">
                      <div className="p-2 rounded-lg bg-muted">
                        {providerIcons[account.provider] || <Mail className="h-5 w-5" />}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{account.display_name}</span>
                          <Badge variant="outline" className="text-xs capitalize">
                            {providerLabels[account.provider] || account.provider}
                          </Badge>
                          {account.is_default && (
                            <Badge className="text-xs bg-primary">Default</Badge>
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground">{account.from_email}</p>
                        {account.smtp_host && (
                          <p className="text-xs text-muted-foreground mt-1">
                            SMTP: {account.smtp_host}:{account.smtp_port}
                          </p>
                        )}
                        {account.error_message && (
                          <p className="text-xs text-destructive mt-1">{account.error_message}</p>
                        )}
                        {account.last_sync_at && (
                          <p className="text-xs text-muted-foreground mt-1">
                            Last used: {format(new Date(account.last_sync_at), 'MMM d, h:mm a')}
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      {getStatusBadge(account.status, account.error_message)}
                      {!account.is_default && account.status === 'connected' && (
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
                        className="text-destructive hover:text-destructive hover:bg-destructive/10"
                        onClick={() => initiateDelete(account)}
                        disabled={isDeleting === account.id}
                      >
                        {isDeleting === account.id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Trash2 className="h-4 w-4" />
                        )}
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Help Section */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">SMTP Configuration Guide</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid md:grid-cols-2 gap-6">
              <div>
                <h4 className="font-medium mb-2 flex items-center gap-2">
                  <Mail className="h-4 w-4 text-red-500" />
                  Gmail SMTP Settings
                </h4>
                <div className="bg-muted rounded-lg p-3 text-sm space-y-1">
                  <p><span className="text-muted-foreground">Host:</span> smtp.gmail.com</p>
                  <p><span className="text-muted-foreground">Port:</span> 587 (TLS) or 465 (SSL)</p>
                  <p><span className="text-muted-foreground">Username:</span> your-email@gmail.com</p>
                  <p><span className="text-muted-foreground">Password:</span> App Password (not your Gmail password)</p>
                </div>
                <a 
                  href="https://support.google.com/accounts/answer/185833" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-xs text-primary hover:underline mt-2 inline-flex items-center gap-1"
                >
                  How to create Gmail App Password <ExternalLink className="h-3 w-3" />
                </a>
              </div>
              <div>
                <h4 className="font-medium mb-2 flex items-center gap-2">
                  <Mail className="h-4 w-4 text-blue-500" />
                  Outlook/Microsoft 365 SMTP
                </h4>
                <div className="bg-muted rounded-lg p-3 text-sm space-y-1">
                  <p><span className="text-muted-foreground">Host:</span> smtp.office365.com</p>
                  <p><span className="text-muted-foreground">Port:</span> 587</p>
                  <p><span className="text-muted-foreground">Username:</span> your-email@outlook.com</p>
                  <p><span className="text-muted-foreground">Password:</span> App Password</p>
                </div>
                <a 
                  href="https://support.microsoft.com/en-us/account-billing/manage-app-passwords" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-xs text-primary hover:underline mt-2 inline-flex items-center gap-1"
                >
                  How to create Outlook App Password <ExternalLink className="h-3 w-3" />
                </a>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Add Account Dialog */}
      <Dialog open={showAddDialog} onOpenChange={(open) => {
        setShowAddDialog(open);
        if (!open) resetForm();
      }}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {formData.smtp_host === 'smtp.gmail.com' ? (
                <>
                  <Mail className="h-5 w-5 text-red-500" />
                  Connect Gmail Account
                </>
              ) : formData.smtp_host === 'smtp.office365.com' ? (
                <>
                  <Mail className="h-5 w-5 text-blue-500" />
                  Connect Outlook Account
                </>
              ) : (
                <>
                  <Settings className="h-5 w-5" />
                  Add SMTP Email Account
                </>
              )}
            </DialogTitle>
            <DialogDescription>
              {formData.smtp_host === 'smtp.gmail.com' 
                ? 'Enter your Gmail address and App Password to send emails'
                : formData.smtp_host === 'smtp.office365.com'
                ? 'Enter your Outlook address and App Password to send emails'
                : 'Configure your email server to send emails from your own address'
              }
            </DialogDescription>
          </DialogHeader>
          
          {/* Quick Setup Instructions for Gmail/Outlook */}
          {(formData.smtp_host === 'smtp.gmail.com' || formData.smtp_host === 'smtp.office365.com') && (
            <Alert className="border-primary/50 bg-primary/5">
              <AlertCircle className="h-4 w-4 text-primary" />
              <AlertDescription className="text-sm">
                <strong>Quick Setup:</strong> You need an App Password, not your regular password.{' '}
                <a 
                  href={formData.smtp_host === 'smtp.gmail.com' 
                    ? 'https://support.google.com/accounts/answer/185833'
                    : 'https://support.microsoft.com/en-us/account-billing/manage-app-passwords'
                  }
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary underline"
                >
                  Learn how to create one →
                </a>
              </AlertDescription>
            </Alert>
          )}

          <div className="space-y-4 py-4">
            {/* Account Info */}
            <div className="space-y-4 p-4 bg-muted/50 rounded-lg">
              <h4 className="font-medium text-sm flex items-center gap-2">
                <Mail className="h-4 w-4" />
                Account Information
              </h4>
              <div className="grid grid-cols-2 gap-4">
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
              </div>
            </div>

            {/* SMTP Configuration - always visible; Gmail/Outlook lock host but allow port change */}
            <div className="space-y-4 p-4 bg-muted/50 rounded-lg">
              <h4 className="font-medium text-sm flex items-center gap-2">
                <Server className="h-4 w-4" />
                SMTP Server Configuration
              </h4>
              
              <div className="grid grid-cols-3 gap-4">
                <div className="col-span-2 space-y-2">
                  <Label>SMTP Host *</Label>
                  <Input
                    value={formData.smtp_host}
                    disabled={formData.smtp_host === 'smtp.gmail.com' || formData.smtp_host === 'smtp.office365.com'}
                    onChange={(e) => setFormData({ ...formData, smtp_host: e.target.value })}
                    placeholder="smtp.gmail.com"
                  />
                  {(formData.smtp_host === 'smtp.gmail.com' || formData.smtp_host === 'smtp.office365.com') && (
                    <p className="text-xs text-muted-foreground">
                      Host is fixed for Gmail/Outlook. You can still change the port below if needed.
                    </p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label>Port *</Label>
                  <Input
                    type="number"
                    value={formData.smtp_port}
                    onChange={(e) => setFormData({ ...formData, smtp_port: parseInt(e.target.value) || 587 })}
                  />
                </div>
              </div>

              <div className="flex items-center justify-between pt-2">
                <Label className="text-sm">Enable TLS/SSL Encryption</Label>
                <Switch
                  checked={formData.smtp_use_tls}
                  onCheckedChange={(v) => setFormData({ ...formData, smtp_use_tls: v })}
                />
              </div>
            </div>

            {/* Simplified Credentials for Gmail/Outlook */}
            <div className="space-y-4 p-4 bg-muted/50 rounded-lg">
              <h4 className="font-medium text-sm flex items-center gap-2">
                <Key className="h-4 w-4" />
                {formData.smtp_host === 'smtp.gmail.com' || formData.smtp_host === 'smtp.office365.com'
                  ? 'Login Credentials'
                  : 'SMTP Credentials'
                }
              </h4>
              
              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  Email Address *
                </Label>
                <Input
                  type="email"
                  value={formData.smtp_user}
                  onChange={(e) => setFormData({ 
                    ...formData, 
                    smtp_user: e.target.value,
                    from_email: e.target.value // Auto-fill from_email
                  })}
                  placeholder={formData.smtp_host === 'smtp.gmail.com' 
                    ? 'your-email@gmail.com'
                    : formData.smtp_host === 'smtp.office365.com'
                    ? 'your-email@outlook.com'
                    : 'your-email@company.com'
                  }
                />
              </div>

              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <Lock className="h-3 w-3" />
                  {formData.smtp_host === 'smtp.gmail.com' || formData.smtp_host === 'smtp.office365.com'
                    ? 'App Password *'
                    : 'SMTP Password *'
                  }
                </Label>
                <Input
                  type="password"
                  value={formData.smtp_password}
                  onChange={(e) => setFormData({ ...formData, smtp_password: e.target.value })}
                  placeholder="••••••••••••••••"
                />
                {formData.smtp_host === 'smtp.gmail.com' || formData.smtp_host === 'smtp.office365.com' ? (
                  <p className="text-xs text-muted-foreground">
                    Use an App Password, not your regular password. 16 characters, no spaces.
                  </p>
                ) : (
                  <p className="text-xs text-muted-foreground">
                    For Gmail/Outlook, use an App Password, not your regular password
                  </p>
                )}
              </div>
            </div>

            {/* Test Result */}
            {testResult && (
              <Alert className={testResult.success ? 'border-green-500 bg-green-50 dark:bg-green-950/20' : 'border-destructive'}>
                {testResult.success ? (
                  <CheckCircle className="h-4 w-4 text-green-600" />
                ) : (
                  <XCircle className="h-4 w-4 text-destructive" />
                )}
                <AlertDescription className={testResult.success ? 'text-green-800 dark:text-green-200' : ''}>
                  {testResult.message}
                </AlertDescription>
              </Alert>
            )}
          </div>

          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button 
              variant="outline" 
              onClick={handleTestConnection}
              disabled={isTesting || !formData.smtp_host || !formData.smtp_user || !formData.smtp_password}
              className="gap-2"
            >
              {isTesting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
              Test Connection
            </Button>
            <div className="flex-1" />
            <Button variant="ghost" onClick={() => setShowAddDialog(false)}>
              Cancel
            </Button>
            <Button 
              onClick={handleAddAccount} 
              disabled={isSaving || !formData.from_email || !formData.display_name}
            >
              {isSaving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Save Account
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={showDeleteDialog} onOpenChange={(open) => { if (!open) { setShowDeleteDialog(false); setDeleteTarget(null); } }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-destructive flex items-center gap-2">
              <Trash2 className="h-5 w-5" />
              Remove Email Account
            </DialogTitle>
            <DialogDescription>
              {deleteTarget?.is_default
                ? 'This is your default sending account. Please select another account as default before deleting.'
                : `Are you sure you want to remove "${deleteTarget?.display_name}" (${deleteTarget?.from_email})? This cannot be undone.`}
            </DialogDescription>
          </DialogHeader>

          {deleteTarget?.is_default && (
            <div className="space-y-2">
              <Label>New default account</Label>
              <Select value={newDefaultId} onValueChange={setNewDefaultId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select new default..." />
                </SelectTrigger>
                <SelectContent>
                  {accounts.filter(a => a.id !== deleteTarget.id).map(a => (
                    <SelectItem key={a.id} value={a.id}>
                      {a.display_name} ({a.from_email})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowDeleteDialog(false); setDeleteTarget(null); }}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDeleteAccount}
              disabled={!!isDeleting || (deleteTarget?.is_default && !newDefaultId)}
            >
              {isDeleting ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
              Delete Account
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
