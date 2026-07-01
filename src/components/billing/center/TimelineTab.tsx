import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useBillingTimeline } from '@/hooks/useBillingCenter';
import { formatDistanceToNow } from 'date-fns';
import {
  CheckCircle2, XCircle, CreditCard, Tag, TrendingUp, TrendingDown,
  PlayCircle, PauseCircle, Receipt, Sparkles, AlertTriangle, RefreshCcw,
} from 'lucide-react';

const ICON: Record<string, any> = {
  'subscription.created': Sparkles,
  'subscription.updated': RefreshCcw,
  'subscription.cancelled': XCircle,
  'subscription.resumed': PlayCircle,
  'subscription.paused': PauseCircle,
  'subscription.upgraded': TrendingUp,
  'subscription.downgraded': TrendingDown,
  'trial.started': Sparkles,
  'trial.ending': AlertTriangle,
  'payment.succeeded': CheckCircle2,
  'payment.failed': AlertTriangle,
  'invoice.paid': Receipt,
  'invoice.created': Receipt,
  'invoice.manual_created': Receipt,
  'invoice.downloaded': Receipt,
  'promo.applied': Tag,
  'promo.expired': Tag,
  'card.updated': CreditCard,
};

const TONE: Record<string, string> = {
  'payment.failed': 'text-destructive bg-destructive/10 border-destructive/30',
  'subscription.cancelled': 'text-destructive bg-destructive/10 border-destructive/30',
  'trial.ending': 'text-warning bg-warning/10 border-warning/30',
  'payment.succeeded': 'text-success bg-success/10 border-success/30',
  'invoice.paid': 'text-success bg-success/10 border-success/30',
  'subscription.resumed': 'text-success bg-success/10 border-success/30',
  'promo.applied': 'text-primary bg-primary/10 border-primary/30',
};

function pickIcon(action: string) {
  return ICON[action] ?? CheckCircle2;
}

function label(action: string) {
  return action.replace(/[._]/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

export function TimelineTab() {
  const { entries, loading } = useBillingTimeline();
  if (loading) return <Skeleton className="h-96" />;

  return (
    <Card>
      <CardHeader><CardTitle>Billing Timeline</CardTitle></CardHeader>
      <CardContent>
        {entries.length === 0 && <div className="text-sm text-muted-foreground">No billing activity yet.</div>}
        <ol className="relative border-l border-border ml-3 space-y-6">
          {entries.map((e) => {
            const Icon = pickIcon(e.action);
            const tone = TONE[e.action] ?? 'text-muted-foreground bg-muted border-border';
            return (
              <li key={e.id} className="ml-6">
                <span className={`absolute -left-3 flex h-6 w-6 items-center justify-center rounded-full border ${tone}`}>
                  <Icon className="h-3.5 w-3.5" />
                </span>
                <div className="flex flex-wrap items-baseline gap-x-3">
                  <h4 className="font-medium text-sm">{label(e.action)}</h4>
                  <time className="text-xs text-muted-foreground">
                    {(() => { try { return e.created_at ? formatDistanceToNow(new Date(e.created_at), { addSuffix: true }) : ''; } catch { return ''; } })()}
                  </time>
                </div>
                {e.metadata && Object.keys(e.metadata).length > 0 && (
                  <pre className="mt-1 text-xs text-muted-foreground whitespace-pre-wrap break-words">
                    {JSON.stringify(e.metadata, null, 0).slice(0, 200)}
                  </pre>
                )}
              </li>
            );
          })}
        </ol>
      </CardContent>
    </Card>
  );
}
