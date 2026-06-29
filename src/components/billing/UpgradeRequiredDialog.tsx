import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { useNavigate } from 'react-router-dom';
import { Sparkles, TrendingUp } from 'lucide-react';
import { FEATURE_LABELS } from '@/lib/entitlements';
import { useFeatureUsage } from '@/hooks/useFeatureUsage';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  featureKey: string;
  title?: string;
  description?: string;
}

export function UpgradeRequiredDialog({ open, onOpenChange, featureKey, title, description }: Props) {
  const navigate = useNavigate();
  const label = FEATURE_LABELS[featureKey] ?? featureKey.replace(/_/g, ' ');
  const { data } = useFeatureUsage(open ? featureKey : null);

  const used = data?.usage ?? 0;
  const limit = data?.unlimited ? null : data?.limit ?? null;
  const remaining = data?.remaining ?? 0;
  const percent = data?.percent ?? 100;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <div className="flex items-center gap-2 mb-1">
            <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center">
              <Sparkles className="w-5 h-5 text-primary" />
            </div>
            <DialogTitle>{title ?? 'Plan limit reached'}</DialogTitle>
          </div>
          <DialogDescription>
            {description ?? `You've reached your plan's limit for ${label}. Upgrade to keep going.`}
          </DialogDescription>
        </DialogHeader>

        {data && (
          <div className="rounded-lg border bg-muted/30 p-4 space-y-3">
            <div className="flex items-center justify-between text-sm">
              <span className="font-medium">{label} usage</span>
              <span className="text-muted-foreground">
                {used} {limit != null ? `/ ${limit}` : '/ ∞'}
              </span>
            </div>
            {limit != null && <Progress value={Math.min(100, percent)} />}
            <div className="grid grid-cols-3 gap-3 text-center text-xs">
              <div>
                <div className="text-lg font-semibold">{used}</div>
                <div className="text-muted-foreground">Used</div>
              </div>
              <div>
                <div className="text-lg font-semibold">{limit ?? '∞'}</div>
                <div className="text-muted-foreground">Allowed</div>
              </div>
              <div>
                <div className="text-lg font-semibold text-primary">{limit != null ? remaining : '∞'}</div>
                <div className="text-muted-foreground">Remaining</div>
              </div>
            </div>
            <div className="flex items-center gap-2 text-xs text-muted-foreground pt-1">
              <TrendingUp className="w-3.5 h-3.5" />
              Upgrading unlocks higher limits and additional features instantly.
            </div>
          </div>
        )}

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Not now</Button>
          <Button onClick={() => { onOpenChange(false); navigate('/billing'); }}>Upgrade plan</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
