import { useEffect, useState } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { formatMoney, BONUS_STATUS_COLORS } from "@/lib/finance";
import { cn } from "@/lib/utils";
import { Plus, Loader2, MoreVertical, Trophy } from "lucide-react";
import { format } from "date-fns";
import { toast } from "@/hooks/use-toast";
import { CreateBonusDialog } from "@/components/finance/CreateBonusDialog";

export default function RecruiterBonusesPage() {
  const { tenantId, user, isOwner, isManager } = useAuth();
  const canManage = isOwner || isManager;
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("all");
  const [createOpen, setCreateOpen] = useState(false);
  const [profiles, setProfiles] = useState<Record<string, string>>({});

  const load = async () => {
    if (!tenantId) return;
    setLoading(true);
    let query = supabase
      .from("recruiter_bonuses")
      .select("*, placements(placement_date, placement_fee, candidates(full_name), jobs(title), clients(name))")
      .eq("tenant_id", tenantId)
      .order("created_at", { ascending: false });
    const { data, error } = await query;
    if (error) console.error(error);
    setRows(data || []);
    const ids = Array.from(new Set((data || []).map(r => r.recruiter_user_id).filter(Boolean)));
    if (ids.length) {
      const { data: p } = await supabase.from("profiles").select("id, full_name, email").in("id", ids);
      const map: Record<string, string> = {};
      (p || []).forEach(x => { map[x.id] = x.full_name || x.email || "?"; });
      setProfiles(map);
    }
    setLoading(false);
  };
  useEffect(() => { load(); }, [tenantId]);

  const updateStatus = async (id: string, status: string) => {
    const patch: any = { status };
    if (status === "approved") { patch.approved_by = user?.id; patch.approved_at = new Date().toISOString(); }
    if (status === "paid") { patch.paid_by = user?.id; patch.paid_at = new Date().toISOString(); }
    const { error } = await supabase.from("recruiter_bonuses").update(patch).eq("id", id);
    if (error) { toast({ title: "Failed", description: error.message, variant: "destructive" }); return; }
    await supabase.from("finance_audit_log").insert({ tenant_id: tenantId!, entity_type: "bonus", entity_id: id, action: `status:${status}`, performed_by: user?.id });
    toast({ title: `Bonus ${status}` });
    load();
  };

  const filtered = rows.filter(r => statusFilter === "all" || r.status === statusFilter);

  const totals = {
    earned: rows.filter(r => r.status !== "cancelled").reduce((s, r) => s + Number(r.bonus_amount || 0), 0),
    paid: rows.filter(r => r.status === "paid").reduce((s, r) => s + Number(r.bonus_amount || 0), 0),
    pending: rows.filter(r => r.status === "pending" || r.status === "approved").reduce((s, r) => s + Number(r.bonus_amount || 0), 0),
  };

  return (
    <AppLayout>
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Recruiter Bonuses</h1>
            <p className="text-muted-foreground">{canManage ? "Manually approve, pay or cancel recruiter bonuses." : "Your earned bonuses."}</p>
          </div>
          {canManage && (
            <Button onClick={() => setCreateOpen(true)}>
              <Plus className="w-4 h-4 mr-2" />New bonus
            </Button>
          )}
        </div>

        {canManage && (
          <div className="grid grid-cols-3 gap-4">
            <Card><CardContent className="pt-6"><div className="text-sm text-muted-foreground">Total Earned</div><div className="text-2xl font-bold">{totals.earned.toLocaleString(undefined,{minimumFractionDigits:2,maximumFractionDigits:2})}</div></CardContent></Card>
            <Card><CardContent className="pt-6"><div className="text-sm text-muted-foreground">Paid</div><div className="text-2xl font-bold text-green-600">{totals.paid.toLocaleString(undefined,{minimumFractionDigits:2,maximumFractionDigits:2})}</div></CardContent></Card>
            <Card><CardContent className="pt-6"><div className="text-sm text-muted-foreground">Outstanding</div><div className="text-2xl font-bold text-amber-600">{totals.pending.toLocaleString(undefined,{minimumFractionDigits:2,maximumFractionDigits:2})}</div></CardContent></Card>
          </div>
        )}

        <Card><CardContent className="pt-6">
          <div className="flex gap-3 mb-4">
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="approved">Approved</SelectItem>
                <SelectItem value="paid">Paid</SelectItem>
                <SelectItem value="cancelled">Cancelled</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {loading ? <Loader2 className="animate-spin" /> : filtered.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Trophy className="w-12 h-12 mx-auto mb-2 opacity-50" />
              No bonuses yet.
            </div>
          ) : (
            <Table>
              <TableHeader><TableRow>
                <TableHead>Recruiter</TableHead><TableHead>Candidate</TableHead><TableHead>Job</TableHead>
                <TableHead>Client</TableHead>
                <TableHead>Placement Date</TableHead><TableHead>Created</TableHead><TableHead>Type</TableHead>
                <TableHead className="text-right">Amount</TableHead><TableHead>Status</TableHead><TableHead></TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {filtered.map(r => (
                  <TableRow key={r.id}>
                    <TableCell className="font-medium">{profiles[r.recruiter_user_id] || "—"}</TableCell>
                    <TableCell>{r.placements?.candidates?.full_name || "—"}</TableCell>
                    <TableCell className="text-muted-foreground text-sm">{r.placements?.jobs?.title || "—"}</TableCell>
                    <TableCell className="text-sm">{r.placements?.clients?.name || "—"}</TableCell>
                    <TableCell>{r.placements?.placement_date ? format(new Date(r.placements.placement_date), "dd MMM yyyy") : "—"}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{r.created_at ? format(new Date(r.created_at), "dd MMM yyyy") : "—"}</TableCell>
                    <TableCell>{r.bonus_type === "percent" ? `${r.bonus_pct}%` : "Fixed"}</TableCell>
                    <TableCell className="text-right font-medium">{formatMoney(r.bonus_amount, r.currency)}</TableCell>
                    <TableCell><Badge className={cn(BONUS_STATUS_COLORS[r.status])} variant="outline">{r.status}</Badge></TableCell>
                    <TableCell>
                      {canManage && (
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild><Button size="icon" variant="ghost"><MoreVertical className="w-4 h-4" /></Button></DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            {r.status === "pending" && <DropdownMenuItem onClick={() => updateStatus(r.id, "approved")}>Approve</DropdownMenuItem>}
                            {(r.status === "pending" || r.status === "approved") && <DropdownMenuItem onClick={() => updateStatus(r.id, "paid")}>Mark as Paid</DropdownMenuItem>}
                            {r.status !== "cancelled" && r.status !== "paid" && <DropdownMenuItem onClick={() => updateStatus(r.id, "cancelled")}>Cancel</DropdownMenuItem>}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent></Card>

        <CreateBonusDialog open={createOpen} onOpenChange={setCreateOpen} onSaved={load} />
      </div>
    </AppLayout>
  );
}
