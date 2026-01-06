import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { PDFDocument, rgb, StandardFonts } from "https://esm.sh/pdf-lib@1.17.1";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface BrandingSettings {
  logo_url: string | null;
  logo_position: string | null;
  company_name: string | null;
  primary_color: string | null;
}

// HireMetrics default logo as SVG
const HIREMETRICS_LOGO_SVG = `
<svg width="140" height="40" viewBox="0 0 140 40" xmlns="http://www.w3.org/2000/svg">
  <rect x="0" y="0" width="40" height="40" rx="8" fill="#0B1C8C"/>
  <text x="20" y="28" font-family="Arial, sans-serif" font-size="24" font-weight="bold" fill="white" text-anchor="middle">H</text>
  <text x="50" y="26" font-family="Arial, sans-serif" font-size="14" font-weight="600" fill="#0B1C8C">HireMetrics</text>
</svg>
`;

// Generate branded PDF HTML wrapper with proper logo embedding
function generateBrandedPdfHtml(
  contentHtml: string,
  orgLogoUrl: string | null,
  companyName: string | null,
  documentType: 'cv' | 'jd',
  candidateOrJobName: string
): string {
  // For org logo, we need to use an img tag with full URL (no data URI needed for external URLs)
  let orgLogoHtml = '';
  if (orgLogoUrl) {
    orgLogoHtml = `<img src="${orgLogoUrl}" alt="${companyName || 'Company'}" style="max-height:50px;max-width:150px;object-fit:contain;display:block;" crossorigin="anonymous" />`;
  } else if (companyName) {
    orgLogoHtml = `<div style="font-size:18px;font-weight:600;color:#0B1C8C;">${companyName}</div>`;
  }

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>${documentType === 'cv' ? 'CV' : 'Job Description'} - ${candidateOrJobName}</title>
  <style>
    @page {
      margin: 20mm;
      size: A4;
    }
    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }
    body {
      font-family: 'Segoe UI', Arial, sans-serif;
      font-size: 11pt;
      line-height: 1.5;
      color: #1a1a1a;
    }
    .branded-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 15px 0;
      margin-bottom: 20px;
      border-bottom: 2px solid #00008B;
    }
    .hiremetrics-logo {
      display: flex;
      align-items: center;
      gap: 10px;
    }
    .hiremetrics-icon {
      width: 40px;
      height: 40px;
      background: linear-gradient(135deg, #00008B 0%, #1E3A8A 100%);
      border-radius: 8px;
      display: flex;
      align-items: center;
      justify-content: center;
      color: white;
      font-weight: bold;
      font-size: 22px;
      line-height: 40px;
      text-align: center;
    }
    .hiremetrics-text {
      font-size: 18px;
      font-weight: 700;
      color: #0F172A;
    }
    .org-logo {
      text-align: right;
    }
    .document-content {
      min-height: 600px;
    }
    .branded-footer {
      margin-top: 30px;
      padding-top: 15px;
      border-top: 1px solid #e5e5e5;
      text-align: center;
      font-size: 9pt;
      color: #666;
    }
  </style>
</head>
<body>
  <div class="branded-header">
    <div class="hiremetrics-logo">
      <div class="hiremetrics-icon">H</div>
      <span class="hiremetrics-text">HireMetrics</span>
    </div>
    <div class="org-logo">
      ${orgLogoHtml}
    </div>
  </div>
  
  <div class="document-content">
    ${contentHtml}
  </div>
  
  <div class="branded-footer">
    Generated via HireMetrics &bull; hiremetrics.co.uk
  </div>
</body>
</html>`;
}

function uint8ToBase64(bytes: Uint8Array): string {
  // Avoid call stack limits on large files by chunking.
  let binary = '';
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }
  return btoa(binary);
}

function base64ToUint8(base64: string): Uint8Array {
  const binaryString = atob(base64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

async function fetchLogoBytes(
  supabaseClient: any,
  logoUrl: string
): Promise<{ bytes: Uint8Array; mime: string; url: string } | null> {
  const cleanUrl = logoUrl.split('?')[0];

  // If this is a Supabase Storage URL, prefer server-side download (works for private buckets too)
  // Examples:
  //  - .../storage/v1/object/public/{bucket}/{path}
  //  - .../storage/v1/object/sign/{bucket}/{path}?token=...
  const m = cleanUrl.match(/\/storage\/v1\/object\/(?:public|sign)\/([^/]+)\/(.+)$/);
  if (m) {
    const bucket = m[1];
    const objectPath = decodeURIComponent(m[2]);

    try {
      const { data, error } = await supabaseClient.storage.from(bucket).download(objectPath);
      if (!error && data) {
        const mime = data.type || '';
        const ab = await data.arrayBuffer();
        return { bytes: new Uint8Array(ab), mime, url: logoUrl };
      }
    } catch (e) {
      console.warn('Storage logo download failed, falling back to fetch:', e);
    }
  }

  // Fallback: regular fetch for public URLs
  try {
    const res = await fetch(logoUrl);
    if (!res.ok) return null;
    const mime = res.headers.get('content-type') || '';
    const ab = await res.arrayBuffer();
    return { bytes: new Uint8Array(ab), mime, url: logoUrl };
  } catch {
    return null;
  }
}

async function brandPdfWithHeader(params: {
  supabaseClient: any;
  pdfBytes: Uint8Array;
  orgLogoUrl: string | null;
  companyName: string | null;
}): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.load(params.pdfBytes);
  const pages = pdfDoc.getPages();

  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  // Try to embed org logo (PNG/JPG). SVGs are not supported by pdf-lib.
  let orgLogoImage: any = null;
  if (params.orgLogoUrl) {
    const logo = await fetchLogoBytes(params.supabaseClient, params.orgLogoUrl);
    const urlLower = params.orgLogoUrl.toLowerCase();
    const mimeLower = (logo?.mime || '').toLowerCase();

    if (logo?.bytes?.length && !mimeLower.includes('svg') && !urlLower.endsWith('.svg')) {
      if (mimeLower.includes('png') || urlLower.endsWith('.png')) {
        orgLogoImage = await pdfDoc.embedPng(logo.bytes);
      } else if (
        mimeLower.includes('jpeg') ||
        mimeLower.includes('jpg') ||
        urlLower.match(/\.(jpe?g)$/)
      ) {
        orgLogoImage = await pdfDoc.embedJpg(logo.bytes);
      }
    }
  }

  const brandBlue = rgb(0.043, 0.11, 0.55);
  const borderGray = rgb(0.9, 0.9, 0.92);

  for (const page of pages) {
    const { width, height } = page.getSize();

    const marginX = 40;
    const top = height - 32;
    const headerHeight = 42;

    // Separator line
    page.drawLine({
      start: { x: marginX, y: top - headerHeight + 6 },
      end: { x: width - marginX, y: top - headerHeight + 6 },
      thickness: 1,
      color: borderGray,
    });

    // Left: HireMetrics wordmark (simple, no external assets)
    page.drawText('HireMetrics', {
      x: marginX,
      y: top - 18,
      size: 14,
      font: fontBold,
      color: brandBlue,
    });

    // Right: Org logo or company name
    if (orgLogoImage) {
      const maxH = 22;
      const maxW = 120;
      const scale = Math.min(maxW / orgLogoImage.width, maxH / orgLogoImage.height, 1);
      const w = orgLogoImage.width * scale;
      const h = orgLogoImage.height * scale;
      page.drawImage(orgLogoImage, {
        x: width - marginX - w,
        y: top - 28,
        width: w,
        height: h,
      });
    } else if (params.companyName) {
      const text = params.companyName;
      const size = 10;
      const textWidth = font.widthOfTextAtSize(text, size);
      page.drawText(text, {
        x: Math.max(marginX, width - marginX - textWidth),
        y: top - 22,
        size,
        font,
        color: rgb(0.25, 0.3, 0.35),
      });
    }
  }

  return await pdfDoc.save();
}

// Extract text content from common document types
async function extractDocumentContent(
  fileBuffer: ArrayBuffer, 
  fileType: string,
  fileName: string
): Promise<string> {
  // For PDF files, we create a wrapper that embeds the original
  // For text/html files, we can process directly
  
  const decoder = new TextDecoder('utf-8', { fatal: false });
  
  if (fileType.includes('text/html') || fileName.endsWith('.html')) {
    const text = decoder.decode(fileBuffer);
    // Extract body content if present
    const bodyMatch = text.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
    return bodyMatch ? bodyMatch[1] : text;
  }
  
  if (fileType.includes('text/plain') || fileName.endsWith('.txt')) {
    const text = decoder.decode(fileBuffer);
    return `<pre style="white-space:pre-wrap;font-family:inherit;">${text.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</pre>`;
  }

  // For PDF and other binary formats, return placeholder with original file info
  // The frontend will handle embedding the original PDF with branding overlay
  return `
    <div style="padding:20px;text-align:center;color:#666;">
      <p style="font-size:14px;margin-bottom:10px;">📄 <strong>${fileName}</strong></p>
      <p style="font-size:12px;">This document has been branded with your organization's logo.</p>
      <p style="font-size:11px;color:#999;margin-top:10px;">Original file preserved • Branding applied to header only</p>
    </div>
  `;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('Missing authorization header');
    }

    // Get user from auth header
    const { data: { user }, error: userError } = await supabaseClient.auth.getUser(
      authHeader.replace('Bearer ', '')
    );

    if (userError || !user) {
      throw new Error('Unauthorized');
    }

    // Get tenant_id from profile
    const { data: profile, error: profileError } = await supabaseClient
      .from('profiles')
      .select('tenant_id')
      .eq('id', user.id)
      .single();

    if (profileError || !profile?.tenant_id) {
      throw new Error('Tenant not found');
    }

    // Get user role to check permissions
    const { data: userRole } = await supabaseClient
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .eq('tenant_id', profile.tenant_id)
      .single();

    const allowedRoles = ['owner', 'manager', 'recruiter'];
    if (!userRole || !allowedRoles.includes(userRole.role)) {
      throw new Error('Insufficient permissions to download branded documents');
    }

    const { 
      file_url, 
      document_type = 'cv',
      entity_name = 'Document'
    } = await req.json();

    if (!file_url) {
      throw new Error('File URL is required');
    }

    // Get branding settings for the organization
    const { data: branding, error: brandingError } = await supabaseClient
      .from('branding_settings')
      .select('logo_url, logo_position, company_name, primary_color')
      .eq('tenant_id', profile.tenant_id)
      .maybeSingle();

    if (brandingError) {
      console.error('Error fetching branding:', brandingError);
    }

    const brandingSettings: BrandingSettings | null = branding;

    // Extract file path from URL
    let filePath = file_url;
    if (filePath.includes('/documents/')) {
      filePath = filePath.split('/documents/').pop() || filePath;
    }
    filePath = filePath.split('?')[0];

    // Download original file from storage
    const { data: fileData, error: downloadError } = await supabaseClient.storage
      .from('documents')
      .download(filePath);

    if (downloadError || !fileData) {
      console.error('Download error:', downloadError);
      throw new Error('Failed to download file');
    }

    // Get file type and name
    const fileName = filePath.split('/').pop() || 'document';
    const fileType = fileData.type || 'application/octet-stream';
    const fileBuffer = await fileData.arrayBuffer();
    const fileExtension = fileName.split('.').pop()?.toLowerCase() || '';

    console.log('Processing document:', { fileName, fileType, fileExtension, documentType: document_type });

    // If the original is a PDF, generate a *real branded PDF* (org logo embedded into pages)
     if (fileExtension === 'pdf') {
       const brandedPdfBytes = await brandPdfWithHeader({
         supabaseClient,
         pdfBytes: new Uint8Array(fileBuffer),
         orgLogoUrl: brandingSettings?.logo_url || null,
         companyName: brandingSettings?.company_name || null,
       });

      return new Response(
        JSON.stringify({
          success: true,
          message: 'Document branded successfully',
          branded_pdf_base64: uint8ToBase64(brandedPdfBytes),
          original_file_name: fileName,
          file_type: 'pdf',
          branding_applied: {
            logo_position: 'header',
            company_name: brandingSettings?.company_name || null,
            logo_url: brandingSettings?.logo_url || null,
            has_org_logo: !!brandingSettings?.logo_url,
            has_hiremetrics_logo: true,
          },
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200,
        }
      );
    }

    // For DOCX/other formats, extract content and generate branded HTML
    const extractedContent = await extractDocumentContent(fileBuffer, fileType, fileName);
    
    const brandedHtml = generateBrandedPdfHtml(
      extractedContent,
      brandingSettings?.logo_url || null,
      brandingSettings?.company_name || null,
      document_type as 'cv' | 'jd',
      entity_name
    );

    // Convert original to base64 for download option (chunked to avoid call stack limits)
    const originalBase64 = uint8ToBase64(new Uint8Array(fileBuffer));

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Document branded successfully',
        branded_html: brandedHtml,
        original_file_base64: originalBase64,
        original_file_name: fileName,
        file_type: fileExtension,
        branding_applied: {
          logo_position: 'header',
          company_name: brandingSettings?.company_name || null,
          logo_url: brandingSettings?.logo_url || null,
          has_org_logo: !!brandingSettings?.logo_url,
          has_hiremetrics_logo: true
        }
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );

  } catch (error) {
    console.error('Error in brand-cv function:', error);
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : 'Unknown error',
        success: false 
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      }
    );
  }
});
