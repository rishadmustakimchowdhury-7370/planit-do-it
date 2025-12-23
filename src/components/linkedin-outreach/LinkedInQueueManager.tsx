import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { 
  Clock, 
  CheckCircle2, 
  XCircle, 
  AlertTriangle, 
  ExternalLink,
  User,
  Building,
  Briefcase
} from "lucide-react";
import { useState } from "react";

interface LinkedInQueueManagerProps {
  campaignId: string | null;
}

const statusConfig = {
  pending: { icon: Clock, color: "text-muted-foreground", bg: "bg-muted" },
  visited: { icon: CheckCircle2, color: "text-blue-600", bg: "bg-blue-100 dark:bg-blue-900/30" },
  connected: { icon: CheckCircle2, color: "text-green-600", bg: "bg-green-100 dark:bg-green-900/30" },
  skipped: { icon: AlertTriangle, color: "text-amber-600", bg: "bg-amber-100 dark:bg-amber-900/30" },
  failed: { icon: XCircle, color: "text-red-600", bg: "bg-red-100 dark:bg-red-900/30" },
};

export function LinkedInQueueManager({ campaignId }: LinkedInQueueManagerProps) {
  const { profile } = useAuth();
  const [statusFilter, setStatusFilter] = useState<string>("all");

  // Fetch campaigns for selector
  const { data: campaigns } = useQuery({
    queryKey: ["linkedin-campaigns-list", profile?.tenant_id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("linkedin_outreach_campaigns")
        .select("id, name, status")
        .eq("tenant_id", profile?.tenant_id)
        .order("created_at", { ascending: false });
      
      if (error) throw error;
      return data;
    },
    enabled: !!profile?.tenant_id,
  });

  const [selectedCampaign, setSelectedCampaign] = useState<string>(campaignId || "");

  // Fetch queue items
  const { data: queueItems, isLoading } = useQuery({
    queryKey: ["linkedin-queue", selectedCampaign, statusFilter],
    queryFn: async () => {
      let query = supabase
        .from("linkedin_outreach_queue")
        .select("*")
        .eq("campaign_id", selectedCampaign)
        .order("position", { ascending: true });

      if (statusFilter !== "all") {
        query = query.eq("status", statusFilter);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
    enabled: !!selectedCampaign,
  });

  // Stats
  const stats = queueItems?.reduce(
    (acc, item) => {
      acc[item.status] = (acc[item.status] || 0) + 1;
      acc.total++;
      return acc;
    },
    { total: 0, pending: 0, visited: 0, connected: 0, skipped: 0, failed: 0 } as Record<string, number>
  );

  if (!campaigns?.length) {
    return (
      <Card>
        <CardContent className="py-12 text-center text-muted-foreground">
          <Clock className="h-12 w-12 mx-auto mb-4 opacity-50" />
          <p className="font-medium">No campaigns yet</p>
          <p className="text-sm">Create a campaign to start adding profiles to your queue</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
        <div className="flex gap-2 items-center">
          <Select value={selectedCampaign} onValueChange={setSelectedCampaign}>
            <SelectTrigger className="w-64">
              <SelectValue placeholder="Select a campaign" />
            </SelectTrigger>
            <SelectContent>
              {campaigns.map((campaign) => (
                <SelectItem key={campaign.id} value={campaign.id}>
                  {campaign.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="visited">Visited</SelectItem>
              <SelectItem value="connected">Connected</SelectItem>
              <SelectItem value="skipped">Skipped</SelectItem>
              <SelectItem value="failed">Failed</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {stats && (
          <div className="flex gap-2 flex-wrap">
            <Badge variant="outline">{stats.total} Total</Badge>
            <Badge variant="secondary" className="bg-muted">{stats.pending} Pending</Badge>
            <Badge className="bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300">
              {stats.visited} Visited
            </Badge>
            <Badge className="bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300">
              {stats.connected} Connected
            </Badge>
            <Badge className="bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300">
              {stats.skipped} Skipped
            </Badge>
          </div>
        )}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Queue Items</CardTitle>
          <CardDescription>
            Profiles in your outreach queue
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
          ) : !queueItems?.length ? (
            <div className="text-center py-8 text-muted-foreground">
              <User className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p>No profiles in queue</p>
            </div>
          ) : (
            <ScrollArea className="h-[500px]">
              <div className="space-y-2">
                {queueItems.map((item, index) => {
                  const config = statusConfig[item.status as keyof typeof statusConfig];
                  const StatusIcon = config.icon;

                  return (
                    <div
                      key={item.id}
                      className="flex items-center gap-4 p-4 rounded-lg border hover:bg-muted/50 transition-colors"
                    >
                      <div className="text-muted-foreground text-sm w-8">
                        #{index + 1}
                      </div>

                      <div className={`p-2 rounded-full ${config.bg}`}>
                        <StatusIcon className={`h-4 w-4 ${config.color}`} />
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          {item.first_name ? (
                            <span className="font-medium">{item.first_name}</span>
                          ) : (
                            <span className="text-muted-foreground text-sm truncate">
                              {item.linkedin_url}
                            </span>
                          )}
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6"
                            onClick={() => window.open(item.linkedin_url, "_blank")}
                          >
                            <ExternalLink className="h-3 w-3" />
                          </Button>
                        </div>

                        <div className="flex items-center gap-3 text-xs text-muted-foreground mt-1">
                          {item.job_title && (
                            <span className="flex items-center gap-1">
                              <Briefcase className="h-3 w-3" />
                              {item.job_title}
                            </span>
                          )}
                          {item.company && (
                            <span className="flex items-center gap-1">
                              <Building className="h-3 w-3" />
                              {item.company}
                            </span>
                          )}
                        </div>

                        {item.skip_reason && (
                          <p className="text-xs text-amber-600 mt-1">
                            Skip reason: {item.skip_reason}
                          </p>
                        )}

                        {item.error_message && (
                          <p className="text-xs text-red-600 mt-1">
                            Error: {item.error_message}
                          </p>
                        )}
                      </div>

                      <Badge variant="outline" className={config.bg}>
                        {item.status}
                      </Badge>

                      {item.dwell_time_seconds && (
                        <span className="text-xs text-muted-foreground">
                          {item.dwell_time_seconds}s dwell
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            </ScrollArea>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
