// =========================================================================
// backfill-structuring
// Backfills `structured_jd` for jobs and `structured_profile` for candidates
// so the role_first_v1 validator (function_family, role_similarity) has the
// data it needs. Tracks progress in `structuring_backfill_runs`.
//
// Auth: workspace owner/manager (or super_admin), scoped to caller's tenant.
// Body: { scope: "jobs"|"candidates"|"both", limit?: number, force?: boolean,
//         only_open?: boolean }
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
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY")!;

// ---------- Candidate structuring (no resume re-download required) ----------
// We synthesize a "parsed CV" from the fields already on the candidate row
// and ask the structured-profile model to produce the role_first_v1 payload.
async function structureCandidateFromRow(c: any): Promise<StructuredCandidateProfile | null> {
  const sourceJson = JSON.stringify({
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
  }, null, 2);

  const sourceText = `Legacy parsed CV (use as the primary source of truth):\n${sourceJson}`;

  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${OPENAI_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      temperature: 0.1,
      messages: [
        { role: "system", content: CANDIDATE_STRUCTURED_SYSTEM },
        { role: "user", content: sourceText },
      ],
      tools: [CANDIDATE_STRUCTURED_TOOL],
      tool_choice: { type: "function", function: { name: CANDIDATE_STRUCTURED_TOOL.function.name } },
    }),
  });
  if (!res.ok) {
    const body = await res.text();
    console.error("structureCandidateFromRow failed", res.status, body);
    if (res.status === 429) throw new Error("RATE_LIMIT");
    if (res.status === 402) throw new Error("CREDITS_EXHAUSTED");
    return null;
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

async function invokeStructureJd(jobId: string, force: boolean): Promise<{ ok: boolean; err?: string }> {
  try {
    const r = await fetch(`${SUPABASE_URL}/functions/v1/structure-jd`, {
      method: "POST",
      headers: { Authorization: `Bearer ${SERVICE_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ job_id: jobId, force }),
    });
    if (!r.ok) return { ok: false, err: `structure-jd_${r.status}` };
    return { ok: true };
  } catch (e: any) {
    return { ok: false, err: e?.message ?? "invoke_failed" };
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const userClient = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData } = await userClient.auth.getUser();
    const user = userData?.user;
    if (!user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const admin = createClient(SUPABASE_URL, SERVICE_KEY);
    const { data: profile } = await admin.from("profiles").select("tenant_id").eq("id", user.id).maybeSingle();
    const tenantId: string | null = profile?.tenant_id ?? null;
    if (!tenantId) {
      return new Response(JSON.stringify({ error: "No tenant" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    // Authorize: owner / manager / super_admin
    const { data: isOwnerMgr } = await admin.rpc("is_owner_or_manager_in_tenant", {
      _user_id: user.id, _tenant_id: tenantId,
    });
    const { data: isSuper } = await admin.rpc("is_super_admin", { _user_id: user.id });
    if (!isOwnerMgr && !isSuper) {
      return new Response(JSON.stringify({ error: "Forbidden — owner/manager only" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json().catch(() => ({}));
    const scope: "jobs" | "candidates" | "both" = body?.scope ?? "both";
    const limit: number = Math.max(1, Math.min(200, body?.limit ?? 50));
    const force: boolean = !!body?.force;
    const onlyOpen: boolean = body?.only_open !== false; // default true for jobs

    // Create run row
    const { data: run } = await admin.from("structuring_backfill_runs").insert({
      tenant_id: tenantId, triggered_by: user.id, scope, status: "running",
    }).select("id").single();

    let totalJ = 0, okJ = 0, failJ = 0;
    let totalC = 0, okC = 0, failC = 0;
    const errors: string[] = [];

    // ---- Jobs ----
    if (scope === "jobs" || scope === "both") {
      let q = admin.from("jobs").select("id, status, structured_jd_version").eq("tenant_id", tenantId);
      if (!force) q = q.or("structured_jd.is.null,structured_jd_version.neq." + STRUCTURED_SCHEMA_VERSION);
      if (onlyOpen) q = q.in("status", ["open", "draft"]);
      const { data: jobs } = await q.limit(limit);
      totalJ = jobs?.length ?? 0;
      // Serial loop to respect OpenAI rate limits.
      for (const j of jobs ?? []) {
        const r = await invokeStructureJd(j.id, force);
        if (r.ok) okJ++; else { failJ++; if (r.err) errors.push(`job ${j.id}: ${r.err}`); }
      }
    }

    // ---- Candidates ----
    if (scope === "candidates" || scope === "both") {
      let q = admin
        .from("candidates")
        .select("id, full_name, email, phone, location, current_title, current_company, linkedin_url, summary, experience_years, skills, education, work_history, structured_profile_version")
        .eq("tenant_id", tenantId);
      if (!force) q = q.or("structured_profile.is.null,structured_profile_version.neq." + STRUCTURED_SCHEMA_VERSION);
      const { data: cands } = await q.limit(limit);
      totalC = cands?.length ?? 0;
      for (const c of cands ?? []) {
        try {
          const structured = await structureCandidateFromRow(c);
          if (!structured) { failC++; continue; }
          const { error: updErr } = await admin.from("candidates").update({
            structured_profile: structured as any,
            structured_profile_version: STRUCTURED_SCHEMA_VERSION,
            structured_profile_at: new Date().toISOString(),
          }).eq("id", c.id);
          if (updErr) { failC++; errors.push(`cand ${c.id}: ${updErr.message}`); } else okC++;
        } catch (e: any) {
          failC++;
          if (e?.message === "RATE_LIMIT" || e?.message === "CREDITS_EXHAUSTED") {
            errors.push(`HALT: ${e.message}`);
            break;
          }
          errors.push(`cand ${c.id}: ${e?.message ?? "unknown"}`);
        }
      }
    }

    const total = totalJ + totalC;
    const succeeded = okJ + okC;
    const failed = failJ + failC;
    const status = failed === 0 ? "success" : (succeeded > 0 ? "partial" : "failed");

    await admin.from("structuring_backfill_runs").update({
      status,
      total, succeeded, failed,
      details: { jobs: { total: totalJ, ok: okJ, fail: failJ }, candidates: { total: totalC, ok: okC, fail: failC } },
      error: errors.length ? errors.slice(0, 20).join(" | ") : null,
      completed_at: new Date().toISOString(),
    }).eq("id", run!.id);

    return new Response(JSON.stringify({
      ok: true, run_id: run!.id,
      jobs: { total: totalJ, succeeded: okJ, failed: failJ },
      candidates: { total: totalC, succeeded: okC, failed: failC },
      status,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e: any) {
    console.error("backfill-structuring error", e);
    return new Response(JSON.stringify({ error: e?.message ?? "unknown" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
