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

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
    if (!RESEND_API_KEY) {
      throw new Error("RESEND_API_KEY not configured");
    }

    const { name, email, whatsapp_number, preferred_date, preferred_time, timezone, message }: DemoBookingRequest = await req.json();

    console.log("Processing demo booking for:", email);

    // Send confirmation email to visitor
    const visitorEmailResponse = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: "Recruitify CRM <onboarding@resend.dev>",
        to: [email],
        subject: "Your Demo is Booked! - Recruitify CRM",
        html: `
          <!DOCTYPE html>
          <html>
          <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
          </head>
          <body style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f5f5f5;">
            <div style="background: linear-gradient(135deg, #0052CC 0%, #0747A6 100%); padding: 30px; border-radius: 12px 12px 0 0; text-align: center;">
              <h1 style="color: white; margin: 0; font-size: 28px;">🎉 Demo Booked!</h1>
            </div>
            
            <div style="background: white; padding: 30px; border-radius: 0 0 12px 12px; box-shadow: 0 4px 12px rgba(0,0,0,0.1);">
              <p style="font-size: 18px; margin-bottom: 20px;">Hi <strong>${name}</strong>,</p>
              
              <p>Thank you for booking a demo with Recruitify CRM! We're excited to show you how our AI-powered platform can transform your hiring process.</p>
              
              <div style="background: #f8f9fa; border-left: 4px solid #0052CC; padding: 20px; margin: 25px 0; border-radius: 4px;">
                <h3 style="margin: 0 0 15px 0; color: #0052CC;">Your Demo Details</h3>
                <p style="margin: 5px 0;"><strong>📅 Date:</strong> ${preferred_date}</p>
                <p style="margin: 5px 0;"><strong>🕐 Time:</strong> ${preferred_time}</p>
                <p style="margin: 5px 0;"><strong>🌍 Timezone:</strong> ${timezone}</p>
                ${whatsapp_number ? `<p style="margin: 5px 0;"><strong>📱 WhatsApp:</strong> ${whatsapp_number}</p>` : ''}
              </div>
              
              <p>Our team will reach out shortly to confirm the meeting and share the calendar invite with video call details.</p>
              
              <p style="margin-top: 30px;">Best regards,<br><strong>The Recruitify CRM Team</strong></p>
            </div>
            
            <div style="text-align: center; padding: 20px; color: #666; font-size: 12px;">
              <p>© ${new Date().getFullYear()} Recruitify CRM. All rights reserved.</p>
              <p>If you have any questions, reply to this email or contact us at info@recruitifycrm.com</p>
            </div>
          </body>
          </html>
        `,
      }),
    });

    console.log("Visitor email sent:", await visitorEmailResponse.json());

    // Send notification email to super admin
    const adminEmailResponse = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: "Recruitify CRM <onboarding@resend.dev>",
        to: ["info@recruitifycrm.com"],
        subject: `New Demo Booking: ${name}`,
        html: `
          <!DOCTYPE html>
          <html>
          <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
          </head>
          <body style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
            <div style="background: #0052CC; padding: 20px; border-radius: 8px 8px 0 0;">
              <h2 style="color: white; margin: 0;">🎯 New Demo Booking</h2>
            </div>
            
            <div style="background: white; padding: 25px; border: 1px solid #e0e0e0; border-top: none; border-radius: 0 0 8px 8px;">
              <h3 style="color: #0052CC; margin-top: 0;">Contact Information</h3>
              <table style="width: 100%; border-collapse: collapse;">
                <tr>
                  <td style="padding: 8px 0; border-bottom: 1px solid #eee; font-weight: bold; width: 140px;">Name:</td>
                  <td style="padding: 8px 0; border-bottom: 1px solid #eee;">${name}</td>
                </tr>
                <tr>
                  <td style="padding: 8px 0; border-bottom: 1px solid #eee; font-weight: bold;">Email:</td>
                  <td style="padding: 8px 0; border-bottom: 1px solid #eee;"><a href="mailto:${email}">${email}</a></td>
                </tr>
                <tr>
                  <td style="padding: 8px 0; border-bottom: 1px solid #eee; font-weight: bold;">WhatsApp:</td>
                  <td style="padding: 8px 0; border-bottom: 1px solid #eee;">${whatsapp_number || 'Not provided'}</td>
                </tr>
              </table>
              
              <h3 style="color: #0052CC; margin-top: 25px;">Requested Schedule</h3>
              <table style="width: 100%; border-collapse: collapse;">
                <tr>
                  <td style="padding: 8px 0; border-bottom: 1px solid #eee; font-weight: bold; width: 140px;">Date:</td>
                  <td style="padding: 8px 0; border-bottom: 1px solid #eee;">${preferred_date}</td>
                </tr>
                <tr>
                  <td style="padding: 8px 0; border-bottom: 1px solid #eee; font-weight: bold;">Time:</td>
                  <td style="padding: 8px 0; border-bottom: 1px solid #eee;">${preferred_time}</td>
                </tr>
                <tr>
                  <td style="padding: 8px 0; border-bottom: 1px solid #eee; font-weight: bold;">Timezone:</td>
                  <td style="padding: 8px 0; border-bottom: 1px solid #eee;">${timezone}</td>
                </tr>
              </table>
              
              ${message ? `
              <h3 style="color: #0052CC; margin-top: 25px;">Message</h3>
              <div style="background: #f8f9fa; padding: 15px; border-radius: 6px;">
                <p style="margin: 0;">${message}</p>
              </div>
              ` : ''}
              
              <div style="margin-top: 25px; padding: 15px; background: #e8f4fd; border-radius: 6px;">
                <p style="margin: 0; color: #0052CC;"><strong>Action Required:</strong> Please confirm this demo booking and send a calendar invite to the visitor.</p>
              </div>
            </div>
          </body>
          </html>
        `,
      }),
    });

    console.log("Admin email sent:", await adminEmailResponse.json());

    return new Response(
      JSON.stringify({ success: true, message: "Demo booking emails sent successfully" }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  } catch (error: any) {
    console.error("Error sending demo booking emails:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
};

serve(handler);
