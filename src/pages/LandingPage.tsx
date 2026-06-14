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
import { PricingComparisonMatrix } from '@/components/pricing/PricingComparisonMatrix';
import { HomepageTestimonials } from '@/components/testimonials/HomepageTestimonials';
import {
  ArrowRight, Brain, Users, Mail, Calendar, BarChart3,
  Sparkles, CheckCircle2, Play, Menu, X, Activity,
  Timer, Zap, Workflow, Target, Eye, Rocket, Linkedin, Twitter, Github, Star,
  DollarSign, FileText, Briefcase, TrendingUp, Receipt, Wallet,
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
            app.hiremetrics.co.uk
          </div>
        </div>
      </div>
      <img src={src} alt={alt} className="w-full block transition-transform duration-700 group-hover:scale-[1.01]" loading="lazy" />
    </div>
  );
}

/* Animated count-up number */
function AnimatedStat({ value, suffix = '', label, icon: Icon }: { value: number; suffix?: string; label: string; icon: any }) {
  const [n, setN] = useState(0);
  useEffect(() => {
    let raf = 0;
    const start = performance.now();
    const dur = 1400;
    const tick = (t: number) => {
      const p = Math.min(1, (t - start) / dur);
      setN(Math.round(value * (1 - Math.pow(1 - p, 3))));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value]);
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      className="rounded-2xl border border-border bg-card p-6 text-center hover:border-primary/30 hover:shadow-lg transition-all"
    >
      <div className="w-10 h-10 rounded-xl bg-primary/10 border border-primary/15 flex items-center justify-center mx-auto mb-4">
        <Icon className="h-5 w-5 text-primary" />
      </div>
      <div className="text-4xl md:text-5xl font-bold tracking-tight bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
        {n.toLocaleString()}{suffix}
      </div>
      <p className="text-sm text-muted-foreground mt-2 font-medium">{label}</p>
    </motion.div>
  );
}

/* ---------------- Operational Value Cards ---------------- */

