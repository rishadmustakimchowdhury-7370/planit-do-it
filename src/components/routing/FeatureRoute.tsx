import { ReactNode } from 'react';
import { useEntitlement } from '@/hooks/useEntitlement';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Lock } from 'lucide-react';
import { Link } from 'react-router-dom';
import { AppLayout } from '@/components/layout/AppLayout';
import { FEATURE_LABELS } from '@/lib/entitlements';
import { Skeleton } from '@/components/ui/skeleton';

interface Props {
  featureKey: string;
  children: ReactNode;
}

export function FeatureRoute({ featureKey, children }: Props) {
  const { entitlement, loading } = useEntitlement(featureKey);

  if (loading) {
    return (
      <AppLayout>
        <Skeleton className="h-64 w-full" />
      </AppLayout>
    );
  }

  if (entitlement && !entitlement.enabled) {
    const label = FEATURE_LABELS[featureKey] ?? featureKey.replace(/_/g, ' ');
    return (
      <AppLayout>
        <div className="max-w-2xl mx-auto py-16">
          <Card>
            <CardContent className="p-10 text-center space-y-4">
              <div className="w-14 h-14 mx-auto rounded-full bg-primary/10 flex items-center justify-center">
                <Lock className="w-7 h-7 text-primary" />
              </div>
              <h2 className="text-2xl font-semibold">{label} is not included in your plan</h2>
              <p className="text-muted-foreground">
                Upgrade your subscription to unlock this feature.
              </p>
              <Button asChild>
                <Link to="/billing">View plans</Link>
              </Button>
            </CardContent>
          </Card>
        </div>
      </AppLayout>
    );
  }

  return <>{children}</>;
}
