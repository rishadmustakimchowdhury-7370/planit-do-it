import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Sparkles, FileText, CheckCircle2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useLatestValidation, useValidateCandidateFit } from "@/hooks/useCandidateValidation";
import { useCreateSubmission } from "@/hooks/useSubmissionPack";
import { AIValidationCard } from "@/components/clients/AIValidationCard";
import { SubmissionWorkspace } from "@/components/clients/SubmissionWorkspace";
import { toast } from "sonner";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  tenantId: string;
  jobId: string;
  candidateId: string;
  candidateName: string;
  jobTitle: string;
  defaultClientOrgId?: string | null;
  onCompleted?: (submissionId: string) => void;
}

type Step = 1 | 2 | 3 | 4;

export function SubmissionWizard({
  open, onOpenChange, tenantId, jobId, candidateId, candidateName, jobTitle, defaultClientOrgId, onCompleted,
}: Props) {
  const [step, setStep] = useState<Step>(1);
  const [clientOrgId, setClientOrgId] = useState<string>(defaultClientOrgId ?? "");
  const [clients, setClients] = useState<Array<{ id: string; name: string }>>([]);
  const [message, setMessage] = useState("");
  const [submissionId, setSubmissionId] = useState<string | null>(null);

  const { data: validation } = useLatestValidation(jobId, candidateId);
  const { run: runValidation, loading: validating } = useValidateCandidateFit();
  const createSubmission = useCreateSubmission();

  useEffect(() => {
    if (!open) return;
    setStep(1);
    setSubmissionId(null);
    setMessage("");
    setClientOrgId(defaultClientOrgId ?? "");
    (async () => {
      const { data } = await supabase
        .from("client_organizations")
        .select("id, name")
        .eq("tenant_id", tenantId)
        .order("name");
      setClients(data ?? []);
    })();
  }, [open, tenantId, defaultClientOrgId]);

  const canNextFrom1 = !!clientOrgId;
  const canNextFrom2 = !!validation;

  const handleCreate = async () => {
    if (!validation) { toast.error("Run AI validation first"); return; }
    try {
      const created = await createSubmission.mutateAsync({
        tenant_id: tenantId, job_id: jobId, candidate_id: candidateId,
        client_org_id: clientOrgId, submission_message: message || undefined,
        ai_validation_id: validation.id,
      });
      setSubmissionId(created.id);
      setStep(4);
      onCompleted?.(created.id);
    } catch (e: any) {
      toast.error("Couldn't start the submission. Please retry.");
    }
  };

  const isWorkspace = step === 4 && submissionId;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={isWorkspace
        ? "max-w-[1200px] w-[95vw] h-[90vh] p-0 overflow-hidden flex flex-col"
        : "max-w-3xl max-h-[90vh] overflow-hidden flex flex-col"}>
        <DialogHeader className={isWorkspace ? "px-5 pt-4 pb-2" : ""}>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            Submit {candidateName} for {jobTitle}
          </DialogTitle>
        </DialogHeader>

        {!isWorkspace && <Stepper step={step} />}

        {isWorkspace ? (
          <SubmissionWorkspace
            submissionId={submissionId!}
            tenantId={tenantId}
            clientOrgId={clientOrgId}
            candidateName={candidateName}
            jobTitle={jobTitle}
            onClose={() => onOpenChange(false)}
          />
        ) : (
          <>
            <div className="flex-1 overflow-y-auto py-4 space-y-4">
              {step === 1 && (
                <div className="space-y-3">
                  <Label>Client Organization</Label>
                  <select
                    value={clientOrgId}
                    onChange={(e) => setClientOrgId(e.target.value)}
                    className="w-full h-10 rounded-md border bg-background px-3 text-sm"
                  >
                    <option value="">Select a client…</option>
                    {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                  <p className="text-sm text-muted-foreground">Pick the client this candidate will be submitted to. Specific recipients are configured in the next step.</p>
                </div>
              )}

              {step === 2 && (
                <AIValidationCard jobId={jobId} candidateId={candidateId} />
              )}

              {step === 3 && (
                <div className="space-y-3">
                  <Label>Recruiter Notes (optional)</Label>
                  <Textarea
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    placeholder="Why is this candidate a great fit? Anything the client should know…"
                    rows={8}
                  />
                  <p className="text-xs text-muted-foreground">You'll be able to edit this and the AI content in the next step.</p>
                </div>
              )}
            </div>

            <DialogFooter className="border-t pt-3">
              {step === 1 && (
                <>
                  <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
                  <Button disabled={!canNextFrom1} onClick={() => setStep(2)}>Next</Button>
                </>
              )}
              {step === 2 && (
                <>
                  <Button variant="ghost" onClick={() => setStep(1)}>Back</Button>
                  {!validation ? (
                    <Button onClick={() => runValidation(jobId, candidateId).catch(() => {})} disabled={validating}>
                      {validating ? "Analyzing…" : "Run AI Validation"}
                    </Button>
                  ) : (
                    <Button disabled={!canNextFrom2} onClick={() => setStep(3)}>Next</Button>
                  )}
                </>
              )}
              {step === 3 && (
                <>
                  <Button variant="ghost" onClick={() => setStep(2)}>Back</Button>
                  <Button onClick={handleCreate} disabled={createSubmission.isPending}>
                    <FileText className="h-4 w-4 mr-2" />
                    {createSubmission.isPending ? "Preparing…" : "Open Delivery Workspace"}
                  </Button>
                </>
              )}
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

function Stepper({ step }: { step: Step }) {
  const items = ["Client", "AI Validation", "Notes", "Pack"];
  return (
    <div className="flex items-center gap-2 px-1 pt-1">
      {items.map((label, i) => {
        const n = (i + 1) as Step;
        const active = step === n;
        const done = step > n;
        return (
          <div key={label} className="flex items-center gap-2 flex-1">
            <div className={`h-7 w-7 rounded-full text-xs font-semibold flex items-center justify-center
              ${done ? "bg-primary text-primary-foreground" :
                active ? "bg-primary/10 text-primary border border-primary" :
                "bg-muted text-muted-foreground"}`}>
              {done ? <CheckCircle2 className="h-4 w-4" /> : n}
            </div>
            <span className={`text-xs ${active ? "font-medium text-foreground" : "text-muted-foreground"}`}>{label}</span>
            {i < items.length - 1 && <div className="flex-1 h-px bg-border" />}
          </div>
        );
      })}
    </div>
  );
}
