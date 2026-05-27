// Placement Outcome Intelligence — outcome memory engine.
//
// SAFETY RULES (do not relax):
//   • Every query is parametrised by tenant_id. No cross-tenant joins. Ever.
//   • Signals with sample_size < 5 are tagged `confidence: 'low'` and are
//     ignored by the calibrator and the prompt injector.
//   • Calibration shifts placement_probability by ≤15pp total in either
//     direction so a noisy signal can never dominate the AI prior.
//   • The AI never sees raw outcome rows — only summarised, anonymised
//     patterns. No candidate names or personal data are emitted to prompts.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

export interface LearningSignal {
  signal_type: string;
  signal_key: string;
  weight: number;
  sample_size: number;
  confidence: "low" | "medium" | "high";
  scope: "tenant" | "client" | "recruiter";
}

export interface ClientPreferenceProfile {
  preferences: Record<string, unknown>;
  sample_size: number;
  confidence: "low" | "medium" | "high";
}

export interface OutcomeMemory {
  signals: LearningSignal[];
  client_preferences: ClientPreferenceProfile | null;
}

const MIN_SAMPLE_FOR_USE = 5;
const MAX_CALIBRATION_PP = 15;

export async function loadOutcomeMemory(
  admin: ReturnType<typeof createClient>,
  args: { tenant_id: string; client_org_id?: string | null; recruiter_id?: string | null },
): Promise<OutcomeMemory> {
  try {
    const { data } = await admin
      .from("outcome_learning_signals")
      .select("signal_type, signal_key, weight, sample_size, confidence, scope, client_org_id, recruiter_id")
      .eq("tenant_id", args.tenant_id)
      .order("weight", { ascending: false })
      .limit(200);

    const all = (data ?? []) as any[];
    const signals: LearningSignal[] = all
      .filter((r) =>
        r.scope === "tenant" ||
        (r.scope === "client" && args.client_org_id && r.client_org_id === args.client_org_id) ||
        (r.scope === "recruiter" && args.recruiter_id && r.recruiter_id === args.recruiter_id)
      )
      .map((r) => ({
        signal_type: r.signal_type,
        signal_key: r.signal_key,
        weight: Number(r.weight ?? 0),
        sample_size: Number(r.sample_size ?? 0),
        confidence: (r.confidence ?? "low") as LearningSignal["confidence"],
        scope: r.scope as LearningSignal["scope"],
      }));

    let client_preferences: ClientPreferenceProfile | null = null;
    if (args.client_org_id) {
      const { data: prof } = await admin
        .from("client_preference_profile")
        .select("preferences, sample_size, confidence")
        .eq("tenant_id", args.tenant_id)
        .eq("client_org_id", args.client_org_id)
        .maybeSingle();
      if (prof) {
        client_preferences = {
          preferences: (prof as any).preferences ?? {},
          sample_size: Number((prof as any).sample_size ?? 0),
          confidence: ((prof as any).confidence ?? "low") as ClientPreferenceProfile["confidence"],
        };
      }
    }

    return { signals, client_preferences };
  } catch {
    return { signals: [], client_preferences: null };
  }
}

// Render a tight, anonymised summary to inject into the validation prompt.
// Hard-capped at 6 bullets to avoid prompt bloat.
export function renderOutcomeMemoryForPrompt(mem: OutcomeMemory): string {
  const usable = mem.signals
    .filter((s) => s.sample_size >= MIN_SAMPLE_FOR_USE && s.confidence !== "low")
    .slice(0, 6);
  if (!usable.length && !mem.client_preferences) return "";

  const lines = usable.map((s) => {
    const verb = s.weight >= 0 ? "wins" : "underperforms";
    const human = humaniseSignal(s);
    return `- ${human} (${verb}, n=${s.sample_size}, ${s.confidence} confidence)`;
  });

  let header = "PLACEMENT OUTCOME PATTERNS (this tenant only — calibrate reasoning, never expose to client):";
  if (mem.client_preferences && mem.client_preferences.sample_size >= MIN_SAMPLE_FOR_USE) {
    const p = mem.client_preferences.preferences as any;
    if (Array.isArray(p?.prefers_ecosystems) && p.prefers_ecosystems.length) {
      lines.push(`- This client historically prefers: ${p.prefers_ecosystems.slice(0, 4).join(", ")}`);
    }
    if (Array.isArray(p?.rejects_patterns) && p.rejects_patterns.length) {
      lines.push(`- This client historically rejects: ${p.rejects_patterns.slice(0, 4).join(", ")}`);
    }
  }

  if (!lines.length) return "";
  return `\n\n${header}\n${lines.join("\n")}`;
}

