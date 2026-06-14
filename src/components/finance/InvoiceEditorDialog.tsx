import { useEffect, useMemo, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { toast } from "@/hooks/use-toast";
import { SUPPORTED_CURRENCIES, formatMoney } from "@/lib/finance";
import { Loader2, Plus, Trash2, ChevronsUpDown, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { format } from "date-fns";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  invoiceId?: string | null;
  placementId?: string | null;
  onSaved?: () => void;
}

interface LineItem {
  description: string;
  quantity: number;
  rate: number;
  amount: number;
}

export function InvoiceEditorDialog({ open, onOpenChange, invoiceId, placementId, onSaved }: Props) {
  const { tenantId, user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [settings, setSettings] = useState<any>(null);
  const [clients, setClients] = useState<any[]>([]);
  const [placements, setPlacements] = useState<any[]>([]);

  const [form, setForm] = useState<any>({
    invoice_number: "",
    client_id: null,
    client_org_id: null,
    placement_id: null,
    currency: "USD",
    issue_date: format(new Date(), "yyyy-MM-dd"),
    due_date: "",
    tax_pct: 0,
    vat_pct: 0,
    notes: "",
    payment_terms: "",
    status: "draft",
  });
  const [lineItems, setLineItems] = useState<LineItem[]>([
    { description: "Placement fee", quantity: 1, rate: 0, amount: 0 },
  ]);

  useEffect(() => {
    if (!open || !tenantId) return;
    (async () => {
      setLoading(true);
      const [{ data: s }, { data: cl }, { data: pls }] = await Promise.all([
        supabase.from("finance_settings").select("*").eq("tenant_id", tenantId).maybeSingle(),
        supabase.from("clients")
          .select("id, name, contact_name, contact_email, address, address_line1, address_line2, city, state, postal_code, country, is_active")
          .eq("tenant_id", tenantId)
          .eq("is_active", true)
          .order("name"),
        supabase.from("placements").select("id, candidate_id, job_id, client_id, client_org_id, placement_fee, currency, salary, candidates(full_name), jobs(title), clients(name)").eq("tenant_id", tenantId).order("placement_date", { ascending: false }),
      ]);
      setSettings(s);
      setClients(cl || []);
      setPlacements(pls || []);

      if (invoiceId) {
        const { data: inv } = await supabase.from("invoices").select("*").eq("id", invoiceId).single();
        if (inv) {
          setForm({
            invoice_number: inv.invoice_number,
            client_id: inv.client_id,
            client_org_id: inv.client_org_id,
            placement_id: inv.placement_id,
            currency: inv.currency || "USD",
            issue_date: inv.issue_date || format(new Date(), "yyyy-MM-dd"),
            due_date: inv.due_date || "",
            tax_pct: inv.tax_pct || 0,
            vat_pct: inv.vat_pct || 0,
            notes: inv.notes || "",
            payment_terms: inv.payment_terms || "",
            status: inv.status || "draft",
          });
          setLineItems(Array.isArray(inv.line_items) && inv.line_items.length ? inv.line_items as any : [{ description: "Placement fee", quantity: 1, rate: 0, amount: 0 }]);
        }
      } else {
        // prefill from settings + placement
        const prefix = s?.invoice_number_prefix || "INV";
        const number = `${prefix}-${format(new Date(), "yyyyMMdd")}-${Math.floor(Math.random() * 9000 + 1000)}`;
        const due = new Date();
        due.setDate(due.getDate() + (s?.default_payment_terms_days || 14));

        let placementPrefill: any = null;
        if (placementId) {
          const { data: p } = await supabase
            .from("placements")
            .select("*, candidates(full_name), jobs(title), clients(name)")
            .eq("id", placementId).single();
          placementPrefill = p;
        }

        setForm((f: any) => ({
          ...f,
          invoice_number: number,
          currency: placementPrefill?.currency || s?.default_currency || "USD",
          due_date: format(due, "yyyy-MM-dd"),
          tax_pct: s?.default_tax_pct || 0,
          vat_pct: s?.default_vat_pct || 0,
          placement_id: placementPrefill?.id || null,
          client_id: placementPrefill?.client_id || null,
          client_org_id: placementPrefill?.client_org_id || null,
          payment_terms: `Net ${s?.default_payment_terms_days || 14}`,
        }));

        if (placementPrefill) {
          const fee = Number(placementPrefill.placement_fee || 0);
          const desc = `Placement fee — ${placementPrefill.candidates?.full_name || "Candidate"}${placementPrefill.jobs?.title ? ` for ${placementPrefill.jobs.title}` : ""}`;
          setLineItems([{ description: desc, quantity: 1, rate: fee, amount: fee }]);
        }
      }
      setLoading(false);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, tenantId, invoiceId, placementId]);

  const subtotal = lineItems.reduce((s, li) => s + Number(li.amount || 0), 0);
  const taxAmount = subtotal * Number(form.tax_pct || 0) / 100;
  const vatAmount = subtotal * Number(form.vat_pct || 0) / 100;
  const total = subtotal + taxAmount + vatAmount;

  const updateLine = (i: number, field: keyof LineItem, value: any) => {
    setLineItems(items => items.map((li, idx) => {
      if (idx !== i) return li;
      const next = { ...li, [field]: value };
      if (field === "quantity" || field === "rate") {
        next.amount = Number(next.quantity || 0) * Number(next.rate || 0);
      }
      return next;
    }));
  };

  const handleSave = async () => {
    if (!tenantId || !user) return;
    if (!form.invoice_number) {
      toast({ title: "Invoice number required", variant: "destructive" });
      return;
    }
    setSaving(true);
    const payload: any = {
      tenant_id: tenantId,
      invoice_number: form.invoice_number,
      client_id: form.client_id,
      client_org_id: form.client_org_id,
      placement_id: form.placement_id,
      currency: form.currency,
      issue_date: form.issue_date,
      due_date: form.due_date || null,
      tax_pct: form.tax_pct,
      tax_amount: taxAmount,
      vat_pct: form.vat_pct,
      vat_amount: vatAmount,
      subtotal,
      total_amount: total,
      amount: total,
      balance: total,
      line_items: lineItems,
      notes: form.notes,
      payment_terms: form.payment_terms,
      status: form.status,
      bank_details: settings ? {
        bank_name: settings.bank_name, bank_account_name: settings.bank_account_name,
        bank_account_number: settings.bank_account_number, bank_sort_code: settings.bank_sort_code,
        bank_iban: settings.bank_iban, bank_swift: settings.bank_swift,
      } : null,
      company_name: settings?.agency_name,
      company_address: settings?.agency_address,
      company_phone: settings?.agency_phone,
      company_logo: settings?.agency_logo_url,
    };

    let result;
    if (invoiceId) {
      result = await supabase.from("invoices").update(payload).eq("id", invoiceId);
    } else {
      payload.created_by = user.id;
      result = await supabase.from("invoices").insert(payload);
    }
    setSaving(false);
    if (result.error) {
      toast({ title: "Save failed", description: result.error.message, variant: "destructive" });
      return;
    }
    await supabase.from("finance_audit_log").insert({
      tenant_id: tenantId, entity_type: "invoice", entity_id: invoiceId || "00000000-0000-0000-0000-000000000000",
      action: invoiceId ? "updated" : "created", performed_by: user.id,
    });
    toast({ title: invoiceId ? "Invoice updated" : "Invoice created" });
    onSaved?.();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{invoiceId ? "Edit Invoice" : "New Invoice"}</DialogTitle>
        </DialogHeader>
        {loading ? <Loader2 className="animate-spin" /> : (
          <div className="space-y-4">
            <div className="grid md:grid-cols-3 gap-4">
              <div><Label>Invoice #</Label><Input value={form.invoice_number} onChange={e => setForm({ ...form, invoice_number: e.target.value })} /></div>
              <div><Label>Issue date</Label><Input type="date" value={form.issue_date} onChange={e => setForm({ ...form, issue_date: e.target.value })} /></div>
              <div><Label>Due date</Label><Input type="date" value={form.due_date} onChange={e => setForm({ ...form, due_date: e.target.value })} /></div>
              <div>
                <Label>Client</Label>
                <ClientCombobox
                  clients={clients}
                  value={form.client_id}
                  onChange={(c) => {
                    const composedAddress = [c?.address_line1, c?.address_line2, [c?.city, c?.state, c?.postal_code].filter(Boolean).join(" "), c?.country].filter(Boolean).join(", ") || c?.address || "";
                    setForm({
                      ...form,
                      client_id: c?.id || null,
                      client_org_id: null,
                      notes: form.notes || (composedAddress ? `Bill to: ${c?.name}\n${composedAddress}` : form.notes),
                    });
                  }}
                />
              </div>
              <div>
                <Label>Placement (optional)</Label>
                <Select value={form.placement_id || ""} onValueChange={v => {
                  const p = placements.find(x => x.id === v);
                  setForm({ ...form, placement_id: v, client_id: p?.client_id || form.client_id, client_org_id: p?.client_org_id || form.client_org_id, currency: p?.currency || form.currency });
                  if (p) {
                    const fee = Number(p.placement_fee || 0);
                    setLineItems([{ description: `Placement fee — ${p.candidates?.full_name || "Candidate"}${p.jobs?.title ? ` for ${p.jobs.title}` : ""}`, quantity: 1, rate: fee, amount: fee }]);
                  }
                }}>
                  <SelectTrigger><SelectValue placeholder="Link placement" /></SelectTrigger>
                  <SelectContent>{placements.map(p => <SelectItem key={p.id} value={p.id}>{p.candidates?.full_name || "?"} — {p.jobs?.title || "?"}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <Label>Currency</Label>
                <Select value={form.currency} onValueChange={v => setForm({ ...form, currency: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{SUPPORTED_CURRENCIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <Label>Line items</Label>
                <Button size="sm" variant="outline" onClick={() => setLineItems([...lineItems, { description: "", quantity: 1, rate: 0, amount: 0 }])}>
                  <Plus className="w-4 h-4 mr-1" />Add item
                </Button>
              </div>
              <Table>
                <TableHeader><TableRow><TableHead>Description</TableHead><TableHead className="w-20">Qty</TableHead><TableHead className="w-32">Rate</TableHead><TableHead className="w-32">Amount</TableHead><TableHead className="w-10"></TableHead></TableRow></TableHeader>
                <TableBody>
                  {lineItems.map((li, i) => (
                    <TableRow key={i}>
                      <TableCell><Input value={li.description} onChange={e => updateLine(i, "description", e.target.value)} /></TableCell>
                      <TableCell><Input type="number" value={li.quantity} onChange={e => updateLine(i, "quantity", parseFloat(e.target.value) || 0)} /></TableCell>
                      <TableCell><Input type="number" step="0.01" value={li.rate} onChange={e => updateLine(i, "rate", parseFloat(e.target.value) || 0)} /></TableCell>
                      <TableCell className="font-medium">{formatMoney(li.amount, form.currency)}</TableCell>
                      <TableCell><Button size="icon" variant="ghost" onClick={() => setLineItems(lineItems.filter((_, x) => x !== i))}><Trash2 className="w-4 h-4" /></Button></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            <div className="grid md:grid-cols-2 gap-4">
              <div className="space-y-3">
                <div><Label>Notes</Label><Textarea rows={3} value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} /></div>
                <div><Label>Payment terms</Label><Input value={form.payment_terms} onChange={e => setForm({ ...form, payment_terms: e.target.value })} /></div>
              </div>
              <div className="space-y-2 bg-muted/30 rounded-lg p-4">
                <div className="flex justify-between"><span>Subtotal</span><span className="font-medium">{formatMoney(subtotal, form.currency)}</span></div>
                <div className="flex justify-between items-center gap-2">
                  <div className="flex items-center gap-2">Tax <Input type="number" step="0.01" className="w-20 h-7" value={form.tax_pct} onChange={e => setForm({ ...form, tax_pct: parseFloat(e.target.value) || 0 })} />%</div>
                  <span>{formatMoney(taxAmount, form.currency)}</span>
                </div>
                <div className="flex justify-between items-center gap-2">
                  <div className="flex items-center gap-2">VAT <Input type="number" step="0.01" className="w-20 h-7" value={form.vat_pct} onChange={e => setForm({ ...form, vat_pct: parseFloat(e.target.value) || 0 })} />%</div>
                  <span>{formatMoney(vatAmount, form.currency)}</span>
                </div>
                <div className="flex justify-between text-lg font-bold pt-2 border-t"><span>Total</span><span>{formatMoney(total, form.currency)}</span></div>
              </div>
            </div>
          </div>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSave} disabled={saving || loading}>
            {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
            {invoiceId ? "Save changes" : "Create invoice"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ClientCombobox({ clients, value, onChange }: { clients: any[]; value: string | null; onChange: (c: any | null) => void }) {
  const [open, setOpen] = useState(false);
  const selected = clients.find(c => c.id === value);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" role="combobox" className={cn("w-full justify-between font-normal", !selected && "text-muted-foreground")}>
          {selected ? selected.name : "Select client"}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
        <Command>
          <CommandInput placeholder="Search clients..." />
          <CommandList>
            <CommandEmpty>No clients found.</CommandEmpty>
            <CommandGroup>
              {clients.map(c => (
                <CommandItem key={c.id} value={`${c.name} ${c.contact_name || ""} ${c.contact_email || ""}`} onSelect={() => { onChange(c); setOpen(false); }}>
                  <Check className={cn("mr-2 h-4 w-4", value === c.id ? "opacity-100" : "opacity-0")} />
                  <div className="flex flex-col">
                    <span className="font-medium">{c.name}</span>
                    {(c.contact_name || c.contact_email) && (
                      <span className="text-xs text-muted-foreground">
                        {c.contact_name}{c.contact_name && c.contact_email ? " · " : ""}{c.contact_email}
                      </span>
                    )}
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
