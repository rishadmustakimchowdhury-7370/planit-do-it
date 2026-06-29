# Commit 4 — Production Billing Foundation

Completes the billing foundation before Milestone B (Billing Portal + Invoice History). Everything stays database-driven; no hardcoded prices, plans, or discounts.

## 1. Live Promo Validation (BillingPage + CheckoutPage)

- Add a `PromoCodeInput` component (`src/components/billing/PromoCodeInput.tsx`) that:
  - Debounces input (400ms) and calls the existing `validate-promo` edge function.
  - Shows inline success/error messages (server-supplied `message`).
  - Renders a backend-calculated discount preview: original price, discount, new total.
  - Never computes the discount on the frontend — displays whatever `validate-promo` returns.
- Extend `validate-promo` to also return computed `original_amount`, `discount_amount`, `final_amount`, `currency` for the requested `planId`/`interval` so the preview is server-truth.
- Wire it into `CheckoutPage.tsx` (replacing any inline promo logic) and surface a compact preview block on `BillingPage` plan cards when a code is being entered.

## 2. Global Subscription Status Hook

- New `src/hooks/useSubscriptionStatus.ts` returning a single normalized object:
  `{ status, planName, trialEnd, renewalDate, pastDue, cancelled, suspended, gracePeriod, remainingTrialDays, remainingUsage }`.
- Source: one query joining `tenants` + `subscriptions` + `subscription_plans` + `subscription_usage_counters` (already populated by Commits 1–3). Live updates via Supabase realtime on `tenants` and `subscriptions`.
- New `src/components/billing/SubscriptionStatusBanner.tsx` (single component, all messages driven by the hook):
  - Payment failed (past_due)
  - Trial ending (≤ 3 days)
  - Renewal in N days
  - Usage near/at limit (per feature)
  - Suspended / cancelled
- Mounted once inside `AppLayout` so every protected page shows the right banner without duplicating logic.

## 3. Stripe Coupon Synchronization

- DB: add `stripe_coupon_id`, `stripe_promotion_code_id`, `last_synced_at`, `sync_status`, `sync_error` columns to `promo_codes`.
- New edge function `sync-stripe-coupons`:
  - Idempotent upsert into Stripe for each active promo code (creates/updates Coupon + Promotion Code).
  - Maps percentage vs fixed amount, duration (once/repeating/forever), max redemptions, expiry, plan restrictions (via `applies_to.products`), per-customer limit (stored as metadata; enforced by `validate_promo_code`).
  - Writes back `stripe_coupon_id` + `stripe_promotion_code_id`.
  - Audit-logs every sync.
- Trigger: called automatically from `AdminPromoCodesPage.tsx` on create/update, plus a manual "Sync to Stripe" button.
- `create-checkout`: when a validated promo has a `stripe_promotion_code_id`, pass `discounts: [{ promotion_code }]` to Stripe so the Hosted Checkout and invoice show the same discount. Falls back to current server-recorded discount when Stripe sync is unavailable.

## 4. Billing Notifications

- Reuse the existing `notify_workspace_owners` RPC (added in Commit 3).
- Extend `stripe-webhook/index.ts` to fan out notifications for: `payment_failed`, `payment_succeeded`, `trial_will_end`, `trial_ended`, `subscription_renewed`, `subscription_cancelled`, `subscription_suspended`, `subscription_reactivated`, `promo_applied`, `promo_expired`.
- New scheduled edge function `usage-threshold-notifier` (cron-ready, daily) that scans `subscription_usage_counters` and fires `ai_usage_almost_full`, `storage_almost_full`, `open_web_almost_full` at 80% / 95% / 100% thresholds (dedup via `notifications.metadata.threshold`).
- All events flow through one helper `_shared/billing-events.ts` so future providers (Slack, etc.) can be added in one place. Delivery = in-app `notifications` table + existing email pipeline.

## 5. Billing Consistency Audit

- Single source of truth document: `docs/billing-architecture.md` (one diagram, one event list, one ownership table).
- Code audit pass — remove any remaining inline discount math or hardcoded plan checks; centralize on:
  - `validate_promo_code` (RPC) for validation
  - `record_promo_use` (RPC) for redemption
  - `useSubscriptionStatus` for UI gating
  - `useEnforceFeature` for limit checks
  - `stripe-webhook` for state mutations from Stripe
- Verify each flow (upgrade / downgrade / trial / renewal / cancel / resume / promo / webhook / invoice / usage reset / audit / portal) hits exactly one of those primitives.

## 6. Final Verification

- Typecheck pass.
- Edge function smoke tests via `supabase--test_edge_functions` for `validate-promo`, `sync-stripe-coupons`, and `stripe-webhook` idempotency.
- Manual log review in `audit_log` + `webhook_logs` to confirm events fire once.

## Deliverables at the end
- Files changed (list)
- DB migrations (one: promo_codes Stripe columns + indexes)
- Edge Functions updated/added: `validate-promo`, `create-checkout`, `stripe-webhook`, `sync-stripe-coupons` (new), `usage-threshold-notifier` (new)
- Billing architecture summary
- Remaining production tasks
- Production readiness score

After this commit, Milestone B (Billing Portal + Invoice History) builds cleanly on top.
