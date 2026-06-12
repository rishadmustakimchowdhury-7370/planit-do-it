// Professional invoice PDF generator using jsPDF.
// Returns a Uint8Array ready to be attached to an email.
import { jsPDF } from "https://esm.sh/jspdf@2.5.1";

export interface InvoicePdfData {
  invoice_number: string;
  issue_date?: string | null;
  due_date?: string | null;
  status?: string | null;
  currency: string;
  subtotal?: number | null;
  tax_pct?: number | null;
  tax_amount?: number | null;
  vat_pct?: number | null;
  vat_amount?: number | null;
  total_amount?: number | null;
  amount_paid?: number | null;
  balance?: number | null;
  notes?: string | null;
  payment_terms?: string | null;
  line_items?: Array<{ description?: string; quantity?: number; rate?: number; amount?: number }> | null;
  bank_details?: Record<string, any> | null;
  // Agency
  agency_name?: string | null;
  agency_logo_url?: string | null;
  agency_address?: string | null;
  agency_phone?: string | null;
  agency_email?: string | null;
  agency_website?: string | null;
  // Client
  client_name?: string | null;
  client_email?: string | null;
  client_address?: string | null;
  // Placement context
  candidate_name?: string | null;
  job_title?: string | null;
  placement_start_date?: string | null;
  annual_salary?: number | null;
  fee_percent?: number | null;
}

function fmtMoney(amount: number | null | undefined, currency: string): string {
  const n = typeof amount === "number" ? amount : 0;
  try {
    return new Intl.NumberFormat("en-US", { style: "currency", currency: (currency || "USD").toUpperCase() }).format(n);
  } catch {
    return `${currency} ${n.toFixed(2)}`;
  }
}

async function fetchLogoDataUrl(url?: string | null): Promise<{ data: string; format: "PNG" | "JPEG" } | null> {
  if (!url) return null;
  try {
    const r = await fetch(url);
    if (!r.ok) return null;
    const ct = (r.headers.get("content-type") || "image/png").toLowerCase();
    const fmt: "PNG" | "JPEG" = ct.includes("jpeg") || ct.includes("jpg") ? "JPEG" : "PNG";
    const buf = new Uint8Array(await r.arrayBuffer());
    let bin = "";
    for (let i = 0; i < buf.length; i++) bin += String.fromCharCode(buf[i]);
    const b64 = btoa(bin);
    return { data: `data:${fmt === "JPEG" ? "image/jpeg" : "image/png"};base64,${b64}`, format: fmt };
  } catch (e) {
    console.warn("[invoice-pdf] logo fetch failed", e);
    return null;
  }
}

