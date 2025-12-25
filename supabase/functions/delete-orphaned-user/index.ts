import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type JsonResponseInit = { status?: number };

function jsonResponse(body: unknown, init: JsonResponseInit = {}) {
  return new Response(JSON.stringify(body), {
    status: init.status ?? 200,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function findAuthUserByEmail(
  supabaseAdmin: any,
  emailLower: string
) {
  const perPage = 1000;
  let page = 1;

  // Scan pages to avoid missing users (listUsers is paginated)
  while (page <= 50) {
    const { data, error } = await supabaseAdmin.auth.admin.listUsers({ page, perPage });
    if (error) return { user: null, error };

    const found = data.users.find((u: any) => (u.email ?? "").toLowerCase() === emailLower);
    if (found) return { user: found, error: null };

    if (data.users.length < perPage) break;
    page += 1;
  }

  return { user: null, error: null };
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return jsonResponse({ error: "Missing authorization header" }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const emailRaw = (body as any)?.email as string | undefined;
    const email = emailRaw?.trim().toLowerCase();

    if (!email) {
      return jsonResponse({ error: "email is required" }, { status: 400 });
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
      return jsonResponse({ error: "Unauthorized" }, { status: 401 });
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
      return jsonResponse({ error: "Failed to verify permissions" }, { status: 500 });
    }

    if (!superAdminCheck) {
      return jsonResponse({ error: "Only super admins can delete orphaned users" }, { status: 403 });
    }

    // Find auth user by email (paginated)
    const { user: targetUser, error: findError } = await findAuthUserByEmail(supabaseAdmin, email);

    if (findError) {
      console.error("Error listing users:", findError);
      return jsonResponse({ error: "Failed to search for user" }, { status: 500 });
    }

    if (!targetUser) {
      // Return 200 so supabase-js doesn't surface as a transport error
      return jsonResponse({ success: false, error: "No user found with this email in auth.users" });
    }

    console.log(`Found auth user: ${targetUser.id} with email ${email}`);

    // Only allow "orphan" cleanup when there is no CRM profile
    const { data: profile, error: profileCheckError } = await supabaseAdmin
      .from("profiles")
      .select("id")
      .eq("id", targetUser.id)
      .maybeSingle();

    if (profileCheckError) {
      console.error("Error checking profile:", profileCheckError);
      return jsonResponse({ error: "Failed to verify profile status" }, { status: 500 });
    }

    if (profile) {
      // Return 200 so UI shows a friendly message
      return jsonResponse({
        success: false,
        error: "This user has a profile and is not orphaned. Use the regular delete function instead.",
        user_id: targetUser.id,
      });
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
        return jsonResponse({ error: "Failed to delete user or release email" }, { status: 500 });
      }

      console.log(`Released email ${email} by renaming auth user ${targetUser.id} -> ${releasedEmail}`);

      return jsonResponse({
        success: true,
        action: "email_released",
        message: `User could not be fully deleted due to linked data. Email ${email} is now free to sign up again.`,
        released_email: releasedEmail,
        user_id: targetUser.id,
      });
    }

    console.log(`Super admin ${caller.id} deleted orphaned auth user ${targetUser.id} (${email})`);

    return jsonResponse({
      success: true,
      action: "user_deleted",
      message: `Orphaned user ${email} deleted successfully`,
      deleted_user_id: targetUser.id,
    });
  } catch (error: unknown) {
    console.error("Error in delete-orphaned-user:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return jsonResponse({ error: errorMessage }, { status: 500 });
  }
});
