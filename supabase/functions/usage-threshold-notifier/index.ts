// Scan subscription_usage_counters and notify workspace owners at 80% / 95% / 100% thresholds.
// Designed to be triggered by pg_cron / Supabase scheduled trigger (daily).
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import { notifyBillingEvent, BillingEvent } from "../_shared/billing-events.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const THRESHOLDS = [80, 95, 100] as const;

const EVENT_MAP: Record<string, BillingEvent> = {
  ai_matches_monthly: 'ai_usage_almost_full',
  ai_credits: 'ai_usage_almost_full',
  storage_mb: 'storage_almost_full',
  open_web_searches: 'open_web_almost_full',
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    { auth: { persistSession: false } },
  );

  try {
    const now = new Date();
    const { data: counters, error } = await supabase
      .from('subscription_usage_counters')
      .select('tenant_id, feature_key, used, period_end')
      .gte('period_end', now.toISOString());
    if (error) throw error;

    // For each (tenant, feature) we need the limit from get_tenant_feature
    let fired = 0;
    for (const row of counters ?? []) {
      const event = EVENT_MAP[row.feature_key];
      if (!event) continue;
      const { data: feature } = await supabase.rpc('get_tenant_feature', {
        _tenant_id: row.tenant_id, _feature_key: row.feature_key,
      });
      const f = feature as { limit: number | null; usage: number; unlimited: boolean } | null;
      if (!f || f.unlimited || !f.limit || f.limit <= 0) continue;
      const pct = Math.floor((f.usage / f.limit) * 100);
      const threshold = [...THRESHOLDS].reverse().find(t => pct >= t);
      if (!threshold) continue;

      // Dedup: skip if a notification with the same threshold already exists this period
      const { data: dup } = await supabase
        .from('notifications')
        .select('id')
        .eq('tenant_id', row.tenant_id)
        .eq('type', event)
        .contains('metadata', { feature_key: row.feature_key, threshold })
        .gte('created_at', new Date(now.getTime() - 30 * 86_400_000).toISOString())
        .limit(1);
      if (dup && dup.length > 0) continue;

      await notifyBillingEvent(supabase, {
        tenantId: row.tenant_id,
        event,
        message: `You have used ${pct}% of your ${row.feature_key.replace(/_/g, ' ')} allowance.`,
        metadata: { feature_key: row.feature_key, threshold, used: f.usage, limit: f.limit },
      });
      fired++;
    }

    return new Response(JSON.stringify({ ok: true, fired }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return new Response(JSON.stringify({ error: msg }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
