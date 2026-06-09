import { useEffect, useMemo, useRef, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Sparkles, User, Briefcase } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { RecruiterAssessmentSection } from "./RecruiterAssessmentSection";
import { ClientReportSection } from "./ClientReportSection";
import { SubmissionPackBuilder } from "./SubmissionPackBuilder";
import { SubmissionPackPreview } from "./SubmissionPackPreview";
import { SubmissionHistoryTable } from "./SubmissionHistoryTable";
import { ClientDeliveryWorkspace } from "./ClientDeliveryWorkspace";
import { PrepareForClientStepper, type StepKey } from "./PrepareForClientStepper";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  tenantId: string;
  jobId: string;
  candidateId: string;
  candidateName: string;
  jobTitle: string;
}

export function PrepareForClientDialog({
  open, onOpenChange, tenantId, jobId, candidateId, candidateName, jobTitle,
}: Props) {
  const [candidate, setCandidate] = useState<any | null>(null);
  const [job, setJob] = useState<any | null>(null);
  const [candidateLoading, setCandidateLoading] = useState(true);
  const [jobLoading, setJobLoading] = useState(true);
  const [candidateError, setCandidateError] = useState<string | null>(null);
  const [jobError, setJobError] = useState<string | null>(null);

  // Step state
  const [notesDone, setNotesDone] = useState(false);
  const [reportApproved, setReportApproved] = useState(false);
  const [hasPack, setHasPack] = useState(false);
  const [hasSent, setHasSent] = useState(false);
  const [previewPackId, setPreviewPackId] = useState<string | null>(null);
  const [deliveryAttachmentId, setDeliveryAttachmentId] = useState<string | null>(null);
  const [activeStep, setActiveStep] = useState<StepKey>("context");
  const [refreshKey, setRefreshKey] = useState(0);

  const refs = {
    context: useRef<HTMLDivElement>(null),
    notes: useRef<HTMLDivElement>(null),
    report: useRef<HTMLDivElement>(null),
    "preview-report": useRef<HTMLDivElement>(null),
    pack: useRef<HTMLDivElement>(null),
    "preview-pack": useRef<HTMLDivElement>(null),
    send: useRef<HTMLDivElement>(null),
    history: useRef<HTMLDivElement>(null),
  } as const;

  async function refreshStepState() {
    const [
      { data: notes },
      { data: report },
      { count: packCount },
      { count: emailCount },
    ] = await Promise.all([
      supabase.from("prepare_for_client_assessments")
        .select("id").eq("tenant_id", tenantId).eq("job_id", jobId).eq("candidate_id", candidateId).limit(1),
      supabase.from("client_submission_reports")
        .select("status").eq("tenant_id", tenantId).eq("job_id", jobId).eq("candidate_id", candidateId)
        .order("version", { ascending: false }).limit(1).maybeSingle(),
      supabase.from("client_submission_pack_files")
        .select("id", { count: "exact", head: true })
        .eq("tenant_id", tenantId).eq("job_id", jobId).eq("candidate_id", candidateId),
      supabase.from("client_emails")
        .select("id", { count: "exact", head: true })
        .eq("tenant_id", tenantId).eq("job_id", jobId).eq("candidate_id", candidateId)
        .in("status", ["sent", "sending"]),
    ]);
    setNotesDone((notes ?? []).length > 0);
    setReportApproved((report as any)?.status === "approved");
    setHasPack((packCount ?? 0) > 0);
    setHasSent((emailCount ?? 0) > 0);
  }

  useEffect(() => {
    if (!open) return;
    setCandidate(null); setJob(null); setActiveStep("context");
    setCandidateLoading(true); setJobLoading(true);
    setCandidateError(null); setJobError(null);
    setPreviewPackId(null); setDeliveryAttachmentId(null);
    (async () => {
      supabase.from("candidates")
        .select("id, full_name, current_title, current_company, email, phone, location, years_experience, skills")
        .eq("id", candidateId).maybeSingle()
        .then(({ data, error }) => {
          setCandidate(data ?? null);
          setCandidateError(error?.message ?? (!data ? "Candidate not found" : null));
          setCandidateLoading(false);
        });
      supabase.from("jobs")
        .select("id, title, location, employment_type, seniority_level, description")
        .eq("id", jobId).maybeSingle()
        .then(({ data, error }) => {
          setJob(data ?? null);
          setJobError(error?.message ?? (!data ? "Job not found" : null));
          setJobLoading(false);
        });
      refreshStepState();
    })();
  }, [open, candidateId, jobId, tenantId]);

  const steps = useMemo(() => ([
    { key: "context" as StepKey, label: "Candidate & Job", done: !!candidate && !!job },
    { key: "notes" as StepKey, label: "Recruiter Notes", done: notesDone },
    { key: "report" as StepKey, label: "AI Report", done: reportApproved },
    { key: "preview-pack" as StepKey, label: "Pack Preview", done: hasPack },
    { key: "pack" as StepKey, label: "Generate Pack", done: hasPack },
    { key: "send" as StepKey, label: "Send To Client", done: hasSent },
    { key: "history" as StepKey, label: "History", done: hasPack },
  ]), [candidate, job, notesDone, reportApproved, hasPack, hasSent]);

  function jumpTo(key: StepKey) {
    setActiveStep(key);
    refs[key].current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function handleBuilt(packId: string) {
    setPreviewPackId(packId);
    setDeliveryAttachmentId(packId);
    setRefreshKey((k) => k + 1);
    refreshStepState();
    setTimeout(() => jumpTo("preview-pack"), 100);
  }

  function handleSendFromPreview(packId: string) {
    setDeliveryAttachmentId(packId);
    setTimeout(() => jumpTo("send"), 50);
  }

  function handleHistoryPreview(packId: string) {
    setPreviewPackId(packId);
    setTimeout(() => jumpTo("preview-pack"), 50);
  }

  function handleHistoryResend(packId: string) {
    setDeliveryAttachmentId(packId);
    setTimeout(() => jumpTo("send"), 50);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[92vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            Prepare For Client — {candidateName}
            <span className="text-sm font-normal text-muted-foreground">· {jobTitle}</span>
          </DialogTitle>
        </DialogHeader>

        <PrepareForClientStepper steps={steps} active={activeStep} onJump={jumpTo} />

        <div className="flex-1 overflow-y-auto space-y-4 py-3 pr-1">
          <div ref={refs.context}>
            <Card>
              <CardContent className="p-5 space-y-3">
                <SectionHeader icon={<User className="h-4 w-4" />} title="Candidate Information" />
                {!candidate ? <Skeleton className="h-20" /> : (
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <Field label="Full Name" value={candidate.full_name} />
                    <Field label="Current Title" value={candidate.current_title} />
                    <Field label="Current Company" value={candidate.current_company} />
                    <Field label="Location" value={candidate.location} />
                    <Field label="Years of Experience" value={candidate.years_experience?.toString()} />
                    <Field label="Email" value={candidate.email} />
                  </div>
                )}
              </CardContent>
            </Card>
            <Card className="mt-4">
              <CardContent className="p-5 space-y-3">
                <SectionHeader icon={<Briefcase className="h-4 w-4" />} title="Job Information" />
                {!job ? <Skeleton className="h-20" /> : (
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <Field label="Job Title" value={job.title} />
                    <Field label="Seniority" value={job.seniority_level} />
                    <Field label="Location" value={job.location} />
                    <Field label="Employment Type" value={job.employment_type} />
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          <div ref={refs.notes} onFocusCapture={() => refreshStepState()}>
            <RecruiterAssessmentSection
              tenantId={tenantId} jobId={jobId} candidateId={candidateId}
            />
          </div>

          <div ref={refs.report}>
            <ClientReportSection
              tenantId={tenantId} jobId={jobId} candidateId={candidateId}
              candidateName={candidateName} jobTitle={jobTitle}
              onReportChanged={() => { setRefreshKey(k => k + 1); refreshStepState(); }}
            />
          </div>

          <div ref={refs.pack}>
            <SubmissionPackBuilder
              tenantId={tenantId} jobId={jobId} candidateId={candidateId}
              onBuilt={handleBuilt}
              refreshKey={refreshKey}
            />
          </div>

          <div ref={refs["preview-pack"]}>
            <SubmissionPackPreview
              tenantId={tenantId} jobId={jobId} candidateId={candidateId}
              pinnedPackId={previewPackId}
              refreshKey={refreshKey}
              onEditReport={() => jumpTo("report")}
              onRegenerateReport={() => jumpTo("report")}
              onSendToClient={handleSendFromPreview}
            />
          </div>

          <div ref={refs.send}>
            <ClientDeliveryWorkspace
              tenantId={tenantId} jobId={jobId} candidateId={candidateId}
              candidateName={candidateName} jobTitle={jobTitle}
              prefillAttachmentId={deliveryAttachmentId}
              refreshKey={refreshKey}
            />
          </div>

          <div ref={refs.history}>
            <SubmissionHistoryTable
              tenantId={tenantId} jobId={jobId} candidateId={candidateId}
              refreshKey={refreshKey}
              onPreview={handleHistoryPreview}
              onResend={handleHistoryResend}
            />
          </div>
        </div>

        <div className="border-t pt-3 flex justify-end gap-2">
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Close</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function SectionHeader({ icon, title }: { icon: React.ReactNode; title: string }) {
  return (
    <div className="flex items-center gap-2">
      <div className="h-7 w-7 rounded-md bg-primary/10 text-primary flex items-center justify-center">{icon}</div>
      <h4 className="font-semibold text-sm">{title}</h4>
    </div>
  );
}

function Field({ label, value }: { label: string; value?: string | null }) {
  return (
    <div>
      <div className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="font-medium">{value || <span className="text-muted-foreground">—</span>}</div>
    </div>
  );
}
