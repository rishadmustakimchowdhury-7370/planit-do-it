import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Card, CardContent } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Sparkles, User, Briefcase, Package, Lock } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { RecruiterAssessmentSection } from "./RecruiterAssessmentSection";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  tenantId: string;
  jobId: string;
  candidateId: string;
  candidateName: string;
  jobTitle: string;
}

/**
 * Phase 1 placeholder for the new AI-powered "Prepare For Client" workflow.
 * This replaces the legacy multi-step Submission Wizard at the entry point,
 * but preserves routing, permissions, and audit history of existing submissions.
 */
export function PrepareForClientDialog({
  open, onOpenChange, jobId, candidateId, candidateName, jobTitle,
}: Props) {
  const [candidate, setCandidate] = useState<any | null>(null);
  const [job, setJob] = useState<any | null>(null);
  const [notes, setNotes] = useState("");

  useEffect(() => {
    if (!open) return;
    setCandidate(null);
    setJob(null);
    setNotes("");
    (async () => {
      const [{ data: c }, { data: j }] = await Promise.all([
        supabase.from("candidates")
          .select("id, full_name, current_title, current_company, email, phone, location, years_experience, skills")
          .eq("id", candidateId).maybeSingle(),
        supabase.from("jobs")
          .select("id, title, location, employment_type, seniority_level, description")
          .eq("id", jobId).maybeSingle(),
      ]);
      setCandidate(c);
      setJob(j);
    })();
  }, [open, candidateId, jobId]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            Prepare For Client — {candidateName}
            <span className="text-sm font-normal text-muted-foreground">· {jobTitle}</span>
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto space-y-4 py-2">
          {/* Candidate Information */}
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

          {/* Job Information */}
          <Card>
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

          {/* Recruiter Notes */}
          <Card>
            <CardContent className="p-5 space-y-3">
              <SectionHeader icon={<FileText className="h-4 w-4" />} title="Recruiter Notes" />
              <Label className="text-xs text-muted-foreground">
                Capture context the AI will use to craft the client-facing report.
              </Label>
              <Textarea
                rows={5}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Why is this candidate a strong fit? Key wins, motivations, salary expectations, availability…"
              />
            </CardContent>
          </Card>

          {/* AI Report (Coming Soon) */}
          <ComingSoonSection
            icon={<Sparkles className="h-4 w-4" />}
            title="AI Report"
            description="An AI-generated fit analysis tailored to this client — strengths, gaps, talking points, and recommended next steps."
          />

          {/* Generate Submission Pack (Coming Soon) */}
          <ComingSoonSection
            icon={<Package className="h-4 w-4" />}
            title="Generate Submission Pack"
            description="One-click branded submission pack with CV, AI report and recruiter notes — ready to share with the client."
          />
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

function ComingSoonSection({ icon, title, description }: { icon: React.ReactNode; title: string; description: string }) {
  return (
    <Card className="border-dashed bg-muted/30">
      <CardContent className="p-5 space-y-2">
        <div className="flex items-center gap-2">
          <div className="h-7 w-7 rounded-md bg-primary/10 text-primary flex items-center justify-center">{icon}</div>
          <h4 className="font-semibold text-sm">{title}</h4>
          <Badge variant="secondary" className="ml-2 gap-1">
            <Lock className="h-3 w-3" /> Coming Soon
          </Badge>
        </div>
        <p className="text-xs text-muted-foreground pl-9">{description}</p>
      </CardContent>
    </Card>
  );
}
