# Milestone C — Production Billing Security & Audit Layer

Goal: make the billing backend production-safe. No UI redesigns. No changes to working flows except the wiring described below.

This is large. I'll ship it in **5 sequenced commits**, each independently verifiable. Each commit ends in a green typecheck + targeted test/Playwright check before the next starts.

---

## Commit 1 — DB foundation (single migration)

One migration creating the persistence backbone everything else writes to.

- `public.webhook_logs` (event_id PK, event_type, tenant_id, stripe_customer_id, stripe_subscription_id, status `received|processed|skipped|failed`, error text, processed_at, payload jsonb, created_at). RLS: super-admin SELECT only; service_role full. GRANTs per project rule.
- Extend `public.audit_log` only if columns are missing (ip_address, user_agent, old_values, new_values already exist per schema). Add index on `(tenant_id, created_at desc)` and `(action, created_at desc)` if missing.
- `public.write_audit_log(_action, _entity_type, _entity_id, _old, _new, _metadata)` SECURITY DEFINER RPC. Resolves tenant_id + user_id from `auth.uid()` / profile; service_role bypass allowed via optional `_tenant_id`/`_user_id` args. `search_path = public, pg_temp`.
- Promo validation RPC `public.validate_promo_code(_code, _plan_id, _interval)` returning `{ valid, reason, discount_type, discount_value, promo_id }`. Checks: active flag, start/expiry dates, max_uses vs `promo_code_uses` count, per-customer cap via `promo_code_uses.tenant_id`, plan applicability (`applicable_plan_ids` jsonb or `null`=all), interval eligibility.
- `public.increment_feature_usage` rewrite: single atomic `INSERT ... ON CONFLICT (tenant_id, feature_key, period_start) DO UPDATE SET usage = subscription_usage_counters.usage + EXCLUDED.usage` with `GREATEST(0, …)` clamp; returns new usage. Wrapped in `SECURITY DEFINER`, `search_path = public, pg_temp`. Adds unique index if missing.
- `public.reset_usage_counters_for_period(_tenant_id, _period_start, _period_end)` for renewal resets.
- `public.tenant_api_connections` add `last_tested_at timestamptz`, `last_status text`, `last_error text` if missing (used by Milestone D too, but the audit column lives here now).

## Commit 2 — Stripe webhook rewrite (`supabase/functions/stripe-webhook`)

Single rewrite, no behavioural surprises to existing happy path.

- Raw-body signature verification with `stripe.webhooks.constructEventAsync` + `STRIPE_WEBHOOK_SECRET` from `getStripeCredentials`.
- Idempotency: `INSERT INTO stripe_processed_events (id) VALUES (event.id) ON CONFLICT DO NOTHING RETURNING id`; if no row, log `skipped` to `webhook_logs` and 200.
- Per-event handlers (each in its own function, wrapped in try/catch):
  - `checkout.session.completed` → resolve tenant by `client_reference_id` or customer email; upsert `subscriptions`; record promo redemption in `promo_code_uses` if `discount` present; audit `checkout_completed`.
  - `customer.subscription.created|updated|resumed` → upsert `subscriptions` (status, price→plan_id, current_period_start/end, trial_end, cancel_at_period_end); update `tenants.subscription_status`, `subscription_plan_id`, `trial_ends_at`; on period change call `reset_usage_counters_for_period`; audit `subscription_updated`.
  - `customer.subscription.deleted` → mark `cancelled`; audit `subscription_cancelled`.
  - `customer.subscription.trial_will_end` → insert notification `trial_ending`; audit.
  - `invoice.created|finalized|upcoming` → log + audit, no state change.
  - `invoice.paid` → set tenant `past_due=false`; reset usage if new period; audit `invoice_paid`; notification.
  - `invoice.payment_failed` → set tenant `subscription_status='past_due'`, `past_due_since=now()`; audit `invoice_failed`; notification.
  - `payment_intent.succeeded` → log only.
