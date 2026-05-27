// Recruiter Workflow Optimization — Phase 6 (AI Fatigue Prevention)
// "Calm mode" hides AI confidence numbers and noisy badges across the app
// while keeping every recruiter action available. Stored per-browser so the
// recruiter doesn't need to re-toggle on every visit.

import { useCallback, useEffect, useState } from "react";

const KEY = "hm.calmMode.v1";

function read(): boolean {
  try {
    if (typeof window === "undefined") return false;
    return window.localStorage.getItem(KEY) === "1";
  } catch {
    return false;
  }
}

export function useCalmMode() {
  const [calm, setCalm] = useState<boolean>(read);

  useEffect(() => {
    const handler = (e: StorageEvent) => {
      if (e.key === KEY) setCalm(e.newValue === "1");
    };
    window.addEventListener("storage", handler);
    return () => window.removeEventListener("storage", handler);
  }, []);

  const toggle = useCallback((v?: boolean) => {
    setCalm(prev => {
      const next = typeof v === "boolean" ? v : !prev;
      try {
        window.localStorage.setItem(KEY, next ? "1" : "0");
      } catch {}
      return next;
    });
  }, []);

  return { calm, toggle } as const;
}
