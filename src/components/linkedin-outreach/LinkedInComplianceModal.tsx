import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Shield, AlertTriangle, CheckCircle2 } from "lucide-react";

interface LinkedInComplianceModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userId?: string;
  tenantId?: string;
}

export function LinkedInComplianceModal({
  open,
  onOpenChange,
  userId,
  tenantId,
}: LinkedInComplianceModalProps) {
  const [acknowledged, setAcknowledged] = useState({
    ownAccount: false,
    userControlled: false,
    noCredentials: false,
    safeLimits: false,
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const allAcknowledged = Object.values(acknowledged).every(Boolean);

  const handleAccept = async () => {
    if (!userId || !tenantId) return;

    setIsSubmitting(true);
    try {
      const { error } = await supabase.from("linkedin_outreach_consent").insert({
        user_id: userId,
        tenant_id: tenantId,
        ip_address: null, // Would be captured server-side in production
        user_agent: navigator.userAgent,
      });

      if (error) throw error;

      toast.success("Compliance acknowledged", {
        description: "You can now use LinkedIn Outreach features.",
      });
      onOpenChange(false);
    } catch (error: any) {
      toast.error("Failed to save acknowledgement", {
        description: error.message,
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={() => {}}>
      <DialogContent className="sm:max-w-lg" onPointerDownOutside={(e) => e.preventDefault()}>
        <DialogHeader>
          <div className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-primary" />
            <DialogTitle>LinkedIn Outreach Compliance</DialogTitle>
          </div>
          <DialogDescription>
            Before using this feature, please acknowledge the following terms.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg p-4">
            <div className="flex gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
              <div className="text-sm text-amber-800 dark:text-amber-200">
                <p className="font-medium">Important Notice</p>
                <p className="mt-1">
                  This feature assists you with LinkedIn outreach but requires a browser
                  extension to execute actions. All actions happen in YOUR browser with
                  YOUR LinkedIn session.
                </p>
              </div>
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex items-start space-x-3">
              <Checkbox
                id="ownAccount"
                checked={acknowledged.ownAccount}
                onCheckedChange={(checked) =>
                  setAcknowledged((prev) => ({ ...prev, ownAccount: !!checked }))
                }
              />
              <Label htmlFor="ownAccount" className="text-sm leading-relaxed cursor-pointer">
                I will use my <strong>own LinkedIn account</strong> that I am logged into in my browser
              </Label>
            </div>

            <div className="flex items-start space-x-3">
              <Checkbox
                id="userControlled"
                checked={acknowledged.userControlled}
                onCheckedChange={(checked) =>
                  setAcknowledged((prev) => ({ ...prev, userControlled: !!checked }))
                }
              />
              <Label htmlFor="userControlled" className="text-sm leading-relaxed cursor-pointer">
                I understand that actions are <strong>user-controlled</strong> and I can pause or stop anytime
              </Label>
            </div>

            <div className="flex items-start space-x-3">
              <Checkbox
                id="noCredentials"
                checked={acknowledged.noCredentials}
                onCheckedChange={(checked) =>
                  setAcknowledged((prev) => ({ ...prev, noCredentials: !!checked }))
                }
              />
              <Label htmlFor="noCredentials" className="text-sm leading-relaxed cursor-pointer">
                I confirm that this system does <strong>NOT store my LinkedIn credentials</strong>
              </Label>
            </div>

            <div className="flex items-start space-x-3">
              <Checkbox
                id="safeLimits"
                checked={acknowledged.safeLimits}
                onCheckedChange={(checked) =>
                  setAcknowledged((prev) => ({ ...prev, safeLimits: !!checked }))
                }
              />
              <Label htmlFor="safeLimits" className="text-sm leading-relaxed cursor-pointer">
                I accept that <strong>safe usage limits</strong> are enforced automatically and cannot be overridden
              </Label>
            </div>
          </div>

          {allAcknowledged && (
            <div className="flex items-center gap-2 text-sm text-green-600 dark:text-green-400">
              <CheckCircle2 className="h-4 w-4" />
              <span>All terms acknowledged</span>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button
            onClick={handleAccept}
            disabled={!allAcknowledged || isSubmitting}
            className="w-full sm:w-auto"
          >
            {isSubmitting ? "Saving..." : "Accept & Continue"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
