// Recruiter Workflow Optimization — Phase 6
// Small toggle recruiters can flip to hide AI confidence numbers and
// noisy badges across the app. Lives next to the existing "Show Recruiter
// Intelligence" toggle so both AI-restraint controls sit together.

import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { useCalmMode } from "@/hooks/useCalmMode";

export function CalmModeToggle() {
  const { calm, toggle } = useCalmMode();
  return (
    <div className="inline-flex items-center gap-2">
      <Switch
        id="calm-mode"
        checked={calm}
        onCheckedChange={v => toggle(!!v)}
        aria-label="Calm mode"
      />
      <Label htmlFor="calm-mode" className="text-xs text-muted-foreground cursor-pointer">
        Calm mode
      </Label>
    </div>
  );
}
