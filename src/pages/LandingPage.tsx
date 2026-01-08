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
import { 
  ArrowRight, 
  Users, 
  Briefcase,
  Brain, 
  BarChart3, 
  CheckCircle,
  Play,
  Phone,
  Mail,
  Send,
  Loader2,
  Menu,
  X,
  Target,
  Activity,
  Timer,
  UserCheck,
  FileText,
  Calendar,
  Zap,
  Shield,
  TrendingUp,
  Clock,
  Award,
  Globe,
  Sparkles
} from 'lucide-react';

// All Features
const allFeatures = [
  {
    icon: Users,
    title: 'Candidate Management',
    description: 'Upload, organize, and track candidates with AI-powered CV parsing and structured profiles.',
    color: 'from-blue-500 to-cyan-500',
  },
  {
    icon: Briefcase,
    title: 'Job Pipeline',
    description: 'Create jobs, manage the hiring lifecycle, and track progress with visual Kanban boards.',
    color: 'from-purple-500 to-pink-500',
  },
  {
    icon: Brain,
    title: 'AI Matching',
    description: 'Match candidates to jobs with AI-powered scoring, explanations, and gap analysis.',
    color: 'from-amber-500 to-orange-500',
  },
  {
    icon: Timer,
    title: 'Work Tracking',
    description: 'Real-time tracking of recruiter activity, work sessions, and productivity metrics.',
    color: 'from-emerald-500 to-teal-500',
  },
  {
    icon: BarChart3,
    title: 'Performance Analytics',
    description: 'Comprehensive dashboards for KPIs, CV submissions, interviews, and placements.',
    color: 'from-rose-500 to-red-500',
  },
  {
    icon: Calendar,
    title: 'Interview Scheduling',
    description: 'Schedule interviews, send invitations, and manage calendars seamlessly.',
    color: 'from-indigo-500 to-violet-500',
  },
  {
    icon: Mail,
    title: 'Email Integration',
    description: 'Send personalized emails with templates, tracking, and AI-powered composition.',
    color: 'from-sky-500 to-blue-500',
  },
  {
    icon: Shield,
    title: 'Team Permissions',
    description: 'Role-based access control for owners, managers, and recruiters.',
    color: 'from-slate-500 to-gray-600',
  },
];

// Quick features for hero
const heroFeatures = [
  { icon: Zap, text: 'AI-Powered Matching' },
  { icon: TrendingUp, text: 'Performance Analytics' },
  { icon: Clock, text: 'Work Time Tracking' },
  { icon: Award, text: 'Team KPI Dashboard' },
];

interface TrustedClient {
  id: string;
  name: string;
  logo_url: string;
  website_url: string | null;
}

