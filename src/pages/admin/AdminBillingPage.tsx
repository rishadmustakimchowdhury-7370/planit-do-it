import { useState, useEffect } from 'react';
import { AdminLayout } from '@/components/admin/AdminLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Loader2, DollarSign, TrendingUp, CreditCard, FileText, Plus, Send, Mail } from 'lucide-react';
import { format } from 'date-fns';

interface Invoice {
  id: string;
  invoice_number: string;
  tenant_id: string;
  amount: number;
  currency: string;
  status: string;
  due_date: string | null;
  paid_at: string | null;
  created_at: string | null;
  notes: string | null;
}

interface Tenant {
  id: string;
  name: string;
  slug: string;
}

export default function AdminBillingPage() {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    mrr: 0,
    totalRevenue: 0,
    pendingInvoices: 0,
    paidThisMonth: 0,
  });
  const [filter, setFilter] = useState('all');
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const [invoiceForm, setInvoiceForm] = useState({
    tenant_id: '',
    amount: '',
    currency: 'USD',
    due_date: '',
    notes: '',
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [invoicesRes, tenantsRes] = await Promise.all([
        supabase.from('invoices').select('*').order('created_at', { ascending: false }),
        supabase.from('tenants').select('id, name, slug'),
      ]);

      if (invoicesRes.error) throw invoicesRes.error;
      if (tenantsRes.error) throw tenantsRes.error;

      const invoicesData = invoicesRes.data || [];
      setInvoices(invoicesData);
      setTenants(tenantsRes.data || []);

      // Calculate stats
      const paidInvoices = invoicesData.filter(i => i.status === 'paid');
      const pendingInvoices = invoicesData.filter(i => i.status === 'sent' || i.status === 'draft');
      const thisMonth = new Date().getMonth();
      const thisYear = new Date().getFullYear();
      const paidThisMonth = paidInvoices.filter(i => {
        if (!i.paid_at) return false;
        const paidDate = new Date(i.paid_at);
        return paidDate.getMonth() === thisMonth && paidDate.getFullYear() === thisYear;
      });

      setStats({
        mrr: paidThisMonth.reduce((sum, i) => sum + Number(i.amount), 0),
        totalRevenue: paidInvoices.reduce((sum, i) => sum + Number(i.amount), 0),
        pendingInvoices: pendingInvoices.reduce((sum, i) => sum + Number(i.amount), 0),
        paidThisMonth: paidThisMonth.length,
      });
    } catch (error: any) {
      toast.error('Failed to fetch billing data: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const getTenantName = (tenantId: string) => {
    return tenants.find(t => t.id === tenantId)?.name || 'Unknown';
  };

  const getTenantEmail = async (tenantId: string) => {
    const { data } = await supabase
      .from('profiles')
      .select('email')
      .eq('tenant_id', tenantId)
      .limit(1)
      .single();
    return data?.email;
  };

  const updateInvoiceStatus = async (invoiceId: string, status: string) => {
    try {
      const updates: any = { status };
      if (status === 'paid') {
        updates.paid_at = new Date().toISOString();
      }
      if (status === 'sent') {
        updates.sent_at = new Date().toISOString();
      }

      const { error } = await supabase
        .from('invoices')
        .update(updates)
        .eq('id', invoiceId);

      if (error) throw error;
      toast.success('Invoice updated');
      fetchData();
    } catch (error: any) {
      toast.error('Failed to update invoice: ' + error.message);
    }
  };

  const handleCreateInvoice = async () => {
    if (!invoiceForm.tenant_id || !invoiceForm.amount) {
      toast.error('Tenant and amount are required');
      return;
    }

    setIsSaving(true);
    try {
      // Generate invoice number
      const { data: invoiceNumber } = await supabase.rpc('generate_invoice_number');

      const { error } = await supabase.from('invoices').insert({
        tenant_id: invoiceForm.tenant_id,
        invoice_number: invoiceNumber || `INV-${Date.now()}`,
        amount: parseFloat(invoiceForm.amount),
        currency: invoiceForm.currency,
        due_date: invoiceForm.due_date || null,
        notes: invoiceForm.notes || null,
        status: 'draft',
      });

      if (error) throw error;

      toast.success('Invoice created');
      setShowCreateDialog(false);
      setInvoiceForm({ tenant_id: '', amount: '', currency: 'USD', due_date: '', notes: '' });
      fetchData();
    } catch (error: any) {
      toast.error('Failed to create invoice: ' + error.message);
    } finally {
      setIsSaving(false);
    }
  };

  const handleSendInvoiceEmail = async (invoice: Invoice) => {
    setIsSaving(true);
    try {
      const tenantEmail = await getTenantEmail(invoice.tenant_id);
      if (!tenantEmail) {
        toast.error('Could not find email for this tenant');
        setIsSaving(false);
        return;
      }

      const tenantName = getTenantName(invoice.tenant_id);

      const { data, error } = await supabase.functions.invoke('send-email', {
        body: {
          to: tenantEmail,
          subject: `Invoice ${invoice.invoice_number} - ${invoice.currency} $${Number(invoice.amount).toLocaleString()}`,
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
              <h1 style="color: #0ea5e9;">Invoice from Recruitsy</h1>
              <p>Dear ${tenantName},</p>
              <p>Please find your invoice details below:</p>
              <div style="background: #f8fafc; padding: 20px; border-radius: 8px; margin: 20px 0;">
                <p><strong>Invoice Number:</strong> ${invoice.invoice_number}</p>
                <p><strong>Amount:</strong> ${invoice.currency} $${Number(invoice.amount).toLocaleString()}</p>
                <p><strong>Due Date:</strong> ${invoice.due_date ? format(new Date(invoice.due_date), 'MMMM d, yyyy') : 'Upon receipt'}</p>
                ${invoice.notes ? `<p><strong>Notes:</strong> ${invoice.notes}</p>` : ''}
              </div>
              <p>Thank you for your business!</p>
              <p style="color: #64748b; font-size: 12px; margin-top: 40px;">
                This email was sent from Recruitsy. If you have any questions, please contact support.
              </p>
            </div>
          `,
        },
      });

      if (error) throw error;

      // Update invoice status to sent
      await updateInvoiceStatus(invoice.id, 'sent');
      toast.success('Invoice sent via email');
    } catch (error: any) {
      toast.error('Failed to send email: ' + error.message);
    } finally {
      setIsSaving(false);
    }
  };

  const filteredInvoices = filter === 'all'
    ? invoices
    : invoices.filter(i => i.status === filter);

  const statusColors: Record<string, string> = {
    draft: 'secondary',
    sent: 'default',
    paid: 'default',
    overdue: 'destructive',
    canceled: 'secondary',
  };

  if (loading) {
    return (
      <AdminLayout title="Billing & Invoices" description="Manage billing and invoices">
        <div className="flex justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout title="Billing & Invoices" description="Manage billing and invoices">
      <div className="space-y-6">
        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-green-100 rounded-lg">
                  <TrendingUp className="h-5 w-5 text-green-600" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">MRR</p>
                  <p className="text-2xl font-bold">${stats.mrr.toLocaleString()}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-100 rounded-lg">
                  <DollarSign className="h-5 w-5 text-blue-600" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Total Revenue</p>
                  <p className="text-2xl font-bold">${stats.totalRevenue.toLocaleString()}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-yellow-100 rounded-lg">
                  <FileText className="h-5 w-5 text-yellow-600" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Pending</p>
                  <p className="text-2xl font-bold">${stats.pendingInvoices.toLocaleString()}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-purple-100 rounded-lg">
                  <CreditCard className="h-5 w-5 text-purple-600" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Paid This Month</p>
                  <p className="text-2xl font-bold">{stats.paidThisMonth}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Invoices List */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Invoices</CardTitle>
                <CardDescription>Manage all platform invoices</CardDescription>
              </div>
              <div className="flex gap-2">
                <Select value={filter} onValueChange={setFilter}>
                  <SelectTrigger className="w-[150px]">
                    <SelectValue placeholder="Filter" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All</SelectItem>
                    <SelectItem value="draft">Draft</SelectItem>
                    <SelectItem value="sent">Sent</SelectItem>
                    <SelectItem value="paid">Paid</SelectItem>
                    <SelectItem value="overdue">Overdue</SelectItem>
                  </SelectContent>
                </Select>
                <Button onClick={() => setShowCreateDialog(true)}>
                  <Plus className="h-4 w-4 mr-2" />
                  Create Invoice
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {filteredInvoices.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>No invoices found</p>
                <Button variant="link" onClick={() => setShowCreateDialog(true)}>
                  Create your first invoice
                </Button>
              </div>
            ) : (
              <div className="space-y-3">
                {filteredInvoices.map((invoice) => (
                  <div
                    key={invoice.id}
                    className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors"
                  >
                    <div className="flex items-center gap-4">
                      <FileText className="h-8 w-8 text-primary" />
                      <div>
                        <p className="font-medium">{invoice.invoice_number}</p>
                        <p className="text-sm text-muted-foreground">{getTenantName(invoice.tenant_id)}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="text-right">
                        <p className="font-medium">
                          {invoice.currency} ${Number(invoice.amount).toLocaleString()}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {invoice.due_date ? format(new Date(invoice.due_date), 'MMM d, yyyy') : 'No due date'}
                        </p>
                      </div>
                      <Badge variant={statusColors[invoice.status] as any || 'secondary'} className={invoice.status === 'paid' ? 'bg-green-600' : ''}>
                        {invoice.status}
                      </Badge>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleSendInvoiceEmail(invoice)}
                        disabled={isSaving}
                      >
                        <Mail className="h-4 w-4 mr-1" />
                        Send
                      </Button>
                      <Select
                        value={invoice.status}
                        onValueChange={(value) => updateInvoiceStatus(invoice.id, value)}
                      >
                        <SelectTrigger className="w-[120px]">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="draft">Draft</SelectItem>
                          <SelectItem value="sent">Sent</SelectItem>
                          <SelectItem value="paid">Paid</SelectItem>
                          <SelectItem value="overdue">Overdue</SelectItem>
                          <SelectItem value="canceled">Canceled</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Create Invoice Dialog */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create Invoice</DialogTitle>
            <DialogDescription>Create a new invoice for a tenant</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Tenant *</Label>
              <Select
                value={invoiceForm.tenant_id}
                onValueChange={(value) => setInvoiceForm({ ...invoiceForm, tenant_id: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select tenant" />
                </SelectTrigger>
                <SelectContent>
                  {tenants.map((t) => (
                    <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Amount *</Label>
                <Input
                  type="number"
                  value={invoiceForm.amount}
                  onChange={(e) => setInvoiceForm({ ...invoiceForm, amount: e.target.value })}
                  placeholder="99.00"
                />
              </div>
              <div className="space-y-2">
                <Label>Currency</Label>
                <Select
                  value={invoiceForm.currency}
                  onValueChange={(value) => setInvoiceForm({ ...invoiceForm, currency: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="USD">USD</SelectItem>
                    <SelectItem value="EUR">EUR</SelectItem>
                    <SelectItem value="GBP">GBP</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Due Date</Label>
              <Input
                type="date"
                value={invoiceForm.due_date}
                onChange={(e) => setInvoiceForm({ ...invoiceForm, due_date: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Notes</Label>
              <Textarea
                value={invoiceForm.notes}
                onChange={(e) => setInvoiceForm({ ...invoiceForm, notes: e.target.value })}
                placeholder="Additional notes..."
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateDialog(false)}>Cancel</Button>
            <Button onClick={handleCreateInvoice} disabled={isSaving}>
              {isSaving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Create Invoice
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
}
