import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { SMTPClient } from "https://deno.land/x/denomailer@1.6.0/mod.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPER_ADMIN_EMAIL = "admin@hiremetrics.co.uk";

interface Participant {
  id: string;
  participant_type: string;
  email: string;
  name: string;
  role: string;
}

interface SendEventInvitationRequest {
  event_id: string;
  action: 'invite' | 'update' | 'cancel' | 'reminder';
  participant_ids?: string[];
}

interface SMTPConfig {
  host: string;
  port: number;
  username: string;
  password: string;
  use_tls: boolean;
  from_email: string;
  from_name: string;
}

// Generate ICS calendar file content
function generateICS(event: any, participants: Participant[], action: string): string {
  const formatDate = (date: Date): string => {
    return date.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
  };

  const escapeText = (text: string): string => {
    return (text || '').replace(/[,;\\]/g, '\\$&').replace(/\n/g, '\\n');
  };

  const startDate = new Date(event.start_time);
  const endDate = new Date(event.end_time);
  const now = new Date();
  
  const attendees = participants.map(p => 
    `ATTENDEE;CUTYPE=INDIVIDUAL;ROLE=REQ-PARTICIPANT;PARTSTAT=NEEDS-ACTION;RSVP=TRUE;CN=${escapeText(p.name)}:mailto:${p.email}`
  ).join('\r\n');

  const location = event.location_type === 'online' 
    ? event.meeting_link || 'Online Meeting'
    : event.location_address || '';

  const method = action === 'cancel' ? 'CANCEL' : 'REQUEST';
  const status = action === 'cancel' ? 'CANCELLED' : 'CONFIRMED';
  const sequence = action === 'update' ? '1' : '0';

  return `BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//HireMetrics//Event//EN
CALSCALE:GREGORIAN
METHOD:${method}
BEGIN:VTIMEZONE
TZID:${event.timezone}
END:VTIMEZONE
BEGIN:VEVENT
DTSTART:${formatDate(startDate)}
DTEND:${formatDate(endDate)}
DTSTAMP:${formatDate(now)}
UID:${event.id}@hiremetrics.co.uk
CREATED:${formatDate(new Date(event.created_at))}
LAST-MODIFIED:${formatDate(now)}
SEQUENCE:${sequence}
STATUS:${status}
SUMMARY:${escapeText(event.title)}
DESCRIPTION:${escapeText(event.description || '')}
LOCATION:${escapeText(location)}
${attendees}
ORGANIZER;CN=${escapeText(event.organizer_name)}:mailto:${event.organizer_email}
END:VEVENT
END:VCALENDAR`.replace(/\n/g, '\r\n');
}

