import { useState, useEffect } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
  User, 
  Building2, 
  Bell, 
  Shield, 
  Save, 
  Loader2,
  Camera,
  Globe,
  Mail,
  Phone,
  MapPin,
  Linkedin,
  CheckCircle,
  Users,
  UserPlus,
  Trash2,
  Crown,
  AlertCircle
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth';
import { toast } from 'sonner';
import { motion } from 'framer-motion';
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

interface TeamMember {
  id: string;
  user_id: string;
  role: string;
  profile?: {
    full_name: string | null;
    email: string;
    avatar_url: string | null;
    job_title: string | null;
  };
}

interface PendingInvite {
  id: string;
  email: string;
  role: string;
  expires_at: string;
  created_at: string;
}

interface TenantWithPlan {
  subscription_plan_id: string | null;
  subscription_plans?: {
    max_users: number | null;
    name: string;
  } | null;
}

const TEAM_LIMITS: Record<string, number> = {
  'starter': 2,
  'pro': 5,
  'agency': 999, // Unlimited
  'enterprise': 999,
};

export default function SettingsPage() {
  const { profile, tenantId, user, refreshProfile } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  
  // Team management state
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [pendingInvites, setPendingInvites] = useState<PendingInvite[]>([]);
  const [teamLimit, setTeamLimit] = useState(1);
  const [planName, setPlanName] = useState('starter');
  const [showInviteDialog, setShowInviteDialog] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<string>('recruiter');
  const [isInviting, setIsInviting] = useState(false);
  const [memberToRemove, setMemberToRemove] = useState<TeamMember | null>(null);
  
  const [profileData, setProfileData] = useState({
    full_name: '',
    email: '',
    phone: '',
    job_title: '',
    avatar_url: '',
    linkedin_url: '',
  });

  const [tenantData, setTenantData] = useState({
    name: '',
    logo_url: '',
    primary_color: '#0ea5e9',
  });

  useEffect(() => {
    if (profile) {
      setProfileData({
        full_name: profile.full_name || '',
        email: profile.email || '',
        phone: profile.phone || '',
        job_title: profile.job_title || '',
        avatar_url: profile.avatar_url || '',
        linkedin_url: '',
      });
    }
    
    if (tenantId) {
      fetchTenantData();
      fetchTeamData();
    }
  }, [profile, tenantId]);

  const fetchTenantData = async () => {
    try {
      const { data, error } = await supabase
        .from('tenants')
        .select('name, logo_url, primary_color, subscription_plan_id')
        .eq('id', tenantId)
        .single();

      if (error) throw error;
      if (data) {
        setTenantData({
          name: data.name || '',
          logo_url: data.logo_url || '',
          primary_color: data.primary_color || '#0ea5e9',
        });
        
        // Fetch plan details if subscription_plan_id exists
        if (data.subscription_plan_id) {
          const { data: planData } = await supabase
            .from('subscription_plans')
            .select('max_users, name, slug')
            .eq('id', data.subscription_plan_id)
            .single();
          
          if (planData) {
            // Handle -1 as unlimited (999 for comparison purposes)
            const maxUsers = planData.max_users === -1 || planData.max_users === null 
              ? 999 
              : planData.max_users;
            setTeamLimit(maxUsers);
            setPlanName(planData.name.toLowerCase());
          }
        }
      }
    } catch (error) {
      console.error('Error fetching tenant:', error);
    }
  };

  const fetchTeamData = async () => {
    setIsLoading(true);
    try {
      // Fetch team members (user_roles with profiles)
      const { data: rolesData, error: rolesError } = await supabase
        .from('user_roles')
        .select('id, user_id, role')
        .eq('tenant_id', tenantId);

      if (rolesError) throw rolesError;

      // Fetch profiles for each team member
      if (rolesData && rolesData.length > 0) {
        const userIds = rolesData.map(r => r.user_id);
        const { data: profilesData } = await supabase
          .from('profiles')
          .select('id, full_name, email, avatar_url, job_title')
          .in('id', userIds);

        const membersWithProfiles = rolesData.map(role => ({
          ...role,
          profile: profilesData?.find(p => p.id === role.user_id) || null
        }));

        setTeamMembers(membersWithProfiles as TeamMember[]);
      }

      // Fetch pending invites
      const { data: invitesData, error: invitesError } = await supabase
        .from('user_invites')
        .select('id, email, role, expires_at, created_at')
        .eq('tenant_id', tenantId)
        .is('accepted_at', null)
        .gt('expires_at', new Date().toISOString());

      if (invitesError) throw invitesError;
      setPendingInvites(invitesData || []);

    } catch (error) {
      console.error('Error fetching team data:', error);
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

    // Check team limit
    const currentCount = teamMembers.length + pendingInvites.length;
    if (currentCount >= teamLimit) {
      toast.error(`Team limit reached (${teamLimit} members). Upgrade your plan for more seats.`);
      return;
    }

    setIsInviting(true);
    try {
      const { error } = await supabase
        .from('user_invites')
        .insert({
          tenant_id: tenantId,
          email: inviteEmail.toLowerCase().trim(),
          role: inviteRole as any,
          invited_by: user?.id,
        });

      if (error) {
        if (error.code === '23505') {
          throw new Error('This email has already been invited');
        }
        throw error;
      }

      toast.success(`Invitation sent to ${inviteEmail}`);
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

  const handleCancelInvite = async (inviteId: string) => {
    try {
      const { error } = await supabase
        .from('user_invites')
        .delete()
        .eq('id', inviteId);

      if (error) throw error;

      toast.success('Invitation cancelled');
      fetchTeamData();
    } catch (error: any) {
      console.error('Error cancelling invite:', error);
      toast.error(error.message || 'Failed to cancel invitation');
    }
  };

  const handleSaveProfile = async () => {
    if (!profile?.id) return;
    
    setIsSaving(true);
    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          full_name: profileData.full_name,
          phone: profileData.phone || null,
          job_title: profileData.job_title || null,
          avatar_url: profileData.avatar_url || null,
        })
        .eq('id', profile.id);

      if (error) throw error;
      
      await refreshProfile();
      toast.success('Profile updated successfully');
    } catch (error: any) {
      console.error('Error updating profile:', error);
      toast.error(error.message || 'Failed to update profile');
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveOrganization = async () => {
    if (!tenantId) return;
    
    setIsSaving(true);
    try {
      const { error } = await supabase
        .from('tenants')
        .update({
          name: tenantData.name,
          logo_url: tenantData.logo_url || null,
          primary_color: tenantData.primary_color,
        })
        .eq('id', tenantId);

      if (error) throw error;
      toast.success('Organization settings updated');
    } catch (error: any) {
      console.error('Error updating tenant:', error);
      toast.error(error.message || 'Failed to update organization');
    } finally {
      setIsSaving(false);
    }
  };

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !profile?.id) return;

    if (file.size > 5 * 1024 * 1024) {
      toast.error('Image must be less than 5MB');
      return;
    }

    try {
      const fileExt = file.name.split('.').pop();
      const filePath = `avatars/${profile.id}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from('documents')
        .upload(filePath, file, { upsert: true });

      if (uploadError) throw uploadError;

      // Create a signed URL for private bucket access
      const { data: signedData, error: signedError } = await supabase.storage
        .from('documents')
        .createSignedUrl(filePath, 60 * 60 * 24 * 365); // 1 year expiry

      if (signedError) throw signedError;

      setProfileData({ ...profileData, avatar_url: signedData.signedUrl });
      toast.success('Avatar uploaded. Click Save to apply.');
    } catch (error: any) {
      console.error('Error uploading avatar:', error);
      toast.error('Failed to upload avatar');
    }
  };

  const validateLinkedInUrl = (url: string): boolean => {
    if (!url) return true;
    const linkedinRegex = /^(https?:\/\/)?(www\.)?linkedin\.com\/(in|company)\/[\w-]+\/?$/;
    return linkedinRegex.test(url);
  };

  const getRoleBadgeColor = (role: string) => {
    switch (role) {
      case 'admin':
      case 'super_admin':
        return 'bg-warning/10 text-warning border-warning/30';
      case 'recruiter':
        return 'bg-accent/10 text-accent border-accent/30';
      case 'support':
        return 'bg-info/10 text-info border-info/30';
      default:
        return 'bg-muted text-muted-foreground';
    }
  };

  return (
    <AppLayout title="Settings" subtitle="Manage your profile, team, and organization settings">
      <div className="max-w-4xl mx-auto">
        <Tabs defaultValue="profile" className="w-full">
          <TabsList className="mb-6 flex-wrap">
            <TabsTrigger value="profile" className="gap-2">
              <User className="h-4 w-4" />
              Profile
            </TabsTrigger>
            <TabsTrigger value="team" className="gap-2">
              <Users className="h-4 w-4" />
              Team
            </TabsTrigger>
            <TabsTrigger value="organization" className="gap-2">
              <Building2 className="h-4 w-4" />
              Organization
            </TabsTrigger>
            <TabsTrigger value="notifications" className="gap-2">
              <Bell className="h-4 w-4" />
              Notifications
            </TabsTrigger>
            <TabsTrigger value="security" className="gap-2">
              <Shield className="h-4 w-4" />
              Security
            </TabsTrigger>
          </TabsList>

          <TabsContent value="profile">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3 }}
            >
              <Card>
                <CardHeader>
                  <CardTitle>Personal Information</CardTitle>
                  <CardDescription>
                    Update your personal details and profile picture
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  {/* Avatar Section */}
                  <div className="flex items-center gap-6">
                    <div className="relative">
                      <Avatar className="h-24 w-24">
                        <AvatarImage src={profileData.avatar_url} />
                        <AvatarFallback className="text-2xl bg-accent/10 text-accent">
                          {profileData.full_name?.split(' ').map(n => n[0]).join('').toUpperCase() || 'U'}
                        </AvatarFallback>
                      </Avatar>
                      <label 
                        htmlFor="avatar-upload"
                        className="absolute bottom-0 right-0 p-1.5 bg-accent text-accent-foreground rounded-full cursor-pointer hover:bg-accent/90 transition-colors"
                      >
                        <Camera className="h-4 w-4" />
                        <input
                          id="avatar-upload"
                          type="file"
                          accept="image/jpeg,image/png,image/webp"
                          className="hidden"
                          onChange={handleAvatarUpload}
                        />
                      </label>
                    </div>
                    <div>
                      <h3 className="font-medium">{profileData.full_name || 'Your Name'}</h3>
                      <p className="text-sm text-muted-foreground">{profileData.email}</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        JPEG, PNG or WebP. Max 5MB.
                      </p>
                    </div>
                  </div>

                  <Separator />

                  {/* Form Fields */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="full_name">Full Name</Label>
                      <Input
                        id="full_name"
                        value={profileData.full_name}
                        onChange={(e) => setProfileData({ ...profileData, full_name: e.target.value })}
                        placeholder="John Doe"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="email">Email Address</Label>
                      <Input
                        id="email"
                        type="email"
                        value={profileData.email}
                        disabled
                        className="bg-muted"
                      />
                      <p className="text-xs text-muted-foreground">Email cannot be changed</p>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="phone">Phone Number</Label>
                      <div className="relative">
                        <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                          id="phone"
                          value={profileData.phone}
                          onChange={(e) => setProfileData({ ...profileData, phone: e.target.value })}
                          placeholder="+1 (555) 123-4567"
                          className="pl-10"
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="job_title">Job Title</Label>
                      <Input
                        id="job_title"
                        value={profileData.job_title}
                        onChange={(e) => setProfileData({ ...profileData, job_title: e.target.value })}
                        placeholder="Senior Recruiter"
                      />
                    </div>

                    <div className="space-y-2 md:col-span-2">
                      <Label htmlFor="linkedin_url">LinkedIn Profile</Label>
                      <div className="relative">
                        <Linkedin className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                          id="linkedin_url"
                          value={profileData.linkedin_url}
                          onChange={(e) => setProfileData({ ...profileData, linkedin_url: e.target.value })}
                          placeholder="https://linkedin.com/in/yourprofile"
                          className="pl-10"
                        />
                      </div>
                      {profileData.linkedin_url && !validateLinkedInUrl(profileData.linkedin_url) && (
                        <p className="text-xs text-destructive">Please enter a valid LinkedIn URL</p>
                      )}
                    </div>
                  </div>

                  <div className="flex justify-end pt-4">
                    <Button onClick={handleSaveProfile} disabled={isSaving}>
                      {isSaving ? (
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      ) : (
                        <Save className="h-4 w-4 mr-2" />
                      )}
                      Save Changes
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          </TabsContent>

          <TabsContent value="team">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3 }}
              className="space-y-6"
            >
              {/* Plan Info */}
              <Card>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle>Team Members</CardTitle>
                      <CardDescription>
                        Manage your team and invite new members
                      </CardDescription>
                    </div>
                    <Button onClick={() => setShowInviteDialog(true)} className="gap-2">
                      <UserPlus className="h-4 w-4" />
                      Invite Member
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  {/* Team Limit Info */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                    <div className="flex items-center justify-between p-4 rounded-lg bg-muted/50">
                      <div className="flex items-center gap-3">
                        <div className="p-2 rounded-lg bg-accent/10">
                          <Users className="h-5 w-5 text-accent" />
                        </div>
                        <div>
                          <p className="font-medium">Team Seats</p>
                          <p className="text-sm text-muted-foreground">
                            {teamMembers.length + pendingInvites.length} / {teamLimit >= 999 ? 'Unlimited' : teamLimit} used
                          </p>
                        </div>
                      </div>
                      <Badge variant="outline" className="capitalize">
                        {planName} Plan
                      </Badge>
                    </div>
                    
                    {/* Plan Team Limits */}
                    <div className="p-4 rounded-lg border bg-background">
                      <p className="font-medium text-sm mb-3">Team Limits by Plan</p>
                      <div className="grid grid-cols-3 gap-2 text-center">
                        <div className={`p-2 rounded-lg ${planName === 'starter' ? 'bg-accent/10 border border-accent/30' : 'bg-muted/50'}`}>
                          <p className="text-lg font-bold">2</p>
                          <p className="text-xs text-muted-foreground">Starter</p>
                        </div>
                        <div className={`p-2 rounded-lg ${planName === 'pro' ? 'bg-accent/10 border border-accent/30' : 'bg-muted/50'}`}>
                          <p className="text-lg font-bold">5</p>
                          <p className="text-xs text-muted-foreground">Pro</p>
                        </div>
                        <div className={`p-2 rounded-lg ${planName === 'agency' || planName === 'enterprise' ? 'bg-accent/10 border border-accent/30' : 'bg-muted/50'}`}>
                          <p className="text-lg font-bold">∞</p>
                          <p className="text-xs text-muted-foreground">Agency</p>
                        </div>
                      </div>
                    </div>
                  </div>
                  
                  {/* Team Limit Warning */}
                  {teamLimit < 999 && (teamMembers.length + pendingInvites.length) >= teamLimit && (
                    <div className="flex items-center gap-3 p-4 rounded-lg bg-warning/10 border border-warning/30 mb-6">
                      <AlertCircle className="h-5 w-5 text-warning flex-shrink-0" />
                      <div>
                        <p className="font-medium text-warning">Team limit reached</p>
                        <p className="text-sm text-muted-foreground">
                          Upgrade to {planName === 'starter' ? 'Pro (5 members)' : 'Agency (Unlimited members)'} to invite more team members.
                        </p>
                      </div>
                    </div>
                  )}

                  {/* Current Members */}
                  <div className="space-y-3">
                    <h4 className="font-medium text-sm text-muted-foreground">Active Members</h4>
                    {isLoading ? (
                      <div className="space-y-2">
                        {[1, 2].map(i => (
                          <div key={i} className="h-16 bg-muted animate-pulse rounded-lg" />
                        ))}
                      </div>
                    ) : teamMembers.length === 0 ? (
                      <p className="text-sm text-muted-foreground py-4">No team members yet</p>
                    ) : (
                      teamMembers.map((member) => (
                        <div
                          key={member.id}
                          className="flex items-center justify-between p-4 rounded-lg border"
                        >
                          <div className="flex items-center gap-3">
                            <Avatar className="h-10 w-10">
                              <AvatarImage src={member.profile?.avatar_url || ''} />
                              <AvatarFallback className="bg-accent/10 text-accent text-sm">
                                {member.profile?.full_name?.split(' ').map(n => n[0]).join('').toUpperCase() || 'U'}
                              </AvatarFallback>
                            </Avatar>
                            <div>
                              <div className="flex items-center gap-2">
                                <p className="font-medium">{member.profile?.full_name || 'Unknown'}</p>
                                {member.user_id === user?.id && (
                                  <Badge variant="secondary" className="text-xs">You</Badge>
                                )}
                              </div>
                              <p className="text-sm text-muted-foreground">{member.profile?.email}</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-3">
                            <Badge variant="outline" className={getRoleBadgeColor(member.role)}>
                              {member.role === 'admin' && <Crown className="h-3 w-3 mr-1" />}
                              {member.role}
                            </Badge>
                            {member.user_id !== user?.id && (
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-muted-foreground hover:text-destructive"
                                onClick={() => setMemberToRemove(member)}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            )}
                          </div>
                        </div>
                      ))
                    )}
                  </div>

                  {/* Pending Invites */}
                  {pendingInvites.length > 0 && (
                    <div className="space-y-3 mt-6">
                      <h4 className="font-medium text-sm text-muted-foreground">Pending Invitations</h4>
                      {pendingInvites.map((invite) => (
                        <div
                          key={invite.id}
                          className="flex items-center justify-between p-4 rounded-lg border border-dashed"
                        >
                          <div className="flex items-center gap-3">
                            <Avatar className="h-10 w-10">
                              <AvatarFallback className="bg-muted text-muted-foreground text-sm">
                                <Mail className="h-4 w-4" />
                              </AvatarFallback>
                            </Avatar>
                            <div>
                              <p className="font-medium">{invite.email}</p>
                              <p className="text-sm text-muted-foreground">
                                Expires {new Date(invite.expires_at).toLocaleDateString()}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-3">
                            <Badge variant="outline">{invite.role}</Badge>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-destructive hover:text-destructive"
                              onClick={() => handleCancelInvite(invite.id)}
                            >
                              Cancel
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Upgrade prompt - Only show for plans with limits */}
                  {teamLimit < 999 && (teamMembers.length + pendingInvites.length) >= teamLimit && (
                    <div className="mt-6 p-4 rounded-lg bg-warning/10 border border-warning/30">
                      <div className="flex items-start gap-3">
                        <AlertCircle className="h-5 w-5 text-warning mt-0.5" />
                        <div>
                          <p className="font-medium text-warning">Team limit reached</p>
                          <p className="text-sm text-muted-foreground mt-1">
                            {planName === 'starter' 
                              ? 'Upgrade to Pro (5 members) or Agency (Unlimited) to add more team members.'
                              : planName === 'pro'
                              ? 'Upgrade to Agency (Unlimited members) to add more team members.'
                              : 'Contact support to increase your team limit.'}
                          </p>
                          <Button variant="outline" size="sm" className="mt-3" onClick={() => window.location.href = '/billing'}>
                            View Plans
                          </Button>
                        </div>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </motion.div>
          </TabsContent>

          <TabsContent value="organization">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3 }}
            >
              <Card>
                <CardHeader>
                  <CardTitle>Organization Settings</CardTitle>
                  <CardDescription>
                    Manage your organization's branding and details
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="org_name">Organization Name</Label>
                      <Input
                        id="org_name"
                        value={tenantData.name}
                        onChange={(e) => setTenantData({ ...tenantData, name: e.target.value })}
                        placeholder="Acme Recruiting"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="org_logo">Logo URL</Label>
                      <Input
                        id="org_logo"
                        value={tenantData.logo_url}
                        onChange={(e) => setTenantData({ ...tenantData, logo_url: e.target.value })}
                        placeholder="https://example.com/logo.png"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="primary_color">Brand Color</Label>
                      <div className="flex gap-2">
                        <input
                          type="color"
                          id="primary_color"
                          value={tenantData.primary_color}
                          onChange={(e) => setTenantData({ ...tenantData, primary_color: e.target.value })}
                          className="h-10 w-16 rounded border cursor-pointer"
                        />
                        <Input
                          value={tenantData.primary_color}
                          onChange={(e) => setTenantData({ ...tenantData, primary_color: e.target.value })}
                          placeholder="#0ea5e9"
                          className="flex-1"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="flex justify-end pt-4">
                    <Button onClick={handleSaveOrganization} disabled={isSaving}>
                      {isSaving ? (
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      ) : (
                        <Save className="h-4 w-4 mr-2" />
                      )}
                      Save Organization
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          </TabsContent>

          <TabsContent value="notifications">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3 }}
            >
              <Card>
                <CardHeader>
                  <CardTitle>Notification Preferences</CardTitle>
                  <CardDescription>
                    Choose how you want to receive notifications
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {[
                      { label: 'New candidate applications', description: 'Get notified when candidates apply to your jobs' },
                      { label: 'AI match results', description: 'Receive updates when AI matching completes' },
                      { label: 'Interview reminders', description: 'Get reminded about upcoming interviews' },
                      { label: 'Weekly digest', description: 'Receive a weekly summary of activities' },
                    ].map((item, i) => (
                      <div key={i} className="flex items-center justify-between p-4 rounded-lg border">
                        <div>
                          <p className="font-medium">{item.label}</p>
                          <p className="text-sm text-muted-foreground">{item.description}</p>
                        </div>
                        <Badge variant="secondary">Coming Soon</Badge>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          </TabsContent>

          <TabsContent value="security">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3 }}
            >
              <Card>
                <CardHeader>
                  <CardTitle>Security Settings</CardTitle>
                  <CardDescription>
                    Manage your password and security preferences
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="p-4 rounded-lg border bg-muted/30">
                    <div className="flex items-center gap-3">
                      <CheckCircle className="h-5 w-5 text-success" />
                      <div>
                        <p className="font-medium">Password</p>
                        <p className="text-sm text-muted-foreground">Your password is securely stored</p>
                      </div>
                    </div>
                    <Button variant="outline" size="sm" className="mt-3">
                      Change Password
                    </Button>
                  </div>

                  <div className="p-4 rounded-lg border bg-muted/30">
                    <div className="flex items-center gap-3">
                      <Shield className="h-5 w-5 text-muted-foreground" />
                      <div>
                        <p className="font-medium">Two-Factor Authentication</p>
                        <p className="text-sm text-muted-foreground">Add an extra layer of security</p>
                      </div>
                    </div>
                    <Badge variant="secondary" className="mt-3">Coming Soon</Badge>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          </TabsContent>
        </Tabs>
      </div>

      {/* Invite Dialog */}
      <Dialog open={showInviteDialog} onOpenChange={setShowInviteDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Invite Team Member</DialogTitle>
            <DialogDescription>
              Send an invitation to join your team. They'll receive an email with a link to join.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="invite_email">Email Address</Label>
              <Input
                id="invite_email"
                type="email"
                placeholder="colleague@company.com"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="invite_role">Role</Label>
              <Select value={inviteRole} onValueChange={setInviteRole}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="recruiter">Recruiter</SelectItem>
                  <SelectItem value="admin">Admin</SelectItem>
                  <SelectItem value="viewer">Viewer</SelectItem>
                  <SelectItem value="support">Support</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowInviteDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleInviteMember} disabled={isInviting}>
              {isInviting ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Mail className="h-4 w-4 mr-2" />
              )}
              Send Invitation
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Remove Member Confirmation */}
      <AlertDialog open={!!memberToRemove} onOpenChange={() => setMemberToRemove(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove Team Member</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to remove {memberToRemove?.profile?.full_name || 'this member'} from your team?
              They will lose access to all team resources.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleRemoveMember}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Remove Member
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppLayout>
  );
}
