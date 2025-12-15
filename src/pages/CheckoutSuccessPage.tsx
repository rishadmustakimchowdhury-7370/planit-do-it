import { useState, useEffect } from 'react';
import { useSearchParams, useNavigate, Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { 
  CheckCircle2, 
  Clock, 
  ArrowRight, 
  Mail, 
  Loader2,
  PartyPopper
} from 'lucide-react';
import { motion } from 'framer-motion';

export default function CheckoutSuccessPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  
  const sessionId = searchParams.get('session_id');
  const orderId = searchParams.get('order_id');
  
  const [loading, setLoading] = useState(true);
  const [order, setOrder] = useState<any>(null);
  const [verificationStatus, setVerificationStatus] = useState<'verifying' | 'success' | 'pending'>('verifying');

  useEffect(() => {
    if (sessionId) {
      verifyPayment();
    } else {
      setLoading(false);
      setVerificationStatus('success');
    }
  }, [sessionId]);

  const verifyPayment = async () => {
    try {
      const { data, error } = await supabase.functions.invoke('verify-payment', {
        body: { sessionId, orderId }
      });

      if (error) throw error;

      if (data?.success) {
        setOrder(data.order);
        setVerificationStatus('success');
      } else {
        setVerificationStatus('pending');
      }
    } catch (error) {
      console.error('Verification error:', error);
      setVerificationStatus('pending');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <Loader2 className="h-12 w-12 animate-spin text-primary mx-auto mb-4" />
          <p className="text-muted-foreground">Verifying your payment...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5">
      <div className="container max-w-2xl mx-auto px-4 py-16">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <Card className="text-center">
            <CardHeader className="pb-4">
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ delay: 0.2, type: 'spring', stiffness: 200 }}
                className="mx-auto mb-4"
              >
                <div className="h-20 w-20 rounded-full bg-green-500/10 flex items-center justify-center mx-auto">
                  <CheckCircle2 className="h-10 w-10 text-green-500" />
                </div>
              </motion.div>
              
              <div className="flex justify-center mb-2">
                <PartyPopper className="h-6 w-6 text-yellow-500" />
              </div>
              
              <CardTitle className="text-2xl sm:text-3xl">
                Payment Successful!
              </CardTitle>
              <CardDescription className="text-base">
                Thank you for your purchase. Your order has been received.
              </CardDescription>
            </CardHeader>
            
            <CardContent className="space-y-6">
              {/* Order Status */}
              <div className="p-4 bg-amber-500/10 border border-amber-500/20 rounded-lg">
                <div className="flex items-center justify-center gap-2 text-amber-600 dark:text-amber-400">
                  <Clock className="h-5 w-5" />
                  <span className="font-medium">Pending Admin Approval</span>
                </div>
                <p className="text-sm text-muted-foreground mt-2">
                  Your account will be activated once our admin team reviews and approves your order.
                  This typically takes 1-24 hours.
                </p>
              </div>

              {/* Order Details */}
              {order && (
                <div className="text-left p-4 bg-muted/50 rounded-lg space-y-2">
                  <h4 className="font-medium">Order Details</h4>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <span className="text-muted-foreground">Order ID:</span>
                    <span className="font-mono">{order.id?.substring(0, 8)}...</span>
                    
                    <span className="text-muted-foreground">Plan:</span>
                    <span>{order.subscription_plans?.name || 'N/A'}</span>
                    
                    <span className="text-muted-foreground">Amount:</span>
                    <span>${order.amount} {order.currency?.toUpperCase()}</span>
                    
                    <span className="text-muted-foreground">Billing:</span>
                    <span className="capitalize">{order.billing_cycle}</span>
                    
                    <span className="text-muted-foreground">Status:</span>
                    <Badge variant="secondary" className="w-fit">
                      {order.approval_status === 'pending_approval' ? 'Pending Approval' : order.approval_status}
                    </Badge>
                  </div>
                </div>
              )}

              {/* What's Next */}
              <div className="text-left space-y-3">
                <h4 className="font-medium">What happens next?</h4>
                <div className="space-y-2 text-sm">
                  <div className="flex items-start gap-3">
                    <div className="h-6 w-6 rounded-full bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
                      <span className="text-xs font-medium text-primary">1</span>
                    </div>
                    <p className="text-muted-foreground">
                      Our admin team will review your payment and order details
                    </p>
                  </div>
                  <div className="flex items-start gap-3">
                    <div className="h-6 w-6 rounded-full bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
                      <span className="text-xs font-medium text-primary">2</span>
                    </div>
                    <p className="text-muted-foreground">
                      Once approved, your subscription will be activated
                    </p>
                  </div>
                  <div className="flex items-start gap-3">
                    <div className="h-6 w-6 rounded-full bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
                      <span className="text-xs font-medium text-primary">3</span>
                    </div>
                    <p className="text-muted-foreground">
                      You'll receive a confirmation email with access details
                    </p>
                  </div>
                </div>
              </div>

              {/* Email Notice */}
              <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
                <Mail className="h-4 w-4" />
                <span>A receipt has been sent to your email</span>
              </div>

              {/* Actions */}
              <div className="flex flex-col sm:flex-row gap-3 pt-4">
                <Button 
                  className="flex-1" 
                  onClick={() => navigate('/dashboard')}
                >
                  Go to Dashboard
                  <ArrowRight className="h-4 w-4 ml-2" />
                </Button>
                <Button 
                  variant="outline" 
                  className="flex-1"
                  onClick={() => navigate('/billing')}
                >
                  View Order History
                </Button>
              </div>

              {/* Support */}
              <p className="text-sm text-muted-foreground">
                Questions? Contact us at{' '}
                <Link to="mailto:support@recruitifycrm.com" className="text-primary hover:underline">
                  support@recruitifycrm.com
                </Link>
              </p>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </div>
  );
}
