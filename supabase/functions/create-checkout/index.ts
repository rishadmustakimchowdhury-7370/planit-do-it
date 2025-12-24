import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[CREATE-CHECKOUT] ${step}${detailsStr}`);
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseClient = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    { auth: { persistSession: false } }
  );

  try {
    logStep("Function started");
    
    const { planId, promoCode, billingMonths = 1 } = await req.json();
    logStep("Request params", { planId, promoCode, billingMonths });

    if (!planId) {
      throw new Error("Missing planId");
    }
    
    // Billing duration discounts
    const durationDiscounts: Record<number, number> = { 1: 0, 3: 10, 6: 15, 12: 20 };
    const durationDiscount = durationDiscounts[billingMonths] || 0;

    // Get authenticated user
    const authHeader = req.headers.get("Authorization")!;
    const token = authHeader.replace("Bearer ", "");
    const { data } = await supabaseClient.auth.getUser(token);
    const user = data.user;
    if (!user?.email) throw new Error("User not authenticated or email not available");
    logStep("User authenticated", { userId: user.id, email: user.email });

    // Fetch plan details
    const { data: plan, error: planError } = await supabaseClient
      .from('subscription_plans')
      .select('*')
      .eq('id', planId)
      .single();

    if (planError || !plan) {
      throw new Error("Plan not found");
    }
    logStep("Plan fetched", { planName: plan.name, priceMonthly: plan.price_monthly });

    // Validate promo code if provided
    let validPromoCode = null;
    let discountAmount = 0;
    
    if (promoCode) {
      const { data: promo } = await supabaseClient
        .from('promo_codes')
        .select('*')
        .eq('code', promoCode.toUpperCase())
        .eq('is_active', true)
        .single();
      
      if (promo) {
        // Check if promo is still valid
        const now = new Date();
        const validUntil = promo.valid_until ? new Date(promo.valid_until) : null;
        const withinUsageLimit = !promo.max_uses || promo.uses_count < promo.max_uses;
        
        // Check if user has already used this promo code
        const { data: existingUsage } = await supabaseClient
          .from('promo_code_usage')
          .select('id')
          .eq('promo_code_id', promo.id)
          .eq('user_id', user.id)
          .single();
        
        if (existingUsage) {
          logStep("User already used this promo code", { code: promo.code, userId: user.id });
          // Don't apply the promo code if already used
        } else if (withinUsageLimit && (!validUntil || validUntil > now)) {
          validPromoCode = promo;
          if (promo.discount_type === 'percentage') {
            discountAmount = (plan.price_monthly * promo.discount_value) / 100;
          } else {
            discountAmount = promo.discount_value;
          }
          logStep("Promo code validated", { code: promo.code, discount: discountAmount });
        }
      }
    }

    // Get monthly price ID only
    const priceId = plan.stripe_price_id_monthly;

    if (!priceId) {
      throw new Error(`Stripe price ID not configured for ${plan.name}. Please add the stripe_price_id_monthly in the subscription_plans table.`);
    }
    logStep("Using price ID", { priceId });

    // Initialize Stripe
    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeKey) throw new Error("STRIPE_SECRET_KEY not configured");
    
    const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });
    logStep("Stripe initialized");

    // Check for existing Stripe customer
    const customers = await stripe.customers.list({ email: user.email, limit: 1 });
    let customerId;
    if (customers.data.length > 0) {
      customerId = customers.data[0].id;
      logStep("Existing customer found", { customerId });
    }

    // Get user's profile and tenant
    const { data: profile } = await supabaseClient
      .from('profiles')
      .select('tenant_id, full_name')
      .eq('id', user.id)
      .single();

    // Calculate total with discounts
    const baseAmount = plan.price_monthly * billingMonths;
    const durationDiscountAmount = baseAmount * (durationDiscount / 100);
    const promoDiscountAmount = discountAmount * billingMonths;
    const finalAmount = baseAmount - durationDiscountAmount - promoDiscountAmount;

    // Create order record (pending)
    const { data: order, error: orderError } = await supabaseClient
      .from('orders')
      .insert({
        user_id: user.id,
        tenant_id: profile?.tenant_id,
        plan_id: planId,
        amount: finalAmount,
        currency: 'gbp',
        billing_cycle: billingMonths === 1 ? 'monthly' : `${billingMonths}_months`,
        status: 'pending',
        approval_status: 'pending_approval',
        metadata: {
          plan_name: plan.name,
          user_email: user.email,
          user_name: profile?.full_name,
          promo_code: validPromoCode?.code || null,
          promo_discount: promoDiscountAmount,
          duration_discount: durationDiscountAmount,
          original_amount: baseAmount,
          billing_months: billingMonths,
        }
      })
      .select()
      .single();

    if (orderError) {
      logStep("Order creation failed", { error: orderError });
      throw new Error("Failed to create order record");
    }
    logStep("Order created", { orderId: order.id });

    // Build checkout session options
    const checkoutOptions: any = {
      customer: customerId,
      customer_email: customerId ? undefined : user.email,
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      mode: "subscription",
      success_url: `${req.headers.get("origin")}/checkout/success?session_id={CHECKOUT_SESSION_ID}&order_id=${order.id}`,
      cancel_url: `${req.headers.get("origin")}/checkout/cancel?order_id=${order.id}`,
      metadata: {
        order_id: order.id,
        plan_id: planId,
        user_id: user.id,
        tenant_id: profile?.tenant_id || '',
        promo_code: validPromoCode?.code || '',
      },
      subscription_data: {
        metadata: {
          order_id: order.id,
          plan_id: planId,
          user_id: user.id,
        }
      },
    };

    // Apply Stripe coupon if promo code discount exists
    // Note: You need to create corresponding Stripe coupons for each promo code
    // For now, we store the discount in metadata for manual processing
    
    // Create checkout session
    const session = await stripe.checkout.sessions.create(checkoutOptions);

    logStep("Checkout session created", { sessionId: session.id, url: session.url });

    // Update order with checkout session ID
    await supabaseClient
      .from('orders')
      .update({ stripe_checkout_session_id: session.id })
      .eq('id', order.id);

    return new Response(JSON.stringify({ url: session.url, orderId: order.id }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logStep("ERROR", { message: errorMessage });
    return new Response(JSON.stringify({ error: errorMessage }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
