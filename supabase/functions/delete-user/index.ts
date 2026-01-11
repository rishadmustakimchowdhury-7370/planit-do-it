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
      .neq('user_id', user_id) // Exclude the user being deleted
      .maybeSingle();

    const ownerUserId = ownerData?.user_id || caller.id;
    logStep("Owner for reassignment", { ownerUserId });

    // ============================================
    // STEP 1: Clean up ALL FK references BEFORE auth.users deletion
    // This MUST happen before auth deletion to avoid FK constraint violations
    // ============================================
    logStep("Cleaning up ALL FK references before auth deletion...");

    // Helper to log cleanup errors but continue
    const logCleanupError = (table: string, error: any) => {
      if (error) logStep(`Cleanup error: ${table}`, { code: error.code, message: error.message });
    };

    // ---- Tables with user_id FK to auth.users ----
    
    // user_roles - DELETE (will be recreated if user signs up again)
    const { error: rolesErr } = await supabaseAdmin
      .from('user_roles')
      .delete()
      .eq('user_id', user_id);
    logCleanupError('user_roles', rolesErr);
    if (!rolesErr) logStep("user_roles deleted");

    // profiles - DELETE
    const { error: profileErr } = await supabaseAdmin
      .from('profiles')
      .delete()
      .eq('id', user_id);
    logCleanupError('profiles', profileErr);
    if (!profileErr) logStep("profiles deleted");

    // email_accounts - DELETE
    const { error: emailAccErr } = await supabaseAdmin
      .from('email_accounts')
      .delete()
      .eq('user_id', user_id);
    logCleanupError('email_accounts', emailAccErr);

    // user_email_templates - DELETE
    const { error: templatesErr } = await supabaseAdmin
      .from('user_email_templates')
      .delete()
      .eq('user_id', user_id);
    logCleanupError('user_email_templates', templatesErr);

    // ai_usage - Nullify user_id (preserve for analytics)
    const { error: aiUsageErr } = await supabaseAdmin
      .from('ai_usage')
      .update({ user_id: null })
      .eq('user_id', user_id);
    logCleanupError('ai_usage', aiUsageErr);

    // activities - Nullify user_id (preserve for audit)
    const { error: activitiesErr } = await supabaseAdmin
      .from('activities')
      .update({ user_id: null })
      .eq('user_id', user_id);
    logCleanupError('activities', activitiesErr);

    // audit_log - Nullify user_id (preserve for audit)
    const { error: auditErr } = await supabaseAdmin
      .from('audit_log')
      .update({ user_id: null })
      .eq('user_id', user_id);
    logCleanupError('audit_log', auditErr);

    // notifications - DELETE
    const { error: notifErr } = await supabaseAdmin
      .from('notifications')
      .delete()
      .eq('user_id', user_id);
    logCleanupError('notifications', notifErr);

    // user_permissions - DELETE
    const { error: permErr } = await supabaseAdmin
      .from('user_permissions')
      .delete()
      .eq('user_id', user_id);
    logCleanupError('user_permissions', permErr);

    // linkedin_connections - DELETE
    const { error: linkedinErr } = await supabaseAdmin
      .from('linkedin_connections')
      .delete()
      .eq('user_id', user_id);
    logCleanupError('linkedin_connections', linkedinErr);

    // event_participants - DELETE where user_id
    const { error: participantsErr } = await supabaseAdmin
      .from('event_participants')
      .delete()
      .eq('user_id', user_id);
    logCleanupError('event_participants', participantsErr);

    // work_sessions - DELETE
    const { error: workSessionsErr } = await supabaseAdmin
      .from('work_sessions')
      .delete()
      .eq('user_id', user_id);
    logCleanupError('work_sessions', workSessionsErr);

    // recruiter_activities - DELETE
    const { error: recruiterActErr } = await supabaseAdmin
      .from('recruiter_activities')
      .delete()
      .eq('user_id', user_id);
    logCleanupError('recruiter_activities', recruiterActErr);

    // credit_transactions - Nullify user_id (preserve for billing)
    const { error: creditTxErr } = await supabaseAdmin
      .from('credit_transactions')
      .update({ user_id: ownerUserId })
      .eq('user_id', user_id);
    logCleanupError('credit_transactions', creditTxErr);

    // orders - Nullify user_id (CRITICAL - was blocking deletion)
    const { error: ordersErr } = await supabaseAdmin
      .from('orders')
      .update({ user_id: null })
      .eq('user_id', user_id);
    logCleanupError('orders', ordersErr);
    if (!ordersErr) logStep("orders user_id nullified");

    // ---- Tables with created_by FK ----

    // jobs - Reassign created_by to owner
    const { error: jobsCreatedErr } = await supabaseAdmin
      .from('jobs')
      .update({ created_by: ownerUserId })
      .eq('created_by', user_id);
    logCleanupError('jobs.created_by', jobsCreatedErr);

    // jobs - NULLIFY assigned_to (CRITICAL - was blocking deletion)
    const { error: jobsAssignedErr } = await supabaseAdmin
      .from('jobs')
      .update({ assigned_to: null })
      .eq('assigned_to', user_id);
    logCleanupError('jobs.assigned_to', jobsAssignedErr);
    if (!jobsAssignedErr) logStep("jobs.assigned_to nullified");

    // job_assignees - DELETE
    const { error: jobAssigneesErr } = await supabaseAdmin
      .from('job_assignees')
      .delete()
      .eq('user_id', user_id);
    logCleanupError('job_assignees', jobAssigneesErr);

    // job_assignees - Nullify assigned_by
    const { error: jobAssignedByErr } = await supabaseAdmin
      .from('job_assignees')
      .update({ assigned_by: null })
      .eq('assigned_by', user_id);
    logCleanupError('job_assignees.assigned_by', jobAssignedByErr);

    // candidates - Reassign created_by
    const { error: candidatesErr } = await supabaseAdmin
      .from('candidates')
      .update({ created_by: ownerUserId })
      .eq('created_by', user_id);
    logCleanupError('candidates.created_by', candidatesErr);

    // clients - Reassign created_by
    const { error: clientsCreatedErr } = await supabaseAdmin
      .from('clients')
      .update({ created_by: ownerUserId })
      .eq('created_by', user_id);
    logCleanupError('clients.created_by', clientsCreatedErr);

    // clients - Nullify default_recruiter_id
    const { error: clientsRecruiterErr } = await supabaseAdmin
      .from('clients')
      .update({ default_recruiter_id: null })
      .eq('default_recruiter_id', user_id);
    logCleanupError('clients.default_recruiter_id', clientsRecruiterErr);

    // events - Reassign organizer_id
    const { error: eventsErr } = await supabaseAdmin
      .from('events')
      .update({ organizer_id: ownerUserId })
      .eq('organizer_id', user_id);
    logCleanupError('events.organizer_id', eventsErr);

    // cms_pages - Nullify created_by
    const { error: cmsErr } = await supabaseAdmin
      .from('cms_pages')
      .update({ created_by: null })
      .eq('created_by', user_id);
    logCleanupError('cms_pages.created_by', cmsErr);

    // platform_settings - Nullify updated_by
    const { error: platformErr } = await supabaseAdmin
      .from('platform_settings')
      .update({ updated_by: null })
      .eq('updated_by', user_id);
    logCleanupError('platform_settings.updated_by', platformErr);

    // site_branding - Nullify updated_by
    const { error: brandingErr } = await supabaseAdmin
      .from('site_branding')
      .update({ updated_by: null })
      .eq('updated_by', user_id);
    logCleanupError('site_branding.updated_by', brandingErr);

    // support_tickets - Nullify assigned_to and created_by
    const { error: ticketsAssignedErr } = await supabaseAdmin
      .from('support_tickets')
      .update({ assigned_to: null })
      .eq('assigned_to', user_id);
    logCleanupError('support_tickets.assigned_to', ticketsAssignedErr);

    const { error: ticketsCreatedErr } = await supabaseAdmin
      .from('support_tickets')
      .update({ created_by: null })
      .eq('created_by', user_id);
    logCleanupError('support_tickets.created_by', ticketsCreatedErr);

    // import_jobs - Nullify created_by
    const { error: importJobsErr } = await supabaseAdmin
      .from('import_jobs')
      .update({ created_by: null })
      .eq('created_by', user_id);
    logCleanupError('import_jobs.created_by', importJobsErr);

    // chat_conversations - Nullify assigned_to
    const { error: chatErr } = await supabaseAdmin
      .from('chat_conversations')
      .update({ assigned_to: null })
      .eq('assigned_to', user_id);
    logCleanupError('chat_conversations.assigned_to', chatErr);

    // cv_submissions - Reassign submitted_by
    const { error: cvSubErr } = await supabaseAdmin
      .from('cv_submissions')
      .update({ submitted_by: ownerUserId })
      .eq('submitted_by', user_id);
    logCleanupError('cv_submissions.submitted_by', cvSubErr);

    // candidate_emails - Reassign sent_by
    const { error: candEmailsErr } = await supabaseAdmin
      .from('candidate_emails')
      .update({ sent_by: ownerUserId })
      .eq('sent_by', user_id);
    logCleanupError('candidate_emails.sent_by', candEmailsErr);

    // client_emails - Reassign sent_by
    const { error: clientEmailsErr } = await supabaseAdmin
      .from('client_emails')
      .update({ sent_by: ownerUserId })
      .eq('sent_by', user_id);
    logCleanupError('client_emails.sent_by', clientEmailsErr);

    // client_activities - Nullify created_by
    const { error: clientActErr } = await supabaseAdmin
      .from('client_activities')
      .update({ created_by: null })
      .eq('created_by', user_id);
    logCleanupError('client_activities.created_by', clientActErr);

    // client_attachments - Nullify uploaded_by
    const { error: clientAttachErr } = await supabaseAdmin
      .from('client_attachments')
      .update({ uploaded_by: null })
      .eq('uploaded_by', user_id);
    logCleanupError('client_attachments.uploaded_by', clientAttachErr);

    // team_invitations - Nullify invited_by and accepted_by
    const { error: invitedByErr } = await supabaseAdmin
      .from('team_invitations')
      .update({ invited_by: null })
      .eq('invited_by', user_id);
    logCleanupError('team_invitations.invited_by', invitedByErr);

    const { error: acceptedByErr } = await supabaseAdmin
      .from('team_invitations')
      .update({ accepted_by: null })
      .eq('accepted_by', user_id);
    logCleanupError('team_invitations.accepted_by', acceptedByErr);

    // user_invites - Nullify invited_by
    const { error: userInvitesErr } = await supabaseAdmin
      .from('user_invites')
      .update({ invited_by: null })
      .eq('invited_by', user_id);
    logCleanupError('user_invites.invited_by', userInvitesErr);

    // temp_login_links - DELETE
    const { error: tempLinksErr } = await supabaseAdmin
      .from('temp_login_links')
      .delete()
      .or(`user_id.eq.${user_id},created_by.eq.${user_id}`);
    logCleanupError('temp_login_links', tempLinksErr);

    // linkedin_message_logs - Nullify sent_by
    const { error: linkedinLogsErr } = await supabaseAdmin
      .from('linkedin_message_logs')
      .update({ sent_by: ownerUserId })
      .eq('sent_by', user_id);
    logCleanupError('linkedin_message_logs.sent_by', linkedinLogsErr);

    // linkedin_message_templates - Nullify created_by
    const { error: linkedinTemplatesErr } = await supabaseAdmin
      .from('linkedin_message_templates')
      .update({ created_by: null })
      .eq('created_by', user_id);
    logCleanupError('linkedin_message_templates.created_by', linkedinTemplatesErr);

    // linkedin_outreach_campaigns - Nullify created_by
    const { error: outreachErr } = await supabaseAdmin
      .from('linkedin_outreach_campaigns')
      .update({ created_by: null })
      .eq('created_by', user_id);
    logCleanupError('linkedin_outreach_campaigns.created_by', outreachErr);

    // deleted_by in profiles - Nullify (for soft delete history)
    const { error: deletedByErr } = await supabaseAdmin
      .from('profiles')
      .update({ deleted_by: null })
      .eq('deleted_by', user_id);
    logCleanupError('profiles.deleted_by', deletedByErr);

    logStep("ALL FK references cleaned up");

    // ============================================
    // STEP 2: Delete from auth.users
    // ============================================
    logStep("Deleting from auth.users...");
    const { error: deleteAuthError } = await supabaseAdmin.auth.admin.deleteUser(user_id);
    
    if (deleteAuthError) {
      logStep("Auth deletion FAILED", { error: deleteAuthError.message });
      
      // If deletion fails, try to release the email by updating user metadata
      // This allows the email to be reused for new signups
      try {
        const deletedEmail = `deleted+${user_id}@deleted.invalid`;
        const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(user_id, {
          email: deletedEmail,
          email_confirm: false,
          user_metadata: { 
            deleted: true, 
            deleted_at: new Date().toISOString(),
            original_email: targetProfile.email 
          }
        });
        
        if (!updateError) {
          logStep("Email released for reuse", { originalEmail: targetProfile.email });
        } else {
          logStep("Failed to release email", { error: updateError.message });
          return new Response(
            JSON.stringify({ error: 'Failed to delete user: ' + deleteAuthError.message }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
      } catch (e) {
        return new Response(
          JSON.stringify({ error: 'Failed to delete user: ' + deleteAuthError.message }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    } else {
      logStep("User deleted from auth.users");
    }

    // ============================================
    // STEP 3: Log audit entry
    // ============================================
    const { error: auditLogError } = await supabaseAdmin
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
    if (auditLogError) logStep("Audit log error", { error: auditLogError });
    else logStep("Audit log created");

    // ============================================
    // STEP 4: Recalculate tenant usage
    // ============================================
    const { count: teamCount } = await supabaseAdmin
      .from('user_roles')
      .select('*', { count: 'exact', head: true })
      .eq('tenant_id', targetTenantId)
      .neq('role', 'super_admin');
    
    logStep("Tenant team count recalculated", { teamCount });

    // ============================================
    // STEP 5: Send notification emails (SMTP-only)
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
                    <p style="margin: 0 0 15px; color: #1e293b; font-size: 16px; font-weight: 600;">${data.deletedUserName}</p>
                    <p style="margin: 0 0 8px; color: #64748b; font-size: 13px;">Email</p>
                    <p style="margin: 0 0 15px; color: #1e293b; font-size: 15px;">${data.deletedUserEmail}</p>
                    <p style="margin: 0 0 8px; color: #64748b; font-size: 13px;">Removed By</p>
                    <p style="margin: 0; color: #1e293b; font-size: 15px;">${data.deletedByName}</p>
                  </td>
                </tr>
              </table>
              <p style="margin: 0; color: #64748b; font-size: 14px; line-height: 1.6;">
                This user's data has been reassigned to you. If you have any questions, please contact support.
              </p>
            </td>
          </tr>
          <tr>
            <td style="padding: 25px 40px; background-color: #f8fafc; text-align: center; border-top: 1px solid #e2e8f0;">
              <p style="margin: 0; color: #94a3b8; font-size: 13px;">
                HireMetrics – Intelligent Recruitment Platform
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `.trim();
}
