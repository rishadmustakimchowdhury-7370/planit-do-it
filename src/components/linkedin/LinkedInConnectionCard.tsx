import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Separator } from '@/components/ui/separator';
import { 
  Linkedin, 
  Link2, 
  Unlink, 
  Check, 
  AlertCircle, 
  Loader2,
  ExternalLink,
  Info
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth';
import { toast } from 'sonner';
import { format } from 'date-fns';

interface LinkedInConnection {
  id: string;
  linkedin_profile_id: string | null;
  linkedin_profile_url: string | null;
  linkedin_name: string | null;
  linkedin_email: string | null;
  linkedin_avatar_url: string | null;
  is_connected: boolean;
  connected_at: string | null;
}

export function LinkedInConnectionCard() {
  const { user, tenantId } = useAuth();
  const [connection, setConnection] = useState<LinkedInConnection | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isDisconnecting, setIsDisconnecting] = useState(false);

  useEffect(() => {
    if (user?.id && tenantId) {
      fetchConnection();
    }
  }, [user?.id, tenantId]);

  const fetchConnection = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('linkedin_connections')
        .select('*')
        .eq('user_id', user?.id)
        .eq('tenant_id', tenantId)
        .maybeSingle();

      if (error && error.code !== 'PGRST116') throw error;
      setConnection(data);
    } catch (error) {
      console.error('Error fetching LinkedIn connection:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleConnect = async () => {
    if (!user?.id || !tenantId) {
      toast.error('You must be logged in');
      return;
    }

    setIsConnecting(true);
    try {
      // For now, we'll simulate a manual connection since LinkedIn OAuth requires
      // app verification for messaging APIs
      // In a real implementation, this would redirect to LinkedIn OAuth

      // Create or update the connection record
      const { error } = await supabase
        .from('linkedin_connections')
        .upsert({
          user_id: user.id,
          tenant_id: tenantId,
          is_connected: true,
          connected_at: new Date().toISOString(),
        }, {
          onConflict: 'user_id,tenant_id'
        });

      if (error) throw error;

      toast.success('LinkedIn account connected! You can now track your outreach.');
      fetchConnection();
    } catch (error) {
      console.error('Error connecting LinkedIn:', error);
      toast.error('Failed to connect LinkedIn');
    } finally {
      setIsConnecting(false);
    }
  };

  const handleDisconnect = async () => {
    if (!connection?.id) return;

    setIsDisconnecting(true);
    try {
      const { error } = await supabase
        .from('linkedin_connections')
        .update({
          is_connected: false,
          disconnected_at: new Date().toISOString(),
        })
        .eq('id', connection.id);

      if (error) throw error;

      toast.success('LinkedIn account disconnected');
      fetchConnection();
    } catch (error) {
      console.error('Error disconnecting LinkedIn:', error);
      toast.error('Failed to disconnect LinkedIn');
    } finally {
      setIsDisconnecting(false);
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  const isConnected = connection?.is_connected;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-[#0077B5]/10">
              <Linkedin className="w-6 h-6 text-[#0077B5]" />
            </div>
            <div>
              <CardTitle className="text-lg">LinkedIn Connection</CardTitle>
              <CardDescription>
                Connect your LinkedIn account to track outreach
              </CardDescription>
            </div>
          </div>
          <Badge variant={isConnected ? 'default' : 'secondary'} className="gap-1">
            {isConnected ? (
              <>
                <Check className="w-3 h-3" />
                Connected
              </>
            ) : (
              <>
                <AlertCircle className="w-3 h-3" />
                Not Connected
              </>
            )}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {isConnected && connection ? (
          <>
            <div className="flex items-center gap-4 p-3 rounded-lg bg-muted/50">
              <Avatar className="h-12 w-12">
                {connection.linkedin_avatar_url ? (
                  <AvatarImage src={connection.linkedin_avatar_url} />
                ) : null}
                <AvatarFallback className="bg-[#0077B5] text-white">
                  <Linkedin className="w-6 h-6" />
                </AvatarFallback>
              </Avatar>
              <div className="flex-1">
                <p className="font-medium">
                  {connection.linkedin_name || user?.email || 'LinkedIn User'}
                </p>
                {connection.linkedin_email && (
                  <p className="text-sm text-muted-foreground">{connection.linkedin_email}</p>
                )}
                {connection.connected_at && (
                  <p className="text-xs text-muted-foreground">
                    Connected {format(new Date(connection.connected_at), 'PPP')}
                  </p>
                )}
              </div>
              {connection.linkedin_profile_url && (
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-2"
                  onClick={() => window.open(connection.linkedin_profile_url!, '_blank')}
                >
                  <ExternalLink className="w-4 h-4" />
                  View Profile
                </Button>
              )}
            </div>

            <Separator />

            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">
                Your LinkedIn account is connected for outreach tracking.
              </p>
              <Button
                variant="destructive"
                size="sm"
                onClick={handleDisconnect}
                disabled={isDisconnecting}
                className="gap-2"
              >
                {isDisconnecting ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Unlink className="w-4 h-4" />
                )}
                Disconnect
              </Button>
            </div>
          </>
        ) : (
          <>
            <Alert>
              <Info className="w-4 h-4" />
              <AlertDescription className="text-sm">
                <strong>How it works:</strong> LinkedIn's API doesn't allow automated messaging or connection requests.
                By connecting your account, you enable tracking of your manual outreach activity within this CRM.
                Messages are composed here, then you copy and send them directly on LinkedIn.
              </AlertDescription>
            </Alert>

            <div className="space-y-3">
              <h4 className="text-sm font-medium">Benefits of connecting:</h4>
              <ul className="text-sm text-muted-foreground space-y-2">
                <li className="flex items-start gap-2">
                  <Check className="w-4 h-4 text-green-500 mt-0.5" />
                  <span>One-click to open candidate LinkedIn profiles</span>
                </li>
                <li className="flex items-start gap-2">
                  <Check className="w-4 h-4 text-green-500 mt-0.5" />
                  <span>Pre-composed messages with placeholders</span>
                </li>
                <li className="flex items-start gap-2">
                  <Check className="w-4 h-4 text-green-500 mt-0.5" />
                  <span>Track all your LinkedIn outreach in one place</span>
                </li>
                <li className="flex items-start gap-2">
                  <Check className="w-4 h-4 text-green-500 mt-0.5" />
                  <span>Analytics on your messaging activity</span>
                </li>
              </ul>
            </div>

            <Button
              onClick={handleConnect}
              disabled={isConnecting}
              className="w-full gap-2 bg-[#0077B5] hover:bg-[#005885]"
            >
              {isConnecting ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Link2 className="w-4 h-4" />
              )}
              Connect LinkedIn Account
            </Button>
          </>
        )}
      </CardContent>
    </Card>
  );
}