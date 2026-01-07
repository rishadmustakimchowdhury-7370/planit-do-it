import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { PDFDocument, StandardFonts, rgb } from "https://esm.sh/pdf-lib@1.17.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function uint8ToBase64(bytes: Uint8Array): string {
  let binary = "";
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }
  return btoa(binary);
}

function wrapText(text: string, maxChars: number): string[] {
  // Preserve existing newlines/bullets by only wrapping within a single line/paragraph.
  const words = text.replace(/\s+/g, " ").trim().split(" ");
  const lines: string[] = [];
  let current = "";
  for (const w of words) {
    if (!current) {
      current = w;
      continue;
    }
    if ((current + " " + w).length <= maxChars) {
      current += " " + w;
    } else {
      lines.push(current);
      current = w;
    }
  }
  if (current) lines.push(current);
  return lines;
}

type TextBlock = { kind: "blank" } | { kind: "text"; prefix?: string; text: string };

// Strip HTML tags from content
function stripHtml(html: string): string {
  return String(html || "")
    // Replace <br>, <br/>, <br /> with newlines
    .replace(/<br\s*\/?>/gi, "\n")
    // Replace closing block tags with newlines
    .replace(/<\/(p|div|h[1-6]|li|tr)>/gi, "\n")
    // Replace <li> with bullet
    .replace(/<li[^>]*>/gi, "• ")
    // Remove all other HTML tags
    .replace(/<[^>]+>/g, "")
    // Decode common HTML entities
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&apos;/gi, "'")
    // Clean up extra whitespace
    .replace(/[ \t]+/g, " ")
    .replace(/\n\s*\n\s*\n/g, "\n\n")
    .trim();
}

function parseTextBlocks(raw: string): TextBlock[] {
  // First strip HTML tags
  const cleanText = stripHtml(raw);
  
  const lines = cleanText
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .split("\n");

  const blocks: TextBlock[] = [];
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) {
      blocks.push({ kind: "blank" });
      continue;
    }

    const bulletMatch = trimmed.match(/^([-*•]|\d+\.)\s+(.*)$/);
    if (bulletMatch) {
      blocks.push({ kind: "text", prefix: "•", text: bulletMatch[2] });
    } else {
      blocks.push({ kind: "text", text: trimmed });
    }
  }

  // trim leading/trailing blanks
  while (blocks[0]?.kind === "blank") blocks.shift();
  while (blocks[blocks.length - 1]?.kind === "blank") blocks.pop();
  return blocks;
}

