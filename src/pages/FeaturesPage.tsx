import { Link } from 'react-router-dom';
import { Logo, BRAND } from '@/components/brand/Logo';
import { Button } from '@/components/ui/button';
import { 
  Brain, Users, Briefcase, Mail, Calendar, FileText, 
  BarChart3, Zap, Shield, Globe, MessageSquare, ArrowRight,
  CheckCircle2, Sparkles
} from 'lucide-react';

const features = [
  {
    icon: Brain,
    title: "AI-Powered Matching",
    description: "Our advanced AI analyzes CVs and job descriptions to provide accurate match scores, helping you identify the best candidates instantly.",
    highlights: ["Smart skill matching", "Experience analysis", "Cultural fit scoring"]
  },
  {
    icon: Users,
    title: "Candidate Management",
    description: "Organize and track unlimited candidates with powerful search, filtering, and bulk actions. Never lose track of promising talent.",
    highlights: ["Unlimited candidates", "Advanced search", "Bulk operations"]
  },
  {
    icon: Briefcase,
    title: "Job Pipeline",
    description: "Visual Kanban boards to track candidates through your hiring pipeline. Drag-and-drop simplicity for efficient workflow management.",
    highlights: ["Kanban boards", "Custom stages", "Pipeline analytics"]
  },
  {
    icon: Mail,
    title: "Email Integration",
    description: "Send personalized emails directly from the platform using your own email identity. Templates, scheduling, and tracking included.",
    highlights: ["Email templates", "Schedule sends", "Open tracking"]
  },
  {
    icon: Calendar,
    title: "Interview Scheduling",
    description: "Schedule interviews with automatic calendar invites, timezone support, and meeting link integration for Google Meet, Zoom, and Teams.",
    highlights: ["Calendar sync", "Timezone support", "Auto reminders"]
  },
  {
    icon: FileText,
    title: "CV Parsing",
    description: "Automatically extract candidate information from resumes. Support for PDF, DOCX, and LinkedIn profile imports.",
    highlights: ["Auto extraction", "LinkedIn import", "Bulk upload"]
  },
  {
    icon: BarChart3,
    title: "Analytics & Reports",
    description: "Gain insights into your recruitment performance with detailed analytics and customizable reports.",
    highlights: ["Performance metrics", "Custom reports", "Export data"]
  },
  {
    icon: MessageSquare,
    title: "WhatsApp Integration",
    description: "Reach candidates instantly via WhatsApp. Send interview invites, updates, and maintain communication on their preferred channel.",
    highlights: ["Direct messaging", "Templates", "Message logging"]
  }
];

