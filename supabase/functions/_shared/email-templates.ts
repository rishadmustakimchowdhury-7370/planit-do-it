/**
 * HireMetrics Email Template Engine
 * 
 * Provides enterprise-grade HTML email templates with proper branding:
 * - System emails: HireMetrics logo only
 * - Operational emails: Dual logo (HireMetrics left + Org logo right)
 * 
 * All templates use:
 * - Content-Type: text/html; charset=UTF-8
 * - Content-Transfer-Encoding: base64
 * - Inline CSS only
 * - Absolute URLs
 * - target="_blank" for all links
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

// ============================================================================
// CONSTANTS
// ============================================================================

export const HIREMETRICS_BRAND = {
  name: "HireMetrics",
  tagline: "Recruitment Performance OS",
  website: "https://hiremetrics.co.uk",
  supportEmail: "admin@hiremetrics.co.uk",
  primaryColor: "#00008B", // Dark navy blue
  secondaryColor: "#1E3A8A",
};

// ============================================================================
// HIREMETRICS LOGO SVG (Pure HTML - no external dependencies)
// ============================================================================

export function getHireMetricsLogoHTML(size: "sm" | "md" | "lg" = "md"): string {
  const sizes = {
    sm: { icon: 20, fontSize: "14px", padding: "6px", boxSize: 32 },
    md: { icon: 24, fontSize: "18px", padding: "8px", boxSize: 40 },
    lg: { icon: 32, fontSize: "22px", padding: "10px", boxSize: 52 },
  };
  
  const { fontSize, padding, boxSize } = sizes[size];
  
  // Use table-based layout for maximum email client compatibility
  // The icon is represented by styled text/shapes that work in all clients
  return `
    <table cellpadding="0" cellspacing="0" border="0" style="display:inline-table;">
      <tr>
        <td style="vertical-align:middle;">
          <div style="background:linear-gradient(135deg, ${HIREMETRICS_BRAND.primaryColor} 0%, ${HIREMETRICS_BRAND.secondaryColor} 100%); border-radius:10px; padding:${padding}; display:inline-block; width:${boxSize}px; height:${boxSize}px; text-align:center; line-height:${boxSize - 12}px;">
            <span style="font-family:Arial,sans-serif; font-size:${parseInt(fontSize) + 4}px; font-weight:900; color:#ffffff; letter-spacing:-2px;">H</span>
          </div>
        </td>
        <td style="vertical-align:middle; padding-left:10px;">
          <table cellpadding="0" cellspacing="0" border="0">
            <tr>
              <td style="font-family:'Segoe UI',Tahoma,Geneva,Verdana,sans-serif; font-weight:700; font-size:${fontSize}; color:#0F172A; line-height:1.2;">
                HireMetrics
              </td>
            </tr>
            <tr>
              <td style="font-family:Arial,sans-serif; font-size:9px; color:#64748B; text-transform:uppercase; letter-spacing:0.5px;">
                Recruitment Performance OS
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  `.trim();
}

// Simpler inline logo for smaller spaces
export function getHireMetricsLogoInline(): string {
  return `
    <table cellpadding="0" cellspacing="0" border="0" style="display:inline-table;">
      <tr>
        <td style="vertical-align:middle;">
          <div style="background:linear-gradient(135deg, ${HIREMETRICS_BRAND.primaryColor} 0%, ${HIREMETRICS_BRAND.secondaryColor} 100%); border-radius:8px; padding:6px; display:inline-block; width:30px; height:30px; text-align:center; line-height:18px;">
            <span style="font-family:Arial,sans-serif; font-size:16px; font-weight:900; color:#ffffff;">H</span>
          </div>
        </td>
        <td style="vertical-align:middle; padding-left:8px; font-family:'Segoe UI',Tahoma,Geneva,Verdana,sans-serif; font-weight:600; font-size:14px; color:#0F172A;">
          HireMetrics
        </td>
      </tr>
    </table>
  `.trim();
}

// ============================================================================
// ORGANIZATION LOGO HELPER
// ============================================================================

interface OrgBranding {
  logoUrl: string | null;
  companyName: string | null;
  primaryColor: string | null;
}

export async function getOrgBranding(tenantId: string): Promise<OrgBranding> {
  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );
    
    const { data } = await supabase
      .from("branding_settings")
      .select("logo_url, company_name, primary_color")
      .eq("tenant_id", tenantId)
      .maybeSingle();
    
    if (data) {
      return {
        logoUrl: data.logo_url,
        companyName: data.company_name,
        primaryColor: data.primary_color,
      };
    }
    
    // Fallback: try to get org name from tenants table
    const { data: tenant } = await supabase
      .from("tenants")
      .select("name")
      .eq("id", tenantId)
      .maybeSingle();
    
    return {
      logoUrl: null,
      companyName: tenant?.name || null,
      primaryColor: null,
    };
  } catch (error) {
    console.error("[EMAIL-TEMPLATES] Failed to fetch org branding:", error);
    return { logoUrl: null, companyName: null, primaryColor: null };
  }
}

function getOrgLogoHTML(branding: OrgBranding): string {
  if (!branding.logoUrl && !branding.companyName) {
    return "";
  }
  
  const color = branding.primaryColor || "#374151";
  
  if (branding.logoUrl) {
    return `
      <table cellpadding="0" cellspacing="0" border="0" style="display:inline-table;">
        <tr>
          <td style="vertical-align:middle;">
            <img src="${branding.logoUrl}" 
                 alt="${branding.companyName || 'Organization'}" 
                 height="40" 
                 style="display:block; border:0; max-width:150px; height:auto; max-height:40px;" />
          </td>
        </tr>
      </table>
    `.trim();
  }
  
  // Text fallback if no logo
  return `
    <table cellpadding="0" cellspacing="0" border="0" style="display:inline-table;">
      <tr>
        <td style="vertical-align:middle;">
          <div style="background:${color}; border-radius:8px; padding:8px 12px; display:inline-block;">
            <span style="font-family:'Segoe UI',Tahoma,Geneva,Verdana,sans-serif; font-weight:600; font-size:14px; color:#ffffff;">
              ${branding.companyName || "Organization"}
            </span>
          </div>
        </td>
      </tr>
    </table>
  `.trim();
}

// ============================================================================
// EMAIL HEADER BUILDERS
// ============================================================================

/**
 * System Email Header - HireMetrics logo only (centered)
 * Used for: signup, verification, password reset, billing
 */
