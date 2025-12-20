import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useUsageTracking, useTeamUsageTracking, FeatureUsage } from '@/hooks/useUsageTracking';
import { useAuth } from '@/lib/auth';
import { 
  FileUp, 
  Sparkles, 
  Briefcase, 
  AlertTriangle, 
  XCircle, 
  RefreshCw, 
  Users, 
  ExternalLink,
  Zap,
  Crown,
  ArrowRight,
  TrendingUp
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import { motion } from 'framer-motion';

interface UsageCardProps {
  usage: FeatureUsage;
  label: string;
  icon: React.ReactNode;
  gradient: string;
  iconBg: string;
  delay?: number;
}

function UsageCard({ usage, label, icon, gradient, iconBg, delay = 0 }: UsageCardProps) {
  const isUnlimited = usage.limit === -1;
  
  const getStatusStyles = () => {
    if (isUnlimited) return { ring: 'ring-emerald-500/30', glow: 'shadow-emerald-500/20' };
    switch (usage.status) {
      case 'limit_reached': return { ring: 'ring-red-500/50', glow: 'shadow-red-500/20' };
      case 'warning': return { ring: 'ring-amber-500/50', glow: 'shadow-amber-500/20' };
      default: return { ring: 'ring-primary/30', glow: 'shadow-primary/10' };
    }
  };

  const styles = getStatusStyles();

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay }}
      whileHover={{ y: -4, scale: 1.02 }}
      className={`relative group`}
    >
      <div className={`absolute inset-0 rounded-3xl bg-gradient-to-br ${gradient} opacity-50 blur-xl group-hover:opacity-70 transition-opacity`} />
      
      <div className={`relative bg-card/80 backdrop-blur-sm border rounded-3xl p-6 ring-2 ${styles.ring} shadow-lg ${styles.glow} transition-all duration-300`}>
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className={`p-3 rounded-2xl ${iconBg} shadow-lg`}>
            {icon}
          </div>
          {isUnlimited && (
            <Badge className="bg-gradient-to-r from-emerald-500 to-teal-500 text-white border-0 shadow-lg shadow-emerald-500/25">
              <Zap className="h-3 w-3 mr-1" />
              Unlimited
            </Badge>
          )}
          {!isUnlimited && usage.status === 'limit_reached' && (
            <Badge className="bg-gradient-to-r from-red-500 to-rose-500 text-white border-0">
              <XCircle className="h-3 w-3 mr-1" />
              Limit
            </Badge>
          )}
          {!isUnlimited && usage.status === 'warning' && (
            <Badge className="bg-gradient-to-r from-amber-500 to-orange-500 text-white border-0">
              <AlertTriangle className="h-3 w-3 mr-1" />
              Warning
            </Badge>
          )}
        </div>

        {/* Main Stats */}
        <div className="mb-4">
          <p className="text-sm text-muted-foreground mb-1">{label}</p>
          <div className="flex items-baseline gap-2">
            <span className="text-4xl font-bold tracking-tight">
              {usage.used}
            </span>
            {!isUnlimited && (
              <span className="text-lg text-muted-foreground">
                / {usage.limit}
              </span>
            )}
          </div>
        </div>

        {/* Progress Bar */}
        {!isUnlimited && (
          <div className="space-y-2">
            <div className="h-3 bg-muted/50 rounded-full overflow-hidden">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${Math.min(usage.percent, 100)}%` }}
                transition={{ duration: 0.8, delay: delay + 0.3, ease: "easeOut" }}
                className={`h-full rounded-full bg-gradient-to-r ${
                  usage.status === 'limit_reached' 
                    ? 'from-red-500 to-rose-500' 
                    : usage.status === 'warning'
                    ? 'from-amber-500 to-orange-500'
                    : 'from-primary to-primary/80'
                }`}
              />
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-muted-foreground">{usage.percent}% used</span>
              <span className="font-medium text-foreground">{usage.remaining} remaining</span>
            </div>
          </div>
        )}

        {/* Unlimited visual */}
        {isUnlimited && (
          <div className="h-3 bg-gradient-to-r from-emerald-500/20 via-teal-500/30 to-emerald-500/20 rounded-full overflow-hidden">
            <motion.div
              animate={{ 
                backgroundPosition: ['0% 50%', '100% 50%', '0% 50%'],
              }}
              transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
              className="h-full w-full bg-gradient-to-r from-emerald-500 via-teal-400 to-emerald-500 bg-[length:200%_100%]"
            />
          </div>
        )}
      </div>
    </motion.div>
  );
}

function TeamMemberCard({ member, index }: { member: any; index: number }) {
  const getStatusColor = () => {
    switch (member.status) {
      case 'limit_reached': return 'border-red-200 bg-red-50/50 dark:bg-red-950/20';
      case 'warning': return 'border-amber-200 bg-amber-50/50 dark:bg-amber-950/20';
      default: return 'border-border bg-card/50';
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.3, delay: index * 0.05 }}
      className={`flex items-center gap-4 p-4 rounded-2xl border-2 ${getStatusColor()} hover:shadow-lg transition-all`}
    >
      <Avatar className="h-12 w-12 ring-2 ring-background shadow-lg">
        <AvatarImage src={member.avatarUrl || undefined} />
        <AvatarFallback className="bg-gradient-to-br from-primary to-primary/60 text-primary-foreground font-bold text-lg">
          {member.fullName.charAt(0)}
        </AvatarFallback>
      </Avatar>
      
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-2">
          <span className="font-semibold truncate">{member.fullName}</span>
          {member.status === 'limit_reached' && (
            <Badge variant="destructive" className="text-xs">Limit Reached</Badge>
          )}
          {member.status === 'warning' && (
            <Badge className="bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 text-xs">Near Limit</Badge>
          )}
        </div>
        
        <div className="grid grid-cols-3 gap-6">
          <UsageMini label="CVs" usage={member.cvUploads} />
          <UsageMini label="AI Tests" usage={member.aiTests} />
          <UsageMini label="Jobs" usage={member.jobs} />
        </div>
      </div>
    </motion.div>
  );
}

function UsageMini({ label, usage }: { label: string; usage: FeatureUsage }) {
  const isUnlimited = usage.limit === -1;
  
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between">
        <span className="text-xs text-muted-foreground">{label}</span>
        <span className="text-sm font-bold">
          {usage.used}
          {!isUnlimited && <span className="text-muted-foreground font-normal">/{usage.limit}</span>}
        </span>
      </div>
      <div className="h-1.5 bg-muted rounded-full overflow-hidden">
        {isUnlimited ? (
          <div className="h-full w-full bg-gradient-to-r from-emerald-500 to-teal-500" />
        ) : (
          <div 
            className={`h-full rounded-full transition-all ${
              usage.status === 'limit_reached' 
                ? 'bg-red-500' 
                : usage.status === 'warning'
                ? 'bg-amber-500'
                : 'bg-primary'
            }`}
            style={{ width: `${Math.min(usage.percent, 100)}%` }}
          />
        )}
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
      <div className="space-y-6">
        <div className="rounded-3xl border bg-card p-8">
          <Skeleton className="h-8 w-64 mb-6" />
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Skeleton className="h-56 rounded-3xl" />
            <Skeleton className="h-56 rounded-3xl" />
            <Skeleton className="h-56 rounded-3xl" />
          </div>
        </div>
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
    <div className="space-y-8">
      {/* Personal Usage Dashboard */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative overflow-hidden rounded-3xl border bg-gradient-to-br from-card via-card to-muted/20"
      >
        {/* Background decoration */}
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute -top-24 -right-24 w-96 h-96 bg-primary/5 rounded-full blur-3xl" />
          <div className="absolute -bottom-24 -left-24 w-96 h-96 bg-accent/5 rounded-full blur-3xl" />
        </div>
        
        <CardHeader className="relative border-b bg-gradient-to-r from-background/80 to-background/40 backdrop-blur-sm">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-2xl bg-gradient-to-br from-primary to-primary/60 shadow-lg shadow-primary/25">
                <TrendingUp className="h-6 w-6 text-primary-foreground" />
              </div>
              <div>
                <h2 className="text-2xl font-bold tracking-tight">My Usage Dashboard</h2>
                <div className="flex flex-wrap items-center gap-2 mt-1">
                  <Badge className="bg-gradient-to-r from-primary/10 to-accent/10 text-foreground border-primary/20">
                    <Crown className="h-3 w-3 mr-1 text-primary" />
                    {usageStats.planName} Plan
                  </Badge>
                  {isUnlimitedPlan && (
                    <Badge className="bg-gradient-to-r from-emerald-500 to-teal-500 text-white border-0">
                      <Zap className="h-3 w-3 mr-1" />
                      Unlimited Access
                    </Badge>
                  )}
                  {usageStats.billingCycleEnd && (
                    <span className="text-sm text-muted-foreground">
                      Resets {format(new Date(usageStats.billingCycleEnd), 'MMM d, yyyy')}
                    </span>
                  )}
                </div>
              </div>
            </div>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={handleRefresh} 
              className="gap-2 rounded-xl hover:bg-primary hover:text-primary-foreground transition-colors"
            >
              <RefreshCw className="h-4 w-4" />
              Refresh
            </Button>
          </div>
        </CardHeader>
        
        <CardContent className="relative p-8">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <UsageCard
              usage={usageStats.cvUploads}
              label="CV Uploads"
              icon={<FileUp className="h-6 w-6 text-white" />}
              gradient="from-blue-500/20 to-indigo-500/20"
              iconBg="bg-gradient-to-br from-blue-500 to-indigo-600"
              delay={0}
            />
            <UsageCard
              usage={usageStats.aiTests}
              label="AI Tests"
              icon={<Sparkles className="h-6 w-6 text-white" />}
              gradient="from-violet-500/20 to-purple-500/20"
              iconBg="bg-gradient-to-br from-violet-500 to-purple-600"
              delay={0.1}
            />
            <UsageCard
              usage={usageStats.jobs}
              label="Active Jobs"
              icon={<Briefcase className="h-6 w-6 text-white" />}
              gradient="from-emerald-500/20 to-teal-500/20"
              iconBg="bg-gradient-to-br from-emerald-500 to-teal-600"
              delay={0.2}
            />
          </div>

          {hasLimitReached && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="mt-8 p-6 rounded-2xl bg-gradient-to-r from-red-500/10 to-rose-500/10 border-2 border-red-200 dark:border-red-900/50"
            >
              <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                  <div className="p-3 rounded-full bg-red-100 dark:bg-red-900/30">
                    <XCircle className="h-6 w-6 text-red-600 dark:text-red-400" />
                  </div>
                  <div>
                    <p className="font-semibold text-red-700 dark:text-red-400">Plan Limit Reached</p>
                    <p className="text-sm text-red-600/70 dark:text-red-400/70">Upgrade to continue using all features</p>
                  </div>
                </div>
                <Button 
                  onClick={() => navigate('/billing')}
                  className="bg-gradient-to-r from-red-500 to-rose-500 hover:from-red-600 hover:to-rose-600 text-white shadow-lg"
                >
                  Upgrade Now
                  <ArrowRight className="h-4 w-4 ml-2" />
                </Button>
              </div>
            </motion.div>
          )}
        </CardContent>
      </motion.div>

      {/* Team Usage Card - Only for Owners and Managers */}
      {(isOwner || isManager) && (
        <Card className="rounded-3xl overflow-hidden">
          <CardHeader className="bg-gradient-to-r from-accent/5 to-primary/5 border-b">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                <div className="p-3 rounded-2xl bg-gradient-to-br from-accent to-accent/60 shadow-lg shadow-accent/25">
                  <Users className="h-6 w-6 text-accent-foreground" />
                </div>
                <div>
                  <h2 className="text-xl font-bold">Team Usage Overview</h2>
                  <div className="flex flex-wrap gap-3 mt-2">
                    <Badge variant="secondary" className="gap-1 rounded-lg">
                      <FileUp className="h-3 w-3" />
                      {teamTotals.cvs} CVs
                    </Badge>
                    <Badge variant="secondary" className="gap-1 rounded-lg">
                      <Sparkles className="h-3 w-3" />
                      {teamTotals.ai} AI Tests
                    </Badge>
                    <Badge variant="secondary" className="gap-1 rounded-lg">
                      <Briefcase className="h-3 w-3" />
                      {teamTotals.jobs} Jobs
                    </Badge>
                  </div>
                </div>
              </div>
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => navigate('/team/usage')}
                className="gap-2 rounded-xl"
              >
                Full Report
                <ExternalLink className="h-4 w-4" />
              </Button>
            </div>
          </CardHeader>
          <CardContent className="p-6">
            {teamLoading ? (
              <div className="space-y-4">
                <Skeleton className="h-24 rounded-2xl" />
                <Skeleton className="h-24 rounded-2xl" />
                <Skeleton className="h-24 rounded-2xl" />
              </div>
            ) : teamUsage.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <Users className="h-16 w-16 mx-auto mb-4 opacity-20" />
                <p className="text-lg font-medium">No team members found</p>
                <p className="text-sm">Add team members to track their usage</p>
              </div>
            ) : (
              <div className="space-y-4">
                {teamUsage.slice(0, 5).map((member, index) => (
                  <TeamMemberCard key={member.userId} member={member} index={index} />
                ))}
                
                {teamUsage.length > 5 && (
                  <Button 
                    variant="ghost" 
                    className="w-full mt-4 rounded-xl text-muted-foreground hover:text-foreground"
                    onClick={() => navigate('/team/usage')}
                  >
                    View all {teamUsage.length} team members
                    <ArrowRight className="h-4 w-4 ml-2" />
                  </Button>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
