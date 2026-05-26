import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { PDFDocument, PDFFont, PDFPage, rgb, StandardFonts } from "https://esm.sh/pdf-lib@1.17.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// ============================================================================
// Premium Executive-Search Submission Pack
// Layout inspired by retained-search firm candidate submissions.
// Dark navy + subtle gold/brand accent. One-page priority.
// All scores read from the centralized engine (rediscovered_matches) so the
// number is identical in AI Match, Validation, Submission pack, Client portal.
// ============================================================================

const A4 = { w: 595.28, h: 841.89 };
const MARGIN = 44;

// Palette
const NAVY = rgb(0.05, 0.10, 0.22);          // primary text / headings  ~#0D1A38
const NAVY_SOFT = rgb(0.18, 0.24, 0.38);
const INK = rgb(0.13, 0.14, 0.18);
const MUTED = rgb(0.46, 0.49, 0.56);
const HAIR = rgb(0.85, 0.87, 0.91);
const PANEL = rgb(0.965, 0.972, 0.984);      // very light gray panel
const PANEL_BORDER = rgb(0.90, 0.92, 0.95);

// Status colors (text/border for pills)
const C_EXCEEDS = rgb(0.13, 0.36, 0.72);     // navy blue
const C_STRONG  = rgb(0.10, 0.50, 0.30);     // green
const C_MOD     = rgb(0.70, 0.50, 0.10);     // amber
const C_PARTIAL = rgb(0.75, 0.30, 0.20);     // muted red
const C_EXCEEDS_BG = rgb(0.93, 0.95, 0.99);
const C_STRONG_BG  = rgb(0.92, 0.97, 0.94);
const C_MOD_BG     = rgb(0.99, 0.96, 0.88);
const C_PARTIAL_BG = rgb(0.99, 0.93, 0.91);

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

