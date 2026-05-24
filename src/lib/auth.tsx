import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';

interface Profile {
  id: string;
  tenant_id: string | null;
  email: string;
  full_name: string | null;
  avatar_url: string | null;
  phone: string | null;
  job_title: string | null;
  is_active: boolean;
  must_reset_password: boolean;
  email_signature?: string | null;
}

interface UserRole {
  role: 'super_admin' | 'owner' | 'manager' | 'recruiter' | 'client_user' | 'hiring_manager';
  tenant_id: string | null;
}

interface ClientPortalMembership {
  id: string;
  client_org_id: string;
  tenant_id: string;
  role: 'client_user' | 'hiring_manager';
  full_name: string | null;
  email: string;
  is_active: boolean;
}

interface AuthContextType {
  user: User | null;
  session: Session | null;
  profile: Profile | null;
  roles: UserRole[];
  isLoading: boolean;
  isOwner: boolean;
  isManager: boolean;
  isRecruiter: boolean;
  isSuperAdmin: boolean;
  isClientUser: boolean;
  clientPortal: ClientPortalMembership | null;
  tenantId: string | null;
  signUp: (email: string, password: string, fullName: string) => Promise<{ error: Error | null }>;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signInWithGoogle: () => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [roles, setRoles] = useState<UserRole[]>([]);
  const [clientPortal, setClientPortal] = useState<ClientPortalMembership | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const fetchProfile = async (userId: string) => {
    try {
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .maybeSingle();

      if (profileError) {
        console.error('Error fetching profile:', profileError);
      }

      if (profileData) {
        if (profileData.is_active === false) {
          console.log('User account is deactivated');
          await supabase.auth.signOut();
          setProfile(null);
          setRoles([]);
          setClientPortal(null);
          return;
        }
        setProfile(profileData as Profile);
      }

      const { data: rolesData } = await supabase
        .from('user_roles')
        .select('role, tenant_id')
        .eq('user_id', userId);

      // Check for client portal membership in parallel
      const { data: portalData } = await supabase
        .from('client_portal_users' as any)
        .select('id, client_org_id, tenant_id, role, full_name, email, is_active')
        .eq('user_id', userId)
        .eq('is_active', true)
        .maybeSingle();

      const hasRoles = rolesData && rolesData.length > 0;
      const hasPortal = !!portalData;

      // If user has neither internal roles nor client portal membership → access removed
      if (!hasRoles && !hasPortal) {
        console.log('User has no roles or portal access - signing out');
        await supabase.auth.signOut();
        setProfile(null);
        setRoles([]);
        setClientPortal(null);
        return;
      }

      setRoles((rolesData || []) as UserRole[]);
      setClientPortal(portalData ? (portalData as unknown as ClientPortalMembership) : null);
    } catch (error) {
      console.error('Error in fetchProfile:', error);
    }
  };

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
        
        if (session?.user) {
          setTimeout(() => {
            fetchProfile(session.user.id);
          }, 0);
        } else {
          setProfile(null);
          setRoles([]);
          setClientPortal(null);
        }
        
        setIsLoading(false);
      }
    );

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      
      if (session?.user) {
        fetchProfile(session.user.id);
      }
      
      setIsLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const signUp = async (email: string, password: string, fullName: string) => {
    const redirectUrl = `${window.location.origin}/`;
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: redirectUrl,
        data: { full_name: fullName },
      },
    });
    return { error: error as Error | null };
  };

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error: error as Error | null };
  };

  const signInWithGoogle = async () => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/` },
    });
    return { error: error as Error | null };
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setProfile(null);
    setRoles([]);
    setClientPortal(null);
  };

  const refreshProfile = async () => {
    if (user) {
      await fetchProfile(user.id);
    }
  };

  const tenantId = profile?.tenant_id ?? roles[0]?.tenant_id ?? clientPortal?.tenant_id ?? null;

  const rolesForTenant = tenantId
    ? roles.filter((r) => r.tenant_id === tenantId || r.tenant_id === null)
    : roles;

  const isSuperAdmin = roles.some((r) => r.role === 'super_admin');
  const isOwner = rolesForTenant.some((r) => r.role === 'owner');
  const isManager = rolesForTenant.some((r) => r.role === 'manager');
  const isRecruiter = rolesForTenant.some((r) => r.role === 'recruiter');
  const isClientUser = !!clientPortal;

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        profile,
        roles,
        isLoading,
        isOwner,
        isManager,
        isRecruiter,
        isSuperAdmin,
        isClientUser,
        clientPortal,
        tenantId,
        signUp,
        signIn,
        signInWithGoogle,
        signOut,
        refreshProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
