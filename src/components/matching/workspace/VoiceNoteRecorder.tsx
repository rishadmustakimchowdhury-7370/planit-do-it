import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Mic, Square, Loader2, Plus, X } from "lucide-react";
import { useVoiceRecorder } from "@/hooks/useVoiceRecorder";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface Props {
  onAddTranscript: (text: string) => void;
}

function formatMs(ms: number) {
  const s = Math.floor(ms / 1000);
  return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
}

export function VoiceNoteRecorder({ onAddTranscript }: Props) {
  const { state, error, elapsedMs, start, stop, cancel } = useVoiceRecorder();
  const [transcribing, setTranscribing] = useState(false);
  const [draft, setDraft] = useState("");

  const handleStop = async () => {
    const blob = await stop();
    if (!blob) return;
    setTranscribing(true);
    try {
      const file = new File([blob], "voice-note.webm", { type: blob.type || "audio/webm" });
      const form = new FormData();
      form.append("file", file);
      const { data, error: fnErr } = await supabase.functions.invoke("transcribe-voice-note", { body: form });
      if (fnErr) throw fnErr;
      const text = (data as any)?.text?.trim();
      if (!text) {
        toast.error("No speech detected");
        return;
      }
      setDraft((prev) => (prev ? `${prev}\n${text}` : text));
    } catch (e: any) {
      toast.error(e?.message ?? "Transcription failed");
    } finally {
      setTranscribing(false);
    }
  };

  const commit = () => {
    const text = draft.trim();
    if (!text) return;
    onAddTranscript(text);
    setDraft("");
    toast.success("Voice note added to recruiter context");
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        {state === "idle" && !transcribing && (
          <Button size="sm" variant="outline" onClick={start} className="gap-2">
            <Mic className="h-4 w-4" /> Record
          </Button>
        )}
        {state === "recording" && (
          <>
            <Button size="sm" variant="destructive" onClick={handleStop} className="gap-2">
              <Square className="h-4 w-4" /> Stop
            </Button>
            <Button size="sm" variant="ghost" onClick={cancel}>Cancel</Button>
            <span className="text-xs text-muted-foreground flex items-center gap-1">
              <span className="h-2 w-2 rounded-full bg-rose-500 animate-pulse" />
              {formatMs(elapsedMs)}
            </span>
          </>
        )}
        {(state === "stopping" || transcribing) && (
          <span className="text-xs text-muted-foreground flex items-center gap-2">
            <Loader2 className="h-3.5 w-3.5 animate-spin" /> Transcribing…
          </span>
        )}
      </div>

      {error && <p className="text-xs text-rose-500">{error}</p>}

      {(draft || transcribing) && (
        <div className="space-y-2">
          <Textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Edit transcript before saving…"
            className="min-h-[90px] text-sm"
          />
          <div className="flex items-center gap-2">
            <Button size="sm" onClick={commit} disabled={!draft.trim()} className="gap-1">
              <Plus className="h-3.5 w-3.5" /> Add to context
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setDraft("")} className="gap-1">
              <X className="h-3.5 w-3.5" /> Discard
            </Button>
          </div>
        </div>
      )}

      <p className="text-[11px] text-muted-foreground leading-relaxed">
        Voice notes are transcribed locally to text and merged into recruiter context. Audio is not stored.
      </p>
    </div>
  );
}
