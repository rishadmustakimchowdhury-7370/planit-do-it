import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { email, role, token, tenant_id, invited_by_name } = await req.json();

    if (!email || !token) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY');
    if (!RESEND_API_KEY) {
      console.error('RESEND_API_KEY not configured');
      return new Response(
        JSON.stringify({ error: 'Email service not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get the app URL from request origin or environment
    const origin = req.headers.get('origin') || req.headers.get('referer')?.split('/').slice(0, 3).join('/');
    const appUrl = origin || Deno.env.get('APP_URL') || 'http://localhost:3000';
    const inviteUrl = `${appUrl}/accept-invitation?token=${token}`;

    const roleLabels: Record<string, string> = {
      admin: 'Owner',
      manager: 'Manager',
      recruiter: 'Recruiter',
      support: 'Support',
      viewer: 'Viewer',
    };

    const roleName = roleLabels[role] || role;

    const emailHtml = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Team Invitation</title>
        </head>
        <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 0; padding: 0; background-color: #f4f4f5;">
          <div style="max-width: 600px; margin: 0 auto; padding: 40px 20px;">
            <div style="background: white; border-radius: 12px; padding: 40px; box-shadow: 0 2px 8px rgba(0,0,0,0.08);">
              <div style="text-align: center; margin-bottom: 32px;">
                <h1 style="color: #0052CC; font-size: 24px; margin: 0 0 8px 0;">🎉 You're Invited!</h1>
                <p style="color: #64748b; font-size: 16px; margin: 0;">Join your team on RecruitifyCRM</p>
              </div>
              
              <div style="background: #f8fafc; border-radius: 8px; padding: 24px; margin-bottom: 24px;">
                <p style="margin: 0 0 12px 0; color: #334155;">
                  <strong>${invited_by_name}</strong> has invited you to join their recruitment team as a <strong>${roleName}</strong>.
                </p>
                <p style="margin: 0; color: #64748b; font-size: 14px;">
                  As a ${roleName}, you'll be able to collaborate on recruitment activities and help find the best candidates.
                </p>
              </div>

              <div style="text-align: center; margin: 32px 0;">
                <a href="${inviteUrl}" 
                   style="display: inline-block; background: #0052CC; color: white; padding: 14px 32px; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 16px;">
                  Accept Invitation
                </a>
              </div>

              <p style="color: #94a3b8; font-size: 13px; text-align: center; margin: 24px 0 0 0;">
                This invitation will expire in 7 days. If the button doesn't work, copy and paste this link:<br>
                <a href="${inviteUrl}" style="color: #0052CC; word-break: break-all;">${inviteUrl}</a>
              </p>
            </div>
            
            <p style="color: #94a3b8; font-size: 12px; text-align: center; margin-top: 24px;">
              © ${new Date().getFullYear()} RecruitifyCRM. All rights reserved.
            </p>
          </div>
        </body>
      </html>
    `;

    console.log(`Sending team invitation to ${email}`);

    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'HireMetrics <admin@hiremetrics.co.uk>',
        to: [email],
        subject: `${invited_by_name} invited you to join their team on RecruitifyCRM`,
        html: emailHtml,
      }),
    });

    const responseData = await response.json();

    if (!response.ok) {
      console.error('Resend API error:', responseData);
      return new Response(
        JSON.stringify({ error: 'Failed to send email', details: responseData }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Team invitation email sent successfully:', responseData);

    return new Response(
      JSON.stringify({ success: true, message_id: responseData.id }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    console.error('Error in send-team-invitation:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
