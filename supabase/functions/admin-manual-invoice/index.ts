// Super-admin: create a one-off Stripe invoice for a tenant.
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import { getStripeCredentials } from "../_shared/stripe-credentials.ts";
import { corsHeaders } from "../_shared/billing-context.ts";

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    { auth: { persistSession: false } },
  );

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("Missing Authorization");
    const token = authHeader.replace("Bearer ", "");
    const { data: u } = await supabase.auth.getUser(token);
    if (!u.user) throw new Error("Not authenticated");
    const { data: isAdmin } = await supabase.rpc("is_super_admin", { _user_id: u.user.id });
    if (!isAdmin) throw new Error("Forbidden");

    const { tenant_id, description, amount_cents, currency = "usd" } = await req.json();
    if (!tenant_id || !description || !amount_cents) {
      throw new Error("tenant_id, description, amount_cents required");
    }

    const { secretKey } = await getStripeCredentials(supabase);
    if (!secretKey) throw new Error("Stripe is not configured");
    const stripe = new Stripe(secretKey, { apiVersion: "2025-08-27.basil" });

    const { data: order } = await supabase
      .from("orders")
      .select("stripe_customer_id")
      .eq("tenant_id", tenant_id)
      .not("stripe_customer_id", "is", null)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!order?.stripe_customer_id) throw new Error("No Stripe customer on file");

    await stripe.invoiceItems.create({
      customer: order.stripe_customer_id,
      amount: Math.round(amount_cents),
      currency,
      description,
    });

    const invoice = await stripe.invoices.create({
      customer: order.stripe_customer_id,
      auto_advance: true,
      collection_method: "send_invoice",
      days_until_due: 14,
      metadata: { tenant_id, manual: "true", created_by: u.user.id },
    });

    await stripe.invoices.finalizeInvoice(invoice.id);

    await supabase.from("audit_log").insert({
      user_id: u.user.id,
      tenant_id,
      action: "invoice.manual_created",
      entity_type: "invoice",
      new_values: { stripe_invoice_id: invoice.id, amount_cents, description },
    });

    return new Response(JSON.stringify({ success: true, invoice_id: invoice.id }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
