import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { formatDistanceToNow } from "date-fns";
import {
  Activity, RefreshCw, FileText, Sparkles, Eye, CheckCircle2,
  ThumbsUp, ThumbsDown, CalendarClock, MessageSquare, MessageCircle,
} from "lucide-react";
import { SUBMISSION_STATUS_META, type SubmissionStatus } from "@/components/clients/SubmissionStatusBadge";

const ICONS: Record<string, any> = {
  submission_created: FileText,
  status_changed: RefreshCw,
  pack_generated: Sparkles,
  recipient_viewed: Eye,
  recipient_decision: CheckCircle2,
  approved: ThumbsUp,
  rejected: ThumbsDown,
  requested_interview: CalendarClock,
  message: MessageSquare,
  client_feedback: MessageCircle,
};

function stageLabel(v?: string | null): string {
  if (!v) return "?";
  const meta = SUBMISSION_STATUS_META[v as SubmissionStatus];
  return meta?.label ?? v;
}

function describe(a: any): string {
  const jobTitle = a.submission?.job?.title;
  const client = a.submission?.client_org?.name;
  const ctx = [jobTitle, client].filter(Boolean).join(" · ");
  const suffix = ctx ? ` (${ctx})` : "";
  switch (a.event_type) {
    case "submission_created": return `Submission created${suffix}`;
    case "status_changed":     return `${stageLabel(a.metadata?.from)} → ${stageLabel(a.metadata?.to)}${suffix}`;
    case "client_feedback":    return `Client feedback: ${a.metadata?.outcome ?? "logged"}${suffix}`;
    case "pack_generated":     return `Submission pack generated${suffix}`;
    case "recipient_viewed":   return `Recipient viewed submission${suffix}`;
    case "recipient_decision": return `Recipient decision: ${a.metadata?.decision ?? "?"}${suffix}`;
    default:                   return `${(a.event_type ?? "").replace(/_/g, " ")}${suffix}`;
  }
}

export function CandidateSubmissionTimeline({ candidateId }: { candidateId: string }) {
  const [items, setItems] = useState<any[] | null>(null);

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      const { data: subs } = await supabase
        .from("candidate_submissions")
        .select("id, job:job_id ( title ), client_org:client_org_id ( name )")
        .eq("candidate_id", candidateId);
      const ids = (subs ?? []).map((s: any) => s.id);
      if (!ids.length) { if (mounted) setItems([]); return; }
      const subMap = new Map((subs ?? []).map((s: any) => [s.id, s]));

      const { data } = await supabase
        .from("submission_activity" as any)
        .select("id, submission_id, event_type, metadata, actor_user_id, created_at")
        .in("submission_id", ids)
        .order("created_at", { ascending: false })
        .limit(200);

      const enriched = (data as any[] ?? []).map((it) => ({
        ...it,
        submission: subMap.get(it.submission_id) ?? null,
      }));
      if (mounted) setItems(enriched);
    };
    load();
    const ch = supabase
      .channel(`cand-timeline-${candidateId}`)
      .on("postgres_changes",
        { event: "INSERT", schema: "public", table: "submission_activity" },
        () => load())
      .subscribe();
    return () => { mounted = false; supabase.removeChannel(ch); };
  }, [candidateId]);

  if (items === null) {
    return <div className="space-y-2">{[1,2,3].map(i => <Skeleton key={i} className="h-12" />)}</div>;
  }
  if (!items.length) {
    return (
      <div className="flex flex-col items-center justify-center py-8 text-center gap-2 text-muted-foreground">
        <Activity className="h-6 w-6" />
        <p className="text-sm">No pipeline movements yet.</p>
      </div>
    );
  }

  return (
    <ScrollArea className="max-h-[480px] pr-2">
      <ol className="relative border-l border-border ml-2 space-y-3">
        {items.map((it) => {
          const Icon = ICONS[it.event_type] ?? Activity;
          return (
            <li key={it.id} className="ml-4">
              <span className="absolute -left-[9px] flex h-4 w-4 items-center justify-center rounded-full bg-background border border-border">
                <Icon className="h-2.5 w-2.5 text-primary" />
              </span>
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm">{describe(it)}</p>
                <Badge variant="outline" className="text-[10px] shrink-0">
                  {formatDistanceToNow(new Date(it.created_at), { addSuffix: true })}
                </Badge>
              </div>
            </li>
          );
        })}
      </ol>
    </ScrollArea>
  );
}
