import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { SMTPClient } from "https://deno.land/x/denomailer@1.6.0/mod.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface SMTPConfig {
  host: string;
  port: number;
  username: string;
  password: string;
  use_tls: boolean;
  from_email: string;
  from_name: string;
}

interface SendEmailRequest {
  smtp_config?: SMTPConfig;
  account_id?: string;
  to_email: string;
  cc_email?: string;
  bcc_email?: string;
  subject: string;
  html_body: string;
  text_body?: string;
  attachments?: Array<{ filename: string; path: string }>;
  reply_to?: string;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

    // Get user from auth header
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      throw new Error("Missing authorization header");
    }

    const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const supabaseUser = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });

    // Get current user
    const { data: { user }, error: userError } = await supabaseUser.auth.getUser();
    if (userError || !user) {
      throw new Error("Unauthorized");
    }

    const body: SendEmailRequest = await req.json();
    const {
      smtp_config,
      account_id,
      to_email,
      cc_email,
      bcc_email,
      subject,
      html_body,
      text_body,
      attachments,
      reply_to,
    } = body;

    let config: SMTPConfig;

    // If account_id provided, fetch SMTP credentials from database
    if (account_id) {
      const { data: account, error: accountError } = await supabaseAdmin
        .from("email_accounts")
        .select("*")
        .eq("id", account_id)
        .eq("user_id", user.id)
        .single();

      if (accountError || !account) {
        throw new Error("Email account not found or not authorized");
      }

      if (account.provider !== "smtp") {
        throw new Error("This function only supports SMTP accounts. Use the appropriate provider function for OAuth accounts.");
      }

      if (!account.smtp_host || !account.smtp_user || !account.smtp_password) {
        throw new Error("SMTP account is not properly configured");
      }

      config = {
        host: account.smtp_host,
        port: account.smtp_port || 587,
        username: account.smtp_user,
        password: account.smtp_password,
        use_tls: account.smtp_use_tls ?? true,
        from_email: account.from_email,
        from_name: account.display_name,
      };
    } else if (smtp_config) {
      // Use provided SMTP config (for testing)
      config = smtp_config;
    } else {
      throw new Error("Either account_id or smtp_config must be provided");
    }

    console.log(`Sending email via SMTP to ${to_email} from ${config.from_email}`);

    // Create SMTP client
    const client = new SMTPClient({
      connection: {
        hostname: config.host,
        port: config.port,
        tls: config.use_tls,
        auth: {
          username: config.username,
          password: config.password,
        },
      },
    });

    // Build recipients
    const toList = to_email.split(",").map(e => e.trim()).filter(Boolean);
    const ccList = cc_email ? cc_email.split(",").map(e => e.trim()).filter(Boolean) : [];
    const bccList = bcc_email ? bcc_email.split(",").map(e => e.trim()).filter(Boolean) : [];

    // Send email
    await client.send({
      from: `${config.from_name} <${config.from_email}>`,
      to: toList,
      cc: ccList.length > 0 ? ccList : undefined,
      bcc: bccList.length > 0 ? bccList : undefined,
      replyTo: reply_to,
      subject: subject,
      content: text_body || "Please view this email in an HTML-compatible client.",
      html: html_body,
    });

    // Close connection
    await client.close();

    console.log(`Email sent successfully via SMTP to ${to_email}`);

    // Update account last_sync_at
    if (account_id) {
      await supabaseAdmin
        .from("email_accounts")
        .update({ 
          last_sync_at: new Date().toISOString(),
          status: "connected",
          error_message: null,
        })
        .eq("id", account_id);
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: "Email sent via SMTP",
        from: config.from_email,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("SMTP send error:", error);
    
    // Update account status if there was an error
    const body = await req.clone().json().catch(() => ({}));
    if (body.account_id) {
      const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
      const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
      const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
      
      await supabaseAdmin
        .from("email_accounts")
        .update({ 
          status: "error",
          error_message: error instanceof Error ? error.message : "Unknown error",
        })
        .eq("id", body.account_id);
    }

    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : "Failed to send email via SMTP" 
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
