
# Enterprise AI Validation Engine — Audit & Migration Plan

This is an architecture document. No code is generated here; implementation follows only after you approve.

---

## PHASE 1 — AUDIT OF EXISTING SYSTEM

I traced every AI-adjacent surface currently in the codebase. Findings below.

### 1. JD ↔ Candidate Matching (deterministic core)

- **Location:** `supabase/functions/_shared/match-scoring.ts` (`computeMatchScore`, `MODEL_VERSION = "hybrid_v1"`)
- **Purpose:** Single source of truth for the numeric fit score used by both Talent Rediscovery and per-candidate Validation.
- **Implementation:** Hand-coded role-family detection, skill alias normalization, seniority rank, weighted formula (role 40 / skills 25 / industry 10 / seniority 10 / experience 10 / location 5) minus penalties.
- **Strengths:** Deterministic, fast, cheap, explainable, identical score everywhere, already integrated into UI (`rediscovered_matches`, `sub_scores`, `confidence`).
- **Weaknesses:** Keyword/alias driven; `industry` is hardcoded 0.5; no semantic understanding; role families are a small fixed dictionary (won't generalize to executive search, finance, healthcare niches); transferable-skills logic is shallow.
- **Risks:** Won't scale to "all industries / all countries"; maintenance of dictionaries is unbounded.
- **Classification:** **MODIFY** — keep as the fast deterministic *pre-filter* layer, demote from "final score" to "candidate level signal feeding the AI engine".

### 2. Semantic Retrieval (embeddings)

- **Location:** `supabase/functions/embed-job/index.ts`, `embed-candidate/index.ts`, tables `job_embeddings`, `candidate_embeddings`, RPC `match_candidates_for_job` (pgvector cosine).
- **Purpose:** ANN shortlist of candidates per job.
- **Implementation:** OpenAI `text-embedding-3-small`, 1536-dim, stored in pgvector, tenant-scoped RPC.
- **Strengths:** True semantic understanding; tenant-isolated; already scales to ~1M rows with HNSW; the right primitive for the new engine.
- **Weaknesses:** Embeddings are built from raw text only — no structured JD/profile JSON; no re-embedding on profile change is guaranteed; only one embedding per entity (no per-section embeddings).
- **Risks:** Stale embeddings on profile edit; recall ceiling when JD is sparse.
- **Classification:** **KEEP + MODIFY** — make this the Stage-1 retrieval layer; add structured-text builder + re-embed triggers.

### 3. Per-candidate AI Validation

- **Location:** `supabase/functions/validate-candidate-fit/index.ts`, shared `_shared/validation-prompt.ts`, `_shared/validation-contract.ts`, table `ai_candidate_validations`, hook `useCandidateValidation.ts`.
- **Purpose:** Generate fit score + strengths/weaknesses/risks + recruiter copilot per (job, candidate) pair.
- **Implementation:** OpenAI (gpt-4o family), strict JSON contract, cached by `jd_signature`, `validation_stale` triggers auto-revalidate.
- **Strengths:** Explainable output; recruiter-copilot blocks; staleness handling; outcome-memory + recruiter-memory injected into prompt.
- **Weaknesses:** Runs **per candidate on demand** — not "JD vs all candidates" automatically; final `fit_score` is overwritten by deterministic hybrid score (line in `useLatestValidation`), so AI score is effectively shadowed; no global ranking write-back; no admin-tunable weights; mandatory-vs-preferred skill split not modeled.
- **Risks:** Two scoring authorities (AI + hybrid) producing different truths; users see hybrid number but AI rationale — divergence already visible (`override_divergence`).
- **Classification:** **MODIFY** — keep as the Stage-3 *explanation + qualitative reasoning* layer, stop overwriting its score with hybrid; introduce a single fused score.

### 4. Bulk JD → Candidates Discovery

- **Location:** `supabase/functions/rediscover-candidates/index.ts`, `_shared/discovery-engine.ts`, table `rediscovered_matches`, `src/components/matching/RediscoveredTalentSection.tsx`.
- **Purpose:** When a job is created/opened, surface ranked candidates.
- **Implementation:** Calls `match_candidates_for_job` (pgvector) → enriches with `computeMatchScore` (hybrid_v1) → writes `rediscovered_matches`.
- **Strengths:** This is already the "Talent Rediscovery" pipeline you asked for in Step 7; tenant-safe; includes inactive/archived candidates by virtue of querying all embeddings.
- **Weaknesses:** Does not call the AI validation engine in batch — AI runs only when user opens a candidate; ranking is hybrid-only.
- **Classification:** **MODIFY** — become Stage-2 orchestrator that fans out async AI validations for the top-N retrieved candidates.

### 5. Resume Parsing

- **Location:** `supabase/functions/parse-cv/index.ts`.
- **Purpose:** Extract structured profile fields from uploaded CV.
- **Strengths:** Already produces candidate JSON used elsewhere.
- **Weaknesses:** Unknown how much of the Step-2 "Resume Analysis" target schema (career progression, domain expertise, certifications, languages) it actually fills — many `candidates` columns are likely sparse.
- **Classification:** **MODIFY** — extend to emit the full structured profile schema required by the new engine; backfill missing candidates via batch job.

### 6. Recruiter Copilot / Outcome Learning

- **Location:** `_shared/outcome-memory.ts`, `_shared/recruiter-memory.ts`, `_shared/recruiter-language.ts`, `useRecruiterCopilot.ts`, `useOutcomeCapture.ts`, `useRecruiterIntelligence.ts`, `recruiter_outcomes` / intelligence signal tables.
- **Purpose:** Feed recruiter overrides, placement outcomes, and client preferences back into prompts.
- **Strengths:** Already implements the "self-improving" feedback loop, override divergence, calibration tracking.
- **Classification:** **KEEP** — plug directly into the new engine prompt without change.

### 7. Outreach / Comms Automation

- **Location:** `generate-client-comms`, `ai-compose-email`, `send-candidate-email`, `send-submission-email`, `CommunicationDrawer`, templates manager.
- **Classification:** **KEEP** — orthogonal to validation; no conflict.

### 8. AI-Generated Reports / Submission Pack

- **Location:** `generate-submission-pack`, `brand-cv`, `generate-jd-pdf`, `generate-invoice-pdf`.
- **Classification:** **KEEP** — consumes validation output, not a competing engine.

### 9. Other AI surfaces

- `ai-generate-template`, `ai-qa-runner`, `chatbot`, `transcribe-voice-note`, `linkedin-extension-api` → **KEEP** (unrelated to candidate validation).

### 10. Database structures related to AI

| Table | Status |
|---|---|
| `ai_candidate_validations` | KEEP, extend (mandatory/preferred breakdown, fused score, weights snapshot) |
| `rediscovered_matches` | KEEP, extend (add `ai_score`, `final_score`, `recommendation`) |
| `job_embeddings`, `candidate_embeddings` | KEEP |
| `validation_queue` (referenced in earlier architecture) | VERIFY / CREATE if missing — required for async fan-out |
| `recruiter_outcomes`, `recruiter_intelligence_signals`, `client_preference_intelligence` | KEEP |
| `ai_validation_cache` (24h) | KEEP |
| New: `scoring_weights_profiles` | CREATE — admin-tunable weights |
| New: `jd_structured`, `candidate_structured` (or JSONB columns on jobs/candidates) | CREATE — Step 1 & 2 outputs |

### Audit Conclusion

There are **two competing scoring authorities** today: deterministic `hybrid_v1` and the AI validator. The hybrid score silently overrides the AI score in the UI hook. This is the single biggest architectural problem and exactly the duplication you warned against. The fix is **not** a new engine — it is to make `hybrid_v1` a *retrieval/pre-filter signal* and the AI validator the *single authoritative scorer*, fused into one transparent number with admin-tunable weights.

---

## MIGRATION PLAN (no parallel system)

1. **Freeze** new feature work on `computeMatchScore`. Mark `hybrid_v1` as "pre-filter only".
2. **Schema migration** (Phase 2.1 below) — additive only, no drops.
3. **Refactor `useLatestValidation`** to stop overwriting `fit_score` with the canonical hybrid score; expose both as `prefilter_score` and `final_score`.
4. **Extend `validate-candidate-fit`** to emit the new contract (mandatory/preferred split, weights snapshot, transparent explanation).
5. **Extend `rediscover-candidates`** to enqueue async AI validation for top-N (default 50) and write fused score back to `rediscovered_matches`.
6. **Extend `parse-cv`** to fill the structured profile schema; run one-time backfill job.
7. **Ship Validation Dashboard** consuming the new fused score and recommendation tier.
8. **Decommission** the hybrid-overrides-AI code path once dashboard is live.

No table is dropped. No second AI engine is introduced. Old `MODEL_VERSION` stays as a column value for historical rows.

---

## PHASE 2 — NEW ENGINE ARCHITECTURE

### Architecture (3-stage funnel, single authority)

```text
Job created/updated
  │
  ▼
[Stage 0] JD Structuring  (OpenAI, JSON-mode)
  │  writes jobs.structured_jd (JSONB)
  ▼
[Stage 1] Semantic Retrieval  (pgvector ANN, top 500)
  │  uses job_embeddings + candidate_embeddings
  ▼
[Stage 2] Deterministic Pre-filter  (hybrid_v1, top 50)
  │  cheap, removes obvious mismatches, produces prefilter_score
  ▼
[Stage 3] AI Validation Engine  (OpenAI, per candidate, async via validation_queue)
        - mandatory/preferred skill resolution
        - industry & domain reasoning
        - career progression & seniority arc
        - transferable skills
        - explainable strengths / concerns / missing
        - tier recommendation
  │  writes ai_candidate_validations + recommendation
  ▼
[Fusion] final_score = Σ (weight_i × sub_score_i)  using active scoring_weights_profile
  │  writes rediscovered_matches.final_score
  ▼
[Stage 4] Ranking + Validation Dashboard
```

Single authority: `final_score` is computed once, in one place (a SQL function `compute_final_score(validation_id)` or in the edge function before insert). Hybrid score becomes the `prefilter_score` column.

### Database Changes Required

Additive migration (details in implementation step):

- `jobs.structured_jd JSONB` — Step 1 output.
- `candidates.structured_profile JSONB` — Step 2 output.
- `ai_candidate_validations`: add `mandatory_skills_matched JSONB`, `preferred_skills_matched JSONB`, `missing_requirements JSONB`, `weights_profile_id UUID`, `final_score INT`, `prefilter_score INT`, `recommendation_tier TEXT` (`highly_recommended|recommended|consider|not_recommended`), `explanation TEXT`.
- `rediscovered_matches`: add `final_score INT`, `recommendation_tier TEXT`, `ai_validation_id UUID`.
- New `scoring_weights_profiles` (tenant-scoped, admin editable): `mandatory_skills`, `industry`, `domain`, `title`, `experience`, `location`, `education` — defaults 35/20/15/10/10/5/5, validated to sum to 100.
- New `validation_queue` if not present: `tenant_id`, `job_id`, `candidate_id`, `status`, `priority`, `enqueued_at`, `processed_at`.
- All new tables: GRANT block + RLS scoped to tenant.

### API Flow

- `POST /functions/v1/rediscover-candidates` `{job_id}` → enqueues Stage 3 jobs, returns retrieval set immediately.
- `POST /functions/v1/validate-candidate-fit` `{job_id, candidate_id, force?}` → unchanged signature, new contract.
- Worker: `process-validation-queue` (cron / pg_net) → drains `validation_queue` in batches respecting OpenAI rate limits.
- `GET` via PostgREST on `rediscovered_matches` for dashboard.

### OpenAI Prompt Flow (single model: gpt-4o, fallback gpt-4o-mini for high-volume)

1. **JD-Structurer prompt** — input raw JD text, output strict JSON: title, seniority, mandatory_skills[], preferred_skills[], industries[], domains[], certifications[], education[], languages[], location, min_years, max_years, technical_skills[], domain_expertise[].
2. **Profile-Structurer prompt** — same shape, applied to CV/profile.
3. **Validator prompt** — receives structured JD + structured profile + recruiter memory + outcome memory + active weights, returns: per-criterion sub-scores (0–1), matched/missing arrays, strengths[], concerns[], explanation, recommendation_tier.
4. Tool-calling (function schema) for structured output — no JSON parsing roulette.

### Ranking Logic

`final_score = round(100 × Σ weight_i × sub_score_i) − penalties`.
Penalties: hard mandatory miss (−15 each, cap −30), seniority gap ≥2 (−10), country mismatch when JD is on-site (−10).
Tier mapping (admin-tunable defaults): ≥85 Highly Recommended, 70–84 Recommended, 55–69 Consider, <55 Not Recommended.

### Validation Dashboard

Recruiter-only route, columns: Candidate, Current Employer, Current Title, Industry, Location, Final Score (with tier chip), Recommendation, Mandatory Missing, Quick Actions (Validate / Shortlist / Submit / Message). Filters: tier, missing-mandatory, industry, location, weights-profile. Inline drawer shows full explanation + sub-scores + recruiter copilot.

### Implementation Plan (sequenced, each step is a separate PR)

1. Migration: additive columns + `scoring_weights_profiles` + `validation_queue` + GRANTs + RLS.
2. Extend `parse-cv` → fill `candidates.structured_profile`; backfill job.
3. New edge function `structure-jd` (or fold into existing JD save flow) → fill `jobs.structured_jd` on insert/update.
4. Rewrite `validate-candidate-fit` to consume structured inputs, emit new contract, compute `final_score` using active weights profile, write `prefilter_score` from `computeMatchScore`.
5. Patch `useLatestValidation` to expose `final_score` / `prefilter_score` cleanly — remove silent override.
6. Extend `rediscover-candidates` to enqueue Stage 3 for top 50 and write `final_score` / tier back to `rediscovered_matches` on completion.
7. New `process-validation-queue` worker (cron every minute, batch 20, respects 429/402).
8. Admin UI: scoring weights editor.
9. Recruiter Validation Dashboard page.
10. Decommission hybrid-as-final-score path; keep `computeMatchScore` as labeled pre-filter.

### Out of scope (intentionally not built)

- No second AI provider. OpenAI only, per requirement.
- No keyword-only matcher anywhere in the new path.
- No client-visible AI internals — `toClientSafe()` continues to gate the client portal.

---

If you approve this plan I will start with the additive migration (step 1) and pause for confirmation before refactoring the validator.
