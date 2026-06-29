import { UsageMetersCard } from '@/components/billing/UsageMetersCard';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { useUsageLimits } from '@/hooks/useUsageLimits';
import { Skeleton } from '@/components/ui/skeleton';

function Meter({ label, used, limit, blocked, warning }: { label: string; used: number; limit: number; blocked?: boolean; warning?: boolean }) {
  const pct = limit > 0 ? Math.min(100, Math.round((used / limit) * 100)) : 0;
  const tone = blocked ? 'bg-destructive' : warning ? 'bg-warning' : 'bg-primary';
  return (
    <div>
      <div className="flex justify-between text-sm mb-1">
        <span className="font-medium">{label}</span>
        <span className="text-muted-foreground">{used} / {limit === -1 ? '∞' : limit}</span>
      </div>
      <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
        <div className={`h-full ${tone} transition-all`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

export function UsageTab() {
  const { usageStats, isLoading } = useUsageLimits();
  if (isLoading || !usageStats) return <Skeleton className="h-72" />;
  const u = usageStats.usage;
  return (
    <div className="space-y-6">
      <UsageMetersCard />
      <Card>
        <CardHeader>
          <CardTitle>Workspace Limits</CardTitle>
          <CardDescription>Detailed usage across all metered resources.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <Meter label="AI Credits" used={u.aiCredits.used} limit={u.aiCredits.limit} blocked={u.aiCredits.blocked} warning={u.aiCredits.warning} />
          <Meter label="Active Jobs" used={u.jobs.used} limit={u.jobs.limit} blocked={u.jobs.blocked} warning={u.jobs.warning} />
          <Meter label="Candidates" used={u.candidates.used} limit={u.candidates.limit} blocked={u.candidates.blocked} warning={u.candidates.warning} />
          <Meter label="Team Members" used={u.teamMembers.used} limit={u.teamMembers.limit} blocked={u.teamMembers.blocked} warning={u.teamMembers.warning} />
        </CardContent>
      </Card>
    </div>
  );
}
