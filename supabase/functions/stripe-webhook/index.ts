import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import { Resend } from "https://esm.sh/resend@2.0.0";
import { getStripeCredentials } from "../_shared/stripe-credentials.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, stripe-signature",
};

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[STRIPE-WEBHOOK] ${step}${detailsStr}`);
};

type ResendSendResult = { data: any; error: any };

async function sendResendEmailWithRetry(
  resend: Resend,
  payload: Parameters<Resend["emails"]["send"]>[0],
  maxAttempts = 5
): Promise<ResendSendResult> {
  let lastResult: ResendSendResult = { data: null, error: null };
  let delayMs = 700;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const result = (await resend.emails.send(payload)) as ResendSendResult;
    lastResult = result;

    const err = result?.error;
    if (!err) return result;

    const statusCode = err?.statusCode;
    const name = err?.name;
    const isRateLimit = statusCode === 429 || name === "rate_limit_exceeded";

    if (!isRateLimit || attempt === maxAttempts) return result;

    logStep("Resend rate-limited, retrying", { attempt, delayMs, statusCode, name });
    await new Promise((r) => setTimeout(r, delayMs));
    delayMs = Math.min(delayMs * 2, 5000);
  }

  return lastResult;
}

// Professional email template with CRM branding and downloadable invoice
function generateSubscriptionEmailHTML(
  type: 'confirmation' | 'upgrade' | 'renewal',
  data: {
    userName: string;
    planName: string;
    amount: number;
    currency: string;
    nextBillingDate?: string;
    invoiceUrl?: string;
    invoicePdfUrl?: string;
    companyLogo?: string;
  }
): string {
  const logoHTML = data.companyLogo 
    ? `<img src="${data.companyLogo}" alt="Company Logo" style="max-height: 50px; max-width: 200px; object-fit: contain;" />`
    : `<div style="display: inline-flex; align-items: center; gap: 10px;">
        <div style="background: linear-gradient(135deg, #00008B 0%, #0000CD 100%); border-radius: 10px; padding: 10px; display: flex; align-items: center; justify-content: center;">
          <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M3 3v18h18"/>
            <path d="m19 9-5 5-4-4-3 3"/>
          </svg>
        </div>
        <span style="font-family: 'Segoe UI', Arial, sans-serif; font-weight: 700; font-size: 22px;">
          <span style="color: #00008B;">HireMetrics</span><span style="color: #64748b; font-weight: 500;"> CRM</span>
        </span>
      </div>`;

  const titleMap = {
    confirmation: '🎉 Payment Confirmed!',
    upgrade: '🚀 Plan Upgraded Successfully!',
    renewal: '✅ Subscription Renewed!'
  };

  const messageMap = {
    confirmation: 'Thank you for your payment! Your subscription has been activated.',
    upgrade: 'Congratulations! Your plan has been upgraded successfully.',
    renewal: 'Your subscription has been renewed successfully.'
  };

  const formattedAmount = new Intl.NumberFormat('en-GB', {
    style: 'currency',
    currency: data.currency.toUpperCase()
  }).format(data.amount / 100);

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${titleMap[type]}</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f1f5f9;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color: #f1f5f9;">
    <tr>
      <td align="center" style="padding: 40px 20px;">
        <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width: 600px; background-color: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 24px rgba(0, 0, 0, 0.08);">
          
          <!-- Logo Header -->
          <tr>
            <td style="padding: 30px 40px; background: linear-gradient(180deg, #ffffff 0%, #f8fafc 100%); border-bottom: 1px solid #e2e8f0;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center">
                    ${logoHTML}
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Success Banner -->
          <tr>
            <td style="background: linear-gradient(135deg, #059669 0%, #10b981 100%); padding: 35px 40px; text-align: center;">
              <h1 style="margin: 0; color: #ffffff; font-size: 28px; font-weight: 700; letter-spacing: -0.5px;">
                ${titleMap[type]}
              </h1>
            </td>
          </tr>
          
          <!-- Main Content -->
          <tr>
            <td style="padding: 40px;">
              <p style="margin: 0 0 20px; color: #1e293b; font-size: 18px; font-weight: 600;">
                Hello ${data.userName}! 👋
              </p>
              <p style="margin: 0 0 30px; color: #475569; font-size: 16px; line-height: 1.7;">
                ${messageMap[type]}
              </p>
              
              <!-- Payment Details Card -->
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background: linear-gradient(145deg, #f8fafc 0%, #f1f5f9 100%); border-radius: 16px; border: 1px solid #e2e8f0; margin-bottom: 30px;">
                <tr>
                  <td style="padding: 24px;">
                    <h2 style="margin: 0 0 20px; color: #0f172a; font-size: 18px; font-weight: 600;">
                      📋 Payment Details
                    </h2>
                    <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                      <tr>
                        <td style="padding: 12px 0; border-bottom: 1px solid #e2e8f0;">
                          <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                            <tr>
                              <td style="color: #64748b; font-size: 14px;">Plan</td>
                              <td align="right" style="color: #1e293b; font-size: 14px; font-weight: 600;">${data.planName}</td>
                            </tr>
                          </table>
                        </td>
                      </tr>
                      <tr>
                        <td style="padding: 12px 0; border-bottom: 1px solid #e2e8f0;">
                          <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                            <tr>
                              <td style="color: #64748b; font-size: 14px;">Amount Paid</td>
                              <td align="right" style="color: #059669; font-size: 16px; font-weight: 700;">${formattedAmount}</td>
                            </tr>
                          </table>
                        </td>
                      </tr>
                      ${data.nextBillingDate ? `
                      <tr>
                        <td style="padding: 12px 0;">
                          <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                            <tr>
                              <td style="color: #64748b; font-size: 14px;">Next Billing Date</td>
                              <td align="right" style="color: #1e293b; font-size: 14px; font-weight: 600;">${data.nextBillingDate}</td>
                            </tr>
                          </table>
                        </td>
                      </tr>
                      ` : ''}
                    </table>
                  </td>
                </tr>
              </table>

              <!-- Invoice Buttons -->
              ${data.invoiceUrl || data.invoicePdfUrl ? `
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-bottom: 30px;">
                <tr>
                  <td align="center">
                    <table role="presentation" cellpadding="0" cellspacing="0">
                      <tr>
                        ${data.invoiceUrl ? `
                        <td style="padding-right: 12px;">
                          <a href="${data.invoiceUrl}" style="display: inline-block; background: linear-gradient(135deg, #00008B 0%, #0000CD 100%); color: #ffffff; text-decoration: none; padding: 14px 24px; border-radius: 8px; font-weight: 600; font-size: 14px;">
                            📄 View Invoice
                          </a>
                        </td>
                        ` : ''}
                        ${data.invoicePdfUrl ? `
                        <td>
                          <a href="${data.invoicePdfUrl}" style="display: inline-block; background: #1e293b; color: #ffffff; text-decoration: none; padding: 14px 24px; border-radius: 8px; font-weight: 600; font-size: 14px;">
                            ⬇️ Download PDF
                          </a>
                        </td>
                        ` : ''}
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
              ` : ''}

              <!-- Features Reminder -->
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color: #eff6ff; border-radius: 12px; border: 1px solid #bfdbfe; margin-bottom: 25px;">
                <tr>
                  <td style="padding: 20px;">
                    <p style="margin: 0 0 12px; color: #1e40af; font-size: 14px; font-weight: 600;">🎯 Your plan includes:</p>
                    <ul style="margin: 0; padding-left: 20px; color: #3b82f6; font-size: 14px; line-height: 1.8;">
                      <li>AI-powered candidate matching</li>
                      <li>Unlimited email communications</li>
                      <li>Advanced analytics & reporting</li>
                      <li>Team collaboration tools</li>
                    </ul>
                  </td>
                </tr>
              </table>
              
              <!-- Signature -->
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-top: 1px solid #e2e8f0; padding-top: 25px;">
                <tr>
                  <td>
                    <p style="margin: 0 0 5px; color: #475569; font-size: 15px; line-height: 1.6;">
                      Thank you for choosing HireMetrics CRM!
                    </p>
                    <p style="margin: 15px 0 0; color: #1e293b; font-size: 15px;">
                      Best regards,<br>
                      <strong style="color: #00008B;">The HireMetrics CRM Team</strong>
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          
          <!-- Footer -->
          <tr>
            <td style="background: linear-gradient(180deg, #f8fafc 0%, #f1f5f9 100%); padding: 24px 40px; border-top: 1px solid #e2e8f0;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center">
                    <p style="margin: 0 0 8px; color: #64748b; font-size: 13px;">
                      Powered by <strong style="color: #00008B;">HireMetrics CRM</strong>
                    </p>
                    <p style="margin: 0; color: #94a3b8; font-size: 11px;">
                      © ${new Date().getFullYear()} HireMetrics CRM. All rights reserved.
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `;
}

