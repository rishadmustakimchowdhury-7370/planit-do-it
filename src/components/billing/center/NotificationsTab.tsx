import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { useBillingNotifications } from '@/hooks/useBillingCenter';
import { formatDistanceToNow } from 'date-fns';
import { Bell, AlertTriangle, CheckCircle2, Info } from 'lucide-react';

function iconFor(type: string) {
  if (type.includes('failed') || type.includes('past_due')) return AlertTriangle;
  if (type.includes('success') || type.includes('paid')) return CheckCircle2;
  if (type.includes('trial')) return Info;
  return Bell;
}

export function NotificationsTab() {
  const { items, loading } = useBillingNotifications();
  if (loading) return <Skeleton className="h-72" />;

  return (
    <Card>
      <CardHeader><CardTitle>Billing Notifications</CardTitle></CardHeader>
      <CardContent>
        {items.length === 0 && (
          <div className="text-sm text-muted-foreground">You're all caught up.</div>
        )}
        <ul className="divide-y">
          {items.map((n) => {
            const Icon = iconFor(n.type);
            return (
              <li key={n.id} className="py-4 flex gap-4">
                <div className="p-2 rounded-md bg-muted h-fit"><Icon className="h-4 w-4" /></div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-medium text-sm truncate">{n.title}</span>
                    <span className="text-xs text-muted-foreground whitespace-nowrap">
                      {formatDistanceToNow(new Date(n.created_at), { addSuffix: true })}
                    </span>
                  </div>
                  <p className="text-sm text-muted-foreground">{n.message}</p>
                  <div className="mt-1 flex items-center gap-2">
                    <Badge variant="outline" className="text-xs">{n.type}</Badge>
                    {!n.is_read && <Badge className="text-xs">New</Badge>}
                    {n.link && <a href={n.link} className="text-xs text-primary hover:underline">Open</a>}
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      </CardContent>
    </Card>
  );
}
