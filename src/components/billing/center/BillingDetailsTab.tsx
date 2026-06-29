import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Loader2, Save } from 'lucide-react';
import { useTenantBillingDetails, TenantBillingDetails } from '@/hooks/useBillingCenter';
import { toast } from 'sonner';

const fields: { key: keyof TenantBillingDetails; label: string; type?: string; col?: number }[] = [
  { key: 'company_name', label: 'Company Name' },
  { key: 'billing_email', label: 'Billing Email', type: 'email' },
  { key: 'vat_number', label: 'VAT Number' },
  { key: 'tax_number', label: 'Tax Number' },
  { key: 'address_line1', label: 'Address Line 1', col: 2 },
  { key: 'address_line2', label: 'Address Line 2', col: 2 },
  { key: 'city', label: 'City' },
  { key: 'region', label: 'Region / State' },
  { key: 'postal_code', label: 'Postal Code' },
  { key: 'country', label: 'Country' },
  { key: 'currency', label: 'Currency' },
  { key: 'timezone', label: 'Timezone' },
];

export function BillingDetailsTab() {
  const { details, loading, save } = useTenantBillingDetails();
  const [form, setForm] = useState<Partial<TenantBillingDetails>>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => { if (details) setForm(details); }, [details]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try { await save(form); toast.success('Billing details saved'); }
    catch (err: any) { toast.error(err?.message ?? 'Failed to save'); }
    finally { setSaving(false); }
  };

  if (loading) return <Skeleton className="h-96" />;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Workspace Billing Details</CardTitle>
        <CardDescription>Used on invoices and tax documents.</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={submit} className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {fields.map(f => (
            <div key={f.key} className={f.col === 2 ? 'md:col-span-2' : ''}>
              <Label className="text-xs">{f.label}</Label>
              <Input
                type={f.type ?? 'text'}
                value={(form[f.key] as any) ?? ''}
                onChange={e => setForm(prev => ({ ...prev, [f.key]: e.target.value }))}
              />
            </div>
          ))}
          <div className="md:col-span-2 flex justify-end">
            <Button type="submit" disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Save changes
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
