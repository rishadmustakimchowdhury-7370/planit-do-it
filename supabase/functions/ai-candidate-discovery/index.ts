// AI Candidate Discovery: extract structured search criteria from a recruiter prompt
// + optional uploaded JD (PDF/DOCX/TXT). Uses OpenAI gpt-4o-mini with JSON schema.
// PDFs are sent to OpenAI as a `file` content part for real text extraction (incl. scanned PDFs).
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
    role_titles: { type: "array", items: { type: "string" } },
    skills: { type: "array", items: { type: "string" } },
    locations: { type: "array", items: { type: "string" } },
    industries: { type: "array", items: { type: "string" } },
    seniority: { type: "string" },
    min_years_experience: { type: ["integer", "null"], minimum: 0, maximum: 50 },
    max_years_experience: { type: ["integer", "null"], minimum: 0, maximum: 60 },
    keywords: { type: "array", items: { type: "string" } },
    languages: { type: "array", items: { type: "string" } },
    notes: { type: ["string", "null"] },
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
  const text = await res.text();
  if (!res.ok) throw new Error(`OpenAI ${res.status}: ${text.slice(0, 500)}`);
  try { return JSON.parse(text); } catch { throw new Error(`OpenAI returned non-JSON: ${text.slice(0, 200)}`); }
}

// Use OpenAI gpt-4o-mini to extract text from a PDF (handles scanned PDFs via its vision pipeline).
async function extractPdfWithOpenAI(fileBase64: string, fileName: string): Promise<string> {
  console.log(`[discovery] extracting PDF via OpenAI: ${fileName} (${fileBase64.length} b64 chars)`);
  const data = await callOpenAI({
    model: "gpt-4o-mini",
    temperature: 0,
    messages: [
      {
        role: "user",
        content: [
          { type: "text", text: "Extract ALL readable text from this job description PDF. Return only the raw text, preserving paragraphs and bullet points. Do not summarise." },
          {
            type: "file",
            file: {
              filename: fileName || "jd.pdf",
              file_data: `data:application/pdf;base64,${fileBase64}`,
            },
          },
        ],
      },
    ],
  });
  const out = (data?.choices?.[0]?.message?.content ?? "").toString().trim();
  console.log(`[discovery] extracted ${out.length} chars from ${fileName}`);
  return out;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  // ── Batch A / Phase 2 metering state (refund on failure) ────────────
  let __meterAdmin: ReturnType<typeof createClient> | null = null;
  let __meterTenant: string | null = null;
  let __meterUser: string | null = null;
  let __meterReserved = false;
  const __meterFeatureKey = "ai_candidate_discovery";
  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "Unauthorized" }, 401);

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const userClient = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authHeader } } });
    const { data: userData, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userData.user) return json({ error: "Unauthorized" }, 401);
    const admin = createClient(supabaseUrl, serviceKey);
    const { data: profile } = await admin.from("profiles").select("tenant_id").eq("id", userData.user.id).maybeSingle();
    const tenantId = (profile?.tenant_id as string | null) ?? null;
    __meterAdmin = admin; __meterTenant = tenantId; __meterUser = userData.user.id;
    if (tenantId) {
      const __r = await admin.rpc("check_and_reserve_feature_usage", {
        _tenant_id: tenantId, _feature_key: __meterFeatureKey, _amount: 1, _user_id: userData.user.id,
      });
      if (__r.error) {
        const m = __r.error.message ?? "";
        if (m.includes("FEATURE_LIMIT_EXCEEDED")) {
          return new Response(JSON.stringify({
            error: `Plan limit reached for ${__meterFeatureKey}. Upgrade to continue.`,
            code: "FEATURE_LIMIT_EXCEEDED", feature_key: __meterFeatureKey, upgrade_required: true,
          }), { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        }
        console.error("[meter] reserve error", m);
      } else { __meterReserved = true; }
    }


    const body = await req.json().catch(() => ({}));
    const prompt = (body.prompt ?? "").toString().trim();
    const fileName = (body.fileName ?? "").toString();
    const fileMime = (body.fileMime ?? "").toString();
    const fileBase64 = (body.fileBase64 ?? "").toString();
    let fileText = (body.fileText ?? "").toString();

    console.log(`[discovery] request from ${userData.user.id} prompt=${prompt.length}ch file=${fileName || "-"} mime=${fileMime} b64=${fileBase64.length}ch text=${fileText.length}ch`);

    // Real PDF extraction when a base64 PDF was provided.
    if (fileBase64 && (fileMime === "application/pdf" || fileName.toLowerCase().endsWith(".pdf"))) {
      try {
        fileText = await extractPdfWithOpenAI(fileBase64, fileName);
        if (!fileText || fileText.length < 20) {
          return json({
            error: `PDF text extraction returned only ${fileText.length} characters. The file may be empty, encrypted, or image-only with no readable text. Try a different file or paste the JD as text.`,
          }, 422);
        }
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Unknown extraction error";
        console.error(`[discovery] PDF extraction failed for ${fileName}:`, msg);
        return json({ error: `PDF extraction failed: ${msg}` }, 422);
      }
    }

    fileText = fileText.trim();
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

    console.log(`[discovery] criteria generated for ${userData.user.id}`);
    return json({ ok: true, criteria, extractedText: fileText.slice(0, 4000), extractedChars: fileText.length });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Server error";
    console.error("[discovery] error:", msg);
    return json({ error: msg }, 500);
  }
});
