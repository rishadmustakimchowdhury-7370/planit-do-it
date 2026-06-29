// Resolve tenant + Stripe customer for an authenticated billing request.
import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import Stripe from "https://esm.sh/stripe@18.5.0";

export interface BillingContext {
  userId: string;
  email: string;
  tenantId: string | null;
  stripeCustomerId: string | null;
}

export async function resolveBillingContext(
  supabase: SupabaseClient,
  stripe: Stripe,
  authHeader: string | null,
): Promise<BillingContext> {
  if (!authHeader) throw new Error("Missing Authorization header");
  const token = authHeader.replace("Bearer ", "");
  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data.user?.email) throw new Error("Not authenticated");
  const user = data.user;

  const { data: profile } = await supabase
    .from("profiles")
    .select("tenant_id")
    .eq("id", user.id)
    .maybeSingle();

  let stripeCustomerId: string | null = null;

  // Prefer order-level mapping (existing convention)
  if (profile?.tenant_id) {
    const { data: order } = await supabase
      .from("orders")
      .select("stripe_customer_id")
      .eq("tenant_id", profile.tenant_id)
      .not("stripe_customer_id", "is", null)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    stripeCustomerId = order?.stripe_customer_id ?? null;
  }

  // Fallback to Stripe lookup by email
  if (!stripeCustomerId) {
    const customers = await stripe.customers.list({ email: user.email, limit: 1 });
    stripeCustomerId = customers.data[0]?.id ?? null;
  }

  return {
    userId: user.id,
    email: user.email,
    tenantId: profile?.tenant_id ?? null,
    stripeCustomerId,
  };
}

export const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
