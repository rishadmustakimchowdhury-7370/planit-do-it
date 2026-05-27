import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Mic, Square, Loader2, Plus, X, Languages } from "lucide-react";
import { useVoiceRecorder } from "@/hooks/useVoiceRecorder";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface Props {
  onAddTranscript: (text: string) => void;
}

// Whisper supports 50+ languages; we expose the common ones plus auto-detect.
// Selecting a language only hints the model for better accuracy when keeping
// the original language. When "Translate to English" is on, Whisper auto-
// detects the spoken language and always outputs English.
const LANGUAGES: { code: string; label: string }[] = [
  { code: "", label: "Auto-detect" },
  { code: "bn", label: "Bangla (বাংলা)" },
  { code: "en", label: "English" },
  { code: "hi", label: "Hindi (हिन्दी)" },
  { code: "ur", label: "Urdu (اردو)" },
  { code: "ar", label: "Arabic (العربية)" },
  { code: "es", label: "Spanish" },
  { code: "fr", label: "French" },
  { code: "de", label: "German" },
  { code: "pt", label: "Portuguese" },
  { code: "zh", label: "Chinese" },
  { code: "ja", label: "Japanese" },
  { code: "ko", label: "Korean" },
  { code: "ru", label: "Russian" },
  { code: "tr", label: "Turkish" },
  { code: "it", label: "Italian" },
  { code: "nl", label: "Dutch" },
  { code: "pl", label: "Polish" },
  { code: "fa", label: "Persian" },
  { code: "ta", label: "Tamil" },
];

function formatMs(ms: number) {
  const s = Math.floor(ms / 1000);
  return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
}

export function VoiceNoteRecorder({ onAddTranscript }: Props) {
  const { state, error, elapsedMs, start, stop, cancel } = useVoiceRecorder();
  const [transcribing, setTranscribing] = useState(false);
  const [draft, setDraft] = useState("");
  const [language, setLanguage] = useState<string>(""); // auto-detect by default
  const [translate, setTranslate] = useState<boolean>(true); // default → English output

  const handleStop = async () => {
    const blob = await stop();
    if (!blob) return;
    setTranscribing(true);
    try {
      const file = new File([blob], "voice-note.webm", { type: blob.type || "audio/webm" });
      const form = new FormData();
      form.append("file", file);
      form.append("mode", translate ? "translate" : "transcribe");
      if (!translate && language) form.append("language", language);
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
    toast.success("Voice note added");
  };

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        <div>
          <label className="text-[11px] uppercase tracking-wide text-muted-foreground">Spoken language</label>
          <Select value={language || "auto"} onValueChange={(v) => setLanguage(v === "auto" ? "" : v)}>
            <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent className="max-h-72">
              {LANGUAGES.map((l) => (
                <SelectItem key={l.code || "auto"} value={l.code || "auto"} className="text-xs">{l.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <label className="text-[11px] uppercase tracking-wide text-muted-foreground">Output</label>
          <Select value={translate ? "en" : "orig"} onValueChange={(v) => setTranslate(v === "en")}>
            <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="en" className="text-xs">Translate to English</SelectItem>
              <SelectItem value="orig" className="text-xs">Keep original language</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

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
            <Loader2 className="h-3.5 w-3.5 animate-spin" /> {translate ? "Translating…" : "Transcribing…"}
          </span>
        )}
        <span className="ml-auto inline-flex items-center gap-1 text-[11px] text-muted-foreground">
          <Languages className="h-3 w-3" /> 50+ languages
        </span>
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
              <Plus className="h-3.5 w-3.5" /> Add to notes
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setDraft("")} className="gap-1">
              <X className="h-3.5 w-3.5" /> Discard
            </Button>
          </div>
        </div>
      )}

      <p className="text-[11px] text-muted-foreground leading-relaxed">
        Speak in Bangla, Hindi, Arabic, Spanish — or any of 50+ languages. Choose "Translate to English" to get a client-ready English transcript automatically. Audio is not stored.
      </p>
    </div>
  );
}
