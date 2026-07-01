import { BRAND } from '@/components/brand/Logo';
import {
  LegalPageLayout,
  Section,
  SubHeading,
  Callout,
  InlineList,
  type TocSection,
} from '@/components/legal/LegalPageLayout';

const LAST_UPDATED = 'January 15, 2026';
const CANONICAL = 'https://hiremetrics.co.uk/refund-policy';

const TOC: TocSection[] = [
  { id: 'overview', label: 'Overview' },
  { id: 'subscription-billing', label: 'Subscription billing' },
  { id: 'free-trial', label: 'Free trial' },
  { id: 'promo-codes', label: 'Promo codes' },
  { id: 'cancellation', label: 'Cancellation & renewals' },
  { id: 'upgrade-downgrade', label: 'Upgrade & downgrade' },
  { id: 'payment-failures', label: 'Payment failures' },
  { id: 'refund-eligibility', label: 'Refund eligibility' },
  { id: 'non-refundable', label: 'Non-refundable situations' },
  { id: 'billing-errors', label: 'Billing errors & duplicates' },
  { id: 'contact-process', label: 'How to request a refund' },
  { id: 'chargebacks', label: 'Chargebacks & fraud' },
  { id: 'taxes-currency', label: 'Taxes & currency' },
  { id: 'changes', label: 'Changes to this policy' },
];

