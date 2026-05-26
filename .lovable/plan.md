# Centralized AI Match Scoring + Submission Workflow Fix

## Problem

Two critical issues:

1. **Conflicting AI scores** — Same candidate/job pair shows 57% LOW in "AI Talent Match" but 90% Strongly Recommended in "AI Validation / Submission Pack". Two independent engines (`rediscover-candidates` and `validate-candidate-fit`) generate scores separately.
2. **Submission workflow crash** — Inserting into `submission_activity` violates `submission_activity_actor_type_check`, blocking "Generate Pack & Submit".

## Goal

One deterministic match score per `(tenant, candidate, job)`. Every surface (Talent Match cards, AI Validation modal, Submission Pack PDF, Reports, Client Portal) reads from this single record. Validation enriches it with explanation — never replaces the score.

---

## Phase 1 — Database: Single Source of Truth

Create `candidate_job_match` table:

```
id, tenant_id, candidate_id, job_id,
final_match_score (0-100, numeric),
confidence_level ('low'|'medium'|'high'),
recommendation_level ('strongly_recommended'|'recommended'|'moderate_match'|'low_match'),
sub_scores jsonb {role, skills, experience, seniority, location, industry, semantic},
strengths text[], considerations text[], risks text[],
ai_summary text,
score_breakdown jsonb,
scoring_version text,
cached_embedding_hash text,
generated_at, updated_at
UNIQUE (tenant_id, candidate_id, job_id)
```

RLS: tenant-scoped read for authenticated users in the tenant; service role writes via edge functions.

Backfill: migrate existing `rediscovered_matches` and `candidate_validations` rows into the new table (best score wins; keep latest enrichment).

## Phase 2 — Fix submission_activity Constraint

Audit the existing `submission_activity_actor_type_check` constraint. Replace it with:
```
CHECK (actor_type IN ('recruiter','manager','owner','client','system','ai'))
```
Normalize all insert sites (triggers + edge functions) to use these exact values. Add a server-side fallback: if `actor_type` is anything else, log warn and insert `'system'`. Wrap activity inserts in try/catch in `generate-submission-pack` so logging never blocks submission completion.

## Phase 3 — Deterministic Scoring Engine

New shared module `supabase/functions/_shared/match-scoring.ts` exporting `computeMatch(job, candidate)`:

- Deterministic weighted sub-scores (Skills 35 / Experience 25 / Role 20 / Seniority 10 / Location 5 / Industry 5).
- Optional semantic similarity boost when embeddings exist.
- Returns `{final_match_score, sub_scores, confidence_level, recommendation_level}`.
- `scoring_version = 'v1.0'` constant; bump when weights change.

Thresholds:
- ≥90 → strongly_recommended (high confidence)
- 75–89 → recommended (high)
- 60–74 → moderate_match (medium)
- <60 → low_match (low)

## Phase 4 — Refactor Edge Functions to Use the Engine

- **`rediscover-candidates`** — for each candidate, call `computeMatch`, upsert into `candidate_job_match`. Still writes a denormalized row into `rediscovered_matches` for the discovery UI, but the score comes from `candidate_job_match`.
- **`validate-candidate-fit`** — read existing `candidate_job_match`; if missing, compute it first. Then call OpenAI ONLY to enrich `strengths/considerations/risks/ai_summary`. Update the same row — never the score. Returns the unified record.
- **`generate-submission-pack`** — read score from `candidate_job_match`. PDF shows the same number as everywhere else.

## Phase 5 — Frontend: Single Hook

New `src/hooks/useCandidateJobMatch.ts` — fetches/subscribes to `candidate_job_match` for a `(candidate, job)`. Realtime invalidation.

Refactor consumers:
- `AIValidationCard.tsx` → read from new hook; show "Based on centralized AI scoring engine · v1.0 · generated {time} · {confidence} confidence".
- `RediscoveredTalentSection.tsx` cards → score, recommendation, sub-score bars from new hook.
- `SubmissionDetailDialog.tsx` / Submission Wizard → same hook.
- Re-run button calls `validate-candidate-fit` with `force=true` which recomputes + re-enriches.

## Phase 6 — UX Improvements

- Score breakdown bars (Role / Skills / Experience / Seniority / Location / Industry) visible in Validation card and Talent Match card — driven by `sub_scores`.
- Confidence badge (High/Medium/Low).
- Consistent recommendation label and color everywhere via shared `src/lib/match-recommendation.ts` helper.

## Phase 7 — Caching & Safety

- Hash of `(jd_text + cv_text + skills)` stored as `cached_embedding_hash`. Skip recompute if unchanged and <7 days old, unless `force=true`.
- All AI calls wrapped: failures return existing cached score; never throw past the UI.
- Submission flow: if validation/AI/activity logging fails, submission still completes; failures surface as non-blocking toasts.

---

## Technical Notes

- Migration creates the table + RLS + indexes + constraint update for `submission_activity.actor_type`.
- `src/integrations/supabase/types.ts` is auto-regenerated post-migration.
- Existing `rediscovered_matches` and `candidate_validations` tables remain (for history) but become projections of `candidate_job_match`.
- No new secrets needed — OpenAI key already configured.

## Out of Scope

- Reweighting the scoring algorithm beyond the defaults above (can tune later).
- Rebuilding the Submission Wizard UI — only the score display changes.
- Client portal redesign — it just reads the same record.

Approve and I'll execute Phases 1–7 in order.
