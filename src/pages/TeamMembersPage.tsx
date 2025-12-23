import { useState, useEffect } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Users, 
  UserPlus, 
  Trash2, 
  Crown,
  AlertCircle,
  Mail,
  Clock,
  Shield,
  UserCheck,
  UserX,
  Search,
  MoreVertical,
  RefreshCw,
  Sparkles,
  Settings
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth';
import { toast } from 'sonner';
import { motion } from 'framer-motion';
import { useUsageLimits } from '@/hooks/useUsageLimits';
import { AssignAICreditsDialog } from '@/components/team/AssignAICreditsDialog';
import { ManagePermissionsDialog } from '@/components/team/ManagePermissionsDialog';
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { format } from 'date-fns';

interface TeamMember {
  id: string;
  user_id: string;
  role: string;
  tenant_id: string;
  ai_credits_allocated?: number;
  ai_credits_used?: number;
  profile?: {
    id: string;
    full_name: string | null;
    email: string;
    avatar_url: string | null;
    job_title: string | null;
    is_active: boolean | null;
    last_login_at: string | null;
  };
}

interface TeamInvitation {
  id: string;
  email: string;
  role: string;
  status: string;
  token: string;
  expires_at: string;
  created_at: string;
  invited_by: string;
}

const ROLE_LABELS: Record<string, string> = {
  owner: 'Owner',
  manager: 'Manager',
  recruiter: 'Recruiter',
};

