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
const HEADER_H = 86;
const FOOTER_H = 38;

// Premium executive-search palette (dark navy + royal blue + gold)
const NAVY = rgb(0.031, 0.106, 0.267);       // #081B44 primary headers / bands
const NAVY_DEEP = rgb(0.020, 0.067, 0.180);  // #05112E deeper accents
const ROYAL = rgb(0.118, 0.251, 0.686);      // #1E40AF royal-blue accents
const GOLD = rgb(0.788, 0.659, 0.298);       // #C9A84C subtle gold separators
const GOLD_SOFT = rgb(0.886, 0.792, 0.490);  // lighter gold for thin lines
const NAVY_SOFT = rgb(0.20, 0.27, 0.42);
const INK = rgb(0.13, 0.14, 0.18);
const MUTED = rgb(0.46, 0.49, 0.56);
const HAIR = rgb(0.85, 0.87, 0.91);
const PANEL = rgb(0.961, 0.969, 0.980);      // #F4F6FA very light gray panel
const PANEL_BORDER = rgb(0.88, 0.90, 0.94);
const WHITE = rgb(1, 1, 1);
const ON_NAVY_MUTED = rgb(0.75, 0.80, 0.92);

// Status colors (text/border for pills) — kept readable on light panels
const C_EXCEEDS = rgb(0.118, 0.251, 0.686);  // royal
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

