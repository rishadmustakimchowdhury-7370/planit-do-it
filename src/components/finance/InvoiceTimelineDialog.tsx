import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Loader2, Send, Eye, Bell, DollarSign, AlertTriangle } from "lucide-react";
import { format } from "date-fns";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  invoiceId: string | null;
  invoiceNumber?: string;
}

const ICONS: Record<string, any> = {
  sent: Send,
  opened: Eye,
  reminder_sent: Bell,
  payment_received: DollarSign,
  bounced: AlertTriangle,
};

const COLORS: Record<string, string> = {
  sent: "bg-blue-100 text-blue-800",
  opened: "bg-emerald-100 text-emerald-800",
  reminder_sent: "bg-amber-100 text-amber-800",
  payment_received: "bg-green-100 text-green-800",
  bounced: "bg-red-100 text-red-800",
};

export function InvoiceTimelineDialog({ open, onOpenChange, invoiceId, invoiceNumber }: Props) {
  const [loading, setLoading] = useState(true);
  const [events, setEvents] = useState<any[]>([]);

  useEffect(() => {
    if (!open || !invoiceId) return;
    setLoading(true);
    Promise.all([
      supabase.from("invoice_email_logs").select("*").eq("invoice_id", invoiceId).order("created_at", { ascending: false }),
      supabase.from("invoice_payments").select("amount,currency,payment_date,reference,created_at").eq("invoice_id", invoiceId).order("created_at", { ascending: false }),
    ]).then(([logs, payments]) => {
      const merged = [
        ...(logs.data || []).map((l: any) => ({ kind: l.event_type, at: l.created_at, label: l.subject || l.event_type, sub: l.recipient_email || l.reminder_kind })),
        ...(payments.data || []).map((p: any) => ({ kind: "payment_received", at: p.created_at, label: `Payment received: ${p.amount} ${p.currency || ""}`, sub: p.reference || p.payment_date })),
      ].sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());
      setEvents(merged);
      setLoading(false);
    });
  }, [open, invoiceId]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Email & Payment Timeline {invoiceNumber ? `· ${invoiceNumber}` : ""}</DialogTitle>
        </DialogHeader>
        {loading ? (
          <div className="py-8 flex justify-center"><Loader2 className="w-5 h-5 animate-spin" /></div>
        ) : events.length === 0 ? (
          <div className="text-center text-sm text-muted-foreground py-8">No events yet. Send the invoice to start tracking.</div>
        ) : (
          <div className="space-y-3 max-h-[60vh] overflow-y-auto">
            {events.map((e, i) => {
              const Icon = ICONS[e.kind] || Send;
              return (
                <div key={i} className="flex items-start gap-3 border-l-2 border-muted pl-3">
                  <div className={`rounded-full p-2 ${COLORS[e.kind] || "bg-muted"}`}><Icon className="w-3.5 h-3.5" /></div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="text-[10px] uppercase">{String(e.kind).replace("_", " ")}</Badge>
                      <span className="text-xs text-muted-foreground">{format(new Date(e.at), "dd MMM yyyy HH:mm")}</span>
                    </div>
                    <div className="text-sm mt-1 truncate">{e.label}</div>
                    {e.sub && <div className="text-xs text-muted-foreground truncate">{e.sub}</div>}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
