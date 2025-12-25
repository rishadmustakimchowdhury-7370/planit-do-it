import { useEffect, useMemo, useState } from "react";
import { X, Tag } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";

interface ActivePromo {
  id: string;
  code: string;
  banner_text: string | null;
  discount_type: string;
  discount_value: number;
  valid_until: string | null;
}

export function PublicPromoBanner() {
  const { toast } = useToast();
  const [promo, setPromo] = useState<ActivePromo | null>(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    const dismissedPromosRaw = sessionStorage.getItem("dismissed_promos");
    const dismissedPromos: string[] = dismissedPromosRaw ? JSON.parse(dismissedPromosRaw) : [];

    const fetchPromo = async () => {
      const { data, error } = await supabase.functions.invoke("public-promo-banner");
      if (error) {
        console.error("public-promo-banner error", error);
        return;
      }

      const active = (data as any)?.promo as ActivePromo | null | undefined;
      if (!active) return;

      if (dismissedPromos.includes(active.id)) return;
      if (active.valid_until && new Date(active.valid_until) < new Date()) return;

      setPromo(active);
    };

    fetchPromo();
  }, []);

  const discountText = useMemo(() => {
    if (!promo) return "";
    if (promo.discount_type === "percentage") return `${promo.discount_value}% OFF`;
    return `£${promo.discount_value} OFF`;
  }, [promo]);

  const message = useMemo(() => {
    if (!promo) return "";
    const text = promo.banner_text?.trim() || "Limited time offer";
    return `${discountText} • ${text} • Use code ${promo.code}`;
  }, [promo, discountText]);

  const onCopy = async () => {
    if (!promo) return;
    try {
      await navigator.clipboard.writeText(promo.code);
      toast({ title: "Copied", description: `Promo code ${promo.code} copied.` });
    } catch {
      toast({ title: "Copy failed", description: "Please copy the code manually.", variant: "destructive" });
    }
  };

  const onDismiss = () => {
    if (promo) {
      const dismissedPromosRaw = sessionStorage.getItem("dismissed_promos");
      const existing: string[] = dismissedPromosRaw ? JSON.parse(dismissedPromosRaw) : [];
      sessionStorage.setItem("dismissed_promos", JSON.stringify([...existing, promo.id]));
    }
    setDismissed(true);
  };

  if (!promo || dismissed) return null;

  return (
    <div className="relative w-full overflow-hidden bg-primary text-primary-foreground border-b border-primary/20">
      <div className="flex items-center gap-3 px-4 py-2">
        <Tag className="h-4 w-4 shrink-0" aria-hidden="true" />

        <button
          type="button"
          onClick={onCopy}
          className="flex-1 overflow-hidden"
          aria-label={`Copy promo code ${promo.code}`}
        >
          <div className="relative overflow-hidden">
            <div className="flex w-max whitespace-nowrap animate-marquee">
              <span className="text-sm font-semibold px-4">{message}</span>
              <span className="text-sm font-semibold px-4">{message}</span>
              <span className="text-sm font-semibold px-4">{message}</span>
              <span className="text-sm font-semibold px-4">{message}</span>
            </div>
          </div>
        </button>

        <Button
          variant="ghost"
          size="icon"
          onClick={onDismiss}
          className="h-8 w-8 text-primary-foreground/80 hover:text-primary-foreground hover:bg-primary-foreground/10"
          aria-label="Dismiss promo banner"
        >
          <X className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
