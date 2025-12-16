import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { supabase } from '@/integrations/supabase/client';
import { Logo, BRAND } from '@/components/brand/Logo';
import { useToast } from '@/hooks/use-toast';
import { 
  Sparkles, 
  ArrowRight, 
  Users, 
  Briefcase, 
  Brain, 
  BarChart3, 
  Shield, 
  Zap,
  CheckCircle,
  Star,
  Play,
  MessageCircle,
  Phone,
  Mail,
  Clock,
  Send,
  Loader2,
  Menu,
  X
} from 'lucide-react';

const features = [
  {
    icon: Brain,
    title: 'AI-Powered Matching',
    description: 'Our AI analyzes CVs and job descriptions to find the perfect candidates with 95% accuracy.',
  },
  {
    icon: Users,
    title: 'Kanban Pipelines',
    description: 'Visualize your hiring process with drag-and-drop candidate pipelines for every job.',
  },
  {
    icon: BarChart3,
    title: 'Smart Analytics',
    description: 'Track time-to-hire, source effectiveness, and team performance with real-time dashboards.',
  },
  {
    icon: Zap,
    title: 'Automated Workflows',
    description: 'Set up triggers to automatically move candidates, send emails, and schedule interviews.',
  },
  {
    icon: Shield,
    title: 'Enterprise Security',
    description: 'SOC 2 compliant with role-based access control and data encryption at rest.',
  },
  {
    icon: MessageCircle,
    title: '24/7 Support',
    description: 'Get help when you need it with our AI chatbot and dedicated success team.',
  },
];

const plans = [
  {
    name: 'Starter',
    price: '$9',
    period: '/month',
    description: 'Perfect for small teams getting started',
    features: ['5 Active Jobs', '50 Candidates', '50 AI Matches/month', 'Email Support', 'Basic Analytics'],
    popular: false,
  },
  {
    name: 'Pro',
    price: '$29',
    period: '/month',
    description: 'For growing recruitment teams',
    features: ['25 Active Jobs', '500 Candidates', '200 AI Matches/month', 'Priority Support', 'Advanced Analytics', 'API Access', 'Custom Branding'],
    popular: true,
  },
  {
    name: 'Agency',
    price: '$79',
    period: '/month',
    description: 'For agencies and large teams',
    features: ['Unlimited Jobs', 'Unlimited Candidates', '1000 AI Matches/month', '24/7 Support', 'Full Analytics', 'API Access', 'White Label', 'Dedicated Account Manager'],
    popular: false,
  },
];

interface Testimonial {
  id: string;
  quote: string;
  author_name: string;
  author_role: string;
  author_avatar: string | null;
  rating: number | null;
}

const defaultTestimonials = [
  {
    id: '1',
    quote: "Recruitify CRM cut our time-to-hire by 60%. The AI matching is incredibly accurate.",
    author_name: "Sarah Johnson",
    author_role: "Head of Talent, TechCorp",
    author_avatar: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=100&h=100&fit=crop&crop=face",
    rating: 5,
  },
  {
    id: '2',
    quote: "Finally, a recruitment tool that actually understands what we're looking for.",
    author_name: "Michael Chen",
    author_role: "CEO, Fintech Innovations",
    author_avatar: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100&h=100&fit=crop&crop=face",
    rating: 5,
  },
  {
    id: '3',
    quote: "The pipeline visualization changed how our team collaborates on hiring.",
    author_name: "Emily Davis",
    author_role: "HR Director, HealthTech Pro",
    author_avatar: "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=100&h=100&fit=crop&crop=face",
    rating: 5,
  },
];

const steps = [
  { step: '01', title: 'Add Your Jobs', description: 'Create job postings with our AI-assisted description builder.' },
  { step: '02', title: 'Import Candidates', description: 'Upload CVs, import from LinkedIn, or let candidates apply.' },
  { step: '03', title: 'AI Matching', description: 'Our AI analyzes and ranks candidates by fit for each role.' },
];

