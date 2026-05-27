# Talent Intelligence Workspace — Plan

Goal: turn the standalone AI Matching page into a recruiter copilot workspace that shares ONE validation engine with AI Validation, candidate cards, submission packs, executive PDF and client portal. Recruiter written + voice notes influence (but don't override) the AI decision, and validation reruns live.

---

## Phase 1 — Voice transcription backend

- New edge function `transcribe-voice-note` (Deno) that accepts a base64/audio Blob upload and returns text using **OpenAI `gpt-4o-mini-transcribe`** (re-uses existing `OPENAI_API_KEY`, no Lovable AI Gateway, per project memory).
- Validates auth (JWT in code), tenant binding, file-size cap (≤ 25 MB), mime allow-list (`audio/webm`, `audio/mp4`, `audio/mpeg`, `audio/wav`).
- Returns `{ text, language, duration_ms }`. Frontend keeps transcript editable before save.

## Phase 2 — Persist recruiter context (one source of truth)

Reuse existing structured recruiter notes table (`recruiter_notes` / `candidate_notes` already feeding the engine). Add:

- `voice_note_url` (optional, storage) and `voice_transcript` text column on the same row.
- Storage bucket `recruiter-voice-notes` (private, tenant-scoped RLS, recruiter-only read/write).

Single migration covers: column adds, bucket create, RLS, GRANTs.

## Phase 3 — Engine weighting (60 / 25 / 15)

Update `supabase/functions/validate-candidate-fit/index.ts` prompt + scoring contract:

- Explicit weighting block: 60% CV evidence, 25% recruiter context, 15% transferable inference.
- Recruiter notes can move the band by at most **one tier** (already enforced) — keep the guardrail; document the 25% influence in the system prompt.
- Continue passing `recruiter_notes_impact[]` sidecar so the UI can show which note moved the recommendation.
- Run all output strings through `softenLanguage` (already exists).

No change to `_shared/match-scoring.ts` (out of scope per prior plan).

## Phase 4 — Live re-validation hook

- Extend `useValidateCandidateFit` with a debounced `runDebounced(jobId, candidateId, { force:true })` (700 ms) wired to recruiter-notes and transcript edits.
- Invalidate React Query keys: `ai-validation`, `recruiter-notes`, `rediscovered-matches` so all surfaces (validation card, candidate card, submission preview) refresh together.

## Phase 5 — New `AIMatchPage` Talent Intelligence Workspace

Replace the current 2-column layout with a responsive 3-panel workspace (stacks on < lg).

```text
┌─────────────┬──────────────────────────┬────────────────┐
│ LEFT        │ CENTER                   │ RIGHT          │
│ Job select  │ Recommendation badge     │ Generate Exec  │
│ Cand select │ Executive Summary        │   Report (PDF) │
│ Recruiter   │ JD Alignment table       │ Generate       │
│  Notes      │ Transferable Strengths   │   Submission   │
│  (structured│ Interview Focus Areas    │   Pack         │
│   + free)   │ Considerations / Risks   │ Share w/Client │
│ Voice Notes │ Recruiter-impact chips   │ Save Insight   │
│  recorder + │ (which note shifted band)│ Re-run button  │
│  transcript │                          │                │
│ AI Memory   │                          │                │
│  (history)  │                          │                │
└─────────────┴──────────────────────────┴────────────────┘
```

Components (new, in `src/components/matching/workspace/`):

- `JobCandidatePicker.tsx`
- `RecruiterNotesPanel.tsx` (wraps existing `StructuredRecruiterNotesForm`)
- `VoiceNoteRecorder.tsx` (MediaRecorder → upload → transcribe → editable textarea)
- `AIContextMemory.tsx` (lists prior validations, recruiter-notes versions, transcripts)
- `ValidationCenter.tsx` (renders existing `RecommendationBadge`, mandate table, strengths/considerations from `useLatestValidation`)
- `WorkspaceActions.tsx` (re-uses existing submission-pack and exec-PDF generators — no new logic)

`AIMatchPage.tsx` becomes a thin composition + state container.

## Phase 6 — Wording + consistency sweep

- Replace any remaining "STRONG/EXCEEDS" badge labels in the new workspace with the 5-band taxonomy from `src/lib/recommendation.ts`.
- Every recruiter-facing string passes through the engine (already softens). UI hardcoded labels reviewed for: "lacks", "weak", "not qualified".

## Phase 7 — QA

- Manual: record voice → transcript appears → edit → save → recommendation re-runs within ~1 s.
- Sanity: same candidate now renders identical recommendation in AI Matching, AI Validation card, Talent Match list, submission pack header, executive PDF.

---

## Technical notes

- **Edge functions:** new `transcribe-voice-note`; edits to `validate-candidate-fit` (weighting prompt only).
- **DB migration (single):** add `voice_note_url`, `voice_transcript` to existing recruiter-notes row; create private storage bucket + RLS; required GRANTs.
- **Secrets:** uses existing `OPENAI_API_KEY` — no new secret prompt.
- **Out of scope:** changing scoring math in `_shared/match-scoring.ts`, client-portal redesign, multi-language transcript translation, real-time streaming STT (we transcribe on stop — simpler and cheaper).
- **Risk:** MediaRecorder mime support varies across browsers — we feature-detect and fall back to `audio/webm;codecs=opus` → `audio/mp4`.

Awaiting your approval before any code is written.