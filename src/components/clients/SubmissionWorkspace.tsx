import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Accordion, AccordionContent, AccordionItem, AccordionTrigger,
} from "@/components/ui/accordion";
import {
  ResizablePanelGroup, ResizablePanel, ResizableHandle,
} from "@/components/ui/resizable";
import {
  Loader2, RefreshCw, Download, ExternalLink, FileText, Sparkles, Send,
  CheckCircle2, AlertTriangle, Users, Settings2, MessageSquare, Activity, Upload,
} from "lucide-react";
import { toast } from "sonner";
import { getSubmissionPackUrl } from "@/hooks/useSubmissionPack";
import { SubmissionRecipientsManager } from "./SubmissionRecipientsManager";
import { SubmissionActivityTimeline } from "./SubmissionActivityTimeline";
import { StructuredRecruiterNotesForm } from "./StructuredRecruiterNotesForm";
import { OutcomeCaptureBar } from "./OutcomeCaptureBar";
import { emptyStructuredNotes, structuredNotesToLines, type StructuredRecruiterNotes } from "@/lib/recruiterNotes";
import { QuickActionsBar } from "@/components/recruiter/QuickActionsBar";
import { AIInsightChip } from "@/components/recruiter/AIInsightChip";
import { CalmModeToggle } from "@/components/recruiter/CalmModeToggle";
import { CommunicationDrawer } from "@/components/recruiter/CommunicationDrawer";
import { KeyboardShortcutsHelp } from "@/components/recruiter/KeyboardShortcutsHelp";
import { useKeyboardShortcuts, type Shortcut } from "@/hooks/useKeyboardShortcuts";
import { useRecruiterIntelligenceToggle } from "@/hooks/useRecruiterIntelligenceToggle";

interface Props {
  submissionId: string;
  tenantId: string;
  clientOrgId: string;
  candidateName: string;
  jobTitle: string;
  onSent?: () => void;
  onClose: () => void;
}

type PackStatus = "idle" | "generating" | "ready" | "failed";

interface SubmissionRow {
  id: string;
  job_id: string | null;
  candidate_id: string | null;
  ai_validation_id: string | null;
  pack_pdf_url: string | null;
  pack_status: PackStatus;
  pack_error: string | null;
  pack_components: { ai_report: boolean; branded_cv: boolean; original_cv: boolean };
  recruiter_summary: string | null;
  recruiter_recommendation: string | null;
  recruiter_strengths: string[] | null;
  recruiter_considerations: string[] | null;
  recruiter_notes: string[] | null;
  structured_notes: StructuredRecruiterNotes | null;
  submission_message: string | null;
  branded_cv_url: string | null;
  original_cv_url: string | null;
  status: string;
  sent_at: string | null;
}

