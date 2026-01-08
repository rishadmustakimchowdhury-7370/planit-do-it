import { useState, useEffect } from 'react';
import { AdminLayout } from '@/components/admin/AdminLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Checkbox } from '@/components/ui/checkbox';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth';
import { toast } from 'sonner';
import { format, subDays, subMonths, subYears, startOfDay, endOfDay, startOfWeek } from 'date-fns';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Calendar as CalendarIcon } from 'lucide-react';
import { 
  Search, 
  CheckCircle, 
  XCircle, 
  Clock, 
  Eye, 
  Loader2,
  DollarSign,
  TrendingUp,
  ShoppingCart,
  Users,
  ExternalLink,
  RefreshCw,
  Trash2,
  Download
} from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar } from 'recharts';

interface Order {
  id: string;
  user_id: string;
  tenant_id: string;
  plan_id: string;
  amount: number;
  currency: string;
  billing_cycle: string;
  status: string;
  approval_status: string;
  stripe_customer_id: string | null;
  stripe_payment_intent_id: string | null;
  stripe_subscription_id: string | null;
  stripe_checkout_session_id: string | null;
  approved_by: string | null;
  approved_at: string | null;
  rejection_reason: string | null;
  metadata: any;
  created_at: string;
  subscription_plans?: { name: string; slug: string } | null;
}

interface RevenueMetrics {
  total: number;
  daily: number;
  weekly: number;
  monthly: number;
  yearly: number;
}

