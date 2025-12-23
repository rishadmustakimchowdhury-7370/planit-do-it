import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } }
    );

    // Authenticate user
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Missing authorization header" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 401 }
      );
    }
    
    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userError } = await supabaseClient.auth.getUser(token);
    
    if (userError || !userData.user) {
      console.log("Auth error:", userError?.message);
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 401 }
      );
    }

    // Get user's tenant
    const { data: profile, error: profileError } = await supabaseClient
      .from("profiles")
      .select("tenant_id")
      .eq("id", userData.user.id)
      .single();

    if (profileError || !profile?.tenant_id) {
      throw new Error("No tenant found");
    }

    const tenantId = profile.tenant_id;

    // Get subscription plan details
    const { data: tenant, error: tenantError } = await supabaseClient
      .from("tenants")
      .select("subscription_plan_id, subscription_status")
      .eq("id", tenantId)
      .single();

    if (tenantError) throw tenantError;

    let planLimits = {
      max_users: 2,
      max_jobs: 10,
      max_candidates: 150,
      match_credits_monthly: 50,
    };

    if (tenant.subscription_plan_id) {
      const { data: plan, error: planError } = await supabaseClient
        .from("subscription_plans")
        .select("max_users, max_jobs, max_candidates, match_credits_monthly")
        .eq("id", tenant.subscription_plan_id)
        .single();

      if (!planError && plan) {
        planLimits = {
          max_users: plan.max_users || -1,
          max_jobs: plan.max_jobs || -1,
          max_candidates: plan.max_candidates || -1,
          match_credits_monthly: plan.match_credits_monthly || 0,
        };
      }
    }

    // Get current month start
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

    // Count AI usage for current month
    const { count: aiUsageCount, error: aiUsageError } = await supabaseClient
      .from("ai_usage")
      .select("*", { count: "exact", head: true })
      .eq("tenant_id", tenantId)
      .eq("action_type", "ai_match")
      .gte("created_at", monthStart);

    if (aiUsageError) {
      console.error("Error counting AI usage:", aiUsageError);
    }

    const aiCreditsUsed = aiUsageCount || 0;

    // Count active jobs
    const { count: jobsCount, error: jobsError } = await supabaseClient
      .from("jobs")
      .select("*", { count: "exact", head: true })
      .eq("tenant_id", tenantId)
      .in("status", ["open", "draft"]);

    if (jobsError) {
      console.error("Error counting jobs:", jobsError);
    }

    const activeJobs = jobsCount || 0;

    // Count candidates
    const { count: candidatesCount, error: candidatesError } = await supabaseClient
      .from("candidates")
      .select("*", { count: "exact", head: true })
      .eq("tenant_id", tenantId);

    if (candidatesError) {
      console.error("Error counting candidates:", candidatesError);
    }

    const totalCandidates = candidatesCount || 0;

    // Count team members
    const { count: usersCount, error: usersError } = await supabaseClient
      .from("profiles")
      .select("*", { count: "exact", head: true })
      .eq("tenant_id", tenantId)
      .eq("is_active", true);

    if (usersError) {
      console.error("Error counting users:", usersError);
    }

    const teamMembers = usersCount || 0;

    // Calculate percentages and warnings
    const calculateStatus = (used: number, limit: number) => {
      if (limit === -1) return { percent: 0, warning: false, blocked: false };
      const percent = (used / limit) * 100;
      return {
        percent: Math.round(percent),
        warning: percent >= 80 && percent < 100,
        blocked: percent >= 100,
      };
    };

    const aiCreditsStatus = calculateStatus(aiCreditsUsed, planLimits.match_credits_monthly);
    const jobsStatus = calculateStatus(activeJobs, planLimits.max_jobs);
    const candidatesStatus = calculateStatus(totalCandidates, planLimits.max_candidates);
    const usersStatus = calculateStatus(teamMembers, planLimits.max_users);

    return new Response(
      JSON.stringify({
        limits: planLimits,
        usage: {
          aiCredits: {
            used: aiCreditsUsed,
            limit: planLimits.match_credits_monthly,
            remaining: Math.max(0, planLimits.match_credits_monthly - aiCreditsUsed),
            ...aiCreditsStatus,
          },
          jobs: {
            used: activeJobs,
            limit: planLimits.max_jobs,
            remaining: planLimits.max_jobs === -1 ? Infinity : Math.max(0, planLimits.max_jobs - activeJobs),
            ...jobsStatus,
          },
          candidates: {
            used: totalCandidates,
            limit: planLimits.max_candidates,
            remaining: planLimits.max_candidates === -1 ? Infinity : Math.max(0, planLimits.max_candidates - totalCandidates),
            ...candidatesStatus,
          },
          teamMembers: {
            used: teamMembers,
            limit: planLimits.max_users,
            remaining: planLimits.max_users === -1 ? Infinity : Math.max(0, planLimits.max_users - teamMembers),
            ...usersStatus,
          },
        },
        hasWarnings: aiCreditsStatus.warning || jobsStatus.warning || candidatesStatus.warning || usersStatus.warning,
        hasBlocks: aiCreditsStatus.blocked || jobsStatus.blocked || candidatesStatus.blocked || usersStatus.blocked,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (error) {
    console.error("Error in get-usage-stats:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      }
    );
  }
});
