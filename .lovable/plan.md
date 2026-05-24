# Client Collaboration Portal — Implementation Plan

A lightweight **collaboration layer** on top of HireMetrics. Not a second CRM. Clients get a calm, premium workspace scoped to *only* what's shared with them. Internal users keep their existing dashboards and gain collaboration superpowers.

---

## Guiding Principles

- **Layer, don't fork** — reuse existing `jobs`, `candidates`, `job_candidates`, `events`, `email_*`, `notifications` tables. Add only what collaboration needs.
- **Zero-trust RLS** — every new table enforces tenant + share-scope at the database level. Clients can never see unrelated rows even with a forged request.
- **Contextual, not chat** — every conversation hangs off a candidate / job / interview. No free-form rooms.
- **One timeline of truth** — every action (share, view, feedback, interview, email, WhatsApp) writes to a unified `collaboration_activities` log.
- **Premium minimal UI** — slide-over panels, soft cards, Poppins, generous spacing. No clutter in the client sidebar (5 items max).

---

## Phase 1 — Roles, Invitations & Tenant Isolation (Foundation)

**Goal:** introduce external roles without disturbing internal RBAC.

- Extend `app_role` enum: add `client_user`, `hiring_manager`.
- New tables:
  - `client_organizations` (tenant_id, client_id → existing `clients.id`, name, branding)
  - `client_portal_users` (user_id, tenant_id, client_org_id, role, invited_by, status)
  - `client_invitations` (token-based, mirrors `team_invitations` pattern, 7-day TTL)
- Auth routing:
  - On login, if user has *only* `client_user` / `hiring_manager` role → redirect to `/client` route tree.
  - Internal users blocked from `/client/*`; client users blocked from everything else.
- Edge function: `invite-client-user` (sends branded invitation email via existing SMTP infra).
- RLS helpers (SECURITY DEFINER):
  - `is_client_user(uid)`, `client_org_for_user(uid)`, `client_can_see_job(uid, job_id)`, `client_can_see_candidate(uid, candidate_id)`.

---

## Phase 2 — Sharing Model (What Clients Can See)

**Goal:** explicit, auditable sharing. Nothing is visible by default.

- New tables:
  - `job_client_shares` (job_id, client_org_id, shared_by, shared_at, permissions jsonb)
  - `candidate_client_shares` (job_candidate_id, client_org_id, shared_by, status: shared/withdrawn, branded_cv_url, recruiter_summary, ai_insights_snapshot jsonb)
- Internal UI:
  - On `JobDetailPage` → "Share with client" action (selects client org, sets permissions).
  - On `CandidateWorkflowPanel` → "Share with client" button (snapshots AI match, recruiter summary, generates/links branded CV).
- RLS: client RLS on `jobs` / `candidates` / `job_candidates` reads through these share tables only.

---

## Phase 3 — Client Workspace Shell + Dashboard + Jobs + Candidate Slide-Over

**Goal:** the visible portal.

- Route tree under `/client`:
  - `ClientLayout` (own sidebar: Dashboard · Jobs · Candidates · Interviews · Notifications)
  - `ClientDashboardPage` — premium stat cards (active jobs, awaiting feedback, interview requests, recent updates) + upcoming interviews + activity stream
  - `ClientJobsPage` + `ClientJobDetailPage` — only shared jobs, pipeline summary, recruiter avatar
  - `ClientCandidatesPage` — aggregate view across all shared candidates, filter by job/status
  - `ClientCandidateSlideOver` — right-side panel (not page reload) with:
    - Header: name / title / location / AI match circle
    - Tabs: Overview · Branded CV · AI Insights · Feedback · Discussion · Interviews
    - Actions: Approve · Reject · Request Interview · Request More Candidates
- Design system: reuse existing tokens; add `--client-surface`, `--client-accent` for subtle differentiation. Poppins everywhere. Slide-overs via existing `Sheet`.

---

## Phase 4 — Feedback + Contextual Discussions

**Goal:** structured hiring conversations bound to an entity.

- New tables:
  - `candidate_feedback` (job_candidate_id, author_user_id, decision: approve/reject/request_more, notes, created_at)
  - `collaboration_threads` (subject_type: candidate|job|interview, subject_id, tenant_id, client_org_id)
  - `collaboration_messages` (thread_id, author_user_id, author_role, body, mentions uuid[], attachments jsonb)
- UI:
  - Inline threaded comments inside slide-over "Discussion" tab.
  - `@mention` picker (recruiter / manager / owner / client_user).
  - Internal users see same thread inside `CandidateWorkflowPanel` → new "Client Discussion" tab.
- Realtime: Supabase `postgres_changes` subscription on messages for the open thread.

---

## Phase 5 — Interview Workflow

**Goal:** end the back-and-forth.

