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

    const { email } = await req.json();

    if (!email) {
      return new Response(
        JSON.stringify({ error: 'email is required' }),
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

    // Check if caller is super_admin
    const { data: superAdminCheck } = await supabaseAdmin
      .from('user_roles')
      .select('role')
      .eq('user_id', caller.id)
      .eq('role', 'super_admin')
      .single();

    if (!superAdminCheck) {
      return new Response(
        JSON.stringify({ error: 'Only super admins can delete orphaned users' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // List users with this email from auth.users
    const { data: authUsers, error: listError } = await supabaseAdmin.auth.admin.listUsers();
    
    if (listError) {
      console.error('Error listing users:', listError);
      return new Response(
        JSON.stringify({ error: 'Failed to search for user' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Find user by email
    const targetUser = authUsers.users.find(u => u.email?.toLowerCase() === email.toLowerCase());
    
    if (!targetUser) {
      return new Response(
        JSON.stringify({ error: 'No user found with this email in auth.users' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Found auth user: ${targetUser.id} with email ${email}`);

    // Check if user exists in profiles (if so, they're not orphaned)
    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('id')
      .eq('id', targetUser.id)
      .single();

    if (profile) {
      return new Response(
        JSON.stringify({ 
          error: 'This user has a profile and is not orphaned. Use the regular delete function instead.',
          user_id: targetUser.id
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Clear job assignments referencing this user
    const { error: jobsError } = await supabaseAdmin
      .from('jobs')
      .update({ assigned_to: null })
      .eq('assigned_to', targetUser.id);

    if (jobsError) {
      console.error('Error clearing job assignments:', jobsError);
    }

    // Clear job_assignees referencing this user
    const { error: assigneesError } = await supabaseAdmin
      .from('job_assignees')
      .delete()
      .eq('user_id', targetUser.id);

    if (assigneesError) {
      console.error('Error clearing job_assignees:', assigneesError);
    }

    // Clean up any orphaned user_roles
    const { error: rolesError } = await supabaseAdmin
      .from('user_roles')
      .delete()
      .eq('user_id', targetUser.id);

    if (rolesError) {
      console.error('Error cleaning up user_roles:', rolesError);
    }

    // Clean up any orphaned profiles (shouldn't exist but just in case)
    const { error: profileError } = await supabaseAdmin
      .from('profiles')
      .delete()
      .eq('id', targetUser.id);

    if (profileError) {
      console.error('Error cleaning up profiles:', profileError);
    }

    // Delete user from auth.users
    const { error: deleteError } = await supabaseAdmin.auth.admin.deleteUser(targetUser.id);

    if (deleteError) {
      console.error('Error deleting user from auth:', deleteError);
      return new Response(
        JSON.stringify({ error: 'Failed to delete user from auth.users' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Super admin ${caller.id} deleted orphaned auth user ${targetUser.id} (${email})`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: `Orphaned user ${email} deleted successfully`,
        deleted_user_id: targetUser.id
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    console.error('Error in delete-orphaned-user:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
