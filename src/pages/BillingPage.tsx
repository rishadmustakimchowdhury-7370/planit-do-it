import { useState, useEffect } from 'react';
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
  AlertTriangle,
  Sparkles,
  Zap,
  Crown,
  ArrowUpRight,
  FileText
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth';
import { toast } from 'sonner';
import { motion } from 'framer-motion';
import { formatCurrency, getCurrency } from '@/lib/currencies';
import { format } from 'date-fns';

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
}

const plans = [
  {
    name: 'Starter',
    price: 9,
    period: 'month',
    icon: Zap,
    features: ['5 Active Jobs', '50 Candidates', '50 AI Matches/month', 'Email Support'],
    popular: false,
  },
  {
    name: 'Pro',
    price: 29,
    period: 'month',
    icon: Sparkles,
    features: ['25 Active Jobs', '500 Candidates', '200 AI Matches/month', 'Priority Support', 'API Access'],
    popular: true,
  },
  {
    name: 'Agency',
    price: 79,
    period: 'month',
    icon: Crown,
    features: ['Unlimited Jobs', 'Unlimited Candidates', '1000 AI Matches/month', '24/7 Support', 'White Label'],
    popular: false,
  },
];

const statusColors: Record<string, string> = {
  paid: 'bg-success/10 text-success border-success/30',
  pending: 'bg-warning/10 text-warning border-warning/30',
  overdue: 'bg-destructive/10 text-destructive border-destructive/30',
  draft: 'bg-muted text-muted-foreground',
  canceled: 'bg-muted text-muted-foreground',
};

export default function BillingPage() {
  const { tenantId } = useAuth();
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [tenant, setTenant] = useState<Tenant | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (tenantId) {
      fetchBillingData();
    }
  }, [tenantId]);

  const fetchBillingData = async () => {
    setIsLoading(true);
    try {
      // Fetch tenant subscription info
      const { data: tenantData, error: tenantError } = await supabase
        .from('tenants')
        .select('id, name, subscription_status, subscription_ends_at, match_credits_remaining, match_credits_limit')
        .eq('id', tenantId)
        .single();

      if (tenantError) throw tenantError;
      setTenant(tenantData);

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

  const currentPlan = plans.find(p => p.name.toLowerCase() === tenant?.subscription_status) || plans[0];
  const creditsUsed = (tenant?.match_credits_limit || 100) - (tenant?.match_credits_remaining || 0);
  const creditsPercent = Math.round((creditsUsed / (tenant?.match_credits_limit || 100)) * 100);

  if (isLoading) {
    return (
      <AppLayout title="Billing" subtitle="Manage your subscription and invoices">
        <div className="space-y-6">
          <Skeleton className="h-48 w-full" />
          <Skeleton className="h-64 w-full" />
        </div>
      </AppLayout>
    );
  }

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
                      : `Your ${currentPlan.name} subscription`}
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
                      <currentPlan.icon className="h-5 w-5 text-accent" />
                    </div>
                    <div>
                      <p className="font-semibold">{currentPlan.name} Plan</p>
                      <p className="text-sm text-muted-foreground">
                        ${currentPlan.price}/{currentPlan.period}
                      </p>
                    </div>
                  </div>
                  <Button size="sm" className="w-full gap-2">
                    <ArrowUpRight className="h-4 w-4" />
                    Upgrade Plan
                  </Button>
                </div>

                {/* AI Credits */}
                <div className="p-4 rounded-lg border">
                  <p className="text-sm font-medium mb-2">AI Match Credits</p>
                  <div className="flex items-end gap-2 mb-2">
                    <span className="text-2xl font-bold">{tenant?.match_credits_remaining || 0}</span>
                    <span className="text-muted-foreground text-sm">/ {tenant?.match_credits_limit || 100}</span>
                  </div>
                  <div className="h-2 bg-muted rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-accent transition-all duration-500"
                      style={{ width: `${100 - creditsPercent}%` }}
                    />
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    {creditsUsed} credits used this month
                  </p>
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
                  <Button variant="outline" size="sm" className="w-full mt-2">
                    <CreditCard className="h-4 w-4 mr-2" />
                    Manage Payment Method
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Plans Comparison */}
        <Tabs defaultValue="invoices">
          <TabsList>
            <TabsTrigger value="invoices" className="gap-2">
              <FileText className="h-4 w-4" />
              Invoices
            </TabsTrigger>
            <TabsTrigger value="plans" className="gap-2">
              <Sparkles className="h-4 w-4" />
              Available Plans
            </TabsTrigger>
          </TabsList>

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

          <TabsContent value="plans" className="mt-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {plans.map((plan, i) => (
                <motion.div
                  key={plan.name}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3, delay: i * 0.1 }}
                >
                  <Card className={plan.popular ? 'border-accent shadow-glow' : ''}>
                    {plan.popular && (
                      <div className="bg-accent text-accent-foreground text-center py-1 text-sm font-medium">
                        Most Popular
                      </div>
                    )}
                    <CardContent className="p-6">
                      <div className="flex items-center gap-3 mb-4">
                        <div className="p-2 rounded-lg bg-accent/10">
                          <plan.icon className="h-5 w-5 text-accent" />
                        </div>
                        <h3 className="text-xl font-semibold">{plan.name}</h3>
                      </div>
                      <div className="mb-6">
                        <span className="text-4xl font-bold">${plan.price}</span>
                        <span className="text-muted-foreground">/{plan.period}</span>
                      </div>
                      <ul className="space-y-3 mb-6">
                        {plan.features.map((feature, j) => (
                          <li key={j} className="flex items-center gap-2 text-sm">
                            <CheckCircle className="h-4 w-4 text-success flex-shrink-0" />
                            {feature}
                          </li>
                        ))}
                      </ul>
                      <Button 
                        className="w-full" 
                        variant={plan.popular ? 'default' : 'outline'}
                      >
                        {currentPlan.name === plan.name ? 'Current Plan' : 'Choose Plan'}
                      </Button>
                    </CardContent>
                  </Card>
                </motion.div>
              ))}
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
}
