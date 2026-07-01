// Enterprise Billing Center.
// All pricing/subscription state is server-driven; this shell only renders.
// Working APIs are reused via existing edge functions and hooks.
import { useState } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { SubscriptionStatusBanner } from '@/components/billing/SubscriptionStatusBanner';
import { OverviewTab } from '@/components/billing/center/OverviewTab';
import { SubscriptionTab } from '@/components/billing/center/SubscriptionTab';
import { InvoicesTab } from '@/components/billing/center/InvoicesTab';
import { PaymentMethodTab } from '@/components/billing/center/PaymentMethodTab';
import { UsageTab } from '@/components/billing/center/UsageTab';
import { PromoTab } from '@/components/billing/center/PromoTab';
import { TimelineTab } from '@/components/billing/center/TimelineTab';
import { NotificationsTab } from '@/components/billing/center/NotificationsTab';
import { BillingDetailsTab } from '@/components/billing/center/BillingDetailsTab';
import {
  LayoutDashboard, Sparkles, Receipt, CreditCard, Gauge, Tag, History, Bell, Building2,
} from 'lucide-react';

const TABS = [
  { value: 'overview', label: 'Overview', icon: LayoutDashboard, render: () => { console.log('BillingOverview'); return <OverviewTab />; } },
  { value: 'subscription', label: 'Subscription', icon: Sparkles, render: () => { console.log('BillingSubscription'); return <SubscriptionTab />; } },
  { value: 'invoices', label: 'Invoices', icon: Receipt, render: () => { console.log('BillingInvoices'); return <InvoicesTab />; } },
  { value: 'payment-method', label: 'Payment Method', icon: CreditCard, render: () => { console.log('BillingPaymentMethod'); return <PaymentMethodTab />; } },
  { value: 'usage', label: 'Usage', icon: Gauge, render: () => { console.log('BillingUsage'); return <UsageTab />; } },
  { value: 'promo', label: 'Promo Codes', icon: Tag, render: () => { console.log('BillingPromo'); return <PromoTab />; } },
  { value: 'timeline', label: 'Timeline', icon: History, render: () => { console.log('BillingTimeline'); return <TimelineTab />; } },
  { value: 'notifications', label: 'Notifications', icon: Bell, render: () => { console.log('BillingNotifications'); return <NotificationsTab />; } },
  { value: 'details', label: 'Billing Details', icon: Building2, render: () => { console.log('BillingDetails'); return <BillingDetailsTab />; } },
];

export default function BillingPage() {
  const [tab, setTab] = useState('overview');

  return (
    <AppLayout title="Billing Center" subtitle="Manage your subscription, invoices and billing">
      <div className="space-y-6">
          <SubscriptionStatusBanner />

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
                {t.render()}
              </TabsContent>
            ))}
          </Tabs>
        </div>
    </AppLayout>
  );
}
