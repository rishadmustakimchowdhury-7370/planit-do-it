# AI Talent Match — Unified Matching Architecture

Goal: Replace the dual "Suggested Candidates" + "Rediscovered Talent" systems with **one** explainable, recruiter-trusted matching engine that produces a single consistent score per candidate-job pair.

---

## Phase 1 — Consolidation & Cleanup

**Remove duplication** so one score = one truth.

- Delete `SuggestedCandidates.tsx` and any callers on Job Detail / dashboards.
- Rename `RediscoveredTalentSection` → `AITalentMatchSection`.
- Drop legacy `ai-match` one-off scoring (page-level "Run AI Match") in favor of the unified pipeline. Keep the page as a thin viewer that reads from the same source of truth.
- Single DB table for results: reuse `rediscovered_matches` → rename conceptually to `ai_talent_matches` (new table + migration; old data archived).
- Single edge function: `ai-talent-match` (replaces `rediscover-candidates`).

**Outcome:** one engine, one table, one score everywhere.

---

## Phase 2 — Data Foundations

Add the signals the new scoring needs.

Schema additions (migration):
- `jobs`: `role_family` (text), `seniority_level` (enum), `industry` (text), `required_skills` (text[]), `nice_to_have_skills` (text[]).
- `candidates`: `role_family` (text), `seniority_level` (enum), `industries` (text[]), `normalized_skills` (text[]).
- New `skill_aliases` table: canonical skill ↔ aliases ↔ related skills (e.g. Selenium ↔ WebDriver ↔ Playwright/Cypress as "test-automation" family).
- New `role_families` table: title patterns → family (QA, Backend, Frontend, Data, DevOps, PM, etc.) + seniority regex.
- New `ai_talent_matches` table: `job_id, candidate_id, final_score, confidence, sub_scores jsonb, reasoning jsonb, model_version, created_at` (unique on job+candidate).
- New `match_feedback` table: recruiter actions (shortlisted/rejected/interviewed/placed) feeding the learning loop.

Backfill job:
- Edge function `normalize-entities` runs once and on insert/update to populate role_family, seniority, normalized_skills from existing free-text.

---

## Phase 3 — Hybrid Scoring Engine

Implemented in `supabase/functions/ai-talent-match/scoring.ts`.

Weighted final score (0–100):

```
final =  0.40 * role_similarity
       + 0.25 * skill_match
       + 0.10 * industry_match
       + 0.10 * seniority_match
       + 0.10 * experience_match
       + 0.05 * location_availability
       - penalties
```

Each sub-score:
- **Role similarity (40%)** — role_family exact = 1.0; adjacent family = 0.5; unrelated = 0.1. Augmented by title embedding cosine (OpenAI `text-embedding-3-small`).
- **Skill match (25%)** — Jaccard over normalized required skills + alias expansion + embedding similarity for missing exact matches. Core (required) skills weighted 2× nice-to-haves.
- **Industry (10%)** — overlap of `jobs.industry` with `candidates.industries`.
- **Seniority (10%)** — distance on ordinal scale (junior=1…principal=5); same=1.0, ±1=0.6, ±2=0.2, junior→senior=0.
- **Experience (10%)** — within required band=1.0, decreasing with delta.
- **Location/availability (5%)** — same country/timezone/remote-compat.

**Negative weighting (penalties):**
- Wrong role_family on a specialist role: −25.
- Missing ≥50% of required skills: −15.
- Seniority mismatch ≥2 levels: −15.
- Zero industry overlap on industry-critical role: −5.

**Confidence:**
- HIGH: final ≥ 80 AND role_family match AND ≥70% required skills.
- MEDIUM: final 65–79 OR one strong factor missing.
- LOW: final < 65 → **hidden by default**.

**Threshold:** UI shows only ≥65 by default; "Show all" reveals lower for debugging.

---

## Phase 4 — Explainable AI Layer

After deterministic scoring, send the top N (e.g. 25) candidates to `gpt-4o-mini` for a structured explanation only — never to alter the score.

Prompt returns JSON: `{ strengths: string[], gaps: string[], summary: string }`.

Stored in `ai_talent_matches.reasoning`. The score the recruiter sees is always the deterministic hybrid score → guarantees consistency across screens.

---

## Phase 5 — Unified UI: "AI Talent Match"

New `src/components/matching/AITalentMatchSection.tsx` used on Job Detail.

Card shows:
- Name, current title, location, years experience.
- Big match circle + confidence badge (HIGH/MED).
- Sub-score breakdown bars (role/skills/industry/seniority/exp).
- Strengths (green ✓) and gaps (amber ⚠).
- Actions: Shortlist · Move to pipeline stage · AI outreach · Schedule interview · Assign recruiter · Dismiss.

Filters bar:
- Min score slider (default 65), confidence (High/Med), location, must-have skills, experience range, owner, last-active.

Empty state: "No strong matches yet — quality over quantity. Try widening required skills or re-scan."

Sidebar/top-level nav: rename "AI Match" → "AI Talent Match", point to the same engine.

---

## Phase 6 — Feedback Learning Loop

Every recruiter action writes to `match_feedback`:
- shortlisted → +signal for that candidate's role_family/skills on similar jobs.
- rejected with reason → −signal.
- interviewed / placed → strongest +signal.

Nightly edge function `recompute-weights` adjusts per-tenant multipliers on sub-scores (bounded ±20%) so the engine learns each agency's taste without destabilizing the global formula.

Stored in `tenant_scoring_weights`.

---

## Phase 7 — Rollout, QA & Trust

1. Migration + backfill (normalize all existing jobs/candidates).
2. Deploy `ai-talent-match` edge function; deprecate `rediscover-candidates` and `ai-match` (keep stubs that proxy to the new function for one release).
3. Re-score all open jobs in background.
4. Visual QA: same candidate must show identical score on Job Detail, AI Talent Match page, and dashboard.
5. Add a "Why this score?" modal exposing sub-scores + penalties.
6. Telemetry: log every score with `model_version` so we can A/B future tweaks.
7. Update docs + in-app tooltip explaining the scoring model to recruiters.

---

## Technical summary (for reference)

- **Embeddings:** `text-embedding-3-small` (1536 dims) via OpenAI — already wired. Used only for title + skill semantic similarity, not as the final score.
- **LLM:** `gpt-4o-mini` for explanations only (deterministic temp 0.2, JSON mode).
- **DB:** pgvector already enabled; add new tables + RLS scoped to `tenant_id` via `user_belongs_to_tenant`.
- **RPCs:** `match_candidates_for_job` stays for the ANN prefilter (top 200), then hybrid scoring runs in the edge function on that shortlist.
- **Consistency guarantee:** UI never recomputes — it only reads `ai_talent_matches`. One write path, one read path.

After approval I'll proceed phase by phase, starting with Phase 1 + 2 (migration + cleanup) so nothing else breaks.