// Trusted Clients Section
function TrustedClientsSection() {
  const [clients, setClients] = useState<TrustedClient[]>([]);

  useEffect(() => {
    const fetchClients = async () => {
      const { data } = await supabase
        .from('trusted_clients')
        .select('id, name, logo_url, website_url')
        .eq('is_active', true)
        .order('display_order');
      
      if (data && data.length > 0) {
        setClients(data);
      }
    };
    fetchClients();
  }, []);

  if (clients.length === 0) {
    // Fallback placeholder logos
    return (
      <section className="py-16 border-y border-border/50 bg-muted/20">
        <div className="container mx-auto px-6">
          <p className="text-center text-sm text-muted-foreground mb-8 font-medium tracking-wide uppercase">
            Trusted by recruitment agencies worldwide
          </p>
          <div className="flex flex-wrap justify-center items-center gap-x-16 gap-y-8">
            {['TalentForce', 'RecruitPro', 'HireWise', 'StaffingHub', 'PeoplePlus'].map((company, i) => (
              <motion.span 
                key={i} 
                initial={{ opacity: 0 }}
                whileInView={{ opacity: 1 }}
                transition={{ delay: i * 0.1 }}
                viewport={{ once: true }}
                className="text-xl font-bold text-muted-foreground/40"
              >
                {company}
              </motion.span>
            ))}
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="py-16 border-y border-border/50 bg-muted/20 overflow-hidden">
      <div className="container mx-auto px-6">
        <p className="text-center text-sm text-muted-foreground mb-8 font-medium tracking-wide uppercase">
          Trusted by recruitment agencies worldwide
        </p>
        <div className="relative">
          <div className="flex animate-marquee gap-16 items-center">
            {[...clients, ...clients].map((client, i) => (
              <a
                key={`${client.id}-${i}`}
                href={client.website_url || '#'}
                target={client.website_url ? '_blank' : undefined}
                rel="noopener noreferrer"
                className="flex-shrink-0 grayscale hover:grayscale-0 opacity-60 hover:opacity-100 transition-all duration-300"
              >
                <img 
                  src={client.logo_url} 
                  alt={client.name}
                  className="h-10 max-w-[140px] object-contain"
                />
              </a>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

// Footer
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
          html: `<p><strong>Name:</strong> ${formData.name}</p><p><strong>Email:</strong> ${formData.email}</p><p>${formData.message}</p>`
        }
      });
      toast({ title: "Message sent", description: "We'll get back to you soon." });
      setFormData({ name: '', email: '', message: '' });
    } catch {
      toast({ title: "Error", description: "Please try again.", variant: "destructive" });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <footer className="border-t border-border bg-card">
      <div className="container mx-auto px-6 py-16">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-12">
          <div className="lg:col-span-1">
            <Link to="/" className="inline-block mb-4">
              <Logo size="md" />
            </Link>
            <p className="text-sm text-muted-foreground mb-6 max-w-xs">
              The recruitment analytics platform for agencies and remote teams.
            </p>
            <div className="space-y-2 text-sm text-muted-foreground">
              <div className="flex items-center gap-2">
                <Phone className="h-4 w-4" />
                <span>+447426468550 (WhatsApp Available)</span>
              </div>
              <div className="flex items-center gap-2">
                <Mail className="h-4 w-4" />
                <span>{BRAND.email}</span>
              </div>
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
            </ul>
          </div>

          <div>
            <h4 className="font-semibold text-sm mb-4">Contact Us</h4>
            <form onSubmit={handleSubmit} className="space-y-3">
              <Input 
                placeholder="Your name" 
                value={formData.name} 
                onChange={(e) => setFormData({ ...formData, name: e.target.value })} 
                required 
                className="h-9 text-sm bg-background" 
              />
              <Input 
                type="email" 
                placeholder="Email" 
                value={formData.email} 
                onChange={(e) => setFormData({ ...formData, email: e.target.value })} 
                required 
                className="h-9 text-sm bg-background" 
              />
              <Textarea 
                placeholder="Message" 
                rows={2} 
                value={formData.message} 
                onChange={(e) => setFormData({ ...formData, message: e.target.value })} 
                required 
                className="text-sm resize-none bg-background" 
              />
              <Button type="submit" size="sm" className="w-full" disabled={isSubmitting}>
                {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                {isSubmitting ? 'Sending...' : 'Send'}
              </Button>
            </form>
          </div>
        </div>

        <div className="border-t border-border mt-12 pt-8 text-center">
          <p className="text-xs text-muted-foreground">
            © {new Date().getFullYear()} {BRAND.name}. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  );
}

export default function LandingPage() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [watchDemoOpen, setWatchDemoOpen] = useState(false);
  const [bookDemoOpen, setBookDemoOpen] = useState(false);
  const [demoVideoUrl, setDemoVideoUrl] = useState<string | null>(null);
  const { plans: pricingPlans } = usePublicPricingPlans();

  useEffect(() => {
    const fetchDemoVideoUrl = async () => {
      const { data } = await supabase
        .from('platform_settings')
        .select('value')
        .eq('key', 'demo_video_url')
        .single();
      
      if (data?.value) {
        const url = typeof data.value === 'string' ? data.value.replace(/^"|"$/g, '') : String(data.value);
        setDemoVideoUrl(url || null);
      }
    };
    fetchDemoVideoUrl();
  }, []);

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="fixed top-0 left-0 right-0 z-50 bg-background/80 backdrop-blur-xl border-b border-border/50">
        <PublicPromoBanner />
        <div className="container mx-auto px-6 h-16 flex items-center justify-between">
          <Link to="/" className="flex items-center">
            <Logo size="md" />
          </Link>
          
          <nav className="hidden md:flex items-center gap-8">
            <a href="#features" className="text-sm text-muted-foreground hover:text-foreground transition-colors font-medium">Features</a>
            <a href="#pricing" className="text-sm text-muted-foreground hover:text-foreground transition-colors font-medium">Pricing</a>
            <Link to="/about" className="text-sm text-muted-foreground hover:text-foreground transition-colors font-medium">About</Link>
          </nav>
          
          <div className="hidden md:flex items-center gap-3">
            <Link to="/auth">
              <Button variant="ghost" size="sm">Log in</Button>
            </Link>
            <Link to="/auth?mode=signup">
              <Button size="sm" className="bg-primary hover:bg-primary/90">
                Start Free Trial
              </Button>
            </Link>
          </div>
          
          <button 
            className="md:hidden p-2"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          >
            {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
        
        {mobileMenuOpen && (
          <motion.div 
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="md:hidden border-t border-border bg-background"
          >
            <nav className="container mx-auto px-6 py-4 flex flex-col gap-2">
              <a href="#features" onClick={() => setMobileMenuOpen(false)} className="py-2 text-muted-foreground">Features</a>
              <a href="#pricing" onClick={() => setMobileMenuOpen(false)} className="py-2 text-muted-foreground">Pricing</a>
              <Link to="/about" onClick={() => setMobileMenuOpen(false)} className="py-2 text-muted-foreground">About</Link>
              <div className="flex flex-col gap-2 pt-4 border-t border-border">
                <Link to="/auth" onClick={() => setMobileMenuOpen(false)}>
                  <Button variant="outline" className="w-full">Log in</Button>
                </Link>
                <Link to="/auth?mode=signup" onClick={() => setMobileMenuOpen(false)}>
                  <Button className="w-full">Start Free Trial</Button>
                </Link>
              </div>
            </nav>
          </motion.div>
        )}
      </header>

      {/* Hero Section */}
      <section className="pt-28 pb-20 md:pt-36 md:pb-28 px-6 relative overflow-hidden">
        {/* Background decorations */}
        <div className="absolute inset-0 -z-10">
          <div className="absolute top-20 left-1/4 w-96 h-96 bg-primary/5 rounded-full blur-3xl" />
          <div className="absolute bottom-20 right-1/4 w-96 h-96 bg-accent/5 rounded-full blur-3xl" />
        </div>
        
        <div className="container mx-auto max-w-5xl">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="text-center space-y-6"
          >
            {/* Badge */}
            <motion.div 
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.1 }}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 border border-primary/20"
            >
              <Sparkles className="h-4 w-4 text-primary" />
              <span className="text-sm font-medium text-primary">AI-Powered Recruitment Analytics</span>
            </motion.div>

            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight text-foreground leading-tight">
              Recruitment You Can{' '}
              <span className="relative">
                <span className="bg-gradient-to-r from-primary to-primary/70 bg-clip-text text-transparent">
                  Actually Measure
                </span>
                <svg className="absolute -bottom-2 left-0 w-full" viewBox="0 0 300 12" fill="none">
                  <path d="M2 8C50 4 100 2 150 6C200 10 250 6 298 4" stroke="currentColor" strokeWidth="3" strokeLinecap="round" className="text-primary/30" />
                </svg>
              </span>
            </h1>
            
            <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto leading-relaxed">
              The performance platform for recruitment agencies. Track productivity, 
              manage candidates with AI, and make data-driven hiring decisions.
            </p>

            {/* Hero features */}
            <div className="flex flex-wrap justify-center gap-4 pt-2">
              {heroFeatures.map((feature, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.3 + i * 0.1 }}
                  className="flex items-center gap-2 text-sm text-muted-foreground"
                >
                  <feature.icon className="h-4 w-4 text-primary" />
                  <span>{feature.text}</span>
                </motion.div>
              ))}
            </div>
            
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5 }}
              className="flex flex-col sm:flex-row gap-4 justify-center pt-4"
            >
              <Link to="/auth?mode=signup">
                <Button size="lg" className="w-full sm:w-auto gap-2 h-12 px-8 text-base">
                  Start Free Trial
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
              <Button 
                variant="outline" 
                size="lg"
                className="w-full sm:w-auto gap-2 h-12 px-8 text-base"
                onClick={() => demoVideoUrl ? setWatchDemoOpen(true) : setBookDemoOpen(true)}
              >
                <Play className="h-4 w-4" />
                Watch Demo
              </Button>
            </motion.div>
            
            <p className="text-sm text-muted-foreground">
              No credit card required · Free 14-day trial · Cancel anytime
            </p>
          </motion.div>

          {/* Dashboard Preview */}
          <motion.div
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.3 }}
            className="mt-16 relative"
          >
            <div className="rounded-2xl border border-border shadow-2xl overflow-hidden bg-card">
              <div className="h-10 bg-muted border-b border-border flex items-center gap-2 px-4">
                <div className="flex gap-2">
                  <div className="w-3 h-3 rounded-full bg-red-400" />
                  <div className="w-3 h-3 rounded-full bg-yellow-400" />
                  <div className="w-3 h-3 rounded-full bg-green-400" />
                </div>
                <div className="flex-1 flex justify-center">
                  <div className="px-4 py-1 bg-background rounded-md text-xs text-muted-foreground">
                    hiremetrics.io/dashboard
                  </div>
                </div>
              </div>
              <div className="p-6 bg-background">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {[
                    { label: 'Active Jobs', value: '24', icon: Briefcase, trend: '+3 this week' },
                    { label: 'Candidates', value: '1,284', icon: Users, trend: '+47 new' },
                    { label: 'AI Matches', value: '856', icon: Brain, trend: '94% accuracy' },
                    { label: 'Team Active', value: '8/10', icon: Activity, trend: 'Online now' },
                  ].map((stat, i) => (
                    <motion.div 
                      key={i} 
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.5 + i * 0.1 }}
                      className="p-4 rounded-xl border border-border bg-card hover:shadow-md transition-shadow"
                    >
                      <div className="flex items-center gap-2 mb-2">
                        <stat.icon className="h-4 w-4 text-primary" />
                        <span className="text-xs text-muted-foreground">{stat.label}</span>
                      </div>
                      <div className="text-2xl font-bold text-foreground">{stat.value}</div>
                      <div className="text-xs text-muted-foreground mt-1">{stat.trend}</div>
                    </motion.div>
                  ))}
                </div>
              </div>
            </div>
            <div className="absolute inset-x-0 bottom-0 h-40 bg-gradient-to-t from-background to-transparent pointer-events-none" />
          </motion.div>
        </div>
      </section>

      {/* Trusted Clients */}
      <TrustedClientsSection />

      {/* Features Section */}
      <section id="features" className="py-24 px-6">
        <div className="container mx-auto max-w-6xl">
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-16"
          >
            <span className="text-sm font-medium text-primary uppercase tracking-wider">Features</span>
            <h2 className="text-3xl md:text-4xl font-bold tracking-tight text-foreground mt-2 mb-4">
              Everything You Need to Hire Better
            </h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              One platform for candidates, jobs, AI matching, and team performance tracking.
            </p>
          </motion.div>
          
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            {allFeatures.map((feature, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: i * 0.05 }}
                viewport={{ once: true }}
                className="group p-6 rounded-2xl border border-border bg-card hover:shadow-lg hover:border-primary/30 transition-all duration-300"
              >
                <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${feature.color} flex items-center justify-center mb-4 group-hover:scale-110 transition-transform`}>
                  <feature.icon className="h-6 w-6 text-white" />
                </div>
                <h3 className="text-lg font-semibold mb-2">{feature.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{feature.description}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Value Proposition */}
      <section className="py-24 px-6 bg-muted/30">
        <div className="container mx-auto max-w-6xl">
          <div className="grid lg:grid-cols-2 gap-16 items-center">
            <motion.div
              initial={{ opacity: 0, x: -30 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
            >
              <span className="text-sm font-medium text-primary uppercase tracking-wider">Why Hiremetrics</span>
              <h2 className="text-3xl md:text-4xl font-bold tracking-tight text-foreground mt-2 mb-6">
                Know Exactly Who Is Working and How They Perform
              </h2>
              <p className="text-muted-foreground mb-8 leading-relaxed text-lg">
                Most CRMs track candidates. Hiremetrics tracks your team. See work hours, 
                CV submissions, interview schedules, and placement rates—all in one dashboard.
              </p>
              <ul className="space-y-4">
                {[
                  'Real-time work tracking for remote teams',
                  'Individual and team KPI dashboards',
                  'AI usage with full cost control',
                  'Role-based access for owners, managers, recruiters'
                ].map((item, i) => (
                  <motion.li 
                    key={i} 
                    initial={{ opacity: 0, x: -20 }}
                    whileInView={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.1 }}
                    viewport={{ once: true }}
                    className="flex items-start gap-3"
                  >
                    <div className="mt-1 w-5 h-5 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                      <CheckCircle className="h-3 w-3 text-primary" />
                    </div>
                    <span className="text-foreground">{item}</span>
                  </motion.li>
                ))}
              </ul>
              <div className="mt-8">
                <Link to="/auth?mode=signup">
                  <Button size="lg" className="gap-2">
                    Get Started Free
                    <ArrowRight className="h-4 w-4" />
                  </Button>
                </Link>
              </div>
            </motion.div>
            
            <motion.div
              initial={{ opacity: 0, x: 30 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              className="p-8 rounded-2xl border border-border bg-card shadow-xl"
            >
              <div className="space-y-4">
                {[
                  { label: 'Work Sessions Today', value: '8 active', icon: Timer, color: 'text-emerald-500' },
                  { label: 'CVs Submitted', value: '47 this week', icon: FileText, color: 'text-blue-500' },
                  { label: 'AI Credits Used', value: '234 / 500', icon: Brain, color: 'text-purple-500' },
                  { label: 'Placements', value: '12 this month', icon: UserCheck, color: 'text-amber-500' },
                ].map((stat, i) => (
                  <motion.div 
                    key={i} 
                    initial={{ opacity: 0, y: 10 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.1 }}
                    viewport={{ once: true }}
                    className="flex items-center justify-between p-4 rounded-xl bg-muted/50 hover:bg-muted transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <div className={`p-2 rounded-lg bg-background ${stat.color}`}>
                        <stat.icon className="h-5 w-5" />
                      </div>
                      <span className="text-sm font-medium">{stat.label}</span>
                    </div>
                    <span className="text-sm font-semibold">{stat.value}</span>
                  </motion.div>
                ))}
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section id="pricing" className="py-24 px-6">
        <div className="container mx-auto max-w-5xl">
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-16"
          >
            <span className="text-sm font-medium text-primary uppercase tracking-wider">Pricing</span>
            <h2 className="text-3xl md:text-4xl font-bold tracking-tight text-foreground mt-2 mb-4">
              Simple, Transparent Pricing
            </h2>
            <p className="text-lg text-muted-foreground">
              Start free, scale as you grow. No hidden fees.
            </p>
          </motion.div>
          
          <div className={`grid gap-8 ${pricingPlans.length === 4 ? 'md:grid-cols-2 lg:grid-cols-4' : 'md:grid-cols-3'}`}>
            {pricingPlans.map((plan, i) => (
              <motion.div
                key={plan.id}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: i * 0.1 }}
                viewport={{ once: true }}
                className={`relative p-8 rounded-2xl border bg-card ${
                  plan.is_popular ? 'border-primary shadow-xl scale-105' : 'border-border'
                }`}
              >
                {plan.is_popular && (
                  <div className="absolute -top-4 left-1/2 -translate-x-1/2">
                    <span className="bg-primary text-primary-foreground text-xs font-medium px-4 py-1.5 rounded-full">
                      Most Popular
                    </span>
                  </div>
                )}
                <div className="text-center mb-6">
                  <h3 className="text-xl font-semibold mb-1">{plan.name}</h3>
                  <p className="text-sm text-muted-foreground mb-4">{plan.description || ''}</p>
                  <div className="flex items-baseline justify-center gap-1">
                    <span className="text-4xl font-bold">£{plan.price_monthly}</span>
                    <span className="text-muted-foreground">/month</span>
                  </div>
                </div>
                <ul className="space-y-3 mb-8">
                  {plan.features.map((feature, j) => (
                    <li key={j} className="flex items-center gap-3 text-sm">
                      <CheckCircle className="h-4 w-4 text-primary flex-shrink-0" />
                      {feature}
                    </li>
                  ))}
                </ul>
                <Link to="/auth?mode=signup">
                  <Button 
                    variant={plan.is_popular ? 'default' : 'outline'} 
                    className="w-full"
                  >
                    Get Started
                  </Button>
                </Link>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-24 px-6 bg-primary text-primary-foreground relative overflow-hidden">
        <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.03)_1px,transparent_1px)] bg-[size:64px_64px]" />
        <div className="container mx-auto max-w-3xl text-center relative z-10">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
          >
            <h2 className="text-3xl md:text-4xl font-bold tracking-tight mb-4">
              Ready to Transform Your Recruitment?
            </h2>
            <p className="text-primary-foreground/80 mb-8 text-lg">
              Start your free trial today. No credit card required.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
              <Link to="/auth?mode=signup">
                <Button size="lg" variant="secondary" className="gap-2 h-12 px-8 min-w-[180px]">
                  Start Free Trial
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
              <Button 
                size="lg" 
                variant="secondary"
                className="h-12 px-8 min-w-[180px] bg-white text-primary hover:bg-white/90"
                onClick={() => setBookDemoOpen(true)}
              >
                Book a Demo
              </Button>
            </div>
          </motion.div>
        </div>
      </section>

      <Footer />

      <WatchDemoDialog open={watchDemoOpen} onOpenChange={setWatchDemoOpen} videoUrl={demoVideoUrl} />
      <BookDemoDialog open={bookDemoOpen} onOpenChange={setBookDemoOpen} />

      {/* Add marquee animation styles */}
      <style>{`
        @keyframes marquee {
          0% { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
        .animate-marquee {
          animation: marquee 30s linear infinite;
        }
      `}</style>
    </div>
  );
}
