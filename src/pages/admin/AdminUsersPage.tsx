import { useState, useEffect } from 'react';
import { AdminLayout } from '@/components/admin/AdminLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
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
import { useAuth } from '@/lib/auth';
import { toast } from 'sonner';
import {
  Search,
  MoreHorizontal,
  UserPlus,
  Download,
  PauseCircle,
  PlayCircle,
  Trash2,
  Clock,
  Mail,
  Link as LinkIcon,
  Package,
  Eye,
  Loader2,
} from 'lucide-react';

interface UserWithTenant {
  id: string;
  email: string;
  full_name: string | null;
  avatar_url: string | null;
  phone: string | null;
  job_title: string | null;
  is_active: boolean;
  created_at: string;
  last_login_at: string | null;
  tenant_id: string | null;
  tenant?: {
    name: string;
    subscription_status: string;
    is_paused: boolean;
    is_suspended: boolean;
    subscription_ends_at: string | null;
    grace_until: string | null;
  } | null;
}

interface SubscriptionPlan {
  id: string;
  name: string;
  slug: string;
}

export default function AdminUsersPage() {
  const { user: currentUser } = useAuth();
  const [users, setUsers] = useState<UserWithTenant[]>([]);
  const [plans, setPlans] = useState<SubscriptionPlan[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  
  // Dialog states
  const [selectedUser, setSelectedUser] = useState<UserWithTenant | null>(null);
  const [showGraceDialog, setShowGraceDialog] = useState(false);
  const [showPackageDialog, setShowPackageDialog] = useState(false);
  const [showTempLoginDialog, setShowTempLoginDialog] = useState(false);
  const [showAddUserDialog, setShowAddUserDialog] = useState(false);
  const [graceDays, setGraceDays] = useState('7');
  const [selectedPackage, setSelectedPackage] = useState('');
  const [tempLoginMinutes, setTempLoginMinutes] = useState('30');
  const [isProcessing, setIsProcessing] = useState(false);

  // Add user form
  const [newUserForm, setNewUserForm] = useState({
    email: '',
    fullName: '',
    password: '',
    companyName: '',
    selectedPlan: '',
  });

  useEffect(() => {
    fetchUsers();
    fetchPlans();
  }, []);

  const fetchUsers = async () => {
    try {
      setIsLoading(true);

      const { data: profiles, error } = await supabase
        .from('profiles')
        .select(`
          *,
          tenant:tenants!profiles_tenant_id_fkey (
            name,
            subscription_status,
            is_paused,
            is_suspended,
            subscription_ends_at,
            grace_until
          )
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;

      setUsers(profiles as unknown as UserWithTenant[]);
    } catch (error) {
      console.error('Error fetching users:', error);
      toast.error('Failed to fetch users');
    } finally {
      setIsLoading(false);
    }
  };

  const fetchPlans = async () => {
    const { data } = await supabase
      .from('subscription_plans')
      .select('id, name, slug')
      .eq('is_active', true);
    setPlans(data || []);
  };

  const logAuditAction = async (action: string, targetId: string, payload?: Record<string, unknown>) => {
    await supabase.from('audit_log').insert([{
      action,
      entity_type: 'user',
      entity_id: targetId,
      new_values: (payload || {}) as any,
    }]);
  };

  const handleAddUser = async () => {
    if (!newUserForm.email || !newUserForm.password || !newUserForm.fullName) {
      toast.error('Please fill in all required fields');
      return;
    }

    try {
      setIsProcessing(true);

      // Create user via Supabase Auth Admin API (this requires service role)
      // Since we can't use service role from frontend, we'll use signUp 
      // In production, this should be done via an edge function
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: newUserForm.email,
        password: newUserForm.password,
        options: {
          data: {
            full_name: newUserForm.fullName,
          },
        },
      });

      if (authError) throw authError;

      if (authData.user) {
        // If a plan is selected, update the tenant
        if (newUserForm.selectedPlan) {
          // Wait a bit for the trigger to create profile/tenant
          await new Promise(resolve => setTimeout(resolve, 1000));
          
          const { data: profile } = await supabase
            .from('profiles')
            .select('tenant_id')
            .eq('id', authData.user.id)
            .single();

          if (profile?.tenant_id) {
            await supabase
              .from('tenants')
              .update({ 
                subscription_plan_id: newUserForm.selectedPlan,
                name: newUserForm.companyName || `${newUserForm.fullName}'s Workspace`,
              })
              .eq('id', profile.tenant_id);
          }
        }

        await logAuditAction('create_user', authData.user.id, { email: newUserForm.email });
        toast.success('User created successfully! They will receive a confirmation email.');
        setShowAddUserDialog(false);
        setNewUserForm({ email: '', fullName: '', password: '', companyName: '', selectedPlan: '' });
        fetchUsers();
      }
    } catch (error: any) {
      console.error('Error creating user:', error);
      toast.error(error.message || 'Failed to create user');
    } finally {
      setIsProcessing(false);
    }
  };

  const handlePauseUser = async (user: UserWithTenant) => {
    if (!user.tenant_id) return;

    try {
      setIsProcessing(true);
      const isPaused = user.tenant?.is_paused;

      const { error } = await supabase
        .from('tenants')
        .update({
          is_paused: !isPaused,
          paused_at: !isPaused ? new Date().toISOString() : null,
          paused_reason: !isPaused ? 'Paused by admin' : null,
        })
        .eq('id', user.tenant_id);

      if (error) throw error;

      await logAuditAction(isPaused ? 'unpause_user' : 'pause_user', user.id);
      toast.success(`User ${isPaused ? 'unpaused' : 'paused'} successfully`);
      fetchUsers();
    } catch (error) {
      console.error('Error pausing user:', error);
      toast.error('Failed to pause user');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleGrantGrace = async () => {
    if (!selectedUser?.tenant_id) return;

    try {
      setIsProcessing(true);
      const graceUntil = new Date();
      graceUntil.setDate(graceUntil.getDate() + parseInt(graceDays));

      const { error } = await supabase
        .from('tenants')
        .update({ grace_until: graceUntil.toISOString() })
        .eq('id', selectedUser.tenant_id);

      if (error) throw error;

      await logAuditAction('grant_grace', selectedUser.id, { days: graceDays });
      toast.success(`${graceDays}-day grace period granted`);
      setShowGraceDialog(false);
      fetchUsers();
    } catch (error) {
      console.error('Error granting grace:', error);
      toast.error('Failed to grant grace period');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleAssignPackage = async () => {
    if (!selectedUser?.tenant_id || !selectedPackage) return;

    try {
      setIsProcessing(true);

      const { error } = await supabase
        .from('tenants')
        .update({ 
          subscription_plan_id: selectedPackage,
          subscription_status: 'active',
        })
        .eq('id', selectedUser.tenant_id);

      if (error) throw error;

      await logAuditAction('assign_package', selectedUser.id, { package_id: selectedPackage });
      toast.success('Package assigned successfully');
      setShowPackageDialog(false);
      fetchUsers();
    } catch (error) {
      console.error('Error assigning package:', error);
      toast.error('Failed to assign package');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleSendPasswordReset = async (user: UserWithTenant) => {
    try {
      setIsProcessing(true);
      const { error } = await supabase.auth.resetPasswordForEmail(user.email, {
        redirectTo: `${window.location.origin}/auth?reset=true`,
      });

      if (error) throw error;

      await logAuditAction('send_password_reset', user.id);
      toast.success('Password reset email sent');
    } catch (error) {
      console.error('Error sending password reset:', error);
      toast.error('Failed to send password reset');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDeleteUser = async (user: UserWithTenant) => {
    try {
      setIsProcessing(true);

      // First, delete the user's data from profiles and user_roles
      const { error: profileError } = await supabase
        .from('profiles')
        .delete()
        .eq('id', user.id);

      if (profileError) throw profileError;

      // Note: Due to foreign key constraints and RLS policies,
      // deleting from auth.users requires service role access
      // This should ideally be done via an edge function
      toast.success('User profile deleted. Auth account removal requires manual cleanup.');
      
      await logAuditAction('delete_user', user.id);
      fetchUsers();
    } catch (error: any) {
      console.error('Error deleting user:', error);
      toast.error(error.message || 'Failed to delete user');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleGenerateTempLogin = async () => {
    if (!selectedUser) return;

    try {
      setIsProcessing(true);

      // Generate a secure token
      const token = crypto.randomUUID();
      const tokenHash = await crypto.subtle.digest(
        'SHA-256',
        new TextEncoder().encode(token)
      );
      const hashArray = Array.from(new Uint8Array(tokenHash));
      const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

      const expiresAt = new Date();
      expiresAt.setMinutes(expiresAt.getMinutes() + parseInt(tempLoginMinutes));

      const { error } = await supabase.from('temp_login_links').insert({
        user_id: selectedUser.id,
        token_hash: hashHex,
        expires_at: expiresAt.toISOString(),
        created_by: currentUser?.id,
        reason: 'Generated by admin',
      });

      if (error) throw error;

      // Store the raw token temporarily so we can use it for login
      // The temp login URL includes the raw token AND user_id for lookup
      const tempLoginUrl = `${window.location.origin}/auth?temp_token=${token}&user_id=${selectedUser.id}`;
      await navigator.clipboard.writeText(tempLoginUrl);

      await logAuditAction('generate_temp_login', selectedUser.id, { expires_in: tempLoginMinutes });
      toast.success('Temporary login link copied to clipboard');
      setShowTempLoginDialog(false);
    } catch (error) {
      console.error('Error generating temp login:', error);
      toast.error('Failed to generate temporary login');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleExportUsers = () => {
    const csvData = users.map(u => ({
      name: u.full_name || '',
      email: u.email,
      phone: u.phone || '',
      company: u.tenant?.name || '',
      status: u.tenant?.subscription_status || 'unknown',
      is_paused: u.tenant?.is_paused ? 'Yes' : 'No',
    }));

    const headers = ['Name', 'Email', 'Phone', 'Company', 'Status', 'Is Paused'];
    const csv = [
      headers.join(','),
      ...csvData.map(row => Object.values(row).map(v => `"${v}"`).join(',')),
    ].join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `users_export_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();

    logAuditAction('export_users', currentUser?.id || '', { count: users.length });
    toast.success('Users exported');
  };

  const getStatusBadge = (user: UserWithTenant) => {
    if (user.tenant?.is_suspended) {
      return <Badge variant="destructive">Suspended</Badge>;
    }
    if (user.tenant?.is_paused) {
      return <Badge variant="secondary">Paused</Badge>;
    }
    if (user.tenant?.grace_until && new Date(user.tenant.grace_until) > new Date()) {
      return <Badge variant="outline" className="border-orange-500 text-orange-500">On Grace</Badge>;
    }
    if (user.tenant?.subscription_status === 'trial') {
      return <Badge variant="outline" className="border-yellow-500 text-yellow-500">Trial</Badge>;
    }
    if (user.tenant?.subscription_status === 'active') {
      return <Badge variant="default" className="bg-green-600">Active</Badge>;
    }
    return <Badge variant="secondary">Inactive</Badge>;
  };

  const filteredUsers = users.filter(user => {
    const matchesSearch = 
      user.full_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      user.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      user.tenant?.name?.toLowerCase().includes(searchQuery.toLowerCase());

    if (statusFilter === 'all') return matchesSearch;
    if (statusFilter === 'active') return matchesSearch && user.tenant?.subscription_status === 'active';
    if (statusFilter === 'paused') return matchesSearch && user.tenant?.is_paused;
    if (statusFilter === 'trial') return matchesSearch && user.tenant?.subscription_status === 'trial';
    if (statusFilter === 'expired') return matchesSearch && user.tenant?.subscription_status === 'expired';
    return matchesSearch;
  });

  return (
    <AdminLayout title="User Management" description="Manage all platform users">
      {/* Actions Bar */}
      <div className="flex flex-col sm:flex-row gap-4 mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search users..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-40">
            <SelectValue placeholder="Filter by status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Users</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="trial">Trial</SelectItem>
            <SelectItem value="paused">Paused</SelectItem>
            <SelectItem value="expired">Expired</SelectItem>
          </SelectContent>
        </Select>
        <Button variant="outline" onClick={handleExportUsers}>
          <Download className="h-4 w-4 mr-2" />
          Export CSV
        </Button>
        <Button onClick={() => setShowAddUserDialog(true)}>
          <UserPlus className="h-4 w-4 mr-2" />
          Add User
        </Button>
      </div>

      {/* Users Table */}
      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-6 space-y-4">
              {[1, 2, 3, 4, 5].map(i => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>User</TableHead>
                  <TableHead>Company</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Expires</TableHead>
                  <TableHead>Last Login</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredUsers.map((user) => (
                  <TableRow key={user.id}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <Avatar className="h-9 w-9">
                          <AvatarImage src={user.avatar_url || undefined} />
                          <AvatarFallback>
                            {user.full_name?.charAt(0) || user.email.charAt(0).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <p className="font-medium">{user.full_name || 'No name'}</p>
                          <p className="text-xs text-muted-foreground">{user.email}</p>
                          {user.phone && (
                            <p className="text-xs text-muted-foreground">{user.phone}</p>
                          )}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>{user.tenant?.name || '-'}</TableCell>
                    <TableCell>{getStatusBadge(user)}</TableCell>
                    <TableCell>
                      {user.tenant?.subscription_ends_at 
                        ? new Date(user.tenant.subscription_ends_at).toLocaleDateString()
                        : '-'}
                    </TableCell>
                    <TableCell>
                      {user.last_login_at
                        ? new Date(user.last_login_at).toLocaleDateString()
                        : 'Never'}
                    </TableCell>
                    <TableCell className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuLabel>Actions</DropdownMenuLabel>
                          <DropdownMenuItem>
                            <Eye className="h-4 w-4 mr-2" />
                            View Profile
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            onClick={() => {
                              setSelectedUser(user);
                              setShowPackageDialog(true);
                            }}
                          >
                            <Package className="h-4 w-4 mr-2" />
                            Assign Package
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handlePauseUser(user)}>
                            {user.tenant?.is_paused ? (
                              <>
                                <PlayCircle className="h-4 w-4 mr-2" />
                                Unpause
                              </>
                            ) : (
                              <>
                                <PauseCircle className="h-4 w-4 mr-2" />
                                Pause
                              </>
                            )}
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => {
                              setSelectedUser(user);
                              setShowGraceDialog(true);
                            }}
                          >
                            <Clock className="h-4 w-4 mr-2" />
                            Grant Grace Period
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem onClick={() => handleSendPasswordReset(user)}>
                            <Mail className="h-4 w-4 mr-2" />
                            Send Password Reset
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => {
                              setSelectedUser(user);
                              setShowTempLoginDialog(true);
                            }}
                          >
                            <LinkIcon className="h-4 w-4 mr-2" />
                            Generate Temp Login
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem 
                            className="text-destructive"
                            onClick={() => {
                              if (confirm(`Are you sure you want to delete ${user.full_name || user.email}? This action cannot be undone.`)) {
                                handleDeleteUser(user);
                              }
                            }}
                          >
                            <Trash2 className="h-4 w-4 mr-2" />
                            Delete User
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Add User Dialog */}
      <Dialog open={showAddUserDialog} onOpenChange={setShowAddUserDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Add New User</DialogTitle>
            <DialogDescription>
              Create a new user account. They will receive a confirmation email.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label>Full Name *</Label>
              <Input
                value={newUserForm.fullName}
                onChange={(e) => setNewUserForm({ ...newUserForm, fullName: e.target.value })}
                placeholder="John Doe"
                className="mt-1"
              />
            </div>
            <div>
              <Label>Email *</Label>
              <Input
                type="email"
                value={newUserForm.email}
                onChange={(e) => setNewUserForm({ ...newUserForm, email: e.target.value })}
                placeholder="john@example.com"
                className="mt-1"
              />
            </div>
            <div>
              <Label>Password *</Label>
              <Input
                type="password"
                value={newUserForm.password}
                onChange={(e) => setNewUserForm({ ...newUserForm, password: e.target.value })}
                placeholder="••••••••"
                className="mt-1"
              />
            </div>
            <div>
              <Label>Company Name</Label>
              <Input
                value={newUserForm.companyName}
                onChange={(e) => setNewUserForm({ ...newUserForm, companyName: e.target.value })}
                placeholder="Acme Inc."
                className="mt-1"
              />
            </div>
            <div>
              <Label>Subscription Plan</Label>
              <Select 
                value={newUserForm.selectedPlan} 
                onValueChange={(value) => setNewUserForm({ ...newUserForm, selectedPlan: value })}
              >
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="Select a plan (optional)" />
                </SelectTrigger>
                <SelectContent>
                  {plans.map((plan) => (
                    <SelectItem key={plan.id} value={plan.id}>
                      {plan.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddUserDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleAddUser} disabled={isProcessing}>
              {isProcessing && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Create User
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Grace Period Dialog */}
      <Dialog open={showGraceDialog} onOpenChange={setShowGraceDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Grant Grace Period</DialogTitle>
            <DialogDescription>
              Extend access for {selectedUser?.full_name || selectedUser?.email}. 
              After the grace period ends, if they don't subscribe, their account will be automatically paused.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Label>Grace Period Duration</Label>
            <Select value={graceDays} onValueChange={setGraceDays}>
              <SelectTrigger className="mt-2">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="3">3 Days</SelectItem>
                <SelectItem value="7">7 Days</SelectItem>
                <SelectItem value="15">15 Days</SelectItem>
                <SelectItem value="30">30 Days</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-sm text-muted-foreground mt-3">
              Grace until: {new Date(Date.now() + parseInt(graceDays) * 24 * 60 * 60 * 1000).toLocaleDateString()}
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowGraceDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleGrantGrace} disabled={isProcessing}>
              {isProcessing && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Grant Grace
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Assign Package Dialog */}
      <Dialog open={showPackageDialog} onOpenChange={setShowPackageDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Assign Package</DialogTitle>
            <DialogDescription>
              Change subscription package for {selectedUser?.full_name || selectedUser?.email}
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Label>Select Package</Label>
            <Select value={selectedPackage} onValueChange={setSelectedPackage}>
              <SelectTrigger className="mt-2">
                <SelectValue placeholder="Choose a package" />
              </SelectTrigger>
              <SelectContent>
                {plans.map((plan) => (
                  <SelectItem key={plan.id} value={plan.id}>
                    {plan.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowPackageDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleAssignPackage} disabled={isProcessing || !selectedPackage}>
              {isProcessing && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Assign Package
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Temp Login Dialog */}
      <Dialog open={showTempLoginDialog} onOpenChange={setShowTempLoginDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Generate Temporary Login</DialogTitle>
            <DialogDescription>
              Create a single-use login link for {selectedUser?.full_name || selectedUser?.email}
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Label>Link Expiry</Label>
            <Select value={tempLoginMinutes} onValueChange={setTempLoginMinutes}>
              <SelectTrigger className="mt-2">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="15">15 Minutes</SelectItem>
                <SelectItem value="30">30 Minutes</SelectItem>
                <SelectItem value="60">1 Hour</SelectItem>
                <SelectItem value="1440">24 Hours</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowTempLoginDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleGenerateTempLogin} disabled={isProcessing}>
              {isProcessing && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Generate & Copy Link
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
}