export default function ReturnPolicyPage() {
  return (
    <LegalPageLayout
      breadcrumb="Refund Policy"
      title="Refund Policy"
      subtitle={`${BRAND.name} is a subscription SaaS product. This policy explains how billing, cancellations and refund requests work.`}
      lastUpdated={LAST_UPDATED}
      toc={TOC}
      seo={{
        title: `Refund Policy | ${BRAND.name}`,
        description: `Read the ${BRAND.name} Refund Policy — subscription billing, free trial, cancellations, upgrades, downgrades, refund eligibility and how to raise a billing dispute.`,
        canonical: CANONICAL,
        ogType: 'article',
        jsonLd: {
          '@context': 'https://schema.org',
          '@type': 'WebPage',
          name: `${BRAND.name} Refund Policy`,
          url: CANONICAL,
          inLanguage: 'en',
          publisher: {
            '@type': 'Organization',
            name: BRAND.name,
            legalName: 'Tasaru Ventures Ltd',
          },
          dateModified: LAST_UPDATED,
        },
      }}
    >
      <Section id="overview" title="1. Overview">
        <p>
          {BRAND.name} is operated by Tasaru Ventures Ltd (company number
          16399822). This Refund Policy sets out the terms under which
          subscription fees paid for {BRAND.name} may be cancelled, refunded or
          disputed. It applies to every {BRAND.name} plan sold through the
          website, sales team or in-app checkout.
        </p>
        <Callout variant="info" title="Consumer rights not affected">
          Where you are a consumer (rather than a business) and applicable law
          gives you additional refund or cancellation rights — including UK and
          EU distance-selling regulations — those rights apply in addition to
          this policy. Nothing in this policy limits your statutory rights.
        </Callout>
      </Section>

      <Section id="subscription-billing" title="2. Subscription billing">
        <SubHeading>2.1 Monthly plans</SubHeading>
        <p>
          {BRAND.name} plans are billed monthly in advance in US dollars. The
          subscription starts on the day you activate it and renews
          automatically on the same day each month until cancelled. You can see
          your renewal date at any time inside the Billing Center.
        </p>
        <SubHeading>2.2 Annual plans</SubHeading>
        <p>
          Annual plans are offered to selected Enterprise customers on a
          contracted basis. Annual fees are paid in advance for the full 12-month
          period and are non-refundable for early cancellation except where
          required by law or explicitly stated in the order form.
        </p>
      </Section>

      <Section id="free-trial" title="3. Free trial">
        <p>
          New workspaces may start a 7-day free trial of any plan without
          providing a payment method. During the trial you have full access to
          the features included in the selected plan, subject to plan limits.
        </p>
        <InlineList
          items={[
            'You are not charged during the trial.',
            'If you do not subscribe by the end of the trial, your workspace is placed in read-only mode. You can still export your data and reactivate at any time.',
            'A workspace may use one free trial per plan. Repeat trials to avoid billing are not permitted.',
          ]}
        />
      </Section>

      <Section id="promo-codes" title="4. Promo codes">
        <InlineList
          items={[
            'Promo codes are single-use per workspace unless stated otherwise on the code.',
            'A promo code must be applied at checkout — codes cannot be added retroactively to a previous invoice.',
            'Discounts apply only to future billing periods, not to invoices already paid.',
            'Promo codes cannot be combined with other discounts unless the code explicitly says so.',
            'Fraudulent, distributed or resold codes are void and the associated subscription may be cancelled without refund.',
          ]}
        />
      </Section>

      <Section id="cancellation" title="5. Cancellation & renewals">
        <p>
          You can cancel a subscription at any time from Billing Center →
          Subscription → Cancel plan. Cancellation takes effect at the end of
          your current billing period; you retain full access until then.
          Subscriptions renew automatically until cancelled.
        </p>
        <Callout variant="warning" title="Cancelling does not automatically refund">
          Cancelling stops future renewals. It does <strong>not</strong>{' '}
          automatically refund the current billing period. If you believe a
          refund is warranted, see the refund eligibility section below.
        </Callout>
      </Section>

      <Section id="upgrade-downgrade" title="6. Upgrade & downgrade">
        <SubHeading>Upgrades</SubHeading>
        <p>
          Upgrades take effect immediately. Stripe automatically issues a
          prorated invoice covering the difference between your old and new
          plan for the remainder of the current billing period.
        </p>
        <SubHeading>Downgrades</SubHeading>
        <p>
          Downgrades take effect at the start of the next billing period. No
          refund is issued for the unused portion of the more expensive plan.
          If, after the downgrade, your workspace exceeds the new plan\u2019s
          limits (for example number of active jobs or team seats), affected
          features may become read-only until usage returns within the new
          limits.
        </p>
      </Section>

      <Section id="payment-failures" title="7. Payment failures">
        <p>
          If a scheduled payment fails, Stripe retries automatically for up to
          seven days and we notify the workspace owner by email. If payment is
          not recovered:
        </p>
        <InlineList
          items={[
            'The workspace is placed in past-due mode. Team members can still sign in and view existing records.',
            'Metered actions (AI Discovery runs, invoice generation, new job creation) are paused.',
            'After 14 days of unresolved past-due status, the workspace is downgraded to read-only until a valid payment method is added.',
          ]}
        />
      </Section>

      <Section id="refund-eligibility" title="8. Refund eligibility">
        <p>
          Subscription fees are generally non-refundable because plan
          allowances (AI credits, seats, jobs) are provisioned in advance.
          Refund requests are reviewed on a <strong>case-by-case basis</strong>{' '}
          and may be granted, in whole or in part, where:
        </p>
        <InlineList
          items={[
            'A confirmed platform outage or defect materially prevented you from using the Service for a sustained period.',
            'A charge was made in error due to a system fault on our side.',
            'You were charged after cancelling the subscription (double-billing).',
            'Applicable consumer-protection law requires a refund.',
          ]}
        />
        <p>
          Where a refund is approved, it is issued to the original payment
          method within 5–10 business days. Partial refunds may be prorated by
          days of unused service.
        </p>
      </Section>

      <Section id="non-refundable" title="9. Non-refundable situations">
        <p>Refunds are not available for:</p>
        <InlineList
          items={[
            'A change of mind or a decision to switch to another product after using the Service.',
            'Unused portions of a plan following a mid-period cancellation.',
            'Failure to cancel before an automatic renewal, unless the renewal was blocked by a platform fault.',
            'Third-party costs (Apollo, Lusha, Vibe Prospecting, email deliverability providers, or any other service you connect via your own API keys).',
            'Discounts, promotional credits or trial extensions that were never paid for.',
            'Suspension or termination of an account for breach of our Terms of Service, including abusive AI usage, scraping of prohibited sources or fraudulent activity.',
          ]}
        />
      </Section>

      <Section id="billing-errors" title="10. Billing errors & duplicate charges">
        <p>
          If you notice a duplicate charge, an amount that does not match your
          plan, or a charge for a workspace you have already cancelled,
          contact us within 60 days of the invoice date. Once verified, the
          incorrect portion is refunded to the original payment method in full.
        </p>
      </Section>

      <Section id="contact-process" title="11. How to request a refund">
        <p>
          Send refund requests from the email address associated with your
          workspace to{' '}
          <a
            href={`mailto:${BRAND.email}`}
            className="text-primary underline underline-offset-2"
          >
            {BRAND.email}
          </a>{' '}
          with the subject line <em>&ldquo;Refund request&rdquo;</em>. Include:
        </p>
        <InlineList
          items={[
            'The workspace name or account email.',
            'The invoice number(s) or approximate payment date.',
            'A short description of what happened and why you believe a refund is due.',
          ]}
        />
        <Callout variant="success" title="Response time">
          We acknowledge every refund request within <strong>2 business days</strong>{' '}
          and aim to reach a decision within <strong>7 business days</strong>.
          Complex cases (for example those involving a bank investigation) may
          take longer; we will keep you informed throughout.
        </Callout>
      </Section>

      <Section id="chargebacks" title="12. Chargebacks & fraud">
        <p>
          Please contact us before raising a chargeback with your bank —
          almost every billing question can be resolved directly and more
          quickly. Chargebacks incur processor fees and administrative cost.
        </p>
        <p>
          Workspaces subject to a chargeback are suspended pending review.
          Chargebacks judged to be fraudulent or made in bad faith may result
          in permanent termination of the account and referral to the
          payment processor\u2019s fraud programme.
        </p>
      </Section>

      <Section id="taxes-currency" title="13. Taxes & currency">
        <p>
          All prices displayed on the pricing page and Billing Center are in
          US dollars (USD) unless expressly stated otherwise. Depending on your
          billing address, applicable sales tax, VAT or GST may be added at
          checkout by Stripe. Refunds are issued in the original currency of
          the charge; foreign-exchange differences arising from bank conversion
          are not reimbursed.
        </p>
      </Section>

      <Section id="changes" title="14. Changes to this policy">
        <p>
          We may update this Refund Policy from time to time. Material changes
          will be notified to workspace owners by email and take effect no
          earlier than 14 days after notification. The date at the top of this
          page reflects the most recent update.
        </p>
        <p>
          Questions about this policy? Email{' '}
          <a
            href={`mailto:${BRAND.email}`}
            className="text-primary underline underline-offset-2"
          >
            {BRAND.email}
          </a>
          .
        </p>
      </Section>
    </LegalPageLayout>
  );
}
