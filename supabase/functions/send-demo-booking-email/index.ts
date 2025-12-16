import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface DemoBookingRequest {
  name: string;
  email: string;
  whatsapp_number?: string;
  preferred_date: string;
  preferred_time: string;
  timezone: string;
  message?: string;
}

const getVisitorEmailTemplate = (data: DemoBookingRequest) => `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f8fafc;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f8fafc; padding: 40px 20px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 16px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.05); overflow: hidden;">
          <!-- Header with Logo -->
          <tr>
            <td style="background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%); padding: 32px 40px; text-align: center;">
              <table cellpadding="0" cellspacing="0" style="margin: 0 auto;">
                <tr>
                  <td style="vertical-align: middle;">
                    <div style="width: 48px; height: 48px; background-color: #14b8a6; border-radius: 12px; display: inline-flex; align-items: center; justify-content: center;">
                      <span style="color: white; font-size: 24px;">💼</span>
                    </div>
                  </td>
                  <td style="vertical-align: middle; padding-left: 12px;">
                    <span style="color: #ffffff; font-size: 28px; font-weight: 700; letter-spacing: -0.5px;">Recruitify</span>
                    <span style="color: #14b8a6; font-size: 28px; font-weight: 700;"> CRM</span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          
          <!-- Success Icon -->
          <tr>
            <td style="padding: 40px 40px 20px; text-align: center;">
              <div style="width: 80px; height: 80px; background-color: #ecfdf5; border-radius: 50%; display: inline-flex; align-items: center; justify-content: center; margin: 0 auto;">
                <span style="font-size: 40px;">✅</span>
              </div>
            </td>
          </tr>
          
          <!-- Content -->
          <tr>
            <td style="padding: 0 40px 40px;">
              <h1 style="color: #0f172a; font-size: 28px; font-weight: 700; margin: 0 0 16px; text-align: center;">Demo Booking Confirmed!</h1>
              <p style="color: #64748b; font-size: 16px; line-height: 1.6; margin: 0 0 24px; text-align: center;">
                Thank you, <strong style="color: #0f172a;">${data.name}</strong>! Your demo request has been received. Our team will reach out to you shortly.
              </p>
              
              <!-- Booking Details Card -->
              <div style="background-color: #f8fafc; border-radius: 12px; padding: 24px; margin-bottom: 24px;">
                <h2 style="color: #0f172a; font-size: 18px; font-weight: 600; margin: 0 0 16px; border-bottom: 2px solid #e2e8f0; padding-bottom: 12px;">📅 Your Booking Details</h2>
                <table width="100%" cellpadding="0" cellspacing="0">
                  <tr>
                    <td style="padding: 8px 0;">
                      <span style="color: #64748b; font-size: 14px;">Date:</span>
                    </td>
                    <td style="padding: 8px 0; text-align: right;">
                      <span style="color: #0f172a; font-size: 14px; font-weight: 600;">${data.preferred_date}</span>
                    </td>
                  </tr>
                  <tr>
                    <td style="padding: 8px 0;">
                      <span style="color: #64748b; font-size: 14px;">Time:</span>
                    </td>
                    <td style="padding: 8px 0; text-align: right;">
                      <span style="color: #0f172a; font-size: 14px; font-weight: 600;">${data.preferred_time}</span>
                    </td>
                  </tr>
                  <tr>
                    <td style="padding: 8px 0;">
                      <span style="color: #64748b; font-size: 14px;">Timezone:</span>
                    </td>
                    <td style="padding: 8px 0; text-align: right;">
                      <span style="color: #0f172a; font-size: 14px; font-weight: 600;">${data.timezone}</span>
                    </td>
                  </tr>
                </table>
              </div>
              
              <p style="color: #64748b; font-size: 14px; line-height: 1.6; margin: 0; text-align: center;">
                We're excited to show you how Recruitify CRM can transform your recruitment process! 🚀
              </p>
            </td>
          </tr>
          
          <!-- Footer -->
          <tr>
            <td style="background-color: #f8fafc; padding: 24px 40px; text-align: center; border-top: 1px solid #e2e8f0;">
              <p style="color: #94a3b8; font-size: 12px; margin: 0 0 8px;">
                © ${new Date().getFullYear()} Recruitify CRM. All rights reserved.
              </p>
              <p style="color: #94a3b8; font-size: 12px; margin: 0;">
                <a href="mailto:info@recruitifycrm.com" style="color: #14b8a6; text-decoration: none;">info@recruitifycrm.com</a>
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
`;

