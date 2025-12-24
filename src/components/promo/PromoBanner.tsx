import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { X, Tag, Sparkles, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { motion, AnimatePresence } from 'framer-motion';

interface ActivePromo {
  id: string;
  code: string;
  banner_text: string | null;
  discount_type: string;
  discount_value: number;
}

interface PromoBannerProps {
  variant?: 'landing' | 'dashboard';
}

export function PromoBanner({ variant = 'landing' }: PromoBannerProps) {
  const [promo, setPromo] = useState<ActivePromo | null>(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    fetchActiveBannerPromo();
  }, []);

  const fetchActiveBannerPromo = async () => {
    try {
      const { data, error } = await supabase
        .from('promo_codes')
        .select('id, code, banner_text, discount_type, discount_value')
        .eq('is_active', true)
        .eq('show_as_banner', true)
        .or('valid_until.is.null,valid_until.gt.now()')
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (!error && data) {
        // Check if already dismissed in this session
        const dismissedPromos = sessionStorage.getItem('dismissed_promos');
        if (dismissedPromos && JSON.parse(dismissedPromos).includes(data.id)) {
          return;
        }
        setPromo(data);
      }
    } catch (error) {
      // No active banner promo - that's okay
    }
  };

  const handleDismiss = () => {
    if (promo) {
      const dismissedPromos = sessionStorage.getItem('dismissed_promos');
      const existing = dismissedPromos ? JSON.parse(dismissedPromos) : [];
      sessionStorage.setItem('dismissed_promos', JSON.stringify([...existing, promo.id]));
    }
    setDismissed(true);
  };

  const getDiscountText = () => {
    if (!promo) return '';
    if (promo.discount_type === 'percentage') {
      return `${promo.discount_value}% OFF`;
    }
    return `£${promo.discount_value} OFF`;
  };

  const copyCode = () => {
    if (promo) {
      navigator.clipboard.writeText(promo.code);
    }
  };

  if (!promo || dismissed) return null;

  if (variant === 'dashboard') {
    return (
      <AnimatePresence>
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -20 }}
          className="mb-6 relative overflow-hidden rounded-xl bg-gradient-to-r from-primary/10 via-primary/5 to-accent/10 border border-primary/20 p-4"
        >
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="h-12 w-12 rounded-full bg-primary/20 flex items-center justify-center shrink-0">
                <Sparkles className="h-6 w-6 text-primary" />
              </div>
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-lg font-bold text-primary">{getDiscountText()}</span>
                  <span className="text-sm text-muted-foreground">
                    {promo.banner_text || 'Special offer on subscription plans!'}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <code className="bg-primary/20 px-3 py-1 rounded text-sm font-mono font-semibold text-primary">
                    {promo.code}
                  </code>
                  <Button variant="ghost" size="sm" onClick={copyCode} className="h-7 text-xs">
                    Copy Code
                  </Button>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Link to="/billing">
                <Button size="sm" className="gap-1">
                  Upgrade Now <ArrowRight className="h-3 w-3" />
                </Button>
              </Link>
              <Button variant="ghost" size="icon" onClick={handleDismiss} className="h-8 w-8">
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>
          {/* Decorative elements */}
          <div className="absolute -right-8 -top-8 h-32 w-32 rounded-full bg-primary/5" />
          <div className="absolute -right-4 -bottom-4 h-20 w-20 rounded-full bg-accent/5" />
        </motion.div>
      </AnimatePresence>
    );
  }

  // Landing page variant - full width banner at top
  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, height: 0 }}
        animate={{ opacity: 1, height: 'auto' }}
        exit={{ opacity: 0, height: 0 }}
        className="relative bg-gradient-to-r from-primary via-primary/90 to-primary text-primary-foreground"
      >
        <div className="container mx-auto px-4 py-3">
          <div className="flex items-center justify-center gap-4 text-center flex-wrap">
            <div className="flex items-center gap-2">
              <Tag className="h-5 w-5" />
              <span className="font-bold text-lg">{getDiscountText()}</span>
            </div>
            <span className="text-sm opacity-90">
              {promo.banner_text || 'Use code at checkout for discount on all plans!'}
            </span>
            <div className="flex items-center gap-2">
              <code className="bg-background/20 backdrop-blur px-3 py-1 rounded text-sm font-mono font-bold">
                {promo.code}
              </code>
              <Button 
                variant="secondary" 
                size="sm" 
                onClick={copyCode}
                className="h-7 text-xs bg-background/20 hover:bg-background/30 text-primary-foreground border-0"
              >
                Copy
              </Button>
            </div>
            <Link to="/auth">
              <Button 
                variant="secondary" 
                size="sm"
                className="bg-background text-foreground hover:bg-background/90"
              >
                Get Started <ArrowRight className="h-3 w-3 ml-1" />
              </Button>
            </Link>
          </div>
        </div>
        <Button 
          variant="ghost" 
          size="icon" 
          onClick={handleDismiss}
          className="absolute right-2 top-1/2 -translate-y-1/2 h-8 w-8 text-primary-foreground/80 hover:text-primary-foreground hover:bg-primary-foreground/10"
        >
          <X className="h-4 w-4" />
        </Button>
      </motion.div>
    </AnimatePresence>
  );
}
