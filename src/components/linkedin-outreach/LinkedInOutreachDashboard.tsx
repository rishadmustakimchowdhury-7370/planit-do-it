import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { 
  Play, 
  Pause, 
  Square, 
  Eye, 
  Send, 
  AlertTriangle, 
  Clock,
  TrendingUp,
  Users,
  Lock,
  RefreshCw
} from "lucide-react";
import { toast } from "sonner";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, useEffect } from "react";

interface LinkedInOutreachDashboardProps {
  selectedCampaignId: string | null;
  onSelectCampaign: (id: string) => void;
}

export function LinkedInOutreachDashboard({ 
  selectedCampaignId, 
  onSelectCampaign 
}: LinkedInOutreachDashboardProps) {
  const { profile } = useAuth();
  const queryClient = useQueryClient();
  const [cooldownRemaining, setCooldownRemaining] = useState(0);

  // Fetch all campaigns
  const { data: campaigns } = useQuery({
    queryKey: ["linkedin-campaigns", profile?.tenant_id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("linkedin_outreach_campaigns")
        .select("*")
        .eq("tenant_id", profile?.tenant_id)
        .order("created_at", { ascending: false });
      
      if (error) throw error;
      return data;
    },
    enabled: !!profile?.tenant_id,
  });

  const selectedCampaign = campaigns?.find(c => c.id === selectedCampaignId) || campaigns?.[0];

  // Fetch queue stats for selected campaign
  const { data: queueStats } = useQuery({
    queryKey: ["linkedin-queue-stats", selectedCampaign?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("linkedin_outreach_queue")
        .select("status")
        .eq("campaign_id", selectedCampaign?.id);
      
      if (error) throw error;

      return data.reduce(
        (acc, item) => {
          acc[item.status] = (acc[item.status] || 0) + 1;
          acc.total++;
          return acc;
        },
        { total: 0, pending: 0, visited: 0, connected: 0, skipped: 0, failed: 0 } as Record<string, number>
      );
    },
    enabled: !!selectedCampaign?.id,
  });

  // Fetch recent logs
  const { data: recentLogs } = useQuery({
    queryKey: ["linkedin-logs", selectedCampaign?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("linkedin_outreach_logs")
        .select("*")
        .eq("campaign_id", selectedCampaign?.id)
        .order("created_at", { ascending: false })
        .limit(10);
      
      if (error) throw error;
      return data;
    },
    enabled: !!selectedCampaign?.id,
  });

  // Update campaign status
  const updateStatus = useMutation({
    mutationFn: async (newStatus: string) => {
      const updates: any = { status: newStatus };
      
      if (newStatus === "running") {
        updates.started_at = new Date().toISOString();
        updates.paused_at = null;
      } else if (newStatus === "paused") {
        updates.paused_at = new Date().toISOString();
      } else if (newStatus === "completed") {
        updates.completed_at = new Date().toISOString();
      }

      const { error } = await supabase
        .from("linkedin_outreach_campaigns")
        .update(updates)
        .eq("id", selectedCampaign?.id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["linkedin-campaigns"] });
      toast.success("Campaign status updated");
    },
    onError: (error: any) => {
      toast.error("Failed to update status", { description: error.message });
    },
  });

  // Cooldown timer
  useEffect(() => {
    if (cooldownRemaining > 0) {
      const timer = setTimeout(() => setCooldownRemaining(cooldownRemaining - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [cooldownRemaining]);

  const formatCooldown = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  const quotaUsed = selectedCampaign?.sent_today || 0;
  const quotaLimit = selectedCampaign?.daily_limit || 20;
  const quotaPercentage = (quotaUsed / quotaLimit) * 100;

  if (!campaigns?.length) {
    return (
      <Card>
        <CardContent className="py-12 text-center text-muted-foreground">
          <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
          <p className="font-medium">No campaigns yet</p>
          <p className="text-sm">Create your first campaign to get started</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Campaign Selector */}
      <div className="flex items-center justify-between">
        <Select 
          value={selectedCampaign?.id} 
          onValueChange={onSelectCampaign}
        >
          <SelectTrigger className="w-64">
            <SelectValue placeholder="Select campaign" />
          </SelectTrigger>
          <SelectContent>
            {campaigns.map((campaign) => (
              <SelectItem key={campaign.id} value={campaign.id}>
                {campaign.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <div className="flex items-center gap-2">
          <Badge 
            variant={
              selectedCampaign?.status === "running" ? "default" :
              selectedCampaign?.status === "locked" ? "destructive" :
              selectedCampaign?.status === "completed" ? "secondary" :
              "outline"
            }
          >
            {selectedCampaign?.status === "running" && <Play className="h-3 w-3 mr-1" />}
            {selectedCampaign?.status === "paused" && <Pause className="h-3 w-3 mr-1" />}
            {selectedCampaign?.status === "locked" && <Lock className="h-3 w-3 mr-1" />}
            {selectedCampaign?.status}
          </Badge>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Visited Today</CardDescription>
            <CardTitle className="text-3xl flex items-center gap-2">
              <Eye className="h-6 w-6 text-blue-500" />
              {selectedCampaign?.visited_today || 0}
            </CardTitle>
          </CardHeader>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Connections Sent</CardDescription>
            <CardTitle className="text-3xl flex items-center gap-2">
              <Send className="h-6 w-6 text-green-500" />
              {selectedCampaign?.sent_today || 0}
            </CardTitle>
          </CardHeader>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Skipped</CardDescription>
            <CardTitle className="text-3xl flex items-center gap-2">
              <AlertTriangle className="h-6 w-6 text-amber-500" />
              {queueStats?.skipped || 0}
            </CardTitle>
          </CardHeader>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Queue Remaining</CardDescription>
            <CardTitle className="text-3xl flex items-center gap-2">
              <Clock className="h-6 w-6 text-muted-foreground" />
              {queueStats?.pending || 0}
            </CardTitle>
          </CardHeader>
        </Card>
      </div>

      {/* Quota & Controls */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Daily Quota</CardTitle>
            <CardDescription>
              {quotaUsed} / {quotaLimit} connections sent today
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Progress value={quotaPercentage} className="h-3" />
            
            {quotaPercentage >= 100 && (
              <div className="flex items-center gap-2 text-sm text-amber-600">
                <Lock className="h-4 w-4" />
                Limit reached - will resume tomorrow
              </div>
            )}

            {cooldownRemaining > 0 && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <RefreshCw className="h-4 w-4 animate-spin" />
                Next action in {formatCooldown(cooldownRemaining)}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Controls</CardTitle>
            <CardDescription>
              Manage your outreach campaign
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex gap-2">
              {selectedCampaign?.status !== "running" && selectedCampaign?.status !== "completed" && (
                <Button 
                  onClick={() => updateStatus.mutate("running")}
                  disabled={updateStatus.isPending || quotaPercentage >= 100}
                  className="flex-1"
                >
                  <Play className="h-4 w-4 mr-2" />
                  Start
                </Button>
              )}

              {selectedCampaign?.status === "running" && (
                <>
                  <Button 
                    variant="outline"
                    onClick={() => updateStatus.mutate("paused")}
                    disabled={updateStatus.isPending}
                    className="flex-1"
                  >
                    <Pause className="h-4 w-4 mr-2" />
                    Pause
                  </Button>
                  <Button 
                    variant="destructive"
                    onClick={() => updateStatus.mutate("completed")}
                    disabled={updateStatus.isPending}
                    className="flex-1"
                  >
                    <Square className="h-4 w-4 mr-2" />
                    Stop
                  </Button>
                </>
              )}

              {selectedCampaign?.status === "completed" && (
                <Badge variant="secondary" className="w-full justify-center py-2">
                  Campaign Completed
                </Badge>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Recent Activity */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Recent Activity</CardTitle>
          <CardDescription>Last 10 actions</CardDescription>
        </CardHeader>
        <CardContent>
          {recentLogs?.length ? (
            <div className="space-y-2">
              {recentLogs.map((log) => (
                <div 
                  key={log.id} 
                  className="flex items-center justify-between py-2 border-b last:border-0"
                >
                  <div className="flex items-center gap-2">
                    {log.action === "profile_visit" && <Eye className="h-4 w-4 text-blue-500" />}
                    {log.action === "connection_sent" && <Send className="h-4 w-4 text-green-500" />}
                    {log.action === "skipped" && <AlertTriangle className="h-4 w-4 text-amber-500" />}
                    {log.action === "error" && <AlertTriangle className="h-4 w-4 text-red-500" />}
                    <span className="text-sm capitalize">
                      {log.action.replace("_", " ")}
                    </span>
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {new Date(log.created_at).toLocaleTimeString()}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-4">
              No activity yet
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
