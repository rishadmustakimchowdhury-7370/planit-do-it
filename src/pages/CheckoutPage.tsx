import { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth';
import { toast } from 'sonner';
import { Logo } from '@/components/brand/Logo';
import { 
  Check, 
  Shield, 
  Lock, 
  CreditCard, 
  Loader2, 
  ArrowLeft,
  Zap,
  Sparkles,
  Crown
} from 'lucide-react';

interface SubscriptionPlan {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  price_monthly: number;
  features: any;
  max_users: number | null;
  max_jobs: number | null;
  max_candidates: number | null;
  match_credits_monthly: number | null;
}

const planIcons: Record<string, any> = {
  starter: Zap,
  pro: Sparkles,
  agency: Crown,
};

export default function CheckoutPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user, isLoading: authLoading } = useAuth();
  
  const planId = searchParams.get('plan');
  
  const [plan, setPlan] = useState<SubscriptionPlan | null>(null);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);

  useEffect(() => {
    if (planId) {
      fetchPlan();
    } else {
      navigate('/billing');
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
      navigate('/billing');
    } finally {
      setLoading(false);
    }
  };

  const handleCheckout = async () => {
    if (!user) {
      toast.error('Please log in to continue');
      navigate('/auth?redirect=/checkout?plan=' + planId);
      return;
    }

    setProcessing(true);
    try {
      const { data, error } = await supabase.functions.invoke('create-checkout', {
        body: { planId, billingCycle: 'monthly' }
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

  const Icon = planIcons[plan.slug] || Zap;

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/30">
      <div className="container max-w-5xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <Button 
              variant="ghost" 
              onClick={() => navigate('/billing')}
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Billing
            </Button>
            <Logo size="md" />
          </div>
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
                      <Icon className="h-6 w-6 text-primary" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-lg">{plan.name} Plan</h3>
                      <p className="text-sm text-muted-foreground">{plan.description}</p>
                    </div>
                  </div>
                  <Badge variant="secondary">Monthly</Badge>
                </div>

                <Separator />

                {/* Features Included */}
                <div>
                  <h4 className="font-medium mb-3">Features Included</h4>
                  <div className="grid sm:grid-cols-2 gap-2">
                    <div className="flex items-center gap-2 text-sm">
                      <Check className="h-4 w-4 text-green-500 shrink-0" />
                      <span>{plan.max_users === -1 ? 'Unlimited' : plan.max_users} Team Members</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                      <Check className="h-4 w-4 text-green-500 shrink-0" />
                      <span>{plan.max_jobs === -1 ? 'Unlimited' : plan.max_jobs} Active Jobs</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                      <Check className="h-4 w-4 text-green-500 shrink-0" />
                      <span>{plan.max_candidates === -1 ? 'Unlimited' : plan.max_candidates} Candidates</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                      <Check className="h-4 w-4 text-green-500 shrink-0" />
                      <span>{plan.match_credits_monthly} AI Matches/month</span>
                    </div>
                    {Array.isArray(plan.features) && plan.features.map((feature: string, i: number) => (
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
                    <span>{plan.name} Plan (Monthly)</span>
                    <span>${plan.price_monthly.toFixed(2)}</span>
                  </div>
                </div>

                <Separator />

                <div className="flex justify-between font-semibold text-lg">
                  <span>Total</span>
                  <span>${plan.price_monthly.toFixed(2)} USD/month</span>
                </div>

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
                      Complete Payment
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
