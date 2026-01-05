import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { sendTeamEmail } from "../_shared/smtp-sender.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[DELETE-USER] ${step}${detailsStr}`);
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    logStep("Function started");
    
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Missing authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { user_id, tenant_id } = await req.json();
    logStep("Request received", { user_id, tenant_id });

    if (!user_id) {
      return new Response(
        JSON.stringify({ error: 'user_id is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create Supabase admin client with service role key
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    // Create user client to verify the caller
    const supabaseUser = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY')!, {
      global: { headers: { Authorization: authHeader } }
    });

    // Get the caller's user
    const { data: { user: caller }, error: userError } = await supabaseUser.auth.getUser();
    if (userError || !caller) {
      logStep("Auth error", { error: userError });
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    logStep("Caller authenticated", { callerId: caller.id });

    // Check if caller is super_admin (can delete any user)
    const { data: superAdminCheck } = await supabaseAdmin
      .from('user_roles')
      .select('role')
      .eq('user_id', caller.id)
      .eq('role', 'super_admin')
      .maybeSingle();

    const isSuperAdmin = !!superAdminCheck;
    logStep("Super admin check", { isSuperAdmin });

    // If not super_admin, check if caller is owner or manager in the tenant
    let callerRole = null;
    if (!isSuperAdmin) {
      if (!tenant_id) {
        return new Response(
          JSON.stringify({ error: 'tenant_id is required for non-super_admin users' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const { data: roleData, error: roleError } = await supabaseAdmin
        .from('user_roles')
        .select('role')
        .eq('user_id', caller.id)
        .eq('tenant_id', tenant_id)
        .in('role', ['owner', 'manager'])
        .maybeSingle();

      if (roleError || !roleData) {
        logStep("Permission denied - not owner/manager", { roleError });
        return new Response(
          JSON.stringify({ error: 'You do not have permission to delete users' }),
          { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      callerRole = roleData;
    }

    // Prevent deleting yourself
    if (user_id === caller.id) {
      return new Response(
        JSON.stringify({ error: 'You cannot delete your own account' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get target user's profile and role info
    const { data: targetProfile } = await supabaseAdmin
      .from('profiles')
      .select('full_name, email, tenant_id')
      .eq('id', user_id)
      .single();

    if (!targetProfile) {
      return new Response(
        JSON.stringify({ error: 'User not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const targetTenantId = tenant_id || targetProfile.tenant_id;
    logStep("Target user found", { email: targetProfile.email, targetTenantId });

    // Check target user's role
    const { data: targetRole } = await supabaseAdmin
      .from('user_roles')
      .select('role, tenant_id')
      .eq('user_id', user_id)
      .maybeSingle();

    // Non-super_admin: Managers cannot delete owners
    if (!isSuperAdmin && callerRole?.role === 'manager' && targetRole?.role === 'owner') {
      return new Response(
        JSON.stringify({ error: 'Managers cannot delete owners' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get owner for record reassignment
    const { data: ownerData } = await supabaseAdmin
      .from('user_roles')
      .select('user_id')
      .eq('tenant_id', targetTenantId)
      .eq('role', 'owner')
      .maybeSingle();

    const ownerUserId = ownerData?.user_id || caller.id;
    logStep("Owner for reassignment", { ownerUserId });

    // ============================================
    // STEP 1: Clean up FK references FIRST (before auth.users deletion)
    // ============================================
    logStep("Cleaning up FK references before auth deletion...");

    // Reassign events to owner (events_organizer_id_fkey)
    const { error: eventsReassignError } = await supabaseAdmin
      .from('events')
      .update({ organizer_id: ownerUserId })
      .eq('organizer_id', user_id);
    if (eventsReassignError) logStep("Events reassign error", { error: eventsReassignError });
    else logStep("Events reassigned to owner");

    // Clear team_invitations accepted_by (team_invitations_accepted_by_fkey)
    const { error: invitationsError } = await supabaseAdmin
      .from('team_invitations')
      .update({ accepted_by: null })
      .eq('accepted_by', user_id);
    if (invitationsError) logStep("Team invitations cleanup error", { error: invitationsError });
    else logStep("Team invitations cleaned up");

    // Remove from event participants
    const { error: participantsError } = await supabaseAdmin
      .from('event_participants')
      .delete()
      .eq('user_id', user_id);
    if (participantsError) logStep("Event participants cleanup error", { error: participantsError });

    // ============================================
    // STEP 2: Delete from auth.users
    // ============================================
    logStep("Deleting from auth.users...");
    const { error: deleteAuthError } = await supabaseAdmin.auth.admin.deleteUser(user_id);
    if (deleteAuthError) {
      logStep("Auth deletion FAILED", { error: deleteAuthError.message });
      return new Response(
        JSON.stringify({ error: 'Failed to delete user: ' + deleteAuthError.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    logStep("User deleted from auth.users");

    // ============================================
    // STEP 3: Clean up remaining records (cascade may have handled some)
    // ============================================
    logStep("Cleaning up remaining user records...");

    // Reassign jobs created by user to owner
    const { error: jobsCreatedError } = await supabaseAdmin
      .from('jobs')
      .update({ created_by: ownerUserId })
      .eq('created_by', user_id);
    if (jobsCreatedError) logStep("Jobs created_by error", { error: jobsCreatedError });

    // Clear job assignments
    const { error: jobsAssignedError } = await supabaseAdmin
      .from('jobs')
      .update({ assigned_to: null })
      .eq('assigned_to', user_id);
    if (jobsAssignedError) logStep("Jobs assigned_to error", { error: jobsAssignedError });

    // Remove from job_assignees
    const { error: jobAssigneesError } = await supabaseAdmin
      .from('job_assignees')
      .delete()
      .eq('user_id', user_id);
    if (jobAssigneesError) logStep("Job assignees error", { error: jobAssigneesError });

    // Reassign candidates to owner
    const { error: candidatesError } = await supabaseAdmin
      .from('candidates')
      .update({ created_by: ownerUserId })
      .eq('created_by', user_id);
    if (candidatesError) logStep("Candidates error", { error: candidatesError });

    // Reassign clients to owner
    const { error: clientsError } = await supabaseAdmin
      .from('clients')
      .update({ created_by: ownerUserId })
      .eq('created_by', user_id);
    if (clientsError) logStep("Clients error", { error: clientsError });

    // Update client default recruiter
    const { error: clientRecruiterError } = await supabaseAdmin
      .from('clients')
      .update({ default_recruiter_id: null })
      .eq('default_recruiter_id', user_id);
    if (clientRecruiterError) logStep("Client recruiter error", { error: clientRecruiterError });

    // Delete email accounts
    const { error: emailAccountsError } = await supabaseAdmin
      .from('email_accounts')
      .delete()
      .eq('user_id', user_id);
    if (emailAccountsError) logStep("Email accounts error", { error: emailAccountsError });

    // Delete user permissions
    const { error: permissionsError } = await supabaseAdmin
      .from('user_permissions')
      .delete()
      .eq('user_id', user_id);
    if (permissionsError) logStep("Permissions error", { error: permissionsError });

    // Delete LinkedIn connections
    const { error: linkedinError } = await supabaseAdmin
      .from('linkedin_connections')
      .delete()
      .eq('user_id', user_id);
    if (linkedinError) logStep("LinkedIn connections error", { error: linkedinError });

    // Update CV submissions submitted_by
    const { error: cvSubmissionsError } = await supabaseAdmin
      .from('cv_submissions')
      .update({ submitted_by: ownerUserId })
      .eq('submitted_by', user_id);
    if (cvSubmissionsError) logStep("CV submissions error", { error: cvSubmissionsError });

    // Update candidate emails sent_by
    const { error: candEmailsError } = await supabaseAdmin
      .from('candidate_emails')
      .update({ sent_by: ownerUserId })
      .eq('sent_by', user_id);
    if (candEmailsError) logStep("Candidate emails error", { error: candEmailsError });

    // Update client emails sent_by
    const { error: clientEmailsError } = await supabaseAdmin
      .from('client_emails')
      .update({ sent_by: ownerUserId })
      .eq('sent_by', user_id);
    if (clientEmailsError) logStep("Client emails error", { error: clientEmailsError });

    // Clear chat assignments
    const { error: chatAssignError } = await supabaseAdmin
      .from('chat_conversations')
      .update({ assigned_to: null })
      .eq('assigned_to', user_id);
    if (chatAssignError) logStep("Chat assignments error", { error: chatAssignError });

    // Delete notifications
    const { error: notificationsError } = await supabaseAdmin
      .from('notifications')
      .delete()
      .eq('user_id', user_id);
    if (notificationsError) logStep("Notifications error", { error: notificationsError });

    logStep("Credit transactions preserved for audit");

    // ============================================
    // STEP 3: Delete user role (if not already cascade deleted)
    // ============================================
    const { error: deleteRoleError } = await supabaseAdmin
      .from('user_roles')
      .delete()
      .eq('user_id', user_id);
    if (deleteRoleError) logStep("Role deletion error (may already be deleted)", { error: deleteRoleError });
    else logStep("User role deleted");

    // ============================================
    // STEP 4: Delete user profile (if not already cascade deleted)
    // ============================================
    const { error: deleteProfileError } = await supabaseAdmin
      .from('profiles')
      .delete()
      .eq('id', user_id);
    if (deleteProfileError) logStep("Profile deletion error (may already be deleted)", { error: deleteProfileError });
    else logStep("User profile deleted");

    // ============================================
    // STEP 6: Log audit entry
    // ============================================
    const { error: auditError } = await supabaseAdmin
      .from('audit_log')
      .insert({
        action: 'user_permanently_deleted',
        entity_type: 'user',
        entity_id: user_id,
        user_id: caller.id,
        tenant_id: targetTenantId,
        old_values: {
          email: targetProfile.email,
          full_name: targetProfile.full_name,
          role: targetRole?.role,
        },
        new_values: null,
        ip_address: req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip'),
        user_agent: req.headers.get('user-agent'),
      });
    if (auditError) logStep("Audit log error", { error: auditError });
    else logStep("Audit log created");

    // ============================================
    // STEP 7: Recalculate tenant usage
    // ============================================
    const { count: teamCount } = await supabaseAdmin
      .from('user_roles')
      .select('*', { count: 'exact', head: true })
      .eq('tenant_id', targetTenantId)
      .neq('role', 'super_admin');
    
    logStep("Tenant team count recalculated", { teamCount });

    // ============================================
    // STEP 8: Send notification emails (SMTP-only)
    // ============================================
    try {
      // Get owner email to notify
      if (ownerUserId !== user_id && ownerUserId !== caller.id) {
        const { data: ownerProfile } = await supabaseAdmin
          .from('profiles')
          .select('email, full_name')
          .eq('id', ownerUserId)
          .single();

        if (ownerProfile?.email) {
          const result = await sendTeamEmail(
            targetTenantId,
            caller.id,
            caller.email || 'Administrator',
            {
              to: ownerProfile.email,
              subject: `Team Member Removed: ${targetProfile.full_name || targetProfile.email}`,
              html: generateDeletionNotificationHTML({
                ownerName: ownerProfile.full_name || 'Team Owner',
                deletedUserName: targetProfile.full_name || 'Team Member',
                deletedUserEmail: targetProfile.email,
                deletedByName: caller.email || 'Administrator',
              }),
            }
          );

          if (!result.success) {
            logStep("Failed to send owner notification", { error: result.error });
          } else {
            logStep("Owner notified of deletion", { email: ownerProfile.email, from: result.from });
          }
        }
      }
    } catch (e) {
      logStep("Failed to send owner notification", { error: e instanceof Error ? e.message : String(e) });
    }

    logStep("User deletion completed successfully", { 
      deletedUser: targetProfile.email,
      deletedBy: caller.email,
      isSuperAdmin 
    });

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'User permanently deleted',
        deleted_user_email: targetProfile.email,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logStep("FATAL ERROR", { error: errorMessage });
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

function generateDeletionNotificationHTML(data: {
  ownerName: string;
  deletedUserName: string;
  deletedUserEmail: string;
  deletedByName: string;
}): string {
  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Team Member Removed</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif; background-color: #f1f5f9;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f1f5f9; padding: 40px 20px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="max-width: 600px; background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 24px rgba(0, 0, 0, 0.08);">
          <tr>
            <td style="padding: 30px 40px; background: #1e293b; text-align: center;">
              <h1 style="margin: 0; color: #ffffff; font-size: 22px; font-weight: 600;">Team Member Removed</h1>
            </td>
          </tr>
          <tr>
            <td style="padding: 40px;">
              <p style="margin: 0 0 20px; color: #1e293b; font-size: 16px;">Hello ${data.ownerName},</p>
              <p style="margin: 0 0 20px; color: #475569; font-size: 15px; line-height: 1.6;">
                A team member has been permanently removed from your HireMetrics workspace.
              </p>
              <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f8fafc; border-radius: 8px; margin-bottom: 25px;">
                <tr>
                  <td style="padding: 20px;">
                    <p style="margin: 0 0 8px; color: #64748b; font-size: 13px;">Removed User</p>
                    <p style="margin: 0 0 4px; color: #1e293b; font-size: 15px; font-weight: 600;">${data.deletedUserName}</p>
                    <p style="margin: 0 0 16px; color: #64748b; font-size: 14px;">${data.deletedUserEmail}</p>
                    <p style="margin: 0 0 4px; color: #64748b; font-size: 13px;">Removed by</p>
                    <p style="margin: 0; color: #1e293b; font-size: 14px;">${data.deletedByName}</p>
                  </td>
                </tr>
              </table>
              <p style="margin: 0 0 20px; color: #475569; font-size: 14px; line-height: 1.6;">
                All records created by this user have been reassigned to you. The user can no longer access the platform.
              </p>
              <p style="margin: 0; color: #1e293b; font-size: 14px;">
                Best regards,<br>
                <strong>HireMetrics</strong>
              </p>
            </td>
          </tr>
          <tr>
            <td style="background-color: #f8fafc; padding: 20px; text-align: center; border-top: 1px solid #e2e8f0;">
              <p style="margin: 0; color: #64748b; font-size: 12px;">
                © ${new Date().getFullYear()} HireMetrics. All rights reserved.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `;
}
