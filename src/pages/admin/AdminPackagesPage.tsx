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
import { Checkbox } from '@/components/ui/checkbox';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Plus, Edit, Trash2, Package, Loader2, Check, Settings2, ListChecks } from 'lucide-react';

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

interface PlanFeature {
  id: string;
  name: string;
  description: string | null;
  category: string;
  is_active: boolean;
  display_order: number;
}

export default function AdminPackagesPage() {
  const [plans, setPlans] = useState<SubscriptionPlan[]>([]);
  const [features, setFeatures] = useState<PlanFeature[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingPlan, setEditingPlan] = useState<SubscriptionPlan | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isFeaturesDialogOpen, setIsFeaturesDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState('plans');

  // New feature form
  const [newFeatureName, setNewFeatureName] = useState('');
  const [newFeatureCategory, setNewFeatureCategory] = useState('general');
  const [addingFeature, setAddingFeature] = useState(false);

  const [formData, setFormData] = useState({
    name: '',
    slug: '',
    description: '',
    price_monthly: 0,
    price_yearly: 0,
    stripe_price_id_monthly: '',
    stripe_price_id_yearly: '',
    max_users: 3,
    max_jobs: 10,
    max_candidates: 100,
    match_credits_monthly: 100,
    selectedFeatures: [] as string[],
    is_active: true,
    display_order: 0,
  });

  useEffect(() => {
    fetchPlans();
    fetchFeatures();
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

  const fetchFeatures = async () => {
    try {
      const { data, error } = await supabase
        .from('plan_features')
        .select('*')
        .eq('is_active', true)
        .order('display_order', { ascending: true });

      if (error) throw error;
      setFeatures(data || []);
    } catch (error: any) {
      toast.error('Failed to fetch features: ' + error.message);
    }
  };

  const handleOpenDialog = (plan?: SubscriptionPlan) => {
    if (plan) {
      setEditingPlan(plan);
      // Convert feature names to IDs if they're stored as names
      const featureNames = Array.isArray(plan.features) ? plan.features : [];
      const selectedIds = features
        .filter(f => featureNames.includes(f.name))
        .map(f => f.id);
      
      setFormData({
        name: plan.name,
        slug: plan.slug,
        description: plan.description || '',
        price_monthly: plan.price_monthly,
        price_yearly: plan.price_yearly,
        stripe_price_id_monthly: (plan as any).stripe_price_id_monthly || '',
        stripe_price_id_yearly: (plan as any).stripe_price_id_yearly || '',
        max_users: plan.max_users || 3,
        max_jobs: plan.max_jobs || 10,
        max_candidates: plan.max_candidates || 100,
        match_credits_monthly: plan.match_credits_monthly || 100,
        selectedFeatures: selectedIds.length > 0 ? selectedIds : featureNames, // fallback to names if no IDs match
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
        stripe_price_id_monthly: '',
        stripe_price_id_yearly: '',
        max_users: 3,
        max_jobs: 10,
        max_candidates: 100,
        match_credits_monthly: 100,
        selectedFeatures: [],
        is_active: true,
        display_order: plans.length,
      });
    }
    setIsDialogOpen(true);
  };

  const handleFeatureToggle = (featureId: string) => {
    setFormData(prev => ({
      ...prev,
      selectedFeatures: prev.selectedFeatures.includes(featureId)
        ? prev.selectedFeatures.filter(id => id !== featureId)
        : [...prev.selectedFeatures, featureId]
    }));
  };

  const handleSave = async () => {
    if (!formData.name || !formData.slug) {
      toast.error('Name and slug are required');
      return;
    }

    setSaving(true);
    try {
      // Convert selected feature IDs back to names for storage
      const selectedFeatureNames = formData.selectedFeatures.map(id => {
        const feature = features.find(f => f.id === id);
        return feature ? feature.name : id; // fallback to id if it's already a name
      });

      const planData = {
        name: formData.name,
        slug: formData.slug.toLowerCase().replace(/\s+/g, '-'),
        description: formData.description || null,
        price_monthly: formData.price_monthly,
        price_yearly: formData.price_yearly,
        stripe_price_id_monthly: formData.stripe_price_id_monthly || null,
        stripe_price_id_yearly: formData.stripe_price_id_yearly || null,
        max_users: formData.max_users,
        max_jobs: formData.max_jobs,
        max_candidates: formData.max_candidates,
        match_credits_monthly: formData.match_credits_monthly,
        features: selectedFeatureNames,
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

  const handleAddFeature = async () => {
    if (!newFeatureName.trim()) {
      toast.error('Feature name is required');
      return;
    }

    setAddingFeature(true);
    try {
      const { error } = await supabase.from('plan_features').insert({
        name: newFeatureName.trim(),
        category: newFeatureCategory,
        display_order: features.length,
      });

      if (error) throw error;
      toast.success('Feature added successfully');
      setNewFeatureName('');
      setNewFeatureCategory('general');
      fetchFeatures();
    } catch (error: any) {
      toast.error('Failed to add feature: ' + error.message);
    } finally {
      setAddingFeature(false);
    }
  };

  const handleDeleteFeature = async (id: string) => {
    if (!confirm('Are you sure you want to delete this feature?')) return;

    try {
      const { error } = await supabase.from('plan_features').delete().eq('id', id);
      if (error) throw error;
      toast.success('Feature deleted');
      fetchFeatures();
    } catch (error: any) {
      toast.error('Failed to delete feature: ' + error.message);
    }
  };

  // Group features by category
  const groupedFeatures = features.reduce((acc, feature) => {
    const cat = feature.category || 'general';
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(feature);
    return acc;
  }, {} as Record<string, PlanFeature[]>);

  const categoryLabels: Record<string, string> = {
    general: 'General',
    jobs: 'Jobs',
    candidates: 'Candidates',
    team: 'Team',
    ai: 'AI Features',
    communication: 'Communication',
    branding: 'Branding',
    support: 'Support',
    integrations: 'Integrations',
    analytics: 'Analytics',
    billing: 'Billing',
  };

  return (
    <AdminLayout title="Subscription Packages" description="Manage subscription plans and pricing">
      <div className="space-y-6">
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <div className="flex justify-between items-center">
            <TabsList>
              <TabsTrigger value="plans" className="gap-2">
                <Package className="h-4 w-4" />
                Plans
              </TabsTrigger>
              <TabsTrigger value="features" className="gap-2">
                <ListChecks className="h-4 w-4" />
                Features
              </TabsTrigger>
            </TabsList>

            {activeTab === 'plans' && (
              <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                <DialogTrigger asChild>
                  <Button onClick={() => handleOpenDialog()}>
                    <Plus className="h-4 w-4 mr-2" />
                    Add Plan
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
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
                        <Label>Monthly Price (£)</Label>
                        <Input
                          type="number"
                          value={formData.price_monthly}
                          onChange={(e) => setFormData({ ...formData, price_monthly: parseFloat(e.target.value) || 0 })}
                        />
                      </div>
                      <div>
                        <Label>Yearly Price (£)</Label>
                        <Input
                          type="number"
                          value={formData.price_yearly}
                          onChange={(e) => setFormData({ ...formData, price_yearly: parseFloat(e.target.value) || 0 })}
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label>Stripe Monthly Price ID</Label>
                        <Input
                          value={formData.stripe_price_id_monthly}
                          onChange={(e) => setFormData({ ...formData, stripe_price_id_monthly: e.target.value })}
                          placeholder="price_1Abc..."
                        />
                        <p className="text-xs text-muted-foreground mt-1">
                          From Stripe Dashboard → Products → Price ID
                        </p>
                      </div>
                      <div>
                        <Label>Stripe Yearly Price ID</Label>
                        <Input
                          value={formData.stripe_price_id_yearly}
                          onChange={(e) => setFormData({ ...formData, stripe_price_id_yearly: e.target.value })}
                          placeholder="price_1Xyz..."
                        />
                        <p className="text-xs text-muted-foreground mt-1">
                          Optional: For annual billing
                        </p>
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

                    {/* Features Selection */}
                    <div>
                      <Label className="text-base font-semibold">Plan Features</Label>
                      <p className="text-sm text-muted-foreground mb-3">
                        Select the features included in this plan
                      </p>
                      <div className="border rounded-lg p-4 max-h-[300px] overflow-y-auto space-y-4">
                        {Object.entries(groupedFeatures).map(([category, categoryFeatures]) => (
                          <div key={category}>
                            <h4 className="text-sm font-medium text-muted-foreground mb-2">
                              {categoryLabels[category] || category}
                            </h4>
                            <div className="grid grid-cols-2 gap-2">
                              {categoryFeatures.map((feature) => (
                                <div
                                  key={feature.id}
                                  className="flex items-center space-x-2 p-2 rounded-md hover:bg-muted/50 cursor-pointer"
                                  onClick={() => handleFeatureToggle(feature.id)}
                                >
                                  <Checkbox
                                    checked={formData.selectedFeatures.includes(feature.id)}
                                    onCheckedChange={() => handleFeatureToggle(feature.id)}
                                  />
                                  <label className="text-sm cursor-pointer flex-1">
                                    {feature.name}
                                  </label>
                                </div>
                              ))}
                            </div>
                          </div>
                        ))}
                        {features.length === 0 && (
                          <p className="text-sm text-muted-foreground text-center py-4">
                            No features available. Go to the Features tab to add some.
                          </p>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground mt-2">
                        {formData.selectedFeatures.length} features selected
                      </p>
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
            )}
          </div>

          <TabsContent value="plans" className="mt-6">
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
                          £{plan.price_monthly}
                          <span className="text-sm font-normal text-muted-foreground">/month</span>
                        </p>
                        <p className="text-sm text-muted-foreground">
                          or £{plan.price_yearly}/year
                        </p>
                      </div>
                      {plan.description && (
                        <p className="text-sm text-muted-foreground">{plan.description}</p>
                      )}
                      <div className="space-y-2 text-sm">
                        <p><strong>{plan.max_users === -1 ? 'Unlimited' : plan.max_users}</strong> team members</p>
                        <p><strong>{plan.max_jobs === -1 ? 'Unlimited' : plan.max_jobs}</strong> active jobs</p>
                        <p><strong>{plan.max_candidates === -1 ? 'Unlimited' : plan.max_candidates}</strong> candidates</p>
                        <p><strong>{plan.match_credits_monthly}</strong> AI credits/month</p>
                      </div>
                      {Array.isArray(plan.features) && plan.features.length > 0 && (
                        <div className="space-y-1 pt-2 border-t">
                          {plan.features.map((feature, i) => (
                            <div key={i} className="flex items-center gap-2 text-sm">
                              <Check className="h-4 w-4 text-green-500 flex-shrink-0" />
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
          </TabsContent>

          <TabsContent value="features" className="mt-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Settings2 className="h-5 w-5" />
                  Manage Features
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Add New Feature */}
                <div className="p-4 border rounded-lg bg-muted/30">
                  <h4 className="font-medium mb-3">Add New Feature</h4>
                  <div className="flex gap-3">
                    <Input
                      placeholder="Feature name (e.g., Advanced Reporting)"
                      value={newFeatureName}
                      onChange={(e) => setNewFeatureName(e.target.value)}
                      className="flex-1"
                    />
                    <select
                      className="border rounded-md px-3 py-2 text-sm bg-background"
                      value={newFeatureCategory}
                      onChange={(e) => setNewFeatureCategory(e.target.value)}
                    >
                      {Object.entries(categoryLabels).map(([value, label]) => (
                        <option key={value} value={value}>{label}</option>
                      ))}
                    </select>
                    <Button onClick={handleAddFeature} disabled={addingFeature}>
                      {addingFeature ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <>
                          <Plus className="h-4 w-4 mr-2" />
                          Add
                        </>
                      )}
                    </Button>
                  </div>
                </div>

                {/* Features List */}
                <div className="space-y-4">
                  {Object.entries(groupedFeatures).map(([category, categoryFeatures]) => (
                    <div key={category}>
                      <h4 className="text-sm font-semibold text-muted-foreground mb-2 uppercase tracking-wide">
                        {categoryLabels[category] || category}
                      </h4>
                      <div className="grid gap-2">
                        {categoryFeatures.map((feature) => (
                          <div
                            key={feature.id}
                            className="flex items-center justify-between p-3 border rounded-lg bg-background"
                          >
                            <div className="flex items-center gap-3">
                              <Check className="h-4 w-4 text-green-500" />
                              <span className="font-medium">{feature.name}</span>
                            </div>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleDeleteFeature(feature.id)}
                              className="h-8 w-8 text-destructive hover:text-destructive"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                  {features.length === 0 && (
                    <div className="text-center py-8 text-muted-foreground">
                      <ListChecks className="h-12 w-12 mx-auto mb-4 opacity-50" />
                      <p>No features yet. Add your first feature above.</p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </AdminLayout>
  );
}
