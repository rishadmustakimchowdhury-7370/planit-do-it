import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY")!;

function getEnv(name: string) {
  const value = Deno.env.get(name);
  if (!value) throw new Error(`${name} not configured`);
  return value;
}

function formatSkills(skills: unknown): string {
  return Array.isArray(skills) ? skills.filter(Boolean).join(", ") : "";
}

async function embedJobIfMissing(supabase: any, jobId: string) {
  const { data: existing } = await supabase
    .from("job_embeddings").select("job_id").eq("job_id", jobId).maybeSingle();
  if (existing) return true;

  const resp = await fetch(`${SUPABASE_URL}/functions/v1/embed-job`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${SERVICE_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ job_id: jobId }),
  });
  return resp.ok;
}

async function embedMissingCandidates(supabase: any, tenantId: string, limit = 30) {
  const { data: candidates, error: candidatesError } = await supabase
    .from("candidates")
    .select("id")
    .eq("tenant_id", tenantId)
    .order("updated_at", { ascending: false })
    .limit(limit * 2);

  if (candidatesError) throw candidatesError;
  if (!candidates?.length) return 0;

  const candidateIds = candidates.map((row: any) => row.id);
  const { data: existing, error: existingError } = await supabase
    .from("candidate_embeddings")
    .select("candidate_id")
    .in("candidate_id", candidateIds);

  if (existingError) throw existingError;

  const embeddedIds = new Set((existing ?? []).map((row: any) => row.candidate_id));
  const missing = candidates.filter((row: any) => !embeddedIds.has(row.id)).slice(0, limit);

  if (!missing?.length) return 0;
  let embedded = 0;
  for (const row of missing) {
    try {
      const resp = await fetch(`${SUPABASE_URL}/functions/v1/embed-candidate`, {
        method: "POST",
        headers: { Authorization: `Bearer ${SERVICE_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({ candidate_id: row.id }),
      });
      if (resp.ok) embedded++;
    } catch (_) { /* continue */ }
  }
  return embedded;
}

async function aiScoreBatch(job: any, candidates: any[]): Promise<Record<string, any>> {
  const payload = candidates.map((c: any) => ({
    id: c.id,
    name: c.full_name,
    title: c.current_title,
    location: c.location,
    experience_years: c.experience_years,
    skills: Array.isArray(c.skills) ? c.skills.slice(0, 20) : [],
    summary: (c.summary ?? "").slice(0, 500),
  }));

  const systemPrompt = `You are an expert recruitment AI. For each candidate, score the fit (0-100) against the job, list 2-3 strengths, 1-2 gaps, a 2-sentence summary, and a confidence level (low/medium/high). Return ONLY through the tool.`;

  const userPrompt = `JOB:
Title: ${job.title}
Location: ${job.location ?? ""}
Experience Level: ${job.experience_level ?? ""}
Required Skills: ${formatSkills(job.skills)}
Description: ${(job.description ?? "").slice(0, 2000)}

CANDIDATES (JSON):
${JSON.stringify(payload)}`;

  const tool = {
    type: "function",
    function: {
      name: "score_candidates",
      description: "Score each candidate against the job",
      parameters: {
        type: "object",
        properties: {
          results: {
            type: "array",
            items: {
              type: "object",
              properties: {
                candidate_id: { type: "string" },
                score: { type: "integer", minimum: 0, maximum: 100 },
                summary: { type: "string" },
                strengths: { type: "array", items: { type: "string" } },
                gaps: { type: "array", items: { type: "string" } },
                confidence: { type: "string", enum: ["low", "medium", "high"] },
              },
              required: ["candidate_id", "score", "summary", "strengths", "gaps", "confidence"],
            },
          },
        },
        required: ["results"],
      },
    },
  };

  const resp = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${OPENAI_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      temperature: 0.2,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      tools: [tool],
      tool_choice: { type: "function", function: { name: "score_candidates" } },
    }),
  });

  if (!resp.ok) {
    const txt = await resp.text();
    console.error("OpenAI scoring error:", resp.status, txt);
    if (resp.status === 429) throw new Error("RATE_LIMIT");
    if (resp.status === 402) throw new Error("CREDITS_EXHAUSTED");
    throw new Error(`OpenAI scoring failed: ${resp.status}`);
  }

  const data = await resp.json();
  const call = data.choices?.[0]?.message?.tool_calls?.[0];
  if (!call) return {};
  try {
    const args = JSON.parse(call.function.arguments);
    const map: Record<string, any> = {};
    for (const r of (args.results ?? [])) map[r.candidate_id] = r;
    return map;
  } catch (e) {
    console.error("Failed to parse tool args:", e);
    return {};
  }
}

function buildInsights(c: any, recentEmails: any[]): string[] {
  const insights: string[] = [];
  const updatedAt = c.updated_at ? new Date(c.updated_at) : null;
  if (updatedAt && Date.now() - updatedAt.getTime() < 30 * 86400 * 1000) {
    insights.push("Recently active");
  }
  const submitted = recentEmails.some((e: any) => e.candidate_id === c.id);
  if (submitted) insights.push("Previously contacted");
  return insights;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userClient = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData } = await userClient.auth.getUser();
    const user = userData?.user;
    if (!user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { job_id, force } = await req.json();
    if (!job_id) {
      return new Response(JSON.stringify({ error: "job_id required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(SUPABASE_URL, getEnv("SUPABASE_SERVICE_ROLE_KEY"));
    const rpcClient = createClient(SUPABASE_URL, getEnv("SUPABASE_ANON_KEY"), {
      global: { headers: { Authorization: authHeader } },
    });

    // Verify job belongs to user's tenant
    const { data: profile } = await supabase
      .from("profiles").select("tenant_id").eq("id", user.id).maybeSingle();
    const callerTenant = profile?.tenant_id;
    const { data: job } = await supabase
      .from("jobs")
      .select("id, tenant_id, title, description, requirements, location, experience_level, skills")
      .eq("id", job_id)
      .maybeSingle();

    if (!job) {
      return new Response(JSON.stringify({ error: "Job not found" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (job.tenant_id !== callerTenant) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Cache check: if a successful run < 24h ago and not forced, return cached
    if (!force) {
      const since = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
      const { data: recentRun } = await supabase
        .from("rediscovery_runs")
        .select("id")
        .eq("job_id", job_id)
        .eq("status", "success")
        .gte("completed_at", since)
        .limit(1)
        .maybeSingle();
      if (recentRun) {
        return new Response(JSON.stringify({ ok: true, cached: true }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    // Create run record
    const { data: run } = await supabase.from("rediscovery_runs").insert({
      job_id, tenant_id: job.tenant_id, triggered_by: user.id, status: "running",
    }).select("id").single();

    try {
      // 1. Ensure job embedding exists
      await embedJobIfMissing(supabase, job_id);
      // 2. Warm candidate embeddings (limited batch)
      const embedded = await embedMissingCandidates(supabase, job.tenant_id, 25);

      // 3. Top-K similarity
      const { data: matches, error: matchErr } = await rpcClient
        .rpc("match_candidates_for_job", { p_job_id: job_id, p_match_count: 25 });
      if (matchErr) throw matchErr;

      const topIds = (matches ?? []).map((m: any) => m.candidate_id);
      let scanned = topIds.length;

      // 4. Fetch existing job_candidates to exclude
      const { data: existingJC } = await supabase
        .from("job_candidates").select("candidate_id").eq("job_id", job_id);
      const excludeIds = new Set((existingJC ?? []).map((x: any) => x.candidate_id));
      const eligibleIds = topIds.filter((id: string) => !excludeIds.has(id));

      if (eligibleIds.length === 0) {
        await supabase.from("rediscovery_runs").update({
          status: "success", candidates_scanned: scanned, matches_found: 0,
          completed_at: new Date().toISOString(),
        }).eq("id", run.id);

        return new Response(JSON.stringify({ ok: true, matches: 0, embedded }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // 5. Load candidate details (top 10 only go to AI)
      const aiPoolIds = eligibleIds.slice(0, 10);
      const { data: candidates } = await supabase
        .from("candidates")
        .select("id, full_name, current_title, location, experience_years, skills, summary, updated_at")
        .in("id", aiPoolIds);

      // 6. AI scoring (batched)
      let aiMap: Record<string, any> = {};
      if (candidates && candidates.length > 0) {
        try {
          aiMap = await aiScoreBatch(job, candidates);
        } catch (e: any) {
          if (e?.message === "RATE_LIMIT" || e?.message === "CREDITS_EXHAUSTED") {
            await supabase.from("rediscovery_runs").update({
              status: "failed", error: e.message, completed_at: new Date().toISOString(),
            }).eq("id", run.id);
            return new Response(JSON.stringify({ error: e.message }), {
              status: e.message === "RATE_LIMIT" ? 429 : 402,
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
          }
          throw e;
        }
      }

      // 7. Recent contact lookup for insights
      const { data: recentEmails } = await supabase
        .from("candidate_emails")
        .select("candidate_id")
        .in("candidate_id", aiPoolIds);

      // 8. Build upsert rows
      const similarityMap = new Map(
        (matches ?? []).map((m: any) => [m.candidate_id, Number(m.similarity ?? 0)])
      );
      const rows = (candidates ?? []).map((c: any) => {
        const ai = aiMap[c.id] ?? {};
        const sim = Number(similarityMap.get(c.id) ?? 0);
        const semScore = Math.round(sim * 100);
        const aiScore = typeof ai.score === "number" ? ai.score : semScore;
        const combined = Math.round(semScore * 0.6 + aiScore * 0.4);
        return {
          job_id, candidate_id: c.id, tenant_id: job.tenant_id,
          match_score: combined,
          semantic_score: sim,
          ai_score: aiScore,
          ai_summary: ai.summary ?? null,
          strengths: ai.strengths ?? [],
          gaps: ai.gaps ?? [],
          confidence: ai.confidence ?? "medium",
          insights: buildInsights(c, recentEmails ?? []),
          dismissed: false,
          updated_at: new Date().toISOString(),
        };
      });

      // Upsert in one call
      if (rows.length) {
        const { error: upErr } = await supabase
          .from("rediscovered_matches")
          .upsert(rows, { onConflict: "job_id,candidate_id" });
        if (upErr) throw upErr;
      }

      await supabase.from("rediscovery_runs").update({
        status: "success",
        candidates_scanned: scanned,
        matches_found: rows.length,
        completed_at: new Date().toISOString(),
      }).eq("id", run.id);

      return new Response(JSON.stringify({ ok: true, matches: rows.length, embedded, scanned }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    } catch (innerErr: any) {
      console.error("rediscovery inner error:", innerErr);
      await supabase.from("rediscovery_runs").update({
        status: "failed", error: innerErr?.message ?? "unknown",
        completed_at: new Date().toISOString(),
      }).eq("id", run.id);
      throw innerErr;
    }
  } catch (e: any) {
    console.error("rediscover-candidates error:", e);
    return new Response(JSON.stringify({ error: e?.message ?? "unknown" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
