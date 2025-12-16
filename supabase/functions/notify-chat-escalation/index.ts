import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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
    const resendApiKey = Deno.env.get('RESEND_API_KEY');
    
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

    console.log(`Found ${superAdmins?.length || 0} super admins to notify`);

    // Create in-app notifications for all super admins
    if (superAdmins && superAdmins.length > 0) {
      const notifications = superAdmins.map(admin => ({
        user_id: admin.user_id,
        tenant_id: admin.user_id, // Use user_id as tenant for super admins
        title: 'Live Chat Escalation',
        message: `${visitorName || 'A visitor'} is requesting live support`,
        type: 'chat_escalation',
        entity_type: 'chat_conversation',
        entity_id: conversationId,
        link: `/admin/live-chat`,
        is_read: false,
        is_email_sent: false,
      }));

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
          console.log('In-app notifications created successfully');
        }
      }

      // Send email notifications if Resend is configured
      if (resendApiKey) {
        // Get super admin emails
        const { data: adminProfiles } = await supabase
          .from('profiles')
          .select('email')
          .in('id', superAdmins.map(a => a.user_id));

        if (adminProfiles && adminProfiles.length > 0) {
          for (const profile of adminProfiles) {
            if (!profile.email) continue;

            try {
              const emailResponse = await fetch('https://api.resend.com/emails', {
                method: 'POST',
                headers: {
                  'Authorization': `Bearer ${resendApiKey}`,
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                  from: 'Recruitify CRM <info@recruitifycrm.com>',
                  to: profile.email,
                  subject: `🔔 Live Chat: ${visitorName || 'Visitor'} needs support`,
                  html: `
                    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                      <h2 style="color: #0052CC;">Live Chat Escalation</h2>
                      <p><strong>${visitorName || 'A visitor'}</strong> is requesting to speak with a live support agent.</p>
                      ${visitorEmail ? `<p>Email: ${visitorEmail}</p>` : ''}
                      <p style="margin-top: 20px;">
                        <a href="${supabaseUrl.replace('.supabase.co', '')}/admin/live-chat" 
                           style="background-color: #0052CC; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
                          Open Live Chat
                        </a>
                      </p>
                      <p style="color: #666; font-size: 12px; margin-top: 30px;">
                        This is an automated notification from Recruitify CRM.
                      </p>
                    </div>
                  `,
                }),
              });

              if (emailResponse.ok) {
                console.log(`Email sent to ${profile.email}`);
              } else {
                const errorText = await emailResponse.text();
                console.error(`Failed to send email to ${profile.email}:`, errorText);
              }
            } catch (emailError) {
              console.error(`Error sending email to ${profile.email}:`, emailError);
            }
          }
        }
      } else {
        console.log('Resend API key not configured, skipping email notifications');
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
