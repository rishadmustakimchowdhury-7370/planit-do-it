// Phase 7 — "Show Recruiter Intelligence" toggle.
// Default OFF so recruiters see the executive summary first; expansion is opt-in.
// State persists per-browser so the recruiter doesn't re-toggle constantly,
// but it never auto-enables for a new user.

import { useCallback, useEffect, useState } from "react";

const KEY = "hm.recruiterIntel.v1";

function read(): boolean {
  try {
    if (typeof window === "undefined") return false;
    return window.localStorage.getItem(KEY) === "1";
  } catch { return false; }
}

export function useRecruiterIntelligenceToggle() {
  const [on, setOn] = useState<boolean>(read);

  useEffect(() => {
    const handler = (e: StorageEvent) => {
      if (e.key === KEY) setOn(e.newValue === "1");
    };
    window.addEventListener("storage", handler);
    return () => window.removeEventListener("storage", handler);
  }, []);

  const toggle = useCallback((v?: boolean) => {
    setOn(prev => {
      const next = typeof v === "boolean" ? v : !prev;
      try { window.localStorage.setItem(KEY, next ? "1" : "0"); } catch {}
      return next;
    });
  }, []);

  return { on, toggle } as const;
}
