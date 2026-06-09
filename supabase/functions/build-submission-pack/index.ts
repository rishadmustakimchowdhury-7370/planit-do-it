// Build a downloadable Submission Pack PDF from an approved Client Submission Report.
// Options:
//   A = AI Report PDF only
//   B = Original CV + AI Report PDF (CV merged if it's a PDF)
//   C = Branded CV cover + AI Report PDF + original CV
//
// Stores the file in the `submission-packs` storage bucket and records history
// in `client_submission_pack_files`. No email delivery in this phase.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { PDFDocument, PDFFont, PDFPage, rgb, StandardFonts } from "https://esm.sh/pdf-lib@1.17.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

const A4 = { w: 595.28, h: 841.89 };
const MARGIN = 48;

const INK = rgb(0.13, 0.14, 0.18);
const MUTED = rgb(0.46, 0.49, 0.56);
const HAIR = rgb(0.86, 0.88, 0.92);
const WHITE = rgb(1, 1, 1);
const PANEL = rgb(0.96, 0.97, 0.98);

const FIT_COLOR: Record<string, [number, number, number]> = {
  STRONG: [0.10, 0.50, 0.30],
  GOOD: [0.18, 0.55, 0.35],
  PARTIAL: [0.70, 0.50, 0.10],
  WEAK: [0.75, 0.30, 0.20],
  MISSING: [0.70, 0.20, 0.20],
};

