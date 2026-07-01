// Fully dynamic pricing section rendered on the homepage.
// Every value (plan name, price, features, limits, CTA, badges) comes from get_public_pricing().
import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Check, Loader2, Sparkles } from 'lucide-react';
import { usePricingCatalog } from '@/hooks/usePricingCatalog';
import { formatLimit, formatPrice, resolvePlanFeatureLimit } from '@/types/pricing';
import type { BillingInterval } from '@/types/pricing';
import { cn } from '@/lib/utils';

const NAVY = '#182C6F';

interface Props {
  onContactSales?: () => void;
}

const fadeUp = {
  initial: { opacity: 0, y: 20 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, amount: 0.2 },
  transition: { duration: 0.6, ease: [0.16, 1, 0.3, 1] as [number, number, number, number] },
};

export function PricingSection({ onContactSales }: Props) {
  const { plans, isLoading, hasYearlyPricing, getFeaturesForPlan } = usePricingCatalog();
  const [interval, setInterval] = useState<BillingInterval>('monthly');

  const activePlans = useMemo(
    () => plans.filter(p => p.active).sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0)),
    [plans],
  );

  return (
    <section id="pricing" className="py-20 md:py-32 px-5 sm:px-6">
      <div className="container mx-auto max-w-7xl">
        <motion.div {...fadeUp} className="text-center max-w-3xl mx-auto mb-10">
          <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white border border-slate-200 text-xs font-medium text-slate-600">
            <Sparkles className="h-3.5 w-3.5" /> Pricing
          </span>
          <h2 className="mt-4 text-3xl md:text-5xl font-semibold tracking-tight" style={{ color: NAVY }}>
            Simple, transparent pricing
          </h2>
          <p className="mt-4 text-lg text-slate-600">
            Pick the plan that fits your team. Upgrade, downgrade or cancel at any time.
          </p>
        </motion.div>

        {hasYearlyPricing && (
          <div className="flex justify-center mb-10">
            <div className="inline-flex rounded-full border border-slate-200 bg-white p-1 shadow-sm">
              {(['monthly', 'yearly'] as const).map(v => (
                <button
                  key={v}
                  onClick={() => setInterval(v)}
                  className={cn(
                    'px-4 py-1.5 rounded-full text-sm font-medium capitalize transition-colors',
                    interval === v ? 'text-white' : 'text-slate-600 hover:text-slate-900',
                  )}
                  style={interval === v ? { background: NAVY } : undefined}
                >
                  {v}
                  {v === 'yearly' && ' — save more'}
                </button>
              ))}
            </div>
          </div>
        )}

        {isLoading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
          </div>
        ) : activePlans.length === 0 ? (
          <p className="text-center text-slate-500">Pricing plans are being configured. Please check back soon.</p>
        ) : (
          <div
            className={cn(
              'grid gap-6 max-w-6xl mx-auto',
              activePlans.length === 1 && 'md:grid-cols-1 max-w-md',
              activePlans.length === 2 && 'md:grid-cols-2 max-w-3xl',
              activePlans.length >= 3 && 'md:grid-cols-3',
            )}
          >
            {activePlans.map(plan => {
              const isYearly = interval === 'yearly' && plan.price_yearly != null && plan.price_yearly > 0;
              const displayPrice = isYearly
                ? (plan.price_yearly ?? 0) / 12
                : plan.price_monthly ?? 0;
              const priceStr = formatPrice(displayPrice, plan.currency);
              const trialDays = isYearly ? plan.yearly_trial_days : plan.monthly_trial_days;
              const rows = getFeaturesForPlan(plan.id);
              const isEnterprise = plan.enterprise;
              const ctaText = plan.button_text || (isEnterprise ? 'Contact Sales' : 'Get started');
              const ctaHref = isEnterprise
                ? undefined
                : plan.button_url ||
                  `/checkout?plan=${encodeURIComponent(plan.slug)}&interval=${interval}`;

              return (
                <motion.div
                  {...fadeUp}
                  key={plan.id}
                  className={cn(
                    'relative rounded-[24px] p-8 border bg-white flex flex-col',
                    plan.highlighted
                      ? 'shadow-[0_30px_80px_-30px_rgba(24,44,111,0.4)] border-[color:var(--navy-15,#dfe4f2)] md:scale-[1.03]'
                      : 'border-slate-200',
                  )}
                >
                  {plan.popular && (
                    <div
                      className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full text-xs font-semibold text-white"
                      style={{ background: NAVY }}
                    >
                      Most popular
                    </div>
                  )}
                  {plan.badge && (
                    <Badge variant="secondary" className="self-start mb-3">
                      {plan.badge}
                    </Badge>
                  )}

                  <h3 className="text-xl font-semibold" style={{ color: plan.color || NAVY }}>
                    {plan.name}
                  </h3>
                  {plan.description && (
                    <p className="mt-2 text-sm text-slate-600 min-h-[40px]">{plan.description}</p>
                  )}

                  <div className="mt-6 flex items-baseline gap-1">
                    {isEnterprise && (displayPrice === 0 || !displayPrice) ? (
                      <span className="text-3xl font-semibold" style={{ color: NAVY }}>
                        Custom
                      </span>
                    ) : (
                      <>
                        <span className="text-4xl font-semibold" style={{ color: NAVY }}>
                          {priceStr}
                        </span>
                        <span className="text-sm text-slate-500">/mo</span>
                      </>
                    )}
                  </div>
                  {isYearly && plan.yearly_discount_percentage ? (
                    <p className="text-xs text-emerald-600 font-medium mt-1">
                      Save {Number(plan.yearly_discount_percentage)}% billed yearly
                    </p>
                  ) : isYearly && plan.price_yearly ? (
                    <p className="text-xs text-slate-500 mt-1">
                      {formatPrice(plan.price_yearly, plan.currency)} billed yearly
                    </p>
                  ) : null}
                  {trialDays ? (
                    <p className="text-xs text-slate-500 mt-1">{trialDays}-day free trial</p>
                  ) : null}

                  <Button
                    asChild={!!ctaHref}
                    onClick={!ctaHref ? onContactSales : undefined}
                    className="mt-6 w-full text-white rounded-xl"
                    style={{ background: plan.highlighted ? NAVY : '#0F172A' }}
                  >
                    {ctaHref ? (
                      ctaHref.startsWith('http') ? (
                        <a href={ctaHref} target="_blank" rel="noreferrer">
                          {ctaText}
                        </a>
                      ) : (
                        <Link to={ctaHref}>{ctaText}</Link>
                      )
                    ) : (
                      <span>{ctaText}</span>
                    )}
                  </Button>

                  {rows.length > 0 && (
                    <ul className="mt-8 space-y-3 text-sm text-slate-700">
                      {rows.map(({ pf, feature }) => {
                        const limit = resolvePlanFeatureLimit(pf, feature, interval);
                        const label = pf.custom_label || feature.display_name;
                        const isCountable = pf.unlimited || pf.monthly_limit != null || pf.yearly_limit != null || feature.default_limit != null;
                        return (
                          <li key={feature.id} className="flex items-start gap-2.5">
                            <Check className="h-4 w-4 mt-0.5 text-emerald-600 shrink-0" />
                            <span>
                              {isCountable ? (
                                <>
                                  <span className="font-medium">{formatLimit(limit, feature.unit)}</span>{' '}
                                  {label.toLowerCase()}
                                </>
                              ) : (
                                label
                              )}
                            </span>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </motion.div>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}
