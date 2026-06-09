// =========================================================================
// auto-structure-entity
// Called by DB triggers (and optionally by the client for instant UX) to
// structure a single job or candidate. Idempotent and safe to call multiple
// times — re-uses structure-jd for jobs and runs in-process for candidates.
//
// Body: { entity_type: 'job' | 'candidate', entity_id: uuid, force?: boolean }
// =========================================================================

import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  CANDIDATE_STRUCTURED_SYSTEM,
  CANDIDATE_STRUCTURED_TOOL,
  STRUCTURED_SCHEMA_VERSION,
  type StructuredCandidateProfile,
} from "../_shared/structured-schema.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY")!;

const admin = createClient(SUPABASE_URL, SERVICE_KEY);

async function structureCandidateFromRow(
  c: any,
): Promise<StructuredCandidateProfile | null> {
  const sourceJson = JSON.stringify(
    {
      full_name: c.full_name,
      email: c.email,
      phone: c.phone,
      location: c.location,
      current_title: c.current_title,
      current_company: c.current_company,
      linkedin_url: c.linkedin_url,
      summary: c.summary,
      experience_years: c.experience_years,
      skills: c.skills ?? [],
      education: c.education ?? [],
      work_history: c.work_history ?? [],
      cv_parsed_data: c.cv_parsed_data ?? null,
      linkedin_data: c.linkedin_data ?? null,
    },
    null,
    2,
  );

  const sourceText =
    `Legacy parsed CV (use as the primary source of truth):\n${sourceJson}`;

  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${OPENAI_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      temperature: 0.1,
      messages: [
        { role: "system", content: CANDIDATE_STRUCTURED_SYSTEM },
        { role: "user", content: sourceText },
      ],
      tools: [CANDIDATE_STRUCTURED_TOOL],
      tool_choice: {
        type: "function",
        function: { name: CANDIDATE_STRUCTURED_TOOL.function.name },
      },
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`openai_${res.status}: ${body.slice(0, 200)}`);
  }
  const data = await res.json();
  const tc = data.choices?.[0]?.message?.tool_calls?.[0];
  if (!tc?.function?.arguments) return null;
  const parsed = JSON.parse(tc.function.arguments);
  return {
    schema_version: STRUCTURED_SCHEMA_VERSION,
    full_name: parsed.full_name ?? c.full_name ?? null,
    current_title: parsed.current_title ?? c.current_title ?? null,
    current_company: parsed.current_company ?? c.current_company ?? null,
    seniority: parsed.seniority ?? null,
    industries: parsed.industries ?? [],
    domain_expertise: parsed.domain_expertise ?? [],
    skills: parsed.skills ?? [],
    certifications: parsed.certifications ?? [],
    education: parsed.education ?? [],
    languages: parsed.languages ?? [],
    location: parsed.location ?? {},
    years_experience: parsed.years_experience ?? c.experience_years ?? null,
    career_progression: parsed.career_progression ?? {
      total_years_experience: c.experience_years ?? null,
      current_seniority: parsed.seniority ?? null,
      trajectory: null,
    },
    work_history: parsed.work_history ?? [],
    summary: parsed.summary ?? c.summary ?? null,
  };
}

async function processJob(jobId: string, force: boolean) {
  // Claim
  const startedAt = new Date().toISOString();
  await admin
    .from("jobs")
    .update({
      structuring_status: "processing",
      structuring_started_at: startedAt,
      structuring_last_error: null,
    })
    .eq("id", jobId);

  // Delegate to structure-jd (already handles minimal-title fallback)
  const r = await fetch(`${SUPABASE_URL}/functions/v1/structure-jd`, {
    method: "POST",
    headers: {
      "x-internal-service-token": SERVICE_KEY,
      "x-internal-source": "auto-structure-entity",
      "Content-Type": "application/json",

    },
    body: JSON.stringify({ job_id: jobId, force }),
  });
  const text = await r.text();

  if (!r.ok) {
    const { data: cur } = await admin
      .from("jobs")
      .select("structuring_retry_count")
      .eq("id", jobId)
      .maybeSingle();
    await admin
      .from("jobs")
      .update({
        structuring_status: "failed",
        structuring_last_error:
          `structure-jd_${r.status}: ${text.slice(0, 300)}`,
        structuring_retry_count: (cur?.structuring_retry_count ?? 0) + 1,
      })
      .eq("id", jobId);
    throw new Error(`structure-jd_${r.status}`);
  }


  await admin
    .from("jobs")
    .update({
      structuring_status: "completed",
      structuring_last_error: null,
    })
    .eq("id", jobId);
}

async function processCandidate(candidateId: string, force: boolean) {
  const { data: cand, error } = await admin
    .from("candidates")
    .select(
      "id, full_name, email, phone, location, current_title, current_company, linkedin_url, summary, experience_years, skills, education, work_history, cv_parsed_data, linkedin_data, structured_profile_version, structuring_retry_count",
    )
    .eq("id", candidateId)
    .maybeSingle();

  if (error || !cand) throw new Error("candidate_not_found");

  if (
    !force && cand.structured_profile_version === STRUCTURED_SCHEMA_VERSION
  ) {
    await admin
      .from("candidates")
      .update({ structuring_status: "completed", structuring_last_error: null })
      .eq("id", candidateId);
    return;
  }

  await admin
    .from("candidates")
    .update({
      structuring_status: "processing",
      structuring_started_at: new Date().toISOString(),
      structuring_last_error: null,
    })
    .eq("id", candidateId);

  try {
    const structured = await structureCandidateFromRow(cand);
    if (!structured) throw new Error("no_structured_returned");

    await admin
      .from("candidates")
      .update({
        structured_profile: structured as any,
        structured_profile_version: STRUCTURED_SCHEMA_VERSION,
        structured_profile_at: new Date().toISOString(),
        structuring_status: "completed",
        structuring_last_error: null,
      })
      .eq("id", candidateId);
  } catch (e: any) {
    await admin
      .from("candidates")
      .update({
        structuring_status: "failed",
        structuring_last_error: String(e?.message ?? "unknown").slice(0, 500),
        structuring_retry_count: (cand.structuring_retry_count ?? 0) + 1,
      })
      .eq("id", candidateId);
    throw e;
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const entity_type: string = body?.entity_type;
    const entity_id: string = body?.entity_id;
    const force: boolean = !!body?.force;

    if (
      !entity_id ||
      (entity_type !== "job" && entity_type !== "candidate")
    ) {
      return new Response(
        JSON.stringify({ error: "entity_type and entity_id required" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    if (entity_type === "job") {
      await processJob(entity_id, force);
    } else {
      await processCandidate(entity_id, force);
    }

    return new Response(JSON.stringify({ ok: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    console.error("auto-structure-entity error:", e);
    return new Response(
      JSON.stringify({ ok: false, error: e?.message ?? "unknown" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
});
