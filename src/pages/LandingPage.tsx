import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { supabase } from '@/integrations/supabase/client';
import { Logo, BRAND } from '@/components/brand/Logo';
import { useToast } from '@/hooks/use-toast';
import { TestimonialsCarousel } from '@/components/testimonials/TestimonialsCarousel';
import { CustomerFeedbackForm } from '@/components/testimonials/CustomerFeedbackForm';
import { BookDemoDialog } from '@/components/landing/BookDemoDialog';
import { WatchDemoDialog } from '@/components/landing/WatchDemoDialog';
import { 
  ArrowRight, 
  Users, 
  Briefcase,
  Brain, 
  BarChart3, 
  Shield, 
  CheckCircle,
  Play,
  Phone,
  Mail,
  Clock,
  Send,
  Loader2,
  Menu,
  X,
  Calendar,
  Target,
  Eye,
  EyeOff,
  Activity,
  TrendingUp,
  Timer,
  Coffee,
  UserCheck,
  FileText,
  MessageSquare,
  Lock,
  Crown,
  Building,
  AlertTriangle,
  Zap,
  Settings,
  ChevronRight
} from 'lucide-react';

// Pain points data
const painPoints = [
  { icon: EyeOff, text: "You don't know who is actually working" },
  { icon: BarChart3, text: "Recruiter productivity is hard to measure" },
  { icon: FileText, text: "CVs are submitted, but performance is unclear" },
  { icon: Brain, text: "AI tools exist, but results aren't tracked" },
  { icon: Users, text: "Team management happens outside the CRM" },
];

// Core Features Data
const recruitmentFeatures = [
  { icon: Briefcase, title: "Jobs & Clients", description: "Create and manage jobs with full lifecycle tracking. Attach clients, hiring managers, and notes." },
  { icon: Users, title: "Candidates & CV Management", description: "Upload candidates manually or in bulk. CV parsing and structured candidate profiles." },
  { icon: FileText, title: "Branded CV Downloads", description: "Download CVs with your company branding. Professional presentation every time." },
];

const aiFeatures = [
  { icon: Brain, title: "AI-Powered CV Matching", description: "Match candidates to jobs with AI. Score candidates job-by-job with full transparency." },
  { icon: Target, title: "Controlled AI Usage", description: "Control AI usage via monthly credits. No surprise costs, full visibility on AI operations." },
  { icon: Shield, title: "AI Assists, Not Replaces", description: "AI supports recruiter decisions without replacing human judgment. You stay in control." },
];

const workTrackingFeatures = [
  { icon: Timer, title: "Start Work", description: "Recruiters clock in when they begin their workday." },
  { icon: Coffee, title: "Break Tracking", description: "Breaks are logged automatically for accurate time records." },
  { icon: Activity, title: "Resume & End Day", description: "Every action is logged. Owners see who is working, when, and for how long." },
];

const kpiMetrics = [
  "CVs submitted",
  "Interviews scheduled", 
  "Offers made",
  "Hires completed",
  "Rejection ratios"
];

const viewPeriods = ["Daily", "Weekly", "Monthly", "Yearly"];

const communicationFeatures = [
  { icon: Mail, title: "Email Integration", description: "Email candidates directly from dashboard with auto templates and signatures." },
  { icon: MessageSquare, title: "WhatsApp Click-to-Chat", description: "Instant WhatsApp communication with one click." },
  { icon: Calendar, title: "Interview Scheduling", description: "Schedule interviews, invite candidates and clients via email with automatic notifications." },
];

// Roles Data
const roles = [
  {
    icon: Crown,
    title: "Owner",
    color: "text-accent",
    features: ["Full access", "Billing & subscription", "Team management", "Reports & analytics"]
  },
  {
    icon: Building,
    title: "Manager", 
    color: "text-primary",
    features: ["Team oversight", "Performance tracking", "No billing access", "Job management"]
  },
  {
    icon: UserCheck,
    title: "Recruiter",
    color: "text-slate",
    features: ["Sourcing", "Screening", "AI matching", "Candidate communication"]
  }
];

