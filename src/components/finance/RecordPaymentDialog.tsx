import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { toast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";
import { format } from "date-fns";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  invoiceId: string;
  tenantId: string;
  currency: string;
  balance: number;
  onSaved?: () => void;
}

export function RecordPaymentDialog({ open, onOpenChange, invoiceId, tenantId, currency, balance, onSaved }: Props) {
  const { user } = useAuth();
  const [amount, setAmount] = useState<number>(balance);
  const [method, setMethod] = useState("bank_transfer");
  const [reference, setReference] = useState("");
  const [paymentDate, setPaymentDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!user || !amount || amount <= 0) {
      toast({ title: "Enter a valid amount", variant: "destructive" });
      return;
    }
    setSaving(true);
    const { error, data } = await supabase.from("invoice_payments").insert({
      tenant_id: tenantId, invoice_id: invoiceId, amount, currency,
      payment_method: method, reference, payment_date: paymentDate, notes,
      recorded_by: user.id,
    }).select().single();
    if (!error && data) {
      await supabase.from("finance_audit_log").insert({
        tenant_id: tenantId, entity_type: "payment", entity_id: data.id,
        action: "recorded", performed_by: user.id, metadata: { amount, invoice_id: invoiceId },
      });
    }
    setSaving(false);
    if (error) {
      toast({ title: "Failed", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Payment recorded" });
    onSaved?.();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader><DialogTitle>Record Payment</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <div><Label>Amount ({currency})</Label><Input type="number" step="0.01" value={amount} onChange={e => setAmount(parseFloat(e.target.value) || 0)} /></div>
          <div><Label>Payment date</Label><Input type="date" value={paymentDate} onChange={e => setPaymentDate(e.target.value)} /></div>
          <div>
            <Label>Method</Label>
            <Select value={method} onValueChange={setMethod}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="bank_transfer">Bank Transfer</SelectItem>
                <SelectItem value="card">Card</SelectItem>
                <SelectItem value="cash">Cash</SelectItem>
                <SelectItem value="cheque">Cheque</SelectItem>
                <SelectItem value="other">Other</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div><Label>Reference</Label><Input value={reference} onChange={e => setReference(e.target.value)} placeholder="Transaction ID" /></div>
          <div><Label>Notes</Label><Textarea rows={2} value={notes} onChange={e => setNotes(e.target.value)} /></div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
            Save payment
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
