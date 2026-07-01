/**
 * FAQ content — modular, CMS-ready. When a Super Admin CMS is added,
 * this file becomes the fallback / seed data; the loader can swap
 * to a remote source without touching the FAQ page markup.
 */

export type FaqCategoryId =
  | 'general'
  | 'recruitment_crm'
  | 'ai_candidate_discovery'
  | 'ai_company_search'
  | 'open_web_discovery'
  | 'apollo'
  | 'lusha'
  | 'vibe'
  | 'billing'
  | 'trial'
  | 'data_security'
  | 'multi_tenant_security'
  | 'api_connections'
  | 'candidate_management'
  | 'client_management'
  | 'resume_parsing'
  | 'ai_matching'
  | 'reports'
  | 'team'
  | 'finance'
  | 'stripe'
  | 'cancel'
  | 'upgrade'
  | 'support';

export interface FaqCategory {
  id: FaqCategoryId;
  label: string;
  description?: string;
}

export interface FaqItem {
  category: FaqCategoryId;
  question: string;
  answer: string;
}

export const faqCategories: FaqCategory[] = [
  { id: 'general', label: 'General', description: 'About Hiremetrics and how the platform is used.' },
  { id: 'recruitment_crm', label: 'Recruitment CRM', description: 'Jobs, pipelines and day-to-day recruiting.' },
  { id: 'ai_candidate_discovery', label: 'AI Candidate Discovery' },
  { id: 'ai_company_search', label: 'AI Company Search' },
  { id: 'open_web_discovery', label: 'Open Web Discovery' },
  { id: 'apollo', label: 'Apollo Integration' },
  { id: 'lusha', label: 'Lusha Integration' },
  { id: 'vibe', label: 'Vibe Prospecting Integration' },
  { id: 'candidate_management', label: 'Candidate Management' },
  { id: 'client_management', label: 'Client Management' },
  { id: 'resume_parsing', label: 'Resume Parsing' },
  { id: 'ai_matching', label: 'AI Matching' },
  { id: 'reports', label: 'Reports' },
  { id: 'team', label: 'Team Management' },
  { id: 'finance', label: 'Finance' },
  { id: 'billing', label: 'Billing & Subscription' },
  { id: 'stripe', label: 'Stripe Billing' },
  { id: 'trial', label: 'Free Trial' },
  { id: 'cancel', label: 'Cancel Subscription' },
  { id: 'upgrade', label: 'Upgrade / Downgrade' },
  { id: 'data_security', label: 'Data Security' },
  { id: 'multi_tenant_security', label: 'Multi-Tenant Security' },
  { id: 'api_connections', label: 'API Connections' },
  { id: 'support', label: 'Technical Support' },
];

