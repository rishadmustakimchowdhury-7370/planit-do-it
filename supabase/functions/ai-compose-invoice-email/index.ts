import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

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
  try {
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
    return new Response(JSON.stringify({ error: e?.message || "Failed" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
