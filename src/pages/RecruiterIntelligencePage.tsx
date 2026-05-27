// Recruiter Intelligence Dashboard — Phase 6 of Placement Outcome Intelligence.
// Recruiter / Manager / Owner only. Never accessible from the client portal.

import { useState } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { RoleGate } from "@/components/auth/RoleGate";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Sparkles, RefreshCw, TrendingUp, TrendingDown, Building2, Users, Target, ArrowRight } from "lucide-react";
import { useRecruiterIntelligence } from "@/hooks/useRecruiterIntelligence";
import { useRefreshOutcomeMemory } from "@/hooks/useOutcomeCapture";
import { formatDistanceToNow } from "date-fns";

export default function RecruiterIntelligencePage() {
  return (
    <RoleGate allow={["owner", "manager", "recruiter", "super_admin"]}>
      <AppLayout>
        <RecruiterIntelligenceContent />
      </AppLayout>
    </RoleGate>
  );
}

function RecruiterIntelligenceContent() {
  const { data, isLoading, refetch } = useRecruiterIntelligence();
  const refresh = useRefreshOutcomeMemory();
  const [tab, setTab] = useState("funnel");

  const handleRefresh = async () => {
    await refresh.mutateAsync();
    await refetch();
  };

  return (
    <div className="space-y-6 p-6 max-w-7xl mx-auto">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Sparkles className="h-6 w-6 text-primary" /> Recruiter Intelligence
          </h1>
          <p className="text-sm text-muted-foreground mt-1 max-w-2xl">
            Outcome-informed analytics from your tenant only. Patterns here calibrate AI recommendations across the
            platform. Recruiter-only — clients never see this.
          </p>
        </div>
        <Button onClick={handleRefresh} disabled={refresh.isPending} variant="outline" className="gap-1.5">
          <RefreshCw className={`h-4 w-4 ${refresh.isPending ? "animate-spin" : ""}`} />
          {refresh.isPending ? "Refreshing…" : "Rebuild intelligence"}
        </Button>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {[1,2,3,4,5,6].map((i) => <Skeleton key={i} className="h-32" />)}
        </div>
      ) : (
        <Tabs value={tab} onValueChange={setTab}>
          <TabsList className="w-full md:w-auto grid grid-cols-2 md:inline-flex md:grid-cols-none">
            <TabsTrigger value="funnel"><Target className="h-3.5 w-3.5 mr-1.5" />Funnel</TabsTrigger>
            <TabsTrigger value="ecosystems"><Building2 className="h-3.5 w-3.5 mr-1.5" />Ecosystems</TabsTrigger>
            <TabsTrigger value="paths"><ArrowRight className="h-3.5 w-3.5 mr-1.5" />Transferable Paths</TabsTrigger>
            <TabsTrigger value="clients"><Building2 className="h-3.5 w-3.5 mr-1.5" />Clients</TabsTrigger>
            <TabsTrigger value="recruiters"><Users className="h-3.5 w-3.5 mr-1.5" />Recruiters</TabsTrigger>
          </TabsList>

          <TabsContent value="funnel" className="mt-4">
            <FunnelView funnel={data?.funnel ?? {}} />
          </TabsContent>
          <TabsContent value="ecosystems" className="mt-4">
            <SignalList items={data?.ecosystems ?? []} empty="No ecosystem patterns yet. Record more outcomes to build intelligence." />
          </TabsContent>
          <TabsContent value="paths" className="mt-4">
            <SignalList items={data?.paths ?? []} empty="No transferable-path patterns yet." />
          </TabsContent>
          <TabsContent value="clients" className="mt-4">
            <ClientsView clients={data?.clients ?? []} />
          </TabsContent>
          <TabsContent value="recruiters" className="mt-4">
            <RecruitersView recruiters={data?.recruiters ?? []} />
          </TabsContent>
        </Tabs>
      )}

      {data?.generated_at && (
        <p className="text-[11px] text-muted-foreground text-right">
          Generated {formatDistanceToNow(new Date(data.generated_at), { addSuffix: true })}
        </p>
      )}
    </div>
  );
}

function FunnelView({ funnel }: { funnel: Record<string, number> }) {
  const stages: Array<{ key: string; label: string }> = [
    { key: "shortlist_accepted",  label: "Shortlist Accepted" },
    { key: "interview_scheduled", label: "Interviews" },
    { key: "offer_extended",      label: "Offers Extended" },
    { key: "offer_accepted",      label: "Offers Accepted" },
    { key: "placement_succeeded", label: "Placements" },
  ];
  const max = Math.max(1, ...stages.map((s) => funnel[s.key] ?? 0));
  const total = stages.reduce((acc, s) => acc + (funnel[s.key] ?? 0), 0);
  if (!total) return <Empty text="No outcomes recorded in the last 90 days." />;
  return (
    <Card>
      <CardHeader><CardTitle className="text-base">Conversion funnel (90 days)</CardTitle></CardHeader>
      <CardContent className="space-y-3">
        {stages.map((s) => {
          const n = funnel[s.key] ?? 0;
          const pct = Math.round((n / max) * 100);
          return (
            <div key={s.key}>
              <div className="flex items-center justify-between text-xs mb-1">
                <span className="font-medium">{s.label}</span>
                <span className="text-muted-foreground">{n}</span>
              </div>
              <div className="h-2 rounded bg-muted overflow-hidden">
                <div className="h-full bg-primary transition-all" style={{ width: `${pct}%` }} />
              </div>
            </div>
          );
        })}
        <div className="pt-2 border-t flex flex-wrap gap-3 text-xs text-muted-foreground">
          <span>Shortlist rejected: {funnel.shortlist_rejected ?? 0}</span>
          <span>Interview rejected: {funnel.interview_rejected ?? 0}</span>
          <span>Offer rejected: {funnel.offer_rejected ?? 0}</span>
          <span>Withdrew: {funnel.candidate_withdrew ?? 0}</span>
        </div>
      </CardContent>
    </Card>
  );
}

