import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const resendApiKey = Deno.env.get('RESEND_API_KEY');

    if (!resendApiKey) {
      console.error('RESEND_API_KEY not configured');
      return new Response(
        JSON.stringify({ error: 'Email service not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Find scheduled emails that are due
    const now = new Date().toISOString();
    
    const { data: scheduledEmails, error: fetchError } = await supabase
      .from('candidate_emails')
      .select('*')
      .eq('status', 'scheduled')
      .lte('scheduled_at', now)
      .limit(50);

    if (fetchError) {
      console.error('Error fetching scheduled emails:', fetchError);
      throw fetchError;
    }

    console.log(`Found ${scheduledEmails?.length || 0} scheduled emails to process`);

    if (!scheduledEmails || scheduledEmails.length === 0) {
      return new Response(
        JSON.stringify({ success: true, processed: 0, message: 'No scheduled emails to process' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    let successCount = 0;
    let failCount = 0;

    for (const email of scheduledEmails) {
      try {
        // Send via Resend
        const emailResponse = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${resendApiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            from: 'RecruitifyCRM <info@recruitifycrm.com>',
            to: [email.to_email],
            subject: email.subject,
            html: email.body_text,
          }),
        });

        const resendData = await emailResponse.json();

        if (emailResponse.ok) {
          // Update email status to sent
          await supabase
            .from('candidate_emails')
            .update({
              status: 'sent',
              sent_at: new Date().toISOString(),
              provider_message_id: resendData.id,
              error_message: null,
            })
            .eq('id', email.id);

          successCount++;
          console.log(`Email ${email.id} sent successfully`);
        } else {
          // Update email status to failed
          await supabase
            .from('candidate_emails')
            .update({
              status: 'failed',
              error_message: resendData.message || 'Failed to send',
            })
            .eq('id', email.id);

          failCount++;
          console.error(`Email ${email.id} failed:`, resendData);
        }
      } catch (error: any) {
        // Update email status to failed
        await supabase
          .from('candidate_emails')
          .update({
            status: 'failed',
            error_message: error.message || 'Unknown error',
          })
          .eq('id', email.id);

        failCount++;
        console.error(`Error processing email ${email.id}:`, error);
      }
    }

    // Log to audit
    await supabase.from('audit_log').insert({
      action: 'process_scheduled_emails',
      entity_type: 'email',
      new_values: { 
        total: scheduledEmails.length,
        success: successCount,
        failed: failCount,
      },
    });

    return new Response(
      JSON.stringify({ 
        success: true, 
        processed: scheduledEmails.length,
        sent: successCount,
        failed: failCount,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    console.error('Error in process-scheduled-emails:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
