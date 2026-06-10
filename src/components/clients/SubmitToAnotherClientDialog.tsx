import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, CheckCircle2, Pencil, GitBranch } from "lucide-react";
import { toast } from "sonner";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  tenantId: string;
  candidateId: string;
  sourceReportData: any;          // report_data jsonb to reuse
}

type ClientRow = { id: string; name: string | null; client_org_id: string | null };
type JobRow = { id: string; title: string | null; client_id: string | null };

export function SubmitToAnotherClientDialog({
  open, onOpenChange, tenantId, candidateId, sourceReportData,
}: Props) {
  const [clients, setClients] = useState<ClientRow[]>([]);
  const [jobs, setJobs] = useState<JobRow[]>([]);
  const [clientId, setClientId] = useState<string>("");
  const [jobId, setJobId] = useState<string>("");
  const [busy, setBusy] = useState<"reuse" | "edit" | "new" | null>(null);

  useEffect(() => {
    if (!open) return;
    setClientId(""); setJobId("");
    (async () => {
      const { data } = await supabase
        .from("clients")
        .select("id, name, client_org_id")
        .eq("tenant_id", tenantId)
        .order("name");
      setClients((data as any[]) ?? []);
    })();
  }, [open, tenantId]);

  useEffect(() => {
    if (!clientId) { setJobs([]); return; }
    (async () => {
      const { data } = await supabase
        .from("jobs")
        .select("id, title, client_id")
        .eq("tenant_id", tenantId)
        .eq("client_id", clientId)
        .order("created_at", { ascending: false });
      setJobs((data as any[]) ?? []);
    })();
  }, [clientId, tenantId]);

  async function nextVersion(targetJobId: string): Promise<number> {
    const { data } = await supabase
      .from("client_submission_reports")
      .select("version")
      .eq("tenant_id", tenantId)
      .eq("job_id", targetJobId)
      .eq("candidate_id", candidateId)
      .order("version", { ascending: false })
      .limit(1)
      .maybeSingle();
    return ((data as any)?.version ?? 0) + 1;
  }

  async function submitWith(mode: "reuse" | "edit" | "new") {
    if (!clientId || !jobId) { toast.error("Select a client and a job"); return; }
    setBusy(mode);
    try {
      const client = clients.find(c => c.id === clientId);
      const v = await nextVersion(jobId);
      const { data: { user } } = await supabase.auth.getUser();

      const status = mode === "reuse" ? "approved" : "draft";
      const { data: report, error: repErr } = await supabase
        .from("client_submission_reports")
        .insert({
          tenant_id: tenantId,
          job_id: jobId,
          candidate_id: candidateId,
          recruiter_id: user?.id ?? null,
          generated_by: user?.id ?? null,
          version: v,
          status,
          report_data: sourceReportData,
          approved_at: status === "approved" ? new Date().toISOString() : null,
          approved_by: status === "approved" ? (user?.id ?? null) : null,
        })
        .select("id")
        .single();
      if (repErr) throw repErr;

      // Create candidate_submissions row so it lands in pipeline
      if (client?.client_org_id) {
        const { error: subErr } = await supabase.from("candidate_submissions").insert({
          tenant_id: tenantId,
          job_id: jobId,
          candidate_id: candidateId,
          client_org_id: client.client_org_id,
          status: "screening",
          source: "reused_report",
          submitted_by: user?.id ?? null,
        });
        if (subErr && !String(subErr.message).includes("duplicate")) throw subErr;
      }

      toast.success(
        mode === "reuse" ? "Submitted — report reused as-is"
        : mode === "edit" ? "Draft created — open the report to edit"
        : "New version v" + v + " created"
      );
      onOpenChange(false);
    } catch (e: any) {
      toast.error(e?.message ?? "Failed to submit");
    } finally {
      setBusy(null);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Submit To Another Client</DialogTitle>
          <DialogDescription>
            Reuse this report on a different client and job. A new version is created — history is preserved.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-2">
          <div className="space-y-1">
            <Label>Client</Label>
            <Select value={clientId} onValueChange={(v) => { setClientId(v); setJobId(""); }}>
              <SelectTrigger><SelectValue placeholder="Choose a client" /></SelectTrigger>
              <SelectContent>
                {clients.map(c => (
                  <SelectItem key={c.id} value={c.id}>{c.name || "Unnamed"}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1">
            <Label>Job</Label>
            <Select value={jobId} onValueChange={setJobId} disabled={!clientId}>
              <SelectTrigger><SelectValue placeholder={clientId ? "Choose a job" : "Select a client first"} /></SelectTrigger>
              <SelectContent>
                {jobs.map(j => (
                  <SelectItem key={j.id} value={j.id}>{j.title || "Untitled job"}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <DialogFooter className="flex-wrap gap-2 sm:justify-between">
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={!!busy}>Cancel</Button>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" disabled={!jobId || !!busy} onClick={() => submitWith("edit")}>
              {busy === "edit" ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : <Pencil className="h-3 w-3 mr-1" />}
              Edit Before Submission
            </Button>
            <Button variant="outline" disabled={!jobId || !!busy} onClick={() => submitWith("new")}>
              {busy === "new" ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : <GitBranch className="h-3 w-3 mr-1" />}
              Create New Version
            </Button>
            <Button disabled={!jobId || !!busy} onClick={() => submitWith("reuse")}>
              {busy === "reuse" ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : <CheckCircle2 className="h-3 w-3 mr-1" />}
              Reuse Existing Report
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
