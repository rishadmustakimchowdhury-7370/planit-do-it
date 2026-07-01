# Dynamic Pricing Management System

Turn every pricing surface (Homepage, Billing Center, Checkout, Feature Gates, Usage Meters, Upgrade Dialogs) into a single database-driven system managed entirely by Super Admin.

## Current state (audit)

The project already has most of the plumbing — but it's fragmented across three overlapping tables and several hardcoded UI paths:

- `subscription_plans` — has `price_monthly`, `stripe_price_id_monthly`, `features` jsonb, `is_active`, `display_order`, trial columns. Missing: yearly price + Stripe yearly price ID, yearly trial, badge, button_text/url, highlighted, popular, enterprise, icon, color, currency, yearly_discount_percentage.
- `subscription_features` — master catalog (feature_key, feature_name, category, sort_order). Missing: description, icon, default_limit, unit, is_ai.
- `subscription_plan_features` — join (plan_id, feature_id, enabled, limit_value). Missing: monthly_limit, yearly_limit, unlimited, display_order, custom_label.
- Admin UI: `AdminPlansPage` + `EntitlementMatrix` exist but only cover a subset of fields.
- Homepage: `usePublicPricingPlans` reads DB but renders features from a hardcoded `features` jsonb array; no yearly toggle, no badges, no dynamic CTA.
- Feature gating: `useEntitlement` / `get_tenant_feature` RPC already reads DB — keep.
- Checkout: `create-checkout` reads `stripe_price_id_monthly` — extend to yearly.

## Plan

### Phase 1 — Database migration (single migration)

Extend, do not recreate. Preserve existing rows.

**`subscription_plans` — add columns:**
`yearly_price numeric`, `yearly_discount_percentage numeric`, `currency text default 'USD'`, `stripe_price_id_yearly text`, `yearly_trial_days int`, `badge text`, `button_text text default 'Get started'`, `button_url text`, `highlighted bool default false`, `popular bool default false`, `enterprise bool default false`, `icon text`, `color text`, `is_archived bool default false`. Rename intent: keep `price_monthly` + `stripe_price_id_monthly` (already present); add computed view aliases in code.

**`subscription_features` — add columns:**
`description text`, `icon text`, `default_limit numeric`, `unit text`, `is_ai bool default false`, `is_archived bool default false`.

**`subscription_plan_features` — add columns:**
`monthly_limit numeric`, `yearly_limit numeric`, `unlimited bool default false`, `display_order int default 0`, `custom_label text`. Backfill `monthly_limit` from existing `limit_value`.

**Realtime:** ensure all three tables are in `supabase_realtime` publication.

**Seed:** insert missing catalog features from the user's list that don't yet exist (idempotent `ON CONFLICT (feature_key) DO NOTHING`).

**RPC:** `get_public_pricing()` returns plans + enabled features + limits in one payload (public/anon readable, only non-archived + active).

### Phase 2 — Shared types & hooks

- `src/types/pricing.ts` — `PricingPlan`, `PlanFeature`, `PricingCatalogFeature` interfaces mirroring DB.
- `src/hooks/usePricingCatalog.ts` — single source of truth. Fetches via `get_public_pricing()` RPC, cached in react-query, invalidated via realtime channel on any of the 3 tables. Exports `{ plans, features, getPlanBySlug, getFeaturesForPlan }`.
- Refactor `usePublicPricingPlans` to delegate to the new hook (keep export for compatibility).
- `useEntitlement` / `useEntitlements` already DB-driven — no change.

### Phase 3 — Super Admin Pricing Management

Rewrite `src/pages/admin/AdminPlansPage.tsx` into a full-featured console:

- **Plans list** with drag-to-reorder (sort_order), inline toggles for active/popular/highlighted/enterprise/archived, duplicate, delete.
- **Plan editor drawer** — every field editable: name, slug, description, monthly & yearly price, yearly discount %, currency, Stripe monthly + yearly price IDs, monthly + yearly trial days, badge, button text, button URL, icon, color.
- **Feature matrix per plan** — rewrite `EntitlementMatrix` to expose: enabled toggle, unlimited toggle, monthly_limit, yearly_limit, custom_label, display_order. Grouped by category.
- **Catalog manager tab** — CRUD `subscription_features` (category, key, name, description, icon, unit, default_limit, is_ai, sort_order, archived).

All writes go through existing RLS (super_admin-only policies already enforced).

### Phase 4 — Homepage (fully dynamic)

Rewrite the pricing section of `src/pages/LandingPage.tsx` (and any `PricingComparisonMatrix` usage):

- Monthly/Yearly toggle (only shown if any plan has yearly_price).
- For each active, non-archived plan sorted by `sort_order`:
  - Icon + name + badge + description
  - Price (monthly or yearly/12 with "Save X%" chip)
  - Trial days line ("X-day free trial")
  - Dynamic features list from `plan_features` where `enabled=true`, sorted by `display_order`, showing `custom_label ?? feature.display_name` + limit ("Unlimited" | `${limit} ${unit}`)
  - CTA button uses `button_text` and routes to `button_url` (fallback `/checkout?plan=<slug>&interval=monthly|yearly`)
  - Highlighted/popular styling driven by flags
- Remove every hardcoded plan name, price, feature bullet.

### Phase 5 — Checkout, Billing, Feature Gates

- **`supabase/functions/create-checkout`** — accept `interval: 'monthly'|'yearly'`, resolve `stripe_price_id_monthly` or `stripe_price_id_yearly`, pass matching `trial_period_days`. Reject if the selected interval has no Stripe price.
- **`CheckoutPage`** — pass interval from query string.
- **Billing Center `SubscriptionTab`** — show current interval, allow switching monthly↔yearly using `change-subscription` edge function (already exists; extend to accept interval).
- **`UsageTab` / `useUsageLimits`** — read limits from `subscription_plan_features` for the tenant's plan+interval (fallback monthly). No hardcoded caps.
- **`UpgradeRequiredDialog`** — already reads plan data; wire to `usePricingCatalog` so recommended-plan copy is dynamic.

### Phase 6 — Cache & realtime

- Single react-query key `['pricing-catalog']` shared by all consumers.
- One realtime channel subscribes to `subscription_plans`, `subscription_features`, `subscription_plan_features` → `invalidateQueries`. Admin edits propagate to homepage/billing within ~1s.

### Phase 7 — Verification

- `tsgo` clean.
- Playwright: load `/`, assert plans render from RPC (mock a DB edit → confirm homepage updates without reload).
- Manual: create plan in admin → appears on homepage; toggle archived → disappears; edit limit → usage meter reflects.

## Technical details

- No breaking rename of existing columns — additive only, so live tenants keep working.
- `get_public_pricing()` is `SECURITY DEFINER`, `GRANT EXECUTE TO anon, authenticated`, returns JSON to avoid N+1 from the browser.
- Feature limit resolution order: `plan_feature.unlimited` → null cap; else `plan_feature.monthly_limit` (or `yearly_limit` if tenant on yearly); else `feature.default_limit`; else unlimited.
- Currency stored per-plan; homepage formats via `Intl.NumberFormat(locale, { style:'currency', currency: plan.currency })`.
- Stripe sync: admin UI shows a "Missing Stripe price ID" warning badge when price > 0 but no ID set; checkout blocks with a clear error rather than silently failing.

## Out of scope

- Auto-creating Stripe products/prices from the admin UI (user pastes IDs — matches current pattern in `stripe-pricing-ids-live` memory).
- Multi-currency conversion (single currency per plan).
- Per-tenant custom pricing overrides.
