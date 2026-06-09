import { useEffect, useMemo, useRef, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  ClipboardList, Mic, FileText, Loader2, Check, Trash2, Upload,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { VoiceNoteRecorder } from "@/components/matching/workspace/VoiceNoteRecorder";
import { toast } from "sonner";

export interface AssessmentStructured {
  motivation?: string;
  salary_expectation?: string;
  current_salary?: string;
  notice_period?: string;
  availability?: string;
  visa_status?: string;
  relocation?: string;
  communication_quality?: "" | "excellent" | "strong" | "average" | "needs_work";
  observations?: string;
}

export interface VoiceTranscript {
  id: string;
  text: string;
  created_at: string;
  source: "recording" | "upload";
}

interface Props {
  tenantId: string;
  jobId: string;
  candidateId: string;
}

const EMPTY: AssessmentStructured = {
  motivation: "",
  salary_expectation: "",
  current_salary: "",
  notice_period: "",
  availability: "",
  visa_status: "",
  relocation: "",
  communication_quality: "",
  observations: "",
};

export function RecruiterAssessmentSection({ tenantId, jobId, candidateId }: Props) {
  const [loading, setLoading] = useState(true);
  const [recordId, setRecordId] = useState<string | null>(null);
  const [recruiterId, setRecruiterId] = useState<string | null>(null);
  const [textNotes, setTextNotes] = useState("");
  const [structured, setStructured] = useState<AssessmentStructured>(EMPTY);
  const [transcripts, setTranscripts] = useState<VoiceTranscript[]>([]);
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved">("idle");
  const [uploading, setUploading] = useState(false);

  const initialised = useRef(false);
  const saveTimer = useRef<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Load existing assessment for (job, candidate, current recruiter)
  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      initialised.current = false;
      const { data: userData } = await supabase.auth.getUser();
      const uid = userData?.user?.id ?? null;
      if (cancelled) return;
      setRecruiterId(uid);
      if (!uid) { setLoading(false); return; }

      const { data, error } = await supabase
        .from("prepare_for_client_assessments")
        .select("id, text_notes, structured_notes, voice_transcripts")
        .eq("tenant_id", tenantId)
        .eq("job_id", jobId)
        .eq("candidate_id", candidateId)
        .eq("recruiter_id", uid)
        .maybeSingle();

      if (cancelled) return;
      if (error) console.error("[assessment] load", error);

      if (data) {
        setRecordId(data.id);
        setTextNotes(data.text_notes ?? "");
        setStructured({ ...EMPTY, ...(data.structured_notes as any) });
        setTranscripts(Array.isArray(data.voice_transcripts) ? (data.voice_transcripts as any) : []);
      } else {
        setRecordId(null);
        setTextNotes("");
        setStructured(EMPTY);
        setTranscripts([]);
      }
      setLoading(false);
      // Allow autosave on subsequent edits
      requestAnimationFrame(() => { initialised.current = true; });
    })();
    return () => { cancelled = true; };
  }, [tenantId, jobId, candidateId]);

  // Debounced auto-save
  useEffect(() => {
    if (!initialised.current || !recruiterId) return;
    if (saveTimer.current) window.clearTimeout(saveTimer.current);
    setSaveState("saving");
    saveTimer.current = window.setTimeout(() => { void persist(); }, 700);
    return () => { if (saveTimer.current) window.clearTimeout(saveTimer.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [textNotes, structured, transcripts]);

  const persist = async () => {
    if (!recruiterId) return;
    const payload = {
      tenant_id: tenantId,
      job_id: jobId,
      candidate_id: candidateId,
      recruiter_id: recruiterId,
      text_notes: textNotes,
      structured_notes: structured as any,
      voice_transcripts: transcripts as any,
    };
    const { data, error } = await supabase
      .from("prepare_for_client_assessments")
      .upsert(payload, { onConflict: "tenant_id,job_id,candidate_id,recruiter_id" })
      .select("id")
      .maybeSingle();
    if (error) {
      console.error("[assessment] save", error);
      toast.error("Failed to save notes");
      setSaveState("idle");
      return;
    }
    if (data?.id) setRecordId(data.id);
    setSaveState("saved");
    window.setTimeout(() => setSaveState((s) => (s === "saved" ? "idle" : s)), 1500);
  };

  const updateStructured = (k: keyof AssessmentStructured, v: string) =>
    setStructured((prev) => ({ ...prev, [k]: v }));

  const addTranscript = (text: string, source: VoiceTranscript["source"] = "recording") => {
    const t: VoiceTranscript = {
      id: crypto.randomUUID(),
      text,
      created_at: new Date().toISOString(),
      source,
    };
    setTranscripts((prev) => [...prev, t]);
  };

  const removeTranscript = (id: string) =>
    setTranscripts((prev) => prev.filter((t) => t.id !== id));

  const onUploadAudio = async (file: File) => {
    if (file.size > 20 * 1024 * 1024) {
      toast.error("Audio file too large (max 20 MB)");
      return;
    }
    setUploading(true);
    try {
      const form = new FormData();
      form.append("file", file);
      form.append("mode", "translate");
      const { data, error } = await supabase.functions.invoke("transcribe-voice-note", { body: form });
      if (error) throw error;
      const text = (data as any)?.text?.trim();
      if (!text) { toast.error("No speech detected"); return; }
      addTranscript(text, "upload");
      toast.success("Audio transcribed");
    } catch (e: any) {
      toast.error(e?.message ?? "Upload transcription failed");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const saveLabel = useMemo(() => {
    if (saveState === "saving") return (<><Loader2 className="h-3 w-3 animate-spin" /> Saving…</>);
    if (saveState === "saved") return (<><Check className="h-3 w-3" /> Saved</>);
    return <span className="text-muted-foreground">Auto-save enabled</span>;
  }, [saveState]);

  if (loading) {
    return (
      <Card><CardContent className="p-5 space-y-3">
        <Skeleton className="h-5 w-48" />
        <Skeleton className="h-32" />
      </CardContent></Card>
    );
  }

  return (
    <Card>
      <CardContent className="p-5 space-y-5">
        <div className="flex items-center gap-2">
          <div className="h-7 w-7 rounded-md bg-primary/10 text-primary flex items-center justify-center">
            <ClipboardList className="h-4 w-4" />
          </div>
          <h4 className="font-semibold text-sm">Recruiter Assessment</h4>
          <span className="ml-auto text-[11px] flex items-center gap-1">{saveLabel}</span>
        </div>

        {/* Structured screening fields */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <Field label="Candidate motivation">
            <Textarea rows={2} value={structured.motivation ?? ""}
              onChange={(e) => updateStructured("motivation", e.target.value)}
              placeholder="Why is the candidate exploring this role?" />
          </Field>
          <Field label="Recruiter observations">
            <Textarea rows={2} value={structured.observations ?? ""}
              onChange={(e) => updateStructured("observations", e.target.value)}
              placeholder="Standout strengths, concerns, cultural fit…" />
          </Field>
          <Field label="Current salary">
            <Input value={structured.current_salary ?? ""}
              onChange={(e) => updateStructured("current_salary", e.target.value)}
              placeholder="e.g. £55,000" />
          </Field>
          <Field label="Salary expectation">
            <Input value={structured.salary_expectation ?? ""}
              onChange={(e) => updateStructured("salary_expectation", e.target.value)}
              placeholder="e.g. £65,000–£70,000" />
          </Field>
          <Field label="Notice period">
            <Input value={structured.notice_period ?? ""}
              onChange={(e) => updateStructured("notice_period", e.target.value)}
              placeholder="e.g. 1 month" />
          </Field>
          <Field label="Availability">
            <Input value={structured.availability ?? ""}
              onChange={(e) => updateStructured("availability", e.target.value)}
              placeholder="e.g. Immediate / from 1 Aug" />
          </Field>
          <Field label="Visa status">
            <Input value={structured.visa_status ?? ""}
              onChange={(e) => updateStructured("visa_status", e.target.value)}
              placeholder="e.g. UK citizen, Skilled Worker visa" />
          </Field>
          <Field label="Relocation preference">
            <Input value={structured.relocation ?? ""}
              onChange={(e) => updateStructured("relocation", e.target.value)}
              placeholder="e.g. Open within UK, not international" />
          </Field>
          <Field label="Communication skills">
            <Select
              value={structured.communication_quality || "unset"}
              onValueChange={(v) => updateStructured("communication_quality", v === "unset" ? "" : v)}
            >
              <SelectTrigger><SelectValue placeholder="Select…" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="unset">—</SelectItem>
                <SelectItem value="excellent">Excellent</SelectItem>
                <SelectItem value="strong">Strong</SelectItem>
                <SelectItem value="average">Average</SelectItem>
                <SelectItem value="needs_work">Needs work</SelectItem>
              </SelectContent>
            </Select>
          </Field>
        </div>

        {/* Free-form text notes */}
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <FileText className="h-4 w-4 text-muted-foreground" />
            <Label className="text-xs uppercase tracking-wide text-muted-foreground">Text notes</Label>
          </div>
          <Textarea
            rows={5}
            value={textNotes}
            onChange={(e) => setTextNotes(e.target.value)}
            placeholder="Free-form notes from the screening call…"
          />
        </div>

        {/* Voice notes */}
        <div className="space-y-3 rounded-lg border bg-muted/30 p-4">
          <div className="flex items-center gap-2">
            <Mic className="h-4 w-4 text-muted-foreground" />
            <Label className="text-xs uppercase tracking-wide text-muted-foreground">Voice notes</Label>
            <Badge variant="secondary" className="ml-auto text-[10px]">Auto-transcribed</Badge>
          </div>

          <VoiceNoteRecorder onAddTranscript={(t) => addTranscript(t, "recording")} />

          <div className="pt-2 border-t flex items-center gap-2">
            <input
              ref={fileInputRef}
              type="file"
              accept="audio/*"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void onUploadAudio(f);
              }}
            />
            <Button
              size="sm"
              variant="outline"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className="gap-2"
            >
              {uploading
                ? <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Transcribing…</>
                : <><Upload className="h-3.5 w-3.5" /> Upload audio file</>}
            </Button>
            <span className="text-[11px] text-muted-foreground">MP3, WAV, M4A, WEBM — up to 20 MB</span>
          </div>

          {transcripts.length > 0 && (
            <div className="space-y-2">
              <div className="text-[11px] uppercase tracking-wide text-muted-foreground">
                Saved transcripts ({transcripts.length})
              </div>
              {transcripts.map((t) => (
                <div key={t.id} className="rounded-md border bg-background p-3">
                  <div className="flex items-start gap-2">
                    <p className="text-sm flex-1 whitespace-pre-wrap">{t.text}</p>
                    <Button size="icon" variant="ghost" className="h-7 w-7"
                      onClick={() => removeTranscript(t.id)} aria-label="Remove transcript">
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                  <div className="text-[10px] text-muted-foreground mt-1">
                    {t.source === "upload" ? "Uploaded audio" : "Recorded"} ·{" "}
                    {new Date(t.created_at).toLocaleString()}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</Label>
      {children}
    </div>
  );
}
