import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useUsageTracking, FeatureUsage } from '@/hooks/useUsageTracking';
import { FileUp, Sparkles, Briefcase, AlertTriangle, CheckCircle, XCircle, RefreshCw } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { format } from 'date-fns';

interface UsageItemProps {
  label: string;
  usage: FeatureUsage;
  icon: React.ReactNode;
}

function UsageItem({ label, usage, icon }: UsageItemProps) {
  const isUnlimited = usage.limit === -1;
  
  const getStatusColor = () => {
    switch (usage.status) {
      case 'limit_reached':
        return 'text-destructive';
      case 'warning':
        return 'text-warning';
      default:
        return 'text-success';
    }
  };

  const getProgressColor = () => {
    switch (usage.status) {
      case 'limit_reached':
        return 'bg-destructive';
      case 'warning':
        return 'bg-warning';
      default:
        return 'bg-success';
    }
  };

  const getStatusIcon = () => {
    switch (usage.status) {
      case 'limit_reached':
        return <XCircle className="h-4 w-4 text-destructive" />;
      case 'warning':
        return <AlertTriangle className="h-4 w-4 text-warning" />;
      default:
        return <CheckCircle className="h-4 w-4 text-success" />;
    }
  };

  return (
    <div className="space-y-3 p-4 rounded-lg border bg-card">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {icon}
          <span className="font-medium">{label}</span>
        </div>
        {getStatusIcon()}
      </div>

      {isUnlimited ? (
        <div className="text-sm text-muted-foreground">
          Used: <span className="font-semibold text-foreground">{usage.used}</span>
          <Badge variant="secondary" className="ml-2">Unlimited</Badge>
        </div>
      ) : (
        <>
          <div className="flex items-center justify-between text-sm">
            <span className={getStatusColor()}>
              Used <span className="font-bold">{usage.used}</span> of <span className="font-bold">{usage.limit}</span>
            </span>
            <span className="text-muted-foreground">
              Remaining: <span className="font-semibold">{usage.remaining}</span>
            </span>
          </div>

          <div className="relative">
            <Progress value={usage.percent} className="h-2" />
            <div 
              className={`absolute top-0 left-0 h-2 rounded-full transition-all ${getProgressColor()}`}
              style={{ width: `${Math.min(usage.percent, 100)}%` }}
            />
          </div>

          {usage.status === 'warning' && (
            <p className="text-xs text-warning flex items-center gap-1">
              <AlertTriangle className="h-3 w-3" />
              You are close to your monthly limit
            </p>
          )}

          {usage.status === 'limit_reached' && (
            <p className="text-xs text-destructive flex items-center gap-1">
              <XCircle className="h-3 w-3" />
              You have reached your plan limit. Please upgrade to continue.
            </p>
          )}
        </>
      )}
    </div>
  );
}

export function MyUsageSection() {
  const { usageStats, isLoading, refreshUsage } = useUsageTracking();
  const navigate = useNavigate();

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-32" />
          <Skeleton className="h-4 w-48" />
        </CardHeader>
        <CardContent className="space-y-4">
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-24 w-full" />
        </CardContent>
      </Card>
    );
  }

  if (!usageStats) {
    return null;
  }

  const hasLimitReached = 
    usageStats.cvUploads.status === 'limit_reached' ||
    usageStats.aiTests.status === 'limit_reached' ||
    usageStats.jobs.status === 'limit_reached';

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              My Usage
              <Badge variant="outline">{usageStats.planName} Plan</Badge>
            </CardTitle>
            <CardDescription>
              Track your feature usage for this billing period
              {usageStats.billingCycleEnd && (
                <span className="ml-1">
                  (Resets {format(new Date(usageStats.billingCycleEnd), 'MMM d, yyyy')})
                </span>
              )}
            </CardDescription>
          </div>
          <Button variant="ghost" size="icon" onClick={refreshUsage}>
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <UsageItem
          label="CV Uploads"
          usage={usageStats.cvUploads}
          icon={<FileUp className="h-5 w-5 text-primary" />}
        />

        <UsageItem
          label="AI Tests"
          usage={usageStats.aiTests}
          icon={<Sparkles className="h-5 w-5 text-accent" />}
        />

        <UsageItem
          label="Active Jobs"
          usage={usageStats.jobs}
          icon={<Briefcase className="h-5 w-5 text-info" />}
        />

        {hasLimitReached && (
          <Button 
            className="w-full" 
            onClick={() => navigate('/billing')}
          >
            Upgrade Your Plan
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
