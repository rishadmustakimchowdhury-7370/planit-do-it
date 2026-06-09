// Build a downloadable Submission Pack PDF from an approved Client Submission Report.
// Options:
//   A = AI Report PDF only
//   B = Original CV + AI Report PDF (CV merged if it's a PDF)
//   C = Branded CV cover + AI Report PDF + original CV
//
// Stores the file in the `submission-packs` storage bucket and records history
// in `client_submission_pack_files`. No email delivery in this phase.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { PDFDocument, PDFFont, PDFPage, rgb, StandardFonts, degrees } from "https://esm.sh/pdf-lib@1.17.1";

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

type LogoStatus = "ok" | "missing" | "svg_unsupported" | "fetch_failed" | "decode_failed";

async function embedLogoDiag(
  pdf: PDFDocument, url?: string | null,
): Promise<{ image: any | null; status: LogoStatus; reason: string }> {
  if (!url) return { image: null, status: "missing", reason: "logo_url is empty" };
  const clean = url.split("?")[0].toLowerCase();
  if (clean.endsWith(".svg")) return { image: null, status: "svg_unsupported", reason: "SVG logos cannot be embedded in PDF (export PNG/JPG)" };
  const data = await fetchBytes(url);
  if (!data) return { image: null, status: "fetch_failed", reason: "Could not download logo at resolved URL" };
  try {
    const img = (clean.endsWith(".png") || data.mime.includes("png"))
      ? await pdf.embedPng(data.bytes)
      : await pdf.embedJpg(data.bytes);
    return { image: img, status: "ok", reason: "embedded successfully" };
  } catch (e) {
    return { image: null, status: "decode_failed", reason: `decode error: ${(e as Error).message}` };
  }
}
async function embedLogo(pdf: PDFDocument, url?: string | null) {
  return (await embedLogoDiag(pdf, url)).image;
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
  logoImage: any | null;
  headerMeta?: { candidateName?: string; position?: string; dateStr?: string };
  pageIndex: number;
}

function newPage(ctx: Ctx) {
  ctx.page = ctx.pdf.addPage([A4.w, A4.h]);
  ctx.pageIndex++;
  drawHeader(ctx);
  // Page 1 leaves room for the big logo+confidential block. Continuation
  // pages are minimal — start near the top of the page.
  ctx.y = ctx.pageIndex === 0 ? A4.h - 96 : A4.h - MARGIN;
}

