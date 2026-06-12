import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const PIXEL = new Uint8Array([
  0x47,0x49,0x46,0x38,0x39,0x61,0x01,0x00,0x01,0x00,0x80,0x00,0x00,0xff,0xff,0xff,
  0x00,0x00,0x00,0x21,0xf9,0x04,0x01,0x00,0x00,0x00,0x00,0x2c,0x00,0x00,0x00,0x00,
  0x01,0x00,0x01,0x00,0x00,0x02,0x02,0x44,0x01,0x00,0x3b,
]);

const headers = {
  "Content-Type": "image/gif",
  "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
  "Pragma": "no-cache",
  "Access-Control-Allow-Origin": "*",
};

Deno.serve(async (req) => {
  const url = new URL(req.url);
  const id = url.searchParams.get("id");
  if (!id) return new Response(PIXEL, { headers });
  try {
    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { data: inv } = await supabase.from("invoices").select("id,tenant_id,open_count,first_opened_at").eq("id", id).maybeSingle();
    if (!inv) return new Response(PIXEL, { headers });
    const now = new Date().toISOString();
    await supabase.from("invoices").update({
      open_count: (inv.open_count || 0) + 1,
      first_opened_at: inv.first_opened_at || now,
    }).eq("id", id);
    await supabase.from("invoice_email_logs").insert({
      tenant_id: inv.tenant_id, invoice_id: id, event_type: "opened",
      metadata: { user_agent: req.headers.get("user-agent"), ip: req.headers.get("x-forwarded-for") },
    });
  } catch (e) {
    console.error("[track-invoice-email]", e);
  }
  return new Response(PIXEL, { headers });
});
