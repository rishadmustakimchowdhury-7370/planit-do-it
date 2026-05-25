import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { formatDistanceToNow } from "date-fns";
import { CheckCircle2, Eye, FileText, MessageSquare, Sparkles, ThumbsUp, ThumbsDown, CalendarClock, RefreshCw, Activity } from "lucide-react";

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
};

interface Props {
  submissionId: string;
  className?: string;
}

export function SubmissionActivityTimeline({ submissionId, className = "" }: Props) {
  const [items, setItems] = useState<any[] | null>(null);

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      const { data } = await supabase
        .from("submission_activity" as any)
        .select("id, activity_type, payload, actor_id, created_at")
        .eq("submission_id", submissionId)
        .order("created_at", { ascending: false })
        .limit(100);
      if (mounted) setItems((data as any[]) ?? []);
    };
    load();
    const ch = supabase
      .channel(`sub-activity-${submissionId}`)
      .on("postgres_changes",
        { event: "INSERT", schema: "public", table: "submission_activity", filter: `submission_id=eq.${submissionId}` },
        () => load())
      .subscribe();
    return () => { mounted = false; supabase.removeChannel(ch); };
  }, [submissionId]);

  if (items === null) {
    return <div className="space-y-2">{[1,2,3].map(i => <Skeleton key={i} className="h-12" />)}</div>;
  }
  if (!items.length) {
    return (
      <Card className={className}>
        <CardContent className="flex flex-col items-center justify-center py-8 text-center gap-2 text-muted-foreground">
          <Activity className="h-6 w-6" />
          <p className="text-sm">No activity yet.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <ScrollArea className={`max-h-[420px] pr-2 ${className}`}>
      <ol className="relative border-l border-border ml-2 space-y-3">
        {items.map((it) => {
          const Icon = ICONS[it.activity_type] ?? Activity;
          const label = describe(it);
          return (
            <li key={it.id} className="ml-4">
              <span className="absolute -left-[9px] flex h-4 w-4 items-center justify-center rounded-full bg-background border border-border">
                <Icon className="h-2.5 w-2.5 text-primary" />
              </span>
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm">{label}</p>
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

function describe(a: any): string {
  switch (a.activity_type) {
    case "submission_created": return "Submission created";
    case "status_changed":     return `Status: ${a.payload?.from ?? "?"} → ${a.payload?.to ?? "?"}`;
    case "pack_generated":     return "Branded submission pack generated";
    case "recipient_viewed":   return "A client recipient viewed the submission";
    case "recipient_decision": return `Recipient decision: ${a.payload?.decision ?? "?"}`;
    case "message":            return a.payload?.text ?? "New message";
    default:                   return a.activity_type.replace(/_/g, " ");
  }
}
