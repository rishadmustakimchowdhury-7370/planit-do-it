# Milestone B — Enterprise Billing Center

This is a large scope (13 sections across UI, edge functions, RPCs, admin). I'll ship it in 5 atomic commits so each lands in a working state. Existing billing primitives (`useSubscriptionStatus`, `SubscriptionStatusBanner`, `PromoCodeInput`, `useUsageLimits`, `notify_billing_event`, audit log) are reused — no redesign of working surfaces.

## Architecture

```text
/billing (Workspace Owner)
├── Overview      → dashboard cards, plan, usage snapshot, banners
├── Subscription  → upgrade / downgrade / cancel / resume / monthly↔yearly
├── Invoices      → history table + invoice drawer + PDF + Stripe link
├── Payment Method→ card brand/last4/exp + Stripe Portal launcher
├── Usage         → reuses UsageMetersCard + upgrade CTAs
├── Promo Codes   → applied promo + add new (uses validate-promo)
├── Timeline      → audit_log filtered to billing events
├── Notifications → in-app billing notifications feed
└── Details       → editable company/VAT/address/billing email

/admin/billing (Super Admin) — extend existing AdminBillingPage
├── Workspaces tab: per-tenant subscription, invoices, Stripe sync status
├── Webhooks tab : stripe_processed_events history
└── Actions     : resync, reset usage, manual invoice, suspend, reactivate
```

All pricing/discount math stays server-side (RPCs + Stripe). Frontend never computes prices.

## Commit 1 — Data layer

Migration:
- Add `tenant_billing_details` (company_name, billing_email, vat_number, tax_number, address_line1/2, city, region, postal_code, country, currency, timezone). RLS: owners read/write own tenant; service_role all. Includes GRANTs.
- RPC `get_billing_timeline(p_tenant_id, p_limit, p_offset)` — reads `audit_log` filtered to billing event types, returns normalized timeline rows.
- RPC `get_billing_notifications(p_tenant_id, p_limit)` — reads `notifications` where category in billing set.
- RPC `admin_billing_overview()` — super-admin only; returns per-tenant subscription + invoice totals + sync state.
- RPC `admin_resync_tenant_subscription(p_tenant_id)` — flags tenant for resync; audited.
- RPC `admin_reset_tenant_usage(p_tenant_id)` — zeroes `subscription_usage_counters` for current period; audited.

## Commit 2 — Edge functions

- `stripe-list-invoices` — list customer invoices with pagination/filters (returns number, date, amount, tax, discount, status, hosted_invoice_url, invoice_pdf, payment_intent).
- `stripe-get-invoice` — single invoice detail.
- `stripe-payment-method` — returns default PM (brand, last4, exp).
- `customer-portal` — confirm/extend existing one; ensure return_url=/billing.
- `change-subscription` — upgrade/downgrade and monthly↔yearly switch via Stripe Subscription Update; prorations enabled; audited via `notify_billing_event`.
- `cancel-subscription` / `resume-subscription` — cancel_at_period_end toggle; audited.
- `admin-stripe-resync` — pulls subscription from Stripe and rewrites tenant row; super-admin only.
- `admin-manual-invoice` — creates one-off Stripe invoice for a tenant.

All use shared `notifyBillingEvent` + `write_audit_log`.

## Commit 3 — Workspace Owner UI

- New `/billing` route with tabbed shell (`BillingCenterPage.tsx`) replacing existing `BillingPage` (keep route, redirect old links).
- Components in `src/components/billing/center/`:
  - `OverviewTab.tsx` — cards: Plan, Status, Next Renewal, Trial, Monthly Cost, Discount, Payment Status, Storage.
  - `SubscriptionTab.tsx` — plan switcher, billing cycle toggle, cancel/resume buttons.
  - `InvoicesTab.tsx` — TanStack table with pagination, search, status filter, PDF + Stripe link, row → drawer.
  - `InvoiceDetailDrawer.tsx`.
  - `PaymentMethodTab.tsx` — card display + Stripe Portal CTA.
  - `UsageTab.tsx` — wraps existing `UsageMetersCard` + per-feature breakdown.
  - `PromoTab.tsx` — applied promo + `PromoCodeInput` for new code.
  - `TimelineTab.tsx` — vertical timeline from `get_billing_timeline`.
  - `NotificationsTab.tsx`.
  - `BillingDetailsTab.tsx` — form bound to `tenant_billing_details`.
- Hooks: `useStripeInvoices`, `useStripePaymentMethod`, `useBillingTimeline`, `useBillingNotifications`, `useTenantBillingDetails`.
- Skeletons + empty states for every tab.

## Commit 4 — Admin extensions

Extend `AdminBillingPage`:
- Workspaces table (uses `admin_billing_overview`): plan, MRR, status, sync state, last webhook.
- Row actions: Resync, Reset Usage, Manual Invoice, Suspend, Reactivate (already exist for some — wire missing).
- Webhooks tab from `stripe_processed_events` joined with `webhook_logs`.
- All actions write audit log entries via existing RPC.

## Commit 5 — Polish & verification

- Wire `notify_billing_event` calls for: card updated (from `payment_method.updated` webhook), plan changed, promo applied, invoice paid/failed (confirm coverage).
- Responsive review at 360 / 768 / 1280.
- Playwright smoke: open `/billing`, switch tabs, open invoice drawer, click Manage Payment (asserts Stripe URL returned), apply promo (validates server response), cancel + resume toggles state.
- Update `docs/billing-architecture.md` with Billing Center map.

## Technical notes

- Stripe is source of truth for invoices/PMs; DB mirrors subscription state via webhook only.
- No card data ever touches our backend — payment method changes always route through Stripe Customer Portal.
- Currency formatting via `Intl.NumberFormat` with tenant currency from `tenant_billing_details`.
- All new tables follow `CREATE TABLE → GRANT → ENABLE RLS → POLICY` ordering.

## Out of scope (call out)

- Yearly Stripe prices: requires the user to create yearly `price_*` IDs in Stripe Dashboard and add them to `subscription_plans.stripe_price_id_yearly`. UI will show "Yearly unavailable" until present.
- Manual invoice line items beyond a single description+amount (v2).
- Tax ID validation against VIES (v2).

## Deliverable on completion

Files changed, migrations applied, edge functions deployed, manual Stripe setup list (yearly prices, webhook events to enable), and production readiness score.
