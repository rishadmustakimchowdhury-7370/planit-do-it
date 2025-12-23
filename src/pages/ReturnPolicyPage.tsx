import { Link } from 'react-router-dom';
import { Logo, BRAND } from '@/components/brand/Logo';
import { Button } from '@/components/ui/button';

export default function ReturnPolicyPage() {
  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border py-4 px-6">
        <div className="container mx-auto max-w-6xl flex items-center justify-between">
          <Link to="/">
            <Logo size="md" />
          </Link>
          <div className="flex items-center gap-4">
            <Link to="/auth">
              <Button variant="ghost">Sign In</Button>
            </Link>
            <Link to="/auth">
              <Button>Get Started</Button>
            </Link>
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="py-16 px-6">
        <div className="container mx-auto max-w-4xl">
          <h1 className="text-4xl font-bold mb-4">Return & Refund Policy</h1>
          <p className="text-muted-foreground mb-8">Last updated: December 2024</p>

          <div className="prose prose-lg max-w-none">
            <section className="mb-8">
              <h2 className="text-2xl font-bold mb-4">1. Overview</h2>
              <p className="text-muted-foreground mb-4">
                At {BRAND.name}, operated by Tasaru Ventures Ltd (Business License: 16399822), we want you to be completely satisfied with our service. This policy outlines our refund procedures and guidelines for subscription cancellations.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-bold mb-4">2. Free Trial</h2>
              <p className="text-muted-foreground mb-4">
                We offer a free trial period for new users to evaluate our service. During the trial:
              </p>
              <ul className="list-disc pl-6 text-muted-foreground mb-4 space-y-2">
                <li>No payment information is required</li>
                <li>Full access to all features within your plan tier</li>
                <li>No obligation to continue after the trial ends</li>
                <li>Cancel anytime without any charges</li>
              </ul>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-bold mb-4">3. Subscription Cancellation</h2>
              <p className="text-muted-foreground mb-4">
                You may cancel your subscription at any time through your account settings or by contacting our support team.
              </p>
              <p className="text-muted-foreground mb-4">
                <strong>When you cancel:</strong>
              </p>
              <ul className="list-disc pl-6 text-muted-foreground mb-4 space-y-2">
                <li>Your subscription remains active until the end of the current billing period</li>
                <li>You retain full access to all features until expiration</li>
                <li>No further charges will be made after the current period</li>
                <li>Your data will be retained for 30 days after expiration for potential reactivation</li>
              </ul>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-bold mb-4">4. Refund Policy</h2>
              <h3 className="text-xl font-semibold mb-3">4.1 7-Day Money-Back Guarantee</h3>
              <p className="text-muted-foreground mb-4">
                <strong>We offer a 7-day money-back guarantee on all new paid subscriptions.</strong> If you're not satisfied within the first 7 days of your paid subscription, contact us for a full refund. No questions asked.
              </p>

              <h3 className="text-xl font-semibold mb-3">4.2 Refund Eligibility</h3>
              <p className="text-muted-foreground mb-4">Refunds are automatically granted for:</p>
              <ul className="list-disc pl-6 text-muted-foreground mb-4 space-y-2">
                <li><strong>Requests within 7 days of initial subscription</strong></li>
                <li>Duplicate charges or billing errors</li>
                <li>Service outages exceeding 48 hours</li>
                <li>Significant feature changes that affect your use case</li>
              </ul>

              <h3 className="text-xl font-semibold mb-3">4.3 Non-Refundable Cases</h3>
              <p className="text-muted-foreground mb-4">Refunds are generally not provided for:</p>
              <ul className="list-disc pl-6 text-muted-foreground mb-4 space-y-2">
                <li>Requests made after 7 days of subscription</li>
                <li>Unused portions of subscription periods after 7 days</li>
                <li>Account termination due to Terms of Service violations</li>
                <li>Changes in business needs or circumstances</li>
              </ul>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-bold mb-4">5. How to Request a Refund</h2>
              <p className="text-muted-foreground mb-4">
                To request a refund within your 7-day guarantee period, please contact our support team:
              </p>
              <ul className="list-disc pl-6 text-muted-foreground mb-4 space-y-2">
                <li>Email us at {BRAND.email}</li>
                <li>Call or WhatsApp us at +447426468550</li>
                <li>Use the live chat on our website</li>
              </ul>
              <p className="text-muted-foreground mb-4">
                Please include your account email and reason for the refund. We aim to process all refund requests within 3-5 business days.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-bold mb-4">6. Refund Processing</h2>
              <p className="text-muted-foreground mb-4">
                Once a refund is approved:
              </p>
              <ul className="list-disc pl-6 text-muted-foreground mb-4 space-y-2">
                <li>Refunds are processed to the original payment method</li>
                <li>Credit card refunds may take 5-10 business days to appear</li>
                <li>You will receive email confirmation when the refund is processed</li>
                <li>Your account will be downgraded to the free tier or deactivated</li>
              </ul>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-bold mb-4">7. Plan Downgrades</h2>
              <p className="text-muted-foreground mb-4">
                If you downgrade your plan:
              </p>
              <ul className="list-disc pl-6 text-muted-foreground mb-4 space-y-2">
                <li>The change takes effect at the start of the next billing period</li>
                <li>No partial refunds for the current period</li>
                <li>Features beyond your new plan tier will become inaccessible</li>
                <li>Your data will be preserved according to the new plan limits</li>
              </ul>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-bold mb-4">8. Exceptional Circumstances</h2>
              <p className="text-muted-foreground mb-4">
                We understand that exceptional circumstances may arise. If you believe you have a valid case for a refund outside of the 7-day window, please contact us. We review each case individually and aim to find fair solutions.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-bold mb-4">9. Contact Us</h2>
              <p className="text-muted-foreground mb-4">
                For questions about our refund policy or to request a refund:
              </p>
              <ul className="list-none text-muted-foreground space-y-2">
                <li><strong>Email:</strong> {BRAND.email}</li>
                <li><strong>Phone:</strong> +447426468550 (WhatsApp Available)</li>
                <li><strong>Live Support:</strong> Available 24/7</li>
                <li><strong>Address:</strong></li>
                <li className="pl-4">Suite A</li>
                <li className="pl-4">82 James Carter Road</li>
                <li className="pl-4">Mildenhall</li>
                <li className="pl-4">Bury St. Edmunds</li>
                <li className="pl-4">United Kingdom</li>
                <li className="pl-4">IP28 7DE</li>
                <li className="mt-2"><strong>Company:</strong> Tasaru Ventures Ltd</li>
                <li><strong>Business License:</strong> 16399822</li>
              </ul>
            </section>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-border py-8 px-6">
        <div className="container mx-auto max-w-6xl text-center">
          <p className="text-sm text-muted-foreground">
            © {new Date().getFullYear()} {BRAND.name}. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  );
}
