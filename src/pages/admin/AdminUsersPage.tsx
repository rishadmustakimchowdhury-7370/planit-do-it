import { useState, useEffect } from 'react';
import { AdminLayout } from '@/components/admin/AdminLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Skeleton } from '@/components/ui/skeleton';
import { Checkbox } from '@/components/ui/checkbox';
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
  CalendarClock,
  Edit,
  ShieldCheck,
  ShieldOff,
  Bell,
  CreditCard,
  Calendar,
  UserX,
  CheckSquare,
  XSquare,
} from 'lucide-react';
import { Textarea } from '@/components/ui/textarea';

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
    trial_expires_at: string | null;
    trial_days: number | null;
  } | null;
  is_super_admin?: boolean;
  tenant_role?: string | null;
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
  
  // Bulk selection state
  const [selectedUsers, setSelectedUsers] = useState<Set<string>>(new Set());
  const [showBulkDeleteDialog, setShowBulkDeleteDialog] = useState(false);
  const [showBulkPackageDialog, setShowBulkPackageDialog] = useState(false);
  const [bulkPackage, setBulkPackage] = useState('');
  
  // Dialog states
  const [selectedUser, setSelectedUser] = useState<UserWithTenant | null>(null);
  const [showGraceDialog, setShowGraceDialog] = useState(false);
  const [showPackageDialog, setShowPackageDialog] = useState(false);
  const [showTempLoginDialog, setShowTempLoginDialog] = useState(false);
  const [showAddUserDialog, setShowAddUserDialog] = useState(false);
  const [showTrialDialog, setShowTrialDialog] = useState(false);
  const [showViewProfileDialog, setShowViewProfileDialog] = useState(false);
  const [showEditProfileDialog, setShowEditProfileDialog] = useState(false);
  const [showSendReminderDialog, setShowSendReminderDialog] = useState(false);
  const [showDeleteOrphanedDialog, setShowDeleteOrphanedDialog] = useState(false);
  const [showDeleteConfirmDialog, setShowDeleteConfirmDialog] = useState(false);
  const [orphanedEmail, setOrphanedEmail] = useState('');
  const [graceDays, setGraceDays] = useState('7');
  const [trialDays, setTrialDays] = useState('14');
  const [selectedPackage, setSelectedPackage] = useState('');
  const [tempLoginMinutes, setTempLoginMinutes] = useState('30');
  const [reminderMessage, setReminderMessage] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);

  // Add user form
  const [newUserForm, setNewUserForm] = useState({
    email: '',
    fullName: '',
    password: '',
    companyName: '',
    selectedPlan: '',
  });

  // Edit user form
  const [editUserForm, setEditUserForm] = useState({
    fullName: '',
    phone: '',
    jobTitle: '',
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
            grace_until,
            trial_expires_at,
            trial_days
          )
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Fetch super admin status for each user
      const { data: superAdminRoles } = await supabase
        .from('user_roles')
        .select('user_id')
        .eq('role', 'super_admin');

      const superAdminIds = new Set(superAdminRoles?.map(r => r.user_id) || []);

      // Fetch tenant roles for each user
      const { data: tenantRoles } = await supabase
        .from('user_roles')
        .select('user_id, tenant_id, role')
        .neq('role', 'super_admin');

      const roleMap = new Map<string, string>();
      tenantRoles?.forEach(r => {
        // Map user_id + tenant_id to role
        roleMap.set(`${r.user_id}_${r.tenant_id}`, r.role);
      });

      const usersWithSuperAdmin = (profiles as unknown as UserWithTenant[]).map(user => ({
        ...user,
        is_super_admin: superAdminIds.has(user.id),
        tenant_role: user.tenant_id ? roleMap.get(`${user.id}_${user.tenant_id}`) || null : null,
      }));

      setUsers(usersWithSuperAdmin);
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

    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(newUserForm.email)) {
      toast.error('Please enter a valid email address');
      return;
    }

    // Password validation
    if (newUserForm.password.length < 6) {
      toast.error('Password must be at least 6 characters');
      return;
    }

    try {
      setIsProcessing(true);

      // Call edge function to create user with service role
      const { data, error } = await supabase.functions.invoke('admin-create-user', {
        body: {
          email: newUserForm.email.trim().toLowerCase(),
          password: newUserForm.password,
          fullName: newUserForm.fullName.trim(),
          companyName: newUserForm.companyName?.trim() || `${newUserForm.fullName.trim()}'s Workspace`,
          planId: newUserForm.selectedPlan || null,
        },
      });

      if (error) {
        console.error('Edge function error:', error);
        throw error;
      }

      if (!data?.success) {
        throw new Error(data?.error || 'Failed to create user');
      }

      await logAuditAction('create_user', data.user.id, { email: newUserForm.email });
      toast.success('User created successfully! Account is ready to use.');
      setShowAddUserDialog(false);
      setNewUserForm({ email: '', fullName: '', password: '', companyName: '', selectedPlan: '' });
      fetchUsers();
    } catch (error: any) {
      console.error('Error creating user:', error);

      // Provide more specific error messages
      let errorMessage = 'Failed to create user';
      const msg = error?.message || '';

      if (msg.includes('already been registered') || msg.includes('email_exists') || msg.includes('already exists')) {
        errorMessage = 'A user with this email already exists';
      } else if (msg.includes('Only super admins') || msg.includes('forbidden')) {
        errorMessage = 'You do not have permission to create users.';
      } else if (msg) {
        errorMessage = msg;
      }

      toast.error(errorMessage);
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
      
      // Use the subscription-lifecycle edge function to grant grace period with email notification
      const { data, error } = await supabase.functions.invoke('subscription-lifecycle', {
        body: {
          action: 'grant_grace_period',
          tenant_id: selectedUser.tenant_id,
          grace_days: parseInt(graceDays),
          admin_id: currentUser?.id,
          reason: 'Granted by admin from user management',
        },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      await logAuditAction('grant_grace', selectedUser.id, { days: graceDays });
      toast.success(`${graceDays}-day grace period granted and notification sent`);
      setShowGraceDialog(false);
      fetchUsers();
    } catch (error: any) {
      console.error('Error granting grace:', error);
      toast.error(error?.message || 'Failed to grant grace period');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleGrantTrial = async () => {
    if (!selectedUser?.tenant_id) return;

    try {
      setIsProcessing(true);
      const trialExpires = new Date();
      trialExpires.setDate(trialExpires.getDate() + parseInt(trialDays));

      const { error } = await supabase
        .from('tenants')
        .update({ 
          trial_expires_at: trialExpires.toISOString(),
          trial_days: parseInt(trialDays),
          subscription_status: 'trial',
        })
        .eq('id', selectedUser.tenant_id);

      if (error) throw error;

      // Send trial notification email
      try {
        await supabase.functions.invoke('subscription-lifecycle', {
          body: {
            action: 'send_trial_notification',
            tenant_id: selectedUser.tenant_id,
          },
        });
      } catch (emailError) {
        console.warn('Failed to send trial notification email:', emailError);
        // Don't fail the whole operation if email fails
      }

      await logAuditAction('grant_trial', selectedUser.id, { days: trialDays });
      toast.success(`${trialDays}-day trial period granted and notification sent`);
      setShowTrialDialog(false);
      fetchUsers();
    } catch (error) {
      console.error('Error granting trial:', error);
      toast.error('Failed to grant trial period');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleAssignPackage = async () => {
    if (!selectedUser?.tenant_id || !selectedPackage) return;

    try {
      setIsProcessing(true);

      // Get package details
      const { data: packageData } = await supabase
        .from('subscription_plans')
        .select('name')
        .eq('id', selectedPackage)
        .single();

      const { error } = await supabase
        .from('tenants')
        .update({ 
          subscription_plan_id: selectedPackage,
          subscription_status: 'active',
        })
        .eq('id', selectedUser.tenant_id);

      if (error) throw error;

      // Send package assignment notification email
      try {
        await supabase.functions.invoke('subscription-lifecycle', {
          body: {
            action: 'send_package_notification',
            tenant_id: selectedUser.tenant_id,
            package_name: packageData?.name || 'your new package',
          },
        });
      } catch (emailError) {
        console.warn('Failed to send package notification email:', emailError);
      }

      await logAuditAction('assign_package', selectedUser.id, { package_id: selectedPackage });
      toast.success('Package assigned and notification sent');
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
      
      // Use our edge function instead of Supabase auth directly
      const { data, error } = await supabase.functions.invoke('send-password-reset', {
        body: { email: user.email }
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      await logAuditAction('send_password_reset', user.id);
      toast.success('Password reset email sent');
    } catch (error: any) {
      console.error('Error sending password reset:', error);
      toast.error(error?.message || 'Failed to send password reset');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDeleteUser = async (user: UserWithTenant) => {
    setSelectedUser(user);
    setShowDeleteConfirmDialog(true);
  };

  const confirmDeleteUser = async () => {
    if (!selectedUser) return;
    
    try {
      setIsProcessing(true);

      const { data, error } = await supabase.functions.invoke('delete-user', {
        body: { user_id: selectedUser.id }
      });

      if (error) throw error;

      if (data?.error) {
        throw new Error(data.error);
      }

      await logAuditAction('delete_user', selectedUser.id);
      toast.success('User permanently deleted from the system');
      setShowDeleteConfirmDialog(false);
      setSelectedUser(null);
      fetchUsers();
    } catch (error: any) {
      console.error('Error deleting user:', error);
      toast.error(error.message || 'Failed to delete user');
    } finally {
      setIsProcessing(false);
    }
  };

  // Bulk selection handlers
  const handleSelectAll = () => {
    if (selectedUsers.size === filteredUsers.length) {
      setSelectedUsers(new Set());
    } else {
      setSelectedUsers(new Set(filteredUsers.map(u => u.id)));
    }
  };

  const handleSelectUser = (userId: string) => {
    const newSelected = new Set(selectedUsers);
    if (newSelected.has(userId)) {
      newSelected.delete(userId);
    } else {
      newSelected.add(userId);
    }
    setSelectedUsers(newSelected);
  };

  const handleBulkDelete = async () => {
    if (selectedUsers.size === 0) return;

    try {
      setIsProcessing(true);
      let successCount = 0;
      let errorCount = 0;

      for (const userId of selectedUsers) {
        try {
          const { data, error } = await supabase.functions.invoke('delete-user', {
            body: { user_id: userId }
          });

          if (error || data?.error) {
            errorCount++;
            console.error(`Failed to delete user ${userId}:`, error || data?.error);
          } else {
            successCount++;
            await logAuditAction('delete_user', userId);
          }
        } catch (e) {
          errorCount++;
          console.error(`Failed to delete user ${userId}:`, e);
        }
      }

      if (successCount > 0) {
        toast.success(`Successfully deleted ${successCount} user(s)`);
      }
      if (errorCount > 0) {
        toast.error(`Failed to delete ${errorCount} user(s)`);
      }

      setShowBulkDeleteDialog(false);
      setSelectedUsers(new Set());
      fetchUsers();
    } catch (error: any) {
      console.error('Error in bulk delete:', error);
      toast.error('Failed to complete bulk delete');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleBulkAssignPackage = async () => {
    if (selectedUsers.size === 0 || !bulkPackage) return;

    try {
      setIsProcessing(true);
      let successCount = 0;
      let errorCount = 0;

      // Get tenant IDs for selected users
      const usersToUpdate = users.filter(u => selectedUsers.has(u.id) && u.tenant_id);

      for (const user of usersToUpdate) {
        try {
          const { error } = await supabase
            .from('tenants')
            .update({ 
              subscription_plan_id: bulkPackage,
              subscription_status: 'active',
            })
            .eq('id', user.tenant_id!);

          if (error) {
            errorCount++;
            console.error(`Failed to assign package for ${user.email}:`, error);
          } else {
            successCount++;
            await logAuditAction('assign_package', user.id, { package_id: bulkPackage });
          }
        } catch (e) {
          errorCount++;
          console.error(`Failed to assign package for ${user.email}:`, e);
        }
      }

      if (successCount > 0) {
        toast.success(`Successfully assigned package to ${successCount} user(s)`);
      }
      if (errorCount > 0) {
        toast.error(`Failed to assign package to ${errorCount} user(s)`);
      }

      setShowBulkPackageDialog(false);
      setBulkPackage('');
      setSelectedUsers(new Set());
      fetchUsers();
    } catch (error: any) {
      console.error('Error in bulk assign package:', error);
      toast.error('Failed to complete bulk package assignment');
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
      const tempLoginUrl = `${window.location.origin}/auth?temp_token=${token}&user_id=${selectedUser.id}`;
      await navigator.clipboard.writeText(tempLoginUrl);

      // Send temp login email to user
      try {
        await supabase.functions.invoke('subscription-lifecycle', {
          body: {
            action: 'send_temp_login_notification',
            user_email: selectedUser.email,
            user_name: selectedUser.full_name || selectedUser.email.split('@')[0],
            temp_login_url: tempLoginUrl,
            expires_in_minutes: tempLoginMinutes,
          },
        });
      } catch (emailError) {
        console.warn('Failed to send temp login notification email:', emailError);
      }

      await logAuditAction('generate_temp_login', selectedUser.id, { expires_in: tempLoginMinutes });
      toast.success('Temporary login link copied and email sent to user');
      setShowTempLoginDialog(false);
    } catch (error) {
      console.error('Error generating temp login:', error);
      toast.error('Failed to generate temporary login');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleViewProfile = (user: UserWithTenant) => {
    setSelectedUser(user);
    setShowViewProfileDialog(true);
  };

  const handleEditProfile = (user: UserWithTenant) => {
    setSelectedUser(user);
    setEditUserForm({
      fullName: user.full_name || '',
      phone: user.phone || '',
      jobTitle: user.job_title || '',
    });
    setShowEditProfileDialog(true);
  };

  const handleSaveProfile = async () => {
    if (!selectedUser) return;

    try {
      setIsProcessing(true);

      const { error } = await supabase
        .from('profiles')
        .update({
          full_name: editUserForm.fullName,
          phone: editUserForm.phone,
          job_title: editUserForm.jobTitle,
        })
        .eq('id', selectedUser.id);

      if (error) throw error;

      await logAuditAction('edit_profile', selectedUser.id, editUserForm);
      toast.success('Profile updated successfully');
      setShowEditProfileDialog(false);
      fetchUsers();
    } catch (error) {
      console.error('Error updating profile:', error);
      toast.error('Failed to update profile');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleSendReminder = async () => {
    if (!selectedUser) return;

    try {
      setIsProcessing(true);

      // Call edge function to send reminder email
      const { data, error } = await supabase.functions.invoke('send-renewal-reminders', {
        body: {
          manual: true,
          user_email: selectedUser.email,
          user_name: selectedUser.full_name || selectedUser.email.split('@')[0],
          custom_message: reminderMessage,
          subscription_ends_at: selectedUser.tenant?.subscription_ends_at,
          trial_expires_at: selectedUser.tenant?.trial_expires_at,
          subscription_status: selectedUser.tenant?.subscription_status,
        },
      });

      if (error) throw error;

      await logAuditAction('send_reminder', selectedUser.id, { 
        type: 'manual_reminder',
        message: reminderMessage 
      });
      
      toast.success('Reminder sent successfully');
      setShowSendReminderDialog(false);
      setReminderMessage('');
    } catch (error: any) {
      console.error('Error sending reminder:', error);
      toast.error(error?.message || 'Failed to send reminder');
    } finally {
      setIsProcessing(false);
    }
  };

  const getSubscribedDate = (user: UserWithTenant) => {
    // Use created_at as the subscription start date
    if (user.created_at) {
      return new Date(user.created_at).toLocaleDateString();
    }
    return '-';
  };

  const getDaysUntilExpiry = (user: UserWithTenant) => {
    let expiryDate: Date | null = null;
    
    if (user.tenant?.subscription_status === 'trial' && user.tenant.trial_expires_at) {
      expiryDate = new Date(user.tenant.trial_expires_at);
    } else if (user.tenant?.subscription_ends_at) {
      expiryDate = new Date(user.tenant.subscription_ends_at);
    }
    
    if (!expiryDate) return null;
    
    const now = new Date();
    const diffTime = expiryDate.getTime() - now.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    return diffDays;
  };

  const handleToggleSuperAdmin = async (user: UserWithTenant) => {
    if (user.id === currentUser?.id) {
      toast.error('You cannot change your own super admin status');
      return;
    }

    try {
      setIsProcessing(true);

      if (user.is_super_admin) {
        // Remove super admin role
        const { error } = await supabase
          .from('user_roles')
          .delete()
          .eq('user_id', user.id)
          .eq('role', 'super_admin');

        if (error) throw error;

        await logAuditAction('revoke_super_admin', user.id);
        toast.success('Super Admin access revoked');
      } else {
        // Add super admin role
        const { error } = await supabase
          .from('user_roles')
          .insert({
            user_id: user.id,
            role: 'super_admin',
            tenant_id: null,
          });

        if (error) throw error;

        await logAuditAction('grant_super_admin', user.id);
        toast.success('Super Admin access granted');
      }

      fetchUsers();
    } catch (error) {
      console.error('Error toggling super admin:', error);
      toast.error('Failed to update super admin status');
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

  const handleDeleteOrphanedUser = async () => {
    if (!orphanedEmail) {
      toast.error('Please enter an email address');
      return;
    }

    try {
      setIsProcessing(true);

      const { data, error } = await supabase.functions.invoke('delete-orphaned-user', {
        body: { email: orphanedEmail.trim().toLowerCase() }
      });

      if (error) throw error;

      if (data?.error) {
        throw new Error(data.error);
      }

      await logAuditAction('delete_orphaned_user', data.deleted_user_id || '', { email: orphanedEmail });
      toast.success(data.message || 'Orphaned user deleted successfully');
      setShowDeleteOrphanedDialog(false);
      setOrphanedEmail('');
    } catch (error: any) {
      console.error('Error deleting orphaned user:', error);
      toast.error(error.message || 'Failed to delete orphaned user');
    } finally {
      setIsProcessing(false);
    }
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
      const isExpired = user.tenant.trial_expires_at && new Date(user.tenant.trial_expires_at) < new Date();
      if (isExpired) {
        return <Badge variant="outline" className="border-destructive text-destructive">Trial Expired</Badge>;
      }
      return <Badge variant="outline" className="border-yellow-500 text-yellow-500">Trial</Badge>;
    }
    if (user.tenant?.subscription_status === 'active') {
      return <Badge variant="default" className="bg-green-600">Active</Badge>;
    }
    return <Badge variant="secondary">Inactive</Badge>;
  };

  const getExpiresDate = (user: UserWithTenant) => {
    // For trial users, show trial expiry date
    if (user.tenant?.subscription_status === 'trial' && user.tenant.trial_expires_at) {
      return new Date(user.tenant.trial_expires_at).toLocaleDateString();
    }
    // For subscribed users, show subscription end date
    if (user.tenant?.subscription_ends_at) {
      return new Date(user.tenant.subscription_ends_at).toLocaleDateString();
    }
    return '-';
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
        <Button variant="outline" onClick={() => setShowDeleteOrphanedDialog(true)}>
          <UserX className="h-4 w-4 mr-2" />
          Delete Orphaned
        </Button>
      </div>

      {/* Bulk Actions Bar */}
      {selectedUsers.size > 0 && (
        <Card className="mb-4 border-primary/50 bg-primary/5">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CheckSquare className="h-5 w-5 text-primary" />
                <span className="font-medium">{selectedUsers.size} user(s) selected</span>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowBulkPackageDialog(true)}
                >
                  <Package className="h-4 w-4 mr-2" />
                  Assign Package
                </Button>
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => setShowBulkDeleteDialog(true)}
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Delete Selected
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setSelectedUsers(new Set())}
                >
                  <XSquare className="h-4 w-4 mr-2" />
                  Clear Selection
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

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
                  <TableHead className="w-12">
                    <Checkbox
                      checked={selectedUsers.size === filteredUsers.length && filteredUsers.length > 0}
                      onCheckedChange={handleSelectAll}
                    />
                  </TableHead>
                  <TableHead>User</TableHead>
                  <TableHead>Company</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Subscribed</TableHead>
                  <TableHead>Expires</TableHead>
                  <TableHead>Days Left</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredUsers.map((user) => {
                  const daysLeft = getDaysUntilExpiry(user);
                  const isSelected = selectedUsers.has(user.id);
                  return (
                  <TableRow key={user.id} className={isSelected ? 'bg-primary/5' : ''}>
                    <TableCell>
                      <Checkbox
                        checked={isSelected}
                        onCheckedChange={() => handleSelectUser(user.id)}
                      />
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <Avatar className="h-9 w-9">
                          <AvatarImage src={user.avatar_url || undefined} />
                          <AvatarFallback>
                            {user.full_name?.charAt(0) || user.email.charAt(0).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <div className="flex items-center gap-2">
                            <p className="font-medium">{user.full_name || 'No name'}</p>
                            {user.is_super_admin && (
                              <Badge variant="outline" className="text-xs border-purple-500 text-purple-500">
                                Super Admin
                              </Badge>
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground">{user.email}</p>
                          {user.phone && (
                            <p className="text-xs text-muted-foreground">{user.phone}</p>
                          )}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>{user.tenant?.name || '-'}</TableCell>
                    <TableCell>
                      {user.tenant_role ? (
                        <Badge 
                          variant={user.tenant_role === 'owner' ? 'default' : 'secondary'}
                          className={user.tenant_role === 'owner' ? 'bg-blue-600' : user.tenant_role === 'manager' ? 'bg-amber-600' : ''}
                        >
                          {user.tenant_role.charAt(0).toUpperCase() + user.tenant_role.slice(1)}
                        </Badge>
                      ) : '-'}
                    </TableCell>
                    <TableCell>{getStatusBadge(user)}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Calendar className="h-3 w-3 text-muted-foreground" />
                        <span className="text-sm">{getSubscribedDate(user)}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      {getExpiresDate(user) !== '-' ? (
                        <div className="flex items-center gap-1">
                          <CalendarClock className="h-3 w-3 text-muted-foreground" />
                          <span className="text-sm">{getExpiresDate(user)}</span>
                        </div>
                      ) : (
                        <span className="text-muted-foreground">No expiry</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {daysLeft !== null ? (
                        <Badge 
                          variant={daysLeft <= 7 ? "destructive" : daysLeft <= 14 ? "outline" : "secondary"}
                          className={daysLeft <= 7 ? "" : daysLeft <= 14 ? "border-yellow-500 text-yellow-600" : ""}
                        >
                          {daysLeft < 0 ? `${Math.abs(daysLeft)}d overdue` : `${daysLeft}d`}
                        </Badge>
                      ) : '-'}
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
                          <DropdownMenuItem onClick={() => handleViewProfile(user)}>
                            <Eye className="h-4 w-4 mr-2" />
                            View Profile
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleEditProfile(user)}>
                            <Edit className="h-4 w-4 mr-2" />
                            Edit Profile
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            onClick={() => handleToggleSuperAdmin(user)}
                            disabled={user.id === currentUser?.id}
                          >
                            {user.is_super_admin ? (
                              <>
                                <ShieldOff className="h-4 w-4 mr-2" />
                                Revoke Super Admin
                              </>
                            ) : (
                              <>
                                <ShieldCheck className="h-4 w-4 mr-2" />
                                Make Super Admin
                              </>
                            )}
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
                          <DropdownMenuItem
                            onClick={() => {
                              setSelectedUser(user);
                              setShowTrialDialog(true);
                            }}
                          >
                            <CalendarClock className="h-4 w-4 mr-2" />
                            Grant Trial Period
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem 
                            onClick={() => {
                              setSelectedUser(user);
                              setReminderMessage('');
                              setShowSendReminderDialog(true);
                            }}
                          >
                            <Bell className="h-4 w-4 mr-2" />
                            Send Reminder
                          </DropdownMenuItem>
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
                            onClick={() => handleDeleteUser(user)}
                          >
                            <Trash2 className="h-4 w-4 mr-2" />
                            Delete User
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                  );
                })}
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

      {/* Grant Trial Dialog */}
      <Dialog open={showTrialDialog} onOpenChange={setShowTrialDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Grant Trial Period</DialogTitle>
            <DialogDescription>
              Give a free trial access to {selectedUser?.full_name || selectedUser?.email}. 
              They will have full access during the trial period.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Label>Trial Duration</Label>
            <Select value={trialDays} onValueChange={setTrialDays}>
              <SelectTrigger className="mt-2">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="3">3 Days</SelectItem>
                <SelectItem value="7">7 Days</SelectItem>
                <SelectItem value="14">14 Days</SelectItem>
                <SelectItem value="21">21 Days</SelectItem>
                <SelectItem value="30">30 Days</SelectItem>
                <SelectItem value="60">60 Days</SelectItem>
                <SelectItem value="90">90 Days</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-sm text-muted-foreground mt-3">
              Trial expires: {new Date(Date.now() + parseInt(trialDays) * 24 * 60 * 60 * 1000).toLocaleDateString()}
            </p>
            {selectedUser?.tenant?.subscription_status === 'trial' && selectedUser?.tenant?.trial_expires_at && (
              <p className="text-sm text-yellow-600 mt-2">
                Note: User is already on trial (expires {new Date(selectedUser.tenant.trial_expires_at).toLocaleDateString()}). This will extend/reset their trial.
              </p>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowTrialDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleGrantTrial} disabled={isProcessing}>
              {isProcessing && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Grant Trial
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* View Profile Dialog */}
      <Dialog open={showViewProfileDialog} onOpenChange={setShowViewProfileDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>User Profile</DialogTitle>
            <DialogDescription>
              View details for {selectedUser?.full_name || selectedUser?.email}
            </DialogDescription>
          </DialogHeader>
          {selectedUser && (
            <div className="space-y-4 py-4">
              <div className="flex items-center gap-4">
                <Avatar className="h-16 w-16">
                  <AvatarImage src={selectedUser.avatar_url || undefined} />
                  <AvatarFallback className="text-lg">
                    {selectedUser.full_name?.charAt(0) || selectedUser.email.charAt(0).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <h3 className="font-semibold text-lg">{selectedUser.full_name || 'No name'}</h3>
                  <p className="text-sm text-muted-foreground">{selectedUser.email}</p>
                  {selectedUser.is_super_admin && (
                    <Badge variant="default" className="mt-1 bg-purple-600">Super Admin</Badge>
                  )}
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-4 pt-4 border-t">
                <div>
                  <Label className="text-muted-foreground">Phone</Label>
                  <p className="font-medium">{selectedUser.phone || '-'}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Job Title</Label>
                  <p className="font-medium">{selectedUser.job_title || '-'}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Company</Label>
                  <p className="font-medium">{selectedUser.tenant?.name || '-'}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Status</Label>
                  <div className="mt-1">{getStatusBadge(selectedUser)}</div>
                </div>
                <div>
                  <Label className="text-muted-foreground">Subscribed Date</Label>
                  <p className="font-medium">{getSubscribedDate(selectedUser)}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Expiry Date</Label>
                  <p className="font-medium">{getExpiresDate(selectedUser)}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Last Login</Label>
                  <p className="font-medium">
                    {selectedUser.last_login_at 
                      ? new Date(selectedUser.last_login_at).toLocaleDateString() 
                      : 'Never'}
                  </p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Days Until Expiry</Label>
                  <p className="font-medium">
                    {(() => {
                      const days = getDaysUntilExpiry(selectedUser);
                      if (days === null) return '-';
                      if (days < 0) return <span className="text-destructive">{Math.abs(days)} days overdue</span>;
                      if (days <= 7) return <span className="text-destructive">{days} days</span>;
                      if (days <= 14) return <span className="text-yellow-600">{days} days</span>;
                      return `${days} days`;
                    })()}
                  </p>
                </div>
              </div>

              {/* Subscription Info Card */}
              <div className="mt-4 p-4 bg-muted/50 rounded-lg border">
                <div className="flex items-center gap-2 mb-2">
                  <CreditCard className="h-4 w-4 text-muted-foreground" />
                  <Label className="text-sm font-medium">Subscription Details</Label>
                </div>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div>
                    <span className="text-muted-foreground">Plan Type:</span>
                    <span className="ml-2 font-medium capitalize">{selectedUser.tenant?.subscription_status || 'Unknown'}</span>
                  </div>
                  {selectedUser.tenant?.trial_expires_at && (
                    <div>
                      <span className="text-muted-foreground">Trial Expires:</span>
                      <span className="ml-2 font-medium">{new Date(selectedUser.tenant.trial_expires_at).toLocaleDateString()}</span>
                    </div>
                  )}
                  {selectedUser.tenant?.subscription_ends_at && (
                    <div>
                      <span className="text-muted-foreground">Subscription Ends:</span>
                      <span className="ml-2 font-medium">{new Date(selectedUser.tenant.subscription_ends_at).toLocaleDateString()}</span>
                    </div>
                  )}
                  {selectedUser.tenant?.grace_until && (
                    <div>
                      <span className="text-muted-foreground">Grace Until:</span>
                      <span className="ml-2 font-medium">{new Date(selectedUser.tenant.grace_until).toLocaleDateString()}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowViewProfileDialog(false)}>
              Close
            </Button>
            <Button onClick={() => {
              setShowViewProfileDialog(false);
              if (selectedUser) handleEditProfile(selectedUser);
            }}>
              <Edit className="h-4 w-4 mr-2" />
              Edit Profile
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Profile Dialog */}
      <Dialog open={showEditProfileDialog} onOpenChange={setShowEditProfileDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Profile</DialogTitle>
            <DialogDescription>
              Update profile for {selectedUser?.email}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label>Full Name</Label>
              <Input
                value={editUserForm.fullName}
                onChange={(e) => setEditUserForm({ ...editUserForm, fullName: e.target.value })}
                placeholder="John Doe"
                className="mt-1"
              />
            </div>
            <div>
              <Label>Phone</Label>
              <Input
                value={editUserForm.phone}
                onChange={(e) => setEditUserForm({ ...editUserForm, phone: e.target.value })}
                placeholder="+1 234 567 8900"
                className="mt-1"
              />
            </div>
            <div>
              <Label>Job Title</Label>
              <Input
                value={editUserForm.jobTitle}
                onChange={(e) => setEditUserForm({ ...editUserForm, jobTitle: e.target.value })}
                placeholder="Senior Recruiter"
                className="mt-1"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowEditProfileDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleSaveProfile} disabled={isProcessing}>
              {isProcessing && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Send Reminder Dialog */}
      <Dialog open={showSendReminderDialog} onOpenChange={setShowSendReminderDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Send Reminder</DialogTitle>
            <DialogDescription>
              Send a subscription reminder to {selectedUser?.full_name || selectedUser?.email}
            </DialogDescription>
          </DialogHeader>
          {selectedUser && (
            <div className="space-y-4 py-4">
              <div className="p-4 bg-muted/50 rounded-lg border space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Status:</span>
                  <span className="font-medium capitalize">{selectedUser.tenant?.subscription_status || 'Unknown'}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Expires:</span>
                  <span className="font-medium">{getExpiresDate(selectedUser)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Days Left:</span>
                  <span className={`font-medium ${
                    (() => {
                      const days = getDaysUntilExpiry(selectedUser);
                      if (days === null) return '';
                      if (days <= 7) return 'text-destructive';
                      if (days <= 14) return 'text-yellow-600';
                      return '';
                    })()
                  }`}>
                    {(() => {
                      const days = getDaysUntilExpiry(selectedUser);
                      if (days === null) return 'N/A';
                      if (days < 0) return `${Math.abs(days)} days overdue`;
                      return `${days} days`;
                    })()}
                  </span>
                </div>
              </div>
              <div>
                <Label>Custom Message (Optional)</Label>
                <Textarea
                  value={reminderMessage}
                  onChange={(e) => setReminderMessage(e.target.value)}
                  placeholder="Add a personalized message to include in the reminder email..."
                  className="mt-2"
                  rows={4}
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowSendReminderDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleSendReminder} disabled={isProcessing}>
              {isProcessing && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              <Bell className="h-4 w-4 mr-2" />
              Send Reminder
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Orphaned User Dialog */}
      <Dialog open={showDeleteOrphanedDialog} onOpenChange={setShowDeleteOrphanedDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Orphaned User</DialogTitle>
            <DialogDescription>
              Delete a user that exists in auth.users but not in the CRM profiles table.
              This is useful when a user was partially deleted or signup failed.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="p-4 bg-destructive/10 border border-destructive/20 rounded-lg">
              <p className="text-sm text-destructive">
                <strong>Warning:</strong> This will permanently delete the user from Supabase Auth.
                They will be able to sign up again with the same email.
              </p>
            </div>
            <div>
              <Label htmlFor="orphaned-email">Email Address</Label>
              <Input
                id="orphaned-email"
                type="email"
                value={orphanedEmail}
                onChange={(e) => setOrphanedEmail(e.target.value)}
                placeholder="user@example.com"
                className="mt-2"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDeleteOrphanedDialog(false)}>
              Cancel
            </Button>
            <Button 
              variant="destructive" 
              onClick={handleDeleteOrphanedUser} 
              disabled={isProcessing || !orphanedEmail}
            >
              {isProcessing && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              <Trash2 className="h-4 w-4 mr-2" />
              Delete User
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Single Delete Confirmation Dialog */}
      <AlertDialog open={showDeleteConfirmDialog} onOpenChange={setShowDeleteConfirmDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete User Permanently?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete <strong>{selectedUser?.full_name || selectedUser?.email}</strong>? 
              This action cannot be undone. All user data will be permanently removed from the system.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isProcessing}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDeleteUser}
              disabled={isProcessing}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isProcessing && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Delete User
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Bulk Delete Confirmation Dialog */}
      <AlertDialog open={showBulkDeleteDialog} onOpenChange={setShowBulkDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {selectedUsers.size} Users?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to permanently delete <strong>{selectedUsers.size}</strong> selected user(s)? 
              This action cannot be undone. All user data will be permanently removed from the system.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isProcessing}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleBulkDelete}
              disabled={isProcessing}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isProcessing && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Delete {selectedUsers.size} Users
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Bulk Assign Package Dialog */}
      <Dialog open={showBulkPackageDialog} onOpenChange={setShowBulkPackageDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Assign Package to {selectedUsers.size} Users</DialogTitle>
            <DialogDescription>
              Select a package to assign to all selected users. Their subscription status will be set to active.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Label>Select Package</Label>
            <Select value={bulkPackage} onValueChange={setBulkPackage}>
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
            <Button variant="outline" onClick={() => setShowBulkPackageDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleBulkAssignPackage} disabled={isProcessing || !bulkPackage}>
              {isProcessing && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Assign to {selectedUsers.size} Users
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
}
