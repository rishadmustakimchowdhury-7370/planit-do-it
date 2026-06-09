import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Package, Loader2, Download, FileText, Sparkles, History } from "lucide-react";
import { toast } from "sonner";

interface Props {
  tenantId: string;
  jobId: string;
  candidateId: string;
}

type PackRow = {
  id: string;
  pack_option: "A" | "B" | "C";
  storage_path: string;
  file_name: string;
  file_size: number | null;
  created_at: string;
};

const OPTIONS: { key: "A" | "B" | "C"; title: string; desc: string }[] = [
  { key: "A", title: "AI Report PDF", desc: "Recruiter assessment report only" },
  { key: "B", title: "Original CV + AI Report", desc: "Candidate's CV followed by the AI report" },
  { key: "C", title: "Branded CV + AI Report", desc: "Branded cover page, CV, and AI report" },
];

export function SubmissionPackBuilder({ tenantId, jobId, candidateId }: Props) {
  const [latestReport, setLatestReport] = useState<{ id: string; version: number; status: string } | null>(null);
  const [history, setHistory] = useState<PackRow[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  async function refresh() {
    setLoading(true);
    const [{ data: rep }, { data: files }] = await Promise.all([
      supabase.from("client_submission_reports")
        .select("id, version, status")
        .eq("tenant_id", tenantId).eq("job_id", jobId).eq("candidate_id", candidateId)
        .order("version", { ascending: false }).limit(1).maybeSingle(),
      supabase.from("client_submission_pack_files")
        .select("id, pack_option, storage_path, file_name, file_size, created_at")
        .eq("tenant_id", tenantId).eq("job_id", jobId).eq("candidate_id", candidateId)
        .order("created_at", { ascending: false }),
    ]);
    setLatestReport(rep as any);
    setHistory((files ?? []) as PackRow[]);
    setLoading(false);
  }

  useEffect(() => { refresh(); /* eslint-disable-next-line */ }, [tenantId, jobId, candidateId]);

  async function approve() {
    if (!latestReport) return;
    const { error } = await supabase.from("client_submission_reports")
      .update({ status: "approved" }).eq("id", latestReport.id);
    if (error) { toast.error(error.message); return; }
    toast.success(`Report v${latestReport.version} approved`);
    refresh();
  }

  async function build(option: "A" | "B" | "C") {
    if (!latestReport) { toast.error("Generate an AI report first"); return; }
    setBusy(option);
    try {
      const { data, error } = await supabase.functions.invoke("build-submission-pack", {
        body: { report_id: latestReport.id, pack_option: option },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      toast.success("Submission pack ready");
      if ((data as any)?.download_url) {
        window.open((data as any).download_url, "_blank");
      }
      refresh();
    } catch (e: any) {
      toast.error(e?.message ?? "Build failed");
    } finally { setBusy(null); }
  }

  async function download(row: PackRow) {
    const { data, error } = await supabase.storage.from("submission-packs")
      .createSignedUrl(row.storage_path, 3600);
    if (error || !data?.signedUrl) { toast.error(error?.message ?? "Could not get link"); return; }
    window.open(data.signedUrl, "_blank");
  }

  const approved = latestReport?.status === "approved";

  return (
    <Card>
      <CardContent className="p-5 space-y-4">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <div className="h-7 w-7 rounded-md bg-primary/10 text-primary flex items-center justify-center">
              <Package className="h-4 w-4" />
            </div>
            <h4 className="font-semibold text-sm">Generate Submission Pack</h4>
          </div>
          {latestReport && (
            approved
              ? <Badge variant="default" className="gap-1"><Sparkles className="h-3 w-3" />v{latestReport.version} Approved</Badge>
              : <Button size="sm" variant="outline" onClick={approve}>Approve Report v{latestReport.version}</Button>
          )}
        </div>

        {!latestReport ? (
          <p className="text-sm text-muted-foreground">Generate an AI Report above first, then build a submission pack.</p>
        ) : !approved ? (
          <p className="text-sm text-muted-foreground">Approve the AI report to unlock pack generation.</p>
        ) : (
          <div className="grid md:grid-cols-3 gap-3">
            {OPTIONS.map((opt) => (
              <div key={opt.key} className="border rounded-lg p-4 flex flex-col gap-3">
                <div className="flex items-start gap-2">
                  <Badge variant="secondary">Option {opt.key}</Badge>
                </div>
                <div>
                  <div className="font-semibold text-sm">{opt.title}</div>
                  <div className="text-xs text-muted-foreground mt-1">{opt.desc}</div>
                </div>
                <Button size="sm" disabled={busy !== null} onClick={() => build(opt.key)}>
                  {busy === opt.key
                    ? <><Loader2 className="h-3 w-3 mr-1 animate-spin" />Building...</>
                    : <><FileText className="h-3 w-3 mr-1" />Generate PDF</>}
                </Button>
              </div>
            ))}
          </div>
        )}

        {/* History */}
        {!loading && history.length > 0 && (
          <div className="space-y-2 pt-2 border-t">
            <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-muted-foreground">
              <History className="h-3 w-3" /> Submission history
            </div>
            <div className="space-y-1.5">
              {history.map((h) => (
                <div key={h.id} className="flex items-center justify-between gap-3 text-sm border rounded-md px-3 py-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <Badge variant="outline">Option {h.pack_option}</Badge>
                    <span className="truncate font-medium">{h.file_name}</span>
                    <span className="text-xs text-muted-foreground shrink-0">
                      {new Date(h.created_at).toLocaleString()}
                      {h.file_size ? ` · ${(h.file_size / 1024).toFixed(0)} KB` : ""}
                    </span>
                  </div>
                  <Button size="sm" variant="ghost" onClick={() => download(h)}>
                    <Download className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
