import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface PublicPricingPlan {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  price_monthly: number;
  features: string[];
  display_order: number | null;
}

function normalizeFeatures(value: unknown): string[] {
  if (Array.isArray(value)) return value.map(String);
  return [];
}

export function usePublicPricingPlans() {
  const [plans, setPlans] = useState<PublicPricingPlan[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchPlans = async () => {
    setIsLoading(true);
    const { data } = await supabase
      .from("subscription_plans")
      .select("id, name, slug, description, price_monthly, features, display_order")
      .eq("is_active", true)
      .order("display_order", { ascending: true })
      .order("created_at", { ascending: true })
      .limit(50);

    const normalized = (data ?? []).map((p) => ({
      id: String(p.id),
      name: String(p.name),
      slug: String(p.slug),
      description: p.description,
      price_monthly: Number(p.price_monthly ?? 0),
      features: normalizeFeatures(p.features),
      display_order: (p.display_order ?? null) as number | null,
    }));

    setPlans(normalized);
    setIsLoading(false);
  };

  useEffect(() => {
    fetchPlans();

    const channel = supabase
      .channel("public-pricing-plans")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "subscription_plans" },
        () => fetchPlans()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const plansWithPopular = useMemo(
    () =>
      plans.map((p) => ({
        ...p,
        is_popular: p.slug === "pro",
      })),
    [plans]
  );

  return { plans: plansWithPopular, isLoading, refetch: fetchPlans };
}