// Generate modern HTML email content
function generateEmailHTML(
  event: any, 
  participant: Participant, 
  action: string, 
  organizerName: string,
  companyLogoUrl: string | null,
  companyName: string | null
): string {
  const startDate = new Date(event.start_time);
  const endDate = new Date(event.end_time);
  
  const formatTime = (date: Date, timezone: string) => {
    return date.toLocaleString('en-US', { 
      timeZone: timezone,
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    });
  };

  const formatDate = (date: Date, timezone: string) => {
    return date.toLocaleString('en-US', { 
      timeZone: timezone,
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  const eventTypeLabels: Record<string, string> = {
    interview: 'Interview',
    client_meeting: 'Client Meeting',
    internal_meeting: 'Internal Meeting',
    follow_up: 'Follow-up Call',
    custom: 'Event'
  };

  const eventTypeColors: Record<string, string> = {
    interview: '#059669',
    client_meeting: '#7c3aed',
    internal_meeting: '#0284c7',
    follow_up: '#d97706',
    custom: '#6366f1'
  };

  const actionColors: Record<string, { bg: string; text: string }> = {
    invite: { bg: '#0052CC', text: '#ffffff' },
    update: { bg: '#f59e0b', text: '#ffffff' },
    cancel: { bg: '#dc2626', text: '#ffffff' },
    reminder: { bg: '#8b5cf6', text: '#ffffff' }
  };

  const actionTitle = action === 'cancel' ? 'Event Cancelled' 
    : action === 'update' ? 'Event Updated' 
    : action === 'reminder' ? 'Event Reminder'
    : "You're Invited!";

  const actionMessage = action === 'cancel'
    ? `We regret to inform you that this event has been cancelled by <strong>${organizerName}</strong>.`
    : action === 'update'
    ? `<strong>${organizerName}</strong> has updated the event details. Please review the new information below.`
    : action === 'reminder'
    ? `This is a friendly reminder about your upcoming event with <strong>${organizerName}</strong>.`
    : `<strong>${companyName || organizerName}</strong> has invited you to an exciting event. We look forward to seeing you there!`;

  const actionColor = actionColors[action] || actionColors.invite;
  const eventTypeColor = eventTypeColors[event.event_type] || '#6366f1';
  const displayCompanyName = companyName || 'HireMetrics';
  const firstName = participant.name.split(' ')[0];

  const logoHTML = companyLogoUrl 
    ? `<img src="${companyLogoUrl}" alt="${displayCompanyName} Logo" style="max-height:50px;max-width:200px;object-fit:contain;display:block;margin:0 auto;border:0;" />`
    : `<table role="presentation" cellpadding="0" cellspacing="0"><tr><td style="background:linear-gradient(135deg,#00008B 0%,#0052CC 100%);border-radius:10px;padding:10px;"><svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 20V4a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/><rect width="20" height="14" x="2" y="6" rx="2"/></svg></td><td style="padding-left:10px;font-family:Segoe UI,Arial,sans-serif;font-weight:700;font-size:22px;"><span style="color:#00008B;">Hire</span><span style="color:#64748b;font-weight:500;">Metrics</span></td></tr></table>`;

  const meetingLinkButton = event.location_type === 'online' && event.meeting_link
    ? `<tr><td align="center" style="padding:20px 0;"><a href="${event.meeting_link}" style="display:inline-block;background:linear-gradient(135deg,#0052CC 0%,#0066FF 100%);color:#ffffff;text-decoration:none;padding:14px 32px;border-radius:8px;font-weight:600;font-size:16px;">Join Meeting</a></td></tr>`
    : '';

  const locationDisplay = event.location_type === 'online' 
    ? `<span style="color:#059669;font-weight:500;">Online Meeting</span>${event.meeting_link ? `<br/><a href="${event.meeting_link}" style="color:#0052CC;text-decoration:none;font-size:13px;">${event.meeting_link}</a>` : ''}`
    : `<span style="color:#374151;">${event.location_address || 'Location TBD'}</span>`;

  const descriptionBlock = event.description 
    ? `<tr><td style="padding:0 24px 24px;"><div style="background-color:#ffffff;border-radius:10px;padding:16px;border:1px solid #e2e8f0;"><div style="color:#64748b;font-size:12px;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:8px;">Details</div><div style="color:#475569;font-size:14px;line-height:1.6;">${event.description}</div></div></td></tr>`
    : '';

  const calendarNote = action !== 'cancel' 
    ? `<tr><td style="padding:0 40px 25px;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#eff6ff;border-radius:12px;border:1px solid #bfdbfe;"><tr><td style="padding:16px 20px;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td width="40" valign="top" style="font-size:24px;">📆</td><td style="padding-left:12px;"><p style="margin:0;color:#1e40af;font-size:14px;font-weight:600;">Add to your calendar</p><p style="margin:4px 0 0;color:#3b82f6;font-size:13px;">Open the attached .ics file to add this event to your calendar.</p></td></tr></table></td></tr></table></td></tr>`
    : '';

  const normalize = (s: string | null | undefined) => String(s || '').trim().toLowerCase();
  const showCompanyName = normalize(displayCompanyName) !== normalize(organizerName);
  const signatureHTML = showCompanyName 
    ? `<p style="margin:15px 0 0;color:#1e293b;font-size:15px;line-height:1.6;">Best regards,<br/><strong style="color:#00008B;">${organizerName}</strong><br/><span style="color:#64748b;font-size:13px;">${displayCompanyName}</span></p>`
    : `<p style="margin:15px 0 0;color:#1e293b;font-size:15px;line-height:1.6;">Best regards,<br/><strong style="color:#00008B;">${organizerName}</strong></p>`;

  return `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"><title>${actionTitle}: ${event.title}</title></head><body style="margin:0;padding:0;font-family:-apple-system,BlinkMacSystemFont,Segoe UI,Roboto,Helvetica Neue,Arial,sans-serif;background-color:#f1f5f9;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f1f5f9;"><tr><td align="center" style="padding:40px 20px;"><table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;background-color:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);"><tr><td style="padding:30px 40px;background:linear-gradient(180deg,#ffffff 0%,#f8fafc 100%);border-bottom:1px solid #e2e8f0;text-align:center;">${logoHTML}</td></tr><tr><td style="background:linear-gradient(135deg,${actionColor.bg} 0%,${actionColor.bg}dd 100%);padding:35px 40px;text-align:center;"><h1 style="margin:0;color:${actionColor.text};font-size:28px;font-weight:700;letter-spacing:-0.5px;">${actionTitle}</h1></td></tr><tr><td style="padding:40px;"><p style="margin:0 0 20px;color:#1e293b;font-size:18px;font-weight:600;">Hello ${firstName}!</p><p style="margin:0 0 30px;color:#475569;font-size:16px;line-height:1.7;">${actionMessage}</p><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:linear-gradient(145deg,#f8fafc 0%,#f1f5f9 100%);border-radius:16px;border:1px solid #e2e8f0;margin-bottom:30px;overflow:hidden;"><tr><td style="padding:20px 24px 0;"><span style="display:inline-block;background-color:${eventTypeColor}15;color:${eventTypeColor};padding:6px 14px;border-radius:20px;font-size:13px;font-weight:600;">${eventTypeLabels[event.event_type] || 'Event'}</span></td></tr><tr><td style="padding:16px 24px 8px;"><h2 style="margin:0;color:#0f172a;font-size:24px;font-weight:700;line-height:1.3;">${event.title}</h2></td></tr><tr><td style="padding:16px 24px 24px;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td style="padding:12px 0;border-bottom:1px solid #e2e8f0;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td width="40" valign="top"><div style="width:36px;height:36px;background-color:#dbeafe;border-radius:10px;text-align:center;line-height:36px;font-size:18px;">📅</div></td><td style="padding-left:12px;"><div style="color:#64748b;font-size:12px;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:4px;">Date</div><div style="color:#1e293b;font-size:15px;font-weight:500;">${formatDate(startDate, event.timezone)}</div></td></tr></table></td></tr><tr><td style="padding:12px 0;border-bottom:1px solid #e2e8f0;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td width="40" valign="top"><div style="width:36px;height:36px;background-color:#fce7f3;border-radius:10px;text-align:center;line-height:36px;font-size:18px;">⏰</div></td><td style="padding-left:12px;"><div style="color:#64748b;font-size:12px;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:4px;">Time</div><div style="color:#1e293b;font-size:15px;font-weight:500;">${formatTime(startDate, event.timezone)} - ${formatTime(endDate, event.timezone)}</div><div style="color:#94a3b8;font-size:12px;margin-top:2px;">${event.timezone}</div></td></tr></table></td></tr><tr><td style="padding:12px 0;border-bottom:1px solid #e2e8f0;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td width="40" valign="top"><div style="width:36px;height:36px;background-color:#dcfce7;border-radius:10px;text-align:center;line-height:36px;font-size:18px;">${event.location_type === 'online' ? '🌐' : '📍'}</div></td><td style="padding-left:12px;"><div style="color:#64748b;font-size:12px;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:4px;">Location</div><div style="font-size:15px;">${locationDisplay}</div></td></tr></table></td></tr><tr><td style="padding:12px 0;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td width="40" valign="top"><div style="width:36px;height:36px;background-color:#fef3c7;border-radius:10px;text-align:center;line-height:36px;font-size:18px;">👤</div></td><td style="padding-left:12px;"><div style="color:#64748b;font-size:12px;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:4px;">Organizer</div><div style="color:#1e293b;font-size:15px;font-weight:500;">${organizerName}</div></td></tr></table></td></tr></table></td></tr>${descriptionBlock}</table>${meetingLinkButton ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:25px;">${meetingLinkButton}</table>` : ''}${calendarNote}<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-top:1px solid #e2e8f0;padding-top:25px;"><tr><td><p style="margin:0 0 5px;color:#475569;font-size:15px;line-height:1.6;">Looking forward to connecting with you!</p>${signatureHTML}</td></tr></table></td></tr><tr><td style="background:linear-gradient(180deg,#f8fafc 0%,#f1f5f9 100%);padding:24px 40px;border-top:1px solid #e2e8f0;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center"><p style="margin:0 0 8px;color:#64748b;font-size:13px;">Powered by <strong style="color:#00008B;">HireMetrics</strong></p><p style="margin:0;color:#94a3b8;font-size:11px;">© ${new Date().getFullYear()} HireMetrics. All rights reserved.</p></td></tr></table></td></tr></table></td></tr></table></body></html>`;
}

// Send email via SMTP
async function sendViaSMTP(
  config: SMTPConfig,
  to: string,
  subject: string,
  html: string,
  icsContent?: string
): Promise<void> {
  const isDirectTLS = config.port === 465;
  
  console.log(`[SMTP] Sending from ${config.from_email} to ${to}`);

  const client = new SMTPClient({
    connection: {
      hostname: config.host,
      port: config.port,
      tls: isDirectTLS,
      auth: {
        username: config.username,
        password: config.password,
      },
    },
  });

  const emailOptions: any = {
    from: `${config.from_name} <${config.from_email}>`,
    to: [to],
    subject: subject,
    content: "Please view this email in an HTML-compatible client.",
    html: html,
  };

  if (icsContent) {
    emailOptions.attachments = [{
      filename: 'invite.ics',
      content: new TextEncoder().encode(icsContent),
      contentType: 'text/calendar; method=REQUEST',
      encoding: 'binary',
    }];
  }

  await client.send(emailOptions);
  await client.close();
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const body: SendEventInvitationRequest = await req.json();
    const { event_id, action, participant_ids } = body;

    console.log(`[SMTP] Processing ${action} for event ${event_id}`);

    // Fetch event details
    const { data: event, error: eventError } = await supabase
      .from('events')
      .select(`*, jobs(title)`)
      .eq('id', event_id)
      .single();

    if (eventError || !event) {
      throw new Error(`Event not found: ${eventError?.message}`);
    }

    // Fetch organizer details
    const { data: organizer } = await supabase
      .from('profiles')
      .select('full_name, email, tenant_id')
      .eq('id', event.organizer_id)
      .single();

    const organizerName = organizer?.full_name || 'Recruiter';
    const organizerEmail = organizer?.email || SUPER_ADMIN_EMAIL;
    const tenantId = organizer?.tenant_id || event.tenant_id;

    // Fetch tenant branding
    let companyLogoUrl: string | null = null;
    let companyName: string | null = null;

    const signLogoPath = async (path: string): Promise<string | null> => {
      // Emails can be opened days later, so use a longer expiry.
      const expiresIn = 60 * 60 * 24 * 30; // 30 days

      // Try common buckets.
      const buckets = ['documents', 'trusted-clients'];
      for (const bucket of buckets) {
        const { data } = await supabase.storage.from(bucket).createSignedUrl(path, expiresIn);
        if (data?.signedUrl) return data.signedUrl;
      }
      return null;
    };

    if (tenantId) {
      const { data: tenant } = await supabase
        .from('tenants')
        .select('logo_url, name')
        .eq('id', tenantId)
        .single();
      
      if (tenant) {
        companyLogoUrl = tenant.logo_url;
        companyName = tenant.name;
      }

      const { data: branding } = await supabase
        .from('branding_settings')
        .select('logo_url, company_name')
        .eq('tenant_id', tenantId)
        .single();

      if (branding) {
        companyLogoUrl = branding.logo_url || companyLogoUrl;
        companyName = branding.company_name || companyName;
      }

      // If logo is stored as a bare storage path, turn it into a signed URL.
      if (companyLogoUrl && !companyLogoUrl.startsWith('http') && !companyLogoUrl.includes('/storage/v1/object/')) {
        const signed = await signLogoPath(companyLogoUrl);
        if (signed) companyLogoUrl = signed;
      }
    }

    // Fetch participants
    let participantQuery = supabase
      .from('event_participants')
      .select('*')
      .eq('event_id', event_id);

    if (participant_ids && participant_ids.length > 0) {
      participantQuery = participantQuery.in('id', participant_ids);
    }

    const { data: eventParticipants, error: participantError } = await participantQuery;

    if (participantError) {
      throw new Error(`Failed to fetch participants: ${participantError.message}`);
    }

    // Resolve participant details
    const participants: Participant[] = [];
    for (const ep of eventParticipants || []) {
      let email = ep.external_email || '';
      let name = ep.external_name || '';

      if (ep.participant_type === 'user' && ep.user_id) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('email, full_name')
          .eq('id', ep.user_id)
          .single();
        if (profile) {
          email = profile.email || '';
          name = profile.full_name || '';
        }
      } else if (ep.participant_type === 'candidate' && ep.candidate_id) {
        const { data: candidate } = await supabase
          .from('candidates')
          .select('email, full_name')
          .eq('id', ep.candidate_id)
          .single();
        if (candidate) {
          email = candidate.email || '';
          name = candidate.full_name || '';
        }
      } else if (ep.participant_type === 'client' && ep.client_id) {
        const { data: client } = await supabase
          .from('clients')
          .select('contact_email, contact_name')
          .eq('id', ep.client_id)
          .single();
        if (client) {
          email = client.contact_email || '';
          name = client.contact_name || '';
        }
      }

      if (email) {
        participants.push({
          id: ep.id,
          participant_type: ep.participant_type,
          email,
          name: name || email.split('@')[0],
          role: ep.role,
        });
      }
    }

    if (participants.length === 0) {
      console.log('[SMTP] No participants with valid emails found');
      return new Response(
        JSON.stringify({ success: true, message: 'No participants with valid emails', sent: 0 }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get organizer's SMTP config or use system SMTP
    let smtpConfig: SMTPConfig;

    const { data: emailAccount } = await supabase
      .from('email_accounts')
      .select('*')
      .eq('user_id', event.organizer_id)
      .eq('tenant_id', tenantId)
      .eq('status', 'connected')
      .eq('provider', 'smtp')
      .order('is_default', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (emailAccount && emailAccount.smtp_host && emailAccount.smtp_user && emailAccount.smtp_password) {
      smtpConfig = {
        host: emailAccount.smtp_host,
        port: emailAccount.smtp_port || 587,
        username: emailAccount.smtp_user,
        password: emailAccount.smtp_password,
        use_tls: emailAccount.smtp_use_tls ?? true,
        from_email: emailAccount.from_email,
        from_name: emailAccount.display_name || organizerName,
      };
    } else {
      // Use system SMTP
      const host = Deno.env.get("SMTP_HOST") || "smtp.gmail.com";
      const port = parseInt(Deno.env.get("SMTP_PORT") || "587", 10);
      const user = Deno.env.get("SMTP_USER");
      const password = Deno.env.get("SMTP_PASSWORD");

      if (!user || !password) {
        throw new Error("No SMTP configuration available");
      }

      smtpConfig = {
        host,
        port,
        username: user,
        password,
        use_tls: port === 587,
        from_email: SUPER_ADMIN_EMAIL,
        from_name: organizerName,
      };
    }

    // Add organizer info to event for ICS generation
    const eventWithOrganizer = {
      ...event,
      organizer_name: organizerName,
      organizer_email: smtpConfig.from_email,
    };

    // Generate ICS content
    const icsContent = action !== 'cancel' ? generateICS(eventWithOrganizer, participants, action) : undefined;

    // Send emails
    let sentCount = 0;
    const errors: string[] = [];

    for (const participant of participants) {
      try {
        const emailHtml = generateEmailHTML(
          event,
          participant,
          action,
          organizerName,
          companyLogoUrl,
          companyName
        );

        const subjectPrefixes: Record<string, string> = {
          invite: '📅 ',
          update: '🔄 ',
          cancel: '❌ ',
          reminder: '⏰ ',
        };

        const subject = `${subjectPrefixes[action] || ''}${action === 'cancel' ? 'Cancelled: ' : ''}${event.title}`;

        await sendViaSMTP(smtpConfig, participant.email, subject, emailHtml, icsContent);

        // Update invitation sent timestamp
        await supabase
          .from('event_participants')
          .update({ invitation_sent_at: new Date().toISOString() })
          .eq('id', participant.id);

        sentCount++;
        console.log(`[SMTP] Email sent to ${participant.email}`);
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : 'Unknown error';
        console.error(`[SMTP] Failed to send to ${participant.email}:`, errorMsg);
        errors.push(`${participant.email}: ${errorMsg}`);
      }
    }

    console.log(`[SMTP] Event invitations sent: ${sentCount}/${participants.length}`);

    return new Response(
      JSON.stringify({
        success: true,
        message: `Invitations sent successfully`,
        sent: sentCount,
        total: participants.length,
        errors: errors.length > 0 ? errors : undefined,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('[SMTP] Error in send-event-invitation:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
