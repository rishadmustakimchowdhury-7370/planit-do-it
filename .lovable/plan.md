
# Unified Recruiter-Grade AI Validation Engine

Goal: one brain (`validate-candidate-fit`) feeds every AI surface — AI Match page, candidate cards, validation modal, submission pack, executive PDF, client portal. Same candidate → same recommendation, same wording, every screen.

---

## Phase 1 — JD Classification (Step 1 of PRD)

Extend `validate-candidate-fit` so the AI first emits a structured JD breakdown before scoring:

- `mandatory_requirements[]` — blocking core skills (e.g. React, REST, SQL).
- `preferred_requirements[]` — nice-to-have (Docker, AWS, CI/CD). Missing → light penalty only.
- `transferable_families[]` — adjacency map (Backend↔Fullstack, Java↔Python, DevOps↔Backend).
- `seniority_target` — junior / mid / senior / lead.

Cache the JD breakdown per `job_id` in a new `job_jd_analysis` table so it's reused across candidates and consumers (no re-parsing per call).

## Phase 2 — Evidence-Led Candidate Analysis (Step 2)

Tighten the system prompt + scoring shared module:

- Classify every requirement as HIGH / MEDIUM / LOW evidence using the existing hierarchy, but driven explicitly by mandatory vs preferred.
- Reward production ownership, architecture, deployments, measurable impact, years on stack.
- Demote pure keyword lists / generic summaries.
- Apply transferable-family bonus only to *adjacent* mandatory gaps, never to fabricate STRONG.

## Phase 3 — Recruiter Notes Weighting (Step 3)

Notes already flow into the engine; formalize their effect:

- AI must produce a `recruiter_notes_impact[]` array (what shifted, in which direction, by how much).
- Allowed to upgrade band by at most one tier when notes provide concrete off-CV evidence (e.g. "frontend exposure outside CV", "currently leading team").
- Never upgrade past `recommended` purely from notes without CV anchor.

## Phase 4 — Recommendation Engine (Step 4) — Single Taxonomy

Lock the platform to five bands, no numeric % anywhere user-facing:

`highly_recommended | recommended | moderate_fit | limited_alignment | not_suitable`

Migrate `strong_match` → `highly_recommended`, remove `needs_review` from UI (kept only as internal fallback when AI fails). Update `src/lib/recommendation.ts` + `RecommendationBadge` + all filters/sorts/labels.

## Phase 5 — Executive-Search Language Layer (Step 5)

Add a post-processing language guardrail in the edge function:

- Banned phrases regex: "lacks", "weak candidate", "not qualified", "missing experience", "no matched skills".
- Replacement bank: "may benefit from technical validation", "appears limited in the provided CV", "additional discussion recommended", "production ownership should be explored during interview".
- Applied to `summary`, `considerations`, `risks`, `missing_requirements`, `recruiter_review` before persisting.

## Phase 6 — One-Brain Wiring (Most Important Rule)

Audit every consumer and force them to render from the same `ai_candidate_validations` row:

- `AIValidationCard`, `RediscoveredTalentSection`, `JobAIMatchSection`, `AIMatchPage` (already migrated) — confirmed reading recommendation only.
- `generate-submission-pack` + `brand-cv` + executive PDF — pull recommendation, summary, mandate_match, strengths, considerations from the same row instead of re-prompting.
- `ClientCandidateSlideOver`, `SubmissionWorkspace`, `PublicCandidateSharePage` — same source.
- Delete or hard-deprecate the old `ai-match` edge function (frontend already migrated last turn) so no future surface can call it.

## Phase 7 — Executive PDF Polish

One-page, dark navy, premium layout sections in this fixed order:

1. Recommendation pill + 2–3 sentence executive summary.
2. JD Alignment table (mandatory rows first, preferred rows after, fit chips).
3. Transferable Strengths (lead — evidence).
4. Interview Focus Areas (replaces "Gaps"/"Considerations").
5. Recruiter Observations (notes impact + closing paragraph).

Reuse the same component data already returned by `validate-candidate-fit`; no separate AI call.

---

## Technical Notes

- **DB**: new `job_jd_analysis` table (job_id PK, mandatory jsonb, preferred jsonb, transferable jsonb, seniority text, model_version text, created_at). Migration + GRANTs + RLS via tenant scope.
- **Schema additions to `ai_candidate_validations`**: `jd_classification jsonb`, `recruiter_notes_impact jsonb`, `language_sanitized boolean`.
- **Edge functions touched**: `validate-candidate-fit` (engine), new `analyze-job-requirements` (JD step, callable on demand + on job create/edit), `generate-submission-pack` (consume row only), `brand-cv` (consume row only). Delete `ai-match`.
- **Frontend touched**: `src/lib/recommendation.ts`, `RecommendationBadge`, `AIValidationCard`, `RediscoveredTalentSection`, `JobAIMatchSection`, `AIMatchPage`, submission/exec PDF components, client portal candidate views.
- **Language guardrail**: shared helper `_shared/recruiter-language.ts` used by validation + submission pack.
- **Caching**: keep canonical `match_score` (internal) for hard ceilings; never surface it.

## Out of Scope (Confirm Before Building)

- Re-training or fine-tuning models.
- Changing scoring math in `_shared/match-scoring.ts` (recalibrated last turn).
- Client-portal redesign beyond label/wording alignment.

---

Reply **approve** to proceed phase-by-phase, or tell me which phases to cut/reorder.
