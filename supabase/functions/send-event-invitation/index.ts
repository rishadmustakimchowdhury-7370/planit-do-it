import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { Resend } from "https://esm.sh/resend@2.0.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

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
PRODID:-//RecruitifyCRM//Event//EN
CALSCALE:GREGORIAN
METHOD:${method}
BEGIN:VTIMEZONE
TZID:${event.timezone}
END:VTIMEZONE
BEGIN:VEVENT
DTSTART:${formatDate(startDate)}
DTEND:${formatDate(endDate)}
DTSTAMP:${formatDate(now)}
UID:${event.id}@recruitifycrm.com
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

// Generate HTML email content
function generateEmailHTML(event: any, participant: Participant, action: string, organizerName: string): string {
  const startDate = new Date(event.start_time);
  const endDate = new Date(event.end_time);
  
  const formatDateTime = (date: Date, timezone: string) => {
    return date.toLocaleString('en-US', { 
      timeZone: timezone,
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      timeZoneName: 'short'
    });
  };

  const location = event.location_type === 'online' 
    ? `<a href="${event.meeting_link}" style="color: #0052CC;">${event.meeting_link || 'Online Meeting'}</a>`
    : event.location_address || 'TBD';

  const eventTypeLabels: Record<string, string> = {
    interview: 'Interview',
    client_meeting: 'Client Meeting',
    internal_meeting: 'Internal Meeting',
    follow_up: 'Follow-up Call',
    custom: 'Event'
  };

  const actionTitle = action === 'cancel' 
    ? 'Event Cancelled' 
    : action === 'update' 
    ? 'Event Updated' 
    : action === 'reminder'
    ? 'Event Reminder'
    : 'Event Invitation';

  const actionMessage = action === 'cancel'
    ? `This event has been cancelled by ${organizerName}.`
    : action === 'update'
    ? `This event has been updated by ${organizerName}. Please review the new details below.`
    : action === 'reminder'
    ? `This is a reminder for your upcoming event.`
    : `You have been invited to the following event by ${organizerName}.`;

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${actionTitle}: ${event.title}</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f5f5f5;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f5f5f5; padding: 40px 20px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
          <!-- Header -->
          <tr>
            <td style="background-color: ${action === 'cancel' ? '#dc2626' : '#0052CC'}; padding: 30px; text-align: center;">
              <h1 style="margin: 0; color: #ffffff; font-size: 24px; font-weight: 600;">${actionTitle}</h1>
            </td>
          </tr>
          
          <!-- Content -->
          <tr>
            <td style="padding: 30px;">
              <p style="margin: 0 0 20px; color: #374151; font-size: 16px; line-height: 1.5;">
                Hi ${participant.name.split(' ')[0]},
              </p>
              <p style="margin: 0 0 25px; color: #374151; font-size: 16px; line-height: 1.5;">
                ${actionMessage}
              </p>
              
              <!-- Event Card -->
              <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f8fafc; border-radius: 8px; border: 1px solid #e2e8f0; margin-bottom: 25px;">
                <tr>
                  <td style="padding: 20px;">
                    <h2 style="margin: 0 0 15px; color: #1e293b; font-size: 20px; font-weight: 600;">${event.title}</h2>
                    <table width="100%" cellpadding="0" cellspacing="0">
                      <tr>
                        <td style="padding: 8px 0; color: #64748b; font-size: 14px; width: 120px; vertical-align: top;">
                          <strong>Type:</strong>
                        </td>
                        <td style="padding: 8px 0; color: #374151; font-size: 14px;">
                          ${eventTypeLabels[event.event_type] || 'Event'}
                        </td>
                      </tr>
                      <tr>
                        <td style="padding: 8px 0; color: #64748b; font-size: 14px; width: 120px; vertical-align: top;">
                          <strong>Date & Time:</strong>
                        </td>
                        <td style="padding: 8px 0; color: #374151; font-size: 14px;">
                          ${formatDateTime(startDate, event.timezone)}<br>
                          to ${formatDateTime(endDate, event.timezone)}
                        </td>
                      </tr>
                      <tr>
                        <td style="padding: 8px 0; color: #64748b; font-size: 14px; width: 120px; vertical-align: top;">
                          <strong>Location:</strong>
                        </td>
                        <td style="padding: 8px 0; color: #374151; font-size: 14px;">
                          ${location}
                        </td>
                      </tr>
                      <tr>
                        <td style="padding: 8px 0; color: #64748b; font-size: 14px; width: 120px; vertical-align: top;">
                          <strong>Organizer:</strong>
                        </td>
                        <td style="padding: 8px 0; color: #374151; font-size: 14px;">
                          ${organizerName}
                        </td>
                      </tr>
                      ${event.description ? `
                      <tr>
                        <td style="padding: 8px 0; color: #64748b; font-size: 14px; width: 120px; vertical-align: top;">
                          <strong>Details:</strong>
                        </td>
                        <td style="padding: 8px 0; color: #374151; font-size: 14px;">
                          ${event.description}
                        </td>
                      </tr>
                      ` : ''}
                    </table>
                  </td>
                </tr>
              </table>
              
              ${action !== 'cancel' ? `
              <p style="margin: 0 0 15px; color: #64748b; font-size: 14px;">
                📅 Use the attached .ics file to add this event to your calendar.
              </p>
              ` : ''}
              
              <p style="margin: 25px 0 0; color: #64748b; font-size: 14px; line-height: 1.5;">
                Best regards,<br>
                <strong>${organizerName}</strong><br>
                RecruitifyCRM
              </p>
            </td>
          </tr>
          
          <!-- Footer -->
          <tr>
            <td style="background-color: #f8fafc; padding: 20px; text-align: center; border-top: 1px solid #e2e8f0;">
              <p style="margin: 0; color: #94a3b8; font-size: 12px;">
                This email was sent from RecruitifyCRM
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

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    
    if (!resendApiKey) {
      throw new Error("RESEND_API_KEY is not configured");
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const resend = new Resend(resendApiKey);

    const body: SendEventInvitationRequest = await req.json();
    const { event_id, action, participant_ids } = body;

    console.log(`Processing ${action} for event ${event_id}`);

    // Fetch event details
    const { data: event, error: eventError } = await supabase
      .from('events')
      .select(`
        *,
        jobs(title)
      `)
      .eq('id', event_id)
      .single();

    if (eventError || !event) {
      throw new Error(`Event not found: ${eventError?.message}`);
    }

    // Fetch organizer details
    const { data: organizer } = await supabase
      .from('profiles')
      .select('full_name, email')
      .eq('id', event.organizer_id)
      .single();

    const organizerName = organizer?.full_name || 'Recruiter';
    const organizerEmail = organizer?.email || 'noreply@recruitifycrm.com';

    // Fetch participants (without profiles join - fetch separately)
    let participantsQuery = supabase
      .from('event_participants')
      .select(`
        id,
        participant_type,
        role,
        candidate_id,
        client_id,
        user_id,
        external_name,
        external_email,
        candidates(full_name, email),
        clients(name, contact_email)
      `)
      .eq('event_id', event_id);

    if (participant_ids && participant_ids.length > 0) {
      participantsQuery = participantsQuery.in('id', participant_ids);
    }

    const { data: rawParticipants, error: participantsError } = await participantsQuery;

    if (participantsError) {
      throw new Error(`Failed to fetch participants: ${participantsError.message}`);
    }

    // Fetch user profiles separately for user-type participants
    const userIds = (rawParticipants || [])
      .filter((p: any) => p.participant_type === 'user' && p.user_id)
      .map((p: any) => p.user_id);
    
    let userProfiles: Record<string, { full_name: string; email: string }> = {};
    
    if (userIds.length > 0) {
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, full_name, email')
        .in('id', userIds);
      
      userProfiles = (profiles || []).reduce((acc: any, p: any) => {
        acc[p.id] = { full_name: p.full_name, email: p.email };
        return acc;
      }, {});
    }

    // Transform participants to a usable format
    const participants: Participant[] = (rawParticipants || []).map((p: any) => {
      let email = '';
      let name = '';

      if (p.participant_type === 'candidate' && p.candidates) {
        email = p.candidates.email;
        name = p.candidates.full_name;
      } else if (p.participant_type === 'client' && p.clients) {
        email = p.clients.contact_email || '';
        name = p.clients.name;
      } else if (p.participant_type === 'user' && p.user_id && userProfiles[p.user_id]) {
        email = userProfiles[p.user_id].email;
        name = userProfiles[p.user_id].full_name;
      } else if (p.participant_type === 'external') {
        email = p.external_email || '';
        name = p.external_name || 'Guest';
      }

      return {
        id: p.id,
        participant_type: p.participant_type,
        email,
        name,
        role: p.role
      };
    }).filter((p: Participant) => p.email);

    console.log(`Sending ${action} to ${participants.length} participants`);

    // Add organizer info to event for ICS generation
    const eventWithOrganizer = {
      ...event,
      organizer_name: organizerName,
      organizer_email: organizerEmail
    };

    // Generate ICS file
    const icsContent = generateICS(eventWithOrganizer, participants, action);
    const icsBase64 = btoa(icsContent);

    // Send emails to each participant
    const results = [];
    for (const participant of participants) {
      try {
        const htmlContent = generateEmailHTML(eventWithOrganizer, participant, action, organizerName);
        
        const subjectPrefix = action === 'cancel' 
          ? 'Cancelled: ' 
          : action === 'update' 
          ? 'Updated: ' 
          : action === 'reminder'
          ? 'Reminder: '
          : '';

        // Use verified recruitifycrm.com domain
        const fromEmail = `${organizerName} <info@recruitifycrm.com>`;
        
        console.log(`Sending email from: ${fromEmail} to: ${participant.email}`);
        
        const emailResult = await resend.emails.send({
          from: fromEmail,
          reply_to: organizerEmail,
          to: [participant.email],
          subject: `${subjectPrefix}${event.title}`,
          html: htmlContent,
          attachments: action !== 'cancel' ? [
            {
              filename: 'invite.ics',
              content: icsBase64
            }
          ] : undefined
        });
        
        console.log(`Email result:`, JSON.stringify(emailResult));

        // Update participant invitation status
        await supabase
          .from('event_participants')
          .update({ 
            invitation_sent_at: new Date().toISOString(),
            ...(action === 'reminder' && { 
              [`reminder_${participant_ids ? '1h' : '24h'}_sent`]: true 
            })
          })
          .eq('id', participant.id);

        results.push({ 
          participant_id: participant.id, 
          email: participant.email, 
          success: true 
        });

        console.log(`Email sent to ${participant.email}`);
      } catch (emailError: any) {
        console.error(`Failed to send to ${participant.email}:`, emailError);
        results.push({ 
          participant_id: participant.id, 
          email: participant.email, 
          success: false, 
          error: emailError.message 
        });
      }
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        sent_count: results.filter(r => r.success).length,
        failed_count: results.filter(r => !r.success).length,
        results 
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("Error in send-event-invitation:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