export function buildSystemEmailHeader(): string {
  return `
    <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#f8fafc; padding:24px 0;">
      <tr>
        <td align="center">
          ${getHireMetricsLogoHTML("lg")}
        </td>
      </tr>
    </table>
  `.trim();
}

/**
 * Operational Email Header - Dual logos
 * HireMetrics (left) + Organization logo (right)
 * Used for: candidate emails, client emails, job updates, team notifications
 */
export function buildOperationalEmailHeader(orgBranding: OrgBranding): string {
  const orgLogo = getOrgLogoHTML(orgBranding);
  
  return `
    <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#f8fafc; padding:20px 24px;">
      <tr>
        <td align="left" style="width:50%;">
          ${getHireMetricsLogoInline()}
        </td>
        <td align="right" style="width:50%;">
          ${orgLogo}
        </td>
      </tr>
    </table>
  `.trim();
}

// ============================================================================
// EMAIL FOOTER BUILDERS
// ============================================================================

export function buildSystemEmailFooter(): string {
  const year = new Date().getFullYear();
  
  return `
    <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#f1f5f9; padding:24px; margin-top:32px;">
      <tr>
        <td align="center">
          <table cellpadding="0" cellspacing="0" border="0">
            <tr>
              <td align="center" style="padding-bottom:16px;">
                ${getHireMetricsLogoInline()}
              </td>
            </tr>
            <tr>
              <td align="center" style="font-family:Arial,sans-serif; font-size:12px; color:#64748B; line-height:1.6;">
                <p style="margin:0 0 8px 0;">
                  © ${year} HireMetrics. All rights reserved.
                </p>
                <p style="margin:0;">
                  <a href="${HIREMETRICS_BRAND.website}" target="_blank" rel="noopener noreferrer" style="color:#00008B; text-decoration:none;">
                    ${HIREMETRICS_BRAND.website}
                  </a>
                </p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  `.trim();
}

