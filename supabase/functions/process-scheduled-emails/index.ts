import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { SMTPClient } from "https://deno.land/x/denomailer@1.6.0/mod.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const SUPER_ADMIN_EMAIL = "admin@hiremetrics.co.uk";

// Send email via user's SMTP or fallback to system SMTP
async function sendEmail(
  email: any,
  supabase: any
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  // Check if user has a configured SMTP account
  if (email.from_account_id) {
    const { data: account } = await supabase
      .from('email_accounts')
      .select('*')
      .eq('id', email.from_account_id)
      .single();
    
    if (account && account.provider === 'smtp' && account.smtp_host && account.smtp_user && account.smtp_password) {
      console.log(`[SMTP] Attempting send via ${account.smtp_host} for email ${email.id}`);
      
      try {
        const isDirectTLS = account.smtp_port === 465;
        const client = new SMTPClient({
          connection: {
            hostname: account.smtp_host,
            port: account.smtp_port || 587,
            tls: isDirectTLS,
            auth: {
              username: account.smtp_user,
              password: account.smtp_password,
            },
          },
        });

        await client.send({
          from: `${account.display_name} <${account.from_email}>`,
          to: [email.to_email],
          subject: email.subject,
          content: "Please view this email in an HTML-compatible client.",
          html: email.body_text,
        });

        await client.close();

        // Update account last sync
        await supabase
          .from('email_accounts')
          .update({ last_sync_at: new Date().toISOString(), status: 'connected' })
          .eq('id', account.id);

        return { success: true, messageId: crypto.randomUUID() };
      } catch (error) {
        console.error(`[SMTP] User account send error:`, error);
        // Fall through to system SMTP
      }
    }
  }

  // Fallback to system SMTP
  const host = Deno.env.get("SMTP_HOST") || "smtp.gmail.com";
  const port = parseInt(Deno.env.get("SMTP_PORT") || "587", 10);
  const user = Deno.env.get("SMTP_USER");
  const password = Deno.env.get("SMTP_PASSWORD");

  if (!user || !password) {
    return { success: false, error: 'System SMTP not configured' };
  }

  try {
    const isDirectTLS = port === 465;
    const client = new SMTPClient({
      connection: {
        hostname: host,
        port: port,
        tls: isDirectTLS,
        auth: {
          username: user,
          password: password,
        },
      },
    });

    await client.send({
      from: `HireMetrics <${SUPER_ADMIN_EMAIL}>`,
      replyTo: email.from_email,
      to: [email.to_email],
      subject: email.subject,
      content: "Please view this email in an HTML-compatible client.",
      html: email.body_text,
    });

    await client.close();

    console.log(`[SMTP] Email sent via system SMTP to ${email.to_email}`);
    return { success: true, messageId: crypto.randomUUID() };
  } catch (error: any) {
    console.error('[SMTP] System send error:', error);
    return { success: false, error: error.message || 'SMTP send failed' };
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const now = new Date().toISOString();
    console.log(`[SMTP] Processing scheduled emails at ${now}`);
    
    const { data: scheduledEmails, error: fetchError } = await supabase
      .from('candidate_emails')
      .select('*')
      .eq('status', 'scheduled')
      .lte('scheduled_at', now)
      .lt('retry_count', 3)
      .order('scheduled_at', { ascending: true })
      .limit(50);

    if (fetchError) {
      console.error('Error fetching scheduled emails:', fetchError);
      throw fetchError;
    }

    console.log(`[SMTP] Found ${scheduledEmails?.length || 0} scheduled emails to process`);

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
      console.log(`[SMTP] Processing email ${email.id} scheduled for ${email.scheduled_at}`);
      
      const result = await sendEmail(email, supabase);
      
      if (result.success) {
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
        console.log(`[SMTP] Email ${email.id} sent successfully`);
      } else {
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
        console.error(`[SMTP] Email ${email.id} failed (retry ${newRetryCount}/3):`, result.error);
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

    console.log(`[SMTP] Completed: ${successCount} sent, ${failCount} failed`);

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
