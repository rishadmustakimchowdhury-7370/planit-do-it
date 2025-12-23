import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { toast } from "sonner";
import { Linkedin, Link2, Unlink, CheckCircle2, AlertCircle, ExternalLink } from "lucide-react";

export function LinkedInConnectionStatus() {
  const { user, profile, signInWithLinkedIn } = useAuth();
  const queryClient = useQueryClient();
  const [isConnecting, setIsConnecting] = useState(false);

  // Check if user has connected LinkedIn
  const { data: connection, isLoading } = useQuery({
    queryKey: ["linkedin-connection", user?.id],
    queryFn: async () => {
      if (!user?.id || !profile?.tenant_id) return null;
      const { data, error } = await supabase
        .from("linkedin_connections")
        .select("*")
        .eq("user_id", user.id)
        .eq("tenant_id", profile.tenant_id)
        .maybeSingle();
      
      if (error) throw error;
      return data;
    },
    enabled: !!user?.id && !!profile?.tenant_id,
  });

  const disconnectMutation = useMutation({
    mutationFn: async () => {
      if (!connection?.id) throw new Error("No connection to disconnect");
      
      const { error } = await supabase
        .from("linkedin_connections")
        .update({ 
          is_connected: false, 
          disconnected_at: new Date().toISOString(),
          access_token_encrypted: null 
        })
        .eq("id", connection.id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("LinkedIn disconnected");
      queryClient.invalidateQueries({ queryKey: ["linkedin-connection"] });
    },
    onError: (error: Error) => {
      toast.error("Failed to disconnect", { description: error.message });
    },
  });

  const handleConnectLinkedIn = async () => {
    setIsConnecting(true);
    try {
      const { error } = await signInWithLinkedIn();
      if (error) throw error;
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Failed to connect";
      toast.error("Connection failed", { description: message });
      setIsConnecting(false);
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="animate-pulse flex items-center gap-4">
            <div className="h-12 w-12 bg-muted rounded-full" />
            <div className="space-y-2 flex-1">
              <div className="h-4 bg-muted rounded w-1/3" />
              <div className="h-3 bg-muted rounded w-1/2" />
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Linkedin className="h-5 w-5 text-[#0A66C2]" />
          <CardTitle className="text-lg">LinkedIn Connection</CardTitle>
        </div>
        <CardDescription>
          Connect your LinkedIn account to enable browser-based outreach
        </CardDescription>
      </CardHeader>
      <CardContent>
        {connection?.is_connected ? (
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Avatar className="h-12 w-12">
                <AvatarImage src={connection.linkedin_avatar_url || undefined} />
                <AvatarFallback>
                  {connection.linkedin_name?.charAt(0) || "L"}
                </AvatarFallback>
              </Avatar>
              <div>
                <div className="flex items-center gap-2">
                  <p className="font-medium">{connection.linkedin_name}</p>
                  <Badge variant="secondary" className="gap-1">
                    <CheckCircle2 className="h-3 w-3" />
                    Connected
                  </Badge>
                </div>
                <p className="text-sm text-muted-foreground">
                  {connection.linkedin_email}
                </p>
                {connection.linkedin_profile_url && (
                  <a
                    href={connection.linkedin_profile_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-primary hover:underline inline-flex items-center gap-1 mt-1"
                  >
                    View Profile <ExternalLink className="h-3 w-3" />
                  </a>
                )}
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => disconnectMutation.mutate()}
              disabled={disconnectMutation.isPending}
            >
              <Unlink className="h-4 w-4 mr-2" />
              Disconnect
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-start gap-3 p-4 bg-muted/50 rounded-lg">
              <AlertCircle className="h-5 w-5 text-amber-500 flex-shrink-0 mt-0.5" />
              <div className="text-sm">
                <p className="font-medium">Not connected</p>
                <p className="text-muted-foreground">
                  Connect your LinkedIn account to verify your identity. The browser extension 
                  will use YOUR logged-in LinkedIn session to perform actions.
                </p>
              </div>
            </div>
            <Button
              onClick={handleConnectLinkedIn}
              disabled={isConnecting}
              className="w-full bg-[#0A66C2] hover:bg-[#004182]"
            >
              <Link2 className="h-4 w-4 mr-2" />
              {isConnecting ? "Connecting..." : "Connect LinkedIn Account"}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
