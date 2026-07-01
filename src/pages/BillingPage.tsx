// Enterprise Billing Center.
// All pricing/subscription state is server-driven; this shell only renders.
// Working APIs are reused via existing edge functions and hooks.
import { useState } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { OverviewTab } from '@/components/billing/center/OverviewTab';
import { SubscriptionTab } from '@/components/billing/center/SubscriptionTab';
import { InvoicesTab } from '@/components/billing/center/InvoicesTab';
import { PaymentMethodTab } from '@/components/billing/center/PaymentMethodTab';
import { UsageTab } from '@/components/billing/center/UsageTab';
import { PromoTab } from '@/components/billing/center/PromoTab';
import { TimelineTab } from '@/components/billing/center/TimelineTab';
import { NotificationsTab } from '@/components/billing/center/NotificationsTab';
import { BillingDetailsTab } from '@/components/billing/center/BillingDetailsTab';
import { ErrorBoundary } from '@/components/common/ErrorBoundary';
import {
  LayoutDashboard, Sparkles, Receipt, CreditCard, Gauge, Tag, History, Bell, Building2,
} from 'lucide-react';

const TABS = [
  { value: 'overview', label: 'Overview', icon: LayoutDashboard, render: () => <OverviewTab /> },
  { value: 'subscription', label: 'Subscription', icon: Sparkles, render: () => <SubscriptionTab /> },
  { value: 'invoices', label: 'Invoices', icon: Receipt, render: () => <InvoicesTab /> },
  { value: 'payment-method', label: 'Payment Method', icon: CreditCard, render: () => <PaymentMethodTab /> },
  { value: 'usage', label: 'Usage', icon: Gauge, render: () => <UsageTab /> },
  { value: 'promo', label: 'Promo Codes', icon: Tag, render: () => <PromoTab /> },
  { value: 'timeline', label: 'Timeline', icon: History, render: () => <TimelineTab /> },
  { value: 'notifications', label: 'Notifications', icon: Bell, render: () => <NotificationsTab /> },
  { value: 'details', label: 'Billing Details', icon: Building2, render: () => <BillingDetailsTab /> },
];

export default function BillingPage() {
  const [tab, setTab] = useState('overview');

  return (
    <AppLayout title="Billing Center" subtitle="Manage your subscription, invoices and billing">
      <ErrorBoundary label="Billing Center">
        <div className="space-y-6">
          <Tabs value={tab} onValueChange={setTab} className="w-full">
            <div className="overflow-x-auto -mx-1">
              <TabsList className="bg-muted/40 p-1 h-auto flex flex-wrap gap-1">
                {TABS.map(t => (
                  <TabsTrigger key={t.value} value={t.value}
                    className="data-[state=active]:bg-background data-[state=active]:shadow-sm gap-2 px-3 py-2">
                    <t.icon className="h-4 w-4" />
                    <span className="hidden sm:inline">{t.label}</span>
                  </TabsTrigger>
                ))}
              </TabsList>
            </div>

            {TABS.map(t => (
              <TabsContent key={t.value} value={t.value} className="mt-6 focus-visible:outline-none">
                <ErrorBoundary label={t.label}>
                  {t.render()}
                </ErrorBoundary>
              </TabsContent>
            ))}
          </Tabs>
        </div>
      </ErrorBoundary>
    </AppLayout>
  );
}
