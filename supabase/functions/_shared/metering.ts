// Server-side metering helper. Single source of truth for paid-feature enforcement.
//
// Usage:
//   const result = await meterFeature(admin, {
//     tenantId, userId, featureKey: "ai_matches_monthly", amount: 1,
//   }, async () => {
//     // do the real work here; throw on failure
//     return await runWork();
//   });
//   if (!result.ok) return featureLimitResponse(result);
//
// Semantics:
//   1. Atomically checks quota (respects platform_settings.enforce_plan_limits toggle)
//      and reserves usage in one SQL round-trip.
//   2. Runs the action. If it throws, refunds the reservation (never consume quota
//      on failure) and writes an audit_log entry with action=<feature>.failed.
//   3. On success, writes an audit_log entry with action=<feature>.success.
//   4. Enforcement is concurrency-safe: reservation happens inside the RPC and
//      relies on the counter's UNIQUE(tenant_id, feature_key, period_start).
//
// While the platform toggle is OFF (default), the helper still meters (increments
// counters, writes audit rows) but never blocks — zero behaviour change for
// existing tenants. Flip enforce_plan_limits=true in platform_settings to arm
// hard limits atomically across every wired endpoint.

import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

export const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

export interface FeatureLimitError {
  ok: false;
  code: "FEATURE_LIMIT_EXCEEDED";
  feature_key: string;
  current_usage: number;
  allowed_usage: number;
  remaining: number;
  upgrade_required: true;
  message: string;
}

export interface MeterSuccess<T> {
  ok: true;
  data: T;
  usage: {
    feature_key: string;
    current_usage: number;
    allowed_usage: number;
    remaining: number;
    enforced: boolean;
  };
}

export type MeterResult<T> = MeterSuccess<T> | FeatureLimitError;

interface MeterOptions {
  tenantId: string | null | undefined;
  userId?: string | null;
  featureKey: string;
  amount?: number;
  // If false, skip metering entirely (e.g. super-admin bypass). Default: true.
  meter?: boolean;
}

function parseLimitError(raw: string, featureKey: string): FeatureLimitError {
  // Postgres raises: "FEATURE_LIMIT_EXCEEDED:<feature>:<json>"
  const jsonStart = raw.indexOf("{");
  let details: Record<string, unknown> = {};
  if (jsonStart >= 0) {
    try { details = JSON.parse(raw.slice(jsonStart)); } catch { /* ignore */ }
  }
  return {
    ok: false,
    code: "FEATURE_LIMIT_EXCEEDED",
    feature_key: (details.feature_key as string) ?? featureKey,
    current_usage: Number(details.current_usage ?? 0),
    allowed_usage: Number(details.allowed_usage ?? 0),
    remaining: Number(details.remaining ?? 0),
    upgrade_required: true,
    message: `You have reached your plan limit for "${featureKey}". Upgrade to continue.`,
  };
}

async function writeAudit(
  admin: SupabaseClient,
  args: {
    tenantId: string | null;
    userId: string | null;
    action: string;
    featureKey: string;
    metadata: Record<string, unknown>;
  },
): Promise<void> {
  try {
    await admin.rpc("write_audit_log", {
      _action: args.action,
      _entity_type: "feature_usage",
      _entity_id: null,
      _old: null,
      _new: null,
      _metadata: { feature_key: args.featureKey, ...args.metadata },
      _tenant_id: args.tenantId,
      _user_id: args.userId,
    });
  } catch (e) {
    console.error("[metering] audit failed", args.action, (e as Error).message);
  }
}

