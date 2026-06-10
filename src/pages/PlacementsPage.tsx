import { useEffect, useMemo, useState } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import {
  Trophy, DollarSign, TrendingUp, Users, Building2, Download, FileSpreadsheet,
  Calendar, BarChart3,
} from "lucide-react";
import {
  format, startOfMonth, startOfQuarter, startOfYear, subYears,
} from "date-fns";
import { Link } from "react-router-dom";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
  PieChart, Pie, Cell, Legend,
} from "recharts";
import * as XLSX from "xlsx";

interface PlacementRow {
  id: string;
  placement_date: string;
  start_date: string | null;
  salary: number | null;
  placement_fee: number | null;
  fee_pct: number | null;
  guarantee_period_days: number | null;
  currency: string | null;
  status: string;
  candidate_id: string;
  job_id: string | null;
  client_id: string | null;
  recruiter_user_id: string | null;
  candidates?: { full_name: string } | null;
  jobs?: { title: string } | null;
  clients?: { company_name: string; industry?: string | null } | null;
}

const COLORS = ["#3B82F6", "#10B981", "#F59E0B", "#EF4444", "#8B5CF6", "#06B6D4", "#EC4899", "#84CC16"];

export default function PlacementsPage() {
  const { tenantId } = useAuth();
  const [rows, setRows] = useState<PlacementRow[]>([]);
  const [recruitersMap, setRecruitersMap] = useState<Record<string, string>>({});
  const [jobsStatus, setJobsStatus] = useState<{ open: Record<string, number>; closed: Record<string, number> }>({ open: {}, closed: {} });
  const [submissionsByRecruiter, setSubmissionsByRecruiter] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState<"all" | "month" | "quarter" | "year">("month");
  const [recruiterFilter, setRecruiterFilter] = useState<string>("all");
  const [clientFilter, setClientFilter] = useState<string>("all");

  useEffect(() => {
    if (!tenantId) return;
    (async () => {
      setLoading(true);
      const [placements, profiles, jobsRows, subs] = await Promise.all([
        supabase
          .from("placements")
          .select(`
            id, placement_date, start_date, salary, placement_fee, fee_pct, guarantee_period_days,
            currency, status, candidate_id, job_id, client_id, recruiter_user_id,
            candidates:candidate_id ( full_name ),
            jobs:job_id ( title ),
            clients:client_id ( company_name, industry )
          `)
          .eq("tenant_id", tenantId)
          .order("placement_date", { ascending: false }),
        supabase.from("profiles").select("id, full_name, email").eq("tenant_id", tenantId),
        supabase.from("jobs").select("id, status, client_id").eq("tenant_id", tenantId),
        supabase.from("candidate_submissions").select("submitted_by").eq("tenant_id", tenantId),
      ]);

      setRows((placements.data ?? []) as any);
      const map: Record<string, string> = {};
      (profiles.data ?? []).forEach((p: any) => { map[p.id] = p.full_name || p.email; });
      setRecruitersMap(map);

      const open: Record<string, number> = {}, closed: Record<string, number> = {};
      (jobsRows.data ?? []).forEach((j: any) => {
        if (!j.client_id) return;
        const isClosed = ["closed", "filled", "archived", "cancelled"].includes((j.status || "").toLowerCase());
        const bucket = isClosed ? closed : open;
        bucket[j.client_id] = (bucket[j.client_id] || 0) + 1;
      });
      setJobsStatus({ open, closed });

      const sub: Record<string, number> = {};
      (subs.data ?? []).forEach((s: any) => {
        if (s.submitted_by) sub[s.submitted_by] = (sub[s.submitted_by] || 0) + 1;
      });
      setSubmissionsByRecruiter(sub);

      setLoading(false);
    })();
  }, [tenantId]);

  const filtered = useMemo(() => {
    const now = new Date();
    const cutoff =
      period === "month" ? startOfMonth(now) :
      period === "quarter" ? startOfQuarter(now) :
      period === "year" ? startOfYear(now) : null;
    return rows.filter((r) => {
      if (cutoff && new Date(r.placement_date) < cutoff) return false;
      if (recruiterFilter !== "all" && r.recruiter_user_id !== recruiterFilter) return false;
      if (clientFilter !== "all" && r.client_id !== clientFilter) return false;
      return true;
    });
  }, [rows, period, recruiterFilter, clientFilter]);

  const metrics = useMemo(() => {
    const now = new Date();
    const inRange = (r: PlacementRow, start: Date) => new Date(r.placement_date) >= start;
    const sumFee = (arr: PlacementRow[]) => arr.reduce((a, b) => a + Number(b.placement_fee || 0), 0);

    const m = rows.filter((r) => inRange(r, startOfMonth(now)));
    const q = rows.filter((r) => inRange(r, startOfQuarter(now)));
    const y = rows.filter((r) => inRange(r, startOfYear(now)));

    const fees = filtered.map((r) => Number(r.placement_fee || 0));
    const salaries = filtered.map((r) => Number(r.salary || 0)).filter((v) => v > 0);
    const totalRevenue = fees.reduce((a, b) => a + b, 0);

    return {
      countMonth: m.length, countQuarter: q.length, countYear: y.length,
      revenueMonth: sumFee(m), revenueQuarter: sumFee(q), revenueYear: sumFee(y),
      avgFee: fees.length ? totalRevenue / fees.length : 0,
      avgSalary: salaries.length ? salaries.reduce((a, b) => a + b, 0) / salaries.length : 0,
      totalRevenue,
    };
  }, [rows, filtered]);

  // Recruiter performance
  const recruiterPerf = useMemo(() => {
    const agg: Record<string, { placements: number; revenue: number; name: string }> = {};
    filtered.forEach((r) => {
      const id = r.recruiter_user_id; if (!id) return;
      if (!agg[id]) agg[id] = { placements: 0, revenue: 0, name: recruitersMap[id] || "Recruiter" };
      agg[id].placements++;
      agg[id].revenue += Number(r.placement_fee || 0);
    });
    return Object.entries(agg).map(([id, v]) => {
      const subs = submissionsByRecruiter[id] || 0;
      return {
        id, ...v,
        submissions: subs,
        conversionRate: subs > 0 ? (v.placements / subs) * 100 : 0,
      };
    }).sort((a, b) => b.revenue - a.revenue);
  }, [filtered, recruitersMap, submissionsByRecruiter]);

  // Client performance
  const clientPerf = useMemo(() => {
    const agg: Record<string, { placements: number; revenue: number; name: string }> = {};
    filtered.forEach((r) => {
      const id = r.client_id; if (!id) return;
      if (!agg[id]) agg[id] = { placements: 0, revenue: 0, name: r.clients?.company_name || "Client" };
      agg[id].placements++;
      agg[id].revenue += Number(r.placement_fee || 0);
    });
    return Object.entries(agg).map(([id, v]) => ({
      id, ...v,
      openJobs: jobsStatus.open[id] || 0,
      closedJobs: jobsStatus.closed[id] || 0,
    })).sort((a, b) => b.revenue - a.revenue);
  }, [filtered, jobsStatus]);

  // Revenue by month chart (last 12 months from rows, not filtered, to show trend)
  const revenueByMonth = useMemo(() => {
    const months: Record<string, { month: string; revenue: number; count: number }> = {};
    const cutoff = subYears(new Date(), 1);
    rows.filter((r) => new Date(r.placement_date) >= cutoff).forEach((r) => {
      const k = format(new Date(r.placement_date), "MMM yyyy");
      if (!months[k]) months[k] = { month: k, revenue: 0, count: 0 };
      months[k].revenue += Number(r.placement_fee || 0);
      months[k].count++;
    });
    return Object.values(months);
  }, [rows]);

  const placementsByIndustry = useMemo(() => {
    const agg: Record<string, number> = {};
    filtered.forEach((r) => {
      const ind = r.clients?.industry || "Other";
      agg[ind] = (agg[ind] || 0) + 1;
    });
    return Object.entries(agg).map(([name, value]) => ({ name, value }));
  }, [filtered]);

  const recruiterOptions = useMemo(
    () => Array.from(new Set(rows.map((r) => r.recruiter_user_id).filter(Boolean))) as string[],
    [rows]
  );
  const clientOptions = useMemo(
    () => Array.from(
      new Map(rows.filter((r) => r.client_id).map((r) => [r.client_id!, r.clients?.company_name || "Client"]))
    ),
    [rows]
  );

  const fmtMoney = (val: number, ccy?: string | null) =>
    new Intl.NumberFormat(undefined, { style: "currency", currency: ccy || "USD", maximumFractionDigits: 0 }).format(val);

  // Exports
  function downloadCSV(rows: any[], filename: string) {
    if (!rows.length) return;
    const headers = Object.keys(rows[0]);
    const csv = [
      headers.join(","),
      ...rows.map((r) => headers.map((h) => {
        const v = r[h]; if (v == null) return "";
        const s = String(v).replace(/"/g, '""');
        return /[,"\n]/.test(s) ? `"${s}"` : s;
      }).join(","))
    ].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob); a.download = filename; a.click();
    URL.revokeObjectURL(a.href);
  }

  function downloadXLSX() {
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(filtered.map((r) => ({
      Candidate: r.candidates?.full_name ?? "",
      Client: r.clients?.company_name ?? "",
      Job: r.jobs?.title ?? "",
      Recruiter: r.recruiter_user_id ? recruitersMap[r.recruiter_user_id] ?? "" : "",
      PlacementDate: r.placement_date,
      StartDate: r.start_date ?? "",
      Salary: r.salary ?? 0,
      Fee: r.placement_fee ?? 0,
      FeePct: r.fee_pct ?? "",
      Currency: r.currency ?? "",
      Guarantee: r.guarantee_period_days ?? "",
      Status: r.status,
    }))), "Placements");
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(recruiterPerf.map((r) => ({
      Recruiter: r.name, Placements: r.placements, Revenue: r.revenue,
      Submissions: r.submissions, ConversionRatePct: Number(r.conversionRate.toFixed(2)),
    }))), "Recruiter Performance");
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(clientPerf.map((c) => ({
      Client: c.name, Placements: c.placements, Revenue: c.revenue,
      OpenJobs: c.openJobs, ClosedJobs: c.closedJobs,
    }))), "Client Performance");
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(revenueByMonth.map((m) => ({
      Month: m.month, Revenue: m.revenue, Placements: m.count,
    }))), "Revenue By Month");
    XLSX.writeFile(wb, `placements_${format(new Date(), "yyyy-MM-dd")}.xlsx`);
  }

  function exportPlacementsCSV() {
    downloadCSV(filtered.map((r) => ({
      candidate: r.candidates?.full_name ?? "",
      client: r.clients?.company_name ?? "",
      job: r.jobs?.title ?? "",
      recruiter: r.recruiter_user_id ? recruitersMap[r.recruiter_user_id] ?? "" : "",
      placement_date: r.placement_date,
      start_date: r.start_date ?? "",
      salary: r.salary ?? 0,
      fee: r.placement_fee ?? 0,
      fee_pct: r.fee_pct ?? "",
      currency: r.currency ?? "",
      guarantee_days: r.guarantee_period_days ?? "",
      status: r.status,
    })), `placements_${format(new Date(), "yyyy-MM-dd")}.csv`);
  }

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Trophy className="w-6 h-6 text-success" /> Placements & Revenue
            </h1>
            <p className="text-sm text-muted-foreground">Source of truth for successful hires, revenue and performance.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Select value={period} onValueChange={(v) => setPeriod(v as any)}>
              <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="month">This Month</SelectItem>
                <SelectItem value="quarter">This Quarter</SelectItem>
                <SelectItem value="year">This Year</SelectItem>
                <SelectItem value="all">All Time</SelectItem>
              </SelectContent>
            </Select>
            <Select value={recruiterFilter} onValueChange={setRecruiterFilter}>
              <SelectTrigger className="w-44"><SelectValue placeholder="Recruiter" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Recruiters</SelectItem>
                {recruiterOptions.map((id) => (
                  <SelectItem key={id} value={id}>{recruitersMap[id] || "Recruiter"}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={clientFilter} onValueChange={setClientFilter}>
              <SelectTrigger className="w-44"><SelectValue placeholder="Client" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Clients</SelectItem>
                {clientOptions.map(([id, name]) => (
                  <SelectItem key={id} value={id}>{name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button variant="outline" size="sm" onClick={exportPlacementsCSV}>
              <Download className="w-4 h-4 mr-1" /> CSV
            </Button>
            <Button variant="outline" size="sm" onClick={downloadXLSX}>
              <FileSpreadsheet className="w-4 h-4 mr-1" /> Excel
            </Button>
          </div>
        </div>

        {/* Period KPI cards */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          <MetricCard icon={Calendar} label="Placements (Month)" value={metrics.countMonth.toString()} />
          <MetricCard icon={Calendar} label="Placements (Quarter)" value={metrics.countQuarter.toString()} />
          <MetricCard icon={Calendar} label="Placements (Year)" value={metrics.countYear.toString()} />
          <MetricCard icon={DollarSign} label="Revenue (Month)" value={fmtMoney(metrics.revenueMonth)} />
          <MetricCard icon={DollarSign} label="Revenue (Quarter)" value={fmtMoney(metrics.revenueQuarter)} />
          <MetricCard icon={DollarSign} label="Revenue (Year)" value={fmtMoney(metrics.revenueYear)} />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <MetricCard icon={TrendingUp} label="Average Placement Fee" value={fmtMoney(metrics.avgFee)} />
          <MetricCard icon={DollarSign} label="Average Salary" value={fmtMoney(metrics.avgSalary)} />
          <MetricCard icon={Trophy} label="Filtered Revenue" value={fmtMoney(metrics.totalRevenue)} />
        </div>

        {/* Charts */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <Card>
            <CardHeader><CardTitle className="text-base flex items-center gap-2"><BarChart3 className="w-4 h-4" /> Placement Revenue by Month</CardTitle></CardHeader>
            <CardContent className="h-72">
              {revenueByMonth.length === 0 ? (
                <p className="text-sm text-muted-foreground py-8 text-center">No data yet.</p>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={revenueByMonth}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="month" />
                    <YAxis />
                    <Tooltip formatter={(v: any) => fmtMoney(Number(v))} />
                    <Bar dataKey="revenue" fill="#3B82F6" />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="text-base flex items-center gap-2"><BarChart3 className="w-4 h-4" /> Placements by Industry</CardTitle></CardHeader>
            <CardContent className="h-72">
              {placementsByIndustry.length === 0 ? (
                <p className="text-sm text-muted-foreground py-8 text-center">No data yet.</p>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={placementsByIndustry} dataKey="value" nameKey="name" outerRadius={90} label>
                      {placementsByIndustry.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                    </Pie>
                    <Tooltip />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Recruiter performance */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2"><Users className="w-4 h-4" /> Recruiter Performance</CardTitle>
            <Button variant="ghost" size="sm" onClick={() => downloadCSV(
              recruiterPerf.map((r) => ({ recruiter: r.name, placements: r.placements, revenue: r.revenue, submissions: r.submissions, conversion_rate_pct: Number(r.conversionRate.toFixed(2)) })),
              "recruiter_performance.csv"
            )}><Download className="w-4 h-4 mr-1" /> CSV</Button>
          </CardHeader>
          <CardContent>
            {recruiterPerf.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6">No recruiter activity in this range.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Recruiter</TableHead>
                    <TableHead className="text-right">Placements</TableHead>
                    <TableHead className="text-right">Revenue</TableHead>
                    <TableHead className="text-right">Submissions</TableHead>
                    <TableHead className="text-right">Conversion</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {recruiterPerf.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell className="font-medium">{r.name}</TableCell>
                      <TableCell className="text-right">{r.placements}</TableCell>
                      <TableCell className="text-right">{fmtMoney(r.revenue)}</TableCell>
                      <TableCell className="text-right">{r.submissions}</TableCell>
                      <TableCell className="text-right">{r.conversionRate.toFixed(1)}%</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {/* Client performance */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2"><Building2 className="w-4 h-4" /> Client Performance</CardTitle>
            <Button variant="ghost" size="sm" onClick={() => downloadCSV(
              clientPerf.map((c) => ({ client: c.name, placements: c.placements, revenue: c.revenue, open_jobs: c.openJobs, closed_jobs: c.closedJobs })),
              "client_performance.csv"
            )}><Download className="w-4 h-4 mr-1" /> CSV</Button>
          </CardHeader>
          <CardContent>
            {clientPerf.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6">No client activity in this range.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Client</TableHead>
                    <TableHead className="text-right">Placements</TableHead>
                    <TableHead className="text-right">Revenue</TableHead>
                    <TableHead className="text-right">Open Jobs</TableHead>
                    <TableHead className="text-right">Closed Jobs</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {clientPerf.map((c) => (
                    <TableRow key={c.id}>
                      <TableCell className="font-medium">{c.name}</TableCell>
                      <TableCell className="text-right">{c.placements}</TableCell>
                      <TableCell className="text-right">{fmtMoney(c.revenue)}</TableCell>
                      <TableCell className="text-right">{c.openJobs}</TableCell>
                      <TableCell className="text-right">{c.closedJobs}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {/* All placements table */}
        <Card>
          <CardHeader><CardTitle>All Placements</CardTitle></CardHeader>
          <CardContent>
            {loading ? (
              <Skeleton className="h-48 w-full" />
            ) : filtered.length === 0 ? (
              <p className="text-sm text-muted-foreground py-8 text-center">No placements match these filters.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Candidate</TableHead>
                    <TableHead>Client</TableHead>
                    <TableHead>Job Title</TableHead>
                    <TableHead>Recruiter</TableHead>
                    <TableHead>Placement Date</TableHead>
                    <TableHead className="text-right">Salary</TableHead>
                    <TableHead className="text-right">Fee</TableHead>
                    <TableHead className="text-right">Fee %</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell>
                        <Link to={`/candidates/${r.candidate_id}`} className="hover:underline font-medium">
                          {r.candidates?.full_name || "—"}
                        </Link>
                      </TableCell>
                      <TableCell>{r.clients?.company_name || "—"}</TableCell>
                      <TableCell>{r.jobs?.title || "—"}</TableCell>
                      <TableCell>{r.recruiter_user_id ? recruitersMap[r.recruiter_user_id] || "—" : "—"}</TableCell>
                      <TableCell>{format(new Date(r.placement_date), "dd MMM yyyy")}</TableCell>
                      <TableCell className="text-right">{r.salary ? fmtMoney(Number(r.salary), r.currency) : "—"}</TableCell>
                      <TableCell className="text-right">{r.placement_fee ? fmtMoney(Number(r.placement_fee), r.currency) : "—"}</TableCell>
                      <TableCell className="text-right">{r.fee_pct ? `${Number(r.fee_pct).toFixed(1)}%` : "—"}</TableCell>
                      <TableCell><Badge variant="secondary">{r.status}</Badge></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}

function MetricCard({ icon: Icon, label, value }: { icon: any; label: string; value: string }) {
  return (
    <Card>
      <CardContent className="p-4 flex items-center gap-3">
        <div className="p-2 rounded-lg bg-primary/10"><Icon className="w-5 h-5 text-primary" /></div>
        <div className="min-w-0">
          <p className="text-xs text-muted-foreground truncate">{label}</p>
          <p className="text-xl font-bold truncate">{value}</p>
        </div>
      </CardContent>
    </Card>
  );
}
