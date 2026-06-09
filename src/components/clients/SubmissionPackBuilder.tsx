import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Package, Loader2, FileText, Sparkles, ShieldAlert } from "lucide-react";
import { toast } from "sonner";

interface Props {
  tenantId: string;
  jobId: string;
  candidateId: string;
  /** Called after a successful build with the new pack id, so parent can jump to preview. */
  onBuilt?: (packId: string) => void;
  /** Bumped by parent to force a refetch of the latest report status. */
  refreshKey?: number;
}

const OPTIONS: { key: "A" | "B" | "C"; title: string; desc: string }[] = [
  { key: "A", title: "AI Report Only", desc: "Recruiter assessment report only" },
  { key: "B", title: "Original CV + Report", desc: "AI report followed by the candidate's original CV (no cover page)" },
  { key: "C", title: "Branded CV + Report", desc: "AI report followed by an agency-branded CV (no cover page)" },
];

type BuildDiag = {
  branding_diagnostics?: {
    agency_name: string | null; stored_logo_url: string | null; resolved_logo_url: string | null;
    logo_status: string; logo_reason: string; last_attempt: string;
  };
  merge_validation?: {
    report_pages: number; cv_pages: number; total_pages: number; expected_total: number;
    cv_source: string; failed_parts: number[]; merge_status: string;
  };
};

type LifecycleStatus = "none" | "draft" | "approved" | "generated" | "sent";

export function SubmissionPackBuilder({ tenantId, jobId, candidateId, onBuilt, refreshKey }: Props) {
  const [latestReport, setLatestReport] = useState<{ id: string; version: number; status: string } | null>(null);
  const [lifecycle, setLifecycle] = useState<LifecycleStatus>("none");
  const [busy, setBusy] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [watermark, setWatermark] = useState(false);
  const [lastDiag, setLastDiag] = useState<BuildDiag | null>(null);

  async function refresh() {
    setLoading(true);
    const { data: rep } = await supabase.from("client_submission_reports")
      .select("id, version, status")
      .eq("tenant_id", tenantId).eq("job_id", jobId).eq("candidate_id", candidateId)
      .order("version", { ascending: false }).limit(1).maybeSingle();
    setLatestReport(rep as any);

    // Derive lifecycle status from packs & emails
    let next: LifecycleStatus = "none";
    if (rep) next = (rep as any).status === "approved" ? "approved" : "draft";
    const [{ count: packs }, { count: emails }] = await Promise.all([
      supabase.from("client_submission_pack_files")
        .select("id", { count: "exact", head: true })
        .eq("tenant_id", tenantId).eq("job_id", jobId).eq("candidate_id", candidateId),
      supabase.from("client_emails")
        .select("id", { count: "exact", head: true })
        .eq("tenant_id", tenantId).eq("job_id", jobId).eq("candidate_id", candidateId)
        .in("status", ["sent", "sending"]),
    ]);
    if ((packs ?? 0) > 0 && next !== "none") next = "generated";
    if ((emails ?? 0) > 0) next = "sent";
    setLifecycle(next);
    setLoading(false);
  }

  useEffect(() => { refresh(); /* eslint-disable-next-line */ }, [tenantId, jobId, candidateId, refreshKey]);

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
        body: { report_id: latestReport.id, pack_option: option, watermark },
      });
      // Read backend body even on non-2xx so the user sees real errors (CV merge failed, etc.)
      let payload: any = data ?? null;
      if (error) {
        const ctx: any = (error as any).context;
        if (ctx && typeof ctx.text === "function") {
          try { payload = JSON.parse(await ctx.text()); } catch { /* ignore */ }
        }
        if (payload?.branding_diagnostics || payload?.merge_validation) setLastDiag(payload);
        throw new Error(payload?.error || error.message);
      }
      if ((payload as any)?.error) throw new Error((payload as any).error);
      setLastDiag(payload as BuildDiag);
      const mv = payload?.merge_validation;
      toast.success(
        mv ? `Submission pack ready (${mv.report_pages} report + ${mv.cv_pages} CV = ${mv.total_pages} pages)`
           : "Submission pack ready"
      );
      const newId = (payload as any)?.pack?.id;
      if (newId) onBuilt?.(newId);
    } catch (e: any) {
      toast.error(e?.message ?? "Build failed", { duration: 8000 });
    } finally { setBusy(null); }
  }


  const approved = latestReport?.status === "approved";

  return (
    <Card>
      <CardContent className="p-5 space-y-4">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-2">
            <div className="h-7 w-7 rounded-md bg-primary/10 text-primary flex items-center justify-center">
              <Package className="h-4 w-4" />
            </div>
            <h4 className="font-semibold text-sm">Generate Submission Pack</h4>
            <LifecycleBadge status={lifecycle} />

          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5">
              <Switch id="wm" checked={watermark} onCheckedChange={setWatermark} />
              <Label htmlFor="wm" className="text-xs flex items-center gap-1">
                <ShieldAlert className="h-3 w-3" />Confidential watermark
              </Label>
            </div>
            {latestReport && (
              approved
                ? <Badge variant="default" className="gap-1"><Sparkles className="h-3 w-3" />v{latestReport.version} Approved</Badge>
                : <Button size="sm" variant="outline" onClick={approve}>Approve Report v{latestReport.version}</Button>
            )}
          </div>
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
      </CardContent>
    </Card>
  );
}

function LifecycleBadge({ status }: { status: LifecycleStatus }) {
  const map: Record<LifecycleStatus, { label: string; variant: "secondary" | "default" | "outline" }> = {
    none: { label: "No Report", variant: "outline" },
    draft: { label: "Draft", variant: "secondary" },
    approved: { label: "Approved", variant: "default" },
    generated: { label: "Pack Generated", variant: "default" },
    sent: { label: "Sent to Client", variant: "default" },
  };
  const { label, variant } = map[status];
  return <Badge variant={variant} className="text-[10px]">{label}</Badge>;
}

