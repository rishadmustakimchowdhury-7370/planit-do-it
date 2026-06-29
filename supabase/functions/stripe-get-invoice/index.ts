import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import { getStripeCredentials } from "../_shared/stripe-credentials.ts";
import { resolveBillingContext, corsHeaders } from "../_shared/billing-context.ts";

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    { auth: { persistSession: false } },
  );

  try {
    const { secretKey } = await getStripeCredentials(supabase);
    if (!secretKey) throw new Error("Stripe is not configured");
    const stripe = new Stripe(secretKey, { apiVersion: "2025-08-27.basil" });

    const url = new URL(req.url);
    const invoiceId = url.searchParams.get("id");
    if (!invoiceId) throw new Error("Missing invoice id");

    const ctx = await resolveBillingContext(supabase, stripe, req.headers.get("Authorization"));
    if (!ctx.stripeCustomerId) throw new Error("No Stripe customer");

    const inv = await stripe.invoices.retrieve(invoiceId, { expand: ["lines.data.price.product"] });
    if (inv.customer !== ctx.stripeCustomerId) throw new Error("Not authorized for this invoice");

    return new Response(
      JSON.stringify({
        id: inv.id,
        number: inv.number,
        status: inv.status,
        created: inv.created,
        period_start: inv.period_start,
        period_end: inv.period_end,
        currency: inv.currency,
        subtotal: inv.subtotal,
        tax: inv.tax,
        total: inv.total,
        amount_paid: inv.amount_paid,
        discount_amount: inv.total_discount_amounts?.reduce((s, d) => s + (d.amount || 0), 0) ?? 0,
        hosted_invoice_url: inv.hosted_invoice_url,
        invoice_pdf: inv.invoice_pdf,
        lines: inv.lines.data.map((l) => ({
          description: l.description,
          amount: l.amount,
          quantity: l.quantity,
        })),
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
