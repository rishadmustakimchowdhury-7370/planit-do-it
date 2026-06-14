import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { toast } from "@/hooks/use-toast";
import { SUPPORTED_CURRENCIES } from "@/lib/finance";
import { Loader2 } from "lucide-react";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved?: () => void;
}

export function CreateBonusDialog({ open, onOpenChange, onSaved }: Props) {
  const { tenantId, user } = useAuth();
  const [placements, setPlacements] = useState<any[]>([]);
  const [recruiters, setRecruiters] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<any>({
    placement_id: "",
    recruiter_user_id: "",
    bonus_type: "percent",
    bonus_pct: 10,
    bonus_fixed: 0,
    currency: "USD",
    notes: "",
  });

  useEffect(() => {
    if (!open || !tenantId) return;
    (async () => {
      setLoading(true);
      const [{ data: pls }, { data: roles }] = await Promise.all([
        supabase
          .from("placements")
          .select("id, placement_date, placement_fee, currency, recruiter_user_id, candidates(full_name), jobs(title)")
          .eq("tenant_id", tenantId)
          .order("placement_date", { ascending: false }),
        supabase
          .from("user_roles")
          .select("user_id, role, profiles!inner(id, full_name, email, is_active)")
          .eq("tenant_id", tenantId)
          .in("role", ["recruiter", "manager", "owner"]),
      ]);
      setPlacements(pls || []);
      const seen = new Set<string>();
      const recs = (roles || [])
        .map((r: any) => r.profiles)
        .filter((p: any) => p && p.is_active && !seen.has(p.id) && seen.add(p.id))
        .sort((a: any, b: any) => (a.full_name || a.email || "").localeCompare(b.full_name || b.email || ""));
      setRecruiters(recs);
      setLoading(false);
    })();
  }, [open, tenantId]);

  const selectedPlacement = placements.find(p => p.id === form.placement_id);
  const fee = Number(selectedPlacement?.placement_fee || 0);
  const calcAmount = form.bonus_type === "percent"
    ? fee * Number(form.bonus_pct || 0) / 100
    : Number(form.bonus_fixed || 0);

  const handleSave = async () => {
    if (!tenantId || !user) return;
    if (!form.recruiter_user_id) {
      toast({ title: "Select a recruiter", variant: "destructive" });
      return;
    }
    setSaving(true);
    const { error, data } = await supabase.from("recruiter_bonuses").insert({
      tenant_id: tenantId,
      placement_id: selectedPlacement?.id || null,
      recruiter_user_id: form.recruiter_user_id,
      bonus_type: form.bonus_type,
      bonus_pct: form.bonus_type === "percent" ? form.bonus_pct : null,
      bonus_fixed: form.bonus_type === "fixed" ? form.bonus_fixed : null,
      bonus_amount: calcAmount,
      currency: selectedPlacement?.currency || form.currency,
      status: "pending",
      notes: form.notes,
      created_by: user.id,
    }).select().single();
    if (!error && data) {
      await supabase.from("finance_audit_log").insert({
        tenant_id: tenantId, entity_type: "bonus", entity_id: data.id,
        action: "created", performed_by: user.id,
      });
    }
    setSaving(false);
    if (error) {
      toast({ title: "Failed", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Bonus created (pending)" });
    onSaved?.();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader><DialogTitle>Create Recruiter Bonus</DialogTitle></DialogHeader>
        {loading ? <Loader2 className="animate-spin" /> : (
          <div className="space-y-4">
            <div>
              <Label>Placement</Label>
              <Select value={form.placement_id} onValueChange={v => setForm({ ...form, placement_id: v })}>
                <SelectTrigger><SelectValue placeholder="Select placement" /></SelectTrigger>
                <SelectContent>
                  {placements.map(p => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.candidates?.full_name || "?"} — {p.jobs?.title || "?"}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Bonus type</Label>
              <Select value={form.bonus_type} onValueChange={v => setForm({ ...form, bonus_type: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="percent">% of placement fee</SelectItem>
                  <SelectItem value="fixed">Fixed amount</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {form.bonus_type === "percent" ? (
              <div><Label>Bonus %</Label><Input type="number" step="0.01" value={form.bonus_pct} onChange={e => setForm({ ...form, bonus_pct: parseFloat(e.target.value) || 0 })} /></div>
            ) : (
              <div><Label>Fixed amount</Label><Input type="number" step="0.01" value={form.bonus_fixed} onChange={e => setForm({ ...form, bonus_fixed: parseFloat(e.target.value) || 0 })} /></div>
            )}
            <div>
              <Label>Currency</Label>
              <Select value={selectedPlacement?.currency || form.currency} onValueChange={v => setForm({ ...form, currency: v })} disabled={!!selectedPlacement?.currency}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{SUPPORTED_CURRENCIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            {selectedPlacement && (
              <div className="bg-muted/30 rounded p-3 text-sm">
                Placement fee: <strong>{fee.toLocaleString()}</strong> {selectedPlacement.currency || form.currency}<br />
                Bonus amount: <strong>{calcAmount.toLocaleString()}</strong> {selectedPlacement.currency || form.currency}
              </div>
            )}
            <div><Label>Notes</Label><Textarea rows={2} value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} /></div>
          </div>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSave} disabled={saving}>{saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}Create</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
