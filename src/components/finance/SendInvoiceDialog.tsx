import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { Loader2, Sparkles, Send } from "lucide-react";
import { formatMoney } from "@/lib/finance";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  invoice: any | null;
  onSent?: () => void;
}

export function SendInvoiceDialog({ open, onOpenChange, invoice, onSent }: Props) {
  const [mode, setMode] = useState<"ai" | "custom">("ai");
  const [recipient, setRecipient] = useState("");
  const [cc, setCc] = useState("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [composing, setComposing] = useState(false);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    if (!open || !invoice) return;
    const defaultRecipient = invoice.sent_to_email || invoice.clients?.contact_email || "";
    setRecipient(defaultRecipient);
    setCc("");
    setSubject(`Invoice ${invoice.invoice_number}${invoice.clients?.name ? ` – ${invoice.clients.name}` : ""}`);
    setBody("");
    setMode("ai");
    // Auto-compose on open
    if (defaultRecipient) void compose(invoice);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, invoice?.id]);

  const compose = async (inv = invoice) => {
    if (!inv) return;
    setComposing(true);
    try {
      const { data, error } = await supabase.functions.invoke("ai-compose-invoice-email", {
        body: {
          client_name: inv.clients?.name,
          client_contact_name: inv.clients?.contact_name,
          candidate_name: inv.placements?.candidates?.full_name,
          job_title: inv.placements?.jobs?.title,
          invoice_number: inv.invoice_number,
          amount: Number(inv.total_amount || 0),
          currency: inv.currency || "USD",
          due_date: inv.due_date,
          agency_name: inv.company_name,
          tone: "formal",
        },
      });
      if (error) throw error;
      if (data?.subject) setSubject(data.subject);
      if (data?.body) setBody(data.body);
    } catch (e: any) {
      toast({ title: "AI compose failed", description: e.message, variant: "destructive" });
    } finally {
      setComposing(false);
    }
  };

  const send = async () => {
    if (!invoice || !recipient || !subject || !body) {
      toast({ title: "Missing fields", description: "Recipient, subject and body are required", variant: "destructive" });
      return;
    }
    setSending(true);
    try {
      const { error } = await supabase.functions.invoke("send-invoice-email", {
        body: {
          invoice_id: invoice.id,
          recipient_email: recipient,
          cc_email: cc || undefined,
          subject,
          body,
          mark_as_sent: true,
        },
      });
      if (error) throw error;
      toast({ title: "Invoice sent", description: `Sent to ${recipient}` });
      onOpenChange(false);
      onSent?.();
    } catch (e: any) {
      toast({ title: "Send failed", description: e.message, variant: "destructive" });
    } finally {
      setSending(false);
    }
  };

  if (!invoice) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Send Invoice {invoice.invoice_number}</DialogTitle>
          <p className="text-sm text-muted-foreground">
            {formatMoney(Number(invoice.total_amount || 0), invoice.currency)} · {invoice.clients?.name || "—"} · PDF will be attached automatically
          </p>
        </DialogHeader>

        <Tabs value={mode} onValueChange={(v) => setMode(v as any)}>
          <TabsList className="grid grid-cols-2 w-full">
            <TabsTrigger value="ai"><Sparkles className="w-4 h-4 mr-2" />AI Compose</TabsTrigger>
            <TabsTrigger value="custom">Custom</TabsTrigger>
          </TabsList>
          <TabsContent value="ai" className="space-y-3">
            <Button type="button" variant="outline" size="sm" onClick={() => compose()} disabled={composing}>
              {composing ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Sparkles className="w-4 h-4 mr-2" />}
              {composing ? "Composing…" : "Regenerate with AI"}
            </Button>
          </TabsContent>
          <TabsContent value="custom">
            <p className="text-xs text-muted-foreground">Edit subject and body freely below.</p>
          </TabsContent>
        </Tabs>

        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>To</Label>
              <Input value={recipient} onChange={(e) => setRecipient(e.target.value)} placeholder="client@company.com" />
            </div>
            <div>
              <Label>CC (optional)</Label>
              <Input value={cc} onChange={(e) => setCc(e.target.value)} placeholder="finance@company.com" />
            </div>
          </div>
          <div>
            <Label>Subject</Label>
            <Input value={subject} onChange={(e) => setSubject(e.target.value)} />
          </div>
          <div>
            <Label>Message</Label>
            <Textarea value={body} onChange={(e) => setBody(e.target.value)} rows={12} className="font-sans" />
            <p className="text-xs text-muted-foreground mt-1">A professional invoice PDF and your signature will be appended automatically.</p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={sending}>Cancel</Button>
          <Button onClick={send} disabled={sending || composing}>
            {sending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Send className="w-4 h-4 mr-2" />}
            Send Invoice
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
