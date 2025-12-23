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
  Clock,
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
  ChevronRight
} from 'lucide-react';

// Pricing Plans
const plans = [
  {
    name: 'Basic',
    price: '£29',
    period: '/month',
    description: 'For solo recruiters',
    features: ['10 Active Jobs', '100 CV Uploads', '50 AI Matches', '1 User', 'Email Support'],
    popular: false,
  },
  {
    name: 'Starter',
    price: '£79',
    period: '/month',
    description: 'For small agencies',
    features: ['50 Active Jobs', '500 CV Uploads', '200 AI Matches', 'Up to 5 Users', 'Team Tracking', 'Priority Support'],
    popular: true,
  },
  {
    name: 'Pro',
    price: '£149',
    period: '/month',
    description: 'For growing teams',
    features: ['Unlimited Jobs', 'Unlimited CVs', '1000 AI Matches', 'Up to 25 Users', 'Full Analytics', 'API Access'],
    popular: false,
  },
];

// Features
const features = [
  {
    icon: Users,
    title: 'Candidate Management',
    description: 'Upload, organize, and track candidates with structured profiles and CV parsing.',
  },
  {
    icon: Briefcase,
    title: 'Job Pipeline',
    description: 'Create jobs, attach clients, and manage the full hiring lifecycle.',
  },
  {
    icon: Brain,
    title: 'AI Matching',
    description: 'Match candidates to jobs with AI-powered scoring and transparency.',
  },
  {
    icon: Timer,
    title: 'Work Tracking',
    description: 'See who is working, when, and measure recruiter productivity.',
  },
  {
    icon: BarChart3,
    title: 'Performance Analytics',
    description: 'Track KPIs, CVs submitted, interviews, and placements.',
  },
  {
    icon: Calendar,
    title: 'Interview Scheduling',
    description: 'Schedule interviews and send automatic notifications.',
  },
];

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
    <footer className="border-t border-border bg-muted/30">
      <div className="container mx-auto px-6 py-16">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-12">
          <div className="lg:col-span-1">
            <Link to="/" className="inline-block mb-4">
              <Logo size="md" />
            </Link>
            <p className="text-sm text-muted-foreground mb-6 max-w-xs">
              Recruitment performance platform for agencies and remote teams.
            </p>
            <div className="space-y-2 text-sm text-muted-foreground">
              <div className="flex items-center gap-2">
                <Phone className="h-4 w-4" />
                <span>+44 7426 468550</span>
              </div>
              <div className="flex items-center gap-2">
                <Mail className="h-4 w-4" />
                <span>{BRAND.email}</span>
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
            © {new Date().getFullYear()} {BRAND.name}. All rights reserved. A product of Tasaru Ventures Ltd.
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
        <div className="container mx-auto px-6 h-16 flex items-center justify-between">
          <Link to="/" className="flex items-center">
            <Logo size="md" />
          </Link>
          
          <nav className="hidden md:flex items-center gap-8">
            <a href="#features" className="text-sm text-muted-foreground hover:text-foreground transition-colors">Features</a>
            <a href="#pricing" className="text-sm text-muted-foreground hover:text-foreground transition-colors">Pricing</a>
            <Link to="/about" className="text-sm text-muted-foreground hover:text-foreground transition-colors">About</Link>
          </nav>
          
          <div className="hidden md:flex items-center gap-3">
            <Link to="/auth">
              <Button variant="ghost" size="sm">Log in</Button>
            </Link>
            <Link to="/auth?mode=signup">
              <Button variant="accent" size="sm">
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
          <div className="md:hidden border-t border-border bg-background">
            <nav className="container mx-auto px-6 py-4 flex flex-col gap-2">
              <a href="#features" onClick={() => setMobileMenuOpen(false)} className="py-2 text-muted-foreground">Features</a>
              <a href="#pricing" onClick={() => setMobileMenuOpen(false)} className="py-2 text-muted-foreground">Pricing</a>
              <Link to="/about" onClick={() => setMobileMenuOpen(false)} className="py-2 text-muted-foreground">About</Link>
              <div className="flex flex-col gap-2 pt-4 border-t border-border">
                <Link to="/auth" onClick={() => setMobileMenuOpen(false)}>
                  <Button variant="outline" className="w-full">Log in</Button>
                </Link>
                <Link to="/auth?mode=signup" onClick={() => setMobileMenuOpen(false)}>
                  <Button variant="accent" className="w-full">Start Free Trial</Button>
                </Link>
              </div>
            </nav>
          </div>
        )}
      </header>

      {/* Hero Section */}
      <section className="pt-32 pb-20 md:pt-40 md:pb-28 px-6">
        <div className="container mx-auto max-w-4xl text-center">
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: [0.25, 0.46, 0.45, 0.94] }}
            className="space-y-6"
          >
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-semibold tracking-tight text-foreground text-balance">
              Recruitment that you can{' '}
              <span className="text-accent">actually measure</span>
            </h1>
            
            <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto">
              The performance platform for recruitment agencies. Track productivity, 
              manage candidates, and hire with full control.
            </p>
            
            <div className="flex flex-col sm:flex-row gap-3 justify-center pt-4">
              <Link to="/auth?mode=signup">
                <Button variant="accent" size="lg" className="w-full sm:w-auto gap-2">
                  Start Free Trial
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
              <Button 
                variant="outline" 
                size="lg"
                className="w-full sm:w-auto gap-2"
                onClick={() => demoVideoUrl ? setWatchDemoOpen(true) : setBookDemoOpen(true)}
              >
                <Play className="h-4 w-4" />
                Watch Demo
              </Button>
            </div>
            
            <p className="text-sm text-muted-foreground pt-2">
              No credit card required · Free 14-day trial
            </p>
          </motion.div>

          {/* Dashboard Preview */}
          <motion.div
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.2, ease: [0.25, 0.46, 0.45, 0.94] }}
            className="mt-16 relative"
          >
            <div className="rounded-xl border border-border shadow-xl overflow-hidden bg-card">
              <div className="h-10 bg-muted border-b border-border flex items-center gap-2 px-4">
                <div className="w-3 h-3 rounded-full bg-border" />
                <div className="w-3 h-3 rounded-full bg-border" />
                <div className="w-3 h-3 rounded-full bg-border" />
              </div>
              <div className="p-6 bg-background">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {[
                    { label: 'Active Jobs', value: '24', icon: Briefcase },
                    { label: 'Candidates', value: '1,284', icon: Users },
                    { label: 'AI Matches', value: '856', icon: Brain },
                    { label: 'Team Active', value: '8/10', icon: Activity },
                  ].map((stat, i) => (
                    <div key={i} className="p-4 rounded-lg border border-border bg-card">
                      <stat.icon className="h-5 w-5 text-muted-foreground mb-2" />
                      <div className="text-2xl font-semibold text-foreground">{stat.value}</div>
                      <div className="text-sm text-muted-foreground">{stat.label}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
            <div className="absolute inset-x-0 bottom-0 h-32 bg-gradient-to-t from-background to-transparent pointer-events-none" />
          </motion.div>
        </div>
      </section>

      {/* Social Proof */}
      <section className="py-12 border-y border-border bg-muted/30">
        <div className="container mx-auto px-6">
          <p className="text-center text-sm text-muted-foreground mb-8">
            Trusted by recruitment agencies worldwide
          </p>
          <div className="flex flex-wrap justify-center items-center gap-x-12 gap-y-6">
            {['Agency Pro', 'TalentFirst', 'HireRight', 'RecruitFlow', 'StaffingPlus'].map((company, i) => (
              <span key={i} className="text-lg font-semibold text-muted-foreground/50">{company}</span>
            ))}
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="py-20 md:py-28 px-6">
        <div className="container mx-auto max-w-5xl">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-semibold tracking-tight text-foreground mb-4">
              Everything you need to run your agency
            </h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              One platform for candidates, jobs, AI matching, and team performance tracking.
            </p>
          </div>
          
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {features.map((feature, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: i * 0.1 }}
                viewport={{ once: true }}
                className="p-6 rounded-xl border border-border bg-card hover:shadow-md transition-shadow"
              >
                <div className="w-10 h-10 rounded-lg bg-accent/10 flex items-center justify-center mb-4">
                  <feature.icon className="h-5 w-5 text-accent" />
                </div>
                <h3 className="text-lg font-semibold mb-2">{feature.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{feature.description}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Value Proposition */}
      <section className="py-20 md:py-28 px-6 bg-muted/30">
        <div className="container mx-auto max-w-5xl">
          <div className="grid md:grid-cols-2 gap-12 items-center">
            <div>
              <h2 className="text-3xl md:text-4xl font-semibold tracking-tight text-foreground mb-6">
                Know exactly who is working and how they perform
              </h2>
              <p className="text-muted-foreground mb-8 leading-relaxed">
                Most CRMs track candidates. HireMetrics tracks your team. See work hours, 
                CV submissions, interview schedules, and placement rates—all in one dashboard.
              </p>
              <ul className="space-y-3">
                {[
                  'Real-time work tracking for remote teams',
                  'Individual and team KPI dashboards',
                  'AI usage with full cost control',
                  'Role-based access for owners, managers, recruiters'
                ].map((item, i) => (
                  <li key={i} className="flex items-start gap-3">
                    <CheckCircle className="h-5 w-5 text-success flex-shrink-0 mt-0.5" />
                    <span className="text-sm">{item}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div className="p-8 rounded-xl border border-border bg-card">
              <div className="space-y-4">
                {[
                  { label: 'Work Sessions Today', value: '8 active', icon: Timer },
                  { label: 'CVs Submitted', value: '47 this week', icon: FileText },
                  { label: 'AI Credits Used', value: '234 / 500', icon: Brain },
                  { label: 'Placements', value: '12 this month', icon: UserCheck },
                ].map((stat, i) => (
                  <div key={i} className="flex items-center justify-between p-4 rounded-lg bg-muted/50">
                    <div className="flex items-center gap-3">
                      <stat.icon className="h-5 w-5 text-muted-foreground" />
                      <span className="text-sm">{stat.label}</span>
                    </div>
                    <span className="text-sm font-medium">{stat.value}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section id="pricing" className="py-20 md:py-28 px-6">
        <div className="container mx-auto max-w-5xl">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-semibold tracking-tight text-foreground mb-4">
              Simple, transparent pricing
            </h2>
            <p className="text-lg text-muted-foreground">
              Start free, scale as you grow. No hidden fees.
            </p>
          </div>
          
          <div className="grid md:grid-cols-3 gap-6">
            {plans.map((plan, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: i * 0.1 }}
                viewport={{ once: true }}
                className={`relative p-6 rounded-xl border bg-card ${
                  plan.popular ? 'border-accent shadow-lg' : 'border-border'
                }`}
              >
                {plan.popular && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                    <span className="bg-accent text-accent-foreground text-xs font-medium px-3 py-1 rounded-full">
                      Most Popular
                    </span>
                  </div>
                )}
                <div className="text-center mb-6">
                  <h3 className="text-lg font-semibold mb-1">{plan.name}</h3>
                  <p className="text-sm text-muted-foreground mb-4">{plan.description}</p>
                  <div className="flex items-baseline justify-center gap-1">
                    <span className="text-4xl font-semibold">{plan.price}</span>
                    <span className="text-muted-foreground">{plan.period}</span>
                  </div>
                </div>
                <ul className="space-y-3 mb-6">
                  {plan.features.map((feature, j) => (
                    <li key={j} className="flex items-center gap-2 text-sm">
                      <CheckCircle className="h-4 w-4 text-success flex-shrink-0" />
                      {feature}
                    </li>
                  ))}
                </ul>
                <Link to="/auth?mode=signup">
                  <Button 
                    variant={plan.popular ? 'accent' : 'outline'} 
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
      <section className="py-20 md:py-28 px-6 bg-primary text-primary-foreground">
        <div className="container mx-auto max-w-3xl text-center">
          <h2 className="text-3xl md:text-4xl font-semibold tracking-tight mb-4">
            Ready to take control of your recruitment?
          </h2>
          <p className="text-primary-foreground/80 mb-8 text-lg">
            Start your free trial today. No credit card required.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link to="/auth?mode=signup">
              <Button size="lg" variant="secondary" className="w-full sm:w-auto gap-2">
                Start Free Trial
                <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
            <Button 
              size="lg" 
              variant="outline"
              className="w-full sm:w-auto border-primary-foreground/30 text-primary-foreground hover:bg-primary-foreground/10"
              onClick={() => setBookDemoOpen(true)}
            >
              Book a Demo
            </Button>
          </div>
        </div>
      </section>

      <Footer />

      <WatchDemoDialog open={watchDemoOpen} onOpenChange={setWatchDemoOpen} videoUrl={demoVideoUrl} />
      <BookDemoDialog open={bookDemoOpen} onOpenChange={setBookDemoOpen} />
    </div>
  );
}