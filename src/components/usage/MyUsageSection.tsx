import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Separator } from '@/components/ui/separator';
import { useUsageTracking, useTeamUsageTracking, FeatureUsage } from '@/hooks/useUsageTracking';
import { useAuth } from '@/lib/auth';
import { 
  FileUp, 
  Sparkles, 
  Briefcase, 
  AlertTriangle, 
  CheckCircle, 
  XCircle, 
  RefreshCw, 
  Users, 
  ExternalLink,
  TrendingUp,
  Zap,
  Crown
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import { motion } from 'framer-motion';

interface UsageGaugeProps {
  usage: FeatureUsage;
  label: string;
  icon: React.ReactNode;
  color: string;
  delay?: number;
}

function UsageGauge({ usage, label, icon, color, delay = 0 }: UsageGaugeProps) {
  const isUnlimited = usage.limit === -1;
  const circumference = 2 * Math.PI * 40;
  const strokeDashoffset = circumference - (Math.min(usage.percent, 100) / 100) * circumference;

  const getStatusColor = () => {
    if (isUnlimited) return 'text-success';
    switch (usage.status) {
      case 'limit_reached': return 'text-destructive';
      case 'warning': return 'text-warning';
      default: return color;
    }
  };

  const getStrokeColor = () => {
    if (isUnlimited) return 'stroke-success';
    switch (usage.status) {
      case 'limit_reached': return 'stroke-destructive';
      case 'warning': return 'stroke-warning';
      default: return `stroke-primary`;
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.4, delay }}
      className="relative flex flex-col items-center p-6 rounded-2xl border bg-gradient-to-br from-card to-muted/30 hover:shadow-lg transition-shadow"
    >
      {/* Circular Progress */}
      <div className="relative w-28 h-28 mb-4">
        <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
          {/* Background circle */}
          <circle
            cx="50"
            cy="50"
            r="40"
            fill="none"
            stroke="currentColor"
            strokeWidth="8"
            className="text-muted/30"
          />
          {/* Progress circle */}
          {!isUnlimited && (
            <motion.circle
              cx="50"
              cy="50"
              r="40"
              fill="none"
              strokeWidth="8"
              strokeLinecap="round"
              className={getStrokeColor()}
              style={{
                strokeDasharray: circumference,
              }}
              initial={{ strokeDashoffset: circumference }}
              animate={{ strokeDashoffset }}
              transition={{ duration: 1, delay: delay + 0.2, ease: "easeOut" }}
            />
          )}
          {/* Unlimited indicator */}
          {isUnlimited && (
            <circle
              cx="50"
              cy="50"
              r="40"
              fill="none"
              strokeWidth="8"
              strokeDasharray="8 4"
              className="stroke-success"
            />
          )}
        </svg>
        
        {/* Center content */}
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <div className={`p-2 rounded-full ${color.replace('text-', 'bg-')}/10 mb-1`}>
            {icon}
          </div>
        </div>
      </div>

      {/* Label */}
      <h3 className="font-semibold text-sm mb-2">{label}</h3>

      {/* Stats */}
      {isUnlimited ? (
        <div className="text-center">
          <div className="text-2xl font-bold text-foreground">{usage.used}</div>
          <Badge className="mt-1 bg-success/10 text-success border-success/20">
            <Zap className="h-3 w-3 mr-1" />
            Unlimited
          </Badge>
        </div>
      ) : (
        <div className="text-center">
          <div className={`text-2xl font-bold ${getStatusColor()}`}>
            {usage.percent}%
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            {usage.used} / {usage.limit} used
          </p>
          <p className="text-xs font-medium text-muted-foreground">
            {usage.remaining} remaining
          </p>
        </div>
      )}

      {/* Status indicator */}
      {!isUnlimited && usage.status !== 'normal' && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className={`mt-3 px-3 py-1 rounded-full text-xs font-medium flex items-center gap-1 ${
            usage.status === 'limit_reached' 
              ? 'bg-destructive/10 text-destructive' 
              : 'bg-warning/10 text-warning'
          }`}
        >
          {usage.status === 'limit_reached' ? (
            <><XCircle className="h-3 w-3" /> Limit Reached</>
          ) : (
            <><AlertTriangle className="h-3 w-3" /> Near Limit</>
          )}
        </motion.div>
      )}
    </motion.div>
  );
}

