import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

interface StripeConnectRow {
  stripe_secret_key_encrypted: string | null;
  stripe_webhook_secret_encrypted: string | null;
  is_connected: boolean;
}

// Helper to get Stripe credentials from database or environment
export async function getStripeCredentials(supabase: SupabaseClient) {
  // First try to get from database (connected account)
  const { data: connectData } = await supabase
    .from("stripe_connect")
    .select("stripe_secret_key_encrypted, stripe_webhook_secret_encrypted, is_connected")
    .eq("is_connected", true)
    .limit(1)
    .maybeSingle() as { data: StripeConnectRow | null };

  if (connectData?.stripe_secret_key_encrypted) {
    return {
      secretKey: connectData.stripe_secret_key_encrypted,
      webhookSecret: connectData.stripe_webhook_secret_encrypted || Deno.env.get("STRIPE_WEBHOOK_SECRET"),
    };
  }

  // Fallback to environment variables
  return {
    secretKey: Deno.env.get("STRIPE_SECRET_KEY"),
    webhookSecret: Deno.env.get("STRIPE_WEBHOOK_SECRET"),
  };
}
