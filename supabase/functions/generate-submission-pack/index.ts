import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { PDFDocument, PDFFont, PDFPage, rgb, StandardFonts } from "https://esm.sh/pdf-lib@1.17.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const A4 = { w: 595.28, h: 841.89 };
const MARGIN = 56;

// Brand-leaning palette: navy text, gold accent (overridden by tenant primary_color)
const NAVY = rgb(0.06, 0.12, 0.27);          // #0F1F45-ish — main text / headings
const NAVY_SOFT = rgb(0.12, 0.18, 0.33);
const TEXT = rgb(0.13, 0.14, 0.18);
const MUTED = rgb(0.45, 0.45, 0.52);
const HAIR = rgb(0.86, 0.84, 0.74);          // hairline rule (subtle gold tint)
const ROW_ALT = rgb(0.97, 0.96, 0.92);

function hexToRgb(hex?: string | null, fallback = rgb(0.78, 0.63, 0.30)) {
  if (!hex) return fallback;
  const m = hex.replace("#", "");
  const n = parseInt(m.length === 3 ? m.split("").map(c => c + c).join("") : m, 16);
  if (isNaN(n)) return fallback;
  return rgb(((n >> 16) & 0xff) / 255, ((n >> 8) & 0xff) / 255, (n & 0xff) / 255);
}

