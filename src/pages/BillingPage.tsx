import { useEffect, useRef, useState } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { 
  CreditCard, 
  Download, 
  CheckCircle, 
  Clock,
  Sparkles,
  Zap,
  Crown,
  ArrowUpRight,
  FileText,
  Loader2,
  Settings,
  AlertTriangle
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth';
import { toast } from 'sonner';
import { motion } from 'framer-motion';
import { formatCurrency } from '@/lib/currencies';
import { format } from 'date-fns';
import { ManageSubscriptionDialog } from '@/components/billing/ManageSubscriptionDialog';
import { useUsageLimits } from '@/hooks/useUsageLimits';

interface Invoice {
  id: string;
  invoice_number: string;
  amount: number;
  currency: string;
  status: string;
  created_at: string;
  due_date: string | null;
  paid_at: string | null;
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

const planIcons: Record<string, any> = {
  starter: Zap,
  pro: Sparkles,
  agency: Crown,
};

const statusColors: Record<string, string> = {
  paid: 'bg-success/10 text-success border-success/30',
  pending: 'bg-warning/10 text-warning border-warning/30',
  overdue: 'bg-destructive/10 text-destructive border-destructive/30',
  draft: 'bg-muted text-muted-foreground',
  canceled: 'bg-muted text-muted-foreground',
};

export default function BillingPage() {
  const { tenantId, user } = useAuth();
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [tenant, setTenant] = useState<Tenant | null>(null);
  const [currentPlanData, setCurrentPlanData] = useState<SubscriptionPlan | null>(null);
  const [allPlans, setAllPlans] = useState<SubscriptionPlan[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [processingPlanId, setProcessingPlanId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'plans' | 'invoices'>('plans');
  const [showManageDialog, setShowManageDialog] = useState(false);
  const { usageStats, isLoading: isLoadingUsage } = useUsageLimits();

  const plansSectionRef = useRef<HTMLDivElement | null>(null);

  const goToPlans = () => {
    setActiveTab('plans');
    setTimeout(() => {
      plansSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 0);
  };

  useEffect(() => {
    if (tenantId) {
      fetchBillingData();
    }
  }, [tenantId]);

  const fetchBillingData = async () => {
    setIsLoading(true);
    try {
      // Fetch all subscription plans
      const { data: plansData, error: plansError } = await supabase
        .from('subscription_plans')
        .select('*')
        .eq('is_active', true)
        .order('display_order');

      if (!plansError && plansData) {
        setAllPlans(plansData);
      }

      // Fetch tenant subscription info with plan_id
      const { data: tenantData, error: tenantError } = await supabase
        .from('tenants')
        .select('id, name, subscription_status, subscription_ends_at, match_credits_remaining, match_credits_limit, subscription_plan_id')
        .eq('id', tenantId)
        .single();

      if (tenantError) throw tenantError;
      setTenant(tenantData);

      // Fetch the actual subscription plan details if plan_id exists
      if (tenantData?.subscription_plan_id) {
        const { data: planData, error: planError } = await supabase
          .from('subscription_plans')
          .select('*')
          .eq('id', tenantData.subscription_plan_id)
          .single();

        if (!planError && planData) {
          setCurrentPlanData(planData);
        }
      }

      // Fetch invoices
      const { data: invoicesData, error: invoicesError } = await supabase
        .from('invoices')
        .select('*')
        .eq('tenant_id', tenantId)
        .order('created_at', { ascending: false });

      if (invoicesError) throw invoicesError;
      setInvoices(invoicesData || []);
    } catch (error) {
      console.error('Error fetching billing data:', error);
      toast.error('Failed to load billing information');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDownloadInvoice = async (invoice: Invoice) => {
    toast.info(`Downloading invoice ${invoice.invoice_number}...`);
    // In a real app, this would generate/download a PDF
  };

  const handleSelectPlan = async (plan: SubscriptionPlan) => {
    if (!user) {
      toast.error('Please log in to continue');
      return;
    }

    // Check if trying to select current plan
    if (currentPlanData?.id === plan.id) {
      toast.info('You are already on this plan');
      return;
    }

    // Check if Stripe price ID is configured
    if (!plan.stripe_price_id_monthly) {
      toast.error('This plan is not available for purchase yet. Please contact support.');
      return;
    }

    setProcessingPlanId(plan.id);
    try {
      const { data, error } = await supabase.functions.invoke('create-checkout', {
        body: { planId: plan.id, billingCycle: 'monthly' }
      });

      if (error) throw error;

      if (data?.url) {
        // Use same-tab navigation to avoid popup blockers
        window.location.assign(data.url);
      } else {
        throw new Error('No checkout URL returned');
      }
    } catch (error: any) {
      console.error('Checkout error:', error);
      toast.error(error.message || 'Failed to start checkout');
    } finally {
      setProcessingPlanId(null);
    }
  };

  const handleManageSubscription = () => {
    setShowManageDialog(true);
  };

  const creditsUsed = usageStats?.usage.aiCredits.used || 0;
  const creditsLimit = usageStats?.usage.aiCredits.limit || 100;
  const creditsRemaining = usageStats?.usage.aiCredits.remaining || 0;
  const creditsPercent = usageStats?.usage.aiCredits.percent || 0;

  if (isLoading || isLoadingUsage) {
    return (
      <AppLayout title="Billing" subtitle="Manage your subscription and invoices">
        <div className="space-y-6">
          <Skeleton className="h-48 w-full" />
          <Skeleton className="h-64 w-full" />
        </div>
      </AppLayout>
    );
  }

  const PlanIcon = currentPlanData ? planIcons[currentPlanData.slug] || Zap : Zap;

  return (
    <AppLayout title="Billing" subtitle="Manage your subscription and invoices">
      <div className="space-y-6">
        {/* Current Plan Overview */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
        >
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Current Plan</CardTitle>
                  <CardDescription>
                    {tenant?.subscription_status === 'trial' 
                      ? 'You are currently on a free trial'
                      : `Your ${currentPlanData?.name || 'Free'} subscription`}
                  </CardDescription>
                </div>
                <Badge variant="outline" className="capitalize">
                  {tenant?.subscription_status || 'trial'}
                </Badge>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* Plan Details */}
                <div className="p-4 rounded-lg border bg-muted/30">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="p-2 rounded-lg bg-accent/10">
                      <PlanIcon className="h-5 w-5 text-accent" />
                    </div>
                    <div>
                      <p className="font-semibold">{currentPlanData?.name || 'Free'} Plan</p>
                      <p className="text-sm text-muted-foreground">
                        ${currentPlanData?.price_monthly || 0}/month
                      </p>
                    </div>
                  </div>
                  {/* Plan Features */}
                  <div className="space-y-1 mb-3 text-xs text-muted-foreground">
                    <p>• {currentPlanData?.max_users === -1 ? 'Unlimited' : currentPlanData?.max_users || 1} Team Members</p>
                    <p>• {currentPlanData?.max_jobs === -1 ? 'Unlimited' : currentPlanData?.max_jobs || 5} Jobs</p>
                    <p>• {currentPlanData?.match_credits_monthly || 10} AI Credits/month</p>
                  </div>
                  {(!currentPlanData || currentPlanData.slug !== 'agency') && (
                    <Button size="sm" className="w-full gap-2" onClick={goToPlans}>
                      <ArrowUpRight className="h-4 w-4" />
                      Upgrade Plan
                    </Button>
                  )}
                </div>

                {/* AI Credits */}
                <div className="p-4 rounded-lg border">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-sm font-medium">AI Match Credits</p>
                    {usageStats?.usage.aiCredits.warning && (
                      <AlertTriangle className="h-4 w-4 text-warning" />
                    )}
                  </div>
                  <div className="flex items-end gap-2 mb-2">
                    <span className="text-2xl font-bold">{creditsRemaining}</span>
                    <span className="text-muted-foreground text-sm">/ {creditsLimit === -1 ? '∞' : creditsLimit}</span>
                  </div>
                  <div className="h-2 bg-muted rounded-full overflow-hidden">
                    <div 
                      className={`h-full transition-all duration-500 ${
                        usageStats?.usage.aiCredits.blocked ? 'bg-destructive' :
                        usageStats?.usage.aiCredits.warning ? 'bg-warning' :
                        'bg-accent'
                      }`}
                      style={{ width: `${Math.min(100, creditsPercent)}%` }}
                    />
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    {creditsUsed} credits used this month
                  </p>
                  {usageStats?.usage.aiCredits.blocked && (
                    <p className="text-xs text-destructive mt-1 font-medium">
                      Limit reached - Upgrade to continue
                    </p>
                  )}
                </div>

                {/* Billing Cycle */}
                <div className="p-4 rounded-lg border">
                  <p className="text-sm font-medium mb-2">Billing Cycle</p>
                  <div className="flex items-center gap-2 mb-1">
                    <Clock className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm">
                      {tenant?.subscription_ends_at 
                        ? `Renews ${format(new Date(tenant.subscription_ends_at), 'MMM d, yyyy')}`
                        : 'No active subscription'}
                    </span>
                  </div>
                  <Button variant="outline" size="sm" className="w-full mt-2" onClick={handleManageSubscription}>
                    <Settings className="h-4 w-4 mr-2" />
                    Manage Subscription
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Plans & Invoices Tabs */}
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'plans' | 'invoices')}>
          <TabsList>
            <TabsTrigger value="plans" className="gap-2">
              <Sparkles className="h-4 w-4" />
              Available Plans
            </TabsTrigger>
            <TabsTrigger value="invoices" className="gap-2">
              <FileText className="h-4 w-4" />
              Invoices
            </TabsTrigger>
          </TabsList>

          <TabsContent value="plans" className="mt-6">
            <div ref={plansSectionRef} className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {allPlans.map((plan, i) => {
                const Icon = planIcons[plan.slug] || Zap;
                const isCurrentPlan = currentPlanData?.id === plan.id;
                const isProcessing = processingPlanId === plan.id;
                const isPopular = plan.slug === 'pro';

                return (
                  <motion.div
                    key={plan.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.3, delay: i * 0.1 }}
                  >
                    <Card className={`relative ${isPopular ? 'border-accent shadow-lg' : ''} ${isCurrentPlan ? 'ring-2 ring-primary' : ''}`}>
                      {isPopular && (
                        <div className="bg-accent text-accent-foreground text-center py-1 text-sm font-medium rounded-t-lg">
                          Most Popular
                        </div>
                      )}
                      {isCurrentPlan && (
                        <Badge className="absolute top-2 right-2 bg-primary">Current</Badge>
                      )}
                      <CardContent className="p-6">
                        <div className="flex items-center gap-3 mb-4">
                          <div className="p-2 rounded-lg bg-accent/10">
                            <Icon className="h-5 w-5 text-accent" />
                          </div>
                          <h3 className="text-xl font-semibold">{plan.name}</h3>
                        </div>
                        <div className="mb-6">
                          <span className="text-4xl font-bold">${plan.price_monthly}</span>
                          <span className="text-muted-foreground">/month</span>
                        </div>
                        <ul className="space-y-3 mb-6">
                          <li className="flex items-center gap-2 text-sm">
                            <CheckCircle className="h-4 w-4 text-success flex-shrink-0" />
                            {plan.max_users === -1 ? 'Unlimited' : plan.max_users} Team Members
                          </li>
                          <li className="flex items-center gap-2 text-sm">
                            <CheckCircle className="h-4 w-4 text-success flex-shrink-0" />
                            {plan.max_jobs === -1 ? 'Unlimited' : plan.max_jobs} Active Jobs
                          </li>
                          <li className="flex items-center gap-2 text-sm">
                            <CheckCircle className="h-4 w-4 text-success flex-shrink-0" />
                            {plan.max_candidates === -1 ? 'Unlimited' : plan.max_candidates} Candidates
                          </li>
                          <li className="flex items-center gap-2 text-sm">
                            <CheckCircle className="h-4 w-4 text-success flex-shrink-0" />
                            {plan.match_credits_monthly} AI Matches/month
                          </li>
                          {Array.isArray(plan.features) && plan.features.slice(0, 2).map((feature: string, j: number) => (
                            <li key={j} className="flex items-center gap-2 text-sm">
                              <CheckCircle className="h-4 w-4 text-success flex-shrink-0" />
                              {feature}
                            </li>
                          ))}
                        </ul>
                        <Button 
                          className="w-full" 
                          variant={isCurrentPlan ? 'outline' : isPopular ? 'default' : 'outline'}
                          disabled={isCurrentPlan || isProcessing}
                          onClick={() => handleSelectPlan(plan)}
                        >
                          {isProcessing ? (
                            <>
                              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                              Processing...
                            </>
                          ) : isCurrentPlan ? (
                            'Current Plan'
                          ) : (
                            'Choose Plan'
                          )}
                        </Button>
                      </CardContent>
                    </Card>
                  </motion.div>
                );
              })}
            </div>
          </TabsContent>

          <TabsContent value="invoices" className="mt-6">
            <Card>
              <CardHeader>
                <CardTitle>Invoice History</CardTitle>
                <CardDescription>View and download your past invoices</CardDescription>
              </CardHeader>
              <CardContent>
                {invoices.length > 0 ? (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Invoice</TableHead>
                        <TableHead>Date</TableHead>
                        <TableHead>Amount</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {invoices.map((invoice) => (
                        <TableRow key={invoice.id}>
                          <TableCell className="font-medium">{invoice.invoice_number}</TableCell>
                          <TableCell>{format(new Date(invoice.created_at), 'MMM d, yyyy')}</TableCell>
                          <TableCell>
                            {formatCurrency(invoice.amount, invoice.currency || 'USD')}
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className={statusColors[invoice.status] || statusColors.draft}>
                              {invoice.status}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            <Button 
                              variant="ghost" 
                              size="sm"
                              onClick={() => handleDownloadInvoice(invoice)}
                            >
                              <Download className="h-4 w-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                ) : (
                  <div className="text-center py-12">
                    <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                    <h3 className="font-semibold mb-2">No Invoices Yet</h3>
                    <p className="text-muted-foreground">
                      Your invoices will appear here once you upgrade to a paid plan.
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Manage Subscription Dialog */}
        <ManageSubscriptionDialog
          open={showManageDialog}
          onOpenChange={setShowManageDialog}
          currentPlan={currentPlanData}
          tenant={tenant}
          allPlans={allPlans}
          onUpgrade={handleSelectPlan}
          onRefresh={fetchBillingData}
        />
      </div>
    </AppLayout>
  );
}
