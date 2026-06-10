import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  History, Copy, Pencil, GitBranch, CheckCircle2, FileText, Loader2, ChevronDown, ChevronUp,
} from "lucide-react";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";

type Row = {
  id: string;
  version: number;
  status: string;
  report_data: any;
  created_at: string;
  job_id: string;
  job?: { id: string; title: string | null; client_id?: string | null } | null;
  client?: { id: string; name: string | null } | null;
};

interface Props {
  tenantId: string;
  jobId: string;          // current job
  candidateId: string;
  onAfterCopy?: () => void;       // refresh parent versions
  onEditAfterCopy?: () => void;   // scroll to editor
}

export function PreviousReportsPanel({
  tenantId, jobId, candidateId, onAfterCopy, onEditAfterCopy,
}: Props) {
  const [rows, setRows] = useState<Row[] | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [collapsed, setCollapsed] = useState(false);

  async function load() {
    const { data, error } = await supabase
      .from("client_submission_reports")
      .select(`id, version, status, report_data, created_at, job_id,
        job:job_id ( id, title, client_id )`)
      .eq("tenant_id", tenantId)
      .eq("candidate_id", candidateId)
      .neq("job_id", jobId)
      .order("created_at", { ascending: false })
      .limit(25);
    if (error) { toast.error(error.message); setRows([]); return; }

    const list = ((data as any[]) ?? []) as Row[];
    const clientIds = Array.from(new Set(
      list.map(r => r.job?.client_id).filter(Boolean) as string[]
    ));
    if (clientIds.length) {
      const { data: clients } = await supabase
        .from("clients").select("id, name").in("id", clientIds);
      const map = new Map((clients ?? []).map((c: any) => [c.id, c]));
      list.forEach(r => {
        const cid = r.job?.client_id;
        if (cid && map.has(cid)) r.client = map.get(cid) as any;
      });
    }
    setRows(list);
  }

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [tenantId, jobId, candidateId]);

  async function nextVersion(): Promise<number> {
    const { data } = await supabase
      .from("client_submission_reports")
      .select("version")
      .eq("tenant_id", tenantId).eq("job_id", jobId).eq("candidate_id", candidateId)
      .order("version", { ascending: false }).limit(1).maybeSingle();
    return ((data as any)?.version ?? 0) + 1;
  }

  async function copyInto(source: Row, opts: { status: "draft" | "approved"; toastMsg: string; thenEdit?: boolean }) {
    setBusyId(source.id);
    try {
      const v = await nextVersion();
      const { data: { user } } = await supabase.auth.getUser();
      const { error } = await supabase.from("client_submission_reports").insert({
        tenant_id: tenantId,
        job_id: jobId,
        candidate_id: candidateId,
        recruiter_id: user?.id ?? null,
        generated_by: user?.id ?? null,
        version: v,
        status: opts.status,
        report_data: source.report_data,
        approved_at: opts.status === "approved" ? new Date().toISOString() : null,
        approved_by: opts.status === "approved" ? (user?.id ?? null) : null,
      });
      if (error) throw error;
      toast.success(opts.toastMsg);
      onAfterCopy?.();
      if (opts.thenEdit) onEditAfterCopy?.();
    } catch (e: any) {
      toast.error(e?.message ?? "Could not copy report");
    } finally {
      setBusyId(null);
    }
  }

  if (rows === null) {
    return <Skeleton className="h-24" />;
  }
  if (!rows.length) return null;

  return (
    <Card className="border-primary/20">
      <CardContent className="p-3 space-y-3">
        <button
          type="button"
          onClick={() => setCollapsed((c) => !c)}
          className="w-full flex items-center gap-2 text-left"
        >
          <History className="h-4 w-4 text-primary" />
          <span className="text-sm font-semibold">Previous Reports for This Candidate</span>
          <Badge variant="outline" className="text-[10px]">{rows.length}</Badge>
          <span className="text-[11px] text-muted-foreground ml-1">
            Submit to a new client without regenerating
          </span>
          <span className="ml-auto text-muted-foreground">
            {collapsed ? <ChevronDown className="h-4 w-4" /> : <ChevronUp className="h-4 w-4" />}
          </span>
        </button>

        {!collapsed && (
          <div className="space-y-2">
            {rows.map((r) => {
              const busy = busyId === r.id;
              return (
                <div
                  key={r.id}
                  className="rounded-md border bg-card p-3 flex flex-wrap items-center gap-3"
                >
                  <div className="h-8 w-8 rounded-md bg-primary/10 text-primary flex items-center justify-center shrink-0">
                    <FileText className="h-4 w-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-medium truncate">
                        {r.job?.title || "Untitled job"}
                      </span>
                      <Badge variant="secondary" className="text-[10px]">v{r.version}</Badge>
                      <Badge
                        variant={r.status === "approved" ? "default" : "outline"}
                        className="text-[10px]"
                      >
                        {r.status}
                      </Badge>
                      {r.client?.name && (
                        <span className="text-[11px] text-muted-foreground">
                          · for {r.client.name}
                        </span>
                      )}
                    </div>
                    <div className="text-[11px] text-muted-foreground">
                      Created {formatDistanceToNow(new Date(r.created_at), { addSuffix: true })}
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 flex-wrap">
                    <Button
                      size="sm"
                      disabled={busy}
                      onClick={() => copyInto(r, {
                        status: "approved",
                        toastMsg: "Report reused — approved and ready to send",
                      })}
                      title="Copy as-is into this job and mark Approved"
                    >
                      {busy ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : <CheckCircle2 className="h-3 w-3 mr-1" />}
                      Reuse
                    </Button>
                    <Button
                      size="sm" variant="outline" disabled={busy}
                      onClick={() => copyInto(r, {
                        status: "draft",
                        toastMsg: "Report cloned as draft for this job",
                      })}
                      title="Copy as a draft so you can review before sending"
                    >
                      <Copy className="h-3 w-3 mr-1" /> Clone
                    </Button>
                    <Button
                      size="sm" variant="outline" disabled={busy}
                      onClick={() => copyInto(r, {
                        status: "draft",
                        toastMsg: "Report copied — opened for editing",
                        thenEdit: true,
                      })}
                      title="Copy as draft and jump to the editor"
                    >
                      <Pencil className="h-3 w-3 mr-1" /> Edit
                    </Button>
                    <Button
                      size="sm" variant="ghost" disabled={busy}
                      onClick={() => copyInto(r, {
                        status: "draft",
                        toastMsg: "New version created from this report",
                      })}
                      title="Create a new draft version on this job from this report"
                    >
                      <GitBranch className="h-3 w-3 mr-1" /> New Version
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
