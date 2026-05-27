// Refresh Outcome Memory — recomputes learning signals + client preference
// profiles for a single tenant from raw placement_outcomes. Tenant-scoped on
// every query. Server-side only (service_role).
//
// Trigger options:
//   • On-demand from the Recruiter Intelligence dashboard ("Refresh now").
//   • Optional pg_cron nightly call (not enabled by default).

import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const POSITIVE_OUTCOMES = new Set([
  "shortlist_accepted","interview_scheduled","offer_extended","offer_accepted","placement_succeeded",
]);
const NEGATIVE_OUTCOMES = new Set([
  "shortlist_rejected","interview_rejected","offer_rejected","placement_failed",
]);

function confidenceFor(n: number): "low" | "medium" | "high" {
  if (n >= 15) return "high";
  if (n >= 5) return "medium";
  return "low";
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const auth = req.headers.get("Authorization");
    if (!auth?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const userClient = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: auth } },
    });
    const { data: u } = await userClient.auth.getUser();
    if (!u?.user) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const body = await req.json().catch(() => ({}));
    const tenantId: string | undefined = body?.tenant_id;
    if (!tenantId) return new Response(JSON.stringify({ error: "tenant_id required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    // Authorise: caller must belong to the tenant, or be super admin.
    const { data: profile } = await admin.from("profiles").select("tenant_id").eq("id", u.user.id).maybeSingle();
    const { data: roles } = await admin.from("user_roles").select("role").eq("user_id", u.user.id);
    const isSuper = (roles ?? []).some((r: any) => r.role === "super_admin");
    if (!isSuper && (profile as any)?.tenant_id !== tenantId) {
      return new Response(JSON.stringify({ error: "Forbidden" }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Pull all outcomes for this tenant (last 365 days) joined with validation
    // signals. Tenant-scoped — no cross-tenant joins.
    const { data: outcomes } = await admin
      .from("placement_outcomes")
      .select("id, candidate_id, job_id, client_org_id, outcome_type, ai_validation_id, created_at")
      .eq("tenant_id", tenantId)
      .gte("created_at", new Date(Date.now() - 365 * 86400_000).toISOString())
      .limit(5000);

    const rows = (outcomes ?? []) as any[];

    // Hydrate validation signals for every outcome (one query).
    const valIds = Array.from(new Set(rows.map((r) => r.ai_validation_id).filter(Boolean)));
    let valMap = new Map<string, any>();
    if (valIds.length) {
      const { data: vals } = await admin
        .from("ai_candidate_validations")
        .select("id, ecosystem_signals, match_classification, jd_signature, recruiter_copilot")
        .in("id", valIds);
      valMap = new Map((vals ?? []).map((v: any) => [v.id, v]));
    }

    // ──────── Aggregate ecosystem signals (tenant scope) ────────
    interface Agg { wins: number; losses: number; total: number; }
    const ecoStats = new Map<string, Agg>();
    const pathStats = new Map<string, Agg>();          // adjacent paths
    const stratStats = new Map<string, Map<string, Agg>>(); // by recruiter
    const clientStats = new Map<string, { ecos: Map<string, Agg>; rejects: Map<string, number>; total: number }>();

    for (const r of rows) {
      const v = r.ai_validation_id ? valMap.get(r.ai_validation_id) : null;
      const positive = POSITIVE_OUTCOMES.has(r.outcome_type);
      const negative = NEGATIVE_OUTCOMES.has(r.outcome_type);
      if (!positive && !negative) continue;

      const ecos = Array.isArray(v?.ecosystem_signals) ? v.ecosystem_signals : [];
      for (const e of ecos) {
        const key = String(e?.ecosystem ?? e?.company ?? "").trim();
        if (!key) continue;
        const a = ecoStats.get(key) ?? { wins: 0, losses: 0, total: 0 };
        if (positive) a.wins++; else a.losses++; a.total++;
        ecoStats.set(key, a);

        if (r.client_org_id) {
          const c = clientStats.get(r.client_org_id) ?? { ecos: new Map(), rejects: new Map(), total: 0 };
          const ca = c.ecos.get(key) ?? { wins: 0, losses: 0, total: 0 };
          if (positive) ca.wins++; else ca.losses++; ca.total++;
          c.ecos.set(key, ca);
          c.total++;
          clientStats.set(r.client_org_id, c);
        }
      }

      // Adjacent path (transferable matches only).
      if (v?.match_classification === "transferable_match" || v?.match_classification === "needs_validation") {
        const cls = v?.match_classification ?? "transferable";
        const a = pathStats.get(cls) ?? { wins: 0, losses: 0, total: 0 };
        if (positive) a.wins++; else a.losses++; a.total++;
        pathStats.set(cls, a);
      }

      // Recruiter strategy wins
      const strat = v?.recruiter_copilot?.submission_strategy?.recommendation;
      if (strat) {
        // not per-recruiter here — keep at tenant scope to start
        const a = (stratStats.get("__tenant__") ?? new Map<string, Agg>());
        const s = a.get(strat) ?? { wins: 0, losses: 0, total: 0 };
        if (positive) s.wins++; else s.losses++; s.total++;
        a.set(strat, s);
        stratStats.set("__tenant__", a);
      }
    }

    // Convert aggregates → signal rows (weight ∈ [-1,1] from win-rate vs 0.5 baseline).
    type SigRow = { tenant_id: string; scope: string; client_org_id: string | null; recruiter_id: string | null;
                    signal_type: string; signal_key: string; weight: number; sample_size: number; confidence: string;
                    human_basis: string; last_observed_at: string; refreshed_at: string };
    const sigRows: SigRow[] = [];
    const now = new Date().toISOString();

    const pushFromAgg = (
      scope: "tenant" | "client" | "recruiter",
      type: "ecosystem_uplift" | "ecosystem_penalty" | "adjacent_path_winning" | "adjacent_path_losing" | "recruiter_strategy_wins",
      key: string, a: Agg, client_org_id: string | null = null, recruiter_id: string | null = null,
    ) => {
      if (a.total < 3) return; // require ≥3 even before confidence tagging
      const rate = a.wins / a.total;
      const weight = +(2 * (rate - 0.5)).toFixed(3); // [-1,1]
      sigRows.push({
        tenant_id: tenantId, scope, client_org_id, recruiter_id,
        signal_type: type, signal_key: key,
        weight, sample_size: a.total, confidence: confidenceFor(a.total),
        human_basis: `${a.wins}/${a.total} positive outcomes`,
        last_observed_at: now, refreshed_at: now,
      });
    };

    for (const [k, a] of ecoStats) pushFromAgg("tenant", a.wins >= a.losses ? "ecosystem_uplift" : "ecosystem_penalty", k, a);
    for (const [k, a] of pathStats) pushFromAgg("tenant", a.wins >= a.losses ? "adjacent_path_winning" : "adjacent_path_losing", k, a);
    const tenantStrats = stratStats.get("__tenant__");
    if (tenantStrats) for (const [k, a] of tenantStrats) pushFromAgg("tenant", "recruiter_strategy_wins", k, a);

    for (const [clientId, c] of clientStats) {
      for (const [k, a] of c.ecos) {
        pushFromAgg("client", a.wins >= a.losses ? "ecosystem_uplift" : "ecosystem_penalty", k, a, clientId);
      }
    }

    // Wipe + replace signals for this tenant (transactional reset is fine —
    // these are derived data, not source-of-truth).
    await admin.from("outcome_learning_signals").delete().eq("tenant_id", tenantId);
    if (sigRows.length) {
      // Batched insert
      const chunkSize = 200;
      for (let i = 0; i < sigRows.length; i += chunkSize) {
        await admin.from("outcome_learning_signals").insert(sigRows.slice(i, i + chunkSize));
      }
    }

    // Rebuild client preference profiles
    for (const [clientId, c] of clientStats) {
      const prefersEcos: string[] = [];
      const rejectsPatterns: string[] = [];
      for (const [k, a] of c.ecos) {
        if (a.total >= 3) {
          const rate = a.wins / a.total;
          if (rate >= 0.65) prefersEcos.push(k);
          else if (rate <= 0.35) rejectsPatterns.push(k);
        }
      }
      await admin.from("client_preference_profile").upsert({
        tenant_id: tenantId,
        client_org_id: clientId,
        preferences: { prefers_ecosystems: prefersEcos, rejects_patterns: rejectsPatterns },
        sample_size: c.total,
        confidence: confidenceFor(c.total),
        refreshed_at: now,
      }, { onConflict: "tenant_id,client_org_id" });
    }

    return new Response(JSON.stringify({
      ok: true,
      tenant_id: tenantId,
      outcomes_processed: rows.length,
      signals_written: sigRows.length,
      clients_profiled: clientStats.size,
      refreshed_at: now,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    console.error("refresh-outcome-memory error", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : String(e) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