// Pricing Plans - Updated as requested
const plans = [
  {
    name: 'BASIC',
    price: '£29',
    period: '/month',
    description: 'Perfect for solo recruiters',
    features: ['10 Active Jobs', '100 CV Uploads/month', '50 AI Matches/month', '1 User', 'Email Support', 'Basic Analytics'],
    popular: false,
  },
  {
    name: 'STARTER',
    price: '£79',
    period: '/month',
    description: 'For small agencies',
    features: ['50 Active Jobs', '500 CV Uploads/month', '200 AI Matches/month', 'Up to 5 Users', 'Priority Support', 'Full Analytics', 'Team Work Tracking'],
    popular: true,
  },
  {
    name: 'PRO',
    price: '£149',
    period: '/month',
    description: 'For growing teams',
    features: ['Unlimited Jobs', 'Unlimited CV Uploads', '1000 AI Matches/month', 'Up to 25 Users', '24/7 Support', 'Advanced Analytics', 'Full Work Tracking', 'Custom Branding', 'API Access'],
    popular: false,
  },
];

// Why Choose Us
const whyChoose = [
  { icon: Building, text: "Built for agency owners, not just recruiters" },
  { icon: Activity, text: "Full team accountability" },
  { icon: Brain, text: "AI with usage control" },
  { icon: Users, text: "Remote-team friendly" },
  { icon: Settings, text: "No feature overload" },
  { icon: Zap, text: "Clean, fast, modern UI" },
];

// Security Features
const securityFeatures = [
  "Secure authentication",
  "Role-based permissions",
  "Data protection best practices",
  "Reliable cloud infrastructure"
];

