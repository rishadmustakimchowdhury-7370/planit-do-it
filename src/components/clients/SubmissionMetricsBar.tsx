import { Card, CardContent } from "@/components/ui/card";
import type { SubmissionStatus } from "./SubmissionStatusBadge";

interface Row { status: SubmissionStatus }

export function computeMetrics(rows: Row[]) {
  const total = rows.length;
  const interviewCount = rows.filter(r => ["interview_requested","interview_confirmed","final_review","offer","hired"].includes(r.status)).length;
  const offerCount = rows.filter(r => ["offer","hired"].includes(r.status)).length;
  const hireCount = rows.filter(r => r.status === "hired").length;
  const pct = (n: number) => total === 0 ? "0%" : `${Math.round((n / total) * 100)}%`;
  return {
    total,
    interviewRate: pct(interviewCount),
    offerRate: pct(offerCount),
    hireRate: pct(hireCount),
  };
}

export function SubmissionMetricsBar({ rows }: { rows: Row[] }) {
  const m = computeMetrics(rows);
  const cards = [
    { label: "Total submitted", value: m.total.toString() },
    { label: "Interview rate", value: m.interviewRate },
    { label: "Offer rate", value: m.offerRate },
    { label: "Hire rate", value: m.hireRate },
  ];
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
      {cards.map(c => (
        <Card key={c.label}>
          <CardContent className="p-4">
            <div className="text-2xl font-semibold tracking-tight">{c.value}</div>
            <div className="text-xs text-muted-foreground mt-1">{c.label}</div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
