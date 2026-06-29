import { useEffect, useState } from 'react';
import { AdminLayout } from '@/components/admin/AdminLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Loader2, Plus, Save } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { EntitlementMatrix } from '@/components/admin/EntitlementMatrix';

interface Plan {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  price_monthly: number;
  price_yearly: number | null;
  currency: string | null;
  trial_days: number | null;
  display_order: number | null;
  is_active: boolean;
  is_featured: boolean | null;
  cta_label: string | null;
  stripe_product_id: string | null;
  stripe_price_id_monthly: string | null;
  stripe_price_id_yearly: string | null;
}

const empty: Partial<Plan> = {
  name: '',
  slug: '',
  description: '',
  price_monthly: 0,
  price_yearly: 0,
  currency: 'gbp',
  trial_days: 0,
  display_order: 99,
  is_active: true,
  is_featured: false,
  cta_label: 'Start Free Trial',
};

export default function AdminPlansPage() {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [draft, setDraft] = useState<Partial<Plan>>(empty);

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('subscription_plans').select('*').order('display_order').order('price_monthly');
    if (error) toast.error(error.message);
    else setPlans((data as Plan[]) ?? []);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const savePlan = async (p: Partial<Plan>) => {
    if (!p.name || !p.slug) return toast.error('Name and slug required');
    setSaving(p.id ?? 'new');
    const payload: any = {
      _id: p.id ?? null,
      _name: p.name,
      _slug: p.slug,
      _description: p.description ?? null,
      _price_monthly: Number(p.price_monthly) || 0,
      _price_yearly: p.price_yearly != null ? Number(p.price_yearly) : null,
      _currency: p.currency || 'gbp',
      _trial_days: p.trial_days != null ? Number(p.trial_days) : 0,
      _display_order: p.display_order ?? 99,
      _is_active: p.is_active ?? true,
      _is_featured: p.is_featured ?? false,
      _cta_label: p.cta_label ?? 'Start Free Trial',
      _stripe_product_id: p.stripe_product_id ?? null,
      _stripe_price_id_monthly: p.stripe_price_id_monthly ?? null,
      _stripe_price_id_yearly: p.stripe_price_id_yearly ?? null,
    };
    const { error } = await supabase.rpc('admin_upsert_plan', payload);
    setSaving(null);
    if (error) {
      // Fallback to direct upsert if RPC missing
      const direct = await supabase.from('subscription_plans').upsert({
        id: p.id ?? undefined,
        name: p.name, slug: p.slug, description: p.description,
        price_monthly: Number(p.price_monthly) || 0,
        price_yearly: p.price_yearly != null ? Number(p.price_yearly) : null,
        currency: p.currency, trial_days: p.trial_days, display_order: p.display_order,
        is_active: p.is_active, is_featured: p.is_featured, cta_label: p.cta_label,
        stripe_product_id: p.stripe_product_id,
        stripe_price_id_monthly: p.stripe_price_id_monthly,
        stripe_price_id_yearly: p.stripe_price_id_yearly,
      } as any);
      if (direct.error) return toast.error(direct.error.message);
    }
    toast.success('Plan saved');
    setDraft(empty);
    load();
  };

  const renderEditor = (p: Partial<Plan>, isNew: boolean) => (
    <div className="grid md:grid-cols-2 gap-4">
      <div><Label>Name</Label><Input value={p.name ?? ''} onChange={e => setDraft({ ...p, name: e.target.value })} /></div>
      <div><Label>Slug</Label><Input value={p.slug ?? ''} onChange={e => setDraft({ ...p, slug: e.target.value })} /></div>
      <div><Label>Monthly Price</Label><Input type="number" step="0.01" value={p.price_monthly ?? 0} onChange={e => setDraft({ ...p, price_monthly: parseFloat(e.target.value) })} /></div>
      <div><Label>Yearly Price</Label><Input type="number" step="0.01" value={p.price_yearly ?? 0} onChange={e => setDraft({ ...p, price_yearly: parseFloat(e.target.value) })} /></div>
      <div><Label>Currency</Label><Input value={p.currency ?? 'gbp'} onChange={e => setDraft({ ...p, currency: e.target.value })} /></div>
      <div><Label>Trial Days</Label><Input type="number" value={p.trial_days ?? 0} onChange={e => setDraft({ ...p, trial_days: parseInt(e.target.value) })} /></div>
      <div><Label>Display Order</Label><Input type="number" value={p.display_order ?? 99} onChange={e => setDraft({ ...p, display_order: parseInt(e.target.value) })} /></div>
      <div><Label>CTA Label</Label><Input value={p.cta_label ?? ''} onChange={e => setDraft({ ...p, cta_label: e.target.value })} /></div>
      <div><Label>Stripe Product ID</Label><Input value={p.stripe_product_id ?? ''} onChange={e => setDraft({ ...p, stripe_product_id: e.target.value })} /></div>
      <div><Label>Stripe Monthly Price ID</Label><Input value={p.stripe_price_id_monthly ?? ''} onChange={e => setDraft({ ...p, stripe_price_id_monthly: e.target.value })} /></div>
      <div><Label>Stripe Yearly Price ID</Label><Input value={p.stripe_price_id_yearly ?? ''} onChange={e => setDraft({ ...p, stripe_price_id_yearly: e.target.value })} /></div>
      <div className="md:col-span-2"><Label>Description</Label><Textarea rows={2} value={p.description ?? ''} onChange={e => setDraft({ ...p, description: e.target.value })} /></div>
      <div className="flex items-center gap-3"><Switch checked={!!p.is_active} onCheckedChange={v => setDraft({ ...p, is_active: v })} /><Label>Active</Label></div>
      <div className="flex items-center gap-3"><Switch checked={!!p.is_featured} onCheckedChange={v => setDraft({ ...p, is_featured: v })} /><Label>Featured</Label></div>
      <div className="md:col-span-2">
        <Button onClick={() => savePlan(p)} disabled={saving === (p.id ?? 'new')}>
          {saving === (p.id ?? 'new') ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
          {isNew ? 'Create Plan' : 'Save Changes'}
        </Button>
      </div>
    </div>
  );

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Subscription Plans</h1>
          <p className="text-muted-foreground text-sm">Edit pricing, trials, Stripe IDs and feature matrix. All values are read live by the pricing page.</p>
        </div>

        <Tabs defaultValue="plans">
          <TabsList>
            <TabsTrigger value="plans">Plans</TabsTrigger>
            <TabsTrigger value="features">Feature Matrix</TabsTrigger>
            <TabsTrigger value="new">+ New Plan</TabsTrigger>
          </TabsList>

          <TabsContent value="plans" className="space-y-4 mt-4">
            {loading ? <Loader2 className="h-6 w-6 animate-spin" /> : plans.map(p => (
              <Card key={p.id}>
                <CardHeader className="flex flex-row items-center justify-between">
                  <CardTitle className="flex items-center gap-2">
                    {p.name}
                    {p.is_featured && <Badge className="bg-amber-500">Featured</Badge>}
                    {!p.is_active && <Badge variant="secondary">Inactive</Badge>}
                  </CardTitle>
                  <div className="text-sm text-muted-foreground">
                    {p.currency?.toUpperCase()} {p.price_monthly}/mo · {p.price_yearly ?? '—'}/yr
                  </div>
                </CardHeader>
                <CardContent>{renderEditor(p, false)}</CardContent>
              </Card>
            ))}
          </TabsContent>

          <TabsContent value="features" className="mt-4">
            <EntitlementMatrix />
          </TabsContent>

          <TabsContent value="new" className="mt-4">
            <Card>
              <CardHeader><CardTitle className="flex items-center gap-2"><Plus className="h-5 w-5" />New Plan</CardTitle></CardHeader>
              <CardContent>{renderEditor(draft, true)}</CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </AdminLayout>
  );
}
