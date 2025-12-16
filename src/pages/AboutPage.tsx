import { Link } from 'react-router-dom';
import { Logo, BRAND } from '@/components/brand/Logo';
import { Button } from '@/components/ui/button';
import { Users, Target, Award, Globe, ArrowRight } from 'lucide-react';

export default function AboutPage() {
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

      {/* Hero Section */}
      <section className="py-12 sm:py-20 px-4 sm:px-6 bg-gradient-to-b from-primary/5 to-background">
        <div className="container mx-auto max-w-4xl text-center">
          <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold mb-4 sm:mb-6">
            About {BRAND.name}
          </h1>
          <p className="text-base sm:text-xl text-muted-foreground max-w-2xl mx-auto px-2">
            We're on a mission to transform how recruitment agencies find, engage, and hire top talent using the power of artificial intelligence.
          </p>
        </div>
      </section>

      {/* Our Story */}
      <section className="py-10 sm:py-16 px-4 sm:px-6">
        <div className="container mx-auto max-w-4xl">
          <h2 className="text-2xl sm:text-3xl font-bold mb-6 sm:mb-8 text-center">Our Story</h2>
          <div className="prose prose-sm sm:prose-lg max-w-none text-muted-foreground">
            <p className="mb-4 sm:mb-6 text-sm sm:text-base">
              {BRAND.name} was founded with a simple yet powerful vision: to revolutionize the recruitment industry by combining cutting-edge AI technology with intuitive design. We understand the challenges that recruitment agencies face daily – from managing thousands of candidates to matching the right talent with the right opportunities.
            </p>
            <p className="mb-4 sm:mb-6 text-sm sm:text-base">
              Our team of experienced recruiters and technologists came together to build a platform that addresses these challenges head-on. We've leveraged years of industry expertise to create a CRM that doesn't just store data – it actively helps you make better hiring decisions.
            </p>
            <p className="text-sm sm:text-base">
              Today, {BRAND.name} serves recruitment agencies worldwide, helping them streamline their workflows, improve candidate matching accuracy, and ultimately place more candidates faster than ever before.
            </p>
          </div>
        </div>
      </section>

      {/* Values */}
      <section className="py-10 sm:py-16 px-4 sm:px-6 bg-muted/30">
        <div className="container mx-auto max-w-6xl">
          <h2 className="text-2xl sm:text-3xl font-bold mb-8 sm:mb-12 text-center">Our Values</h2>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-8">
            <div className="text-center">
              <div className="w-12 h-12 sm:w-16 sm:h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-3 sm:mb-4">
                <Users className="h-6 w-6 sm:h-8 sm:w-8 text-primary" />
              </div>
              <h3 className="font-semibold mb-1 sm:mb-2 text-sm sm:text-base">People First</h3>
              <p className="text-xs sm:text-sm text-muted-foreground">
                We believe in putting people at the center of everything we do.
              </p>
            </div>
            <div className="text-center">
              <div className="w-12 h-12 sm:w-16 sm:h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-3 sm:mb-4">
                <Target className="h-6 w-6 sm:h-8 sm:w-8 text-primary" />
              </div>
              <h3 className="font-semibold mb-1 sm:mb-2 text-sm sm:text-base">Innovation</h3>
              <p className="text-xs sm:text-sm text-muted-foreground">
                We continuously push the boundaries of what's possible with AI.
              </p>
            </div>
            <div className="text-center">
              <div className="w-12 h-12 sm:w-16 sm:h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-3 sm:mb-4">
                <Award className="h-6 w-6 sm:h-8 sm:w-8 text-primary" />
              </div>
              <h3 className="font-semibold mb-1 sm:mb-2 text-sm sm:text-base">Excellence</h3>
              <p className="text-xs sm:text-sm text-muted-foreground">
                We strive for excellence in every feature and interaction.
              </p>
            </div>
            <div className="text-center">
              <div className="w-12 h-12 sm:w-16 sm:h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-3 sm:mb-4">
                <Globe className="h-6 w-6 sm:h-8 sm:w-8 text-primary" />
              </div>
              <h3 className="font-semibold mb-1 sm:mb-2 text-sm sm:text-base">Global Impact</h3>
              <p className="text-xs sm:text-sm text-muted-foreground">
                We're building for a global audience, connecting talent worldwide.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Company Info */}
      <section className="py-10 sm:py-16 px-4 sm:px-6">
        <div className="container mx-auto max-w-4xl">
          <h2 className="text-2xl sm:text-3xl font-bold mb-6 sm:mb-8 text-center">Company Information</h2>
          <div className="bg-card border border-border rounded-xl p-6 sm:p-8 text-center">
            <p className="text-base sm:text-lg mb-3 sm:mb-4">
              <strong>{BRAND.name}</strong> is a sister concern company of <strong>Tasaru Ventures Ltd</strong>
            </p>
            <p className="text-sm sm:text-base text-muted-foreground mb-3 sm:mb-4">
              Business License Number: <strong>16399822</strong>
            </p>
            <p className="text-sm sm:text-base text-muted-foreground">
              Registered in England and Wales
            </p>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-10 sm:py-16 px-4 sm:px-6 bg-primary text-primary-foreground">
        <div className="container mx-auto max-w-4xl text-center">
          <h2 className="text-2xl sm:text-3xl font-bold mb-4">Ready to Transform Your Recruitment?</h2>
          <p className="text-sm sm:text-lg opacity-90 mb-6 sm:mb-8">
            Join thousands of agencies already using {BRAND.name} to hire smarter.
          </p>
          <Link to="/auth">
            <Button size="lg" variant="secondary" className="gap-2">
              Start Free Trial <ArrowRight className="h-4 w-4" />
            </Button>
          </Link>
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
