import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const url = new URL(req.url);
    const action = url.searchParams.get('action');

    // Get user from auth header
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      console.error('Auth error:', authError);
      return new Response(JSON.stringify({ error: 'Invalid token' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Get user's tenant
    const { data: profile } = await supabase
      .from('profiles')
      .select('tenant_id')
      .eq('id', user.id)
      .single();

    if (!profile?.tenant_id) {
      return new Response(JSON.stringify({ error: 'No tenant found' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const tenantId = profile.tenant_id;

    console.log(`Action: ${action}, User: ${user.id}, Tenant: ${tenantId}`);

    switch (action) {
      case 'get-next-profile': {
        // Get the active campaign for this user
        const { data: campaign } = await supabase
          .from('linkedin_outreach_campaigns')
          .select('*')
          .eq('user_id', user.id)
          .eq('tenant_id', tenantId)
          .eq('status', 'active')
          .is('locked_until', null)
          .single();

        if (!campaign) {
          return new Response(JSON.stringify({ 
            profile: null, 
            message: 'No active campaign found' 
          }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        // Check if campaign is locked due to daily limit
        if (campaign.locked_until && new Date(campaign.locked_until) > new Date()) {
          return new Response(JSON.stringify({ 
            profile: null, 
            message: 'Daily limit reached, campaign locked until tomorrow',
            locked_until: campaign.locked_until
          }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        // Reset daily counters if new day
        const today = new Date().toISOString().split('T')[0];
        if (campaign.last_reset_date !== today) {
          await supabase
            .from('linkedin_outreach_campaigns')
            .update({ 
              visited_today: 0, 
              sent_today: 0, 
              last_reset_date: today,
              locked_until: null
            })
            .eq('id', campaign.id);
          campaign.visited_today = 0;
          campaign.sent_today = 0;
        }

        // Check daily limit
        if (campaign.visited_today >= campaign.daily_limit) {
          const tomorrow = new Date();
          tomorrow.setDate(tomorrow.getDate() + 1);
          tomorrow.setHours(0, 0, 0, 0);
          
          await supabase
            .from('linkedin_outreach_campaigns')
            .update({ locked_until: tomorrow.toISOString() })
            .eq('id', campaign.id);

          return new Response(JSON.stringify({ 
            profile: null, 
            message: 'Daily limit reached',
            daily_limit: campaign.daily_limit,
            visited_today: campaign.visited_today
          }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        // Get next pending profile
        const { data: nextProfile } = await supabase
          .from('linkedin_outreach_queue')
          .select('*')
          .eq('campaign_id', campaign.id)
          .eq('status', 'pending')
          .order('position', { ascending: true })
          .limit(1)
          .single();

        if (!nextProfile) {
          // Mark campaign as completed
          await supabase
            .from('linkedin_outreach_campaigns')
            .update({ status: 'completed', completed_at: new Date().toISOString() })
            .eq('id', campaign.id);

          return new Response(JSON.stringify({ 
            profile: null, 
            message: 'Campaign completed - no more profiles' 
          }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        // Mark as in_progress
        await supabase
          .from('linkedin_outreach_queue')
          .update({ status: 'in_progress' })
          .eq('id', nextProfile.id);

        console.log(`Returning profile: ${nextProfile.linkedin_url}`);

        return new Response(JSON.stringify({ 
          profile: nextProfile,
          campaign: {
            id: campaign.id,
            name: campaign.name,
            outreach_mode: campaign.outreach_mode,
            custom_message: campaign.custom_message,
            daily_limit: campaign.daily_limit,
            visited_today: campaign.visited_today,
            sent_today: campaign.sent_today
          }
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      case 'report-visit': {
        const body = await req.json();
        const { queue_item_id, status, dwell_time_seconds, error_message, skip_reason, connection_sent } = body;

        console.log(`Report visit: ${queue_item_id}, status: ${status}`);

        // Update queue item
        const updateData: Record<string, unknown> = {
          status,
          visited_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };

        if (dwell_time_seconds) updateData.dwell_time_seconds = dwell_time_seconds;
        if (error_message) updateData.error_message = error_message;
        if (skip_reason) updateData.skip_reason = skip_reason;
        if (connection_sent !== undefined) {
          updateData.connection_sent = connection_sent;
          if (connection_sent) updateData.connected_at = new Date().toISOString();
        }

        const { data: queueItem } = await supabase
          .from('linkedin_outreach_queue')
          .update(updateData)
          .eq('id', queue_item_id)
          .select('campaign_id')
          .single();

        if (queueItem) {
          // Increment campaign counters
          const { data: campaign } = await supabase
            .from('linkedin_outreach_campaigns')
            .select('visited_today, sent_today')
            .eq('id', queueItem.campaign_id)
            .single();

          if (campaign) {
            const updates: Record<string, number> = {
              visited_today: campaign.visited_today + 1,
            };
            if (connection_sent) {
              updates.sent_today = campaign.sent_today + 1;
            }

            await supabase
              .from('linkedin_outreach_campaigns')
              .update(updates)
              .eq('id', queueItem.campaign_id);
          }

          // Log the action
          await supabase
            .from('linkedin_outreach_logs')
            .insert({
              campaign_id: queueItem.campaign_id,
              queue_item_id,
              user_id: user.id,
              tenant_id: tenantId,
              action: status === 'visited' ? 'profile_visited' : status === 'connected' ? 'connection_sent' : 'profile_skipped',
              details: { dwell_time_seconds, error_message, skip_reason, connection_sent }
            });
        }

        return new Response(JSON.stringify({ success: true }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      case 'get-status': {
        // Get active campaign status
        const { data: campaigns } = await supabase
          .from('linkedin_outreach_campaigns')
          .select(`
            id, name, status, daily_limit, visited_today, sent_today,
            locked_until, total_profiles
          `)
          .eq('user_id', user.id)
          .eq('tenant_id', tenantId)
          .in('status', ['active', 'paused']);

        // Get queue stats for each campaign
        const stats = await Promise.all((campaigns || []).map(async (campaign) => {
          const { count: pending } = await supabase
            .from('linkedin_outreach_queue')
            .select('*', { count: 'exact', head: true })
            .eq('campaign_id', campaign.id)
            .eq('status', 'pending');

          const { count: completed } = await supabase
            .from('linkedin_outreach_queue')
            .select('*', { count: 'exact', head: true })
            .eq('campaign_id', campaign.id)
            .in('status', ['visited', 'connected', 'skipped']);

          return {
            ...campaign,
            pending_count: pending || 0,
            completed_count: completed || 0,
          };
        }));

        return new Response(JSON.stringify({ campaigns: stats }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      case 'pause-campaign': {
        const body = await req.json();
        const { campaign_id } = body;

        await supabase
          .from('linkedin_outreach_campaigns')
          .update({ status: 'paused', paused_at: new Date().toISOString() })
          .eq('id', campaign_id)
          .eq('user_id', user.id);

        console.log(`Campaign paused: ${campaign_id}`);

        return new Response(JSON.stringify({ success: true }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      case 'resume-campaign': {
        const body = await req.json();
        const { campaign_id } = body;

        await supabase
          .from('linkedin_outreach_campaigns')
          .update({ status: 'active', paused_at: null })
          .eq('id', campaign_id)
          .eq('user_id', user.id);

        console.log(`Campaign resumed: ${campaign_id}`);

        return new Response(JSON.stringify({ success: true }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      default:
        return new Response(JSON.stringify({ error: 'Unknown action' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
    }
  } catch (error) {
    console.error('Error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