function hexToRgb(hex?: string | null, fb = rgb(0.118, 0.251, 0.686)) {
  if (!hex) return fb;
  const m = hex.replace("#", "");
  const n = parseInt(m.length === 3 ? m.split("").map(c => c + c).join("") : m, 16);
  if (isNaN(n)) return fb;
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

async function fetchBytes(url?: string | null): Promise<{ bytes: Uint8Array; mime: string } | null> {
  if (!url) return null;
  try {
    const r = await fetch(url);
    if (!r.ok) return null;
    return { bytes: new Uint8Array(await r.arrayBuffer()), mime: r.headers.get("content-type") || "" };
  } catch { return null; }
}

async function embedLogo(pdf: PDFDocument, url?: string | null) {
  if (!url) return null;
  const clean = url.split("?")[0].toLowerCase();
  if (clean.endsWith(".svg")) return null;
  const data = await fetchBytes(url);
  if (!data) return null;
  try {
    if (clean.endsWith(".png") || data.mime.includes("png")) return await pdf.embedPng(data.bytes);
    return await pdf.embedJpg(data.bytes);
  } catch { return null; }
}

interface Ctx {
  pdf: PDFDocument;
  page: PDFPage;
  y: number;
  fonts: { reg: PDFFont; bold: PDFFont; italic: PDFFont };
  brandColor: ReturnType<typeof rgb>;
  branding: any;
  reportTitle: string;
  pageNumberStart: number;
}

function newPage(ctx: Ctx) {
  ctx.page = ctx.pdf.addPage([A4.w, A4.h]);
  drawHeader(ctx);
  ctx.y = A4.h - 110;
}

async function drawLogo(ctx: Ctx) {
  const logo = await embedLogo(ctx.pdf, ctx.branding?.logo_url);
  if (logo) {
    const maxH = 32;
    const scale = maxH / logo.height;
    const w = Math.min(logo.width * scale, 160);
    ctx.page.drawImage(logo, { x: MARGIN, y: A4.h - 50, width: w, height: maxH });
  } else if (ctx.branding?.company_name) {
    ctx.page.drawText(ctx.branding.company_name, {
      x: MARGIN, y: A4.h - 38, size: 14, font: ctx.fonts.bold, color: ctx.brandColor,
    });
  }
}

function drawHeader(ctx: Ctx) {
  // brand color band
  ctx.page.drawRectangle({ x: 0, y: A4.h - 6, width: A4.w, height: 6, color: ctx.brandColor });
  // confidential pill
  ctx.page.drawText("CONFIDENTIAL", {
    x: A4.w - MARGIN - 80, y: A4.h - 32, size: 9, font: ctx.fonts.bold, color: rgb(0.7, 0.15, 0.15),
  });
  // hairline
  ctx.page.drawLine({
    start: { x: MARGIN, y: A4.h - 60 }, end: { x: A4.w - MARGIN, y: A4.h - 60 },
    thickness: 0.5, color: HAIR,
  });
  ctx.page.drawText(ctx.reportTitle, {
    x: MARGIN, y: A4.h - 78, size: 10, font: ctx.fonts.reg, color: MUTED,
  });
}

function ensureSpace(ctx: Ctx, h: number) {
  if (ctx.y - h < 60) newPage(ctx);
}

function drawSectionTitle(ctx: Ctx, label: string) {
  ensureSpace(ctx, 28);
  ctx.page.drawText(label.toUpperCase(), {
    x: MARGIN, y: ctx.y, size: 10, font: ctx.fonts.bold, color: ctx.brandColor,
  });
  ctx.page.drawLine({
    start: { x: MARGIN, y: ctx.y - 4 }, end: { x: A4.w - MARGIN, y: ctx.y - 4 },
    thickness: 0.5, color: HAIR,
  });
  ctx.y -= 18;
}

function drawParagraph(ctx: Ctx, text: string, size = 10) {
  const lines = wrap(text, ctx.fonts.reg, size, A4.w - 2 * MARGIN);
  const lh = size * 1.45;
  for (const line of lines) {
    ensureSpace(ctx, lh);
    ctx.page.drawText(line, { x: MARGIN, y: ctx.y, size, font: ctx.fonts.reg, color: INK });
    ctx.y -= lh;
  }
}

function drawKV(ctx: Ctx, label: string, value: string) {
  ensureSpace(ctx, 30);
  ctx.page.drawText(label.toUpperCase(), {
    x: MARGIN, y: ctx.y, size: 7.5, font: ctx.fonts.bold, color: MUTED,
  });
  ctx.y -= 10;
  const lines = wrap(value || "—", ctx.fonts.reg, 10, A4.w - 2 * MARGIN);
  for (const ln of lines) {
    ensureSpace(ctx, 13);
    ctx.page.drawText(ln, { x: MARGIN, y: ctx.y, size: 10, font: ctx.fonts.reg, color: INK });
    ctx.y -= 13;
  }
  ctx.y -= 4;
}

function drawBullets(ctx: Ctx, items: string[]) {
  for (const it of items || []) {
    const lines = wrap(it, ctx.fonts.reg, 10, A4.w - 2 * MARGIN - 14);
    let first = true;
    const lh = 14;
    for (const ln of lines) {
      ensureSpace(ctx, lh);
      if (first) {
        ctx.page.drawText("•", { x: MARGIN, y: ctx.y, size: 11, font: ctx.fonts.bold, color: ctx.brandColor });
        first = false;
      }
      ctx.page.drawText(ln, { x: MARGIN + 12, y: ctx.y, size: 10, font: ctx.fonts.reg, color: INK });
      ctx.y -= lh;
    }
    ctx.y -= 2;
  }
}

function drawFitTable(ctx: Ctx, rows: any[]) {
  if (!rows?.length) return;
  const colReqW = 160;
  const colFitW = 70;
  const colEvW = A4.w - 2 * MARGIN - colReqW - colFitW - 16;
  // Header row
  ensureSpace(ctx, 22);
  ctx.page.drawRectangle({
    x: MARGIN, y: ctx.y - 14, width: A4.w - 2 * MARGIN, height: 18, color: PANEL,
  });
  ctx.page.drawText("REQUIREMENT", { x: MARGIN + 6, y: ctx.y - 9, size: 8, font: ctx.fonts.bold, color: MUTED });
  ctx.page.drawText("EVIDENCE", { x: MARGIN + colReqW + 14, y: ctx.y - 9, size: 8, font: ctx.fonts.bold, color: MUTED });
  ctx.page.drawText("FIT", { x: A4.w - MARGIN - colFitW + 8, y: ctx.y - 9, size: 8, font: ctx.fonts.bold, color: MUTED });
  ctx.y -= 22;

  for (const r of rows) {
    const reqLines = wrap(r.requirement || "", ctx.fonts.bold, 9.5, colReqW - 8);
    const evLines = wrap(r.evidence || "—", ctx.fonts.reg, 9.5, colEvW);
    const rowH = Math.max(reqLines.length, evLines.length, 1) * 12 + 10;
    ensureSpace(ctx, rowH);
    const top = ctx.y;
    // separator
    ctx.page.drawLine({
      start: { x: MARGIN, y: top + 2 }, end: { x: A4.w - MARGIN, y: top + 2 },
      thickness: 0.5, color: HAIR,
    });
    reqLines.forEach((ln, i) => {
      ctx.page.drawText(ln, { x: MARGIN + 6, y: top - 10 - i * 12, size: 9.5, font: ctx.fonts.bold, color: INK });
    });
    evLines.forEach((ln, i) => {
      ctx.page.drawText(ln, { x: MARGIN + colReqW + 14, y: top - 10 - i * 12, size: 9.5, font: ctx.fonts.reg, color: INK });
    });
    const fitLabel = (r.fit || "PARTIAL").toUpperCase();
    const fc = FIT_COLOR[fitLabel] ?? FIT_COLOR.PARTIAL;
    const fitX = A4.w - MARGIN - colFitW + 4;
    ctx.page.drawRectangle({
      x: fitX, y: top - 14, width: colFitW - 8, height: 14,
      color: rgb(fc[0], fc[1], fc[2]), opacity: 0.15,
      borderColor: rgb(fc[0], fc[1], fc[2]), borderWidth: 0.6,
    });
    const tw = ctx.fonts.bold.widthOfTextAtSize(fitLabel, 8);
    ctx.page.drawText(fitLabel, {
      x: fitX + (colFitW - 8 - tw) / 2, y: top - 10,
      size: 8, font: ctx.fonts.bold, color: rgb(fc[0], fc[1], fc[2]),
    });
    ctx.y -= rowH;
  }
  ctx.y -= 4;
}

async function buildReportPdf(report: any, branding: any, reportTitle: string): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  const reg = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const italic = await pdf.embedFont(StandardFonts.HelveticaOblique);
  const brandColor = hexToRgb(branding?.primary_color);

  const ctx: Ctx = {
    pdf,
    page: pdf.addPage([A4.w, A4.h]),
    y: A4.h - 110,
    fonts: { reg, bold, italic },
    brandColor, branding, reportTitle, pageNumberStart: 1,
  };
  drawHeader(ctx);
  await drawLogo(ctx);

  // Title block
  const h = report.header ?? {};
  ctx.page.drawText("Client Submission Report", {
    x: MARGIN, y: ctx.y, size: 18, font: bold, color: INK,
  });
  ctx.y -= 22;
  ctx.page.drawText((h.anonymous ? "Confidential Candidate" : (h.candidate_name || "—")), {
    x: MARGIN, y: ctx.y, size: 14, font: bold, color: brandColor,
  });
  ctx.y -= 16;
  ctx.page.drawText(`Position: ${h.position || "—"}`, {
    x: MARGIN, y: ctx.y, size: 10, font: reg, color: MUTED,
  });
  ctx.y -= 24;

  // Snapshot — 2 columns
  drawSectionTitle(ctx, "Candidate Snapshot");
  const snap = report.snapshot ?? {};
  const snapItems: [string, string][] = [
    ["Compensation Expectation", snap.compensation_expectation],
    ["Availability", snap.availability],
    ["Nationality", snap.nationality],
    ["Current Location", snap.current_location],
    ["Current Employer", snap.current_employer],
    ["Current Position", snap.current_position],
  ];
  const colW = (A4.w - 2 * MARGIN - 16) / 2;
  for (let i = 0; i < snapItems.length; i += 2) {
    const left = snapItems[i];
    const right = snapItems[i + 1];
    ensureSpace(ctx, 36);
    const yStart = ctx.y;
    const drawCell = (x: number, label: string, val: string) => {
      ctx.page.drawText(label.toUpperCase(), { x, y: yStart, size: 7.5, font: bold, color: MUTED });
      const lines = wrap(val || "—", reg, 10, colW);
      lines.slice(0, 2).forEach((ln, i2) => {
        ctx.page.drawText(ln, { x, y: yStart - 12 - i2 * 12, size: 10, font: reg, color: INK });
      });
    };
    drawCell(MARGIN, left[0], left[1] ?? "");
    if (right) drawCell(MARGIN + colW + 16, right[0], right[1] ?? "");
    ctx.y -= 36;
  }
  ctx.y -= 4;

  // Executive Summary
  drawSectionTitle(ctx, "Executive Summary");
  drawParagraph(ctx, report.executive_summary || "—");
  ctx.y -= 6;

  // Fit assessment
  drawSectionTitle(ctx, "Fit Assessment vs Job Description");
  drawFitTable(ctx, report.fit_assessment ?? []);

  // Strengths
  drawSectionTitle(ctx, "Key Strengths");
  drawBullets(ctx, report.key_strengths ?? []);
  ctx.y -= 4;

  // Considerations
  drawSectionTitle(ctx, "Considerations");
  drawBullets(ctx, report.considerations ?? []);
  ctx.y -= 4;

  // Recruiter Notes
  drawSectionTitle(ctx, "Recruiter Notes");
  drawParagraph(ctx, report.recruiter_notes || "—");
  ctx.y -= 6;

  // Recommendation
  drawSectionTitle(ctx, "Recommendation");
  const rec = report.recommendation ?? {};
  ensureSpace(ctx, 32);
  const tier = (rec.tier || "Consider").toString();
  const pillW = bold.widthOfTextAtSize(tier, 11) + 22;
  ctx.page.drawRectangle({
    x: MARGIN, y: ctx.y - 16, width: pillW, height: 22, color: brandColor, opacity: 0.12,
    borderColor: brandColor, borderWidth: 0.6,
  });
  ctx.page.drawText(tier, { x: MARGIN + 11, y: ctx.y - 10, size: 11, font: bold, color: brandColor });
  ctx.y -= 28;
  drawParagraph(ctx, rec.reasoning || "—");

  // Footer w/ page numbers
  finalizePageNumbers(pdf, branding, reg);
  return await pdf.save();
}

