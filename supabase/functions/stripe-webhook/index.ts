import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, stripe-signature",
};

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[STRIPE-WEBHOOK] ${step}${detailsStr}`);
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", {
    apiVersion: "2025-08-27.basil",
  });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    { auth: { persistSession: false } }
  );

  try {
    const signature = req.headers.get("stripe-signature");
    const body = await req.text();
    const webhookSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET");

    let event: Stripe.Event;

    // Verify webhook signature if secret is configured
    if (webhookSecret && signature) {
      try {
        event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
        logStep("Webhook signature verified");
      } catch (err) {
        logStep("Webhook signature verification failed", { error: err });
        return new Response(JSON.stringify({ error: "Webhook signature verification failed" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    } else {
      event = JSON.parse(body);
      logStep("Webhook received (no signature verification)", { type: event.type });
    }

    logStep("Processing event", { type: event.type, id: event.id });

    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        logStep("Checkout session completed", { 
          sessionId: session.id,
          customerId: session.customer,
          paymentStatus: session.payment_status
        });

        const orderId = session.metadata?.order_id;
        if (orderId) {
          // Update order with Stripe IDs
          const updateData: any = {
            stripe_customer_id: session.customer as string,
            stripe_checkout_session_id: session.id,
            status: session.payment_status === 'paid' ? 'completed' : 'pending',
            updated_at: new Date().toISOString(),
          };

          if (session.subscription) {
            updateData.stripe_subscription_id = session.subscription as string;
          }

          if (session.payment_intent) {
            updateData.stripe_payment_intent_id = session.payment_intent as string;
          }

          const { error } = await supabase
            .from('orders')
            .update(updateData)
            .eq('id', orderId);

          if (error) {
            logStep("Failed to update order", { error, orderId });
          } else {
            logStep("Order updated successfully", { orderId, status: updateData.status });
          }
        }
        break;
      }

      case "payment_intent.succeeded": {
        const paymentIntent = event.data.object as Stripe.PaymentIntent;
        logStep("Payment intent succeeded", { 
          paymentIntentId: paymentIntent.id,
          amount: paymentIntent.amount
        });

        const orderId = paymentIntent.metadata?.order_id;
        if (orderId) {
          await supabase
            .from('orders')
            .update({
              stripe_payment_intent_id: paymentIntent.id,
              status: 'completed',
              payment_method: paymentIntent.payment_method_types?.[0] || 'card',
              updated_at: new Date().toISOString(),
            })
            .eq('id', orderId);
          logStep("Order marked completed", { orderId });
        }
        break;
      }

      case "payment_intent.payment_failed": {
        const paymentIntent = event.data.object as Stripe.PaymentIntent;
        logStep("Payment failed", { paymentIntentId: paymentIntent.id });

        const orderId = paymentIntent.metadata?.order_id;
        if (orderId) {
          await supabase
            .from('orders')
            .update({
              status: 'failed',
              metadata: { failure_message: paymentIntent.last_payment_error?.message },
              updated_at: new Date().toISOString(),
            })
            .eq('id', orderId);
        }
        break;
      }

      case "invoice.paid": {
        const invoice = event.data.object as Stripe.Invoice;
        logStep("Invoice paid", { invoiceId: invoice.id, subscriptionId: invoice.subscription });

        if (invoice.subscription) {
          // Find order by subscription ID and update
          await supabase
            .from('orders')
            .update({
              stripe_invoice_id: invoice.id,
              status: 'completed',
              updated_at: new Date().toISOString(),
            })
            .eq('stripe_subscription_id', invoice.subscription as string);
        }
        break;
      }

      case "customer.subscription.deleted": {
        const subscription = event.data.object as Stripe.Subscription;
        logStep("Subscription cancelled", { subscriptionId: subscription.id });

        // Mark related orders/tenant subscription as cancelled
        const { data: order } = await supabase
          .from('orders')
          .select('tenant_id')
          .eq('stripe_subscription_id', subscription.id)
          .single();

        if (order?.tenant_id) {
          await supabase
            .from('tenants')
            .update({
              subscription_status: 'cancelled',
              updated_at: new Date().toISOString(),
            })
            .eq('id', order.tenant_id);
        }
        break;
      }

      default:
        logStep("Unhandled event type", { type: event.type });
    }

    return new Response(JSON.stringify({ received: true }), {
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
