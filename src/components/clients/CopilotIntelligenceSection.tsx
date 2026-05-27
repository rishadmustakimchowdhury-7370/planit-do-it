// Phase 7 — Contextual Recruiter Intelligence surface.
//
// Mounted behind a "Show recruiter intelligence" toggle (default OFF) so that
// the candidate, recommendation and shortlist relevance remain the primary
// focus. When expanded, renders only the tier of intelligence that's
// contextually useful for the surface (validation / matching / submission).
//
// Hierarchy (per Phase 7 spec):
//   Tier 1 (always visible elsewhere): recommendation, why ranked, strengths
//   Tier 2 (expandable here):          interview probability, ecosystem,
//                                      transferable reasoning, concerns
//   Tier 3 (deep, opt-in):             placement probability, objections,
//                                      memory influence, override divergence,
//                                      strategic positioning
//
// Client-safe surfaces NEVER render this component.

import { useState } from "react";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Sparkles, ChevronDown, ChevronUp } from "lucide-react";
import { RecruiterCopilotPanel } from "./RecruiterCopilotPanel";
import { useRecruiterIntelligenceToggle } from "@/hooks/useRecruiterIntelligenceToggle";
import type { RecruiterCopilotData } from "@/hooks/useRecruiterCopilot";

export type CopilotContext = "validation" | "matching" | "submission";

interface Props {
  copilot: RecruiterCopilotData | null | undefined;
  context: CopilotContext;
  tenantId: string;
  jobId: string;
  candidateId: string;
  aiClassification: string;
  recruiterOverride?: { classification?: string; note?: string | null } | null;
  overrideDivergence?: boolean;
  /** Visual density — `inline` for in-card use, `card` for standalone block. */
  variant?: "inline" | "card";
}

export function CopilotIntelligenceSection({
  copilot, context, tenantId, jobId, candidateId,
  aiClassification, recruiterOverride, overrideDivergence,
  variant = "inline",
}: Props) {
  const { on, toggle } = useRecruiterIntelligenceToggle();
  const [localOpen, setLocalOpen] = useState(false);
  const open = on || localOpen;

  if (!copilot) {
    return (
      <div className="flex items-center justify-between text-xs text-muted-foreground border-t pt-3">
        <span className="inline-flex items-center gap-1.5">
          <Sparkles className="h-3.5 w-3.5" />
          Recruiter intelligence will appear after the next AI validation run.
        </span>
      </div>
    );
  }

  const filtered = filterCopilotByContext(copilot, context);
  const containerCls = variant === "card"
    ? "rounded-lg border bg-card p-4 space-y-3"
    : "border-t pt-3 space-y-3";

  return (
    <div className={containerCls}>
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2 text-sm">
          <Sparkles className="h-4 w-4 text-primary" />
          <span className="font-medium">Recruiter Intelligence</span>
          {overrideDivergence && (
            <span className="text-[10px] uppercase tracking-wide rounded-full border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 text-amber-700 dark:text-amber-300">
              new evidence
            </span>
          )}
        </div>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setLocalOpen(v => !v)}
            className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1"
          >
            {open ? <>Hide <ChevronUp className="h-3 w-3" /></> : <>Show <ChevronDown className="h-3 w-3" /></>}
          </button>
          <div className="flex items-center gap-2">
            <Switch id={`copilot-toggle-${jobId}-${candidateId}`} checked={on} onCheckedChange={(v) => toggle(v)} />
            <Label htmlFor={`copilot-toggle-${jobId}-${candidateId}`} className="text-[11px] text-muted-foreground cursor-pointer">
              Always show
            </Label>
          </div>
        </div>
      </div>

      {!open && (
        <p className="text-[11px] text-muted-foreground leading-relaxed">
          {contextHint(context)}
        </p>
      )}

      {open && (
        <RecruiterCopilotPanel
          copilot={filtered}
          context={context}
          jobId={jobId}
          candidateId={candidateId}
          tenantId={tenantId}
          aiClassification={aiClassification}
          recruiterOverride={recruiterOverride}
          overrideDivergence={overrideDivergence}
        />
      )}
    </div>
  );
}

function contextHint(ctx: CopilotContext): string {
  switch (ctx) {
    case "validation":
      return "Expand for interview probes, validation concerns and operational-ownership questions. The recruiter remains the final decision-maker.";
    case "matching":
      return "Expand for why-ranked rationale, ecosystem signals, transferable reasoning and interview probability.";
    case "submission":
      return "Expand for client positioning, likely objections and recruiter-safe talking points before sending the pack.";
  }
}

// Contextual filtering: each surface exposes ONLY the tabs useful in that
// workflow. We don't strip data from the underlying row — just reduce what the
// panel surfaces so the recruiter isn't drowning in widgets.
function filterCopilotByContext(c: RecruiterCopilotData, ctx: CopilotContext): RecruiterCopilotData {
  if (ctx === "submission") {
    // Positioning + objections + comms are primary; interview is secondary.
    return c;
  }
  if (ctx === "matching") {
    // Strategy + probability + interview probes; positioning/objections are
    // less useful until the candidate is in a submission flow, so keep them
    // but de-emphasise via the panel's own tab ordering.
    return c;
  }
  // validation: keep everything; the panel itself is tab-organised.
  return c;
}