export async function meterFeature<T>(
  admin: SupabaseClient,
  opts: MeterOptions,
  action: () => Promise<T>,
): Promise<MeterResult<T>> {
  const amount = Math.max(1, opts.amount ?? 1);
  const meter = opts.meter !== false;
  const tenantId = opts.tenantId ?? null;
  const userId = opts.userId ?? null;

  // Skip metering entirely (bypass path).
  if (!meter || !tenantId) {
    try {
      const data = await action();
      return {
        ok: true,
        data,
        usage: { feature_key: opts.featureKey, current_usage: 0, allowed_usage: -1, remaining: -1, enforced: false },
      };
    } catch (err) {
      await writeAudit(admin, {
        tenantId, userId,
        action: `${opts.featureKey}.failed`,
        featureKey: opts.featureKey,
        metadata: { error: (err as Error).message, metered: false },
      });
      throw err;
    }
  }

  // 1. Atomic check + reserve.
  const reserve = await admin.rpc("check_and_reserve_feature_usage", {
    _tenant_id: tenantId,
    _feature_key: opts.featureKey,
    _amount: amount,
    _user_id: userId,
  });

  if (reserve.error) {
    const msg = reserve.error.message ?? "";
    if (msg.includes("FEATURE_LIMIT_EXCEEDED")) {
      const parsed = parseLimitError(msg, opts.featureKey);
      await writeAudit(admin, {
        tenantId, userId,
        action: `${opts.featureKey}.blocked`,
        featureKey: opts.featureKey,
        metadata: { current_usage: parsed.current_usage, allowed_usage: parsed.allowed_usage },
      });
      return parsed;
    }
    console.error(`[metering] reserve failed for ${opts.featureKey}`, msg);
    // Fail open: never block user for infra errors, but audit.
    await writeAudit(admin, {
      tenantId, userId,
      action: `${opts.featureKey}.meter_error`,
      featureKey: opts.featureKey,
      metadata: { error: msg },
    });
  }

  const usage = (reserve.data ?? {}) as Record<string, unknown>;

  // 2. Run the real action; commit on success, refund on failure.
  try {
    const data = await action();

    // Commit: move reservation into permanent used counter.
    if (!reserve.error) {
      try {
        await admin.rpc("commit_feature_usage", {
          _tenant_id: tenantId,
          _feature_key: opts.featureKey,
          _amount: amount,
          _user_id: userId,
        });
      } catch (commitErr) {
        console.error("[metering] commit failed", (commitErr as Error).message);
      }
    }

    await writeAudit(admin, {
      tenantId, userId,
      action: `${opts.featureKey}.success`,
      featureKey: opts.featureKey,
      metadata: { amount, current_usage: usage.current_usage ?? null },
    });
    return {
      ok: true,
      data,
      usage: {
        feature_key: opts.featureKey,
        current_usage: Number(usage.current_usage ?? 0),
        allowed_usage: Number(usage.allowed_usage ?? -1),
        remaining: Number(usage.remaining ?? -1),
        enforced: Boolean(usage.enforced ?? false),
      },
    };

  } catch (err) {
    // Refund reservation — failed requests must never consume quota.
    if (!reserve.error) {
      try {
        await admin.rpc("refund_feature_usage", {
          _tenant_id: tenantId,
          _feature_key: opts.featureKey,
          _amount: amount,
          _user_id: userId,
          _reason: (err as Error).message?.slice(0, 200) ?? "action_failed",
        });
      } catch (refundErr) {
        console.error("[metering] refund failed", (refundErr as Error).message);
      }
    }
    await writeAudit(admin, {
      tenantId, userId,
      action: `${opts.featureKey}.failed`,
      featureKey: opts.featureKey,
      metadata: { error: (err as Error).message?.slice(0, 500) ?? "unknown" },
    });
    throw err;
  }
}

export function featureLimitResponse(err: FeatureLimitError): Response {
  return new Response(JSON.stringify({
    error: err.message,
    code: err.code,
    feature_key: err.feature_key,
    current_usage: err.current_usage,
    allowed_usage: err.allowed_usage,
    remaining: err.remaining,
    upgrade_required: err.upgrade_required,
  }), {
    status: 402, // Payment Required — distinct from auth/permission failures.
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

// Convenience: resolve tenant_id for the caller. Returns null if unknown.
export async function resolveTenantId(admin: SupabaseClient, userId: string): Promise<string | null> {
  try {
    const { data } = await admin.from("profiles").select("tenant_id").eq("id", userId).maybeSingle();
    return (data?.tenant_id as string | null) ?? null;
  } catch { return null; }
}
