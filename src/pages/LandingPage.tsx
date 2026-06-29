import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { Logo, BRAND } from '@/components/brand/Logo';
import { BookDemoDialog } from '@/components/landing/BookDemoDialog';
import { WatchDemoDialog } from '@/components/landing/WatchDemoDialog';
import { PublicPromoBanner } from '@/components/promo/PublicPromoBanner';
import {
  ArrowRight, Brain, Users, Calendar, BarChart3, Sparkles, CheckCircle2,
  Play, Menu, X, Workflow, Target, Briefcase, Building2, Search, Wallet,
  Receipt, TrendingUp, Mail, Linkedin, Twitter, Github, Shield, Lock,
  ServerCog, KeyRound, FileText, MessageSquare, Globe, ChevronRight,
} from 'lucide-react';

/* Real product screenshots */
import dashboardImg from '@/assets/crm/dashboard.jpg';
import aiMatchImg from '@/assets/crm/ai-match.jpg';
import candidatesImg from '@/assets/crm/candidates.jpg';
import reportsImg from '@/assets/crm/reports.jpg';
import emailComposeImg from '@/assets/crm/email-compose.jpg';
import brandedCvImg from '@/assets/crm/branded-cv.jpg';
import financeImg from '@/assets/crm/finance.png';
import invoicesImg from '@/assets/crm/invoices.png';
import placementsImg from '@/assets/crm/placements.png';
import workTrackingImg from '@/assets/crm/work-tracking.png';
import teamPerfImg from '@/assets/crm/team-perf.png';
import eventsImg from '@/assets/crm/events.png';

/* Editorial photography */
import photoRecruiter from '@/assets/photo/recruiter-workspace.jpg';
import photoCollab from '@/assets/photo/collaboration.jpg';
import photoAI from '@/assets/photo/ai-abstract.jpg';
import photoBD from '@/assets/photo/business-development.jpg';
import photoFinance from '@/assets/photo/finance.jpg';
import photoTeam from '@/assets/photo/team.jpg';
import photoSecurity from '@/assets/photo/security.jpg';
import photoSourcing from '@/assets/photo/sourcing.jpg';

/* ---------------- Design tokens ---------------- */
const NAVY = '#182C6F';
const NAVY_DEEP = '#0F1F52';

const fadeUp = {
  initial: { opacity: 0, y: 24 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, margin: '-80px' },
  transition: { duration: 0.7, ease: [0.22, 1, 0.36, 1] },
} as const;

/* ---------------- Reusable bits ---------------- */

