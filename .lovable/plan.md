# Client Submission & Collaboration Workflow — Unified Build Plan

Phases 1–7 already shipped the foundation (auth, sharing, portal shell, discussions, interviews, notifications, branded sharing). This new plan **unifies them into one premium workflow** under a single "Client Submission" experience, and adds the missing pieces (Submission Pack, AI Validation, Status Pipeline, multi-contact orchestration, branded PDF, activity timeline, permission matrix).

No code will be written until you approve.

---

## Phase 1 — Data Model: Submissions as First-Class Objects

Today we have scattered tables (`candidate_client_shares`, `job_client_shares`, `interview_requests`, `candidate_discussions`, `candidate_feedback`). Phase 1 unifies them under one **`candidate_submissions`** entity — the spine of the whole workflow.

New tables / columns:
- `candidate_submissions` — id, tenant_id, job_id, candidate_id, job_candidate_id, client_org_id, status (enum below), submission_message, ai_validation_id, branded_cv_url, original_cv_url, pack_pdf_url, submitted_by, submitted_at, viewed_at, last_activity_at.
- `submission_status` enum: `draft → ai_validated → prepared → submitted → viewed → screening → interview_requested → interview_confirmed → final_review → offer → hired → rejected → withdrawn`.
- `submission_recipients` — links a submission to specific `client_portal_users` (multi-contact targeting + per-recipient view tracking).
- `submission_activity` — unified timeline events (created, viewed, feedback_added, interview_requested, status_changed, email_sent, note_added, document_downloaded).
- `ai_candidate_validations` — fit_score, strengths[], weaknesses[], risks[], recommendation (`strongly_recommended | needs_review | not_recommended`), summary, generated_at, model.
- `client_user_permissions` — per-client-user feature flags (view_pipeline, request_interviews, leave_feedback, send_messages, approve_reject, view_internal_notes).

Migration also backfills existing `candidate_client_shares` rows into `candidate_submissions` so nothing is lost.

RLS: strict tenant isolation for agency side; clients can only see submissions where `client_org_id = client_org_for_user(auth.uid())` AND a row exists in `submission_recipients` for them.

---

## Phase 2 — AI Validation Engine

Edge function `validate-candidate-fit`:
- Input: `job_id`, `candidate_id`.
- Pulls JD + candidate profile/CV, calls OpenAI `gpt-4o-mini` (per memory: no AI Gateway).
- Returns structured JSON → persisted in `ai_candidate_validations`.
- Deducts AI credits via existing `deduct_user_ai_credits`.
- Re-run supported (versioned).

UI: "Run AI Validation" button inside the new Client Submission tab. Result card shows fit score ring, color-coded recommendation badge, strengths/weaknesses/risks columns, recruiter-editable summary.

Gate: a submission cannot move past `ai_validated` without a validation record (configurable per tenant).

---

## Phase 3 — Submission Pack Builder + Branded PDF

New edge function `generate-submission-pack`:
- Generates a premium branded PDF combining: agency logo + colors (from existing branding), candidate header, AI validation report, recruiter assessment, strengths/considerations, recommendation, contact info masked per client permissions.
- Uploads to `submission-packs` storage bucket (private, signed URLs only).
- Stores URL on `candidate_submissions.pack_pdf_url`.

UI: `SubmissionPackBuilder.tsx` wizard inside the Job → Client Submission tab:
1. Select candidate (from pipeline) → 2. Run/review AI validation → 3. Attach branded CV + original CV (reuse existing `useBrandedDownload`) → 4. Write submission message → 5. Pick client org + specific recipients with role chips → 6. Preview pack → 7. Send.

Sending = insert `candidate_submissions` row, fan out `submission_recipients`, trigger notifications + email (reuse `send-email` function with new `submission_received` template).

---

## Phase 4 — Job Page Restructure (Unified Tabs)

Refactor `src/pages/JobDetailPage.tsx` to the requested tab structure:
- **Pipeline** (existing Kanban)
- **AI Match** (existing)
- **Client Submission** ← NEW central hub
- **Job Description** (existing)

The Client Submission tab contains:
- Top: submission status pipeline (horizontal stepper showing counts per stage for this job).
- Left: list of submissions for this job (filter by client org, status, recipient).
- Right: selected submission detail with sub-tabs **Overview · Documents · Feedback · Interviews · Activity · Discussion**.