// Footer Component
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
          subject: `[Contact Form] Message from ${formData.name}`,
          html: `<h2>New Contact Form Submission</h2><p><strong>Name:</strong> ${formData.name}</p><p><strong>Email:</strong> ${formData.email}</p><h3>Message:</h3><p>${formData.message.replace(/\n/g, '<br>')}</p>`
        }
      });
      toast({ title: "Message Sent!", description: "We'll get back to you within 24 hours." });
      setFormData({ name: '', email: '', message: '' });
    } catch (error) {
      toast({ title: "Error", description: "Failed to send. Please email us directly.", variant: "destructive" });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <footer className="border-t border-border py-10 sm:py-16 px-4 sm:px-6 bg-slate/5">
      <div className="container mx-auto max-w-6xl">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8 sm:gap-12 mb-8 sm:mb-12">
          <div className="sm:col-span-2 lg:col-span-1">
            <Link to="/" className="flex items-center gap-2 mb-4">
              <Logo size="md" />
            </Link>
            <p className="text-sm text-muted-foreground mb-4">Recruitment Performance Platform for agencies and remote teams.</p>
            <div className="space-y-2 text-sm">
              <div className="flex items-center gap-2 text-muted-foreground">
                <Phone className="h-4 w-4 flex-shrink-0" />
                <span>+44 7426 468550</span>
              </div>
              <div className="flex items-center gap-2 text-muted-foreground">
                <Mail className="h-4 w-4 flex-shrink-0" />
                <span className="break-all">{BRAND.email}</span>
              </div>
              <div className="flex items-center gap-2 text-muted-foreground">
                <Clock className="h-4 w-4 flex-shrink-0" />
                <span>24/7 Live Support</span>
              </div>
            </div>
          </div>

          <div>
            <h4 className="font-semibold mb-3 sm:mb-4 text-sm sm:text-base">Quick Links</h4>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li><Link to="/about" className="hover:text-foreground transition-colors">About Us</Link></li>
              <li><Link to="/features" className="hover:text-foreground transition-colors">Features</Link></li>
              <li><a href="#pricing" className="hover:text-foreground transition-colors">Pricing</a></li>
              <li><Link to="/contact" className="hover:text-foreground transition-colors">Contact Us</Link></li>
            </ul>
          </div>

          <div>
            <h4 className="font-semibold mb-3 sm:mb-4 text-sm sm:text-base">Legal</h4>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li><Link to="/privacy" className="hover:text-foreground transition-colors">Privacy Policy</Link></li>
              <li><Link to="/terms" className="hover:text-foreground transition-colors">Terms & Conditions</Link></li>
              <li><Link to="/return-policy" className="hover:text-foreground transition-colors">Return Policy</Link></li>
            </ul>
          </div>

          <div className="sm:col-span-2 lg:col-span-1">
            <h4 className="font-semibold mb-3 sm:mb-4 text-sm sm:text-base">Send us a Message</h4>
            <form onSubmit={handleSubmit} className="space-y-3">
              <Input placeholder="Your Name" value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} required className="h-9 text-sm" />
              <Input type="email" placeholder="Your Email" value={formData.email} onChange={(e) => setFormData({ ...formData, email: e.target.value })} required className="h-9 text-sm" />
              <Textarea placeholder="Your Message" rows={3} value={formData.message} onChange={(e) => setFormData({ ...formData, message: e.target.value })} required className="text-sm resize-none" />
              <Button type="submit" size="sm" className="w-full gap-2" disabled={isSubmitting}>
                {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                {isSubmitting ? 'Sending...' : 'Send'}
              </Button>
            </form>
          </div>
        </div>

        <div className="border-t border-border pt-6 sm:pt-8">
          <div className="text-center mb-4">
            <p className="text-xs sm:text-sm text-muted-foreground">
              <strong>{BRAND.name}</strong> is a sister concern company of <strong>Tasaru Ventures Ltd</strong>
            </p>
            <p className="text-xs text-muted-foreground mt-1">Business License Number: 16399822</p>
          </div>
          <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
            <p className="text-xs sm:text-sm text-muted-foreground text-center sm:text-left">© {new Date().getFullYear()} {BRAND.name}. All rights reserved.</p>
            <div className="flex gap-4">
              <a href="#" className="text-muted-foreground hover:text-foreground transition-colors">
                <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24"><path d="M24 4.557c-.883.392-1.832.656-2.828.775 1.017-.609 1.798-1.574 2.165-2.724-.951.564-2.005.974-3.127 1.195-.897-.957-2.178-1.555-3.594-1.555-3.179 0-5.515 2.966-4.797 6.045-4.091-.205-7.719-2.165-10.148-5.144-1.29 2.213-.669 5.108 1.523 6.574-.806-.026-1.566-.247-2.229-.616-.054 2.281 1.581 4.415 3.949 4.89-.693.188-1.452.232-2.224.084.626 1.956 2.444 3.379 4.6 3.419-2.07 1.623-4.678 2.348-7.29 2.04 2.179 1.397 4.768 2.212 7.548 2.212 9.142 0 14.307-7.721 13.995-14.646.962-.695 1.797-1.562 2.457-2.549z"/></svg>
              </a>
              <a href="#" className="text-muted-foreground hover:text-foreground transition-colors">
                <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24"><path d="M19 0h-14c-2.761 0-5 2.239-5 5v14c0 2.761 2.239 5 5 5h14c2.762 0 5-2.239 5-5v-14c0-2.761-2.238-5-5-5zm-11 19h-3v-11h3v11zm-1.5-12.268c-.966 0-1.75-.79-1.75-1.764s.784-1.764 1.75-1.764 1.75.79 1.75 1.764-.783 1.764-1.75 1.764zm13.5 12.268h-3v-5.604c0-3.368-4-3.113-4 0v5.604h-3v-11h3v1.765c1.396-2.586 7-2.777 7 2.476v6.759z"/></svg>
              </a>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}

