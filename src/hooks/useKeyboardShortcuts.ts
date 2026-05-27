// Recruiter Workflow Optimization — Phase 1
// Global keyboard shortcut registry. Recruiters can drive the workflow
// without leaving the keyboard. Shortcuts are scoped to the current
// surface via the `enabled` flag and ignored when the user is typing
// in an input, textarea, contenteditable, or select.

import { useEffect, useRef } from "react";

export type ShortcutHandler = (e: KeyboardEvent) => void;

export interface Shortcut {
  /** Single key, e.g. "j", "s", "?". Case-insensitive. */
  key: string;
  /** Optional modifiers — all must be pressed. */
  meta?: boolean;
  ctrl?: boolean;
  shift?: boolean;
  alt?: boolean;
  /** Human-readable description rendered in the cheatsheet. */
  description: string;
  /** Group label for the cheatsheet (e.g. "Navigation", "Actions"). */
  group?: string;
  handler: ShortcutHandler;
}

function isTypingTarget(t: EventTarget | null): boolean {
  if (!(t instanceof HTMLElement)) return false;
  const tag = t.tagName;
  if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return true;
  if (t.isContentEditable) return true;
  return false;
}

export function useKeyboardShortcuts(
  shortcuts: Shortcut[],
  opts: { enabled?: boolean } = {},
) {
  const enabled = opts.enabled !== false;
  const ref = useRef(shortcuts);
  ref.current = shortcuts;

  useEffect(() => {
    if (!enabled) return;
    const onKey = (e: KeyboardEvent) => {
      if (isTypingTarget(e.target)) return;
      const key = e.key.toLowerCase();
      for (const s of ref.current) {
        if (s.key.toLowerCase() !== key) continue;
        if (!!s.meta !== e.metaKey) continue;
        if (!!s.ctrl !== e.ctrlKey) continue;
        if (!!s.shift !== e.shiftKey) continue;
        if (!!s.alt !== e.altKey) continue;
        e.preventDefault();
        s.handler(e);
        return;
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [enabled]);
}
