import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { Logo, BRAND } from '@/components/brand/Logo';
import { BookDemoDialog } from '@/components/landing/BookDemoDialog';
import { WatchDemoDialog } from '@/components/landing/WatchDemoDialog';
import { PublicPromoBanner } from '@/components/promo/PublicPromoBanner';
import { usePublicPricingPlans } from '@/hooks/usePublicPricingPlans';
import {
  ArrowRight, Brain, Users, Mail, Calendar, BarChart3,
  Sparkles, CheckCircle2, Play, Menu, X, Activity,
  Timer, Zap, Workflow, Target, Eye, Rocket, Linkedin, Twitter, Github, Star,
} from 'lucide-react';

import dashboardImg from '@/assets/crm/dashboard.jpg';
import aiMatchImg from '@/assets/crm/ai-match.jpg';
import candidatesImg from '@/assets/crm/candidates.jpg';
import teamPerfImg from '@/assets/crm/team-performance.jpg';
import reportsImg from '@/assets/crm/reports.jpg';
import emailComposeImg from '@/assets/crm/email-compose.jpg';
import brandedCvImg from '@/assets/crm/branded-cv.jpg';
import { Shield, Lock, KeyRound, ServerCog } from 'lucide-react';

/* ---------------- Reusable bits ---------------- */

const fadeUp = {
  initial: { opacity: 0, y: 20 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, margin: '-80px' },
  transition: { duration: 0.6 },
} as const;

function Eyebrow({ children, dark = false }: { children: React.ReactNode; dark?: boolean }) {
  return (
    <div className={`inline-flex items-center gap-2 px-3 py-1 rounded-full border text-[11px] font-semibold uppercase tracking-[0.12em] ${
      dark ? 'bg-white/5 border-white/10 text-white/70' : 'bg-primary/5 border-primary/15 text-primary'
    }`}>
      <Sparkles className="h-3 w-3" />
      {children}
    </div>
  );
}

/* Premium browser frame */
function DashboardFrame({ src, alt, className = '' }: { src: string; alt: string; className?: string }) {
  return (
    <div className={`group rounded-2xl border border-border/70 bg-card shadow-[0_40px_100px_-25px_rgba(15,23,42,0.35)] hover:shadow-[0_50px_120px_-25px_rgba(59,130,246,0.35)] transition-shadow duration-500 overflow-hidden ring-1 ring-black/[0.04] ${className}`}>
      <div className="h-9 bg-gradient-to-b from-muted/60 to-muted/30 border-b border-border/60 flex items-center gap-2 px-4">
        <div className="flex gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-red-400/80" />
          <span className="w-2.5 h-2.5 rounded-full bg-yellow-400/80" />
          <span className="w-2.5 h-2.5 rounded-full bg-green-400/80" />
        </div>
        <div className="flex-1 flex justify-center">
          <div className="px-3 py-0.5 bg-background rounded-md text-[10px] text-muted-foreground font-mono border border-border/40">
            app.hiremetrics.io
          </div>
        </div>
      </div>
      <img src={src} alt={alt} className="w-full block transition-transform duration-700 group-hover:scale-[1.01]" loading="lazy" />
    </div>
  );
}

/* ---------------- Operational Value Cards ---------------- */

const valueCards = [
  { icon: Rocket, title: 'Faster Placements', desc: 'Move candidates from CV to placement in days, not weeks, with AI-driven pipelines.' },
  { icon: Brain, title: 'AI Candidate Matching', desc: 'Match scores, skill gaps, and shortlist suggestions generated automatically.' },
  { icon: Timer, title: 'Recruiter Productivity', desc: 'Automate parsing, outreach, and follow-ups so recruiters focus on closing.' },
  { icon: Workflow, title: 'Workflow Automation', desc: 'Standardised stages, reminders, and handoffs across your entire team.' },
  { icon: Target, title: 'Centralized Operations', desc: 'Jobs, candidates, clients, and communications in one operating system.' },
  { icon: Eye, title: 'Team Visibility', desc: 'Live recruiter activity, pipeline health, and KPI tracking for managers.' },
];

/* ---------------- Bento Features (cleaner, fewer) ---------------- */

