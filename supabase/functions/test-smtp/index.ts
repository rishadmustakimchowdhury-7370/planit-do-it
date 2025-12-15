import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { SMTPClient } from "https://deno.land/x/denomailer@1.6.0/mod.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface TestSMTPRequest {
  smtp_host: string;
  smtp_port: number;
  smtp_user: string;
  smtp_password: string;
  smtp_use_tls: boolean;
  from_email: string;
  display_name: string;
  send_test_email?: boolean;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

    // Get user from auth header
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      throw new Error("Missing authorization header");
    }

    const supabaseUser = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });

    // Get current user
    const { data: { user }, error: userError } = await supabaseUser.auth.getUser();
    if (userError || !user) {
      throw new Error("Unauthorized");
    }

    const body: TestSMTPRequest = await req.json();
    const {
      smtp_host,
      smtp_port,
      smtp_user,
      smtp_password,
      smtp_use_tls,
      from_email,
      display_name,
      send_test_email,
    } = body;

    console.log(`Testing SMTP connection: ${smtp_host}:${smtp_port} for ${from_email}`);

    // Validate required fields
    if (!smtp_host || !smtp_port || !smtp_user || !smtp_password) {
      throw new Error("Missing required SMTP configuration fields");
    }

    // Create SMTP client
    const client = new SMTPClient({
      connection: {
        hostname: smtp_host,
        port: smtp_port,
        tls: smtp_use_tls,
        auth: {
          username: smtp_user,
          password: smtp_password,
        },
      },
    });

    // Test connection by sending a test email if requested
    if (send_test_email) {
      console.log(`Sending test email to ${from_email}`);
      
      await client.send({
        from: `${display_name} <${from_email}>`,
        to: from_email,
        subject: "RecruitifyCRM - SMTP Test Email",
        content: "If you're seeing this email, your SMTP configuration is working correctly!",
        html: `
          <div style="font-family: Arial, sans-serif; padding: 20px; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #0052cc;">SMTP Configuration Test</h2>
            <p>Congratulations! Your SMTP settings are configured correctly.</p>
            <p>You can now send emails from <strong>${from_email}</strong> via RecruitifyCRM.</p>
            <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 20px 0;" />
            <p style="color: #6b7280; font-size: 12px;">
              This is an automated test email from RecruitifyCRM.
            </p>
          </div>
        `,
      });

      console.log("Test email sent successfully");
    }

    // Close connection
    await client.close();

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: send_test_email 
          ? `SMTP connection successful! Test email sent to ${from_email}`
          : "SMTP connection successful!",
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("SMTP test error:", error);
    
    // Provide helpful error messages
    let errorMessage = error instanceof Error ? error.message : "Unknown error";
    
    if (errorMessage.includes("ECONNREFUSED")) {
      errorMessage = "Connection refused. Check your SMTP host and port.";
    } else if (errorMessage.includes("ETIMEDOUT")) {
      errorMessage = "Connection timed out. Check your SMTP host and port, and ensure your firewall allows outbound connections.";
    } else if (errorMessage.includes("AUTH")) {
      errorMessage = "Authentication failed. Check your username and password.";
    } else if (errorMessage.includes("certificate")) {
      errorMessage = "TLS/SSL certificate error. Try toggling the TLS setting.";
    }

    return new Response(
      JSON.stringify({ 
        error: errorMessage,
        details: error instanceof Error ? error.message : undefined,
      }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