// Footer Component with Contact Form
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
    <footer className="border-t border-border py-10 sm:py-16 px-4 sm:px-6 bg-muted/30">
      <div className="container mx-auto max-w-6xl">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8 sm:gap-12 mb-8 sm:mb-12">
          {/* Brand & Contact Info */}
          <div className="sm:col-span-2 lg:col-span-1">
            <Link to="/" className="flex items-center gap-2 mb-4">
              <Logo size="md" />
            </Link>
            <p className="text-sm text-muted-foreground mb-4">AI-powered recruitment platform for modern teams.</p>
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

          {/* Quick Links */}
          <div>
            <h4 className="font-semibold mb-3 sm:mb-4 text-sm sm:text-base">Quick Links</h4>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li><Link to="/about" className="hover:text-foreground transition-colors">About Us</Link></li>
              <li><Link to="/features" className="hover:text-foreground transition-colors">Features</Link></li>
              <li><a href="#pricing" className="hover:text-foreground transition-colors">Pricing</a></li>
              <li><Link to="/contact" className="hover:text-foreground transition-colors">Contact Us</Link></li>
            </ul>
          </div>

          {/* Legal */}
          <div>
            <h4 className="font-semibold mb-3 sm:mb-4 text-sm sm:text-base">Legal</h4>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li><Link to="/privacy" className="hover:text-foreground transition-colors">Privacy Policy</Link></li>
              <li><Link to="/terms" className="hover:text-foreground transition-colors">Terms & Conditions</Link></li>
              <li><Link to="/return-policy" className="hover:text-foreground transition-colors">Return Policy</Link></li>
            </ul>
          </div>

          {/* Contact Form */}
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

        {/* Bottom Bar */}
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

