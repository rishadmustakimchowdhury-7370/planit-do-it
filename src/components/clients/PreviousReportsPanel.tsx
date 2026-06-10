import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  History, Copy, Pencil, GitBranch, CheckCircle2, FileText, Loader2,
  ChevronDown, ChevronUp, Download, Eye, Package, Send,
} from "lucide-react";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";
import { SubmitToAnotherClientDialog } from "./SubmitToAnotherClientDialog";

type Row = {
  id: string;
  version: number;
  status: string;
  report_data: any;
  created_at: string;
  job_id: string;
  recruiter_id: string | null;
  job?: { id: string; title: string | null; client_id?: string | null } | null;
  client?: { id: string; name: string | null } | null;
  recruiter_name?: string | null;
  pack_file?: { id: string; storage_path: string; file_name: string } | null;
};

interface Props {
  tenantId: string;
  jobId: string;
  candidateId: string;
  onAfterCopy?: () => void;
  onEditAfterCopy?: () => void;
}

export function PreviousReportsPanel({
  tenantId, jobId, candidateId, onAfterCopy, onEditAfterCopy,
}: Props) {
  const [rows, setRows] = useState<Row[] | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [collapsed, setCollapsed] = useState(false);
  const [submitTo, setSubmitTo] = useState<Row | null>(null);

  async function load() {
    const { data, error } = await supabase
      .from("client_submission_reports")
      .select(`id, version, status, report_data, created_at, job_id, recruiter_id,
        job:job_id ( id, title, client_id )`)
      .eq("tenant_id", tenantId)
      .eq("candidate_id", candidateId)
      .order("created_at", { ascending: false })
      .limit(50);
    if (error) { toast.error(error.message); setRows([]); return; }

    const list = ((data as any[]) ?? []) as Row[];

    // Resolve client names
    const clientIds = Array.from(new Set(list.map(r => r.job?.client_id).filter(Boolean) as string[]));
    if (clientIds.length) {
      const { data: clients } = await supabase
        .from("clients").select("id, name").in("id", clientIds);
      const map = new Map((clients ?? []).map((c: any) => [c.id, c]));
      list.forEach(r => {
        const cid = r.job?.client_id;
        if (cid && map.has(cid)) r.client = map.get(cid) as any;
      });
    }

    // Resolve recruiter names
    const recruiterIds = Array.from(new Set(list.map(r => r.recruiter_id).filter(Boolean) as string[]));
    if (recruiterIds.length) {
      const { data: profs } = await supabase
        .from("profiles").select("id, full_name, email").in("id", recruiterIds);
      const pMap = new Map((profs ?? []).map((p: any) => [p.id, p.full_name || p.email]));
      list.forEach(r => { if (r.recruiter_id) r.recruiter_name = pMap.get(r.recruiter_id) ?? null; });
    }

    // Resolve combined pack files
    const reportIds = list.map(r => r.id);
    if (reportIds.length) {
      const { data: files } = await supabase
        .from("client_submission_pack_files")
        .select("id, report_id, storage_path, file_name, pack_option, created_at")
        .in("report_id", reportIds)
        .order("created_at", { ascending: false });
      const byReport = new Map<string, any>();
      (files ?? []).forEach((f: any) => {
        if (!byReport.has(f.report_id)) byReport.set(f.report_id, f);
      });
      list.forEach(r => { r.pack_file = byReport.get(r.id) ?? null; });
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

  async function openFile(row: Row, mode: "view" | "download") {
    if (!row.pack_file) { toast.error("No combined pack found for this report"); return; }
    const { data, error } = await supabase.storage
      .from("submission-packs")
      .createSignedUrl(row.pack_file.storage_path, 3600,
        mode === "download" ? { download: row.pack_file.file_name } : undefined);
    if (error || !data?.signedUrl) { toast.error(error?.message ?? "Could not open file"); return; }
    window.open(data.signedUrl, "_blank");
  }

  if (rows === null) return <Skeleton className="h-24" />;
  if (!rows.length) return null;

  return (
    <>
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
            Reuse, clone or re-submit to another client — no regeneration needed
          </span>
          <span className="ml-auto text-muted-foreground">
            {collapsed ? <ChevronDown className="h-4 w-4" /> : <ChevronUp className="h-4 w-4" />}
          </span>
        </button>

        {!collapsed && (
          <div className="space-y-2">
            {rows.map((r) => {
              const busy = busyId === r.id;
              const isCurrentJob = r.job_id === jobId;
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
                        className="text-[10px] capitalize"
                      >
                        {r.status}
                      </Badge>
                      {isCurrentJob && <Badge variant="outline" className="text-[10px]">this job</Badge>}
                      {r.client?.name && (
                        <span className="text-[11px] text-muted-foreground">
                          · for {r.client.name}
                        </span>
                      )}
                      {r.recruiter_name && (
                        <span className="text-[11px] text-muted-foreground">
                          · by {r.recruiter_name}
                        </span>
                      )}
                    </div>
                    <div className="text-[11px] text-muted-foreground">
                      Created {formatDistanceToNow(new Date(r.created_at), { addSuffix: true })}
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 flex-wrap">
                    {r.pack_file && (
                      <>
                        <Button size="sm" variant="ghost" onClick={() => openFile(r, "view")}
                          title="View combined CV + report pack">
                          <Eye className="h-3 w-3 mr-1" /> View Pack
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => openFile(r, "download")}
                          title="Download combined pack">
                          <Download className="h-3 w-3 mr-1" /> Download
                        </Button>
                      </>
                    )}
                    {!isCurrentJob && (
                      <>
                        <Button
                          size="sm"
                          disabled={busy}
                          onClick={() => copyInto(r, { status: "approved", toastMsg: "Report reused — approved and ready to send" })}
                          title="Copy as-is into this job and mark Approved"
                        >
                          {busy ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : <CheckCircle2 className="h-3 w-3 mr-1" />}
                          Reuse
                        </Button>
                        <Button
                          size="sm" variant="outline" disabled={busy}
                          onClick={() => copyInto(r, { status: "draft", toastMsg: "Report cloned as draft for this job" })}
                          title="Copy as a draft so you can review before sending"
                        >
                          <Copy className="h-3 w-3 mr-1" /> Clone
                        </Button>
                        <Button
                          size="sm" variant="outline" disabled={busy}
                          onClick={() => copyInto(r, { status: "draft", toastMsg: "Report copied — opened for editing", thenEdit: true })}
                          title="Copy as draft and jump to the editor"
                        >
                          <Pencil className="h-3 w-3 mr-1" /> Edit
                        </Button>
                        <Button
                          size="sm" variant="ghost" disabled={busy}
                          onClick={() => copyInto(r, { status: "draft", toastMsg: "New version created from this report" })}
                          title="Create a new draft version on this job"
                        >
                          <GitBranch className="h-3 w-3 mr-1" /> New Version
                        </Button>
                      </>
                    )}
                    <Button
                      size="sm" variant="secondary"
                      onClick={() => setSubmitTo(r)}
                      title="Submit this report to another client / job"
                    >
                      <Send className="h-3 w-3 mr-1" /> Submit To Another Client
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>

    {submitTo && (
      <SubmitToAnotherClientDialog
        open={!!submitTo}
        onOpenChange={(v) => { if (!v) setSubmitTo(null); }}
        tenantId={tenantId}
        candidateId={candidateId}
        sourceReportData={submitTo.report_data}
      />
    )}
    </>
  );
}
