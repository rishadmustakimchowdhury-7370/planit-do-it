import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  JOB_STRUCTURED_TOOL,
  JOB_STRUCTURED_SYSTEM,
  STRUCTURED_SCHEMA_VERSION,
  type StructuredJobDescription,
} from "../_shared/structured-schema.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function buildJobSource(j: any): string {
  const parts: string[] = [];
  if (j.title) parts.push(`Title: ${j.title}`);
  if (j.experience_level) parts.push(`Experience Level: ${j.experience_level}`);
  if (j.employment_type) parts.push(`Employment Type: ${j.employment_type}`);
  if (j.location) parts.push(`Location: ${j.location}`);
  if (j.is_remote) parts.push(`Remote: yes`);
  if (j.salary_min || j.salary_max) parts.push(`Salary: ${j.salary_min ?? "?"} – ${j.salary_max ?? "?"}`);
  if (Array.isArray(j.skills) && j.skills.length) parts.push(`Listed Skills: ${j.skills.join(", ")}`);
  if (j.description) parts.push(`Description:\n${j.description}`);
  if (j.requirements) parts.push(`Requirements:\n${j.requirements}`);
  if (j.responsibilities) parts.push(`Responsibilities:\n${j.responsibilities}`);
  return parts.join("\n").slice(0, 16000);
}

async function callOpenAI(sourceText: string, apiKey: string): Promise<StructuredJobDescription> {
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "gpt-4o",
      temperature: 0.1,
      messages: [
        { role: "system", content: JOB_STRUCTURED_SYSTEM },
        { role: "user", content: `Structure the following job description:\n\n${sourceText}` },
      ],
      tools: [JOB_STRUCTURED_TOOL],
      tool_choice: { type: "function", function: { name: JOB_STRUCTURED_TOOL.function.name } },
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    console.error("OpenAI structure-jd error:", res.status, body);
    throw new Error(`openai_failed_${res.status}`);
  }

  const data = await res.json();
  const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
  if (!toolCall?.function?.arguments) {
    throw new Error("no_tool_call_returned");
  }
  const parsed = JSON.parse(toolCall.function.arguments);
  return {
    schema_version: STRUCTURED_SCHEMA_VERSION,
    title: parsed.title ?? null,
    normalized_title: parsed.normalized_title ?? null,
    seniority: parsed.seniority ?? null,
    employment_type: parsed.employment_type ?? null,
    industry: parsed.industry ?? null,
    industries_acceptable: parsed.industries_acceptable ?? [],
    domain_expertise: parsed.domain_expertise ?? [],
    mandatory_skills: parsed.mandatory_skills ?? [],
    preferred_skills: parsed.preferred_skills ?? [],
    certifications_required: parsed.certifications_required ?? [],
    certifications_preferred: parsed.certifications_preferred ?? [],
    education_requirements: parsed.education_requirements ?? [],
    languages_required: parsed.languages_required ?? [],
    location: parsed.location ?? {},
    years_experience_min: parsed.years_experience_min ?? null,
    years_experience_max: parsed.years_experience_max ?? null,
    career_progression_expected: parsed.career_progression_expected ?? {
      target_seniority: null,
      leadership_required: null,
      people_management_required: null,
    },
    responsibilities: parsed.responsibilities ?? [],
    nice_to_have: parsed.nice_to_have ?? [],
    deal_breakers: parsed.deal_breakers ?? [],
    summary: parsed.summary ?? null,
  };
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const internalToken = req.headers.get("x-internal-service-token");
    const internalSource = req.headers.get("x-internal-source");
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const allowedInternalSources = new Set([
      "backfill-structuring",
      "validate-candidate-fit",
      "validate-candidate-fit-v2",
    ]);
    if (!internalToken || internalToken !== serviceKey || !allowedInternalSources.has(internalSource ?? "")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { job_id, force } = await req.json();
    if (!job_id) {
      return new Response(JSON.stringify({ error: "job_id required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
    if (!OPENAI_API_KEY) throw new Error("OPENAI_API_KEY not configured");

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      serviceKey,
    );

    const { data: job, error } = await supabase
      .from("jobs")
      .select(
        "id, tenant_id, title, description, requirements, responsibilities, location, experience_level, employment_type, is_remote, skills, salary_min, salary_max, structured_jd_version",
      )
      .eq("id", job_id)
      .maybeSingle();

    if (error || !job) {
      return new Response(JSON.stringify({ error: "job_not_found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!force && job.structured_jd_version === STRUCTURED_SCHEMA_VERSION) {
      return new Response(JSON.stringify({ ok: true, cached: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const sourceText = buildJobSource(job);
    if (sourceText.length < 30) {
      return new Response(JSON.stringify({ ok: false, reason: "insufficient_jd_text" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const structured = await callOpenAI(sourceText, OPENAI_API_KEY);

    const { error: updErr } = await supabase
      .from("jobs")
      .update({
        structured_jd: structured as any,
        structured_jd_version: STRUCTURED_SCHEMA_VERSION,
        structured_jd_at: new Date().toISOString(),
      })
      .eq("id", job.id);

    if (updErr) throw updErr;

    return new Response(
      JSON.stringify({ ok: true, structured_jd: structured }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e: any) {
    console.error("structure-jd error:", e);
    const status = String(e?.message || "").includes("_429") ? 429 : 500;
    return new Response(JSON.stringify({ error: e?.message ?? "unknown" }), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