export function buildOperationalEmailFooter(orgBranding: OrgBranding): string {
  const year = new Date().getFullYear();
  const orgName = orgBranding.companyName || "Your Organization";
  
  return `
    <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#f1f5f9; padding:24px; margin-top:32px;">
      <tr>
        <td align="center">
          <p style="margin:0 0 12px 0; font-family:Arial,sans-serif; font-size:12px; color:#64748B;">
            This email was sent on behalf of <strong style="color:#374151;">${orgName}</strong>
          </p>
          <table cellpadding="0" cellspacing="0" border="0" style="margin:12px 0;">
            <tr>
              <td style="padding:8px 20px; background:linear-gradient(135deg, #00008B 0%, #1E3A8A 100%); border-radius:6px;">
                <span style="font-family:'Segoe UI',Arial,sans-serif; font-size:11px; color:#ffffff; font-weight:500;">
                  Powered by <strong>HireMetrics CRM</strong>
                </span>
              </td>
            </tr>
          </table>
          <p style="margin:12px 0 0 0; font-family:Arial,sans-serif; font-size:10px; color:#94a3b8;">
            © ${year} HireMetrics. All rights reserved. | 
            <a href="${HIREMETRICS_BRAND.website}" target="_blank" rel="noopener noreferrer" style="color:#00008B; text-decoration:none;">
              hiremetrics.co.uk
            </a>
          </p>
        </td>
      </tr>
    </table>
  `.trim();
}

// ============================================================================
// EMAIL BUTTON BUILDER (ENTERPRISE STANDARD)
// ============================================================================

export function buildEmailButton(
  text: string,
  url: string,
  options?: {
    variant?: "primary" | "secondary" | "outline";
    fullWidth?: boolean;
  }
): string {
  const { variant = "primary", fullWidth = false } = options || {};
  
  const styles = {
    primary: {
      bg: HIREMETRICS_BRAND.primaryColor,
      color: "#ffffff",
      border: "none",
    },
    secondary: {
      bg: "#f1f5f9",
      color: "#0f172a",
      border: "1px solid #e2e8f0",
    },
    outline: {
      bg: "transparent",
      color: HIREMETRICS_BRAND.primaryColor,
      border: `2px solid ${HIREMETRICS_BRAND.primaryColor}`,
    },
  };
  
  const style = styles[variant];
  const width = fullWidth ? "width:100%;" : "";
  
  // MUST be an <a> tag, not a button
  // MUST have absolute URL
  // MUST have target="_blank"
  return `
    <table cellpadding="0" cellspacing="0" border="0" ${fullWidth ? 'width="100%"' : ""}>
      <tr>
        <td align="center">
          <a href="${url}" 
             target="_blank" 
             rel="noopener noreferrer"
             style="
               display:inline-block;
               ${width}
               padding:14px 32px;
               background-color:${style.bg};
               color:${style.color};
               text-decoration:none;
               font-family:'Segoe UI',Tahoma,Geneva,Verdana,sans-serif;
               font-size:16px;
               font-weight:600;
               border-radius:8px;
               border:${style.border};
               text-align:center;
               mso-padding-alt:0;
             ">
            <!--[if mso]>
            <i style="letter-spacing:32px;mso-font-width:-100%;mso-text-raise:24pt;">&nbsp;</i>
            <![endif]-->
            <span style="mso-text-raise:12pt;">${text}</span>
            <!--[if mso]>
            <i style="letter-spacing:32px;mso-font-width:-100%;">&nbsp;</i>
            <![endif]-->
          </a>
        </td>
      </tr>
    </table>
  `.trim();
}

// ============================================================================
// FULL EMAIL TEMPLATE WRAPPERS
// ============================================================================

/**
 * Wrap content in a complete system email template
 * Used for: signup, verification, password reset, billing, security
 */
