import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';

export interface CookiePreferences {
  essential: boolean;
  analytics: boolean;
  marketing: boolean;
}

interface CookieConsentContextType {
  consent: CookiePreferences | null;
  hasConsented: boolean;
  showBanner: boolean;
  showPreferences: boolean;
  acceptAll: () => void;
  rejectNonEssential: () => void;
  savePreferences: (prefs: CookiePreferences) => void;
  openPreferences: () => void;
  closePreferences: () => void;
  resetConsent: () => void;
}

const STORAGE_KEY = 'cookie_consent';

const CookieConsentContext = createContext<CookieConsentContextType | null>(null);

export function CookieConsentProvider({ children }: { children: ReactNode }) {
  const [consent, setConsent] = useState<CookiePreferences | null>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      return stored ? JSON.parse(stored) : null;
    } catch {
      return null;
    }
  });
  const [showBanner, setShowBanner] = useState(!consent);
  const [showPreferences, setShowPreferences] = useState(false);

  const persist = useCallback((prefs: CookiePreferences) => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
    setConsent(prefs);
    setShowBanner(false);
    setShowPreferences(false);
  }, []);

  const acceptAll = useCallback(() => {
    persist({ essential: true, analytics: true, marketing: true });
  }, [persist]);

  const rejectNonEssential = useCallback(() => {
    persist({ essential: true, analytics: false, marketing: false });
  }, [persist]);

  const savePreferences = useCallback((prefs: CookiePreferences) => {
    persist({ ...prefs, essential: true });
  }, [persist]);

  const openPreferences = useCallback(() => setShowPreferences(true), []);
  const closePreferences = useCallback(() => setShowPreferences(false), []);

  const resetConsent = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY);
    setConsent(null);
    setShowBanner(true);
    setShowPreferences(true);
  }, []);

  return (
    <CookieConsentContext.Provider
      value={{
        consent,
        hasConsented: !!consent,
        showBanner,
        showPreferences,
        acceptAll,
        rejectNonEssential,
        savePreferences,
        openPreferences,
        closePreferences,
        resetConsent,
      }}
    >
      {children}
    </CookieConsentContext.Provider>
  );
}

export function useCookieConsent() {
  const ctx = useContext(CookieConsentContext);
  if (!ctx) throw new Error('useCookieConsent must be used within CookieConsentProvider');
  return ctx;
}
