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
}
interface Plan { id: string; name: string; slug: string; price_monthly: number; }
interface Mapping {
  id?: string;
  plan_id: string;
  feature_id: string;
  enabled: boolean;
  limit_value: number | null;
}

export function EntitlementMatrix() {
  const [features, setFeatures] = useState<Feature[]>([]);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [matrix, setMatrix] = useState<Record<string, Mapping>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);

  // new feature dialog
  const [newOpen, setNewOpen] = useState(false);
  const [nf, setNf] = useState({ feature_key: '', feature_name: '', description: '', category: 'general' });

  const key = (planId: string, featureId: string) => `${planId}:${featureId}`;

  const load = async () => {
    setLoading(true);
    const [f, p, m] = await Promise.all([
      supabase.from('subscription_features').select('*').order('sort_order'),
      supabase.from('subscription_plans').select('id,name,slug,price_monthly').eq('is_active', true).order('price_monthly'),
      supabase.from('subscription_plan_features').select('*'),
    ]);
    if (f.error || p.error || m.error) {
      toast.error('Failed to load entitlements');
    } else {
      setFeatures(f.data as Feature[]);
      setPlans(p.data as Plan[]);
      const map: Record<string, Mapping> = {};
      (m.data as Mapping[]).forEach(row => { map[key(row.plan_id, row.feature_id)] = row; });
      setMatrix(map);
    }
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const upsertCell = async (planId: string, featureId: string, patch: Partial<Mapping>) => {
    const k = key(planId, featureId);
    const existing = matrix[k] ?? { plan_id: planId, feature_id: featureId, enabled: false, limit_value: null };
    const next: Mapping = { ...existing, ...patch };
    setMatrix(prev => ({ ...prev, [k]: next }));
    setSaving(k);
    const { error } = await supabase
      .from('subscription_plan_features')
      .upsert({ plan_id: planId, feature_id: featureId, enabled: next.enabled, limit_value: next.limit_value }, { onConflict: 'plan_id,feature_id' });
    setSaving(null);
    if (error) {
      toast.error(error.message);
      load();
    }
  };

  const createFeature = async () => {
    if (!nf.feature_key || !nf.feature_name) return;
    const { error } = await supabase.from('subscription_features').insert({
      feature_key: nf.feature_key,
      feature_name: nf.feature_name,
      description: nf.description || null,
      category: nf.category || null,
      sort_order: (features.at(-1)?.sort_order ?? 0) + 10,
    });
    if (error) return toast.error(error.message);
    setNewOpen(false);
    setNf({ feature_key: '', feature_name: '', description: '', category: 'general' });
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
              <div><Label>Key</Label><Input value={nf.feature_key} onChange={e => setNf({ ...nf, feature_key: e.target.value })} placeholder="e.g. priority_support" /></div>
              <div><Label>Name</Label><Input value={nf.feature_name} onChange={e => setNf({ ...nf, feature_name: e.target.value })} /></div>
              <div><Label>Category</Label><Input value={nf.category} onChange={e => setNf({ ...nf, category: e.target.value })} /></div>
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
              <th className="text-left p-2 min-w-[220px]">Feature</th>
              {plans.map(p => (
                <th key={p.id} className="text-center p-2 min-w-[140px]">
                  {p.name}<div className="text-xs text-muted-foreground">${p.price_monthly}/mo</div>
                </th>
              ))}
              <th className="w-10"></th>
            </tr>
          </thead>
          <tbody>
            {features.map(f => (
              <tr key={f.id} className="border-b align-middle">
                <td className="p-2">
                  <div className="font-medium">{f.feature_name}</div>
                  <div className="text-xs text-muted-foreground">{f.feature_key}{f.category ? ` • ${f.category}` : ''}</div>
                </td>
                {plans.map(p => {
                  const cell = matrix[key(p.id, f.id)] ?? { enabled: false, limit_value: null, plan_id: p.id, feature_id: f.id };
                  return (
                    <td key={p.id} className="p-2 text-center">
                      <div className="flex flex-col items-center gap-1">
                        <Switch
                          checked={cell.enabled}
                          onCheckedChange={(v) => upsertCell(p.id, f.id, { enabled: v })}
                        />
                        <Input
                          type="number"
                          className="h-7 w-20 text-center text-xs"
                          placeholder="∞"
                          value={cell.limit_value ?? ''}
                          onChange={(e) => {
                            const v = e.target.value === '' ? null : parseInt(e.target.value, 10);
                            upsertCell(p.id, f.id, { limit_value: Number.isNaN(v as number) ? null : v });
                          }}
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
          </tbody>
        </table>
        <p className="text-xs text-muted-foreground mt-3">Leave the limit empty for unlimited. Changes save automatically{saving ? ' • saving…' : ''}.</p>
      </CardContent>
    </Card>
  );
}
