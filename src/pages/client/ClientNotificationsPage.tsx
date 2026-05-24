import { ClientLayout } from '@/components/client/ClientLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Bell } from 'lucide-react';

export default function ClientNotificationsPage() {
  return (
    <ClientLayout title="Notifications" subtitle="Updates from your recruiter">
      <Card>
        <CardContent className="p-12 text-center">
          <Bell className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
          <p className="text-sm text-muted-foreground">You're all caught up.</p>
        </CardContent>
      </Card>
    </ClientLayout>
  );
}