- Extend existing `events` (interviews) table with:
  - `requested_by_client_user_id`, `client_proposed_slots jsonb`, `client_timezone`, `suggested_interviewers uuid[]`, `confirmation_status`.
- Client flow:
  - "Request Interview" → modal: propose 1–3 slots, timezone, notes, suggested interviewers.
  - Status badges on candidate slide-over Interviews tab.
- Recruiter flow:
  - Notification + inbox card on existing `EventsPage` showing "Pending client requests".
  - Confirm → reuses existing `send-event-invitation` edge function (ICS + branded email).
- All state changes log to `collaboration_activities`.

---

## Phase 6 — Notifications, Emails, WhatsApp, Activity Timeline

**Goal:** keep everyone in the loop, log everything.

- Unified `collaboration_activities` table:
  - actor_user_id, actor_role, action (enum), subject_type, subject_id, tenant_id, client_org_id, metadata jsonb, created_at
  - Written via SECURITY DEFINER `log_collab_activity(...)` helper from every relevant edge function & RPC.
- Notifications:
  - Reuse existing `notifications` table + `NotificationBell`; add new notification types: `candidate_shared`, `feedback_added`, `interview_requested`, `interview_confirmed`, `thread_mention`, `candidate_decision`.
  - Client-side `NotificationBell` variant inside `ClientLayout`.
- Email automation (new edge functions, each branded via existing template engine):
  - `notify-candidate-shared`, `notify-feedback-added`, `notify-interview-requested`, `notify-interview-confirmed`, `notify-thread-reply`, `notify-candidate-decision`.
- Email reply ingestion: optional client SMTP connect reuses existing `smtp_accounts` infra (scoped to `client_portal_users`).
- WhatsApp:
  - New `whatsapp_activities` table (initiator_user_id, candidate_id, job_id, type: candidate_msg / interview_coord, message_preview, opened_at).
  - Admin toggle on tenant: `client_whatsapp_mode` enum (`disabled` / `recruiter_only` / `client_allowed` / `approval_required`).
  - Existing `SendWhatsAppDialog` reused; new approval queue page for admins when mode = approval_required.
- Activity Timeline UI:
  - Inside client candidate/job slide-over: vertical timeline grouped by day.
  - Inside recruiter `CandidateWorkflowPanel`: full timeline including client actions.

---

## Phase 7 — Security Hardening, Audit, Mobile Polish, QA

**Goal:** enterprise-grade finish.

- Full RLS audit on every new table — write SQL tests covering: client_user from tenant A cannot see tenant B; client_user cannot see un-shared candidate in their own tenant; internal recruiter cannot see other tenants' threads.
- Add `audit_log` rows for sensitive actions (share, withdraw, role change, WhatsApp init).
- Rate-limit invitation + interview request edge functions.
- Mobile pass on `ClientLayout`, slide-overs, feedback forms, interview request modal (test at 375px).
- Empty-states + skeletons for every list/dashboard surface.
- Update `mem://` with new feature memory: `features/client-collaboration-portal`.

---

## Technical Notes (for the developer)

```text
NEW DB OBJECTS
  enums:        app_role += client_user, hiring_manager
                collab_action (candidate_shared, feedback_added, interview_requested, ...)
                whatsapp_mode (disabled|recruiter_only|client_allowed|approval_required)
  tables:       client_organizations, client_portal_users, client_invitations,
                job_client_shares, candidate_client_shares,
                candidate_feedback,
                collaboration_threads, collaboration_messages,
                collaboration_activities,
                whatsapp_activities
  rpc helpers:  is_client_user, client_org_for_user,
                client_can_see_job, client_can_see_candidate,
                log_collab_activity, share_candidate_with_client

NEW EDGE FUNCTIONS
  invite-client-user
  notify-candidate-shared
  notify-feedback-added
  notify-interview-requested
  notify-interview-confirmed
  notify-thread-reply
  notify-candidate-decision
  client-whatsapp-approve  (only if approval mode enabled)

NEW ROUTES
  /client                       ClientLayout
    /client/dashboard
    /client/jobs                /client/jobs/:id
    /client/candidates          (slide-over driven)
    /client/interviews
    /client/notifications
  /accept-client-invitation/:token
  internal-only: /admin/client-portal (per-tenant settings: WhatsApp mode, branding)

REUSED INFRA
  - existing SMTP send-email edge function + branded templates
  - existing notifications table + NotificationBell
  - existing events table for interviews
  - existing brand-cv + branded CV storage
  - existing rich-text-editor + Poppins setup
```

---

## Out of Scope (intentionally)

- Slack-style free chat rooms
- Public job board for clients
- Client-to-client visibility across orgs
- Billing changes (clients are seats under existing tenant plans — addressed later if needed)

---

**Estimated scope:** large but incremental. Each phase ships independently and is usable on its own. Phase 1–3 delivers a visible MVP; Phases 4–7 turn it into the differentiator.
