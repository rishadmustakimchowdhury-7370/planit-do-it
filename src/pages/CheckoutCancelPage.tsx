import { useSearchParams, useNavigate, Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { 
  XCircle, 
  ArrowLeft, 
  RefreshCw, 
  MessageCircle 
} from 'lucide-react';
import { motion } from 'framer-motion';

export default function CheckoutCancelPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  
  const orderId = searchParams.get('order_id');

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-destructive/5">
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
                <div className="h-20 w-20 rounded-full bg-destructive/10 flex items-center justify-center mx-auto">
                  <XCircle className="h-10 w-10 text-destructive" />
                </div>
              </motion.div>
              
              <CardTitle className="text-2xl sm:text-3xl">
                Checkout Cancelled
              </CardTitle>
              <CardDescription className="text-base">
                Your payment was not completed. No charges have been made.
              </CardDescription>
            </CardHeader>
            
            <CardContent className="space-y-6">
              {/* Reasons */}
              <div className="text-left p-4 bg-muted/50 rounded-lg">
                <h4 className="font-medium mb-3">Common reasons for cancellation:</h4>
                <ul className="space-y-2 text-sm text-muted-foreground">
                  <li className="flex items-start gap-2">
                    <span>•</span>
                    <span>Changed your mind about the plan</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span>•</span>
                    <span>Payment method issues</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span>•</span>
                    <span>Need more information before purchasing</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span>•</span>
                    <span>Accidentally closed the checkout page</span>
                  </li>
                </ul>
              </div>

              {/* Help Text */}
              <p className="text-sm text-muted-foreground">
                If you encountered any issues during checkout or have questions about our plans, 
                our support team is here to help.
              </p>

              {/* Actions */}
              <div className="flex flex-col sm:flex-row gap-3 pt-4">
                <Button 
                  className="flex-1" 
                  onClick={() => navigate('/pricing')}
                >
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Try Again
                </Button>
                <Button 
                  variant="outline" 
                  className="flex-1"
                  onClick={() => navigate('/dashboard')}
                >
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Back to Dashboard
                </Button>
              </div>

              {/* Support */}
              <div className="pt-4">
                <Link 
                  to="mailto:support@recruitifycrm.com"
                  className="inline-flex items-center gap-2 text-sm text-primary hover:underline"
                >
                  <MessageCircle className="h-4 w-4" />
                  Need help? Contact Support
                </Link>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </div>
  );
}
