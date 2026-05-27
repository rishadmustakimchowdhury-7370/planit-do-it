// Recruiter Workflow Optimization — Phase 1
// "?" cheatsheet dialog. Recruiters open it from anywhere to see the
// currently-registered shortcuts. Surfaces are responsible for passing
// their own shortcut list via the `shortcuts` prop or relying on the
// global defaults.

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { useKeyboardShortcuts, type Shortcut } from "@/hooks/useKeyboardShortcuts";

export interface KeyboardShortcutsHelpProps {
  shortcuts: Shortcut[];
}

export function KeyboardShortcutsHelp({ shortcuts }: KeyboardShortcutsHelpProps) {
  const [open, setOpen] = useState(false);

  useKeyboardShortcuts([
    {
      key: "?",
      shift: true,
      description: "Show keyboard shortcuts",
      group: "Help",
      handler: () => setOpen(v => !v),
    },
  ]);

  const groups = shortcuts.reduce<Record<string, Shortcut[]>>((acc, s) => {
    const g = s.group ?? "General";
    (acc[g] ||= []).push(s);
    return acc;
  }, {});

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Keyboard shortcuts</DialogTitle>
          <DialogDescription>
            Move faster through the recruiter workflow.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 pt-2">
          {Object.entries(groups).map(([group, list]) => (
            <div key={group}>
              <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">
                {group}
              </div>
              <ul className="space-y-1.5">
                {list.map((s, i) => (
                  <li key={i} className="flex items-center justify-between text-sm">
                    <span>{s.description}</span>
                    <kbd className="rounded border bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                      {[s.meta && "⌘", s.ctrl && "Ctrl", s.shift && "Shift", s.alt && "Alt", s.key.toUpperCase()]
                        .filter(Boolean)
                        .join(" + ")}
                    </kbd>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
