import { useEffect, useMemo, useState } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { SubmissionKanban, type KanbanRow } from "@/components/clients/SubmissionKanban";
import { SubmissionMetricsBar } from "@/components/clients/SubmissionMetricsBar";
import { SubmissionDetailDialog } from "@/components/clients/SubmissionDetailDialog";
import { SUBMISSION_STATUS_META, type SubmissionStatus } from "@/components/clients/SubmissionStatusBadge";
import { Kanban } from "lucide-react";

const COUNTER_STAGES: SubmissionStatus[] = [
  "submitted","viewed","screening","interview_requested","interview_confirmed","offer","hired",
];

export default function ClientPipelinePage() {
  const { tenantId } = useAuth();
  const [rows, setRows] = useState<KanbanRow[] | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [clientFilter, setClientFilter] = useState<string>("all");
  const [recruiterFilter, setRecruiterFilter] = useState<string>("all");

  const load = async () => {
    if (!tenantId) return;
    const { data, error } = await supabase
      .from("candidate_submissions")
      .select(`id, status, last_activity_at, submitted_by, client_org_id, job_id,
        candidate:candidate_id ( id, full_name, current_title ),
        job:job_id ( id, title ),
        client_org:client_org_id ( id, name )`)
      .eq("tenant_id", tenantId)
      .neq("status", "draft")
      .order("last_activity_at", { ascending: false })
      .limit(500);
    if (error) { toast.error(error.message); return; }
    setRows((data as any[]) ?? []);
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [tenantId]);

  useEffect(() => {
    if (!tenantId) return;
    const ch = supabase
      .channel(`pipeline-${tenantId}`)
      .on("postgres_changes",
        { event: "*", schema: "public", table: "candidate_submissions", filter: `tenant_id=eq.${tenantId}` },
        () => load())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
    /* eslint-disable-next-line */
  }, [tenantId]);

  const clients = useMemo(() => {
    const map = new Map<string, string>();
    (rows ?? []).forEach((r: any) => { if (r.client_org?.id) map.set(r.client_org.id, r.client_org.name ?? "—"); });
    return Array.from(map.entries());
  }, [rows]);

  const recruiters = useMemo(() => {
    const set = new Set<string>();
    (rows ?? []).forEach((r: any) => r.submitted_by && set.add(r.submitted_by));
    return Array.from(set);
  }, [rows]);

  const filtered = useMemo(() => {
    if (!rows) return [];
    const q = search.trim().toLowerCase();
    return rows.filter((r: any) => {
      if (clientFilter !== "all" && r.client_org_id !== clientFilter) return false;
      if (recruiterFilter !== "all" && r.submitted_by !== recruiterFilter) return false;
      if (!q) return true;
      return (
        r.candidate?.full_name?.toLowerCase().includes(q) ||
        r.job?.title?.toLowerCase().includes(q) ||
        r.client_org?.name?.toLowerCase().includes(q)
      );
    });
  }, [rows, search, clientFilter, recruiterFilter]);

  const counters = useMemo(() => {
    const c: Record<string, number> = {};
    COUNTER_STAGES.forEach(s => { c[s] = 0; });
    filtered.forEach(r => { if (c[r.status] !== undefined) c[r.status] += 1; });
    return c;
  }, [filtered]);

  const handleMove = async (id: string, to: SubmissionStatus) => {
    const prev = rows;
    setRows((cur) => (cur ?? []).map(r => r.id === id ? { ...r, status: to, last_activity_at: new Date().toISOString() } : r));
    const { error } = await supabase.rpc("set_submission_status" as any, {
      _submission_id: id,
      _to_status: to,
      _note: null,
    });
    if (error) {
      setRows(prev ?? []);
      toast.error(error.message);
      return;
    }
    toast.success(`Moved to ${SUBMISSION_STATUS_META[to].label}`);
  };

  return (
    <AppLayout>
      <div className="space-y-6">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Kanban className="h-5 w-5 text-primary" />
            <h1 className="text-2xl font-semibold tracking-tight">Client Submission Pipeline</h1>
          </div>
          <p className="text-sm text-muted-foreground">
            Single source of truth for every candidate after they're sent to a client.
          </p>
        </div>

        {/* Counters */}
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
          {COUNTER_STAGES.map((s) => (
            <Card key={s}>
              <CardContent className="p-3">
                <div className="text-xs text-muted-foreground">{SUBMISSION_STATUS_META[s].label}</div>
                <div className="text-2xl font-semibold tracking-tight mt-1">
                  {rows === null ? <Skeleton className="h-7 w-10" /> : counters[s]}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Metrics */}
        {rows !== null && <SubmissionMetricsBar rows={filtered} />}

        {/* Filters */}
        <Card>
          <CardContent className="p-3 flex flex-col md:flex-row gap-2 md:items-center">
            <Input
              placeholder="Search candidate, job or client..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="md:max-w-xs"
            />
            <Select value={clientFilter} onValueChange={setClientFilter}>
              <SelectTrigger className="md:w-56"><SelectValue placeholder="All clients" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All clients</SelectItem>
                {clients.map(([id, name]) => <SelectItem key={id} value={id}>{name}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={recruiterFilter} onValueChange={setRecruiterFilter}>
              <SelectTrigger className="md:w-56"><SelectValue placeholder="All recruiters" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All recruiters</SelectItem>
                {recruiters.map((id) => <SelectItem key={id} value={id}>Recruiter {id.slice(0,8)}</SelectItem>)}
              </SelectContent>
            </Select>
          </CardContent>
        </Card>

        {/* Board */}
        <Tabs defaultValue="kanban">
          <TabsList>
            <TabsTrigger value="kanban">Kanban</TabsTrigger>
            <TabsTrigger value="list">List</TabsTrigger>
          </TabsList>
          <TabsContent value="kanban" className="mt-4">
            {rows === null ? (
              <div className="flex gap-3 overflow-x-auto">
                {[1,2,3,4,5].map(i => <Skeleton key={i} className="w-72 h-64 shrink-0" />)}
              </div>
            ) : (
              <SubmissionKanban rows={filtered} onMove={handleMove} onOpen={setOpenId} />
            )}
          </TabsContent>
          <TabsContent value="list" className="mt-4">
            <Card>
              <CardContent className="p-0 divide-y">
                {filtered.length === 0 && <div className="p-8 text-center text-sm text-muted-foreground">No submissions match these filters.</div>}
                {filtered.map((r: any) => (
                  <button key={r.id} onClick={() => setOpenId(r.id)}
                    className="w-full flex items-center justify-between p-3 hover:bg-muted/40 transition-colors text-left">
                    <div className="min-w-0">
                      <div className="text-sm font-medium truncate">{r.candidate?.full_name}</div>
                      <div className="text-[11px] text-muted-foreground truncate">
                        {r.client_org?.name} · {r.job?.title}
                      </div>
                    </div>
                    <span className="text-xs text-muted-foreground ml-2 shrink-0">{SUBMISSION_STATUS_META[r.status as SubmissionStatus].label}</span>
                  </button>
                ))}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        <SubmissionDetailDialog submissionId={openId} open={!!openId} onOpenChange={(v) => !v && setOpenId(null)} />
      </div>
    </AppLayout>
  );
}