const valueCards = [
  { icon: Brain, title: 'AI Candidate Matching', desc: 'Match candidates against job requirements instantly using AI.' },
  { icon: Mail, title: 'Client Submission Reports', desc: 'Generate professional branded reports for clients in minutes.' },
  { icon: Workflow, title: 'Client Submission Pipeline', desc: 'Track every candidate from submission to placement.' },
  { icon: Target, title: 'Placement Tracking', desc: 'Monitor interviews, offers, hires and placements end-to-end.' },
  { icon: BarChart3, title: 'Finance Dashboard', desc: 'Track revenue, invoices and business performance in real time.' },
  { icon: CheckCircle2, title: 'Invoice Management', desc: 'Generate and send invoices directly from HireMetrics.' },
  { icon: Rocket, title: 'Recruiter Bonus Tracking', desc: 'Manage recruiter commissions and bonus payments automatically.' },
  { icon: Activity, title: 'Recruiter Performance Dashboard', desc: 'Measure recruiter productivity, submissions and placements.' },
  { icon: Timer, title: 'Daily Activity & Work Hour Tracking', desc: 'Monitor recruiter activity and team performance live.' },
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
  const [demoPlaying, setDemoPlaying] = useState(false);
  const { plans: pricingPlans } = usePublicPricingPlans();

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
            <Eyebrow>AI Recruitment Agency Operating System</Eyebrow>
            <h1 className="text-4xl sm:text-5xl lg:text-[68px] font-bold tracking-tight leading-[1.05] text-foreground">
              Run Your Entire Recruitment Agency<br />
              <span className="bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
                From One Platform
              </span>
            </h1>
            <p className="text-lg md:text-xl text-muted-foreground max-w-3xl mx-auto leading-relaxed">
              Source candidates, generate client-ready reports, manage submissions, track placements,
              invoice clients, monitor recruiter performance and grow your agency — all from one AI-powered platform.
            </p>
            <p className="text-sm md:text-base text-muted-foreground/90 max-w-2xl mx-auto">
              Stop switching between spreadsheets, ATS systems, reporting tools and finance software.
              HireMetrics combines recruitment operations, client submissions, placements, invoicing
              and recruiter performance management into one seamless workflow.
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
            <div className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2 pt-3 text-xs sm:text-sm text-muted-foreground">
              {['AI Matching','Client Reports','Placement Tracking','Finance & Invoicing','Recruiter Analytics'].map(b => (
                <span key={b} className="inline-flex items-center gap-1.5"><CheckCircle2 className="h-3.5 w-3.5 text-primary"/>{b}</span>
              ))}
            </div>
            <p className="text-xs text-muted-foreground">No credit card · 14-day free trial · Cancel anytime</p>
          </motion.div>

          {/* Dashboard showcase — full-width hero (30% larger) */}
          <motion.div
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.9, delay: 0.25 }}
            className="relative mt-14 mx-auto"
            style={{ maxWidth: 'min(1280px, 100%)' }}
          >
            <div className="absolute -inset-8 bg-gradient-to-tr from-primary/20 via-accent/10 to-transparent rounded-[2rem] blur-3xl opacity-70 -z-10" />
            <motion.div
              animate={{ y: [0, -8, 0] }}
              transition={{ duration: 6, repeat: Infinity, ease: 'easeInOut' }}
            >
              <DashboardFrame src={dashboardImg} alt="HireMetrics recruiter dashboard" />
            </motion.div>

            {/* Floating KPI cards */}
            {[
              { icon: Users, label: 'Candidates', value: '2,847', tone: 'text-primary', pos: 'hidden md:flex absolute -left-6 top-16' },
              { icon: Target, label: 'Placements', value: '184', tone: 'text-emerald-600', pos: 'hidden md:flex absolute -right-6 top-28' },
              { icon: DollarSign, label: 'Revenue', value: '$1.2M', tone: 'text-primary', pos: 'hidden lg:flex absolute -left-8 bottom-24' },
              { icon: Receipt, label: 'Invoices', value: '96', tone: 'text-amber-600', pos: 'hidden md:flex absolute -right-8 bottom-16' },
            ].map((k, i) => (
              <motion.div
                key={k.label}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.7 + i * 0.15 }}
                className={`${k.pos} items-center gap-3 px-4 py-3 rounded-2xl bg-card border border-border shadow-xl`}
              >
                <div className={`w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center ${k.tone}`}>
                  <k.icon className="h-4 w-4" />
                </div>
                <div className="text-left">
                  <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{k.label}</div>
                  <div className="text-base font-bold leading-tight">{k.value}</div>
                </div>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* ============ PRODUCT DEMO VIDEO ============ */}
      <section className="relative py-14 md:py-20 px-5 sm:px-6 overflow-hidden bg-[#070b14] text-white">
        <div className="absolute inset-0 -z-0">
          <div className="absolute top-1/2 left-1/4 -translate-y-1/2 w-[700px] h-[500px] bg-gradient-to-br from-primary/25 via-primary/5 to-transparent rounded-full blur-3xl" />
          <div className="absolute bottom-0 right-0 w-[500px] h-[400px] bg-accent/15 rounded-full blur-3xl" />
        </div>
        <div className="relative container mx-auto max-w-6xl">
          <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
            {/* LEFT — Premium video frame */}
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-80px' }}
              transition={{ duration: 0.8 }}
              className="relative group order-2 lg:order-1"
            >
              <div className="absolute -inset-4 md:-inset-6 bg-gradient-to-tr from-primary/40 via-accent/20 to-transparent rounded-[2rem] blur-3xl opacity-60 -z-10" />
              <div className="relative rounded-2xl md:rounded-3xl p-1.5 md:p-2 bg-gradient-to-br from-white/15 via-white/5 to-white/[0.02] border border-white/15 shadow-[0_50px_140px_-30px_rgba(0,0,0,0.7)] backdrop-blur-sm">
                <div className="relative rounded-xl md:rounded-2xl overflow-hidden aspect-video bg-black ring-1 ring-white/10">
                  {demoPlaying ? (
                    <iframe
                      src="https://www.youtube.com/embed/PLLruU2OIac?autoplay=1&rel=0&modestbranding=1"
                      title="HireMetrics product walkthrough"
                      className="absolute inset-0 w-full h-full"
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                      allowFullScreen
                    />
                  ) : (
                    <button
                      type="button"
                      onClick={() => setDemoPlaying(true)}
                      aria-label="Play product walkthrough"
                      className="absolute inset-0 w-full h-full group/play z-10 cursor-pointer"
                    >
                      <img
                        src="https://img.youtube.com/vi/PLLruU2OIac/maxresdefault.jpg"
                        onError={(e) => { (e.currentTarget as HTMLImageElement).src = dashboardImg; }}
                        alt="HireMetrics product walkthrough preview"
                        className="absolute inset-0 w-full h-full object-cover opacity-95 transition-transform duration-700 group-hover/play:scale-[1.03] pointer-events-none"
                      />
                      <div className="absolute inset-0 bg-gradient-to-tr from-[#070b14]/70 via-[#070b14]/30 to-transparent pointer-events-none" />
                      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                        <div className="relative">
                          <div className="absolute inset-0 rounded-full bg-primary/40 blur-2xl scale-150 animate-pulse" />
                          <div className="relative w-20 h-20 md:w-24 md:h-24 rounded-full bg-white/95 backdrop-blur flex items-center justify-center shadow-[0_20px_50px_-10px_rgba(0,0,0,0.6)] group-hover/play:scale-110 transition-transform duration-300">
                            <Play className="h-8 w-8 md:h-10 md:w-10 text-[#070b14] fill-current ml-1" />
                          </div>
                        </div>
                      </div>
                      <div className="absolute bottom-4 left-4 md:bottom-5 md:left-5 flex items-center gap-2 px-3 py-1.5 rounded-full bg-black/50 backdrop-blur border border-white/15 text-[11px] font-medium text-white/90 pointer-events-none">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                        2-minute product walkthrough
                      </div>
                    </button>
                  )}
                </div>
              </div>
            </motion.div>

            {/* RIGHT — Content */}
            <motion.div {...fadeUp} className="space-y-6 order-1 lg:order-2">
              <Eyebrow dark>Product walkthrough</Eyebrow>
              <h2 className="text-3xl md:text-[44px] font-bold tracking-tight leading-[1.1]">
                See How Modern Agencies Use HireMetrics
              </h2>
              <p className="text-white/70 text-base md:text-lg leading-relaxed">
                Watch how recruiters manage candidates, automate outreach, validate talent with AI,
                and track recruiter productivity from one unified platform.
              </p>
              <ul className="space-y-3 pt-1">
                {[
                  'AI candidate validation',
                  'Integrated recruiter outreach',
                  'Team productivity tracking',
                  'Branded CV exports',
                  'Centralized recruitment workflows',
                ].map((b) => (
                  <li key={b} className="flex items-start gap-3 text-sm md:text-[15px] text-white/85">
                    <CheckCircle2 className="h-4.5 w-4.5 text-primary flex-shrink-0 mt-0.5" />
                    <span>{b}</span>
                  </li>
                ))}
              </ul>
              <div className="flex flex-col sm:flex-row gap-3 pt-3">
                <Button
                  size="lg"
                  className="h-12 px-7 gap-2 bg-white text-[#070b14] hover:bg-white/90"
                  onClick={() => setDemoPlaying(true)}
                >
                  <Play className="h-4 w-4 fill-current" /> Watch Demo
                </Button>
                <Link to="/auth?mode=signup">
                  <Button
                    size="lg"
                    variant="outline"
                    className="h-12 px-7 gap-2 border-white/20 bg-white/5 text-white hover:bg-white/10 hover:text-white w-full sm:w-auto"
                  >
                    Start Free Trial <ArrowRight className="h-4 w-4" />
                  </Button>
                </Link>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* ============ OPERATIONAL VALUE CARDS ============ */}
      <section className="py-12 md:py-16 px-5 sm:px-6 bg-muted/30 border-y border-border/60">
        <div className="container mx-auto max-w-6xl">
          <motion.div {...fadeUp} className="text-center mb-14 max-w-2xl mx-auto">
            <Eyebrow>Why HireMetrics</Eyebrow>
            <h2 className="text-3xl md:text-[44px] font-bold tracking-tight mt-4 leading-tight">
              Why Recruitment Agencies Choose HireMetrics
            </h2>
            <p className="text-muted-foreground mt-4">
              Everything your agency needs to recruit, submit, place and grow.
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

      {/* ============ ANIMATED STATISTICS ============ */}
      <section className="py-12 md:py-16 px-5 sm:px-6 border-y border-border/60 bg-background">
        <div className="container mx-auto max-w-6xl">
          <motion.div {...fadeUp} className="text-center max-w-2xl mx-auto mb-10">
            <Eyebrow>Proven Impact</Eyebrow>
            <h2 className="text-2xl md:text-4xl font-bold tracking-tight mt-3 leading-tight">
              Measurable outcomes for modern agencies
            </h2>
          </motion.div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6">
            <AnimatedStat value={80} suffix="%" label="Less Reporting Time" icon={Timer} />
            <AnimatedStat value={3} suffix="×" label="Faster Client Submissions" icon={Zap} />
            <AnimatedStat value={100} suffix="%" label="Placement Tracking" icon={Target} />
            <AnimatedStat value={100} suffix="%" label="Revenue Visibility" icon={TrendingUp} />
          </div>
        </div>
      </section>

      {/* ============ PRODUCT TOUR ============ */}
      <section className="py-14 md:py-20 px-5 sm:px-6 bg-muted/30 border-y border-border/60">
        <div className="container mx-auto max-w-6xl">
          <motion.div {...fadeUp} className="text-center max-w-2xl mx-auto mb-12">
            <Eyebrow>Product Tour</Eyebrow>
            <h2 className="text-3xl md:text-[44px] font-bold tracking-tight mt-4 leading-tight">
              Every step of the recruitment journey
            </h2>
            <p className="text-muted-foreground mt-4">
              From sourcing to invoicing — see how HireMetrics powers the entire workflow.
            </p>
          </motion.div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {[
              { step: '01', label: 'Candidate CRM', img: candidatesImg },
              { step: '02', label: 'AI Match', img: aiMatchImg },
              { step: '03', label: 'Client Report', img: reportsImg },
              { step: '04', label: 'Pipeline', img: teamPerfImg },
              { step: '05', label: 'Placement', img: dashboardImg },
              { step: '06', label: 'Invoice', img: brandedCvImg },
            ].map((s, i) => (
              <motion.div
                key={s.label}
                initial={{ opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.05 }}
                className="group rounded-2xl border border-border bg-card overflow-hidden hover:border-primary/30 hover:shadow-xl transition-all"
              >
                <div className="relative aspect-[16/10] overflow-hidden bg-muted/40">
                  <img src={s.img} alt={s.label} loading="lazy" className="w-full h-full object-cover object-top transition-transform duration-700 group-hover:scale-[1.04]" />
                  <div className="absolute top-3 left-3 px-2.5 py-1 rounded-md bg-primary text-primary-foreground text-[10px] font-bold tracking-wider">
                    {s.step}
                  </div>
                </div>
                <div className="p-4 flex items-center justify-between">
                  <h3 className="font-semibold text-sm">{s.label}</h3>
                  <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-primary group-hover:translate-x-0.5 transition-all" />
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ============ FINANCE & REVENUE ============ */}
      <section className="py-14 md:py-20 px-5 sm:px-6">
        <div className="container mx-auto max-w-6xl">
          <motion.div {...fadeUp} className="text-center max-w-2xl mx-auto mb-12">
            <Eyebrow>Finance & Revenue</Eyebrow>
            <h2 className="text-3xl md:text-[44px] font-bold tracking-tight mt-4 leading-tight">
              Track every placement, invoice and dollar
            </h2>
            <p className="text-muted-foreground mt-4">
              Built-in finance dashboard and invoicing — no more spreadsheets or external accounting tools.
            </p>
          </motion.div>
          <div className="grid lg:grid-cols-2 gap-8 lg:gap-10">
            <motion.div {...fadeUp} className="relative">
              <div className="absolute -inset-4 bg-gradient-to-tr from-primary/15 to-accent/10 rounded-3xl blur-2xl opacity-70 -z-10" />
              <DashboardFrame src={reportsImg} alt="Finance dashboard" />
              <div className="mt-5 flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center"><Wallet className="h-5 w-5 text-primary" /></div>
                <div>
                  <h3 className="font-semibold">Finance Dashboard</h3>
                  <p className="text-sm text-muted-foreground">Live revenue, placements and pipeline value.</p>
                </div>
              </div>
            </motion.div>
            <motion.div {...fadeUp} className="relative">
              <div className="absolute -inset-4 bg-gradient-to-tr from-accent/15 to-primary/10 rounded-3xl blur-2xl opacity-70 -z-10" />
              <DashboardFrame src={brandedCvImg} alt="Invoice management" />
              <div className="mt-5 flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center"><FileText className="h-5 w-5 text-primary" /></div>
                <div>
                  <h3 className="font-semibold">Invoice Management</h3>
                  <p className="text-sm text-muted-foreground">Generate, send and track invoices in one click.</p>
                </div>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* ============ FEATURE ROWS (alternating screenshots) ============ */}
      <section id="features" className="py-14 md:py-20 px-5 sm:px-6">
        <div className="container mx-auto max-w-6xl">
          <motion.div {...fadeUp} className="text-center mb-20 max-w-2xl mx-auto">
            <Eyebrow>Platform</Eyebrow>
            <h2 className="text-3xl md:text-[44px] font-bold tracking-tight mt-4 leading-tight">
              Built for the way modern agencies actually work
            </h2>
          </motion.div>

          <div className="space-y-20 md:space-y-28">
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
      <section className="py-14 md:py-20 px-5 sm:px-6 bg-muted/30 border-y border-border/60">
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
      <section className="py-14 md:py-20 px-5 sm:px-6">
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
      <section id="platform" className="py-14 md:py-20 px-5 sm:px-6 bg-muted/30 border-y border-border/60">
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

      {/* ============ RECRUITMENT WORKFLOW ============ */}
      <section className="py-14 md:py-20 px-5 sm:px-6 bg-muted/30 border-y border-border/60">
        <div className="container mx-auto max-w-6xl">
          <motion.div {...fadeUp} className="text-center max-w-2xl mx-auto mb-14">
            <Eyebrow>End-to-End</Eyebrow>
            <h2 className="text-3xl md:text-[44px] font-bold tracking-tight mt-4 leading-tight">
              From Candidate To Revenue
            </h2>
            <p className="text-muted-foreground mt-4">
              Manage the entire recruitment lifecycle without switching platforms.
            </p>
          </motion.div>

          <div className="flex flex-wrap items-center justify-center gap-2 md:gap-3">
            {['Candidate','AI Match','Client Report','Submission','Interview','Placement','Invoice','Payment','Revenue'].map((step, i, arr) => (
              <div key={step} className="flex items-center gap-2 md:gap-3">
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.06 }}
                  className="px-4 py-2.5 rounded-xl bg-card border border-border font-semibold text-sm md:text-base shadow-sm hover:border-primary/40 hover:shadow-md transition-all"
                >
                  {step}
                </motion.div>
                {i < arr.length - 1 && <ArrowRight className="h-4 w-4 text-muted-foreground/50 shrink-0" />}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ============ BUILT FOR AGENCIES ============ */}
      <section className="py-14 md:py-20 px-5 sm:px-6">
        <div className="container mx-auto max-w-6xl">
          <motion.div {...fadeUp} className="text-center max-w-2xl mx-auto mb-14">
            <Eyebrow>Who it's for</Eyebrow>
            <h2 className="text-3xl md:text-[44px] font-bold tracking-tight mt-4 leading-tight">
              Built Specifically For Recruitment Businesses
            </h2>
          </motion.div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-5 gap-4">
            {[
              { t: 'Executive Search Firms', d: 'Confidential searches with branded client reports and shortlist tracking.' },
              { t: 'Staffing Agencies', d: 'High-volume pipelines, multi-recruiter routing, and live KPI dashboards.' },
              { t: 'Recruitment Boutiques', d: 'A complete OS for small teams — no spreadsheets, no scattered tools.' },
              { t: 'RPO Providers', d: 'Multi-client workspaces with submission packs and SLA reporting.' },
              { t: 'Internal Talent Teams', d: 'Hiring manager collaboration, AI matching, and offer/placement tracking.' },
            ].map((c, i) => (
              <motion.div
                key={c.t}
                initial={{ opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.05 }}
                className="rounded-2xl border border-border bg-card p-6 hover:border-primary/30 hover:shadow-lg transition-all"
              >
                <h3 className="font-semibold mb-2">{c.t}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{c.d}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ============ BUSINESS BENEFITS ============ */}
      <section className="py-14 md:py-20 px-5 sm:px-6 bg-muted/30 border-y border-border/60">
        <div className="container mx-auto max-w-5xl">
          <motion.div {...fadeUp} className="text-center max-w-2xl mx-auto mb-12">
            <Eyebrow>Outcomes</Eyebrow>
            <h2 className="text-3xl md:text-[44px] font-bold tracking-tight mt-4 leading-tight">
              Reduce Admin Work. Increase Placements.
            </h2>
          </motion.div>
          <div className="grid sm:grid-cols-2 gap-4">
            {[
              'Reduce manual reporting by up to 80%',
              'Generate client submissions in minutes',
              'Track recruiter performance in real time',
              'Monitor placement revenue instantly',
              'Manage invoices and payments from one dashboard',
              'Eliminate spreadsheets and disconnected tools',
            ].map((b) => (
              <div key={b} className="flex items-start gap-3 rounded-xl border border-border bg-card p-5">
                <CheckCircle2 className="h-5 w-5 text-primary shrink-0 mt-0.5" />
                <p className="text-sm md:text-base font-medium">{b}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ============ TESTIMONIALS ============ */}
      <HomepageTestimonials />

      {/* ============ PRICING ============ */}
      <section id="pricing" className="py-14 md:py-20 px-5 sm:px-6">

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
                      ? 'bg-gradient-to-br from-[#0b1424] via-[#0d1a30] to-[#0b1424] text-white border-2 border-primary/60 shadow-[0_40px_100px_-20px_rgba(59,130,246,0.55)] md:scale-[1.08] md:-my-2 z-10 ring-4 ring-primary/10'
                      : 'bg-card border border-border hover:border-primary/30 hover:shadow-lg md:opacity-95'
                  }`}
                >
                  {popular && (
                    <div className="absolute -top-4 left-1/2 -translate-x-1/2 px-4 py-1.5 rounded-full bg-gradient-to-r from-primary to-accent text-primary-foreground text-[11px] font-extrabold uppercase tracking-[0.14em] flex items-center gap-1.5 shadow-[0_10px_30px_-5px_rgba(59,130,246,0.6)] whitespace-nowrap">
                      <Star className="h-3 w-3 fill-current" /> Most Popular
                    </div>
                  )}
                  <h3 className={`text-lg font-bold mb-1 ${popular ? 'text-white' : ''}`}>{plan.name}</h3>
                  <p className={`text-sm mb-6 ${popular ? 'text-white/70' : 'text-muted-foreground'}`}>
                    {i === 0 ? 'For solo recruiters' : i === 1 ? 'For growing teams' : 'For scaling agencies'}
                  </p>
                  <div className="flex items-end gap-1 mb-7">
                    <span className={`font-bold ${popular ? 'text-white text-6xl' : 'text-5xl'}`}>
                      ${Number(plan.price_monthly ?? plan.price ?? 0)}
                    </span>
                    <span className={`mb-2 ${popular ? 'text-white/60' : 'text-muted-foreground'}`}>/mo</span>
                  </div>
                  <Link to="/auth?mode=signup" className="block">
                    <Button
                      className={`w-full mb-7 ${popular ? 'h-14 text-base font-semibold bg-white text-[#0b1424] hover:bg-white/90 shadow-xl' : ''}`}
                      variant={popular ? 'default' : 'outline'}
                      size={popular ? 'xl' : 'lg'}
                    >
                      {popular ? 'Start Free Trial →' : 'Start Free Trial'}
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

          {/* Feature comparison matrix */}
          <div className="mt-16 max-w-6xl mx-auto">
            <div className="text-center mb-8">
              <h3 className="text-2xl md:text-3xl font-bold tracking-tight">Compare plans</h3>
              <p className="text-muted-foreground mt-2 text-sm">Every feature, every limit — straight from our entitlement system.</p>
            </div>
            <PricingComparisonMatrix />
          </div>
        </div>
      </section>

      {/* ============ PREMIUM DARK CTA ============ */}
      <section className="relative py-14 md:py-20 px-5 sm:px-6 overflow-hidden bg-[#070b14] text-white">
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
            Ready To Scale Your{' '}
            <span className="bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
              Recruitment Agency?
            </span>
          </h2>
          <p className="text-white/70 text-lg mt-6 max-w-2xl mx-auto leading-relaxed">
            Everything you need to recruit, submit, place and grow — in one AI-powered platform.
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
        <div className="container mx-auto px-5 sm:px-6 py-12 md:py-14">
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