export default function LandingPage() {
  const [testimonials, setTestimonials] = useState<Testimonial[]>(defaultTestimonials);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    const fetchTestimonials = async () => {
      const { data, error } = await supabase
        .from('testimonials')
        .select('*')
        .eq('is_active', true)
        .order('order_index', { ascending: true });

      if (!error && data && data.length > 0) {
        setTestimonials(data);
      }
    };

    fetchTestimonials();
  }, []);

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="fixed top-0 left-0 right-0 z-50 bg-background/80 backdrop-blur-lg border-b border-border">
        <div className="container mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2">
            <Logo size="md" />
          </Link>
          
          <nav className="hidden lg:flex items-center gap-8">
            <a href="#features" className="text-sm text-muted-foreground hover:text-foreground transition-colors">Features</a>
            <a href="#how-it-works" className="text-sm text-muted-foreground hover:text-foreground transition-colors">How it Works</a>
            <a href="#pricing" className="text-sm text-muted-foreground hover:text-foreground transition-colors">Pricing</a>
            <a href="#testimonials" className="text-sm text-muted-foreground hover:text-foreground transition-colors">Testimonials</a>
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
          
          {/* Mobile menu button */}
          <button 
            className="lg:hidden p-2 hover:bg-muted rounded-lg transition-colors"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          >
            {mobileMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
          </button>
        </div>
        
        {/* Mobile Menu */}
        <AnimatePresence>
          {mobileMenuOpen && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="lg:hidden border-t border-border bg-background"
            >
              <nav className="container mx-auto px-4 py-4 flex flex-col gap-3">
                <a href="#features" onClick={() => setMobileMenuOpen(false)} className="py-2 text-muted-foreground hover:text-foreground transition-colors">Features</a>
                <a href="#how-it-works" onClick={() => setMobileMenuOpen(false)} className="py-2 text-muted-foreground hover:text-foreground transition-colors">How it Works</a>
                <a href="#pricing" onClick={() => setMobileMenuOpen(false)} className="py-2 text-muted-foreground hover:text-foreground transition-colors">Pricing</a>
                <a href="#testimonials" onClick={() => setMobileMenuOpen(false)} className="py-2 text-muted-foreground hover:text-foreground transition-colors">Testimonials</a>
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

      {/* Hero Section */}
      <section className="pt-24 sm:pt-32 pb-12 sm:pb-20 px-4 sm:px-6">
        <div className="container mx-auto max-w-6xl">
          <div className="text-center space-y-6 sm:space-y-8">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
            >
              <Badge variant="secondary" className="mb-4 text-xs sm:text-sm">
                <Sparkles className="h-3 w-3 mr-1" />
                AI-Powered Recruitment Platform
              </Badge>
            </motion.div>
            
            <motion.h1
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.1 }}
              className="text-3xl sm:text-5xl lg:text-7xl font-bold tracking-tight leading-tight"
            >
              Hire the <span className="text-accent">Best Talent</span>
              <br className="hidden sm:block" />
              <span className="sm:hidden"> </span>Faster Than Ever
            </motion.h1>
            
            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.2 }}
              className="text-base sm:text-xl text-muted-foreground max-w-2xl mx-auto px-4"
            >
              Recruitify CRM uses AI to match candidates to jobs, automate your pipeline, 
              and give you insights that help you make better hiring decisions.
            </motion.p>
            
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.3 }}
              className="flex flex-col sm:flex-row gap-3 sm:gap-4 justify-center px-4"
            >
              <Link to="/auth?mode=signup" className="w-full sm:w-auto">
                <Button size="lg" className="w-full sm:w-auto bg-accent hover:bg-accent/90 text-accent-foreground gap-2">
                  Start Free Trial
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
              <Button size="lg" variant="outline" className="w-full sm:w-auto gap-2">
                <Play className="h-4 w-4" />
                Watch Demo
              </Button>
            </motion.div>
            
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.5, delay: 0.4 }}
              className="flex flex-col sm:flex-row items-center justify-center gap-3 sm:gap-8 pt-6 sm:pt-8 text-xs sm:text-sm text-muted-foreground"
            >
              <div className="flex items-center gap-2">
                <CheckCircle className="h-4 w-4 text-success" />
                No credit card required
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle className="h-4 w-4 text-success" />
                14-day free trial
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle className="h-4 w-4 text-success" />
                Cancel anytime
              </div>
            </motion.div>
          </div>
          
          {/* Hero Image/Dashboard Preview */}
          <motion.div
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.5 }}
            className="mt-10 sm:mt-16 relative"
          >
            <div className="absolute inset-0 bg-gradient-to-t from-background via-transparent to-transparent z-10 pointer-events-none" />
            <div className="rounded-lg sm:rounded-xl border border-border shadow-2xl overflow-hidden bg-card">
              <div className="h-6 sm:h-8 bg-muted flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4">
                <div className="w-2 h-2 sm:w-3 sm:h-3 rounded-full bg-destructive/50" />
                <div className="w-2 h-2 sm:w-3 sm:h-3 rounded-full bg-warning/50" />
                <div className="w-2 h-2 sm:w-3 sm:h-3 rounded-full bg-success/50" />
              </div>
              <div className="p-3 sm:p-6 bg-gradient-to-br from-card to-muted/30">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-4">
                  {[
                    { label: 'Open Jobs', value: '12', icon: Briefcase },
                    { label: 'Candidates', value: '284', icon: Users },
                    { label: 'Interviews', value: '8', icon: BarChart3 },
                    { label: 'AI Matches', value: '156', icon: Brain },
                  ].map((stat, i) => (
                    <div key={i} className="p-3 sm:p-4 rounded-lg bg-background/50 border border-border">
                      <stat.icon className="h-4 w-4 sm:h-5 sm:w-5 text-accent mb-1 sm:mb-2" />
                      <div className="text-lg sm:text-2xl font-bold">{stat.value}</div>
                      <div className="text-xs sm:text-sm text-muted-foreground">{stat.label}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="py-12 sm:py-20 px-4 sm:px-6 bg-muted/30">
        <div className="container mx-auto max-w-6xl">
          <div className="text-center mb-10 sm:mb-16">
            <Badge variant="outline" className="mb-4">Features</Badge>
            <h2 className="text-2xl sm:text-4xl font-bold mb-4">Everything you need to hire smarter</h2>
            <p className="text-base sm:text-xl text-muted-foreground max-w-2xl mx-auto px-4">
              From AI matching to analytics, Recruitify CRM gives you the tools to build your dream team.
            </p>
          </div>
          
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
            {features.map((feature, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: i * 0.1 }}
                viewport={{ once: true }}
              >
                <Card className="h-full hover:shadow-lg transition-shadow">
                  <CardContent className="p-4 sm:p-6">
                    <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-lg bg-accent/10 flex items-center justify-center mb-3 sm:mb-4">
                      <feature.icon className="h-5 w-5 sm:h-6 sm:w-6 text-accent" />
                    </div>
                    <h3 className="text-base sm:text-lg font-semibold mb-2">{feature.title}</h3>
                    <p className="text-sm sm:text-base text-muted-foreground">{feature.description}</p>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* How it Works */}
      <section id="how-it-works" className="py-12 sm:py-20 px-4 sm:px-6">
        <div className="container mx-auto max-w-6xl">
          <div className="text-center mb-10 sm:mb-16">
            <Badge variant="outline" className="mb-4">How it Works</Badge>
            <h2 className="text-2xl sm:text-4xl font-bold mb-4">Get started in 3 simple steps</h2>
          </div>
          
          <div className="grid sm:grid-cols-3 gap-8 sm:gap-8">
            {steps.map((item, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: i * 0.15 }}
                viewport={{ once: true }}
                className="text-center"
              >
                <div className="text-4xl sm:text-6xl font-bold text-accent/20 mb-3 sm:mb-4">{item.step}</div>
                <h3 className="text-lg sm:text-xl font-semibold mb-2">{item.title}</h3>
                <p className="text-sm sm:text-base text-muted-foreground">{item.description}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section id="pricing" className="py-12 sm:py-20 px-4 sm:px-6 bg-muted/30">
        <div className="container mx-auto max-w-6xl">
          <div className="text-center mb-10 sm:mb-16">
            <Badge variant="outline" className="mb-4">Pricing</Badge>
            <h2 className="text-2xl sm:text-4xl font-bold mb-4">Simple, transparent pricing</h2>
            <p className="text-base sm:text-xl text-muted-foreground">Start free, scale as you grow</p>
          </div>
          
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-8">
            {plans.map((plan, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: i * 0.1 }}
                viewport={{ once: true }}
              >
                <Card className={`h-full relative ${plan.popular ? 'border-accent shadow-glow' : ''}`}>
                  {plan.popular && (
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                      <Badge className="bg-accent text-accent-foreground text-xs">Most Popular</Badge>
                    </div>
                  )}
                  <CardContent className="p-4 sm:p-6">
                    <h3 className="text-lg sm:text-xl font-semibold mb-2">{plan.name}</h3>
                    <p className="text-muted-foreground text-xs sm:text-sm mb-4">{plan.description}</p>
                    <div className="mb-4 sm:mb-6">
                      <span className="text-3xl sm:text-4xl font-bold">{plan.price}</span>
                      <span className="text-muted-foreground text-sm">{plan.period}</span>
                    </div>
                    <ul className="space-y-2 sm:space-y-3 mb-4 sm:mb-6">
                      {plan.features.map((feature, j) => (
                        <li key={j} className="flex items-center gap-2 text-xs sm:text-sm">
                          <CheckCircle className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-success flex-shrink-0" />
                          {feature}
                        </li>
                      ))}
                    </ul>
                    <Link to="/auth?mode=signup">
                      <Button size="sm" className={`w-full ${plan.popular ? 'bg-accent hover:bg-accent/90' : ''}`} variant={plan.popular ? 'default' : 'outline'}>
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

      {/* Testimonials */}
      <section id="testimonials" className="py-12 sm:py-20 px-4 sm:px-6">
        <div className="container mx-auto max-w-6xl">
          <div className="text-center mb-10 sm:mb-16">
            <Badge variant="outline" className="mb-4">Testimonials</Badge>
            <h2 className="text-2xl sm:text-4xl font-bold mb-4">Loved by recruiters worldwide</h2>
          </div>
          
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-8">
            {testimonials.map((testimonial, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: i * 0.1 }}
                viewport={{ once: true }}
              >
                <Card className="h-full">
                  <CardContent className="p-4 sm:p-6">
                    <div className="flex gap-1 mb-3 sm:mb-4">
                      {[...Array(testimonial.rating || 5)].map((_, j) => (
                        <Star key={j} className="h-3.5 w-3.5 sm:h-4 sm:w-4 fill-warning text-warning" />
                      ))}
                    </div>
                    <p className="text-sm sm:text-base text-foreground mb-4 sm:mb-6">"{testimonial.quote}"</p>
                    <div className="flex items-center gap-3">
                      <img 
                        src={testimonial.author_avatar || 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=100&h=100&fit=crop&crop=face'} 
                        alt={testimonial.author_name}
                        className="w-9 h-9 sm:w-10 sm:h-10 rounded-full object-cover"
                      />
                      <div>
                        <div className="font-medium text-sm sm:text-base">{testimonial.author_name}</div>
                        <div className="text-xs sm:text-sm text-muted-foreground">{testimonial.author_role}</div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-12 sm:py-20 px-4 sm:px-6">
        <div className="container mx-auto max-w-4xl">
          <Card className="gradient-hero text-primary-foreground overflow-hidden">
            <CardContent className="p-6 sm:p-12 text-center">
              <h2 className="text-2xl sm:text-4xl font-bold mb-4">Ready to transform your hiring?</h2>
              <p className="text-base sm:text-xl text-primary-foreground/80 mb-6 sm:mb-8 max-w-xl mx-auto">
                Join thousands of teams using Recruitify CRM to find and hire the best talent.
              </p>
              <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 justify-center">
                <Link to="/auth?mode=signup" className="w-full sm:w-auto">
                  <Button size="lg" variant="secondary" className="w-full sm:w-auto gap-2">
                    Start Free Trial
                    <ArrowRight className="h-4 w-4" />
                  </Button>
                </Link>
                <Button size="lg" variant="outline" className="w-full sm:w-auto bg-transparent border-primary-foreground/30 text-primary-foreground hover:bg-primary-foreground/10">
                  Request Demo
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* Footer */}
      {/* Footer */}
      <Footer />
    </div>
  );
}