const getAdminEmailTemplate = (data: DemoBookingRequest) => `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f8fafc;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f8fafc; padding: 40px 20px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 16px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.05); overflow: hidden;">
          <!-- Header with Logo -->
          <tr>
            <td style="background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%); padding: 32px 40px; text-align: center;">
              <table cellpadding="0" cellspacing="0" style="margin: 0 auto;">
                <tr>
                  <td style="vertical-align: middle;">
                    <div style="width: 48px; height: 48px; background-color: #14b8a6; border-radius: 12px; display: inline-flex; align-items: center; justify-content: center;">
                      <span style="color: white; font-size: 24px;">💼</span>
                    </div>
                  </td>
                  <td style="vertical-align: middle; padding-left: 12px;">
                    <span style="color: #ffffff; font-size: 28px; font-weight: 700; letter-spacing: -0.5px;">Recruitify</span>
                    <span style="color: #14b8a6; font-size: 28px; font-weight: 700;"> CRM</span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          
          <!-- Alert Badge -->
          <tr>
            <td style="padding: 40px 40px 20px; text-align: center;">
              <div style="display: inline-block; background-color: #fef3c7; color: #92400e; padding: 8px 16px; border-radius: 20px; font-size: 14px; font-weight: 600;">
                🔔 New Demo Request
              </div>
            </td>
          </tr>
          
          <!-- Content -->
          <tr>
            <td style="padding: 0 40px 40px;">
              <h1 style="color: #0f172a; font-size: 24px; font-weight: 700; margin: 0 0 24px; text-align: center;">New Demo Booking Request</h1>
              
              <!-- Contact Info Card -->
              <div style="background-color: #f0fdf4; border-radius: 12px; padding: 24px; margin-bottom: 20px; border-left: 4px solid #22c55e;">
                <h2 style="color: #0f172a; font-size: 16px; font-weight: 600; margin: 0 0 16px;">👤 Contact Information</h2>
                <table width="100%" cellpadding="0" cellspacing="0">
                  <tr>
                    <td style="padding: 6px 0;">
                      <span style="color: #64748b; font-size: 14px;">Name:</span>
                    </td>
                    <td style="padding: 6px 0; text-align: right;">
                      <span style="color: #0f172a; font-size: 14px; font-weight: 600;">${data.name}</span>
                    </td>
                  </tr>
                  <tr>
                    <td style="padding: 6px 0;">
                      <span style="color: #64748b; font-size: 14px;">Email:</span>
                    </td>
                    <td style="padding: 6px 0; text-align: right;">
                      <a href="mailto:${data.email}" style="color: #14b8a6; font-size: 14px; font-weight: 600; text-decoration: none;">${data.email}</a>
                    </td>
                  </tr>
                  ${data.whatsapp_number ? `
                  <tr>
                    <td style="padding: 6px 0;">
                      <span style="color: #64748b; font-size: 14px;">WhatsApp:</span>
                    </td>
                    <td style="padding: 6px 0; text-align: right;">
                      <a href="https://wa.me/${data.whatsapp_number.replace(/[^0-9]/g, '')}" style="color: #25d366; font-size: 14px; font-weight: 600; text-decoration: none;">${data.whatsapp_number}</a>
                    </td>
                  </tr>
                  ` : ''}
                </table>
              </div>
              
              <!-- Schedule Card -->
              <div style="background-color: #eff6ff; border-radius: 12px; padding: 24px; margin-bottom: 20px; border-left: 4px solid #3b82f6;">
                <h2 style="color: #0f172a; font-size: 16px; font-weight: 600; margin: 0 0 16px;">📅 Preferred Schedule</h2>
                <table width="100%" cellpadding="0" cellspacing="0">
                  <tr>
                    <td style="padding: 6px 0;">
                      <span style="color: #64748b; font-size: 14px;">Date:</span>
                    </td>
                    <td style="padding: 6px 0; text-align: right;">
                      <span style="color: #0f172a; font-size: 14px; font-weight: 600;">${data.preferred_date}</span>
                    </td>
                  </tr>
                  <tr>
                    <td style="padding: 6px 0;">
                      <span style="color: #64748b; font-size: 14px;">Time:</span>
                    </td>
                    <td style="padding: 6px 0; text-align: right;">
                      <span style="color: #0f172a; font-size: 14px; font-weight: 600;">${data.preferred_time}</span>
                    </td>
                  </tr>
                  <tr>
                    <td style="padding: 6px 0;">
                      <span style="color: #64748b; font-size: 14px;">Timezone:</span>
                    </td>
                    <td style="padding: 6px 0; text-align: right;">
                      <span style="color: #0f172a; font-size: 14px; font-weight: 600;">${data.timezone}</span>
                    </td>
                  </tr>
                </table>
              </div>
              
              ${data.message ? `
              <!-- Message Card -->
              <div style="background-color: #faf5ff; border-radius: 12px; padding: 24px; border-left: 4px solid #a855f7;">
                <h2 style="color: #0f172a; font-size: 16px; font-weight: 600; margin: 0 0 12px;">💬 Message</h2>
                <p style="color: #475569; font-size: 14px; line-height: 1.6; margin: 0;">${data.message}</p>
              </div>
              ` : ''}
              
              <!-- Action Card -->
              <div style="background-color: #fef3c7; border-radius: 12px; padding: 20px; margin-top: 20px; text-align: center;">
                <p style="color: #92400e; font-size: 14px; font-weight: 500; margin: 0;">
                  ⚡ Action Required: Please confirm this demo booking and send a calendar invite.
                </p>
              </div>
            </td>
          </tr>
          
          <!-- Footer -->
          <tr>
            <td style="background-color: #f8fafc; padding: 24px 40px; text-align: center; border-top: 1px solid #e2e8f0;">
              <p style="color: #94a3b8; font-size: 12px; margin: 0;">
                This is an automated notification from Recruitify CRM
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
`;

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
    if (!RESEND_API_KEY) {
      throw new Error("RESEND_API_KEY not configured");
    }

    const data: DemoBookingRequest = await req.json();
    console.log("Processing demo booking for:", data.email);

    const results = {
      visitorEmail: null as any,
      adminEmail: null as any,
    };

    // Send confirmation email to visitor
    try {
      const visitorResponse = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${RESEND_API_KEY}`,
        },
        body: JSON.stringify({
          from: "Recruitify CRM <info@recruitifycrm.com>",
          to: [data.email],
          subject: "🎉 Your Demo Booking is Confirmed - Recruitify CRM",
          html: getVisitorEmailTemplate(data),
        }),
      });
      results.visitorEmail = await visitorResponse.json();
      console.log("Visitor email result:", JSON.stringify(results.visitorEmail));
    } catch (error: any) {
      console.error("Error sending visitor email:", error);
      results.visitorEmail = { error: error.message };
    }

    // Send notification email to admin
    try {
      const adminResponse = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${RESEND_API_KEY}`,
        },
        body: JSON.stringify({
          from: "Recruitify CRM <info@recruitifycrm.com>",
          to: ["info@recruitifycrm.com"],
          subject: `🔔 New Demo Request from ${data.name}`,
          html: getAdminEmailTemplate(data),
        }),
      });
      results.adminEmail = await adminResponse.json();
      console.log("Admin email result:", JSON.stringify(results.adminEmail));
    } catch (error: any) {
      console.error("Error sending admin email:", error);
      results.adminEmail = { error: error.message };
    }

    return new Response(
      JSON.stringify({ success: true, results }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  } catch (error: any) {
    console.error("Error in send-demo-booking-email:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
};

serve(handler);