// Section Component for consistent styling
function SectionTitle({ badge, title, subtitle }: { badge?: string; title: string; subtitle?: string }) {
  return (
    <div className="text-center mb-8 sm:mb-10">
      {badge && <Badge variant="outline" className="mb-3 bg-primary/5 border-primary/20 text-primary">{badge}</Badge>}
      <h2 className="text-2xl sm:text-4xl font-bold mb-3 text-foreground">{title}</h2>
      {subtitle && <p className="text-base sm:text-lg text-muted-foreground max-w-3xl mx-auto px-4">{subtitle}</p>}
    </div>
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
        const rawValue = data.value;
        const url = typeof rawValue === 'string' ? rawValue.replace(/^"|"$/g, '') : String(rawValue);
        setDemoVideoUrl(url || null);
      }
    };
    fetchDemoVideoUrl();
  }, []);

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="fixed top-0 left-0 right-0 z-50 bg-background/95 backdrop-blur-lg border-b border-border">
        <div className="container mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2">
            <Logo size="md" />
          </Link>
          
          <nav className="hidden lg:flex items-center gap-8">
            <a href="#problem" className="text-sm text-muted-foreground hover:text-foreground transition-colors">Why Us</a>
            <a href="#features" className="text-sm text-muted-foreground hover:text-foreground transition-colors">Features</a>
            <a href="#roles" className="text-sm text-muted-foreground hover:text-foreground transition-colors">Roles</a>
            <a href="#pricing" className="text-sm text-muted-foreground hover:text-foreground transition-colors">Pricing</a>
          </nav>
          
          <div className="hidden sm:flex items-center gap-4">
            <Link to="/auth">
              <Button variant="ghost" size="sm">Login</Button>
            </Link>
            <Link to="/auth?mode=signup">
              <Button size="sm" className="bg-accent hover:bg-accent/90 text-accent-foreground">
                Start Free Trial
              </Button>
            </Link>
          </div>
          
          <button 
            className="lg:hidden p-2 hover:bg-muted rounded-lg transition-colors"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          >
            {mobileMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
          </button>
        </div>
        
        <AnimatePresence>
          {mobileMenuOpen && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="lg:hidden border-t border-border bg-background"
            >
              <nav className="container mx-auto px-4 py-4 flex flex-col gap-3">
                <a href="#problem" onClick={() => setMobileMenuOpen(false)} className="py-2 text-muted-foreground hover:text-foreground transition-colors">Why Us</a>
                <a href="#features" onClick={() => setMobileMenuOpen(false)} className="py-2 text-muted-foreground hover:text-foreground transition-colors">Features</a>
                <a href="#roles" onClick={() => setMobileMenuOpen(false)} className="py-2 text-muted-foreground hover:text-foreground transition-colors">Roles</a>
                <a href="#pricing" onClick={() => setMobileMenuOpen(false)} className="py-2 text-muted-foreground hover:text-foreground transition-colors">Pricing</a>
                <div className="flex flex-col gap-2 pt-3 border-t border-border">
                  <Link to="/auth" onClick={() => setMobileMenuOpen(false)}>
                    <Button variant="outline" className="w-full">Login</Button>
                  </Link>
                  <Link to="/auth?mode=signup" onClick={() => setMobileMenuOpen(false)}>
                    <Button className="w-full bg-accent hover:bg-accent/90 text-accent-foreground">Start Free Trial</Button>
                  </Link>
                </div>
              </nav>
            </motion.div>
          )}
        </AnimatePresence>
      </header>

      {/* 1. HERO SECTION */}
      <section className="pt-24 sm:pt-28 pb-12 sm:pb-16 px-4 sm:px-6 bg-gradient-to-b from-primary/5 to-background">
        <div className="container mx-auto max-w-6xl">
          <div className="text-center space-y-6 sm:space-y-8">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
            >
              <Badge className="mb-4 bg-primary/10 text-primary border-primary/20 text-xs sm:text-sm px-4 py-1.5">
                <Target className="h-3.5 w-3.5 mr-2" />
                Recruitment Performance Platform
              </Badge>
            </motion.div>
            
            <motion.h1
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.1 }}
              className="text-3xl sm:text-5xl lg:text-6xl font-bold tracking-tight leading-tight text-foreground"
            >
              Track Recruiter Work.
              <br />
              <span className="text-primary">Measure Performance.</span>
              <br />
              Hire With Control.
            </motion.h1>
            
            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.2 }}
              className="text-base sm:text-xl text-muted-foreground max-w-3xl mx-auto px-4"
            >
              An all-in-one recruitment performance platform designed for agencies and remote recruiting teams 
              to manage jobs, candidates, AI matching, and recruiter productivity from one dashboard.
            </motion.p>
            
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.3 }}
              className="flex flex-col sm:flex-row gap-3 sm:gap-4 justify-center px-4"
            >
              <Link to="/auth?mode=signup" className="w-full sm:w-auto">
                <Button size="lg" className="w-full sm:w-auto bg-accent hover:bg-accent/90 text-accent-foreground gap-2 h-12 px-8 text-base font-semibold">
                  Start Free – No Credit Card Required
                  <ArrowRight className="h-5 w-5" />
                </Button>
              </Link>
              <Button 
                size="lg" 
                variant="outline" 
                className="w-full sm:w-auto gap-2 h-12 px-8 text-base border-2"
                onClick={() => demoVideoUrl ? setWatchDemoOpen(true) : setBookDemoOpen(true)}
              >
                <Play className="h-5 w-5" />
                Book a Live Demo
              </Button>
            </motion.div>
            
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.5, delay: 0.4 }}
              className="text-sm text-muted-foreground pt-4"
            >
              Trusted by independent recruiters and growing recruitment agencies worldwide.
            </motion.p>
          </div>
          
          {/* Dashboard Preview */}
          <motion.div
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.5 }}
            className="mt-12 sm:mt-16 relative"
          >
            <div className="absolute inset-0 bg-gradient-to-t from-background via-transparent to-transparent z-10 pointer-events-none" />
            <div className="rounded-xl border-2 border-primary/20 shadow-2xl overflow-hidden bg-card">
              <div className="h-8 bg-primary flex items-center gap-2 px-4">
                <div className="w-3 h-3 rounded-full bg-white/30" />
                <div className="w-3 h-3 rounded-full bg-white/30" />
                <div className="w-3 h-3 rounded-full bg-white/30" />
                <span className="text-xs text-white/70 ml-4 font-medium">HireMetrics Dashboard</span>
              </div>
              <div className="p-6 bg-gradient-to-br from-card to-slate/5">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                  {[
                    { label: 'Active Jobs', value: '24', icon: Briefcase, color: 'text-primary' },
                    { label: 'Candidates', value: '1,284', icon: Users, color: 'text-slate' },
                    { label: 'AI Matches', value: '856', icon: Brain, color: 'text-accent' },
                    { label: 'Team Active', value: '8/10', icon: Activity, color: 'text-primary' },
                  ].map((stat, i) => (
                    <div key={i} className="p-4 rounded-lg bg-background border border-border">
                      <stat.icon className={`h-5 w-5 ${stat.color} mb-2`} />
                      <div className="text-2xl font-bold text-foreground">{stat.value}</div>
                      <div className="text-sm text-muted-foreground">{stat.label}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* 2. THE PROBLEM YOU SOLVE */}
      <section id="problem" className="py-12 sm:py-16 px-4 sm:px-6 bg-slate/5">
        <div className="container mx-auto max-w-6xl">
          <SectionTitle 
            badge="The Challenge"
            title="Recruitment Is Not the Problem. Visibility Is."
          />
          
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
            {painPoints.map((point, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, x: -20 }}
                whileInView={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.4, delay: i * 0.1 }}
                viewport={{ once: true }}
                className="flex items-center gap-4 p-4 rounded-lg bg-background border border-border"
              >
                <div className="w-10 h-10 rounded-full bg-accent/10 flex items-center justify-center flex-shrink-0">
                  <point.icon className="h-5 w-5 text-accent" />
                </div>
                <p className="text-sm sm:text-base text-foreground">{point.text}</p>
              </motion.div>
            ))}
          </div>
          
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            viewport={{ once: true }}
            className="text-center bg-primary/5 rounded-2xl p-8 border border-primary/20"
          >
            <p className="text-lg sm:text-xl text-foreground font-medium">
              Your recruitment data is scattered.
              <br />
              Your team performance is invisible.
              <br />
              <span className="text-primary font-bold">That's where HireMetrics changes the game.</span>
            </p>
          </motion.div>
        </div>
      </section>

      {/* 3. THE SOLUTION */}
      <section className="py-12 sm:py-16 px-4 sm:px-6">
        <div className="container mx-auto max-w-6xl text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            viewport={{ once: true }}
          >
            <Badge className="mb-4 bg-accent/10 text-accent border-accent/20">The Solution</Badge>
            <h2 className="text-2xl sm:text-4xl font-bold mb-6 text-foreground">
              More Than a CRM. A <span className="text-primary">Recruitment Performance System.</span>
            </h2>
            <p className="text-base sm:text-lg text-muted-foreground max-w-3xl mx-auto">
              Unlike traditional recruitment CRMs that only track candidates, HireMetrics tracks 
              <span className="text-foreground font-semibold"> people, performance, and productivity</span> — 
              giving agency owners full operational control.
            </p>
          </motion.div>
        </div>
      </section>

      {/* 4. CORE FEATURES */}
      <section id="features" className="py-12 sm:py-16 px-4 sm:px-6 bg-slate/5">
        <div className="container mx-auto max-w-6xl">
          <SectionTitle 
            badge="Platform Features"
            title="Everything You Need to Run Your Agency"
          />
          
          {/* Recruitment Management */}
          <div className="mb-10">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <Briefcase className="h-5 w-5 text-primary" />
              </div>
              <h3 className="text-xl sm:text-2xl font-bold text-foreground">Recruitment Management</h3>
            </div>
            <div className="grid sm:grid-cols-3 gap-6">
              {recruitmentFeatures.map((feature, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.4, delay: i * 0.1 }}
                  viewport={{ once: true }}
                >
                  <Card className="h-full hover:shadow-lg transition-all hover:border-primary/30">
                    <CardContent className="p-6">
                      <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center mb-4">
                        <feature.icon className="h-6 w-6 text-primary" />
                      </div>
                      <h4 className="text-lg font-semibold mb-2 text-foreground">{feature.title}</h4>
                      <p className="text-muted-foreground">{feature.description}</p>
                    </CardContent>
                  </Card>
                </motion.div>
              ))}
            </div>
          </div>
          
          {/* AI Matching */}
          <div className="mb-10">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-lg bg-accent/10 flex items-center justify-center">
                <Brain className="h-5 w-5 text-accent" />
              </div>
              <h3 className="text-xl sm:text-2xl font-bold text-foreground">AI Matching & Smart Screening</h3>
            </div>
            <div className="grid sm:grid-cols-3 gap-6">
              {aiFeatures.map((feature, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.4, delay: i * 0.1 }}
                  viewport={{ once: true }}
                >
                  <Card className="h-full hover:shadow-lg transition-all hover:border-accent/30 border-accent/10">
                    <CardContent className="p-6">
                      <div className="w-12 h-12 rounded-lg bg-accent/10 flex items-center justify-center mb-4">
                        <feature.icon className="h-6 w-6 text-accent" />
                      </div>
                      <h4 className="text-lg font-semibold mb-2 text-foreground">{feature.title}</h4>
                      <p className="text-muted-foreground">{feature.description}</p>
                    </CardContent>
                  </Card>
                </motion.div>
              ))}
            </div>
          </div>
          
          {/* Work Tracking - THE DIFFERENTIATOR */}
          <div className="mb-10">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-lg bg-primary flex items-center justify-center">
                <Activity className="h-5 w-5 text-primary-foreground" />
              </div>
              <h3 className="text-xl sm:text-2xl font-bold text-foreground">Team Work Tracking</h3>
              <Badge className="bg-accent text-accent-foreground">Your Differentiator</Badge>
            </div>
            <p className="text-muted-foreground mb-8 max-w-2xl">
              Agency owners finally see who is working, when, and for how long. Every action is logged automatically.
            </p>
            <div className="grid sm:grid-cols-3 gap-6">
              {workTrackingFeatures.map((feature, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.4, delay: i * 0.1 }}
                  viewport={{ once: true }}
                >
                  <Card className="h-full bg-primary/5 border-primary/20 hover:shadow-lg transition-all">
                    <CardContent className="p-6">
                      <div className="w-12 h-12 rounded-lg bg-primary flex items-center justify-center mb-4">
                        <feature.icon className="h-6 w-6 text-primary-foreground" />
                      </div>
                      <h4 className="text-lg font-semibold mb-2 text-foreground">{feature.title}</h4>
                      <p className="text-muted-foreground">{feature.description}</p>
                    </CardContent>
                  </Card>
                </motion.div>
              ))}
            </div>
          </div>
          
          {/* KPI Dashboard */}
          <div className="mb-10">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-lg bg-slate/20 flex items-center justify-center">
                <TrendingUp className="h-5 w-5 text-slate" />
              </div>
              <h3 className="text-xl sm:text-2xl font-bold text-foreground">Team Performance & KPIs</h3>
            </div>
            <div className="grid lg:grid-cols-2 gap-8">
              <Card className="border-slate/20">
                <CardContent className="p-6">
                  <h4 className="text-lg font-semibold mb-4 text-foreground">Recruiter Performance Dashboard</h4>
                  <div className="grid grid-cols-2 gap-3">
                    {kpiMetrics.map((metric, i) => (
                      <div key={i} className="flex items-center gap-2 p-3 rounded-lg bg-slate/5">
                        <CheckCircle className="h-4 w-4 text-primary flex-shrink-0" />
                        <span className="text-sm text-foreground">{metric}</span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
              <Card className="border-slate/20">
                <CardContent className="p-6">
                  <h4 className="text-lg font-semibold mb-4 text-foreground">View Performance By Period</h4>
                  <div className="flex flex-wrap gap-3 mb-6">
                    {viewPeriods.map((period, i) => (
                      <Badge key={i} variant="outline" className="px-4 py-2 text-sm">{period}</Badge>
                    ))}
                  </div>
                  <p className="text-muted-foreground">
                    Compare recruiters objectively — no guesswork. Perfect for performance reviews, salary justification, and client reporting.
                  </p>
                </CardContent>
              </Card>
            </div>
          </div>
          
          {/* Communication */}
          <div>
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-lg bg-slate/20 flex items-center justify-center">
                <MessageSquare className="h-5 w-5 text-slate" />
              </div>
              <h3 className="text-xl sm:text-2xl font-bold text-foreground">Communication & Scheduling</h3>
            </div>
            <div className="grid sm:grid-cols-3 gap-6">
              {communicationFeatures.map((feature, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.4, delay: i * 0.1 }}
                  viewport={{ once: true }}
                >
                  <Card className="h-full hover:shadow-lg transition-all">
                    <CardContent className="p-6">
                      <div className="w-12 h-12 rounded-lg bg-slate/10 flex items-center justify-center mb-4">
                        <feature.icon className="h-6 w-6 text-slate" />
                      </div>
                      <h4 className="text-lg font-semibold mb-2 text-foreground">{feature.title}</h4>
                      <p className="text-muted-foreground">{feature.description}</p>
                    </CardContent>
                  </Card>
                </motion.div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* 5. ROLE-BASED ACCESS */}
      <section id="roles" className="py-12 sm:py-16 px-4 sm:px-6">
        <div className="container mx-auto max-w-6xl">
          <SectionTitle 
            badge="Role-Based Access"
            title="Designed for Every Role in Your Agency"
            subtitle="Clear separation. Full control."
          />
          
          <div className="grid sm:grid-cols-3 gap-6">
            {roles.map((role, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: i * 0.15 }}
                viewport={{ once: true }}
              >
                <Card className="h-full hover:shadow-lg transition-all">
                  <CardContent className="p-6">
                    <div className={`w-14 h-14 rounded-xl bg-gradient-to-br from-primary/10 to-slate/10 flex items-center justify-center mb-4`}>
                      <role.icon className={`h-7 w-7 ${role.color}`} />
                    </div>
                    <h3 className="text-xl font-bold mb-4 text-foreground">{role.title}</h3>
                    <ul className="space-y-3">
                      {role.features.map((feature, j) => (
                        <li key={j} className="flex items-center gap-2 text-muted-foreground">
                          <ChevronRight className="h-4 w-4 text-primary flex-shrink-0" />
                          {feature}
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* 6. PRICING */}
      <section id="pricing" className="py-12 sm:py-16 px-4 sm:px-6 bg-slate/5">
        <div className="container mx-auto max-w-6xl">
          <SectionTitle 
            badge="Pricing"
            title="Simple Pricing. Scales With You."
            subtitle="One successful hire can pay for your entire year."
          />
          
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6 sm:gap-8">
            {plans.map((plan, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: i * 0.1 }}
                viewport={{ once: true }}
              >
                <Card className={`h-full relative ${plan.popular ? 'border-2 border-accent shadow-lg' : ''}`}>
                  {plan.popular && (
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                      <Badge className="bg-accent text-accent-foreground px-4">Most Popular</Badge>
                    </div>
                  )}
                  <CardContent className="p-6">
                    <h3 className="text-xl font-bold mb-1 text-foreground">{plan.name}</h3>
                    <p className="text-muted-foreground text-sm mb-4">{plan.description}</p>
                    <div className="mb-6">
                      <span className="text-4xl font-bold text-foreground">{plan.price}</span>
                      <span className="text-muted-foreground">{plan.period}</span>
                    </div>
                    <ul className="space-y-3 mb-6">
                      {plan.features.map((feature, j) => (
                        <li key={j} className="flex items-center gap-2 text-sm">
                          <CheckCircle className="h-4 w-4 text-primary flex-shrink-0" />
                          <span className="text-foreground">{feature}</span>
                        </li>
                      ))}
                    </ul>
                    <Link to="/auth?mode=signup" className="block">
                      <Button 
                        className={`w-full ${plan.popular ? 'bg-accent hover:bg-accent/90 text-accent-foreground' : ''}`} 
                        variant={plan.popular ? 'default' : 'outline'}
                      >
                        Get Started
                      </Button>
                    </Link>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* 7. WHY CHOOSE US */}
      <section className="py-12 sm:py-16 px-4 sm:px-6">
        <div className="container mx-auto max-w-6xl">
          <SectionTitle 
            badge="Why HireMetrics"
            title="Why Agencies Switch to HireMetrics"
          />
          
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {whyChoose.map((item, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, x: -20 }}
                whileInView={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.4, delay: i * 0.1 }}
                viewport={{ once: true }}
                className="flex items-center gap-4 p-4 rounded-lg bg-primary/5 border border-primary/10"
              >
                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                  <item.icon className="h-5 w-5 text-primary" />
                </div>
                <p className="text-foreground font-medium">{item.text}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* 8. SECURITY */}
      <section className="py-12 sm:py-16 px-4 sm:px-6 bg-slate/5">
        <div className="container mx-auto max-w-4xl text-center">
          <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-6">
            <Lock className="h-8 w-8 text-primary" />
          </div>
          <h2 className="text-2xl sm:text-3xl font-bold mb-4 text-foreground">Secure. Reliable. Professional.</h2>
          <div className="flex flex-wrap justify-center gap-4 mt-8">
            {securityFeatures.map((feature, i) => (
              <Badge key={i} variant="outline" className="px-4 py-2 text-sm bg-background">
                <Shield className="h-3.5 w-3.5 mr-2 text-primary" />
                {feature}
              </Badge>
            ))}
          </div>
        </div>
      </section>

      {/* 9. TESTIMONIALS */}
      <section id="testimonials" className="py-12 sm:py-16 px-4 sm:px-6">
        <div className="container mx-auto max-w-6xl">
          <SectionTitle 
            badge="Testimonials"
            title="Trusted by Recruitment Agencies"
            subtitle="See what our customers have to say"
          />
          <div className="mb-8 text-center">
            <CustomerFeedbackForm />
          </div>
          <TestimonialsCarousel />
        </div>
      </section>

      {/* 10. FINAL CTA */}
      <section className="py-12 sm:py-16 px-4 sm:px-6">
        <div className="container mx-auto max-w-4xl">
          <Card className="bg-primary text-primary-foreground overflow-hidden border-0">
            <CardContent className="p-8 sm:p-12 text-center">
              <h2 className="text-2xl sm:text-4xl font-bold mb-4">
                Stop Managing Recruitment Blindly.
              </h2>
              <p className="text-lg sm:text-xl text-primary-foreground/80 mb-8 max-w-xl mx-auto">
                Start tracking recruiter performance, not just candidates.
              </p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <Link to="/auth?mode=signup" className="w-full sm:w-auto">
                  <Button size="lg" className="w-full sm:w-auto bg-accent hover:bg-accent/90 text-accent-foreground gap-2 h-12 px-8">
                    Start Free Trial
                    <ArrowRight className="h-5 w-5" />
                  </Button>
                </Link>
                <Button 
                  size="lg" 
                  variant="outline" 
                  className="w-full sm:w-auto bg-transparent border-2 border-primary-foreground/30 text-primary-foreground hover:bg-primary-foreground/10 gap-2 h-12 px-8"
                  onClick={() => setBookDemoOpen(true)}
                >
                  <Calendar className="h-5 w-5" />
                  Book a Demo
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* Footer */}
      <Footer />

      {/* Dialogs */}
      <WatchDemoDialog 
        open={watchDemoOpen} 
        onOpenChange={setWatchDemoOpen} 
        videoUrl={demoVideoUrl} 
      />
      <BookDemoDialog 
        open={bookDemoOpen} 
        onOpenChange={setBookDemoOpen} 
      />
    </div>
  );
}
