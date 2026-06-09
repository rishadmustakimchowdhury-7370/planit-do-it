// Client Communication Assistant — Phase 6 of Recruiter Copilot.
// Generates recruiter-grade, client-safe copy on demand from the same
// ValidationOutput (single source of truth). Supported types:
//   - submission_summary
//   - positioning_note
//   - interview_scheduling
//   - follow_up
//   - objection_response
//
// Never exposes recruiter-only fields. Outputs are plain text; the caller is
// responsible for embedding into the email channel.

import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type CommType =
  | "submission_summary" | "positioning_note"
  | "interview_scheduling" | "follow_up" | "objection_response";

const TYPE_GUIDE: Record<CommType, string> = {
  submission_summary:
    "A polished executive submission summary (4–6 sentences) the recruiter can paste into a client email. Lead with the candidate's most relevant strengths anchored to JD requirements. Acknowledge any adjacent/transferable angles in commercially confident language. Close with a clear call to next step.",
  positioning_note:
    "A 3–5 sentence client-safe positioning note that frames transferable experience as opportunity, never as a gap. Use confident recruiter tone.",
  interview_scheduling:
    "A short, warm interview-scheduling message offering 2–3 next steps. Reference what the interview should focus on without revealing internal AI concerns. Keep under 100 words.",
  follow_up:
    "A nudge follow-up email to the client (under 90 words) referencing the candidate and asking for a status update. Professional, never pushy.",
  objection_response:
    "A direct, recruiter-grade response to a likely client objection. Acknowledge the concern, then surface 2–3 evidence points that address it. Close with an invitation to discuss live.",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: userData, error: userErr } = await supabase.auth.getUser();
    if (userErr || !userData?.user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const { job_id, candidate_id, type, objection, language } = await req.json();
    const commType = String(type) as CommType;
    if (!job_id || !candidate_id || !TYPE_GUIDE[commType]) {
      return new Response(JSON.stringify({ error: "job_id, candidate_id, type required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const [{ data: validation }, { data: candidate }, { data: job }] = await Promise.all([
      supabase.from("ai_candidate_validations").select("*")
        .eq("job_id", job_id).eq("candidate_id", candidate_id)
        .eq("is_active", true)
        .order("created_at", { ascending: false }).limit(1).maybeSingle(),
      supabase.from("candidates").select("full_name, current_title, current_company").eq("id", candidate_id).maybeSingle(),
      supabase.from("jobs").select("title, location, employment_type").eq("id", job_id).maybeSingle(),
    ]);

    if (!validation) {
      return new Response(JSON.stringify({ error: "Run AI validation first" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
    if (!OPENAI_API_KEY) {
      return new Response(JSON.stringify({ error: "OPENAI_API_KEY not configured" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // STRICTLY CLIENT-SAFE: never include recruiter_copilot, recruiter_override,
    // raw considerations, or risks in the prompt context — only client-safe
    // strengths + summary + match band + positioning angles flagged "client".
    const cp: any = (validation as any).recruiter_copilot ?? {};
    const clientAngles = Array.isArray(cp.positioning_angles)
      ? cp.positioning_angles.filter((p: any) => p?.audience === "client").map((p: any) => p.angle)
      : [];

    const ctx = {
      candidate: candidate?.full_name,
      current_role: `${candidate?.current_title ?? ""}${candidate?.current_company ? ` @ ${candidate.current_company}` : ""}`,
      role: job?.title,
      location: job?.location,
      employment_type: job?.employment_type,
      classification: (validation as any).match_classification ?? (validation as any).recommendation,
      summary: (validation as any).summary,
      strengths: (validation as any).strengths ?? [],
      positioning_angles_client_safe: clientAngles,
      objection_text: objection ?? null,
    };

    const langInstruction = language && String(language).toLowerCase() !== "english"
      ? `\nWrite the output in ${language}. Use natural, professional business tone for that language.`
      : "";

    const systemPrompt = `You are a senior executive recruiter writing client-facing communication. Tone: confident, warm, commercial, never apologetic. NEVER reveal internal AI analysis, probabilities, gaps, risks, recruiter strategy, or internal classifications. NEVER use the words "lacks", "weak", "missing", "concern", "AI", "validation", "score". Reframe transferable experience as commercial opportunity. Always sound like a human recruiter who has met the candidate.${langInstruction}

OUTPUT FORMAT: ${TYPE_GUIDE[commType]}

Return JSON: { "subject": "<email subject line or null if not applicable>", "body": "<the message body, plain text with paragraph breaks>" }`;

    const aiRes = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${OPENAI_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: `Context:\n${JSON.stringify(ctx, null, 2)}\n\nGenerate the ${commType.replace(/_/g, " ")} now.` },
        ],
        temperature: 0.4,
        response_format: { type: "json_object" },
      }),
    });

    if (!aiRes.ok) {
      const t = await aiRes.text();
      console.error("client-comms openai error", aiRes.status, t);
      return new Response(JSON.stringify({ error: aiRes.status === 429 ? "Rate limited, try again shortly." : "AI provider error" }), {
        status: aiRes.status === 429 ? 429 : 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const aiJson = await aiRes.json();
    let parsed: any = {};
    try { parsed = JSON.parse(aiJson.choices?.[0]?.message?.content ?? "{}"); } catch { parsed = {}; }

    return new Response(JSON.stringify({
      subject: parsed.subject ?? null,
      body: parsed.body ?? "",
      type: commType,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    console.error("generate-client-comms error", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
