// Change subscription plan or billing cycle. Sends prorated change via Stripe.
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
    const { plan_id, billing_cycle } = await req.json() as {
      plan_id: string;
      billing_cycle: "monthly" | "yearly";
    };
    if (!plan_id || !billing_cycle) throw new Error("plan_id and billing_cycle required");

    const { secretKey } = await getStripeCredentials(supabase);
    if (!secretKey) throw new Error("Stripe is not configured");
    const stripe = new Stripe(secretKey, { apiVersion: "2025-08-27.basil" });

    const ctx = await resolveBillingContext(supabase, stripe, req.headers.get("Authorization"));
    if (!ctx.stripeCustomerId) throw new Error("No Stripe customer found");
    if (!ctx.tenantId) throw new Error("No tenant");

    const { data: plan, error: planErr } = await supabase
      .from("subscription_plans")
      .select("id, name, slug, stripe_price_id_monthly, stripe_price_id_yearly")
      .eq("id", plan_id)
      .maybeSingle();
    if (planErr || !plan) throw new Error("Plan not found");

    const priceId = billing_cycle === "yearly"
      ? plan.stripe_price_id_yearly
      : plan.stripe_price_id_monthly;
    if (!priceId) throw new Error(`No ${billing_cycle} price configured for this plan`);

    const subs = await stripe.subscriptions.list({
      customer: ctx.stripeCustomerId,
      status: "active",
      limit: 1,
    });
    if (subs.data.length === 0) throw new Error("No active subscription to modify");
    const sub = subs.data[0];

    const updated = await stripe.subscriptions.update(sub.id, {
      cancel_at_period_end: false,
      proration_behavior: "create_prorations",
      items: [{ id: sub.items.data[0].id, price: priceId }],
    });

    await supabase.from("tenants")
      .update({ subscription_plan_id: plan.id })
      .eq("id", ctx.tenantId);

    await supabase.rpc("write_audit_log", {
      _action: "subscription.changed",
      _entity_type: "subscription",
      _entity_id: ctx.tenantId,
      _metadata: { plan_id: plan.id, billing_cycle, stripe_subscription_id: updated.id },
    }).catch(() => {});

    await notifyBillingEvent(supabase, {
      tenantId: ctx.tenantId,
      event: "subscription_reactivated",
      title: `Plan changed to ${plan.name}`,
      message: `Your subscription is now on the ${plan.name} plan (${billing_cycle}).`,
    });

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
