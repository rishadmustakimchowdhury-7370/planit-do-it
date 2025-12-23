import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Slider } from "@/components/ui/slider";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { toast } from "sonner";
import { Plus, Upload, Users, AlertCircle, Info } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface LinkedInCampaignSetupProps {
  onCampaignCreated?: (campaignId: string) => void;
}

export function LinkedInCampaignSetup({ onCampaignCreated }: LinkedInCampaignSetupProps) {
  const { user, profile } = useAuth();
  const queryClient = useQueryClient();

  const [campaignName, setCampaignName] = useState("");
  const [outreachMode, setOutreachMode] = useState<"connect_with_note" | "connect_without_note">("connect_with_note");
  const [accountType, setAccountType] = useState<"new" | "normal">("normal");
  const [dailyLimit, setDailyLimit] = useState(20);
  const [customMessage, setCustomMessage] = useState("");
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>("");
  const [profileUrls, setProfileUrls] = useState("");
  const [addMethod, setAddMethod] = useState<"manual" | "csv" | "candidates">("manual");
  const [selectedCandidates, setSelectedCandidates] = useState<string[]>([]);

  // Get recommended limit based on account type
  const getRecommendedLimit = () => {
    if (accountType === "new") return { min: 15, max: 20, default: 15 };
    return { min: 20, max: 30, default: 20 };
  };

  const limits = getRecommendedLimit();

  // Fetch message templates
  const { data: templates } = useQuery({
    queryKey: ["linkedin-templates", profile?.tenant_id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("linkedin_message_templates")
        .select("*")
        .eq("tenant_id", profile?.tenant_id)
        .eq("is_active", true);
      
      if (error) throw error;
      return data;
    },
    enabled: !!profile?.tenant_id,
  });

  // Fetch candidates with LinkedIn URLs
  const { data: candidates } = useQuery({
    queryKey: ["candidates-with-linkedin", profile?.tenant_id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("candidates")
        .select("id, full_name, linkedin_url, current_title, current_company")
        .eq("tenant_id", profile?.tenant_id)
        .not("linkedin_url", "is", null);
      
      if (error) throw error;
      return data;
    },
    enabled: !!profile?.tenant_id,
  });

  // Create campaign mutation
  const createCampaign = useMutation({
    mutationFn: async () => {
      if (!user?.id || !profile?.tenant_id) throw new Error("Not authenticated");

      // Parse profile URLs
      let urls: string[] = [];
      if (addMethod === "manual") {
        urls = profileUrls
          .split("\n")
          .map((url) => url.trim())
          .filter((url) => url.includes("linkedin.com"));
      } else if (addMethod === "candidates") {
        urls = candidates
          ?.filter((c) => selectedCandidates.includes(c.id))
          .map((c) => c.linkedin_url!)
          .filter(Boolean) || [];
      }

      if (urls.length === 0) {
        throw new Error("No valid LinkedIn profile URLs provided");
      }

      // Create campaign
      const { data: campaign, error: campaignError } = await supabase
        .from("linkedin_outreach_campaigns")
        .insert({
          tenant_id: profile.tenant_id,
          user_id: user.id,
          name: campaignName || `Campaign ${new Date().toLocaleDateString()}`,
          outreach_mode: outreachMode,
          account_type: accountType,
          daily_limit: Math.min(dailyLimit, 35), // Hard cap
          message_template_id: selectedTemplateId || null,
          custom_message: customMessage || null,
          total_profiles: urls.length,
        })
        .select()
        .single();

      if (campaignError) throw campaignError;

      // Add profiles to queue
      const queueItems = urls.map((url, index) => {
        const candidate = candidates?.find((c) => c.linkedin_url === url);
        return {
          campaign_id: campaign.id,
          tenant_id: profile.tenant_id,
          linkedin_url: url,
          candidate_id: candidate?.id || null,
          first_name: candidate?.full_name?.split(" ")[0] || null,
          job_title: candidate?.current_title || null,
          company: candidate?.current_company || null,
          position: index,
        };
      });

      const { error: queueError } = await supabase
        .from("linkedin_outreach_queue")
        .insert(queueItems);

      if (queueError) throw queueError;

      return campaign;
    },
    onSuccess: (campaign) => {
      toast.success("Campaign created", {
        description: `Added ${campaign.total_profiles} profiles to queue`,
      });
      queryClient.invalidateQueries({ queryKey: ["linkedin-campaigns"] });
      onCampaignCreated?.(campaign.id);
      
      // Reset form
      setCampaignName("");
      setProfileUrls("");
      setSelectedCandidates([]);
      setCustomMessage("");
    },
    onError: (error: any) => {
      toast.error("Failed to create campaign", {
        description: error.message,
      });
    },
  });

  const toggleCandidate = (id: string) => {
    setSelectedCandidates((prev) =>
      prev.includes(id) ? prev.filter((c) => c !== id) : [...prev, id]
    );
  };

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle>Campaign Settings</CardTitle>
          <CardDescription>Configure your outreach campaign parameters</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="name">Campaign Name</Label>
            <Input
              id="name"
              placeholder="e.g., Q1 Developer Outreach"
              value={campaignName}
              onChange={(e) => setCampaignName(e.target.value)}
            />
          </div>

          <div className="space-y-3">
            <Label>Outreach Mode</Label>
            <RadioGroup
              value={outreachMode}
              onValueChange={(v) => setOutreachMode(v as any)}
              className="grid grid-cols-2 gap-4"
            >
              <div className="flex items-center space-x-2 border rounded-lg p-4 cursor-pointer hover:bg-muted/50">
                <RadioGroupItem value="connect_with_note" id="with_note" />
                <Label htmlFor="with_note" className="cursor-pointer">
                  <div className="font-medium">Connect with Note</div>
                  <div className="text-xs text-muted-foreground">Include personalized message</div>
                </Label>
              </div>
              <div className="flex items-center space-x-2 border rounded-lg p-4 cursor-pointer hover:bg-muted/50">
                <RadioGroupItem value="connect_without_note" id="without_note" />
                <Label htmlFor="without_note" className="cursor-pointer">
                  <div className="font-medium">Connect Only</div>
                  <div className="text-xs text-muted-foreground">No message attached</div>
                </Label>
              </div>
            </RadioGroup>
          </div>

          {outreachMode === "connect_with_note" && (
            <div className="space-y-3">
              <Label>Message Template</Label>
              <Select value={selectedTemplateId} onValueChange={setSelectedTemplateId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a template or write custom" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Custom Message</SelectItem>
                  {templates?.map((template) => (
                    <SelectItem key={template.id} value={template.id}>
                      {template.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {!selectedTemplateId && (
                <div className="space-y-2">
                  <Textarea
                    placeholder="Hi {first_name}, I noticed you work at {company}..."
                    value={customMessage}
                    onChange={(e) => setCustomMessage(e.target.value)}
                    rows={4}
                  />
                  <p className="text-xs text-muted-foreground">
                    Variables: {"{first_name}"}, {"{job_title}"}, {"{company}"}
                  </p>
                </div>
              )}
            </div>
          )}

          <div className="space-y-3">
            <Label>Account Type</Label>
            <RadioGroup
              value={accountType}
              onValueChange={(v) => {
                setAccountType(v as any);
                setDailyLimit(v === "new" ? 15 : 20);
              }}
              className="flex gap-4"
            >
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="normal" id="normal" />
                <Label htmlFor="normal">Normal Account</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="new" id="new" />
                <Label htmlFor="new">New Account (&lt;1 month)</Label>
              </div>
            </RadioGroup>
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label>Daily Connection Limit</Label>
              <Badge variant="secondary">{dailyLimit}/day</Badge>
            </div>
            <Slider
              value={[dailyLimit]}
              onValueChange={([v]) => setDailyLimit(v)}
              min={limits.min}
              max={limits.max}
              step={1}
            />
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>Safe: {limits.min}</span>
              <span>Max: {limits.max}</span>
            </div>
            <Alert>
              <Info className="h-4 w-4" />
              <AlertDescription className="text-xs">
                Hard cap of 35/day enforced. System will auto-lock when reached and resume next day.
              </AlertDescription>
            </Alert>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Add Profiles</CardTitle>
          <CardDescription>Add LinkedIn profiles to your outreach queue</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Tabs value={addMethod} onValueChange={(v) => setAddMethod(v as any)}>
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="manual">Manual</TabsTrigger>
              <TabsTrigger value="csv">CSV Upload</TabsTrigger>
              <TabsTrigger value="candidates">From Candidates</TabsTrigger>
            </TabsList>

            <TabsContent value="manual" className="space-y-4 mt-4">
              <div className="space-y-2">
                <Label>LinkedIn Profile URLs</Label>
                <Textarea
                  placeholder="https://linkedin.com/in/johndoe&#10;https://linkedin.com/in/janedoe&#10;..."
                  value={profileUrls}
                  onChange={(e) => setProfileUrls(e.target.value)}
                  rows={8}
                />
                <p className="text-xs text-muted-foreground">
                  One URL per line. Only linkedin.com URLs will be processed.
                </p>
              </div>
              {profileUrls && (
                <Badge variant="outline">
                  {profileUrls.split("\n").filter((u) => u.includes("linkedin.com")).length} valid URLs
                </Badge>
              )}
            </TabsContent>

            <TabsContent value="csv" className="space-y-4 mt-4">
              <div className="border-2 border-dashed rounded-lg p-8 text-center">
                <Upload className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                <p className="text-sm text-muted-foreground mb-2">
                  Drop CSV file here or click to upload
                </p>
                <Button variant="outline" size="sm">
                  Select File
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                CSV should have a column named "linkedin_url" or "LinkedIn URL"
              </p>
            </TabsContent>

            <TabsContent value="candidates" className="space-y-4 mt-4">
              {candidates && candidates.length > 0 ? (
                <>
                  <div className="flex items-center justify-between">
                    <p className="text-sm text-muted-foreground">
                      {candidates.length} candidates with LinkedIn profiles
                    </p>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        setSelectedCandidates(
                          selectedCandidates.length === candidates.length
                            ? []
                            : candidates.map((c) => c.id)
                        )
                      }
                    >
                      {selectedCandidates.length === candidates.length ? "Deselect All" : "Select All"}
                    </Button>
                  </div>
                  <div className="max-h-64 overflow-y-auto space-y-2">
                    {candidates.map((candidate) => (
                      <div
                        key={candidate.id}
                        className={`flex items-center justify-between p-3 rounded-lg border cursor-pointer transition-colors ${
                          selectedCandidates.includes(candidate.id)
                            ? "bg-primary/10 border-primary"
                            : "hover:bg-muted/50"
                        }`}
                        onClick={() => toggleCandidate(candidate.id)}
                      >
                        <div>
                          <p className="font-medium text-sm">{candidate.full_name}</p>
                          <p className="text-xs text-muted-foreground">
                            {candidate.current_title} at {candidate.current_company}
                          </p>
                        </div>
                        <Users className="h-4 w-4 text-muted-foreground" />
                      </div>
                    ))}
                  </div>
                  {selectedCandidates.length > 0 && (
                    <Badge>{selectedCandidates.length} selected</Badge>
                  )}
                </>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <Users className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p>No candidates with LinkedIn profiles found</p>
                </div>
              )}
            </TabsContent>
          </Tabs>

          <Button
            className="w-full"
            onClick={() => createCampaign.mutate()}
            disabled={createCampaign.isPending}
          >
            <Plus className="h-4 w-4 mr-2" />
            {createCampaign.isPending ? "Creating..." : "Create Campaign"}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