function humaniseSignal(s: LearningSignal): string {
  switch (s.signal_type) {
    case "ecosystem_uplift":  return `Ecosystem "${s.signal_key}" candidates`;
    case "ecosystem_penalty": return `Ecosystem "${s.signal_key}" candidates`;
    case "tenure_pattern":    return `Tenure pattern "${s.signal_key}"`;
    case "adjacent_path_winning": return `Adjacent path ${s.signal_key}`;
    case "adjacent_path_losing":  return `Adjacent path ${s.signal_key}`;
    case "recruiter_strategy_wins": return `Submission strategy "${s.signal_key}"`;
    case "client_prefers": return `Client prefers ${s.signal_key}`;
    case "client_rejects": return `Client rejects ${s.signal_key}`;
    default: return `${s.signal_type}: ${s.signal_key}`;
  }
}

// =========================================================================
// Calibration — deterministic, bounded, explainable.
// Applied AFTER the AI response so the AI cannot poison itself.
// =========================================================================

export interface CalibrationInput {
  prior: { shortlist_pct: number; interview_pct: number; placement_pct: number };
  ecosystem_signals: Array<{ company?: string; ecosystem?: string; relevance?: string }>;
  match_classification: string;
}

export interface CalibrationResult {
  calibrated: { shortlist_pct: number; interview_pct: number; placement_pct: number };
  delta_pp: number;
  calibration_basis: string;
  applied_signals: Array<{ key: string; pp: number; n: number }>;
}

export function calibratePlacementProbability(
  prior: CalibrationInput["prior"],
  mem: OutcomeMemory,
  ctx: { ecosystem_signals: CalibrationInput["ecosystem_signals"]; match_classification: string },
): CalibrationResult {
  let delta = 0;
  const applied: Array<{ key: string; pp: number; n: number }> = [];

  const usableSignals = mem.signals.filter((s) => s.sample_size >= MIN_SAMPLE_FOR_USE && s.confidence !== "low");

  // Ecosystem alignment — match candidate ecosystem to learning signals.
  const candidateEcos = new Set(
    (ctx.ecosystem_signals ?? [])
      .map((e) => (e.ecosystem ?? e.company ?? "").toLowerCase())
      .filter(Boolean)
  );
  for (const sig of usableSignals) {
    if (sig.signal_type !== "ecosystem_uplift" && sig.signal_type !== "ecosystem_penalty") continue;
    if (!candidateEcos.has(sig.signal_key.toLowerCase())) continue;
    const pp = clamp(sig.weight * 10, -8, 8); // weight ∈ [-1,1] → ±8pp per match
    delta += pp;
    applied.push({ key: `ecosystem:${sig.signal_key}`, pp: round1(pp), n: sig.sample_size });
  }

  // Adjacent / transferable path performance for transferable_match candidates.
  if (ctx.match_classification === "transferable_match" || ctx.match_classification === "needs_validation") {
    for (const sig of usableSignals) {
      if (sig.signal_type !== "adjacent_path_winning" && sig.signal_type !== "adjacent_path_losing") continue;
      const pp = clamp(sig.weight * 6, -6, 6);
      delta += pp;
      applied.push({ key: `path:${sig.signal_key}`, pp: round1(pp), n: sig.sample_size });
      break; // apply only the strongest path signal once
    }
  }

  // Client preference negative patterns.
  const prefs = mem.client_preferences?.preferences as any;
  if (prefs?.rejects_patterns && mem.client_preferences!.sample_size >= MIN_SAMPLE_FOR_USE) {
    // No keyword matching here; counted as a soft anchor that recruiter notes
    // will surface qualitatively. Subtract a small confidence haircut.
    if (mem.client_preferences!.confidence === "high") {
      delta -= 3;
      applied.push({ key: "client_rejects_pattern", pp: -3, n: mem.client_preferences!.sample_size });
    }
  }

  // Final bound.
  delta = clamp(delta, -MAX_CALIBRATION_PP, MAX_CALIBRATION_PP);

  const calibrated = {
    shortlist_pct: clampPct(prior.shortlist_pct + delta),
    interview_pct: clampPct(prior.interview_pct + delta),
    placement_pct: clampPct(prior.placement_pct + delta),
  };

  let basis: string;
  if (!applied.length) {
    basis = "AI prior (no outcome history yet for this pattern at this tenant).";
  } else if (delta > 0) {
    basis = `Adjusted +${round1(delta)}pp from ${applied.length} outcome signal${applied.length === 1 ? "" : "s"} (${summariseApplied(applied)}).`;
  } else if (delta < 0) {
    basis = `Adjusted ${round1(delta)}pp from ${applied.length} outcome signal${applied.length === 1 ? "" : "s"} (${summariseApplied(applied)}).`;
  } else {
    basis = "AI prior preserved (signals offset).";
  }

  return { calibrated, delta_pp: round1(delta), calibration_basis: basis, applied_signals: applied };
}

function clamp(n: number, lo: number, hi: number) { return Math.max(lo, Math.min(hi, n)); }
function clampPct(n: number) { return Math.round(clamp(n, 0, 100)); }
function round1(n: number) { return Math.round(n * 10) / 10; }
function summariseApplied(applied: Array<{ key: string; pp: number; n: number }>) {
  return applied.slice(0, 3).map((a) => `${a.key} ${a.pp >= 0 ? "+" : ""}${a.pp}pp/n=${a.n}`).join("; ");
}
