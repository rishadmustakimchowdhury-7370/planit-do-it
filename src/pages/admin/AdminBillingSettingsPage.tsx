import { useState, useEffect } from 'react';
import { AdminLayout } from '@/components/admin/AdminLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Loader2, Save, Percent } from 'lucide-react';

interface MultiMonthDiscounts {
  3: number;
  6: number;
  12: number;
}

type DiscountMode = 'total' | 'per_month';

export default function AdminBillingSettingsPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [discountMode, setDiscountMode] = useState<DiscountMode>('total');
  const [discounts, setDiscounts] = useState<MultiMonthDiscounts>({
    3: 5,
    6: 10,
    12: 15,
  });

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      const { data, error } = await supabase
        .from('billing_settings')
        .select('*')
        .eq('setting_key', 'multi_month_discounts')
        .single();

      if (error && error.code !== 'PGRST116') throw error;
      
      if (data?.setting_value) {
        const value = data.setting_value as any;
        if (value && typeof value === 'object') {
          setDiscounts({
            3: value['3'] ?? value[3] ?? 5,
            6: value['6'] ?? value[6] ?? 10,
            12: value['12'] ?? value[12] ?? 15,
          });
          if (value.discount_mode) {
            setDiscountMode(value.discount_mode as DiscountMode);
          }
        }
      }
    } catch (error: any) {
      console.error('Failed to load billing settings:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      // Check if record exists
      const { data: existing } = await supabase
        .from('billing_settings')
        .select('id')
        .eq('setting_key', 'multi_month_discounts')
        .single();

      const discountValue = { "3": discounts[3], "6": discounts[6], "12": discounts[12], "discount_mode": discountMode };

      if (existing) {
        const { error } = await supabase
          .from('billing_settings')
          .update({
            setting_value: discountValue,
            updated_at: new Date().toISOString(),
          })
          .eq('setting_key', 'multi_month_discounts');
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('billing_settings')
          .insert([{
            setting_key: 'multi_month_discounts',
            setting_value: discountValue,
          }]);
        if (error) throw error;
      }
      toast.success('Billing settings saved successfully');
    } catch (error: any) {
      toast.error(error.message || 'Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <AdminLayout title="Billing Settings" description="Manage multi-month discounts">
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout title="Billing Settings" description="Configure subscription discounts and payment options">
      <div className="space-y-6 max-w-2xl">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Percent className="h-5 w-5" />
              Multi-Month Subscription Discounts
            </CardTitle>
            <CardDescription>
              Set discount percentages for customers who choose longer billing periods.
              These discounts are applied automatically at checkout.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Discount Mode Selection */}
            <div className="p-4 border rounded-lg bg-muted/30">
              <Label className="text-base font-medium mb-3 block">Discount Application Mode</Label>
              <RadioGroup
                value={discountMode}
                onValueChange={(value) => setDiscountMode(value as DiscountMode)}
                className="flex flex-col gap-3"
              >
                <div className="flex items-start gap-3 p-3 border rounded-lg bg-background cursor-pointer hover:bg-muted/50">
                  <RadioGroupItem value="total" id="total" className="mt-0.5" />
                  <div>
                    <Label htmlFor="total" className="font-medium cursor-pointer">Off Total Amount</Label>
                    <p className="text-sm text-muted-foreground">
                      Discount is applied once to the entire subscription total
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-3 p-3 border rounded-lg bg-background cursor-pointer hover:bg-muted/50">
                  <RadioGroupItem value="per_month" id="per_month" className="mt-0.5" />
                  <div>
                    <Label htmlFor="per_month" className="font-medium cursor-pointer">Off Each Month</Label>
                    <p className="text-sm text-muted-foreground">
                      Discount is applied to each monthly payment
                    </p>
                  </div>
                </div>
              </RadioGroup>
            </div>

            {/* Discount Percentages */}
            <div className="grid gap-6">
              <div className="flex items-center justify-between p-4 border rounded-lg">
                <div>
                  <Label className="text-base font-medium">3 Months</Label>
                  <p className="text-sm text-muted-foreground">Discount for quarterly billing</p>
                </div>
                <div className="flex items-center gap-2">
                  <Input
                    type="number"
                    min="0"
                    max="50"
                    value={discounts[3]}
                    onChange={(e) => setDiscounts({ ...discounts, 3: parseInt(e.target.value) || 0 })}
                    className="w-20 text-right"
                  />
                  <span className="text-muted-foreground">%</span>
                </div>
              </div>

              <div className="flex items-center justify-between p-4 border rounded-lg">
                <div>
                  <Label className="text-base font-medium">6 Months</Label>
                  <p className="text-sm text-muted-foreground">Discount for semi-annual billing</p>
                </div>
                <div className="flex items-center gap-2">
                  <Input
                    type="number"
                    min="0"
                    max="50"
                    value={discounts[6]}
                    onChange={(e) => setDiscounts({ ...discounts, 6: parseInt(e.target.value) || 0 })}
                    className="w-20 text-right"
                  />
                  <span className="text-muted-foreground">%</span>
                </div>
              </div>

              <div className="flex items-center justify-between p-4 border rounded-lg bg-primary/5">
                <div>
                  <Label className="text-base font-medium">12 Months (Annual)</Label>
                  <p className="text-sm text-muted-foreground">Best value - highest discount</p>
                </div>
                <div className="flex items-center gap-2">
                  <Input
                    type="number"
                    min="0"
                    max="50"
                    value={discounts[12]}
                    onChange={(e) => setDiscounts({ ...discounts, 12: parseInt(e.target.value) || 0 })}
                    className="w-20 text-right"
                  />
                  <span className="text-muted-foreground">%</span>
                </div>
              </div>
            </div>

            <div className="pt-4 border-t">
              <Button onClick={handleSave} disabled={saving}>
                {saving ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Save className="h-4 w-4 mr-2" />
                    Save Changes
                  </>
                )}
              </Button>
            </div>

            <div className="p-4 bg-muted/50 rounded-lg">
              <h4 className="font-medium text-sm mb-2">Preview</h4>
              <ul className="text-sm text-muted-foreground space-y-1">
                <li>• 1 Month: No discount (full price)</li>
                <li>• 3 Months: {discounts[3]}% off {discountMode === 'total' ? 'total amount' : 'each month'}</li>
                <li>• 6 Months: {discounts[6]}% off {discountMode === 'total' ? 'total amount' : 'each month'}</li>
                <li>• 12 Months: {discounts[12]}% off {discountMode === 'total' ? 'total amount' : 'each month'}</li>
              </ul>
            </div>
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
}
