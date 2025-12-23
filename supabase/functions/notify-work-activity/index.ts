import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { user_id, user_name, user_email, action, tenant_id } = await req.json();

    if (!user_id || !action || !tenant_id) {
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

    // Create Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get admin/owner emails for this tenant
    const { data: adminRoles } = await supabase
      .from('user_roles')
      .select('user_id')
      .eq('tenant_id', tenant_id)
      .in('role', ['admin', 'super_admin', 'manager']);

    if (!adminRoles || adminRoles.length === 0) {
      console.log('No admins found for tenant:', tenant_id);
      return new Response(
        JSON.stringify({ success: true, message: 'No admins to notify' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const adminIds = adminRoles.map(r => r.user_id);
    const { data: adminProfiles } = await supabase
      .from('profiles')
      .select('email, full_name')
      .in('id', adminIds)
      .eq('is_active', true);

    if (!adminProfiles || adminProfiles.length === 0) {
      console.log('No active admin profiles found');
      return new Response(
        JSON.stringify({ success: true, message: 'No active admins to notify' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Format action message
    const actionMessages: Record<string, { title: string, message: string, emoji: string }> = {
      'start_work': {
        title: '🟢 Team Member Started Work',
        message: 'started their work session',
        emoji: '🟢'
      },
      'start_break': {
        title: '🟡 Team Member On Break',
        message: 'started a break',
        emoji: '☕'
      },
      'resume_work': {
        title: '🔵 Team Member Resumed Work',
        message: 'resumed working',
        emoji: '▶️'
      },
      'end_work': {
        title: '🔴 Team Member Ended Work',
        message: 'ended their work session',
        emoji: '🏁'
      }
    };

    const actionInfo = actionMessages[action] || {
      title: 'Work Activity Update',
      message: action,
      emoji: '📊'
    };

    const timestamp = new Date().toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    });

    const emailHtml = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Work Activity Notification</title>
        </head>
        <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 0; padding: 0; background-color: #f4f4f5;">
          <div style="max-width: 600px; margin: 0 auto; padding: 40px 20px;">
            <div style="background: white; border-radius: 12px; padding: 40px; box-shadow: 0 2px 8px rgba(0,0,0,0.08);">
              <div style="text-align: center; margin-bottom: 24px;">
                <h1 style="color: #0052CC; font-size: 24px; margin: 0 0 8px 0;">${actionInfo.emoji} Work Activity Update</h1>
                <p style="color: #64748b; font-size: 14px; margin: 0;">${timestamp}</p>
              </div>
              
              <div style="background: #f8fafc; border-left: 4px solid #0052CC; border-radius: 8px; padding: 20px; margin-bottom: 24px;">
                <p style="margin: 0 0 8px 0; color: #334155; font-size: 16px;">
                  <strong>${user_name || user_email}</strong> ${actionInfo.message}
                </p>
                <p style="margin: 0; color: #64748b; font-size: 14px;">
                  Email: ${user_email}
                </p>
              </div>

              <div style="background: #fef3c7; border-radius: 8px; padding: 16px; margin-top: 24px;">
                <p style="margin: 0; color: #92400e; font-size: 13px;">
                  💡 <strong>Tip:</strong> You can view all team activity in the Work Tracking dashboard.
                </p>
              </div>
            </div>
            
            <p style="color: #94a3b8; font-size: 12px; text-align: center; margin-top: 24px;">
              © ${new Date().getFullYear()} RecruitifyCRM. All rights reserved.
            </p>
          </div>
        </body>
      </html>
    `;

    // Send emails to all admins
    const emailPromises = adminProfiles.map(admin => 
      fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${RESEND_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: 'HireMetrics <admin@hiremetrics.co.uk>',
          to: [admin.email],
          subject: actionInfo.title,
          html: emailHtml,
        }),
      })
    );

    await Promise.all(emailPromises);

    console.log(`Work activity notifications sent to ${adminProfiles.length} admins`);

    return new Response(
      JSON.stringify({ success: true, notified: adminProfiles.length }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    console.error('Error in notify-work-activity:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