export function wrapSystemEmail(bodyContent: string): string {
  return `
<!DOCTYPE html>
<html lang="en" xmlns="http://www.w3.org/1999/xhtml" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <meta name="format-detection" content="telephone=no, date=no, address=no, email=no">
  <meta name="x-apple-disable-message-reformatting">
  <title>HireMetrics</title>
  <!--[if mso]>
  <noscript>
    <xml>
      <o:OfficeDocumentSettings>
        <o:PixelsPerInch>96</o:PixelsPerInch>
      </o:OfficeDocumentSettings>
    </xml>
  </noscript>
  <![endif]-->
</head>
<body style="margin:0; padding:0; background-color:#f8fafc; font-family:'Segoe UI',Tahoma,Geneva,Verdana,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#f8fafc;">
    <tr>
      <td align="center" style="padding:40px 20px;">
        <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="max-width:600px; width:100%; background-color:#ffffff; border-radius:12px; overflow:hidden; box-shadow:0 4px 6px -1px rgba(0,0,0,0.1);">
          <tr>
            <td>
              ${buildSystemEmailHeader()}
            </td>
          </tr>
          <tr>
            <td style="padding:32px 40px;">
              ${bodyContent}
            </td>
          </tr>
          <tr>
            <td>
              ${buildSystemEmailFooter()}
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `.trim();
}

/**
 * Wrap content in a complete operational email template
 * Used for: candidate emails, client emails, job updates, team notifications
 */
export function wrapOperationalEmail(bodyContent: string, orgBranding: OrgBranding): string {
  return `
<!DOCTYPE html>
<html lang="en" xmlns="http://www.w3.org/1999/xhtml" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <meta name="format-detection" content="telephone=no, date=no, address=no, email=no">
  <meta name="x-apple-disable-message-reformatting">
  <title>Email from ${orgBranding.companyName || "HireMetrics"}</title>
  <!--[if mso]>
  <noscript>
    <xml>
      <o:OfficeDocumentSettings>
        <o:PixelsPerInch>96</o:PixelsPerInch>
      </o:OfficeDocumentSettings>
    </xml>
  </noscript>
  <![endif]-->
</head>
<body style="margin:0; padding:0; background-color:#f8fafc; font-family:'Segoe UI',Tahoma,Geneva,Verdana,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#f8fafc;">
    <tr>
      <td align="center" style="padding:40px 20px;">
        <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="max-width:600px; width:100%; background-color:#ffffff; border-radius:12px; overflow:hidden; box-shadow:0 4px 6px -1px rgba(0,0,0,0.1);">
          <tr>
            <td>
              ${buildOperationalEmailHeader(orgBranding)}
            </td>
          </tr>
          <tr>
            <td style="padding:32px 40px;">
              ${bodyContent}
            </td>
          </tr>
          <tr>
            <td>
              ${buildOperationalEmailFooter(orgBranding)}
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `.trim();
}

// ============================================================================
// TEXT STYLING HELPERS
// ============================================================================

export function emailHeading(text: string, level: 1 | 2 | 3 = 1): string {
  const sizes = {
    1: { fontSize: "24px", marginBottom: "16px" },
    2: { fontSize: "20px", marginBottom: "12px" },
    3: { fontSize: "16px", marginBottom: "8px" },
  };
  const { fontSize, marginBottom } = sizes[level];
  
  return `
    <p style="margin:0 0 ${marginBottom} 0; font-family:'Segoe UI',Tahoma,Geneva,Verdana,sans-serif; font-size:${fontSize}; font-weight:700; color:#0f172a; line-height:1.3;">
      ${text}
    </p>
  `.trim();
}

export function emailParagraph(text: string): string {
  return `
    <p style="margin:0 0 16px 0; font-family:Arial,sans-serif; font-size:15px; color:#374151; line-height:1.6;">
      ${text}
    </p>
  `.trim();
}

export function emailDivider(): string {
  return `
    <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:24px 0;">
      <tr>
        <td style="border-top:1px solid #e2e8f0;"></td>
      </tr>
    </table>
  `.trim();
}

export function emailInfoBox(content: string, variant: "info" | "success" | "warning" = "info"): string {
  const colors = {
    info: { bg: "#eff6ff", border: "#3b82f6", text: "#1e40af" },
    success: { bg: "#f0fdf4", border: "#22c55e", text: "#166534" },
    warning: { bg: "#fffbeb", border: "#f59e0b", text: "#92400e" },
  };
  const { bg, border, text } = colors[variant];
  
  return `
    <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:16px 0;">
      <tr>
        <td style="background-color:${bg}; border-left:4px solid ${border}; padding:16px; border-radius:0 8px 8px 0;">
          <p style="margin:0; font-family:Arial,sans-serif; font-size:14px; color:${text}; line-height:1.5;">
            ${content}
          </p>
        </td>
      </tr>
    </table>
  `.trim();
}
