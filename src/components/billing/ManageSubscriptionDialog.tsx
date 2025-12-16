import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { 
  Crown, 
  Sparkles, 
  Zap, 
  CheckCircle, 
  XCircle,
  ArrowUpRight,
  Loader2,
  AlertTriangle
} from 'lucide-react';
import { format } from 'date-fns';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface SubscriptionPlan {
  id: string;
  name: string;
  slug: string;
  max_users: number | null;
  max_jobs: number | null;
  max_candidates: number | null;
  match_credits_monthly: number | null;
  price_monthly: number;
  stripe_price_id_monthly: string | null;
  features: any;
  description: string | null;
}

interface Tenant {
  id: string;
  name: string;
  subscription_status: string | null;
  subscription_ends_at: string | null;
  match_credits_remaining: number | null;
  match_credits_limit: number | null;
  subscription_plan_id: string | null;
}

interface ManageSubscriptionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentPlan: SubscriptionPlan | null;
  tenant: Tenant | null;
  allPlans: SubscriptionPlan[];
  onUpgrade: (plan: SubscriptionPlan) => void;
  onRefresh: () => void;
}

const planIcons: Record<string, any> = {
  starter: Zap,
  pro: Sparkles,
  agency: Crown,
};

export function ManageSubscriptionDialog({
  open,
  onOpenChange,
  currentPlan,
  tenant,
  allPlans,
  onUpgrade,
  onRefresh,
}: ManageSubscriptionDialogProps) {
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);

  const PlanIcon = currentPlan ? planIcons[currentPlan.slug] || Zap : Zap;

  const handleCancelSubscription = async () => {
    setIsCancelling(true);
    try {
      // Call edge function to cancel subscription
      const { data, error } = await supabase.functions.invoke('cancel-subscription', {});

      if (error) throw error;

      toast.success('Subscription cancelled successfully. You will have access until the end of your billing period.');
      setShowCancelConfirm(false);
      onOpenChange(false);
      onRefresh();
    } catch (error: any) {
      console.error('Cancel error:', error);
      toast.error(error.message || 'Failed to cancel subscription');
    } finally {
      setIsCancelling(false);
    }
  };

  const upgradePlans = allPlans.filter(plan => {
    if (!currentPlan) return true;
    return plan.price_monthly > currentPlan.price_monthly;
  });

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Manage Subscription</DialogTitle>
            <DialogDescription>
              View your current plan, upgrade, or cancel your subscription
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6 py-4">
            {/* Current Plan Section */}
            <div>
              <h3 className="text-sm font-medium text-muted-foreground mb-3">Current Plan</h3>
              <Card className="border-primary/50">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-lg bg-primary/10">
                        <PlanIcon className="h-5 w-5 text-primary" />
                      </div>
                      <div>
                        <p className="font-semibold text-lg">{currentPlan?.name || 'Free'} Plan</p>
                        <p className="text-sm text-muted-foreground">
                          ${currentPlan?.price_monthly || 0}/month
                        </p>
                      </div>
                    </div>
                    <Badge variant="outline" className="capitalize">
                      {tenant?.subscription_status || 'trial'}
                    </Badge>
                  </div>

                  <Separator className="my-4" />

                  {/* Plan Features */}
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div className="flex items-center gap-2">
                      <CheckCircle className="h-4 w-4 text-success" />
                      <span>{currentPlan?.max_users === -1 ? 'Unlimited' : currentPlan?.max_users || 1} Team Members</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <CheckCircle className="h-4 w-4 text-success" />
                      <span>{currentPlan?.max_jobs === -1 ? 'Unlimited' : currentPlan?.max_jobs || 5} Jobs</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <CheckCircle className="h-4 w-4 text-success" />
                      <span>{currentPlan?.max_candidates === -1 ? 'Unlimited' : currentPlan?.max_candidates || 100} Candidates</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <CheckCircle className="h-4 w-4 text-success" />
                      <span>{currentPlan?.match_credits_monthly || 10} AI Credits/mo</span>
                    </div>
                  </div>

                  {/* Billing Info */}
                  {tenant?.subscription_ends_at && (
                    <div className="mt-4 p-3 bg-muted/50 rounded-lg text-sm">
                      <p className="text-muted-foreground">
                        {tenant.subscription_status === 'canceled' 
                          ? `Access ends on ${format(new Date(tenant.subscription_ends_at), 'MMMM d, yyyy')}`
                          : `Next billing date: ${format(new Date(tenant.subscription_ends_at), 'MMMM d, yyyy')}`
                        }
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Upgrade Options */}
            {upgradePlans.length > 0 && (
              <div>
                <h3 className="text-sm font-medium text-muted-foreground mb-3">Upgrade Options</h3>
                <div className="space-y-2">
                  {upgradePlans.map((plan) => {
                    const Icon = planIcons[plan.slug] || Zap;
                    return (
                      <Card key={plan.id} className="hover:border-accent transition-colors">
                        <CardContent className="p-4">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <div className="p-2 rounded-lg bg-accent/10">
                                <Icon className="h-4 w-4 text-accent" />
                              </div>
                              <div>
                                <p className="font-medium">{plan.name}</p>
                                <p className="text-sm text-muted-foreground">
                                  ${plan.price_monthly}/month
                                </p>
                              </div>
                            </div>
                            <Button 
                              size="sm" 
                              onClick={() => {
                                onOpenChange(false);
                                onUpgrade(plan);
                              }}
                            >
                              <ArrowUpRight className="h-4 w-4 mr-1" />
                              Upgrade
                            </Button>
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Cancel Subscription */}
            {currentPlan && tenant?.subscription_status !== 'canceled' && tenant?.subscription_status !== 'trial' && (
              <div>
                <Separator className="mb-4" />
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium text-sm">Cancel Subscription</p>
                    <p className="text-xs text-muted-foreground">
                      You'll retain access until the end of your billing period
                    </p>
                  </div>
                  <Button 
                    variant="outline" 
                    size="sm"
                    className="text-destructive hover:text-destructive hover:bg-destructive/10"
                    onClick={() => setShowCancelConfirm(true)}
                  >
                    <XCircle className="h-4 w-4 mr-1" />
                    Cancel Plan
                  </Button>
                </div>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Cancel Confirmation Dialog */}
      <AlertDialog open={showCancelConfirm} onOpenChange={setShowCancelConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-warning" />
              Cancel Subscription?
            </AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to cancel your {currentPlan?.name} subscription? 
              You'll continue to have access until{' '}
              {tenant?.subscription_ends_at 
                ? format(new Date(tenant.subscription_ends_at), 'MMMM d, yyyy')
                : 'the end of your billing period'
              }.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isCancelling}>Keep Subscription</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleCancelSubscription}
              disabled={isCancelling}
              className="bg-destructive hover:bg-destructive/90"
            >
              {isCancelling ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Cancelling...
                </>
              ) : (
                'Yes, Cancel Subscription'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