function SignalList({ items, empty }: { items: any[]; empty: string }) {
  if (!items.length) return <Empty text={empty} />;
  return (
    <Card>
      <CardContent className="p-0">
        <ul className="divide-y">
          {items.map((s, i) => {
            const positive = s.weight >= 0;
            return (
              <li key={i} className="flex items-center justify-between gap-3 p-3 text-sm">
                <div className="flex items-center gap-2 min-w-0">
                  {positive ? <TrendingUp className="h-4 w-4 text-emerald-500 shrink-0" /> : <TrendingDown className="h-4 w-4 text-rose-500 shrink-0" />}
                  <span className="font-medium truncate">{s.signal_key}</span>
                  <Badge variant="outline" className="text-[10px]">{s.signal_type.replace(/_/g, " ")}</Badge>
                </div>
                <div className="flex items-center gap-2 text-xs text-muted-foreground shrink-0">
                  <span>weight {s.weight >= 0 ? "+" : ""}{Number(s.weight).toFixed(2)}</span>
                  <span>n={s.sample_size}</span>
                  <Badge variant="secondary" className="text-[10px]">{s.confidence}</Badge>
                </div>
              </li>
            );
          })}
        </ul>
      </CardContent>
    </Card>
  );
}

function ClientsView({ clients }: { clients: any[] }) {
  if (!clients.length) return <Empty text="No client preference profiles yet." />;
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
      {clients.map((c) => {
        const prefs = c.preferences ?? {};
        return (
          <Card key={c.client_org_id}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <Building2 className="h-4 w-4 text-muted-foreground" /> Client preference profile
                <Badge variant="secondary" className="text-[10px] ml-auto">{c.confidence}</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-xs">
              {Array.isArray(prefs.prefers_ecosystems) && prefs.prefers_ecosystems.length > 0 && (
                <div>
                  <p className="font-semibold uppercase tracking-wide text-[10px] text-muted-foreground mb-1">Prefers</p>
                  <div className="flex flex-wrap gap-1.5">
                    {prefs.prefers_ecosystems.map((e: string, i: number) => (
                      <Badge key={i} className="bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/30">{e}</Badge>
                    ))}
                  </div>
                </div>
              )}
              {Array.isArray(prefs.rejects_patterns) && prefs.rejects_patterns.length > 0 && (
                <div>
                  <p className="font-semibold uppercase tracking-wide text-[10px] text-muted-foreground mb-1">Rejects</p>
                  <div className="flex flex-wrap gap-1.5">
                    {prefs.rejects_patterns.map((e: string, i: number) => (
                      <Badge key={i} variant="outline" className="border-rose-500/30 text-rose-700 dark:text-rose-300">{e}</Badge>
                    ))}
                  </div>
                </div>
              )}
              <p className="text-muted-foreground pt-1">
                {c.sample_size} outcomes · refreshed {formatDistanceToNow(new Date(c.refreshed_at), { addSuffix: true })}
              </p>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

function RecruitersView({ recruiters }: { recruiters: any[] }) {
  if (!recruiters.length) return <Empty text="No recruiter outcomes recorded in the last 180 days." />;
  return (
    <Card>
      <CardContent className="p-0">
        <table className="w-full text-sm">
          <thead className="text-xs text-muted-foreground bg-muted/40">
            <tr>
              <th className="text-left p-3">Recruiter</th>
              <th className="text-right p-3">Total</th>
              <th className="text-right p-3">Wins</th>
              <th className="text-right p-3">Losses</th>
              <th className="text-right p-3">Win rate</th>
            </tr>
          </thead>
          <tbody>
            {recruiters.map((r) => {
              const rate = r.total ? Math.round((r.wins / r.total) * 100) : 0;
              return (
                <tr key={r.recruiter_id} className="border-t">
                  <td className="p-3 font-mono text-xs">{r.recruiter_id.slice(0, 8)}…</td>
                  <td className="p-3 text-right">{r.total}</td>
                  <td className="p-3 text-right text-emerald-600 dark:text-emerald-400">{r.wins}</td>
                  <td className="p-3 text-right text-rose-600 dark:text-rose-400">{r.losses}</td>
                  <td className="p-3 text-right font-semibold">{rate}%</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </CardContent>
    </Card>
  );
}

function Empty({ text }: { text: string }) {
  return (
    <Card>
      <CardContent className="py-12 text-center text-sm text-muted-foreground">{text}</CardContent>
    </Card>
  );
}
