import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { toast } from "sonner";
import { Loader2, Trophy } from "lucide-react";
import { currencies } from "@/lib/currencies";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  candidateId: string;
  candidateName?: string;
  jobId?: string | null;
  onSaved?: () => void;
}

export function MarkAsPlacementDialog({ open, onOpenChange, candidateId, candidateName, jobId, onSaved }: Props) {
  const { tenantId, user } = useAuth();
  const [saving, setSaving] = useState(false);
  const [jobs, setJobs] = useState<Array<{ id: string; title: string; client_id: string | null; assigned_to: string | null }>>([]);
  const [clients, setClients] = useState<Array<{ id: string; company_name: string }>>([]);
  const [recruiters, setRecruiters] = useState<Array<{ id: string; full_name: string | null; email: string }>>([]);

  const [form, setForm] = useState({
    job_id: jobId ?? "",
    client_id: "",
    recruiter_user_id: user?.id ?? "",
    placement_date: new Date().toISOString().slice(0, 10),
    start_date: "",
    salary: "",
    placement_fee: "",
    fee_pct: "",
    currency: "USD",
    guarantee_period_days: "",
    notes: "",
  });

  // Keep Fee % and Fee $ in sync when salary changes
  useEffect(() => {
    const sal = Number(form.salary);
    const fee = Number(form.placement_fee);
    const pct = Number(form.fee_pct);
    if (sal > 0 && fee > 0 && !pct) {
      setForm((f) => ({ ...f, fee_pct: ((fee / sal) * 100).toFixed(2) }));
    } else if (sal > 0 && pct > 0 && !fee) {
      setForm((f) => ({ ...f, placement_fee: ((sal * pct) / 100).toFixed(2) }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.salary]);


  useEffect(() => {
    if (!open || !tenantId) return;
    (async () => {
      const [j, c, p] = await Promise.all([
        supabase.from("jobs").select("id, title, client_id, assigned_to").eq("tenant_id", tenantId).order("created_at", { ascending: false }).limit(200),
        supabase.from("clients").select("id, company_name").eq("tenant_id", tenantId).order("company_name").limit(200),
        supabase.from("profiles").select("id, full_name, email").eq("tenant_id", tenantId).eq("is_active", true).limit(200),
      ]);
      setJobs((j.data ?? []) as any);
      setClients((c.data ?? []) as any);
      setRecruiters((p.data ?? []) as any);
      setForm((f) => ({
        ...f,
        job_id: jobId ?? f.job_id,
        recruiter_user_id: f.recruiter_user_id || user?.id || "",
      }));
    })();
  }, [open, tenantId, jobId, user?.id]);

  // Auto-fill client when job changes
  useEffect(() => {
    if (!form.job_id) return;
    const job = jobs.find((j) => j.id === form.job_id);
    if (job?.client_id && !form.client_id) {
      setForm((f) => ({ ...f, client_id: job.client_id! }));
    }
    if (job?.assigned_to && !form.recruiter_user_id) {
      setForm((f) => ({ ...f, recruiter_user_id: job.assigned_to! }));
    }
  }, [form.job_id, jobs]);

  const save = async () => {
    if (!tenantId) return;
    if (!form.placement_date) {
      toast.error("Placement date is required");
      return;
    }
    setSaving(true);
    try {
      // Resolve client_org_id from client_id if possible
      let clientOrgId: string | null = null;
      if (form.client_id) {
        const { data } = await supabase
          .from("client_organizations")
          .select("id")
          .eq("tenant_id", tenantId)
          .eq("client_id", form.client_id)
          .maybeSingle();
        clientOrgId = data?.id ?? null;
      }

      const { data: inserted, error } = await supabase
        .from("placements")
        .insert({
          tenant_id: tenantId,
          candidate_id: candidateId,
          job_id: form.job_id || null,
          client_id: form.client_id || null,
          client_org_id: clientOrgId,
          recruiter_user_id: form.recruiter_user_id || null,
          placement_date: form.placement_date,
          start_date: form.start_date || null,
          salary: form.salary ? Number(form.salary) : null,
          placement_fee: form.placement_fee ? Number(form.placement_fee) : null,
          fee_pct: form.fee_pct ? Number(form.fee_pct) : null,
          guarantee_period_days: form.guarantee_period_days ? Number(form.guarantee_period_days) : null,
          currency: form.currency,
          notes: form.notes || null,
          status: "confirmed",
          created_by: user?.id ?? null,
        } as any)
        .select("id")
        .single();
      if (error) throw error;

      toast.success(`Placement recorded · ${inserted.id.slice(0, 8)}`);
      onOpenChange(false);
      onSaved?.();
    } catch (e: any) {
      toast.error(e?.message ?? "Failed to record placement");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Trophy className="w-5 h-5 text-success" /> Mark as Placement
          </DialogTitle>
          <DialogDescription>
            Record a successful hire{candidateName ? ` for ${candidateName}` : ""}. This adds to placement reports and revenue metrics.
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2 md:col-span-2">
            <Label>Job</Label>
            <Select value={form.job_id} onValueChange={(v) => setForm((f) => ({ ...f, job_id: v }))}>
              <SelectTrigger><SelectValue placeholder="Select a job" /></SelectTrigger>
              <SelectContent>{jobs.map((j) => <SelectItem key={j.id} value={j.id}>{j.title}</SelectItem>)}</SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Client</Label>
            <Select value={form.client_id} onValueChange={(v) => setForm((f) => ({ ...f, client_id: v }))}>
              <SelectTrigger><SelectValue placeholder="Select a client" /></SelectTrigger>
              <SelectContent>{clients.map((c) => <SelectItem key={c.id} value={c.id}>{c.company_name}</SelectItem>)}</SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Recruiter</Label>
            <Select value={form.recruiter_user_id} onValueChange={(v) => setForm((f) => ({ ...f, recruiter_user_id: v }))}>
              <SelectTrigger><SelectValue placeholder="Select recruiter" /></SelectTrigger>
              <SelectContent>{recruiters.map((r) => <SelectItem key={r.id} value={r.id}>{r.full_name || r.email}</SelectItem>)}</SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Placement Date</Label>
            <Input type="date" value={form.placement_date} onChange={(e) => setForm((f) => ({ ...f, placement_date: e.target.value }))} />
          </div>

          <div className="space-y-2">
            <Label>Start Date</Label>
            <Input type="date" value={form.start_date} onChange={(e) => setForm((f) => ({ ...f, start_date: e.target.value }))} />
          </div>

          <div className="space-y-2">
            <Label>Salary</Label>
            <Input type="number" min="0" step="0.01" placeholder="e.g. 75000" value={form.salary} onChange={(e) => setForm((f) => ({ ...f, salary: e.target.value }))} />
          </div>

          <div className="space-y-2">
            <Label>Placement Fee</Label>
            <Input type="number" min="0" step="0.01" placeholder="e.g. 15000" value={form.placement_fee}
              onChange={(e) => {
                const fee = e.target.value;
                const sal = Number(form.salary);
                setForm((f) => ({
                  ...f, placement_fee: fee,
                  fee_pct: sal > 0 && fee ? ((Number(fee) / sal) * 100).toFixed(2) : f.fee_pct,
                }));
              }} />
          </div>

          <div className="space-y-2">
            <Label>Fee %</Label>
            <Input type="number" min="0" step="0.01" placeholder="e.g. 20" value={form.fee_pct}
              onChange={(e) => {
                const pct = e.target.value;
                const sal = Number(form.salary);
                setForm((f) => ({
                  ...f, fee_pct: pct,
                  placement_fee: sal > 0 && pct ? ((sal * Number(pct)) / 100).toFixed(2) : f.placement_fee,
                }));
              }} />
          </div>

          <div className="space-y-2">
            <Label>Currency</Label>
            <Select value={form.currency} onValueChange={(v) => setForm((f) => ({ ...f, currency: v }))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent className="max-h-72">
                {currencies.map((c) => <SelectItem key={c.code} value={c.code}>{c.code} — {c.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Guarantee Period (days)</Label>
            <Input type="number" min="0" step="1" placeholder="e.g. 90" value={form.guarantee_period_days}
              onChange={(e) => setForm((f) => ({ ...f, guarantee_period_days: e.target.value }))} />
          </div>

          <div className="space-y-2 md:col-span-2">
            <Label>Notes</Label>
            <Textarea rows={3} value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} placeholder="Optional context, contract terms, etc." />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>Cancel</Button>
          <Button onClick={save} disabled={saving}>
            {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Trophy className="w-4 h-4 mr-2" />}
            Save Placement
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
