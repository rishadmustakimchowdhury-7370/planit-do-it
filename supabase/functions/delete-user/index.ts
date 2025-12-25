import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Missing authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { user_id, tenant_id } = await req.json();

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
      console.error('Auth error:', userError);
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if caller is super_admin (can delete any user)
    const { data: superAdminCheck } = await supabaseAdmin
      .from('user_roles')
      .select('role')
      .eq('user_id', caller.id)
      .eq('role', 'super_admin')
      .single();

    const isSuperAdmin = !!superAdminCheck;

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
        .single();

      if (roleError || !roleData) {
        console.error('Role check error:', roleError);
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

    // For super_admin: get the target user's tenant from their profile
    let targetTenantId = tenant_id;
    if (isSuperAdmin && !tenant_id) {
      const { data: targetProfile } = await supabaseAdmin
        .from('profiles')
        .select('tenant_id')
        .eq('id', user_id)
        .single();
      
      targetTenantId = targetProfile?.tenant_id;
    }

    // Check if target user exists
    const { data: targetRole, error: targetError } = await supabaseAdmin
      .from('user_roles')
      .select('role, tenant_id')
      .eq('user_id', user_id)
      .single();

    if (targetError || !targetRole) {
      return new Response(
        JSON.stringify({ error: 'User not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Non-super_admin: Managers cannot delete owners
    if (!isSuperAdmin && callerRole?.role === 'manager' && targetRole.role === 'owner') {
      return new Response(
        JSON.stringify({ error: 'Managers cannot delete owners' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Clean up related records that reference this user via foreign keys
    // Update events where user is organizer (set to null or delete)
    const { error: eventsError } = await supabaseAdmin
      .from('events')
      .delete()
      .eq('organizer_id', user_id);
    
    if (eventsError) {
      console.error('Error cleaning up events:', eventsError);
    }

    // Update jobs where user is assigned (set assigned_to to null)
    const { error: jobsAssignedError } = await supabaseAdmin
      .from('jobs')
      .update({ assigned_to: null })
      .eq('assigned_to', user_id);
    
    if (jobsAssignedError) {
      console.error('Error cleaning up jobs assigned_to:', jobsAssignedError);
    }

    // Update jobs where user is created_by (set to null)
    const { error: jobsCreatedError } = await supabaseAdmin
      .from('jobs')
      .update({ created_by: null })
      .eq('created_by', user_id);
    
    if (jobsCreatedError) {
      console.error('Error cleaning up jobs created_by:', jobsCreatedError);
    }

    // Clean up job_assignees
    const { error: jobAssigneesError } = await supabaseAdmin
      .from('job_assignees')
      .delete()
      .eq('user_id', user_id);
    
    if (jobAssigneesError) {
      console.error('Error cleaning up job_assignees:', jobAssigneesError);
    }

    // Clean up candidates created by user (set to null)
    const { error: candidatesError } = await supabaseAdmin
      .from('candidates')
      .update({ created_by: null })
      .eq('created_by', user_id);
    
    if (candidatesError) {
      console.error('Error cleaning up candidates:', candidatesError);
    }

    // Clean up clients created by user (set to null)
    const { error: clientsError } = await supabaseAdmin
      .from('clients')
      .update({ created_by: null })
      .eq('created_by', user_id);
    
    if (clientsError) {
      console.error('Error cleaning up clients:', clientsError);
    }

    // Clean up email accounts
    const { error: emailAccountsError } = await supabaseAdmin
      .from('email_accounts')
      .delete()
      .eq('user_id', user_id);
    
    if (emailAccountsError) {
      console.error('Error cleaning up email_accounts:', emailAccountsError);
    }

    // Clean up user permissions
    const { error: permissionsError } = await supabaseAdmin
      .from('user_permissions')
      .delete()
      .eq('user_id', user_id);
    
    if (permissionsError) {
      console.error('Error cleaning up user_permissions:', permissionsError);
    }

    // Delete user's role(s)
    const { error: deleteRoleError } = await supabaseAdmin
      .from('user_roles')
      .delete()
      .eq('user_id', user_id);

    if (deleteRoleError) {
      console.error('Error deleting user role:', deleteRoleError);
    }

    // Delete user's profile
    const { error: deleteProfileError } = await supabaseAdmin
      .from('profiles')
      .delete()
      .eq('id', user_id);

    if (deleteProfileError) {
      console.error('Error deleting profile:', deleteProfileError);
    }

    // Delete user from auth.users
    const { error: deleteError } = await supabaseAdmin.auth.admin.deleteUser(user_id);

    if (deleteError) {
      console.error('Error deleting user from auth:', deleteError);
      return new Response(
        JSON.stringify({ error: 'Database error deleting user' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`User ${caller.id} (${isSuperAdmin ? 'super_admin' : callerRole?.role}) deleted user ${user_id}`);

    return new Response(
      JSON.stringify({ success: true, message: 'User deleted successfully' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    console.error('Error in delete-user:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
