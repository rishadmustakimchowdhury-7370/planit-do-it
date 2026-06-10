import { useEffect, useState } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { toast } from "@/hooks/use-toast";
import { SUPPORTED_CURRENCIES } from "@/lib/finance";
import { Loader2, Save, Banknote, Building2 } from "lucide-react";
import { Navigate } from "react-router-dom";

export default function FinanceSettingsPage() {
  const { tenantId, isOwner, isManager, isLoading: authLoading } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<any>({
    agency_name: "",
    agency_address: "",
    agency_phone: "",
    agency_email: "",
    agency_website: "",
    agency_logo_url: "",
    bank_name: "",
    bank_account_name: "",
    bank_account_number: "",
    bank_sort_code: "",
    bank_iban: "",
    bank_swift: "",
    default_currency: "USD",
    default_payment_terms_days: 14,
    default_tax_pct: 0,
    default_vat_pct: 0,
    invoice_number_prefix: "INV",
    invoice_footer_note: "",
  });

  useEffect(() => {
    if (!tenantId) return;
    (async () => {
      setLoading(true);
      const { data } = await supabase
        .from("finance_settings")
        .select("*")
        .eq("tenant_id", tenantId)
        .maybeSingle();
      if (data) setForm({ ...form, ...data });
      setLoading(false);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tenantId]);

  if (authLoading) return <AppLayout><div className="p-6"><Loader2 className="animate-spin" /></div></AppLayout>;
  if (!isOwner && !isManager) return <Navigate to="/dashboard" replace />;

  const handleSave = async () => {
    if (!tenantId) return;
    setSaving(true);
    const payload = { ...form, tenant_id: tenantId };
    const { error } = await supabase
      .from("finance_settings")
      .upsert(payload, { onConflict: "tenant_id" });
    setSaving(false);
    if (error) {
      toast({ title: "Save failed", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Finance settings saved" });
    }
  };

  const set = (k: string, v: any) => setForm((f: any) => ({ ...f, [k]: v }));

  return (
    <AppLayout>
      <div className="p-6 max-w-4xl mx-auto space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Finance Settings</h1>
          <p className="text-muted-foreground">Configure agency details, bank details and invoice defaults.</p>
        </div>

        {loading ? <Loader2 className="animate-spin" /> : (
          <>
            <Card>
              <CardHeader><CardTitle className="flex items-center gap-2"><Building2 className="w-5 h-5" />Agency Details</CardTitle></CardHeader>
              <CardContent className="grid md:grid-cols-2 gap-4">
                <div><Label>Agency name</Label><Input value={form.agency_name || ""} onChange={e => set("agency_name", e.target.value)} /></div>
                <div><Label>Email</Label><Input value={form.agency_email || ""} onChange={e => set("agency_email", e.target.value)} /></div>
                <div><Label>Phone</Label><Input value={form.agency_phone || ""} onChange={e => set("agency_phone", e.target.value)} /></div>
                <div><Label>Website</Label><Input value={form.agency_website || ""} onChange={e => set("agency_website", e.target.value)} /></div>
                <div className="md:col-span-2"><Label>Address</Label><Textarea rows={2} value={form.agency_address || ""} onChange={e => set("agency_address", e.target.value)} /></div>
                <div className="md:col-span-2"><Label>Logo URL</Label><Input value={form.agency_logo_url || ""} onChange={e => set("agency_logo_url", e.target.value)} placeholder="https://…" /></div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle className="flex items-center gap-2"><Banknote className="w-5 h-5" />Bank Details</CardTitle></CardHeader>
              <CardContent className="grid md:grid-cols-2 gap-4">
                <div><Label>Bank name</Label><Input value={form.bank_name || ""} onChange={e => set("bank_name", e.target.value)} /></div>
                <div><Label>Account name</Label><Input value={form.bank_account_name || ""} onChange={e => set("bank_account_name", e.target.value)} /></div>
                <div><Label>Account number</Label><Input value={form.bank_account_number || ""} onChange={e => set("bank_account_number", e.target.value)} /></div>
                <div><Label>Sort code</Label><Input value={form.bank_sort_code || ""} onChange={e => set("bank_sort_code", e.target.value)} /></div>
                <div><Label>IBAN</Label><Input value={form.bank_iban || ""} onChange={e => set("bank_iban", e.target.value)} /></div>
                <div><Label>SWIFT/BIC</Label><Input value={form.bank_swift || ""} onChange={e => set("bank_swift", e.target.value)} /></div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle>Invoice Defaults</CardTitle></CardHeader>
              <CardContent className="grid md:grid-cols-2 gap-4">
                <div>
                  <Label>Default currency</Label>
                  <Select value={form.default_currency} onValueChange={v => set("default_currency", v)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{SUPPORTED_CURRENCIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div><Label>Payment terms (days)</Label><Input type="number" value={form.default_payment_terms_days ?? 14} onChange={e => set("default_payment_terms_days", parseInt(e.target.value) || 0)} /></div>
                <div><Label>Default tax %</Label><Input type="number" step="0.01" value={form.default_tax_pct ?? 0} onChange={e => set("default_tax_pct", parseFloat(e.target.value) || 0)} /></div>
                <div><Label>Default VAT %</Label><Input type="number" step="0.01" value={form.default_vat_pct ?? 0} onChange={e => set("default_vat_pct", parseFloat(e.target.value) || 0)} /></div>
                <div><Label>Invoice number prefix</Label><Input value={form.invoice_number_prefix || "INV"} onChange={e => set("invoice_number_prefix", e.target.value)} /></div>
                <div className="md:col-span-2"><Label>Footer note (shown on every invoice)</Label><Textarea rows={2} value={form.invoice_footer_note || ""} onChange={e => set("invoice_footer_note", e.target.value)} /></div>
              </CardContent>
            </Card>

            <div className="flex justify-end">
              <Button onClick={handleSave} disabled={saving}>
                {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
                Save settings
              </Button>
            </div>
          </>
        )}
      </div>
    </AppLayout>
  );
}
