import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Loader2, Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';

interface Feature {
  id: string;
  feature_key: string;
  feature_name: string;
  description: string | null;
  category: string | null;
  sort_order: number;
  unit: string | null;
  icon: string | null;
  default_limit: number | null;
  is_ai: boolean;
  is_archived: boolean;
}
interface Plan { id: string; name: string; slug: string; price_monthly: number; }
interface Mapping {
  id?: string;
  plan_id: string;
  feature_id: string;
  enabled: boolean;
  unlimited: boolean;
  monthly_limit: number | null;
  yearly_limit: number | null;
  custom_label: string | null;
  display_order: number;
}

const emptyCell = (plan_id: string, feature_id: string): Mapping => ({
  plan_id, feature_id, enabled: false, unlimited: false,
  monthly_limit: null, yearly_limit: null, custom_label: null, display_order: 0,
});

export function EntitlementMatrix() {
  const [features, setFeatures] = useState<Feature[]>([]);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [matrix, setMatrix] = useState<Record<string, Mapping>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);

  const [newOpen, setNewOpen] = useState(false);
  const [nf, setNf] = useState({
    feature_key: '', feature_name: '', description: '', category: 'general',
    unit: '', icon: '', default_limit: '', is_ai: false,
  });

  const key = (planId: string, featureId: string) => `${planId}:${featureId}`;

  const load = async () => {
    setLoading(true);
    const [f, p, m] = await Promise.all([
      supabase.from('subscription_features').select('*').order('sort_order'),
      supabase.from('subscription_plans').select('id,name,slug,price_monthly').eq('is_archived', false).order('display_order').order('price_monthly'),
      supabase.from('subscription_plan_features').select('*'),
    ]);
    if (f.error || p.error || m.error) {
      toast.error('Failed to load entitlements');
    } else {
      setFeatures((f.data as unknown as Feature[]) ?? []);
      setPlans((p.data as unknown as Plan[]) ?? []);
      const map: Record<string, Mapping> = {};
      ((m.data as unknown as Mapping[]) ?? []).forEach(row => { map[key(row.plan_id, row.feature_id)] = row; });
      setMatrix(map);
    }
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const upsertCell = async (planId: string, featureId: string, patch: Partial<Mapping>) => {
    const k = key(planId, featureId);
    const existing = matrix[k] ?? emptyCell(planId, featureId);
    const next: Mapping = { ...existing, ...patch };
    setMatrix(prev => ({ ...prev, [k]: next }));
    setSaving(k);
    const { error } = await supabase
      .from('subscription_plan_features')
      .upsert({
        plan_id: planId,
        feature_id: featureId,
        enabled: next.enabled,
        unlimited: next.unlimited,
        monthly_limit: next.monthly_limit,
        yearly_limit: next.yearly_limit,
        custom_label: next.custom_label,
        display_order: next.display_order,
        // Legacy column: keep in sync so older enforcement paths still work
        limit_value: next.unlimited ? null : next.monthly_limit,
      }, { onConflict: 'plan_id,feature_id' } as never);
    setSaving(null);
    if (error) { toast.error(error.message); load(); }
  };

  const createFeature = async () => {
    if (!nf.feature_key || !nf.feature_name) return;
    const { error } = await supabase.from('subscription_features').insert({
      feature_key: nf.feature_key,
      feature_name: nf.feature_name,
      description: nf.description || null,
      category: nf.category || null,
      unit: nf.unit || null,
      icon: nf.icon || null,
      default_limit: nf.default_limit ? Number(nf.default_limit) : null,
      is_ai: nf.is_ai,
      sort_order: (features.length ? features[features.length - 1].sort_order : 0) + 10,
    } as never);
    if (error) return toast.error(error.message);
    setNewOpen(false);
    setNf({ feature_key: '', feature_name: '', description: '', category: 'general', unit: '', icon: '', default_limit: '', is_ai: false });
    load();
  };

  const patchFeature = async (id: string, patch: Partial<Feature>) => {
    const { error } = await supabase.from('subscription_features').update(patch as never).eq('id', id);
    if (error) return toast.error(error.message);
    load();
  };

  const deleteFeature = async (id: string) => {
    if (!confirm('Delete this feature for all plans?')) return;
    const { error } = await supabase.from('subscription_features').delete().eq('id', id);
    if (error) return toast.error(error.message);
    load();
  };

  if (loading) {
    return <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin" /></div>;
  }

  // Group by category
  const grouped = new Map<string, Feature[]>();
  features.filter(f => !f.is_archived).forEach(f => {
    const c = f.category ?? 'other';
    if (!grouped.has(c)) grouped.set(c, []);
    grouped.get(c)!.push(f);
  });

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Feature Matrix</CardTitle>
        <Dialog open={newOpen} onOpenChange={setNewOpen}>
          <DialogTrigger asChild>
            <Button size="sm"><Plus className="h-4 w-4 mr-2" />Add Feature</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>New Feature</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div><Label>Key</Label><Input value={nf.feature_key} onChange={e => setNf({ ...nf, feature_key: e.target.value })} placeholder="e.g. ai_matching" /></div>
              <div><Label>Display Name</Label><Input value={nf.feature_name} onChange={e => setNf({ ...nf, feature_name: e.target.value })} /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Category</Label><Input value={nf.category} onChange={e => setNf({ ...nf, category: e.target.value })} /></div>
                <div><Label>Unit</Label><Input value={nf.unit} onChange={e => setNf({ ...nf, unit: e.target.value })} placeholder="searches / GB / seats" /></div>
                <div><Label>Icon (lucide)</Label><Input value={nf.icon} onChange={e => setNf({ ...nf, icon: e.target.value })} /></div>
                <div><Label>Default Limit</Label><Input type="number" value={nf.default_limit} onChange={e => setNf({ ...nf, default_limit: e.target.value })} placeholder="blank = unlimited" /></div>
              </div>
              <label className="flex items-center gap-2 text-sm"><Switch checked={nf.is_ai} onCheckedChange={v => setNf({ ...nf, is_ai: v })} /> AI feature</label>
              <div><Label>Description</Label><Textarea value={nf.description} onChange={e => setNf({ ...nf, description: e.target.value })} /></div>
              <Button onClick={createFeature} className="w-full">Create</Button>
            </div>
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b">
              <th className="text-left p-2 min-w-[240px]">Feature</th>
              {plans.map(p => (
                <th key={p.id} className="text-center p-2 min-w-[180px]">
                  {p.name}<div className="text-xs text-muted-foreground">${p.price_monthly}/mo</div>
                </th>
              ))}
              <th className="w-10"></th>
            </tr>
          </thead>
          <tbody>
            {Array.from(grouped.entries()).map(([cat, rows]) => (
              <>
                <tr key={`cat-${cat}`} className="bg-muted/40">
                  <td colSpan={plans.length + 2} className="p-2 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">{cat}</td>
                </tr>
                {rows.map(f => (
                  <tr key={f.id} className="border-b align-middle">
                    <td className="p-2">
                      <div className="font-medium flex items-center gap-2">
                        <input
                          className="bg-transparent border-b border-transparent hover:border-input focus:border-primary focus:outline-none"
                          defaultValue={f.feature_name}
                          onBlur={e => e.target.value !== f.feature_name && patchFeature(f.id, { feature_name: e.target.value })}
                        />
                        {f.is_ai && <span className="text-[10px] px-1.5 py-0.5 rounded bg-primary/10 text-primary">AI</span>}
                      </div>
                      <div className="text-xs text-muted-foreground">{f.feature_key}{f.unit ? ` • ${f.unit}` : ''}</div>
                    </td>
                    {plans.map(p => {
                      const cell = matrix[key(p.id, f.id)] ?? emptyCell(p.id, f.id);
                      return (
                        <td key={p.id} className="p-2 text-center">
                          <div className="flex flex-col items-center gap-1">
                            <div className="flex items-center gap-2">
                              <Switch
                                checked={cell.enabled}
                                onCheckedChange={(v) => upsertCell(p.id, f.id, { enabled: v })}
                              />
                              <label className="text-[10px] text-muted-foreground flex items-center gap-1">
                                <Switch
                                  checked={cell.unlimited}
                                  onCheckedChange={(v) => upsertCell(p.id, f.id, { unlimited: v })}
                                />
                                ∞
                              </label>
                            </div>
                            <div className="flex gap-1">
                              <Input
                                type="number" placeholder="/mo"
                                className="h-7 w-16 text-center text-xs"
                                value={cell.monthly_limit ?? ''}
                                onChange={(e) => {
                                  const v = e.target.value === '' ? null : parseFloat(e.target.value);
                                  upsertCell(p.id, f.id, { monthly_limit: Number.isNaN(v as number) ? null : v });
                                }}
                                disabled={!cell.enabled || cell.unlimited}
                              />
                              <Input
                                type="number" placeholder="/yr"
                                className="h-7 w-16 text-center text-xs"
                                value={cell.yearly_limit ?? ''}
                                onChange={(e) => {
                                  const v = e.target.value === '' ? null : parseFloat(e.target.value);
                                  upsertCell(p.id, f.id, { yearly_limit: Number.isNaN(v as number) ? null : v });
                                }}
                                disabled={!cell.enabled || cell.unlimited}
                              />
                            </div>
                            <Input
                              placeholder="Custom label"
                              className="h-6 w-32 text-[10px]"
                              value={cell.custom_label ?? ''}
                              onChange={e => upsertCell(p.id, f.id, { custom_label: e.target.value || null })}
                              disabled={!cell.enabled}
                            />
                          </div>
                        </td>
                      );
                    })}
                    <td className="p-2">
                      <Button size="icon" variant="ghost" onClick={() => deleteFeature(f.id)}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </td>
                  </tr>
                ))}
              </>
            ))}
          </tbody>
        </table>
        <p className="text-xs text-muted-foreground mt-3">
          Toggle ∞ for unlimited. Leave monthly/yearly blank to fall back to the catalog default. Changes save automatically{saving ? ' • saving…' : ''}.
        </p>
      </CardContent>
    </Card>
  );
}
