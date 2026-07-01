// Convert natural-language prospect search into Apollo filters via OpenAI.
// Gated to Agency plan only.
import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...corsHeaders, "Content-Type": "application/json" } });

const EMPLOYEE_RANGES = ["1-10","11-50","51-200","201-500","501-1000","1001-5000","5001-10000","10001+"];

const SYSTEM_PROMPT = `You convert a recruiter's natural-language prospect search into structured Apollo.io company/people filters.

Return JSON ONLY in this exact shape (omit fields you cannot infer; never invent specific company names):
{
  "keywords": string,            // industry/role keywords e.g. "recruitment agency", "commodities trading", "healthcare staffing"
  "industry": string,            // single short industry tag, optional
  "employeeRange": string,       // one of: ${EMPLOYEE_RANGES.join(", ")} — only if user implied size
  "revenueMin": number|null,
  "revenueMax": number|null,
  "country": string,             // ISO country name e.g. "United Kingdom", "Switzerland", "United States"
  "city": string,                // city or region/state e.g. "London", "Zurich", "Texas"
  "explanation": string          // 1 short sentence explaining how you mapped the query
}

Rules:
- "London" => country "United Kingdom", city "London".
- "Switzerland" => country "Switzerland".
- "Texas" => country "United States", city "Texas".
- "recruitment agencies" => keywords "recruitment agency", industry "Staffing & Recruiting".
- "commodity companies" => keywords "commodities trading", industry "Commodities".
- "healthcare staffing" => keywords "healthcare staffing", industry "Staffing & Recruiting".
- Output JSON only. No prose, no markdown.`;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  // ── Batch A / Phase 2 metering state ─────────────────────────────────
  let __meterAdmin: ReturnType<typeof createClient> | null = null;
  let __meterTenant: string | null = null;
  let __meterUser: string | null = null;
  let __meterReserved = false;
  const __meterFeatureKey = "ai_prospect_search";
  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "Unauthorized" }, 401);

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const userClient = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authHeader } } });
    const { data: userData, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userData.user) return json({ error: "Unauthorized" }, 401);
    const userId = userData.user.id;
    const admin = createClient(supabaseUrl, serviceKey);

    const { data: profile } = await admin.from("profiles").select("tenant_id").eq("id", userId).maybeSingle();
    if (!profile?.tenant_id) return json({ error: "No tenant" }, 403);
    const tenantId = profile.tenant_id as string;
    __meterAdmin = admin; __meterTenant = tenantId; __meterUser = userId;

    // Agency plan gate
    const { data: tenant } = await admin
      .from("tenants").select("subscription_plan_id").eq("id", tenantId).maybeSingle();
    let slug: string | null = null;
    if (tenant?.subscription_plan_id) {
      const { data: plan } = await admin
        .from("subscription_plans").select("slug").eq("id", tenant.subscription_plan_id).maybeSingle();
      slug = (plan?.slug as string) ?? null;
    }
    if (slug !== "agency" && slug !== "enterprise") {
      return json({ error: "AI Prospect Search is available on the Agency/Enterprise plan only.", upgrade_required: true }, 403);
    }

    // Server-side metering (Batch A / Phase 2)
    const __r = await admin.rpc("check_and_reserve_feature_usage", {
      _tenant_id: tenantId, _feature_key: __meterFeatureKey, _amount: 1, _user_id: userId,
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


    const { query } = await req.json().catch(() => ({ query: "" }));
    if (!query || typeof query !== "string") return json({ error: "query is required" }, 400);

    const openaiKey = Deno.env.get("OPENAI_API_KEY");
    if (!openaiKey) return json({ error: "OPENAI_API_KEY not configured" }, 500);

    const aiRes = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { "Authorization": `Bearer ${openaiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        temperature: 0.1,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: query },
        ],
      }),
    });
    if (!aiRes.ok) {
      const t = await aiRes.text().catch(() => "");
      return json({ error: `OpenAI ${aiRes.status}: ${t.slice(0, 200)}` }, 502);
    }
    const aiData = await aiRes.json();
    const content = aiData.choices?.[0]?.message?.content ?? "{}";
    let parsed: Record<string, unknown> = {};
    try { parsed = JSON.parse(content); } catch { parsed = {}; }

    const filters = {
      keywords: String(parsed.keywords ?? ""),
      industry: String(parsed.industry ?? ""),
      employeeRange: EMPLOYEE_RANGES.includes(String(parsed.employeeRange ?? "")) ? String(parsed.employeeRange) : "",
      revenueMin: parsed.revenueMin == null ? null : Number(parsed.revenueMin),
      revenueMax: parsed.revenueMax == null ? null : Number(parsed.revenueMax),
      country: String(parsed.country ?? ""),
      city: String(parsed.city ?? ""),
      explanation: String(parsed.explanation ?? ""),
    };

    return json({ filters });
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : "Server error" }, 500);
  }
});
