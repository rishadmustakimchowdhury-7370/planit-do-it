// AI Candidate Discovery: extract structured search criteria from a recruiter prompt
// + optional uploaded JD (PDF/DOCX). Uses OpenAI gpt-4o-mini with JSON schema.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (b: unknown, status = 200) =>
  new Response(JSON.stringify(b), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

const SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    role_titles: { type: "array", items: { type: "string" }, description: "Target job titles" },
    skills: { type: "array", items: { type: "string" }, description: "Required hard skills/technologies" },
    locations: { type: "array", items: { type: "string" }, description: "Cities, regions, or countries" },
    industries: { type: "array", items: { type: "string" } },
    seniority: { type: "string", description: "junior | mid | senior | lead | director | executive | any" },
    min_years_experience: { type: ["integer", "null"], minimum: 0, maximum: 50 },
    max_years_experience: { type: ["integer", "null"], minimum: 0, maximum: 60 },
    keywords: { type: "array", items: { type: "string" }, description: "Additional free-text keywords" },
    languages: { type: "array", items: { type: "string" }, description: "Spoken languages required" },
    notes: { type: ["string", "null"], description: "Short analyst summary (1–2 sentences)" },
  },
  required: [
    "role_titles", "skills", "locations", "industries",
    "seniority", "min_years_experience", "max_years_experience",
    "keywords", "languages", "notes",
  ],
} as const;

const SYSTEM = `You are a senior recruitment sourcing analyst.
A recruiter will give you a free-text request, a pasted job description, or an uploaded JD.
Extract concrete, searchable criteria. Be precise — do not invent skills or locations not implied by the input.
If a field is unknown, return an empty array (or null where allowed). Use ISO-style country names (e.g. "United Kingdom", "Switzerland").
Always populate a short "notes" summary of the search intent.`;

async function callOpenAI(body: Record<string, unknown>) {
  const key = Deno.env.get("OPENAI_API_KEY");
  if (!key) throw new Error("OPENAI_API_KEY not configured");
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const t = await res.text().catch(() => "");
    throw new Error(`OpenAI ${res.status}: ${t.slice(0, 300)}`);
  }
  return await res.json();
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "Unauthorized" }, 401);

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const userClient = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authHeader } } });
    const { data: userData, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userData.user) return json({ error: "Unauthorized" }, 401);

    const body = await req.json().catch(() => ({}));
    const prompt = (body.prompt ?? "").toString().trim();
    const fileText = (body.fileText ?? "").toString().trim();
    const fileName = (body.fileName ?? "").toString();
    if (!prompt && !fileText) return json({ error: "Provide a prompt or job description text" }, 400);

    const userContent = [
      prompt ? `Recruiter request:\n${prompt}` : "",
      fileText ? `\n\nJob description${fileName ? ` (${fileName})` : ""}:\n${fileText.slice(0, 12000)}` : "",
    ].filter(Boolean).join("");

    const data = await callOpenAI({
      model: "gpt-4o-mini",
      temperature: 0.1,
      messages: [
        { role: "system", content: SYSTEM },
        { role: "user", content: userContent },
      ],
      response_format: {
        type: "json_schema",
        json_schema: { name: "search_criteria", strict: true, schema: SCHEMA },
      },
    });

    const raw = data?.choices?.[0]?.message?.content ?? "{}";
    let criteria: Record<string, unknown> = {};
    try { criteria = JSON.parse(raw); } catch { criteria = {}; }

    return json({ ok: true, criteria });
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : "Server error" }, 500);
  }
});
