// Generates an AI-powered Client Submission Report (recruiter assessment),
// versioned per (job, candidate). No PDF in this phase — JSON only.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY")!;

const REPORT_TOOL = {
  type: "function",
  function: {
    name: "emit_client_report",
    description: "Emit a structured recruiter assessment report for client submission.",
    parameters: {
      type: "object",
      additionalProperties: false,
      properties: {
        snapshot: {
          type: "object",
          additionalProperties: false,
          properties: {
            compensation_expectation: { type: "string" },
            availability: { type: "string" },
            nationality: { type: "string" },
            current_location: { type: "string" },
            current_employer: { type: "string" },
            current_position: { type: "string" },
          },
          required: ["compensation_expectation","availability","nationality","current_location","current_employer","current_position"],
        },
        executive_summary: { type: "string", description: "3-6 sentence recruiter-written summary." },
        fit_assessment: {
          type: "array",
          description: "One row per job requirement mapped to evidence.",
          items: {
            type: "object",
            additionalProperties: false,
            properties: {
              requirement: { type: "string" },
              evidence: { type: "string", description: "Concrete evidence from CV/notes/feedback. No hallucination." },
              fit: { type: "string", enum: ["STRONG","GOOD","PARTIAL","WEAK","MISSING"] },
            },
            required: ["requirement","evidence","fit"],
          },
        },
        key_strengths: { type: "array", items: { type: "string" }, minItems: 3, maxItems: 8 },
        considerations: { type: "array", items: { type: "string" }, description: "Honest concerns/gaps." },
        recruiter_notes: { type: "string", description: "Professional consolidation of recruiter text notes, voice transcripts, and screening." },
        recommendation: {
          type: "object",
          additionalProperties: false,
          properties: {
            tier: { type: "string", enum: ["Strong Shortlist","Recommended","Consider","Transferable","Do Not Recommend"] },
            reasoning: { type: "string" },
          },
          required: ["tier","reasoning"],
        },
      },
      required: ["snapshot","executive_summary","fit_assessment","key_strengths","considerations","recruiter_notes","recommendation"],
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

    const { job_id, candidate_id, anonymous = false } = await req.json();
    if (!job_id || !candidate_id) return j({ error: "job_id and candidate_id required" }, 400);

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE);

    const { data: profile } = await admin.from("profiles").select("tenant_id").eq("id", user.id).maybeSingle();
    const tenant_id = profile?.tenant_id;
    if (!tenant_id) return j({ error: "No tenant" }, 403);

    const [candidateRes, jobRes, validationRes, assessmentRes, brandingRes] = await Promise.all([
      admin.from("candidates").select("*").eq("id", candidate_id).maybeSingle(),
      admin.from("jobs").select("*").eq("id", job_id).maybeSingle(),
      admin.from("ai_candidate_validations").select("*").eq("job_id", job_id).eq("candidate_id", candidate_id).order("created_at",{ascending:false}).limit(1).maybeSingle(),
      admin.from("prepare_for_client_assessments").select("*").eq("job_id", job_id).eq("candidate_id", candidate_id).eq("recruiter_id", user.id).maybeSingle(),
      admin.from("branding_settings").select("*").eq("tenant_id", tenant_id).maybeSingle(),
    ]);

    const candidate = candidateRes.data;
    const job = jobRes.data;
    const validation = validationRes.data;
    const assessment = assessmentRes.data;

    if (!candidate || !job) return j({ error: "Candidate or job not found" }, 404);

    const voiceText = Array.isArray(assessment?.voice_transcripts)
      ? assessment.voice_transcripts.map((v: any) => v?.transcript || "").filter(Boolean).join("\n\n")
      : "";

    const systemPrompt = `You are an experienced executive recruiter writing a Client Submission Report.

Style: consultative, recruiter-grade, client-safe. Avoid ATS-style blunt rejection language.
Rules:
- Never invent evidence. If something is unknown, mark fit as MISSING or use "Not stated".
- Map every meaningful JD requirement to evidence from CV, notes, or recruiter feedback.
- Be honest about gaps in the Considerations section.
- Snapshot fields: use recruiter assessment data first, then CV. If unknown, say "Not stated".
- Recruiter notes section must combine text notes, voice transcript, and screening observations into a professional narrative.`;

    const userPayload = {
      job: {
        title: job.title, seniority: job.seniority_level, location: job.location,
        employment_type: job.employment_type, description: job.description,
        requirements: job.requirements, structured_jd: job.structured_jd,
      },
      candidate: {
        name: anonymous ? "Confidential Candidate" : candidate.full_name,
        current_title: candidate.current_title, current_company: candidate.current_company,
        location: candidate.location, experience_years: candidate.experience_years,
        skills: candidate.skills, summary: candidate.summary,
        work_history: candidate.work_history, education: candidate.education,
        structured_profile: candidate.structured_profile, cv_parsed_data: candidate.cv_parsed_data,
      },
      ai_validation: validation ? {
        final_score: validation.final_score ?? validation.fit_score,
        recommendation_tier: validation.recommendation_tier,
        strengths: validation.strengths, weaknesses: validation.weaknesses, risks: validation.risks,
        mandatory_skills_matched: validation.mandatory_skills_matched,
        missing_requirements: validation.missing_requirements,
        explanation: validation.explanation, summary: validation.summary,
      } : null,
      recruiter_assessment: assessment ? {
        text_notes: assessment.text_notes,
        structured: assessment.structured_notes,
        voice_transcript: voiceText,
      } : null,
    };

    const aiRes = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${OPENAI_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "gpt-4o",
        temperature: 0.3,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: JSON.stringify(userPayload) },
        ],
        tools: [REPORT_TOOL],
        tool_choice: { type: "function", function: { name: "emit_client_report" } },
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

    // Next version number
    const { data: existing } = await admin
      .from("client_submission_reports")
      .select("version")
      .eq("tenant_id", tenant_id).eq("job_id", job_id).eq("candidate_id", candidate_id)
      .order("version", { ascending: false }).limit(1).maybeSingle();
    const version = (existing?.version ?? 0) + 1;

    const reportData = {
      ...report,
      header: {
        candidate_name: anonymous ? "Confidential Candidate" : (candidate.full_name ?? ""),
        anonymous,
        position: job.title,
        confidential: true,
      },
      branding: {
        company_name: brandingRes.data?.company_name ?? null,
        logo_url: brandingRes.data?.logo_url ?? null,
        primary_color: brandingRes.data?.primary_color ?? null,
        footer_text: brandingRes.data?.footer_text ?? null,
      },
      meta: { generated_at: new Date().toISOString(), validation_score: validation?.final_score ?? validation?.fit_score ?? null },
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
