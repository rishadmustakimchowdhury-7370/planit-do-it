import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";


const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface Body {
  client_name?: string;
  client_contact_name?: string;
  candidate_name?: string;
  job_title?: string;
  invoice_number: string;
  amount: number;
  currency: string;
  due_date?: string;
  agency_name?: string;
  recruiter_name?: string;
  tone?: "formal" | "friendly" | "brief";
  custom_instructions?: string;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  // Batch A / Phase 2 metering state
  let __meterAdmin: any = null;
  let __meterTenant: string | null = null;
  let __meterUser: string | null = null;
  let __meterReserved = false;
  const __meterFeatureKey = "ai_email_generation";

  try {
    // Auth + tenant + meter (payload unchanged)
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const userClient = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authHeader } } });
    const { data: userData, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userData.user) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    const admin = createClient(supabaseUrl, serviceKey);
    const { data: profile } = await admin.from('profiles').select('tenant_id').eq('id', userData.user.id).maybeSingle();
    const tenantId = (profile?.tenant_id as string | null) ?? null;
    __meterAdmin = admin; __meterTenant = tenantId; __meterUser = userData.user.id;
    if (tenantId) {
      const __r = await admin.rpc('check_and_reserve_feature_usage', {
        _tenant_id: tenantId, _feature_key: __meterFeatureKey, _amount: 1, _user_id: userData.user.id,
      });
      if (__r.error) {
        const m = __r.error.message ?? '';
        if (m.includes('FEATURE_LIMIT_EXCEEDED')) {
          return new Response(JSON.stringify({
            error: `Plan limit reached for ${__meterFeatureKey}. Upgrade to continue.`,
            code: 'FEATURE_LIMIT_EXCEEDED', feature_key: __meterFeatureKey, upgrade_required: true,
          }), { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }
        console.error('[meter] reserve error', m);
      } else { __meterReserved = true; }
    }

    const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
    if (!OPENAI_API_KEY) throw new Error("OPENAI_API_KEY missing");

    const b: Body = await req.json();
    const greetingName = b.client_contact_name?.trim() || (b.client_name ? `${b.client_name} team` : "there");
    const amountStr = new Intl.NumberFormat("en-US", { style: "currency", currency: (b.currency || "USD").toUpperCase() }).format(b.amount || 0);

    const system = `You are a senior recruitment agency consultant writing a CLIENT BILLING email accompanying an attached invoice PDF.

CRITICAL CONTEXT:
- Recipient is the CLIENT (the company that hired the candidate). NEVER candidate outreach.
- A professional invoice PDF is attached. Reference it naturally.
- Tone: ${b.tone || "formal"}, professional, concise, warm but business-like.

OUTPUT FORMAT (exact, blank line between each):

Hello ${greetingName},

[Paragraph 1 — Thank the client for their business and reference the successful placement of ${b.candidate_name || "the candidate"}${b.job_title ? ` for the ${b.job_title} role` : ""}.]

[Paragraph 2 — Confirm that invoice ${b.invoice_number} for ${amountStr} is attached${b.due_date ? `, with a due date of ${b.due_date}` : ""}. Mention that payment details (bank info) are inside the PDF.]

[Paragraph 3 — Offer help with any questions and confirm the team is available for future hiring needs.]

Kind regards,

STRICT RULES:
- No bullet points, no markdown, no emojis, no HTML.
- Do not invent numbers, dates, or facts.
- Do not include a signature block — the system appends one.
- Stop after "Kind regards,".
- Provide a subject line at the END in the exact format:
SUBJECT: Invoice ${b.invoice_number}${b.client_name ? ` – ${b.client_name}` : ""}`;

    const user = `Compose the client billing email.
CLIENT: ${b.client_name || "(unknown)"}
CONTACT: ${b.client_contact_name || "(team)"}
CANDIDATE: ${b.candidate_name || "(unspecified)"}
ROLE: ${b.job_title || "(unspecified)"}
INVOICE #: ${b.invoice_number}
AMOUNT: ${amountStr}
DUE DATE: ${b.due_date || "(none)"}
AGENCY: ${b.agency_name || "(unspecified)"}
SENDER: ${b.recruiter_name || "the consultant"}
${b.custom_instructions ? `\nADDITIONAL INSTRUCTIONS: ${b.custom_instructions}` : ""}`;

    const r = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { "Authorization": `Bearer ${OPENAI_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        temperature: 0.6,
        messages: [{ role: "system", content: system }, { role: "user", content: user }],
      }),
    });
    if (!r.ok) {
      const txt = await r.text();
      throw new Error(`OpenAI ${r.status}: ${txt}`);
    }
    const j = await r.json();
    const raw = (j.choices?.[0]?.message?.content || "").trim();

    let subject = `Invoice ${b.invoice_number}${b.client_name ? ` – ${b.client_name}` : ""}`;
    let body = raw;
    const m = raw.match(/SUBJECT:\s*(.+?)\s*$/im);
    if (m) {
      subject = m[1].trim();
      body = raw.replace(m[0], "").trim();
    }

    return new Response(JSON.stringify({ subject, body }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    console.error("[ai-compose-invoice-email]", e);
    const msg = e?.message || "Failed";
    if (__meterReserved && __meterAdmin && __meterTenant) {
      try {
        await __meterAdmin.rpc('refund_feature_usage', {
          _tenant_id: __meterTenant, _feature_key: __meterFeatureKey,
          _amount: 1, _user_id: __meterUser, _reason: String(msg).slice(0, 200),
        });
      } catch (_) { /* noop */ }
    }
    return new Response(JSON.stringify({ error: msg }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }

});
