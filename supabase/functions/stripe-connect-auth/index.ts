import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const logStep = (step: string, details?: unknown) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : "";
  console.log(`[STRIPE-CONNECT-AUTH] ${step}${detailsStr}`);
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    { auth: { persistSession: false } }
  );

  try {
    logStep("Function started");

    // Verify super admin
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("Missing Authorization header");

    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userError } = await supabase.auth.getUser(token);
    if (userError) throw new Error(`Auth error: ${userError.message}`);

    const userId = userData.user?.id;
    if (!userId) throw new Error("User not authenticated");

    // Check if super admin
    const { data: roleData } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userId)
      .eq("role", "super_admin")
      .maybeSingle();

    if (!roleData) throw new Error("Unauthorized: Super admin access required");
    logStep("Super admin verified", { userId });

    const { action, stripeSecretKey, stripePublishableKey, stripeWebhookSecret } = await req.json();

    if (action === "connect") {
      // Validate the Stripe keys by making a test API call
      if (!stripeSecretKey) throw new Error("Stripe Secret Key is required");

      // Test the API key
      const testResponse = await fetch("https://api.stripe.com/v1/account", {
        headers: {
          "Authorization": `Bearer ${stripeSecretKey}`,
        },
      });

      if (!testResponse.ok) {
        const errorData = await testResponse.json();
        throw new Error(`Invalid Stripe API Key: ${errorData.error?.message || "Unknown error"}`);
      }

      const accountData = await testResponse.json();
      logStep("Stripe account verified", { accountId: accountData.id, email: accountData.email });

      // Store the connection (encrypt keys in production - for now storing as-is)
      // Check if record exists
      const { data: existingConnect } = await supabase
        .from("stripe_connect")
        .select("id")
        .limit(1)
        .maybeSingle();

      const connectData = {
        stripe_account_id: accountData.id,
        stripe_publishable_key: stripePublishableKey || null,
        stripe_secret_key_encrypted: stripeSecretKey, // In production, encrypt this
        stripe_webhook_secret_encrypted: stripeWebhookSecret || null,
        is_connected: true,
        connected_at: new Date().toISOString(),
        connected_by: userId,
        account_name: accountData.business_profile?.name || accountData.settings?.dashboard?.display_name || null,
        account_email: accountData.email,
        livemode: accountData.livemode || false,
        updated_at: new Date().toISOString(),
      };

      let result;
      if (existingConnect) {
        result = await supabase
          .from("stripe_connect")
          .update(connectData)
          .eq("id", existingConnect.id)
          .select()
          .single();
      } else {
        result = await supabase
          .from("stripe_connect")
          .insert(connectData)
          .select()
          .single();
      }

      if (result.error) throw new Error(`Failed to save connection: ${result.error.message}`);

      logStep("Stripe connected successfully", { accountId: accountData.id });

      return new Response(JSON.stringify({
        success: true,
        account: {
          id: accountData.id,
          email: accountData.email,
          name: accountData.business_profile?.name || accountData.settings?.dashboard?.display_name,
          livemode: accountData.livemode,
        },
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    if (action === "disconnect") {
      const { error } = await supabase
        .from("stripe_connect")
        .update({
          is_connected: false,
          stripe_secret_key_encrypted: null,
          stripe_webhook_secret_encrypted: null,
          updated_at: new Date().toISOString(),
        })
        .neq("id", "00000000-0000-0000-0000-000000000000"); // Update all rows

      if (error) throw new Error(`Failed to disconnect: ${error.message}`);

      logStep("Stripe disconnected successfully");

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    if (action === "status") {
      const { data: connectData } = await supabase
        .from("stripe_connect")
        .select("*")
        .limit(1)
        .maybeSingle();

      return new Response(JSON.stringify({
        connected: connectData?.is_connected || false,
        account: connectData ? {
          id: connectData.stripe_account_id,
          email: connectData.account_email,
          name: connectData.account_name,
          livemode: connectData.livemode,
          connectedAt: connectData.connected_at,
        } : null,
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    throw new Error("Invalid action");
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logStep("ERROR", { message: errorMessage });

    return new Response(JSON.stringify({ error: errorMessage }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
