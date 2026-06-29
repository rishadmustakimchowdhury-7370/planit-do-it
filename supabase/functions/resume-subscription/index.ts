// Resume a subscription that was scheduled to cancel at period end.
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import { getStripeCredentials } from "../_shared/stripe-credentials.ts";
import { resolveBillingContext, corsHeaders } from "../_shared/billing-context.ts";
import { notifyBillingEvent } from "../_shared/billing-events.ts";

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
    if (!ctx.stripeCustomerId) throw new Error("No Stripe customer");

    const subs = await stripe.subscriptions.list({
      customer: ctx.stripeCustomerId,
      status: "all",
      limit: 5,
    });
    const sub = subs.data.find((s) => s.cancel_at_period_end);
    if (!sub) throw new Error("No subscription scheduled to cancel");

    const updated = await stripe.subscriptions.update(sub.id, { cancel_at_period_end: false });

    if (ctx.tenantId) {
      await supabase.from("tenants").update({ subscription_status: "active" }).eq("id", ctx.tenantId);
      await notifyBillingEvent(supabase, {
        tenantId: ctx.tenantId,
        event: "subscription_reactivated",
        message: "Your subscription has been resumed and will renew normally.",
      });
    }

    return new Response(JSON.stringify({ success: true, subscription_id: updated.id }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