export default function FeaturesPage() {
  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border py-4 px-4 sm:px-6">
        <div className="container mx-auto max-w-6xl flex items-center justify-between">
          <Link to="/">
            <Logo size="md" />
          </Link>
          <div className="flex items-center gap-2 sm:gap-4">
            <Link to="/auth">
              <Button variant="ghost" size="sm">Sign In</Button>
            </Link>
            <Link to="/auth" className="hidden sm:block">
              <Button size="sm">Get Started</Button>
            </Link>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="py-12 sm:py-20 px-4 sm:px-6 bg-gradient-to-b from-primary/5 to-background">
        <div className="container mx-auto max-w-4xl text-center">
          <div className="inline-flex items-center gap-2 bg-primary/10 text-primary px-3 sm:px-4 py-1.5 sm:py-2 rounded-full text-xs sm:text-sm font-medium mb-4 sm:mb-6">
            <Sparkles className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
            Powerful Features for Modern Recruiters
          </div>
          <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold mb-4 sm:mb-6">
            Everything You Need to Recruit Smarter
          </h1>
          <p className="text-base sm:text-xl text-muted-foreground max-w-2xl mx-auto px-2">
            {BRAND.name} combines AI technology with intuitive design to give you the most powerful recruitment platform available.
          </p>
        </div>
      </section>

      {/* Key Benefits */}
      <section className="py-8 sm:py-12 px-4 sm:px-6 border-b border-border">
        <div className="container mx-auto max-w-6xl">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-6">
            <div className="flex items-center gap-2 sm:gap-3 p-3 sm:p-4 bg-card rounded-lg border border-border">
              <Zap className="h-6 w-6 sm:h-8 sm:w-8 text-primary flex-shrink-0" />
              <div>
                <p className="font-semibold text-sm sm:text-base">10x Faster</p>
                <p className="text-xs sm:text-sm text-muted-foreground">Screening</p>
              </div>
            </div>
            <div className="flex items-center gap-2 sm:gap-3 p-3 sm:p-4 bg-card rounded-lg border border-border">
              <Shield className="h-6 w-6 sm:h-8 sm:w-8 text-primary flex-shrink-0" />
              <div>
                <p className="font-semibold text-sm sm:text-base">Secure</p>
                <p className="text-xs sm:text-sm text-muted-foreground">SOC 2 compliant</p>
              </div>
            </div>
            <div className="flex items-center gap-2 sm:gap-3 p-3 sm:p-4 bg-card rounded-lg border border-border">
              <Globe className="h-6 w-6 sm:h-8 sm:w-8 text-primary flex-shrink-0" />
              <div>
                <p className="font-semibold text-sm sm:text-base">24/7 Support</p>
                <p className="text-xs sm:text-sm text-muted-foreground">Global</p>
              </div>
            </div>
            <div className="flex items-center gap-2 sm:gap-3 p-3 sm:p-4 bg-card rounded-lg border border-border">
              <Brain className="h-6 w-6 sm:h-8 sm:w-8 text-primary flex-shrink-0" />
              <div>
                <p className="font-semibold text-sm sm:text-base">AI-Powered</p>
                <p className="text-xs sm:text-sm text-muted-foreground">Smart</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Grid */}
      <section className="py-12 sm:py-20 px-4 sm:px-6">
        <div className="container mx-auto max-w-6xl">
          <div className="grid sm:grid-cols-2 gap-4 sm:gap-8">
            {features.map((feature, index) => (
              <div 
                key={index} 
                className="p-5 sm:p-8 bg-card border border-border rounded-xl hover:shadow-lg transition-shadow"
              >
                <div className="w-11 h-11 sm:w-14 sm:h-14 bg-primary/10 rounded-xl flex items-center justify-center mb-4 sm:mb-6">
                  <feature.icon className="h-5 w-5 sm:h-7 sm:w-7 text-primary" />
                </div>
                <h3 className="text-lg sm:text-xl font-bold mb-2 sm:mb-3">{feature.title}</h3>
                <p className="text-sm sm:text-base text-muted-foreground mb-3 sm:mb-4">{feature.description}</p>
                <ul className="space-y-1.5 sm:space-y-2">
                  {feature.highlights.map((highlight, idx) => (
                    <li key={idx} className="flex items-center gap-2 text-xs sm:text-sm">
                      <CheckCircle2 className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-primary flex-shrink-0" />
                      {highlight}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-12 sm:py-20 px-4 sm:px-6 bg-primary text-primary-foreground">
        <div className="container mx-auto max-w-4xl text-center">
          <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold mb-4">
            Ready to Experience These Features?
          </h2>
          <p className="text-sm sm:text-lg opacity-90 mb-6 sm:mb-8 max-w-2xl mx-auto px-2">
            Start your free trial today and see how {BRAND.name} can transform your recruitment process.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 justify-center">
            <Link to="/auth" className="w-full sm:w-auto">
              <Button size="lg" variant="secondary" className="w-full sm:w-auto gap-2">
                Start Free Trial <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
            <Link to="/contact" className="w-full sm:w-auto">
              <Button size="lg" variant="outline" className="w-full sm:w-auto border-primary-foreground/30 text-primary-foreground hover:bg-primary-foreground/10">
                Contact Sales
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border py-6 sm:py-8 px-4 sm:px-6">
        <div className="container mx-auto max-w-6xl text-center">
          <p className="text-xs sm:text-sm text-muted-foreground">
            © {new Date().getFullYear()} {BRAND.name}. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  );
}
