import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function buildCandidateText(c: any): string {
  const parts: string[] = [];
  if (c.full_name) parts.push(`Name: ${c.full_name}`);
  if (c.current_title) parts.push(`Title: ${c.current_title}`);
  if (c.current_company) parts.push(`Company: ${c.current_company}`);
  if (c.location) parts.push(`Location: ${c.location}`);
  if (c.experience_years != null) parts.push(`Years of Experience: ${c.experience_years}`);
  if (c.summary) parts.push(`Summary: ${c.summary}`);
  const skills = Array.isArray(c.skills) ? c.skills : [];
  if (skills.length) parts.push(`Skills: ${skills.join(", ")}`);
  if (Array.isArray(c.work_history) && c.work_history.length) {
    const wh = c.work_history.slice(0, 5).map((w: any) =>
      `${w.title ?? ""} @ ${w.company ?? ""} (${w.start_date ?? ""}–${w.end_date ?? "present"})`
    ).join("; ");
    parts.push(`Work History: ${wh}`);
  }
  if (Array.isArray(c.education) && c.education.length) {
    const ed = c.education.slice(0, 3).map((e: any) =>
      `${e.degree ?? ""} ${e.field ?? ""} @ ${e.institution ?? ""}`
    ).join("; ");
    parts.push(`Education: ${ed}`);
  }
  if (c.cv_parsed_data) {
    try {
      const cv = typeof c.cv_parsed_data === "string" ? c.cv_parsed_data : JSON.stringify(c.cv_parsed_data);
      parts.push(`CV: ${cv.slice(0, 3000)}`);
    } catch (_) { /* noop */ }
  }
  return parts.join("\n").slice(0, 8000);
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { candidate_id } = await req.json();
    if (!candidate_id) {
      return new Response(JSON.stringify({ error: "candidate_id required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
    if (!OPENAI_API_KEY) throw new Error("OPENAI_API_KEY not configured");

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: candidate, error } = await supabase
      .from("candidates")
      .select("id, tenant_id, full_name, current_title, current_company, location, experience_years, summary, skills, work_history, education, cv_parsed_data")
      .eq("id", candidate_id)
      .maybeSingle();

    if (error || !candidate) {
      return new Response(JSON.stringify({ error: "Candidate not found" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const sourceText = buildCandidateText(candidate);
    if (!sourceText || sourceText.length < 10) {
      return new Response(JSON.stringify({ ok: false, reason: "insufficient_data" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const embedRes = await fetch("https://api.openai.com/v1/embeddings", {
      method: "POST",
      headers: { Authorization: `Bearer ${OPENAI_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model: "text-embedding-3-small", input: sourceText }),
    });

    if (!embedRes.ok) {
      const body = await embedRes.text();
      console.error("OpenAI embed error:", embedRes.status, body);
      return new Response(JSON.stringify({ error: "embedding_failed", status: embedRes.status }), {
        status: embedRes.status === 429 ? 429 : 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: embData } = await embedRes.json();
    const embedding = embData[0].embedding as number[];

    const { error: upsertErr } = await supabase.from("candidate_embeddings").upsert({
      candidate_id: candidate.id,
      tenant_id: candidate.tenant_id,
      embedding: embedding as any,
      source_text: sourceText,
      model_version: "text-embedding-3-small",
      updated_at: new Date().toISOString(),
    }, { onConflict: "candidate_id" });

    if (upsertErr) {
      console.error("Upsert error:", upsertErr);
      throw upsertErr;
    }

    return new Response(JSON.stringify({ ok: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    console.error("embed-candidate error:", e);
    return new Response(JSON.stringify({ error: e?.message ?? "unknown" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
