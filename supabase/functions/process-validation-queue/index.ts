// =========================================================================
// process-validation-queue
// Drains the validation_queue table by invoking validate-candidate-fit-v2
// for each pending row. Designed to be called by pg_cron every minute.
// Idempotent and safe to overlap (uses started_at + status='in_progress'
// to claim rows). Backs off on OpenAI 429/402.
// =========================================================================

import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const DEFAULT_BATCH_SIZE = 20;
const MAX_ATTEMPTS = 3;

async function runValidator(jobId: string, candidateId: string): Promise<{ ok: true } | { ok: false; status: number; message: string }> {
  try {
    const res = await fetch(`${SUPABASE_URL}/functions/v1/validate-candidate-fit-v2`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${SERVICE_KEY}`,
        apikey: SERVICE_KEY,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ job_id: jobId, candidate_id: candidateId }),
    });
    if (res.ok) return { ok: true };
    const txt = await res.text().catch(() => "");
    return { ok: false, status: res.status, message: txt.slice(0, 500) };
  } catch (e: any) {
    return { ok: false, status: 0, message: e?.message ?? "network error" };
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const admin = createClient(SUPABASE_URL, SERVICE_KEY);

  let batchSize = DEFAULT_BATCH_SIZE;
  try {
    if (req.method === "POST") {
      const body = await req.json().catch(() => ({}));
      if (typeof body?.batch_size === "number") batchSize = Math.min(50, Math.max(1, body.batch_size));
    }
  } catch { /* ignore */ }

  // Claim pending rows. Order by priority desc, enqueued_at asc.
  const { data: pending, error: claimErr } = await admin
    .from("validation_queue")
    .select("id, tenant_id, job_id, candidate_id, attempts")
    .eq("status", "pending")
    .order("priority", { ascending: false })
    .order("enqueued_at", { ascending: true })
    .limit(batchSize);

  if (claimErr) {
    return new Response(JSON.stringify({ error: claimErr.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const rows = pending ?? [];
  if (!rows.length) {
    return new Response(JSON.stringify({ ok: true, processed: 0, failed: 0, remaining: 0 }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Mark claimed rows in_progress (best-effort optimistic claim).
  const ids = rows.map((r) => r.id);
  await admin
    .from("validation_queue")
    .update({ status: "in_progress", started_at: new Date().toISOString() })
    .in("id", ids)
    .eq("status", "pending");

  let processed = 0;
  let failed = 0;
  let rateLimited = false;

  for (const row of rows) {
    if (rateLimited) {
      // Release the remainder of this batch back to pending so cron picks them up.
      await admin
        .from("validation_queue")
        .update({ status: "pending", started_at: null })
        .eq("id", row.id);
      continue;
    }
    const result = await runValidator(row.job_id, row.candidate_id);
    if (result.ok) {
      await admin
        .from("validation_queue")
        .update({ status: "done", processed_at: new Date().toISOString(), last_error: null })
        .eq("id", row.id);
      processed++;
    } else {
      if (result.status === 429 || result.status === 402) {
        // Back off; leave this row + remainder as pending.
        rateLimited = true;
        await admin
          .from("validation_queue")
          .update({ status: "pending", started_at: null, last_error: `backoff:${result.status}` })
          .eq("id", row.id);
        continue;
      }
      const nextAttempts = (row.attempts ?? 0) + 1;
      const finalStatus = nextAttempts >= MAX_ATTEMPTS ? "failed" : "pending";
      await admin
        .from("validation_queue")
        .update({
          status: finalStatus,
          attempts: nextAttempts,
          last_error: `${result.status}:${result.message}`,
          started_at: null,
          processed_at: finalStatus === "failed" ? new Date().toISOString() : null,
        })
        .eq("id", row.id);
      if (finalStatus === "failed") failed++;
    }
  }

  // Count remaining pending after this batch.
  const { count: remaining } = await admin
    .from("validation_queue")
    .select("id", { count: "exact", head: true })
    .eq("status", "pending");

  return new Response(JSON.stringify({
    ok: true,
    processed,
    failed,
    rate_limited: rateLimited,
    remaining: remaining ?? null,
  }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
});
