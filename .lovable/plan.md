# Recruiter Workflow Optimization Phase

Per project memory (planning-first), here is the 7-phase plan before any code is written. Scope is workflow speed, communication, premium UX, performance, mobile, AI restraint, and design language — building on the now-stable intelligence foundation.

---

## Phase 1 — Recruiter Speed Layer

Goal: minimize clicks; recruiter throughput first.

- `QuickActionsBar` component mounted on candidate row, shortlist row, submission row.
  - One-click: Validate, Shortlist, Submit, Reject, Note, Follow-up.
- Bulk action toolbar (multi-select checkboxes) on candidate list & shortlist:
  - bulk shortlist, bulk reject, bulk assign recruiter, bulk tag.
- Global keyboard shortcuts via a `useKeyboardShortcuts` hook:
  - `j/k` navigate, `s` shortlist, `v` validate, `e` email, `?` cheatsheet.
- Inline `QuickNoteInput` (no modal) — saves to `recruiter_notes`.
- Candidate fast-nav (prev/next) inside review drawer.

## Phase 2 — Communication Workflow Layer

Goal: embed comms inside the workflow surface — no context switching.

- New `CommunicationDrawer` accessible from any candidate/client row.
  - Tabs: Email, WhatsApp, Templates, AI Reply.
- `recruiter_message_templates` table (tenant-scoped) + admin editor reusing existing email-template editor pattern.
- Reuse existing SMTP infrastructure for email; new `send-recruiter-message` edge function.
- WhatsApp via existing Twilio gateway pattern (click-to-chat first; server-send only if recruiter explicitly toggles).
- AI-generated reply: new `recruiter-reply-suggest` edge function (gpt-4o-mini) returning 3 short variants, recruiter edits before send.
- Interview scheduling already exists (Events module) — surface "Schedule Interview" inline action.
- Follow-up reminders: `recruiter_followups` table + daily cron + in-app reminder bell.

## Phase 3 — Executive Submission Experience

Goal: elite presentation, recruiter-fast.

- Redesign `SubmissionWorkspace` with premium layout: candidate hero, recruiter positioning, client-safe summary, AI fit (subtle).
- New `SubmissionPreview` (client-view simulation) with one-click "Send to Client".
- Recruiter positioning editor inline (no modal).
- Confidential-by-default redaction toggle for client-facing fields.

## Phase 4 — Performance Optimization

Goal: keep OpenAI-heavy architecture snappy.

- Optimistic UI on Validate / Shortlist / Submit (rollback on error).
- React Query cache tuning: `staleTime` per resource; invalidation map.
- Queue-based validation: `validation_queue` table + background processor; UI shows "queued / running / done".
- Token optimization in `validate-candidate-fit`: trim prompt, drop redundant outcome memory when confidence already high.
- Result cache for AI validation keyed on `(job_id, candidate_id, profile_hash)` — 24h TTL.
- Route-level lazy loading audit; suspense fallbacks.
- Image/avatar lazy loading + Supabase signed-URL caching.

## Phase 5 — Mobile Recruiter Mode

Goal: recruiters operate from phone.

- `/m` mobile shell with bottom nav: Inbox · Jobs · Shortlist · Submissions · Comms.
- `MobileCandidateCard` — swipe right shortlist, swipe left reject.
- Mobile submission review (read-only premium card + Send button).
- Tap-to-call / tap-to-WhatsApp / tap-to-email.
- Respects existing RBAC + recruiter-only intelligence gating.

## Phase 6 — AI Fatigue Prevention

Goal: AI invisible until needed.

- Audit all AI badges/chips — collapse into a single `AIInsightChip` per row with hover/expand.
- Remove duplicate percentages; keep one source of truth (calibrated placement probability).
- Default `Show Recruiter Intelligence` toggle to OFF; persisted per recruiter.
- Replace badge spam with a subtle left-edge accent + tooltip.
- "Calm mode" preference: hides all confidence numbers, keeps actions.

## Phase 7 — Recruiter-First Design Language

Goal: executive-search software, not a dashboard.

- Tighten design tokens: reduce accent saturation, increase whitespace, refined typography scale.
- New component variants: `card-elite`, `button-executive`, `surface-quiet`.
- Replace generic dashboard widgets on landing recruiter view with workflow-centric panels: Today's Pipeline, Awaiting Client, Follow-ups Due, Submissions Out.
- Motion: subtle (150–200ms ease-out); no flashy animations.
- Empty states rewritten in recruiter voice ("No one waiting on you. Nice.").

---

## Technical notes

- New tables: `recruiter_message_templates`, `recruiter_followups`, `validation_queue`, `ai_validation_cache`. All RLS-gated by `tenant_id` + `auth.uid()`, with required `GRANT`s to `authenticated` + `service_role`. No `anon` access.
- New edge functions: `send-recruiter-message`, `recruiter-reply-suggest`, `process-validation-queue` (cron-driven), `dispatch-followup-reminders` (daily cron).
- Reuse existing OpenAI key + recruiter outcome memory; no Lovable AI Gateway (per memory).
- All currency stays USD; no new pricing surface.
- Strict tenant isolation preserved in all new RPCs and caches.

## Sequencing

Phases 1 → 6 → 7 deliver the most perceived value fastest (speed + calm + premium feel). Phase 2 is the largest; Phase 4 runs in parallel as quick wins. Phase 5 last.

## Out of scope

- No new pricing tiers or billing changes.
- No new intelligence models — this phase is workflow/UX, not AI capability.
- No client-facing portal changes.

Approve and I'll start with Phase 1 (Speed Layer) + Phase 6 (AI Fatigue) together, since they share the row/card components.