export function SubmissionWorkspace({
  submissionId, tenantId, clientOrgId, candidateName, jobTitle, onSent, onClose,
}: Props) {
  const [row, setRow] = useState<SubmissionRow | null>(null);
  const [signedUrl, setSignedUrl] = useState<string | null>(null);
  const [recipientCount, setRecipientCount] = useState(0);
  const [regenerating, setRegenerating] = useState(false);
  const [sending, setSending] = useState(false);
  const [sentScreen, setSentScreen] = useState(false);
  const [commsOpen, setCommsOpen] = useState(false);
  const [copilot, setCopilot] = useState<any | null>(null);
  const { on: intelOn, toggle: toggleIntel } = useRecruiterIntelligenceToggle();

  // Editable controls (autosaved)
  const [components, setComponents] = useState({ ai_report: true, branded_cv: true, original_cv: true });
  const [recommendation, setRecommendation] = useState("");
  const [summary, setSummary] = useState("");
  const [strengthsText, setStrengthsText] = useState("");
  const [considerationsText, setConsiderationsText] = useState("");
  const [recruiterMessage, setRecruiterMessage] = useState("");
  const [structuredNotes, setStructuredNotes] = useState<StructuredRecruiterNotes>(emptyStructuredNotes());

  // Initial load + realtime
  useEffect(() => {
    let active = true;
    const load = async () => {
      const { data } = await supabase
        .from("candidate_submissions")
        .select("id, job_id, candidate_id, ai_validation_id, pack_pdf_url, pack_status, pack_error, pack_components, recruiter_summary, recruiter_recommendation, recruiter_strengths, recruiter_considerations, recruiter_notes, structured_notes, submission_message, branded_cv_url, original_cv_url, status, sent_at")
        .eq("id", submissionId)
        .maybeSingle();
      if (!active || !data) return;
      const r = data as any as SubmissionRow;
      setRow(r);
      setComponents(r.pack_components ?? { ai_report: true, branded_cv: true, original_cv: true });
      setRecommendation(r.recruiter_recommendation ?? "");
      setSummary(r.recruiter_summary ?? "");
      setStrengthsText((r.recruiter_strengths ?? []).join("\n"));
      setConsiderationsText((r.recruiter_considerations ?? []).join("\n"));
      setRecruiterMessage(r.submission_message ?? "");
      setStructuredNotes({ ...emptyStructuredNotes(), ...(r.structured_notes ?? {}) });
    };
    load();

    const channel = supabase
      .channel(`submission-ws-${submissionId}`)
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "candidate_submissions", filter: `id=eq.${submissionId}` },
        (payload) => {
          const r = payload.new as any as SubmissionRow;
          setRow(prev => ({ ...(prev ?? r), ...r }));
        })
      .subscribe();

    return () => { active = false; supabase.removeChannel(channel); };
  }, [submissionId]);

  // Recipient count for Send-enable
  useEffect(() => {
    const t = setInterval(async () => {
      const { count } = await supabase
        .from("submission_recipients" as any)
        .select("id", { count: "exact", head: true })
        .eq("submission_id", submissionId);
      setRecipientCount(count ?? 0);
    }, 1500);
    return () => clearInterval(t);
  }, [submissionId]);

  // Sign URL when pack_pdf_url changes
  useEffect(() => {
    if (!row?.pack_pdf_url) { setSignedUrl(null); return; }
    let cancelled = false;
    getSubmissionPackUrl(row.pack_pdf_url)
      .then((u) => { if (!cancelled) setSignedUrl(u); })
      .catch(() => { if (!cancelled) setSignedUrl(null); });
    return () => { cancelled = true; };
  }, [row?.pack_pdf_url]);

  // Auto-trigger first generation if idle
  useEffect(() => {
    if (row && row.pack_status === "idle" && !row.pack_pdf_url) {
      regenerate();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [row?.id]);

  // Debounced autosave of recruiter overrides
  useEffect(() => {
    if (!row) return;
    const t = setTimeout(async () => {
      const derivedNotes = structuredNotesToLines(structuredNotes);
      await supabase.from("candidate_submissions").update({
        recruiter_recommendation: recommendation || null,
        recruiter_summary: summary || null,
        recruiter_strengths: strengthsText.split("\n").map(s => s.trim()).filter(Boolean),
        recruiter_considerations: considerationsText.split("\n").map(s => s.trim()).filter(Boolean),
        recruiter_notes: derivedNotes,
        structured_notes: structuredNotes as any,
        submission_message: recruiterMessage || null,
        pack_components: components,
        draft_state: { recommendation, summary, strengthsText, considerationsText, structuredNotes, recruiterMessage, components, savedAt: new Date().toISOString() } as any,
      }).eq("id", submissionId);
    }, 800);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recommendation, summary, strengthsText, considerationsText, JSON.stringify(structuredNotes), recruiterMessage, JSON.stringify(components)]);

  const [readiness, setReadiness] = useState<{ candidate: boolean; job: boolean; ai_validation: boolean; cv: boolean; missing: string[] } | null>(null);
  const [buildStage, setBuildStage] = useState<string>("Preparing…");

  // Cycle through build stage messages while generating
  useEffect(() => {
    if (!regenerating && row?.pack_status !== "generating") return;
    const stages = [
      "Generating AI Executive Report…",
      "Building branded CV…",
      "Combining PDFs…",
      "Rendering preview…",
    ];
    let i = 0;
    setBuildStage(stages[0]);
    const t = setInterval(() => {
      i = (i + 1) % stages.length;
      setBuildStage(stages[i]);
    }, 1400);
    return () => clearInterval(t);
  }, [regenerating, row?.pack_status]);

  const regenerate = async () => {
    setRegenerating(true);
    try {
      const { data, error } = await supabase.functions.invoke("generate-submission-pack", {
        body: { submission_id: submissionId, components },
      });
      if (error) throw error;
      const result = data as any;
      if (result?.readiness) setReadiness(result.readiness);
      if (result?.status === "failed") {
        toast.error(result.user_message || "Package generation temporarily failed. Please retry.");
        return;
      }
      // Use response directly so preview shows immediately (don't wait on realtime)
      if (result?.status === "ready" && result?.path) {
        setRow(prev => prev ? { ...prev, pack_pdf_url: result.path, pack_status: "ready", pack_error: null } : prev);
        if (result?.signed_url) setSignedUrl(result.signed_url);
      }
      toast.success("Submission pack ready");
    } catch (e: any) {
      toast.error("Package generation temporarily failed. Please retry.");
    } finally {
      setRegenerating(false);
    }
  };

  // Upload a CV file (branded or original) into the documents bucket, save URL, then rebuild
  const uploadCV = async (kind: "branded_cv_url" | "original_cv_url", file: File) => {
    try {
      const ext = file.name.split(".").pop() || "pdf";
      const path = `${tenantId}/${submissionId}/${kind}-${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage.from("documents").upload(path, file, {
        contentType: file.type || "application/pdf", upsert: true,
      });
      if (upErr) throw upErr;
      const { data: pub } = supabase.storage.from("documents").getPublicUrl(path);
      const url = pub?.publicUrl || path;
      const { error: updErr } = await supabase.from("candidate_submissions")
        .update({ [kind]: url }).eq("id", submissionId);
      if (updErr) throw updErr;
      setRow(prev => prev ? { ...prev, [kind]: url } as any : prev);
      toast.success(kind === "branded_cv_url" ? "Branded CV uploaded" : "Original CV uploaded");
      regenerate();
    } catch (e: any) {
      toast.error(e?.message || "Upload failed");
    }
  };

  const sendSubmission = async () => {
    if (recipientCount === 0) {
      toast.error("Add at least one client recipient first.");
      return;
    }
    if (!(row?.pack_status === "ready" && signedUrl)) {
      toast.error("Please wait for the pack to finish building.");
      return;
    }
    setSending(true);
    try {
      const nowIso = new Date().toISOString();
      const { error } = await supabase.from("candidate_submissions").update({
        status: "submitted",
        sent_at: nowIso,
        submitted_at: nowIso,
        last_activity_at: nowIso,
      }).eq("id", submissionId);
      if (error) throw error;

      try {
        const { data, error: fnErr } = await supabase.functions.invoke("send-submission-email", {
          body: { submission_id: submissionId },
        });
        if (fnErr) throw fnErr;
        const res = data as any;
        if (res?.sent > 0) toast.success(`Submission delivered to ${res.sent} recipient${res.sent === 1 ? "" : "s"}`);
        if (res?.failed?.length) toast.warning(`Couldn't email: ${res.failed.join(", ")}`);
      } catch (e) {
        toast.warning("Submission saved, but email notification failed. You can resend from the timeline.");
      }

      setSentScreen(true);
      onSent?.();
    } catch (e: any) {
      toast.error("We couldn't send right now. Please retry.");
    } finally {
      setSending(false);
    }
  };

  const statusBadge = useMemo(() => {
    if (!row) return null;
    if (row.pack_status === "generating" || regenerating) {
      return <Badge variant="secondary" className="gap-1"><Loader2 className="h-3 w-3 animate-spin" /> Building pack…</Badge>;
    }
    if (row.pack_status === "failed") {
      return <Badge variant="destructive" className="gap-1"><AlertTriangle className="h-3 w-3" /> Generation failed</Badge>;
    }
    if (row.pack_status === "ready") {
      return <Badge className="gap-1 bg-emerald-500/15 text-emerald-700 border-transparent"><CheckCircle2 className="h-3 w-3" /> Pack ready</Badge>;
    }
    return <Badge variant="outline">Idle</Badge>;
  }, [row, regenerating]);

  // Load copilot intelligence (lazy — only when validation id is present).
  useEffect(() => {
    let active = true;
    if (!row?.ai_validation_id) { setCopilot(null); return; }
    supabase
      .from("ai_candidate_validations")
      .select("recruiter_copilot")
      .eq("id", row.ai_validation_id)
      .maybeSingle()
      .then(({ data }) => {
        if (!active) return;
        setCopilot((data as any)?.recruiter_copilot ?? null);
      });
    return () => { active = false; };
  }, [row?.ai_validation_id]);

  const placementScore: number | null = useMemo(() => {
    const p = copilot?.placement_probability;
    if (!p) return null;
    const v = p.placement_pct ?? p.shortlist_pct ?? null;
    return typeof v === "number" ? v : null;
  }, [copilot]);

  const insightSignals: string[] = useMemo(() => {
    const angles = (copilot?.positioning_angles ?? []) as Array<{ angle: string }>;
    return angles.slice(0, 4).map(a => a.angle).filter(Boolean);
  }, [copilot]);

  // Keyboard shortcuts — registered once per workspace.
  const shortcuts: Shortcut[] = useMemo(() => [
    { key: "r", group: "Submission", description: "Rebuild pack", handler: () => { if (!isBuilding) regenerate(); } },
    { key: "u", group: "Submission", description: "Send submission", handler: () => { if (!sending && isReady && recipientCount > 0) sendSubmission(); } },
    { key: "m", group: "Communication", description: "Open communication drawer", handler: () => setCommsOpen(true) },
    { key: "i", group: "View", description: "Toggle recruiter intelligence", handler: () => toggleIntel() },
    { key: "Escape", group: "View", description: "Close workspace", handler: onClose },
  // eslint-disable-next-line react-hooks/exhaustive-deps
  ], [isBuilding, isReady, sending, recipientCount]);

  useKeyboardShortcuts(shortcuts);

  if (sentScreen) {
    return (
      <div className="flex flex-col items-center text-center py-10 px-6 gap-4">
        <div className="h-16 w-16 rounded-full bg-emerald-500/15 flex items-center justify-center">
          <CheckCircle2 className="h-9 w-9 text-emerald-600" />
        </div>
        <div>
          <h3 className="text-xl font-semibold">Submission delivered</h3>
          <p className="text-sm text-muted-foreground mt-1">
            {candidateName} has been shared with {recipientCount} client {recipientCount === 1 ? "contact" : "contacts"} for {jobTitle}.
          </p>
        </div>
        <div className="text-xs text-muted-foreground border rounded-lg p-3 bg-muted/30 w-full max-w-md text-left">
          <div className="flex justify-between"><span>Submission ID</span><span className="font-mono">{submissionId.slice(0, 8)}…</span></div>
          <div className="flex justify-between"><span>Sent</span><span>{new Date().toLocaleString()}</span></div>
          <div className="flex justify-between"><span>Pack version</span><span>Latest</span></div>
        </div>
        <div className="flex gap-2 pt-2">
          {signedUrl && (
            <Button variant="outline" asChild>
              <a href={signedUrl} target="_blank" rel="noreferrer"><ExternalLink className="h-4 w-4 mr-2" /> Open Pack</a>
            </Button>
          )}
          <Button onClick={onClose}>Done</Button>
        </div>
      </div>
    );
  }

  if (!row) {
    return <div className="p-6 space-y-3"><Skeleton className="h-8 w-64" /><Skeleton className="h-[400px] w-full" /></div>;
  }

  const isReady = row.pack_status === "ready" && signedUrl;
  const isBuilding = row.pack_status === "generating" || regenerating;
  const isFailed = row.pack_status === "failed";

  return (
    <div className="flex flex-col h-[78vh]">
      <ResizablePanelGroup direction="horizontal" className="flex-1 min-h-0">
        {/* ===== LEFT: PDF preview ===== */}
        <ResizablePanel defaultSize={62} minSize={40}>
          <div className="h-full flex flex-col">
            <div className="flex items-center justify-between px-3 py-2 border-b">
              <div className="flex items-center gap-2 text-sm">
                <FileText className="h-4 w-4 text-primary" />
                <span className="font-medium">Combined Submission Pack</span>
                {statusBadge}
              </div>
              <div className="flex items-center gap-1">
                <Button size="sm" variant="ghost" disabled={isBuilding} onClick={regenerate}>
                  <RefreshCw className={`h-3.5 w-3.5 mr-1 ${isBuilding ? "animate-spin" : ""}`} /> Rebuild
                </Button>
                {signedUrl && (
                  <>
                    <Button size="sm" variant="ghost" asChild>
                      <a href={signedUrl} download><Download className="h-3.5 w-3.5 mr-1" /> Download</a>
                    </Button>
                    <Button size="sm" variant="ghost" asChild>
                      <a href={signedUrl} target="_blank" rel="noreferrer"><ExternalLink className="h-3.5 w-3.5" /></a>
                    </Button>
                  </>
                )}
              </div>
            </div>
            <div className="flex-1 bg-muted/20 relative">
              {isBuilding && (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 z-10 bg-background/70 backdrop-blur-sm">
                  <Loader2 className="h-8 w-8 text-primary animate-spin" />
                  <div className="text-sm font-medium">{buildStage}</div>
                  <div className="text-xs text-muted-foreground">AI report · branded CV · original CV</div>
                </div>
              )}
              {isFailed && !isBuilding && (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 p-6 text-center">
                  <AlertTriangle className="h-8 w-8 text-destructive" />
                  <div className="text-sm font-medium">Submission can't be built yet</div>
                  {readiness ? (
                    <div className="text-left text-xs bg-muted/40 border rounded-lg p-3 w-full max-w-sm space-y-1.5">
                      <div className="font-medium text-foreground mb-1">Readiness check</div>
                      {[
                        ["Candidate record", readiness.candidate],
                        ["Job record", readiness.job],
                        ["AI assessment", readiness.ai_validation],
                        ["At least one CV", readiness.cv],
                      ].map(([label, ok]) => (
                        <div key={label as string} className="flex items-center gap-2">
                          {ok ? <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" /> : <AlertTriangle className="h-3.5 w-3.5 text-destructive" />}
                          <span className={ok ? "text-muted-foreground" : "text-destructive"}>{label}</span>
                        </div>
                      ))}
                      {readiness.missing?.length > 0 && (
                        <div className="pt-1 text-[11px] text-muted-foreground">
                          Fix: {readiness.missing.join(", ")}.
                        </div>
                      )}
                    </div>
                  ) : (
                    <p className="text-xs text-muted-foreground max-w-sm">
                      {row.pack_error || "Some required data is missing. Open the candidate or job record to complete it, then retry."}
                    </p>
                  )}
                  <Button size="sm" onClick={regenerate}><RefreshCw className="h-3.5 w-3.5 mr-1" /> Retry</Button>
                </div>
              )}
              {isReady && signedUrl && (
                <iframe
                  key={signedUrl}
                  src={signedUrl}
                  title="Submission pack preview"
                  className="w-full h-full bg-white"
                />
              )}
              {!isBuilding && !isFailed && !isReady && (
                <div className="flex items-center justify-center h-full text-sm text-muted-foreground">
                  Pack hasn't been built yet.
                </div>
              )}
            </div>
          </div>
        </ResizablePanel>

        <ResizableHandle withHandle />

        {/* ===== RIGHT: Controls ===== */}
        <ResizablePanel defaultSize={38} minSize={28}>
          <div className="h-full overflow-y-auto px-4 py-3 space-y-3">
            <Accordion type="multiple" defaultValue={["compose", "recipients"]} className="space-y-2">
              <AccordionItem value="compose" className="border rounded-lg px-3">
                <AccordionTrigger className="text-sm hover:no-underline">
                  <span className="flex items-center gap-2"><Settings2 className="h-4 w-4" /> Pack composition</span>
                </AccordionTrigger>
                <AccordionContent className="space-y-3 pt-1">
                  {([
                    { key: "ai_report", label: "AI Executive Report", desc: "Branded AI-powered candidate report", uploadKey: null },
                    { key: "branded_cv", label: "Branded CV", desc: row.branded_cv_url ? "Available" : "Not uploaded yet", uploadKey: "branded_cv_url" as const },
                    { key: "original_cv", label: "Original CV", desc: row.original_cv_url ? "Available" : "Not uploaded yet", uploadKey: "original_cv_url" as const },
                  ]).map((c) => {
                    const hasFile = c.uploadKey ? !!(row as any)[c.uploadKey] : true;
                    return (
                      <div key={c.key} className="flex items-center justify-between gap-2">
                        <div className="min-w-0 pr-3 flex-1">
                          <div className="text-sm font-medium">{c.label}</div>
                          <div className="text-[11px] text-muted-foreground">{c.desc}</div>
                        </div>
                        {c.uploadKey && !hasFile && (
                          <label className="text-[11px] inline-flex items-center gap-1 px-2 py-1 rounded border cursor-pointer hover:bg-muted">
                            <Upload className="h-3 w-3" /> Upload CV
                            <input type="file" accept="application/pdf" className="hidden"
                              onChange={(e) => {
                                const f = e.target.files?.[0];
                                if (f) uploadCV(c.uploadKey!, f);
                                e.currentTarget.value = "";
                              }} />
                          </label>
                        )}
                        <Switch
                          checked={(components as any)[c.key]}
                          disabled={c.uploadKey ? !hasFile : false}
                          onCheckedChange={(v) => setComponents(prev => ({ ...prev, [c.key]: v }))}
                        />
                      </div>
                    );
                  })}
                  <Button size="sm" className="w-full" variant="outline" onClick={regenerate} disabled={isBuilding}>
                    <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${isBuilding ? "animate-spin" : ""}`} /> Rebuild Pack
                  </Button>
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="notes" className="border rounded-lg px-3">
                <AccordionTrigger className="text-sm hover:no-underline">
                  <span className="flex items-center gap-2"><MessageSquare className="h-4 w-4" /> Recruiter screening notes</span>
                </AccordionTrigger>
                <AccordionContent className="pt-1">
                  <StructuredRecruiterNotesForm value={structuredNotes} onChange={setStructuredNotes} />
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="content" className="border rounded-lg px-3">
                <AccordionTrigger className="text-sm hover:no-underline">
                  <span className="flex items-center gap-2"><Sparkles className="h-4 w-4" /> Edit AI content</span>
                </AccordionTrigger>
                <AccordionContent className="space-y-3 pt-1">
                  <div className="space-y-1.5">
                    <Label className="text-xs">Recommendation summary</Label>
                    <Textarea rows={3} placeholder="One-line headline recommendation…"
                      value={recommendation} onChange={(e) => setRecommendation(e.target.value)} />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Executive summary</Label>
                    <Textarea rows={3} placeholder="Why this candidate is a fit…"
                      value={summary} onChange={(e) => setSummary(e.target.value)} />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Strengths (one per line)</Label>
                    <Textarea rows={4} placeholder={"Leadership — led 30-person team\nDomain expertise — 8y SaaS"}
                      value={strengthsText} onChange={(e) => setStrengthsText(e.target.value)} />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Considerations (one per line)</Label>
                    <Textarea rows={3} placeholder={"Notice period — 3 months\nLocation — open to relocation"}
                      value={considerationsText} onChange={(e) => setConsiderationsText(e.target.value)} />
                  </div>
                  <p className="text-[11px] text-muted-foreground">
                    Changes autosave. Click <strong>Rebuild Pack</strong> to regenerate the PDF.
                  </p>
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="message" className="border rounded-lg px-3">
                <AccordionTrigger className="text-sm hover:no-underline">
                  <span className="flex items-center gap-2"><MessageSquare className="h-4 w-4" /> Recruiter message</span>
                </AccordionTrigger>
                <AccordionContent className="pt-1">
                  <Textarea rows={5} placeholder="Personal note included with the submission email…"
                    value={recruiterMessage} onChange={(e) => setRecruiterMessage(e.target.value)} />
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="recipients" className="border rounded-lg px-3">
                <AccordionTrigger className="text-sm hover:no-underline">
                  <span className="flex items-center gap-2">
                    <Users className="h-4 w-4" /> Client recipients
                    {recipientCount > 0 && <Badge variant="secondary" className="ml-1">{recipientCount}</Badge>}
                  </span>
                </AccordionTrigger>
                <AccordionContent className="pt-1">
                  <SubmissionRecipientsManager
                    submissionId={submissionId}
                    tenantId={tenantId}
                    clientOrgId={clientOrgId}
                  />
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="activity" className="border rounded-lg px-3">
                <AccordionTrigger className="text-sm hover:no-underline">
                  <span className="flex items-center gap-2"><Activity className="h-4 w-4" /> Live activity</span>
                </AccordionTrigger>
                <AccordionContent className="pt-1">
                  <SubmissionActivityTimeline submissionId={submissionId} />
                </AccordionContent>
              </AccordionItem>

              {row?.job_id && row?.candidate_id && (
                <div className="border rounded-lg px-3 py-3">
                  <div className="text-sm font-medium mb-2 flex items-center gap-2">
                    <Sparkles className="h-4 w-4" /> Outcome capture
                  </div>
                  <OutcomeCaptureBar
                    jobId={row.job_id}
                    candidateId={row.candidate_id}
                    clientOrgId={clientOrgId}
                    aiValidationId={row.ai_validation_id ?? null}
                    submissionId={submissionId}
                    compact
                  />
                </div>
              )}
            </Accordion>
          </div>
        </ResizablePanel>
      </ResizablePanelGroup>

      {/* ===== Footer: Send action ===== */}
      <div className="border-t px-4 py-3 flex items-center justify-between gap-3 bg-muted/20">
        <div className="text-xs text-muted-foreground">
          {recipientCount === 0
            ? "Add at least one recipient to send"
            : `Ready to deliver to ${recipientCount} recipient${recipientCount === 1 ? "" : "s"}`}
        </div>
        <div className="flex gap-2">
          <Button variant="ghost" onClick={onClose}>Save & Close</Button>
          <Button
            disabled={sending || isBuilding || !isReady || recipientCount === 0}
            onClick={sendSubmission}
          >
            {sending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Send className="h-4 w-4 mr-2" />}
            Send Submission
          </Button>
        </div>
      </div>
    </div>
  );
}
