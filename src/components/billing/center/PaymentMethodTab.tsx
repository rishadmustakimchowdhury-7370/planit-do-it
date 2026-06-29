import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { CreditCard, ExternalLink, Loader2 } from 'lucide-react';
import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useStripePaymentMethod } from '@/hooks/useBillingCenter';
import { toast } from 'sonner';

export function PaymentMethodTab() {
  const { paymentMethod, loading, refresh } = useStripePaymentMethod();
  const [opening, setOpening] = useState(false);

  const openPortal = async () => {
    setOpening(true);
    try {
      const { data, error } = await supabase.functions.invoke('customer-portal');
      if (error) throw error;
      if ((data as any)?.url) window.location.href = (data as any).url;
    } catch (e: any) {
      toast.error(e?.message ?? 'Unable to open the customer portal');
    } finally { setOpening(false); }
  };

  if (loading) return <Skeleton className="h-48" />;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Payment Method</CardTitle>
        <CardDescription>Card data is handled by Stripe. Use the Customer Portal to add or change cards.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {paymentMethod ? (
          <div className="flex items-center gap-4 rounded-lg border p-5 bg-muted/30">
            <div className="p-3 rounded-md bg-background border"><CreditCard className="h-6 w-6" /></div>
            <div className="flex-1">
              <div className="font-medium uppercase">{paymentMethod.brand} •••• {paymentMethod.last4}</div>
              <div className="text-sm text-muted-foreground">Expires {String(paymentMethod.exp_month).padStart(2,'0')}/{paymentMethod.exp_year}</div>
            </div>
            <span className="text-xs px-2 py-0.5 rounded-full bg-success/10 text-success border border-success/30">Default</span>
          </div>
        ) : (
          <div className="rounded-lg border-2 border-dashed p-8 text-center">
            <CreditCard className="h-10 w-10 mx-auto text-muted-foreground" />
            <div className="mt-3 font-medium">No payment method on file</div>
            <div className="text-sm text-muted-foreground">Add a card via the Stripe Customer Portal.</div>
          </div>
        )}
        <div className="flex gap-2">
          <Button onClick={openPortal} disabled={opening}>
            {opening ? <Loader2 className="h-4 w-4 animate-spin" /> : <ExternalLink className="h-4 w-4" />}
            Manage in Stripe Portal
          </Button>
          <Button variant="ghost" onClick={refresh}>Refresh</Button>
        </div>
      </CardContent>
    </Card>
  );
}
