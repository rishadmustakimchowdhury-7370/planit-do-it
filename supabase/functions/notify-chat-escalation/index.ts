import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  sendAuditEmail,
  logEmailEvent,
  SUPER_ADMIN_EMAIL,
} from "../_shared/smtp-sender.ts";
import { getAppBaseUrl } from "../_shared/app-url.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { conversationId, visitorName, visitorEmail } = await req.json();
    
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get all super admins
    const { data: superAdmins, error: adminError } = await supabase
      .from('user_roles')
      .select('user_id')
      .eq('role', 'super_admin');

    if (adminError) {
      console.error('Error fetching super admins:', adminError);
      throw adminError;
    }

    console.log(`[SMTP] Found ${superAdmins?.length || 0} super admins to notify`);

    // Create in-app notifications for all super admins
    if (superAdmins && superAdmins.length > 0) {
      // Get profiles for notifications
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, tenant_id')
        .in('id', superAdmins.map(a => a.user_id));

      if (profiles) {
        const notificationsWithTenant = superAdmins.map(admin => {
          const profile = profiles.find(p => p.id === admin.user_id);
          return {
            user_id: admin.user_id,
            tenant_id: profile?.tenant_id || admin.user_id,
            title: 'Live Chat Escalation',
            message: `${visitorName || 'A visitor'} is requesting live support`,
            type: 'chat_escalation',
            entity_type: 'chat_conversation',
            entity_id: conversationId,
            link: `/admin/live-chat`,
            is_read: false,
            is_email_sent: false,
          };
        });

        const { error: notifError } = await supabase
          .from('notifications')
          .insert(notificationsWithTenant);

        if (notifError) {
          console.error('Error creating notifications:', notifError);
        } else {
          console.log('[SMTP] In-app notifications created successfully');
        }
      }

      // Get app base URL for email links
      const appBaseUrl = await getAppBaseUrl();

      logEmailEvent("Sending chat escalation notification", { visitorName, visitorEmail });

      // Send email notification to super admin via SMTP
      const htmlContent = `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head><body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f1f5f9;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color: #f1f5f9;"><tr><td align="center" style="padding: 40px 20px;"><table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width: 600px; background-color: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 24px rgba(0, 0, 0, 0.08);"><tr><td style="background: linear-gradient(135deg, #dc2626 0%, #ef4444 100%); padding: 30px 40px; text-align: center;"><h1 style="margin: 0; color: #ffffff; font-size: 24px; font-weight: 700;">🔔 Live Chat Escalation</h1></td></tr><tr><td style="padding: 40px;"><p style="margin: 0 0 20px; color: #374151; font-size: 16px; line-height: 1.6;"><strong>${visitorName || 'A visitor'}</strong> is requesting to speak with a live support agent.</p>${visitorEmail ? `<p style="margin: 0 0 20px; color: #6b7280; font-size: 14px;">📧 Email: ${visitorEmail}</p>` : ''}<table role="presentation" cellpadding="0" cellspacing="0" style="margin: 30px 0;"><tr><td><a href="${appBaseUrl}/admin/live-chat" style="display: inline-block; background: linear-gradient(135deg, #00008B 0%, #0052CC 100%); color: #ffffff; text-decoration: none; padding: 14px 32px; border-radius: 8px; font-weight: 600; font-size: 16px;">Open Live Chat</a></td></tr></table><p style="margin: 0; color: #9ca3af; font-size: 12px;">This is an automated notification from HireMetrics CRM.</p></td></tr><tr><td style="background-color: #f8fafc; padding: 20px 40px; border-top: 1px solid #e2e8f0; text-align: center;"><p style="margin: 0; color: #94a3b8; font-size: 12px;">© ${new Date().getFullYear()} HireMetrics. All rights reserved.</p></td></tr></table></td></tr></table></body></html>`;

      const result = await sendAuditEmail(
        `🔔 Live Chat: ${visitorName || 'Visitor'} needs support`,
        htmlContent
      );

      if (result.success) {
        console.log('[SMTP] Chat escalation email sent successfully');
      } else {
        console.error('[SMTP] Failed to send chat escalation email:', result.error);
      }
    }

    return new Response(JSON.stringify({ 
      success: true,
      message: 'Notifications sent'
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in notify-chat-escalation:', error);
    return new Response(JSON.stringify({ 
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
