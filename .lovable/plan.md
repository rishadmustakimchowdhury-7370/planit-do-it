# Placement Outcome Intelligence — 7-Phase Plan

Per project memory, no code is written until you approve. This evolves the platform from static AI reasoning into a self-improving Executive Search intelligence loop, while keeping every learning signal tenant-isolated, confidence-weighted, and recruiter-supervised.

## Guiding principles

- **Tenant isolation is non-negotiable.** Every learning signal, aggregate, and prior is scoped by `tenant_id`. No cross-tenant contamination, ever — enforced at the RLS level and in the calibration math.
- **Human-in-the-loop only.** The AI never self-trains blindly. Outcomes are captured automatically where possible (status changes, submission events) and explicitly when recruiter judgment is involved (overrides, client feedback, win/loss reason).
- **Probability stays explainable.** Calibrated `placement_pct` always carries a `calibration_basis` ("AI prior" → "tenant outcome-adjusted, n=47 similar placements") so recruiters trust it.
- **Recruiter-only intelligence.** Analytics dashboards, outcome reasoning, and learned priors are never exposed in client-safe surfaces.

---

## Phase 1 — Outcome Capture Schema

New tables (all tenant-scoped, RLS-protected, GRANTs to `authenticated` + `service_role`):

- `placement_outcomes` — one row per (job, candidate) terminal event:
  - `outcome_type`: shortlist_accepted | shortlist_rejected | interview_scheduled | interview_rejected | offer_extended | offer_accepted | offer_rejected | placement_succeeded | placement_failed | candidate_withdrew
  - `outcome_reason` (free text) + `outcome_reason_category` (compensation | culture_fit | experience_gap | tenure | ecosystem_mismatch | overqualified | timing | client_silence | other)
  - `recorded_by` (recruiter_id) + `source` (manual | submission_event | client_portal | recruiter_override)
  - Links: `ai_validation_id`, `submission_id`, `client_org_id`
- `outcome_learning_signals` — derived, weighted signals (recruiter | client | tenant scope):
  - `signal_type`: ecosystem_uplift | ecosystem_penalty | tenure_pattern | adjacent_path_winning | adjacent_path_losing | recruiter_strategy_wins | client_prefers | client_rejects
  - `signal_key` (e.g. `"Glencore"`, `"<2yr tenure"`, `"adjacent:trading→commodities_compliance"`)
  - `weight` (–1.0 … +1.0) + `sample_size` (n) + `confidence` (low/medium/high)
- `client_preference_profile` — auto-rolled summary per `client_org_id`:
  - JSON map of preferences (`prefers_ecosystems`, `rejects_patterns`, `avg_tenure_floor`, `transferable_tolerance`).
- Migration also adds `outcome_status`, `outcome_recorded_at` to `candidate_submissions` for fast filtering.

---

## Phase 2 — Outcome Capture UX

Recruiter-facing capture without adding noise:

- **One-click outcome bar** on `CandidateWorkflowPanel`, `SubmissionWorkspace`, and the kanban card menu: Interview / Reject / Offer / Hired / Withdrawn — opens a small modal for reason + reason_category.
- **Auto-capture hooks**: stage transitions in `KanbanBoard` write `placement_outcomes` rows automatically (interview_scheduled when stage = interview, etc.).
- **Client portal capture**: when a client clicks "Decline" / "Request interview" / "Reject" on a submission, a `placement_outcomes` row is written with `source = client_portal` — no extra burden on the client.
- **Recruiter override → learning signal**: the existing `recruiter_feedback` table already captures overrides; we link those rows to subsequent outcomes so "AI said weak → recruiter upgraded → client accepted" becomes a strengthening signal.

All capture surfaces are recruiter-only. Clients never see "outcome learning" labels — only the buttons that already make sense to them.

---

## Phase 3 — Outcome Memory Engine (`_shared/outcome-memory.ts`)

A new shared edge module that:

1. **Aggregates signals** from `placement_outcomes` × `ai_candidate_validations` × `recruiter_feedback`, grouped by tenant.
2. **Rolls up patterns**:
   - Ecosystem uplift: avg placement-rate of candidates with each ecosystem signal vs baseline.
   - Adjacent path conversion: `(from_family → to_family)` win-rate.
   - Tenure cliffs: rejection rate by tenure bucket per client_org.
   - Recruiter strategy wins: which `submission_strategy` value produced the most accepted shortlists per recruiter.
3. **Writes** to `outcome_learning_signals` and `client_preference_profile`.
4. **Refresh job**: scheduled via `pg_cron` (or invoked nightly via existing `subscription-lifecycle` pattern) per tenant.
5. **Cold-start safety**: signals with `sample_size < 5` are ignored at inference time and surfaced with `confidence = low`.

All aggregation queries are constrained to a single `tenant_id` parameter — no cross-tenant joins anywhere.

---

## Phase 4 — Probability Calibration (Outcome-Informed)

Extend the existing `RecruiterCopilot.placement_probability` so it's a function of:

