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

    const ctx = await resolveBillingContext(supabase, stripe, req.headers.get("Authorization"));
    if (!ctx.stripeCustomerId) {
      return new Response(JSON.stringify({ payment_method: null }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const customer = await stripe.customers.retrieve(ctx.stripeCustomerId, {
      expand: ["invoice_settings.default_payment_method"],
    });
    if (customer.deleted) throw new Error("Customer deleted");

    const pm = (customer as Stripe.Customer).invoice_settings
      ?.default_payment_method as Stripe.PaymentMethod | null;

    let result = null;
    if (pm?.card) {
      result = {
        id: pm.id,
        brand: pm.card.brand,
        last4: pm.card.last4,
        exp_month: pm.card.exp_month,
        exp_year: pm.card.exp_year,
      };
    } else {
      // fall back to listing card payment methods
      const list = await stripe.paymentMethods.list({
        customer: ctx.stripeCustomerId,
        type: "card",
        limit: 1,
      });
      const first = list.data[0];
      if (first?.card) {
        result = {
          id: first.id,
          brand: first.card.brand,
          last4: first.card.last4,
          exp_month: first.card.exp_month,
          exp_year: first.card.exp_year,
        };
      }
    }

    return new Response(JSON.stringify({ payment_method: result }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
