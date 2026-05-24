# AI Talent Match — Interactive Recruiter Workflow Upgrade

Transform static AI match cards into a full recruiter command center via a premium right-side slide-over panel, without leaving the matching screen.

---

## Phase 1 — Clickable Card + Slide-Over Shell

- Make the entire `AITalentMatchSection` candidate card clickable (keyboard + mouse, full a11y).
- Create `CandidateWorkflowPanel.tsx` using shadcn `Sheet` (side="right"), width ~640px desktop / full-screen mobile.
- Panel sections (sticky header + scrollable body + sticky action footer):
  1. Profile header
  2. AI Match summary + "Why this match?"
  3. CV management
  4. Quick actions
  5. Pipeline controls
  6. Activity timeline
  7. Notes
- Smooth open/close animation (existing vaul/radix). Esc + overlay click to dismiss. Deep-link via `?candidate=<id>` query param so the panel survives refresh.

---

## Phase 2 — Profile Header + AI Match Transparency

- Header: avatar, name, current title, location, years exp, notice period, availability badge, recruiter owner, match circle + confidence badge.
- "Why this match?" expandable using `Collapsible`. Render per-factor bars from `sub_scores` JSONB (role 40%, skills 25%, industry 10%, seniority 10%, exp 10%, location 5%) with ✅ strengths / ⚠ gaps lists from `reasoning`.
- All semantic tokens — no hard-coded colors.

---

## Phase 3 — CV Management + Inline Preview

- Buttons: Preview Original, Download Original, Preview Branded, Download Branded.
- Inline viewer: signed URL from `documents` bucket rendered in an `<iframe>` (PDFs) or `<img>` (image CVs); fallback "Open in new tab".
- Branded CV uses existing `brand-cv` edge function + `useBrandedDownload` hook; cache generated URL in `candidates.branded_cv_url` to avoid re-generating.
- Log `cv_preview` and `cv_download` via `useRecruiterActivity`.

---

## Phase 4 — Quick Actions (Comms + Workflow)

Action grid:
- **AI Outreach Email** → existing `ai-compose-email` → `SendCandidateEmailModal`.
- **Send Email** → `SendEmailDialog` (already in `CandidateCard`).
- **WhatsApp** → `getWhatsAppUrl(phone, prefilledMsg)` opening `wa.me`. Prefilled template:
  `Hi {firstName}, we reviewed your profile for our {jobTitle} role at {agencyName} and would like to discuss this opportunity. — {recruiterName}`
  Log `whatsapp_initiated` activity with `{candidate_id, job_id, message_preview}`.
- **Schedule Interview** → reuse `CreateEventDialog` prefilled with candidate + job.
- **Assign Recruiter** → reuse `AssignJobDialog` pattern, scoped per-candidate-per-job.
- **Add Notes** → inline textarea → `candidate_notes` table.
- **Share with Client** → see Phase 6.

Agency-admin toggles (new `tenant_settings` flags): `clients_can_contact_candidates`, `whatsapp_recruiter_only`, `show_candidate_contact_to_clients`. UI in `SettingsPage` → Workflow tab. Gate WhatsApp & contact reveal based on role + flags.

---

## Phase 5 — Pipeline Actions (Inline)

- Inline stage selector reusing `CandidateStatusSelect`: New → Screening → Shortlisted → Interview → Offer → Placed / Rejected.
- "Add to Pipeline" if candidate isn't yet attached to this job (creates `job_candidates` row).
- Each transition logged to activity timeline + `recruiter_activities`.
- Optimistic UI; rollback on RLS failure.

---

## Phase 6 — Client Sharing Workflow

- "Share with Client" dialog:
  - Pick client(s) from the job's linked client.
  - Choose visible fields (toggle: contact details, salary, notes).
  - Generate branded PDF via `brand-cv`.
  - Email via `send-candidate-email` with branded attachment.
- Persist in new `candidate_client_shares` table for audit + client access logs.

---

## Phase 7 — Activity Timeline + Backend Audit

- New `ActivityTimeline` component reading from `recruiter_activities` filtered by `candidate_id` (+ optional `job_id`), grouped by day, icon per `action_type`.
- New activity types added to `useRecruiterActivity`: `cv_preview`, `cv_download`, `branded_cv_generated`, `whatsapp_initiated`, `candidate_shared_with_client`, `note_added`.
- Migration:
  - `candidate_client_shares` (tenant_id, candidate_id, job_id, client_id, shared_by, visible_fields jsonb, branded_pdf_url, created_at) + RLS.
  - `tenant_settings` columns: `clients_can_contact_candidates bool default false`, `whatsapp_recruiter_only bool default true`, `show_candidate_contact_to_clients bool default false`.
  - `candidates.branded_cv_url text`, `candidates.notice_period text`, `candidates.availability_status text` (only if missing).
- RLS: tenant isolation + role gates (owner/manager full, recruiter limited to assigned, clients read-only on shared rows).

---

## Files (created / edited)

**Created**
- `src/components/matching/CandidateWorkflowPanel.tsx`
- `src/components/matching/MatchExplanation.tsx`
- `src/components/matching/CVViewer.tsx`
- `src/components/matching/QuickActionsGrid.tsx`
- `src/components/matching/ActivityTimeline.tsx`
- `src/components/matching/ShareWithClientDialog.tsx`
- `supabase/migrations/<timestamp>_workflow_panel.sql`

**Edited**
- `src/components/matching/RediscoveredTalentSection.tsx` (card click → open panel)
- `src/hooks/useRecruiterActivity.ts` (new ActivityType union members)
- `src/pages/SettingsPage.tsx` (workflow flags)
- `src/lib/whatsapp.ts` (extend with templated message builder if needed)

---

## Technical notes

- Slide-over uses shadcn `Sheet` to stay consistent with existing dialogs.
- Inline PDF preview via signed URL (`supabase.storage.from('documents').createSignedUrl(path, 600)`) + `<iframe sandbox>`.
- WhatsApp uses existing `wa.me` deep-link util (no API/token).
- All scoring stays read-only from `rediscovered_matches.sub_scores` — no scoring logic changes.
- Mobile: `Sheet` becomes bottom drawer via `useIsMobile` → swap to `Drawer` from vaul.
- No new external dependencies.

Confirm and I'll start with Phase 1 (clickable card + slide-over shell) and Phase 7 migration so subsequent phases can write to the new tables.
