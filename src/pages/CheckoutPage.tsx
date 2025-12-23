import { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Input } from '@/components/ui/input';
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
  Crown,
  Tag,
  X
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

interface PromoCodeValidation {
  valid: boolean;
  code: string;
  discount_type: string;
  discount_value: number;
  discount_amount: number;
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
  const [promoCode, setPromoCode] = useState('');
  const [validatingPromo, setValidatingPromo] = useState(false);
  const [appliedPromo, setAppliedPromo] = useState<PromoCodeValidation | null>(null);

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

  const validatePromoCode = async () => {
    if (!promoCode.trim() || !plan) return;
    
    setValidatingPromo(true);
    try {
      const { data, error } = await supabase
        .from('promo_codes')
        .select('*')
        .eq('code', promoCode.toUpperCase().trim())
        .eq('is_active', true)
        .single();

      if (error || !data) {
        toast.error('Invalid promo code');
        return;
      }

      // Check validity
      const now = new Date();
      const validUntil = data.valid_until ? new Date(data.valid_until) : null;
      const withinUsageLimit = !data.max_uses || data.uses_count < data.max_uses;
      
      if (!withinUsageLimit) {
        toast.error('Promo code has reached its usage limit');
        return;
      }
      
      if (validUntil && validUntil < now) {
        toast.error('Promo code has expired');
        return;
      }

      // Calculate discount
      let discountAmount = 0;
      if (data.discount_type === 'percentage') {
        discountAmount = (plan.price_monthly * data.discount_value) / 100;
      } else {
        discountAmount = Math.min(data.discount_value, plan.price_monthly);
      }

      setAppliedPromo({
        valid: true,
        code: data.code,
        discount_type: data.discount_type,
        discount_value: data.discount_value,
        discount_amount: discountAmount,
      });
      
      toast.success(`Promo code applied! You save £${discountAmount.toFixed(2)}`);
    } catch (error: any) {
      toast.error('Failed to validate promo code');
    } finally {
      setValidatingPromo(false);
    }
  };

  const removePromoCode = () => {
    setAppliedPromo(null);
    setPromoCode('');
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
        body: { planId, billingCycle: 'monthly', promoCode: appliedPromo?.code }
      });

      if (error) throw error;
      
       if (data?.url) {
         const isInIframe = (() => {
           try {
             return window.self !== window.top;
           } catch {
             return true;
           }
         })();

         if (isInIframe) {
           const w = window.open(data.url, '_blank', 'noopener,noreferrer');
           if (!w) {
             toast.error('Popup blocked. Please allow popups to open checkout.');
             setProcessing(false);
           }
         } else {
           window.location.href = data.url;
         }
       } else {
         throw new Error('No checkout URL returned');
       }
    } catch (error: any) {
      console.error('Checkout error:', error);
      toast.error(error.message || 'Failed to start checkout');
      setProcessing(false);
    }
  };

  const finalPrice = plan ? (appliedPromo ? plan.price_monthly - appliedPromo.discount_amount : plan.price_monthly) : 0;

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
                {/* Promo Code */}
                <div className="space-y-2">
                  <label className="text-sm font-medium">Promo Code</label>
                  {appliedPromo ? (
                    <div className="flex items-center gap-2 p-2 bg-success/10 rounded-lg border border-success/30">
                      <Tag className="h-4 w-4 text-success" />
                      <span className="text-sm font-medium text-success">{appliedPromo.code}</span>
                      <span className="text-sm text-muted-foreground">
                        -{appliedPromo.discount_type === 'percentage' ? `${appliedPromo.discount_value}%` : `£${appliedPromo.discount_value}`}
                      </span>
                      <Button variant="ghost" size="icon" className="h-6 w-6 ml-auto" onClick={removePromoCode}>
                        <X className="h-3 w-3" />
                      </Button>
                    </div>
                  ) : (
                    <div className="flex gap-2">
                      <Input
                        placeholder="Enter code"
                        value={promoCode}
                        onChange={(e) => setPromoCode(e.target.value.toUpperCase())}
                        className="font-mono"
                      />
                      <Button 
                        variant="outline" 
                        onClick={validatePromoCode}
                        disabled={!promoCode.trim() || validatingPromo}
                      >
                        {validatingPromo ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Apply'}
                      </Button>
                    </div>
                  )}
                </div>

                <Separator />

                {/* Price Breakdown */}
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>{plan.name} Plan (Monthly)</span>
                    <span>£{plan.price_monthly.toFixed(2)}</span>
                  </div>
                  {appliedPromo && (
                    <div className="flex justify-between text-sm text-success">
                      <span>Discount ({appliedPromo.code})</span>
                      <span>-£{appliedPromo.discount_amount.toFixed(2)}</span>
                    </div>
                  )}
                </div>

                <Separator />

                <div className="flex justify-between font-semibold text-lg">
                  <span>Total</span>
                  <span>£{finalPrice.toFixed(2)} GBP/month</span>
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
