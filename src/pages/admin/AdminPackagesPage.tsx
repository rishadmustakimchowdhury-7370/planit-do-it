import { useState, useEffect } from 'react';
import { AdminLayout } from '@/components/admin/AdminLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Plus, Edit, Trash2, Package, Loader2, Check } from 'lucide-react';

interface SubscriptionPlan {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  price_monthly: number;
  price_yearly: number;
  max_users: number | null;
  max_jobs: number | null;
  max_candidates: number | null;
  match_credits_monthly: number | null;
  features: any;
  is_active: boolean;
  display_order: number | null;
}

export default function AdminPackagesPage() {
  const [plans, setPlans] = useState<SubscriptionPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingPlan, setEditingPlan] = useState<SubscriptionPlan | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const [formData, setFormData] = useState({
    name: '',
    slug: '',
    description: '',
    price_monthly: 0,
    price_yearly: 0,
    max_users: 3,
    max_jobs: 10,
    max_candidates: 100,
    match_credits_monthly: 100,
    features: '',
    is_active: true,
    display_order: 0,
  });

  useEffect(() => {
    fetchPlans();
  }, []);

  const fetchPlans = async () => {
    try {
      const { data, error } = await supabase
        .from('subscription_plans')
        .select('*')
        .order('display_order', { ascending: true });

      if (error) throw error;
      setPlans(data || []);
    } catch (error: any) {
      toast.error('Failed to fetch plans: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenDialog = (plan?: SubscriptionPlan) => {
    if (plan) {
      setEditingPlan(plan);
      setFormData({
        name: plan.name,
        slug: plan.slug,
        description: plan.description || '',
        price_monthly: plan.price_monthly,
        price_yearly: plan.price_yearly,
        max_users: plan.max_users || 3,
        max_jobs: plan.max_jobs || 10,
        max_candidates: plan.max_candidates || 100,
        match_credits_monthly: plan.match_credits_monthly || 100,
        features: Array.isArray(plan.features) ? plan.features.join('\n') : '',
        is_active: plan.is_active,
        display_order: plan.display_order || 0,
      });
    } else {
      setEditingPlan(null);
      setFormData({
        name: '',
        slug: '',
        description: '',
        price_monthly: 0,
        price_yearly: 0,
        max_users: 3,
        max_jobs: 10,
        max_candidates: 100,
        match_credits_monthly: 100,
        features: '',
        is_active: true,
        display_order: plans.length,
      });
    }
    setIsDialogOpen(true);
  };

  const handleSave = async () => {
    if (!formData.name || !formData.slug) {
      toast.error('Name and slug are required');
      return;
    }

    setSaving(true);
    try {
      const planData = {
        name: formData.name,
        slug: formData.slug.toLowerCase().replace(/\s+/g, '-'),
        description: formData.description || null,
        price_monthly: formData.price_monthly,
        price_yearly: formData.price_yearly,
        max_users: formData.max_users,
        max_jobs: formData.max_jobs,
        max_candidates: formData.max_candidates,
        match_credits_monthly: formData.match_credits_monthly,
        features: formData.features.split('\n').filter(f => f.trim()),
        is_active: formData.is_active,
        display_order: formData.display_order,
      };

      if (editingPlan) {
        const { error } = await supabase
          .from('subscription_plans')
          .update(planData)
          .eq('id', editingPlan.id);
        if (error) throw error;
        toast.success('Plan updated successfully');
      } else {
        const { error } = await supabase
          .from('subscription_plans')
          .insert(planData);
        if (error) throw error;
        toast.success('Plan created successfully');
      }

      setIsDialogOpen(false);
      fetchPlans();
    } catch (error: any) {
      toast.error('Failed to save plan: ' + error.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this plan?')) return;

    try {
      const { error } = await supabase.from('subscription_plans').delete().eq('id', id);
      if (error) throw error;
      toast.success('Plan deleted successfully');
      fetchPlans();
    } catch (error: any) {
      toast.error('Failed to delete plan: ' + error.message);
    }
  };

  return (
    <AdminLayout title="Subscription Packages" description="Manage subscription plans and pricing">
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <p className="text-muted-foreground">Configure pricing plans and features</p>
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button onClick={() => handleOpenDialog()}>
                <Plus className="h-4 w-4 mr-2" />
                Add Plan
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>{editingPlan ? 'Edit Plan' : 'Create New Plan'}</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 mt-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Plan Name</Label>
                    <Input
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      placeholder="Pro"
                    />
                  </div>
                  <div>
                    <Label>Slug</Label>
                    <Input
                      value={formData.slug}
                      onChange={(e) => setFormData({ ...formData, slug: e.target.value })}
                      placeholder="pro"
                    />
                  </div>
                </div>
                <div>
                  <Label>Description</Label>
                  <Textarea
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    placeholder="Best for growing teams"
                    rows={2}
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Monthly Price ($)</Label>
                    <Input
                      type="number"
                      value={formData.price_monthly}
                      onChange={(e) => setFormData({ ...formData, price_monthly: parseFloat(e.target.value) || 0 })}
                    />
                  </div>
                  <div>
                    <Label>Yearly Price ($)</Label>
                    <Input
                      type="number"
                      value={formData.price_yearly}
                      onChange={(e) => setFormData({ ...formData, price_yearly: parseFloat(e.target.value) || 0 })}
                    />
                  </div>
                </div>
                <div className="grid grid-cols-4 gap-4">
                  <div>
                    <Label>Max Users</Label>
                    <Input
                      type="number"
                      value={formData.max_users}
                      onChange={(e) => setFormData({ ...formData, max_users: parseInt(e.target.value) || 0 })}
                    />
                  </div>
                  <div>
                    <Label>Max Jobs</Label>
                    <Input
                      type="number"
                      value={formData.max_jobs}
                      onChange={(e) => setFormData({ ...formData, max_jobs: parseInt(e.target.value) || 0 })}
                    />
                  </div>
                  <div>
                    <Label>Max Candidates</Label>
                    <Input
                      type="number"
                      value={formData.max_candidates}
                      onChange={(e) => setFormData({ ...formData, max_candidates: parseInt(e.target.value) || 0 })}
                    />
                  </div>
                  <div>
                    <Label>AI Credits/Mo</Label>
                    <Input
                      type="number"
                      value={formData.match_credits_monthly}
                      onChange={(e) => setFormData({ ...formData, match_credits_monthly: parseInt(e.target.value) || 0 })}
                    />
                  </div>
                </div>
                <div>
                  <Label>Features (one per line)</Label>
                  <Textarea
                    value={formData.features}
                    onChange={(e) => setFormData({ ...formData, features: e.target.value })}
                    placeholder="Unlimited job postings&#10;AI-powered matching&#10;Priority support"
                    rows={5}
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Display Order</Label>
                    <Input
                      type="number"
                      value={formData.display_order}
                      onChange={(e) => setFormData({ ...formData, display_order: parseInt(e.target.value) || 0 })}
                    />
                  </div>
                  <div className="flex items-center gap-2 pt-6">
                    <Switch
                      checked={formData.is_active}
                      onCheckedChange={(checked) => setFormData({ ...formData, is_active: checked })}
                    />
                    <Label>Active</Label>
                  </div>
                </div>
                <div className="flex justify-end gap-2">
                  <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
                    Cancel
                  </Button>
                  <Button onClick={handleSave} disabled={saving}>
                    {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                    {editingPlan ? 'Update' : 'Create'}
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : plans.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <Package className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium mb-2">No plans yet</h3>
              <p className="text-muted-foreground mb-4">Create your first subscription plan</p>
              <Button onClick={() => handleOpenDialog()}>
                <Plus className="h-4 w-4 mr-2" />
                Create Plan
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid md:grid-cols-3 gap-6">
            {plans.map((plan) => (
              <Card key={plan.id} className={!plan.is_active ? 'opacity-60' : ''}>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-xl">{plan.name}</CardTitle>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="icon" onClick={() => handleOpenDialog(plan)}>
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleDelete(plan.id)}
                        className="text-destructive hover:text-destructive"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                  {!plan.is_active && <Badge variant="secondary">Inactive</Badge>}
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <p className="text-3xl font-bold">
                      ${plan.price_monthly}
                      <span className="text-sm font-normal text-muted-foreground">/month</span>
                    </p>
                    <p className="text-sm text-muted-foreground">
                      or ${plan.price_yearly}/year
                    </p>
                  </div>
                  {plan.description && (
                    <p className="text-sm text-muted-foreground">{plan.description}</p>
                  )}
                  <div className="space-y-2 text-sm">
                    <p><strong>{plan.max_users}</strong> team members</p>
                    <p><strong>{plan.max_jobs}</strong> active jobs</p>
                    <p><strong>{plan.max_candidates}</strong> candidates</p>
                    <p><strong>{plan.match_credits_monthly}</strong> AI credits/month</p>
                  </div>
                  {Array.isArray(plan.features) && plan.features.length > 0 && (
                    <div className="space-y-1">
                      {plan.features.map((feature, i) => (
                        <div key={i} className="flex items-center gap-2 text-sm">
                          <Check className="h-4 w-4 text-green-500" />
                          <span>{feature}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
