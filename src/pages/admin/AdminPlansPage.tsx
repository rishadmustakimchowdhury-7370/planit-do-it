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
import { Loader2, Plus, Save, Copy, Archive, Trash2, AlertTriangle } from 'lucide-react';
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
  yearly_discount_percentage: number | null;
  currency: string | null;
  trial_days: number | null;
  yearly_trial_days: number | null;
  display_order: number | null;
  is_active: boolean;
  is_archived: boolean;
  highlighted: boolean;
  popular: boolean;
  enterprise: boolean;
  is_featured: boolean | null;
  cta_label: string | null;
  button_url: string | null;
  badge: string | null;
  icon: string | null;
  color: string | null;
  stripe_product_id: string | null;
  stripe_price_id_monthly: string | null;
  stripe_price_id_yearly: string | null;
  show_on_pricing: boolean;
}

const empty: Partial<Plan> = {
  name: '',
  slug: '',
  description: '',
  price_monthly: 0,
  price_yearly: 0,
  yearly_discount_percentage: 0,
  currency: 'USD',
  trial_days: 0,
  yearly_trial_days: 0,
  display_order: 99,
  is_active: true,
  is_archived: false,
  highlighted: false,
  popular: false,
  enterprise: false,
  cta_label: 'Get started',
  show_on_pricing: true,
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
    else setPlans((data as unknown as Plan[]) ?? []);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const savePlan = async (p: Partial<Plan>) => {
    if (!p.name || !p.slug) return toast.error('Name and slug required');
    setSaving(p.id ?? 'new');
    const payload = {
      id: p.id ?? undefined,
      name: p.name,
      slug: p.slug,
      description: p.description ?? null,
      price_monthly: Number(p.price_monthly) || 0,
      price_yearly: p.price_yearly != null && p.price_yearly !== 0 ? Number(p.price_yearly) : null,
      yearly_discount_percentage: p.yearly_discount_percentage != null ? Number(p.yearly_discount_percentage) : 0,
      currency: (p.currency || 'USD').toUpperCase(),
      trial_days: p.trial_days != null ? Number(p.trial_days) : 0,
      yearly_trial_days: p.yearly_trial_days != null ? Number(p.yearly_trial_days) : 0,
      display_order: p.display_order ?? 99,
      is_active: p.is_active ?? true,
      is_archived: p.is_archived ?? false,
      highlighted: p.highlighted ?? false,
      popular: p.popular ?? false,
      enterprise: p.enterprise ?? false,
      cta_label: p.cta_label ?? 'Get started',
      button_url: p.button_url ?? null,
      badge: p.badge ?? null,
      icon: p.icon ?? null,
      color: p.color ?? null,
      stripe_product_id: p.stripe_product_id ?? null,
      stripe_price_id_monthly: p.stripe_price_id_monthly ?? null,
      stripe_price_id_yearly: p.stripe_price_id_yearly ?? null,
      show_on_pricing: p.show_on_pricing ?? true,
    };
    const { error } = await supabase.from('subscription_plans').upsert(payload as never);
    setSaving(null);
    if (error) return toast.error(error.message);
    toast.success('Plan saved');
    setDraft(empty);
    load();
  };

  const duplicatePlan = async (p: Plan) => {
    const clone = { ...p, id: undefined, name: `${p.name} (copy)`, slug: `${p.slug}-copy-${Date.now().toString(36)}` };
    await savePlan(clone);
  };

  const togglePlanFlag = async (id: string, patch: Partial<Plan>) => {
    const { error } = await supabase.from('subscription_plans').update(patch as never).eq('id', id);
    if (error) return toast.error(error.message);
    load();
  };

  const deletePlan = async (id: string) => {
    if (!confirm('Delete this plan permanently? Consider archiving instead.')) return;
    const { error } = await supabase.from('subscription_plans').delete().eq('id', id);
    if (error) return toast.error(error.message);
    toast.success('Plan deleted');
    load();
  };

  const renderEditor = (p: Partial<Plan>, isNew: boolean) => {
    const set = (patch: Partial<Plan>) => (isNew ? setDraft({ ...p, ...patch }) : setPlans(plans.map(x => (x.id === p.id ? ({ ...x, ...patch } as Plan) : x))));
    const missingMonthlyStripe = !isNew && (p.price_monthly ?? 0) > 0 && !p.stripe_price_id_monthly;
    const missingYearlyStripe = !isNew && (p.price_yearly ?? 0) > 0 && !p.stripe_price_id_yearly;
    return (
      <div className="grid md:grid-cols-2 gap-4">
        <div><Label>Name</Label><Input value={p.name ?? ''} onChange={e => set({ name: e.target.value })} /></div>
        <div><Label>Slug</Label><Input value={p.slug ?? ''} onChange={e => set({ slug: e.target.value })} /></div>
        <div><Label>Monthly Price</Label><Input type="number" step="0.01" value={p.price_monthly ?? 0} onChange={e => set({ price_monthly: parseFloat(e.target.value) })} /></div>
        <div><Label>Yearly Price</Label><Input type="number" step="0.01" value={p.price_yearly ?? 0} onChange={e => set({ price_yearly: parseFloat(e.target.value) })} /></div>
        <div><Label>Yearly Discount %</Label><Input type="number" step="1" value={p.yearly_discount_percentage ?? 0} onChange={e => set({ yearly_discount_percentage: parseFloat(e.target.value) })} /></div>
        <div><Label>Currency (ISO)</Label><Input value={p.currency ?? 'USD'} onChange={e => set({ currency: e.target.value })} /></div>
        <div><Label>Monthly Trial Days</Label><Input type="number" value={p.trial_days ?? 0} onChange={e => set({ trial_days: parseInt(e.target.value) })} /></div>
        <div><Label>Yearly Trial Days</Label><Input type="number" value={p.yearly_trial_days ?? 0} onChange={e => set({ yearly_trial_days: parseInt(e.target.value) })} /></div>
        <div><Label>Display Order</Label><Input type="number" value={p.display_order ?? 99} onChange={e => set({ display_order: parseInt(e.target.value) })} /></div>
        <div><Label>Button Text</Label><Input value={p.cta_label ?? ''} onChange={e => set({ cta_label: e.target.value })} /></div>
        <div><Label>Button URL (blank → /checkout)</Label><Input value={p.button_url ?? ''} onChange={e => set({ button_url: e.target.value })} placeholder="/checkout?plan=slug" /></div>
        <div><Label>Badge (e.g. New, Beta)</Label><Input value={p.badge ?? ''} onChange={e => set({ badge: e.target.value })} /></div>
        <div><Label>Icon (lucide name)</Label><Input value={p.icon ?? ''} onChange={e => set({ icon: e.target.value })} placeholder="Sparkles" /></div>
        <div><Label>Accent Color</Label><Input value={p.color ?? ''} onChange={e => set({ color: e.target.value })} placeholder="#182C6F" /></div>
        <div><Label>Stripe Product ID</Label><Input value={p.stripe_product_id ?? ''} onChange={e => set({ stripe_product_id: e.target.value })} /></div>
        <div>
          <Label>Stripe Monthly Price ID {missingMonthlyStripe && <Badge variant="destructive" className="ml-2 text-[10px]"><AlertTriangle className="h-3 w-3 mr-1" />Missing</Badge>}</Label>
          <Input value={p.stripe_price_id_monthly ?? ''} onChange={e => set({ stripe_price_id_monthly: e.target.value })} />
        </div>
        <div>
          <Label>Stripe Yearly Price ID {missingYearlyStripe && <Badge variant="destructive" className="ml-2 text-[10px]"><AlertTriangle className="h-3 w-3 mr-1" />Missing</Badge>}</Label>
          <Input value={p.stripe_price_id_yearly ?? ''} onChange={e => set({ stripe_price_id_yearly: e.target.value })} />
        </div>
        <div className="md:col-span-2"><Label>Description</Label><Textarea rows={2} value={p.description ?? ''} onChange={e => set({ description: e.target.value })} /></div>

        <div className="md:col-span-2 grid grid-cols-2 md:grid-cols-5 gap-3 py-2 border-t border-b">
          <label className="flex items-center gap-2 text-sm"><Switch checked={!!p.is_active} onCheckedChange={v => set({ is_active: v })} /> Active</label>
          <label className="flex items-center gap-2 text-sm"><Switch checked={!!p.highlighted} onCheckedChange={v => set({ highlighted: v })} /> Highlighted</label>
          <label className="flex items-center gap-2 text-sm"><Switch checked={!!p.popular} onCheckedChange={v => set({ popular: v })} /> Popular</label>
          <label className="flex items-center gap-2 text-sm"><Switch checked={!!p.enterprise} onCheckedChange={v => set({ enterprise: v })} /> Enterprise</label>
          <label className="flex items-center gap-2 text-sm"><Switch checked={!!p.show_on_pricing} onCheckedChange={v => set({ show_on_pricing: v })} /> On pricing page</label>
        </div>

        <div className="md:col-span-2 flex gap-2 flex-wrap">
          <Button onClick={() => savePlan(p)} disabled={saving === (p.id ?? 'new')}>
            {saving === (p.id ?? 'new') ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
            {isNew ? 'Create Plan' : 'Save Changes'}
          </Button>
          {!isNew && p.id && (
            <>
              <Button variant="outline" onClick={() => duplicatePlan(p as Plan)}><Copy className="h-4 w-4 mr-2" />Duplicate</Button>
              <Button variant="outline" onClick={() => togglePlanFlag(p.id!, { is_archived: !p.is_archived })}>
                <Archive className="h-4 w-4 mr-2" />{p.is_archived ? 'Unarchive' : 'Archive'}
              </Button>
              <Button variant="destructive" onClick={() => deletePlan(p.id!)}><Trash2 className="h-4 w-4 mr-2" />Delete</Button>
            </>
          )}
        </div>
      </div>
    );
  };

  return (
    <AdminLayout title="Pricing Management">
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Pricing Management</h1>
          <p className="text-muted-foreground text-sm">
            Every field here powers the public homepage, checkout, billing center, and feature gating in real time.
          </p>
        </div>

        <Tabs defaultValue="plans">
          <TabsList>
            <TabsTrigger value="plans">Plans</TabsTrigger>
            <TabsTrigger value="features">Feature Matrix</TabsTrigger>
            <TabsTrigger value="new">+ New Plan</TabsTrigger>
          </TabsList>

          <TabsContent value="plans" className="space-y-4 mt-4">
            {loading ? <Loader2 className="h-6 w-6 animate-spin" /> : plans.map(p => (
              <Card key={p.id} className={p.is_archived ? 'opacity-60' : ''}>
                <CardHeader className="flex flex-row items-center justify-between flex-wrap gap-2">
                  <CardTitle className="flex items-center gap-2 flex-wrap">
                    {p.name}
                    {p.badge && <Badge>{p.badge}</Badge>}
                    {p.highlighted && <Badge className="bg-amber-500">Highlighted</Badge>}
                    {p.popular && <Badge className="bg-emerald-600">Popular</Badge>}
                    {p.enterprise && <Badge variant="outline">Enterprise</Badge>}
                    {!p.is_active && <Badge variant="secondary">Inactive</Badge>}
                    {p.is_archived && <Badge variant="destructive">Archived</Badge>}
                  </CardTitle>
                  <div className="text-sm text-muted-foreground">
                    {(p.currency ?? 'USD').toUpperCase()} {p.price_monthly}/mo · {p.price_yearly ?? '—'}/yr
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
