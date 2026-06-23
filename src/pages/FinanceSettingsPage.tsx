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
import { Loader2, Save, Banknote, Building2, Upload, X } from "lucide-react";
import { Navigate } from "react-router-dom";

const LOGO_BUCKET = "branding-assets";
const MAX_LOGO_BYTES = 5 * 1024 * 1024;
const ALLOWED_LOGO_TYPES = ["image/png", "image/jpeg", "image/jpg", "image/svg+xml", "image/webp"];

export default function FinanceSettingsPage() {
  const { tenantId, isOwner, isManager, isLoading: authLoading } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);
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
        .select("id, tenant_id, agency_name, agency_address, agency_phone, agency_email, agency_website, agency_logo_url, bank_name, default_currency, default_payment_terms_days, default_tax_pct, default_vat_pct, invoice_number_prefix, invoice_footer_note")
        .eq("tenant_id", tenantId)
        .maybeSingle();
      let merged: any = data || {};
      if (isOwner) {
        const { data: bank } = await (supabase as any).rpc("get_finance_bank_details", { _tenant_id: tenantId });
        if (bank) merged = { ...merged, ...bank };
      } else {
        merged = {
          ...merged,
          bank_account_name: "••••••",
          bank_account_number: "••••••",
          bank_sort_code: "••••",
          bank_iban: "•••• •••• •••• ••••",
          bank_swift: "••••••",
        };
      }
      setForm((f: any) => ({ ...f, ...merged }));
      setLoading(false);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tenantId, isOwner]);

  if (authLoading) return <AppLayout><div className="p-6"><Loader2 className="animate-spin" /></div></AppLayout>;
  if (!isOwner && !isManager) return <Navigate to="/dashboard" replace />;

  const handleSave = async () => {
    if (!tenantId) return;
    setSaving(true);
    const nonSensitive: any = {
      tenant_id: tenantId,
      agency_name: form.agency_name,
      agency_address: form.agency_address,
      agency_phone: form.agency_phone,
      agency_email: form.agency_email,
      agency_website: form.agency_website,
      agency_logo_url: form.agency_logo_url,
      bank_name: form.bank_name,
      default_currency: form.default_currency,
      default_payment_terms_days: form.default_payment_terms_days,
      default_tax_pct: form.default_tax_pct,
      default_vat_pct: form.default_vat_pct,
      invoice_number_prefix: form.invoice_number_prefix,
      invoice_footer_note: form.invoice_footer_note,
    };
    const { error } = await supabase
      .from("finance_settings")
      .upsert(nonSensitive, { onConflict: "tenant_id" });

    let bankErr: any = null;
    if (isOwner) {
      const { error: e2 } = await (supabase as any).rpc("upsert_finance_bank_details", {
        _tenant_id: tenantId,
        _bank_name: form.bank_name || null,
        _bank_account_name: form.bank_account_name || null,
        _bank_account_number: form.bank_account_number || null,
        _bank_sort_code: form.bank_sort_code || null,
        _bank_iban: form.bank_iban || null,
        _bank_swift: form.bank_swift || null,
      });
      bankErr = e2;
    }
    setSaving(false);
    if (error || bankErr) {
      toast({ title: "Save failed", description: (error || bankErr)?.message, variant: "destructive" });
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
                <div className="md:col-span-2">
                  <Label>Company Logo</Label>
                  <div className="flex items-start gap-4 mt-2">
                    {form.agency_logo_url ? (
                      <div className="relative w-32 h-32 rounded-lg border bg-muted/30 flex items-center justify-center overflow-hidden">
                        <img src={form.agency_logo_url} alt="Logo" className="max-w-full max-h-full object-contain" />
                        <button
                          type="button"
                          onClick={() => set("agency_logo_url", "")}
                          className="absolute top-1 right-1 bg-background/90 hover:bg-background border rounded-full p-1"
                          aria-label="Remove logo"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    ) : (
                      <div className="w-32 h-32 rounded-lg border-2 border-dashed bg-muted/20 flex items-center justify-center text-xs text-muted-foreground">
                        No logo
                      </div>
                    )}
                    <div className="flex-1">
                      <input
                        id="logo-upload"
                        type="file"
                        accept="image/png,image/jpeg,image/svg+xml,image/webp"
                        className="hidden"
                        onChange={async (e) => {
                          const file = e.target.files?.[0];
                          e.target.value = "";
                          if (!file || !tenantId) return;
                          if (!ALLOWED_LOGO_TYPES.includes(file.type)) {
                            toast({ title: "Unsupported file type", description: "Use PNG, JPG, SVG or WEBP.", variant: "destructive" });
                            return;
                          }
                          if (file.size > MAX_LOGO_BYTES) {
                            toast({ title: "File too large", description: "Max 5MB.", variant: "destructive" });
                            return;
                          }
                          setUploadingLogo(true);
                          const ext = file.name.split(".").pop() || "png";
                          const path = `finance-logos/${tenantId}/${Date.now()}.${ext}`;
                          const { error: upErr } = await supabase.storage.from(LOGO_BUCKET).upload(path, file, { upsert: true, contentType: file.type });
                          if (upErr) {
                            setUploadingLogo(false);
                            toast({ title: "Upload failed", description: upErr.message, variant: "destructive" });
                            return;
                          }
                          const { data: pub } = supabase.storage.from(LOGO_BUCKET).getPublicUrl(path);
                          set("agency_logo_url", pub.publicUrl);
                          setUploadingLogo(false);
                          toast({ title: "Logo uploaded" });
                        }}
                      />
                      <Button type="button" variant="outline" disabled={uploadingLogo} onClick={() => document.getElementById("logo-upload")?.click()}>
                        {uploadingLogo ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Upload className="w-4 h-4 mr-2" />}
                        {form.agency_logo_url ? "Replace logo" : "Upload logo"}
                      </Button>
                      <p className="text-xs text-muted-foreground mt-2">PNG, JPG, SVG or WEBP · Max 5MB. Appears on invoices and emails.</p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle className="flex items-center gap-2"><Banknote className="w-5 h-5" />Bank Details</CardTitle></CardHeader>
              <CardContent className="grid md:grid-cols-2 gap-4">
                <div><Label>Bank name</Label><Input value={form.bank_name || ""} onChange={e => set("bank_name", e.target.value)} /></div>
                <div><Label>Account name</Label><Input disabled={!isOwner} value={form.bank_account_name || ""} onChange={e => set("bank_account_name", e.target.value)} /></div>
                <div><Label>Account number</Label><Input disabled={!isOwner} value={form.bank_account_number || ""} onChange={e => set("bank_account_number", e.target.value)} /></div>
                <div><Label>Sort code</Label><Input disabled={!isOwner} value={form.bank_sort_code || ""} onChange={e => set("bank_sort_code", e.target.value)} /></div>
                <div><Label>IBAN</Label><Input disabled={!isOwner} value={form.bank_iban || ""} onChange={e => set("bank_iban", e.target.value)} /></div>
                <div><Label>SWIFT/BIC</Label><Input disabled={!isOwner} value={form.bank_swift || ""} onChange={e => set("bank_swift", e.target.value)} /></div>
                {!isOwner && <p className="md:col-span-2 text-xs text-muted-foreground">Bank details are masked. Only Owners can view or edit them.</p>}
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