export default function AdminOrdersPage() {
  const { user } = useAuth();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [isApprovalOpen, setIsApprovalOpen] = useState(false);
  const [rejectionReason, setRejectionReason] = useState('');
  const [processing, setProcessing] = useState(false);
  const [metrics, setMetrics] = useState<RevenueMetrics>({ total: 0, daily: 0, weekly: 0, monthly: 0, yearly: 0 });
  const [chartData, setChartData] = useState<any[]>([]);
  const [selectedOrders, setSelectedOrders] = useState<string[]>([]);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [orderToDelete, setOrderToDelete] = useState<Order | null>(null);
  const [isExporting, setIsExporting] = useState(false);
  const [revenueFilter, setRevenueFilter] = useState('30days');
  const [customDateFrom, setCustomDateFrom] = useState<Date | undefined>();
  const [customDateTo, setCustomDateTo] = useState<Date | undefined>();
  const [allCompletedOrders, setAllCompletedOrders] = useState<any[]>([]);

  useEffect(() => {
    fetchOrders();
    fetchMetrics();
  }, [statusFilter]);

  const fetchOrders = async () => {
    try {
      let query = supabase
        .from('orders')
        .select(`
          *,
          subscription_plans(name, slug)
        `)
        .order('created_at', { ascending: false });

      if (statusFilter !== 'all') {
        query = query.eq('approval_status', statusFilter);
      }

      const { data, error } = await query;
      if (error) throw error;
      setOrders(data || []);
    } catch (error: any) {
      toast.error('Failed to fetch orders');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const fetchMetrics = async () => {
    try {
      const now = new Date();
      const todayStart = startOfDay(now);
      const weekStart = startOfWeek(now);
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
      const yearStart = new Date(now.getFullYear(), 0, 1);

      const { data: allOrders } = await supabase
        .from('orders')
        .select('id, amount, created_at, status, currency, metadata, subscription_plans(name)')
        .eq('status', 'completed')
        .order('created_at', { ascending: false });

      if (allOrders) {
        setAllCompletedOrders(allOrders);
        
        const total = allOrders.reduce((sum, o) => sum + Number(o.amount), 0);
        const daily = allOrders
          .filter(o => new Date(o.created_at) >= todayStart)
          .reduce((sum, o) => sum + Number(o.amount), 0);
        const weekly = allOrders
          .filter(o => new Date(o.created_at) >= weekStart)
          .reduce((sum, o) => sum + Number(o.amount), 0);
        const monthly = allOrders
          .filter(o => new Date(o.created_at) >= monthStart)
          .reduce((sum, o) => sum + Number(o.amount), 0);
        const yearly = allOrders
          .filter(o => new Date(o.created_at) >= yearStart)
          .reduce((sum, o) => sum + Number(o.amount), 0);

        setMetrics({ total, daily, weekly, monthly, yearly });

        // Generate chart data for last 7 days
        const last7Days = [];
        for (let i = 6; i >= 0; i--) {
          const date = new Date();
          date.setDate(date.getDate() - i);
          const dayStart = startOfDay(date);
          const dayEnd = endOfDay(date);

          const dayRevenue = allOrders
            .filter(o => {
              const orderDate = new Date(o.created_at);
              return orderDate >= dayStart && orderDate <= dayEnd;
            })
            .reduce((sum, o) => sum + Number(o.amount), 0);

          last7Days.push({
            date: format(dayStart, 'MMM dd'),
            revenue: dayRevenue
          });
        }
        setChartData(last7Days);
      }
    } catch (error) {
      console.error('Failed to fetch metrics:', error);
    }
  };

  const getFilteredRevenueData = () => {
    if (!allCompletedOrders.length) return { orders: [], total: 0, count: 0 };
    
    const now = new Date();
    let startDate: Date;
    let endDate = endOfDay(now);
    
    switch (revenueFilter) {
      case 'today':
        startDate = startOfDay(now);
        break;
      case 'week':
        startDate = startOfWeek(now);
        break;
      case '15days':
        startDate = subDays(now, 15);
        break;
      case '30days':
        startDate = subDays(now, 30);
        break;
      case '2months':
        startDate = subMonths(now, 2);
        break;
      case '3months':
        startDate = subMonths(now, 3);
        break;
      case '6months':
        startDate = subMonths(now, 6);
        break;
      case '1year':
        startDate = subYears(now, 1);
        break;
      case 'custom':
        startDate = customDateFrom ? startOfDay(customDateFrom) : subDays(now, 30);
        endDate = customDateTo ? endOfDay(customDateTo) : endOfDay(now);
        break;
      default:
        startDate = subDays(now, 30);
    }
    
    const filtered = allCompletedOrders.filter(o => {
      const orderDate = new Date(o.created_at);
      return orderDate >= startDate && orderDate <= endDate;
    });
    
    return {
      orders: filtered,
      total: filtered.reduce((sum, o) => sum + Number(o.amount), 0),
      count: filtered.length
    };
  };

  const handleExportRevenue = () => {
    const { orders: filteredData } = getFilteredRevenueData();
    
    if (filteredData.length === 0) {
      toast.error('No data to export');
      return;
    }

    const csvHeaders = ['Order ID', 'Customer', 'Plan', 'Amount', 'Currency', 'Date'];
    const csvRows = filteredData.map(order => [
      order.id,
      order.metadata?.user_email || 'N/A',
      order.subscription_plans?.name || order.metadata?.plan_name || 'N/A',
      order.amount.toString(),
      order.currency?.toUpperCase() || 'USD',
      format(new Date(order.created_at), 'yyyy-MM-dd HH:mm:ss')
    ]);

    const csvContent = [
      csvHeaders.join(','),
      ...csvRows.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `revenue-report-${revenueFilter}-${format(new Date(), 'yyyy-MM-dd')}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    toast.success(`Exported ${filteredData.length} transactions`);
  };

  const filteredRevenueData = getFilteredRevenueData();

  const handleApprove = async () => {
    if (!selectedOrder || !user) return;
    setProcessing(true);

    try {
      // Update order
      const { error: orderError } = await supabase
        .from('orders')
        .update({
          approval_status: 'approved',
          approved_by: user.id,
          approved_at: new Date().toISOString()
        })
        .eq('id', selectedOrder.id);

      if (orderError) throw orderError;

      // Update tenant subscription if we have plan info
      if (selectedOrder.tenant_id && selectedOrder.plan_id) {
        const subscriptionEnd = new Date();
        subscriptionEnd.setMonth(subscriptionEnd.getMonth() + (selectedOrder.billing_cycle === 'yearly' ? 12 : 1));

        await supabase
          .from('tenants')
          .update({
            subscription_plan_id: selectedOrder.plan_id,
            subscription_status: 'active',
            subscription_ends_at: subscriptionEnd.toISOString(),
            is_suspended: false,
            is_paused: false
          })
          .eq('id', selectedOrder.tenant_id);
      }

      // Log audit
      await supabase.from('audit_log').insert({
        user_id: user.id,
        action: 'order_approved',
        entity_type: 'order',
        entity_id: selectedOrder.id,
        new_values: { approval_status: 'approved' }
      });

      toast.success('Order approved successfully');
      setIsApprovalOpen(false);
      setSelectedOrder(null);
      fetchOrders();
      fetchMetrics();
    } catch (error: any) {
      toast.error('Failed to approve order: ' + error.message);
    } finally {
      setProcessing(false);
    }
  };

  const handleReject = async () => {
    if (!selectedOrder || !user || !rejectionReason.trim()) return;
    setProcessing(true);

    try {
      const { error } = await supabase
        .from('orders')
        .update({
          approval_status: 'rejected',
          rejection_reason: rejectionReason,
          approved_by: user.id,
          approved_at: new Date().toISOString()
        })
        .eq('id', selectedOrder.id);

      if (error) throw error;

      await supabase.from('audit_log').insert({
        user_id: user.id,
        action: 'order_rejected',
        entity_type: 'order',
        entity_id: selectedOrder.id,
        new_values: { approval_status: 'rejected', rejection_reason: rejectionReason }
      });

      toast.success('Order rejected');
      setIsApprovalOpen(false);
      setSelectedOrder(null);
      setRejectionReason('');
      fetchOrders();
    } catch (error: any) {
      toast.error('Failed to reject order: ' + error.message);
    } finally {
      setProcessing(false);
    }
  };

  const filteredOrders = orders.filter(order => {
    const searchLower = searchQuery.toLowerCase();
    const matchesSearch = !searchQuery || 
      order.id.toLowerCase().includes(searchLower) ||
      order.metadata?.user_email?.toLowerCase().includes(searchLower) ||
      order.metadata?.user_name?.toLowerCase().includes(searchLower);
    return matchesSearch;
  });

  const handleDeleteOrder = async () => {
    if (!orderToDelete || !user) return;
    setProcessing(true);

    try {
      const { error } = await supabase
        .from('orders')
        .delete()
        .eq('id', orderToDelete.id);

      if (error) throw error;

      await supabase.from('audit_log').insert({
        user_id: user.id,
        action: 'order_deleted',
        entity_type: 'order',
        entity_id: orderToDelete.id,
        old_values: { order_id: orderToDelete.id, amount: orderToDelete.amount }
      });

      toast.success('Order deleted successfully');
      setIsDeleteDialogOpen(false);
      setOrderToDelete(null);
      fetchOrders();
      fetchMetrics();
    } catch (error: any) {
      toast.error('Failed to delete order: ' + error.message);
    } finally {
      setProcessing(false);
    }
  };

  const handleBulkDelete = async () => {
    if (selectedOrders.length === 0 || !user) return;
    setProcessing(true);

    try {
      const { error } = await supabase
        .from('orders')
        .delete()
        .in('id', selectedOrders);

      if (error) throw error;

      await supabase.from('audit_log').insert({
        user_id: user.id,
        action: 'orders_bulk_deleted',
        entity_type: 'order',
        new_values: { deleted_count: selectedOrders.length }
      });

      toast.success(`${selectedOrders.length} orders deleted successfully`);
      setSelectedOrders([]);
      setIsDeleteDialogOpen(false);
      fetchOrders();
      fetchMetrics();
    } catch (error: any) {
      toast.error('Failed to delete orders: ' + error.message);
    } finally {
      setProcessing(false);
    }
  };

  const handleExportOrders = async () => {
    setIsExporting(true);
    try {
      const ordersToExport = selectedOrders.length > 0
        ? filteredOrders.filter(o => selectedOrders.includes(o.id))
        : filteredOrders;

      const csvHeaders = [
        'Order ID',
        'Customer Name',
        'Customer Email',
        'Plan',
        'Amount',
        'Currency',
        'Billing Cycle',
        'Payment Status',
        'Approval Status',
        'Stripe Customer ID',
        'Stripe Payment Intent',
        'Stripe Subscription ID',
        'Created At',
        'Approved At',
        'Rejection Reason'
      ];

      const csvRows = ordersToExport.map(order => [
        order.id,
        order.metadata?.user_name || 'N/A',
        order.metadata?.user_email || 'N/A',
        order.subscription_plans?.name || order.metadata?.plan_name || 'N/A',
        order.amount.toString(),
        order.currency?.toUpperCase() || 'USD',
        order.billing_cycle,
        order.status,
        order.approval_status,
        order.stripe_customer_id || '',
        order.stripe_payment_intent_id || '',
        order.stripe_subscription_id || '',
        format(new Date(order.created_at), 'yyyy-MM-dd HH:mm:ss'),
        order.approved_at ? format(new Date(order.approved_at), 'yyyy-MM-dd HH:mm:ss') : '',
        order.rejection_reason || ''
      ]);

      const csvContent = [
        csvHeaders.join(','),
        ...csvRows.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
      ].join('\n');

      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `orders-export-${format(new Date(), 'yyyy-MM-dd-HHmmss')}.csv`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      toast.success(`Exported ${ordersToExport.length} orders`);
    } catch (error: any) {
      toast.error('Failed to export orders: ' + error.message);
    } finally {
      setIsExporting(false);
    }
  };

  const toggleOrderSelection = (orderId: string) => {
    setSelectedOrders(prev =>
      prev.includes(orderId)
        ? prev.filter(id => id !== orderId)
        : [...prev, orderId]
    );
  };

  const toggleAllOrders = () => {
    if (selectedOrders.length === filteredOrders.length) {
      setSelectedOrders([]);
    } else {
      setSelectedOrders(filteredOrders.map(o => o.id));
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'completed':
        return <Badge className="bg-green-500/10 text-green-600 border-green-500/20">Completed</Badge>;
      case 'pending':
        return <Badge className="bg-yellow-500/10 text-yellow-600 border-yellow-500/20">Pending</Badge>;
      case 'failed':
        return <Badge className="bg-red-500/10 text-red-600 border-red-500/20">Failed</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  const getApprovalBadge = (status: string) => {
    switch (status) {
      case 'approved':
        return <Badge className="bg-green-500/10 text-green-600 border-green-500/20"><CheckCircle className="h-3 w-3 mr-1" />Approved</Badge>;
      case 'pending_approval':
        return <Badge className="bg-amber-500/10 text-amber-600 border-amber-500/20"><Clock className="h-3 w-3 mr-1" />Pending</Badge>;
      case 'rejected':
        return <Badge className="bg-red-500/10 text-red-600 border-red-500/20"><XCircle className="h-3 w-3 mr-1" />Rejected</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  return (
    <AdminLayout title="Orders & Revenue" description="Manage orders and track revenue">
      <Tabs defaultValue="orders" className="space-y-6">
        <TabsList>
          <TabsTrigger value="orders">Orders</TabsTrigger>
          <TabsTrigger value="revenue">Revenue Analytics</TabsTrigger>
        </TabsList>

        <TabsContent value="orders" className="space-y-6">
          {/* Filters */}
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by ID, email, or name..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Filter by status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Orders</SelectItem>
                <SelectItem value="pending_approval">Pending Approval</SelectItem>
                <SelectItem value="approved">Approved</SelectItem>
                <SelectItem value="rejected">Rejected</SelectItem>
              </SelectContent>
            </Select>
            <div className="flex gap-2">
              {selectedOrders.length > 0 && (
                <Button
                  variant="destructive"
                  onClick={() => { setOrderToDelete(null); setIsDeleteDialogOpen(true); }}
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Delete ({selectedOrders.length})
                </Button>
              )}
              <Button
                variant="outline"
                onClick={handleExportOrders}
                disabled={isExporting}
              >
                {isExporting ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Download className="h-4 w-4 mr-2" />
                )}
                Export {selectedOrders.length > 0 ? `(${selectedOrders.length})` : 'All'}
              </Button>
              <Button variant="outline" onClick={() => { fetchOrders(); fetchMetrics(); }}>
                <RefreshCw className="h-4 w-4 mr-2" />
                Refresh
              </Button>
            </div>
          </div>

          {/* Orders Table */}
          <Card>
            <CardContent className="p-0">
              {loading ? (
                <div className="flex justify-center py-12">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                </div>
              ) : filteredOrders.length === 0 ? (
                <div className="text-center py-12">
                  <ShoppingCart className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">No orders found</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[50px]">
                        <Checkbox
                          checked={selectedOrders.length === filteredOrders.length && filteredOrders.length > 0}
                          onCheckedChange={toggleAllOrders}
                        />
                      </TableHead>
                      <TableHead>Order ID</TableHead>
                      <TableHead>Customer</TableHead>
                      <TableHead>Plan</TableHead>
                      <TableHead>Amount</TableHead>
                      <TableHead>Payment</TableHead>
                      <TableHead>Approval</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredOrders.map((order) => (
                      <TableRow key={order.id}>
                        <TableCell>
                          <Checkbox
                            checked={selectedOrders.includes(order.id)}
                            onCheckedChange={() => toggleOrderSelection(order.id)}
                          />
                        </TableCell>
                        <TableCell className="font-mono text-sm">
                          {order.id.substring(0, 8)}...
                        </TableCell>
                        <TableCell>
                          <div>
                            <p className="font-medium">{order.metadata?.user_name || 'N/A'}</p>
                            <p className="text-sm text-muted-foreground">{order.metadata?.user_email}</p>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div>
                            <p className="font-medium">{order.subscription_plans?.name || order.metadata?.plan_name || 'N/A'}</p>
                            <p className="text-sm text-muted-foreground capitalize">{order.billing_cycle}</p>
                          </div>
                        </TableCell>
                        <TableCell className="font-semibold">
                          ${Number(order.amount).toFixed(2)} {order.currency?.toUpperCase()}
                        </TableCell>
                        <TableCell>{getStatusBadge(order.status)}</TableCell>
                        <TableCell>{getApprovalBadge(order.approval_status)}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {format(new Date(order.created_at), 'MMM dd, yyyy HH:mm')}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => { setSelectedOrder(order); setIsDetailOpen(true); }}
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                            {order.approval_status === 'pending_approval' && order.status === 'completed' && (
                              <Button
                                variant="ghost"
                                size="icon"
                                className="text-green-600"
                                onClick={() => { setSelectedOrder(order); setIsApprovalOpen(true); }}
                              >
                                <CheckCircle className="h-4 w-4" />
                              </Button>
                            )}
                            <Button
                              variant="ghost"
                              size="icon"
                              className="text-destructive"
                              onClick={() => { setOrderToDelete(order); setIsDeleteDialogOpen(true); }}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="revenue" className="space-y-6">
          {/* Filter Controls */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span>Revenue Analytics</span>
                <Button onClick={handleExportRevenue} variant="outline" size="sm">
                  <Download className="h-4 w-4 mr-2" />
                  Export CSV
                </Button>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-4 items-end">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Filter Period</label>
                  <Select value={revenueFilter} onValueChange={setRevenueFilter}>
                    <SelectTrigger className="w-[180px]">
                      <SelectValue placeholder="Select period" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="today">Today</SelectItem>
                      <SelectItem value="week">This Week</SelectItem>
                      <SelectItem value="15days">Last 15 Days</SelectItem>
                      <SelectItem value="30days">Last 30 Days</SelectItem>
                      <SelectItem value="2months">Last 2 Months</SelectItem>
                      <SelectItem value="3months">Last 3 Months</SelectItem>
                      <SelectItem value="6months">Last 6 Months</SelectItem>
                      <SelectItem value="1year">Last 1 Year</SelectItem>
                      <SelectItem value="custom">Custom Date Range</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                
                {revenueFilter === 'custom' && (
                  <>
                    <div className="space-y-2">
                      <label className="text-sm font-medium">From Date</label>
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button variant="outline" className="w-[180px] justify-start text-left font-normal">
                            <CalendarIcon className="mr-2 h-4 w-4" />
                            {customDateFrom ? format(customDateFrom, 'PP') : 'Pick a date'}
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                          <Calendar
                            mode="single"
                            selected={customDateFrom}
                            onSelect={setCustomDateFrom}
                            initialFocus
                          />
                        </PopoverContent>
                      </Popover>
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium">To Date</label>
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button variant="outline" className="w-[180px] justify-start text-left font-normal">
                            <CalendarIcon className="mr-2 h-4 w-4" />
                            {customDateTo ? format(customDateTo, 'PP') : 'Pick a date'}
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                          <Calendar
                            mode="single"
                            selected={customDateTo}
                            onSelect={setCustomDateTo}
                            initialFocus
                          />
                        </PopoverContent>
                      </Popover>
                    </div>
                  </>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Filtered Revenue Summary */}
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-4">
                  <div className="h-12 w-12 rounded-lg bg-green-500/10 flex items-center justify-center">
                    <DollarSign className="h-6 w-6 text-green-500" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Filtered Revenue</p>
                    <p className="text-2xl font-bold">${filteredRevenueData.total.toLocaleString()}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-4">
                  <div className="h-12 w-12 rounded-lg bg-blue-500/10 flex items-center justify-center">
                    <ShoppingCart className="h-6 w-6 text-blue-500" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Transactions</p>
                    <p className="text-2xl font-bold">{filteredRevenueData.count}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-4">
                  <div className="h-12 w-12 rounded-lg bg-purple-500/10 flex items-center justify-center">
                    <TrendingUp className="h-6 w-6 text-purple-500" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Avg. Transaction</p>
                    <p className="text-2xl font-bold">
                      ${filteredRevenueData.count > 0 
                        ? (filteredRevenueData.total / filteredRevenueData.count).toFixed(2) 
                        : '0.00'}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-4">
                  <div className="h-12 w-12 rounded-lg bg-amber-500/10 flex items-center justify-center">
                    <Users className="h-6 w-6 text-amber-500" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">All-Time Revenue</p>
                    <p className="text-2xl font-bold">${metrics.total.toLocaleString()}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Revenue Chart */}
          <Card>
            <CardHeader>
              <CardTitle>Revenue Trend (Last 7 Days)</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis dataKey="date" className="text-xs" />
                    <YAxis className="text-xs" tickFormatter={(value) => `$${value}`} />
                    <Tooltip 
                      formatter={(value: number) => [`$${value.toFixed(2)}`, 'Revenue']}
                      contentStyle={{ 
                        backgroundColor: 'hsl(var(--background))',
                        border: '1px solid hsl(var(--border))',
                        borderRadius: '8px'
                      }}
                    />
                    <Bar dataKey="revenue" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          {/* Transactions Table */}
          <Card>
            <CardHeader>
              <CardTitle>Recent Transactions</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {filteredRevenueData.orders.length === 0 ? (
                <div className="text-center py-12">
                  <ShoppingCart className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">No transactions in selected period</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Order ID</TableHead>
                      <TableHead>Customer</TableHead>
                      <TableHead>Plan</TableHead>
                      <TableHead>Amount</TableHead>
                      <TableHead>Date</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredRevenueData.orders.slice(0, 20).map((order) => (
                      <TableRow key={order.id}>
                        <TableCell className="font-mono text-sm">{order.id.substring(0, 8)}...</TableCell>
                        <TableCell className="text-sm">{order.metadata?.user_email || 'N/A'}</TableCell>
                        <TableCell>{order.subscription_plans?.name || order.metadata?.plan_name || 'N/A'}</TableCell>
                        <TableCell className="font-semibold">${Number(order.amount).toFixed(2)}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {format(new Date(order.created_at), 'MMM dd, yyyy HH:mm')}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Order Detail Dialog */}
      <Dialog open={isDetailOpen} onOpenChange={setIsDetailOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Order Details</DialogTitle>
          </DialogHeader>
          {selectedOrder && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-muted-foreground">Order ID</p>
                  <p className="font-mono">{selectedOrder.id}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Created</p>
                  <p>{format(new Date(selectedOrder.created_at), 'PPpp')}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Customer</p>
                  <p>{selectedOrder.metadata?.user_name}</p>
                  <p className="text-muted-foreground">{selectedOrder.metadata?.user_email}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Plan</p>
                  <p>{selectedOrder.subscription_plans?.name || selectedOrder.metadata?.plan_name}</p>
                  <p className="capitalize text-muted-foreground">{selectedOrder.billing_cycle}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Amount</p>
                  <p className="font-semibold">${Number(selectedOrder.amount).toFixed(2)} {selectedOrder.currency?.toUpperCase()}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Status</p>
                  <div className="flex gap-2 mt-1">
                    {getStatusBadge(selectedOrder.status)}
                    {getApprovalBadge(selectedOrder.approval_status)}
                  </div>
                </div>
              </div>

              <div className="border-t pt-4 space-y-2">
                <p className="font-medium">Stripe References</p>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  {selectedOrder.stripe_customer_id && (
                    <div>
                      <p className="text-muted-foreground">Customer ID</p>
                      <p className="font-mono text-xs">{selectedOrder.stripe_customer_id}</p>
                    </div>
                  )}
                  {selectedOrder.stripe_payment_intent_id && (
                    <div>
                      <p className="text-muted-foreground">Payment Intent</p>
                      <p className="font-mono text-xs">{selectedOrder.stripe_payment_intent_id}</p>
                    </div>
                  )}
                  {selectedOrder.stripe_subscription_id && (
                    <div>
                      <p className="text-muted-foreground">Subscription ID</p>
                      <p className="font-mono text-xs">{selectedOrder.stripe_subscription_id}</p>
                    </div>
                  )}
                  {selectedOrder.stripe_checkout_session_id && (
                    <div>
                      <p className="text-muted-foreground">Checkout Session</p>
                      <p className="font-mono text-xs">{selectedOrder.stripe_checkout_session_id}</p>
                    </div>
                  )}
                </div>
              </div>

              {selectedOrder.rejection_reason && (
                <div className="border-t pt-4">
                  <p className="font-medium text-destructive">Rejection Reason</p>
                  <p className="text-sm">{selectedOrder.rejection_reason}</p>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Approval Dialog */}
      <Dialog open={isApprovalOpen} onOpenChange={setIsApprovalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Approve or Reject Order</DialogTitle>
            <DialogDescription>
              Review the order details and decide whether to approve or reject this purchase.
            </DialogDescription>
          </DialogHeader>
          {selectedOrder && (
            <div className="space-y-4">
              <div className="p-4 bg-muted/50 rounded-lg">
                <p className="font-medium">{selectedOrder.subscription_plans?.name || selectedOrder.metadata?.plan_name}</p>
                <p className="text-sm text-muted-foreground">
                  ${Number(selectedOrder.amount).toFixed(2)} - {selectedOrder.billing_cycle}
                </p>
                <p className="text-sm text-muted-foreground mt-1">
                  Customer: {selectedOrder.metadata?.user_email}
                </p>
              </div>

              <div>
                <p className="text-sm font-medium mb-2">Rejection Reason (optional for rejection)</p>
                <Textarea
                  value={rejectionReason}
                  onChange={(e) => setRejectionReason(e.target.value)}
                  placeholder="Enter reason for rejection..."
                  rows={3}
                />
              </div>
            </div>
          )}
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => { setIsApprovalOpen(false); setRejectionReason(''); }}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleReject}
              disabled={processing || !rejectionReason.trim()}
            >
              {processing && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Reject
            </Button>
            <Button onClick={handleApprove} disabled={processing}>
              {processing && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Approve
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Order{selectedOrders.length > 0 && !orderToDelete ? 's' : ''}</AlertDialogTitle>
            <AlertDialogDescription>
              {orderToDelete
                ? `Are you sure you want to delete order ${orderToDelete.id.substring(0, 8)}...? This action cannot be undone.`
                : `Are you sure you want to delete ${selectedOrders.length} selected order(s)? This action cannot be undone.`
              }
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={orderToDelete ? handleDeleteOrder : handleBulkDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={processing}
            >
              {processing && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AdminLayout>
  );
}
