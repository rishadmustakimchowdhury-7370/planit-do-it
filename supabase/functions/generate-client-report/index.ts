// Generates a recruiter-style Client Submission Report from:
//   1. Job Description
//   2. Candidate CV
//   3. Recruiter Notes
//   4. Voice Transcript (optional)
//
// This is NOT part of the AI Matching workflow. AI Match is already complete
// before a recruiter decides to submit. The report does not consume, depend
// on, or reconcile against any validation/parity record. It is purely a
// client-facing presentation layer that the recruiter has chosen to generate
// after deciding to submit.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY")!;

const RECOMMENDATIONS = ["Strong Shortlist", "Recommended", "Consider", "Transferable", "Do Not Recommend"] as const;

// Single tool call producing the full report. The recruiter can freely edit
// any field afterwards — the AI is just a drafting aid, not an authority.
const REPORT_TOOL = {
  type: "function",
  function: {
    name: "emit_client_submission_report",
    description: "Produce a recruiter-authored client submission report from the JD, CV, recruiter notes and voice transcript.",
    parameters: {
      type: "object",
      additionalProperties: false,
      properties: {
        snapshot: {
          type: "object",
          additionalProperties: false,
          properties: {
            compensation_expectation: { type: "string", description: "Salary / day rate expectation. Use 'Not stated' if unknown." },
            availability: { type: "string", description: "Notice period / start date / open to discuss." },
            nationality: { type: "string" },
            current_location: { type: "string" },
            current_employer: { type: "string" },
            current_position: { type: "string" },
          },
          required: ["compensation_expectation","availability","nationality","current_location","current_employer","current_position"],
        },
        executive_summary: {
          type: "string",
          description: "3-6 sentence client-facing summary of why this candidate is worth meeting.",
        },
        candidate_overview: {
          type: "string",
          description: "2-4 sentence overview of the candidate's background, current role, total experience and key domain.",
        },
        fit_assessment: {
          type: "array",
          description: "Evidence-based map of JD requirements to candidate evidence. Treat foundational/prerequisite skills as demonstrated by the role or stack the candidate has worked in (e.g. a React/Next.js developer demonstrably knows JavaScript). Only mark MISSING if neither the CV nor the candidate's roles credibly evidence it.",
          items: {
            type: "object",
            additionalProperties: false,
            properties: {
              requirement: { type: "string" },
              evidence: { type: "string" },
              fit: { type: "string", enum: ["EXCEEDS","STRONG","GOOD","PARTIAL","WEAK","MISSING"] },
            },
            required: ["requirement","evidence","fit"],
          },
        },
        key_strengths: {
          type: "array",
          description: "5-7 bullets, each starting with a short bolded lead phrase (e.g. 'Direct domain experience.') followed by 1-2 sentences of substance.",
          items: { type: "string" },
        },
        considerations: {
          type: "array",
          description: "3-5 considerations / potential gaps the client should probe at interview. Same format as strengths.",
          items: { type: "string" },
        },
        recruiter_assessment: {
          type: "string",
          description: "Recruiter's own view (post-screen) in 3-6 sentences. Plain prose, first-person plural ('we'). Incorporate the recruiter notes and voice transcript verbatim where useful.",
        },
        salary_availability: {
          type: "string",
          description: "1-3 sentences summarising compensation expectation, current package context, notice period and any flexibility.",
        },
        recommendation: {
          type: "object",
          additionalProperties: false,
          properties: {
            tier: { type: "string", enum: [...RECOMMENDATIONS] },
            reasoning: { type: "string", description: "Plain-English justification for the chosen tier." },
          },
          required: ["tier","reasoning"],
        },
      },
      required: ["snapshot","executive_summary","candidate_overview","fit_assessment","key_strengths","considerations","recruiter_assessment","salary_availability","recommendation"],
    },
  },
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization") ?? "";
    if (!authHeader.startsWith("Bearer ")) return j({ error: "Unauthorized" }, 401);

    const userClient = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) return j({ error: "Unauthorized" }, 401);

    const body = await req.json();
    const { job_id, candidate_id, anonymous = false } = body;
    const mode: "with_edits" | "from_original" = body.mode === "from_original" ? "from_original" : "with_edits";
    const previousReport = body.previous_report ?? null;
    if (!job_id || !candidate_id) return j({ error: "job_id and candidate_id required" }, 400);

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE);

    const { data: profile } = await admin.from("profiles").select("tenant_id").eq("id", user.id).maybeSingle();
    const tenant_id = profile?.tenant_id;
    if (!tenant_id) return j({ error: "No tenant" }, 403);

    const [candidateRes, jobRes, assessmentRes, brandingRes, tenantRes] = await Promise.all([
      admin.from("candidates").select("*").eq("id", candidate_id).maybeSingle(),
      admin.from("jobs").select("*").eq("id", job_id).maybeSingle(),
      admin.from("prepare_for_client_assessments").select("*").eq("job_id", job_id).eq("candidate_id", candidate_id).eq("recruiter_id", user.id).maybeSingle(),
      admin.from("branding_settings").select("*").eq("tenant_id", tenant_id).maybeSingle(),
      admin.from("tenants").select("name, logo_url, primary_color").eq("id", tenant_id).maybeSingle(),
    ]);

    const candidate = candidateRes.data;
    const job = jobRes.data;
    const assessment = assessmentRes.data;
    if (!candidate || !job) return j({ error: "Candidate or job not found" }, 404);

    // Merge branding from branding_settings -> tenants, then resolve logo URL.
    const mergedBranding = {
      company_name: brandingRes.data?.company_name || tenantRes.data?.name || null,
      logo_url: brandingRes.data?.logo_url || tenantRes.data?.logo_url || null,
      primary_color: brandingRes.data?.primary_color || tenantRes.data?.primary_color || null,
      footer_text: brandingRes.data?.footer_text || brandingRes.data?.company_name || tenantRes.data?.name || null,
    };
    if (mergedBranding.logo_url) {
      mergedBranding.logo_url = await resolveLogoUrl(admin, mergedBranding.logo_url);
    }

    const voiceText = Array.isArray(assessment?.voice_transcripts)
      ? assessment.voice_transcripts.map((v: any) => v?.transcript || "").filter(Boolean).join("\n\n")
      : "";

    const useEdits = mode === "with_edits" && previousReport;

    const systemPrompt = `You are an experienced executive recruiter authoring a Client Submission Report. The recruiter has already decided this candidate is suitable and is presenting them to a client.

CRITICAL RULES:
- Build a recruiter-style assessment that answers "Why is this candidate suitable?" — not "Did I find the exact keyword?".
- EVIDENCE-BASED REASONING: treat foundational/prerequisite skills as demonstrated by the role or stack the candidate has worked in. Examples: a React/Next.js developer demonstrably knows JavaScript, HTML and CSS; a TypeScript engineer knows the JavaScript ecosystem; a SOC Analyst demonstrates Security Operations; a Compliance Officer demonstrates Regulatory Compliance. Only mark something MISSING if neither the CV nor the candidate's roles credibly evidence it.
- Use the JD requirements as the source of truth for what to evaluate, and the CV + recruiter notes + voice transcript as the evidence base.
- For snapshot/salary fields, say "Not stated" when unknown. Never fabricate compensation, notice period or visa status.
- Keep the prose professional, neutral and client-safe. No internal scoring jargon.
${useEdits ? `
RECRUITER EDIT MODE — PRESERVE THE RECRUITER'S EDITS:
- "previous_report" contains the recruiter's edited version. Treat it as ground truth for tone, factual snapshot fields, and phrasing the recruiter has chosen.
- Refine and polish — do NOT discard, contradict, or revert recruiter edits.
- Keep any snapshot values the recruiter has filled in. Only fill blanks.
- Keep the recruiter's executive_summary and recruiter_assessment structure and any specific claims; you may tighten prose and fix grammar.` : `
CLEAN REGENERATION — IGNORE PRIOR EDITS:
- Generate a fresh report from the JD, CV, recruiter notes and voice transcript. Do not reuse prior report text.`}`;

    const userPayload = {
      regeneration_mode: mode,
      job: {
        title: job.title,
        seniority: job.experience_level ?? job.structured_jd?.seniority_level,
        location: job.location,
        employment_type: job.employment_type,
        description: job.description,
        requirements: job.requirements,
        structured_jd: job.structured_jd,
      },
      candidate: {
        name: anonymous ? "Confidential Candidate" : candidate.full_name,
        current_title: candidate.current_title,
        current_company: candidate.current_company,
        location: candidate.location,
        experience_years: candidate.experience_years,
        skills: candidate.skills,
        summary: candidate.summary,
        structured_profile: candidate.structured_profile,
        cv_parsed_data: candidate.cv_parsed_data,
      },
      recruiter_notes: assessment?.text_notes ?? null,
      recruiter_structured_notes: assessment?.structured_notes ?? null,
      voice_transcript: voiceText || null,
      previous_report: useEdits ? previousReport : null,
    };

    const aiRes = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${OPENAI_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "gpt-4o",
        temperature: 0.2,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: JSON.stringify(userPayload) },
        ],
        tools: [REPORT_TOOL],
        tool_choice: { type: "function", function: { name: "emit_client_submission_report" } },
      }),
    });

    if (!aiRes.ok) {
      const txt = await aiRes.text();
      return j({ error: `AI error: ${aiRes.status} ${txt}` }, 500);
    }
    const aiData = await aiRes.json();
    const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall) return j({ error: "AI returned no report" }, 500);
    const report = JSON.parse(toolCall.function.arguments);

    const { data: existing } = await admin
      .from("client_submission_reports")
      .select("version")
      .eq("tenant_id", tenant_id).eq("job_id", job_id).eq("candidate_id", candidate_id)
      .order("version", { ascending: false }).limit(1).maybeSingle();
    const version = (existing?.version ?? 0) + 1;

    const reportData = {
      snapshot: report.snapshot,
      executive_summary: report.executive_summary,
      candidate_overview: report.candidate_overview,
      fit_assessment: report.fit_assessment,
      key_strengths: report.key_strengths,
      considerations: report.considerations,
      recruiter_assessment: report.recruiter_assessment,
      salary_availability: report.salary_availability,
      recommendation: report.recommendation,
      header: {
        candidate_name: anonymous ? "Confidential Candidate" : (candidate.full_name ?? ""),
        anonymous,
        position: job.title,
        confidential: true,
      },
      branding: {
        company_name: mergedBranding.company_name,
        logo_url: mergedBranding.logo_url,
        primary_color: mergedBranding.primary_color,
        footer_text: mergedBranding.footer_text,
      },
      branding_diagnostics: {
        agency_name: mergedBranding.company_name,
        stored_logo_url: brandingRes.data?.logo_url || tenantRes.data?.logo_url || null,
        resolved_logo_url: mergedBranding.logo_url,
        source: brandingRes.data?.company_name
          ? "branding_settings"
          : (tenantRes.data?.name ? "tenants" : "none"),
      },
      meta: {
        generated_at: new Date().toISOString(),
        source: "client_submission_report_v3",
        regeneration_mode: mode,
        based_on_recruiter_edits: !!useEdits,
      },
    };

    const { data: inserted, error: insErr } = await admin.from("client_submission_reports").insert({
      tenant_id, job_id, candidate_id, recruiter_id: user.id,
      version, status: "draft", report_data: reportData,
      model: "gpt-4o", generated_by: user.id,
    }).select("*").single();
    if (insErr) return j({ error: insErr.message }, 500);

    return j({ report: inserted });
  } catch (e) {
    return j({ error: e instanceof Error ? e.message : String(e) }, 500);
  }
});

function j(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status, headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function resolveLogoUrl(admin: any, raw: string): Promise<string> {
  try {
    if (!raw) return raw;
    if (raw.startsWith("http")) return raw;
    if (raw.includes("/storage/v1/object/")) return raw;
    const buckets = ["documents", "branding", "trusted-clients", "public", "logos"];
    for (const b of buckets) {
      const { data } = await admin.storage.from(b).createSignedUrl(raw, 60 * 60 * 24);
      if (data?.signedUrl) return data.signedUrl;
    }
  } catch (_) { /* ignore */ }
  return raw;
}
