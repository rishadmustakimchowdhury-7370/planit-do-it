import { useState, useEffect } from 'react';
import { AdminLayout } from '@/components/admin/AdminLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Plus, Trash2, Edit, Percent, PoundSterling, Copy, Calendar } from 'lucide-react';
import { format } from 'date-fns';

interface PromoCode {
  id: string;
  code: string;
  description: string | null;
  discount_type: string;
  discount_value: number;
  currency: string;
  max_uses: number | null;
  uses_count: number;
  valid_from: string;
  valid_until: string | null;
  is_active: boolean;
  created_at: string;
}

export default function AdminPromoCodesPage() {
  const [promoCodes, setPromoCodes] = useState<PromoCode[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editingCode, setEditingCode] = useState<PromoCode | null>(null);
  
  const [formData, setFormData] = useState({
    code: '',
    description: '',
    discount_type: 'percentage',
    discount_value: 10,
    currency: 'GBP',
    max_uses: '',
    valid_until: '',
    is_active: true,
  });

  useEffect(() => {
    fetchPromoCodes();
  }, []);

  const fetchPromoCodes = async () => {
    try {
      const { data, error } = await supabase
        .from('promo_codes')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setPromoCodes(data || []);
    } catch (error: any) {
      toast.error('Failed to load promo codes');
    } finally {
      setLoading(false);
    }
  };

  const handleOpenDialog = (code?: PromoCode) => {
    if (code) {
      setEditingCode(code);
      setFormData({
        code: code.code,
        description: code.description || '',
        discount_type: code.discount_type,
        discount_value: code.discount_value,
        currency: code.currency,
        max_uses: code.max_uses?.toString() || '',
        valid_until: code.valid_until ? format(new Date(code.valid_until), 'yyyy-MM-dd') : '',
        is_active: code.is_active,
      });
    } else {
      setEditingCode(null);
      setFormData({
        code: '',
        description: '',
        discount_type: 'percentage',
        discount_value: 10,
        currency: 'GBP',
        max_uses: '',
        valid_until: '',
        is_active: true,
      });
    }
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!formData.code.trim()) {
      toast.error('Please enter a promo code');
      return;
    }

    setSaving(true);
    try {
      const payload = {
        code: formData.code.toUpperCase().replace(/\s/g, ''),
        description: formData.description || null,
        discount_type: formData.discount_type,
        discount_value: formData.discount_value,
        currency: formData.currency,
        max_uses: formData.max_uses ? parseInt(formData.max_uses) : null,
        valid_until: formData.valid_until ? new Date(formData.valid_until).toISOString() : null,
        is_active: formData.is_active,
      };

      if (editingCode) {
        const { error } = await supabase
          .from('promo_codes')
          .update(payload)
          .eq('id', editingCode.id);
        if (error) throw error;
        toast.success('Promo code updated');
      } else {
        const { error } = await supabase
          .from('promo_codes')
          .insert(payload);
        if (error) throw error;
        toast.success('Promo code created');
      }

      setDialogOpen(false);
      fetchPromoCodes();
    } catch (error: any) {
      toast.error(error.message || 'Failed to save promo code');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this promo code?')) return;

    try {
      const { error } = await supabase
        .from('promo_codes')
        .delete()
        .eq('id', id);
      if (error) throw error;
      toast.success('Promo code deleted');
      fetchPromoCodes();
    } catch (error: any) {
      toast.error('Failed to delete promo code');
    }
  };

  const copyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    toast.success('Code copied to clipboard');
  };

  if (loading) {
    return (
      <AdminLayout title="Promo Codes" description="Manage discount codes">
        <Card>
          <CardContent className="p-6 space-y-4">
            {[1, 2, 3].map(i => <Skeleton key={i} className="h-16 w-full" />)}
          </CardContent>
        </Card>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout title="Promo Codes" description="Create and manage discount codes for checkout">
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h2 className="text-lg font-medium">All Promo Codes</h2>
            <p className="text-sm text-muted-foreground">
              {promoCodes.length} promo code{promoCodes.length !== 1 ? 's' : ''} created
            </p>
          </div>
          <Button onClick={() => handleOpenDialog()}>
            <Plus className="h-4 w-4 mr-2" />
            Create Promo Code
          </Button>
        </div>

        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Code</TableHead>
                  <TableHead>Discount</TableHead>
                  <TableHead>Usage</TableHead>
                  <TableHead>Valid Until</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {promoCodes.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                      No promo codes created yet
                    </TableCell>
                  </TableRow>
                ) : (
                  promoCodes.map((code) => (
                    <TableRow key={code.id}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <code className="bg-muted px-2 py-1 rounded text-sm font-mono">
                            {code.code}
                          </code>
                          <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => copyCode(code.code)}>
                            <Copy className="h-3 w-3" />
                          </Button>
                        </div>
                        {code.description && (
                          <p className="text-xs text-muted-foreground mt-1">{code.description}</p>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          {code.discount_type === 'percentage' ? (
                            <>
                              <Percent className="h-4 w-4 text-muted-foreground" />
                              <span className="font-medium">{code.discount_value}%</span>
                            </>
                          ) : (
                            <>
                              <PoundSterling className="h-4 w-4 text-muted-foreground" />
                              <span className="font-medium">{code.discount_value}</span>
                            </>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <span className="text-sm">
                          {code.uses_count} / {code.max_uses || '∞'}
                        </span>
                      </TableCell>
                      <TableCell>
                        {code.valid_until ? (
                          <span className="text-sm">
                            {format(new Date(code.valid_until), 'MMM d, yyyy')}
                          </span>
                        ) : (
                          <span className="text-sm text-muted-foreground">No expiry</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge variant={code.is_active ? 'default' : 'secondary'}>
                          {code.is_active ? 'Active' : 'Inactive'}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button variant="ghost" size="icon" onClick={() => handleOpenDialog(code)}>
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" className="text-destructive" onClick={() => handleDelete(code.id)}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editingCode ? 'Edit Promo Code' : 'Create Promo Code'}</DialogTitle>
            <DialogDescription>
              {editingCode ? 'Update the promo code details' : 'Create a new discount code for customers'}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Promo Code *</Label>
              <Input
                placeholder="e.g., SAVE20"
                value={formData.code}
                onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
                className="font-mono"
              />
            </div>

            <div className="space-y-2">
              <Label>Description</Label>
              <Input
                placeholder="e.g., 20% off for new customers"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Discount Type</Label>
                <Select
                  value={formData.discount_type}
                  onValueChange={(v) => setFormData({ ...formData, discount_type: v })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="percentage">Percentage (%)</SelectItem>
                    <SelectItem value="fixed">Fixed Amount (£)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Discount Value</Label>
                <Input
                  type="number"
                  min="1"
                  max={formData.discount_type === 'percentage' ? 100 : 999}
                  value={formData.discount_value}
                  onChange={(e) => setFormData({ ...formData, discount_value: parseFloat(e.target.value) || 0 })}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Max Uses</Label>
                <Input
                  type="number"
                  min="1"
                  placeholder="Unlimited"
                  value={formData.max_uses}
                  onChange={(e) => setFormData({ ...formData, max_uses: e.target.value })}
                />
              </div>

              <div className="space-y-2">
                <Label>Valid Until</Label>
                <Input
                  type="date"
                  value={formData.valid_until}
                  onChange={(e) => setFormData({ ...formData, valid_until: e.target.value })}
                />
              </div>
            </div>

            <div className="flex items-center justify-between">
              <Label>Active</Label>
              <Switch
                checked={formData.is_active}
                onCheckedChange={(checked) => setFormData({ ...formData, is_active: checked })}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? 'Saving...' : (editingCode ? 'Update' : 'Create')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
}