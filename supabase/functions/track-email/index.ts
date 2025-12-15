import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// 1x1 transparent pixel
const TRACKING_PIXEL = new Uint8Array([
  0x47, 0x49, 0x46, 0x38, 0x39, 0x61, 0x01, 0x00, 0x01, 0x00, 
  0x80, 0x00, 0x00, 0xff, 0xff, 0xff, 0x00, 0x00, 0x00, 0x21, 
  0xf9, 0x04, 0x01, 0x00, 0x00, 0x00, 0x00, 0x2c, 0x00, 0x00, 
  0x00, 0x00, 0x01, 0x00, 0x01, 0x00, 0x00, 0x02, 0x02, 0x44, 
  0x01, 0x00, 0x3b
]);

Deno.serve(async (req) => {
  const url = new URL(req.url);
  const emailId = url.searchParams.get('id');
  const type = url.searchParams.get('type') || 'open';

  if (!emailId) {
    return new Response('Missing email ID', { status: 400 });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get email info
    const { data: email, error: emailError } = await supabase
      .from('candidate_emails')
      .select('id, status, metadata')
      .eq('id', emailId)
      .maybeSingle();

    if (emailError || !email) {
      console.error('Email not found:', emailId);
      // Still return pixel to avoid errors
      return new Response(TRACKING_PIXEL, {
        headers: {
          'Content-Type': 'image/gif',
          'Cache-Control': 'no-store, no-cache, must-revalidate',
        },
      });
    }

    const now = new Date().toISOString();
    const currentMetadata = (email.metadata as Record<string, any>) || {};
    
    if (type === 'open') {
      // Track email open
      const opens = currentMetadata.opens || [];
      opens.push({
        timestamp: now,
        user_agent: req.headers.get('user-agent'),
        ip: req.headers.get('x-forwarded-for') || 'unknown',
      });

      await supabase
        .from('candidate_emails')
        .update({
          status: email.status === 'sent' ? 'opened' : email.status,
          metadata: {
            ...currentMetadata,
            opens,
            first_opened_at: currentMetadata.first_opened_at || now,
            last_opened_at: now,
            open_count: opens.length,
          },
        })
        .eq('id', emailId);

      console.log(`Email ${emailId} opened`);
    } else if (type === 'click') {
      // Track link click
      const linkUrl = url.searchParams.get('url');
      const clicks = currentMetadata.clicks || [];
      clicks.push({
        timestamp: now,
        url: linkUrl,
        user_agent: req.headers.get('user-agent'),
      });

      await supabase
        .from('candidate_emails')
        .update({
          metadata: {
            ...currentMetadata,
            clicks,
            first_clicked_at: currentMetadata.first_clicked_at || now,
            last_clicked_at: now,
            click_count: clicks.length,
          },
        })
        .eq('id', emailId);

      console.log(`Email ${emailId} link clicked: ${linkUrl}`);

      // Redirect to the actual URL
      if (linkUrl) {
        return Response.redirect(linkUrl, 302);
      }
    }

    // Return tracking pixel for open tracking
    return new Response(TRACKING_PIXEL, {
      headers: {
        'Content-Type': 'image/gif',
        'Cache-Control': 'no-store, no-cache, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0',
      },
    });
  } catch (error) {
    console.error('Error tracking email:', error);
    // Still return pixel to avoid breaking emails
    return new Response(TRACKING_PIXEL, {
      headers: {
        'Content-Type': 'image/gif',
        'Cache-Control': 'no-store',
      },
    });
  }
});