function Eyebrow({ children, dark = false }: { children: React.ReactNode; dark?: boolean }) {
  return (
    <div
      className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full border text-[11px] font-semibold uppercase tracking-[0.14em] ${
        dark
          ? 'bg-white/[0.06] border-white/15 text-white/80'
          : 'border-[color:var(--navy-15)] text-[color:var(--navy)]'
      }`}
      style={!dark ? { background: 'rgba(24,44,111,0.06)' } : undefined}
    >
      <Sparkles className="h-3 w-3" />
      {children}
    </div>
  );
}

function BrowserFrame({
  src,
  alt,
  className = '',
  url = 'app.hiremetrics.co.uk',
}: {
  src: string;
  alt: string;
  className?: string;
  url?: string;
}) {
  return (
    <div
      className={`group rounded-[20px] border border-slate-200/80 bg-white overflow-hidden ring-1 ring-black/[0.03] shadow-[0_30px_80px_-30px_rgba(24,44,111,0.35)] hover:shadow-[0_40px_100px_-25px_rgba(24,44,111,0.45)] transition-shadow duration-500 ${className}`}
    >
      <div className="h-9 bg-gradient-to-b from-slate-50 to-slate-100/60 border-b border-slate-200/70 flex items-center gap-2 px-4">
        <div className="flex gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-red-400/70" />
          <span className="w-2.5 h-2.5 rounded-full bg-yellow-400/70" />
          <span className="w-2.5 h-2.5 rounded-full bg-green-400/70" />
        </div>
        <div className="flex-1 flex justify-center">
          <div className="px-3 py-0.5 bg-white rounded-md text-[10px] text-slate-500 font-mono border border-slate-200/70">
            {url}
          </div>
        </div>
      </div>
      <img
        src={src}
        alt={alt}
        loading="lazy"
        onError={(e) => {
          const t = e.currentTarget;
          if (!t.dataset.fallback) {
            t.dataset.fallback = '1';
            t.src = '/placeholder.svg';
          }
        }}
        className="w-full block transition-transform duration-700 group-hover:scale-[1.01]"
      />
    </div>
  );
}

function PhotoFrame({ src, alt, className = '' }: { src: string; alt: string; className?: string }) {
  return (
    <div
      className={`rounded-[20px] overflow-hidden ring-1 ring-black/5 shadow-[0_30px_80px_-30px_rgba(24,44,111,0.45)] ${className}`}
    >
      <img src={src} alt={alt} loading="lazy" className="w-full h-full object-cover" />
    </div>
  );
}

/* ---------------- Feature row ---------------- */
type Row = {
  eyebrow: string;
  title: string;
  desc: string;
  bullets: string[];
  screenshot: string;
  photo: string;
  reverse?: boolean;
  url?: string;
};

function FeatureRow({ row }: { row: Row }) {
  return (
    <motion.div {...fadeUp} className="grid lg:grid-cols-12 gap-8 lg:gap-12 items-center">
      <div className={`lg:col-span-5 ${row.reverse ? 'lg:order-2' : ''}`}>
        <Eyebrow>{row.eyebrow}</Eyebrow>
        <h3
          className="mt-4 text-3xl md:text-4xl font-semibold tracking-tight leading-[1.1]"
          style={{ color: NAVY }}
        >
          {row.title}
        </h3>
        <p className="mt-4 text-base md:text-lg text-slate-600 leading-relaxed">{row.desc}</p>
        <ul className="mt-6 space-y-2.5">
          {row.bullets.map((b) => (
            <li key={b} className="flex items-start gap-3 text-[15px] text-slate-700">
              <CheckCircle2 className="h-5 w-5 mt-0.5 flex-shrink-0" style={{ color: NAVY }} />
              <span>{b}</span>
            </li>
          ))}
        </ul>
        <div className="mt-7">
          <Link to="/auth?mode=signup">
            <Button
              size="lg"
              className="h-11 px-6 gap-2 rounded-xl text-white"
              style={{ background: NAVY }}
            >
              Explore Feature <ArrowRight className="h-4 w-4" />
            </Button>
          </Link>
        </div>
      </div>
      <div className={`lg:col-span-7 ${row.reverse ? 'lg:order-1' : ''}`}>
        <div className="relative">
          <BrowserFrame src={row.screenshot} alt={row.title} url={row.url} />
          <div className="hidden md:block absolute -bottom-10 -right-6 w-56 h-36 lg:w-64 lg:h-40 rotate-3">
            <PhotoFrame src={row.photo} alt="" className="w-full h-full" />
          </div>
        </div>
      </div>
    </motion.div>
  );
}

/* ---------------- Data ---------------- */

const featureRows: Row[] = [
  {
    eyebrow: 'Candidate Management',
    title: 'A centralised database for every candidate you touch',
    desc:
      'Keep every candidate, every CV, every conversation in one structured workspace — searchable, filterable and instantly accessible to your whole team.',
    bullets: [
      'Centralised candidate database',
      'CV & resume management',
      'Full candidate history & timeline',
      'Advanced filtering and tags',
    ],
    screenshot: candidatesImg,
    photo: photoCollab,
    url: 'app.hiremetrics.co.uk/candidates',
  },
  {
    eyebrow: 'AI Candidate Discovery',
    title: 'Source qualified candidates with AI in minutes',
    desc:
      'Combine internal database search with open-web discovery to surface candidates that match the role — guided by an AI recruiter search builder.',
    bullets: [
      'AI-assisted candidate sourcing',
      'Recruiter search builder',
      'Role-based search templates',
      'Open-web + internal database',
    ],
    screenshot: dashboardImg,
    photo: photoSourcing,
    reverse: true,
    url: 'app.hiremetrics.co.uk/ai-candidate-discovery',
  },
  {
    eyebrow: 'AI Matching',
    title: 'Match the right person to the right role, instantly',
    desc:
      'Every candidate is scored against the job — skills, role similarity, gaps and recruiter recommendations — so you spend time on the shortlist, not the long list.',
    bullets: [
      'AI Match Score with rationale',
      'Skill comparison & gap analysis',
      'Role similarity scoring',
      'Recruiter insights & recommendations',
    ],
    screenshot: aiMatchImg,
    photo: photoAI,
    url: 'app.hiremetrics.co.uk/ai-match',
  },
  {
    eyebrow: 'Job Management',
    title: 'Run every job from intake to placement',
    desc:
      'Manage live roles, track applications, move candidates through structured pipelines and trigger AI matching from a single workspace.',
    bullets: [
      'Manage live jobs & requirements',
      'Track applications & sources',
      'Visual candidate pipelines',
      'AI matching per job',
    ],
    screenshot: brandedCvImg,
    photo: photoCollab,
    reverse: true,
    url: 'app.hiremetrics.co.uk/jobs',
  },
  {
    eyebrow: 'Client CRM',
    title: 'A CRM built for recruitment relationships',
    desc:
      'Manage clients, contacts and companies in one place. Log activity, track relationships and keep every interaction visible across the team.',
    bullets: [
      'Client, contact & company records',
      'Relationship & ownership tracking',
      'Activity feeds & notes',
      'Company-level context',
    ],
    screenshot: reportsImg,
    photo: photoBD,
    url: 'app.hiremetrics.co.uk/clients',
  },
  {
    eyebrow: 'Business Development',
    title: 'Find, research and convert new clients',
    desc:
      'Prospect Search, AI Prospect Search and Saved Leads work together to discover companies, research decision makers and turn prospects into CRM clients.',
    bullets: [
      'Prospect Search & AI Prospect Search',
      'Research companies & decision makers',
      'Save prospects to a structured pipeline',
      'One-click convert to CRM client',
    ],
    screenshot: emailComposeImg,
    photo: photoBD,
    reverse: true,
    url: 'app.hiremetrics.co.uk/leads',
  },
  {
    eyebrow: 'Submission Pipeline',
    title: 'Track every submission, interview and offer',
    desc:
      'Move candidates through client submission, interview, offer and placement stages — with status, owners and timestamps captured automatically.',
    bullets: [
      'Submission status tracking',
      'Interview progress & feedback',
      'Offer management',
      'Placement workflow',
    ],
    screenshot: placementsImg,
    photo: photoCollab,
    url: 'app.hiremetrics.co.uk/client-pipeline',
  },
  {
    eyebrow: 'Finance',
    title: 'Revenue, invoices and bonuses — in one place',
    desc:
      'Track placement revenue, generate branded invoices, manage recruiter bonuses and see the financial health of the business in real time.',
    bullets: [
      'Revenue & placement tracking',
      'Branded invoice generation',
      'Recruiter bonus management',
      'Financial reporting',
    ],
    screenshot: financeImg,
    photo: photoFinance,
    reverse: true,
    url: 'app.hiremetrics.co.uk/finance',
  },
  {
    eyebrow: 'Team Productivity',
    title: 'Manage your recruiters, hours and scheduling',
    desc:
      'Recruiter management, attendance, working hours, events scheduling, reporting and email integration — the operational backbone of the agency.',
    bullets: [
      'Team management & permissions',
      'Work tracking & attendance',
      'Events & interview scheduling',
      'Reports & email integration',
    ],
    screenshot: workTrackingImg,
    photo: photoTeam,
    url: 'app.hiremetrics.co.uk/work-tracking',
  },
  {
    eyebrow: 'Talent Intelligence',
    title: 'Context, memory and AI assessment for every decision',
    desc:
      'Recruiter notes, voice notes and AI assessment build a living context layer for every candidate — supporting better hiring decisions and executive insight.',
    bullets: [
      'Recruiter notes & voice notes',
      'Context memory per candidate',
      'AI assessment & decision support',
      'Executive insights',
    ],
    screenshot: teamPerfImg,
    photo: photoAI,
    reverse: true,
    url: 'app.hiremetrics.co.uk/talent-intelligence',
  },
];

const capabilityCards = [
  { icon: Brain, title: 'AI Candidate Discovery' },
  { icon: Sparkles, title: 'AI Matching Engine' },
  { icon: Building2, title: 'Business Development CRM' },
  { icon: Target, title: 'Placement Tracking' },
  { icon: TrendingUp, title: 'Revenue Dashboard' },
  { icon: BarChart3, title: 'Recruiter Analytics' },
  { icon: Receipt, title: 'Invoice Management' },
  { icon: Workflow, title: 'Team Productivity' },
  { icon: Mail, title: 'Email Integration' },
];

const whyCards = [
  {
    icon: Briefcase,
    title: 'Built for recruitment agencies',
    desc: 'Every module is designed around how agencies actually source, submit, place and invoice.',
  },
  {
    icon: Brain,
    title: 'AI-powered workflows',
    desc: 'AI discovery, matching, assessment and reports — embedded throughout the platform.',
  },
  {
    icon: ServerCog,
    title: 'Modern cloud architecture',
    desc: 'Built on a secure, scalable cloud stack with role-based access and tenant isolation.',
  },
  {
    icon: TrendingUp,
    title: 'Designed for growing teams',
    desc: 'From solo recruiters to multi-region agencies — the platform grows with your business.',
  },
];

const gallery = [
  { src: candidatesImg, label: 'Candidate Database' },
  { src: aiMatchImg, label: 'AI Matching' },
  { src: financeImg, label: 'Finance Dashboard' },
  { src: invoicesImg, label: 'Invoices' },
  { src: placementsImg, label: 'Placements & Revenue' },
  { src: workTrackingImg, label: 'Work Tracking' },
  { src: teamPerfImg, label: 'Team Performance' },
  { src: eventsImg, label: 'Events & Scheduling' },
  { src: brandedCvImg, label: 'Branded CV Export' },
];

/* ---------------- Page ---------------- */

export default function LandingPage() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [watchDemoOpen, setWatchDemoOpen] = useState(false);
  const [bookDemoOpen, setBookDemoOpen] = useState(false);
  const [demoVideoUrl, setDemoVideoUrl] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.rpc('get_public_platform_setting', { _key: 'demo_video_url' });
      if (data) {
        const url = typeof data === 'string' ? data.replace(/^"|"$/g, '') : String(data);
        setDemoVideoUrl(url || null);
      }
    })();
  }, []);

  return (
    <div
      className="min-h-screen bg-white text-slate-900 overflow-x-hidden"
      style={
        {
          ['--navy' as any]: NAVY,
          ['--navy-deep' as any]: NAVY_DEEP,
          ['--navy-15' as any]: 'rgba(24,44,111,0.15)',
        } as React.CSSProperties
      }
    >
      {/* ============ Header ============ */}
      <header className="fixed top-0 left-0 right-0 z-50 bg-white/85 backdrop-blur-xl border-b border-slate-200/60">
        <PublicPromoBanner />
        <div className="container mx-auto px-6 h-16 flex items-center justify-between">
          <Link to="/" className="flex items-center"><Logo size="md" /></Link>
          <nav className="hidden md:flex items-center gap-8">
            <a href="#platform" className="text-sm text-slate-600 hover:text-slate-900 transition-colors font-medium">Platform</a>
            <a href="#features" className="text-sm text-slate-600 hover:text-slate-900 transition-colors font-medium">Features</a>
            <a href="#gallery" className="text-sm text-slate-600 hover:text-slate-900 transition-colors font-medium">Gallery</a>
            <a href="#pricing" className="text-sm text-slate-600 hover:text-slate-900 transition-colors font-medium">Pricing</a>
            <Link to="/about" className="text-sm text-slate-600 hover:text-slate-900 transition-colors font-medium">About</Link>
          </nav>
          <div className="hidden md:flex items-center gap-3">
            <Link to="/auth"><Button variant="ghost" size="sm">Log in</Button></Link>
            <Button
              size="sm"
              className="text-white rounded-xl"
              style={{ background: NAVY }}
              onClick={() => setBookDemoOpen(true)}
            >
              Book a Demo
            </Button>
          </div>
          <button className="md:hidden p-2" onClick={() => setMobileMenuOpen(!mobileMenuOpen)} aria-label="Toggle menu">
            {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
        {mobileMenuOpen && (
          <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="md:hidden border-t border-slate-200 bg-white">
            <nav className="container mx-auto px-6 py-4 flex flex-col gap-2">
              <a href="#platform" onClick={() => setMobileMenuOpen(false)} className="py-2 text-slate-600">Platform</a>
              <a href="#features" onClick={() => setMobileMenuOpen(false)} className="py-2 text-slate-600">Features</a>
              <a href="#gallery" onClick={() => setMobileMenuOpen(false)} className="py-2 text-slate-600">Gallery</a>
              <a href="#pricing" onClick={() => setMobileMenuOpen(false)} className="py-2 text-slate-600">Pricing</a>
              <Link to="/about" onClick={() => setMobileMenuOpen(false)} className="py-2 text-slate-600">About</Link>
              <div className="flex flex-col gap-2 pt-4 border-t border-slate-200">
                <Link to="/auth" onClick={() => setMobileMenuOpen(false)}><Button variant="outline" className="w-full">Log in</Button></Link>
                <Button className="w-full text-white" style={{ background: NAVY }} onClick={() => { setMobileMenuOpen(false); setBookDemoOpen(true); }}>
                  Book a Demo
                </Button>
              </div>
            </nav>
          </motion.div>
        )}
      </header>

      {/* ============ HERO ============ */}
      <section className="relative pt-32 pb-20 md:pt-44 md:pb-32 px-5 sm:px-6 overflow-hidden">
        {/* Background gradient */}
        <div className="absolute inset-0 -z-10">
          <div
            className="absolute inset-0"
            style={{
              background:
                'radial-gradient(1200px 600px at 50% -10%, rgba(24,44,111,0.18), transparent 60%), radial-gradient(900px 500px at 80% 20%, rgba(59,130,246,0.10), transparent 60%), linear-gradient(180deg, #F7F9FE 0%, #FFFFFF 60%)',
            }}
          />
          <div
            className="absolute inset-0 opacity-[0.035]"
            style={{
              backgroundImage:
                'linear-gradient(to right, #0F1F52 1px, transparent 1px), linear-gradient(to bottom, #0F1F52 1px, transparent 1px)',
              backgroundSize: '64px 64px',
              maskImage: 'radial-gradient(ellipse at top, black 30%, transparent 75%)',
            }}
          />
        </div>

        <div className="container mx-auto max-w-7xl">
          <div className="grid lg:grid-cols-12 gap-12 items-center">
            <motion.div {...fadeUp} className="lg:col-span-6 space-y-7">
              <Eyebrow>AI Recruitment Operating System</Eyebrow>
              <h1
                className="text-4xl sm:text-5xl lg:text-[60px] font-semibold tracking-tight leading-[1.05]"
                style={{ color: NAVY }}
              >
                AI Recruitment Platform Built for{' '}
                <span
                  className="bg-clip-text text-transparent"
                  style={{ backgroundImage: `linear-gradient(90deg, ${NAVY}, #3B82F6)` }}
                >
                  Modern Recruitment Teams
                </span>
              </h1>
              <p className="text-lg md:text-xl text-slate-600 leading-relaxed max-w-xl">
                Manage your entire recruitment workflow from one intelligent platform. Discover candidates,
                match talent with AI, manage clients, track placements, monitor recruiter performance and grow
                your recruitment business — all in one workspace.
              </p>
              <div className="flex flex-col sm:flex-row gap-3 pt-2">
                <Button
                  size="lg"
                  className="h-12 px-7 gap-2 rounded-xl text-white"
                  style={{ background: NAVY }}
                  onClick={() => setBookDemoOpen(true)}
                >
                  Book a Demo <ArrowRight className="h-4 w-4" />
                </Button>
                <Button
                  size="lg"
                  variant="outline"
                  className="h-12 px-7 gap-2 rounded-xl border-slate-300"
                  onClick={() => setWatchDemoOpen(true)}
                >
                  <Play className="h-4 w-4" /> Explore the Platform
                </Button>
              </div>
              <div className="flex items-center gap-6 pt-4 text-sm text-slate-500">
                <div className="flex items-center gap-2"><Shield className="h-4 w-4" style={{ color: NAVY }} /> Enterprise-grade security</div>
                <div className="hidden sm:flex items-center gap-2"><Globe className="h-4 w-4" style={{ color: NAVY }} /> Cloud platform</div>
              </div>
            </motion.div>

            {/* Layered hero mockups */}
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1] }}
              className="lg:col-span-6 relative h-[520px] hidden lg:block"
            >
              <div className="absolute inset-0">
                <div className="absolute top-0 right-0 w-[88%] rotate-[2deg]">
                  <BrowserFrame src={dashboardImg} alt="Dashboard" url="app.hiremetrics.co.uk/dashboard" />
                </div>
                <div className="absolute top-[170px] left-0 w-[60%] -rotate-[3deg]">
                  <BrowserFrame src={aiMatchImg} alt="AI Matching" url="app.hiremetrics.co.uk/ai-match" />
                </div>
                <div className="absolute bottom-0 right-[6%] w-[58%] rotate-[4deg]">
                  <BrowserFrame src={financeImg} alt="Finance Dashboard" url="app.hiremetrics.co.uk/finance" />
                </div>
                <div className="absolute bottom-[40px] left-[8%] w-[40%] -rotate-[5deg]">
                  <BrowserFrame src={candidatesImg} alt="Candidates" url="app.hiremetrics.co.uk/candidates" />
                </div>
              </div>
            </motion.div>

            {/* Mobile hero mockup */}
            <div className="lg:hidden">
              <BrowserFrame src={dashboardImg} alt="Dashboard preview" url="app.hiremetrics.co.uk/dashboard" />
            </div>
          </div>
        </div>
      </section>

      {/* ============ PLATFORM OVERVIEW ============ */}
      <section id="platform" className="py-20 md:py-32 px-5 sm:px-6 bg-slate-50/60 border-y border-slate-200/60">
        <div className="container mx-auto max-w-7xl">
          <motion.div {...fadeUp} className="text-center max-w-3xl mx-auto mb-14">
            <Eyebrow>Platform Overview</Eyebrow>
            <h2 className="mt-4 text-3xl md:text-5xl font-semibold tracking-tight" style={{ color: NAVY }}>
              Everything You Need to Run a Recruitment Business
            </h2>
            <p className="mt-5 text-lg text-slate-600 leading-relaxed">
              HireMetrics is an all-in-one recruitment operating system. Candidates, clients, submissions,
              placements, finance and team performance — managed in one connected workspace built for modern
              recruitment teams.
            </p>
          </motion.div>

          <motion.div {...fadeUp} className="grid lg:grid-cols-12 gap-10 items-center">
            <div className="lg:col-span-7">
              <BrowserFrame src={dashboardImg} alt="HireMetrics dashboard" url="app.hiremetrics.co.uk/dashboard" />
            </div>
            <div className="lg:col-span-5">
              <PhotoFrame src={photoRecruiter} alt="Recruiter at workstation" className="aspect-[4/3]" />
            </div>
          </motion.div>
        </div>
      </section>

      {/* ============ FEATURE ROWS ============ */}
      <section id="features" className="py-20 md:py-32 px-5 sm:px-6">
        <div className="container mx-auto max-w-7xl space-y-28 md:space-y-36">
          {featureRows.map((row) => (
            <FeatureRow key={row.title} row={row} />
          ))}
        </div>
      </section>

      {/* ============ PLATFORM HIGHLIGHTS ============ */}
      <section className="py-20 md:py-32 px-5 sm:px-6 bg-slate-50/60 border-y border-slate-200/60">
        <div className="container mx-auto max-w-7xl">
          <motion.div {...fadeUp} className="text-center max-w-3xl mx-auto mb-14">
            <Eyebrow>Platform Highlights</Eyebrow>
            <h2 className="mt-4 text-3xl md:text-5xl font-semibold tracking-tight" style={{ color: NAVY }}>
              Every capability your agency needs
            </h2>
            <p className="mt-4 text-lg text-slate-600">
              A connected set of modules built for recruitment teams — not a generic CRM bolted onto a spreadsheet.
            </p>
          </motion.div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {capabilityCards.map(({ icon: Icon, title }) => (
              <motion.div
                key={title}
                {...fadeUp}
                className="rounded-[20px] border border-slate-200 bg-white p-6 hover:border-[color:var(--navy-15)] hover:shadow-[0_10px_30px_-10px_rgba(24,44,111,0.25)] transition-all"
              >
                <div
                  className="w-11 h-11 rounded-xl flex items-center justify-center mb-4"
                  style={{ background: 'rgba(24,44,111,0.08)' }}
                >
                  <Icon className="h-5 w-5" style={{ color: NAVY }} />
                </div>
                <h3 className="text-base font-semibold" style={{ color: NAVY }}>{title}</h3>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ============ WHY HIREMETRICS ============ */}
      <section className="py-20 md:py-32 px-5 sm:px-6">
        <div className="container mx-auto max-w-7xl">
          <div className="grid lg:grid-cols-12 gap-12 items-center mb-16">
            <motion.div {...fadeUp} className="lg:col-span-5">
              <Eyebrow>Why HireMetrics</Eyebrow>
              <h2 className="mt-4 text-3xl md:text-5xl font-semibold tracking-tight" style={{ color: NAVY }}>
                The recruitment platform agencies grow into — not out of
              </h2>
              <p className="mt-5 text-lg text-slate-600 leading-relaxed">
                Built for the way modern recruitment teams actually work — with AI at the core, clear workflows,
                and a financial layer that ties everything together.
              </p>
            </motion.div>
            <motion.div {...fadeUp} className="lg:col-span-7">
              <PhotoFrame src={photoTeam} alt="Recruitment team collaborating" className="aspect-[16/10]" />
            </motion.div>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-5">
            {whyCards.map(({ icon: Icon, title, desc }) => (
              <motion.div
                key={title}
                {...fadeUp}
                className="rounded-[20px] border border-slate-200 bg-white p-7 hover:shadow-[0_20px_50px_-20px_rgba(24,44,111,0.25)] transition-all"
              >
                <div
                  className="w-12 h-12 rounded-xl flex items-center justify-center mb-5"
                  style={{ background: 'rgba(24,44,111,0.08)' }}
                >
                  <Icon className="h-6 w-6" style={{ color: NAVY }} />
                </div>
                <h3 className="text-lg font-semibold mb-2" style={{ color: NAVY }}>{title}</h3>
                <p className="text-sm text-slate-600 leading-relaxed">{desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ============ PRODUCT GALLERY ============ */}
      <section id="gallery" className="py-20 md:py-32 px-5 sm:px-6 bg-slate-50/60 border-y border-slate-200/60">
        <div className="container mx-auto max-w-7xl">
          <motion.div {...fadeUp} className="text-center max-w-3xl mx-auto mb-14">
            <Eyebrow>Product Gallery</Eyebrow>
            <h2 className="mt-4 text-3xl md:text-5xl font-semibold tracking-tight" style={{ color: NAVY }}>
              A closer look at the platform
            </h2>
            <p className="mt-4 text-lg text-slate-600">
              Real screenshots from the live HireMetrics application.
            </p>
          </motion.div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {gallery.map((g) => (
              <motion.div key={g.label} {...fadeUp} className="group">
                <BrowserFrame src={g.src} alt={g.label} className="group-hover:-translate-y-1 transition-transform duration-500" />
                <p className="mt-3 text-sm font-medium text-slate-700 pl-1">{g.label}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ============ SECURITY ============ */}
      <section className="py-20 md:py-32 px-5 sm:px-6 relative overflow-hidden" style={{ background: NAVY_DEEP }}>
        <div className="absolute inset-0 opacity-40">
          <img src={photoSecurity} alt="" className="w-full h-full object-cover" loading="lazy" />
        </div>
        <div className="absolute inset-0" style={{ background: `linear-gradient(180deg, ${NAVY_DEEP}E6, ${NAVY_DEEP}F2)` }} />
        <div className="container mx-auto max-w-7xl relative">
          <motion.div {...fadeUp} className="text-center max-w-3xl mx-auto mb-14">
            <Eyebrow dark>Security & Trust</Eyebrow>
            <h2 className="mt-4 text-3xl md:text-5xl font-semibold tracking-tight text-white">
              Enterprise-grade security, by default
            </h2>
            <p className="mt-4 text-lg text-white/70">
              Role-based access, encrypted data, audit logging and tenant isolation built into the foundation.
            </p>
          </motion.div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-5">
            {[
              { icon: Shield, title: 'Enterprise architecture', desc: 'Modern, multi-tenant cloud platform with strict isolation.' },
              { icon: KeyRound, title: 'Role-based permissions', desc: 'Owner, Manager and Recruiter roles with granular access.' },
              { icon: Lock, title: 'Encrypted data', desc: 'Data encrypted in transit and at rest across the platform.' },
              { icon: FileText, title: 'Audit logs', desc: 'Every sensitive action is captured for accountability.' },
            ].map(({ icon: Icon, title, desc }) => (
              <div
                key={title}
                className="rounded-[20px] border border-white/10 bg-white/[0.04] backdrop-blur-md p-7 hover:bg-white/[0.07] transition-colors"
              >
                <div className="w-12 h-12 rounded-xl flex items-center justify-center mb-5 bg-white/10">
                  <Icon className="h-6 w-6 text-white" />
                </div>
                <h3 className="text-lg font-semibold text-white mb-2">{title}</h3>
                <p className="text-sm text-white/70 leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ============ PRICING ============ */}
      <section id="pricing" className="py-20 md:py-32 px-5 sm:px-6">
        <div className="container mx-auto max-w-7xl">
          <motion.div {...fadeUp} className="text-center max-w-3xl mx-auto mb-14">
            <Eyebrow>Pricing</Eyebrow>
            <h2 className="mt-4 text-3xl md:text-5xl font-semibold tracking-tight" style={{ color: NAVY }}>
              Simple, transparent pricing
            </h2>
            <p className="mt-4 text-lg text-slate-600">
              Choose the plan that fits your team — full pricing details published soon.
            </p>
          </motion.div>

          <div className="grid md:grid-cols-3 gap-6 max-w-5xl mx-auto">
            {[
              { name: 'Starter', desc: 'For solo recruiters getting started.', cta: 'Coming Soon' },
              { name: 'Professional', desc: 'For growing recruitment teams.', cta: 'Coming Soon', highlight: true },
              { name: 'Enterprise', desc: 'For multi-region recruitment agencies.', cta: 'Contact Sales' },
            ].map((p) => (
              <motion.div
                key={p.name}
                {...fadeUp}
                className={`rounded-[20px] p-8 border transition-all ${
                  p.highlight
                    ? 'bg-white shadow-[0_30px_80px_-30px_rgba(24,44,111,0.35)] border-[color:var(--navy-15)] scale-[1.02]'
                    : 'bg-white border-slate-200'
                }`}
              >
                <h3 className="text-xl font-semibold" style={{ color: NAVY }}>{p.name}</h3>
                <p className="mt-2 text-sm text-slate-600">{p.desc}</p>
                <div className="mt-6 text-3xl font-semibold text-slate-400">—</div>
                <p className="text-xs text-slate-500 mt-1">Pricing announced soon</p>
                <Button
                  className="mt-8 w-full text-white rounded-xl"
                  style={{ background: p.highlight ? NAVY : '#0F172A' }}
                  onClick={() => setBookDemoOpen(true)}
                >
                  {p.cta}
                </Button>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ============ FINAL CTA ============ */}
      <section className="py-20 md:py-32 px-5 sm:px-6">
        <div className="container mx-auto max-w-6xl">
          <motion.div
            {...fadeUp}
            className="relative rounded-[28px] overflow-hidden p-10 md:p-16 text-center"
            style={{ background: `linear-gradient(135deg, ${NAVY} 0%, ${NAVY_DEEP} 100%)` }}
          >
            <div
              className="absolute inset-0 opacity-[0.08]"
              style={{
                backgroundImage:
                  'linear-gradient(to right, #fff 1px, transparent 1px), linear-gradient(to bottom, #fff 1px, transparent 1px)',
                backgroundSize: '48px 48px',
              }}
            />
            <div className="relative">
              <Eyebrow dark>Get Started</Eyebrow>
              <h2 className="mt-4 text-3xl md:text-5xl font-semibold tracking-tight text-white max-w-3xl mx-auto">
                Ready to See HireMetrics in Action?
              </h2>
              <p className="mt-5 text-lg text-white/75 max-w-2xl mx-auto">
                Explore how HireMetrics helps recruitment teams manage candidates, clients, placements,
                finance and business development from a single platform.
              </p>
              <div className="mt-8 flex flex-col sm:flex-row gap-3 justify-center">
                <Button
                  size="lg"
                  className="h-12 px-8 gap-2 rounded-xl bg-white hover:bg-white/90"
                  style={{ color: NAVY }}
                  onClick={() => setBookDemoOpen(true)}
                >
                  Book a Demo <ArrowRight className="h-4 w-4" />
                </Button>
                <Button
                  size="lg"
                  variant="outline"
                  className="h-12 px-8 gap-2 rounded-xl border-white/30 text-white bg-white/5 hover:bg-white/10"
                  onClick={() => setWatchDemoOpen(true)}
                >
                  <Play className="h-4 w-4" /> Explore the Platform
                </Button>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* ============ FOOTER ============ */}
      <footer className="border-t border-slate-200 bg-white pt-16 pb-10 px-5 sm:px-6">
        <div className="container mx-auto max-w-7xl">
          <div className="grid md:grid-cols-5 gap-10 mb-12">
            <div className="md:col-span-2">
              <Logo size="md" />
              <p className="mt-4 text-sm text-slate-600 max-w-sm leading-relaxed">
                {BRAND.name} — an AI-powered recruitment operating system for modern recruitment teams.
              </p>
              <div className="flex items-center gap-3 mt-5">
                <a href="#" aria-label="LinkedIn" className="w-9 h-9 rounded-lg border border-slate-200 flex items-center justify-center hover:border-[color:var(--navy-15)] text-slate-500 hover:text-[color:var(--navy)]"><Linkedin className="h-4 w-4" /></a>
                <a href="#" aria-label="Twitter" className="w-9 h-9 rounded-lg border border-slate-200 flex items-center justify-center hover:border-[color:var(--navy-15)] text-slate-500 hover:text-[color:var(--navy)]"><Twitter className="h-4 w-4" /></a>
                <a href="#" aria-label="GitHub" className="w-9 h-9 rounded-lg border border-slate-200 flex items-center justify-center hover:border-[color:var(--navy-15)] text-slate-500 hover:text-[color:var(--navy)]"><Github className="h-4 w-4" /></a>
              </div>
            </div>
            <div>
              <h4 className="text-sm font-semibold mb-4" style={{ color: NAVY }}>Platform</h4>
              <ul className="space-y-2.5 text-sm text-slate-600">
                <li><a href="#features" className="hover:text-slate-900">Features</a></li>
                <li><a href="#gallery" className="hover:text-slate-900">Gallery</a></li>
                <li><a href="#pricing" className="hover:text-slate-900">Pricing</a></li>
                <li><span className="text-slate-400">Documentation (Coming Soon)</span></li>
              </ul>
            </div>
            <div>
              <h4 className="text-sm font-semibold mb-4" style={{ color: NAVY }}>Company</h4>
              <ul className="space-y-2.5 text-sm text-slate-600">
                <li><Link to="/about" className="hover:text-slate-900">About</Link></li>
                <li><Link to="/contact" className="hover:text-slate-900">Contact</Link></li>
              </ul>
            </div>
            <div>
              <h4 className="text-sm font-semibold mb-4" style={{ color: NAVY }}>Legal</h4>
              <ul className="space-y-2.5 text-sm text-slate-600">
                <li><Link to="/privacy" className="hover:text-slate-900">Privacy Policy</Link></li>
                <li><Link to="/terms" className="hover:text-slate-900">Terms</Link></li>
                <li><Link to="/cookies" className="hover:text-slate-900">Cookies</Link></li>
              </ul>
            </div>
          </div>
          <div className="pt-8 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-4">
            <p className="text-xs text-slate-500">© {new Date().getFullYear()} {BRAND.name}. All rights reserved.</p>
            <p className="text-xs text-slate-500">Built for modern recruitment teams.</p>
          </div>
        </div>
      </footer>

      {/* Dialogs */}
      <BookDemoDialog open={bookDemoOpen} onOpenChange={setBookDemoOpen} />
      <WatchDemoDialog open={watchDemoOpen} onOpenChange={setWatchDemoOpen} videoUrl={demoVideoUrl} />
    </div>
  );
}
