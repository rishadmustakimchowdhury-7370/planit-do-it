import { useState } from 'react';
import { useCookieConsent, CookiePreferences } from '@/lib/cookie-consent';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Cookie, Shield, BarChart3, Megaphone } from 'lucide-react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';

export function CookieConsentBanner() {
  const {
    showBanner,
    showPreferences,
    acceptAll,
    rejectNonEssential,
    savePreferences,
    openPreferences,
    closePreferences,
  } = useCookieConsent();

  const [prefs, setPrefs] = useState<CookiePreferences>({
    essential: true,
    analytics: false,
    marketing: false,
  });

  const handleSavePrefs = () => {
    savePreferences(prefs);
  };

  return (
    <>
      {/* Bottom banner */}
      <AnimatePresence>
        {showBanner && !showPreferences && (
          <motion.div
            initial={{ y: 100, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 100, opacity: 0 }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            className="fixed bottom-0 left-0 right-0 z-[60] border-t border-border bg-card/95 backdrop-blur-lg shadow-2xl"
          >
            <div className="mx-auto max-w-6xl px-4 py-4 sm:px-6 sm:py-5">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-start gap-3 flex-1">
                  <div className="p-2 rounded-lg bg-primary/10 shrink-0 mt-0.5">
                    <Cookie className="h-5 w-5 text-primary" />
                  </div>
                  <div className="space-y-1">
                    <h3 className="font-semibold text-sm text-foreground">We use cookies</h3>
                    <p className="text-xs text-muted-foreground leading-relaxed max-w-xl">
                      We use cookies to improve your experience, analyze traffic, and personalize content. 
                      You can manage your preferences at any time.{' '}
                      <Link to="/cookie-policy" className="text-primary hover:underline">
                        Learn more
                      </Link>
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0 flex-wrap sm:flex-nowrap">
                  <Button variant="ghost" size="sm" onClick={openPreferences} className="text-xs">
                    Manage Preferences
                  </Button>
                  <Button variant="outline" size="sm" onClick={rejectNonEssential} className="text-xs">
                    Reject Non-Essential
                  </Button>
                  <Button size="sm" onClick={acceptAll} className="text-xs">
                    Accept All
                  </Button>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Preferences modal */}
      <Dialog open={showPreferences} onOpenChange={(open) => { if (!open) closePreferences(); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Cookie className="h-5 w-5 text-primary" />
              Cookie Preferences
            </DialogTitle>
            <DialogDescription>
              Choose which cookies you'd like to allow. Essential cookies are always active as they're required for the site to function.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {/* Essential */}
            <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50 border border-border">
              <div className="flex items-center gap-3">
                <Shield className="h-4 w-4 text-primary" />
                <div>
                  <Label className="font-medium text-sm">Essential</Label>
                  <p className="text-xs text-muted-foreground">Required for the site to function</p>
                </div>
              </div>
              <Switch checked disabled aria-label="Essential cookies always enabled" />
            </div>

            {/* Analytics */}
            <div className="flex items-center justify-between p-3 rounded-lg border border-border">
              <div className="flex items-center gap-3">
                <BarChart3 className="h-4 w-4 text-primary" />
                <div>
                  <Label className="font-medium text-sm">Analytics</Label>
                  <p className="text-xs text-muted-foreground">Help us understand how you use the site</p>
                </div>
              </div>
              <Switch
                checked={prefs.analytics}
                onCheckedChange={(v) => setPrefs(p => ({ ...p, analytics: v }))}
                aria-label="Toggle analytics cookies"
              />
            </div>

            {/* Marketing */}
            <div className="flex items-center justify-between p-3 rounded-lg border border-border">
              <div className="flex items-center gap-3">
                <Megaphone className="h-4 w-4 text-primary" />
                <div>
                  <Label className="font-medium text-sm">Marketing</Label>
                  <p className="text-xs text-muted-foreground">Used for targeted advertising</p>
                </div>
              </div>
              <Switch
                checked={prefs.marketing}
                onCheckedChange={(v) => setPrefs(p => ({ ...p, marketing: v }))}
                aria-label="Toggle marketing cookies"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={closePreferences}>Cancel</Button>
            <Button onClick={handleSavePrefs}>Save Preferences</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