// Executive-search fit labels driven by AI mandate_match output
function fitColors(label: string): { fg: any; bg: any } {
  const L = (label || "").toUpperCase();
  if (L === "EXCEEDS")     return { fg: C_EXCEEDS, bg: C_EXCEEDS_BG };
  if (L === "STRONG")      return { fg: C_STRONG,  bg: C_STRONG_BG };
  if (L === "GOOD")        return { fg: C_STRONG,  bg: C_STRONG_BG };
  if (L === "PARTIAL")     return { fg: C_MOD,     bg: C_MOD_BG };
  if (L === "WEAK")        return { fg: C_PARTIAL, bg: C_PARTIAL_BG };
  if (L === "NOT MATCHED") return { fg: C_PARTIAL, bg: C_PARTIAL_BG };
  return { fg: C_MOD, bg: C_MOD_BG };
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

    // Step 1: Verify the user has access to this submission (RLS-checked).
    const { data: submission, error: subErr } = await supabase
      .from("candidate_submissions")
      .select("id, tenant_id, job_id, candidate_id, ai_validation_id, submission_message, client_org_id, branded_cv_url, original_cv_url, pack_components, recruiter_summary, recruiter_strengths, recruiter_considerations, recruiter_recommendation, recruiter_notes")
      .eq("id", submission_id)
      .maybeSingle();
    if (subErr || !submission) {
      await admin.from("candidate_submissions").update({ pack_status: "failed", pack_error: "not found" }).eq("id", submission_id);
      return fail("This submission could not be found. Please refresh and try again.");
    }

    // Step 2: Use admin client for relational reads. The user has already proven
    // ownership of the submission via RLS above, so it is safe to bypass RLS for
    // related rows in the same tenant. This avoids "Candidate or job data is missing"
    // when the recruiter doesn't directly own the candidate/job (e.g. job is
    // assigned to a teammate within the same tenant).
    const [
      { data: candidate },
      { data: job },
      { data: validationRow },
      { data: canonical },
      { data: branding },
      { data: profile },
    ] = await Promise.all([
      admin.from("candidates").select("*").eq("id", submission.candidate_id).maybeSingle(),
      admin.from("jobs").select("*").eq("id", submission.job_id).maybeSingle(),
      submission.ai_validation_id
        ? admin.from("ai_candidate_validations").select("*").eq("id", submission.ai_validation_id).maybeSingle()
        : admin.from("ai_candidate_validations").select("*").eq("job_id", submission.job_id).eq("candidate_id", submission.candidate_id).order("created_at", { ascending: false }).limit(1).maybeSingle(),
      admin.from("rediscovered_matches").select("match_score, sub_scores, confidence, model_version, strengths, gaps, ai_summary").eq("job_id", submission.job_id).eq("candidate_id", submission.candidate_id).maybeSingle(),
      admin.from("branding_settings").select("logo_url, company_name, primary_color, footer_text").eq("tenant_id", submission.tenant_id).maybeSingle(),
      admin.from("profiles").select("full_name, email, phone").eq("id", userId).maybeSingle(),
    ]);
    let validation: any = validationRow;


    // Step 3: Detailed readiness diagnostics — surface the exact missing piece(s)
    // to the recruiter instead of a generic error.
    const missing: string[] = [];
    if (!candidate) missing.push("Candidate record");
    if (!job) missing.push("Job record");
    if (candidate && (candidate as any).tenant_id && (candidate as any).tenant_id !== submission.tenant_id) {
      missing.push("Candidate belongs to a different workspace");
    }
    if (job && (job as any).tenant_id && (job as any).tenant_id !== submission.tenant_id) {
      missing.push("Job belongs to a different workspace");
    }

    if (!candidate || !job) {
      const detail = missing.join(" · ");
      await admin.from("candidate_submissions").update({
        pack_status: "failed",
        pack_error: detail || "candidate/job missing",
      }).eq("id", submission_id);
      return new Response(JSON.stringify({
        status: "failed",
        user_message: `Submission is missing required data: ${detail}. Please open the candidate or job record to repair it, then retry.`,
        readiness: {
          candidate: !!candidate,
          job: !!job,
          ai_validation: !!(validation || canonical),
          cv: !!(submission.branded_cv_url || submission.original_cv_url),
          missing,
        },
      }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Trigger AI executive-search validation if structured mandate_match is missing
    // or recruiter notes exist (so the AI can incorporate them). Errors are non-fatal —
    // we keep going with whatever validation data we already have.
    const needsValidation =
      !validation ||
      !Array.isArray((validation as any).mandate_match) ||
      ((validation as any).mandate_match?.length ?? 0) === 0 ||
      ((submission.recruiter_notes as string[] | null)?.length ?? 0) > 0;
    if (needsValidation) {
      try {
        const url = `${Deno.env.get("SUPABASE_URL")}/functions/v1/validate-candidate-fit`;
        const r = await fetch(url, {
          method: "POST",
          headers: { Authorization: authHeader!, "Content-Type": "application/json" },
          body: JSON.stringify({
            job_id: submission.job_id,
            candidate_id: submission.candidate_id,
            submission_id: submission.id,
            force: ((submission.recruiter_notes as string[] | null)?.length ?? 0) > 0,
          }),
        });
        if (r.ok) {
          const j = await r.json();
          if (j?.validation) validation = j.validation as any;
        }
      } catch (e) { console.error("validate-fit invoke failed", e); }
    }

    // Step 4: Safe fallbacks — missing AI validation / CV no longer blocks the pack.



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

    // Recruiter-grade recommendation taxonomy — score is internal-only on the
    // executive PDF; clients see the recruiter label.
    type RecKey = "strong_match" | "recommended" | "moderate_fit" | "needs_review" | "limited_alignment" | "not_suitable";
    const recFromScore = (s: number | null): RecKey => {
      if (s == null) return "needs_review";
      if (s >= 88) return "strong_match";
      if (s >= 75) return "recommended";
      if (s >= 62) return "moderate_fit";
      if (s >= 50) return "needs_review";
      if (s >= 35) return "limited_alignment";
      return "not_suitable";
    };
    const recRaw = String(validation?.recommendation ?? "").toLowerCase().replace(/[\s-]+/g, "_");
    const VALID_RECS: RecKey[] = ["strong_match","recommended","moderate_fit","needs_review","limited_alignment","not_suitable"];
    const recKey: RecKey = (VALID_RECS as string[]).includes(recRaw) ? (recRaw as RecKey) : recFromScore(canonicalScore);
    const REC_LABEL: Record<RecKey, string> = {
      strong_match: "Strong Match",
      recommended: "Recommended",
      moderate_fit: "Moderate Fit",
      needs_review: "Needs Review",
      limited_alignment: "Limited Alignment",
      not_suitable: "Not Suitable",
    };
    const REC_ACCENT: Record<RecKey, any> = {
      strong_match: rgb(0.04, 0.45, 0.30),
      recommended: rgb(0.06, 0.40, 0.55),
      moderate_fit: rgb(0.78, 0.63, 0.30),
      needs_review: rgb(0.78, 0.48, 0.16),
      limited_alignment: rgb(0.70, 0.30, 0.25),
      not_suitable: rgb(0.60, 0.18, 0.18),
    };
    const recAccent = REC_ACCENT[recKey];
    const recLabel = REC_LABEL[recKey];

    // Sidecar metadata extracted from mandate_match (validate-candidate-fit packs
    // missing_requirements and recruiter_notes_summary as __kind rows).
    const mandateRaw: any[] = Array.isArray(validation?.mandate_match) ? validation.mandate_match : [];
    const sideMissing: string[] = (() => {
      const row = mandateRaw.find((r) => r && r.__kind === "missing");
      return Array.isArray(row?.items) ? row.items.map(String) : [];
    })();
    const sideRecruiterSummary: string[] = (() => {
      const row = mandateRaw.find((r) => r && r.__kind === "recruiter_notes_summary");
      return Array.isArray(row?.items) ? row.items.map(String) : [];
    })();


    const drawHeader = (page: PDFPage) => {
      const { width, height } = page.getSize();
      // Navy band
      page.drawRectangle({ x: 0, y: height - HEADER_H, width, height: HEADER_H, color: NAVY });
      // Deeper inner stripe for depth
      page.drawRectangle({ x: 0, y: height - HEADER_H, width, height: 4, color: NAVY_DEEP });
      // Gold accent line at bottom of header
      page.drawRectangle({ x: 0, y: height - HEADER_H - 2, width, height: 2, color: GOLD });

      const padY = height - 26;
      // Logo (left)
      let leftX = MARGIN;
      if (logoImg) {
        const maxH = 32, maxW = 110;
        const s = Math.min(maxW / logoImg.width, maxH / logoImg.height, 1);
        const w = logoImg.width * s, h = logoImg.height * s;
        page.drawImage(logoImg, { x: MARGIN, y: height - HEADER_H + (HEADER_H - h) / 2, width: w, height: h });
        leftX = MARGIN + w + 14;
        // vertical gold separator
        page.drawLine({
          start: { x: leftX - 8, y: height - HEADER_H + 18 },
          end:   { x: leftX - 8, y: height - 18 },
          thickness: 0.8, color: GOLD,
        });
      }
      // Agency name + recruiter
      if (companyName) {
        page.drawText(companyName, { x: leftX, y: padY - 4, size: 12, font: sansB, color: WHITE });
      }
      const sub = [recruiterName, profile?.email].filter(Boolean).join("  ·  ");
      if (sub) {
        page.drawText(sub, { x: leftX, y: padY - 20, size: 8.5, font: sans, color: ON_NAVY_MUTED });
      }

      // Right side: CONFIDENTIAL label + generated date
      const confTxt = tracked("Confidential");
      const confW = sansB.widthOfTextAtSize(confTxt, 8);
      page.drawText(confTxt, { x: width - MARGIN - confW, y: padY - 4, size: 8, font: sansB, color: GOLD });
      const dateTxt = `Generated ${generatedAt}`;
      const dateW = sans.widthOfTextAtSize(dateTxt, 8.5);
      page.drawText(dateTxt, { x: width - MARGIN - dateW, y: padY - 20, size: 8.5, font: sans, color: ON_NAVY_MUTED });
    };

    const drawFooter = (page: PDFPage, num: number, total: number) => {
      const { width } = page.getSize();
      // Navy footer band
      page.drawRectangle({ x: 0, y: 0, width, height: FOOTER_H, color: NAVY });
      page.drawRectangle({ x: 0, y: FOOTER_H, width, height: 1.2, color: GOLD });
      page.drawText(`Generated by ${companyName || "HireMetrics"}`, {
        x: MARGIN, y: 20, size: 8, font: sansB, color: WHITE,
      });
      page.drawText("Confidential Candidate Submission", {
        x: MARGIN, y: 9, size: 7.5, font: sans, color: ON_NAVY_MUTED,
      });
      const right = `Page ${num} of ${total}`;
      const rw = sansB.widthOfTextAtSize(right, 8);
      page.drawText(right, { x: width - MARGIN - rw, y: 20, size: 8, font: sansB, color: GOLD });
      const right2 = generatedAt;
      const rw2 = sans.widthOfTextAtSize(right2, 7.5);
      page.drawText(right2, { x: width - MARGIN - rw2, y: 9, size: 7.5, font: sans, color: ON_NAVY_MUTED });
    };

    const innerW = A4.w - MARGIN * 2;

    const newPage = (): PDFPage => {
      const p = doc.addPage([A4.w, A4.h]);
      drawHeader(p);
      return p;
    };
    const cur: Cursor = { page: newPage(), y: A4.h - HEADER_H - 22 };
    const ensure = (need: number) => {
      if (cur.y - need < FOOTER_H + 18) { cur.page = newPage(); cur.y = A4.h - HEADER_H - 22; }
    };

    const sectionHeading = (label: string) => {
      ensure(32);
      cur.y -= 8;
      // Navy section bar with gold accent
      const barH = 18;
      cur.page.drawRectangle({ x: MARGIN, y: cur.y - barH, width: innerW, height: barH, color: NAVY });
      cur.page.drawRectangle({ x: MARGIN, y: cur.y - barH, width: 3, height: barH, color: GOLD });
      cur.page.drawText(tracked(label), {
        x: MARGIN + 12, y: cur.y - 12, size: 8.5, font: sansB, color: WHITE,
      });
      cur.y -= barH + 10;
    };

    const paragraph = (text: string, size = 9.5, font: PDFFont = serif, color = INK, lh = 13) => {
      const lines = wrap(text, font, size, innerW);
      for (const ln of lines) {
        ensure(lh);
        cur.page.drawText(ln, { x: MARGIN, y: cur.y - size, size, font, color });
        cur.y -= lh;
      }
    };

    // ===== Hero — premium navy candidate banner =====
    const name = candidate.full_name ?? "Candidate";
    {
      const heroH = 92;
      ensure(heroH + 6);
      const heroTop = cur.y;
      // Navy banner
      cur.page.drawRectangle({ x: MARGIN, y: heroTop - heroH, width: innerW, height: heroH, color: NAVY });
      // Deeper inner band on the left for editorial accent
      cur.page.drawRectangle({ x: MARGIN, y: heroTop - heroH, width: 6, height: heroH, color: GOLD });
      // Subtle royal accent strip at bottom
      cur.page.drawRectangle({ x: MARGIN, y: heroTop - heroH, width: innerW, height: 3, color: ROYAL });

      // "Executive Candidate Profile" eyebrow
      cur.page.drawText(tracked("Executive Candidate Profile"), {
        x: MARGIN + 22, y: heroTop - 20, size: 7.5, font: sansB, color: GOLD,
      });
      // Candidate name
      cur.page.drawText(name, {
        x: MARGIN + 22, y: heroTop - 46, size: 24, font: serifB, color: WHITE,
      });
      // Target role line
      const targetRole = job.title ? `Submitted for ${job.title}` : "";
      if (targetRole) {
        cur.page.drawText(targetRole, {
          x: MARGIN + 22, y: heroTop - 64, size: 10, font: sansB, color: ON_NAVY_MUTED,
        });
      }
      // Sub line: current title @ company · location
      const subBits: string[] = [];
      if (candidate.current_title) subBits.push(String(candidate.current_title));
      if (candidate.current_company) subBits.push(String(candidate.current_company));
      if (candidate.location) subBits.push(String(candidate.location));
      if (subBits.length) {
        cur.page.drawText(subBits.join("  ·  "), {
          x: MARGIN + 22, y: heroTop - 80, size: 9, font: sans, color: ON_NAVY_MUTED,
        });
      }

      // Recruiter recommendation pill (replaces numeric score) — single source of truth
      {
        const labelText = recLabel.toUpperCase();
        const eyebrow = "RECRUITER ASSESSMENT";
        const labelW = sansB.widthOfTextAtSize(labelText, 11);
        const eyebrowW = sansB.widthOfTextAtSize(eyebrow, 6.5);
        const chipW = Math.max(150, Math.max(labelW, eyebrowW) + 36);
        const chipH = 56;
        const chipX = MARGIN + innerW - chipW - 14;
        const chipY = heroTop - heroH + (heroH - chipH) / 2;
        cur.page.drawRectangle({ x: chipX, y: chipY, width: chipW, height: chipH, color: NAVY_DEEP, borderColor: GOLD, borderWidth: 0.8 });
        cur.page.drawRectangle({ x: chipX, y: chipY + chipH - 3, width: chipW, height: 3, color: GOLD });
        cur.page.drawText(eyebrow, { x: chipX + (chipW - eyebrowW) / 2, y: chipY + chipH - 18, size: 6.5, font: sansB, color: GOLD });
        cur.page.drawText(labelText, { x: chipX + (chipW - labelW) / 2, y: chipY + 22, size: 11, font: sansB, color: WHITE });
        const subTxt = confidence ? `Confidence: ${String(confidence).toUpperCase()}` : "Evidence-based assessment";
        const swW = sans.widthOfTextAtSize(subTxt, 6.5);
        cur.page.drawText(subTxt, { x: chipX + (chipW - swW) / 2, y: chipY + 8, size: 6.5, font: sans, color: ON_NAVY_MUTED });
      }


      cur.y -= heroH + 14;
    }

    // ===== Mandate strip (compact navy band with role) =====
    {
      ensure(28);
      const stripH = 24;
      cur.page.drawRectangle({ x: MARGIN, y: cur.y - stripH, width: innerW, height: stripH, color: NAVY });
      cur.page.drawRectangle({ x: MARGIN, y: cur.y - stripH, width: 3, height: stripH, color: GOLD });
      const label = tracked("Mandate");
      cur.page.drawText(label, { x: MARGIN + 12, y: cur.y - 15, size: 7.5, font: sansB, color: GOLD });
      const labelW = sansB.widthOfTextAtSize(label, 7.5);
      const jobBits = [job.title, job.experience_level, job.department, job.employment_type, job.location].filter(Boolean).join("  ·  ");
      cur.page.drawText(jobBits, { x: MARGIN + 12 + labelW + 14, y: cur.y - 15, size: 9.5, font: sansB, color: WHITE });
      cur.y -= stripH + 12;
    }

    // ===== Recruiter Notes (recruiter-entered context, shown before AI analysis) =====
    const recruiterNotes = (submission.recruiter_notes as string[] | null) ?? [];
    if (recruiterNotes.length) {
      sectionHeading("Recruiter Notes");
      const dotW = 8;
      for (const note of recruiterNotes.slice(0, 12)) {
        const lines = wrap(String(note), serif, 9.5, innerW - dotW - 4);
        ensure(13);
        cur.page.drawText("•", { x: MARGIN, y: cur.y - 10, size: 10, font: sansB, color: GOLD });
        if (lines[0]) cur.page.drawText(lines[0], { x: MARGIN + dotW, y: cur.y - 10, size: 9.5, font: serif, color: INK });
        cur.y -= 13;
        for (let i = 1; i < lines.length; i++) {
          ensure(13);
          cur.page.drawText(lines[i], { x: MARGIN + dotW, y: cur.y - 10, size: 9.5, font: serif, color: INK });
          cur.y -= 13;
        }
      }
      cur.y -= 4;
    }

    // ===== Executive Summary =====
    const narrative = validation?.summary || canonical?.ai_summary || candidate.summary;
    if (narrative) {
      sectionHeading("Executive Summary");
      paragraph(String(narrative), 9.5, serif, INK, 13);
      cur.y -= 4;
    }

    // ===== Fit Assessment vs Job Description (AI-derived mandate_match) =====
    // Filter out sidecar metadata rows (missing/recruiter_notes_summary).
    const mandateRows: Array<{ req: string; evidence: string; fit: string }> =
      Array.isArray(validation?.mandate_match)
        ? (validation.mandate_match as any[])
            .filter((m) => m && !m.__kind && m.requirement && m.evidence)
            .map((m) => ({
              req: String(m.requirement),
              evidence: String(m.evidence),
              fit: String(m.fit || "PARTIAL").toUpperCase(),
            }))
        : [];


    if (mandateRows.length) {
      sectionHeading("Fit Assessment vs Job Description");
      const cReq = 145, cFit = 76;
      const cEv = innerW - cReq - cFit;
      ensure(22);
      cur.page.drawRectangle({ x: MARGIN, y: cur.y - 18, width: innerW, height: 18, color: NAVY });
      cur.page.drawText("Requirement", { x: MARGIN + 10, y: cur.y - 12, size: 8.5, font: sansB, color: WHITE });
      cur.page.drawText("Candidate Evidence", { x: MARGIN + cReq + 10, y: cur.y - 12, size: 8.5, font: sansB, color: WHITE });
      cur.page.drawText("Fit", { x: MARGIN + cReq + cEv + 10, y: cur.y - 12, size: 8.5, font: sansB, color: WHITE });
      cur.y -= 18;

      let rowIdx = 0;
      for (const r of mandateRows) {
        const evLines = wrap(r.evidence, serif, 9, cEv - 20);
        const reqLines = wrap(r.req, sansB, 9, cReq - 20);
        const rowH = Math.max(28, Math.max(evLines.length, reqLines.length) * 12 + 12);
        ensure(rowH + 2);
        if (rowIdx % 2 === 0) {
          cur.page.drawRectangle({ x: MARGIN, y: cur.y - rowH, width: innerW, height: rowH, color: PANEL });
        }
        let ry = cur.y - 14;
        for (const ln of reqLines) {
          cur.page.drawText(ln, { x: MARGIN + 10, y: ry, size: 9, font: sansB, color: NAVY });
          ry -= 12;
        }
        let ey = cur.y - 14;
        for (const ln of evLines) {
          cur.page.drawText(ln, { x: MARGIN + cReq + 10, y: ey, size: 9, font: serif, color: INK });
          ey -= 12;
        }
        const f = fitColors(r.fit);
        const pillW = sansB.widthOfTextAtSize(r.fit, 8) + 14;
        const px = MARGIN + cReq + cEv + (cFit - pillW) / 2;
        const py = cur.y - rowH / 2 - 7;
        cur.page.drawRectangle({ x: px, y: py, width: pillW, height: 14, color: f.bg, borderColor: f.fg, borderWidth: 0.6 });
        cur.page.drawText(r.fit, { x: px + 7, y: py + 4, size: 8, font: sansB, color: f.fg });
        cur.y -= rowH;
        rowIdx++;
      }
      cur.y -= 6;
    }


    // ===== Two-column Strengths / Considerations (recruiter overrides win) =====
    const strengths = (submission.recruiter_strengths as string[] | null)?.length
      ? (submission.recruiter_strengths as string[])
      : ((validation?.strengths as string[]) || (canonical?.strengths as string[]) || []);
    const baseWeak = (validation?.weaknesses as string[]) || (canonical?.gaps as string[]) || [];
    const baseRisks = (validation?.risks as string[]) || [];
    const considerations = (submission.recruiter_considerations as string[] | null)?.length
      ? (submission.recruiter_considerations as string[])
      : [...baseWeak, ...baseRisks];

    if (strengths.length || considerations.length) {
      ensure(36);
      const gap = 18;
      const colWidth = (innerW - gap) / 2;
      const barH = 18;

      // Two-column navy heading bars with gold accent
      cur.page.drawRectangle({ x: MARGIN, y: cur.y - barH, width: colWidth, height: barH, color: NAVY });
      cur.page.drawRectangle({ x: MARGIN, y: cur.y - barH, width: 3, height: barH, color: GOLD });
      cur.page.drawText(tracked("Key Strengths"), { x: MARGIN + 12, y: cur.y - 12, size: 8.5, font: sansB, color: WHITE });

      cur.page.drawRectangle({ x: MARGIN + colWidth + gap, y: cur.y - barH, width: colWidth, height: barH, color: NAVY });
      cur.page.drawRectangle({ x: MARGIN + colWidth + gap, y: cur.y - barH, width: 3, height: barH, color: GOLD });
      cur.page.drawText(tracked("Considerations"), { x: MARGIN + colWidth + gap + 12, y: cur.y - 12, size: 8.5, font: sansB, color: WHITE });
      cur.y -= barH + 10;

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
          if (y - 14 < FOOTER_H + 18) break;
          cur.page.drawText("•", { x, y: y - 10, size: 10, font: sansB, color: GOLD });
          if (leadStr) cur.page.drawText(leadStr, { x: x + dotW, y: y - 10, size: 9, font: sansB, color: NAVY });
          if (lines[0]) cur.page.drawText(lines[0], { x: x + dotW + leadW, y: y - 10, size: 9, font: serif, color: INK });
          y -= 12;
          for (let i = 1; i < lines.length; i++) {
            if (y - 12 < FOOTER_H + 18) break;
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

    // ===== Recruiter View (manual override wins, otherwise AI recruiter_review) =====
    sectionHeading("Recruiter View");
    const recView = submission.recruiter_recommendation
      || submission.recruiter_summary
      || (validation?.recruiter_review as string | null)
      || submission.submission_message
      || `${candidate.full_name?.split(" ")[0] ?? "This candidate"} has been submitted for the ${job.title ?? "role"} for the client's review.`;
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

    // ===== Optional: merge in Branded CV + Original CV PDFs =====
    const components = {
      ai_report: true,
      branded_cv: true,
      original_cv: true,
      ...(submission.pack_components as any || {}),
      ...(reqComponents || {}),
    };

    const tryLoadPdfBytes = async (urlOrPath?: string | null): Promise<Uint8Array | null> => {
      if (!urlOrPath) return null;
      try {
        // If it's already a storage path (no http), try common buckets
        if (!/^https?:\/\//i.test(urlOrPath)) {
          for (const bucket of ["branded-cvs", "cvs", "candidate-cvs", "documents"]) {
            const { data } = await admin.storage.from(bucket).download(urlOrPath);
            if (data) return new Uint8Array(await data.arrayBuffer());
          }
          return null;
        }
        const m = urlOrPath.match(/\/storage\/v1\/object\/(?:public|sign)\/([^/]+)\/(.+?)(?:\?|$)/);
        if (m) {
          const { data } = await admin.storage.from(m[1]).download(decodeURIComponent(m[2]));
          if (data) return new Uint8Array(await data.arrayBuffer());
        }
        const r = await fetch(urlOrPath);
        if (r.ok) return new Uint8Array(await r.arrayBuffer());
      } catch (e) { console.error("pdf load fail", e); }
      return null;
    };

    const appendPdf = async (target: PDFDocument, src: Uint8Array | null) => {
      if (!src) return;
      try {
        const ext = await PDFDocument.load(src, { ignoreEncryption: true });
        const pages = await target.copyPages(ext, ext.getPageIndices());
        for (const p of pages) target.addPage(p);
      } catch (e) { console.error("merge fail", e); }
    };

    if (components.branded_cv) {
      const b = await tryLoadPdfBytes(submission.branded_cv_url);
      await appendPdf(doc, b);
    }
    if (components.original_cv) {
      const originalUrl = submission.original_cv_url || (candidate as any)?.cv_file_url || null;
      const o = await tryLoadPdfBytes(originalUrl);
      await appendPdf(doc, o);
      // Persist the resolved original CV URL on the submission so the UI reflects it
      if (!submission.original_cv_url && (candidate as any)?.cv_file_url) {
        await admin.from("candidate_submissions")
          .update({ original_cv_url: (candidate as any).cv_file_url })
          .eq("id", submission.id);
      }
    }

    // ===== Footers =====
    const total = doc.getPageCount();
    for (let i = 0; i < total; i++) drawFooter(doc.getPage(i), i + 1, total);

    const bytes = await doc.save();
    const versionStamp = Date.now();
    const path = `${submission.tenant_id}/${submission.id}/pack-${versionStamp}.pdf`;
    const { error: upErr } = await admin.storage.from("submission-packs").upload(path, bytes, {
      contentType: "application/pdf",
      upsert: true,
    });
    if (upErr) {
      await admin.from("candidate_submissions").update({ pack_status: "failed", pack_error: upErr.message }).eq("id", submission.id);
      return fail("We couldn't save the pack to storage. Please retry.", upErr);
    }

    const { data: signed } = await admin.storage.from("submission-packs").createSignedUrl(path, 60 * 60 * 24);

    // Determine next version number
    const { data: lastVer } = await admin.from("submission_pack_versions")
      .select("version").eq("submission_id", submission.id)
      .order("version", { ascending: false }).limit(1).maybeSingle();
    const nextVersion = ((lastVer?.version as number) || 0) + 1;

    await admin.from("submission_pack_versions").insert({
      submission_id: submission.id,
      tenant_id: submission.tenant_id,
      version: nextVersion,
      path,
      components,
      created_by: userId,
    });

    await admin.from("candidate_submissions").update({
      pack_pdf_url: path,
      pack_status: "ready",
      pack_error: null,
      last_activity_at: new Date().toISOString(),
    }).eq("id", submission.id);

    try {
      await admin.from("submission_activity").insert({
        submission_id: submission.id,
        tenant_id: submission.tenant_id,
        client_org_id: submission.client_org_id ?? null,
        actor_user_id: userId,
        actor_type: "internal",
        event_type: "pack_generated",
        metadata: { path, version: nextVersion, components },
      });
    } catch (e) { console.error("activity log failed (non-blocking)", e); }

    return new Response(JSON.stringify({
      status: "ready",
      path,
      signed_url: signed?.signedUrl ?? null,
      version: nextVersion,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    console.error("generate-submission-pack fatal", e);
    if (submissionIdForStatus && adminForStatus) {
      try {
        await adminForStatus.from("candidate_submissions").update({
          pack_status: "failed",
          pack_error: e instanceof Error ? e.message : String(e),
        }).eq("id", submissionIdForStatus);
      } catch {}
    }
    return fail("Package generation temporarily failed. Please retry.", e);
  }
});