export default function TeamMembersPage() {
  const { profile, tenantId, user, isOwner, isManager } = useAuth();
  const [isLoading, setIsLoading] = useState(true);
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [invitations, setInvitations] = useState<TeamInvitation[]>([]);
  const [teamLimit, setTeamLimit] = useState(2);
  const [planName, setPlanName] = useState('Starter');
  const [searchQuery, setSearchQuery] = useState('');
  const { checkLimit, showLimitError } = useUsageLimits();
  
  // Dialog states
  const [showInviteDialog, setShowInviteDialog] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState('recruiter');
  const [isInviting, setIsInviting] = useState(false);
  const [memberToRemove, setMemberToRemove] = useState<TeamMember | null>(null);
  const [memberToDeactivate, setMemberToDeactivate] = useState<TeamMember | null>(null);
  const [inviteToCancel, setInviteToCancel] = useState<TeamInvitation | null>(null);
  const [memberForCredits, setMemberForCredits] = useState<TeamMember | null>(null);
  const [memberForPermissions, setMemberForPermissions] = useState<TeamMember | null>(null);
  
  // Use auth context roles instead of checking teamMembers array
  const canManageTeam = isOwner || isManager;

  useEffect(() => {
    if (tenantId) {
      fetchTeamData();
      fetchPlanLimits();
    }
  }, [tenantId]);

  const fetchPlanLimits = async () => {
    try {
      const { data: tenant } = await supabase
        .from('tenants')
        .select('subscription_plan_id')
        .eq('id', tenantId)
        .single();

      if (tenant?.subscription_plan_id) {
        const { data: plan } = await supabase
          .from('subscription_plans')
          .select('max_users, name')
          .eq('id', tenant.subscription_plan_id)
          .single();

        if (plan) {
          setTeamLimit(plan.max_users === -1 ? 999 : (plan.max_users || 2));
          setPlanName(plan.name);
        }
      }
    } catch (error) {
      console.error('Error fetching plan limits:', error);
    }
  };

  const fetchTeamData = async () => {
    setIsLoading(true);
    try {
      // Fetch team members with profiles
      const { data: rolesData, error: rolesError } = await supabase
        .from('user_roles')
        .select('id, user_id, role, tenant_id, ai_credits_allocated, ai_credits_used')
        .eq('tenant_id', tenantId);

      if (rolesError) throw rolesError;

      if (rolesData && rolesData.length > 0) {
        const userIds = rolesData.map(r => r.user_id);
        const { data: profilesData } = await supabase
          .from('profiles')
          .select('id, full_name, email, avatar_url, job_title, is_active, last_login_at')
          .in('id', userIds);

        const membersWithProfiles = rolesData.map(role => ({
          ...role,
          profile: profilesData?.find(p => p.id === role.user_id) || undefined
        }));

        setTeamMembers(membersWithProfiles);
      } else {
        setTeamMembers([]);
      }

      // Fetch pending invitations from team_invitations table
      const { data: invitesData, error: invitesError } = await supabase
        .from('team_invitations')
        .select('*')
        .eq('tenant_id', tenantId)
        .eq('status', 'pending')
        .gt('expires_at', new Date().toISOString());

      if (invitesError) throw invitesError;
      setInvitations(invitesData || []);

    } catch (error) {
      console.error('Error fetching team data:', error);
      toast.error('Failed to load team data');
    } finally {
      setIsLoading(false);
    }
  };

  const handleInviteMember = async () => {
    if (!inviteEmail.trim()) {
      toast.error('Please enter an email address');
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(inviteEmail)) {
      toast.error('Please enter a valid email address');
      return;
    }

    // Check team member limit
    if (checkLimit('teamMembers')) {
      showLimitError('team members');
      return;
    }

    // Check if already invited or member
    const existingMember = teamMembers.find(m => m.profile?.email.toLowerCase() === inviteEmail.toLowerCase());
    if (existingMember) {
      toast.error('This user is already a team member');
      return;
    }

    const existingInvite = invitations.find(i => i.email.toLowerCase() === inviteEmail.toLowerCase());
    if (existingInvite) {
      toast.error('This email has already been invited');
      return;
    }

    setIsInviting(true);
    try {
      // Generate secure token
      const token = crypto.randomUUID() + '-' + crypto.randomUUID();
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 7); // 7 days expiry

      const { error } = await supabase
        .from('team_invitations')
        .insert({
          tenant_id: tenantId!,
          email: inviteEmail.toLowerCase().trim(),
          role: inviteRole as 'owner' | 'manager' | 'recruiter',
          invited_by: user?.id!,
          token,
          expires_at: expiresAt.toISOString(),
          status: 'pending'
        });

      if (error) throw error;

      // Send invitation email via edge function
      const { error: emailError } = await supabase.functions.invoke('send-team-invitation', {
        body: {
          email: inviteEmail.toLowerCase().trim(),
          role: inviteRole,
          token,
          tenant_id: tenantId,
          invited_by_name: profile?.full_name || 'Your team'
        }
      });

      if (emailError) {
        console.error('Email error:', emailError);
        // Don't fail - invitation is created, just email failed
        toast.warning('Invitation created but email failed to send. Share the invite link manually.');
      } else {
        toast.success(`Invitation sent to ${inviteEmail}`);
      }

      setShowInviteDialog(false);
      setInviteEmail('');
      setInviteRole('recruiter');
      fetchTeamData();
    } catch (error: any) {
      console.error('Error inviting member:', error);
      toast.error(error.message || 'Failed to send invitation');
    } finally {
      setIsInviting(false);
    }
  };

  const handleRemoveMember = async () => {
    if (!memberToRemove) return;

    try {
      // Don't allow removing yourself
      if (memberToRemove.user_id === user?.id) {
        toast.error("You cannot remove yourself from the team");
        return;
      }

      const { error } = await supabase
        .from('user_roles')
        .delete()
        .eq('id', memberToRemove.id);

      if (error) throw error;

      toast.success('Team member removed');
      setMemberToRemove(null);
      fetchTeamData();
    } catch (error: any) {
      console.error('Error removing member:', error);
      toast.error(error.message || 'Failed to remove member');
    }
  };

  const handleDeactivateMember = async () => {
    if (!memberToDeactivate) return;

    try {
      const newStatus = memberToDeactivate.profile?.is_active !== false;
      
      const { error } = await supabase
        .from('profiles')
        .update({ is_active: !newStatus })
        .eq('id', memberToDeactivate.user_id);

      if (error) throw error;

      toast.success(newStatus ? 'Team member deactivated' : 'Team member activated');
      setMemberToDeactivate(null);
      fetchTeamData();
    } catch (error: any) {
      console.error('Error updating member status:', error);
      toast.error(error.message || 'Failed to update member status');
    }
  };

  const handleCancelInvite = async () => {
    if (!inviteToCancel) return;

    try {
      const { error } = await supabase
        .from('team_invitations')
        .update({ status: 'cancelled' })
        .eq('id', inviteToCancel.id);

      if (error) throw error;

      toast.success('Invitation cancelled');
      setInviteToCancel(null);
      fetchTeamData();
    } catch (error: any) {
      console.error('Error cancelling invite:', error);
      toast.error(error.message || 'Failed to cancel invitation');
    }
  };

  const handleChangeRole = async (memberId: string, newRole: 'owner' | 'manager' | 'recruiter') => {
    try {
      const { error } = await supabase
        .from('user_roles')
        .update({ role: newRole })
        .eq('id', memberId);

      if (error) throw error;

      toast.success('Role updated successfully');
      fetchTeamData();
    } catch (error: any) {
      console.error('Error updating role:', error);
      toast.error(error.message || 'Failed to update role');
    }
  };

  const handleResendInvite = async (invitation: TeamInvitation) => {
    try {
      const { error } = await supabase.functions.invoke('send-team-invitation', {
        body: {
          email: invitation.email,
          role: invitation.role,
          token: invitation.token, // resend the original token so the link stays valid
          tenant_id: tenantId,
          invited_by_name: profile?.full_name || 'Your team'
        }
      });

      if (error) throw error;
      toast.success(`Invitation resent to ${invitation.email}`);
    } catch (error: any) {
      console.error('Error resending invite:', error);
      toast.error(error.message || 'Failed to resend invitation');
    }
  };

  const filteredMembers = teamMembers.filter(m => 
    m.profile?.full_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    m.profile?.email.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const getRoleBadgeVariant = (role: string): "default" | "secondary" | "outline" => {
    switch (role) {
      case 'owner': return 'default';
      case 'manager': return 'secondary';
      case 'recruiter': return 'outline';
      default: return 'outline';
    }
  };

  return (
    <AppLayout title="Team Members" subtitle="Manage your recruitment team">
      <div className="space-y-6">
        {/* Header Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-primary/10 rounded-lg">
                  <Users className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Team Members</p>
                  <p className="text-2xl font-bold">{teamMembers.length}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-warning/10 rounded-lg">
                  <Clock className="h-5 w-5 text-warning" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Pending Invites</p>
                  <p className="text-2xl font-bold">{invitations.length}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-success/10 rounded-lg">
                  <UserCheck className="h-5 w-5 text-success" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Active</p>
                  <p className="text-2xl font-bold">{teamMembers.filter(m => m.profile?.is_active !== false).length}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-accent/10 rounded-lg">
                  <Shield className="h-5 w-5 text-accent" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Seats Available</p>
                  <p className="text-2xl font-bold">{Math.max(0, teamLimit - teamMembers.length - invitations.length)}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Plan Info Banner */}
        {teamMembers.length + invitations.length >= teamLimit && teamLimit < 999 && (
          <Card className="border-warning/50 bg-warning/5">
            <CardContent className="p-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <AlertCircle className="h-5 w-5 text-warning" />
                <div>
                  <p className="font-medium">Team limit reached</p>
                  <p className="text-sm text-muted-foreground">
                    Your {planName} plan allows {teamLimit} team members. Upgrade for more seats.
                  </p>
                </div>
              </div>
              <Button variant="outline" onClick={() => window.location.href = '/billing'}>
                Upgrade Plan
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Search and Actions */}
        <div className="flex flex-col sm:flex-row gap-4 justify-between">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search team members..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={fetchTeamData}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Refresh
            </Button>
            {canManageTeam && (
              <Button onClick={() => setShowInviteDialog(true)}>
                <UserPlus className="h-4 w-4 mr-2" />
                Invite Member
              </Button>
            )}
          </div>
        </div>

        {/* Tabs */}
        <Tabs defaultValue="members">
          <TabsList>
            <TabsTrigger value="members">
              <Users className="h-4 w-4 mr-2" />
              Members ({teamMembers.length})
            </TabsTrigger>
            <TabsTrigger value="invitations">
              <Mail className="h-4 w-4 mr-2" />
              Pending Invites ({invitations.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="members" className="mt-4">
            <Card>
              <CardContent className="p-0">
                {isLoading ? (
                  <div className="p-8 text-center text-muted-foreground">Loading team members...</div>
                ) : filteredMembers.length === 0 ? (
                  <div className="p-8 text-center text-muted-foreground">
                    {searchQuery ? 'No members match your search' : 'No team members yet'}
                  </div>
                ) : (
                  <div className="divide-y">
                    {filteredMembers.map((member, index) => (
                      <motion.div
                        key={member.id}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: index * 0.05 }}
                        className="p-4 flex items-center justify-between hover:bg-muted/50 transition-colors"
                      >
                        <div className="flex items-center gap-4">
                          <Avatar className="h-10 w-10">
                            <AvatarImage src={member.profile?.avatar_url || undefined} />
                            <AvatarFallback>
                              {member.profile?.full_name?.charAt(0) || member.profile?.email.charAt(0).toUpperCase()}
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <div className="flex items-center gap-2">
                              <p className="font-medium">{member.profile?.full_name || 'Unnamed'}</p>
                              {member.user_id === user?.id && (
                                <Badge variant="secondary" className="text-xs">You</Badge>
                              )}
                              {member.profile?.is_active === false && (
                                <Badge variant="destructive" className="text-xs">Inactive</Badge>
                              )}
                            </div>
                            <p className="text-sm text-muted-foreground">{member.profile?.email}</p>
                            {member.profile?.job_title && (
                              <p className="text-xs text-muted-foreground">{member.profile.job_title}</p>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <Badge variant={getRoleBadgeVariant(member.role)}>
                            {member.role === 'owner' && <Crown className="h-3 w-3 mr-1" />}
                            {ROLE_LABELS[member.role] || member.role}
                          </Badge>
                          {member.profile?.last_login_at && (
                            <span className="text-xs text-muted-foreground hidden md:block">
                              Last login: {format(new Date(member.profile.last_login_at), 'MMM d, yyyy')}
                            </span>
                          )}
                          {canManageTeam && member.user_id !== user?.id && (
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon">
                                  <MoreVertical className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                {isOwner && member.role === 'recruiter' && (
                                  <>
                                    <DropdownMenuItem onClick={() => setMemberForCredits(member)}>
                                      <Sparkles className="h-4 w-4 mr-2" />
                                      Assign AI Credits
                                    </DropdownMenuItem>
                                    <DropdownMenuSeparator />
                                  </>
                                )}
                                {isOwner && (
                                  <>
                                    <DropdownMenuItem onClick={() => setMemberForPermissions(member)}>
                                      <Settings className="h-4 w-4 mr-2" />
                                      Manage Permissions
                                    </DropdownMenuItem>
                                    <DropdownMenuSeparator />
                                  </>
                                )}
                                <DropdownMenuItem onClick={() => handleChangeRole(member.id, 'manager')}>
                                  Make Manager
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => handleChangeRole(member.id, 'recruiter')}>
                                  Make Recruiter
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem onClick={() => setMemberToDeactivate(member)}>
                                  {member.profile?.is_active === false ? (
                                    <><UserCheck className="h-4 w-4 mr-2" /> Activate</>
                                  ) : (
                                    <><UserX className="h-4 w-4 mr-2" /> Deactivate</>
                                  )}
                                </DropdownMenuItem>
                                <DropdownMenuItem 
                                  onClick={() => setMemberToRemove(member)}
                                  className="text-destructive"
                                >
                                  <Trash2 className="h-4 w-4 mr-2" /> Remove
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          )}
                        </div>
                      </motion.div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="invitations" className="mt-4">
            <Card>
              <CardContent className="p-0">
                {invitations.length === 0 ? (
                  <div className="p-8 text-center text-muted-foreground">
                    No pending invitations
                  </div>
                ) : (
                  <div className="divide-y">
                    {invitations.map((invite, index) => (
                      <motion.div
                        key={invite.id}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: index * 0.05 }}
                        className="p-4 flex items-center justify-between hover:bg-muted/50 transition-colors"
                      >
                        <div className="flex items-center gap-4">
                          <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center">
                            <Mail className="h-5 w-5 text-muted-foreground" />
                          </div>
                          <div>
                            <p className="font-medium">{invite.email}</p>
                            <p className="text-sm text-muted-foreground">
                              Expires: {format(new Date(invite.expires_at), 'MMM d, yyyy')}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <Badge variant="outline">{ROLE_LABELS[invite.role] || invite.role}</Badge>
                          {canManageTeam && (
                            <div className="flex gap-2">
                              <Button variant="ghost" size="sm" onClick={() => handleResendInvite(invite)}>
                                Resend
                              </Button>
                              <Button 
                                variant="ghost" 
                                size="sm"
                                onClick={() => setInviteToCancel(invite)}
                                className="text-destructive"
                              >
                                Cancel
                              </Button>
                            </div>
                          )}
                        </div>
                      </motion.div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Invite Dialog */}
        <Dialog open={showInviteDialog} onOpenChange={setShowInviteDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Invite Team Member</DialogTitle>
              <DialogDescription>
                Send an invitation to add a new member to your recruitment team.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Email Address</label>
                <Input
                  type="email"
                  placeholder="colleague@company.com"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Role</label>
                <Select value={inviteRole} onValueChange={setInviteRole}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="manager">
                      <div className="flex flex-col">
                        <span>Manager</span>
                        <span className="text-xs text-muted-foreground">View team KPIs & reports</span>
                      </div>
                    </SelectItem>
                    <SelectItem value="recruiter">
                      <div className="flex flex-col">
                        <span>Recruiter</span>
                        <span className="text-xs text-muted-foreground">Assigned jobs & candidates only</span>
                      </div>
                    </SelectItem>
                    <SelectItem value="viewer">
                      <div className="flex flex-col">
                        <span>Viewer</span>
                        <span className="text-xs text-muted-foreground">Read-only access</span>
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="rounded-lg bg-muted/50 p-3 text-sm">
                <p className="font-medium mb-1">Role Permissions:</p>
                <ul className="list-disc list-inside text-muted-foreground space-y-1">
                  <li><strong>Owner:</strong> Full access to all features, billing, team management</li>
                  <li><strong>Manager:</strong> View team KPIs, reports, manage candidates & jobs</li>
                  <li><strong>Recruiter:</strong> Work with assigned jobs and candidates only</li>
                  <li><strong>Viewer:</strong> View-only access, no editing capabilities</li>
                </ul>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowInviteDialog(false)}>
                Cancel
              </Button>
              <Button onClick={handleInviteMember} disabled={isInviting}>
                {isInviting ? 'Sending...' : 'Send Invitation'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Remove Member Dialog */}
        <AlertDialog open={!!memberToRemove} onOpenChange={() => setMemberToRemove(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Remove Team Member</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to remove {memberToRemove?.profile?.full_name || memberToRemove?.profile?.email} from your team? 
                They will lose access to all team data immediately.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={handleRemoveMember} className="bg-destructive text-destructive-foreground">
                Remove Member
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Deactivate Member Dialog */}
        <AlertDialog open={!!memberToDeactivate} onOpenChange={() => setMemberToDeactivate(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>
                {memberToDeactivate?.profile?.is_active === false ? 'Activate' : 'Deactivate'} Team Member
              </AlertDialogTitle>
              <AlertDialogDescription>
                {memberToDeactivate?.profile?.is_active === false 
                  ? `Are you sure you want to activate ${memberToDeactivate?.profile?.full_name || memberToDeactivate?.profile?.email}? They will regain access to the team.`
                  : `Are you sure you want to deactivate ${memberToDeactivate?.profile?.full_name || memberToDeactivate?.profile?.email}? They will temporarily lose access but their data will be preserved.`
                }
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={handleDeactivateMember}>
                {memberToDeactivate?.profile?.is_active === false ? 'Activate' : 'Deactivate'}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Cancel Invite Dialog */}
        <AlertDialog open={!!inviteToCancel} onOpenChange={() => setInviteToCancel(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Cancel Invitation</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to cancel the invitation to {inviteToCancel?.email}?
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Keep Invitation</AlertDialogCancel>
              <AlertDialogAction onClick={handleCancelInvite}>Cancel Invitation</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Assign AI Credits Dialog */}
        <AssignAICreditsDialog
          open={!!memberForCredits}
          onOpenChange={(open) => !open && setMemberForCredits(null)}
          member={memberForCredits}
          onSuccess={fetchTeamData}
        />

        {/* Manage Permissions Dialog */}
        {memberForPermissions && (
          <ManagePermissionsDialog
            open={!!memberForPermissions}
            onOpenChange={(open) => !open && setMemberForPermissions(null)}
            userId={memberForPermissions.user_id}
            userName={memberForPermissions.profile?.full_name || memberForPermissions.profile?.email || 'User'}
            userRole={ROLE_LABELS[memberForPermissions.role] || memberForPermissions.role}
            onUpdate={fetchTeamData}
          />
        )}
      </div>
    </AppLayout>
  );
}