- Every branch writes a `webhook_logs` row with final status + error.
- Returns 200 on handled-and-logged errors (so Stripe doesn't retry forever on app bugs), 400 on signature failure, 500 only on infra failure.

## Commit 3 — Promo + audit + API audit wiring

- New edge function `validate-promo` (auth-required) → calls `validate_promo_code` RPC and returns clean `{ valid, reason, discount }`. Wired into `CheckoutPage`/billing flow promo input (replace any client-only validation).
- `create-checkout` updated to call `validate_promo_code` server-side before creating the Stripe session; rejects with friendly error.
- `tenant-api-connection` edge function: on every save/test/remove, call `write_audit_log` with `apollo_connected|apollo_removed|...`, and update `last_tested_at`/`last_status`/`last_error`.
- Client-side audit hooks (thin): wrap existing create-job / create-client / create-candidate / invite-team / settings-updated mutations with a single `logAudit(action, entity, ids, old, new)` helper that calls `write_audit_log` RPC. No behaviour change, just an extra await on success.

## Commit 4 — Failed-payment + trial UX (minimal, no redesign)

- `useSubscriptionStatus` hook reading `tenants.subscription_status`, `trial_ends_at`, `past_due_since`. Derives `Active | Trial | TrialEndingSoon | PastDue | GracePeriod | Suspended | Cancelled` (Grace = 3 days after `past_due_since`, Suspended after 14 days).
- `<BillingStatusBanner>` (new, lightweight) mounted once in `AppLayout` above content. Renders only when status ≠ Active. Variants: warning (trial ending, past due, grace), destructive (suspended), info (cancelled at period end). Each has an "Update payment" CTA → existing `customer-portal` flow.
- `useEnforceFeature.guard` extended: if status === `Suspended`, block with the existing UpgradeRequiredDialog using a "Payment required" copy variant instead of "Limit reached". No data deletion anywhere.

## Commit 5 — Error envelope, error monitoring, verification

- Shared `supabase/functions/_shared/errors.ts` → `toClientError(err)` returns `{ code, message }` with stack stripped; `logBillingError(supabase, scope, err, context)` writes to `webhook_logs` (scope=`billing-error`) or a dedicated `billing_errors` view of `webhook_logs` filtered by status='failed'. All billing edge functions (`create-checkout`, `customer-portal`, `cancel-subscription`, `validate-promo`, `stripe-webhook`, `tenant-api-connection`) switched to this envelope.
- `src/lib/billingErrors.ts` → `toToast(err)` mapping to friendly strings; replaces raw `error.message` toasts in `BillingPage`, `CheckoutPage`, `ApiConnectionsPage`.
- Verification:
  - Deno tests for `stripe-webhook` covering: invalid signature → 400; duplicate event_id → skipped; subscription.updated → row upserted + audit + webhook_logs; invoice.payment_failed → tenant past_due; promo redemption recorded.
  - Deno test for `validate-promo` covering each rejection reason.
  - SQL test (via `supabase--read_query` after migration) for `increment_feature_usage` race: two parallel calls produce `usage=2`, not 1.
  - Playwright smoke: hit `/billing` while authed, confirm status banner hidden when active, confirm promo input rejects bad code with friendly toast.

---

## Out of scope (deferred to later milestones, per plan.md)
- Billing portal invoice history table → Milestone B.
- Workspace Usage dashboard polish → already shipped in Milestone A.
- `<NotificationBell>` template expansion → Milestone C-tail / Milestone D.
- Per-provider connection-test calls (Apollo `/auth/health` etc.) → Milestone D.

## Technical notes
- Webhook idempotency table `stripe_processed_events` already exists — reuse it.
- `audit_log` already exists with the right columns — no schema churn beyond indexes.
- `subscription_usage_counters` already exists — only the function + a unique index change.
- `tenants` already has `subscription_status`, `trial_ends_at` per schema; only `past_due_since` is new.
- All edge functions stay on `verify_jwt = false` (current convention) with in-code `getClaims` checks, except `stripe-webhook` which is public-by-design and gated by signature.

## Production readiness score (target after Commit 5)
- Webhook security: 10/10
- Idempotency: 10/10
- Audit coverage: 9/10 (manual mutations covered; bulk import covered by single batch-audit call)
- Failure UX: 9/10
- Counter safety: 10/10

## What I will NOT touch
- AI Discovery engines, CRM workflows, Finance, Placements, Sidebar, Landing page.
- The dynamic pricing schema (plans/features/plan_features) — unchanged.
- Existing entitlement enforcement wired in Milestone A.

---

**Approve to proceed.** I will ship Commit 1 (migration) first and pause for your verification before Commit 2.