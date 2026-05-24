import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { supabase } from '@/integrations/supabase/client';
import { Logo, BRAND } from '@/components/brand/Logo';
import { useToast } from '@/hooks/use-toast';
import { BookDemoDialog } from '@/components/landing/BookDemoDialog';
import { WatchDemoDialog } from '@/components/landing/WatchDemoDialog';
import { PublicPromoBanner } from '@/components/promo/PublicPromoBanner';
import { usePublicPricingPlans } from '@/hooks/usePublicPricingPlans';
import { TestimonialsCarousel } from '@/components/testimonials/TestimonialsCarousel';
import {
  ArrowRight, Brain, Users, Briefcase, Mail, Calendar, FileText, BarChart3,
  Sparkles, CheckCircle2, Play, Phone, Send, Loader2, Menu, X, Activity,
  Timer, TrendingUp, Zap, Shield, Workflow, Target, Building2, Stethoscope,
  Fuel, Code2, Gem, Star,
} from 'lucide-react';

import dashboardImg from '@/assets/crm/dashboard.jpg';
import aiMatchImg from '@/assets/crm/ai-match.jpg';
import candidatesImg from '@/assets/crm/candidates.jpg';
import emailComposeImg from '@/assets/crm/email-compose.jpg';
import teamPerfImg from '@/assets/crm/team-performance.jpg';
import reportsImg from '@/assets/crm/reports.jpg';
import workTrackingImg from '@/assets/crm/work-tracking.jpg';

/* ---------------- Reusable bits ---------------- */

const fadeUp = {
  initial: { opacity: 0, y: 24 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, margin: '-80px' },
  transition: { duration: 0.6 },
} as const;

function SectionEyebrow({ children }: { children: React.ReactNode }) {
  return (
    <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 border border-primary/15 text-primary text-xs font-semibold uppercase tracking-wider">
      <Sparkles className="h-3 w-3" />
      {children}
    </div>
  );
}

/* Browser-style frame around CRM screenshots */
function BrowserFrame({
  src,
  alt,
  className = '',
}: { src: string; alt: string; className?: string }) {
  return (
    <div className={`rounded-2xl border border-border bg-card shadow-2xl overflow-hidden ${className}`}>
      <div className="h-9 bg-muted/70 border-b border-border flex items-center gap-2 px-4">
        <div className="flex gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-red-400/80" />
          <span className="w-2.5 h-2.5 rounded-full bg-yellow-400/80" />
          <span className="w-2.5 h-2.5 rounded-full bg-green-400/80" />
        </div>
        <div className="flex-1 flex justify-center">
          <div className="px-3 py-0.5 bg-background rounded text-[10px] text-muted-foreground font-mono">
            app.hiremetrics.io
          </div>
        </div>
      </div>
      <img src={src} alt={alt} className="w-full block" loading="lazy" />
    </div>
  );
}

/* Floating AI badge over screenshots */
function FloatingBadge({
  icon: Icon,
  label,
  className = '',
  tone = 'primary',
  delay = 0,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  className?: string;
  tone?: 'primary' | 'success' | 'warning';
  delay?: number;
}) {
  const tones = {
    primary: 'bg-primary text-primary-foreground',
    success: 'bg-success text-success-foreground',
    warning: 'bg-warning text-warning-foreground',
  };
  return (
    <motion.div
      initial={{ opacity: 0, y: 10, scale: 0.9 }}
      whileInView={{ opacity: 1, y: 0, scale: 1 }}
      viewport={{ once: true }}
      transition={{ delay, duration: 0.5 }}
      className={`absolute z-10 flex items-center gap-2 px-3 py-2 rounded-xl shadow-2xl backdrop-blur-md border border-white/20 text-xs font-semibold ${tones[tone]} ${className}`}
    >
      <Icon className="h-3.5 w-3.5" />
      {label}
    </motion.div>
  );
}

/* ---------------- Trusted Industries ---------------- */

