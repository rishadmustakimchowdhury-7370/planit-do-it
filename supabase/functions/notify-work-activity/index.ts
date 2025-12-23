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
    const { user_id, user_name, user_email, action, tenant_id, work_summary, break_summary } = await req.json();

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

    // Get owner and manager emails for this tenant (they should receive notifications)
    const { data: adminRoles } = await supabase
      .from('user_roles')
      .select('user_id')
      .eq('tenant_id', tenant_id)
      .in('role', ['owner', 'manager', 'super_admin']);

    if (!adminRoles || adminRoles.length === 0) {
      console.log('No owners/managers found for tenant:', tenant_id);
      return new Response(
        JSON.stringify({ success: true, message: 'No owners/managers to notify' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Filter out the user themselves (don't notify about own actions)
    const adminIds = adminRoles.map(r => r.user_id).filter(id => id !== user_id);
    
    if (adminIds.length === 0) {
      console.log('No other owners/managers to notify');
      return new Response(
        JSON.stringify({ success: true, message: 'No other owners/managers to notify' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

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
    const actionMessages: Record<string, { title: string; message: string; emoji: string; color: string }> = {
      'start_work': {
        title: '🟢 Team Member Started Work',
        message: 'started their work session',
        emoji: '🟢',
        color: '#22c55e'
      },
      'start_break': {
        title: '☕ Team Member On Break',
        message: 'started a break',
        emoji: '☕',
        color: '#eab308'
      },
      'resume_work': {
        title: '▶️ Team Member Resumed Work',
        message: 'resumed working',
        emoji: '▶️',
        color: '#3b82f6'
      },
      'end_work': {
        title: '🏁 Team Member Ended Work',
        message: 'ended their work session',
        emoji: '🏁',
        color: '#ef4444'
      }
    };

    const actionInfo = actionMessages[action] || {
      title: 'Work Activity Update',
      message: action,
      emoji: '📊',
      color: '#6b7280'
    };

    const timestamp = new Date().toLocaleString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    });

    // Build summary section for end_work
    let summarySection = '';
    if (action === 'end_work' && (work_summary || break_summary)) {
      summarySection = `
        <div style="background: #f0f9ff; border-radius: 8px; padding: 20px; margin-top: 20px;">
          <h3 style="margin: 0 0 12px 0; color: #0369a1; font-size: 14px; text-transform: uppercase; letter-spacing: 0.5px;">📋 Work Summary</h3>
          ${work_summary ? `
            <div style="margin-bottom: 12px;">
              <p style="margin: 0 0 4px 0; color: #64748b; font-size: 12px; font-weight: 600;">Total Work Time</p>
              <p style="margin: 0; color: #334155; font-size: 16px; font-weight: bold;">${work_summary}</p>
            </div>
          ` : ''}
          ${break_summary ? `
            <div>
              <p style="margin: 0 0 4px 0; color: #64748b; font-size: 12px; font-weight: 600;">Total Break Time</p>
              <p style="margin: 0; color: #334155; font-size: 16px; font-weight: bold;">${break_summary}</p>
            </div>
          ` : ''}
        </div>
      `;
    }

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
                <div style="width: 60px; height: 60px; background: ${actionInfo.color}20; border-radius: 50%; display: inline-flex; align-items: center; justify-content: center; margin-bottom: 16px;">
                  <span style="font-size: 28px;">${actionInfo.emoji}</span>
                </div>
                <h1 style="color: #1e293b; font-size: 22px; margin: 0 0 8px 0;">Work Activity Update</h1>
                <p style="color: #64748b; font-size: 14px; margin: 0;">${timestamp}</p>
              </div>
              
              <div style="background: linear-gradient(135deg, ${actionInfo.color}10, ${actionInfo.color}05); border-left: 4px solid ${actionInfo.color}; border-radius: 8px; padding: 20px; margin-bottom: 24px;">
                <p style="margin: 0 0 8px 0; color: #1e293b; font-size: 18px; font-weight: 600;">
                  ${user_name || 'Team Member'}
                </p>
                <p style="margin: 0 0 12px 0; color: #334155; font-size: 16px;">
                  ${actionInfo.message}
                </p>
                <p style="margin: 0; color: #64748b; font-size: 14px;">
                  📧 ${user_email}
                </p>
              </div>

              ${summarySection}

              <div style="text-align: center; margin-top: 32px;">
                <a href="https://hiremetrics.co.uk/team/work-tracking" 
                   style="display: inline-block; background: #00008B; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 14px;">
                  View Team Dashboard
                </a>
              </div>
            </div>
            
            <div style="text-align: center; margin-top: 24px;">
              <p style="color: #94a3b8; font-size: 12px; margin: 0;">
                © ${new Date().getFullYear()} HireMetrics CRM. All rights reserved.
              </p>
              <p style="color: #94a3b8; font-size: 11px; margin: 8px 0 0 0;">
                You're receiving this because you're an owner or manager of this workspace.
              </p>
            </div>
          </div>
        </body>
      </html>
    `;

    // Send emails to all owners/managers
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
          subject: `${actionInfo.title} - ${user_name || user_email}`,
          html: emailHtml,
        }),
      })
    );

    const results = await Promise.allSettled(emailPromises);
    const successCount = results.filter(r => r.status === 'fulfilled').length;
    const failCount = results.filter(r => r.status === 'rejected').length;

    if (failCount > 0) {
      console.warn(`${failCount} email(s) failed to send`);
    }

    console.log(`Work activity notifications sent to ${successCount}/${adminProfiles.length} owners/managers for action: ${action}`);

    return new Response(
      JSON.stringify({ success: true, notified: successCount, failed: failCount }),
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