function drawHeader(ctx: Ctx) {
  // Continuation pages: NO logo, NO agency name, NO branding banner.
  // The minimal footer (candidate | position | page x of y) is added at finalize time.
  if (ctx.pageIndex > 0) return;

  // === PAGE 1 ONLY: premium executive-search header ===
  // Logo on the left (logo only — no agency name beside it).
  if (ctx.logoImage) {
    const maxH = 44;
    const scale = maxH / ctx.logoImage.height;
    const w = Math.min(ctx.logoImage.width * scale, 180);
    ctx.page.drawImage(ctx.logoImage, { x: MARGIN, y: A4.h - 60, width: w, height: maxH });
  } else {
    ctx.page.drawText("No agency logo configured", {
      x: MARGIN, y: A4.h - 38, size: 9, font: ctx.fonts.italic, color: rgb(0.72, 0.22, 0.22),
    });
  }

  // Right side: "Candidate Report" + "CONFIDENTIAL"
  const title = "Candidate Report";
  const tw = ctx.fonts.bold.widthOfTextAtSize(title, 12);
  ctx.page.drawText(title, {
    x: A4.w - MARGIN - tw, y: A4.h - 34, size: 12, font: ctx.fonts.bold, color: INK,
  });
  const conf = "CONFIDENTIAL";
  const cw = ctx.fonts.bold.widthOfTextAtSize(conf, 9);
  ctx.page.drawText(conf, {
    x: A4.w - MARGIN - cw, y: A4.h - 48, size: 9, font: ctx.fonts.bold, color: rgb(0.72, 0.15, 0.15),
  });

  // hairline
  ctx.page.drawLine({
    start: { x: MARGIN, y: A4.h - 70 }, end: { x: A4.w - MARGIN, y: A4.h - 70 },
    thickness: 0.5, color: HAIR,
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

async function buildReportPdf(
  report: any,
  branding: any,
  reportTitle: string,
  diag?: { logo_status: LogoStatus; logo_reason: string },
): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  const reg = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const italic = await pdf.embedFont(StandardFonts.HelveticaOblique);
  const brandColor = hexToRgb(branding?.primary_color);
  const logoEmbed = await embedLogoDiag(pdf, branding?.logo_url);
  if (diag) { diag.logo_status = logoEmbed.status; diag.logo_reason = logoEmbed.reason; }

  const h = report.header ?? {};
  const candidateName = h.anonymous ? "Confidential Candidate" : (h.candidate_name || "—");
  const position = h.position || "—";
  const dateStr = new Date().toLocaleDateString("en-GB", { day: "2-digit", month: "long", year: "numeric" });

  const ctx: Ctx = {
    pdf,
    page: pdf.addPage([A4.w, A4.h]),
    y: A4.h - 96,
    fonts: { reg, bold, italic },
    brandColor, branding, reportTitle, pageNumberStart: 1,
    logoImage: logoEmbed.image,
    headerMeta: { candidateName, position, dateStr },
    pageIndex: 0,
  };
  drawHeader(ctx);

  // Page 1: Candidate / Position / Date row directly under the header
  const colW = (A4.w - 2 * MARGIN) / 3;
  const kvRow = (x: number, label: string, value: string) => {
    ctx.page.drawText(label.toUpperCase(), { x, y: ctx.y, size: 7.5, font: bold, color: MUTED });
    const lines = wrap(value || "—", bold, 12, colW - 8);
    lines.slice(0, 2).forEach((ln, i) => {
      ctx.page.drawText(ln, { x, y: ctx.y - 14 - i * 14, size: 12, font: bold, color: INK });
    });
  };
  kvRow(MARGIN, "Candidate", candidateName);
  kvRow(MARGIN + colW, "Position", position);
  kvRow(MARGIN + colW * 2, "Date", dateStr);
  ctx.y -= 50;
  ctx.page.drawLine({
    start: { x: MARGIN, y: ctx.y + 4 }, end: { x: A4.w - MARGIN, y: ctx.y + 4 },
    thickness: 0.5, color: HAIR,
  });
  ctx.y -= 8;


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
  const snapColW = (A4.w - 2 * MARGIN - 16) / 2;
  for (let i = 0; i < snapItems.length; i += 2) {
    const left = snapItems[i];
    const right = snapItems[i + 1];
    ensureSpace(ctx, 36);
    const yStart = ctx.y;
    const drawCell = (x: number, label: string, val: string) => {
      ctx.page.drawText(label.toUpperCase(), { x, y: yStart, size: 7.5, font: bold, color: MUTED });
      const lines = wrap(val || "—", reg, 10, snapColW);
      lines.slice(0, 2).forEach((ln, i2) => {
        ctx.page.drawText(ln, { x, y: yStart - 12 - i2 * 12, size: 10, font: reg, color: INK });
      });
    };
    drawCell(MARGIN, left[0], left[1] ?? "");
    if (right) drawCell(MARGIN + snapColW + 16, right[0], right[1] ?? "");
    ctx.y -= 36;
  }
  ctx.y -= 4;

  // Executive Summary
  drawSectionTitle(ctx, "Executive Summary");
  drawParagraph(ctx, report.executive_summary || "—");
  ctx.y -= 6;

  // Candidate Overview
  if (report.candidate_overview) {
    drawSectionTitle(ctx, "Candidate Overview");
    drawParagraph(ctx, report.candidate_overview);
    ctx.y -= 6;
  }

  // Fit assessment
  drawSectionTitle(ctx, "Fit Assessment vs Job Description");
  drawFitTable(ctx, report.fit_assessment ?? []);

  // Strengths
  drawSectionTitle(ctx, "Key Strengths");
  drawBullets(ctx, report.key_strengths ?? []);
  ctx.y -= 4;

  // Considerations
  drawSectionTitle(ctx, "Considerations / Potential Gaps");
  drawBullets(ctx, report.considerations ?? []);
  ctx.y -= 4;

  // Recruiter Assessment (preferred new field; falls back to legacy recruiter_notes)
  drawSectionTitle(ctx, "Recruiter Assessment");
  drawParagraph(ctx, report.recruiter_assessment || report.recruiter_notes || "—");
  ctx.y -= 6;

  // Salary & Availability
  if (report.salary_availability) {
    drawSectionTitle(ctx, "Salary & Availability");
    drawParagraph(ctx, report.salary_availability);
    ctx.y -= 6;
  }

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

  // Page numbers / footers are stamped after the final merge so report-pages
  // and CV-pages can be footered differently per pack option.
  return await pdf.save();
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

async function countPdfPages(bytes: Uint8Array): Promise<number> {
  try {
    const d = await PDFDocument.load(bytes, { ignoreEncryption: true });
    return d.getPageCount();
  } catch { return 0; }
}

async function mergePdfs(parts: Uint8Array[]): Promise<{ bytes: Uint8Array; failed: number[] }> {
  const out = await PDFDocument.create();
  const failed: number[] = [];
  for (let i = 0; i < parts.length; i++) {
    try {
      const src = await PDFDocument.load(parts[i], { ignoreEncryption: true });
      const pages = await out.copyPages(src, src.getPageIndices());
      pages.forEach((pg) => out.addPage(pg));
    } catch (e) {
      console.warn(`merge skip part ${i}`, e);
      failed.push(i);
    }
  }
  return { bytes: await out.save(), failed };
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
    if (report.status !== "approved") {
      return jsonR({ error: "Report must be approved before generating a submission pack." }, 400);
    }

    const [{ data: candidate }, { data: job }, { data: branding }, { data: tenant }] = await Promise.all([
      admin.from("candidates").select("*").eq("id", report.candidate_id).maybeSingle(),
      admin.from("jobs").select("title").eq("id", report.job_id).maybeSingle(),
      admin.from("branding_settings").select("*").eq("tenant_id", report.tenant_id).maybeSingle(),
      admin.from("tenants").select("name, logo_url, primary_color").eq("id", report.tenant_id).maybeSingle(),
    ]);

    // Merge branding from tenants -> branding_settings -> report override.
    const mergedBranding: any = {
      company_name: branding?.company_name || tenant?.name || null,
      logo_url: branding?.logo_url || tenant?.logo_url || null,
      primary_color: branding?.primary_color || tenant?.primary_color || null,
      footer_text: branding?.footer_text || branding?.company_name || tenant?.name || null,
      ...(report.report_data?.branding ?? {}),
    };
    if (mergedBranding.logo_url) {
      mergedBranding.logo_url = await resolveLogoUrl(admin, mergedBranding.logo_url);
    }
    const brand = mergedBranding;

    // Branding diagnostics — surfaced to the recruiter/super admin in the response.
    const brandingDiagnostics: {
      agency_name: string | null;
      stored_logo_url: string | null;
      resolved_logo_url: string | null;
      logo_status: LogoStatus;
      logo_reason: string;
      last_attempt: string;
    } = {
      agency_name: brand.company_name,
      stored_logo_url: branding?.logo_url || tenant?.logo_url || null,
      resolved_logo_url: brand.logo_url,
      logo_status: brand.logo_url ? "ok" : "missing",
      logo_reason: brand.logo_url ? "pending embed" : "No agency logo configured",
      last_attempt: new Date().toISOString(),
    };

    const candidateName = report.report_data?.header?.anonymous
      ? "Confidential Candidate"
      : (candidate?.full_name ?? "Candidate");
    const position = job?.title ?? report.report_data?.header?.position ?? "";

    const reportTitle = brand.company_name
      ? `${brand.company_name} — Client Submission v${report.version}`
      : `Client Submission v${report.version}`;

    // Build report PDF and capture the actual logo embed result for diagnostics.
    const logoDiag: { logo_status: LogoStatus; logo_reason: string } = {
      logo_status: brandingDiagnostics.logo_status, logo_reason: brandingDiagnostics.logo_reason,
    };
    const reportPdf = await buildReportPdf(report.report_data, brand, reportTitle, logoDiag);
    brandingDiagnostics.logo_status = logoDiag.logo_status;
    brandingDiagnostics.logo_reason = logoDiag.logo_reason;
    brandingDiagnostics.last_attempt = new Date().toISOString();

    // Always include the FULL CV for options B and C — fall back to a structured CV PDF when source isn't a PDF.
    let cvBytes: Uint8Array | null = null;
    let cvSource: "original_pdf" | "structured_fallback" | "none" = "none";
    if (pack_option === "B" || pack_option === "C") {
      cvBytes = await tryFetchCvPdf(admin, candidate);
      if (cvBytes) cvSource = "original_pdf";
      else { cvBytes = await buildStructuredCvPdf(candidate, brand, position); cvSource = "structured_fallback"; }
    }

    // Pack structure per spec: Report first, CV immediately after. NO cover/intro/separator pages.
    const parts: Uint8Array[] = [reportPdf];
    if (cvBytes) parts.push(cvBytes);

    let finalPdf: Uint8Array;
    let mergeFailed: number[] = [];
    if (parts.length === 1) {
      finalPdf = parts[0];
    } else {
      const merged = await mergePdfs(parts);
      finalPdf = merged.bytes;
      mergeFailed = merged.failed;
    }

    // Merge validation — count pages and refuse to ship a partial pack.
    const reportPages = await countPdfPages(reportPdf);
    const cvPages = cvBytes ? await countPdfPages(cvBytes) : 0;
    const totalPages = await countPdfPages(finalPdf);
    const expectedTotal = reportPages + cvPages;
    const mergeOk = mergeFailed.length === 0 && totalPages === expectedTotal && reportPages > 0;
    const mergeValidation = {
      report_pages: reportPages,
      cv_pages: cvPages,
      total_pages: totalPages,
      expected_total: expectedTotal,
      cv_source: cvSource,
      failed_parts: mergeFailed,
      merge_status: mergeOk ? "ok" : (cvBytes && mergeFailed.includes(1) ? "cv_merge_failed" : "validation_failed"),
    };
    if (!mergeOk) {
      return jsonR({
        error: cvBytes ? "CV merge failed" : "PDF merge validation failed",
        branding_diagnostics: brandingDiagnostics,
        merge_validation: mergeValidation,
      }, 500);
    }

    // Stamp footers per pack option: report-pages get a minimal continuation
    // footer; CV pages are untouched (B) or get a small "Submitted by" line (C).
    const restamped = await stampSubmissionPack(finalPdf, brand, {
      reportPageCount: reportPages,
      cvPageCount: cvPages,
      packOption: pack_option as "A" | "B" | "C",
      candidateName,
      position,
      watermark: wantWatermark,
    });

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

    return jsonR({
      pack: inserted,
      download_url: signed?.signedUrl ?? null,
      branding_diagnostics: brandingDiagnostics,
      merge_validation: mergeValidation,
    });
  } catch (e) {
    console.error(e);
    return jsonR({ error: e instanceof Error ? e.message : String(e) }, 500);
  }
});


async function resolveLogoUrl(admin: any, raw: string): Promise<string> {
  try {
    if (!raw) return raw;
    if (raw.startsWith("http")) return raw;
    if (raw.includes("/storage/v1/object/")) return raw;
    // Treat as bucket-relative path. Try common buckets.
    const buckets = ["documents", "branding", "trusted-clients", "public", "logos"];
    for (const b of buckets) {
      const { data } = await admin.storage.from(b).createSignedUrl(raw, 60 * 60 * 24);
      if (data?.signedUrl) return data.signedUrl;
    }
  } catch (_) { /* ignore */ }
  return raw;
}

async function stampSubmissionPack(
  bytes: Uint8Array,
  branding: any,
  opts: {
    reportPageCount: number;
    cvPageCount: number;
    packOption: "A" | "B" | "C";
    candidateName: string;
    position: string;
    watermark: boolean;
  },
): Promise<Uint8Array> {
  const pdf = await PDFDocument.load(bytes);
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const total = pdf.getPageCount();
  const { reportPageCount, packOption, candidateName, position, watermark } = opts;

  // Report continuation footer line: "Candidate Name | Position | Page X of Y"
  // (Page 1 of the report gets no footer text — it has the premium header.)
  const reportFooter = (i: number) =>
    `${candidateName} | ${position} | Page ${i + 1} of ${reportPageCount}`;

  // Option C only: small "Submitted by [Agency Name]" footer on CV pages.
  const agencyName = branding?.company_name || branding?.footer_text || "";
  const cvFooterC = agencyName ? `Submitted by ${agencyName}` : "";

  for (let i = 0; i < total; i++) {
    const p = pdf.getPage(i);
    const { width, height } = p.getSize();
    const isReportPage = i < reportPageCount;
    const isCvPage = i >= reportPageCount;

    if (watermark) {
      const wmText = "CONFIDENTIAL";
      const size = 72;
      const tw = bold.widthOfTextAtSize(wmText, size);
      p.drawText(wmText, {
        x: (width - tw * 0.7) / 2, y: height / 2 - size / 2,
        size, font: bold, color: rgb(0.85, 0.2, 0.2),
        opacity: 0.08, rotate: degrees(30),
      });
    }

    if (isReportPage) {
      // Minimal footer for report pages 2+. Page 1 stays clean.
      if (i > 0) {
        const txt = reportFooter(i);
        const w = font.widthOfTextAtSize(txt, 8);
        p.drawText(txt, { x: (width - w) / 2, y: 22, size: 8, font, color: MUTED });
      }
      continue;
    }

    if (isCvPage) {
      // Option B: preserve original CV exactly — no stamping.
      if (packOption === "B") continue;
      // Option C: minimal "Submitted by [Agency]" footer only. No logo, no header.
      if (packOption === "C" && cvFooterC) {
        const w = font.widthOfTextAtSize(cvFooterC, 8);
        p.drawText(cvFooterC, { x: (width - w) / 2, y: 18, size: 8, font, color: MUTED });
      }
    }
  }
  return await pdf.save();
}

// ---------- Structured CV fallback ----------
// Renders a multi-page CV PDF from candidate.cv_parsed_data / structured_profile / work_history
// when the original CV file isn't a PDF (e.g., DOCX). Ensures Option B/C always include a full CV.
async function buildStructuredCvPdf(candidate: any, branding: any, position: string): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  const reg = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const italic = await pdf.embedFont(StandardFonts.HelveticaOblique);
  const brandColor = hexToRgb(branding?.primary_color);
  const logo = await embedLogo(pdf, branding?.logo_url);

  const ctx: Ctx = {
    pdf,
    page: pdf.addPage([A4.w, A4.h]),
    y: A4.h - 96,
    fonts: { reg, bold, italic },
    brandColor, branding, reportTitle: "Curriculum Vitae", pageNumberStart: 1,
    logoImage: logo, pageIndex: 0,
  };
  drawHeader(ctx);


  const name = candidate?.full_name || "Candidate";
  ctx.page.drawText(name, { x: MARGIN, y: ctx.y, size: 22, font: bold, color: INK });
  ctx.y -= 22;
  const sub = [candidate?.current_title, candidate?.current_company].filter(Boolean).join(" · ");
  if (sub) {
    ctx.page.drawText(sub, { x: MARGIN, y: ctx.y, size: 11, font: reg, color: brandColor });
    ctx.y -= 14;
  }
  const meta = [candidate?.location, candidate?.email, candidate?.phone].filter(Boolean).join("  •  ");
  if (meta) {
    ctx.page.drawText(meta, { x: MARGIN, y: ctx.y, size: 9.5, font: reg, color: MUTED });
    ctx.y -= 14;
  }
  if (position) {
    ctx.page.drawText(`Submitted for: ${position}`, { x: MARGIN, y: ctx.y, size: 9.5, font: italic, color: MUTED });
    ctx.y -= 14;
  }
  ctx.y -= 8;

  // Pull data from any structured source available
  const sp = candidate?.structured_profile ?? {};
  const cp = candidate?.cv_parsed_data ?? {};
  const summary = sp.summary || cp.summary || candidate?.summary;
  const skills = (sp.skills || cp.skills || candidate?.skills || []) as any[];
  const experience = (sp.work_history || sp.experience || cp.work_history || cp.experience || candidate?.work_history || []) as any[];
  const education = (sp.education || cp.education || candidate?.education || []) as any[];

  if (summary) {
    drawSectionTitle(ctx, "Professional Summary");
    drawParagraph(ctx, String(summary));
    ctx.y -= 6;
  }

  if (Array.isArray(skills) && skills.length) {
    drawSectionTitle(ctx, "Core Skills");
    const flat = skills.map((s) => typeof s === "string" ? s : (s?.name || s?.skill || "")).filter(Boolean);
    drawParagraph(ctx, flat.join(" · "));
    ctx.y -= 6;
  }

  if (Array.isArray(experience) && experience.length) {
    drawSectionTitle(ctx, "Professional Experience");
    for (const job of experience) {
      const title = job?.title || job?.role || job?.position || "Role";
      const company = job?.company || job?.employer || job?.organization || "";
      const period = [job?.start_date || job?.start || job?.from, job?.end_date || job?.end || job?.to || (job?.current ? "Present" : "")].filter(Boolean).join(" – ");
      ensureSpace(ctx, 36);
      ctx.page.drawText(`${title}${company ? " · " + company : ""}`, { x: MARGIN, y: ctx.y, size: 11, font: bold, color: INK });
      ctx.y -= 13;
      if (period) {
        ctx.page.drawText(period, { x: MARGIN, y: ctx.y, size: 9, font: italic, color: MUTED });
        ctx.y -= 12;
      }
      const desc = job?.description || job?.summary || "";
      if (desc) drawParagraph(ctx, String(desc), 9.5);
      const hl = job?.highlights || job?.achievements || [];
      if (Array.isArray(hl) && hl.length) drawBullets(ctx, hl.map(String));
      ctx.y -= 4;
    }
  }

  if (Array.isArray(education) && education.length) {
    drawSectionTitle(ctx, "Education");
    for (const ed of education) {
      const degree = ed?.degree || ed?.qualification || ed?.title || "";
      const inst = ed?.institution || ed?.school || ed?.university || "";
      const period = [ed?.start_date || ed?.start, ed?.end_date || ed?.end].filter(Boolean).join(" – ");
      ensureSpace(ctx, 30);
      const line = [degree, inst].filter(Boolean).join(" — ");
      ctx.page.drawText(line || "Education", { x: MARGIN, y: ctx.y, size: 10.5, font: bold, color: INK });
      ctx.y -= 12;
      if (period) {
        ctx.page.drawText(period, { x: MARGIN, y: ctx.y, size: 9, font: italic, color: MUTED });
        ctx.y -= 12;
      }
      ctx.y -= 2;
    }
  }

  // No structured data at all — render an informational page so the pack is never empty.
  if (!summary && !(skills?.length) && !(experience?.length) && !(education?.length)) {
    drawSectionTitle(ctx, "Curriculum Vitae");
    drawParagraph(ctx, "A full CV is available on request. The candidate's original CV is not in a format that can be embedded inline (e.g., DOCX). Please contact the recruiter for the source file.");
  }

  return await pdf.save();
}