function wrap(text: string, font: PDFFont, size: number, maxWidth: number): string[] {
  if (!text) return [];
  const out: string[] = [];
  for (const para of String(text).split(/\n/)) {
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

function tracked(s: string, spacing = " ") {
  return s.toUpperCase().split("").join(spacing);
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

interface Cursor { page: PDFPage; y: number; }

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

    const { data: userData, error: ue } = await supabase.auth.getUser();
    if (ue || !userData?.user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const userId = userData.user.id;

    const { submission_id } = await req.json();
    if (!submission_id) {
      return new Response(JSON.stringify({ error: "submission_id required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const { data: submission, error: subErr } = await supabase
      .from("candidate_submissions")
      .select("id, tenant_id, job_id, candidate_id, ai_validation_id, submission_message, client_org_id")
      .eq("id", submission_id)
      .maybeSingle();
    if (subErr || !submission) {
      return new Response(JSON.stringify({ error: "Submission not found" }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const [{ data: candidate }, { data: job }, { data: validation }, { data: branding }] = await Promise.all([
      supabase.from("candidates").select("full_name, current_title, current_company, location, experience_years, email, phone, skills, summary, work_history, education, linkedin_url").eq("id", submission.candidate_id).maybeSingle(),
      supabase.from("jobs").select("title, location, employment_type, experience_level").eq("id", submission.job_id).maybeSingle(),
      submission.ai_validation_id
        ? supabase.from("ai_candidate_validations").select("*").eq("id", submission.ai_validation_id).maybeSingle()
        : supabase.from("ai_candidate_validations").select("*").eq("job_id", submission.job_id).eq("candidate_id", submission.candidate_id).order("created_at", { ascending: false }).limit(1).maybeSingle(),
      admin.from("branding_settings").select("logo_url, company_name, primary_color, footer_text").eq("tenant_id", submission.tenant_id).maybeSingle(),
    ]);

    if (!candidate || !job) {
      return new Response(JSON.stringify({ error: "Candidate or job missing" }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const brand = hexToRgb(branding?.primary_color);
    const companyName = branding?.company_name ?? "";
    const footerLine = `${companyName ? companyName + " · " : ""}Confidential candidate report`;
    const logo = await fetchImageBytes(admin, branding?.logo_url ?? null);

    const doc = await PDFDocument.create();
    const serif = await doc.embedFont(StandardFonts.TimesRoman);
    const serifB = await doc.embedFont(StandardFonts.TimesRomanBold);
    const serifI = await doc.embedFont(StandardFonts.TimesRomanItalic);
    const sans = await doc.embedFont(StandardFonts.Helvetica);
    const sansB = await doc.embedFont(StandardFonts.HelveticaBold);

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
      // Centered logo (or company name) at top
      const topY = height - MARGIN;
      if (logoImg) {
        const maxH = 46, maxW = 180;
        const s = Math.min(maxW / logoImg.width, maxH / logoImg.height, 1);
        const w = logoImg.width * s, h = logoImg.height * s;
        page.drawImage(logoImg, { x: (width - w) / 2, y: topY - h, width: w, height: h });
      } else if (companyName) {
        const t = tracked(companyName);
        const tw = sansB.widthOfTextAtSize(t, 13);
        page.drawText(t, { x: (width - tw) / 2, y: topY - 18, size: 13, font: sansB, color: brand });
      }
      // Gold divider below header
      page.drawLine({
        start: { x: MARGIN, y: topY - 62 },
        end: { x: width - MARGIN, y: topY - 62 },
        thickness: 0.8, color: brand,
      });
    };

    const drawFooter = (page: PDFPage, num: number, total: number) => {
      const { width } = page.getSize();
      page.drawLine({ start: { x: MARGIN, y: 52 }, end: { x: width - MARGIN, y: 52 }, thickness: 0.5, color: HAIR });
      page.drawText(footerLine, { x: MARGIN, y: 38, size: 9, font: serif, color: MUTED });
      const right = `Page ${num} of ${total}`;
      page.drawText(right, { x: width - MARGIN - serif.widthOfTextAtSize(right, 9), y: 38, size: 9, font: serif, color: MUTED });
    };

    const innerW = A4.w - MARGIN * 2;

    const newPage = (): PDFPage => {
      const p = doc.addPage([A4.w, A4.h]);
      drawHeader(p);
      return p;
    };
    const cur: Cursor = { page: newPage(), y: A4.h - MARGIN - 80 };
    const ensure = (need: number) => {
      if (cur.y - need < 72) { cur.page = newPage(); cur.y = A4.h - MARGIN - 80; }
    };

    const sectionHeading = (label: string) => {
      ensure(36);
      cur.y -= 10;
      cur.page.drawText(tracked(label), {
        x: MARGIN, y: cur.y, size: 12, font: sansB, color: NAVY,
      });
      cur.y -= 8;
      cur.page.drawLine({
        start: { x: MARGIN, y: cur.y }, end: { x: MARGIN + innerW, y: cur.y },
        thickness: 0.6, color: brand,
      });
      cur.y -= 14;
    };

    const paragraph = (text: string, size = 10.5, font: PDFFont = serif, color = TEXT) => {
      const lines = wrap(text, font, size, innerW);
      for (const ln of lines) {
        ensure(size + 4);
        cur.page.drawText(ln, { x: MARGIN, y: cur.y - size, size, font, color });
        cur.y -= size + 4;
      }
    };

    const emDashBullet = (text: string, opts?: { boldLead?: string }) => {
      const indent = 16;
      const dashW = serif.widthOfTextAtSize("— ", 10.5);
      const maxW = innerW - indent - dashW;
      let firstLineLead = "";
      let firstLineRest = text;
      if (opts?.boldLead) {
        firstLineLead = opts.boldLead;
        firstLineRest = text;
      }
      const lines = wrap(firstLineRest, serif, 10.5, maxW - (firstLineLead ? serifB.widthOfTextAtSize(firstLineLead + " — ", 10.5) : 0));
      ensure(14);
      // dash
      cur.page.drawText("—", { x: MARGIN + indent, y: cur.y - 10, size: 10.5, font: serif, color: brand });
      let x = MARGIN + indent + dashW;
      if (firstLineLead) {
        cur.page.drawText(firstLineLead, { x, y: cur.y - 10, size: 10.5, font: serifB, color: NAVY });
        const lw = serifB.widthOfTextAtSize(firstLineLead, 10.5);
        cur.page.drawText(" — ", { x: x + lw, y: cur.y - 10, size: 10.5, font: serif, color: TEXT });
        x += lw + serif.widthOfTextAtSize(" — ", 10.5);
      }
      if (lines[0]) cur.page.drawText(lines[0], { x, y: cur.y - 10, size: 10.5, font: serif, color: TEXT });
      cur.y -= 14;
      for (let i = 1; i < lines.length; i++) {
        ensure(14);
        cur.page.drawText(lines[i], { x: MARGIN + indent + dashW, y: cur.y - 10, size: 10.5, font: serif, color: TEXT });
        cur.y -= 14;
      }
      cur.y -= 2;
    };

    // ===== Hero block =====
    cur.page.drawText(tracked("Candidate Report"), {
      x: MARGIN, y: cur.y, size: 10, font: sansB, color: brand,
    });
    cur.y -= 28;
    const name = candidate.full_name ?? "Candidate";
    cur.page.drawText(name, { x: MARGIN, y: cur.y - 26, size: 30, font: serifB, color: NAVY });
    cur.y -= 36;
    const subBits = [candidate.current_title, candidate.location].filter(Boolean).join(" · ");
    if (subBits) {
      cur.page.drawText(subBits, { x: MARGIN, y: cur.y - 14, size: 13, font: serifI, color: NAVY_SOFT });
      cur.y -= 20;
    }
    cur.y -= 6;

    // ===== Key facts table =====
    const labelColW = 150;
    const valueColW = innerW - labelColW;
    const facts: Array<[string, string]> = [];
    if (candidate.current_title || candidate.current_company) {
      facts.push(["Current Role", [candidate.current_title, candidate.current_company].filter(Boolean).join(" · ")]);
    }
    facts.push(["Submitted For", [job.title, job.experience_level, job.employment_type].filter(Boolean).join(" · ")]);
    if (job.location) facts.push(["Role Location", job.location]);
    if (candidate.experience_years != null) facts.push(["Experience", `${candidate.experience_years}+ years`]);
    if (candidate.location) facts.push(["Location", candidate.location]);
    const contactBits = [candidate.email, candidate.phone, candidate.linkedin_url].filter(Boolean);
    if (contactBits.length) facts.push(["Contact", contactBits.join("\n")]);

    for (let i = 0; i < facts.length; i++) {
      const [label, value] = facts[i];
      const valueLines = wrap(value, serif, 10.5, valueColW - 16);
      const rowH = Math.max(24, valueLines.length * 14 + 10);
      ensure(rowH + 4);
      if (i % 2 === 1) {
        cur.page.drawRectangle({ x: MARGIN, y: cur.y - rowH, width: innerW, height: rowH, color: ROW_ALT });
      }
      // label
      cur.page.drawText(tracked(label), {
        x: MARGIN + 8, y: cur.y - 16, size: 8.5, font: sansB, color: brand,
      });
      // value
      let ly = cur.y - 16;
      for (const ln of valueLines) {
        cur.page.drawText(ln, { x: MARGIN + labelColW, y: ly, size: 10.5, font: serif, color: TEXT });
        ly -= 14;
      }
      // bottom hairline
      cur.page.drawLine({
        start: { x: MARGIN, y: cur.y - rowH }, end: { x: MARGIN + innerW, y: cur.y - rowH },
        thickness: 0.3, color: HAIR,
      });
      cur.y -= rowH;
    }
    cur.y -= 6;

    // ===== Summary =====
    if (candidate.summary || validation?.summary) {
      sectionHeading("Summary");
      paragraph(validation?.summary || candidate.summary || "");
    }

    // ===== Technical / Key Skills =====
    if (Array.isArray(candidate.skills) && candidate.skills.length) {
      sectionHeading("Key Skills");
      const grouped = (candidate.skills as string[]).join("  ·  ");
      paragraph(grouped);
    }

    // ===== AI Fit Assessment =====
    if (validation) {
      sectionHeading("AI Fit Assessment");
      const reco = (validation.recommendation || "needs_review").replace(/_/g, " ").replace(/\b\w/g, (c: string) => c.toUpperCase());
      ensure(40);
      cur.page.drawText(`Fit Score`, { x: MARGIN, y: cur.y - 11, size: 9, font: sansB, color: MUTED });
      cur.page.drawText(`${validation.fit_score ?? 0} / 100`, { x: MARGIN, y: cur.y - 28, size: 18, font: serifB, color: NAVY });
      cur.page.drawText(`Recommendation`, { x: MARGIN + 180, y: cur.y - 11, size: 9, font: sansB, color: MUTED });
      cur.page.drawText(reco, { x: MARGIN + 180, y: cur.y - 28, size: 14, font: serifB, color: brand });
      cur.y -= 36;
      // score bar
      cur.page.drawRectangle({ x: MARGIN, y: cur.y - 5, width: innerW, height: 4, color: rgb(0.92, 0.91, 0.86) });
      cur.page.drawRectangle({ x: MARGIN, y: cur.y - 5, width: innerW * Math.min(1, Math.max(0, (validation.fit_score ?? 0) / 100)), height: 4, color: brand });
      cur.y -= 16;
    }

    // ===== Strengths / Considerations / Risks (Relevance / Gaps style) =====
    const strengths = (validation?.strengths as string[]) || [];
    const weaknesses = (validation?.weaknesses as string[]) || [];
    const risks = (validation?.risks as string[]) || [];

    if (strengths.length) {
      sectionHeading("Relevance to the Mandate");
      for (const s of strengths) {
        const m = String(s).match(/^([^—:\-]{2,40})\s*[—:\-]\s*(.+)$/);
        if (m) emDashBullet(m[2], { boldLead: m[1].trim() });
        else emDashBullet(String(s));
      }
    }
    if (weaknesses.length) {
      sectionHeading("Considerations & Gaps");
      for (const s of weaknesses) {
        const m = String(s).match(/^([^—:\-]{2,40})\s*[—:\-]\s*(.+)$/);
        if (m) emDashBullet(m[2], { boldLead: m[1].trim() });
        else emDashBullet(String(s));
      }
    }
    if (risks.length) {
      sectionHeading("Risks");
      for (const s of risks) emDashBullet(String(s));
    }

    // ===== Career Highlights =====
    const wh = Array.isArray(candidate.work_history) ? candidate.work_history as any[] : [];
    if (wh.length) {
      sectionHeading("Career Highlights");
      for (const role of wh.slice(0, 6)) {
        const company = role.company || role.employer || "";
        const title = role.title || role.position || role.role || "";
        const start = role.start_date || role.start || role.from || "";
        const end = role.end_date || role.end || role.to || (role.is_current ? "present" : "");
        const dates = [start, end].filter(Boolean).join(" – ");
        const header = [company, title, dates].filter(Boolean).join("  ·  ");
        ensure(20);
        cur.page.drawText(header, { x: MARGIN, y: cur.y - 12, size: 12, font: serifB, color: NAVY });
        cur.y -= 18;
        const desc = role.description || role.summary || "";
        if (desc) {
          if (Array.isArray(desc)) {
            for (const d of desc) emDashBullet(String(d));
          } else {
            const parts = String(desc).split(/\n+|•|·/).map(s => s.trim()).filter(Boolean);
            if (parts.length > 1) for (const d of parts) emDashBullet(d);
            else paragraph(String(desc));
          }
        }
        cur.y -= 4;
      }
    }

    // ===== Recruiter Notes =====
    if (submission.submission_message) {
      sectionHeading("Recruiter Notes");
      paragraph(submission.submission_message);
    }

    // ===== Footer notes / Recommendation closing =====
    if (validation?.summary && (strengths.length || weaknesses.length)) {
      sectionHeading(`${companyName || "Our"} Recommendation`);
      paragraph(validation.summary);
    }

    // ===== Footers on every page =====
    const total = doc.getPageCount();
    for (let i = 0; i < total; i++) drawFooter(doc.getPage(i), i + 1, total);

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

    const { data: signed } = await admin.storage.from("submission-packs").createSignedUrl(path, 60 * 60 * 24);

    await admin.from("candidate_submissions").update({
      pack_pdf_url: path,
      last_activity_at: new Date().toISOString(),
    }).eq("id", submission.id);

    await admin.from("submission_activity").insert({
      submission_id: submission.id,
      tenant_id: submission.tenant_id,
      client_org_id: submission.client_org_id ?? null,
      actor_user_id: userId,
      actor_type: "recruiter",
      event_type: "pack_generated",
      metadata: { path },
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