const industries = [
  { icon: Code2, label: 'IT Recruitment', tint: 'from-blue-500/15 to-cyan-500/10' },
  { icon: Fuel, label: 'Oil & Gas', tint: 'from-amber-500/15 to-orange-500/10' },
  { icon: Gem, label: 'Executive Search', tint: 'from-purple-500/15 to-pink-500/10' },
  { icon: Stethoscope, label: 'Healthcare Staffing', tint: 'from-emerald-500/15 to-teal-500/10' },
  { icon: TrendingUp, label: 'Commodities', tint: 'from-rose-500/15 to-red-500/10' },
  { icon: Building2, label: 'Finance & Banking', tint: 'from-indigo-500/15 to-violet-500/10' },
];

const trustMetrics = [
  { value: '3×', label: 'Faster placements' },
  { value: '60%', label: 'Less recruiter admin' },
  { value: '100%', label: 'Centralized ops' },
  { value: 'AI-Native', label: 'Workflows' },
];

/* ---------------- Bento Features ---------------- */

const bentoFeatures = [
  {
    title: 'Validate Candidates Instantly With AI',
    desc: 'AI-powered candidate analysis with match scoring, strengths, and hiring insights — in seconds.',
    img: aiMatchImg,
    icon: Brain,
    span: 'md:col-span-2 md:row-span-2',
  },
  {
    title: 'Track Every Candidate Pipeline',
    desc: 'Manage stages, submissions, interviews, and placements visually.',
    img: candidatesImg,
    icon: Users,
    span: 'md:col-span-2',
  },
  {
    title: 'Send AI-Powered Outreach',
    desc: 'Generate recruiter emails instantly and send from your own accounts.',
    img: emailComposeImg,
    icon: Mail,
    span: '',
  },
  {
    title: 'Monitor Team Performance',
    desc: 'Track submissions, interviews, hires, and recruiter activity in real time.',
    img: teamPerfImg,
    icon: BarChart3,
    span: '',
  },
  {
    title: 'Branded CV Export',
    desc: 'Export candidate profiles with your agency branding for client submissions.',
    img: reportsImg,
    icon: FileText,
    span: '',
  },
  {
    title: 'Schedule Interviews Seamlessly',
    desc: 'Create events, send invitations, and manage interviews from one platform.',
    img: workTrackingImg,
    icon: Calendar,
    span: '',
  },
];

/* ---------------- AI Workflow ---------------- */

const workflowSteps = [
  { icon: FileText, label: 'Upload CV', detail: 'PDF, DOCX, LinkedIn' },
  { icon: Sparkles, label: 'AI Parses', detail: 'Skills, experience' },
  { icon: Brain, label: 'AI Match', detail: '95% score analysis' },
  { icon: Mail, label: 'Outreach', detail: 'AI-composed email' },
  { icon: Calendar, label: 'Interview', detail: 'Auto-scheduled' },
  { icon: Target, label: 'Placement', detail: 'Pipeline tracked' },
];

/* ---------------- Showcase ---------------- */

const showcase = [
  { img: dashboardImg, label: 'Recruiter Dashboard', caption: 'Your daily command center.' },
  { img: reportsImg, label: 'Reports & Analytics', caption: 'Hiring funnel insights you can act on.' },
  { img: candidatesImg, label: 'Candidate Management', caption: 'Your entire talent pool, organized.' },
  { img: teamPerfImg, label: 'Team Performance', caption: 'Recruiter KPIs in real time.' },
  { img: aiMatchImg, label: 'AI Match Analytics', caption: 'Instant fit scoring with explanations.' },
  { img: workTrackingImg, label: 'Work Tracking', caption: 'See who is working — live.' },
];

/* ---------------- ROI Outcomes ---------------- */

const outcomes = [
  { icon: Timer, title: 'Reduce recruiter admin', desc: 'Automate parsing, matching, and outreach.', stat: '60% less' },
  { icon: Workflow, title: 'Centralize operations', desc: 'One platform for jobs, candidates, clients.', stat: '1 source' },
  { icon: Activity, title: 'Improve visibility', desc: 'Live recruiter activity and pipeline health.', stat: 'Real time' },
  { icon: Mail, title: 'Automate communication', desc: 'AI outreach with branded templates.', stat: 'AI native' },
  { icon: Target, title: 'Track every placement', desc: 'Full pipeline visibility, every stage.', stat: '100%' },
  { icon: Shield, title: 'AI candidate validation', desc: 'Match scores, strengths, skill gaps.', stat: '95% acc.' },
];

