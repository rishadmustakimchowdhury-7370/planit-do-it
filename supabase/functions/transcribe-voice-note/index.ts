import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const ALLOWED_MIMES = new Set([
  "audio/webm", "audio/webm;codecs=opus",
  "audio/mp4", "audio/x-m4a", "audio/aac",
  "audio/mpeg", "audio/mp3",
  "audio/wav", "audio/x-wav", "audio/ogg",
]);
const MAX_BYTES = 20 * 1024 * 1024; // 20 MB

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: userData, error: userErr } = await supabase.auth.getUser();
    if (userErr || !userData?.user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
    if (!OPENAI_API_KEY) {
      return new Response(JSON.stringify({ error: "OPENAI_API_KEY not configured" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const form = await req.formData();
    const file = form.get("file");
    if (!(file instanceof File)) {
      return new Response(JSON.stringify({ error: "file is required (multipart/form-data)" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (file.size > MAX_BYTES) {
      return new Response(JSON.stringify({ error: "Audio file too large (max 20 MB)" }), {
        status: 413, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const mime = (file.type || "").toLowerCase().split(";")[0];
    if (mime && !ALLOWED_MIMES.has(mime) && !ALLOWED_MIMES.has(file.type.toLowerCase())) {
      return new Response(JSON.stringify({ error: `Unsupported mime type: ${file.type}` }), {
        status: 415, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Whisper supports 50+ languages with auto-detection.
    // mode=transcribe → keep original language (use `language` hint to improve accuracy, e.g. "bn" for Bangla)
    // mode=translate  → always returns English text (works from Bangla, Hindi, Spanish, Arabic, etc.)
    const mode = String(form.get("mode") || "transcribe").trim().toLowerCase();
    const language = String(form.get("language") || "").trim();

    const oaForm = new FormData();
    oaForm.append("file", file, file.name || "voice-note.webm");
    oaForm.append("model", "whisper-1");
    oaForm.append("response_format", "json");

    const endpoint = mode === "translate"
      ? "https://api.openai.com/v1/audio/translations"
      : "https://api.openai.com/v1/audio/transcriptions";
    // language hint only applies to transcriptions endpoint
    if (mode !== "translate" && language) oaForm.append("language", language);

    const oaRes = await fetch(endpoint, {
      method: "POST",
      headers: { Authorization: `Bearer ${OPENAI_API_KEY}` },
      body: oaForm,
    });

    if (!oaRes.ok) {
      const t = await oaRes.text();
      console.error("OpenAI transcription error", oaRes.status, t);
      return new Response(JSON.stringify({ error: "Transcription failed" }), {
        status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const json = await oaRes.json();
    return new Response(JSON.stringify({ text: String(json.text || "").trim() }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("transcribe-voice-note error", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