export const faqItems: FaqItem[] = [
  // General ------------------------------------------------------------------
  {
    category: 'general',
    question: 'What is Hiremetrics?',
    answer:
      'Hiremetrics is an AI-native recruitment CRM built for agencies and in-house talent teams. It combines candidate and client management, AI candidate discovery, resume parsing, AI matching, submissions, placements tracking, invoicing and team KPI reporting inside a single workspace.',
  },
  {
    category: 'general',
    question: 'Who is Hiremetrics designed for?',
    answer:
      'Recruitment agencies, staffing firms, executive search boutiques and internal talent acquisition teams. Roles range from individual recruiters and account managers up to team leads, agency owners and finance operators — each with role-scoped permissions.',
  },
  {
    category: 'general',
    question: 'Do I need to install anything?',
    answer:
      'No. Hiremetrics is a fully hosted web application. Sign in from any modern browser on desktop or mobile — there is nothing to download, patch or self-host.',
  },
  {
    category: 'general',
    question: 'Which browsers are supported?',
    answer:
      'The latest two versions of Chrome, Edge, Firefox and Safari on desktop and mobile. We do not support Internet Explorer.',
  },

  // Recruitment CRM ----------------------------------------------------------
  {
    category: 'recruitment_crm',
    question: 'How does the recruitment pipeline work?',
    answer:
      'Every job carries its own pipeline. Candidates move through stages such as Sourced → Screened → AI Match → Prepare For Client → Client Submission → Interview → Offer → Placement. Stage changes are logged automatically and feed KPI reports without manual data entry.',
  },
  {
    category: 'recruitment_crm',
    question: 'Can multiple recruiters work on the same job?',
    answer:
      'Yes. Jobs support multi-recruiter assignment with visibility rules — assigned recruiters, their managers and workspace owners see the job. Activity, submissions and placements are attributed to the recruiter who performed each action for accurate KPIs.',
  },
  {
    category: 'recruitment_crm',
    question: 'Can I share candidates with clients securely?',
    answer:
      'Yes. Use the client portal for a full pipeline view or generate a time-limited public share link for a single candidate. Share links can be revoked at any time and expire automatically.',
  },

  // AI Candidate Discovery ---------------------------------------------------
  {
    category: 'ai_candidate_discovery',
    question: 'How does AI Candidate Discovery source candidates?',
    answer:
      'The engine runs a large fan-out of parallel search strategies against open web sources using OpenAI models (GPT-4o family). Results are deduplicated, scored against the job (role match 40%, skills 30%, function 15%, location 10%, industry 5%) and returned as a ranked shortlist.',
  },
  {
    category: 'ai_candidate_discovery',
    question: 'What is the largest result set I can request?',
    answer:
      'Discovery is metered against your plan. You can target 25, 50, 100, 250 or 500 results per run — higher tiers unlock larger recall. All runs count against your monthly AI Discovery allowance.',
  },
  {
    category: 'ai_candidate_discovery',
    question: 'Does Hiremetrics store scraped candidate profiles?',
    answer:
      'Hiremetrics stores the public profile fields returned by discovery inside your workspace so you can act on them. Nothing is shared across tenants. You can delete any record at any time.',
  },

  // AI Company Search --------------------------------------------------------
  {
    category: 'ai_company_search',
    question: 'What is AI Company Search?',
    answer:
      'A business development tool that finds prospect companies matching a description of your ideal client — industry, size, geography, hiring signals. Results can be saved to Leads, converted into Clients, or exported.',
  },
  {
    category: 'ai_company_search',
    question: 'How is company data enriched?',
    answer:
      'Public sources are used first. Where you have Apollo, Lusha or Vibe Prospecting connected, additional firmographic and contact enrichment is pulled from those providers using your own API keys.',
  },

  // Open Web Discovery -------------------------------------------------------
  {
    category: 'open_web_discovery',
    question: 'When should I use Open Web Discovery instead of Apollo or Lusha?',
    answer:
      'Open Web Discovery is the default fallback and does not require a paid data provider. It excels at niche technical roles, non-tech industries, and geographies where commercial databases are thin. Combine it with Apollo or Lusha for contact enrichment.',
  },
  {
    category: 'open_web_discovery',
    question: 'Does Open Web Discovery respect robots.txt and site terms?',
    answer:
      'The engine works with public search results returned through OpenAI\'s search-enabled models — it does not scrape logged-in surfaces such as LinkedIn behind authentication. You are responsible for how you use the returned data.',
  },

  // Apollo -------------------------------------------------------------------
  {
    category: 'apollo',
    question: 'How do I connect Apollo?',
    answer:
      'Open Settings → API Connections, paste your Apollo API key and save. Apollo becomes available inside AI Company Search and Prospect Search. Your key is stored encrypted and only used server-side.',
  },
  {
    category: 'apollo',
    question: 'Do Apollo credits come out of my Hiremetrics plan?',
    answer:
      'No. Apollo lookups consume credits on your Apollo account. Hiremetrics only meters its own AI usage.',
  },

  // Lusha --------------------------------------------------------------------
  {
    category: 'lusha',
    question: 'What does Lusha enrichment add?',
    answer:
      'Verified business email and direct-dial phone numbers for prospects surfaced in AI Company Search and Prospect Search. Enrichment runs on demand — no credits are consumed until you click enrich.',
  },

  // Vibe Prospecting ---------------------------------------------------------
  {
    category: 'vibe',
    question: 'What is Vibe Prospecting?',
    answer:
      'A specialised sourcing provider we integrate with for intent-based prospecting. Connect it under Settings → API Connections; results are ingested into the same Leads and Clients modules as native discovery.',
  },

  // Candidate Management -----------------------------------------------------
  {
    category: 'candidate_management',
    question: 'What is the Candidate 360 profile?',
    answer:
      'A single master record per candidate that consolidates every version of their CV, voice notes, email history, interviews, submissions across jobs and internal recruiter notes. It is the source of truth for that person across your workspace.',
  },
  {
    category: 'candidate_management',
    question: 'Can I import candidates in bulk?',
    answer:
      'Yes. Upload multiple CVs at once and the resume parser will normalise them into structured records. You can also add candidates one at a time or capture them from AI Discovery runs.',
  },

  // Client Management --------------------------------------------------------
  {
    category: 'client_management',
    question: 'How does the client portal work?',
    answer:
      'Invite a client contact by email. They set up their own login and see a scoped view of their jobs, submitted candidates, interviews and feedback. They cannot see other clients or internal notes.',
  },
  {
    category: 'client_management',
    question: 'Can I white-label the client portal?',
    answer:
      'Yes. Workspace owners can upload a logo and set a primary brand colour under Branding Settings; the client portal renders in those colours.',
  },

  // Resume Parsing -----------------------------------------------------------
  {
    category: 'resume_parsing',
    question: 'Which file types does the CV parser support?',
    answer:
      'PDF, DOCX and TXT are all supported. The parser extracts contact details, work history, education, skills and languages, and creates a structured candidate profile you can edit.',
  },
  {
    category: 'resume_parsing',
    question: 'Is parsing accurate for non-English CVs?',
    answer:
      'The parser handles most European languages, Arabic and CJK scripts via the underlying GPT-4o model. Accuracy is highest on structured, single-column CVs.',
  },

  // AI Matching --------------------------------------------------------------
  {
    category: 'ai_matching',
    question: 'How are AI match scores calculated?',
    answer:
      'Match scores use a weighted rubric: role match 40%, skills 30%, function 15%, location 10%, industry 5%. A rationale is produced for each candidate so you understand why the score was given.',
  },
  {
    category: 'ai_matching',
    question: 'Can I re-run matching after editing a job spec?',
    answer:
      'Yes. Any edit to the job description or requirements invalidates the previous run; re-run AI Match to refresh scores for the current candidate pool.',
  },

  // Reports ------------------------------------------------------------------
  {
    category: 'reports',
    question: 'What reports are included?',
    answer:
      'Pipeline health, recruiter activity, submissions, interviews booked, placements, revenue and time-to-fill. Managers see team roll-ups; recruiters see their own dashboard. All figures are derived from activity logs, never entered by hand.',
  },

  // Team ---------------------------------------------------------------------
  {
    category: 'team',
    question: 'Which roles are available?',
    answer:
      'Owner, Manager, Recruiter and Client User. Owners administer billing and team; Managers oversee assigned recruiters; Recruiters work their pipelines; Client Users get portal-only access. Permissions are enforced at the database level.',
  },
  {
    category: 'team',
    question: 'How do I invite a teammate?',
    answer:
      'Team Members → Invite. Choose a role and enter their email. They receive a signed invitation link and set their own password on first sign-in.',
  },

  // Finance ------------------------------------------------------------------
  {
    category: 'finance',
    question: 'Does Hiremetrics generate invoices?',
    answer:
      'Yes. Placements can be converted into branded PDF invoices, tracked against payment status and reconciled with recruiter bonuses. Payment recording is manual — Hiremetrics does not process customer-to-client payments.',
  },
  {
    category: 'finance',
    question: 'Can I track recruiter commissions?',
    answer:
      'Yes. Bonuses are calculated from placements with approval workflow so managers sign off before commission is recognised.',
  },

  // Billing ------------------------------------------------------------------
  {
    category: 'billing',
    question: 'What plans do you offer?',
    answer:
      'Three monthly plans in USD — Starter, Professional and Enterprise. Each has fixed limits on jobs, candidates, seats and AI usage. Pricing and included allowances are visible on the pricing page and inside your Billing Center.',
  },
  {
    category: 'billing',
    question: 'What happens when I hit a plan limit?',
    answer:
      'The action is blocked with a FEATURE_LIMIT_EXCEEDED response, an in-app upgrade prompt and a link to your Billing Center. Historical data is never deleted for exceeding a limit.',
  },

  // Stripe -------------------------------------------------------------------
  {
    category: 'stripe',
    question: 'How does Stripe payment work?',
    answer:
      'All subscriptions are billed through Stripe. Card data is captured and stored by Stripe — Hiremetrics never sees or stores your card number. Invoices, receipts and payment method changes are handled inside the Billing Center.',
  },
  {
    category: 'stripe',
    question: 'Can I download my Stripe invoices?',
    answer:
      'Yes. Billing → Invoices lists every Stripe invoice with a downloadable PDF and its payment status.',
  },

  // Trial --------------------------------------------------------------------
  {
    category: 'trial',
    question: 'Do you offer a free trial?',
    answer:
      'Yes. New workspaces receive a 7-day free trial with access to all features in their selected plan. No card is required to start and no charge is made until you explicitly subscribe.',
  },
  {
    category: 'trial',
    question: 'What happens at the end of the trial?',
    answer:
      'You will be prompted to enter a payment method. If you do not subscribe, the workspace is placed in read-only mode — you retain access to your data but cannot create new records until you activate a plan.',
  },

  // Cancel -------------------------------------------------------------------
  {
    category: 'cancel',
    question: 'How do I cancel my subscription?',
    answer:
      'Billing Center → Subscription → Cancel plan. Cancellation takes effect at the end of your current billing period; you retain full access until then. You can reactivate at any time.',
  },
  {
    category: 'cancel',
    question: 'Do I lose my data if I cancel?',
    answer:
      'No. Your workspace is retained in read-only mode for 90 days after cancellation so you can export data or reactivate. After 90 days the workspace is scheduled for deletion.',
  },

  // Upgrade / Downgrade ------------------------------------------------------
  {
    category: 'upgrade',
    question: 'Can I upgrade or downgrade at any time?',
    answer:
      'Yes. Upgrades take effect immediately and are prorated. Downgrades take effect at the next billing cycle and may reduce feature access if your workspace exceeds the new plan\'s limits.',
  },

  // Data Security ------------------------------------------------------------
  {
    category: 'data_security',
    question: 'How is my data encrypted?',
    answer:
      'Data in transit is encrypted with TLS 1.2+. Data at rest is encrypted using AES-256 on our managed Postgres and object storage. Sensitive credentials such as MFA secrets and integration API keys are stored in isolated tables with additional access controls.',
  },
  {
    category: 'data_security',
    question: 'Do you support two-factor authentication?',
    answer:
      'Yes. TOTP-based 2FA is available for every account and required for administrator roles. We recommend Google Authenticator, 1Password or Authy.',
  },

  // Multi-Tenant Security ----------------------------------------------------
  {
    category: 'multi_tenant_security',
    question: 'How do you keep my workspace isolated from other customers?',
    answer:
      'Every table is scoped by tenant_id and protected by Postgres Row-Level Security policies that check the authenticated user\'s tenant on every query. A user of one workspace cannot read or write another workspace\'s data, even through direct API calls.',
  },
  {
    category: 'multi_tenant_security',
    question: 'Can Hiremetrics staff see my data?',
    answer:
      'Only a small number of authorised engineers can access production data, and only for support incidents that you raise. Access is logged and reviewed. We do not view customer data for any other purpose.',
  },

  // API Connections ----------------------------------------------------------
  {
    category: 'api_connections',
    question: 'Where do I manage third-party API keys?',
    answer:
      'Settings → API Connections. Keys are encrypted at rest, scoped to your workspace and only decrypted server-side when calling the provider.',
  },
  {
    category: 'api_connections',
    question: 'Do you expose a public API?',
    answer:
      'A public developer API is on the roadmap. Enterprise customers can request early access.',
  },

  // Support ------------------------------------------------------------------
  {
    category: 'support',
    question: 'How do I get help?',
    answer:
      'Use the in-app chat widget, email admin@hiremetrics.co.uk, or open the Contact page. Response time is one business day; urgent production issues are prioritised.',
  },
  {
    category: 'support',
    question: 'Do you offer onboarding?',
    answer:
      'Yes. Professional and Enterprise plans include a guided onboarding session. Starter customers get access to our tutorial video library and email support.',
  },
];
