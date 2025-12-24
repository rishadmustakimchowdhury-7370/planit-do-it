import { useState, useEffect } from 'react';
import { AdminLayout } from '@/components/admin/AdminLayout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Skeleton } from '@/components/ui/skeleton';
import { Checkbox } from '@/components/ui/checkbox';
import { Textarea } from '@/components/ui/textarea';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import {
  Search,
  Mail,
  Sparkles,
  Send,
  Users,
  Download,
  CheckCircle2,
  Loader2,
  Filter,
  RefreshCw,
  Copy,
} from 'lucide-react';
import { format } from 'date-fns';

interface MarketingUser {
  id: string;
  email: string;
  full_name: string | null;
  phone: string | null;
  created_at: string;
  last_login_at: string | null;
  is_active: boolean;
  tenant?: {
    name: string;
    subscription_status: string;
  } | null;
}

export default function AdminUserMarketingPage() {
  const [users, setUsers] = useState<MarketingUser[]>([]);
  const [filteredUsers, setFilteredUsers] = useState<MarketingUser[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [selectedUsers, setSelectedUsers] = useState<Set<string>>(new Set());
  
  // Email compose state
  const [showComposeDialog, setShowComposeDialog] = useState(false);
  const [emailSubject, setEmailSubject] = useState('');
  const [emailBody, setEmailBody] = useState('');
  const [isGeneratingAI, setIsGeneratingAI] = useState(false);
  const [isSendingEmail, setIsSendingEmail] = useState(false);
  const [aiPrompt, setAiPrompt] = useState('');
  const [emailPurpose, setEmailPurpose] = useState<string>('promotion');

  useEffect(() => {
    fetchUsers();
  }, []);

  useEffect(() => {
    filterUsers();
  }, [users, searchQuery, statusFilter]);

  const fetchUsers = async () => {
    try {
      setIsLoading(true);
      const { data: profiles, error } = await supabase
        .from('profiles')
        .select(`
          id,
          email,
          full_name,
          phone,
          created_at,
          last_login_at,
          is_active,
          tenant:tenants!profiles_tenant_id_fkey (
            name,
            subscription_status
          )
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setUsers(profiles as unknown as MarketingUser[]);
    } catch (error) {
      console.error('Error fetching users:', error);
      toast.error('Failed to fetch users');
    } finally {
      setIsLoading(false);
    }
  };

  const filterUsers = () => {
    let filtered = users;

    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (user) =>
          user.email.toLowerCase().includes(query) ||
          user.full_name?.toLowerCase().includes(query) ||
          user.tenant?.name?.toLowerCase().includes(query)
      );
    }

    if (statusFilter !== 'all') {
      filtered = filtered.filter((user) => {
        if (statusFilter === 'active') return user.is_active;
        if (statusFilter === 'inactive') return !user.is_active;
        if (statusFilter === 'subscribed') return user.tenant?.subscription_status === 'active';
        if (statusFilter === 'trial') return user.tenant?.subscription_status === 'trial';
        if (statusFilter === 'expired') return user.tenant?.subscription_status === 'expired';
        return true;
      });
    }

    setFilteredUsers(filtered);
  };

  const toggleUserSelection = (userId: string) => {
    const newSelection = new Set(selectedUsers);
    if (newSelection.has(userId)) {
      newSelection.delete(userId);
    } else {
      newSelection.add(userId);
    }
    setSelectedUsers(newSelection);
  };

  const selectAllUsers = () => {
    if (selectedUsers.size === filteredUsers.length) {
      setSelectedUsers(new Set());
    } else {
      setSelectedUsers(new Set(filteredUsers.map((u) => u.id)));
    }
  };

  const getSelectedEmails = () => {
    return users
      .filter((u) => selectedUsers.has(u.id))
      .map((u) => u.email);
  };

  const handleGenerateAIEmail = async () => {
    if (!aiPrompt.trim()) {
      toast.error('Please describe what kind of email you want to generate');
      return;
    }

    try {
      setIsGeneratingAI(true);

      const { data, error } = await supabase.functions.invoke('ai-compose-email', {
        body: {
          purpose: emailPurpose,
          customInstructions: aiPrompt,
          recipientCount: selectedUsers.size,
          isMarketing: true,
        },
      });

      if (error) throw error;

      if (data?.email_body) {
        setEmailBody(data.email_body);
        if (data.suggested_subject) {
          setEmailSubject(data.suggested_subject);
        }
        toast.success('Email generated successfully!');
      }
    } catch (error: any) {
      console.error('Error generating AI email:', error);
      if (error.message?.includes('429') || error.message?.includes('rate')) {
        toast.error('Rate limit exceeded. Please try again later.');
      } else if (error.message?.includes('402')) {
        toast.error('AI credits exhausted. Please add more credits.');
      } else {
        toast.error('Failed to generate email');
      }
    } finally {
      setIsGeneratingAI(false);
    }
  };

  const handleSendEmails = async () => {
    if (!emailSubject.trim() || !emailBody.trim()) {
      toast.error('Please fill in both subject and body');
      return;
    }

    if (selectedUsers.size === 0) {
      toast.error('Please select at least one recipient');
      return;
    }

    try {
      setIsSendingEmail(true);
      const emails = getSelectedEmails();

      const { error } = await supabase.functions.invoke('send-email', {
        body: {
          to: emails,
          subject: emailSubject,
          html: `<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
            ${emailBody.split('\n').map(p => `<p style="margin: 0 0 16px 0; line-height: 1.6;">${p}</p>`).join('')}
          </div>`,
        },
      });

      if (error) throw error;

      toast.success(`Marketing email sent to ${emails.length} recipient(s)!`);
      setShowComposeDialog(false);
      setEmailSubject('');
      setEmailBody('');
      setAiPrompt('');
      setSelectedUsers(new Set());
    } catch (error) {
      console.error('Error sending emails:', error);
      toast.error('Failed to send marketing emails');
    } finally {
      setIsSendingEmail(false);
    }
  };

  const exportEmails = () => {
    const emails = selectedUsers.size > 0 
      ? getSelectedEmails() 
      : users.map((u) => u.email);
    
    const csvContent = 'data:text/csv;charset=utf-8,' + emails.join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', 'marketing_emails.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success(`Exported ${emails.length} email(s)`);
  };

  const copyEmails = () => {
    const emails = selectedUsers.size > 0 
      ? getSelectedEmails() 
      : users.map((u) => u.email);
    
    navigator.clipboard.writeText(emails.join(', '));
    toast.success(`Copied ${emails.length} email(s) to clipboard`);
  };

  const getStatusBadge = (user: MarketingUser) => {
    const status = user.tenant?.subscription_status;
    if (!user.is_active) {
      return <Badge variant="secondary">Inactive</Badge>;
    }
    switch (status) {
      case 'active':
        return <Badge className="bg-green-500/10 text-green-600 border-green-500/20">Subscribed</Badge>;
      case 'trial':
        return <Badge className="bg-blue-500/10 text-blue-600 border-blue-500/20">Trial</Badge>;
      case 'expired':
        return <Badge className="bg-red-500/10 text-red-600 border-red-500/20">Expired</Badge>;
      default:
        return <Badge variant="outline">Free</Badge>;
    }
  };

  return (
    <AdminLayout title="User Marketing" description="Manage user emails and send AI-powered marketing campaigns">
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">User Marketing</h1>
            <p className="text-muted-foreground">
              Manage user emails and send AI-powered marketing campaigns
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={fetchUsers} disabled={isLoading}>
              <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
            <Button variant="outline" onClick={copyEmails}>
              <Copy className="h-4 w-4 mr-2" />
              Copy Emails
            </Button>
            <Button variant="outline" onClick={exportEmails}>
              <Download className="h-4 w-4 mr-2" />
              Export CSV
            </Button>
            <Button 
              onClick={() => setShowComposeDialog(true)}
              disabled={selectedUsers.size === 0}
            >
              <Mail className="h-4 w-4 mr-2" />
              Send Email ({selectedUsers.size})
            </Button>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Total Users</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{users.length}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Active Subscribers</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">
                {users.filter((u) => u.tenant?.subscription_status === 'active').length}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">On Trial</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-blue-600">
                {users.filter((u) => u.tenant?.subscription_status === 'trial').length}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Selected</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-primary">{selectedUsers.size}</div>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex flex-col md:flex-row gap-4">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search by email, name, or company..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-[180px]">
                  <Filter className="h-4 w-4 mr-2" />
                  <SelectValue placeholder="Filter by status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Users</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="inactive">Inactive</SelectItem>
                  <SelectItem value="subscribed">Subscribed</SelectItem>
                  <SelectItem value="trial">On Trial</SelectItem>
                  <SelectItem value="expired">Expired</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Users Table */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              User Email Directory
            </CardTitle>
            <CardDescription>
              Select users to send marketing emails. Passwords are securely stored and never displayed.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-3">
                {[...Array(5)].map((_, i) => (
                  <Skeleton key={i} className="h-16 w-full" />
                ))}
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12">
                      <Checkbox
                        checked={selectedUsers.size === filteredUsers.length && filteredUsers.length > 0}
                        onCheckedChange={selectAllUsers}
                      />
                    </TableHead>
                    <TableHead>User</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Company</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Joined</TableHead>
                    <TableHead>Last Login</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredUsers.map((user) => (
                    <TableRow 
                      key={user.id}
                      className={selectedUsers.has(user.id) ? 'bg-primary/5' : ''}
                    >
                      <TableCell>
                        <Checkbox
                          checked={selectedUsers.has(user.id)}
                          onCheckedChange={() => toggleUserSelection(user.id)}
                        />
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <Avatar className="h-8 w-8">
                            <AvatarFallback>
                              {user.full_name?.charAt(0) || user.email.charAt(0).toUpperCase()}
                            </AvatarFallback>
                          </Avatar>
                          <span className="font-medium">{user.full_name || 'No name'}</span>
                        </div>
                      </TableCell>
                      <TableCell className="font-mono text-sm">{user.email}</TableCell>
                      <TableCell>{user.tenant?.name || '-'}</TableCell>
                      <TableCell>{getStatusBadge(user)}</TableCell>
                      <TableCell className="text-muted-foreground text-sm">
                        {format(new Date(user.created_at), 'MMM d, yyyy')}
                      </TableCell>
                      <TableCell className="text-muted-foreground text-sm">
                        {user.last_login_at 
                          ? format(new Date(user.last_login_at), 'MMM d, yyyy')
                          : 'Never'}
                      </TableCell>
                    </TableRow>
                  ))}
                  {filteredUsers.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                        No users found
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {/* Compose Email Dialog */}
        <Dialog open={showComposeDialog} onOpenChange={setShowComposeDialog}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Mail className="h-5 w-5" />
                Compose Marketing Email
              </DialogTitle>
              <DialogDescription>
                Send to {selectedUsers.size} selected recipient(s)
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4">
              {/* AI Generation Section */}
              <Card className="border-dashed border-primary/30 bg-primary/5">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Sparkles className="h-4 w-4 text-primary" />
                    AI Email Generator
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label>Email Purpose</Label>
                      <Select value={emailPurpose} onValueChange={setEmailPurpose}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="promotion">Promotion / Offer</SelectItem>
                          <SelectItem value="newsletter">Newsletter</SelectItem>
                          <SelectItem value="announcement">Announcement</SelectItem>
                          <SelectItem value="reengagement">Re-engagement</SelectItem>
                          <SelectItem value="welcome">Welcome Email</SelectItem>
                          <SelectItem value="upgrade">Upgrade Reminder</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div>
                    <Label>Describe what you want (AI will generate the email)</Label>
                    <Textarea
                      placeholder="E.g., Write a friendly email announcing our new AI matching feature and offering 20% off for the first month..."
                      value={aiPrompt}
                      onChange={(e) => setAiPrompt(e.target.value)}
                      rows={3}
                    />
                  </div>
                  <Button 
                    onClick={handleGenerateAIEmail}
                    disabled={isGeneratingAI || !aiPrompt.trim()}
                    className="w-full"
                    variant="secondary"
                  >
                    {isGeneratingAI ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Generating...
                      </>
                    ) : (
                      <>
                        <Sparkles className="h-4 w-4 mr-2" />
                        Generate with AI
                      </>
                    )}
                  </Button>
                </CardContent>
              </Card>

              {/* Email Content */}
              <div>
                <Label>Subject Line</Label>
                <Input
                  placeholder="Enter email subject..."
                  value={emailSubject}
                  onChange={(e) => setEmailSubject(e.target.value)}
                />
              </div>

              <div>
                <Label>Email Body</Label>
                <Textarea
                  placeholder="Enter your email content..."
                  value={emailBody}
                  onChange={(e) => setEmailBody(e.target.value)}
                  rows={10}
                  className="font-sans"
                />
              </div>

              {/* Recipients Preview */}
              <div className="bg-muted/50 rounded-lg p-3">
                <Label className="text-xs text-muted-foreground">Recipients ({selectedUsers.size})</Label>
                <div className="text-sm mt-1 max-h-20 overflow-y-auto">
                  {getSelectedEmails().slice(0, 10).join(', ')}
                  {selectedUsers.size > 10 && ` and ${selectedUsers.size - 10} more...`}
                </div>
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setShowComposeDialog(false)}>
                Cancel
              </Button>
              <Button 
                onClick={handleSendEmails}
                disabled={isSendingEmail || !emailSubject.trim() || !emailBody.trim()}
              >
                {isSendingEmail ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Sending...
                  </>
                ) : (
                  <>
                    <Send className="h-4 w-4 mr-2" />
                    Send to {selectedUsers.size} Recipients
                  </>
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </AdminLayout>
  );
}
