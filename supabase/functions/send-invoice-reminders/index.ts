// Daily cron: send invoice reminders (3 days before due, on due date, 7 days overdue).
// Called by pg_cron. Auth via service role.
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import { sendOperationalEmail, wrapOperationalEmail, getOrgBranding } from "../_shared/smtp-sender.ts";
import { generateInvoicePdfBytes } from "../_shared/invoice-pdf.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function todayUTC(): Date {
  const d = new Date();
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}
function addDays(d: Date, n: number): string {
  const x = new Date(d);
  x.setUTCDate(x.getUTCDate() + n);
  return x.toISOString().slice(0, 10);
}
function fmtMoney(n: number, c: string): string {
  try { return new Intl.NumberFormat("en-US", { style: "currency", currency: (c || "USD").toUpperCase() }).format(n); }
  catch { return `${c} ${n.toFixed(2)}`; }
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
  const today = todayUTC();
  const targets: Array<{ kind: "pre_due_3d" | "due_today" | "overdue_7d"; date: string }> = [
    { kind: "pre_due_3d", date: addDays(today, 3) },
    { kind: "due_today",  date: addDays(today, 0) },
    { kind: "overdue_7d", date: addDays(today, -7) },
  ];

  let totalSent = 0;
  const errors: string[] = [];

  for (const t of targets) {
    const { data: invoices, error } = await supabase
      .from("invoices")
      .select("*, clients(name,contact_email,address,city,country), placements(start_date, salary, fee_pct, candidates(full_name), jobs(title))")
      .eq("due_date", t.date)
      .in("status", ["sent", "overdue", "pending"])
      .gt("balance", 0);
    if (error) { errors.push(`${t.kind}: ${error.message}`); continue; }

    for (const inv of invoices ?? []) {
      // De-dup: skip if same reminder kind already sent today
      if (inv.last_reminder_kind === t.kind && inv.last_reminder_sent_at) {
        const last = new Date(inv.last_reminder_sent_at);
        if (last.toISOString().slice(0, 10) === today.toISOString().slice(0, 10)) continue;
      }
      const recipient = inv.sent_to_email || inv.clients?.email;
      if (!recipient) continue;

      try {
        const [{ data: settings }] = await Promise.all([
          supabase.from("finance_settings").select("*").eq("tenant_id", inv.tenant_id).maybeSingle(),
        ]);
        const branding = await getOrgBranding(inv.tenant_id);
        const candidateName = inv.placements?.candidates?.full_name;

        const subjMap: Record<string, string> = {
          pre_due_3d: `Friendly reminder: Invoice ${inv.invoice_number} due in 3 days`,
          due_today:  `Invoice ${inv.invoice_number} is due today`,
          overdue_7d: `Overdue: Invoice ${inv.invoice_number}`,
        };
        const introMap: Record<string, string> = {
          pre_due_3d: `This is a friendly reminder that invoice <strong>${inv.invoice_number}</strong> for <strong>${fmtMoney(Number(inv.balance || 0), inv.currency)}</strong> is due on <strong>${inv.due_date}</strong> (in 3 days).`,
          due_today:  `Invoice <strong>${inv.invoice_number}</strong> for <strong>${fmtMoney(Number(inv.balance || 0), inv.currency)}</strong> is due today. The latest copy is attached.`,
          overdue_7d: `Invoice <strong>${inv.invoice_number}</strong> for <strong>${fmtMoney(Number(inv.balance || 0), inv.currency)}</strong> is now <strong>7 days overdue</strong>. Please arrange payment at your earliest convenience.`,
        };

        const pdf = await generateInvoicePdfBytes({
          invoice_number: inv.invoice_number, issue_date: inv.issue_date, due_date: inv.due_date,
          status: inv.status, currency: inv.currency || "USD",
          subtotal: Number(inv.subtotal || 0), tax_pct: Number(inv.tax_pct || 0), tax_amount: Number(inv.tax_amount || 0),
          vat_pct: Number(inv.vat_pct || 0), vat_amount: Number(inv.vat_amount || 0),
          total_amount: Number(inv.total_amount || 0), amount_paid: Number(inv.amount_paid || 0), balance: Number(inv.balance || 0),
          notes: inv.notes, payment_terms: inv.payment_terms, line_items: inv.line_items as any,
          bank_details: inv.bank_details || {
            bank_name: settings?.bank_name, bank_account_name: settings?.bank_account_name,
            bank_account_number: settings?.bank_account_number, bank_sort_code: settings?.bank_sort_code,
            bank_iban: settings?.bank_iban, bank_swift: settings?.bank_swift,
          },
          agency_name: settings?.agency_name, agency_logo_url: settings?.agency_logo_url,
          agency_address: settings?.agency_address, agency_phone: settings?.agency_phone,
          agency_email: settings?.agency_email, agency_website: settings?.agency_website,
          client_name: inv.clients?.name, client_email: inv.clients?.contact_email,
          client_address: [inv.clients?.address, inv.clients?.city, inv.clients?.country].filter(Boolean).join(", "),
          candidate_name: candidateName, job_title: inv.placements?.jobs?.title,
          placement_start_date: inv.placements?.start_date,
          annual_salary: inv.placements?.salary ? Number(inv.placements.salary) : null,
          fee_percent: inv.placements?.fee_pct ? Number(inv.placements.fee_pct) : null,
        });

        const trackUrl = `${Deno.env.get("SUPABASE_URL")}/functions/v1/track-invoice-email?id=${inv.id}`;
        const html = wrapOperationalEmail(`
          <p style="margin:0 0 14px;font-family:Arial,sans-serif;font-size:14px;color:#1f2937;line-height:1.6;">Hello ${inv.clients?.name || "there"},</p>
          <p style="margin:0 0 14px;font-family:Arial,sans-serif;font-size:14px;color:#1f2937;line-height:1.6;">${introMap[t.kind]}</p>
          <p style="margin:0 0 14px;font-family:Arial,sans-serif;font-size:14px;color:#1f2937;line-height:1.6;">A copy of the invoice (including bank details) is attached. If payment has already been made, please disregard this email.</p>
          <p style="margin:0 0 14px;font-family:Arial,sans-serif;font-size:14px;color:#1f2937;line-height:1.6;">Kind regards,<br/>${settings?.agency_name || "Accounts"}</p>
          <img src="${trackUrl}" width="1" height="1" alt="" style="display:none;border:0;height:1px;width:1px;" />
        `, branding);

        const result = await sendOperationalEmail(inv.tenant_id, inv.created_by || inv.sent_by, settings?.agency_name || "Accounts", {
          to: recipient, subject: subjMap[t.kind], html,
          replyTo: settings?.agency_email || undefined,
          attachments: [{ filename: `${inv.invoice_number}.pdf`, content: pdf, contentType: "application/pdf" }],
        });

        if (result.success) {
          totalSent++;
          await supabase.from("invoice_email_logs").insert({
            tenant_id: inv.tenant_id, invoice_id: inv.id, event_type: "reminder_sent",
            recipient_email: recipient, subject: subjMap[t.kind], reminder_kind: t.kind,
          });
          const upd: Record<string, any> = {
            last_reminder_sent_at: new Date().toISOString(),
            last_reminder_kind: t.kind,
          };
          if (t.kind === "overdue_7d" && inv.status === "sent") upd.status = "overdue";
          await supabase.from("invoices").update(upd).eq("id", inv.id);
        } else {
          errors.push(`inv ${inv.invoice_number}: ${result.error}`);
        }
      } catch (e: any) {
        console.error("[send-invoice-reminders] inv", inv.invoice_number, e);
        errors.push(`inv ${inv.invoice_number}: ${e?.message}`);
      }
    }
  }

  return new Response(JSON.stringify({ success: true, sent: totalSent, errors }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
