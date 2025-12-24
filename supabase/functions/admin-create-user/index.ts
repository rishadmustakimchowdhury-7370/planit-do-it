import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface CreateUserRequest {
  email: string;
  password: string;
  fullName: string;
  companyName?: string;
  planId?: string;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      {
        global: {
          headers: { Authorization: req.headers.get("Authorization")! },
        },
      }
    );

    // Verify the caller is a super admin
    const {
      data: { user: caller },
    } = await supabaseClient.auth.getUser();

    if (!caller) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check if caller is super admin
    // IMPORTANT: RPC param name must match function argument name
    const { data: isSuperAdmin, error: superAdminError } = await supabaseClient.rpc(
      "is_super_admin",
      { _user_id: caller.id }
    );

    if (superAdminError) {
      console.error("Error checking super admin status:", superAdminError);
      return new Response(
        JSON.stringify({ error: "Failed to verify permissions" }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    if (!isSuperAdmin) {
      return new Response(
        JSON.stringify({ error: "Only super admins can create users" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { email, password, fullName, companyName, planId }: CreateUserRequest = await req.json();

    if (!email || !password || !fullName) {
      return new Response(
        JSON.stringify({ error: "Email, password, and full name are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Create user using service role
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true, // Auto-confirm email
      user_metadata: {
        full_name: fullName,
      },
    });

    if (createError) {
      console.error("Error creating user:", createError);
      return new Response(
        JSON.stringify({ error: createError.message }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!newUser.user) {
      return new Response(
        JSON.stringify({ error: "Failed to create user" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Wait for profile and tenant to be created by trigger
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Get the created profile to find tenant_id
    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('tenant_id')
      .eq('id', newUser.user.id)
      .single();

    // Update tenant with plan and company name if provided
    if (profile?.tenant_id) {
      const updates: any = {};
      if (companyName) updates.name = companyName;
      if (planId) {
        updates.subscription_plan_id = planId;
        updates.subscription_status = 'active';
      }

      if (Object.keys(updates).length > 0) {
        await supabaseAdmin
          .from('tenants')
          .update(updates)
          .eq('id', profile.tenant_id);
      }

      // Assign 'owner' role to the new user for their tenant
      const { error: roleError } = await supabaseAdmin
        .from('user_roles')
        .insert({
          user_id: newUser.user.id,
          role: 'owner',
          tenant_id: profile.tenant_id,
        });

      if (roleError) {
        console.error("Error assigning owner role:", roleError);
        // Don't fail the whole operation, just log the error
      } else {
        console.log(`Owner role assigned to user: ${email}`);
      }
    }

    // Send welcome email to the new user
    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    if (resendApiKey) {
      try {
        const appUrl = Deno.env.get("APP_URL") || "https://efdvolifacsnmiinifiq.lovableproject.com";
        const welcomeEmailHtml = `
          <!DOCTYPE html>
          <html>
          <head>
            <meta charset="utf-8">
            <title>Welcome to HireMetrics</title>
          </head>
          <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
            <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; border-radius: 10px 10px 0 0; text-align: center;">
              <h1 style="color: white; margin: 0;">Welcome to HireMetrics!</h1>
            </div>
            <div style="background: #f9fafb; padding: 30px; border-radius: 0 0 10px 10px; border: 1px solid #e5e7eb; border-top: none;">
              <p>Hi <strong>${fullName}</strong>,</p>
              <p>Your account has been successfully created by the HireMetrics admin team. You now have <strong>Owner</strong> access to your workspace${companyName ? ` "${companyName}"` : ""}.</p>
              <p>Here are your login credentials:</p>
              <div style="background: white; padding: 15px; border-radius: 8px; border: 1px solid #e5e7eb; margin: 20px 0;">
                <p style="margin: 5px 0;"><strong>Email:</strong> ${email}</p>
                <p style="margin: 5px 0;"><strong>Password:</strong> ${password}</p>
              </div>
              <p style="color: #ef4444; font-size: 14px;">⚠️ For security, please change your password after your first login.</p>
              <div style="text-align: center; margin: 30px 0;">
                <a href="${appUrl}/auth" style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">Login to HireMetrics</a>
              </div>
              <p>If you have any questions, feel free to reach out to our support team.</p>
              <p>Best regards,<br><strong>The HireMetrics Team</strong></p>
            </div>
            <div style="text-align: center; padding: 20px; color: #6b7280; font-size: 12px;">
              <p>© ${new Date().getFullYear()} HireMetrics. All rights reserved.</p>
            </div>
          </body>
          </html>
        `;

        const emailResponse = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${resendApiKey}`,
          },
          body: JSON.stringify({
            from: "HireMetrics <admin@hiremetrics.co.uk>",
            to: [email],
            subject: "Welcome to HireMetrics - Your Account is Ready!",
            html: welcomeEmailHtml,
          }),
        });

        if (emailResponse.ok) {
          console.log(`Welcome email sent to: ${email}`);
        } else {
          const errorData = await emailResponse.text();
          console.error("Failed to send welcome email:", errorData);
        }
      } catch (emailError) {
        console.error("Error sending welcome email:", emailError);
        // Don't fail the user creation if email fails
      }
    } else {
      console.warn("RESEND_API_KEY not configured, skipping welcome email");
    }

    console.log(`User created successfully: ${email}`);

    return new Response(
      JSON.stringify({
        success: true,
        user: {
          id: newUser.user.id,
          email: newUser.user.email,
        },
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error: any) {
    console.error("Error in admin-create-user:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
