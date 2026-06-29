// Validate a promo code against current user/plan/interval.
// Thin wrapper around public.validate_promo_code RPC — used by checkout UI.
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization") || "";
    const token = authHeader.replace("Bearer ", "");
    if (!token) {
      return new Response(JSON.stringify({ valid: false, reason: "not_authenticated", message: "Please sign in to apply a promo code." }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json().catch(() => ({}));
    const code = (body.code || "").toString().trim();
    const planId = body.planId ?? null;
    const interval = body.interval ?? null; // 'monthly' | 'yearly' | 'trial'

    if (!code) {
      return new Response(JSON.stringify({ valid: false, reason: "empty_code", message: "Please enter a promo code." }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Run as the authenticated user so per-customer checks apply
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      { global: { headers: { Authorization: `Bearer ${token}` } }, auth: { persistSession: false } },
    );

    const { data, error } = await supabase.rpc("validate_promo_code", {
      _code: code,
      _plan_id: planId,
      _interval: interval,
    });

    if (error) {
      return new Response(JSON.stringify({ valid: false, reason: "rpc_error", message: error.message }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify(data), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return new Response(JSON.stringify({ valid: false, reason: "internal_error", message: msg }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
