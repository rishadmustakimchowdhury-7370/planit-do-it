import { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth';
import { toast } from 'sonner';
import { 
  Check, 
  Shield, 
  Lock, 
  CreditCard, 
  Loader2, 
  ArrowLeft,
  Zap
} from 'lucide-react';

interface SubscriptionPlan {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  price_monthly: number;
  price_yearly: number;
  features: any;
  max_users: number | null;
  max_jobs: number | null;
  max_candidates: number | null;
  match_credits_monthly: number | null;
}

export default function CheckoutPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user, isLoading: authLoading } = useAuth();
  
  const planId = searchParams.get('plan');
  const cycle = searchParams.get('cycle') || 'monthly';
  
  const [plan, setPlan] = useState<SubscriptionPlan | null>(null);
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'yearly'>(cycle as 'monthly' | 'yearly');
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);

  useEffect(() => {
    if (planId) {
      fetchPlan();
    } else {
      navigate('/pricing');
    }
  }, [planId]);

  const fetchPlan = async () => {
    try {
      const { data, error } = await supabase
        .from('subscription_plans')
        .select('*')
        .eq('id', planId)
        .single();

      if (error) throw error;
      setPlan(data);
    } catch (error: any) {
      toast.error('Failed to load plan details');
      navigate('/pricing');
    } finally {
      setLoading(false);
    }
  };

  const handleCheckout = async () => {
    if (!user) {
      toast.error('Please log in to continue');
      navigate('/auth?redirect=/checkout?plan=' + planId + '&cycle=' + billingCycle);
      return;
    }

    setProcessing(true);
    try {
      const { data, error } = await supabase.functions.invoke('create-checkout', {
        body: { planId, billingCycle }
      });

      if (error) throw error;
      
      if (data?.url) {
        // Open Stripe checkout
        window.location.href = data.url;
      } else {
        throw new Error('No checkout URL returned');
      }
    } catch (error: any) {
      console.error('Checkout error:', error);
      toast.error(error.message || 'Failed to start checkout');
      setProcessing(false);
    }
  };

  const price = billingCycle === 'yearly' ? plan?.price_yearly : plan?.price_monthly;
  const monthlyEquivalent = billingCycle === 'yearly' && plan ? (plan.price_yearly / 12).toFixed(2) : null;
  const savings = plan ? ((plan.price_monthly * 12 - plan.price_yearly) / (plan.price_monthly * 12) * 100).toFixed(0) : 0;

  if (loading || authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!plan) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/30">
      <div className="container max-w-5xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <Button 
            variant="ghost" 
            onClick={() => navigate('/pricing')}
            className="mb-4"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Pricing
          </Button>
          <h1 className="text-3xl font-bold">Complete Your Purchase</h1>
          <p className="text-muted-foreground mt-1">Secure checkout powered by Stripe</p>
        </div>

        <div className="grid lg:grid-cols-5 gap-8">
          {/* Order Summary */}
          <div className="lg:col-span-3 space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Order Summary</CardTitle>
                <CardDescription>Review your subscription details</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Plan Details */}
                <div className="flex items-start justify-between p-4 bg-muted/50 rounded-lg">
                  <div className="flex items-center gap-4">
                    <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center">
                      <Zap className="h-6 w-6 text-primary" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-lg">{plan.name} Plan</h3>
                      <p className="text-sm text-muted-foreground">{plan.description}</p>
                    </div>
                  </div>
                  <Badge variant="secondary">{billingCycle === 'yearly' ? 'Annual' : 'Monthly'}</Badge>
                </div>

                {/* Billing Cycle Toggle */}
                <div>
                  <label className="text-sm font-medium mb-2 block">Billing Cycle</label>
                  <div className="flex gap-2">
                    <Button
                      variant={billingCycle === 'monthly' ? 'default' : 'outline'}
                      onClick={() => setBillingCycle('monthly')}
                      className="flex-1"
                    >
                      Monthly
                      <span className="ml-2 text-muted-foreground">${plan.price_monthly}/mo</span>
                    </Button>
                    <Button
                      variant={billingCycle === 'yearly' ? 'default' : 'outline'}
                      onClick={() => setBillingCycle('yearly')}
                      className="flex-1 relative"
                    >
                      Yearly
                      <span className="ml-2 text-muted-foreground">${plan.price_yearly}/yr</span>
                      {Number(savings) > 0 && (
                        <Badge className="absolute -top-2 -right-2 bg-green-500">
                          Save {savings}%
                        </Badge>
                      )}
                    </Button>
                  </div>
                </div>

                <Separator />

                {/* Features Included */}
                <div>
                  <h4 className="font-medium mb-3">Features Included</h4>
                  <div className="grid sm:grid-cols-2 gap-2">
                    {Array.isArray(plan.features) && plan.features.map((feature, i) => (
                      <div key={i} className="flex items-center gap-2 text-sm">
                        <Check className="h-4 w-4 text-green-500 shrink-0" />
                        <span>{feature}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Limits */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 p-4 bg-muted/30 rounded-lg">
                  <div className="text-center">
                    <div className="text-2xl font-bold text-primary">
                      {plan.max_users === -1 ? '∞' : plan.max_users}
                    </div>
                    <div className="text-xs text-muted-foreground">Team Members</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-primary">
                      {plan.max_jobs === -1 ? '∞' : plan.max_jobs}
                    </div>
                    <div className="text-xs text-muted-foreground">Active Jobs</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-primary">
                      {plan.max_candidates === -1 ? '∞' : plan.max_candidates}
                    </div>
                    <div className="text-xs text-muted-foreground">Candidates</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-primary">
                      {plan.match_credits_monthly}
                    </div>
                    <div className="text-xs text-muted-foreground">AI Credits/mo</div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Payment Summary */}
          <div className="lg:col-span-2">
            <Card className="sticky top-8">
              <CardHeader>
                <CardTitle>Payment Details</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Price Breakdown */}
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>{plan.name} Plan ({billingCycle})</span>
                    <span>${price?.toFixed(2)}</span>
                  </div>
                  {billingCycle === 'yearly' && monthlyEquivalent && (
                    <div className="flex justify-between text-sm text-muted-foreground">
                      <span>Monthly equivalent</span>
                      <span>${monthlyEquivalent}/mo</span>
                    </div>
                  )}
                </div>

                <Separator />

                <div className="flex justify-between font-semibold text-lg">
                  <span>Total</span>
                  <span>${price?.toFixed(2)} USD</span>
                </div>

                {billingCycle === 'yearly' && Number(savings) > 0 && (
                  <div className="p-3 bg-green-500/10 border border-green-500/20 rounded-lg">
                    <p className="text-sm text-green-600 dark:text-green-400 font-medium">
                      You save ${(plan.price_monthly * 12 - plan.price_yearly).toFixed(2)} with annual billing!
                    </p>
                  </div>
                )}

                {/* Checkout Button */}
                <Button 
                  className="w-full h-12 text-lg" 
                  onClick={handleCheckout}
                  disabled={processing}
                >
                  {processing ? (
                    <>
                      <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                      Processing...
                    </>
                  ) : (
                    <>
                      <CreditCard className="h-5 w-5 mr-2" />
                      Complete Secure Payment
                    </>
                  )}
                </Button>

                {/* Trust Signals */}
                <div className="space-y-3 pt-4">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Lock className="h-4 w-4" />
                    <span>256-bit SSL encrypted checkout</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Shield className="h-4 w-4" />
                    <span>Secure payment via Stripe</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Check className="h-4 w-4" />
                    <span>Cancel anytime, no hidden fees</span>
                  </div>
                </div>

                {/* Stripe Badge */}
                <div className="pt-4 flex justify-center">
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <span>Powered by</span>
                    <span className="font-semibold">Stripe</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