function finalizePageNumbers(pdf: PDFDocument, branding: any, font: PDFFont) {
  const total = pdf.getPageCount();
  for (let i = 0; i < total; i++) {
    const p = pdf.getPage(i);
    p.drawLine({
      start: { x: MARGIN, y: 36 }, end: { x: A4.w - MARGIN, y: 36 },
      thickness: 0.5, color: HAIR,
    });
    const left = branding?.footer_text || branding?.company_name || "";
    if (left) p.drawText(String(left), { x: MARGIN, y: 22, size: 8, font, color: MUTED });
    const txt = `Page ${i + 1} of ${total}`;
    const w = font.widthOfTextAtSize(txt, 8);
    p.drawText(txt, { x: A4.w - MARGIN - w, y: 22, size: 8, font, color: MUTED });
  }
}

async function buildBrandedCvCover(branding: any, candidateName: string, position: string): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  const reg = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const brandColor = hexToRgb(branding?.primary_color);
  const page = pdf.addPage([A4.w, A4.h]);

  page.drawRectangle({ x: 0, y: A4.h - 6, width: A4.w, height: 6, color: brandColor });
  const logo = await embedLogo(pdf, branding?.logo_url);
  if (logo) {
    const maxH = 60;
    const scale = maxH / logo.height;
    const w = Math.min(logo.width * scale, 240);
    page.drawImage(logo, { x: (A4.w - w) / 2, y: A4.h - 180, width: w, height: maxH });
  } else if (branding?.company_name) {
    const t = branding.company_name;
    const tw = bold.widthOfTextAtSize(t, 22);
    page.drawText(t, { x: (A4.w - tw) / 2, y: A4.h - 150, size: 22, font: bold, color: brandColor });
  }

  const subtitle = "Candidate Profile — Curriculum Vitae";
  const sw = reg.widthOfTextAtSize(subtitle, 12);
  page.drawText(subtitle, { x: (A4.w - sw) / 2, y: A4.h - 230, size: 12, font: reg, color: MUTED });

  const nm = candidateName || "Confidential Candidate";
  const nmw = bold.widthOfTextAtSize(nm, 28);
  page.drawText(nm, { x: (A4.w - nmw) / 2, y: A4.h - 320, size: 28, font: bold, color: INK });

  const ps = `Position: ${position || "—"}`;
  const pw = reg.widthOfTextAtSize(ps, 12);
  page.drawText(ps, { x: (A4.w - pw) / 2, y: A4.h - 350, size: 12, font: reg, color: MUTED });

  const conf = "CONFIDENTIAL";
  const cw = bold.widthOfTextAtSize(conf, 10);
  page.drawText(conf, { x: (A4.w - cw) / 2, y: 80, size: 10, font: bold, color: rgb(0.7, 0.15, 0.15) });
  if (branding?.footer_text) {
    const ft = String(branding.footer_text);
    const ftw = reg.widthOfTextAtSize(ft, 9);
    page.drawText(ft, { x: (A4.w - ftw) / 2, y: 60, size: 9, font: reg, color: MUTED });
  }

  return await pdf.save();
}

