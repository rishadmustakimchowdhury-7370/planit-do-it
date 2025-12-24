import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[GENERATE-INVOICE-PDF] ${step}${detailsStr}`);
};

// Generate invoice HTML that can be converted to PDF
function generateInvoiceHTML(data: {
  invoiceNumber: string;
  userName: string;
  userEmail: string;
  companyName: string;
  planName: string;
  amount: number;
  currency: string;
  issueDate: string;
  dueDate?: string;
  companyLogo?: string;
  companyAddress?: string;
  companyPhone?: string;
}): string {
  const formattedAmount = new Intl.NumberFormat('en-GB', {
    style: 'currency',
    currency: data.currency.toUpperCase()
  }).format(data.amount);

  const logoHTML = data.companyLogo 
    ? `<img src="${data.companyLogo}" alt="Company Logo" style="max-height: 60px; max-width: 200px;" />`
    : `<div style="display: flex; align-items: center; gap: 10px;">
        <div style="background: linear-gradient(135deg, #00008B 0%, #0000CD 100%); border-radius: 10px; padding: 10px;">
          <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M3 3v18h18"/>
            <path d="m19 9-5 5-4-4-3 3"/>
          </svg>
        </div>
        <span style="font-size: 24px; font-weight: 700;">
          <span style="color: #00008B;">HireMetrics</span><span style="color: #64748b;"> CRM</span>
        </span>
      </div>`;

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
    .payment-note { background: #eff6ff; border-radius: 12px; padding: 20px; margin-bottom: 30px; border: 1px solid #bfdbfe; }
    .payment-note h3 { font-size: 14px; color: #1e40af; margin-bottom: 8px; }
    .payment-note p { font-size: 13px; color: #3b82f6; }
    @media print { 
      body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      .invoice-container { padding: 20px; }
    }
  </style>
</head>
<body>
  <div class="invoice-container">
    <div class="header">
      <div>
        ${logoHTML}
        <div class="company-info">
          ${data.companyAddress ? `<p>${data.companyAddress}</p>` : '<p>United Kingdom</p>'}
          ${data.companyPhone ? `<p>Tel: ${data.companyPhone}</p>` : ''}
          <p>Email: admin@hiremetrics.co.uk</p>
          <p>Website: www.hiremetrics.co.uk</p>
        </div>
      </div>
      <div class="invoice-title">
        <h1>INVOICE</h1>
        <div class="invoice-meta">
          <p><strong>${data.invoiceNumber}</strong></p>
          <p>Issue Date: ${data.issueDate}</p>
          ${data.dueDate ? `<p>Due Date: ${data.dueDate}</p>` : ''}
          <p style="color: #059669; font-weight: 600; margin-top: 8px;">✓ PAID</p>
        </div>
      </div>
    </div>

    <div class="parties">
      <div class="party-box">
        <div class="party-label">From</div>
        <div class="party-name">HireMetrics CRM</div>
        <div class="party-details">
          ${data.companyAddress || 'United Kingdom'}<br>
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

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const { orderId, returnHtml } = await req.json();
    logStep("Generating invoice", { orderId, returnHtml });

    if (!orderId) {
      throw new Error("Order ID is required");
    }

    // Fetch order details with related data
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .select(`
        *,
        subscription_plans(name, billing_cycle),
        profiles:user_id(full_name, email),
        tenants(name, logo_url)
      `)
      .eq('id', orderId)
      .single();

    if (orderError || !order) {
      throw new Error(`Order not found: ${orderError?.message}`);
    }

    logStep("Order fetched", { 
      orderId: order.id, 
      planName: order.subscription_plans?.name 
    });

    // Generate invoice number if not exists
    const invoiceNumber = `INV-${order.id.slice(0, 8).toUpperCase()}-${Date.now().toString().slice(-6)}`;
    const issueDate = new Date(order.created_at).toLocaleDateString('en-GB', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });

    // Get tenant branding
    const { data: branding } = await supabase
      .from('branding_settings')
      .select('logo_url, company_name')
      .eq('tenant_id', order.tenant_id)
      .single();

    const invoiceHtml = generateInvoiceHTML({
      invoiceNumber,
      userName: order.profiles?.full_name || 'Customer',
      userEmail: order.profiles?.email || '',
      companyName: order.tenants?.name || 'Company',
      planName: order.subscription_plans?.name || 'Subscription',
      amount: order.amount,
      currency: order.currency || 'GBP',
      issueDate,
      companyLogo: branding?.logo_url || order.tenants?.logo_url,
    });

    // Store invoice in the database
    const { data: invoice, error: invoiceError } = await supabase
      .from('invoices')
      .upsert({
        tenant_id: order.tenant_id,
        invoice_number: invoiceNumber,
        amount: order.amount,
        currency: order.currency || 'GBP',
        status: 'paid',
        paid_at: new Date().toISOString(),
        notes: `Payment for ${order.subscription_plans?.name || 'Subscription'} plan`,
        line_items: [{
          description: `${order.subscription_plans?.name || 'Subscription'} Plan - Monthly Subscription`,
          quantity: 1,
          rate: order.amount,
          amount: order.amount
        }],
        company_name: branding?.company_name || 'HireMetrics CRM',
        company_logo: branding?.logo_url,
      }, {
        onConflict: 'invoice_number'
      })
      .select()
      .single();

    if (invoiceError) {
      logStep("Error storing invoice", { error: invoiceError });
    } else {
      logStep("Invoice stored", { invoiceId: invoice?.id });
    }

    // Return HTML for email embedding or PDF generation
    if (returnHtml) {
      return new Response(JSON.stringify({ 
        html: invoiceHtml,
        invoiceNumber,
        invoiceId: invoice?.id
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    return new Response(JSON.stringify({ 
      success: true,
      invoiceNumber,
      invoiceId: invoice?.id,
      message: "Invoice generated successfully"
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logStep("Error", { message: errorMessage });
    return new Response(JSON.stringify({ error: errorMessage }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
