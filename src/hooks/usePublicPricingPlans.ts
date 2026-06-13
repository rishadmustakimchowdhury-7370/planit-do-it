import { useEffect, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
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

const QUERY_KEY = ["public-pricing-plans"] as const;

async function fetchPlans(): Promise<PublicPricingPlan[]> {
  const { data } = await supabase
    .from("subscription_plans")
    .select("id, name, slug, description, price_monthly, features, display_order")
    .eq("is_active", true)
    .order("display_order", { ascending: true })
    .order("created_at", { ascending: true })
    .limit(50);

  return (data ?? []).map((p) => ({
    id: String(p.id),
    name: String(p.name),
    slug: String(p.slug),
    description: p.description,
    price_monthly: Number(p.price_monthly ?? 0),
    features: normalizeFeatures(p.features),
    display_order: (p.display_order ?? null) as number | null,
  }));
}

export function usePublicPricingPlans() {
  const queryClient = useQueryClient();
  const { data, isLoading, refetch } = useQuery({
    queryKey: QUERY_KEY,
    queryFn: fetchPlans,
    staleTime: 1000 * 60 * 5, // 5 minutes
    gcTime: 1000 * 60 * 30, // 30 minutes
  });

  useEffect(() => {
    const channel = supabase
      .channel("public-pricing-plans")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "subscription_plans" },
        () => queryClient.invalidateQueries({ queryKey: QUERY_KEY })
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);

  const plans = data ?? [];

  const plansWithPopular = useMemo(
    () => plans.map((p) => ({ ...p, is_popular: p.slug === "pro" })),
    [plans]
  );

  return { plans: plansWithPopular, isLoading, refetch };
}
