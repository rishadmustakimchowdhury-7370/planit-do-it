// Expands recruiter search terms into related synonyms via OpenAI.
// Results are cached in `discovery_synonym_cache` so we never pay twice for the same term.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (b: unknown, status = 200) =>
  new Response(JSON.stringify(b), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

interface Body { terms?: string[] }

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const body = (await req.json()) as Body;
    const terms = Array.from(new Set((body.terms ?? [])
      .map((t) => (t ?? "").trim())
      .filter((t) => t.length > 0 && t.length < 80)))
      .slice(0, 20);
    if (!terms.length) return json({ results: [] });

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    const lowerTerms = terms.map((t) => t.toLowerCase());
    const { data: cached } = await supabase
      .from("discovery_synonym_cache")
      .select("term, synonyms")
      .in("term", lowerTerms);
    const cacheMap = new Map<string, string[]>();
    for (const row of cached ?? []) cacheMap.set(row.term, row.synonyms ?? []);

    const missing = lowerTerms.filter((t) => !cacheMap.has(t));
    if (missing.length) {
      const apiKey = Deno.env.get("OPENAI_API_KEY");
      if (!apiKey) return json({ error: "OPENAI_API_KEY not configured" }, 500);

      const prompt = `You are a recruiter assistant. For each input term, return up to 5 closely related search synonyms a sourcer would actually OR together on LinkedIn / Lusha. Include common abbreviations, modern equivalents and adjacent disciplines. Avoid duplicates. Avoid generic words.

Input terms: ${JSON.stringify(missing)}

Respond as STRICT JSON: {"results":[{"term":"<lowercased input>","synonyms":["..."]}]}`;

      const resp = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "gpt-4o-mini",
          temperature: 0.2,
          response_format: { type: "json_object" },
          messages: [{ role: "user", content: prompt }],
        }),
      });
      if (!resp.ok) {
        const t = await resp.text();
        console.error("[synonyms] openai failed", resp.status, t.slice(0, 300));
        return json({ error: `OpenAI ${resp.status}` }, 502);
      }
      const data = await resp.json();
      let parsed: { results?: { term: string; synonyms: string[] }[] } = {};
      try { parsed = JSON.parse(data.choices?.[0]?.message?.content ?? "{}"); } catch { /* */ }
      const fresh = parsed.results ?? [];
      const upserts = fresh.map((r) => ({
        term: r.term.toLowerCase(),
        synonyms: Array.from(new Set((r.synonyms ?? []).map((s) => s.trim()).filter(Boolean))).slice(0, 5),
        updated_at: new Date().toISOString(),
      }));
      if (upserts.length) {
        await supabase.from("discovery_synonym_cache").upsert(upserts, { onConflict: "term" });
        for (const u of upserts) cacheMap.set(u.term, u.synonyms);
      }
    }

    const results = terms.map((t) => ({ term: t, synonyms: cacheMap.get(t.toLowerCase()) ?? [] }));
    return json({ results });
  } catch (e) {
    console.error("[synonyms] error", e);
    return json({ error: e instanceof Error ? e.message : "Unknown error" }, 500);
  }
});
