import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { PDFDocument, PDFFont, PDFPage, rgb, StandardFonts } from "https://esm.sh/pdf-lib@1.17.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const A4 = { w: 595.28, h: 841.89 };
const MARGIN = 48;

function hexToRgb(hex?: string | null) {
  if (!hex) return rgb(0.043, 0.11, 0.55);
  const m = hex.replace("#", "");
  const n = parseInt(m.length === 3 ? m.split("").map(c => c + c).join("") : m, 16);
  return rgb(((n >> 16) & 0xff) / 255, ((n >> 8) & 0xff) / 255, (n & 0xff) / 255);
}

function wrapText(text: string, font: PDFFont, size: number, maxWidth: number): string[] {
  if (!text) return [];
  const out: string[] = [];
  for (const para of text.split(/\n/)) {
    const words = para.split(/\s+/).filter(Boolean);
    if (!words.length) { out.push(""); continue; }
    let line = "";
    for (const w of words) {
      const test = line ? line + " " + w : w;
      if (font.widthOfTextAtSize(test, size) <= maxWidth) line = test;
      else { if (line) out.push(line); line = w; }
    }
    if (line) out.push(line);
  }
  return out;
}

interface Cursor { page: PDFPage; y: number; }
function ensureSpace(doc: PDFDocument, cur: Cursor, needed: number, drawHeader: (p: PDFPage) => void) {
  if (cur.y - needed < MARGIN + 30) {
    cur.page = doc.addPage([A4.w, A4.h]);
    drawHeader(cur.page);
    cur.y = A4.h - MARGIN - 50;
  }
}

