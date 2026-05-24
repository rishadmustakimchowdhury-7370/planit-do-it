import { ClientLayout } from '@/components/client/ClientLayout';
import { Card, CardContent } from '@/components/ui/card';
import { CalendarClock } from 'lucide-react';

export default function ClientInterviewsPage() {
  return (
    <ClientLayout title="Interviews" subtitle="Requests, confirmations and upcoming sessions">
      <Card>
        <CardContent className="p-12 text-center">
          <CalendarClock className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
          <p className="text-sm text-muted-foreground">
            Interview coordination ships in the next phase.
          </p>
        </CardContent>
      </Card>
    </ClientLayout>
  );
}