function TeamMemberRow({ member, index }: { member: any; index: number }) {
  const getStatusColor = () => {
    switch (member.status) {
      case 'limit_reached': return 'border-destructive/30 bg-destructive/5';
      case 'warning': return 'border-warning/30 bg-warning/5';
      default: return 'border-border';
    }
  };

  const getProgressColor = (status: string) => {
    switch (status) {
      case 'limit_reached': return 'bg-destructive';
      case 'warning': return 'bg-warning';
      default: return 'bg-primary';
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.3, delay: index * 0.05 }}
      className={`flex items-center gap-4 p-4 rounded-xl border ${getStatusColor()} hover:shadow-md transition-all`}
    >
      <Avatar className="h-10 w-10 ring-2 ring-background">
        <AvatarImage src={member.avatarUrl || undefined} />
        <AvatarFallback className="bg-primary/10 text-primary font-semibold">
          {member.fullName.charAt(0)}
        </AvatarFallback>
      </Avatar>
      
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-2">
          <span className="font-medium text-sm truncate">{member.fullName}</span>
          {member.status === 'limit_reached' && (
            <Badge variant="destructive" className="text-xs py-0">Limit</Badge>
          )}
          {member.status === 'warning' && (
            <Badge className="bg-warning/10 text-warning border-warning/20 text-xs py-0">Near</Badge>
          )}
        </div>
        
        <div className="grid grid-cols-3 gap-4">
          <div className="space-y-1">
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">CVs</span>
              <span className="font-medium">
                {member.cvUploads.limit === -1 ? member.cvUploads.used : `${member.cvUploads.used}/${member.cvUploads.limit}`}
              </span>
            </div>
            {member.cvUploads.limit !== -1 && (
              <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                <div 
                  className={`h-full rounded-full transition-all ${getProgressColor(member.cvUploads.status)}`}
                  style={{ width: `${Math.min(member.cvUploads.percent, 100)}%` }}
                />
              </div>
            )}
          </div>
          
          <div className="space-y-1">
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">AI</span>
              <span className="font-medium">
                {member.aiTests.limit === -1 ? member.aiTests.used : `${member.aiTests.used}/${member.aiTests.limit}`}
              </span>
            </div>
            {member.aiTests.limit !== -1 && (
              <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                <div 
                  className={`h-full rounded-full transition-all ${getProgressColor(member.aiTests.status)}`}
                  style={{ width: `${Math.min(member.aiTests.percent, 100)}%` }}
                />
              </div>
            )}
          </div>
          
          <div className="space-y-1">
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">Jobs</span>
              <span className="font-medium">
                {member.jobs.limit === -1 ? member.jobs.used : `${member.jobs.used}/${member.jobs.limit}`}
              </span>
            </div>
            {member.jobs.limit !== -1 && (
              <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                <div 
                  className={`h-full rounded-full transition-all ${getProgressColor(member.jobs.status)}`}
                  style={{ width: `${Math.min(member.jobs.percent, 100)}%` }}
                />
              </div>
            )}
          </div>
        </div>
      </div>
    </motion.div>
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
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <Skeleton className="h-6 w-48" />
            <Skeleton className="h-4 w-64" />
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <Skeleton className="h-64 rounded-2xl" />
              <Skeleton className="h-64 rounded-2xl" />
              <Skeleton className="h-64 rounded-2xl" />
            </div>
          </CardContent>
        </Card>
      </div>
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

  // Calculate totals for team
  const teamTotals = {
    cvs: teamUsage.reduce((sum, m) => sum + m.cvUploads.used, 0),
    ai: teamUsage.reduce((sum, m) => sum + m.aiTests.used, 0),
    jobs: teamUsage.reduce((sum, m) => sum + m.jobs.used, 0),
  };

  return (
    <div className="space-y-6">
      {/* Personal Usage Dashboard */}
      <Card className="overflow-hidden">
        <CardHeader className="bg-gradient-to-r from-primary/5 via-accent/5 to-primary/5 border-b">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-3 text-xl">
                <div className="p-2 rounded-lg bg-primary/10">
                  <TrendingUp className="h-5 w-5 text-primary" />
                </div>
                My Usage Dashboard
              </CardTitle>
              <CardDescription className="flex items-center gap-2 mt-2">
                <Badge variant="outline" className="gap-1">
                  <Crown className="h-3 w-3" />
                  {usageStats.planName} Plan
                </Badge>
                {isUnlimitedPlan && (
                  <Badge className="bg-success/10 text-success border-success/20 gap-1">
                    <Zap className="h-3 w-3" />
                    Unlimited Access
                  </Badge>
                )}
                {usageStats.billingCycleEnd && (
                  <span className="text-xs text-muted-foreground">
                    Resets {format(new Date(usageStats.billingCycleEnd), 'MMM d, yyyy')}
                  </span>
                )}
              </CardDescription>
            </div>
            <Button variant="outline" size="sm" onClick={handleRefresh} className="gap-2">
              <RefreshCw className="h-4 w-4" />
              Refresh
            </Button>
          </div>
        </CardHeader>
        
        <CardContent className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <UsageGauge
              usage={usageStats.cvUploads}
              label="CV Uploads"
              icon={<FileUp className="h-5 w-5 text-primary" />}
              color="text-primary"
              delay={0}
            />
            <UsageGauge
              usage={usageStats.aiTests}
              label="AI Tests"
              icon={<Sparkles className="h-5 w-5 text-accent" />}
              color="text-accent"
              delay={0.1}
            />
            <UsageGauge
              usage={usageStats.jobs}
              label="Active Jobs"
              icon={<Briefcase className="h-5 w-5 text-info" />}
              color="text-info"
              delay={0.2}
            />
          </div>

          {hasLimitReached && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="mt-6 p-4 rounded-xl bg-destructive/5 border border-destructive/20 flex items-center justify-between"
            >
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-full bg-destructive/10">
                  <XCircle className="h-5 w-5 text-destructive" />
                </div>
                <div>
                  <p className="font-medium text-destructive">Plan Limit Reached</p>
                  <p className="text-sm text-muted-foreground">Upgrade to continue using all features</p>
                </div>
              </div>
              <Button onClick={() => navigate('/billing')}>
                Upgrade Now
              </Button>
            </motion.div>
          )}
        </CardContent>
      </Card>

      {/* Team Usage Card - Only for Owners and Managers */}
      {(isOwner || isManager) && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-accent/10">
                    <Users className="h-5 w-5 text-accent" />
                  </div>
                  Team Usage Overview
                </CardTitle>
                <CardDescription className="mt-2">
                  <div className="flex items-center gap-4 mt-2">
                    <span className="text-xs px-2 py-1 rounded-full bg-muted">
                      <strong>{teamTotals.cvs}</strong> CVs uploaded
                    </span>
                    <span className="text-xs px-2 py-1 rounded-full bg-muted">
                      <strong>{teamTotals.ai}</strong> AI tests
                    </span>
                    <span className="text-xs px-2 py-1 rounded-full bg-muted">
                      <strong>{teamTotals.jobs}</strong> active jobs
                    </span>
                  </div>
                </CardDescription>
              </div>
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => navigate('/team/usage')}
                className="gap-2"
              >
                Full Report
                <ExternalLink className="h-3 w-3" />
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {teamLoading ? (
              <div className="space-y-3">
                <Skeleton className="h-20 w-full rounded-xl" />
                <Skeleton className="h-20 w-full rounded-xl" />
                <Skeleton className="h-20 w-full rounded-xl" />
              </div>
            ) : teamUsage.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Users className="h-12 w-12 mx-auto mb-2 opacity-30" />
                <p>No team members found</p>
              </div>
            ) : (
              <div className="space-y-3">
                {teamUsage.slice(0, 5).map((member, index) => (
                  <TeamMemberRow key={member.userId} member={member} index={index} />
                ))}
                
                {teamUsage.length > 5 && (
                  <>
                    <Separator className="my-4" />
                    <Button 
                      variant="ghost" 
                      className="w-full text-muted-foreground hover:text-foreground"
                      onClick={() => navigate('/team/usage')}
                    >
                      View all {teamUsage.length} team members →
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
