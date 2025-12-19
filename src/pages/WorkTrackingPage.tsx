import { useState, useEffect } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Skeleton } from '@/components/ui/skeleton';
import { 
  Clock, 
  Users, 
  Settings,
  Save,
  Loader2
} from 'lucide-react';
import { WorkStatusControls } from '@/components/work-tracking/WorkStatusControls';
import { TeamWorkDashboard } from '@/components/work-tracking/TeamWorkDashboard';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth';
import { toast } from 'sonner';

export default function WorkTrackingPage() {
  const { user, tenantId } = useAuth();
  const [userRole, setUserRole] = useState<string | null>(null);
  const [isLoadingRole, setIsLoadingRole] = useState(true);
  const [workSettings, setWorkSettings] = useState({
    auto_end_time: '23:59',
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
  });
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (user?.id && tenantId) {
      fetchUserRole();
      fetchWorkSettings();
    }
  }, [user?.id, tenantId]);

  const fetchUserRole = async () => {
    try {
      const { data } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', user?.id)
        .eq('tenant_id', tenantId)
        .single();

      setUserRole(data?.role || 'recruiter');
    } catch (error) {
      console.error('Error fetching user role:', error);
      setUserRole('recruiter');
    } finally {
      setIsLoadingRole(false);
    }
  };

  const fetchWorkSettings = async () => {
    try {
      const { data } = await supabase
        .from('tenant_work_settings')
        .select('*')
        .eq('tenant_id', tenantId)
        .maybeSingle();

      if (data) {
        setWorkSettings({
          auto_end_time: data.auto_end_time?.slice(0, 5) || '23:59',
          timezone: data.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone,
        });
      }
    } catch (error) {
      console.error('Error fetching work settings:', error);
    }
  };

  const saveWorkSettings = async () => {
    if (!tenantId) return;
    
    setIsSaving(true);
    try {
      const { error } = await supabase
        .from('tenant_work_settings')
        .upsert({
          tenant_id: tenantId,
          auto_end_time: workSettings.auto_end_time + ':00',
          timezone: workSettings.timezone,
        }, {
          onConflict: 'tenant_id',
        });

      if (error) throw error;
      toast.success('Settings saved');
    } catch (error: any) {
      console.error('Error saving settings:', error);
      toast.error(error.message || 'Failed to save settings');
    } finally {
      setIsSaving(false);
    }
  };

  const isAdmin = userRole === 'owner' || userRole === 'manager';

  if (isLoadingRole) {
    return (
      <AppLayout title="Work Tracking" subtitle="Track working hours">
        <div className="space-y-6">
          <Skeleton className="h-48 w-full" />
          <Skeleton className="h-64 w-full" />
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout 
      title="Work Tracking" 
      subtitle="Track and manage team working hours"
    >
      <Tabs defaultValue="my-status" className="w-full">
        <TabsList className="bg-muted/50 p-1">
          <TabsTrigger value="my-status" className="gap-2">
            <Clock className="w-4 h-4" />
            My Status
          </TabsTrigger>
          {isAdmin && (
            <>
              <TabsTrigger value="team" className="gap-2">
                <Users className="w-4 h-4" />
                Team Dashboard
              </TabsTrigger>
              <TabsTrigger value="settings" className="gap-2">
                <Settings className="w-4 h-4" />
                Settings
              </TabsTrigger>
            </>
          )}
        </TabsList>

        <TabsContent value="my-status" className="mt-6">
          <div className="max-w-md mx-auto">
            <WorkStatusControls />
          </div>
        </TabsContent>

        {isAdmin && (
          <>
            <TabsContent value="team" className="mt-6">
              <TeamWorkDashboard />
            </TabsContent>

            <TabsContent value="settings" className="mt-6">
              <Card className="max-w-lg">
                <CardHeader>
                  <CardTitle>Work Tracking Settings</CardTitle>
                  <CardDescription>
                    Configure automatic session end time and timezone for your organization
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="space-y-2">
                    <Label htmlFor="auto_end_time">Auto-End Work Time</Label>
                    <Input
                      id="auto_end_time"
                      type="time"
                      value={workSettings.auto_end_time}
                      onChange={(e) => setWorkSettings(s => ({ ...s, auto_end_time: e.target.value }))}
                    />
                    <p className="text-xs text-muted-foreground">
                      All active work sessions will automatically end at this time daily
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="timezone">Timezone</Label>
                    <Input
                      id="timezone"
                      value={workSettings.timezone}
                      onChange={(e) => setWorkSettings(s => ({ ...s, timezone: e.target.value }))}
                    />
                  </div>

                  <Button onClick={saveWorkSettings} disabled={isSaving} className="w-full">
                    {isSaving ? (
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    ) : (
                      <Save className="h-4 w-4 mr-2" />
                    )}
                    Save Settings
                  </Button>
                </CardContent>
              </Card>
            </TabsContent>
          </>
        )}
      </Tabs>
    </AppLayout>
  );
}
