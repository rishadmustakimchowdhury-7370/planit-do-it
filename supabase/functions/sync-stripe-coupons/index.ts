// Idempotent sync of public.promo_codes -> Stripe Coupons + Promotion Codes.
// Caller: super admin only. Handles single-code or full sweep.
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import { getStripeCredentials } from "../_shared/stripe-credentials.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type PromoRow = {
  id: string;
  code: string;
  discount_type: string;
  discount_value: number;
  currency: string | null;
  max_uses: number | null;
  valid_until: string | null;
  is_active: boolean;
  applicable_plans: unknown;
  per_customer_limit: number | null;
  stripe_coupon_id: string | null;
  stripe_promotion_code_id: string | null;
};

async function syncOne(stripe: Stripe, promo: PromoRow) {
  // Build coupon parameters
  const couponParams: Stripe.CouponCreateParams = {
    name: promo.code,
    duration: 'once',
    metadata: {
      promo_id: promo.id,
      per_customer_limit: String(promo.per_customer_limit ?? ''),
    },
  };
  if (promo.discount_type === 'percentage') {
    couponParams.percent_off = Number(promo.discount_value);
  } else {
    couponParams.amount_off = Math.round(Number(promo.discount_value) * 100);
    couponParams.currency = (promo.currency ?? 'USD').toLowerCase();
  }
  if (promo.max_uses) couponParams.max_redemptions = promo.max_uses;
  if (promo.valid_until) couponParams.redeem_by = Math.floor(new Date(promo.valid_until).getTime() / 1000);

  // Coupons are immutable for discount fields — recreate when missing or inactive
  let coupon: Stripe.Coupon | null = null;
  if (promo.stripe_coupon_id) {
    try { coupon = await stripe.coupons.retrieve(promo.stripe_coupon_id); } catch { coupon = null; }
  }
  if (!coupon || !coupon.valid) {
    coupon = await stripe.coupons.create(couponParams);
  }

  // Promotion code (customer-facing string)
  let promotionCode: Stripe.PromotionCode | null = null;
  if (promo.stripe_promotion_code_id) {
    try { promotionCode = await stripe.promotionCodes.retrieve(promo.stripe_promotion_code_id); } catch { promotionCode = null; }
  }
  if (!promotionCode || promotionCode.coupon.id !== coupon.id) {
    promotionCode = await stripe.promotionCodes.create({
      coupon: coupon.id,
      code: promo.code,
      active: promo.is_active,
      expires_at: promo.valid_until ? Math.floor(new Date(promo.valid_until).getTime() / 1000) : undefined,
      max_redemptions: promo.max_uses ?? undefined,
      metadata: { promo_id: promo.id },
    });
  } else if (promotionCode.active !== promo.is_active) {
    promotionCode = await stripe.promotionCodes.update(promotionCode.id, { active: promo.is_active });
  }

  return { coupon, promotionCode };
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    { auth: { persistSession: false } },
  );

  try {
    const authHeader = req.headers.get("Authorization") ?? "";
    const token = authHeader.replace("Bearer ", "");
    if (!token) return new Response(JSON.stringify({ error: "auth required" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    const { data: userData } = await supabase.auth.getUser(token);
    const user = userData.user;
    if (!user) return new Response(JSON.stringify({ error: "auth required" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    const { data: isAdmin } = await supabase.rpc("has_role", { _user_id: user.id, _role: "super_admin" });
    if (!isAdmin) return new Response(JSON.stringify({ error: "forbidden" }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const body = await req.json().catch(() => ({}));
    const promoId: string | null = body.promoId ?? null;

    const creds = await getStripeCredentials(supabase);
    if (!creds.secretKey) throw new Error("Stripe not configured.");
    const stripe = new Stripe(creds.secretKey, { apiVersion: "2025-08-27.basil" });

    let query = supabase.from("promo_codes").select("*");
    if (promoId) query = query.eq("id", promoId);
    const { data: rows, error } = await query;
    if (error) throw error;

    const results: Array<{ id: string; code: string; ok: boolean; error?: string; stripe_promotion_code_id?: string }> = [];
    for (const row of (rows ?? []) as PromoRow[]) {
      try {
        const { coupon, promotionCode } = await syncOne(stripe, row);
        await supabase.from("promo_codes").update({
          stripe_coupon_id: coupon.id,
          stripe_promotion_code_id: promotionCode.id,
          last_synced_at: new Date().toISOString(),
          sync_status: 'ok',
          sync_error: null,
        }).eq("id", row.id);
        await supabase.rpc('write_audit_log', {
          _action: 'promo_synced_to_stripe', _entity_type: 'promo_code', _entity_id: row.id,
          _new: { code: row.code, coupon_id: coupon.id, promotion_code_id: promotionCode.id },
          _tenant_id: null, _user_id: user.id,
        });
        results.push({ id: row.id, code: row.code, ok: true, stripe_promotion_code_id: promotionCode.id });
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        await supabase.from("promo_codes").update({ sync_status: 'error', sync_error: msg, last_synced_at: new Date().toISOString() }).eq("id", row.id);
        results.push({ id: row.id, code: row.code, ok: false, error: msg });
      }
    }

    return new Response(JSON.stringify({ ok: true, count: results.length, results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return new Response(JSON.stringify({ error: msg }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
