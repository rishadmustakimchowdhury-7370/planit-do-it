import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import { sendOperationalEmail, wrapOperationalEmail, getOrgBranding } from "../_shared/smtp-sender.ts";
import { buildSignatureHtml, loadProfileSignatureFields } from "../_shared/signature.ts";
import { generateInvoicePdfBytes } from "../_shared/invoice-pdf.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function fmtMoney(amount: number | null | undefined, currency: string): string {
  const n = typeof amount === "number" ? amount : 0;
  try {
    return new Intl.NumberFormat("en-US", { style: "currency", currency: (currency || "USD").toUpperCase() }).format(n);
  } catch { return `${currency} ${n.toFixed(2)}`; }
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function bodyToHtml(text: string): string {
  return escapeHtml(text)
    .split(/\n\s*\n/)
    .map(p => `<p style="margin:0 0 14px 0;font-family:Arial,sans-serif;font-size:14px;color:#1f2937;line-height:1.6;">${p.replace(/\n/g, "<br/>")}</p>`)
    .join("");
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const authHeader = req.headers.get("Authorization") ?? "";

    const userClient = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authHeader } } });
    const admin = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });

    const { data: userRes } = await userClient.auth.getUser();
    const sender = userRes?.user;
    if (!sender) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const { invoice_id, recipient_email, cc_email, subject, body, mark_as_sent = true, reminder_kind = null } = await req.json();
    if (!invoice_id || !recipient_email || !subject || !body) {
      return new Response(JSON.stringify({ error: "invoice_id, recipient_email, subject, body required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Load invoice + relations
    const { data: inv, error: invErr } = await admin
      .from("invoices")
      .select("*, clients(name,contact_email,address,city,country), placements(start_date, salary, fee_pct, candidates(full_name), jobs(title))")
      .eq("id", invoice_id)
      .maybeSingle();
    if (invErr || !inv) {
      return new Response(JSON.stringify({ error: "Invoice not found" }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // RBAC: owner/manager only
    const { data: roleRows } = await admin
      .from("user_roles").select("role").eq("user_id", sender.id).eq("tenant_id", inv.tenant_id);
    const roles = (roleRows ?? []).map((r: any) => r.role);
    if (!roles.includes("owner") && !roles.includes("manager") && !roles.includes("super_admin")) {
      return new Response(JSON.stringify({ error: "Forbidden" }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Load finance settings + profile + branding
    const [{ data: settings }, { data: profile }] = await Promise.all([
      admin.from("finance_settings").select("*").eq("tenant_id", inv.tenant_id).maybeSingle(),
      admin.from("profiles").select("full_name,email").eq("id", sender.id).maybeSingle(),
    ]);
    const branding = await getOrgBranding(inv.tenant_id);
    const signatureFields = await loadProfileSignatureFields(admin, sender.id);
    const signatureHtml = buildSignatureHtml(signatureFields);

    const candidateName = inv.placements?.candidates?.full_name;
    const jobTitle = inv.placements?.jobs?.title;

    // Build PDF
    console.log("[send-invoice-email] building PDF for", inv.invoice_number);
    const pdfBytes = await generateInvoicePdfBytes({
      invoice_number: inv.invoice_number,
      issue_date: inv.issue_date,
      due_date: inv.due_date,
      status: mark_as_sent ? "sent" : inv.status,
      currency: inv.currency || "USD",
      subtotal: Number(inv.subtotal || 0),
      tax_pct: Number(inv.tax_pct || 0),
      tax_amount: Number(inv.tax_amount || 0),
      vat_pct: Number(inv.vat_pct || 0),
      vat_amount: Number(inv.vat_amount || 0),
      total_amount: Number(inv.total_amount || 0),
      amount_paid: Number(inv.amount_paid || 0),
      balance: Number(inv.balance || 0),
      notes: inv.notes,
      payment_terms: inv.payment_terms,
      line_items: inv.line_items as any,
      bank_details: inv.bank_details || {
        bank_name: settings?.bank_name,
        bank_account_name: settings?.bank_account_name,
        bank_account_number: settings?.bank_account_number,
        bank_sort_code: settings?.bank_sort_code,
        bank_iban: settings?.bank_iban,
        bank_swift: settings?.bank_swift,
      },
      agency_name: settings?.agency_name || branding?.companyName,
      agency_logo_url: settings?.agency_logo_url || branding?.logoUrl,
      agency_address: settings?.agency_address,
      agency_phone: settings?.agency_phone,
      agency_email: settings?.agency_email,
      agency_website: settings?.agency_website,
      client_name: inv.clients?.name,
      client_email: inv.clients?.contact_email,
      client_address: [inv.clients?.address, inv.clients?.city, inv.clients?.country].filter(Boolean).join(", "),
      candidate_name: candidateName,
      job_title: jobTitle,
      placement_start_date: inv.placements?.start_date,
      annual_salary: inv.placements?.salary ? Number(inv.placements.salary) : null,
      fee_percent: inv.placements?.fee_pct ? Number(inv.placements.fee_pct) : null,
    });

    // Tracking pixel
    const trackUrl = `${supabaseUrl}/functions/v1/track-invoice-email?id=${inv.id}`;
    const pixel = `<img src="${trackUrl}" width="1" height="1" alt="" style="display:none;border:0;outline:none;text-decoration:none;height:1px;width:1px;" />`;

    // Compose HTML
    const summaryBox = `
      <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:8px;margin:18px 0;">
        <tr><td style="padding:14px 16px;font-family:Arial,sans-serif;font-size:13px;color:#374151;">
          <div><strong>Invoice:</strong> ${escapeHtml(inv.invoice_number)}</div>
          <div><strong>Amount:</strong> ${fmtMoney(Number(inv.total_amount || 0), inv.currency)}</div>
          ${inv.due_date ? `<div><strong>Due date:</strong> ${escapeHtml(inv.due_date)}</div>` : ""}
        </td></tr>
      </table>`;

    const html = wrapOperationalEmail(`
      ${bodyToHtml(body)}
      ${summaryBox}
      ${signatureHtml}
      ${pixel}
    `, branding);

    // Send via existing operational SMTP (same path as client submission emails)
    const senderName = profile?.full_name || settings?.agency_name || "Accounts";
    const result = await sendOperationalEmail(inv.tenant_id, sender.id, senderName, {
      to: recipient_email,
      cc: cc_email ? [cc_email] : undefined,
      subject,
      html,
      replyTo: profile?.email || settings?.agency_email || undefined,
      attachments: [{
        filename: `${inv.invoice_number}.pdf`,
        content: pdfBytes,
        contentType: "application/pdf",
      }],
    });

    if (!result.success) {
      await admin.from("invoice_email_logs").insert({
        tenant_id: inv.tenant_id, invoice_id: inv.id, event_type: "bounced",
        recipient_email, subject, performed_by: sender.id,
        metadata: { error: result.error },
      });
      return new Response(JSON.stringify({ error: result.error || "Send failed" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Log "sent" event
    await admin.from("invoice_email_logs").insert({
      tenant_id: inv.tenant_id, invoice_id: inv.id,
      event_type: reminder_kind ? "reminder_sent" : "sent",
      recipient_email, subject, reminder_kind, performed_by: sender.id,
      metadata: { from: result.from },
    });

    // Update invoice
    const updates: Record<string, any> = {
      sent_to_email: recipient_email,
    };
    if (mark_as_sent && (inv.status === "draft" || inv.status === "pending")) {
      updates.status = "sent";
      updates.sent_at = new Date().toISOString();
      updates.sent_by = sender.id;
      await admin.from("invoice_status_history").insert({
        tenant_id: inv.tenant_id, invoice_id: inv.id,
        from_status: inv.status, to_status: "sent",
        changed_by: sender.id, notes: "Auto on email send",
      });
    }
    if (reminder_kind) {
      updates.last_reminder_sent_at = new Date().toISOString();
      updates.last_reminder_kind = reminder_kind;
    }
    await admin.from("invoices").update(updates).eq("id", inv.id);

    await admin.from("finance_audit_log").insert({
      tenant_id: inv.tenant_id, entity_type: "invoice", entity_id: inv.id,
      action: reminder_kind ? `reminder:${reminder_kind}` : "sent",
      performed_by: sender.id, metadata: { recipient: recipient_email },
    });

    return new Response(JSON.stringify({ success: true, from: result.from }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    console.error("[send-invoice-email] error", e);
    return new Response(JSON.stringify({ error: e?.message || "Unexpected error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