1. **AI prior** (current model output).
2. **Tenant outcome adjustment** — look up applicable learning signals (ecosystem match, adjacent path, tenure pattern, client_org preferences) and apply a bounded ±15pp shift.
3. **Recruiter override adjustment** — if `recruiter_memory_signals` show the current recruiter consistently overrides this AI band toward a different one, soften AI confidence.
4. **Client-specific adjustment** — if `client_preference_profile` has high-confidence rejects matching this candidate, lower acceptance probability.

New optional fields on the copilot block:
- `calibration_basis` (human-readable, e.g. "Adjusted +8pp: 12 similar transferable placements at this client succeeded")
- `prior_pct` vs `calibrated_pct` for transparency.

Calibration is deterministic, executed in TypeScript inside `validate-candidate-fit` after the AI response — the AI never sees raw outcome numbers, eliminating prompt-injection-style poisoning.

---

## Phase 5 — Inference-Time Memory Injection

Inject **summary** (not raw outcomes) into the validation prompt so the AI's qualitative reasoning is outcome-aware:

- "This client historically prefers Big-4 compliance backgrounds (n=8, confidence high)."
- "Adjacent path Trading Ops → Commodities Compliance has won 4/6 placements at this client."
- "Avoid: tenure under 2 years has been rejected 5/6 times by this client."

Strict guardrails:
- Only injects signals where `tenant_id` matches the calling job's tenant.
- Only injects signals with `sample_size ≥ 5` and `confidence ≥ medium`.
- Hard-cap of 6 bullets to avoid prompt bloat.
- Never expose individual candidate names — only patterns.

---

## Phase 6 — Recruiter Analytics Dashboard

New page `src/pages/RecruiterIntelligencePage.tsx` (recruiter / manager / owner only; route-guarded):

Tabs:
1. **Conversion funnel** — Shortlist → Interview → Offer → Hired with per-stage drop-off and 30/90-day trend.
2. **Ecosystem performance** — Tier-1/Tier-2/Adjacent win rates, leaderboard of strongest source ecosystems.
3. **Transferable paths** — Sankey-style summary of which adjacent families convert (top winning / losing paths).
4. **Client preferences** — Per `client_org_id`: detected preferences, rejection reasons trend, average time-to-decision.
5. **Recruiter performance** — Per-recruiter conversion, override accuracy (overrides confirmed by outcomes), strategy win-rates.

All data queried via tenant-scoped RPC functions (security-definer, RLS-aware). Never accessible from the client portal route tree.

---

## Phase 7 — QA, Safety, and Calibration Audit

Extend `ai-qa-runner` and add a new `outcome-calibration-audit` job:

- **Calibration tests**: simulate a tenant with synthetic outcomes; assert `calibrated_pct` shifts in the expected direction and stays within ±15pp bounds.
- **Tenant isolation tests**: insert outcomes for Tenant A, run validation for Tenant B's job, assert no signal leakage in the prompt or calibration math.
- **Cold-start tests**: validation under `sample_size < 5` must equal the AI prior (no learning influence).
- **Reverse-correction tests**: when recruiter consistently overrides an AI band and the override is confirmed by a `placement_succeeded` outcome, assert future validations of similar candidates shift in the recruiter's direction (bounded).
- **False-positive watch**: weekly admin alert when a recurring profile pattern has ≥3 rejections in 30 days — surfaces in `AdminAIQAPage` for human review before the system auto-penalises that pattern.

A small `OutcomeMemoryDebugPanel` (super-admin only) lets ops inspect the learning signals being applied to any given validation, with the recruiter-friendly `calibration_basis` next to the raw math.

---

## What the user will see

- New "Outcome" pill on every candidate card and submission row (Interview / Hired / Rejected / Withdrawn).
- Recruiter Copilot's placement probability now shows: `Calibrated 62% (prior 54%, +8pp from 12 similar wins at this client)`.
- New top-level "Recruiter Intelligence" page with the analytics tabs above.
- Override divergence banner now references real outcome history when applicable: *"Updated reasoning reflects 3 recent similar placements at this client."*
- Clients see nothing different — all learning surfaces are recruiter-only.

---

## Open decisions (please confirm before I build)

1. **Outcome capture trigger** — auto-capture on kanban stage change (zero-friction, may misfire), explicit modal only (cleaner data, more clicks), or both with auto-capture as a soft signal and modal as the authoritative record?
2. **Calibration cap** — keep the ±15pp bound on outcome-adjusted probability, or allow wider movement (±25pp) once `sample_size ≥ 20`?
3. **Client preference visibility** — should the recruiter see the auto-derived client preferences as a sidebar on `ClientDetailPage`, or only inside the Recruiter Intelligence dashboard?
4. **Refresh cadence** — recalculate learning signals nightly via `pg_cron`, or on-demand from the Recruiter Intelligence page with a "Last refreshed Xh ago" indicator (cheaper, more recruiter-controlled)?