async function fetchImageBytes(supa: any, url?: string | null) {
  if (!url) return null;
  const clean = url.split("?")[0].toLowerCase();
  if (clean.endsWith(".svg")) return null;
  try {
    const m = url.split("?")[0].match(/\/storage\/v1\/object\/(?:public|sign)\/([^/]+)\/(.+)$/);
    if (m) {
      const { data } = await supa.storage.from(m[1]).download(decodeURIComponent(m[2]));
      if (data) return { bytes: new Uint8Array(await data.arrayBuffer()), mime: data.type || "" };
    }
    const r = await fetch(url);
    if (!r.ok) return null;
    return { bytes: new Uint8Array(await r.arrayBuffer()), mime: r.headers.get("content-type") || "" };
  } catch { return null; }
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );
    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const token = authHeader.replace("Bearer ", "");
    const { data: claims, error: ce } = await supabase.auth.getClaims(token);
    if (ce || !claims?.claims) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const { submission_id } = await req.json();
    if (!submission_id) {
      return new Response(JSON.stringify({ error: "submission_id required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // RLS-enforced load
    const { data: submission, error: subErr } = await supabase
      .from("candidate_submissions")
      .select("id, tenant_id, job_id, candidate_id, ai_validation_id, submission_message")
      .eq("id", submission_id)
      .maybeSingle();
    if (subErr || !submission) {
      return new Response(JSON.stringify({ error: "Submission not found" }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const [{ data: candidate }, { data: job }, { data: validation }, { data: branding }] = await Promise.all([
      supabase.from("candidates").select("full_name, current_title, current_company, location, years_experience, email, phone, skills, summary").eq("id", submission.candidate_id).maybeSingle(),
      supabase.from("jobs").select("title, location, employment_type, seniority_level").eq("id", submission.job_id).maybeSingle(),
      submission.ai_validation_id
        ? supabase.from("ai_candidate_validations").select("*").eq("id", submission.ai_validation_id).maybeSingle()
        : supabase.from("ai_candidate_validations").select("*").eq("job_id", submission.job_id).eq("candidate_id", submission.candidate_id).order("created_at", { ascending: false }).limit(1).maybeSingle(),
      admin.from("branding_settings").select("logo_url, company_name, primary_color").eq("tenant_id", submission.tenant_id).maybeSingle(),
    ]);

    if (!candidate || !job) {
      return new Response(JSON.stringify({ error: "Candidate or job missing" }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const brandColor = hexToRgb(branding?.primary_color);
    const companyName = branding?.company_name ?? "";
    const logo = await fetchImageBytes(admin, branding?.logo_url ?? null);

    const doc = await PDFDocument.create();
    const font = await doc.embedFont(StandardFonts.Helvetica);
    const bold = await doc.embedFont(StandardFonts.HelveticaBold);

    let logoImg: any = null;
    if (logo?.bytes?.length) {
      const m = (logo.mime || "").toLowerCase();
      try {
        if (m.includes("png")) logoImg = await doc.embedPng(logo.bytes);
        else if (m.includes("jpeg") || m.includes("jpg")) logoImg = await doc.embedJpg(logo.bytes);
      } catch { /* ignore */ }
    }

    const drawHeader = (page: PDFPage) => {
      const { width, height } = page.getSize();
      // Brand bar
      page.drawRectangle({ x: 0, y: height - 6, width, height: 6, color: brandColor });
      // Logo or company name top-left
      if (logoImg) {
        const maxH = 28, maxW = 140;
        const scale = Math.min(maxW / logoImg.width, maxH / logoImg.height, 1);
        page.drawImage(logoImg, { x: MARGIN, y: height - MARGIN - logoImg.height * scale, width: logoImg.width * scale, height: logoImg.height * scale });
      } else if (companyName) {
        page.drawText(companyName, { x: MARGIN, y: height - MARGIN - 14, size: 14, font: bold, color: brandColor });
      }
      // Tagline
      const tag = "Candidate Submission Pack";
      page.drawText(tag, { x: width - MARGIN - bold.widthOfTextAtSize(tag, 9), y: height - MARGIN - 10, size: 9, font, color: rgb(0.45, 0.45, 0.5) });
      // Underline
      page.drawLine({ start: { x: MARGIN, y: height - MARGIN - 36 }, end: { x: width - MARGIN, y: height - MARGIN - 36 }, thickness: 0.6, color: rgb(0.88, 0.88, 0.92) });
    };

    const page1 = doc.addPage([A4.w, A4.h]);
    drawHeader(page1);
    const cur: Cursor = { page: page1, y: A4.h - MARGIN - 60 };

    const innerW = A4.w - MARGIN * 2;

    const drawHeading = (text: string) => {
      ensureSpace(doc, cur, 28, drawHeader);
      cur.page.drawText(text, { x: MARGIN, y: cur.y - 14, size: 13, font: bold, color: brandColor });
      cur.page.drawLine({ start: { x: MARGIN, y: cur.y - 20 }, end: { x: MARGIN + 30, y: cur.y - 20 }, thickness: 1.5, color: brandColor });
      cur.y -= 30;
    };

    const drawParagraph = (text: string, size = 10.5, color = rgb(0.15, 0.15, 0.2)) => {
      const lines = wrapText(text, font, size, innerW);
      for (const ln of lines) {
        ensureSpace(doc, cur, size + 4, drawHeader);
        cur.page.drawText(ln, { x: MARGIN, y: cur.y - size, size, font, color });
        cur.y -= size + 4;
      }
    };

    const drawBullets = (items: string[]) => {
      for (const it of items) {
        const lines = wrapText(it, font, 10, innerW - 14);
        if (!lines.length) continue;
        ensureSpace(doc, cur, 14, drawHeader);
        cur.page.drawCircle({ x: MARGIN + 4, y: cur.y - 6, size: 1.8, color: brandColor });
        cur.page.drawText(lines[0], { x: MARGIN + 14, y: cur.y - 10, size: 10, font, color: rgb(0.18, 0.18, 0.22) });
        cur.y -= 14;
        for (let i = 1; i < lines.length; i++) {
          ensureSpace(doc, cur, 14, drawHeader);
          cur.page.drawText(lines[i], { x: MARGIN + 14, y: cur.y - 10, size: 10, font, color: rgb(0.18, 0.18, 0.22) });
          cur.y -= 14;
        }
        cur.y -= 2;
      }
    };

    // --- Title block ---
    cur.page.drawText(candidate.full_name ?? "Candidate", { x: MARGIN, y: cur.y - 22, size: 22, font: bold, color: rgb(0.07, 0.08, 0.12) });
    cur.y -= 30;
    const sub = [candidate.current_title, candidate.current_company].filter(Boolean).join(" @ ");
    if (sub) { cur.page.drawText(sub, { x: MARGIN, y: cur.y - 12, size: 11, font, color: rgb(0.4, 0.4, 0.46) }); cur.y -= 18; }
    const meta = [candidate.location, candidate.years_experience ? `${candidate.years_experience} yrs exp` : null].filter(Boolean).join(" · ");
    if (meta) { cur.page.drawText(meta, { x: MARGIN, y: cur.y - 11, size: 10, font, color: rgb(0.5, 0.5, 0.55) }); cur.y -= 18; }
    cur.y -= 8;

    // For role
    cur.page.drawRectangle({ x: MARGIN, y: cur.y - 46, width: innerW, height: 46, color: rgb(0.96, 0.97, 1) });
    cur.page.drawText("SUBMITTED FOR", { x: MARGIN + 12, y: cur.y - 16, size: 8, font: bold, color: rgb(0.45, 0.45, 0.55) });
    cur.page.drawText(job.title ?? "Role", { x: MARGIN + 12, y: cur.y - 32, size: 13, font: bold, color: brandColor });
    const jobMeta = [job.seniority_level, job.employment_type, job.location].filter(Boolean).join(" · ");
    if (jobMeta) cur.page.drawText(jobMeta, { x: MARGIN + 12, y: cur.y - 44, size: 9, font, color: rgb(0.4, 0.4, 0.5) });
    cur.y -= 60;

    // AI Validation block
    if (validation) {
      drawHeading("AI Fit Assessment");
      const recoLabel = (validation.recommendation || "needs_review").replace("_", " ").replace(/\b\w/g, (c: string) => c.toUpperCase());
      cur.page.drawText(`Fit Score: ${validation.fit_score ?? 0}/100`, { x: MARGIN, y: cur.y - 12, size: 11, font: bold, color: rgb(0.07, 0.08, 0.12) });
      cur.page.drawText(`Recommendation: ${recoLabel}`, { x: MARGIN + 180, y: cur.y - 12, size: 11, font: bold, color: brandColor });
      cur.y -= 22;
      // Bar
      cur.page.drawRectangle({ x: MARGIN, y: cur.y - 6, width: innerW, height: 6, color: rgb(0.92, 0.93, 0.96) });
      cur.page.drawRectangle({ x: MARGIN, y: cur.y - 6, width: innerW * ((validation.fit_score ?? 0) / 100), height: 6, color: brandColor });
      cur.y -= 18;
      if (validation.summary) drawParagraph(validation.summary);
      cur.y -= 4;

      if ((validation.strengths || []).length) { drawHeading("Strengths"); drawBullets(validation.strengths); }
      if ((validation.weaknesses || []).length) { drawHeading("Considerations"); drawBullets(validation.weaknesses); }
      if ((validation.risks || []).length) { drawHeading("Risks"); drawBullets(validation.risks); }
    }

    // Recruiter message
    if (submission.submission_message) {
      drawHeading("Recruiter Notes");
      drawParagraph(submission.submission_message);
    }

    // Candidate summary
    if (candidate.summary) {
      drawHeading("Candidate Summary");
      drawParagraph(candidate.summary);
    }

    // Skills
    if (Array.isArray(candidate.skills) && candidate.skills.length) {
      drawHeading("Key Skills");
      drawParagraph(candidate.skills.join(" · "), 10);
    }

    // Footer on each page
    const pageCount = doc.getPageCount();
    for (let i = 0; i < pageCount; i++) {
      const p = doc.getPage(i);
      const { width } = p.getSize();
      const footer = `${companyName || "Confidential"} · Page ${i + 1} of ${pageCount}`;
      p.drawText(footer, { x: width - MARGIN - font.widthOfTextAtSize(footer, 8), y: 20, size: 8, font, color: rgb(0.55, 0.55, 0.6) });
    }

    const bytes = await doc.save();

    const path = `${submission.tenant_id}/${submission.id}/pack.pdf`;
    const { error: upErr } = await admin.storage.from("submission-packs").upload(path, bytes, {
      contentType: "application/pdf",
      upsert: true,
    });
    if (upErr) {
      console.error("upload error", upErr);
      return new Response(JSON.stringify({ error: upErr.message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Signed URL (24h) returned + persist canonical storage path
    const { data: signed } = await admin.storage.from("submission-packs").createSignedUrl(path, 60 * 60 * 24);

    await admin.from("candidate_submissions").update({
      pack_pdf_url: path,
      last_activity_at: new Date().toISOString(),
    }).eq("id", submission.id);

    await admin.from("submission_activity").insert({
      submission_id: submission.id,
      tenant_id: submission.tenant_id,
      actor_id: claims.claims.sub,
      activity_type: "pack_generated",
      payload: { path },
    });

    return new Response(JSON.stringify({ path, signed_url: signed?.signedUrl ?? null }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("generate-submission-pack error", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
