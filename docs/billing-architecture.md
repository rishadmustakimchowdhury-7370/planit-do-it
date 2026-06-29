# Billing Architecture — single source of truth

Everything in the billing system flows through the primitives below. Do not add
parallel logic, do not compute pricing on the frontend, do not hardcode plans.

## Primitives (one owner per concern)

| Concern                            | Primitive                                  | Type            |
| ---------------------------------- | ------------------------------------------ | --------------- |
| Promo validation + pricing math    | `public.validate_promo_code(...)`          | DB RPC          |
| Promo redemption                   | `public.record_promo_use(...)`             | DB RPC          |
| Promo ↔ Stripe sync                | edge `sync-stripe-coupons`                 | Edge Function   |
| Audit log writes                   | `public.write_audit_log(...)`              | DB RPC          |
| Workspace notifications            | `public.notify_workspace_owners(...)`      | DB RPC          |
| Audit + notify (billing)           | `public.notify_billing_event(...)`         | DB RPC          |
| Subscription state for UI          | `useSubscriptionStatus()`                  | React hook      |
| Usage limit checks                 | `useEnforceFeature()` / `useUsageLimits()` | React hooks     |
| Subscription banner                | `<SubscriptionStatusBanner/>` (in AppLayout) | React           |
| Stripe → DB state mutations        | edge `stripe-webhook`                      | Edge Function   |
| Checkout                           | edge `create-checkout`                     | Edge Function   |
| Customer portal                    | edge `customer-portal`                     | Edge Function   |
| Live promo validation (UI ↔ DB)    | edge `validate-promo` → RPC                | Edge Function   |
| Threshold notifications            | edge `usage-threshold-notifier` (cron)     | Edge Function   |
| Notification fan-out helper        | `_shared/billing-events.ts → notifyBillingEvent` | Shared module |

## Event flow

```text
                       Stripe                              App UI
                         │                                   │
              webhook events│                                   │
                         ▼                                   │
                ┌─────────────────┐                          │
                │ stripe-webhook  │── notifyBillingEvent ───▶│ in-app + email
                └────────┬────────┘                          │
                         │   updates tenants/subscriptions   │
                         ▼                                   │
                   public.tenants ◀── useSubscriptionStatus ─┤
                         ▲                                   │
                         │ realtime                          │
                         │                                   │
       cron ─▶ usage-threshold-notifier ─ notifyBillingEvent ─▶ notifications
```

## Rules

1. **No frontend pricing math.** All `original_amount`, `discount_amount`,
   `final_amount` come from `validate_promo_code` (jsonb).
2. **No hardcoded plans.** Plans, limits, features live in
   `subscription_plans` + `subscription_plan_features`.
3. **No duplicate subscription logic.** UI gating must use
   `useSubscriptionStatus`; quota checks must use `useEnforceFeature`.
4. **One notification path.** Edge functions call `notifyBillingEvent`; never
   insert directly into `notifications` for billing events.
5. **Stripe is the source of truth for state.** All mutations come from
   `stripe-webhook` (idempotent via `stripe_processed_events`).
6. **Stripe is the source of truth for discounts.** Promo codes are mirrored to
   Stripe via `sync-stripe-coupons`; checkout passes the Stripe promotion code
   when available so the Hosted Checkout, invoice, and subscription all show
   identical pricing.

## Verified flows

| Flow                       | Primitive owner                              |
| -------------------------- | -------------------------------------------- |
| Plan upgrade / downgrade   | `create-checkout` → `stripe-webhook`         |
| Trial start                | `create-checkout` (`trial_period_days`)      |
| Trial ending               | `stripe-webhook` (`customer.subscription.trial_will_end`) → `notifyBillingEvent` |
| Renewal                    | `stripe-webhook` (`invoice.paid`)            |
| Cancellation               | `cancel-subscription` → `stripe-webhook`     |
| Resume / Reactivation      | `customer-portal` → `stripe-webhook`         |
| Promo applied              | `validate-promo` → `create-checkout` → `record_promo_use` |
| Webhook idempotency        | `stripe_processed_events` table              |
| Invoice download           | `generate-invoice-pdf`                       |
| Usage reset                | `reset_usage_counters_for_period`            |
| Audit logs                 | `write_audit_log` (every flow above)         |
| Customer portal            | `customer-portal`                            |
