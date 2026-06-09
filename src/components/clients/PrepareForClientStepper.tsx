import { Check, Circle } from "lucide-react";
import { cn } from "@/lib/utils";

export type StepKey =
  | "context" | "notes" | "report" | "preview-report"
  | "pack" | "preview-pack" | "send" | "history";

interface Step {
  key: StepKey;
  label: string;
  done: boolean;
}

interface Props {
  steps: Step[];
  active: StepKey;
  onJump: (key: StepKey) => void;
}

export function PrepareForClientStepper({ steps, active, onJump }: Props) {
  return (
    <div className="flex items-center gap-1 overflow-x-auto pb-1 border-b">
      {steps.map((s, i) => {
        const isActive = s.key === active;
        return (
          <button
            key={s.key}
            onClick={() => onJump(s.key)}
            className={cn(
              "flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-[11px] whitespace-nowrap transition-colors",
              isActive ? "bg-primary text-primary-foreground"
                : s.done ? "bg-muted text-foreground hover:bg-muted/70"
                : "text-muted-foreground hover:bg-muted/50",
            )}
          >
            <span className={cn(
              "h-4 w-4 rounded-full flex items-center justify-center text-[9px] font-bold",
              s.done ? "bg-emerald-500 text-white"
                : isActive ? "bg-primary-foreground/20"
                : "bg-muted-foreground/20",
            )}>
              {s.done ? <Check className="h-2.5 w-2.5" /> : i + 1}
            </span>
            {s.label}
          </button>
        );
      })}
    </div>
  );
}
