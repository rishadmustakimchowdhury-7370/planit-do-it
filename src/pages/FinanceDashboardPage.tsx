import { useEffect, useMemo, useState } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { formatMoney, INVOICE_STATUS_COLORS } from "@/lib/finance";
import { cn } from "@/lib/utils";
import { DollarSign, FileText, AlertCircle, TrendingUp, Loader2, Download } from "lucide-react";
import { startOfMonth, startOfQuarter, startOfYear, format } from "date-fns";
import { Navigate } from "react-router-dom";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import * as XLSX from "xlsx";

export default function FinanceDashboardPage() {
  const { tenantId, isOwner, isManager, isLoading: authLoading } = useAuth();
  const [loading, setLoading] = useState(true);
  const [invoices, setInvoices] = useState<any[]>([]);
  const [period, setPeriod] = useState<"month" | "quarter" | "year" | "all">("month");

  useEffect(() => {
    if (!tenantId) return;
    (async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from("invoices")
        .select("*, clients(name)")
        .eq("tenant_id", tenantId)
        .order("created_at", { ascending: false });
      if (error) console.error("[finance-dashboard]", error);
      setInvoices(data || []);
      setLoading(false);
    })();
  }, [tenantId]);

  if (authLoading) return <AppLayout><Loader2 className="animate-spin m-6" /></AppLayout>;
  if (!isOwner && !isManager) return <Navigate to="/dashboard" replace />;

  const periodStart = useMemo(() => {
    const now = new Date();
    if (period === "month") return startOfMonth(now);
    if (period === "quarter") return startOfQuarter(now);
    if (period === "year") return startOfYear(now);
    return new Date(0);
  }, [period]);

  const inPeriod = invoices.filter(i => i.issue_date && new Date(i.issue_date) >= periodStart);

  const totalRevenue = inPeriod.filter(i => i.status === "paid").reduce((s, i) => s + Number(i.total_amount || 0), 0);
  const outstanding = invoices.filter(i => ["sent", "overdue"].includes(i.status)).reduce((s, i) => s + Number(i.balance || 0), 0);
  const overdueCount = invoices.filter(i => i.status === "overdue" || (i.status === "sent" && i.due_date && new Date(i.due_date) < new Date() && Number(i.balance) > 0)).length;
  const paidCount = inPeriod.filter(i => i.status === "paid").length;

  const byClient = useMemo(() => {
    const m = new Map<string, { name: string; revenue: number; invoices: number }>();
    inPeriod.filter(i => i.status === "paid").forEach(i => {
      const k = i.client_id || "unknown";
      const name = i.clients?.name || "Unknown";
      const cur = m.get(k) || { name, revenue: 0, invoices: 0 };
      cur.revenue += Number(i.total_amount || 0); cur.invoices += 1;
      m.set(k, cur);
    });
    return Array.from(m.values()).sort((a, b) => b.revenue - a.revenue);
  }, [inPeriod]);

  const byMonth = useMemo(() => {
    const m = new Map<string, number>();
    invoices.filter(i => i.status === "paid" && i.paid_at).forEach(i => {
      const k = format(new Date(i.paid_at), "MMM yyyy");
      m.set(k, (m.get(k) || 0) + Number(i.total_amount || 0));
    });
    return Array.from(m.entries()).slice(-12).map(([month, revenue]) => ({ month, revenue }));
  }, [invoices]);

  const exportXLSX = () => {
    const ws = XLSX.utils.json_to_sheet(invoices.map(i => ({
      Invoice: i.invoice_number, Client: i.clients?.name, Status: i.status,
      Currency: i.currency, Subtotal: i.subtotal, Tax: i.tax_amount, VAT: i.vat_amount,
      Total: i.total_amount, Paid: i.amount_paid, Balance: i.balance,
      Issued: i.issue_date, Due: i.due_date, PaidAt: i.paid_at,
    })));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Invoices");
    XLSX.writeFile(wb, `finance-${format(new Date(), "yyyyMMdd")}.xlsx`);
  };

  return (
    <AppLayout>
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Finance Dashboard</h1>
            <p className="text-muted-foreground">Revenue, outstanding balance and client performance.</p>
          </div>
          <div className="flex gap-2">
            <Select value={period} onValueChange={(v: any) => setPeriod(v)}>
              <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="month">This Month</SelectItem>
                <SelectItem value="quarter">This Quarter</SelectItem>
                <SelectItem value="year">This Year</SelectItem>
                <SelectItem value="all">All Time</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="outline" onClick={exportXLSX}><Download className="w-4 h-4 mr-2" />Export</Button>
          </div>
        </div>

        {loading ? <Loader2 className="animate-spin" /> : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <Card><CardContent className="pt-6">
                <div className="flex items-center justify-between"><span className="text-sm text-muted-foreground">Revenue</span><DollarSign className="w-4 h-4 text-green-600" /></div>
                <div className="text-2xl font-bold mt-2">{totalRevenue.toLocaleString(undefined,{minimumFractionDigits:2,maximumFractionDigits:2})}</div>
                <div className="text-xs text-muted-foreground">{paidCount} paid invoice(s)</div>
              </CardContent></Card>
              <Card><CardContent className="pt-6">
                <div className="flex items-center justify-between"><span className="text-sm text-muted-foreground">Outstanding</span><FileText className="w-4 h-4 text-blue-600" /></div>
                <div className="text-2xl font-bold mt-2 text-blue-600">{outstanding.toLocaleString(undefined,{minimumFractionDigits:2,maximumFractionDigits:2})}</div>
              </CardContent></Card>
              <Card><CardContent className="pt-6">
                <div className="flex items-center justify-between"><span className="text-sm text-muted-foreground">Overdue Invoices</span><AlertCircle className="w-4 h-4 text-red-600" /></div>
                <div className="text-2xl font-bold mt-2 text-red-600">{overdueCount}</div>
              </CardContent></Card>
              <Card><CardContent className="pt-6">
                <div className="flex items-center justify-between"><span className="text-sm text-muted-foreground">Total Invoices</span><TrendingUp className="w-4 h-4 text-primary" /></div>
                <div className="text-2xl font-bold mt-2">{invoices.length}</div>
              </CardContent></Card>
            </div>

            <Card><CardContent className="pt-6">
              <h3 className="font-semibold mb-4">Revenue by Month</h3>
              {byMonth.length === 0 ? <p className="text-muted-foreground text-sm">No paid invoices yet.</p> : (
                <ResponsiveContainer width="100%" height={280}>
                  <BarChart data={byMonth}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="month" /><YAxis />
                    <Tooltip />
                    <Bar dataKey="revenue" fill="#3B82F6" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </CardContent></Card>

            <Card><CardContent className="pt-6">
              <h3 className="font-semibold mb-4">Top Clients by Revenue</h3>
              {byClient.length === 0 ? <p className="text-muted-foreground text-sm">No data.</p> : (
                <Table>
                  <TableHeader><TableRow><TableHead>Client</TableHead><TableHead>Invoices</TableHead><TableHead className="text-right">Revenue</TableHead></TableRow></TableHeader>
                  <TableBody>{byClient.slice(0, 10).map(c => (
                    <TableRow key={c.name}><TableCell>{c.name}</TableCell><TableCell>{c.invoices}</TableCell><TableCell className="text-right font-medium">{c.revenue.toLocaleString(undefined,{minimumFractionDigits:2,maximumFractionDigits:2})}</TableCell></TableRow>
                  ))}</TableBody>
                </Table>
              )}
            </CardContent></Card>

            <Card><CardContent className="pt-6">
              <h3 className="font-semibold mb-4">Recent Invoices</h3>
              <Table>
                <TableHeader><TableRow><TableHead>#</TableHead><TableHead>Client</TableHead><TableHead>Issued</TableHead><TableHead className="text-right">Total</TableHead><TableHead className="text-right">Balance</TableHead><TableHead>Status</TableHead></TableRow></TableHeader>
                <TableBody>{invoices.slice(0, 15).map(i => (
                  <TableRow key={i.id}>
                    <TableCell className="font-mono text-sm">{i.invoice_number}</TableCell>
                    <TableCell>{i.clients?.name || "—"}</TableCell>
                    <TableCell>{i.issue_date ? format(new Date(i.issue_date), "dd MMM yyyy") : "—"}</TableCell>
                    <TableCell className="text-right">{formatMoney(i.total_amount, i.currency)}</TableCell>
                    <TableCell className="text-right">{formatMoney(i.balance, i.currency)}</TableCell>
                    <TableCell><Badge className={cn(INVOICE_STATUS_COLORS[i.status])} variant="outline">{i.status}</Badge></TableCell>
                  </TableRow>
                ))}</TableBody>
              </Table>
            </CardContent></Card>
          </>
        )}
      </div>
    </AppLayout>
  );
}
