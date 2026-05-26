import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import {
  sendTeamEmail,
  wrapOperationalEmail,
  emailHeading,
  emailParagraph,
  buildEmailButton,
  emailInfoBox,
  getOrgBranding,
} from "../_shared/smtp-sender.ts";
import { getAppBaseUrl } from "../_shared/app-url.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
  const authHeader = req.headers.get("Authorization") ?? "";

  try {
    const userClient = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authHeader } } });
    const admin = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });

    const { data: userRes } = await userClient.auth.getUser();
    const inviter = userRes?.user;
    if (!inviter) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { submission_id } = await req.json();
    if (!submission_id) {
      return new Response(JSON.stringify({ error: "submission_id required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Load submission with relations
    const { data: sub, error: subErr } = await admin
      .from("candidate_submissions")
      .select("id, tenant_id, client_org_id, submission_message, candidate_id, job_id")
      .eq("id", submission_id)
      .maybeSingle();
    if (subErr || !sub) {
      return new Response(JSON.stringify({ error: "Submission not found" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const [{ data: candidate }, { data: job }, { data: org }, { data: profile }] = await Promise.all([
      admin.from("candidates").select("first_name,last_name").eq("id", sub.candidate_id).maybeSingle(),
      admin.from("jobs").select("title").eq("id", sub.job_id).maybeSingle(),
      admin.from("client_organizations").select("name").eq("id", sub.client_org_id).maybeSingle(),
      admin.from("profiles").select("full_name,email").eq("id", inviter.id).maybeSingle(),
    ]);

    const candidateName = `${candidate?.first_name ?? ""} ${candidate?.last_name ?? ""}`.trim() || "a candidate";
    const jobTitle = job?.title ?? "an open role";
    const orgName = org?.name ?? "your organisation";
    const recruiterName = profile?.full_name || profile?.email || "Your recruiter";

    // Recipients
    const { data: recs } = await admin
      .from("submission_recipients")
      .select("client_user_id")
      .eq("submission_id", submission_id);

    const userIds = (recs ?? []).map((r: any) => r.client_user_id).filter(Boolean);
    if (userIds.length === 0) {
      return new Response(JSON.stringify({ error: "No recipients" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: portalUsers } = await admin
      .from("client_portal_users")
      .select("user_id, full_name, email")
      .in("user_id", userIds);

    const branding = await getOrgBranding(admin, sub.tenant_id);
    const portalUrl = `${getAppBaseUrl(req)}/client/submissions`;

    let sent = 0;
    const failed: string[] = [];

    for (const u of portalUsers ?? []) {
      if (!u.email) continue;
      try {
        const html = wrapOperationalEmail(`
          ${emailHeading(`New candidate submitted for your review`, 1)}
          ${emailParagraph(`<strong>${recruiterName}</strong> has submitted <strong>${candidateName}</strong> for the <strong>${jobTitle}</strong> role.`)}
          ${sub.submission_message
            ? emailInfoBox(`<div style="font-size:14px;color:#374151;white-space:pre-wrap;">${sub.submission_message}</div>`, "info")
            : ""}
          ${emailParagraph(`Open the secure client portal to review the AI assessment, branded CV, original CV, and respond with a decision or interview request.`)}
          <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:32px 0;">
            <tr><td align="center">${buildEmailButton("Review Submission", portalUrl)}</td></tr>
          </table>
          <p style="margin:0;font-family:Arial,sans-serif;font-size:12px;color:#9ca3af;text-align:center;line-height:1.6;">
            Sent on behalf of ${orgName} via HireMetrics.
          </p>
        `, branding);

        await sendTeamEmail({
          tenantId: sub.tenant_id,
          to: u.email,
          subject: `${candidateName} submitted for ${jobTitle}`,
          html,
          replyTo: profile?.email || undefined,
        });
        sent++;
      } catch (e) {
        console.error("[send-submission-email] failed", u.email, e);
        failed.push(u.email);
      }
    }

    // Activity log
    try {
      await admin.from("submission_activity").insert({
        submission_id,
        tenant_id: sub.tenant_id,
        client_org_id: sub.client_org_id,
        actor_user_id: inviter.id,
        actor_type: "internal",
        event_type: "submission_emailed",
        message: `Notification sent to ${sent} recipient${sent === 1 ? "" : "s"}`,
        metadata: { sent, failed },
      });
    } catch {}

    return new Response(JSON.stringify({ success: true, sent, failed }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    console.error("[send-submission-email] error", e);
    return new Response(JSON.stringify({ error: e?.message || "Unexpected error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
