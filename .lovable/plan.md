# Subscription Feature Entitlement System

This is a large, cross-cutting build. Below is the plan I will execute on approval. Nothing is built yet.

## Phase 1 — Feature Catalog
New table `public.subscription_features`:
- `id uuid pk`, `feature_key text unique`, `feature_name text`, `description text`, `category text`, `sort_order int`, timestamps.
- Seed: `core_crm, ai_match, client_reports, client_pipeline, placement_tracking, invoice_management, finance_dashboard, recruiter_bonus_tracking, custom_branding, api_access, priority_support, email_templates, advanced_analytics`.
- RLS: `SELECT` for `authenticated`; write only `is_super_admin(auth.uid())`.

## Phase 2 — Plan ↔ Feature Mapping
New table `public.subscription_plan_features`:
- `plan_id uuid → subscription_plans`, `feature_id uuid → subscription_features`, `enabled bool`, `limit_value int null` (`null` = unlimited).
- Unique `(plan_id, feature_id)`.
- Seed rows for Starter / Pro / Agency per the matrix in the request.
- Numeric limits (`active_jobs`, `candidates`, `team_members`, `ai_matches_monthly`) stored as feature rows with `limit_value`; existing `subscription_plans.max_*` columns kept in sync via trigger so legacy code keeps working during rollout.

## Phase 3 — Auto Provisioning
- Existing `check-subscription` / `stripe-webhook` edge function path: on `checkout.session.completed` / `customer.subscription.updated`, resolve plan by Stripe price → set `tenants.subscription_plan_id`.
- Entitlements are derived (not copied), so "assignment" is automatic: any read of `get_tenant_feature` returns whatever the plan currently grants. No per-tenant feature rows needed.

## Phase 4 — Feature Enforcement
- New SECURITY DEFINER fn `public.get_tenant_feature(_tenant_id uuid, _feature_key text)` returns `{enabled, limit_value, usage, remaining}` (jsonb). Usage queries reuse current counters used by `get-usage-stats`.
- Client hook `useFeature(key)` wraps it; existing `useUsageLimits` refactored to call it.
- Guard rails added at write sites: AddJob, InviteTeamMember, AI Match button → block + show upgrade dialog when `remaining <= 0`.
- Server-side: edge functions `create-job`, `invite-team-member`, `ai-match` re-check via the same RPC (defence in depth).

## Phase 5 — Admin Management
- `AdminPackagesPage` gains two tabs:
  - **Features** — CRUD on `subscription_features` (name, key, description, category, sort).
  - **Plan Features** — matrix: rows = features, columns = plans, cells = `enabled` toggle + optional limit input. Inline save via upsert.
- Reorder via drag handle on Features tab → updates `sort_order`.
- All writes gated by `is_super_admin`.

## Phase 6 — UI (matrix + usage meters)
- Matrix UI as above (checkbox + optional number input per cell).
- `BillingPage`: usage meters card showing `used / limit` for jobs, candidates, team members, AI matches, reports generated, each with progress bar + upgrade CTA at ≥80%.

## Phase 7 — Tenant Entitlements
- Single helper `get_tenant_feature(feature_key)` is the only allowed entry point in app code. Internal lookups go through it.
- Convenience client wrapper `useEntitlement(key)` returns the same shape with React Query caching + realtime invalidation on `subscription_plan_features` change.

## Phase 8 — Usage Tracking
- Counters (same sources `get-usage-stats` already uses): active jobs, candidates, profiles (team), `ai_usage` rows this month, `client_submission_reports` rows this month.
- `BillingPage` and a new `UsageMetersCard` consume `get_tenant_feature` per key.

## Phase 9 — Stripe Sync
- On `customer.subscription.updated`:
  1. Update `tenants.subscription_plan_id`.
  2. Insert `audit_log` row `{action: 'plan_changed', from, to}`.
  3. No usage reset — historical usage preserved; only monthly-windowed counters naturally roll over.
- Entitlements automatically recalc because they're derived from `subscription_plan_features`.

## Deliverables you'll get
1. **Database schema** — 1 migration creating both tables, seed rows, RLS, GRANTs, `get_tenant_feature` RPC, audit trigger.
2. **RLS policies** — read-for-authenticated, write-for-super-admin on both tables; RPC is SECURITY DEFINER scoped to caller's tenant or super admin.
3. **Admin UI** — new Features + Plan Features tabs in `AdminPackagesPage`.
4. **Stripe webhook changes** — plan resolution + audit log entry in existing webhook function.
5. **Enforcement** — `useEntitlement` hook + guards in AddJob / TeamMembers / AI Match flows + matching server checks.
6. **Usage tracking** — `UsageMetersCard` on `BillingPage`, fed by `get_tenant_feature`.
7. **Migration plan** — backfill: existing tenants keep current `subscription_plan_id`; mapping table seeded so they immediately get correct entitlements. No data loss; legacy `max_*` columns kept until all call sites migrate.

## Technical notes
- `limit_value IS NULL` = unlimited (matches existing `-1` convention internally).
- All new tables get `GRANT SELECT ... TO authenticated` + `GRANT ALL ... TO service_role`; writes denied to `anon`.
- Currency / pricing untouched (USD per project memory).
- No changes to RBAC; super admin gate uses existing `is_super_admin()`.

Reply **approve** to proceed, or tell me what to adjust (e.g. skip server-side guards, defer the matrix UI, change seed limits).