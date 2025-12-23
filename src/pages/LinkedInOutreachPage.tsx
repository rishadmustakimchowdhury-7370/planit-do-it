import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { LinkedInComplianceModal } from "@/components/linkedin-outreach/LinkedInComplianceModal";
import { LinkedInCampaignSetup } from "@/components/linkedin-outreach/LinkedInCampaignSetup";
import { LinkedInQueueManager } from "@/components/linkedin-outreach/LinkedInQueueManager";
import { LinkedInOutreachDashboard } from "@/components/linkedin-outreach/LinkedInOutreachDashboard";
import { LinkedInCampaignList } from "@/components/linkedin-outreach/LinkedInCampaignList";
import { Linkedin } from "lucide-react";

export default function LinkedInOutreachPage() {
  const { user, profile } = useAuth();
  const [showComplianceModal, setShowComplianceModal] = useState(false);
  const [selectedCampaignId, setSelectedCampaignId] = useState<string | null>(null);

  // Check if user has acknowledged compliance
  const { data: consent, isLoading: consentLoading } = useQuery({
    queryKey: ["linkedin-consent", user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      const { data, error } = await supabase
        .from("linkedin_outreach_consent")
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle();
      
      if (error) throw error;
      return data;
    },
    enabled: !!user?.id,
  });

  useEffect(() => {
    if (!consentLoading && !consent && user?.id) {
      setShowComplianceModal(true);
    }
  }, [consent, consentLoading, user?.id]);

  if (consentLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-6 space-y-6">
      <div className="flex items-center gap-3">
        <div className="p-2 bg-primary/10 rounded-lg">
          <Linkedin className="h-6 w-6 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold">LinkedIn Outreach</h1>
          <p className="text-muted-foreground">
            AI-assisted, browser-controlled LinkedIn connection campaigns
          </p>
        </div>
      </div>

      <LinkedInComplianceModal
        open={showComplianceModal}
        onOpenChange={setShowComplianceModal}
        userId={user?.id}
        tenantId={profile?.tenant_id}
      />

      {consent && (
        <Tabs defaultValue="dashboard" className="space-y-4">
          <TabsList>
            <TabsTrigger value="dashboard">Dashboard</TabsTrigger>
            <TabsTrigger value="campaigns">Campaigns</TabsTrigger>
            <TabsTrigger value="queue">Queue</TabsTrigger>
            <TabsTrigger value="setup">New Campaign</TabsTrigger>
          </TabsList>

          <TabsContent value="dashboard">
            <LinkedInOutreachDashboard 
              selectedCampaignId={selectedCampaignId}
              onSelectCampaign={setSelectedCampaignId}
            />
          </TabsContent>

          <TabsContent value="campaigns">
            <LinkedInCampaignList 
              onSelectCampaign={(id) => {
                setSelectedCampaignId(id);
              }}
            />
          </TabsContent>

          <TabsContent value="queue">
            <LinkedInQueueManager campaignId={selectedCampaignId} />
          </TabsContent>

          <TabsContent value="setup">
            <LinkedInCampaignSetup 
              onCampaignCreated={(id) => {
                setSelectedCampaignId(id);
              }}
            />
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}
