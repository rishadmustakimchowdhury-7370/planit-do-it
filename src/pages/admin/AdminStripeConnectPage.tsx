import { AdminLayout } from '@/components/admin/AdminLayout';
import { StripeConnectCard } from '@/components/admin/StripeConnectCard';

export default function AdminStripeConnectPage() {
  return (
    <AdminLayout 
      title="Stripe Connect"
      description="Connect your Stripe account to enable payment processing for your platform."
    >
      <StripeConnectCard />
    </AdminLayout>
  );
}