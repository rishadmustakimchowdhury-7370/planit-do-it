import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';
import { Sparkles } from 'lucide-react';
import { FEATURE_LABELS } from '@/lib/entitlements';

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
            {description ?? `You've reached your plan's limit for ${label}. Upgrade your plan to continue.`}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Not now</Button>
          <Button onClick={() => { onOpenChange(false); navigate('/billing'); }}>Upgrade plan</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