async function tryFetchCvPdf(supa: any, candidate: any): Promise<Uint8Array | null> {
  const url = candidate?.cv_file_url;
  if (!url) return null;
  // Storage URL detection
  const m = url.split("?")[0].match(/\/storage\/v1\/object\/(?:public|sign)\/([^/]+)\/(.+)$/);
  let bytes: Uint8Array | null = null;
  let mime = "";
  if (m) {
    const { data } = await supa.storage.from(m[1]).download(decodeURIComponent(m[2]));
    if (data) {
      bytes = new Uint8Array(await data.arrayBuffer());
      mime = data.type || "";
    }
  } else {
    const r = await fetchBytes(url);
    if (r) { bytes = r.bytes; mime = r.mime; }
  }
  if (!bytes) return null;
  // Sniff PDF magic
  if (bytes.length >= 4 && bytes[0] === 0x25 && bytes[1] === 0x50 && bytes[2] === 0x44 && bytes[3] === 0x46) return bytes;
  if (mime.includes("pdf")) return bytes;
  return null;
}

async function mergePdfs(parts: Uint8Array[]): Promise<Uint8Array> {
  const out = await PDFDocument.create();
  for (const p of parts) {
    try {
      const src = await PDFDocument.load(p, { ignoreEncryption: true });
      const pages = await out.copyPages(src, src.getPageIndices());
      pages.forEach((pg) => out.addPage(pg));
    } catch (e) {
      console.warn("merge skip", e);
    }
  }
  return await out.save();
}