async function fetchLogoBytes(supabaseAdmin: any, logoUrl: string): Promise<{ bytes: Uint8Array; mime: string } | null> {
  const cleanUrl = logoUrl.split('?')[0];
  const m = cleanUrl.match(/\/storage\/v1\/object\/(?:public|sign)\/([^/]+)\/(.+)$/);
  if (m) {
    const bucket = m[1];
    const objectPath = decodeURIComponent(m[2]);
    try {
      const { data, error } = await supabaseAdmin.storage.from(bucket).download(objectPath);
      if (!error && data) {
        const mime = data.type || '';
        const ab = await data.arrayBuffer();
        return { bytes: new Uint8Array(ab), mime };
      }
    } catch {
      // ignore
    }
  }

  try {
    const r = await fetch(logoUrl);
    if (!r.ok) return null;
    const mime = r.headers.get('content-type') || '';
    const bytes = new Uint8Array(await r.arrayBuffer());
    return { bytes, mime };
  } catch {
    return null;
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("Missing authorization header");

    const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const supabaseUser = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: userError } = await supabaseUser.auth.getUser();
    if (userError || !user) throw new Error("Unauthorized");

    const { job_id } = await req.json();
    if (!job_id) throw new Error("job_id is required");

    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("tenant_id")
      .eq("id", user.id)
      .single();

    if (!profile?.tenant_id) throw new Error("User has no tenant");

    const { data: job, error: jobError } = await supabaseAdmin
      .from("jobs")
      .select("id, tenant_id, title, location, salary_min, salary_max, salary_currency, employment_type, experience_level, is_remote, openings, description, requirements")
      .eq("id", job_id)
      .eq("tenant_id", profile.tenant_id)
      .single();

    if (jobError || !job) throw new Error("Job not found");

    // Get branding from tenants table (organization settings)
    const { data: tenant } = await supabaseAdmin
      .from("tenants")
      .select("name, logo_url")
      .eq("id", profile.tenant_id)
      .single();

    // Generate signed URL for logo if it's a storage path
    let branding: { logo_url: string | null; company_name: string | null } = {
      logo_url: null,
      company_name: tenant?.name || null,
    };
    
    if (tenant?.logo_url) {
      if (tenant.logo_url.startsWith('http')) {
        branding.logo_url = tenant.logo_url;
      } else {
        // It's a storage path, generate signed URL
        const { data: signedData } = await supabaseAdmin.storage
          .from('documents')
          .createSignedUrl(tenant.logo_url, 60 * 60); // 1 hour
        if (signedData?.signedUrl) {
          branding.logo_url = signedData.signedUrl;
        }
      }
    }
    
    console.log('JD PDF branding:', {
      company_name: branding.company_name,
      has_logo: !!branding.logo_url,
    });

    const salaryText = (() => {
      if (!job.salary_min && !job.salary_max) return "";
      const currency = job.salary_currency || "USD";
      if (job.salary_min && job.salary_max) return `${currency} ${Number(job.salary_min).toLocaleString()} - ${Number(job.salary_max).toLocaleString()}`;
      if (job.salary_min) return `${currency} ${Number(job.salary_min).toLocaleString()}+`;
      if (job.salary_max) return `Up to ${currency} ${Number(job.salary_max).toLocaleString()}`;
      return "";
    })();

    // Build PDF
    const pdfDoc = await PDFDocument.create();
    const page = pdfDoc.addPage([595.28, 841.89]); // A4
    const { width, height } = page.getSize();

    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

    const margin = 48;
    let y = height - margin;

    // Header with org logo at TOP-RIGHT
    let orgLogoImage: any = null;
    let headerH = 0;

    if (branding?.logo_url) {
      const logo = await fetchLogoBytes(supabaseAdmin, branding.logo_url);
      const urlLower = branding.logo_url.toLowerCase();
      const mimeLower = (logo?.mime || "").toLowerCase();

      if (logo?.bytes?.length) {
        // Support PNG/JPG only (SVG cannot be embedded reliably in edge runtime)
        if (mimeLower.includes("png") || urlLower.endsWith(".png")) {
          orgLogoImage = await pdfDoc.embedPng(logo.bytes);
        } else if (mimeLower.includes("jpeg") || mimeLower.includes("jpg") || urlLower.match(/\.(jpe?g)$/)) {
          orgLogoImage = await pdfDoc.embedJpg(logo.bytes);
        }
      }
    }

    if (orgLogoImage) {
      const maxH = 44;
      const maxW = 200;
      const scale = Math.min(maxW / orgLogoImage.width, maxH / orgLogoImage.height, 1);
      const w = orgLogoImage.width * scale;
      const h = orgLogoImage.height * scale;
      headerH = h;
      page.drawImage(orgLogoImage, {
        x: width - margin - w,
        y: y - h,
        width: w,
        height: h,
      });
    } else if (branding?.company_name) {
      // Fallback: show organization name text in top-right
      const orgNameSize = 16;
      const orgName = String(branding.company_name);
      const orgNameWidth = fontBold.widthOfTextAtSize(orgName, orgNameSize);
      page.drawText(orgName, {
        x: width - margin - orgNameWidth,
        y: y - orgNameSize,
        size: orgNameSize,
        font: fontBold,
        color: rgb(0, 0, 0.545), // dark navy #00008B
      });
      headerH = orgNameSize;
    }

    y -= headerH ? headerH + 18 : 0;

    // Title
    const titleSize = 22;
    page.drawText(String(job.title), {
      x: margin,
      y: y - titleSize,
      size: titleSize,
      font: fontBold,
      color: rgb(0.043, 0.11, 0.55),
    });
    y -= titleSize + 18;

    // Meta lines (no company name)
    const meta: string[] = [];
    if (job.location) meta.push(`Location: ${job.location}`);
    if (salaryText) meta.push(`Salary: ${salaryText}`);
    if (job.employment_type) meta.push(`Type: ${job.employment_type}`);
    if (job.experience_level) meta.push(`Level: ${job.experience_level}`);
    if (job.is_remote) meta.push(`Remote: Yes`);
    if (job.openings) meta.push(`Openings: ${job.openings}`);

    const metaSize = 11;
    for (const line of meta) {
      page.drawText(line, { x: margin, y: y - metaSize, size: metaSize, font, color: rgb(0.25, 0.3, 0.35) });
      y -= metaSize + 6;
    }

    y -= 10;

    const sectionTitleSize = 13;
    const bodySize = 11;

    const drawSection = (title: string, content: string | null) => {
      if (!content || !String(content).trim()) return;

      // Section title
      page.drawText(title, {
        x: margin,
        y: y - sectionTitleSize,
        size: sectionTitleSize,
        font: fontBold,
        color: rgb(0.12, 0.16, 0.23),
      });
      y -= sectionTitleSize + 10;

      // Body: preserve line breaks + bullets
      const blocks = parseTextBlocks(String(content));
      for (const block of blocks) {
        if (y < margin + 60) break; // keep single page for now

        if (block.kind === "blank") {
          y -= bodySize + 8;
          continue;
        }

        const isBullet = Boolean(block.prefix);
        const indent = isBullet ? 14 : 0;
        const maxChars = isBullet ? 84 : 92;

        const wrapped = wrapText(block.text, maxChars);
        wrapped.forEach((line, idx) => {
          if (y < margin + 60) return;

          if (isBullet && idx === 0 && block.prefix) {
            page.drawText(block.prefix, {
              x: margin,
              y: y - bodySize,
              size: bodySize,
              font,
              color: rgb(0.1, 0.1, 0.12),
            });
          }

          page.drawText(line, {
            x: margin + indent,
            y: y - bodySize,
            size: bodySize,
            font,
            color: rgb(0.1, 0.1, 0.12),
          });
          y -= bodySize + 6;
        });
      }

      y -= 14;
    };

    drawSection("Job Description", job.description);
    drawSection("Requirements", job.requirements);

    // Footer
    const footer = "Powered by HireMetrics CRM";
    const footerSize = 10;
    const footerW = font.widthOfTextAtSize(footer, footerSize);
    page.drawText(footer, {
      x: (width - footerW) / 2,
      y: 24,
      size: footerSize,
      font,
      color: rgb(0.58, 0.64, 0.72),
    });

    const pdfBytes = await pdfDoc.save();

    return new Response(
      JSON.stringify({
        success: true,
        file_type: "pdf",
        pdf_base64: uint8ToBase64(pdfBytes),
        file_name: `${String(job.title).replace(/\s+/g, "_")}_JD.pdf`,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error in generate-jd-pdf:", error);
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
