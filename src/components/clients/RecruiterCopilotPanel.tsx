// Recruiter Copilot panel — Placement Intelligence surface.
// Recruiter-only. Never rendered in clientSafe mode. Embedded inside the
// AIValidationCard behind the "Show recruiter intelligence" toggle.

import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Slider } from "@/components/ui/slider";
import {
  Sparkles, MessageCircleQuestion, ShieldAlert, Megaphone, Target,
  CheckCircle2, AlertTriangle, ThumbsUp, Edit3, Send, Copy,
} from "lucide-react";
import {
  useRecordRecruiterFeedback, useGenerateClientComms,
  STRATEGY_LABEL, CATEGORY_LABEL,
  type RecruiterCopilotData, type ClientCommType,
} from "@/hooks/useRecruiterCopilot";
import { recommendationMeta } from "@/lib/recommendation";
import { toast } from "sonner";

interface Props {
  copilot: RecruiterCopilotData;
  jobId: string;
  candidateId: string;
  tenantId: string;
  aiClassification: string;
  recruiterOverride?: { classification?: string; note?: string | null } | null;
  overrideDivergence?: boolean;
}

const SEV_STYLE: Record<string, string> = {
  high: "border-rose-500/30 bg-rose-500/10 text-rose-700 dark:text-rose-300",
  medium: "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300",
  low: "border-sky-500/30 bg-sky-500/10 text-sky-700 dark:text-sky-300",
};

