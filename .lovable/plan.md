# Dynamic SaaS Pricing & Subscription System

This is a large, multi-area build. Per project memory ("Planning-first: provide a detailed 7-phase plan before any code"), here is the plan. I will only start coding after you approve.

A lot of the foundation already exists in HireMetrics: `subscription_plans`, `subscription_features`, `subscription_plan_features`, `plan_features`, `promo_codes`, `subscriptions`, `apollo_integrations`, `candidate_source_integrations`, `useEntitlement`/`useEntitlements`, `EntitlementMatrix`, Stripe edge functions (`cancel-subscription`, `_shared/stripe-credentials`), `BillingPage`, `usePublicPricingPlans`, `PricingComparisonMatrix`. The work is mostly **wiring + admin UI + new features + audit/cleanup**, not greenfield.

---

## Phase 1 — Schema reconciliation & seed (DB only)

Goal: one canonical source of truth for plans, features, limits, and usage.

1. Audit existing tables and pick canonical set:
   - Plans: `subscription_plans` (add missing columns: `price_yearly`, `trial_days`, `is_featured`, `cta_label`, `stripe_product_id`, `stripe_price_id_monthly`, `stripe_price_id_yearly`, `currency` default `'USD'`).
   - Feature catalog: `subscription_features` (add `unit`, `category`, `show_on_pricing_page bool`, `is_addon bool`).
   - Plan↔feature limits: `subscription_plan_features` (ensure `enabled`, `unlimited`, `limit_value`, `monthly_reset bool`).
   - Deprecate/merge `plan_features` into above (data migration, keep view for back-compat).
2. New table `subscription_usage_counters(tenant_id, feature_key, period_start, period_end, used int)` with unique `(tenant_id, feature_key, period_start)`. Plus RPC `increment_feature_usage(_feature_key, _amount)` that upserts the current billing period row.
3. Seed the three plans (Starter $25 / Pro $49 / Enterprise $99) and the full feature catalog from your spec (AI Discovery, Prospect Search, Matching, Open Web, Resume Parsing, Executive Assessment, Email Gen, Storage, Users, Candidates, Clients, Jobs, plus boolean features). Idempotent upsert by `slug`/`feature_key`.
4. GRANTs + RLS: read on plans/features = `anon`+`authenticated`; usage counters = tenant-scoped via `has_role`/`user_belongs_to_tenant`; write paths only via security-definer RPCs.

## Phase 2 — Customer API connections (Apollo / Lusha / Vibe)

Goal: per-tenant encrypted storage of *their* provider keys. HireMetrics-owned AI keys stay in edge-function env (`OPENAI_API_KEY`, `LOVABLE_API_KEY`) and never leave the server.

1. Table `tenant_api_connections(tenant_id, provider enum['apollo','lusha','vibe'], api_key_encrypted text, status, last_tested_at, last_sync_at, usage_count, created_by, updated_at)` — unique `(tenant_id, provider)`.
2. Encryption via pgsodium / pgcrypto with a server-side key (Supabase Vault secret). Decryption only inside security-definer RPC `get_tenant_api_key(_provider)` callable by edge functions (service role).
3. Reuse existing `apollo_integrations` + `candidate_source_integrations` — migrate to the new unified table, keep compatibility shims.
4. Edge function `test-tenant-api-connection` (per provider) returns health status; never echoes the key.
5. Frontend: new Settings page `API Connections` with Connect / Test / Disconnect / health badge / last sync / usage. Role-gated to Owner/Manager.

## Phase 3 — Entitlement enforcement & usage tracking

Goal: every metered AI/data action checks + increments usage atomically.

1. Extend `src/lib/entitlements.ts` + `useEntitlement` to cover all new feature keys (`ai_candidate_discovery`, `ai_prospect_search`, `ai_matching`, `open_web_discovery`, `resume_parsing`, `executive_assessment`, `ai_email_generation`, `storage_gb`, plus existing `active_jobs`, `candidates`, `clients`, `team_members`).
2. Edge functions for each metered action wrap their work in: `assert_feature` → run → `increment_feature_usage`. Wrappers added to: `ai-candidate-search`, `open-web-candidate-discovery`, `open-web-client-discovery`, `parse-cv`, `ai-match-*`, `executive-assessment`, `send-*-email`.
3. Frontend `useUsageLimits` rewritten to read from `subscription_usage_counters` (live) via realtime channel; powers a `UsageMetersCard` showing all metered features (`18 / 50` style).
4. Monthly reset: scheduled `pg_cron` job rolls counters at billing period boundary; on Stripe `invoice.paid`, also reset.

## Phase 4 — Super Admin Subscription Management UI

Goal: edit everything without code.

