import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function buildJobText(j: any): string {
  const parts: string[] = [];
  if (j.title) parts.push(`Title: ${j.title}`);
  if (j.experience_level) parts.push(`Experience Level: ${j.experience_level}`);
  if (j.employment_type) parts.push(`Employment: ${j.employment_type}`);
  if (j.location) parts.push(`Location: ${j.location}`);
  if (j.is_remote) parts.push(`Remote: yes`);
  if (Array.isArray(j.skills) && j.skills.length) parts.push(`Required Skills: ${j.skills.join(", ")}`);
  if (j.description) parts.push(`Description:\n${j.description}`);
  if (j.requirements) parts.push(`Requirements:\n${j.requirements}`);
  return parts.join("\n").slice(0, 8000);
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { job_id } = await req.json();
    if (!job_id) {
      return new Response(JSON.stringify({ error: "job_id required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
    if (!OPENAI_API_KEY) throw new Error("OPENAI_API_KEY not configured");

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: job, error } = await supabase
      .from("jobs")
      .select("id, tenant_id, title, description, requirements, location, experience_level, employment_type, is_remote, skills")
      .eq("id", job_id)
      .maybeSingle();

    if (error || !job) {
      return new Response(JSON.stringify({ error: "Job not found" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const sourceText = buildJobText(job);
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

    const { error: upsertErr } = await supabase.from("job_embeddings").upsert({
      job_id: job.id,
      tenant_id: job.tenant_id,
      embedding: embedding as any,
      source_text: sourceText,
      model_version: "text-embedding-3-small",
      updated_at: new Date().toISOString(),
    }, { onConflict: "job_id" });

    if (upsertErr) throw upsertErr;

    return new Response(JSON.stringify({ ok: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    console.error("embed-job error:", e);
    return new Response(JSON.stringify({ error: e?.message ?? "unknown" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
