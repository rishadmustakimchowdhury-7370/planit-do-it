import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface TempLoginRequest {
  token: string;
  user_id: string;
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const body: TempLoginRequest = await req.json();
    const { token, user_id } = body;

    if (!token || !user_id) {
      return new Response(
        JSON.stringify({ error: "token and user_id are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Hash the token
    const encoder = new TextEncoder();
    const data = encoder.encode(token);
    const hashBuffer = await crypto.subtle.digest("SHA-256", data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const tokenHash = hashArray.map(b => b.toString(16).padStart(2, "0")).join("");

    // Verify the temp login link
    const { data: linkData, error: linkError } = await supabase
      .from("temp_login_links")
      .select("*")
      .eq("user_id", user_id)
      .eq("token_hash", tokenHash)
      .is("used_at", null)
      .gt("expires_at", new Date().toISOString())
      .single();

    if (linkError || !linkData) {
      console.log("Invalid or expired temp login link:", linkError?.message);
      return new Response(
        JSON.stringify({ error: "Invalid or expired temporary login link" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Mark the link as used
    await supabase
      .from("temp_login_links")
      .update({ used_at: new Date().toISOString() })
      .eq("id", linkData.id);

    // Get user email
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("email")
      .eq("id", user_id)
      .single();

    if (profileError || !profile?.email) {
      return new Response(
        JSON.stringify({ error: "User not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Generate a magic link that auto-signs in
    const { data: magicLinkData, error: magicLinkError } = await supabase.auth.admin.generateLink({
      type: "magiclink",
      email: profile.email,
      options: {
        redirectTo: `${req.headers.get("origin") || "https://recruitsy.app"}/dashboard`,
      },
    });

    if (magicLinkError || !magicLinkData) {
      console.error("Error generating magic link:", magicLinkError);
      return new Response(
        JSON.stringify({ error: "Failed to generate login link" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Log the action
    await supabase.from("audit_log").insert([{
      action: "temp_login_used",
      entity_type: "user",
      entity_id: user_id,
      new_values: { link_id: linkData.id },
    }]);

    console.log("Temp login successful for user:", user_id);

    return new Response(
      JSON.stringify({ 
        success: true, 
        redirect_url: magicLinkData.properties?.action_link 
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("Error in temp-login function:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
