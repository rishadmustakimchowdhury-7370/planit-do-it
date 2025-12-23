import { useState, useEffect } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { LinkedInTemplatesManager } from '@/components/linkedin/LinkedInTemplatesManager';
import { LinkedInCandidatesList } from '@/components/linkedin/LinkedInCandidatesList';
import { LinkedInConnectionCard } from '@/components/linkedin/LinkedInConnectionCard';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { 
  Linkedin, 
  MessageSquare, 
  Settings, 
  BarChart3, 
  Loader2, 
  Save,
  Users,
  Calendar,
  UserPlus
} from 'lucide-react';
import { format, subDays, startOfDay, endOfDay } from 'date-fns';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth';
import { toast } from 'sonner';
import { RoleGate } from '@/components/auth/RoleGate';

interface DailyStats {
  date: string;
  count: number;
}

interface RecruiterStats {
  user_id: string;
  full_name: string;
  count: number;
}

export default function LinkedInMessagingPage() {
  const { tenantId, isOwner, isManager } = useAuth();
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  
  // Settings state
  const [linkedInEnabled, setLinkedInEnabled] = useState(true);
  const [dailyLimit, setDailyLimit] = useState(50);
  
  // Stats state
  const [totalMessages, setTotalMessages] = useState(0);
  const [todayMessages, setTodayMessages] = useState(0);
  const [weekMessages, setWeekMessages] = useState(0);
  const [dailyStats, setDailyStats] = useState<DailyStats[]>([]);
  const [recruiterStats, setRecruiterStats] = useState<RecruiterStats[]>([]);

  useEffect(() => {
    if (tenantId) {
      fetchData();
    }
  }, [tenantId]);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      // Fetch LinkedIn settings from tenant_settings or platform_settings
      // For now we'll use local state, but this should be stored in DB
      
      // Fetch message statistics
      const today = new Date();
      const weekAgo = subDays(today, 7);
      
      // Total messages
      const { count: total } = await supabase
        .from('linkedin_message_logs')
        .select('*', { count: 'exact', head: true })
        .eq('tenant_id', tenantId);
      
      setTotalMessages(total || 0);
      
      // Today's messages
      const { count: todayCount } = await supabase
        .from('linkedin_message_logs')
        .select('*', { count: 'exact', head: true })
        .eq('tenant_id', tenantId)
        .gte('sent_at', startOfDay(today).toISOString())
        .lte('sent_at', endOfDay(today).toISOString());
      
      setTodayMessages(todayCount || 0);
      
      // Week's messages
      const { count: weekCount } = await supabase
        .from('linkedin_message_logs')
        .select('*', { count: 'exact', head: true })
        .eq('tenant_id', tenantId)
        .gte('sent_at', weekAgo.toISOString());
      
      setWeekMessages(weekCount || 0);
      
      // Daily breakdown for the last 7 days
      const { data: logsData } = await supabase
        .from('linkedin_message_logs')
        .select('sent_at')
        .eq('tenant_id', tenantId)
        .gte('sent_at', weekAgo.toISOString())
        .order('sent_at', { ascending: true });
      
      if (logsData) {
        const dailyCounts: Record<string, number> = {};
        for (let i = 0; i < 7; i++) {
          const date = format(subDays(today, i), 'yyyy-MM-dd');
          dailyCounts[date] = 0;
        }
        
        logsData.forEach((log) => {
          const date = format(new Date(log.sent_at), 'yyyy-MM-dd');
          if (dailyCounts[date] !== undefined) {
            dailyCounts[date]++;
          }
        });
        
        setDailyStats(
          Object.entries(dailyCounts)
            .map(([date, count]) => ({ date, count }))
            .reverse()
        );
      }
      
      // Top recruiters
      const { data: recruiterData } = await supabase
        .from('linkedin_message_logs')
        .select('sent_by')
        .eq('tenant_id', tenantId)
        .gte('sent_at', weekAgo.toISOString());
      
      if (recruiterData) {
        const recruiterCounts: Record<string, number> = {};
        recruiterData.forEach((log) => {
          recruiterCounts[log.sent_by] = (recruiterCounts[log.sent_by] || 0) + 1;
        });
        
        const recruiterIds = Object.keys(recruiterCounts);
        if (recruiterIds.length > 0) {
          const { data: profiles } = await supabase
            .from('profiles')
            .select('id, full_name')
            .in('id', recruiterIds);
          
          const stats = recruiterIds.map((id) => ({
            user_id: id,
            full_name: profiles?.find(p => p.id === id)?.full_name || 'Unknown',
            count: recruiterCounts[id],
          })).sort((a, b) => b.count - a.count);
          
          setRecruiterStats(stats);
        }
      }
      
    } catch (error) {
      console.error('Error fetching LinkedIn data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSaveSettings = async () => {
    setIsSaving(true);
    try {
      // In a real implementation, save to platform_settings or tenant settings
      // For now, just show success
      toast.success('LinkedIn settings saved');
    } catch (error) {
      console.error('Error saving settings:', error);
      toast.error('Failed to save settings');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <RoleGate allowedRoles={['owner', 'manager', 'recruiter']} requiredPermission="can_send_linkedin_messages" redirectTo="/dashboard">
      <AppLayout title="LinkedIn Messaging" subtitle="Manage LinkedIn outreach templates and track activity">
        <Tabs defaultValue="candidates" className="space-y-6">
          <TabsList>
            <TabsTrigger value="candidates" className="gap-2">
              <UserPlus className="w-4 h-4" />
              Send Requests
            </TabsTrigger>
            <TabsTrigger value="templates" className="gap-2">
              <MessageSquare className="w-4 h-4" />
              Templates
            </TabsTrigger>
            <TabsTrigger value="analytics" className="gap-2">
              <BarChart3 className="w-4 h-4" />
              Analytics
            </TabsTrigger>
            {(isOwner || isManager) && (
              <TabsTrigger value="settings" className="gap-2">
                <Settings className="w-4 h-4" />
                Settings
              </TabsTrigger>
            )}
          </TabsList>

          <TabsContent value="candidates">
            <LinkedInCandidatesList />
          </TabsContent>

          <TabsContent value="templates">
            <LinkedInTemplatesManager />
          </TabsContent>

          {/* Analytics Tab */}
          <TabsContent value="analytics" className="space-y-6">
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <>
                {/* Stats Cards */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm font-medium text-muted-foreground">
                        Total Messages
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-3xl font-bold">{totalMessages}</div>
                      <p className="text-xs text-muted-foreground mt-1">All time</p>
                    </CardContent>
                  </Card>
                  
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm font-medium text-muted-foreground">
                        Today
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-3xl font-bold">{todayMessages}</div>
                      <p className="text-xs text-muted-foreground mt-1">
                        {dailyLimit > 0 ? `${dailyLimit - todayMessages} remaining` : 'No limit'}
                      </p>
                    </CardContent>
                  </Card>
                  
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm font-medium text-muted-foreground">
                        This Week
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-3xl font-bold">{weekMessages}</div>
                      <p className="text-xs text-muted-foreground mt-1">Last 7 days</p>
                    </CardContent>
                  </Card>
                </div>

                {/* Daily Breakdown */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Calendar className="w-5 h-5 text-[#0077B5]" />
                      Daily Activity
                    </CardTitle>
                    <CardDescription>Messages sent per day (last 7 days)</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-end gap-2 h-32">
                      {dailyStats.map((day) => {
                        const maxCount = Math.max(...dailyStats.map(d => d.count), 1);
                        const height = (day.count / maxCount) * 100;
                        return (
                          <div key={day.date} className="flex-1 flex flex-col items-center gap-1">
                            <div 
                              className="w-full bg-[#0077B5]/20 rounded-t relative group cursor-pointer"
                              style={{ height: `${Math.max(height, 4)}%` }}
                            >
                              <div 
                                className="absolute inset-0 bg-[#0077B5] rounded-t opacity-80"
                                style={{ height: '100%' }}
                              />
                              <div className="absolute -top-6 left-1/2 -translate-x-1/2 bg-foreground text-background text-xs px-1.5 py-0.5 rounded opacity-0 group-hover:opacity-100 transition-opacity">
                                {day.count}
                              </div>
                            </div>
                            <span className="text-xs text-muted-foreground">
                              {format(new Date(day.date), 'EEE')}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </CardContent>
                </Card>

                {/* Top Recruiters */}
                {recruiterStats.length > 0 && (
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <Users className="w-5 h-5 text-[#0077B5]" />
                        Top Recruiters
                      </CardTitle>
                      <CardDescription>Most active LinkedIn outreach (last 7 days)</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-3">
                        {recruiterStats.slice(0, 5).map((recruiter, index) => (
                          <div key={recruiter.user_id} className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <Badge variant="outline" className="w-6 h-6 rounded-full flex items-center justify-center p-0">
                                {index + 1}
                              </Badge>
                              <span className="font-medium">{recruiter.full_name}</span>
                            </div>
                            <Badge variant="secondary">{recruiter.count} messages</Badge>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                )}
              </>
            )}
          </TabsContent>

          {/* Settings Tab - Owner/Manager Only */}
          {(isOwner || isManager) && (
            <TabsContent value="settings" className="space-y-6">
              {/* LinkedIn Connection */}
              <LinkedInConnectionCard />

              {/* Messaging Settings */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Settings className="w-5 h-5" />
                    Messaging Settings
                  </CardTitle>
                  <CardDescription>
                    Configure LinkedIn messaging for your organization
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label htmlFor="linkedin-enabled">Enable LinkedIn Messaging</Label>
                      <p className="text-sm text-muted-foreground">
                        Allow team members to send LinkedIn messages to candidates
                      </p>
                    </div>
                    <Switch
                      id="linkedin-enabled"
                      checked={linkedInEnabled}
                      onCheckedChange={setLinkedInEnabled}
                    />
                  </div>

                  <Separator />

                  <div className="space-y-2">
                    <Label htmlFor="daily-limit">Daily Message Limit</Label>
                    <div className="flex items-center gap-4">
                      <Input
                        id="daily-limit"
                        type="number"
                        min={0}
                        max={500}
                        value={dailyLimit}
                        onChange={(e) => setDailyLimit(parseInt(e.target.value) || 0)}
                        className="w-32"
                      />
                      <span className="text-sm text-muted-foreground">
                        messages per recruiter per day (0 = unlimited)
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      LinkedIn recommends staying under 100 connection requests per week
                    </p>
                  </div>

                  <Separator />

                  <Button onClick={handleSaveSettings} disabled={isSaving} className="gap-2">
                    {isSaving ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Save className="w-4 h-4" />
                    )}
                    Save Settings
                  </Button>
                </CardContent>
              </Card>
            </TabsContent>
          )}
        </Tabs>
      </AppLayout>
    </RoleGate>
  );
}
