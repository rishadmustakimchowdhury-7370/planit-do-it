import { useEffect, useMemo, useState } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Trophy, DollarSign, TrendingUp, Users, Building2 } from "lucide-react";
import { format, startOfMonth, startOfQuarter, startOfYear } from "date-fns";
import { Link } from "react-router-dom";

interface PlacementRow {
  id: string;
  placement_date: string;
  start_date: string | null;
  salary: number | null;
  placement_fee: number | null;
  currency: string | null;
  status: string;
  candidate_id: string;
  job_id: string | null;
  client_id: string | null;
  recruiter_user_id: string | null;
  candidates?: { full_name: string } | null;
  jobs?: { title: string } | null;
  clients?: { company_name: string } | null;
}

export default function PlacementsPage() {
  const { tenantId } = useAuth();
  const [rows, setRows] = useState<PlacementRow[]>([]);
  const [recruitersMap, setRecruitersMap] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState<"all" | "month" | "quarter" | "year">("month");
  const [recruiterFilter, setRecruiterFilter] = useState<string>("all");
  const [clientFilter, setClientFilter] = useState<string>("all");

  useEffect(() => {
    if (!tenantId) return;
    (async () => {
      setLoading(true);
      const [{ data }, { data: profiles }] = await Promise.all([
        supabase
          .from("placements")
          .select(`
            id, placement_date, start_date, salary, placement_fee, currency, status,
            candidate_id, job_id, client_id, recruiter_user_id,
            candidates:candidate_id ( full_name ),
            jobs:job_id ( title ),
            clients:client_id ( company_name )
          `)
          .eq("tenant_id", tenantId)
          .order("placement_date", { ascending: false }),
        supabase.from("profiles").select("id, full_name, email").eq("tenant_id", tenantId),
      ]);
      setRows((data ?? []) as any);
      const map: Record<string, string> = {};
      (profiles ?? []).forEach((p: any) => { map[p.id] = p.full_name || p.email; });
      setRecruitersMap(map);
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
    const placementsThisMonth = rows.filter(
      (r) => new Date(r.placement_date) >= startOfMonth(new Date())
    ).length;
    const fees = filtered.map((r) => Number(r.placement_fee || 0));
    const totalRevenue = fees.reduce((a, b) => a + b, 0);
    const avgFee = fees.length ? totalRevenue / fees.length : 0;

    const tally = (key: "recruiter_user_id" | "client_id") => {
      const counts: Record<string, { count: number; revenue: number; label: string }> = {};
      filtered.forEach((r) => {
        const id = (r as any)[key] as string | null;
        if (!id) return;
        const label =
          key === "recruiter_user_id"
            ? recruitersMap[id] || "Recruiter"
            : r.clients?.company_name || "Client";
        if (!counts[id]) counts[id] = { count: 0, revenue: 0, label };
        counts[id].count += 1;
        counts[id].revenue += Number(r.placement_fee || 0);
      });
      return Object.entries(counts)
        .sort((a, b) => b[1].count - a[1].count)
        .slice(0, 5);
    };

    return {
      placementsThisMonth,
      totalRevenue,
      avgFee,
      topRecruiters: tally("recruiter_user_id"),
      topClients: tally("client_id"),
    };
  }, [rows, filtered, recruitersMap]);

  const recruiterOptions = useMemo(
    () => Array.from(new Set(rows.map((r) => r.recruiter_user_id).filter(Boolean))) as string[],
    [rows]
  );
  const clientOptions = useMemo(
    () => Array.from(
      new Map(rows.filter(r => r.client_id).map((r) => [r.client_id!, r.clients?.company_name || "Client"]))
    ),
    [rows]
  );

  const fmtMoney = (val: number, ccy?: string | null) =>
    new Intl.NumberFormat(undefined, { style: "currency", currency: ccy || "USD", maximumFractionDigits: 0 }).format(val);

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2"><Trophy className="w-6 h-6 text-success" /> Placements</h1>
            <p className="text-sm text-muted-foreground">Source of truth for successful hires and revenue.</p>
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
          </div>
        </div>

        {/* Metrics */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <MetricCard icon={Trophy} label="Placements This Month" value={metrics.placementsThisMonth.toString()} />
          <MetricCard icon={DollarSign} label="Placement Revenue" value={fmtMoney(metrics.totalRevenue)} />
          <MetricCard icon={TrendingUp} label="Average Fee" value={fmtMoney(metrics.avgFee)} />
          <MetricCard icon={Users} label="Total (filtered)" value={filtered.length.toString()} />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <LeaderboardCard title="Top Recruiters" icon={Users} entries={metrics.topRecruiters} formatMoney={fmtMoney} />
          <LeaderboardCard title="Top Clients" icon={Building2} entries={metrics.topClients} formatMoney={fmtMoney} />
        </div>

        {/* Table */}
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
        <div>
          <p className="text-xs text-muted-foreground">{label}</p>
          <p className="text-xl font-bold">{value}</p>
        </div>
      </CardContent>
    </Card>
  );
}

function LeaderboardCard({
  title, icon: Icon, entries, formatMoney,
}: {
  title: string; icon: any;
  entries: Array<[string, { count: number; revenue: number; label: string }]>;
  formatMoney: (v: number) => string;
}) {
  return (
    <Card>
      <CardHeader><CardTitle className="flex items-center gap-2 text-base"><Icon className="w-4 h-4" /> {title}</CardTitle></CardHeader>
      <CardContent>
        {entries.length === 0 ? (
          <p className="text-sm text-muted-foreground">No data yet.</p>
        ) : (
          <ul className="space-y-2">
            {entries.map(([id, e]) => (
              <li key={id} className="flex items-center justify-between text-sm">
                <span className="font-medium truncate">{e.label}</span>
                <span className="text-muted-foreground tabular-nums">{e.count} · {formatMoney(e.revenue)}</span>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
