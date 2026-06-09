import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";
import { MessageSquarePlus } from "lucide-react";

export const FEEDBACK_OUTCOMES: { value: string; label: string; tone: string }[] = [
  { value: "interested",          label: "Client interested",     tone: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300" },
  { value: "need_more_info",      label: "Need more information", tone: "bg-amber-500/10 text-amber-700 dark:text-amber-300" },
  { value: "not_suitable",        label: "Not suitable",          tone: "bg-muted text-muted-foreground" },
  { value: "interview_requested", label: "Interview requested",   tone: "bg-indigo-500/10 text-indigo-700 dark:text-indigo-300" },
  { value: "offer_pending",       label: "Offer pending",         tone: "bg-violet-500/10 text-violet-700 dark:text-violet-300" },
  { value: "rejected",            label: "Rejected",              tone: "bg-destructive/10 text-destructive" },
];

interface Props {
  submissionId: string;
  tenantId: string;
  clientOrgId: string | null;
  jobId: string;
  candidateId: string;
  onLogged?: () => void;
}

export function ClientFeedbackPanel({ submissionId, tenantId, clientOrgId, jobId, candidateId, onLogged }: Props) {
  const { user } = useAuth();
  const [items, setItems] = useState<any[] | null>(null);
  const [outcome, setOutcome] = useState<string>("interested");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  const load = async () => {
    const { data } = await supabase
      .from("client_feedback_log" as any)
      .select("id, outcome, reason, recorded_by, created_at")
      .eq("submission_id", submissionId)
      .order("created_at", { ascending: false });
    setItems((data as any[]) ?? []);
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [submissionId]);

  const submit = async () => {
    if (!user) return;
    setBusy(true);
    const { error } = await supabase.from("client_feedback_log" as any).insert({
      tenant_id: tenantId,
      client_org_id: clientOrgId,
      job_id: jobId,
      candidate_id: candidateId,
      submission_id: submissionId,
      outcome,
      reason: note || null,
      recorded_by: user.id,
    });
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Feedback logged");
    setNote("");
    load();
    onLogged?.();
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="flex items-center gap-2 text-sm font-medium">
            <MessageSquarePlus className="h-4 w-4 text-primary" /> Log client feedback
          </div>
          <Select value={outcome} onValueChange={setOutcome}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {FEEDBACK_OUTCOMES.map(o => (
                <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Textarea
            placeholder="Optional note (verbatim from client, context, next steps...)"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={3}
          />
          <div className="flex justify-end">
            <Button size="sm" onClick={submit} disabled={busy}>Log feedback</Button>
          </div>
        </CardContent>
      </Card>

      <div>
        <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">History</div>
        {items === null ? (
          <div className="space-y-2">{[1,2].map(i => <Skeleton key={i} className="h-14" />)}</div>
        ) : items.length === 0 ? (
          <p className="text-sm text-muted-foreground">No client feedback recorded yet.</p>
        ) : (
          <ul className="space-y-2">
            {items.map((it) => {
              const meta = FEEDBACK_OUTCOMES.find(o => o.value === it.outcome);
              return (
                <li key={it.id} className="rounded-lg border bg-card p-3">
                  <div className="flex items-center justify-between gap-2">
                    <Badge className={`${meta?.tone ?? "bg-muted text-muted-foreground"} border-transparent`} variant="outline">
                      {meta?.label ?? it.outcome}
                    </Badge>
                    <span className="text-[11px] text-muted-foreground">
                      {formatDistanceToNow(new Date(it.created_at), { addSuffix: true })}
                    </span>
                  </div>
                  {it.reason && <p className="text-sm mt-2 whitespace-pre-wrap">{it.reason}</p>}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
