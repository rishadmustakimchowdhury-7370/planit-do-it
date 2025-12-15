import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Convert scheduled time in user's timezone to UTC for comparison
function getScheduledTimeInUTC(scheduledAt: string, timezone: string): Date {
  try {
    // Parse the scheduled datetime
    const scheduled = new Date(scheduledAt);
    
    // If timezone is provided, we need to interpret the stored time as being in that timezone
    // The stored time is already in ISO format, so we just compare directly
    return scheduled;
  } catch (e) {
    console.error('Error parsing scheduled time:', e);
    return new Date(scheduledAt);
  }
}

// Send email via user's SMTP or fallback to Resend
async function sendEmail(
  email: any,
  resendApiKey: string | undefined,
  supabase: any
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  // Check if user has a configured SMTP account
  if (email.from_account_id) {
    const { data: account } = await supabase
      .from('email_accounts')
      .select('*')
      .eq('id', email.from_account_id)
      .single();
    
    if (account && account.provider === 'smtp' && account.smtp_host) {
      console.log(`Attempting SMTP send via ${account.smtp_host} for email ${email.id}`);
      // For now, fall through to Resend - SMTP support will be added later
      // TODO: Implement actual SMTP sending with nodemailer
    }
  }

  // Fallback to Resend API
  if (!resendApiKey) {
    return { success: false, error: 'No email provider configured' };
  }

  try {
    // Parse attachments if present
    let attachments: any[] = [];
    if (email.attachments && Array.isArray(email.attachments)) {
      attachments = email.attachments.map((att: any) => ({
        filename: att.name,
        path: att.url, // Resend can fetch from URL
      }));
    }

    const emailPayload: Record<string, unknown> = {
      from: `RecruitifyCRM <info@recruitifycrm.com>`,
      reply_to: email.from_email,
      to: [email.to_email],
      subject: email.subject,
      html: email.body_text,
    };

    if (attachments.length > 0) {
      emailPayload.attachments = attachments;
    }

    const emailResponse = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${resendApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(emailPayload),
    });

    const resendData = await emailResponse.json();

    if (emailResponse.ok) {
      return { success: true, messageId: resendData.id };
    } else {
      return { success: false, error: resendData.message || 'Failed to send' };
    }
  } catch (error: any) {
    return { success: false, error: error.message || 'Unknown error' };
  }
}

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
    // We check emails where scheduled_at <= now
    const now = new Date().toISOString();
    
    console.log(`Processing scheduled emails at ${now}`);
    
    const { data: scheduledEmails, error: fetchError } = await supabase
      .from('candidate_emails')
      .select('*')
      .eq('status', 'scheduled')
      .lte('scheduled_at', now)
      .lt('retry_count', 3) // Max 3 retries
      .order('scheduled_at', { ascending: true })
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
    const results: any[] = [];

    for (const email of scheduledEmails) {
      console.log(`Processing email ${email.id} scheduled for ${email.scheduled_at} (tz: ${email.timezone || 'UTC'})`);
      
      const result = await sendEmail(email, resendApiKey, supabase);
      
      if (result.success) {
        // Update email status to sent
        const { error: updateError } = await supabase
          .from('candidate_emails')
          .update({
            status: 'sent',
            sent_at: new Date().toISOString(),
            provider_message_id: result.messageId,
            error_message: null,
          })
          .eq('id', email.id);

        if (updateError) {
          console.error(`Failed to update email ${email.id} status:`, updateError);
        }

        successCount++;
        results.push({ id: email.id, status: 'sent', messageId: result.messageId });
        console.log(`Email ${email.id} sent successfully. Message ID: ${result.messageId}`);
      } else {
        // Increment retry count and update error
        const newRetryCount = (email.retry_count || 0) + 1;
        const newStatus = newRetryCount >= 3 ? 'failed' : 'scheduled';
        
        const { error: updateError } = await supabase
          .from('candidate_emails')
          .update({
            status: newStatus,
            retry_count: newRetryCount,
            error_message: result.error,
          })
          .eq('id', email.id);

        if (updateError) {
          console.error(`Failed to update email ${email.id} error:`, updateError);
        }

        failCount++;
        results.push({ 
          id: email.id, 
          status: newStatus, 
          error: result.error,
          retries: newRetryCount,
        });
        console.error(`Email ${email.id} failed (retry ${newRetryCount}/3):`, result.error);
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
        processed_at: now,
        results,
      },
    });

    console.log(`Completed: ${successCount} sent, ${failCount} failed`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        processed: scheduledEmails.length,
        sent: successCount,
        failed: failCount,
        results,
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