const featureRows = [
  {
    eyebrow: 'AI Candidate Validation',
    title: 'Score every candidate in seconds',
    desc: 'AI analyses each CV against the role — surfacing match score, strengths, gaps, and a hiring recommendation. Recruiters skip the noise and act on signal.',
    bullets: ['Match scoring with rationale', 'Strengths & skill gap analysis', 'Instant shortlist suggestions'],
    img: aiMatchImg,
  },
  {
    eyebrow: 'Pipeline & Operations',
    title: 'One workspace for the entire recruiting motion',
    desc: 'Manage every job, every candidate, every stage in one structured pipeline — no spreadsheets, no scattered tools, no lost context.',
    bullets: ['Drag-and-drop candidate stages', 'Branded CV export for clients', 'Interviews & events scheduling'],
    img: candidatesImg,
    reverse: true,
  },
  {
    eyebrow: 'Team Performance',
    title: 'Recruiter productivity, made visible',
    desc: 'Track submissions, interviews, placements, and recruiter activity automatically — derived from real work, not manual entries.',
    bullets: ['Automatic activity logging', 'Manager dashboards & KPIs', 'Real-time work tracking'],
    img: teamPerfImg,
  },
];

/* ---------------- Page ---------------- */

export default function LandingPage() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [watchDemoOpen, setWatchDemoOpen] = useState(false);
  const [bookDemoOpen, setBookDemoOpen] = useState(false);
  const [demoVideoUrl, setDemoVideoUrl] = useState<string | null>(null);
  const { plans: pricingPlans } = usePublicPricingPlans();

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from('platform_settings')
        .select('value')
        .eq('key', 'demo_video_url')
        .single();
      if (data?.value) {
        const url = typeof data.value === 'string' ? data.value.replace(/^"|"$/g, '') : String(data.value);
        setDemoVideoUrl(url || null);
      }
    })();
  }, []);

  return (
    <div className="min-h-screen bg-background overflow-x-hidden">
      {/* ============ Header ============ */}
      <header className="fixed top-0 left-0 right-0 z-50 bg-background/80 backdrop-blur-xl border-b border-border/40">
        <PublicPromoBanner />
        <div className="container mx-auto px-6 h-16 flex items-center justify-between">
          <Link to="/" className="flex items-center"><Logo size="md" /></Link>
          <nav className="hidden md:flex items-center gap-8">
            <a href="#features" className="text-sm text-muted-foreground hover:text-foreground transition-colors font-medium">Features</a>
            <a href="#platform" className="text-sm text-muted-foreground hover:text-foreground transition-colors font-medium">Platform</a>
            <a href="#pricing" className="text-sm text-muted-foreground hover:text-foreground transition-colors font-medium">Pricing</a>
            <Link to="/about" className="text-sm text-muted-foreground hover:text-foreground transition-colors font-medium">About</Link>
          </nav>
          <div className="hidden md:flex items-center gap-3">
            <Link to="/auth"><Button variant="ghost" size="sm">Log in</Button></Link>
            <Link to="/auth?mode=signup"><Button size="sm">Start Free Trial</Button></Link>
          </div>
          <button className="md:hidden p-2" onClick={() => setMobileMenuOpen(!mobileMenuOpen)} aria-label="Toggle menu">
            {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
        {mobileMenuOpen && (
          <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="md:hidden border-t border-border bg-background">
            <nav className="container mx-auto px-6 py-4 flex flex-col gap-2">
              <a href="#features" onClick={() => setMobileMenuOpen(false)} className="py-2 text-muted-foreground">Features</a>
              <a href="#platform" onClick={() => setMobileMenuOpen(false)} className="py-2 text-muted-foreground">Platform</a>
              <a href="#pricing" onClick={() => setMobileMenuOpen(false)} className="py-2 text-muted-foreground">Pricing</a>
              <Link to="/about" onClick={() => setMobileMenuOpen(false)} className="py-2 text-muted-foreground">About</Link>
              <div className="flex flex-col gap-2 pt-4 border-t border-border">
                <Link to="/auth" onClick={() => setMobileMenuOpen(false)}><Button variant="outline" className="w-full">Log in</Button></Link>
                <Link to="/auth?mode=signup" onClick={() => setMobileMenuOpen(false)}><Button className="w-full">Start Free Trial</Button></Link>
              </div>
            </nav>
          </motion.div>
        )}
      </header>

      {/* ============ HERO ============ */}
      <section className="relative pt-28 pb-14 md:pt-40 md:pb-28 px-5 sm:px-6 overflow-hidden">
        <div className="absolute inset-0 -z-10">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[900px] h-[500px] bg-gradient-to-br from-primary/15 via-primary/5 to-transparent rounded-full blur-3xl" />
          <div
            className="absolute inset-0 opacity-[0.03]"
            style={{
              backgroundImage:
                'linear-gradient(to right, hsl(var(--foreground)) 1px, transparent 1px), linear-gradient(to bottom, hsl(var(--foreground)) 1px, transparent 1px)',
              backgroundSize: '72px 72px',
              maskImage: 'radial-gradient(ellipse at top, black 30%, transparent 70%)',
            }}
          />
        </div>

        <div className="container mx-auto max-w-7xl">
          <motion.div {...fadeUp} className="text-center max-w-4xl mx-auto space-y-6">
            <Eyebrow>AI Recruitment Operating System</Eyebrow>
            <h1 className="text-4xl sm:text-5xl lg:text-[68px] font-bold tracking-tight leading-[1.05] text-foreground">
              Close More Placements.<br />
              <span className="bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
                Not More Admin Work.
              </span>
            </h1>
            <p className="text-lg md:text-xl text-muted-foreground max-w-3xl mx-auto leading-relaxed">
              The AI-powered recruitment operating system helping agencies streamline hiring
              workflows, validate candidates, automate outreach, and track recruiter productivity.
            </p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center pt-2">
              <Link to="/auth?mode=signup">
                <Button size="lg" className="h-12 px-7 gap-2 w-full sm:w-auto">
                  Start Free Trial <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
              <Button size="lg" variant="outline" className="h-12 px-7 gap-2" onClick={() => setBookDemoOpen(true)}>
                <Play className="h-4 w-4" /> Book Demo
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">No credit card · 14-day free trial · Cancel anytime</p>
          </motion.div>

          {/* Dashboard showcase — full-width hero */}
          <motion.div
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.9, delay: 0.25 }}
            className="relative mt-16 max-w-6xl mx-auto"
          >
            <div className="absolute -inset-8 bg-gradient-to-tr from-primary/20 via-accent/10 to-transparent rounded-[2rem] blur-3xl opacity-70 -z-10" />
            <DashboardFrame src={dashboardImg} alt="HireMetrics recruiter dashboard" />

            {/* Floating activity chips */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.7 }}
              className="hidden md:flex absolute -left-6 top-20 items-center gap-2 px-3.5 py-2.5 rounded-xl bg-card border border-border shadow-xl text-xs font-semibold"
            >
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              95% Match Score
            </motion.div>
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.85 }}
              className="hidden md:flex absolute -right-6 top-32 items-center gap-2 px-3.5 py-2.5 rounded-xl bg-card border border-border shadow-xl text-xs font-semibold"
            >
              <Calendar className="h-3.5 w-3.5 text-primary" />
              Interview Scheduled
            </motion.div>
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 1.0 }}
              className="hidden lg:flex absolute -left-4 bottom-28 items-center gap-2 px-3.5 py-2.5 rounded-xl bg-card border border-border shadow-xl text-xs font-semibold"
            >
              <Sparkles className="h-3.5 w-3.5 text-accent" />
              Candidate Rediscovered
            </motion.div>
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 1.15 }}
              className="hidden md:flex absolute -right-4 bottom-20 items-center gap-2 px-3.5 py-2.5 rounded-xl bg-card border border-border shadow-xl text-xs font-semibold"
            >
              <Mail className="h-3.5 w-3.5 text-emerald-600" />
              Email Sent Successfully
            </motion.div>
          </motion.div>
        </div>
      </section>

      {/* ============ PRODUCT DEMO VIDEO ============ */}
      <section className="relative py-16 md:py-24 px-5 sm:px-6 overflow-hidden bg-[#070b14] text-white">
        <div className="absolute inset-0 -z-0">
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[900px] h-[500px] bg-gradient-to-br from-primary/25 via-primary/5 to-transparent rounded-full blur-3xl" />
        </div>
        <div className="relative container mx-auto max-w-5xl">
          <motion.div {...fadeUp} className="text-center max-w-2xl mx-auto mb-10 md:mb-14">
            <Eyebrow dark>2-minute product walkthrough</Eyebrow>
            <h2 className="text-3xl md:text-[44px] font-bold tracking-tight mt-4 leading-tight">
              See HireMetrics in action
            </h2>
            <p className="text-white/70 mt-4 text-base md:text-lg leading-relaxed">
              Watch how recruitment agencies manage candidates, automate outreach, validate
              candidates with AI, and track recruiter productivity from one platform.
            </p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-80px' }}
            transition={{ duration: 0.8 }}
            className="relative group"
          >
            <div className="absolute -inset-4 md:-inset-6 bg-gradient-to-tr from-primary/40 via-accent/20 to-transparent rounded-[2rem] blur-3xl opacity-60 -z-10" />
            <div className="relative rounded-2xl md:rounded-3xl p-1.5 md:p-2 bg-gradient-to-br from-white/15 via-white/5 to-white/[0.02] border border-white/15 shadow-[0_50px_140px_-30px_rgba(0,0,0,0.7)] backdrop-blur-sm">
              <div className="relative rounded-xl md:rounded-2xl overflow-hidden aspect-video bg-black ring-1 ring-white/10">
                <iframe
                  src="https://www.youtube.com/embed/PLLruU2OIac?rel=0&modestbranding=1"
                  title="HireMetrics product walkthrough"
                  className="absolute inset-0 w-full h-full"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                />
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* ============ OPERATIONAL VALUE CARDS ============ */}
      <section className="py-16 md:py-24 px-5 sm:px-6 bg-muted/30 border-y border-border/60">
        <div className="container mx-auto max-w-6xl">
          <motion.div {...fadeUp} className="text-center mb-14 max-w-2xl mx-auto">
            <Eyebrow>What you get</Eyebrow>
            <h2 className="text-3xl md:text-[44px] font-bold tracking-tight mt-4 leading-tight">
              An operating system built around recruiter outcomes
            </h2>
            <p className="text-muted-foreground mt-4">
              Six operational pillars that replace spreadsheets, manual tracking, and disconnected tools.
            </p>
          </motion.div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {valueCards.map((c, i) => (
              <motion.div
                key={c.title}
                initial={{ opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.05 }}
                className="group rounded-2xl border border-border bg-card p-7 hover:border-primary/30 hover:shadow-lg transition-all"
              >
                <div className="w-11 h-11 rounded-xl bg-primary/10 border border-primary/15 flex items-center justify-center mb-5 group-hover:scale-105 transition-transform">
                  <c.icon className="h-5 w-5 text-primary" />
                </div>
                <h3 className="font-semibold text-lg mb-2">{c.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{c.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ============ FEATURE ROWS (alternating screenshots) ============ */}
      <section id="features" className="py-20 md:py-32 px-5 sm:px-6">
        <div className="container mx-auto max-w-6xl">
          <motion.div {...fadeUp} className="text-center mb-20 max-w-2xl mx-auto">
            <Eyebrow>Platform</Eyebrow>
            <h2 className="text-3xl md:text-[44px] font-bold tracking-tight mt-4 leading-tight">
              Built for the way modern agencies actually work
            </h2>
          </motion.div>

          <div className="space-y-28">
            {featureRows.map((r, i) => (
              <motion.div
                key={r.title}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: '-100px' }}
                transition={{ duration: 0.7 }}
                className={`grid lg:grid-cols-2 gap-12 lg:gap-16 items-center ${r.reverse ? 'lg:[&>*:first-child]:order-2' : ''}`}
              >
                <div className="space-y-5">
                  <Eyebrow>{r.eyebrow}</Eyebrow>
                  <h3 className="text-2xl md:text-4xl font-bold tracking-tight leading-tight">{r.title}</h3>
                  <p className="text-muted-foreground leading-relaxed">{r.desc}</p>
                  <ul className="space-y-2.5 pt-2">
                    {r.bullets.map((b) => (
                      <li key={b} className="flex items-start gap-2.5 text-sm">
                        <CheckCircle2 className="h-4.5 w-4.5 text-primary flex-shrink-0 mt-0.5" />
                        <span>{b}</span>
                      </li>
                    ))}
                  </ul>
                </div>
                <div className="relative">
                  <div className="absolute -inset-4 bg-gradient-to-tr from-primary/10 via-accent/5 to-transparent rounded-3xl blur-2xl opacity-70 -z-10" />
                  <DashboardFrame src={r.img} alt={r.title} />
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ============ BRANDED CV SHOWCASE ============ */}
      <section className="py-20 md:py-32 px-5 sm:px-6 bg-muted/30 border-y border-border/60">
        <div className="container mx-auto max-w-6xl">
          <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
            <motion.div {...fadeUp} className="space-y-5 order-2 lg:order-1">
              <Eyebrow>Branded CV Export</Eyebrow>
              <h2 className="text-3xl md:text-[44px] font-bold tracking-tight leading-tight">
                Client-ready branded CVs in seconds
              </h2>
              <p className="text-muted-foreground leading-relaxed">
                Export professional candidate profiles with your agency branding directly from your
                recruitment workflow — no design tools, no manual formatting, no delays.
              </p>
              <ul className="space-y-2.5 pt-2">
                {[
                  'Your agency logo, colors, and contact details',
                  'Standardised candidate profile layout',
                  'One-click PDF export from any candidate',
                  'Send directly to clients without leaving the platform',
                ].map((b) => (
                  <li key={b} className="flex items-start gap-2.5 text-sm">
                    <CheckCircle2 className="h-4 w-4 text-primary flex-shrink-0 mt-0.5" />
                    <span>{b}</span>
                  </li>
                ))}
              </ul>
            </motion.div>
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.7 }}
              className="relative order-1 lg:order-2"
            >
              <div className="absolute -inset-5 bg-gradient-to-tr from-primary/15 via-accent/10 to-transparent rounded-3xl blur-3xl opacity-70 -z-10" />
              <DashboardFrame src={brandedCvImg} alt="Branded CV export workflow" />
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: 0.5 }}
                className="hidden md:flex absolute -right-5 bottom-12 items-center gap-2 px-3.5 py-2.5 rounded-xl bg-card border border-border shadow-xl text-xs font-semibold"
              >
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                Exported as PDF
              </motion.div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* ============ INTEGRATED OUTREACH ============ */}
      <section className="py-20 md:py-32 px-5 sm:px-6">
        <div className="container mx-auto max-w-6xl">
          <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.7 }}
              className="relative"
            >
              <div className="absolute -inset-5 bg-gradient-to-tr from-accent/15 via-primary/10 to-transparent rounded-3xl blur-3xl opacity-70 -z-10" />
              <DashboardFrame src={emailComposeImg} alt="Integrated recruiter outreach" />
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: 0.5 }}
                className="hidden md:flex absolute -left-5 top-16 items-center gap-2 px-3.5 py-2.5 rounded-xl bg-card border border-border shadow-xl text-xs font-semibold"
              >
                <Sparkles className="h-3.5 w-3.5 text-primary" />
                AI draft generated
              </motion.div>
            </motion.div>
            <motion.div {...fadeUp} className="space-y-5">
              <Eyebrow>Recruiter Outreach</Eyebrow>
              <h2 className="text-3xl md:text-[44px] font-bold tracking-tight leading-tight">
                Recruiter outreach built into your workflow
              </h2>
              <p className="text-muted-foreground leading-relaxed">
                Generate AI-powered recruiter emails and communicate with candidates and clients
                directly from the platform. No tab-switching, no copy-pasting, no lost threads.
              </p>
              <ul className="space-y-2.5 pt-2">
                {[
                  'AI-drafted candidate and client outreach',
                  'Centralized email threads per candidate',
                  'Templates, scheduling, and tracking built in',
                  'Faster follow-ups, fewer dropped conversations',
                ].map((b) => (
                  <li key={b} className="flex items-start gap-2.5 text-sm">
                    <CheckCircle2 className="h-4 w-4 text-primary flex-shrink-0 mt-0.5" />
                    <span>{b}</span>
                  </li>
                ))}
              </ul>
            </motion.div>
          </div>
        </div>
      </section>

      {/* ============ PLATFORM SHOWCASE (single feature image) ============ */}
      <section id="platform" className="py-20 md:py-32 px-5 sm:px-6 bg-muted/30 border-y border-border/60">
        <div className="container mx-auto max-w-6xl">
          <motion.div {...fadeUp} className="text-center mb-14 max-w-2xl mx-auto">
            <Eyebrow>Inside the platform</Eyebrow>
            <h2 className="text-3xl md:text-[44px] font-bold tracking-tight mt-4 leading-tight">
              Reports & analytics that drive decisions
            </h2>
            <p className="text-muted-foreground mt-4">
              Clear visibility into pipeline health, recruiter productivity, and placement performance — without leaving the platform.
            </p>
          </motion.div>
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.7 }}
            className="relative max-w-4xl mx-auto"
          >
            <div className="absolute -inset-6 bg-gradient-to-tr from-primary/15 to-accent/10 rounded-3xl blur-3xl opacity-60 -z-10" />
            <DashboardFrame src={reportsImg} alt="HireMetrics reports and analytics" />
          </motion.div>
        </div>
      </section>

      {/* ============ PRICING ============ */}
      <section id="pricing" className="py-20 md:py-32 px-5 sm:px-6">
        <div className="container mx-auto max-w-6xl">
          <motion.div {...fadeUp} className="text-center mb-16 max-w-2xl mx-auto">
            <Eyebrow>Pricing</Eyebrow>
            <h2 className="text-3xl md:text-[44px] font-bold tracking-tight mt-4 leading-tight">
              Simple, transparent pricing
            </h2>
            <p className="text-muted-foreground mt-4">
              Start free for 14 days. No credit card required. Cancel anytime.
            </p>
          </motion.div>

          <div className="grid md:grid-cols-3 gap-6 max-w-5xl mx-auto">
            {(pricingPlans && pricingPlans.length > 0
              ? pricingPlans.slice(0, 3)
              : [
                  { id: '1', name: 'Starter', price_monthly: 19, features: ['1 user seat', 'Unlimited candidates', 'AI matching credits', 'Email integration'] as string[] },
                  { id: '2', name: 'Pro', price_monthly: 39, features: ['Up to 10 users', 'Team performance KPIs', 'Branded CV export', 'Priority AI processing', 'Work tracking'] as string[] },
                  { id: '3', name: 'Agency', price_monthly: 99, features: ['Unlimited users', 'Advanced analytics', 'API access', 'Dedicated success manager', 'SLA & SSO'] as string[] },
                ]
            ).map((plan: any, i: number) => {
              const popular = i === 1;
              return (
                <motion.div
                  key={plan.id || i}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.06 }}
                  className={`relative rounded-3xl p-8 transition-all ${
                    popular
                      ? 'bg-[#0b1424] text-white border border-primary/30 shadow-[0_30px_80px_-20px_rgba(59,130,246,0.4)] md:scale-[1.03]'
                      : 'bg-card border border-border hover:border-primary/30 hover:shadow-lg'
                  }`}
                >
                  {popular && (
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full bg-primary text-primary-foreground text-[11px] font-bold flex items-center gap-1.5 shadow-md">
                      <Star className="h-3 w-3 fill-current" /> Most Popular
                    </div>
                  )}
                  <h3 className={`text-lg font-bold mb-1 ${popular ? 'text-white' : ''}`}>{plan.name}</h3>
                  <p className={`text-sm mb-6 ${popular ? 'text-white/60' : 'text-muted-foreground'}`}>
                    {i === 0 ? 'For solo recruiters' : i === 1 ? 'For growing teams' : 'For scaling agencies'}
                  </p>
                  <div className="flex items-end gap-1 mb-7">
                    <span className={`text-5xl font-bold ${popular ? 'text-white' : ''}`}>
                      ${Number(plan.price_monthly ?? plan.price ?? 0)}
                    </span>
                    <span className={`mb-2 ${popular ? 'text-white/60' : 'text-muted-foreground'}`}>/mo</span>
                  </div>
                  <Link to="/auth?mode=signup" className="block">
                    <Button
                      className={`w-full mb-7 ${popular ? 'bg-white text-[#0b1424] hover:bg-white/90' : ''}`}
                      variant={popular ? 'default' : 'outline'}
                      size="lg"
                    >
                      Start Free Trial
                    </Button>
                  </Link>
                  <ul className="space-y-3">
                    {(plan.features || []).map((f: string) => (
                      <li key={f} className={`flex items-start gap-2.5 text-sm ${popular ? 'text-white/85' : ''}`}>
                        <CheckCircle2 className={`h-4 w-4 flex-shrink-0 mt-0.5 ${popular ? 'text-primary' : 'text-primary'}`} />
                        <span>{f}</span>
                      </li>
                    ))}
                  </ul>
                </motion.div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ============ PREMIUM DARK CTA ============ */}
      <section className="relative py-20 md:py-32 px-5 sm:px-6 overflow-hidden bg-[#070b14] text-white">
        <div className="absolute inset-0 -z-0">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[1100px] h-[600px] bg-gradient-to-br from-primary/25 via-primary/5 to-transparent rounded-full blur-3xl" />
          <div className="absolute bottom-0 right-0 w-[500px] h-[500px] bg-accent/15 rounded-full blur-3xl" />
          <div
            className="absolute inset-0 opacity-[0.06]"
            style={{
              backgroundImage:
                'linear-gradient(to right, white 1px, transparent 1px), linear-gradient(to bottom, white 1px, transparent 1px)',
              backgroundSize: '80px 80px',
              maskImage: 'radial-gradient(ellipse at center, black 30%, transparent 70%)',
            }}
          />
        </div>

        <div className="relative container mx-auto max-w-4xl text-center">
          <Eyebrow dark>Get Started</Eyebrow>
          <h2 className="text-3xl md:text-5xl lg:text-[56px] font-bold tracking-tight mt-5 leading-[1.08]">
            Built For Recruitment Agencies{' '}
            <span className="bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
              Ready To Scale
            </span>
          </h2>
          <p className="text-white/70 text-lg mt-6 max-w-2xl mx-auto leading-relaxed">
            Replace spreadsheets, disconnected tools, and manual recruitment workflows with one
            AI-powered recruitment operating system.
          </p>

          <div className="flex flex-col sm:flex-row gap-3 justify-center mt-9">
            <Link to="/auth?mode=signup">
              <Button size="lg" className="h-12 px-8 gap-2 bg-white text-[#070b14] hover:bg-white/90 w-full sm:w-auto">
                Start Free Trial <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
            <Button
              size="lg"
              variant="outline"
              className="h-12 px-8 gap-2 border-white/20 bg-white/5 text-white hover:bg-white/10 hover:text-white"
              onClick={() => setBookDemoOpen(true)}
            >
              Book Demo
            </Button>
          </div>

          {/* Trust indicators */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-14 max-w-3xl mx-auto">
            {[
              { icon: Zap, label: 'AI-powered workflows' },
              { icon: Mail, label: 'Integrated email outreach' },
              { icon: BarChart3, label: 'Productivity tracking' },
              { icon: Users, label: 'Pipeline management' },
            ].map((t) => (
              <div key={t.label} className="flex items-center gap-2.5 justify-center md:justify-start px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-sm text-white/80">
                <t.icon className="h-4 w-4 text-primary flex-shrink-0" />
                <span className="text-left">{t.label}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ============ SECURITY & TRUST STRIP ============ */}
      <section className="py-12 md:py-14 px-5 sm:px-6 bg-background border-t border-border/60">
        <div className="container mx-auto max-w-6xl">
          <div className="text-center mb-8">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
              Enterprise-grade security & trust
            </p>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { icon: KeyRound, label: 'Two-Factor Authentication' },
              { icon: ServerCog, label: 'Secure Cloud Infrastructure' },
              { icon: Shield, label: 'Role-Based Permissions' },
              { icon: Lock, label: 'Protected Candidate Data' },
            ].map((t) => (
              <div key={t.label} className="flex items-center gap-3 px-4 py-3.5 rounded-xl border border-border bg-card">
                <div className="w-9 h-9 rounded-lg bg-primary/10 border border-primary/15 flex items-center justify-center flex-shrink-0">
                  <t.icon className="h-4 w-4 text-primary" />
                </div>
                <span className="text-sm font-medium">{t.label}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ============ PREMIUM FOOTER ============ */}
      <footer className="bg-[#070b14] text-white/70 border-t border-white/10">
        <div className="container mx-auto px-5 sm:px-6 py-14 md:py-16">
          <div className="grid grid-cols-1 md:grid-cols-12 gap-10">
            {/* Brand */}
            <div className="md:col-span-4">
              <Link to="/" className="inline-block mb-5"><Logo size="md" /></Link>
              <p className="text-sm leading-relaxed max-w-xs mb-6">
                The AI-powered recruitment operating system for modern agencies.
              </p>
              <div className="flex items-center gap-3">
                <a href="#" aria-label="LinkedIn" className="w-9 h-9 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center hover:bg-white/10 hover:text-white transition-colors">
                  <Linkedin className="h-4 w-4" />
                </a>
                <a href="#" aria-label="Twitter" className="w-9 h-9 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center hover:bg-white/10 hover:text-white transition-colors">
                  <Twitter className="h-4 w-4" />
                </a>
                <a href="#" aria-label="GitHub" className="w-9 h-9 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center hover:bg-white/10 hover:text-white transition-colors">
                  <Github className="h-4 w-4" />
                </a>
              </div>
            </div>

            {/* Product */}
            <div className="md:col-span-2">
              <h4 className="text-white font-semibold text-sm mb-4 uppercase tracking-wider text-[12px]">Product</h4>
              <ul className="space-y-3 text-sm">
                <li><a href="#features" className="hover:text-white transition-colors">Features</a></li>
                <li><a href="#platform" className="hover:text-white transition-colors">Platform</a></li>
                <li><a href="#pricing" className="hover:text-white transition-colors">Pricing</a></li>
                <li><Link to="/features" className="hover:text-white transition-colors">All capabilities</Link></li>
              </ul>
            </div>

            {/* Company */}
            <div className="md:col-span-2">
              <h4 className="text-white font-semibold text-sm mb-4 uppercase tracking-wider text-[12px]">Company</h4>
              <ul className="space-y-3 text-sm">
                <li><Link to="/about" className="hover:text-white transition-colors">About</Link></li>
                <li><Link to="/contact" className="hover:text-white transition-colors">Contact</Link></li>
                <li><button onClick={() => setBookDemoOpen(true)} className="hover:text-white transition-colors text-left">Book a demo</button></li>
              </ul>
            </div>

            {/* Support */}
            <div className="md:col-span-2">
              <h4 className="text-white font-semibold text-sm mb-4 uppercase tracking-wider text-[12px]">Support</h4>
              <ul className="space-y-3 text-sm">
                <li><Link to="/contact" className="hover:text-white transition-colors">Help & Support</Link></li>
                <li><a href={`mailto:${BRAND.email}`} className="hover:text-white transition-colors">{BRAND.email}</a></li>
                <li><a href="https://wa.me/447426468550" target="_blank" rel="noreferrer" className="hover:text-white transition-colors">WhatsApp</a></li>
              </ul>
            </div>

            {/* Legal */}
            <div className="md:col-span-2">
              <h4 className="text-white font-semibold text-sm mb-4 uppercase tracking-wider text-[12px]">Legal</h4>
              <ul className="space-y-3 text-sm">
                <li><Link to="/privacy" className="hover:text-white transition-colors">Privacy</Link></li>
                <li><Link to="/terms" className="hover:text-white transition-colors">Terms</Link></li>
                <li><Link to="/cookie-policy" className="hover:text-white transition-colors">Cookies</Link></li>
                <li><Link to="/return-policy" className="hover:text-white transition-colors">Refunds</Link></li>
                <li>
                  <button
                    onClick={() => { localStorage.removeItem('cookie_consent'); window.location.reload(); }}
                    className="hover:text-white transition-colors text-left"
                  >
                    Cookie preferences
                  </button>
                </li>
              </ul>
            </div>
          </div>

          <div className="border-t border-white/10 mt-14 pt-8 flex flex-col md:flex-row items-center justify-between gap-3">
            <p className="text-xs text-white/50">© {new Date().getFullYear()} {BRAND.name}. All rights reserved.</p>
            <p className="text-xs text-white/50">Suite A, 82 James Carter Road, Mildenhall, Bury St. Edmunds, IP28 7DE, UK</p>
          </div>
        </div>
      </footer>

      <WatchDemoDialog open={watchDemoOpen} onOpenChange={setWatchDemoOpen} videoUrl={demoVideoUrl} />
      <BookDemoDialog open={bookDemoOpen} onOpenChange={setBookDemoOpen} />
    </div>
  );
}
