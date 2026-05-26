# Submission Operating Workflow — Redesign Plan

Goal: Replace the current "Done" dead-end with a full **Submission Review & Delivery Workspace** that lets the recruiter preview, customize, combine, invite, and send — all without leaving the flow. Errors must never leak to the user.

---

## Phase 1 — Database & Storage (migration)

New columns on `candidate_submissions`:
- `recruiter_summary text`, `recruiter_strengths text[]`, `recruiter_considerations text[]`, `recruiter_recommendation text` — recruiter-edited overrides for AI content (PDF prefers these when present).
- `pack_components jsonb` — `{ ai_report: bool, branded_cv: bool, original_cv: bool, attachments: [{path,name}] }`.
- `pack_status text` default `'idle'` — `idle | generating | ready | failed`.
- `pack_error text` (internal only, never shown).
- `draft_state jsonb` — autosave snapshot.
- `sent_at timestamptz`.

New table `submission_pack_versions` (id, submission_id, version int, path, components jsonb, created_at, created_by) — every regenerate creates a new version; latest is shown.

Storage: ensure `submission-packs` bucket exists (private) + `submission-attachments` bucket for extra recruiter uploads.

RLS: tenant-scoped read/write for owner/manager/recruiter; client recipients read-only via existing `submission_recipients` join.

---

## Phase 2 — Edge function hardening (`generate-submission-pack`)

- Wrap entire handler in try/catch → always return `{ status: 'failed', user_message }` with **200** so the client never sees "non-2xx".
- Set `pack_status='generating'` immediately, return early with job id, then continue work (background-style). On finish, update `pack_status='ready'` + insert into `submission_pack_versions`.
- Accept `components` payload → only merges selected docs (AI report PDF + branded CV PDF + original CV PDF using `pdf-lib` merge).
- Use recruiter overrides if set, fall back to AI fields. Pull authoritative score from `rediscovered_matches` (already wired).
- Idempotent: if called twice, return latest ready version.

New edge function `merge-submission-pack` (optional thin wrapper) for re-combining without regenerating the AI report.

---

## Phase 3 — Frontend: rewrite `SubmissionWizard.tsx`

Keep steps 1–3 (Client / Validation / Notes). Replace step 4 with **`SubmissionWorkspace`** (full-screen dialog, split layout).

### Left pane — Live Preview
- Tabs: `AI Report` · `Branded CV` · `Original CV` · `Combined Pack`.
- `<iframe>` of signed URL for each artifact (PDF.js native preview gives zoom/scroll/page nav for free).
- Skeleton + spinner while `pack_status='generating'`. Poll `candidate_submissions` row every 2s via Supabase realtime/subscription.
- Toolbar: Download, Open in new tab, Regenerate.

### Right pane — Controls (accordion sections)
1. **Pack Composition** — 3 toggles (AI Report / Branded CV / Original CV) + "Rebuild Pack" button (calls merge function, updates preview).
2. **Edit AI Content** — inline editors for recommendation, summary, strengths (chip list), considerations (chip list). "Save & Regenerate" rebuilds the AI Report PDF only.
3. **Recruiter Message** — textarea (autosaves to `draft_state`).
4. **Client Recipients** — multi-select existing client users for this `client_org_id` + "Invite new contact" inline form (name/email/role) → reuses existing `invite-client-user` function, attaches as recipient on success.
5. **Portal Access** — per-recipient visibility toggle (job / candidate / submission scope), persisted to `submission_recipients`.
6. **Send Submission** — primary CTA at bottom. Disabled until ≥1 recipient + pack ready.

### Confirmation screen
On send success → replace workspace content with branded confirmation: submission ID, recipient list with avatars, sent timestamp, package summary (which docs included, # pages), and 2 CTAs: "Open Client Portal Preview" / "Track Submission".

---

## Phase 4 — Resilience & UX polish

- **Autosave**: every form change → debounced upsert to `candidate_submissions.draft_state`. On reopen, hydrate from draft.
- **Error handling**: all `supabase.functions.invoke` calls wrapped → toast shows friendly copy ("Package generation temporarily failed. Retry?") with a Retry button. Never surface raw error strings.
- **Background generation**: workspace opens immediately with skeleton; generation runs server-side; UI subscribes to status.
- **Activity logging**: every meaningful action (pack generated, recruiter edited content, CV attached, client invited, submission sent, viewed by client) inserts into `submission_activities` with the correct `actor_type` (now safe after the constraint fix).

---

## Phase 5 — Client notification & portal touch-ups

- On Send: invoke existing transactional email pipeline with a new template `submission-shared` (premium branded, candidate summary, recruiter note, secure review button → signed portal URL).
- Client portal already exists (`ClientSubmissionsPage`) — add the new tabs (AI Report / Branded CV / Original CV / Combined) mirroring recruiter preview, plus engagement actions (already partially present: approve / interview / reject) and view/download tracking insert into `submission_activities`.

---

## Phase 6 — Engagement tracking

Recipient events already partially logged. Add:
- `viewed_at`, `downloaded_at`, `last_action_at` on `submission_recipients` (migration).
- Realtime subscription on workspace right pane → live "Activity" mini-feed under recipients (e.g. "Sarah viewed · 2m ago", "Downloaded Combined Pack").

---

## Phase 7 — QA checklist

- Generate pack → preview renders in <5s, recruiter edits summary, regenerates, sees update.
- Toggle off Original CV → Combined Pack rebuilds without it.
- Invite brand-new client contact → appears in recipients list → email sent.
- Close & reopen wizard → draft restored.
- Force edge function failure → user sees friendly retry, no red error.
- Send → confirmation screen → client receives email → opens portal → recruiter sees "viewed" event live.

---

## Technical notes (for the agent)

- Use `pdf-lib` (already in `generate-submission-pack`) `PDFDocument.copyPages` for merging.
- Preview uses native browser PDF viewer in `<iframe src={signedUrl}>` — no extra deps.
- Realtime: `supabase.channel('submission:'+id).on('postgres_changes', ...)` on `candidate_submissions` row.
- Split layout: `ResizablePanelGroup` (already in ui kit).
- All new UI uses semantic tokens from `index.css` — no hardcoded colors.

No new secrets required. No new third-party packages required.