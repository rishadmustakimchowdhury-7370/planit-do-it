# Centralized OpenAI Talent Intelligence Engine

The validation engine already uses OpenAI (`gpt-4o`) directly — no Lovable AI Gateway. This plan consolidates ALL talent intelligence surfaces onto a single OpenAI-powered "Executive Recruiter Brain" with global industry, seniority and employment-type coverage, plus the evidence/strictness/transferability rules you specified.

## Phase 1 — Single Source of Truth: `_shared/validation-prompt.ts`
Rewrite the shared prompt so every surface uses the exact same logic:
- Persona: Senior Hiring Manager + Executive Search Consultant + Talent Intelligence Specialist (explicitly NOT an ATS / keyword matcher).
- Global coverage matrix: Tech, Banking & Finance, Commodities & Trading, Oil & Gas, Maritime, Aviation, Healthcare, Legal & Compliance, Sales & Marketing, HR, Supply Chain, Energy, Manufacturing, Government — and a generic fallback for any industry not listed.
- Seniority ladder: Intern → Graduate → Junior → Mid → Senior → Lead → Principal → Head → Director → VP → C-Level.
- Employment types: Permanent, Contract, Freelance, Consultant, Remote, Hybrid, Onsite, Temporary, Project-based — each with its own validation lens (e.g. contract = delivery velocity, permanent = retention/leadership scope).
- Three-step flow encoded in the prompt: JD analysis → CV analysis → Recruiter-notes analysis.
- Functional Ownership Detection (verbs like *led, owned, architected, executed, managed, delivered* vs *familiar with, exposure to, knowledge of*).
- Evidence classification (HIGH / MEDIUM / LOW) with hard caps.
- Match taxonomy: Direct / Adjacent / Transferable / Unrelated.
- Strict-industry list (Compliance, AML/KYC, Legal, Cybersecurity, Quant, Aviation Safety, Government Security, Medicine, Nuclear, Regulatory Risk) where transferable evidence can never produce Strong/Excellent/Highly Recommended.
- Negative-finding reframe vocabulary (no "weak/poor/unqualified").

## Phase 2 — Unified OpenAI Client: `_shared/openai-client.ts`
New helper used by every AI surface:
- Reads `OPENAI_API_KEY` once.
- `runRecruiterBrain({ jd, cv, recruiterNotes, mode })` — returns the canonical validation JSON.
- `transcribeAudio(file, language?)` — Whisper wrapper for voice notes.
- `runEmbedding(text)` — `text-embedding-3-small` wrapper for AI Match / Rediscovery.
- Centralized error mapping (rate-limit, quota, invalid key) so all callers surface the same toast.
- Model policy: `gpt-4o` for validation/reasoning, `gpt-4o-mini` for lightweight tasks (templates, chat suggestions).

## Phase 3 — Rewire All Surfaces to the Shared Brain
Replace ad-hoc calls in:
- `validate-candidate-fit` → calls `runRecruiterBrain` (already partial — finalize).
- `rediscover-candidates` → uses shared embedding + brain.
- `parse-cv` → keep parsing model but pull from shared client.
- `ai-compose-email`, `ai-generate-template`, `chatbot` → migrate to shared client + mini model.
- `transcribe-voice-note` → migrate to shared `transcribeAudio`.
- `generate-submission-pack` + executive PDF + Client Portal cards → read **only** from `ai_candidate_validations` (no second AI call), guaranteeing consistency across AI Match / Validation Modal / Submission Pack / PDF / Client Portal / Recruiter Dashboard.

## Phase 4 — Hard-Cap & Strict-Industry Post-Processor
In `validate-candidate-fit`:
- Detect strict industry from JD classification field returned by the brain.
- Apply caps (already partially implemented — extend):
  - Strict industry + transferable-only evidence ⇒ max `moderate_fit`.
  - Any mandatory MISSING ⇒ max `recommended`.
  - ≥30% mandatory missing ⇒ max `moderate_fit`.
  - ≥50% mandatory missing ⇒ max `limited_alignment`.
- Sanitize banned vocabulary before persisting.

## Phase 5 — Recruiter Notes + Voice Note Integration
- Persist transcribed voice notes to `recruiter_notes` (text) and feed both typed + voice into the brain under `recruiterNotes`.
- Notes can shift recommendation by **±1 band only**, never override the mandatory-evidence cap.
- Sync notes across AI Match, Validation Modal, Submission Pack, Executive PDF.

## Phase 6 — Reporting Layer Consistency
- Executive PDF + Submission Pack pull `summary`, `strengths`, `weaknesses`, `risks`, `recommendation`, `fit_score`, `sub_scores` directly from `ai_candidate_validations` / `rediscovered_matches`.
- Apply premium dark-blue branded template (already in place) — verify negative-finding language passes through the sanitizer.

## Phase 7 — QA Harness Update
Extend `ai-qa-runner` to cover:
- One scenario per major industry group (12+).
- Seniority drift (Senior applying for C-Level, Junior applying for Lead).
- Employment-type mismatch (Contract delivery for Permanent leadership role).
- Strict-industry transferable trap (Trader → Compliance, Risk → AML, Backend Dev → Cybersecurity).
- Voice-note influence test (±1 band only).
- Pass/fail metrics surfaced in `/admin/ai-qa`.

## Technical Notes
- Secret required: `OPENAI_API_KEY` (already configured — will verify with `fetch_secrets`).
- No schema changes; reuses `ai_candidate_validations`, `rediscovered_matches`, `recruiter_notes`.
- Frontend touched only where wording or data source changes (RecommendationBadge, AIValidationCard, SubmissionWorkspace) — no business-logic changes in UI.
- Backwards compatible: existing validations keep working; new fields are additive.

Approve and I'll implement Phases 1–7 in order.
