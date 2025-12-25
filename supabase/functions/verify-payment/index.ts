import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import { Resend } from "https://esm.sh/resend@2.0.0";
import { getStripeCredentials } from "../_shared/stripe-credentials.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[VERIFY-PAYMENT] ${step}${detailsStr}`);
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

// Generate professional invoice HTML for email
function generateInvoiceEmailHTML(data: {
  invoiceNumber: string;
  userName: string;
  planName: string;
  amount: number;
  currency: string;
  issueDate: string;
  nextBillingDate?: string;
  invoiceHtml: string;
  companyLogo?: string;
}): string {
  const formattedAmount = new Intl.NumberFormat('en-GB', {
    style: 'currency',
    currency: data.currency.toUpperCase()
  }).format(data.amount);

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

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Your Invoice - ${data.invoiceNumber}</title>
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
                🎉 Payment Confirmed!
              </h1>
              <p style="margin: 10px 0 0; color: rgba(255,255,255,0.9); font-size: 16px;">
                Your invoice is attached below
              </p>
            </td>
          </tr>
          
          <!-- Main Content -->
          <tr>
            <td style="padding: 40px;">
              <p style="margin: 0 0 20px; color: #1e293b; font-size: 18px; font-weight: 600;">
                Hello ${data.userName}! 👋
              </p>
              <p style="margin: 0 0 30px; color: #475569; font-size: 16px; line-height: 1.7;">
                Thank you for your payment! Your subscription has been activated successfully. Below are your payment details and downloadable invoice.
              </p>
              
              <!-- Payment Summary Card -->
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background: linear-gradient(145deg, #f8fafc 0%, #f1f5f9 100%); border-radius: 16px; border: 1px solid #e2e8f0; margin-bottom: 30px;">
                <tr>
                  <td style="padding: 24px;">
                    <h2 style="margin: 0 0 20px; color: #0f172a; font-size: 18px; font-weight: 600;">
                      📋 Payment Summary
                    </h2>
                    <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                      <tr>
                        <td style="padding: 12px 0; border-bottom: 1px solid #e2e8f0;">
                          <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                            <tr>
                              <td style="color: #64748b; font-size: 14px;">Invoice Number</td>
                              <td align="right" style="color: #1e293b; font-size: 14px; font-weight: 600;">${data.invoiceNumber}</td>
                            </tr>
                          </table>
                        </td>
                      </tr>
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
                              <td align="right" style="color: #059669; font-size: 18px; font-weight: 700;">${formattedAmount}</td>
                            </tr>
                          </table>
                        </td>
                      </tr>
                      <tr>
                        <td style="padding: 12px 0; border-bottom: 1px solid #e2e8f0;">
                          <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                            <tr>
                              <td style="color: #64748b; font-size: 14px;">Issue Date</td>
                              <td align="right" style="color: #1e293b; font-size: 14px; font-weight: 600;">${data.issueDate}</td>
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

              <!-- Invoice Download Notice -->
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color: #eff6ff; border-radius: 12px; border: 1px solid #bfdbfe; margin-bottom: 25px;">
                <tr>
                  <td style="padding: 20px;">
                    <p style="margin: 0 0 12px; color: #1e40af; font-size: 14px; font-weight: 600;">📄 Invoice Attached</p>
                    <p style="margin: 0; color: #3b82f6; font-size: 14px; line-height: 1.6;">
                      Your downloadable invoice is attached to this email as an HTML file. Open it in your browser and use Print → Save as PDF to download.
                    </p>
                  </td>
                </tr>
              </table>

              <!-- Features Reminder -->
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color: #f0fdf4; border-radius: 12px; border: 1px solid #bbf7d0; margin-bottom: 25px;">
                <tr>
                  <td style="padding: 20px;">
                    <p style="margin: 0 0 12px; color: #166534; font-size: 14px; font-weight: 600;">🎯 Your ${data.planName} plan includes:</p>
                    <ul style="margin: 0; padding-left: 20px; color: #22c55e; font-size: 14px; line-height: 1.8;">
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

// Generate standalone invoice HTML for attachment
function generateInvoiceAttachmentHTML(data: {
  invoiceNumber: string;
  userName: string;
  userEmail: string;
  companyName: string;
  planName: string;
  amount: number;
  currency: string;
  issueDate: string;
  companyLogo?: string;
}): string {
  const formattedAmount = new Intl.NumberFormat('en-GB', {
    style: 'currency',
    currency: data.currency.toUpperCase()
  }).format(data.amount);

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Invoice ${data.invoiceNumber}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif; background: #fff; color: #1f2937; }
    .invoice-container { max-width: 800px; margin: 0 auto; padding: 40px; }
    .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 40px; padding-bottom: 30px; border-bottom: 2px solid #e5e7eb; }
    .company-info { color: #6b7280; font-size: 14px; margin-top: 12px; }
    .invoice-title { text-align: right; }
    .invoice-title h1 { font-size: 36px; color: #00008B; font-weight: 700; }
    .invoice-meta { margin-top: 10px; color: #6b7280; font-size: 14px; }
    .invoice-meta p { margin: 4px 0; }
    .parties { display: grid; grid-template-columns: 1fr 1fr; gap: 40px; margin-bottom: 40px; }
    .party-box { background: #f9fafb; border-radius: 12px; padding: 20px; }
    .party-label { font-size: 11px; font-weight: 700; color: #9ca3af; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 12px; }
    .party-name { font-size: 18px; font-weight: 700; color: #111827; margin-bottom: 8px; }
    .party-details { font-size: 14px; color: #6b7280; line-height: 1.6; }
    .items-table { width: 100%; border-collapse: collapse; margin-bottom: 30px; border-radius: 12px; overflow: hidden; }
    .items-table thead { background: #1f2937; color: white; }
    .items-table th { padding: 16px 20px; text-align: left; font-weight: 600; font-size: 14px; }
    .items-table th:last-child { text-align: right; }
    .items-table td { padding: 16px 20px; border-bottom: 1px solid #f3f4f6; font-size: 14px; }
    .items-table td:last-child { text-align: right; font-weight: 600; }
    .totals { display: flex; justify-content: flex-end; margin-bottom: 40px; }
    .totals-box { width: 300px; background: #f9fafb; border-radius: 12px; padding: 20px; }
    .total-row { display: flex; justify-content: space-between; padding: 10px 0; font-size: 14px; }
    .total-row.grand { border-top: 2px solid #e5e7eb; padding-top: 15px; margin-top: 10px; }
    .total-row.grand .label { font-size: 18px; font-weight: 700; color: #111827; }
    .total-row.grand .value { font-size: 24px; font-weight: 700; color: #00008B; }
    .footer { text-align: center; padding-top: 30px; border-top: 1px solid #e5e7eb; color: #9ca3af; font-size: 12px; }
    .payment-note { background: #f0fdf4; border-radius: 12px; padding: 20px; margin-bottom: 30px; border: 1px solid #bbf7d0; }
    .payment-note h3 { font-size: 14px; color: #166534; margin-bottom: 8px; }
    .payment-note p { font-size: 13px; color: #22c55e; }
    .print-btn { position: fixed; top: 20px; right: 20px; background: #00008B; color: white; border: none; padding: 12px 24px; border-radius: 8px; font-size: 14px; cursor: pointer; font-weight: 600; }
    .print-btn:hover { background: #0000CD; }
    @media print { 
      body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      .invoice-container { padding: 20px; }
      .print-btn { display: none; }
    }
  </style>
</head>
<body>
  <button class="print-btn" onclick="window.print()">🖨️ Print / Save as PDF</button>
  <div class="invoice-container">
    <div class="header">
      <div>
        <div style="display: flex; align-items: center; gap: 10px;">
          <div style="background: linear-gradient(135deg, #00008B 0%, #0000CD 100%); border-radius: 10px; padding: 10px;">
            <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M3 3v18h18"/>
              <path d="m19 9-5 5-4-4-3 3"/>
            </svg>
          </div>
          <span style="font-size: 24px; font-weight: 700;">
            <span style="color: #00008B;">HireMetrics</span><span style="color: #64748b;"> CRM</span>
          </span>
        </div>
        <div class="company-info">
          <p>United Kingdom</p>
          <p>Email: admin@hiremetrics.co.uk</p>
          <p>Website: www.hiremetrics.co.uk</p>
        </div>
      </div>
      <div class="invoice-title">
        <h1>INVOICE</h1>
        <div class="invoice-meta">
          <p><strong>${data.invoiceNumber}</strong></p>
          <p>Issue Date: ${data.issueDate}</p>
          <p style="color: #059669; font-weight: 600; margin-top: 8px;">✓ PAID</p>
        </div>
      </div>
    </div>

    <div class="parties">
      <div class="party-box">
        <div class="party-label">From</div>
        <div class="party-name">HireMetrics CRM</div>
        <div class="party-details">
          United Kingdom<br>
          admin@hiremetrics.co.uk
        </div>
      </div>
      <div class="party-box">
        <div class="party-label">Bill To</div>
        <div class="party-name">${data.companyName}</div>
        <div class="party-details">
          ${data.userName}<br>
          ${data.userEmail}
        </div>
      </div>
    </div>

    <table class="items-table">
      <thead>
        <tr>
          <th>Description</th>
          <th style="text-align: center; width: 80px;">Qty</th>
          <th style="text-align: right; width: 150px;">Amount</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td>
            <strong>${data.planName} Plan</strong><br>
            <span style="color: #6b7280; font-size: 13px;">Monthly Subscription</span>
          </td>
          <td style="text-align: center;">1</td>
          <td style="text-align: right;">${formattedAmount}</td>
        </tr>
      </tbody>
    </table>

    <div class="totals">
      <div class="totals-box">
        <div class="total-row">
          <span class="label">Subtotal</span>
          <span class="value">${formattedAmount}</span>
        </div>
        <div class="total-row">
          <span class="label">Tax (0%)</span>
          <span class="value">${data.currency.toUpperCase()} 0.00</span>
        </div>
        <div class="total-row grand">
          <span class="label">Total</span>
          <span class="value">${formattedAmount}</span>
        </div>
      </div>
    </div>

    <div class="payment-note">
      <h3>✓ Payment Received</h3>
      <p>Thank you for your payment! Your subscription is now active.</p>
    </div>

    <div class="footer">
      <p><strong>HireMetrics CRM</strong> - Recruitment Management Made Simple</p>
      <p style="margin-top: 8px;">Thank you for your business!</p>
      <p style="margin-top: 4px;">admin@hiremetrics.co.uk • www.hiremetrics.co.uk</p>
    </div>
  </div>
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

  try {
    logStep("Function started");
    
    const { sessionId, orderId } = await req.json();
    logStep("Request params", { sessionId, orderId });

    if (!sessionId) {
      throw new Error("Missing sessionId");
    }

    // Initialize Stripe with dynamic credentials
    const stripeCredentials = await getStripeCredentials(supabase);
    if (!stripeCredentials.secretKey) throw new Error("Stripe is not configured");
    
    const stripe = new Stripe(stripeCredentials.secretKey, { apiVersion: "2025-08-27.basil" });

    // Retrieve session from Stripe
    const session = await stripe.checkout.sessions.retrieve(sessionId, {
      expand: ['subscription', 'payment_intent', 'customer']
    });
    
    logStep("Session retrieved", { 
      status: session.status,
      paymentStatus: session.payment_status,
      customerId: session.customer
    });

    if (session.payment_status !== 'paid') {
      return new Response(JSON.stringify({ 
        success: false, 
        message: "Payment not completed",
        status: session.payment_status 
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    // Update order in database
    const orderIdFromMeta = orderId || session.metadata?.order_id;
    if (orderIdFromMeta) {
      const updateData: Record<string, unknown> = {
        stripe_customer_id: typeof session.customer === 'string' ? session.customer : (session.customer as Stripe.Customer)?.id,
        status: 'completed',
        updated_at: new Date().toISOString(),
      };

      if (session.subscription) {
        const subscriptionId = typeof session.subscription === 'string' 
          ? session.subscription 
          : (session.subscription as Stripe.Subscription)?.id;
        updateData.stripe_subscription_id = subscriptionId;
      }

      if (session.payment_intent) {
        const paymentIntentId = typeof session.payment_intent === 'string'
          ? session.payment_intent
          : (session.payment_intent as Stripe.PaymentIntent)?.id;
        updateData.stripe_payment_intent_id = paymentIntentId;
      }

      const { error } = await supabase
        .from('orders')
        .update(updateData)
        .eq('id', orderIdFromMeta);

      if (error) {
        logStep("Order update failed", { error });
      } else {
        logStep("Order updated", { orderId: orderIdFromMeta });
      }

      // Fetch updated order with related data
      const { data: order } = await supabase
        .from('orders')
        .select(`
          *,
          subscription_plans(name, slug),
          profiles:user_id(full_name, email),
          tenants(name, logo_url)
        `)
        .eq('id', orderIdFromMeta)
        .single();

      // Generate and send invoice email
      if (order) {
        try {
          const resendApiKey = Deno.env.get("RESEND_API_KEY");
          if (resendApiKey) {
            const resend = new Resend(resendApiKey);
            
            const userName = order.profiles?.full_name || 'Valued Customer';
            const userEmail = order.profiles?.email;
            const planName = order.subscription_plans?.name || 'Subscription';
            const companyName = order.tenants?.name || 'Company';
            
            // Generate invoice number
            const invoiceNumber = `INV-${order.id.slice(0, 8).toUpperCase()}-${Date.now().toString().slice(-6)}`;
            const issueDate = new Date().toLocaleDateString('en-GB', {
              year: 'numeric',
              month: 'long',
              day: 'numeric'
            });

            // Get next billing date if subscription
            let nextBillingDate: string | undefined;
            if (session.subscription) {
              const subscriptionId = typeof session.subscription === 'string' 
                ? session.subscription 
                : (session.subscription as Stripe.Subscription)?.id;
              if (subscriptionId) {
                const subscription = await stripe.subscriptions.retrieve(subscriptionId);
                nextBillingDate = new Date(subscription.current_period_end * 1000).toLocaleDateString('en-GB', {
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric'
                });
              }
            }

            // Generate invoice attachment HTML
            const invoiceAttachmentHtml = generateInvoiceAttachmentHTML({
              invoiceNumber,
              userName,
              userEmail: userEmail || '',
              companyName,
              planName,
              amount: order.amount,
              currency: order.currency || 'GBP',
              issueDate,
              companyLogo: order.tenants?.logo_url
            });

            // Generate email body
            const emailHtml = generateInvoiceEmailHTML({
              invoiceNumber,
              userName,
              planName,
              amount: order.amount,
              currency: order.currency || 'GBP',
              issueDate,
              nextBillingDate,
              invoiceHtml: invoiceAttachmentHtml,
              companyLogo: order.tenants?.logo_url
            });

            if (userEmail) {
              // Send email with invoice attachment
              // Encode HTML for attachment
              const encoder = new TextEncoder();
              const invoiceBytes = encoder.encode(invoiceAttachmentHtml);
              const base64Invoice = btoa(String.fromCharCode(...invoiceBytes));

              const emailResult = await sendResendEmailWithRetry(resend, {
                from: 'HireMetrics <admin@hiremetrics.co.uk>',
                to: [userEmail],
                subject: `🧾 Your Invoice ${invoiceNumber} - ${planName} Plan`,
                html: emailHtml,
                attachments: [
                  {
                    filename: `Invoice-${invoiceNumber}.html`,
                    content: base64Invoice,
                  }
                ]
              });

              if (emailResult.error) {
                throw new Error(emailResult.error?.message ?? 'Resend invoice email failed');
              }

              logStep("Invoice email sent", {
                email: userEmail,
                invoiceNumber,
                emailId: emailResult.data?.id
              });

              // Store invoice in database
              await supabase
                .from('invoices')
                .upsert({
                  tenant_id: order.tenant_id,
                  invoice_number: invoiceNumber,
                  amount: order.amount,
                  currency: order.currency || 'GBP',
                  status: 'paid',
                  paid_at: new Date().toISOString(),
                  sent_at: new Date().toISOString(),
                  notes: `Payment for ${planName} plan`,
                  line_items: [{
                    description: `${planName} Plan - Monthly Subscription`,
                    quantity: 1,
                    rate: order.amount,
                    amount: order.amount
                  }],
                  company_name: 'HireMetrics CRM',
                }, {
                  onConflict: 'invoice_number'
                });

              logStep("Invoice stored in database", { invoiceNumber });
            }
          } else {
            logStep("RESEND_API_KEY not configured, skipping invoice email");
          }
        } catch (emailError) {
          logStep("Error sending invoice email", { 
            error: emailError instanceof Error ? emailError.message : String(emailError) 
          });
          // Don't fail the whole request if email fails
        }
      }

      return new Response(JSON.stringify({ 
        success: true,
        order,
        session: {
          id: session.id,
          payment_status: session.payment_status,
          amount_total: session.amount_total,
          currency: session.currency
        }
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    return new Response(JSON.stringify({ 
      success: true,
      session: {
        id: session.id,
        payment_status: session.payment_status,
        amount_total: session.amount_total,
        currency: session.currency
      }
    }), {
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