function tracked(s: string, spacing = "  ") {
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

// Map a normalized 0-1 sub-score to a fit label
function fitLabel(score: number): { label: string; fg: any; bg: any } {
  if (score >= 0.9) return { label: "EXCEEDS", fg: C_EXCEEDS, bg: C_EXCEEDS_BG };
  if (score >= 0.7) return { label: "STRONG", fg: C_STRONG, bg: C_STRONG_BG };
  if (score >= 0.5) return { label: "MODERATE", fg: C_MOD, bg: C_MOD_BG };
  return { label: "PARTIAL", fg: C_PARTIAL, bg: C_PARTIAL_BG };
}

function recommendationLabel(score: number) {
  if (score >= 90) return "Strongly Recommended";
  if (score >= 75) return "Recommended";
  if (score >= 60) return "Moderate Match";
  return "Needs Review";
}

function confidenceLabel(c?: string | null) {
  if (!c) return "—";
  return c.charAt(0).toUpperCase() + c.slice(1) + " confidence";
}

// Always return 200 with { status:'failed', user_message } so the client never sees a raw "non-2xx"
const fail = (user_message: string, internal?: unknown) => {
  if (internal) console.error("[generate-submission-pack]", user_message, internal);
  return new Response(JSON.stringify({ status: "failed", user_message }), {
    status: 200,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  let submissionIdForStatus: string | null = null;
  let adminForStatus: any = null;

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) return fail("Please sign in again to generate this pack.");

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );
    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );
    adminForStatus = admin;

    const { data: userData, error: ue } = await supabase.auth.getUser();
    if (ue || !userData?.user) return fail("Your session has expired. Please sign in again.");
    const userId = userData.user.id;

    const body = await req.json().catch(() => ({} as any));
    const { submission_id, components: reqComponents } = body || {};
    if (!submission_id) return fail("Missing submission reference.");
    submissionIdForStatus = submission_id;

    await admin.from("candidate_submissions").update({
      pack_status: "generating",
      pack_error: null,
      ...(reqComponents ? { pack_components: reqComponents } : {}),
    }).eq("id", submission_id);

    const { data: submission, error: subErr } = await supabase
      .from("candidate_submissions")
      .select("id, tenant_id, job_id, candidate_id, ai_validation_id, submission_message, client_org_id, branded_cv_url, original_cv_url, pack_components, recruiter_summary, recruiter_strengths, recruiter_considerations, recruiter_recommendation")
      .eq("id", submission_id)
      .maybeSingle();
    if (subErr || !submission) {
      await admin.from("candidate_submissions").update({ pack_status: "failed", pack_error: "not found" }).eq("id", submission_id);
      return fail("This submission could not be found. Please refresh and try again.");
    }

    const [
      { data: candidate },
      { data: job },
      { data: validation },
      { data: canonical },
      { data: branding },
      { data: profile },
    ] = await Promise.all([
      supabase.from("candidates").select("full_name, current_title, current_company, location, experience_years, email, phone, skills, summary, work_history, education, linkedin_url, availability, relocation, expected_salary").eq("id", submission.candidate_id).maybeSingle(),
      supabase.from("jobs").select("title, location, employment_type, experience_level, department").eq("id", submission.job_id).maybeSingle(),
      submission.ai_validation_id
        ? supabase.from("ai_candidate_validations").select("*").eq("id", submission.ai_validation_id).maybeSingle()
        : supabase.from("ai_candidate_validations").select("*").eq("job_id", submission.job_id).eq("candidate_id", submission.candidate_id).order("created_at", { ascending: false }).limit(1).maybeSingle(),
      supabase.from("rediscovered_matches").select("match_score, sub_scores, confidence, model_version, strengths, gaps, ai_summary").eq("job_id", submission.job_id).eq("candidate_id", submission.candidate_id).maybeSingle(),
      admin.from("branding_settings").select("logo_url, company_name, primary_color, footer_text").eq("tenant_id", submission.tenant_id).maybeSingle(),
      admin.from("profiles").select("full_name, email, phone").eq("id", userId).maybeSingle(),
    ]);

    if (!candidate || !job) {
      await admin.from("candidate_submissions").update({ pack_status: "failed", pack_error: "candidate/job missing" }).eq("id", submission_id);
      return fail("Candidate or job data is missing. Please check the records.");
    }

    const brand = hexToRgb(branding?.primary_color);
    const companyName = branding?.company_name ?? "";
    const recruiterName = profile?.full_name ?? "";
    const generatedAt = new Date().toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
    const footerLine = `${companyName ? companyName + " · " : ""}Confidential candidate submission · ${generatedAt}`;
    const logo = await fetchImageBytes(admin, branding?.logo_url ?? null);

    const doc = await PDFDocument.create();
    const serif = await doc.embedFont(StandardFonts.TimesRoman);
    const serifB = await doc.embedFont(StandardFonts.TimesRomanBold);
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

    // ===== Centralized score (single source of truth) =====
    const canonicalScore: number | null = canonical?.match_score ?? validation?.fit_score ?? null;
    const sub = (canonical?.sub_scores ?? {}) as any;
    const confidence = canonical?.confidence ?? null;
    const modelVersion = canonical?.model_version ?? "hybrid_v1";

    const drawHeader = (page: PDFPage) => {
      const { width, height } = page.getSize();
      const topY = height - MARGIN;
      // Centered logo (or company name)
      if (logoImg) {
        const maxH = 40, maxW = 160;
        const s = Math.min(maxW / logoImg.width, maxH / logoImg.height, 1);
        const w = logoImg.width * s, h = logoImg.height * s;
        page.drawImage(logoImg, { x: (width - w) / 2, y: topY - h, width: w, height: h });
      } else if (companyName) {
        const t = tracked(companyName);
        const tw = sansB.widthOfTextAtSize(t, 11);
        page.drawText(t, { x: (width - tw) / 2, y: topY - 16, size: 11, font: sansB, color: NAVY });
      }
      // thin brand divider
      page.drawLine({
        start: { x: MARGIN, y: topY - 52 },
        end: { x: width - MARGIN, y: topY - 52 },
        thickness: 0.6, color: brand,
      });
    };

    const drawFooter = (page: PDFPage, num: number, total: number) => {
      const { width } = page.getSize();
      page.drawLine({ start: { x: MARGIN, y: 46 }, end: { x: width - MARGIN, y: 46 }, thickness: 0.4, color: HAIR });
      page.drawText(footerLine, { x: MARGIN, y: 32, size: 8.5, font: sans, color: MUTED });
      const right = `Page ${num} of ${total}`;
      page.drawText(right, { x: width - MARGIN - sans.widthOfTextAtSize(right, 8.5), y: 32, size: 8.5, font: sans, color: MUTED });
    };

    const innerW = A4.w - MARGIN * 2;

    const newPage = (): PDFPage => {
      const p = doc.addPage([A4.w, A4.h]);
      drawHeader(p);
      return p;
    };
    const cur: Cursor = { page: newPage(), y: A4.h - MARGIN - 68 };
    const ensure = (need: number) => {
      if (cur.y - need < 64) { cur.page = newPage(); cur.y = A4.h - MARGIN - 68; }
    };

    const sectionHeading = (label: string) => {
      ensure(28);
      cur.y -= 6;
      cur.page.drawText(tracked(label), {
        x: MARGIN, y: cur.y, size: 9, font: sansB, color: NAVY,
      });
      cur.y -= 8;
      cur.page.drawLine({
        start: { x: MARGIN, y: cur.y }, end: { x: MARGIN + innerW, y: cur.y },
        thickness: 0.4, color: HAIR,
      });
      cur.y -= 10;
    };

    const paragraph = (text: string, size = 9.5, font: PDFFont = serif, color = INK, lh = 13) => {
      const lines = wrap(text, font, size, innerW);
      for (const ln of lines) {
        ensure(lh);
        cur.page.drawText(ln, { x: MARGIN, y: cur.y - size, size, font, color });
        cur.y -= lh;
      }
    };

    // ===== Hero (candidate name) =====
    const name = candidate.full_name ?? "Candidate";
    cur.page.drawText(name, { x: MARGIN, y: cur.y - 26, size: 26, font: serifB, color: NAVY });
    cur.y -= 32;
    const subParts = [
      candidate.current_title,
      candidate.current_company ? `**${candidate.current_company}**` : null,
      candidate.location,
    ].filter(Boolean) as string[];
    if (subParts.length) {
      // Render subline with bold company segment
      let x = MARGIN;
      const size = 10;
      const drawSeg = (txt: string, bold = false) => {
        const f = bold ? sansB : sans;
        cur.page.drawText(txt, { x, y: cur.y - size, size, font: f, color: bold ? NAVY : NAVY_SOFT });
        x += f.widthOfTextAtSize(txt, size);
      };
      subParts.forEach((p, i) => {
        if (i > 0) drawSeg("  ·  ", false);
        if (p.startsWith("**") && p.endsWith("**")) drawSeg(p.slice(2, -2), true);
        else drawSeg(p, false);
      });
      cur.y -= 18;
    }
    // brand underline below hero
    cur.page.drawLine({
      start: { x: MARGIN, y: cur.y }, end: { x: MARGIN + 60, y: cur.y },
      thickness: 1.4, color: brand,
    });
    cur.y -= 14;

    // ===== Top 4-up KPI grid (template-style) =====
    const kpis: Array<{ label: string; value: string }> = [];
    kpis.push({
      label: "Comp Expectation",
      value: candidate.expected_salary ? String(candidate.expected_salary) : "TBD — full package review",
    });
    kpis.push({
      label: "Available",
      value: candidate.availability ? String(candidate.availability) : "On request",
    });
    kpis.push({
      label: "Base / Relocation",
      value: [candidate.location, candidate.relocation ? `Open to ${candidate.relocation}` : null].filter(Boolean).join(" · ") || "—",
    });
    kpis.push({
      label: "Current Role",
      value: [candidate.current_title, candidate.current_company].filter(Boolean).join(" — ") || "—",
    });

    const colW = innerW / kpis.length;
    const kpiH = 56;
    ensure(kpiH + 6);
    const kpiTop = cur.y;
    // Panel background
    cur.page.drawRectangle({ x: MARGIN, y: kpiTop - kpiH, width: innerW, height: kpiH, color: PANEL, borderColor: PANEL_BORDER, borderWidth: 0.5 });
    kpis.forEach((k, i) => {
      const x = MARGIN + i * colW;
      if (i > 0) {
        cur.page.drawLine({ start: { x, y: kpiTop - 8 }, end: { x, y: kpiTop - kpiH + 8 }, thickness: 0.4, color: PANEL_BORDER });
      }
      cur.page.drawText(tracked(k.label), { x: x + 10, y: kpiTop - 16, size: 7, font: sansB, color: MUTED });
      const valLines = wrap(k.value, sansB, 9.5, colW - 20);
      let vy = kpiTop - 30;
      for (const ln of valLines.slice(0, 3)) {
        cur.page.drawText(ln, { x: x + 10, y: vy, size: 9.5, font: sansB, color: NAVY });
        vy -= 12;
      }
    });
    cur.y -= kpiH + 10;

    // ===== Executive narrative paragraph =====
    const narrative = validation?.summary || canonical?.ai_summary || candidate.summary;
    if (narrative) {
      paragraph(String(narrative), 9.5, serif, INK, 13);
      cur.y -= 4;
    }

    // ===== Submitted For (compact strip) =====
    {
      ensure(28);
      const stripH = 22;
      cur.page.drawRectangle({ x: MARGIN, y: cur.y - stripH, width: innerW, height: stripH, color: NAVY });
      const label = tracked("Submitted For");
      cur.page.drawText(label, { x: MARGIN + 10, y: cur.y - 14, size: 7.5, font: sansB, color: rgb(0.75, 0.80, 0.92) });
      const labelW = sansB.widthOfTextAtSize(label, 7.5);
      const jobBits = [job.title, job.experience_level, job.department, job.employment_type, job.location].filter(Boolean).join("  ·  ");
      cur.page.drawText(jobBits, { x: MARGIN + 10 + labelW + 14, y: cur.y - 14, size: 9.5, font: sansB, color: rgb(1, 1, 1) });
      cur.y -= stripH + 10;
    }

    // ===== AI Fit Assessment — premium score block =====
    if (canonicalScore != null) {
      sectionHeading("AI Fit Assessment");
      ensure(64);
      const blockH = 56;
      const blockTop = cur.y;
      cur.page.drawRectangle({ x: MARGIN, y: blockTop - blockH, width: innerW, height: blockH, color: PANEL, borderColor: PANEL_BORDER, borderWidth: 0.5 });

      // Score number (large)
      const scoreTxt = `${canonicalScore}`;
      cur.page.drawText(scoreTxt, { x: MARGIN + 16, y: blockTop - 40, size: 30, font: serifB, color: NAVY });
      cur.page.drawText("/ 100", { x: MARGIN + 16 + serifB.widthOfTextAtSize(scoreTxt, 30) + 4, y: blockTop - 36, size: 11, font: sans, color: MUTED });

      // Recommendation pill
      const reco = recommendationLabel(canonicalScore);
      const recoFit = fitLabel(canonicalScore / 100);
      const pillTxt = reco.toUpperCase();
      const pillW = sansB.widthOfTextAtSize(pillTxt, 8.5) + 18;
      const pillX = MARGIN + 130;
      const pillY = blockTop - 22;
      cur.page.drawRectangle({ x: pillX, y: pillY - 8, width: pillW, height: 16, color: recoFit.bg, borderColor: recoFit.fg, borderWidth: 0.6 });
      cur.page.drawText(pillTxt, { x: pillX + 9, y: pillY - 4, size: 8.5, font: sansB, color: recoFit.fg });

      // Confidence + version line
      const meta = `${confidenceLabel(confidence)}  ·  Centralized scoring engine · ${modelVersion}`;
      cur.page.drawText(meta, { x: MARGIN + 130, y: blockTop - 38, size: 8.5, font: sans, color: MUTED });

      // Progress bar
      const barX = MARGIN + 130, barY = blockTop - 48, barW = innerW - 130 - 16;
      cur.page.drawRectangle({ x: barX, y: barY, width: barW, height: 4, color: rgb(0.90, 0.92, 0.95) });
      cur.page.drawRectangle({ x: barX, y: barY, width: barW * Math.min(1, Math.max(0, canonicalScore / 100)), height: 4, color: brand });

      cur.y -= blockH + 10;
    }

    // ===== Fit Assessment vs Job Description — table =====
    const rows: Array<{ req: string; evidence: string; fit: number }> = [];
    if (sub && Object.keys(sub).length) {
      const techScore = (typeof sub.skills === "number" ? sub.skills : 0.5);
      const matched: string[] = Array.isArray(canonical?.strengths) ? (canonical?.strengths as string[]) : [];
      const evidenceSkills = matched.length
        ? matched.slice(0, 3).join(", ")
        : (Array.isArray(candidate.skills) ? (candidate.skills as string[]).slice(0, 5).join(", ") : "Skills overlap with JD");
      rows.push({ req: "Technical / skills match", evidence: evidenceSkills, fit: techScore });

      const roleScore = (typeof sub.role === "number" ? sub.role : 0.5);
      const roleEv = candidate.current_title ? `Current role: ${candidate.current_title}` : (sub.candidate_family ?? "Role family aligned with JD");
      rows.push({ req: "Role / function alignment", evidence: roleEv, fit: roleScore });

      const seniorScore = (typeof sub.seniority === "number" ? sub.seniority : 0.5);
      rows.push({ req: "Seniority level", evidence: candidate.current_title ?? (job.experience_level ?? "Level inferred from history"), fit: seniorScore });

      const expScore = (typeof sub.experience === "number" ? sub.experience : 0.5);
      rows.push({ req: "Years of experience", evidence: candidate.experience_years != null ? `${candidate.experience_years}+ years` : "Experience evaluated from CV", fit: expScore });

      const locScore = (typeof sub.location === "number" ? sub.location : 0.5);
      rows.push({ req: "Location / mobility", evidence: [candidate.location, candidate.relocation ? `open to ${candidate.relocation}` : null].filter(Boolean).join(" — ") || "—", fit: locScore });

      const indScore = (typeof sub.industry === "number" ? sub.industry : 0.5);
      rows.push({ req: "Industry / domain", evidence: candidate.current_company ? `Experience at ${candidate.current_company}` : "Domain evaluated from CV", fit: indScore });
    }

    if (rows.length) {
      sectionHeading("Fit Assessment vs Job Description");
      const cReq = 145, cFit = 70;
      const cEv = innerW - cReq - cFit;
      // Header row
      ensure(22);
      cur.page.drawRectangle({ x: MARGIN, y: cur.y - 18, width: innerW, height: 18, color: NAVY });
      cur.page.drawText("Requirement", { x: MARGIN + 10, y: cur.y - 12, size: 8.5, font: sansB, color: rgb(1, 1, 1) });
      cur.page.drawText("Candidate Evidence", { x: MARGIN + cReq + 10, y: cur.y - 12, size: 8.5, font: sansB, color: rgb(1, 1, 1) });
      cur.page.drawText("Fit", { x: MARGIN + cReq + cEv + 10, y: cur.y - 12, size: 8.5, font: sansB, color: rgb(1, 1, 1) });
      cur.y -= 18;

      for (const r of rows) {
        const evLines = wrap(r.evidence, serif, 9, cEv - 20);
        const reqLines = wrap(r.req, sansB, 9, cReq - 20);
        const rowH = Math.max(26, Math.max(evLines.length, reqLines.length) * 12 + 10);
        ensure(rowH + 2);
        // bottom border
        cur.page.drawLine({ start: { x: MARGIN, y: cur.y - rowH }, end: { x: MARGIN + innerW, y: cur.y - rowH }, thickness: 0.3, color: HAIR });
        // requirement
        let ry = cur.y - 14;
        for (const ln of reqLines) {
          cur.page.drawText(ln, { x: MARGIN + 10, y: ry, size: 9, font: sansB, color: NAVY });
          ry -= 12;
        }
        // evidence
        let ey = cur.y - 14;
        for (const ln of evLines) {
          cur.page.drawText(ln, { x: MARGIN + cReq + 10, y: ey, size: 9, font: serif, color: INK });
          ey -= 12;
        }
        // fit pill
        const f = fitLabel(r.fit);
        const pillW = sansB.widthOfTextAtSize(f.label, 8) + 14;
        const px = MARGIN + cReq + cEv + (cFit - pillW) / 2;
        const py = cur.y - rowH / 2 - 7;
        cur.page.drawRectangle({ x: px, y: py, width: pillW, height: 14, color: f.bg, borderColor: f.fg, borderWidth: 0.6 });
        cur.page.drawText(f.label, { x: px + 7, y: py + 4, size: 8, font: sansB, color: f.fg });
        cur.y -= rowH;
      }
      cur.y -= 6;
    }

    // ===== Two-column Strengths / Considerations =====
    const strengths = (validation?.strengths as string[]) || (canonical?.strengths as string[]) || [];
    const weaknesses = (validation?.weaknesses as string[]) || (canonical?.gaps as string[]) || [];
    const risks = (validation?.risks as string[]) || [];
    const considerations = [...weaknesses, ...risks];

    if (strengths.length || considerations.length) {
      ensure(28);
      const gap = 18;
      const colWidth = (innerW - gap) / 2;

      // Two-column headings
      cur.page.drawText(tracked("Key Strengths"), { x: MARGIN, y: cur.y, size: 9, font: sansB, color: NAVY });
      cur.page.drawText(tracked("Considerations"), { x: MARGIN + colWidth + gap, y: cur.y, size: 9, font: sansB, color: NAVY });
      cur.y -= 8;
      cur.page.drawLine({ start: { x: MARGIN, y: cur.y }, end: { x: MARGIN + colWidth, y: cur.y }, thickness: 0.4, color: HAIR });
      cur.page.drawLine({ start: { x: MARGIN + colWidth + gap, y: cur.y }, end: { x: MARGIN + innerW, y: cur.y }, thickness: 0.4, color: HAIR });
      cur.y -= 10;

      const bulletInto = (items: string[], x: number, width: number): number => {
        let y = cur.y;
        const dotW = 8;
        for (const item of items.slice(0, 6)) {
          const m = String(item).match(/^([^—:\-]{2,40})\s*[—:\-]\s*(.+)$/);
          const lead = m ? m[1].trim() : "";
          const rest = m ? m[2] : String(item);
          // Build lines: bold lead + rest
          const restMax = width - dotW;
          const leadStr = lead ? `${lead} — ` : "";
          const leadW = leadStr ? sansB.widthOfTextAtSize(leadStr, 9) : 0;
          const firstLineMax = restMax - leadW;
          const lines = wrap(rest, serif, 9, firstLineMax);
          // bullet dot
          if (y - 14 < 64) break;
          cur.page.drawText("•", { x, y: y - 10, size: 10, font: sansB, color: brand });
          if (leadStr) cur.page.drawText(leadStr, { x: x + dotW, y: y - 10, size: 9, font: sansB, color: NAVY });
          if (lines[0]) cur.page.drawText(lines[0], { x: x + dotW + leadW, y: y - 10, size: 9, font: serif, color: INK });
          y -= 12;
          for (let i = 1; i < lines.length; i++) {
            if (y - 12 < 64) break;
            cur.page.drawText(lines[i], { x: x + dotW, y: y - 10, size: 9, font: serif, color: INK });
            y -= 12;
          }
          y -= 3;
        }
        return y;
      };

      const startY = cur.y;
      const leftEndY = bulletInto(strengths.length ? strengths : ["Strong alignment with role requirements"], MARGIN, colWidth);
      cur.y = startY;
      const rightEndY = bulletInto(considerations.length ? considerations : ["No material concerns identified"], MARGIN + colWidth + gap, colWidth);
      cur.y = Math.min(leftEndY, rightEndY) - 4;
    }

    // ===== Recruiter View =====
    sectionHeading("Recruiter View");
    const recView = submission.submission_message
      || (canonicalScore != null
        ? `${candidate.full_name?.split(" ")[0] ?? "This candidate"} ${canonicalScore >= 75 ? "demonstrates strong" : canonicalScore >= 60 ? "shows reasonable" : "shows partial"} alignment with the ${job.title ?? "role"} requirements and is ${canonicalScore >= 75 ? "recommended for client screening" : canonicalScore >= 60 ? "worth a screening conversation" : "submitted for the client's review"}.`
        : "Submitted for client review.");
    paragraph(recView, 9.5, serif, INK, 13);

    // Recruiter signature footer
    if (recruiterName) {
      cur.y -= 6;
      ensure(14);
      cur.page.drawText(`Submitted by ${recruiterName}${companyName ? " · " + companyName : ""}`, {
        x: MARGIN, y: cur.y - 10, size: 8.5, font: sans, color: MUTED,
      });
      cur.y -= 12;
    }

    // ===== Footers =====
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

    try {
      await admin.from("submission_activity").insert({
        submission_id: submission.id,
        tenant_id: submission.tenant_id,
        client_org_id: submission.client_org_id ?? null,
        actor_user_id: userId,
        actor_type: "recruiter",
        event_type: "pack_generated",
        metadata: { path },
      });
    } catch (e) {
      console.error("activity log failed (non-blocking)", e);
    }

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
