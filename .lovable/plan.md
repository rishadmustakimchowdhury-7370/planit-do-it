# Phase 2 — Production Readiness Plan

This is a very large scope (16 workstreams, dozens of features). Shipping it as one giant commit will be unreviewable and risky. I'll execute it in **5 sequential milestones**, each independently shippable and verifiable. After each milestone you can test and approve before I move on.

I will NOT touch working flows (AI Discovery engines, CRM, Finance, Placements, Auth, Sidebar) except to wire enforcement hooks and polish empty/loading states.

---

## Milestone A — Enforcement Backbone (foundation everything else builds on)

Goal: every gated feature checks entitlements + records usage in ONE consistent way.

- New `src/lib/enforce.ts` — single `enforceFeature(featureKey)` helper that:
  - Reads live `get_tenant_feature` RPC (already exists).
  - Throws typed `LimitReachedError` with `{ used, limit, remaining, featureKey }`.
  - Calls `increment_feature_usage` on success.
- New `<UpgradeRequiredDialog>` already exists — extend it to render usage stats (used / limit / remaining) passed by the error.
- Hook `useEnforceFeature` returns `{ guard, dialog }` so any page wraps its action in `await guard('ai_candidate_search')`.
- Wire enforcement into the action entry points (no logic changes to engines themselves):
  - AI Candidate Discovery, AI Prospect Search, Open Web Discovery
  - AI Matching, Resume Parsing, Executive Assessment, AI Email Generation
  - CSV Import / Export / Bulk Upload, Reports export
  - Create Job, Add Candidate, Add Client, Invite Team Member (count-based)
- Seed any missing rows in `subscription_features` + `subscription_plan_features` for the keys above (migration).

## Milestone B — Workspace Usage Dashboard + Billing Portal

- `src/pages/UsagePage.tsx` (route `/usage`): live grid of all meters from `get_tenant_feature`, progress bars, warning thresholds (80/100%), realtime subscription on `subscription_usage_counters`.
- Upgrade `src/pages/BillingPage.tsx`:
  - Current plan card (interval, next renewal, status, payment method last4).
  - Invoice history table (`stripe-list-invoices` edge fn → Stripe API).
  - Buttons: Upgrade, Downgrade, Cancel, Resume, Update card, Update billing details — all route through `customer-portal` edge fn (already exists) or dedicated flows.
- New edge fn `stripe-list-invoices` (read-only, customer-scoped).

## Milestone C — Stripe Webhook Hardening + Promo + Audit Logs + Notifications

- Rewrite `stripe-webhook` to:
  - Verify signature with `STRIPE_WEBHOOK_SECRET`.
  - Idempotency via existing `stripe_processed_events` table (insert-or-skip on `event.id`).
  - Handle: `checkout.session.completed`, `customer.subscription.updated|deleted|trial_will_end`, `invoice.paid|payment_failed`, `customer.subscription.resumed`.
  - Reset `subscription_usage_counters` on renewal period change.
  - Write to `subscription_events` + `notifications`.
- Promo validation RPC `validate_promo_code(code, plan_id, interval)` → returns `{ valid, reason, discount }`. Checks expiry, max_uses, per-customer in `promo_code_uses`, plan applicability, interval.
- Universal audit logger `write_audit(action, target, metadata)` RPC. Wire into: subscription change, promo create/use, API connect/remove, invite, invoice gen, client/candidate/job create, settings change. Re-use existing `audit_log` table.
- `<NotificationBell>` already exists — extend backing table coverage: trial-ending, payment-failed, promo-applied, API-disconnected, storage-full, limit-reached, invite-accepted. Mark-read + archive actions.

## Milestone D — API Connection Health + Email Automation + FAQ + Admin Analytics

- Extend `tenant-api-connection` with `test` action per provider (Apollo `/auth/health`, Lusha `/v2/person`, Vibe ping). Store `last_tested_at`, `last_status` on `tenant_api_connections`.
- `src/pages/settings/ApiConnectionsPage.tsx`: status badge (Connected/Invalid/Expired/Disconnected), Test, Reconnect, Remove. Never render the encrypted key.
- App emails (uses existing transactional email infra): trial-started, trial-ending, sub-created, payment-success, payment-failed, sub-cancelled, upgrade-success, invoice-created, invitation-accepted, password-changed. Triggered from webhook + RPCs.
- FAQ: new `faqs` table (id, category, question, answer, sort_order, published). Admin CRUD page `/admin/faqs`. Landing page loads `published=true` ordered.
- Super Admin analytics `/admin/analytics`: MRR, ARR, trial vs paid counts, active workspaces, plan distribution, churn (from `subscription_events`), top customers (by usage).

## Milestone E — Workspace Health + Performance + UX Polish + Final QA

- `workspace_health_score(tenant_id)` RPC returning 0-100 + tier (Excellent/Good/Warning/Needs Attention). Surfaced on Admin Workspaces list + tenant Settings header.
- Performance: lazy-load route chunks (verify `React.lazy` everywhere in `App.tsx`), add `<Skeleton>` to remaining pages, paginate Candidates/Clients/Jobs lists if not already, add `react-window` to any list >200 rows.
- UX polish pass: standardize Card padding (`p-6`), shadow (`shadow-sm`), radius (existing `--radius`), button sizes; consistent empty-state component `<EmptyState>`; toast success/error standardization.
- Final QA: Playwright smoke covering Checkout → Webhook → Usage increment → Limit reached → Upgrade modal → Stripe portal → Cancel → Resume.

---

## What I will NOT do
- Redesign sidebar, landing page, or any working CRM/Finance/AI engine UI.
- Refactor auth, RLS architecture, or the dynamic pricing schema you just approved.
- Re-introduce features already removed (LinkedIn scraping, plaintext API keys in DB, etc.).

## Technical notes
- All limits resolved via existing `get_tenant_feature(_tenant_id, _feature_key)` RPC.
- All counters via existing `increment_feature_usage` RPC.
- All Stripe state via `stripe-webhook` → `subscriptions` / `subscription_events`.
- Webhook idempotency: existing `stripe_processed_events(id PK)`.
- Audit + notifications: existing `audit_log` and `notifications` tables.
- App emails: existing transactional email infrastructure — new templates only.

## Estimated size
- Migrations: ~6 (feature seed, faqs, validate_promo, write_audit, workspace_health, api_conn columns).
- Edge functions: ~3 new (stripe-list-invoices, validate-promo wrapper, api-connection-test) + 1 rewrite (stripe-webhook).
- New pages: Usage, FAQ Admin, Admin Analytics. Updated pages: Billing, API Connections, Notification Bell.
- New components: EmptyState, LimitReachedDialog (extension), HealthScoreBadge.

---

**Recommended:** approve this plan, then I'll ship **Milestone A** first (the enforcement backbone — highest leverage, unblocks every other limit-related item). After you verify limits work end-to-end, I'll proceed to B → C → D → E.
