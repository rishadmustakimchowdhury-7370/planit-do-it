import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import {
  sendSystemEmail,
  sendBillingEmail,
  sendTeamEmail,
  sendOperationalEmail,
  logEmailEvent,
  SUPER_ADMIN_EMAIL,
} from "../_shared/smtp-sender.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Email category determines the sender
type EmailCategory = "system" | "billing" | "team" | "operational";

interface SendEmailRequest {
  template_name?: string;
  to: string | string[];
  subject?: string;
  html?: string;
  variables?: Record<string, string>;
  category?: EmailCategory;
  tenant_id?: string;
  sender_user_id?: string;
  sender_name?: string;
  replyTo?: string;
  attachments?: Array<{ filename: string; content: string }>;
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const {
      template_name,
      to,
      subject,
      html,
      variables,
      category = "system",
      tenant_id,
      sender_user_id,
      sender_name,
      replyTo,
      attachments,
    }: SendEmailRequest = await req.json();

    let emailSubject = subject;
    let emailHtml = html;

    // If using a template, fetch it from the database
    if (template_name && !html) {
      const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
      const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
      const supabase = createClient(supabaseUrl, supabaseKey);

      const { data: template, error: templateError } = await supabase
        .from("email_templates")
        .select("subject, html_content")
        .eq("name", template_name)
        .eq("is_active", true)
        .single();

      if (templateError || !template) {
        console.error("Template not found:", template_name, templateError);
        return new Response(
          JSON.stringify({ error: `Email template '${template_name}' not found` }),
          { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      emailSubject = template.subject;
      emailHtml = template.html_content;

      // Replace template variables
      if (variables && emailSubject && emailHtml) {
        for (const [key, value] of Object.entries(variables)) {
          const regex = new RegExp(`{{${key}}}`, "g");
          emailSubject = emailSubject.replace(regex, value);
          emailHtml = emailHtml.replace(regex, value);
        }
      }
    }

    if (!emailSubject || !emailHtml) {
      return new Response(
        JSON.stringify({ error: "Email subject and content are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const recipients = Array.isArray(to) ? to : [to];
    
    logEmailEvent("Sending email", {
      to: recipients,
      subject: emailSubject,
      category,
    });

    // Prepare payload
    const emailPayload = {
      to: recipients,
      subject: emailSubject,
      html: emailHtml,
      replyTo,
      attachments: attachments?.map(a => ({
        filename: a.filename,
        content: a.content,
      })),
    };

    let result;

    // Route to appropriate sender based on category
    switch (category) {
      case "billing":
        result = await sendBillingEmail(emailPayload);
        break;
      
      case "team":
        result = await sendTeamEmail(
          tenant_id || "",
          sender_user_id,
          sender_name || "HireMetrics",
          emailPayload
        );
        break;
      
      case "operational":
        result = await sendOperationalEmail(
          tenant_id || "",
          sender_user_id || "",
          sender_name || "HireMetrics",
          emailPayload
        );
        break;
      
      case "system":
      default:
        result = await sendSystemEmail(emailPayload);
        break;
    }

    if (!result.success) {
      console.error("Email send failed:", result.error);
      return new Response(
        JSON.stringify({ error: result.error || "Failed to send email" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    logEmailEvent("Email sent successfully", { from: result.from, method: result.method });

    return new Response(
      JSON.stringify({ success: true, from: result.from, method: result.method }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("Error in send-email function:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
};

serve(handler);
