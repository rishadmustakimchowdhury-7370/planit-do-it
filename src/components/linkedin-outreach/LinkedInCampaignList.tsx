import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { 
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { 
  MoreVertical, 
  Play, 
  Pause, 
  Trash2, 
  Eye,
  Users,
  Calendar,
  MessageSquare
} from "lucide-react";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";

interface LinkedInCampaignListProps {
  onSelectCampaign: (id: string) => void;
}

export function LinkedInCampaignList({ onSelectCampaign }: LinkedInCampaignListProps) {
  const { profile } = useAuth();
  const queryClient = useQueryClient();

  const { data: campaigns, isLoading } = useQuery({
    queryKey: ["linkedin-campaigns", profile?.tenant_id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("linkedin_outreach_campaigns")
        .select(`
          *,
          linkedin_message_templates(name)
        `)
        .eq("tenant_id", profile?.tenant_id)
        .order("created_at", { ascending: false });
      
      if (error) throw error;
      return data;
    },
    enabled: !!profile?.tenant_id,
  });

  const deleteCampaign = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("linkedin_outreach_campaigns")
        .delete()
        .eq("id", id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["linkedin-campaigns"] });
      toast.success("Campaign deleted");
    },
    onError: (error: any) => {
      toast.error("Failed to delete campaign", { description: error.message });
    },
  });

  const getStatusColor = (status: string) => {
    switch (status) {
      case "running": return "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300";
      case "paused": return "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300";
      case "completed": return "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300";
      case "locked": return "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300";
      default: return "bg-muted";
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

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
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      {campaigns.map((campaign) => {
        const progress = campaign.total_profiles > 0 
          ? ((campaign.total_profiles - (campaign.visited_today || 0)) / campaign.total_profiles) * 100
          : 0;

        return (
          <Card key={campaign.id} className="hover:shadow-md transition-shadow">
            <CardHeader className="pb-2">
              <div className="flex items-start justify-between">
                <div className="space-y-1">
                  <CardTitle className="text-lg">{campaign.name}</CardTitle>
                  <CardDescription className="flex items-center gap-1">
                    <Calendar className="h-3 w-3" />
                    {formatDistanceToNow(new Date(campaign.created_at), { addSuffix: true })}
                  </CardDescription>
                </div>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-8 w-8">
                      <MoreVertical className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => onSelectCampaign(campaign.id)}>
                      <Eye className="h-4 w-4 mr-2" />
                      View Details
                    </DropdownMenuItem>
                    <DropdownMenuItem 
                      onClick={() => deleteCampaign.mutate(campaign.id)}
                      className="text-red-600"
                    >
                      <Trash2 className="h-4 w-4 mr-2" />
                      Delete
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-2 flex-wrap">
                <Badge className={getStatusColor(campaign.status)}>
                  {campaign.status}
                </Badge>
                <Badge variant="outline">
                  {campaign.outreach_mode === "connect_with_note" ? (
                    <><MessageSquare className="h-3 w-3 mr-1" /> With Note</>
                  ) : (
                    "Connect Only"
                  )}
                </Badge>
              </div>

              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Progress</span>
                  <span>{campaign.sent_today || 0} / {campaign.total_profiles}</span>
                </div>
                <Progress value={progress} className="h-2" />
              </div>

              <div className="grid grid-cols-3 gap-2 text-center text-sm">
                <div>
                  <p className="font-medium">{campaign.total_profiles}</p>
                  <p className="text-xs text-muted-foreground">Total</p>
                </div>
                <div>
                  <p className="font-medium text-blue-600">{campaign.visited_today || 0}</p>
                  <p className="text-xs text-muted-foreground">Visited</p>
                </div>
                <div>
                  <p className="font-medium text-green-600">{campaign.sent_today || 0}</p>
                  <p className="text-xs text-muted-foreground">Sent</p>
                </div>
              </div>

              <div className="flex gap-2">
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="flex-1"
                  onClick={() => onSelectCampaign(campaign.id)}
                >
                  <Eye className="h-4 w-4 mr-1" />
                  View
                </Button>
                {campaign.status === "draft" || campaign.status === "paused" ? (
                  <Button size="sm" className="flex-1">
                    <Play className="h-4 w-4 mr-1" />
                    Start
                  </Button>
                ) : campaign.status === "running" ? (
                  <Button variant="secondary" size="sm" className="flex-1">
                    <Pause className="h-4 w-4 mr-1" />
                    Pause
                  </Button>
                ) : null}
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
