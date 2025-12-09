import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface SendWhatsAppRequest {
  phone_number: string;
  message: string;
  template_id?: string;
  candidate_id?: string;
  tenant_id?: string;
  variables?: Record<string, string>;
  schedule_at?: string;
}

serve(async (req: Request) => {
  // Handle CORS
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const body: SendWhatsAppRequest = await req.json();
    const { phone_number, message, template_id, candidate_id, tenant_id, variables, schedule_at } = body;

    if (!phone_number || !message) {
      return new Response(
        JSON.stringify({ error: "phone_number and message are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get WhatsApp settings
    const { data: settings, error: settingsError } = await supabase
      .from("whatsapp_settings")
      .select("*")
      .single();

    if (settingsError || !settings?.is_configured) {
      console.log("WhatsApp not configured:", settingsError?.message);
      
      // Log the attempt even if not configured
      await supabase.from("whatsapp_logs").insert({
        phone_number,
        message,
        template_id,
        candidate_id,
        tenant_id,
        status: "failed",
        error_message: "WhatsApp API not configured",
      });

      return new Response(
        JSON.stringify({ error: "WhatsApp API not configured" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Replace template variables
    let finalMessage = message;
    if (variables) {
      for (const [key, value] of Object.entries(variables)) {
        finalMessage = finalMessage.replace(new RegExp(`{{${key}}}`, "g"), value);
      }
    }

    // Format phone number (remove spaces, dashes, and ensure it starts with country code)
    const formattedPhone = phone_number.replace(/[\s-]/g, "").replace(/^0/, "");

    let sendResult: { success: boolean; error?: string; messageId?: string } = { success: false };

    // Send based on provider
    if (settings.api_provider === "twilio") {
      sendResult = await sendViaTwilio(
        settings.api_key,
        settings.api_secret,
        settings.phone_number_id,
        formattedPhone,
        finalMessage
      );
    } else if (settings.api_provider === "meta") {
      sendResult = await sendViaMeta(
        settings.api_key,
        settings.phone_number_id,
        formattedPhone,
        finalMessage
      );
    } else {
      // Default: mock send for testing
      console.log("Mock sending WhatsApp:", { to: formattedPhone, message: finalMessage });
      sendResult = { success: true, messageId: `mock_${Date.now()}` };
    }

    // Log the message
    await supabase.from("whatsapp_logs").insert({
      phone_number: formattedPhone,
      message: finalMessage,
      template_id,
      candidate_id,
      tenant_id,
      status: sendResult.success ? "sent" : "failed",
      error_message: sendResult.error || null,
      sent_at: sendResult.success ? new Date().toISOString() : null,
    });

    if (!sendResult.success) {
      return new Response(
        JSON.stringify({ error: sendResult.error || "Failed to send message" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("WhatsApp message sent successfully:", sendResult.messageId);

    return new Response(
      JSON.stringify({ success: true, messageId: sendResult.messageId }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("Error in send-whatsapp function:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

async function sendViaTwilio(
  accountSid: string,
  authToken: string,
  fromNumber: string,
  toNumber: string,
  body: string
): Promise<{ success: boolean; error?: string; messageId?: string }> {
  try {
    const url = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`;
    const auth = btoa(`${accountSid}:${authToken}`);

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Authorization": `Basic ${auth}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        From: `whatsapp:${fromNumber}`,
        To: `whatsapp:${toNumber}`,
        Body: body,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      return { success: false, error: data.message || "Twilio API error" };
    }

    return { success: true, messageId: data.sid };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

async function sendViaMeta(
  accessToken: string,
  phoneNumberId: string,
  toNumber: string,
  text: string
): Promise<{ success: boolean; error?: string; messageId?: string }> {
  try {
    const url = `https://graph.facebook.com/v18.0/${phoneNumberId}/messages`;

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        recipient_type: "individual",
        to: toNumber,
        type: "text",
        text: { body: text },
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      return { success: false, error: data.error?.message || "Meta API error" };
    }

    return { success: true, messageId: data.messages?.[0]?.id };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}
