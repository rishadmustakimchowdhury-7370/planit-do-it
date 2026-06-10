import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, KanbanSquare } from "lucide-react";
import { toast } from "sonner";
import { SUBMISSION_STATUS_META, type SubmissionStatus } from "./SubmissionStatusBadge";

const STAGES: SubmissionStatus[] = [
  "submitted", "viewed", "screening", "interview_requested", "interview_confirmed",
  "final_review", "offer", "hired", "rejected", "on_hold",
];

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  tenantId: string;
  jobId: string;
  candidateId: string;
  primaryPackId?: string | null;
  onAdded?: (submissionId: string) => void;
}

export function AddToPipelineDialog({
  open, onOpenChange, tenantId, jobId, candidateId, primaryPackId, onAdded,
}: Props) {
  const { user } = useAuth();
  const [stage, setStage] = useState<SubmissionStatus>("submitted");
  const [busy, setBusy] = useState(false);

  async function resolveClientOrgId(): Promise<string> {
    const { data: job, error: jErr } = await supabase
      .from("jobs").select("client_id").eq("id", jobId).maybeSingle();
    if (jErr) throw jErr;
    if (!job?.client_id) throw new Error("This job has no client attached.");

    const { data: client, error: cErr } = await supabase
      .from("clients").select("id, name").eq("id", job.client_id).maybeSingle();
    if (cErr) throw cErr;
    if (!client) throw new Error("Client not found.");

    const { data: existing, error: findErr } = await supabase
      .from("client_organizations")
      .select("id")
      .eq("tenant_id", tenantId)
      .eq("client_id", client.id)
      .maybeSingle();
    if (findErr) throw findErr;
    if (existing?.id) return existing.id;

    const { data: created, error: insErr } = await supabase
      .from("client_organizations")
      .insert({
        tenant_id: tenantId,
        client_id: client.id,
        name: client.name,
        is_active: true,
        created_by: user?.id ?? null,
      })
      .select("id").single();
    if (insErr) throw insErr;
    return created.id;
  }

  async function submit() {
    setBusy(true);
    try {
      const clientOrgId = await resolveClientOrgId();
      const nowIso = new Date().toISOString();

      const { data: existing, error: findErr } = await supabase
        .from("candidate_submissions")
        .select("id")
        .eq("tenant_id", tenantId)
        .eq("job_id", jobId)
        .eq("candidate_id", candidateId)
        .eq("client_org_id", clientOrgId)
        .maybeSingle();
      if (findErr) throw findErr;

      let submissionId: string;
      if (existing?.id) {
        const { error: rpcErr } = await supabase.rpc("set_submission_status" as any, {
          _submission_id: existing.id,
          _to_status: stage,
          _note: "Manual pipeline entry",
        });
        if (rpcErr) throw rpcErr;
        submissionId = existing.id;
      } else {
        const { data: inserted, error: insErr } = await supabase
          .from("candidate_submissions")
          .insert({
            tenant_id: tenantId,
            job_id: jobId,
            candidate_id: candidateId,
            client_org_id: clientOrgId,
            status: stage,
            source: "manual",
            submitted_by: user?.id ?? null,
            submitted_at: nowIso,
            last_activity_at: nowIso,
            pack_status: primaryPackId ? "ready" : "none",
            pack_components: primaryPackId ? { pack_file_id: primaryPackId } : {},
            structured_notes: {},
          } as any)
          .select("id").single();
        if (insErr) throw insErr;
        submissionId = inserted!.id;
      }

      toast.success("Candidate added to pipeline.");
      onAdded?.(submissionId);
      onOpenChange(false);
    } catch (e: any) {
      toast.error(e?.message ?? "Failed to add to pipeline");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <KanbanSquare className="h-4 w-4 text-primary" /> Add To Pipeline
          </DialogTitle>
          <DialogDescription>
            Manually place this candidate at a stage in the Client Submission Pipeline. No email will be sent.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2 py-2">
          <Label>Select Stage</Label>
          <Select value={stage} onValueChange={(v) => setStage(v as SubmissionStatus)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {STAGES.map((s) => (
                <SelectItem key={s} value={s}>{SUBMISSION_STATUS_META[s].label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={busy}>Cancel</Button>
          <Button onClick={submit} disabled={busy}>
            {busy ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : null}
            Add To Pipeline
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
