import { Link } from 'react-router-dom';
import { useCookieConsent } from '@/lib/cookie-consent';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Cookie, Shield, BarChart3, Megaphone, Settings } from 'lucide-react';

export default function CookiePolicyPage() {
  const { resetConsent } = useCookieConsent();

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card/50 backdrop-blur-sm sticky top-0 z-40">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
          <Link to="/" className="text-lg font-bold text-foreground">HireMetrics</Link>
          <Link to="/">
            <Button variant="ghost" size="sm">← Back to Home</Button>
          </Link>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-12 space-y-8">
        <div className="space-y-2">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10">
              <Cookie className="h-6 w-6 text-primary" />
            </div>
            <h1 className="text-3xl font-bold text-foreground">Cookie Policy</h1>
          </div>
          <p className="text-muted-foreground">Last updated: February 2026</p>
        </div>

        <section className="space-y-4">
          <h2 className="text-xl font-semibold text-foreground">What Are Cookies?</h2>
          <p className="text-muted-foreground leading-relaxed">
            Cookies are small text files stored on your device when you visit a website. They help the site 
            remember your preferences, understand how you use the site, and improve your experience. Cookies 
            can be "session" cookies (deleted when you close your browser) or "persistent" cookies (remain 
            until they expire or you delete them).
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="text-xl font-semibold text-foreground">Types of Cookies We Use</h2>
          <div className="grid gap-4">
            <Card>
              <CardContent className="p-5 flex gap-4">
                <div className="p-2 h-fit rounded-lg bg-primary/10">
                  <Shield className="h-5 w-5 text-primary" />
                </div>
                <div className="space-y-2">
                  <h3 className="font-semibold text-foreground">Essential Cookies</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    These cookies are necessary for the website to function properly. They enable core 
                    functionality such as security, authentication, and session management. You cannot 
                    disable these cookies as the site would not work without them.
                  </p>
                  <p className="text-xs text-muted-foreground"><strong>Examples:</strong> Authentication tokens, session IDs, CSRF protection.</p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-5 flex gap-4">
                <div className="p-2 h-fit rounded-lg bg-primary/10">
                  <BarChart3 className="h-5 w-5 text-primary" />
                </div>
                <div className="space-y-2">
                  <h3 className="font-semibold text-foreground">Analytics Cookies</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    These cookies help us understand how visitors interact with our website by collecting 
                    and reporting information anonymously. This helps us improve the user experience and 
                    optimize our services.
                  </p>
                  <p className="text-xs text-muted-foreground"><strong>Examples:</strong> Google Analytics, page view tracking, feature usage metrics.</p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-5 flex gap-4">
                <div className="p-2 h-fit rounded-lg bg-primary/10">
                  <Megaphone className="h-5 w-5 text-primary" />
                </div>
                <div className="space-y-2">
                  <h3 className="font-semibold text-foreground">Marketing Cookies</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    These cookies are used to deliver advertisements more relevant to you and your interests. 
                    They are also used to limit the number of times you see an advertisement and help measure 
                    the effectiveness of advertising campaigns.
                  </p>
                  <p className="text-xs text-muted-foreground"><strong>Examples:</strong> Facebook Pixel, retargeting cookies, conversion tracking.</p>
                </div>
              </CardContent>
            </Card>
          </div>
        </section>

        <section className="space-y-4">
          <h2 className="text-xl font-semibold text-foreground">How to Withdraw Consent</h2>
          <p className="text-muted-foreground leading-relaxed">
            You can change your cookie preferences at any time by clicking the button below. This will 
            clear your current preferences and allow you to re-select which cookies you'd like to allow.
          </p>
          <Button onClick={resetConsent} variant="outline" className="gap-2">
            <Settings className="h-4 w-4" />
            Manage Cookie Preferences
          </Button>
          <p className="text-sm text-muted-foreground leading-relaxed">
            You can also delete cookies through your browser settings. Note that disabling cookies may 
            affect the functionality of the website.
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="text-xl font-semibold text-foreground">Contact Us</h2>
          <p className="text-muted-foreground leading-relaxed">
            If you have any questions about our use of cookies, please contact us at{' '}
            <a href="mailto:support@hiremetrics.com" className="text-primary hover:underline">
              support@hiremetrics.com
            </a>
          </p>
        </section>

        <div className="border-t border-border pt-6 flex gap-4 text-sm text-muted-foreground">
          <Link to="/privacy" className="hover:text-foreground transition-colors">Privacy Policy</Link>
          <Link to="/terms" className="hover:text-foreground transition-colors">Terms of Service</Link>
          <Link to="/return-policy" className="hover:text-foreground transition-colors">Return Policy</Link>
        </div>
      </main>
    </div>
  );
}