// Enhanced admin notification email template with full details
function generateAdminNotificationHTML(
  data: {
    userName: string;
    userEmail: string;
    planName: string;
    amount: number;
    currency: string;
    orderId: string;
    isNewUser?: boolean;
    tenantName?: string;
    registrationDate?: string;
    phone?: string;
  }
): string {
  const formattedAmount = new Intl.NumberFormat('en-GB', {
    style: 'currency',
    currency: data.currency.toUpperCase()
  }).format(data.amount / 100);

  const eventType = data.isNewUser ? '🎉 New User Registration & Upgrade' : '💰 New Subscription Payment';

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>${eventType}</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif; background-color: #f1f5f9;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f1f5f9; padding: 40px 20px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="max-width: 600px; background-color: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 24px rgba(0, 0, 0, 0.08);">
          
          <!-- Header -->
          <tr>
            <td style="background: linear-gradient(135deg, #7c3aed 0%, #8b5cf6 100%); padding: 30px; text-align: center;">
              <h1 style="margin: 0; color: #ffffff; font-size: 24px;">${eventType}</h1>
              <p style="margin: 10px 0 0; color: rgba(255,255,255,0.9); font-size: 14px;">
                ${new Date().toLocaleString('en-GB', { dateStyle: 'full', timeStyle: 'short' })}
              </p>
            </td>
          </tr>
          
          <!-- Content -->
          <tr>
            <td style="padding: 30px;">
              <p style="margin: 0 0 20px; color: #374151; font-size: 16px;">
                ${data.isNewUser ? 'A new user has registered and upgraded their package:' : 'A new subscription payment has been received:'}
              </p>
              
              <!-- Customer Info Card -->
              <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f8fafc; border-radius: 12px; border: 1px solid #e2e8f0; margin-bottom: 20px;">
                <tr>
                  <td style="padding: 20px;">
                    <h3 style="margin: 0 0 15px; color: #1e293b; font-size: 16px; font-weight: 600;">👤 Customer Details</h3>
                    <table width="100%" cellpadding="0" cellspacing="0">
                      <tr>
                        <td style="padding: 8px 0; color: #64748b; font-size: 14px; width: 140px;">Name</td>
                        <td style="padding: 8px 0; color: #1e293b; font-size: 14px; font-weight: 600;">${data.userName}</td>
                      </tr>
                      <tr>
                        <td style="padding: 8px 0; color: #64748b; font-size: 14px;">Email</td>
                        <td style="padding: 8px 0; color: #1e293b; font-size: 14px;">
                          <a href="mailto:${data.userEmail}" style="color: #00008B; text-decoration: none;">${data.userEmail}</a>
                        </td>
                      </tr>
                      ${data.phone ? `
                      <tr>
                        <td style="padding: 8px 0; color: #64748b; font-size: 14px;">Phone</td>
                        <td style="padding: 8px 0; color: #1e293b; font-size: 14px;">${data.phone}</td>
                      </tr>
                      ` : ''}
                      ${data.tenantName ? `
                      <tr>
                        <td style="padding: 8px 0; color: #64748b; font-size: 14px;">Company</td>
                        <td style="padding: 8px 0; color: #1e293b; font-size: 14px; font-weight: 600;">${data.tenantName}</td>
                      </tr>
                      ` : ''}
                      ${data.registrationDate ? `
                      <tr>
                        <td style="padding: 8px 0; color: #64748b; font-size: 14px;">Registered</td>
                        <td style="padding: 8px 0; color: #1e293b; font-size: 14px;">${data.registrationDate}</td>
                      </tr>
                      ` : ''}
                    </table>
                  </td>
                </tr>
              </table>

              <!-- Payment Info Card -->
              <table width="100%" cellpadding="0" cellspacing="0" style="background: linear-gradient(145deg, #ecfdf5 0%, #d1fae5 100%); border-radius: 12px; border: 1px solid #a7f3d0;">
                <tr>
                  <td style="padding: 20px;">
                    <h3 style="margin: 0 0 15px; color: #065f46; font-size: 16px; font-weight: 600;">💳 Payment Details</h3>
                    <table width="100%" cellpadding="0" cellspacing="0">
                      <tr>
                        <td style="padding: 8px 0; color: #065f46; font-size: 14px; width: 140px;">Plan</td>
                        <td style="padding: 8px 0; color: #065f46; font-size: 14px; font-weight: 600;">${data.planName}</td>
                      </tr>
                      <tr>
                        <td style="padding: 8px 0; color: #065f46; font-size: 14px;">Amount</td>
                        <td style="padding: 8px 0; color: #059669; font-size: 20px; font-weight: 700;">${formattedAmount}</td>
                      </tr>
                      <tr>
                        <td style="padding: 8px 0; color: #065f46; font-size: 14px;">Order ID</td>
                        <td style="padding: 8px 0; color: #065f46; font-size: 12px; font-family: monospace; background: rgba(0,0,0,0.05); padding: 4px 8px; border-radius: 4px;">${data.orderId}</td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
              
              <p style="margin: 25px 0 0; color: #64748b; font-size: 14px;">
                ✅ Payment verified and processed automatically. <br>
                🔗 <a href="https://hiremetrics.co.uk/admin/orders" style="color: #00008B;">View in Admin Panel</a>
              </p>
            </td>
          </tr>
          
          <!-- Footer -->
          <tr>
            <td style="background-color: #f8fafc; padding: 20px; text-align: center; border-top: 1px solid #e2e8f0;">
              <p style="margin: 0; color: #94a3b8; font-size: 12px;">
                HireMetrics CRM Admin Notification
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    { auth: { persistSession: false } }
  );

  // Get dynamic Stripe credentials
  const stripeCredentials = await getStripeCredentials(supabase);
  if (!stripeCredentials.secretKey) {
    return new Response(JSON.stringify({ error: "Stripe not configured" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const stripe = new Stripe(stripeCredentials.secretKey, {
    apiVersion: "2025-08-27.basil",
  });

  const resendApiKey = Deno.env.get("RESEND_API_KEY");

  try {
    const signature = req.headers.get("stripe-signature");
    const body = await req.text();
    const webhookSecret = stripeCredentials.webhookSecret;

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
            
            // Record promo code usage if applicable
            if (session.payment_status === 'paid' && session.metadata?.promo_code) {
              const promoCode = session.metadata.promo_code;
              const userId = session.metadata.user_id;
              const tenantId = session.metadata.tenant_id;
              
              // Get promo code ID
              const { data: promoData } = await supabase
                .from('promo_codes')
                .select('id')
                .eq('code', promoCode)
                .single();
              
              if (promoData && userId && tenantId) {
                // Record usage
                await supabase
                  .from('promo_code_usage')
                  .insert({
                    promo_code_id: promoData.id,
                    user_id: userId,
                    tenant_id: tenantId,
                    order_id: orderId,
                  });
                
                // Increment uses_count using rpc function
                await supabase.rpc('increment_promo_uses', { promo_id: promoData.id });
                
                logStep("Promo code usage recorded", { promoCode, userId });
              }
            }
          }

          // Send confirmation emails if payment succeeded
          if (session.payment_status === 'paid' && resendApiKey) {
            try {
              // Fetch order details with user and plan info
              const { data: order } = await supabase
                .from('orders')
                .select(`
                  *,
                  subscription_plans(name),
                  profiles:user_id(full_name, email, phone, created_at)
                `)
                .eq('id', orderId)
                .single();

              if (order) {
                const resend = new Resend(resendApiKey);
                const userName = order.profiles?.full_name || 'Valued Customer';
                const userEmail = order.profiles?.email;
                const planName = order.subscription_plans?.name || 'Subscription';
                
                // Get invoice URLs if available (both hosted and PDF for download)
                let invoiceUrl = null;
                let invoicePdfUrl = null;
                if (session.invoice) {
                  const invoice = await stripe.invoices.retrieve(session.invoice as string);
                  invoiceUrl = invoice.hosted_invoice_url;
                  invoicePdfUrl = invoice.invoice_pdf;
                }

                // Get next billing date for subscriptions
                let nextBillingDate = null;
                if (session.subscription) {
                  const subscription = await stripe.subscriptions.retrieve(session.subscription as string);
                  nextBillingDate = new Date(subscription.current_period_end * 1000).toLocaleDateString('en-GB', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric'
                  });
                }

                // Fetch tenant info
                const { data: tenant } = await supabase
                  .from('tenants')
                  .select('logo_url, name')
                  .eq('id', order.tenant_id)
                  .single();

                // Check if this is a new user (registered within the last hour)
                const userCreatedAt = order.profiles?.created_at ? new Date(order.profiles.created_at) : null;
                const isNewUser = userCreatedAt && (Date.now() - userCreatedAt.getTime()) < 3600000; // 1 hour

                // Send confirmation email to user with downloadable invoice
                if (userEmail) {
                  const userEmailHtml = generateSubscriptionEmailHTML('confirmation', {
                    userName,
                    planName,
                    amount: order.amount * 100, // Convert to cents
                    currency: order.currency,
                    nextBillingDate: nextBillingDate || undefined,
                    invoiceUrl: invoiceUrl || undefined,
                    invoicePdfUrl: invoicePdfUrl || undefined,
                    companyLogo: tenant?.logo_url
                  });

                  const userSendResult = await sendResendEmailWithRetry(resend, {
                    from: 'HireMetrics <admin@hiremetrics.co.uk>',
                    to: [userEmail],
                    subject: `🎉 Payment Confirmed - ${planName} Plan`,
                    html: userEmailHtml,
                  });

                  if (userSendResult.error) {
                    throw new Error(userSendResult.error?.message ?? 'Resend payment confirmation failed');
                  }

                  logStep("Confirmation email sent to user with invoice", { email: userEmail, hasInvoicePdf: !!invoicePdfUrl, emailId: userSendResult.data?.id });

                  // avoid rate limit when sending admin email right after user email
                  await new Promise((r) => setTimeout(r, 700));
                }

                // Send notification to super admins with full details
                const { data: superAdmins } = await supabase
                  .from('user_roles')
                  .select('user_id')
                  .eq('role', 'super_admin');

                if (superAdmins && superAdmins.length > 0) {
                  const adminUserIds = superAdmins.map(sa => sa.user_id);
                  const { data: adminProfiles } = await supabase
                    .from('profiles')
                    .select('email')
                    .in('id', adminUserIds);

                  const adminEmails = adminProfiles?.map(p => p.email).filter(Boolean) || [];
                  
                  if (adminEmails.length > 0) {
                    const adminEmailHtml = generateAdminNotificationHTML({
                      userName,
                      userEmail: userEmail || 'N/A',
                      planName,
                      amount: order.amount * 100,
                      currency: order.currency,
                      orderId,
                      isNewUser: isNewUser || false,
                      tenantName: tenant?.name,
                      registrationDate: userCreatedAt ? userCreatedAt.toLocaleDateString('en-GB', {
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit'
                      }) : undefined,
                      phone: order.profiles?.phone
                    });

                    const emailSubject = isNewUser 
                      ? `🎉 New User Upgrade - ${planName} (${userName})`
                      : `💰 New Payment Received - ${planName} (${userName})`;

                    const adminSendResult = await sendResendEmailWithRetry(resend, {
                      from: 'HireMetrics <admin@hiremetrics.co.uk>',
                      to: adminEmails,
                      subject: emailSubject,
                      html: adminEmailHtml,
                    });

                    if (adminSendResult.error) {
                      throw new Error(adminSendResult.error?.message ?? 'Resend admin payment notification failed');
                    }

                    logStep("Admin notification email sent", { adminEmails, isNewUser, emailId: adminSendResult.data?.id });
                  }
                }
              }
            } catch (emailError) {
              logStep("Failed to send confirmation emails", { error: emailError });
            }
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
          const { data: order } = await supabase
            .from('orders')
            .update({
              stripe_invoice_id: invoice.id,
              status: 'completed',
              updated_at: new Date().toISOString(),
            })
            .eq('stripe_subscription_id', invoice.subscription as string)
            .select(`
              *,
              subscription_plans(name),
              profiles:user_id(full_name, email)
            `)
            .single();

          // Send renewal confirmation email
          if (order && resendApiKey) {
            try {
              const resend = new Resend(resendApiKey);
              const userName = order.profiles?.full_name || 'Valued Customer';
              const userEmail = order.profiles?.email;
              const planName = order.subscription_plans?.name || 'Subscription';

              // Get tenant logo
              const { data: tenant } = await supabase
                .from('tenants')
                .select('logo_url')
                .eq('id', order.tenant_id)
                .single();

              // Get next billing date
              const subscription = await stripe.subscriptions.retrieve(invoice.subscription as string);
              const nextBillingDate = new Date(subscription.current_period_end * 1000).toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'long',
                day: 'numeric'
              });

              // Update tenant subscription end date
              await supabase
                .from('tenants')
                .update({
                  subscription_ends_at: new Date(subscription.current_period_end * 1000).toISOString(),
                  subscription_status: 'active',
                  is_paused: false,
                  updated_at: new Date().toISOString()
                })
                .eq('id', order.tenant_id);

              if (userEmail) {
                const renewalEmailHtml = generateSubscriptionEmailHTML('renewal', {
                  userName,
                  planName,
                  amount: invoice.amount_paid,
                  currency: invoice.currency,
                  nextBillingDate,
                  invoiceUrl: invoice.hosted_invoice_url || undefined,
                  companyLogo: tenant?.logo_url
                });

                const renewalSendResult = await sendResendEmailWithRetry(resend, {
                  from: 'HireMetrics <admin@hiremetrics.co.uk>',
                  to: [userEmail],
                  subject: `✅ Subscription Renewed - ${planName}`,
                  html: renewalEmailHtml,
                });

                if (renewalSendResult.error) {
                  throw new Error(renewalSendResult.error?.message ?? 'Resend renewal email failed');
                }

                logStep("Renewal confirmation email sent", { email: userEmail, emailId: renewalSendResult.data?.id });
              }
            } catch (emailError) {
              logStep("Failed to send renewal email", { error: emailError });
            }
          }
        }
        break;
      }

      case "customer.subscription.deleted": {
        const subscription = event.data.object as Stripe.Subscription;
        logStep("Subscription cancelled", { subscriptionId: subscription.id });

        // Mark related orders/tenant subscription as cancelled
        const { data: order } = await supabase
          .from('orders')
          .select('tenant_id, user_id')
          .eq('stripe_subscription_id', subscription.id)
          .single();

        if (order?.tenant_id) {
          // Set grace period - 3 months from now
          const graceUntil = new Date();
          graceUntil.setMonth(graceUntil.getMonth() + 3);

          await supabase
            .from('tenants')
            .update({
              subscription_status: 'cancelled',
              grace_until: graceUntil.toISOString(),
              updated_at: new Date().toISOString(),
            })
            .eq('id', order.tenant_id);
          
          logStep("Tenant set to grace period", { tenantId: order.tenant_id, graceUntil });
        }
        break;
      }

      case "customer.subscription.updated": {
        const subscription = event.data.object as Stripe.Subscription;
        logStep("Subscription updated", { subscriptionId: subscription.id, status: subscription.status });

        // Update tenant subscription status based on Stripe status
        const { data: order } = await supabase
          .from('orders')
          .select('tenant_id')
          .eq('stripe_subscription_id', subscription.id)
          .single();

        if (order?.tenant_id) {
          const statusMap: Record<string, string> = {
            'active': 'active',
            'past_due': 'past_due',
            'canceled': 'cancelled',
            'unpaid': 'past_due',
            'incomplete': 'pending',
            'incomplete_expired': 'expired',
            'trialing': 'trial'
          };

          await supabase
            .from('tenants')
            .update({
              subscription_status: statusMap[subscription.status] || subscription.status,
              subscription_ends_at: new Date(subscription.current_period_end * 1000).toISOString(),
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