function jsonR(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status, headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const authHeader = req.headers.get("Authorization") ?? "";
    if (!authHeader.startsWith("Bearer ")) return jsonR({ error: "Unauthorized" }, 401);
    const userClient = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) return jsonR({ error: "Unauthorized" }, 401);

    const { report_id, pack_option, watermark } = await req.json();
    if (!report_id || !["A", "B", "C"].includes(pack_option)) {
      return jsonR({ error: "report_id and pack_option (A|B|C) required" }, 400);
    }
    const wantWatermark = watermark === true;

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE);

    const { data: report, error: rErr } = await admin
      .from("client_submission_reports").select("*").eq("id", report_id).maybeSingle();
    if (rErr || !report) return jsonR({ error: "Report not found" }, 404);

    const [{ data: candidate }, { data: job }, { data: branding }] = await Promise.all([
      admin.from("candidates").select("*").eq("id", report.candidate_id).maybeSingle(),
      admin.from("jobs").select("title").eq("id", report.job_id).maybeSingle(),
      admin.from("branding_settings").select("*").eq("tenant_id", report.tenant_id).maybeSingle(),
    ]);

    const brand = { ...(branding ?? {}), ...(report.report_data?.branding ?? {}) };
    const candidateName = report.report_data?.header?.anonymous
      ? "Confidential Candidate"
      : (candidate?.full_name ?? "Candidate");
    const position = job?.title ?? report.report_data?.header?.position ?? "";

    const reportTitle = `${brand.company_name || "Agency"} — Client Submission v${report.version}`;
    const reportPdf = await buildReportPdf(report.report_data, brand, reportTitle);

    const parts: Uint8Array[] = [];
    if (pack_option === "C") {
      parts.push(await buildBrandedCvCover(brand, candidateName, position));
    }
    if (pack_option === "B" || pack_option === "C") {
      const cv = await tryFetchCvPdf(admin, candidate);
      if (cv) parts.push(cv);
    }
    parts.push(reportPdf);

    const finalPdf = parts.length === 1 ? parts[0] : await mergePdfs(parts);

    // Re-stamp page numbers across the merged document for clean numbering
    const restamped = await restampPageNumbers(finalPdf, brand, wantWatermark);

    const safeName = String(candidateName).replace(/[^a-z0-9]+/gi, "-").toLowerCase();
    const fileName = `submission-${safeName}-v${report.version}-${pack_option}.pdf`;
    const storagePath = `${report.tenant_id}/${report.job_id}/${report.candidate_id}/${Date.now()}-${fileName}`;

    const { error: upErr } = await admin.storage.from("submission-packs").upload(storagePath, restamped, {
      contentType: "application/pdf", upsert: false,
    });
    if (upErr) return jsonR({ error: `Upload failed: ${upErr.message}` }, 500);

    const { data: inserted, error: insErr } = await admin.from("client_submission_pack_files").insert({
      tenant_id: report.tenant_id, report_id: report.id,
      job_id: report.job_id, candidate_id: report.candidate_id, recruiter_id: user.id,
      pack_option, storage_path: storagePath, file_name: fileName, file_size: restamped.byteLength,
      status: "ready",
    }).select("*").single();
    if (insErr) return jsonR({ error: insErr.message }, 500);

    const { data: signed } = await admin.storage.from("submission-packs")
      .createSignedUrl(storagePath, 3600);

    return jsonR({ pack: inserted, download_url: signed?.signedUrl ?? null });
  } catch (e) {
    console.error(e);
    return jsonR({ error: e instanceof Error ? e.message : String(e) }, 500);
  }
});

async function restampPageNumbers(bytes: Uint8Array, branding: any): Promise<Uint8Array> {
  const pdf = await PDFDocument.load(bytes);
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const total = pdf.getPageCount();
  for (let i = 0; i < total; i++) {
    const p = pdf.getPage(i);
    const { width } = p.getSize();
    const left = branding?.footer_text || branding?.company_name || "";
    if (left) {
      p.drawRectangle({ x: 0, y: 0, width, height: 32, color: WHITE });
      p.drawLine({ start: { x: MARGIN, y: 30 }, end: { x: width - MARGIN, y: 30 }, thickness: 0.4, color: HAIR });
      p.drawText(String(left), { x: MARGIN, y: 14, size: 8, font, color: MUTED });
    }
    const txt = `Page ${i + 1} of ${total}`;
    const w = font.widthOfTextAtSize(txt, 8);
    p.drawText(txt, { x: width - MARGIN - w, y: 14, size: 8, font, color: MUTED });
  }
  return await pdf.save();
}
