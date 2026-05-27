// Recruiter + Tenant memory loader and writer.
// Memory is read into the validation prompt so future reasoning improves over
// time. Recruiter memory is primary; tenant memory provides contextual
// weighting; client-scoped memory captures client-specific preferences.
//
// IMPORTANT: never expose raw memory to clients — it informs reasoning only.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

export type MemoryScope = "recruiter" | "tenant" | "client";

export interface MemorySignal {
  scope: MemoryScope;
  signal_type: string;
  signal_value: string;
  weight: number;
  evidence_count: number;
}

export async function loadRecruiterMemory(
  admin: ReturnType<typeof createClient>,
  args: { tenant_id: string; recruiter_id?: string | null; client_org_id?: string | null },
): Promise<{ recruiter: MemorySignal[]; tenant: MemorySignal[]; client: MemorySignal[] }> {
  try {
    const { data } = await admin
      .from("recruiter_memory_signals")
      .select("scope, signal_type, signal_value, weight, evidence_count, recruiter_id, client_org_id")
      .eq("tenant_id", args.tenant_id)
      .order("weight", { ascending: false })
      .limit(120);
    const all = (data ?? []) as any[];
    const recruiter = args.recruiter_id
      ? all.filter((r) => r.scope === "recruiter" && r.recruiter_id === args.recruiter_id).slice(0, 25)
      : [];
    const tenant = all.filter((r) => r.scope === "tenant").slice(0, 25);
    const client = args.client_org_id
      ? all.filter((r) => r.scope === "client" && r.client_org_id === args.client_org_id).slice(0, 25)
      : [];
    return { recruiter, tenant, client };
  } catch {
    return { recruiter: [], tenant: [], client: [] };
  }
}

export function renderMemoryForPrompt(mem: {
  recruiter: MemorySignal[]; tenant: MemorySignal[]; client: MemorySignal[];
}): string {
  const fmt = (sigs: MemorySignal[]) => sigs
    .map((s) => `- [${s.signal_type}] ${s.signal_value} (weight=${s.weight}, n=${s.evidence_count})`)
    .join("\n");
  const parts: string[] = [];
  if (mem.recruiter.length) parts.push(`RECRUITER MEMORY (primary — this recruiter's pattern):\n${fmt(mem.recruiter)}`);
  if (mem.client.length)    parts.push(`CLIENT MEMORY (this client's historical preferences):\n${fmt(mem.client)}`);
  if (mem.tenant.length)    parts.push(`AGENCY MEMORY (tenant rollup — contextual weighting):\n${fmt(mem.tenant)}`);
  return parts.length
    ? `\n\nRECRUITER / AGENCY MEMORY — incorporate these patterns when shaping copilot output. Recruiter memory is primary, client memory overrides agency rollup, agency memory provides weighting only:\n${parts.join("\n\n")}`
    : "";
}

export async function recordSignal(
  admin: ReturnType<typeof createClient>,
  args: {
    tenant_id: string;
    scope: MemoryScope;
    recruiter_id?: string | null;
    client_org_id?: string | null;
    signal_type: string;
    signal_value: string;
    weight_delta?: number;
  },
) {
  const weightDelta = args.weight_delta ?? 1;
  try {
    // Upsert via unique index — increment evidence_count + weight if exists
    const { data: existing } = await admin
      .from("recruiter_memory_signals")
      .select("id, weight, evidence_count")
      .eq("tenant_id", args.tenant_id)
      .eq("scope", args.scope)
      .eq("signal_type", args.signal_type)
      .eq("signal_value", args.signal_value)
      .eq("recruiter_id", args.recruiter_id ?? null as any)
      .eq("client_org_id", args.client_org_id ?? null as any)
      .maybeSingle();
    if (existing) {
      await admin.from("recruiter_memory_signals").update({
        weight: Number(existing.weight ?? 1) + weightDelta,
        evidence_count: Number(existing.evidence_count ?? 1) + 1,
        last_observed_at: new Date().toISOString(),
      }).eq("id", (existing as any).id);
    } else {
      await admin.from("recruiter_memory_signals").insert({
        tenant_id: args.tenant_id,
        scope: args.scope,
        recruiter_id: args.recruiter_id ?? null,
        client_org_id: args.client_org_id ?? null,
        signal_type: args.signal_type,
        signal_value: args.signal_value,
        weight: weightDelta,
        evidence_count: 1,
      });
    }
  } catch (e) {
    console.error("recordSignal failed", e);
  }
}
