// Super-admin: pull subscription state from Stripe and rewrite tenant row.
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

    const { tenant_id } = await req.json();
    if (!tenant_id) throw new Error("tenant_id required");

    const { secretKey } = await getStripeCredentials(supabase);
    if (!secretKey) throw new Error("Stripe is not configured");
    const stripe = new Stripe(secretKey, { apiVersion: "2025-08-27.basil" });

    const { data: order } = await supabase
      .from("orders")
      .select("stripe_customer_id, stripe_subscription_id")
      .eq("tenant_id", tenant_id)
      .not("stripe_customer_id", "is", null)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!order?.stripe_customer_id) throw new Error("No Stripe customer on file for this tenant");

    const subs = await stripe.subscriptions.list({
      customer: order.stripe_customer_id,
      status: "all",
      limit: 5,
    });
    const sub = subs.data[0];
    if (!sub) {
      await supabase.from("tenants")
        .update({ subscription_status: "expired" })
        .eq("id", tenant_id);
      return new Response(JSON.stringify({ success: true, status: "expired" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const status = sub.status;
    const endsAt = sub.current_period_end
      ? new Date(sub.current_period_end * 1000).toISOString()
      : null;

    await supabase.from("tenants").update({
      subscription_status: status,
      subscription_ends_at: endsAt,
    }).eq("id", tenant_id);

    await supabase.rpc("admin_request_stripe_resync", { p_tenant_id: tenant_id }).catch(() => {});

    return new Response(JSON.stringify({ success: true, status, ends_at: endsAt }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
