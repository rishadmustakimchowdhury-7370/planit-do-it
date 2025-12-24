import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Loader2, CreditCard, CheckCircle, XCircle, Eye, EyeOff, Unplug } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';

interface StripeAccount {
  id: string;
  email: string;
  name: string | null;
  livemode: boolean;
  connectedAt: string;
}

export function StripeConnectCard() {
  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  const [connected, setConnected] = useState(false);
  const [account, setAccount] = useState<StripeAccount | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  
  const [secretKey, setSecretKey] = useState('');
  const [publishableKey, setPublishableKey] = useState('');
  const [webhookSecret, setWebhookSecret] = useState('');
  const [showSecretKey, setShowSecretKey] = useState(false);
  const [showWebhookSecret, setShowWebhookSecret] = useState(false);

  useEffect(() => {
    checkStatus();
  }, []);

  const checkStatus = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const { data, error } = await supabase.functions.invoke('stripe-connect-auth', {
        body: { action: 'status' },
      });

      if (error) throw error;

      setConnected(data.connected);
      setAccount(data.account);
    } catch (error: any) {
      console.error('Error checking Stripe status:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleConnect = async () => {
    if (!secretKey.startsWith('sk_')) {
      toast.error('Invalid Secret Key format. It should start with sk_');
      return;
    }

    if (publishableKey && !publishableKey.startsWith('pk_')) {
      toast.error('Invalid Publishable Key format. It should start with pk_');
      return;
    }

    setConnecting(true);
    try {
      const { data, error } = await supabase.functions.invoke('stripe-connect-auth', {
        body: {
          action: 'connect',
          stripeSecretKey: secretKey,
          stripePublishableKey: publishableKey || null,
          stripeWebhookSecret: webhookSecret || null,
        },
      });

      if (error) throw error;
      if (data.error) throw new Error(data.error);

      toast.success('Stripe connected successfully!');
      setConnected(true);
      setAccount(data.account);
      setDialogOpen(false);
      
      // Clear form
      setSecretKey('');
      setPublishableKey('');
      setWebhookSecret('');
    } catch (error: any) {
      toast.error(error.message || 'Failed to connect Stripe');
    } finally {
      setConnecting(false);
    }
  };

  const handleDisconnect = async () => {
    setDisconnecting(true);
    try {
      const { data, error } = await supabase.functions.invoke('stripe-connect-auth', {
        body: { action: 'disconnect' },
      });

      if (error) throw error;
      if (data.error) throw new Error(data.error);

      toast.success('Stripe disconnected');
      setConnected(false);
      setAccount(null);
    } catch (error: any) {
      toast.error(error.message || 'Failed to disconnect Stripe');
    } finally {
      setDisconnecting(false);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="flex justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <CreditCard className="h-5 w-5" />
          Stripe Integration
        </CardTitle>
        <CardDescription>
          Connect your Stripe account to enable payment processing
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {connected && account ? (
          <div className="space-y-4">
            <div className="flex items-center gap-3 p-4 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-800">
              <CheckCircle className="h-8 w-8 text-green-600" />
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-medium">Connected to Stripe</span>
                  <Badge variant={account.livemode ? "default" : "secondary"}>
                    {account.livemode ? "Live" : "Test"}
                  </Badge>
                </div>
                <p className="text-sm text-muted-foreground">
                  {account.name || account.email}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  Account ID: {account.id}
                </p>
                {account.connectedAt && (
                  <p className="text-xs text-muted-foreground">
                    Connected: {new Date(account.connectedAt).toLocaleDateString()}
                  </p>
                )}
              </div>
            </div>

            <div className="flex gap-2">
              <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                <DialogTrigger asChild>
                  <Button variant="outline">Update Credentials</Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-md">
                  <DialogHeader>
                    <DialogTitle>Update Stripe Credentials</DialogTitle>
                    <DialogDescription>
                      Update your Stripe API keys to change accounts or refresh credentials
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4 py-4">
                    <div className="space-y-2">
                      <Label htmlFor="secretKey">Secret Key *</Label>
                      <div className="relative">
                        <Input
                          id="secretKey"
                          type={showSecretKey ? "text" : "password"}
                          value={secretKey}
                          onChange={(e) => setSecretKey(e.target.value)}
                          placeholder="sk_live_... or sk_test_..."
                          className="pr-10"
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="absolute right-0 top-0 h-full"
                          onClick={() => setShowSecretKey(!showSecretKey)}
                        >
                          {showSecretKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </Button>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="publishableKey">Publishable Key</Label>
                      <Input
                        id="publishableKey"
                        value={publishableKey}
                        onChange={(e) => setPublishableKey(e.target.value)}
                        placeholder="pk_live_... or pk_test_..."
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="webhookSecret">Webhook Secret</Label>
                      <div className="relative">
                        <Input
                          id="webhookSecret"
                          type={showWebhookSecret ? "text" : "password"}
                          value={webhookSecret}
                          onChange={(e) => setWebhookSecret(e.target.value)}
                          placeholder="whsec_..."
                          className="pr-10"
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="absolute right-0 top-0 h-full"
                          onClick={() => setShowWebhookSecret(!showWebhookSecret)}
                        >
                          {showWebhookSecret ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </Button>
                      </div>
                    </div>
                  </div>
                  <DialogFooter>
                    <Button onClick={handleConnect} disabled={connecting || !secretKey}>
                      {connecting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                      Update Connection
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>

              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="destructive" disabled={disconnecting}>
                    {disconnecting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                    <Unplug className="h-4 w-4 mr-2" />
                    Disconnect
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Disconnect Stripe?</AlertDialogTitle>
                    <AlertDialogDescription>
                      This will disable payment processing. Users won't be able to make purchases until you reconnect.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={handleDisconnect} className="bg-destructive text-destructive-foreground">
                      Disconnect
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center gap-3 p-4 bg-muted/50 rounded-lg border">
              <XCircle className="h-8 w-8 text-muted-foreground" />
              <div>
                <span className="font-medium">Not Connected</span>
                <p className="text-sm text-muted-foreground">
                  Connect your Stripe account to accept payments
                </p>
              </div>
            </div>

            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
              <DialogTrigger asChild>
                <Button className="w-full">
                  <CreditCard className="h-4 w-4 mr-2" />
                  Connect Stripe Account
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-md">
                <DialogHeader>
                  <DialogTitle>Connect Stripe Account</DialogTitle>
                  <DialogDescription>
                    Enter your Stripe API keys to enable payment processing. You can find these in your{' '}
                    <a 
                      href="https://dashboard.stripe.com/apikeys" 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="text-primary underline"
                    >
                      Stripe Dashboard
                    </a>
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label htmlFor="secretKey">Secret Key *</Label>
                    <div className="relative">
                      <Input
                        id="secretKey"
                        type={showSecretKey ? "text" : "password"}
                        value={secretKey}
                        onChange={(e) => setSecretKey(e.target.value)}
                        placeholder="sk_live_... or sk_test_..."
                        className="pr-10"
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="absolute right-0 top-0 h-full"
                        onClick={() => setShowSecretKey(!showSecretKey)}
                      >
                        {showSecretKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </Button>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Required. This key is used for server-side API calls.
                    </p>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="publishableKey">Publishable Key</Label>
                    <Input
                      id="publishableKey"
                      value={publishableKey}
                      onChange={(e) => setPublishableKey(e.target.value)}
                      placeholder="pk_live_... or pk_test_..."
                    />
                    <p className="text-xs text-muted-foreground">
                      Optional. Used for client-side Stripe.js integration.
                    </p>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="webhookSecret">Webhook Secret</Label>
                    <div className="relative">
                      <Input
                        id="webhookSecret"
                        type={showWebhookSecret ? "text" : "password"}
                        value={webhookSecret}
                        onChange={(e) => setWebhookSecret(e.target.value)}
                        placeholder="whsec_..."
                        className="pr-10"
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="absolute right-0 top-0 h-full"
                        onClick={() => setShowWebhookSecret(!showWebhookSecret)}
                      >
                        {showWebhookSecret ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </Button>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Optional. Required for webhook signature verification.
                    </p>
                  </div>
                </div>
                <DialogFooter>
                  <Button onClick={handleConnect} disabled={connecting || !secretKey}>
                    {connecting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                    Connect
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
