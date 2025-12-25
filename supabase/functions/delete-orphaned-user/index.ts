import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing authorization header" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let email: string | undefined;
    try {
      const body = await req.json();
      email = body?.email;
    } catch (_e) {
      // ignore
    }

    if (!email) {
      return new Response(JSON.stringify({ error: "email is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);
    const supabaseUser = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    // Verify caller
    const {
      data: { user: caller },
      error: userError,
    } = await supabaseUser.auth.getUser();

    if (userError || !caller) {
      console.error("Auth error:", userError);
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check if caller is super_admin
    const { data: superAdminCheck, error: roleCheckError } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", caller.id)
      .eq("role", "super_admin")
      .maybeSingle();

    if (roleCheckError) {
      console.error("Role check error:", roleCheckError);
    }

    if (!superAdminCheck) {
      return new Response(JSON.stringify({ error: "Only super admins can delete orphaned users" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Find auth user by email
    const { data: authUsers, error: listError } = await supabaseAdmin.auth.admin.listUsers();

    if (listError) {
      console.error("Error listing users:", listError);
      return new Response(JSON.stringify({ error: "Failed to search for user" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const targetUser = authUsers.users.find((u) => u.email?.toLowerCase() === email!.toLowerCase());

    if (!targetUser) {
      return new Response(JSON.stringify({ error: "No user found with this email in auth.users" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`Found auth user: ${targetUser.id} with email ${email}`);

    // Only allow "orphan" cleanup when there is no CRM profile
    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("id")
      .eq("id", targetUser.id)
      .maybeSingle();

    if (profile) {
      return new Response(
        JSON.stringify({
          error: "This user has a profile and is not orphaned. Use the regular delete function instead.",
          user_id: targetUser.id,
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Clean up orphaned app rows that might reference auth.users
    const { error: rolesError } = await supabaseAdmin.from("user_roles").delete().eq("user_id", targetUser.id);
    if (rolesError) console.error("Error cleaning up user_roles:", rolesError);

    const { error: profileDeleteError } = await supabaseAdmin.from("profiles").delete().eq("id", targetUser.id);
    if (profileDeleteError) console.error("Error cleaning up profiles:", profileDeleteError);

    // Try to delete from auth.users.
    // If deletion fails due to FK constraints (linked historical data), release the email by renaming it.
    const { error: deleteError } = await supabaseAdmin.auth.admin.deleteUser(targetUser.id);

    if (deleteError) {
      console.error("Hard delete failed. Releasing email instead:", deleteError);

      const releasedEmail = `deleted+${targetUser.id}@deleted.invalid`;

      const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(targetUser.id, {
        email: releasedEmail,
        email_confirm: true,
        user_metadata: {
          ...(targetUser.user_metadata ?? {}),
          deleted_original_email: email,
          deleted_at: new Date().toISOString(),
          deleted_by: caller.id,
        },
      });

      if (updateError) {
        console.error("Failed to release email via updateUserById:", updateError);
        return new Response(JSON.stringify({ error: "Failed to delete user or release email" }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      console.log(`Released email ${email} by renaming auth user ${targetUser.id} -> ${releasedEmail}`);

      return new Response(
        JSON.stringify({
          success: true,
          action: "email_released",
          message: `User could not be fully deleted due to linked data. Email ${email} is now free to sign up again.`,
          released_email: releasedEmail,
          user_id: targetUser.id,
        }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    console.log(`Super admin ${caller.id} deleted orphaned auth user ${targetUser.id} (${email})`);

    return new Response(
      JSON.stringify({
        success: true,
        action: "user_deleted",
        message: `Orphaned user ${email} deleted successfully`,
        deleted_user_id: targetUser.id,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error: unknown) {
    console.error("Error in delete-orphaned-user:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