export function RecruiterCopilotPanel({
  copilot, jobId, candidateId, tenantId,
  aiClassification, recruiterOverride, overrideDivergence,
}: Props) {
  const [overrideOpen, setOverrideOpen] = useState(false);
  const [overrideBand, setOverrideBand] = useState<string>(recruiterOverride?.classification ?? aiClassification);
  const [overrideNote, setOverrideNote] = useState<string>(recruiterOverride?.note ?? "");
  const [confidence, setConfidence] = useState<number>(75);

  const record = useRecordRecruiterFeedback();
  const gen = useGenerateClientComms();
  const [commType, setCommType] = useState<ClientCommType>("submission_summary");
  const [objection, setObjection] = useState("");
  const [generated, setGenerated] = useState<{ subject: string | null; body: string } | null>(null);

  const strat = copilot.submission_strategy;
  const prob = copilot.placement_probability;

  return (
    <div className="space-y-4">
      {overrideDivergence && (
        <div className="rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs text-amber-800 dark:text-amber-300 flex items-start gap-2">
          <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
          <div>
            <div className="font-medium">AI recommendation differs from recruiter override after updated validation.</div>
            <div className="opacity-80 mt-0.5">Your override stays in force — review whether the new evidence changes your decision.</div>
          </div>
        </div>
      )}

      {/* Submission strategy + placement probability */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div className="rounded-lg border bg-muted/30 p-3">
          <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1 flex items-center gap-1.5">
            <Sparkles className="h-3.5 w-3.5" /> Submission Strategy
          </div>
          <div className="text-sm font-medium">{STRATEGY_LABEL[strat.recommendation]}</div>
          {strat.rationale && <p className="text-xs text-muted-foreground mt-1">{strat.rationale}</p>}
          {strat.talking_points.length > 0 && (
            <ul className="mt-2 space-y-1">
              {strat.talking_points.map((t, i) => (
                <li key={i} className="text-xs flex gap-1.5"><span className="text-primary">›</span>{t}</li>
              ))}
            </ul>
          )}
        </div>
        <div className="rounded-lg border bg-muted/30 p-3">
          <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2 flex items-center gap-1.5">
            <Target className="h-3.5 w-3.5" /> Placement Probability
          </div>
          <div className="grid grid-cols-3 gap-2 text-center">
            <ProbCell label="Shortlist" pct={prob.shortlist_pct} />
            <ProbCell label="Interview" pct={prob.interview_pct} />
            <ProbCell label="Placement" pct={prob.placement_pct} />
          </div>
          <div className="mt-2 flex items-center gap-2 text-xs">
            <span className="text-muted-foreground">Client acceptance risk:</span>
            <Badge variant="outline" className={SEV_STYLE[prob.client_acceptance_risk]}>{prob.client_acceptance_risk}</Badge>
          </div>
          {prob.rationale && <p className="text-[11px] text-muted-foreground mt-2 leading-relaxed">{prob.rationale}</p>}
        </div>
      </div>

      <Tabs defaultValue="interview">
        <TabsList className="w-full grid grid-cols-4">
          <TabsTrigger value="interview"><MessageCircleQuestion className="h-3.5 w-3.5 mr-1.5" />Interview</TabsTrigger>
          <TabsTrigger value="objections"><ShieldAlert className="h-3.5 w-3.5 mr-1.5" />Objections</TabsTrigger>
          <TabsTrigger value="positioning"><Megaphone className="h-3.5 w-3.5 mr-1.5" />Positioning</TabsTrigger>
          <TabsTrigger value="comms"><Send className="h-3.5 w-3.5 mr-1.5" />Client Comms</TabsTrigger>
        </TabsList>

        <TabsContent value="interview" className="mt-3 space-y-2">
          {copilot.interview_guide.length === 0 && <Empty text="No interview questions generated." />}
          {copilot.interview_guide.map((q, i) => (
            <div key={i} className="rounded-md border p-3 bg-card">
              <div className="flex items-center gap-2 mb-1">
                <Badge variant="secondary" className="text-[10px]">{CATEGORY_LABEL[q.category]}</Badge>
                {q.targets_requirement && <span className="text-[11px] text-muted-foreground">↳ {q.targets_requirement}</span>}
              </div>
              <p className="text-sm font-medium">{q.question}</p>
              {q.intent && <p className="text-[11px] text-muted-foreground mt-1 italic">Intent: {q.intent}</p>}
            </div>
          ))}
        </TabsContent>

        <TabsContent value="objections" className="mt-3 space-y-2">
          {copilot.client_objections.length === 0 && <Empty text="No likely objections detected." />}
          {copilot.client_objections.map((o, i) => (
            <div key={i} className="rounded-md border p-3 bg-card">
              <div className="flex items-start justify-between gap-2">
                <p className="text-sm font-medium flex-1">{o.concern}</p>
                <Badge variant="outline" className={`${SEV_STYLE[o.severity]} text-[10px] shrink-0`}>{o.severity}</Badge>
              </div>
              {o.requirement_at_risk && <p className="text-[11px] text-muted-foreground mt-1">↳ {o.requirement_at_risk}</p>}
              {o.suggested_response && (
                <div className="mt-2 rounded bg-muted/40 p-2 text-xs">
                  <span className="font-semibold text-primary">Suggested response: </span>
                  {o.suggested_response}
                </div>
              )}
            </div>
          ))}
        </TabsContent>

        <TabsContent value="positioning" className="mt-3 space-y-2">
          {copilot.positioning_angles.length === 0 && <Empty text="No positioning angles needed." />}
          {copilot.positioning_angles.map((p, i) => (
            <div key={i} className="rounded-md border p-3 bg-card">
              <div className="flex items-start justify-between gap-2">
                <p className="text-sm font-medium flex-1">{p.angle}</p>
                <Badge variant={p.audience === "client" ? "default" : "secondary"} className="text-[10px] shrink-0">
                  {p.audience === "client" ? "Client-safe" : "Internal"}
                </Badge>
              </div>
              {p.evidence && <p className="text-xs text-muted-foreground mt-1">{p.evidence}</p>}
            </div>
          ))}
        </TabsContent>

        <TabsContent value="comms" className="mt-3 space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <select
              value={commType}
              onChange={(e) => setCommType(e.target.value as ClientCommType)}
              className="h-9 rounded-md border bg-background px-2 text-xs"
            >
              <option value="submission_summary">Submission Summary</option>
              <option value="positioning_note">Positioning Note</option>
              <option value="interview_scheduling">Interview Scheduling</option>
              <option value="follow_up">Follow-up Nudge</option>
              <option value="objection_response">Objection Response</option>
            </select>
            {commType === "objection_response" && (
              <input
                value={objection}
                onChange={(e) => setObjection(e.target.value)}
                placeholder="Paste the client objection…"
                className="flex-1 h-9 rounded-md border bg-background px-2 text-xs min-w-[180px]"
              />
            )}
            <Button size="sm" disabled={gen.isPending} onClick={async () => {
              const r = await gen.mutateAsync({ jobId, candidateId, type: commType, objection: objection || undefined });
              setGenerated(r);
            }}>
              <Sparkles className="h-3.5 w-3.5 mr-1.5" /> {gen.isPending ? "Generating…" : "Generate"}
            </Button>
          </div>
          {generated && (
            <div className="rounded-md border bg-card p-3 space-y-2">
              {generated.subject && (
                <div className="text-xs"><span className="font-semibold">Subject: </span>{generated.subject}</div>
              )}
              <pre className="text-xs whitespace-pre-wrap font-sans leading-relaxed">{generated.body}</pre>
              <Button size="sm" variant="ghost" onClick={() => {
                navigator.clipboard.writeText(`${generated.subject ? `Subject: ${generated.subject}\n\n` : ""}${generated.body}`);
                toast.success("Copied to clipboard");
              }}>
                <Copy className="h-3.5 w-3.5 mr-1.5" /> Copy
              </Button>
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* HITL — endorse / override / confidence */}
      <div className="rounded-lg border-t pt-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">Recruiter Decision</p>
        <div className="flex flex-wrap items-center gap-2">
          <Button size="sm" variant="outline" disabled={record.isPending} onClick={() =>
            record.mutate({ tenantId, jobId, candidateId, action: "endorse", aiClassification, recruiterClassification: aiClassification, confidence })
          }>
            <ThumbsUp className="h-3.5 w-3.5 mr-1.5" /> Endorse AI
          </Button>
          <Button size="sm" variant="outline" onClick={() => setOverrideOpen((v) => !v)}>
            <Edit3 className="h-3.5 w-3.5 mr-1.5" /> Override
          </Button>
          <div className="flex items-center gap-2 ml-auto">
            <span className="text-[11px] text-muted-foreground">Confidence</span>
            <div className="w-32"><Slider value={[confidence]} onValueChange={(v) => setConfidence(v[0])} min={0} max={100} step={5} /></div>
            <span className="text-xs font-medium w-8 text-right">{confidence}%</span>
          </div>
        </div>
        {overrideOpen && (
          <div className="mt-3 space-y-2 rounded-md border bg-muted/30 p-3">
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">Override classification to:</span>
              <select value={overrideBand} onChange={(e) => setOverrideBand(e.target.value)}
                className="h-8 rounded-md border bg-background px-2 text-xs">
                {(["strong_match","recommended","transferable_match","needs_validation","weak_match","reject"] as const).map(b => (
                  <option key={b} value={b}>{recommendationMeta(b).label}</option>
                ))}
              </select>
            </div>
            <Textarea value={overrideNote} onChange={(e) => setOverrideNote(e.target.value)}
              placeholder="Why override? (visible to your team)" rows={2} />
            <Button size="sm" disabled={record.isPending} onClick={async () => {
              await record.mutateAsync({
                tenantId, jobId, candidateId, action: "override",
                aiClassification, recruiterClassification: overrideBand,
                confidence, note: overrideNote || null,
              });
              setOverrideOpen(false);
            }}>
              <CheckCircle2 className="h-3.5 w-3.5 mr-1.5" /> Save Override
            </Button>
          </div>
        )}
        {recruiterOverride?.classification && !overrideOpen && (
          <p className="text-[11px] text-muted-foreground mt-2">
            Current override: <strong>{recommendationMeta(recruiterOverride.classification).label}</strong>
            {recruiterOverride.note && ` — ${recruiterOverride.note}`}
          </p>
        )}
      </div>
    </div>
  );
}

function ProbCell({ label, pct }: { label: string; pct: number }) {
  return (
    <div>
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="text-lg font-semibold text-foreground">{pct}%</div>
    </div>
  );
}

function Empty({ text }: { text: string }) {
  return <p className="text-xs text-muted-foreground italic px-1">{text}</p>;
}
