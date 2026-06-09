// Recruiter Workflow Optimization — Phase 1 (Speed Layer)
// One-click row-level actions for any candidate/shortlist/submission row.
// Designed to feel weightless: small icon buttons, no modals, inline notes.
// Consumers wire the callbacks they need; missing callbacks hide the button.

import { memo } from "react";
import {
  CheckCircle2,
  ListPlus,
  Send,
  XCircle,
  StickyNote,
  BellPlus,
  MessageSquare,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

export interface QuickActionsBarProps {
  onValidate?: () => void;
  onShortlist?: () => void;
  onSubmit?: () => void;
  onReject?: () => void;
  onNote?: () => void;
  onFollowUp?: () => void;
  onMessage?: () => void;
  /** Pending state disables the relevant button to prevent double-click. */
  pending?: {
    validate?: boolean;
    shortlist?: boolean;
    submit?: boolean;
    reject?: boolean;
  };
  size?: "sm" | "xs";
  className?: string;
}

interface ActionDef {
  key: string;
  label: string;
  shortcut?: string;
  icon: typeof CheckCircle2;
  onClick?: () => void;
  pending?: boolean;
  tone?: "default" | "destructive";
}

export const QuickActionsBar = memo(function QuickActionsBar({
  onValidate,
  onShortlist,
  onSubmit,
  onReject,
  onNote,
  onFollowUp,
  onMessage,
  pending,
  size = "sm",
  className,
}: QuickActionsBarProps) {
  const actions: ActionDef[] = [
    { key: "v", label: "Validate fit", shortcut: "V", icon: CheckCircle2, onClick: onValidate, pending: pending?.validate },
    { key: "s", label: "Shortlist", shortcut: "S", icon: ListPlus, onClick: onShortlist, pending: pending?.shortlist },
    { key: "u", label: "Prepare for client", shortcut: "U", icon: Send, onClick: onSubmit, pending: pending?.submit },
    { key: "m", label: "Message", shortcut: "M", icon: MessageSquare, onClick: onMessage },
    { key: "n", label: "Quick note", shortcut: "N", icon: StickyNote, onClick: onNote },
    { key: "f", label: "Follow-up reminder", shortcut: "F", icon: BellPlus, onClick: onFollowUp },
    { key: "r", label: "Reject", shortcut: "R", icon: XCircle, onClick: onReject, pending: pending?.reject, tone: "destructive" },
  ];

  const visible = actions.filter(a => typeof a.onClick === "function");
  if (visible.length === 0) return null;

  const btnSize = size === "xs" ? "h-7 w-7" : "h-8 w-8";
  const iconSize = size === "xs" ? "h-3.5 w-3.5" : "h-4 w-4";

  return (
    <TooltipProvider delayDuration={150}>
      <div
        className={cn(
          "inline-flex items-center gap-0.5 rounded-md border bg-background/60 p-0.5 backdrop-blur-sm",
          className,
        )}
        role="toolbar"
        aria-label="Quick actions"
      >
        {visible.map(a => {
          const Icon = a.icon;
          return (
            <Tooltip key={a.key}>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  disabled={a.pending}
                  onClick={a.onClick}
                  className={cn(
                    btnSize,
                    "rounded",
                    a.tone === "destructive" &&
                      "text-destructive hover:bg-destructive/10 hover:text-destructive",
                  )}
                  aria-label={a.label}
                >
                  <Icon className={cn(iconSize, a.pending && "animate-pulse opacity-60")} />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="top" className="text-xs">
                {a.label}
                {a.shortcut && (
                  <kbd className="ml-2 rounded border bg-muted px-1 text-[10px] text-muted-foreground">
                    {a.shortcut}
                  </kbd>
                )}
              </TooltipContent>
            </Tooltip>
          );
        })}
      </div>
    </TooltipProvider>
  );
});
