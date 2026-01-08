import { useState, useEffect } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
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
  AlertCircle,
  Upload,
  Image as ImageIcon,
  BarChart3,
  Smartphone,
  Key,
  ShieldCheck,
  XCircle
} from 'lucide-react';
import { MyUsageSection } from '@/components/usage/MyUsageSection';
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
import { InputOTP, InputOTPGroup, InputOTPSlot } from '@/components/ui/input-otp';

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
  const [isUploadingLogo, setIsUploadingLogo] = useState(false);
  const [logoSignedUrl, setLogoSignedUrl] = useState<string | null>(null);
  
  // 2FA State
  const [twoFactorEnabled, setTwoFactorEnabled] = useState(false);
  const [twoFactorPhone, setTwoFactorPhone] = useState('');
  const [showSetup2FA, setShowSetup2FA] = useState(false);
  const [verificationCode, setVerificationCode] = useState('');
  const [isSending2FACode, setIsSending2FACode] = useState(false);
  const [isVerifying2FA, setIsVerifying2FA] = useState(false);
  const [codeSent, setCodeSent] = useState(false);
  const [isDisabling2FA, setIsDisabling2FA] = useState(false);
  
  // Notification preferences state
  const [notificationPrefs, setNotificationPrefs] = useState({
    new_candidate: true,
    job_assignment: true,
    ai_match_complete: true,
    interview_reminder: true,
    offer_sent: true,
    candidate_hired: true,
    candidate_rejected: false,
    team_invitation: true,
    weekly_digest: true,
    email_notifications: true,
    in_app_notifications: true,
  });
  
  const [profileData, setProfileData] = useState({
    full_name: '',
    email: '',
    phone: '',
    job_title: '',
    avatar_url: '',
    linkedin_url: '',
    email_signature: '',
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
        email_signature: profile.email_signature || '',
      });

      // Load notification preferences if they exist
      try {
        const savedPrefs = (profile as any).notification_preferences;
        if (savedPrefs && typeof savedPrefs === 'object') {
          setNotificationPrefs({ ...notificationPrefs, ...savedPrefs });
        }
      } catch (error) {
        console.log('No saved notification preferences');
      }
      
      // Load 2FA status
      const twoFA = (profile as any).two_factor_enabled;
      const twoFAPhone = (profile as any).two_factor_phone;
      setTwoFactorEnabled(!!twoFA);
      setTwoFactorPhone(twoFAPhone || '');
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

        // Generate signed URL for logo if it exists (stored as file path)
        if (data.logo_url) {
          const { data: signedData } = await supabase.storage
            .from('documents')
            .createSignedUrl(data.logo_url, 60 * 60 * 24 * 365); // 1 year
          if (signedData?.signedUrl) {
            setLogoSignedUrl(signedData.signedUrl);
          }
        } else {
          setLogoSignedUrl(null);
        }
        
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
          email_signature: profileData.email_signature || null,
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

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !tenantId) return;

    if (file.size > 5 * 1024 * 1024) {
      toast.error('Logo must be less than 5MB');
      return;
    }

    if (!file.type.startsWith('image/')) {
      toast.error('Please upload an image file');
      return;
    }

    setIsUploadingLogo(true);
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${tenantId}/logo-${Date.now()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from('documents')
        .upload(fileName, file, { upsert: true });

      if (uploadError) throw uploadError;

      // Store the file path (not public URL) in database
      setTenantData({ ...tenantData, logo_url: fileName });

      // Generate signed URL for immediate display
      const { data: signedData } = await supabase.storage
        .from('documents')
        .createSignedUrl(fileName, 60 * 60 * 24 * 365); // 1 year
      
      if (signedData?.signedUrl) {
        setLogoSignedUrl(signedData.signedUrl);
      }

      // Auto-save the file path to database
      const { error: updateError } = await supabase
        .from('tenants')
        .update({ logo_url: fileName })
        .eq('id', tenantId);

      if (updateError) throw updateError;
      toast.success('Logo uploaded successfully');
    } catch (error: any) {
      console.error('Error uploading logo:', error);
      toast.error(error.message || 'Failed to upload logo');
    } finally {
      setIsUploadingLogo(false);
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

  const handleSaveNotifications = async () => {
    if (!profile?.id) return;
    
    setIsSaving(true);
    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          notification_preferences: notificationPrefs,
        })
        .eq('id', profile.id);

      if (error) throw error;
      
      await refreshProfile();
      toast.success('Notification preferences updated');
    } catch (error: any) {
      console.error('Error updating notifications:', error);
      toast.error(error.message || 'Failed to update preferences');
    } finally {
      setIsSaving(false);
    }
  };

  // 2FA Functions
  const handleSend2FACode = async () => {
    if (!twoFactorPhone.trim()) {
      toast.error('Please enter a valid phone number');
      return;
    }
    
    // Validate phone format (basic validation)
    const phoneRegex = /^\+?[1-9]\d{6,14}$/;
    const cleanedPhone = twoFactorPhone.replace(/[\s\-\(\)]/g, '');
    if (!phoneRegex.test(cleanedPhone)) {
      toast.error('Please enter a valid phone number with country code (e.g., +1234567890)');
      return;
    }

    setIsSending2FACode(true);
    try {
      // Generate a 6-digit code
      const code = Math.floor(100000 + Math.random() * 900000).toString();
      
      // Store the code temporarily (in a real app, this would be sent via SMS)
      // For now, we'll store it in localStorage for demo purposes
      // In production, you'd use Twilio or similar SMS service
      localStorage.setItem('temp_2fa_code', code);
      localStorage.setItem('temp_2fa_phone', cleanedPhone);
      localStorage.setItem('temp_2fa_expires', (Date.now() + 5 * 60 * 1000).toString()); // 5 minutes
      
      // In production, send SMS here via edge function
      console.log(`[DEV] 2FA Code: ${code} sent to ${cleanedPhone}`);
      
      setCodeSent(true);
      toast.success(`Verification code sent to ${twoFactorPhone}. (Dev mode: check console)`);
    } catch (error: any) {
      console.error('Error sending 2FA code:', error);
      toast.error(error.message || 'Failed to send verification code');
    } finally {
      setIsSending2FACode(false);
    }
  };

  const handleVerify2FA = async () => {
    if (!verificationCode || verificationCode.length !== 6) {
      toast.error('Please enter a valid 6-digit code');
      return;
    }

    setIsVerifying2FA(true);
    try {
      const storedCode = localStorage.getItem('temp_2fa_code');
      const storedPhone = localStorage.getItem('temp_2fa_phone');
      const expires = parseInt(localStorage.getItem('temp_2fa_expires') || '0');

      if (Date.now() > expires) {
        toast.error('Verification code has expired. Please request a new one.');
        setCodeSent(false);
        setVerificationCode('');
        return;
      }

      if (verificationCode !== storedCode) {
        toast.error('Invalid verification code. Please try again.');
        return;
      }

      // Save 2FA settings to profile
      const { error } = await supabase
        .from('profiles')
        .update({
          two_factor_enabled: true,
          two_factor_phone: storedPhone,
        } as any)
        .eq('id', profile?.id);

      if (error) throw error;

      // Clear temp storage
      localStorage.removeItem('temp_2fa_code');
      localStorage.removeItem('temp_2fa_phone');
      localStorage.removeItem('temp_2fa_expires');

      setTwoFactorEnabled(true);
      setTwoFactorPhone(storedPhone || '');
      setShowSetup2FA(false);
      setCodeSent(false);
      setVerificationCode('');
      
      await refreshProfile();
      toast.success('Two-factor authentication enabled successfully!');
    } catch (error: any) {
      console.error('Error enabling 2FA:', error);
      toast.error(error.message || 'Failed to enable 2FA');
    } finally {
      setIsVerifying2FA(false);
    }
  };

  const handleDisable2FA = async () => {
    setIsDisabling2FA(true);
    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          two_factor_enabled: false,
          two_factor_phone: null,
        } as any)
        .eq('id', profile?.id);

      if (error) throw error;

      setTwoFactorEnabled(false);
      setTwoFactorPhone('');
      await refreshProfile();
      toast.success('Two-factor authentication disabled');
    } catch (error: any) {
      console.error('Error disabling 2FA:', error);
      toast.error(error.message || 'Failed to disable 2FA');
    } finally {
      setIsDisabling2FA(false);
    }
  };

  const getRoleBadgeColor = (role: string) => {
    switch (role) {
      case 'owner':
        return 'bg-warning/10 text-warning border-warning/30';
      case 'manager':
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
          <TabsList className="mb-6 grid w-full grid-cols-4 lg:grid-cols-7 h-auto gap-1 p-1">
            <TabsTrigger value="profile" className="gap-1.5 text-xs sm:text-sm px-2 py-2">
              <User className="h-4 w-4 flex-shrink-0" />
              <span className="hidden sm:inline">Profile</span>
            </TabsTrigger>
            <TabsTrigger value="team" className="gap-1.5 text-xs sm:text-sm px-2 py-2">
              <Users className="h-4 w-4 flex-shrink-0" />
              <span className="hidden sm:inline">Team</span>
            </TabsTrigger>
            <TabsTrigger value="email" className="gap-1.5 text-xs sm:text-sm px-2 py-2">
              <Mail className="h-4 w-4 flex-shrink-0" />
              <span className="hidden sm:inline">Email</span>
            </TabsTrigger>
            <TabsTrigger value="organization" className="gap-1.5 text-xs sm:text-sm px-2 py-2">
              <Building2 className="h-4 w-4 flex-shrink-0" />
              <span className="hidden sm:inline">Org</span>
            </TabsTrigger>
            <TabsTrigger value="notifications" className="gap-1.5 text-xs sm:text-sm px-2 py-2">
              <Bell className="h-4 w-4 flex-shrink-0" />
              <span className="hidden sm:inline">Alerts</span>
            </TabsTrigger>
            <TabsTrigger value="usage" className="gap-1.5 text-xs sm:text-sm px-2 py-2">
              <BarChart3 className="h-4 w-4 flex-shrink-0" />
              <span className="hidden sm:inline">Usage</span>
            </TabsTrigger>
            <TabsTrigger value="security" className="gap-1.5 text-xs sm:text-sm px-2 py-2">
              <Shield className="h-4 w-4 flex-shrink-0" />
              <span className="hidden sm:inline">Security</span>
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

                  <Separator className="my-6" />

                  {/* Email Signature Section */}
                  <div className="space-y-4">
                    <div>
                      <h3 className="text-lg font-medium">Email Signature</h3>
                      <p className="text-sm text-muted-foreground">
                        This signature will be automatically added to your outgoing emails
                      </p>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="email_signature">Signature</Label>
                      <Textarea
                        id="email_signature"
                        value={profileData.email_signature}
                        onChange={(e) => setProfileData({ ...profileData, email_signature: e.target.value })}
                        placeholder="Best regards,&#10;John Doe&#10;Senior Recruiter&#10;+1 (555) 123-4567"
                        rows={5}
                        className="font-mono text-sm"
                      />
                      <p className="text-xs text-muted-foreground">
                        Tip: Use line breaks to format your signature. HTML is supported.
                      </p>
                    </div>
                    {profileData.email_signature && (
                      <div className="p-4 rounded-lg bg-muted/50 border">
                        <p className="text-xs text-muted-foreground mb-2">Preview:</p>
                        <div 
                          className="text-sm whitespace-pre-wrap"
                          dangerouslySetInnerHTML={{ __html: profileData.email_signature.replace(/\n/g, '<br>') }}
                        />
                      </div>
                    )}
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
                              {member.role === 'owner' && <Crown className="h-3 w-3 mr-1" />}
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

          <TabsContent value="email">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3 }}
            >
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Mail className="h-5 w-5 text-primary" />
                    Email Integration
                  </CardTitle>
                  <CardDescription>
                    Configure your email accounts to send emails from your own address
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="text-center py-8">
                    <Mail className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                    <h3 className="font-semibold mb-2">Email Account Configuration</h3>
                    <p className="text-muted-foreground mb-4 max-w-md mx-auto">
                      Set up your email accounts (SMTP or Gmail) to send personalized emails from your own address to candidates.
                    </p>
                    <Button 
                      onClick={() => window.location.href = '/email/accounts'}
                      className="gap-2"
                    >
                      <Mail className="h-4 w-4" />
                      Manage Email Accounts
                    </Button>
                  </div>
                  
                  <Separator />
                  
                  <div className="space-y-4">
                    <h4 className="font-medium">Email Signature</h4>
                    <p className="text-sm text-muted-foreground">
                      Your default email signature will be appended to all outgoing emails.
                    </p>
                    <Textarea
                      value={profileData.email_signature}
                      onChange={(e) => setProfileData({ ...profileData, email_signature: e.target.value })}
                      placeholder="Best regards,&#10;Your Name&#10;Your Title&#10;your@email.com"
                      className="min-h-[120px]"
                    />
                    <div className="flex justify-end">
                      <Button onClick={handleSaveProfile} disabled={isSaving} size="sm">
                        {isSaving ? (
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        ) : (
                          <Save className="h-4 w-4 mr-2" />
                        )}
                        Save Signature
                      </Button>
                    </div>
                  </div>
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
                      <Label>Company Logo</Label>
                      <div className="flex items-center gap-4">
                        <div className="relative h-20 w-20 rounded-lg border-2 border-dashed border-muted-foreground/30 flex items-center justify-center bg-muted/30 overflow-hidden">
                          {logoSignedUrl ? (
                            <img
                              src={logoSignedUrl}
                              alt="Company logo"
                              className="h-full w-full object-contain"
                            />
                          ) : (
                            <ImageIcon className="h-8 w-8 text-muted-foreground/50" />
                          )}
                        </div>
                        <div className="flex flex-col gap-2">
                          <label htmlFor="logo_upload" className="cursor-pointer">
                            <div className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-md text-sm font-medium hover:bg-primary/90 transition-colors">
                              {isUploadingLogo ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <Upload className="h-4 w-4" />
                              )}
                              {isUploadingLogo ? 'Uploading...' : 'Upload Logo'}
                            </div>
                            <input
                              id="logo_upload"
                              type="file"
                              accept="image/*"
                              onChange={handleLogoUpload}
                              className="hidden"
                              disabled={isUploadingLogo}
                            />
                          </label>
                          {tenantData.logo_url && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                setTenantData({ ...tenantData, logo_url: '' });
                                setLogoSignedUrl(null);
                              }}
                              className="text-xs"
                            >
                              <Trash2 className="h-3 w-3 mr-1" />
                              Remove
                            </Button>
                          )}
                          <p className="text-xs text-muted-foreground">PNG, JPG up to 5MB</p>
                        </div>
                      </div>
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
                    Choose how and when you want to receive notifications
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  {/* Email & In-App Toggle */}
                  <div className="space-y-4">
                    <h4 className="font-medium">Notification Channels</h4>
                    <div className="space-y-3">
                      <div className="flex items-center justify-between p-4 rounded-lg border">
                        <div>
                          <p className="font-medium">Email Notifications</p>
                          <p className="text-sm text-muted-foreground">Receive notifications via email</p>
                        </div>
                        <Switch
                          checked={notificationPrefs.email_notifications}
                          onCheckedChange={(checked) => 
                            setNotificationPrefs({ ...notificationPrefs, email_notifications: checked })
                          }
                        />
                      </div>
                      <div className="flex items-center justify-between p-4 rounded-lg border">
                        <div>
                          <p className="font-medium">In-App Notifications</p>
                          <p className="text-sm text-muted-foreground">Show notifications in the app</p>
                        </div>
                        <Switch
                          checked={notificationPrefs.in_app_notifications}
                          onCheckedChange={(checked) => 
                            setNotificationPrefs({ ...notificationPrefs, in_app_notifications: checked })
                          }
                        />
                      </div>
                    </div>
                  </div>

                  <Separator />

                  {/* Specific Notifications */}
                  <div className="space-y-4">
                    <h4 className="font-medium">Activity Notifications</h4>
                    <div className="space-y-3">
                      {[
                        { key: 'new_candidate', label: 'New Candidate Applications', description: 'When candidates apply to your jobs or are added' },
                        { key: 'job_assignment', label: 'Job Assignments', description: 'When you are assigned to a new job' },
                        { key: 'ai_match_complete', label: 'AI Match Results', description: 'When AI matching completes for a job' },
                        { key: 'interview_reminder', label: 'Interview Reminders', description: 'Reminders for upcoming interviews (24h and 1h before)' },
                        { key: 'offer_sent', label: 'Offer Notifications', description: 'When an offer is sent to a candidate' },
                        { key: 'candidate_hired', label: 'Hire Notifications', description: 'When a candidate is marked as hired' },
                        { key: 'candidate_rejected', label: 'Rejection Notifications', description: 'When a candidate is rejected' },
                        { key: 'team_invitation', label: 'Team Invitations', description: 'When new members are invited to the team' },
                      ].map((item) => (
                        <div key={item.key} className="flex items-center justify-between p-4 rounded-lg border hover:bg-muted/50 transition-colors">
                          <div>
                            <p className="font-medium">{item.label}</p>
                            <p className="text-sm text-muted-foreground">{item.description}</p>
                          </div>
                          <Switch
                            checked={notificationPrefs[item.key as keyof typeof notificationPrefs] as boolean}
                            onCheckedChange={(checked) => 
                              setNotificationPrefs({ ...notificationPrefs, [item.key]: checked })
                            }
                          />
                        </div>
                      ))}
                    </div>
                  </div>

                  <Separator />

                  {/* Digest Settings */}
                  <div className="space-y-4">
                    <h4 className="font-medium">Digest Settings</h4>
                    <div className="flex items-center justify-between p-4 rounded-lg border hover:bg-muted/50 transition-colors">
                      <div>
                        <p className="font-medium">Weekly Digest</p>
                        <p className="text-sm text-muted-foreground">Receive a weekly summary of all activities every Monday</p>
                      </div>
                      <Switch
                        checked={notificationPrefs.weekly_digest}
                        onCheckedChange={(checked) => 
                          setNotificationPrefs({ ...notificationPrefs, weekly_digest: checked })
                        }
                      />
                    </div>
                  </div>

                  <div className="flex justify-end pt-4">
                    <Button onClick={handleSaveNotifications} disabled={isSaving}>
                      {isSaving ? (
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      ) : (
                        <Save className="h-4 w-4 mr-2" />
                      )}
                      Save Preferences
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          </TabsContent>

          <TabsContent value="usage">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3 }}
            >
              <MyUsageSection />
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
                  {/* Password Section */}
                  <div className="p-4 rounded-lg border bg-muted/30">
                    <div className="flex items-center gap-3">
                      <Key className="h-5 w-5 text-success" />
                      <div>
                        <p className="font-medium">Password</p>
                        <p className="text-sm text-muted-foreground">Your password is securely stored</p>
                      </div>
                    </div>
                    <Button variant="outline" size="sm" className="mt-3">
                      Change Password
                    </Button>
                  </div>

                  {/* Two-Factor Authentication Section */}
                  <div className="p-4 rounded-lg border bg-muted/30">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        {twoFactorEnabled ? (
                          <ShieldCheck className="h-5 w-5 text-success" />
                        ) : (
                          <Smartphone className="h-5 w-5 text-muted-foreground" />
                        )}
                        <div>
                          <p className="font-medium">Two-Factor Authentication (SMS)</p>
                          <p className="text-sm text-muted-foreground">
                            {twoFactorEnabled 
                              ? `Enabled for ${twoFactorPhone.replace(/(\d{3})\d{4}(\d{3})/, '$1****$2')}`
                              : 'Protect your account with phone verification'}
                          </p>
                        </div>
                      </div>
                      {twoFactorEnabled && (
                        <Badge variant="outline" className="bg-success/10 text-success border-success/30">
                          Active
                        </Badge>
                      )}
                    </div>
                    
                    {!twoFactorEnabled ? (
                      <Button 
                        variant="default" 
                        size="sm" 
                        className="mt-3 gap-2"
                        onClick={() => setShowSetup2FA(true)}
                      >
                        <Shield className="h-4 w-4" />
                        Enable 2FA
                      </Button>
                    ) : (
                      <Button 
                        variant="outline" 
                        size="sm" 
                        className="mt-3 gap-2 text-destructive hover:text-destructive"
                        onClick={handleDisable2FA}
                        disabled={isDisabling2FA}
                      >
                        {isDisabling2FA ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <XCircle className="h-4 w-4" />
                        )}
                        Disable 2FA
                      </Button>
                    )}
                  </div>
                  
                  {/* Security Tips */}
                  <div className="p-4 rounded-lg border border-accent/30 bg-accent/5">
                    <div className="flex items-start gap-3">
                      <Shield className="h-5 w-5 text-accent mt-0.5" />
                      <div>
                        <p className="font-medium text-accent">Security Recommendations</p>
                        <ul className="text-sm text-muted-foreground mt-2 space-y-1">
                          <li className="flex items-center gap-2">
                            {twoFactorEnabled ? (
                              <CheckCircle className="h-3.5 w-3.5 text-success" />
                            ) : (
                              <AlertCircle className="h-3.5 w-3.5 text-warning" />
                            )}
                            Enable two-factor authentication
                          </li>
                          <li className="flex items-center gap-2">
                            <CheckCircle className="h-3.5 w-3.5 text-success" />
                            Use a strong, unique password
                          </li>
                          <li className="flex items-center gap-2">
                            <CheckCircle className="h-3.5 w-3.5 text-success" />
                            Never share your login credentials
                          </li>
                        </ul>
                      </div>
                    </div>
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

      {/* 2FA Setup Dialog */}
      <Dialog open={showSetup2FA} onOpenChange={(open) => {
        setShowSetup2FA(open);
        if (!open) {
          setCodeSent(false);
          setVerificationCode('');
          setTwoFactorPhone('');
        }
      }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-accent" />
              Enable Two-Factor Authentication
            </DialogTitle>
            <DialogDescription>
              Add an extra layer of security to your account by enabling SMS verification.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            {!codeSent ? (
              <>
                <div className="space-y-2">
                  <Label htmlFor="twofa_phone">Phone Number</Label>
                  <div className="relative">
                    <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="twofa_phone"
                      type="tel"
                      placeholder="+1234567890"
                      value={twoFactorPhone}
                      onChange={(e) => setTwoFactorPhone(e.target.value)}
                      className="pl-10"
                    />
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Enter your phone number with country code (e.g., +1 for US)
                  </p>
                </div>
                
                <Button 
                  onClick={handleSend2FACode} 
                  disabled={isSending2FACode || !twoFactorPhone.trim()}
                  className="w-full gap-2"
                >
                  {isSending2FACode ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Smartphone className="h-4 w-4" />
                  )}
                  Send Verification Code
                </Button>
              </>
            ) : (
              <>
                <div className="text-center space-y-2">
                  <div className="p-3 rounded-full bg-success/10 w-fit mx-auto">
                    <CheckCircle className="h-6 w-6 text-success" />
                  </div>
                  <p className="text-sm text-muted-foreground">
                    We've sent a 6-digit code to <strong>{twoFactorPhone}</strong>
                  </p>
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="verification_code">Verification Code</Label>
                  <div className="flex justify-center">
                    <InputOTP 
                      maxLength={6} 
                      value={verificationCode}
                      onChange={(value) => setVerificationCode(value)}
                    >
                      <InputOTPGroup>
                        <InputOTPSlot index={0} />
                        <InputOTPSlot index={1} />
                        <InputOTPSlot index={2} />
                        <InputOTPSlot index={3} />
                        <InputOTPSlot index={4} />
                        <InputOTPSlot index={5} />
                      </InputOTPGroup>
                    </InputOTP>
                  </div>
                  <p className="text-xs text-muted-foreground text-center">
                    Enter the 6-digit code sent to your phone
                  </p>
                </div>
                
                <div className="flex gap-2">
                  <Button 
                    variant="outline"
                    onClick={() => {
                      setCodeSent(false);
                      setVerificationCode('');
                    }}
                    className="flex-1"
                  >
                    Change Number
                  </Button>
                  <Button 
                    onClick={handleVerify2FA}
                    disabled={isVerifying2FA || verificationCode.length !== 6}
                    className="flex-1 gap-2"
                  >
                    {isVerifying2FA ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <ShieldCheck className="h-4 w-4" />
                    )}
                    Verify & Enable
                  </Button>
                </div>
                
                <p className="text-xs text-center text-muted-foreground">
                  Didn't receive the code?{' '}
                  <button 
                    type="button"
                    onClick={handleSend2FACode}
                    className="text-accent hover:underline"
                    disabled={isSending2FACode}
                  >
                    Resend
                  </button>
                </p>
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