Removes the current scattered "Share with Client" dialog as a primary entry — replaces with the wizard. Keeps the dialog accessible for quick legacy sharing but routes results through the same `candidate_submissions` table.

---

## Phase 5 — Multi-Contact Client Orgs + Permission Matrix

Inside `AdminClientPortalPage` and a new agency-side **Client Detail → Contacts** tab:
- Invite multiple contacts per client org with role presets: `Hiring Manager`, `HR Manager`, `Interview Panel`, `Decision Maker`.
- Each preset seeds default `client_user_permissions`; owner/manager can fine-tune toggles (matching the image: View pipeline / Request interviews / Leave feedback / Send messages — plus Approve/Reject and View internal notes).
- Resend invite, deactivate, reactivate, transfer ownership.
- New `ShareJobWithClientDialog` matches the uploaded mockup (Existing client / New client toggle, org name, contact email, role select, permissions checkboxes, Cancel / Share).

Client portal respects permissions at the UI level AND via RLS predicates wrapping `client_user_permissions`.

---

## Phase 6 — Client Portal Unification (Submission-Centric)

Restructure the client portal sidebar to match spec:
- Dashboard · Open Jobs · Submitted Candidates · Interviews · Discussions · Notifications.

`Submitted Candidates` becomes the headline page: card grid of submissions with status chip, AI recommendation badge, recruiter avatar, last activity timestamp. Clicking opens a full-screen submission viewer:
- Header: candidate name, role applied for, status pipeline indicator.
- Tabs: **Overview · AI Report · Branded CV · Original CV · Feedback · Interviews · Discussion**.
- Inline actions (permission-gated): Approve, Reject, Request Interview, Leave Feedback, Message Recruiter, Download Pack.

All actions write to `submission_activity` so the timeline stays the single source of truth.

Mobile: every page uses responsive flex/grid; slide-overs collapse to full-screen sheets under `md:`.

---

## Phase 7 — Activity Timeline, Notifications & Communication Hub

- **Unified Activity Timeline** component (used on both agency and client side) reading `submission_activity` in real time via Supabase channels. Icons + relative timestamps + actor avatars.
- **Notification triggers** (DB): extend existing `notify_*` triggers to also emit on submission status change, recipient view, document download, approve/reject, feedback submitted. Routed to recipients per `client_user_permissions` and recruiter assignment.
- **Email templates**: `submission_received`, `submission_viewed`, `feedback_received`, `interview_requested`, `interview_confirmed`, `candidate_approved`, `candidate_rejected` — branded via existing email branding system.
- **Comms hub** on the submission detail: tabs for Email history (existing `email_messages`) and WhatsApp (existing `whatsapp` lib), all scoped to the submission. Agency admins toggle which channels clients may use via tenant-level setting `client_allowed_channels`.
- Final pass: audit logs entry for every cross-tenant action, signed-URL enforcement on all CV/pack downloads, RLS regression check.

---

## Technical Notes

- Stack: existing React 18 + Vite + Tailwind + shadcn + Supabase. No new deps except `pdf-lib` (already used via `generate-jd-pdf` pattern) for the submission pack.
- Reuses: `useBrandedDownload`, `useClientOrgBranding`, `dispatch-notification`, `send-email`, `getAppBaseUrl`, existing notifications table.
- No manual KPI entry — every workflow action logs to `recruiter_activities` so KPIs auto-derive (per core memory).
- All currency/billing untouched.
- ~5 migrations, ~3 new edge functions, ~25 new/edited React files.

---

## Suggested Build Order

1. Phase 1 migration (foundation) — must land first.
2. Phase 2 (AI validation) — unblocks the pack.
3. Phase 3 (pack + PDF) — unblocks the wizard.
4. Phase 4 (job page tabs) — surfaces it.
5. Phase 5 (multi-contact + permissions) — productionizes sharing.
6. Phase 6 (client portal unification) — closes the loop for clients.
7. Phase 7 (timeline + notifications + comms) — polish + enterprise feel.

Reply **"approved, start phase 1"** (or name a phase) and I'll begin. Anything to tweak before I do?