/* ---------------- Footer ---------------- */

function Footer() {
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState({ name: '', email: '', message: '' });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      await supabase.functions.invoke('send-email', {
        body: {
          to: BRAND.email,
          subject: `[Contact] Message from ${formData.name}`,
          html: `<p><strong>Name:</strong> ${formData.name}</p><p><strong>Email:</strong> ${formData.email}</p><p>${formData.message}</p>`,
        },
      });
      toast({ title: 'Message sent', description: "We'll get back to you soon." });
      setFormData({ name: '', email: '', message: '' });
    } catch {
      toast({ title: 'Error', description: 'Please try again.', variant: 'destructive' });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <footer className="border-t border-border bg-card">
      <div className="container mx-auto px-6 py-16">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-12">
          <div className="lg:col-span-1">
            <Link to="/" className="inline-block mb-4"><Logo size="md" /></Link>
            <p className="text-sm text-muted-foreground mb-6 max-w-xs">
              The AI-powered recruitment operating system for modern agencies.
            </p>
            <div className="space-y-2 text-sm text-muted-foreground">
              <div className="flex items-center gap-2"><Phone className="h-4 w-4" /><span>+447426468550 (WhatsApp)</span></div>
              <div className="flex items-center gap-2"><Mail className="h-4 w-4" /><span>{BRAND.email}</span></div>
              <div className="flex items-start gap-2 mt-4">
                <span className="text-xs leading-relaxed">
                  Suite A, 82 James Carter Road<br />
                  Mildenhall, Bury St. Edmunds<br />
                  United Kingdom, IP28 7DE
                </span>
              </div>
            </div>
          </div>

          <div>
            <h4 className="font-semibold text-sm mb-4">Product</h4>
            <ul className="space-y-3 text-sm text-muted-foreground">
              <li><a href="#features" className="hover:text-foreground transition-colors">Features</a></li>
              <li><a href="#pricing" className="hover:text-foreground transition-colors">Pricing</a></li>
              <li><Link to="/about" className="hover:text-foreground transition-colors">About</Link></li>
            </ul>
          </div>

          <div>
            <h4 className="font-semibold text-sm mb-4">Legal</h4>
            <ul className="space-y-3 text-sm text-muted-foreground">
              <li><Link to="/privacy" className="hover:text-foreground transition-colors">Privacy Policy</Link></li>
              <li><Link to="/terms" className="hover:text-foreground transition-colors">Terms of Service</Link></li>
              <li><Link to="/return-policy" className="hover:text-foreground transition-colors">Return Policy</Link></li>
              <li><Link to="/cookie-policy" className="hover:text-foreground transition-colors">Cookie Policy</Link></li>
              <li><button onClick={() => { localStorage.removeItem('cookie_consent'); window.location.reload(); }} className="hover:text-foreground transition-colors text-left">Manage Cookie Preferences</button></li>
            </ul>
          </div>

          <div>
            <h4 className="font-semibold text-sm mb-4">Contact Us</h4>
            <form onSubmit={handleSubmit} className="space-y-3">
              <Input placeholder="Your name" value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} required className="h-9 text-sm bg-background" />
              <Input type="email" placeholder="Email" value={formData.email} onChange={(e) => setFormData({ ...formData, email: e.target.value })} required className="h-9 text-sm bg-background" />
              <Textarea placeholder="Message" rows={2} value={formData.message} onChange={(e) => setFormData({ ...formData, message: e.target.value })} required className="text-sm resize-none bg-background" />
              <Button type="submit" size="sm" className="w-full" disabled={isSubmitting}>
                {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                {isSubmitting ? 'Sending...' : 'Send'}
              </Button>
            </form>
          </div>
        </div>

        <div className="border-t border-border mt-12 pt-8 text-center">
          <p className="text-xs text-muted-foreground">© {new Date().getFullYear()} {BRAND.name}. All rights reserved.</p>
        </div>
      </div>
    </footer>
  );
}

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
      {/* Header */}
      <header className="fixed top-0 left-0 right-0 z-50 bg-background/75 backdrop-blur-xl border-b border-border/40">
        <PublicPromoBanner />
        <div className="container mx-auto px-6 h-16 flex items-center justify-between">
          <Link to="/" className="flex items-center"><Logo size="md" /></Link>
          <nav className="hidden md:flex items-center gap-8">
            <a href="#features" className="text-sm text-muted-foreground hover:text-foreground transition-colors font-medium">Features</a>
            <a href="#workflow" className="text-sm text-muted-foreground hover:text-foreground transition-colors font-medium">Workflow</a>
            <a href="#pricing" className="text-sm text-muted-foreground hover:text-foreground transition-colors font-medium">Pricing</a>
            <Link to="/about" className="text-sm text-muted-foreground hover:text-foreground transition-colors font-medium">About</Link>
          </nav>
          <div className="hidden md:flex items-center gap-3">
            <Link to="/auth"><Button variant="ghost" size="sm">Log in</Button></Link>
            <Link to="/auth?mode=signup"><Button size="sm">Start Free Trial</Button></Link>
          </div>
          <button className="md:hidden p-2" onClick={() => setMobileMenuOpen(!mobileMenuOpen)}>
            {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
        {mobileMenuOpen && (
          <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="md:hidden border-t border-border bg-background">
            <nav className="container mx-auto px-6 py-4 flex flex-col gap-2">
              <a href="#features" onClick={() => setMobileMenuOpen(false)} className="py-2 text-muted-foreground">Features</a>
              <a href="#workflow" onClick={() => setMobileMenuOpen(false)} className="py-2 text-muted-foreground">Workflow</a>
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

      {/* SECTION 1 — HERO */}
      <section className="relative pt-32 pb-24 md:pt-40 md:pb-32 px-6 overflow-hidden">
        {/* Gradient backdrop */}
        <div className="absolute inset-0 -z-10">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[1100px] h-[600px] bg-gradient-to-br from-primary/20 via-primary/5 to-transparent rounded-full blur-3xl" />
          <div className="absolute top-40 -left-20 w-72 h-72 bg-accent/10 rounded-full blur-3xl" />
          <div className="absolute top-60 -right-20 w-72 h-72 bg-primary/10 rounded-full blur-3xl" />
          <div
            className="absolute inset-0 opacity-[0.04]"
            style={{
              backgroundImage:
                'linear-gradient(to right, hsl(var(--foreground)) 1px, transparent 1px), linear-gradient(to bottom, hsl(var(--foreground)) 1px, transparent 1px)',
              backgroundSize: '64px 64px',
              maskImage: 'radial-gradient(ellipse at top, black 30%, transparent 70%)',
            }}
          />
        </div>

        <div className="container mx-auto max-w-6xl">
          <motion.div {...fadeUp} className="text-center space-y-7 max-w-4xl mx-auto">
            <SectionEyebrow>AI Recruitment Operating System</SectionEyebrow>
            <h1 className="text-4xl sm:text-5xl lg:text-7xl font-bold tracking-tight leading-[1.05] text-foreground">
              Close More Placements{' '}
              <span className="bg-gradient-to-r from-primary via-primary to-accent bg-clip-text text-transparent">
                With AI
              </span>
            </h1>
            <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto leading-relaxed">
              The AI-powered recruitment operating system for recruitment agencies. Manage candidates,
              automate workflows, track recruiter productivity, and streamline placements from one platform.
            </p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center pt-2">
              <Button size="lg" className="h-12 px-8 gap-2" onClick={() => setBookDemoOpen(true)}>
                Book Demo <ArrowRight className="h-4 w-4" />
              </Button>
              <Link to="/auth?mode=signup">
                <Button size="lg" variant="outline" className="h-12 px-8 gap-2 w-full sm:w-auto">
                  <Play className="h-4 w-4" /> Start Free Trial
                </Button>
              </Link>
            </div>
            <p className="text-xs text-muted-foreground">No credit card · 14-day free trial · Cancel anytime</p>
          </motion.div>

          {/* Floating dashboard */}
          <motion.div
            initial={{ opacity: 0, y: 60 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.9, delay: 0.3 }}
            className="relative mt-16 max-w-6xl mx-auto"
          >
            {/* Glow */}
            <div className="absolute -inset-8 bg-gradient-to-r from-primary/30 via-accent/20 to-primary/30 rounded-3xl blur-3xl opacity-50 -z-10" />

            <BrowserFrame src={dashboardImg} alt="Hiremetrics recruiter dashboard" />

            {/* Floating badges */}
            <FloatingBadge icon={Brain} label="95% Match Score" className="-left-4 top-20 md:-left-10 md:top-32" tone="success" delay={0.5} />
            <FloatingBadge icon={Sparkles} label="AI Summary Ready" className="-right-4 top-10 md:-right-8 md:top-20" tone="primary" delay={0.7} />
            <FloatingBadge icon={Activity} label="Pipeline Healthy" className="-left-4 bottom-24 md:-left-10 md:bottom-32" tone="primary" delay={0.9} />
            <FloatingBadge icon={Mail} label="Email Sent" className="-right-4 bottom-10 md:-right-8 md:bottom-20" tone="success" delay={1.1} />
          </motion.div>

          {/* Workflow line */}
          <motion.div {...fadeUp} className="mt-16 md:mt-20">
            <div className="flex flex-wrap items-center justify-center gap-3 md:gap-4 text-xs md:text-sm">
              {['Job Created', 'AI Match', 'Outreach', 'Interview', 'Placement'].map((step, i, arr) => (
                <div key={step} className="flex items-center gap-3 md:gap-4">
                  <div className="px-3 md:px-4 py-2 rounded-full border border-primary/20 bg-primary/5 text-primary font-semibold">
                    {step}
                  </div>
                  {i < arr.length - 1 && <ArrowRight className="h-4 w-4 text-muted-foreground" />}
                </div>
              ))}
            </div>
          </motion.div>
        </div>
      </section>

      {/* SECTION 2 — TRUST */}
      <section className="py-20 md:py-24 px-6 border-y border-border bg-muted/30">
        <div className="container mx-auto max-w-6xl">
          <motion.div {...fadeUp} className="text-center mb-12">
            <SectionEyebrow>Built for agencies</SectionEyebrow>
            <h2 className="text-3xl md:text-5xl font-bold tracking-tight mt-3">
              Built For Modern Recruitment Agencies
            </h2>
            <p className="text-muted-foreground mt-4 max-w-2xl mx-auto">
              Trusted across industries to centralize operations, automate work, and accelerate placements.
            </p>
          </motion.div>

          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 md:gap-4 mb-12">
            {industries.map((ind, i) => (
              <motion.div
                key={ind.label}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.06 }}
                className={`group rounded-2xl border border-border bg-gradient-to-br ${ind.tint} p-5 hover:border-primary/40 hover:shadow-lg transition-all`}
              >
                <div className="w-10 h-10 rounded-xl bg-background flex items-center justify-center mb-3 shadow-sm group-hover:scale-110 transition-transform">
                  <ind.icon className="h-5 w-5 text-primary" />
                </div>
                <p className="text-sm font-semibold text-foreground">{ind.label}</p>
              </motion.div>
            ))}
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {trustMetrics.map((m) => (
              <div key={m.label} className="rounded-2xl border border-border bg-card p-6 text-center">
                <div className="text-3xl md:text-4xl font-bold bg-gradient-to-br from-primary to-accent bg-clip-text text-transparent">
                  {m.value}
                </div>
                <p className="text-sm text-muted-foreground mt-1">{m.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* SECTION 3 — BENTO FEATURES */}
      <section id="features" className="py-24 md:py-32 px-6">
        <div className="container mx-auto max-w-7xl">
          <motion.div {...fadeUp} className="text-center mb-14">
            <SectionEyebrow>Platform</SectionEyebrow>
            <h2 className="text-3xl md:text-5xl font-bold tracking-tight mt-3 max-w-3xl mx-auto">
              Everything Your Agency Needs in One AI-Native Platform
            </h2>
          </motion.div>

          <div className="grid md:grid-cols-4 grid-rows-[auto] auto-rows-fr gap-5">
            {bentoFeatures.map((f, i) => (
              <motion.article
                key={f.title}
                initial={{ opacity: 0, y: 24 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.06, duration: 0.5 }}
                className={`group relative overflow-hidden rounded-3xl border border-border bg-card hover:border-primary/40 hover:shadow-2xl transition-all duration-500 ${f.span} flex flex-col`}
              >
                <div className="p-7">
                  <div className="w-11 h-11 rounded-xl bg-primary/10 border border-primary/15 flex items-center justify-center mb-4">
                    <f.icon className="h-5 w-5 text-primary" />
                  </div>
                  <h3 className="text-xl font-semibold mb-2">{f.title}</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">{f.desc}</p>
                </div>
                <div className="mt-auto p-5 pt-0">
                  <div className="rounded-xl border border-border overflow-hidden shadow-md group-hover:shadow-xl transition-shadow bg-gradient-to-br from-primary/5 to-transparent">
                    <img src={f.img} alt={f.title} loading="lazy" className="w-full block group-hover:scale-[1.02] transition-transform duration-500" />
                  </div>
                </div>
              </motion.article>
            ))}
          </div>
        </div>
      </section>

      {/* SECTION 4 — AI WORKFLOW */}
      <section id="workflow" className="relative py-24 md:py-32 px-6 bg-gradient-to-b from-primary/95 to-primary text-primary-foreground overflow-hidden">
        <div className="absolute inset-0 opacity-20" style={{
          backgroundImage: 'radial-gradient(circle at 1px 1px, white 1px, transparent 0)',
          backgroundSize: '32px 32px',
        }} />
        <div className="container mx-auto max-w-6xl relative">
          <motion.div {...fadeUp} className="text-center mb-16">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 border border-white/20 text-xs font-semibold uppercase tracking-wider mb-3">
              <Sparkles className="h-3 w-3" /> AI Workflow Automation
            </div>
            <h2 className="text-3xl md:text-5xl font-bold tracking-tight">From CV to Placement — On Autopilot</h2>
            <p className="text-primary-foreground/80 mt-4 max-w-2xl mx-auto">
              An AI-native pipeline that parses, matches, contacts, schedules, and tracks — automatically.
            </p>
          </motion.div>

          <div className="relative">
            <div className="hidden lg:block absolute top-1/2 left-0 right-0 h-px bg-gradient-to-r from-transparent via-white/30 to-transparent -translate-y-1/2" />
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-5">
              {workflowSteps.map((s, i) => (
                <motion.div
                  key={s.label}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.1 }}
                  className="relative rounded-2xl bg-white/10 backdrop-blur-md border border-white/20 p-5 text-center hover:bg-white/15 transition-colors"
                >
                  <div className="w-12 h-12 mx-auto rounded-xl bg-white text-primary flex items-center justify-center shadow-lg mb-3">
                    <s.icon className="h-5 w-5" />
                  </div>
                  <p className="font-semibold text-sm">{s.label}</p>
                  <p className="text-xs text-primary-foreground/70 mt-1">{s.detail}</p>
                </motion.div>
              ))}
            </div>
          </div>

          <div className="mt-12 flex flex-wrap justify-center gap-3">
            {['AI Summary Generated', 'Candidate Rediscovered', 'Follow-Up Reminder Sent'].map((lbl) => (
              <div key={lbl} className="px-4 py-2 rounded-full bg-white/10 backdrop-blur-md border border-white/20 text-xs font-medium">
                <Sparkles className="inline h-3 w-3 mr-1.5" />{lbl}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* SECTION 5 — DASHBOARD SHOWCASE */}
      <section className="py-24 md:py-32 px-6">
        <div className="container mx-auto max-w-7xl">
          <motion.div {...fadeUp} className="text-center mb-14">
            <SectionEyebrow>Inside the platform</SectionEyebrow>
            <h2 className="text-3xl md:text-5xl font-bold tracking-tight mt-3">A Glance Across Your Operations</h2>
          </motion.div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {showcase.map((s, i) => (
              <motion.div
                key={s.label}
                initial={{ opacity: 0, y: 24 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.07 }}
                className="group"
              >
                <div className="rounded-2xl p-3 bg-gradient-to-br from-primary/10 via-card to-card border border-border hover:border-primary/40 hover:shadow-2xl transition-all duration-500 hover:-translate-y-1">
                  <div className="rounded-xl overflow-hidden border border-border bg-card">
                    <img src={s.img} alt={s.label} loading="lazy" className="w-full h-48 md:h-56 object-cover object-top group-hover:scale-105 transition-transform duration-700" />
                  </div>
                  <div className="p-4">
                    <p className="text-sm font-semibold">{s.label}</p>
                    <p className="text-xs text-muted-foreground mt-1">{s.caption}</p>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* SECTION 6 — ROI / OUTCOMES */}
      <section className="py-24 md:py-32 px-6 bg-muted/30 border-y border-border">
        <div className="container mx-auto max-w-6xl">
          <motion.div {...fadeUp} className="text-center mb-14">
            <SectionEyebrow>Business outcomes</SectionEyebrow>
            <h2 className="text-3xl md:text-5xl font-bold tracking-tight mt-3">
              Why Recruitment Agencies Choose HireMetrics
            </h2>
            <p className="text-muted-foreground mt-4 max-w-2xl mx-auto">
              Built around outcomes, not features. Here is what changes from week one.
            </p>
          </motion.div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
            {outcomes.map((o, i) => (
              <motion.div
                key={o.title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.06 }}
                className="group relative rounded-2xl border border-border bg-card p-7 hover:border-primary/40 hover:shadow-xl transition-all overflow-hidden"
              >
                <div className="absolute -top-12 -right-12 w-32 h-32 bg-primary/5 rounded-full blur-2xl group-hover:bg-primary/10 transition-colors" />
                <div className="flex items-start justify-between mb-4 relative">
                  <div className="w-12 h-12 rounded-xl bg-primary/10 border border-primary/15 flex items-center justify-center">
                    <o.icon className="h-5 w-5 text-primary" />
                  </div>
                  <span className="text-xs font-bold text-primary bg-primary/10 px-2.5 py-1 rounded-full">{o.stat}</span>
                </div>
                <h3 className="font-semibold mb-1.5 relative">{o.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed relative">{o.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Testimonials */}
      <TestimonialsCarousel />

      {/* SECTION 7 — PRICING */}
      <section id="pricing" className="py-24 md:py-32 px-6">
        <div className="container mx-auto max-w-6xl">
          <motion.div {...fadeUp} className="text-center mb-14">
            <SectionEyebrow>Pricing</SectionEyebrow>
            <h2 className="text-3xl md:text-5xl font-bold tracking-tight mt-3">Built To Grow With Your Agency</h2>
            <p className="text-muted-foreground mt-4 max-w-2xl mx-auto">
              Simple plans, AI included, no per-recruiter surprises.
            </p>
          </motion.div>

          <div className="grid md:grid-cols-3 gap-6">
            {(pricingPlans && pricingPlans.length > 0
              ? pricingPlans.slice(0, 3)
              : [
                  { id: '1', name: 'Solo Recruiter', price: 49, currency: 'GBP', features: ['1 user seat', 'Unlimited candidates', 'AI matching credits', 'Email integration'] as string[] },
                  { id: '2', name: 'Growth Agency', price: 149, currency: 'GBP', features: ['Up to 10 users', 'Team performance KPIs', 'Branded CV export', 'Priority AI processing', 'Work tracking'] as string[] },
                  { id: '3', name: 'Scale Agency', price: 399, currency: 'GBP', features: ['Unlimited users', 'Advanced analytics', 'API access', 'Dedicated success manager', 'SLA & SSO'] as string[] },
                ]
            ).map((plan: any, i: number) => {
              const popular = i === 1;
              return (
                <motion.div
                  key={plan.id || i}
                  initial={{ opacity: 0, y: 24 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.08 }}
                  className={`relative rounded-3xl border p-8 transition-all hover:-translate-y-1 ${
                    popular
                      ? 'border-primary bg-gradient-to-b from-primary/5 to-card shadow-2xl shadow-primary/20 md:scale-105'
                      : 'border-border bg-card hover:border-primary/40 hover:shadow-xl'
                  }`}
                >
                  {popular && (
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-4 py-1 rounded-full bg-gradient-to-r from-primary to-accent text-primary-foreground text-xs font-bold flex items-center gap-1.5 shadow-lg">
                      <Star className="h-3 w-3 fill-current" /> Most Popular
                    </div>
                  )}
                  <h3 className="text-xl font-bold mb-1">{plan.name}</h3>
                  <p className="text-sm text-muted-foreground mb-6">
                    {i === 0 ? 'For independents' : i === 1 ? 'For growing agencies' : 'For scaling teams'}
                  </p>
                  <div className="flex items-end gap-1 mb-6">
                    <span className="text-4xl md:text-5xl font-bold">
                      {plan.currency === 'GBP' ? '£' : '$'}
                      {plan.price}
                    </span>
                    <span className="text-muted-foreground mb-2">/mo</span>
                  </div>
                  <Link to="/auth?mode=signup" className="block">
                    <Button className="w-full mb-6" variant={popular ? 'default' : 'outline'} size="lg">
                      Start Free Trial <ArrowRight className="h-4 w-4" />
                    </Button>
                  </Link>
                  <ul className="space-y-3">
                    {(plan.features || []).map((f: string) => (
                      <li key={f} className="flex items-start gap-2.5 text-sm">
                        <CheckCircle2 className="h-4 w-4 text-primary flex-shrink-0 mt-0.5" />
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

      {/* SECTION 8 — FINAL CTA */}
      <section className="relative py-24 md:py-32 px-6 overflow-hidden">
        <div className="absolute inset-0 -z-10 bg-gradient-to-br from-primary via-primary to-accent" />
        <div className="absolute inset-0 -z-10 opacity-30" style={{
          backgroundImage: 'radial-gradient(circle at 1px 1px, white 1px, transparent 0)',
          backgroundSize: '40px 40px',
        }} />
        <div className="absolute top-10 left-10 w-72 h-72 bg-white/10 rounded-full blur-3xl" />
        <div className="absolute bottom-10 right-10 w-72 h-72 bg-white/10 rounded-full blur-3xl" />

        <motion.div {...fadeUp} className="container mx-auto max-w-3xl text-center text-primary-foreground relative">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/15 border border-white/30 text-xs font-semibold uppercase tracking-wider mb-5">
            <Zap className="h-3 w-3" /> Get started today
          </div>
          <h2 className="text-3xl md:text-5xl lg:text-6xl font-bold tracking-tight mb-5">
            Scale Your Recruitment Agency With AI
          </h2>
          <p className="text-lg text-primary-foreground/85 mb-8 max-w-xl mx-auto">
            Modern recruitment agencies need more than spreadsheets and basic ATS tools.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Button size="lg" variant="secondary" className="h-12 px-8 gap-2 bg-white text-primary hover:bg-white/90" onClick={() => setBookDemoOpen(true)}>
              Book Demo
            </Button>
            <Link to="/auth?mode=signup">
              <Button size="lg" variant="outline" className="h-12 px-8 gap-2 w-full sm:w-auto border-white/40 text-primary-foreground hover:bg-white/10">
                Start Free Trial <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
          </div>
        </motion.div>
      </section>

      <Footer />

      <WatchDemoDialog open={watchDemoOpen} onOpenChange={setWatchDemoOpen} videoUrl={demoVideoUrl} />
      <BookDemoDialog open={bookDemoOpen} onOpenChange={setBookDemoOpen} />
    </div>
  );
}
