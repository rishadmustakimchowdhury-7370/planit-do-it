import { useEffect, useState } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { formatMoney, INVOICE_STATUS_COLORS } from "@/lib/finance";
import { cn } from "@/lib/utils";
import { Plus, Loader2, FileText, MoreVertical, DollarSign, Send, Download, Trash2, Edit, Clock } from "lucide-react";
import { format } from "date-fns";
import { Navigate } from "react-router-dom";
import { InvoiceEditorDialog } from "@/components/finance/InvoiceEditorDialog";
import { RecordPaymentDialog } from "@/components/finance/RecordPaymentDialog";
import { SendInvoiceDialog } from "@/components/finance/SendInvoiceDialog";
import { InvoiceTimelineDialog } from "@/components/finance/InvoiceTimelineDialog";
import { toast } from "@/hooks/use-toast";

export default function InvoicesPage() {
  const { tenantId, user, isOwner, isManager, isLoading: authLoading } = useAuth();
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<any[]>([]);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [paymentInvoice, setPaymentInvoice] = useState<any | null>(null);
  const [sendInvoice, setSendInvoice] = useState<any | null>(null);
  const [timelineInvoice, setTimelineInvoice] = useState<any | null>(null);

  const load = async () => {
    if (!tenantId) return;
    setLoading(true);
    const { data, error } = await supabase
      .from("invoices")
      .select("*, clients(name), placements(id, candidates(full_name), jobs(title))")
      .eq("tenant_id", tenantId)
      .order("created_at", { ascending: false });
    if (error) console.error("[invoices] load error", error);
    setRows(data || []);
    setLoading(false);
  };
  useEffect(() => { load(); }, [tenantId]);

  if (authLoading) return <AppLayout><Loader2 className="animate-spin m-6" /></AppLayout>;
  if (!isOwner && !isManager) return <Navigate to="/dashboard" replace />;

  const filtered = rows.filter(r => {
    if (statusFilter !== "all" && r.status !== statusFilter) return false;
    if (search) {
      const q = search.toLowerCase();
      return (
        r.invoice_number?.toLowerCase().includes(q) ||
        r.clients?.name?.toLowerCase().includes(q) ||
        r.placements?.candidates?.full_name?.toLowerCase().includes(q)
      );
    }
    return true;
  });

  const updateStatus = async (id: string, status: string) => {
    const { error } = await supabase.from("invoices").update({ status: status as any, sent_at: status === "sent" ? new Date().toISOString() : undefined, sent_by: status === "sent" ? user?.id : undefined }).eq("id", id);
    if (error) { toast({ title: "Failed", description: error.message, variant: "destructive" }); return; }
    await supabase.from("invoice_status_history").insert({ tenant_id: tenantId!, invoice_id: id, to_status: status, changed_by: user?.id });
    await supabase.from("finance_audit_log").insert({ tenant_id: tenantId!, entity_type: "invoice", entity_id: id, action: `status:${status}`, performed_by: user?.id });
    toast({ title: `Marked as ${status}` });
    load();
  };

  const deleteInvoice = async (id: string) => {
    if (!confirm("Delete this invoice?")) return;
    const { error } = await supabase.from("invoices").delete().eq("id", id);
    if (error) { toast({ title: "Failed", description: error.message, variant: "destructive" }); return; }
    toast({ title: "Invoice deleted" });
    load();
  };

  const printInvoice = (inv: any) => {
    const w = window.open("", "_blank");
    if (!w) return;
    const bank = inv.bank_details || {};
    const items = (inv.line_items || []) as any[];
    w.document.write(`<!DOCTYPE html><html><head><title>${inv.invoice_number}</title><style>
      body{font-family:system-ui,-apple-system,sans-serif;color:#1f2937;padding:40px;max-width:800px;margin:0 auto}
      .header{display:flex;justify-content:space-between;border-bottom:2px solid #e5e7eb;padding-bottom:20px;margin-bottom:24px}
      h1{font-size:28px;color:#1e3a8a;margin:0}
      table{width:100%;border-collapse:collapse;margin-bottom:24px}
      th{background:#1f2937;color:#fff;padding:10px;text-align:left}
      td{padding:10px;border-bottom:1px solid #f3f4f6}
      .right{text-align:right}.totals{margin-left:auto;width:320px}
      .totals div{display:flex;justify-content:space-between;padding:6px 0}
      .grand{font-size:18px;font-weight:700;border-top:2px solid #e5e7eb;padding-top:10px!important;color:#1e3a8a}
      .box{background:#f9fafb;padding:14px;border-radius:8px;margin-bottom:16px}
      .footer{margin-top:30px;font-size:12px;color:#6b7280;border-top:1px solid #e5e7eb;padding-top:14px}
    </style></head><body>
      <div class="header">
        <div>
          ${inv.company_logo ? `<img src="${inv.company_logo}" style="max-height:50px"/>` : `<h2 style="color:#1e3a8a;margin:0">${inv.company_name || ""}</h2>`}
          <div style="font-size:13px;color:#6b7280;margin-top:8px">
            ${inv.company_address ? `<div>${inv.company_address}</div>` : ""}
            ${inv.company_phone ? `<div>${inv.company_phone}</div>` : ""}
          </div>
        </div>
        <div style="text-align:right">
          <h1>INVOICE</h1>
          <div><strong>${inv.invoice_number}</strong></div>
          <div>Issue: ${inv.issue_date || ""}</div>
          ${inv.due_date ? `<div>Due: ${inv.due_date}</div>` : ""}
          <div style="margin-top:6px;font-weight:600;color:${inv.status==='paid'?'#059669':'#374151'}">${(inv.status||'draft').toUpperCase()}</div>
        </div>
      </div>
      <div class="box"><strong>Bill To</strong><br/>${inv.clients?.name || ""}</div>
      <table>
        <thead><tr><th>Description</th><th class="right">Qty</th><th class="right">Rate</th><th class="right">Amount</th></tr></thead>
        <tbody>${items.map(li => `<tr><td>${li.description||""}</td><td class="right">${li.quantity||1}</td><td class="right">${formatMoney(li.rate, inv.currency)}</td><td class="right">${formatMoney(li.amount, inv.currency)}</td></tr>`).join("")}</tbody>
      </table>
      <div class="totals">
        <div><span>Subtotal</span><span>${formatMoney(inv.subtotal, inv.currency)}</span></div>
        <div><span>Tax (${inv.tax_pct||0}%)</span><span>${formatMoney(inv.tax_amount, inv.currency)}</span></div>
        <div><span>VAT (${inv.vat_pct||0}%)</span><span>${formatMoney(inv.vat_amount, inv.currency)}</span></div>
        <div class="grand"><span>Total</span><span>${formatMoney(inv.total_amount, inv.currency)}</span></div>
        <div><span>Paid</span><span>${formatMoney(inv.amount_paid, inv.currency)}</span></div>
        <div style="font-weight:600"><span>Balance</span><span>${formatMoney(inv.balance, inv.currency)}</span></div>
      </div>
      ${(bank.bank_name || bank.bank_iban) ? `<div class="box" style="margin-top:30px"><strong>Payment Details</strong><br/>
        ${bank.bank_name?`Bank: ${bank.bank_name}<br/>`:""}
        ${bank.bank_account_name?`Account name: ${bank.bank_account_name}<br/>`:""}
        ${bank.bank_account_number?`Account: ${bank.bank_account_number}<br/>`:""}
        ${bank.bank_sort_code?`Sort code: ${bank.bank_sort_code}<br/>`:""}
        ${bank.bank_iban?`IBAN: ${bank.bank_iban}<br/>`:""}
        ${bank.bank_swift?`SWIFT: ${bank.bank_swift}`:""}
      </div>`:""}
      ${inv.notes?`<div class="box">${inv.notes}</div>`:""}
      ${inv.payment_terms?`<div class="footer">Payment terms: ${inv.payment_terms}</div>`:""}
    </body></html>`);
    w.document.close();
    setTimeout(() => w.print(), 300);
  };

  return (
    <AppLayout>
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Invoices</h1>
            <p className="text-muted-foreground">Create, send and track invoices linked to placements.</p>
          </div>
          <Button onClick={() => { setEditingId(null); setEditorOpen(true); }}>
            <Plus className="w-4 h-4 mr-2" />New invoice
          </Button>
        </div>

        <Card>
          <CardContent className="pt-6">
            <div className="flex gap-3 mb-4">
              <Input placeholder="Search invoice #, client, candidate…" value={search} onChange={e => setSearch(e.target.value)} className="max-w-sm" />
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All statuses</SelectItem>
                  <SelectItem value="draft">Draft</SelectItem>
                  <SelectItem value="sent">Sent</SelectItem>
                  <SelectItem value="paid">Paid</SelectItem>
                  <SelectItem value="overdue">Overdue</SelectItem>
                  <SelectItem value="canceled">Canceled</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {loading ? <Loader2 className="animate-spin" /> : filtered.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <FileText className="w-12 h-12 mx-auto mb-2 opacity-50" />
                No invoices yet.
              </div>
            ) : (
              <Table>
                <TableHeader><TableRow>
                  <TableHead>Invoice #</TableHead><TableHead>Client</TableHead><TableHead>Placement</TableHead>
                  <TableHead>Issue</TableHead><TableHead>Due</TableHead><TableHead className="text-right">Total</TableHead>
                  <TableHead className="text-right">Balance</TableHead><TableHead>Status</TableHead><TableHead></TableHead>
                </TableRow></TableHeader>
                <TableBody>
                  {filtered.map(r => (
                    <TableRow key={r.id}>
                      <TableCell className="font-mono">{r.invoice_number}</TableCell>
                      <TableCell>{r.clients?.name || "—"}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{r.placements?.candidates?.full_name || "—"}</TableCell>
                      <TableCell>{r.issue_date ? format(new Date(r.issue_date), "dd MMM yyyy") : "—"}</TableCell>
                      <TableCell>{r.due_date ? format(new Date(r.due_date), "dd MMM yyyy") : "—"}</TableCell>
                      <TableCell className="text-right font-medium">{formatMoney(r.total_amount, r.currency)}</TableCell>
                      <TableCell className="text-right">{formatMoney(r.balance, r.currency)}</TableCell>
                      <TableCell><Badge className={cn(INVOICE_STATUS_COLORS[r.status] || "")} variant="outline">{r.status}</Badge></TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild><Button size="icon" variant="ghost"><MoreVertical className="w-4 h-4" /></Button></DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => { setEditingId(r.id); setEditorOpen(true); }}><Edit className="w-4 h-4 mr-2" />Edit</DropdownMenuItem>
                            <DropdownMenuItem onClick={() => printInvoice(r)}><Download className="w-4 h-4 mr-2" />Print / PDF</DropdownMenuItem>
                            {r.status !== "sent" && r.status !== "paid" && <DropdownMenuItem onClick={() => updateStatus(r.id, "sent")}><Send className="w-4 h-4 mr-2" />Mark as Sent</DropdownMenuItem>}
                            {r.status !== "paid" && r.balance > 0 && <DropdownMenuItem onClick={() => setPaymentInvoice(r)}><DollarSign className="w-4 h-4 mr-2" />Record Payment</DropdownMenuItem>}
                            {r.status !== "canceled" && <DropdownMenuItem onClick={() => updateStatus(r.id, "canceled")}>Cancel invoice</DropdownMenuItem>}
                            <DropdownMenuItem className="text-destructive" onClick={() => deleteInvoice(r.id)}><Trash2 className="w-4 h-4 mr-2" />Delete</DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        <InvoiceEditorDialog open={editorOpen} onOpenChange={setEditorOpen} invoiceId={editingId} onSaved={load} />
        {paymentInvoice && (
          <RecordPaymentDialog
            open={!!paymentInvoice} onOpenChange={(o) => !o && setPaymentInvoice(null)}
            invoiceId={paymentInvoice.id} tenantId={tenantId!}
            currency={paymentInvoice.currency} balance={Number(paymentInvoice.balance || 0)}
            onSaved={load}
          />
        )}
      </div>
    </AppLayout>
  );
}