1. New routes:
   - `/admin/billing/plans` — list/create/edit plans (Name, Monthly/Yearly price, Trial days, Display order, Featured, Status, Currency, Description, CTA, Stripe Product/Price IDs).
   - `/admin/billing/features` — feature catalog editor (key, label, category, unit, show_on_pricing, is_addon).
   - `/admin/billing/matrix` — per-plan × per-feature grid: Enabled / Unlimited / Monthly limit / Visible on pricing.
   - `/admin/billing/promo-codes` — full CRUD (already partly built — extend with applicable_plans, monthly/yearly toggle, per-customer limit, expiry).
2. All writes via security-definer RPCs gated by `is_super_admin()`. All edits are reflected on `/pricing` instantly (already realtime-subscribed in `usePublicPricingPlans`).

## Phase 5 — Stripe lifecycle (full)

Goal: verified upgrade / downgrade / cancel / resume / renew / trial / failed payment / proration / promo.

1. Edge functions (create or harden):
   - `create-checkout-session` — supports monthly/yearly toggle, promo code, trial days from plan, success/cancel URLs.
   - `create-customer-portal` — returns portal URL.
   - `cancel-subscription` (exists) + `resume-subscription`.
   - `stripe-webhook` — verifies signature, handles: `checkout.session.completed`, `customer.subscription.created/updated/deleted`, `invoice.paid`, `invoice.payment_failed`, `customer.subscription.trial_will_end`. Idempotent via `processed_events` table.
2. On webhook: upsert `subscriptions` row, update `tenants.subscription_status` + `current_plan_id` + `current_period_end`, reset usage counters on renewal, mark `past_due` on failed payment.
3. Promo codes validated against Stripe Coupons; Super Admin "Sync to Stripe" button creates/updates the Stripe coupon from local promo row.

## Phase 6 — Public pricing page wiring

Goal: pricing page is 100% DB-driven, no hardcoded numbers.

1. `usePublicPricingPlans` already reads DB — extend to include yearly price, trial days, featured, CTA, and the feature comparison matrix filtered to `show_on_pricing_page = true`.
2. Add Monthly/Yearly toggle, "Most popular" badge from `is_featured`, dynamic CTA, promo code input that hits `validate-promo-code` and reflows price.
3. `PricingComparisonMatrix` already exists — replace `LIMIT_KEYS`/`PREMIUM_KEYS` constants with DB-driven `unit`/`is_addon` columns.

## Phase 7 — QA, security audit, cleanup

1. Smoke: signup → trial → checkout (Starter monthly w/ promo) → upgrade Pro yearly → hit limit → upgrade triggers reset → cancel at period end → resume → failed payment → reactivate.
2. Verify each metered AI action increments the right counter and blocks at limit with `EntitlementError` UX.
3. Security: confirm `tenant_api_connections.api_key_encrypted` is never returned via PostgREST (column REVOKE + RPC-only); webhook signature enforced; no plaintext keys in logs; RLS on every new table; `service_role` grants only where needed.
4. Remove now-dead constants (any hardcoded plan limits, hardcoded price strings).
5. Run `supabase--linter` + `security--run_security_scan`; zero new criticals before publish.

---

## Open questions before I start (please answer in your reply)

1. **Customer API keys — encryption backend.** Use Supabase Vault (pgsodium-managed) or store ciphertext encrypted by an edge-function `APP_ENCRYPTION_KEY` secret? Vault is cleaner but requires the extension; the secret approach is simpler and provider-agnostic. Default: **edge-function AES-GCM with `APP_ENCRYPTION_KEY`** unless you prefer Vault.
2. **Stripe Price IDs.** Memory has live IDs for $19 / $39 / $99. New spec is **$25 / $49 / $99**. Do you want me to (a) create new Stripe products/prices at $25/$49/$99 and replace the IDs, or (b) keep existing IDs and you'll update prices in Stripe yourself, or (c) leave Stripe IDs blank and you fill them in via the new Super Admin UI?
3. **Yearly pricing.** No yearly numbers given. Default to **monthly × 10** (2 months free) unless you specify.
4. **Existing `plan_features` table.** Safe to deprecate after migrating data into `subscription_plan_features`? It currently has 4 RLS policies — I'll preserve them on a backwards-compatible view.
5. **Scope of this build.** Given the size (7 phases, ~20+ files, new edge functions, Stripe wiring), should I execute **all phases in one go** or ship phase-by-phase with your review between each? Recommend **phase-by-phase** to keep diffs reviewable and avoid regressions in your already-shipped billing flows.

Once you answer 1–5 (or say "use your defaults, proceed phase-by-phase"), I'll start with Phase 1.
