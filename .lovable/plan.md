
# Validator v2 — Production Integration Plan

## Guiding principle

**One scoring authority, two-payload compatibility.** `validate-candidate-fit` (legacy) currently produces the rich payload the UI already consumes — `mandate_match`, `recruiter_copilot`, `placement_calibration`, `ecosystem_signals`, `recruiter_notes_impact`. We do not throw that away. Instead, legacy becomes a **thin orchestrator** that:

1. Calls the v2 scoring core (`scoreStructured`) for the authoritative `final_score`, `prefilter_score`, `recommendation_tier`, `explanation`, `missing_requirements`, `mandatory_skills_matched`, `preferred_skills_matched`.
2. Continues to generate the recruiter copilot + qualitative reasoning via OpenAI.
3. Writes both halves into the **same** `ai_candidate_validations` row.

Result: every recruiter surface keeps working, and there is exactly one row, one `final_score`, one `recommendation_tier` — produced in one place.

---

## Phase 1 — Frontend Cutover (single authority)

### 1.1 `useCandidateValidation.ts`
- Extend `AICandidateValidation` type with `final_score`, `prefilter_score`, `recommendation_tier`, `explanation`, `mandatory_skills_matched`, `preferred_skills_matched`, `missing_requirements`, `weights_profile_id`.
- **Remove** the silent overwrite of `fit_score` with `rediscovered_matches.match_score`. New `useLatestValidation` returns the row as-is, with a derived `display_score = final_score ?? fit_score` field and `prefilter_score` separately exposed.
- `useValidateCandidateFit.run()` keeps invoking `validate-candidate-fit` (which is now the unified orchestrator).

### 1.2 `validate-candidate-fit` edge function (legacy → unified orchestrator)
- Import `scoreStructured` from `_shared/structured-scoring.ts`.
- After loading job + candidate, ensure `structured_jd` + `structured_profile` exist (invoke `structure-jd` / `parse-cv` if missing — same idempotent pattern as v2).
- Load tenant `scoring_weights_profile`.
- Compute `prefilterScore = computeMatchScore(...)` and `explanation = scoreStructured(...)`.
- Insert row with **both** halves:
  - v2 fields: `final_score`, `prefilter_score`, `recommendation_tier`, `explanation`, `mandatory_skills_matched`, `preferred_skills_matched`, `missing_requirements`, `weights_profile_id`, `engine_version = "enterprise_validation_v2"`.
  - legacy fields kept: `mandate_match`, `recruiter_copilot`, `match_classification`, `interview_probability`, `ecosystem_signals`, `placement_calibration`, etc.
  - `fit_score` set to `final_score` (no longer a separate authority).
- Mirror to `rediscovered_matches` (`final_score`, `recommendation_tier`, `ai_validation_id`).

### 1.3 v2 endpoint
- `validate-candidate-fit-v2` stays as the **lightweight** scoring-only endpoint (used by the queue worker and any non-UI caller). It writes the same row shape minus the qualitative copilot fields.

### 1.4 UI surfaces (no schema changes, just new fields surfaced)
- `JobAIMatchSection.tsx`, `AIMatchPage.tsx`, `JobDetailPage.tsx`, `AIValidationCard.tsx`, `SubmissionWizard.tsx`: read `final_score`, `prefilter_score`, `recommendation_tier`, `explanation` from the validation row. Continue to read legacy fields where already used. Tier chip uses `recommendation_tier` when present, falls back to `match_classification`.

---

## Phase 2 — Validation Queue Worker

### 2.1 New edge function `process-validation-queue`
- Loops a batch (default 20) of `validation_queue` rows where `status = 'pending'` ordered by `priority desc, enqueued_at asc`.
- Per row: mark `in_progress` → invoke `validate-candidate-fit-v2` with service-role auth → on success mark `done` + set `processed_at`; on failure increment `attempts`, mark `failed` after 3 attempts.
- Respects OpenAI 429 / 402: backs off the batch, leaves row as `pending`.
- Idempotent — never enqueues duplicates (relies on existing `validation_queue` unique constraint on (job_id, candidate_id, status='pending')).
- Returns `{processed, failed, remaining}`.

### 2.2 Cron schedule
- Insert (via the insert tool, since URL + anon key are environment-specific) a `pg_cron` job: `process-validation-queue-every-minute`, `* * * * *`, POSTs to the function URL with the project anon key.

---

## Phase 3 — Rediscovery Fan-Out

### 3.1 `rediscover-candidates` edge function
- After `rediscovered_matches.upsert(...)`, take the top **N=25** by `match_score` and bulk-insert into `validation_queue` with `status='pending'`, `priority=10`, conflict-do-nothing on `(tenant_id, job_id, candidate_id)` where status='pending'.
- Returns `enqueued_for_validation: N` in the response.
- The cron worker drains these → writes `final_score`/`recommendation_tier` back to `rediscovered_matches` (already done by v2's mirror step).

---

## Phase 4 — Consistency Audit & Production Readiness Report

Final deliverable in chat:

- **Single Authority Confirmation** — sole writer of `final_score` / `recommendation_tier` is `scoreStructured` (called from both `validate-candidate-fit` and `validate-candidate-fit-v2`).
- **No Legacy Overwrite** — `useLatestValidation` no longer overwrites; `rediscovered_matches.match_score` is now labelled `prefilter_score` for read purposes.
- **Consumer Matrix** — table showing recruiter UI / dashboard / queue worker / future submission engine all reading the same `ai_candidate_validations` row and the same `rediscovered_matches.final_score`.
- **Data flow diagram** (ASCII).
- **Known follow-ups** before Submission Engine begins.

---

## Files Touched

**Frontend (5):**
- `src/hooks/useCandidateValidation.ts`
- `src/components/clients/AIValidationCard.tsx`
- `src/components/matching/JobAIMatchSection.tsx`
- `src/pages/AIMatchPage.tsx`
- `src/pages/JobDetailPage.tsx`

**Edge functions (3):**
- `supabase/functions/validate-candidate-fit/index.ts` (becomes unified orchestrator)
- `supabase/functions/rediscover-candidates/index.ts` (fan-out enqueue)
- `supabase/functions/process-validation-queue/index.ts` (new)

**Infra (1):**
- `supabase/config.toml` (register worker function)
- `pg_cron` schedule (inserted via insert tool, not migration)

No new tables, no schema changes. All additive at the column level — schema is already migrated from earlier phases.

---

## Open question before I start

The legacy `validate-candidate-fit` is ~655 lines of OpenAI prompt + parsing + recruiter copilot logic. The cleanest unification is to **augment** it with v2 scoring rather than rewrite. Confirm you're OK with that (vs. a full rewrite that would also redesign the copilot prompt). My recommendation: augment now, revisit copilot prompt in a later phase — keeps risk surface small for this integration.