export async function generateInvoicePdfBytes(data: InvoicePdfData): Promise<Uint8Array> {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const W = doc.internal.pageSize.getWidth();
  const M = 40;
  let y = M;

  const navy: [number, number, number] = [30, 58, 138];
  const grey: [number, number, number] = [107, 114, 128];
  const dark: [number, number, number] = [31, 41, 55];

  // Header: logo + INVOICE
  const logo = await fetchLogoDataUrl(data.agency_logo_url);
  if (logo) {
    try { doc.addImage(logo.data, logo.format, M, y, 90, 40); } catch (e) { console.warn("[pdf] addImage", e); }
  }
  if (data.agency_name) {
    doc.setFont("helvetica", "bold"); doc.setFontSize(16); doc.setTextColor(...navy);
    doc.text(data.agency_name, M + (logo ? 100 : 0), y + 18);
  }
  doc.setFont("helvetica", "normal"); doc.setFontSize(9); doc.setTextColor(...grey);
  const agencyLines = [data.agency_address, data.agency_phone, data.agency_email, data.agency_website].filter(Boolean) as string[];
  agencyLines.forEach((line, i) => doc.text(line, M + (logo ? 100 : 0), y + 34 + i * 12));

  doc.setFont("helvetica", "bold"); doc.setFontSize(26); doc.setTextColor(...navy);
  doc.text("INVOICE", W - M, y + 20, { align: "right" });
  doc.setFont("helvetica", "normal"); doc.setFontSize(10); doc.setTextColor(...dark);
  doc.text(`# ${data.invoice_number}`, W - M, y + 38, { align: "right" });
  if (data.issue_date) doc.text(`Issue: ${data.issue_date}`, W - M, y + 52, { align: "right" });
  if (data.due_date) doc.text(`Due:   ${data.due_date}`, W - M, y + 66, { align: "right" });
  const status = (data.status || "draft").toUpperCase();
  doc.setFont("helvetica", "bold"); doc.setTextColor(status === "PAID" ? 5 : 30, status === "PAID" ? 150 : 58, status === "PAID" ? 105 : 138);
  doc.text(status, W - M, y + 82, { align: "right" });

  y += 110;
  doc.setDrawColor(229, 231, 235); doc.line(M, y, W - M, y); y += 18;

  // Bill To / Placement
  doc.setFont("helvetica", "bold"); doc.setFontSize(10); doc.setTextColor(...grey);
  doc.text("BILL TO", M, y);
  doc.text("PLACEMENT", W / 2, y);
  y += 14;
  doc.setFont("helvetica", "bold"); doc.setFontSize(12); doc.setTextColor(...dark);
  doc.text(data.client_name || "—", M, y);
  doc.text(data.candidate_name || "—", W / 2, y);
  y += 14;
  doc.setFont("helvetica", "normal"); doc.setFontSize(9); doc.setTextColor(...grey);
  const clientBits = [data.client_address, data.client_email].filter(Boolean) as string[];
  clientBits.forEach((b, i) => doc.text(b, M, y + i * 12));
  const placementBits = [
    data.job_title ? `Role: ${data.job_title}` : null,
    data.placement_start_date ? `Start: ${data.placement_start_date}` : null,
    data.annual_salary ? `Salary: ${fmtMoney(data.annual_salary, data.currency)}` : null,
    data.fee_percent ? `Fee: ${data.fee_percent}%` : null,
  ].filter(Boolean) as string[];
  placementBits.forEach((b, i) => doc.text(b, W / 2, y + i * 12));
  y += Math.max(clientBits.length, placementBits.length) * 12 + 20;

  // Line items table
  doc.setFillColor(31, 41, 55); doc.rect(M, y, W - 2 * M, 22, "F");
  doc.setFont("helvetica", "bold"); doc.setFontSize(10); doc.setTextColor(255, 255, 255);
  doc.text("Description", M + 8, y + 15);
  doc.text("Qty", M + 320, y + 15);
  doc.text("Rate", M + 370, y + 15);
  doc.text("Amount", W - M - 8, y + 15, { align: "right" });
  y += 22;
  doc.setFont("helvetica", "normal"); doc.setTextColor(...dark);
  const items = data.line_items?.length
    ? data.line_items
    : [{ description: data.candidate_name && data.job_title ? `Placement fee – ${data.candidate_name} (${data.job_title})` : "Placement fee", quantity: 1, rate: data.total_amount || 0, amount: data.total_amount || 0 }];
  for (const li of items) {
    const desc = doc.splitTextToSize(String(li.description ?? ""), 280);
    const lineH = Math.max(desc.length * 12, 16);
    doc.text(desc, M + 8, y + 12);
    doc.text(String(li.quantity ?? 1), M + 320, y + 12);
    doc.text(fmtMoney(li.rate ?? 0, data.currency), M + 370, y + 12);
    doc.text(fmtMoney(li.amount ?? 0, data.currency), W - M - 8, y + 12, { align: "right" });
    y += lineH + 4;
    doc.setDrawColor(243, 244, 246); doc.line(M, y, W - M, y);
    y += 4;
  }

  // Totals
  y += 10;
  const tX = W - M - 240;
  const tW = 240;
  const row = (label: string, value: string, bold = false, big = false) => {
    doc.setFont("helvetica", bold ? "bold" : "normal");
    doc.setFontSize(big ? 13 : 10);
    doc.setTextColor(...(big ? navy : dark));
    doc.text(label, tX + 8, y + 14);
    doc.text(value, tX + tW - 8, y + 14, { align: "right" });
    y += big ? 22 : 18;
  };
  row("Subtotal", fmtMoney(data.subtotal, data.currency));
  if ((data.tax_pct ?? 0) > 0) row(`Tax (${data.tax_pct}%)`, fmtMoney(data.tax_amount, data.currency));
  if ((data.vat_pct ?? 0) > 0) row(`VAT (${data.vat_pct}%)`, fmtMoney(data.vat_amount, data.currency));
  doc.setDrawColor(229, 231, 235); doc.line(tX, y, tX + tW, y); y += 4;
  row("Total", fmtMoney(data.total_amount, data.currency), true, true);
  if ((data.amount_paid ?? 0) > 0) {
    row("Paid", fmtMoney(data.amount_paid, data.currency));
    row("Balance Due", fmtMoney(data.balance, data.currency), true);
  }

  // Bank details
  y += 16;
  const bank = data.bank_details || {};
  if (bank.bank_name || bank.bank_iban || bank.bank_account_number) {
    doc.setFillColor(249, 250, 251); doc.rect(M, y, W - 2 * M, 90, "F");
    doc.setFont("helvetica", "bold"); doc.setFontSize(11); doc.setTextColor(...navy);
    doc.text("Payment Details", M + 12, y + 16);
    doc.setFont("helvetica", "normal"); doc.setFontSize(9); doc.setTextColor(...dark);
    const lines = [
      bank.bank_name && `Bank: ${bank.bank_name}`,
      bank.bank_account_name && `Account name: ${bank.bank_account_name}`,
      bank.bank_account_number && `Account: ${bank.bank_account_number}`,
      bank.bank_sort_code && `Sort code: ${bank.bank_sort_code}`,
      bank.bank_iban && `IBAN: ${bank.bank_iban}`,
      bank.bank_swift && `SWIFT/BIC: ${bank.bank_swift}`,
    ].filter(Boolean) as string[];
    lines.forEach((l, i) => doc.text(l, M + 12, y + 32 + i * 12));
    y += 100;
  }

  if (data.payment_terms) {
    doc.setFont("helvetica", "italic"); doc.setFontSize(9); doc.setTextColor(...grey);
    doc.text(`Payment terms: ${data.payment_terms}`, M, y); y += 16;
  }
  if (data.notes) {
    doc.setFont("helvetica", "normal"); doc.setFontSize(9); doc.setTextColor(...dark);
    const notes = doc.splitTextToSize(data.notes, W - 2 * M);
    doc.text(notes, M, y);
  }

  // Footer
  doc.setFont("helvetica", "normal"); doc.setFontSize(8); doc.setTextColor(...grey);
  doc.text(`${data.agency_name || ""} – Thank you for your business.`, W / 2, doc.internal.pageSize.getHeight() - 24, { align: "center" });

  const ab = doc.output("arraybuffer") as ArrayBuffer;
  return new Uint8Array(ab);
}
