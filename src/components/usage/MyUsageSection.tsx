import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Separator } from '@/components/ui/separator';
import { useUsageTracking, useTeamUsageTracking, FeatureUsage } from '@/hooks/useUsageTracking';
import { useAuth } from '@/lib/auth';
import { FileUp, Sparkles, Briefcase, AlertTriangle, CheckCircle, XCircle, RefreshCw, Users, ExternalLink } from 'lucide-react';
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
          <Badge variant="secondary" className="ml-2 bg-success/10 text-success border-success/20">Unlimited</Badge>
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

function CompactUsageBar({ usage, label }: { usage: FeatureUsage; label: string }) {
  const isUnlimited = usage.limit === -1;
  
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-xs">
        <span className="text-muted-foreground">{label}</span>
        {isUnlimited ? (
          <span className="font-medium">{usage.used} <span className="text-muted-foreground">/ ∞</span></span>
        ) : (
          <span className="font-medium">{usage.used} <span className="text-muted-foreground">/ {usage.limit}</span></span>
        )}
      </div>
      {!isUnlimited && <Progress value={usage.percent} className="h-1" />}
    </div>
  );
}

function TeamMemberUsageRow({ member }: { member: any }) {
  const getStatusBadge = () => {
    switch (member.status) {
      case 'limit_reached':
        return <Badge variant="destructive" className="text-xs">Limit Reached</Badge>;
      case 'warning':
        return <Badge variant="secondary" className="bg-warning/10 text-warning border-warning/20 text-xs">Near Limit</Badge>;
      default:
        return <Badge variant="secondary" className="bg-success/10 text-success border-success/20 text-xs">Normal</Badge>;
    }
  };

  return (
    <div className="flex items-center gap-3 p-3 rounded-lg border bg-muted/30 hover:bg-muted/50 transition-colors">
      <Avatar className="h-9 w-9">
        <AvatarImage src={member.avatarUrl || undefined} />
        <AvatarFallback className="text-xs">{member.fullName.charAt(0)}</AvatarFallback>
      </Avatar>
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2 mb-1">
          <span className="font-medium text-sm truncate">{member.fullName}</span>
          {getStatusBadge()}
        </div>
        <div className="grid grid-cols-3 gap-3">
          <CompactUsageBar usage={member.cvUploads} label="CVs" />
          <CompactUsageBar usage={member.aiTests} label="AI" />
          <CompactUsageBar usage={member.jobs} label="Jobs" />
        </div>
      </div>
    </div>
  );
}

export function MyUsageSection() {
  const { usageStats, isLoading, refreshUsage } = useUsageTracking();
  const { teamUsage, isLoading: teamLoading, refreshTeamUsage } = useTeamUsageTracking();
  const { isOwner, isManager } = useAuth();
  const navigate = useNavigate();

  const handleRefresh = () => {
    refreshUsage();
    if (isOwner || isManager) {
      refreshTeamUsage();
    }
  };

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

  const isUnlimitedPlan = 
    usageStats.cvUploads.limit === -1 &&
    usageStats.aiTests.limit === -1 &&
    usageStats.jobs.limit === -1;

  return (
    <div className="space-y-6">
      {/* Personal Usage Card */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                My Usage
                <Badge variant="outline">{usageStats.planName} Plan</Badge>
                {isUnlimitedPlan && (
                  <Badge className="bg-success/10 text-success border-success/20">Unlimited</Badge>
                )}
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
            <Button variant="ghost" size="icon" onClick={handleRefresh}>
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

      {/* Team Usage Card - Only for Owners and Managers */}
      {(isOwner || isManager) && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Users className="h-5 w-5" />
                  Team Usage
                </CardTitle>
                <CardDescription>
                  Overview of feature usage by team members
                </CardDescription>
              </div>
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => navigate('/team/usage')}
                className="gap-2"
              >
                View Full Report
                <ExternalLink className="h-3 w-3" />
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {teamLoading ? (
              <div className="space-y-3">
                <Skeleton className="h-20 w-full" />
                <Skeleton className="h-20 w-full" />
                <Skeleton className="h-20 w-full" />
              </div>
            ) : teamUsage.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">
                No team members found
              </p>
            ) : (
              <div className="space-y-3">
                {teamUsage.slice(0, 5).map((member) => (
                  <TeamMemberUsageRow key={member.userId} member={member} />
                ))}
                
                {teamUsage.length > 5 && (
                  <>
                    <Separator />
                    <Button 
                      variant="ghost" 
                      className="w-full text-muted-foreground"
                      onClick={() => navigate('/team/usage')}
                    >
                      View all {teamUsage.length} team members
                    </Button>
                  </>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
