# Phase 6 — Client Submission Pipeline & Kanban

## Current state (already shipped)
- DB: `candidate_submissions` (with full status enum incl. all 10 stages), `submission_activity`, `client_feedback_log`, `submission_recipients`.
- UI: `SubmissionStatusBadge`, `SubmissionPipelineBar`, `SubmissionActivityTimeline`, `SubmissionDetailDialog`, client-side `ClientSubmissionsPage`.
- Recruiter "Prepare For Client" wizard creates submissions and sets status (draft → prepared → submitted).

## Gap
No **recruiter-facing** pipeline dashboard. We have a per-job submissions tab, but no global Kanban board, no aggregated counters/metrics, no drag-and-drop, no manual feedback panel, no audit log of stage changes, no email-reply schema.

## Plan

### 1. DB migration (additive)
- Add columns to `candidate_submissions`: `email_replied bool default false`, `reply_date timestamptz`, `reply_summary text`.
- New table `submission_stage_audit` (id, submission_id, tenant_id, from_status, to_status, changed_by, changed_at, source text, note text) + RLS + grants.
- Trigger on `candidate_submissions` status change → insert into `submission_stage_audit` AND `submission_activity` (event_type `status_changed`).
- Trigger on `client_feedback_log` insert → append to `submission_activity` (event_type `client_feedback`).
- Helper RPC `set_submission_status(_submission_id, _to_status, _note)` that validates tenant membership and updates status (so client-side drag triggers fire via single call, captures actor).

### 2. Pipeline page (new)
`src/pages/ClientPipelinePage.tsx` at route `/pipeline` (sidebar entry "Client Pipeline"):
- Top counter row: Submitted / Viewed / Screening / Interview Requested / Interview Confirmed / Offer / Hired (live via realtime channel on `candidate_submissions`).
- Metrics strip: Total Submitted, Interview Rate, Offer Rate, Hire Rate (computed from current tenant filter).
- Filters: recruiter, client, job, date range.
- Kanban board: 10 columns (Submitted → Withdrawn), drag-and-drop using `@dnd-kit/core` (already installed via shadcn? confirm; otherwise `bun add @dnd-kit/core @dnd-kit/sortable`).
- Each card: candidate avatar+name, job title, client name, days-in-stage, last activity, status badge.
- Drag onto column → call `set_submission_status` RPC → optimistic update + toast.
- Click card → opens existing `SubmissionDetailDialog` (extended).

### 3. SubmissionDetailDialog upgrades
- New "Feedback" tab: list past `client_feedback_log` entries + form to log new feedback (interested / need_more_info / not_suitable / interview_requested / offer_pending / rejected + optional note). Insert via supabase; trigger pushes to timeline.
- New "Audit" sub-section in Activity tab pulling from `submission_stage_audit`.
- Existing Overview/Pack/Recipients tabs preserved.

### 4. Wire "Send to Client"
Verify `SubmissionWizard` / "Send to Client" action sets status to `submitted` and writes activity event (most likely already done; confirm and patch if not).

### 5. Sidebar nav
Add "Client Pipeline" link in `src/components/layout/Sidebar.tsx` (icon: Kanban/Columns).

### 6. Metrics per recruiter/client
On pipeline page, group view toggle: by recruiter, by client. Same metrics row recomputed for selected grouping. Pure client-side aggregation from loaded rows.

## Files
- New: `supabase/migrations/<ts>_submission_pipeline.sql`
- New: `src/pages/ClientPipelinePage.tsx`
- New: `src/components/clients/SubmissionKanban.tsx`
- New: `src/components/clients/SubmissionMetricsBar.tsx`
- New: `src/components/clients/ClientFeedbackPanel.tsx`
- Edit: `src/components/clients/SubmissionDetailDialog.tsx` (+Feedback tab, +Audit)
- Edit: `src/App.tsx` (route)
- Edit: `src/components/layout/Sidebar.tsx` (nav link)

## Out of scope
- Real email-reply ingestion (schema only, per spec).
- Changing the existing "Prepare For Client" report-creation wizard.

Confirm and I will proceed with the migration first, then UI.
