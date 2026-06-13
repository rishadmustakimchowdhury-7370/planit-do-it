# Entitlement Enforcement Layer — Implementation Plan

The catalog, matrix, hook, meters and Stripe sync are already in place. This plan adds **active enforcement** at both UI and server layers, using `get_tenant_feature(tenant_id, feature_key)` as the single source of truth.

## Phase 1 — Shared Primitives

**DB helper** (migration):
- `public.enforce_feature_limit(_tenant_id uuid, _feature_key text, _increment int default 1)` — `SECURITY DEFINER`. Calls `get_tenant_feature`. Raises `EXCEPTION 'FEATURE_LIMIT_EXCEEDED: <key>'` when `enabled=false` or `usage + increment > limit` (skipping when unlimited). Returns the entitlement JSON.
- `public.subscription_usage_log` table: `id, tenant_id, user_id, feature_key, delta int, action text, metadata jsonb, created_at`. RLS: owners/managers read own tenant; super_admin all; insert restricted to `service_role` + security definer functions.

**Client primitive** (`src/lib/entitlements.ts`):
- `assertFeature(tenantId, key, increment=1)` — RPC wrapper; throws `EntitlementError` with `{ feature, current, limit, planName }` for the upgrade modal.
- `<UpgradeRequiredDialog />` shared component (uses existing UI tokens) displaying current plan, usage, recommended plan (next tier from `subscription_plans` ordered by `price_monthly`).
- `useEnforceFeature(key)` returning `{ check, dialog }` to drop into any create flow.

## Phase 2 — Job Limits (`active_jobs`)

- **DB trigger** `jobs_enforce_limit_trg` BEFORE INSERT — when `status='active'`, call `enforce_feature_limit(tenant_id, 'active_jobs')`. Also on UPDATE when status transitions to active.
- **UI**: `NewJobDialog` / `JobsPage` "New Job" button — call `assertFeature` before submit. On error → show upgrade dialog, block submit.
- **Edge function** `create-job` (if present) — same RPC check before insert.

## Phase 3 — Team Member Limits (`team_members`)

- **DB trigger** on `team_invitations` INSERT and `profiles` INSERT (active members) — enforce.
- **UI**: `InviteUserDialog`, Team Management invite buttons — pre-check; disable button at 100%.
- **Edge function** `invite-team-member` — re-check before sending email.

## Phase 4 — Candidate Limits (`candidates`)

- **DB trigger** on `candidates` BEFORE INSERT.
- **UI**: Manual create dialog, CV upload, bulk import wizard — pre-check (CV import: check `count + files.length`).
- **Edge functions** `parse-cv`, `bulk-import-candidates` — check before insert loop.

## Phase 5 — AI Match Limits (`ai_matches_monthly`)

- **DB function** `consume_ai_match(_tenant_id, _user_id, _action)` — atomic: `SELECT ... FOR UPDATE`-style by inserting a usage row inside a transaction, then re-running `get_tenant_feature`. If exceeded → ROLLBACK + raise.
- **Edge functions** `ai-match`, `generate-client-report`, `ai-candidate-analysis` — call `consume_ai_match` first; abort with 402 on `FEATURE_LIMIT_EXCEEDED`.
- **UI**: AI Match button / Report generate button — pre-check + upgrade dialog on 402.

## Phase 6 — Feature Access (boolean gates)

Features: `finance_dashboard`, `invoice_management`, `recruiter_bonus_tracking`, `api_access`, `advanced_analytics`, `custom_branding`.

- **Routing**: new `<FeatureRoute featureKey="...">` wrapper in `src/App.tsx` routes — renders 403 page with upgrade CTA when `enabled=false`.
- **Sidebar**: filter menu items by `useEntitlement(key).canUse`.
- **Edge functions** touching these areas — guard with `enforce_feature_limit` (which also handles `enabled=false`).

## Phase 7 — Upgrade Prompts

Single `<UpgradeRequiredDialog />` reused from Phase 1 — shown:
- on blocked create flows (Jobs, Candidates, Invites, AI)
- on protected routes (full-page 403 variant)
- on usage meters ≥100% (link to dialog from existing `UsageMetersCard`)

Recommended plan = first plan whose limits for the blocked feature satisfy current usage + 1.

## Phase 8 — Audit Logging

Every `enforce_feature_limit` / `consume_ai_match` call writes a row into `subscription_usage_log` (success or blocked, with `action` = `blocked` / `consumed`). Super Admin gets a read-only view (Admin → Billing → Usage Log) — minimal table, not styled deeply.

## Phase 9 — Validation

Manual test matrix (documented in PR description):
- Starter tenant: create 11th job → blocked DB-side and UI-side; invite 3rd member → blocked; import 151st candidate → blocked; 51st AI match → blocked; visit `/finance` → 403.
- Pro tenant: limits at 25 / 5 / 500 / 200.
- Agency tenant: unlimited (limit_value NULL) → all pass.

## Deliverables

1. **Enforcement points**: jobs/candidates/invites/ai create flows (UI) + DB triggers.
2. **Backend validations**: `enforce_feature_limit`, `consume_ai_match`, triggers on `jobs`, `candidates`, `team_invitations`, `profiles`; edge function guards in `create-job`, `invite-team-member`, `parse-cv`, `bulk-import-candidates`, `ai-match`, `generate-client-report`, `ai-candidate-analysis`.
3. **Protected routes**: `<FeatureRoute>` for finance, invoices, bonuses, analytics, branding, api.
4. **Audit logging**: `subscription_usage_log` + super-admin read view.
5. **Test results**: matrix above.

## Scope notes / asks

- **Edge function list**: I'll guard only edge functions that already exist in the repo — please confirm if there are others you want covered.
- **Bulk operations**: bulk imports will fail-fast at the first row that exceeds the limit (no partial import). Confirm or switch to "import up to the limit then stop".
- **Existing tenants over limits**: enforcement is on *new* writes only; current over-limit data is left in place (no retroactive deletion). Owners simply can't add more until they upgrade or remove items.

Reply **approve** to proceed, or tell me which phases to skip / adjust.
