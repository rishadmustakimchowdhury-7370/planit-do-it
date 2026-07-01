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
const CANONICAL = 'https://hiremetrics.co.uk/privacy';

const TOC: TocSection[] = [
  { id: 'introduction', label: 'Introduction' },
  { id: 'information-we-collect', label: 'Information we collect' },
  { id: 'how-we-use-information', label: 'How we use information' },
  { id: 'ai-processing', label: 'AI processing' },
  { id: 'third-party-integrations', label: 'Third-party integrations' },
  { id: 'data-retention', label: 'Data retention' },
  { id: 'data-security', label: 'Data security' },
  { id: 'international-transfers', label: 'International transfers' },
  { id: 'user-rights', label: 'Your rights' },
  { id: 'cookies', label: 'Cookies' },
  { id: 'children', label: 'Children\u2019s data' },
  { id: 'updates', label: 'Policy updates' },
  { id: 'contact', label: 'Contact us' },
];

export default function PrivacyPage() {
  return (
    <LegalPageLayout
      breadcrumb="Privacy Policy"
      title="Privacy Policy"
      subtitle={`How ${BRAND.name} — operated by Tasaru Ventures Ltd — collects, uses, protects and shares information across our recruitment CRM platform.`}
      lastUpdated={LAST_UPDATED}
      toc={TOC}
      seo={{
        title: `Privacy Policy | ${BRAND.name}`,
        description: `Read the ${BRAND.name} Privacy Policy — what data we collect, how we process it with AI, third-party integrations, retention, security and your GDPR, UK GDPR and CCPA rights.`,
        canonical: CANONICAL,
        ogType: 'article',
        jsonLd: {
          '@context': 'https://schema.org',
          '@type': 'WebPage',
          name: `${BRAND.name} Privacy Policy`,
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
      <Section id="introduction" title="1. Introduction">
        <p>
          {BRAND.name} is a recruitment CRM and AI sourcing platform operated by
          Tasaru Ventures Ltd (company number 16399822), registered in England and
          Wales. This Privacy Policy explains what personal data we collect, why
          we collect it, how it is stored and processed, and the rights you have
          under the UK GDPR, EU GDPR and — where applicable — the California
          Consumer Privacy Act (CCPA).
        </p>
        <p>
          It applies to our marketing website, the {BRAND.name} recruiter
          application, the {BRAND.name} client portal and any related APIs,
          emails and support channels (together, the &ldquo;Service&rdquo;).
        </p>
        <Callout variant="info" title="A note on shared responsibility">
          {BRAND.name} acts as a data <strong>processor</strong> for personal
          data that customers (recruitment agencies and in-house talent teams)
          upload about candidates and clients. Those customers are the data
          <strong> controllers</strong> for that information. {BRAND.name} is a
          data <strong>controller</strong> for account, billing and usage data
          about our direct customers.
        </Callout>
      </Section>

      <Section id="information-we-collect" title="2. Information we collect">
        <SubHeading>2.1 Account and personal information</SubHeading>
        <p>When you register or use the Service, we collect:</p>
        <InlineList
          items={[
            'Name, work email address and, if you provide it, phone number.',
            'Company name, job title and workspace role (Owner, Manager, Recruiter, Client User).',
            'Authentication details — password hash, TOTP two-factor secret, active session identifiers.',
            'Billing contact details and the last four digits of your card (full card data is held by Stripe, never by us).',
            'Communication preferences and support conversation history.',
          ]}
        />

        <SubHeading>2.2 Recruitment data uploaded by customers</SubHeading>
        <p>
          Customers upload or generate the following as part of running their
          recruitment business inside {BRAND.name}. This data belongs to the
          customer\u2019s workspace and is not shared across tenants:
        </p>
        <InlineList
          items={[
            'Candidate information — name, contact details, work history, education, skills, salary expectations, notes and interview feedback.',
            'Client information — company profile, hiring contacts, fees, contracts and communication history.',
            'Uploaded documents — CVs and resumes (PDF, DOCX, TXT), job specifications, offer letters, invoices and other files attached to records.',
            'Resume files parsed by our AI extractor into structured candidate profiles.',
            'Placements, invoices and commission records generated inside the Finance module.',
          ]}
        />

        <SubHeading>2.3 Cookies, analytics and usage data</SubHeading>
        <p>
          We collect technical information automatically when you use the
          Service, including IP address, browser type and version, device type,
          operating system, pages viewed, features used, referrer URL, and
          timestamps of actions. This information is used to operate the
          Service, prevent abuse and improve reliability.
        </p>
        <p>
          Cookies are used for session management, security (CSRF protection),
          remembered preferences and — where you consent — first-party product
          analytics. See <a href="/cookie-policy" className="text-primary underline underline-offset-2">our Cookie Policy</a> for the full list.
        </p>
      </Section>

      <Section id="how-we-use-information" title="3. How we use information">
        <p>We process personal data on the following legal bases:</p>
        <InlineList
          items={[
            <>
              <strong>Contract</strong> — to provide the Service, process
              payments, deliver support and enforce plan limits.
            </>,
            <>
              <strong>Legitimate interests</strong> — to secure the platform,
              prevent fraud and abuse, measure product performance and
              communicate about outages or security matters.
            </>,
            <>
              <strong>Consent</strong> — for optional cookies, marketing emails
              and any feature you explicitly opt into.
            </>,
            <>
              <strong>Legal obligation</strong> — to retain financial records
              and respond to lawful requests from authorities.
            </>,
          ]}
        />
        <p>
          We do <strong>not</strong> sell personal data, and we do not use
          candidate or client data uploaded by customers for our own marketing.
        </p>
      </Section>

      <Section id="ai-processing" title="4. AI processing">
        <p>
          {BRAND.name} uses AI models (currently OpenAI GPT-4o and GPT-4o-mini,
          plus OpenAI\u2019s search-enabled variants for open web discovery) to
          power resume parsing, AI candidate discovery, AI company search, AI
          matching, and outbound message drafting.
        </p>
        <InlineList
          items={[
            'AI providers act as sub-processors and only receive the minimum data required for the specific request.',
            'Inputs and outputs are processed transiently to fulfil the request and are not used to train OpenAI\u2019s public foundation models (per OpenAI\u2019s API data-use terms).',
            'AI-generated output is a suggestion, not a decision — recruiters remain responsible for any hiring, sourcing or client-facing action taken.',
            'AI Discovery searches public web content; it does not access sites requiring authentication (for example a candidate\u2019s private LinkedIn profile).',
          ]}
        />
        <Callout variant="warning" title="Automated decision-making">
          {BRAND.name} does not make automated decisions that produce legal or
          similarly significant effects about individuals. AI match scores and
          shortlists are decision-support tools reviewed by a human recruiter.
        </Callout>
      </Section>

      <Section id="third-party-integrations" title="5. Third-party integrations and sub-processors">
        <p>
          We use a small set of vetted providers to operate the Service. Each
          receives only the data needed for its purpose:
        </p>
        <InlineList
          items={[
            <>
              <strong>Supabase</strong> — managed Postgres, authentication and
              object storage. Hosts customer data at rest inside the EU/UK
              region.
            </>,
            <>
              <strong>Stripe</strong> — subscription billing and payment
              processing. Card data is captured and stored by Stripe; we
              receive only the transaction result and last four digits.
            </>,
            <>
              <strong>OpenAI</strong> — AI models used for parsing, discovery,
              matching and message drafting.
            </>,
            <>
              <strong>Apollo, Lusha, Vibe Prospecting</strong> — optional data
              enrichment providers. They are invoked only when a customer
              connects their own API key under Settings → API Connections.
              Customer keys are stored encrypted and only decrypted server-side.
            </>,
            <>
              <strong>Email providers</strong> — transactional email is sent
              via customer-connected SMTP accounts (for outbound recruiter
              email) and via our platform provider (for account, billing and
              support notifications).
            </>,
            <>
              <strong>Cloudflare</strong> — CDN, DDoS mitigation and DNS.
            </>,
          ]}
        />
        <p>
          A current list of sub-processors is available on request from{' '}
          <a
            href={`mailto:${BRAND.email}`}
            className="text-primary underline underline-offset-2"
          >
            {BRAND.email}
          </a>
          .
        </p>
      </Section>

      <Section id="data-retention" title="6. Data retention">
        <InlineList
          items={[
            'Active workspaces — data is retained for the life of your subscription.',
            'Cancelled workspaces — data is retained in read-only mode for 90 days after cancellation so you can export or reactivate. After 90 days the workspace is scheduled for deletion and removed from primary systems within a further 30 days.',
            'Backups — encrypted daily backups are kept for 30 days on a rolling basis and then overwritten.',
            'Financial records — invoices and payment records are retained for the period required by UK tax law (currently six years).',
            'Audit and security logs — retained for up to 24 months for security investigation and abuse prevention.',
          ]}
        />
      </Section>

      <Section id="data-security" title="7. Data security">
        <SubHeading>7.1 Encryption</SubHeading>
        <p>
          All connections to {BRAND.name} use TLS 1.2 or above. Data at rest is
          encrypted with AES-256 on our managed Postgres database and object
          storage. Sensitive credentials — including TOTP two-factor secrets
          and third-party API keys — are stored in dedicated tables with
          additional access restrictions.
        </p>

        <SubHeading>7.2 Role-based access</SubHeading>
        <p>
          Access inside a workspace is governed by role (Owner, Manager,
          Recruiter, Client User). Permissions are enforced at the database
          level, not only in the UI, so a user cannot bypass their role by
          calling the API directly.
        </p>

        <SubHeading>7.3 Multi-tenant isolation</SubHeading>
        <p>
          Every table is scoped by tenant identifier and protected by Postgres
          Row-Level Security policies that verify the caller\u2019s workspace
          on every read and write. Users of one workspace cannot access another
          workspace\u2019s data, even through direct database queries.
        </p>

        <SubHeading>7.4 Operational controls</SubHeading>
        <InlineList
          items={[
            'Least-privilege production access limited to a small, named group of engineers.',
            'Two-factor authentication required for all administrative accounts.',
            'Continuous dependency scanning and security-focused code review.',
            'Incident response process with customer notification for material events without undue delay and, where required, within 72 hours.',
          ]}
        />
      </Section>

      <Section id="international-transfers" title="8. International transfers">
        <p>
          {BRAND.name} primarily hosts customer data in the European Union
          and United Kingdom. Where personal data is transferred outside the
          UK or EEA — for example when an AI request is processed by OpenAI in
          the United States — we rely on the UK International Data Transfer
          Agreement (IDTA) and the EU Standard Contractual Clauses (SCCs) with
          the receiving party. Additional technical safeguards (encryption in
          transit, minimum-data payloads) are always applied.
        </p>
      </Section>

      <Section id="user-rights" title="9. Your rights">
        <p>
          Depending on where you live, you have some or all of the following
          rights over the personal data we hold about you:
        </p>
        <InlineList
          items={[
            'Access — request a copy of the personal data we hold about you.',
            'Rectification — ask us to correct inaccurate or incomplete data.',
            'Erasure — request deletion of your personal data ("right to be forgotten").',
            'Restriction — ask us to limit how we process your data.',
            'Portability — receive a machine-readable export of your data.',
            'Objection — object to processing based on legitimate interests.',
            'Withdraw consent — where processing is based on consent, withdraw it at any time.',
            'Lodge a complaint — with the UK Information Commissioner\u2019s Office (ICO) or your local supervisory authority.',
          ]}
        />
        <SubHeading>Account deletion and data export</SubHeading>
        <p>
          Workspace owners can request a data export at any time from Settings.
          To delete an account, use the in-app deletion flow or email us at{' '}
          <a
            href={`mailto:${BRAND.email}`}
            className="text-primary underline underline-offset-2"
          >
            {BRAND.email}
          </a>
          . We will confirm the request and complete deletion within 30 days.
        </p>
        <SubHeading>Candidates and clients of our customers</SubHeading>
        <p>
          If your data is held in {BRAND.name} because a recruitment agency or
          employer uploaded it, that organisation is the data controller.
          Please contact them directly to exercise your rights; we will assist
          them in responding.
        </p>
      </Section>

      <Section id="cookies" title="10. Cookies">
        <p>
          We use strictly necessary cookies for authentication and security.
          Optional analytics and marketing cookies are set only with your
          consent through the cookie banner. Full details are in our{' '}
          <a
            href="/cookie-policy"
            className="text-primary underline underline-offset-2"
          >
            Cookie Policy
          </a>
          .
        </p>
      </Section>

      <Section id="children" title="11. Children\u2019s data">
        <p>
          {BRAND.name} is a business-to-business product and is not intended
          for use by individuals under 16. We do not knowingly collect personal
          data from children. If you believe we have received such data,
          contact us and we will delete it.
        </p>
      </Section>

      <Section id="updates" title="12. Policy updates">
        <p>
          We may update this Privacy Policy from time to time to reflect new
          features, legal requirements or operational changes. Material changes
          will be notified to workspace owners by email and shown in-app before
          they take effect. The date at the top of this page reflects the most
          recent update.
        </p>
      </Section>

      <Section id="contact" title="13. Contact us">
        <p>
          Questions, requests or complaints about privacy at {BRAND.name} can
          be sent to:
        </p>
        <div className="rounded-xl border border-border bg-card p-5 text-sm not-prose">
          <p className="text-foreground font-medium mb-2">
            Tasaru Ventures Ltd (trading as {BRAND.name})
          </p>
          <p className="text-muted-foreground">
            Suite A, 82 James Carter Road
            <br />
            Mildenhall, Bury St. Edmunds
            <br />
            United Kingdom, IP28 7DE
          </p>
          <p className="text-muted-foreground mt-3">
            <strong className="text-foreground">Email:</strong>{' '}
            <a
              href={`mailto:${BRAND.email}`}
              className="text-primary underline underline-offset-2"
            >
              {BRAND.email}
            </a>
            <br />
            <strong className="text-foreground">Phone / WhatsApp:</strong>{' '}
            +44 7426 468550
            <br />
            <strong className="text-foreground">Company number:</strong>{' '}
            16399822
          </p>
        </div>
        <p>
          UK / EU residents can lodge a complaint with the Information
          Commissioner\u2019s Office at{' '}
          <a
            href="https://ico.org.uk"
            className="text-primary underline underline-offset-2"
            rel="noopener noreferrer"
            target="_blank"
          >
            ico.org.uk
          </a>
          .
        </p>
      </Section>
    </LegalPageLayout>
  );
}
